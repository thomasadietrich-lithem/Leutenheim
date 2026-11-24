# =============================================================================
#  commun.ps1 - LTH Studio - pieces partagees par les outils de mise en ligne
#  (24/11/2026, demande de Thomas : meme structure et meme rigueur que NeuroVision).
#  - Profil "lth-deploy" = utilisateur lth-deployer, qui ne peut rien sans le code du telephone.
#  - Les jetons restent EN MEMOIRE ($Jetons), jamais sur le disque, et sont effaces a la fin.
#  Messages sans accents : PowerShell 5.1 les lirait mal.
# =============================================================================
$Profil        = 'lth-deploy'
$Region        = 'eu-west-3'
$CompteAttendu = '906515679954'              # compte AWS dedie LTH, jamais celui de l'association
$UserAttendu   = ':user/lth-deployer'
$Pile          = 'caveroller-stats'
$Racine  = Split-Path -Parent $PSScriptRoot
$AD      = Join-Path $Racine 'A_DEPLOYER'
$Journal = Join-Path $PSScriptRoot 'journal_deploiements.log'
$Tmp     = Join-Path $env:TEMP ('lth_tout_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$Jetons = @{}

function Ecrire([string]$t, [string]$c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Noter([string]$t) {
    Add-Content -Path $Journal -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $NomOutil + ' - ' + $t) -Encoding UTF8
}
function Effacer {
    $Jetons.Clear()
    Remove-Item -Recurse -Force -Path $Tmp -ErrorAction SilentlyContinue
}
function Arreter([string]$t) {
    Ecrire ''
    Ecrire ('ARRET : ' + $t) 'Red'
    Noter ('ARRET : ' + $t)
    Effacer
    exit 1
}
function Etape([string]$t) {
    Ecrire ''
    Ecrire '============================================================' 'Cyan'
    Ecrire ('  ' + $t) 'Cyan'
    Ecrire '============================================================' 'Cyan'
}

# Appel de l'AWS CLI. Role 'base' = profil lth-deploy (presque aucun droit) ; sinon les jetons en memoire.
function PoserVar([string]$nom, $val) {
    if ($null -eq $val -or [string]$val -eq '') { Remove-Item -Path ('Env:' + $nom) -ErrorAction SilentlyContinue }
    else { Set-Item -Path ('Env:' + $nom) -Value ([string]$val) }
}
function AppelAws([string[]]$Arguments, [string]$Role = 'base', [string]$Sortie = 'json') {
    $errFic = Join-Path $Tmp 'aws_err.txt'
    Remove-Item -Path $errFic -ErrorAction SilentlyContinue
    $ancien = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $sauve = @($env:AWS_ACCESS_KEY_ID, $env:AWS_SECRET_ACCESS_KEY, $env:AWS_SESSION_TOKEN, $env:AWS_PROFILE)
    try {
        PoserVar 'AWS_PROFILE' ''
        if ($Role -ne 'base') {
            $j = $Jetons[$Role]
            PoserVar 'AWS_ACCESS_KEY_ID' $j.AccessKeyId
            PoserVar 'AWS_SECRET_ACCESS_KEY' $j.SecretAccessKey
            PoserVar 'AWS_SESSION_TOKEN' $j.SessionToken
            $out = & aws @Arguments --region $Region --output $Sortie 2> $errFic
        } else {
            PoserVar 'AWS_ACCESS_KEY_ID' ''
            PoserVar 'AWS_SECRET_ACCESS_KEY' ''
            PoserVar 'AWS_SESSION_TOKEN' ''
            $out = & aws @Arguments --profile $Profil --region $Region --output $Sortie 2> $errFic
        }
        $code = $LASTEXITCODE
    } finally {
        PoserVar 'AWS_ACCESS_KEY_ID' $sauve[0]
        PoserVar 'AWS_SECRET_ACCESS_KEY' $sauve[1]
        PoserVar 'AWS_SESSION_TOKEN' $sauve[2]
        PoserVar 'AWS_PROFILE' $sauve[3]
        $ErrorActionPreference = $ancien
    }
    $err = ''
    if (Test-Path $errFic) { $err = [string](Get-Content -Raw -Path $errFic) }
    [pscustomobject]@{ Code = $code; Texte = (($out | ForEach-Object { "$_" }) -join "`n"); Erreur = $err }
}
function ErreurCourte([string]$e) {
    if (([string]$e) -match 'invalid MFA') { return 'code expire ou errone' }
    $l = @(([string]$e) -split "`r?`n" | Where-Object { $_ -match 'An error occurred|error' -and $_ -notmatch 'NativeCommandError|CategoryInfo|FullyQualifiedErrorId' })
    if ($l.Count -gt 0) { $t = $l[-1] } else { $t = ([string]$e).Trim() }
    $t = $t -replace '^\s*aws:\s*\[ERROR\]:\s*', ''
    return $t.Trim()
}
function LireCode([string]$invite) {
    for ($i = 0; $i -lt 3; $i++) {
        $c = ([string](Read-Host $invite)) -replace '\s', ''
        if ($c -match '^[0-9]{6}$') { return $c }
        Ecrire 'Il faut les 6 chiffres affiches par l''application.' 'DarkYellow'
    }
    Arreter 'Code a 6 chiffres non saisi. Rien n''a ete envoye.'
}

# UNE double verification (code du telephone), puis le role limite aux statistiques. Tout reste en memoire, 1 heure.
function OuvrirSession {
    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { Arreter 'AWS CLI introuvable sur ce PC.' }
    $r = AppelAws @('sts', 'get-caller-identity')
    if ($r.Code -ne 0) { Arreter ('Connexion AWS impossible avec le profil "' + $Profil + '". Si l''acces n''a jamais ete installe : Outils\INSTALLER_COMPTE.bat. Detail : ' + (ErreurCourte $r.Erreur)) }
    $id = $r.Texte | ConvertFrom-Json
    if ([string]$id.Account -ne $CompteAttendu) { Arreter ('Mauvais compte AWS : ' + $id.Account + ' au lieu du compte LTH ' + $CompteAttendu + '. Rien n''a ete fait.') }
    if (-not ([string]$id.Arn).EndsWith($UserAttendu)) { Arreter ('Le profil "' + $Profil + '" n''est pas lth-deployer : ' + $id.Arn) }
    Ecrire ('[ok] Compte LTH ' + $id.Account + ', connecte en tant que lth-deployer') 'Green'
    $serie = ''
    $r = AppelAws @('iam', 'list-mfa-devices', '--user-name', 'lth-deployer')
    if ($r.Code -eq 0 -and $r.Texte.Trim()) {
        $appareils = @(($r.Texte | ConvertFrom-Json).MFADevices)
        if ($appareils.Count -ge 1 -and $appareils[0]) { $serie = [string]$appareils[0].SerialNumber }
    }
    if (-not $serie) { Arreter 'Aucun appareil de double verification pour lth-deployer. Relance Outils\INSTALLER_COMPTE.bat. Rien n''a ete envoye.' }
    $nomApp = $serie.Split('/')[-1]
    Ecrire ('[..] Ouvre l''application d''authentification du telephone, ligne ' + $nomApp + '.') 'White'
    Ecrire '     (Si le code est refuse : heure du telephone en reglage automatique.)' 'DarkGray'
    $essai = 0
    while ($true) {
        $essai++
        $code = LireCode 'Code a 6 chiffres'
        $r = AppelAws @('sts', 'get-session-token', '--serial-number', $serie, '--token-code', $code, '--duration-seconds', '3600')
        if ($r.Code -eq 0) { break }
        $msg = ErreurCourte $r.Erreur
        if ($essai -ge 3) { Arreter ('Code refuse 3 fois (' + $msg + '). Verifie l''heure du telephone et la ligne ' + $nomApp + ' de l''application. Rien n''a ete envoye.') }
        Ecrire ('[!] Code refuse (' + $msg + ').') 'DarkYellow'
        Ecrire '    Attends que le code CHANGE sur le telephone, puis tape le nouveau des qu''il apparait.' 'DarkYellow'
    }
    $Jetons['session'] = ($r.Texte | ConvertFrom-Json).Credentials
    $arn = 'arn:aws:iam::' + $id.Account + ':role/lth-deploiement-stats'
    $nomSession = 'tout-' + (Get-Date -Format 'yyyyMMddHHmmss')
    $r = AppelAws @('sts', 'assume-role', '--role-arn', $arn, '--role-session-name', $nomSession, '--duration-seconds', '3600') 'session'
    if ($r.Code -ne 0) {
        Ecrire '[info] Il faut un code neuf. Attends que le code change sur le telephone.' 'DarkYellow'
        $code2 = LireCode 'Code SUIVANT a 6 chiffres'
        $r = AppelAws @('sts', 'assume-role', '--role-arn', $arn, '--role-session-name', $nomSession, '--duration-seconds', '3600', '--serial-number', $serie, '--token-code', $code2)
        if ($r.Code -ne 0) { Arreter ('Acces de mise en ligne refuse (' + (ErreurCourte $r.Erreur) + '). Rien n''a ete envoye.') }
    }
    $Jetons['stats'] = ($r.Texte | ConvertFrom-Json).Credentials
    Ecrire '[ok] Double verification acceptee (1 heure, jetons gardes en memoire seulement)' 'Green'
    Noter ('double verification OK (' + $nomApp + ')')
}

# Une valeur de sortie de la pile (vide si absente).
function SortiePile([string]$cle) {
    $r = AppelAws @('cloudformation', 'describe-stacks', '--stack-name', $Pile, '--query', ("Stacks[0].Outputs[?OutputKey=='" + $cle + "'].OutputValue | [0]")) 'stats' 'text'
    if ($r.Code -ne 0) { return '' }
    $v = $r.Texte.Trim()
    if ($v -eq 'None') { return '' }
    return $v
}
function Empreinte([string]$fichier, [string]$algo = 'SHA256') { return (Get-FileHash -Algorithm $algo -LiteralPath $fichier).Hash.ToLower() }
