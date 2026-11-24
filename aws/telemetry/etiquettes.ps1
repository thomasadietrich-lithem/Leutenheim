# Cave Roller - etiquettes des joueurs : associe un code joueur (5 signes, visible dans les Parametres du jeu)
# a un prenom, pour le tableau de bord. Les etiquettes sont gardees sur AWS (tags.json, derriere le mot de passe).
#   powershell -ExecutionPolicy Bypass -File etiquettes.ps1
# Le script ouvre le Bloc-notes : une ligne par joueur, "CODE = Prenom". Enregistrer, fermer : c'est envoye.
# (Messages sans accents : PowerShell 5.1 les lirait mal.)
$env:AWS_PROFILE = "lth"
$expected = "906515679954"
$region = "eu-west-3"
$stack = "caveroller-stats"

function Stop-Here([string] $message) {
  Write-Host ""
  Write-Host "ARRET : $message" -ForegroundColor Red
  exit 1
}

$account = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0) { Stop-Here "pas connecte a AWS. Tape : aws login --region eu-west-3 --profile lth   puis relance." }
if ("$account".Trim() -ne $expected) { Stop-Here "le profil lth ne pointe pas sur le compte LTH ($expected). Rien n'a ete fait." }
$bucket = "$(aws cloudformation describe-stacks --stack-name $stack --region $region --query "Stacks[0].Outputs[?OutputKey=='DashboardBucketName'].OutputValue" --output text)".Trim()
if (-not $bucket -or $bucket -eq "None") { Stop-Here "bucket du tableau de bord introuvable." }

$utf8 = New-Object Text.UTF8Encoding $false
$dir = Join-Path $env:TEMP "caveroller-etiquettes"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tagsFile = Join-Path $dir "tags.json"
$dataFile = Join-Path $dir "data.json"
$editFile = Join-Path $dir "etiquettes.txt"
Remove-Item $tagsFile, $dataFile -ErrorAction SilentlyContinue

# Les etiquettes deja posees (s'il y en a) et les joueurs connus.
aws s3 cp "s3://$bucket/tags.json" $tagsFile --region $region --only-show-errors 2>$null | Out-Null
aws s3 cp "s3://$bucket/data.json" $dataFile --region $region --only-show-errors 2>$null | Out-Null
$tags = @{}
if (Test-Path $tagsFile) {
  $old = [IO.File]::ReadAllText($tagsFile, $utf8) | ConvertFrom-Json
  foreach ($p in $old.PSObject.Properties) { $tags[$p.Name] = [string]$p.Value }
}
$known = @{}
if (Test-Path $dataFile) {
  $data = [IO.File]::ReadAllText($dataFile, $utf8) | ConvertFrom-Json
  foreach ($r in $data.runs) {
    if (-not $r.device) { continue }
    if (-not $known.ContainsKey($r.device)) { $known[$r.device] = @{ n = 0; last = "" } }
    $known[$r.device].n++
    if ([string]$r.day -gt $known[$r.device].last) { $known[$r.device].last = [string]$r.day }
  }
}

$lines = @(
  "# Etiquettes des joueurs de Cave Roller.",
  "# Une ligne par joueur :   CODE = Prenom",
  "# Pour etiqueter un joueur de la liste du bas : enleve le # du debut et ecris son prenom apres le =",
  "# Pour retirer une etiquette : efface sa ligne.",
  "# Enregistre (Ctrl + S) puis ferme le Bloc-notes.",
  ""
)
foreach ($c in ($tags.Keys | Sort-Object)) { $lines += "$c = $($tags[$c])" }
$lines += ""
$lines += "# Joueurs sans etiquette :"
foreach ($c in ($known.Keys | Sort-Object)) {
  if (-not $tags.ContainsKey($c)) { $lines += "# $c =            ($($known[$c].n) parties, derniere le $($known[$c].last))" }
}
[IO.File]::WriteAllLines($editFile, $lines, (New-Object Text.UTF8Encoding $true))

Write-Host "Le Bloc-notes s'ouvre. Modifie, enregistre (Ctrl + S), puis ferme-le."
Start-Process notepad.exe -ArgumentList "`"$editFile`"" -Wait

$new = [ordered]@{}
$n = 0
foreach ($line in [IO.File]::ReadAllLines($editFile, $utf8)) {
  $n++
  $t = $line.Trim().TrimStart([char]0xFEFF)
  if (-not $t -or $t.StartsWith("#")) { continue }
  if ($t -notmatch '^([A-Za-z2-9]{5})\s*=\s*(.+)$') { Stop-Here "ligne $n incomprise : $t    (forme attendue : CODE = Prenom). Rien n'a ete envoye." }
  $code = $Matches[1].ToUpper()
  $name = ($Matches[2] -replace '\(\d+ parties.*$', '').Trim()
  if (-not $name) { Stop-Here "ligne $n : il manque le prenom apres le =. Rien n'a ete envoye." }
  if ($name.Length -gt 30) { $name = $name.Substring(0, 30) }
  $new[$code] = $name
}

if ($new.Count -eq 0) { $json = "{}" } else { $json = ($new | ConvertTo-Json) }
[IO.File]::WriteAllText($tagsFile, $json, $utf8)
aws s3 cp $tagsFile "s3://$bucket/tags.json" --region $region --content-type "application/json; charset=utf-8" --cache-control no-store --only-show-errors
if ($LASTEXITCODE -ne 0) { Stop-Here "l'envoi a echoue." }
Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "C'EST FAIT : $($new.Count) etiquette(s) enregistree(s)." -ForegroundColor Green
foreach ($c in $new.Keys) { Write-Host "  $c = $($new[$c])" }
Write-Host "Recharge le tableau de bord pour les voir."
