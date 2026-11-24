# Cave Roller - installe ou met a jour les statistiques sur AWS depuis Windows (PowerShell), sans Git.
# Meme travail que deploy.sh. A lancer depuis ce dossier :
#   powershell -ExecutionPolicy Bypass -File installer.ps1
# L'adresse de courriel et le mot de passe sont demandes ici : ils ne sont ecrits nulle part ailleurs que chez AWS.
# (Messages sans accents : PowerShell 5.1 les lirait mal.)
param([switch] $Changer)   # -Changer : redemande le courriel des alertes et le mot de passe du tableau de bord
$env:AWS_PROFILE = "lth"                 # compte dedie LTH, jamais celui de l'association
$expected = "906515679954"
$region = "eu-west-3"                    # Paris
$stack = "caveroller-stats"
$here = $PSScriptRoot

function Stop-Here([string] $message) {
  Write-Host ""
  Write-Host "ARRET : $message" -ForegroundColor Red
  exit 1
}

# Garde-fou : on n'installe que sur le compte LTH.
$account = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0) { Stop-Here "pas connecte a AWS. Tape : aws login --region eu-west-3 --profile lth   puis relance." }
$account = "$account".Trim()
if ($account -ne $expected) { Stop-Here "le profil lth pointe sur le compte $account, pas sur le compte LTH ($expected). Rien n'a ete fait." }
Write-Host "Compte AWS : $account (LTH), region $region." -ForegroundColor Green

# Un compte AWS neuf n'a droit qu'a 10 appels simultanes au total et refuse qu'on en reserve : on s'adapte.
$limit = (aws lambda get-account-settings --region $region --query "AccountLimit.ConcurrentExecutions" --output text)
if ($LASTEXITCODE -ne 0) { Stop-Here "impossible de lire les limites du compte." }
$limit = [int]"$limit".Trim()
$reserve = 0
if ($limit -ge 105) { $reserve = 5 }
Write-Host "Appels simultanes autorises sur ce compte : $limit (reserve pour les statistiques : $reserve)."
$overrides = @("MaxConcurrency=$reserve")

# Premiere installation : d'abord les statistiques seules. Le tableau de bord en ligne vient au passage suivant,
# pour qu'un refus d'AWS sur la page n'annule pas tout le reste.
aws cloudformation describe-stacks --stack-name $stack --region $region --query "Stacks[0].StackStatus" --output text 2>$null | Out-Null
$first = ($LASTEXITCODE -ne 0)

# Ce qui est deja regle chez AWS n'est pas redemande (sauf avec -Changer).
function Test-Resource([string] $id) {
  aws cloudformation describe-stack-resource --stack-name $stack --region $region --logical-resource-id $id --query "StackResourceDetail.ResourceStatus" --output text 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}
$hasEmail = $false
$hasPassword = $false
if (-not $first) { $hasEmail = Test-Resource "BreakerEmail"; $hasPassword = Test-Resource "DashboardDistribution" }
$email = ""
if ($Changer -or -not $hasEmail) {
  $email = (Read-Host "Adresse de courriel pour les alertes (Entree pour ne rien changer)").Trim()
  if ($email) {
    if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Stop-Here "cette adresse n'a pas la forme d'une adresse de courriel. Rien n'a ete fait." }
    $overrides += "AlertEmail=$email"
  }
} else {
  Write-Host "Courriel des alertes : deja regle."
}
if ($first) {
  Write-Host "Premiere installation : le mot de passe du tableau de bord sera demande au passage suivant."
} elseif ($hasPassword -and -not $Changer) {
  Write-Host "Mot de passe du tableau de bord : deja regle."
} else {
  Write-Host "Mot de passe du tableau de bord : 12 caracteres au moins, lettres et chiffres seulement."
  Write-Host "Rien ne s'affiche pendant la frappe. Entree seule = ne rien changer."
  $s1 = Read-Host "Mot de passe" -AsSecureString
  $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
  if ($p1) {
    $s2 = Read-Host "Encore une fois" -AsSecureString
    $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
    if ($p1 -cne $p2) { Stop-Here "les deux mots de passe sont differents. Rien n'a ete fait." }
    if ($p1 -notmatch '^[A-Za-z0-9]{12,}$') { Stop-Here "il faut au moins 12 caracteres, lettres et chiffres seulement. Rien n'a ete fait." }
    $overrides += "DashboardPassword=$p1"
  }
}

Write-Host ""
Write-Host "Installation en cours (5 a 10 minutes la premiere fois, ne ferme pas la fenetre)..."
$deploy = @("cloudformation", "deploy", "--template-file", (Join-Path $here "cloudformation.yaml"), "--stack-name", $stack,
  "--capabilities", "CAPABILITY_IAM", "--region", $region, "--no-fail-on-empty-changeset")
$deploy += "--parameter-overrides"; $deploy += $overrides
& aws @deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "L'installation a echoue. Voici ce qu'AWS a refuse :" -ForegroundColor Red
  aws cloudformation describe-stack-events --stack-name $stack --region $region --max-items 60 --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId, ResourceStatusReason]" --output text
  Stop-Here "copie tout ce qui est affiche ci-dessus et envoie-le a Claude."
}

function Get-Output([string] $key) {
  $value = (aws cloudformation describe-stacks --stack-name $stack --region $region --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" --output text)
  return "$value".Trim()
}

# La page du tableau de bord, puis un premier calcul des chiffres.
$bucket = Get-Output "DashboardBucketName"
if (-not $bucket -or $bucket -eq "None") { Stop-Here "bucket du tableau de bord introuvable apres l'installation." }
aws s3 cp (Join-Path $here "dashboard\index.html") "s3://$bucket/index.html" --region $region --content-type "text/html; charset=utf-8" --cache-control no-store --only-show-errors
if ($LASTEXITCODE -ne 0) { Stop-Here "la page du tableau de bord n'a pas pu etre envoyee." }
aws s3 cp (Join-Path $here "dashboard\logo_studio.png") "s3://$bucket/logo_studio.png" --region $region --only-show-errors
aws s3 cp (Join-Path $here "dashboard\logo_titre.png") "s3://$bucket/logo_titre.png" --region $region --only-show-errors
$tmp = Join-Path $env:TEMP "caveroller-bilan.json"
aws lambda invoke --function-name caveroller-stats-bilan --region $region $tmp --query StatusCode --output text | Out-Null
if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) { Write-Host ("Chiffres du tableau de bord recalcules : " + (Get-Content $tmp -Raw)) } else { Write-Host "Le premier calcul des chiffres n'a pas marche (a signaler a Claude)." -ForegroundColor Yellow }
Remove-Item $tmp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "C'EST PRET." -ForegroundColor Green
Write-Host "Adresse des statistiques (a envoyer a Claude) :"
Write-Host ("  " + (Get-Output "StatsUrl"))
$dash = Get-Output "DashboardUrl"
if ($dash -and $dash -ne "None") {
  Write-Host "Tableau de bord (utilisateur : lth, mot de passe : celui que tu viens de choisir) :"
  Write-Host "  $dash"
  Write-Host "La premiere mise en ligne peut demander quelques minutes."
} else {
  Write-Host "Tableau de bord : pas encore en ligne. Relance ce script pour choisir son mot de passe." -ForegroundColor Yellow
}
if ($email) { Write-Host "Alertes : AWS t'envoie un courriel de confirmation, clique sur le lien dedans." }
