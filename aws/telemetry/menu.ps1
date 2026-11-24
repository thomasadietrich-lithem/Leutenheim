# Cave Roller - menu des statistiques sur AWS (LTH Studio). Lance par "Cave Roller - AWS.cmd".
# Securite : chaque action qui touche au compte AWS commence par une connexion neuve dans le navigateur
# (mot de passe + code MFA) et se termine par une deconnexion. Aucun acces AWS ne reste sur le PC entre deux usages.
# (Messages sans accents : PowerShell 5.1 les lirait mal.)
$profile_ = "lth"
$region = "eu-west-3"
$dashboard = "https://d3v9udafuu3xtd.cloudfront.net/"
$here = $PSScriptRoot
$root = Split-Path $here -Parent

# Rangement : retire les fichiers de l'ancienne organisation du dossier (remplaces par ce menu et le dossier "systeme").
$old = @("1 - Mettre a jour AWS.cmd", "2 - Etiquettes des joueurs.cmd", "3 - Ouvrir le tableau de bord.cmd",
  "4 - Changer courriel ou mot de passe.cmd", "installer.ps1", "etiquettes.ps1", "cloudformation.yaml",
  "dashboard\index.html", "dashboard\logo_studio.png", "dashboard\logo_titre.png")
foreach ($name in $old) {
  $path = Join-Path $root $name
  if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
}
$oldDir = Join-Path $root "dashboard"
if ((Test-Path -LiteralPath $oldDir) -and -not (Get-ChildItem -LiteralPath $oldDir -Force)) { Remove-Item -LiteralPath $oldDir -Force -ErrorAction SilentlyContinue }

function Disconnect-Aws {
  aws logout --profile $profile_ 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "Deconnecte d'AWS : aucun acces ne reste sur ce PC." -ForegroundColor Green }
  else { Write-Host "ATTENTION : la deconnexion d'AWS n'a pas marche. Signale-le a Claude." -ForegroundColor Yellow }
}

function Connect-Aws {
  aws logout --profile $profile_ 2>$null | Out-Null
  Write-Host ""
  Write-Host "Connexion a AWS : le navigateur s'ouvre. Connecte-toi au compte LTH (mot de passe + code MFA)."
  Write-Host "Si le navigateur propose une session deja ouverte sans demander le code, refuse-la et reconnecte-toi."
  aws login --region $region --profile $profile_
  return ($LASTEXITCODE -eq 0)
}

function Invoke-Install([switch] $Changer) {
  if (-not (Connect-Aws)) { Write-Host "Connexion annulee ou echouee. Rien n'a ete fait." -ForegroundColor Red; return }
  try {
    if ($Changer) { & (Join-Path $here "installer.ps1") -Changer } else { & (Join-Path $here "installer.ps1") }
  } finally {
    Disconnect-Aws
  }
}

while ($true) {
  Write-Host ""
  Write-Host "=== Cave Roller - statistiques des joueurs (LTH Studio) ===" -ForegroundColor Cyan
  Write-Host "  1  Mettre a jour AWS (apres un changement annonce par Claude)"
  Write-Host "  2  Ouvrir le tableau de bord"
  Write-Host "  3  Changer le courriel des alertes ou le mot de passe du tableau de bord"
  Write-Host "  4  Se deconnecter d'AWS maintenant"
  Write-Host "  Q  Quitter"
  $choice = (Read-Host "Ton choix").Trim().ToUpper()
  switch ($choice) {
    "1" { Invoke-Install }
    "2" { Start-Process $dashboard }
    "3" { Invoke-Install -Changer }
    "4" { Disconnect-Aws }
    "Q" { exit 0 }
    default { Write-Host "Choix inconnu." }
  }
}
