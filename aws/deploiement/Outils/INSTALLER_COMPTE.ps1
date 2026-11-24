# =============================================================================
#  INSTALLER_COMPTE.ps1 - LTH Studio - a lancer UNE SEULE FOIS (24/11/2026)
#  Cree l'acces de mise en ligne, sur le modele de NeuroVision :
#   - utilisateur "lth-deployer" (profil "lth-deploy" sur ce PC) : ne peut RIEN faire sans le code du telephone ;
#   - role "lth-deploiement-stats" : limite aux statistiques de Cave Roller, 1 heure a la fois ;
#   - plafond de droits "lth-limite-fonctions" sur toutes les fonctions.
#  C'est la DERNIERE fois que le compte root sert : connexion par le navigateur, deconnexion a la fin.
#  Peut etre relance sans risque (il ne refait que ce qui manque).
#  Messages sans accents : PowerShell 5.1 les lirait mal.
# =============================================================================
$NomOutil = 'COMPTE'
. (Join-Path $PSScriptRoot 'commun.ps1')
$Root = 'lth'      # profil du compte root (connexion par le navigateur)
$PileAcces = 'lth-acces'

function Aws-Root([string[]]$Arguments, [string]$Sortie = 'json') {
    $errFic = Join-Path $Tmp 'root_err.txt'
    Remove-Item -Path $errFic -ErrorAction SilentlyContinue
    $ancien = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & aws @Arguments --profile $Root --region $Region --output $Sortie 2> $errFic; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $ancien }
    $err = ''; if (Test-Path $errFic) { $err = [string](Get-Content -Raw -Path $errFic) }
    [pscustomobject]@{ Code = $code; Texte = (($out | ForEach-Object { "$_" }) -join "`n"); Erreur = $err }
}
function Deconnecter { & aws logout --profile $Root 2>$null | Out-Null }

Ecrire '============================================================' 'Cyan'
Ecrire '  LTH Studio - installation de l''acces de mise en ligne (une seule fois)' 'Cyan'
Ecrire '============================================================' 'Cyan'
Noter 'debut'
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { Arreter 'AWS CLI introuvable sur ce PC.' }

try {
    Etape '1/4  Connexion au compte root (navigateur, derniere fois)'
    Ecrire 'Le navigateur s''ouvre : connecte-toi au compte AWS de LTH (adresse du compte, mot de passe, code MFA).' 'White'
    & aws login --region $Region --profile $Root
    if ($LASTEXITCODE -ne 0) { Arreter 'Connexion annulee ou echouee. Rien n''a ete fait.' }
    $r = Aws-Root @('sts', 'get-caller-identity')
    if ($r.Code -ne 0) { Arreter ('Connexion illisible : ' + (ErreurCourte $r.Erreur)) }
    $id = $r.Texte | ConvertFrom-Json
    if ([string]$id.Account -ne $CompteAttendu) { Deconnecter; Arreter ('Mauvais compte AWS : ' + $id.Account + ' au lieu du compte LTH ' + $CompteAttendu + '. Rien n''a ete fait.') }
    Ecrire ('[ok] Compte LTH ' + $id.Account) 'Green'
    $r = Aws-Root @('iam', 'get-account-summary', '--query', 'SummaryMap.AccountMFAEnabled') 'text'
    if ($r.Code -eq 0 -and $r.Texte.Trim() -eq '1') { Ecrire '[ok] Le compte root a bien une double verification (MFA)' 'Green' }
    else { Ecrire '[ATTENTION] Le compte root n''a PAS de double verification (MFA). A activer aujourd''hui sur le site AWS.' 'Red'; Noter 'root SANS MFA' }
    $r = Aws-Root @('iam', 'get-account-summary', '--query', 'SummaryMap.AccountAccessKeysPresent') 'text'
    if ($r.Code -eq 0 -and $r.Texte.Trim() -ne '0') { Ecrire '[ATTENTION] Le compte root a une cle d''acces. A supprimer sur le site AWS (Informations d''identification de securite).' 'Red'; Noter 'root AVEC cle d''acces' }

    Etape '2/4  Utilisateur, role et plafond de droits'
    $r = Aws-Root @('cloudformation', 'deploy', '--template-file', (Join-Path $PSScriptRoot 'acces.yaml'), '--stack-name', $PileAcces,
        '--capabilities', 'CAPABILITY_NAMED_IAM', '--no-fail-on-empty-changeset') 'text'
    if ($r.Code -ne 0) {
        $d = Aws-Root @('cloudformation', 'describe-stack-events', '--stack-name', $PileAcces, '--max-items', '30', '--query', "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId, ResourceStatusReason]") 'text'
        Ecrire $d.Texte 'DarkYellow'
        Deconnecter
        Arreter ('Creation de l''acces refusee (' + (ErreurCourte $r.Erreur) + '). Copie tout ce qui est affiche pour Claude.')
    }
    Ecrire '[ok] lth-deployer, lth-deploiement-stats et lth-limite-fonctions sont en place' 'Green'

    Etape '3/4  Double verification de lth-deployer (application du telephone)'
    $r = Aws-Root @('iam', 'list-mfa-devices', '--user-name', 'lth-deployer', '--query', 'MFADevices[0].SerialNumber') 'text'
    $serie = $r.Texte.Trim()
    if ($r.Code -eq 0 -and $serie -and $serie -ne 'None') {
        Ecrire ('[ok] Deja en place : ' + $serie.Split('/')[-1]) 'Green'
    } else {
        $qr = Join-Path $Tmp 'code_a_scanner.png'
        $nom = 'lth-deployer'
        $r = Aws-Root @('iam', 'create-virtual-mfa-device', '--virtual-mfa-device-name', $nom, '--outfile', $qr, '--bootstrap-method', 'QRCodePNG', '--query', 'VirtualMFADevice.SerialNumber') 'text'
        if ($r.Code -ne 0 -and $r.Erreur -match 'EntityAlreadyExists') {
            # Un essai precedent s'est arrete en route : on repart d'un appareil neuf.
            Aws-Root @('iam', 'delete-virtual-mfa-device', '--serial-number', ('arn:aws:iam::' + $CompteAttendu + ':mfa/' + $nom)) 'text' | Out-Null
            $r = Aws-Root @('iam', 'create-virtual-mfa-device', '--virtual-mfa-device-name', $nom, '--outfile', $qr, '--bootstrap-method', 'QRCodePNG', '--query', 'VirtualMFADevice.SerialNumber') 'text'
        }
        if ($r.Code -ne 0) { Deconnecter; Arreter ('Creation de l''appareil refusee (' + (ErreurCourte $r.Erreur) + ').') }
        $serie = $r.Texte.Trim()
        Ecrire 'Une image s''ouvre avec un code a scanner.' 'White'
        Ecrire 'Dans l''application d''authentification du telephone : ajouter un compte, scanner le code.' 'White'
        Ecrire 'Une ligne "lth-deployer" apparait. Ne montre cette image a personne.' 'White'
        Start-Process $qr
        $ok = $false
        for ($i = 0; $i -lt 3 -and -not $ok; $i++) {
            $c1 = LireCode 'Premier code a 6 chiffres'
            Ecrire 'Attends que le code CHANGE sur le telephone.' 'DarkGray'
            $c2 = LireCode 'Code SUIVANT a 6 chiffres'
            $r = Aws-Root @('iam', 'enable-mfa-device', '--user-name', 'lth-deployer', '--serial-number', $serie, '--authentication-code1', $c1, '--authentication-code2', $c2) 'text'
            if ($r.Code -eq 0) { $ok = $true } else { Ecrire ('[!] Codes refuses (' + (ErreurCourte $r.Erreur) + '). On recommence avec deux codes neufs.') 'DarkYellow' }
        }
        Remove-Item -Force -Path $qr -ErrorAction SilentlyContinue
        if (-not $ok) { Deconnecter; Arreter 'Double verification non activee. Relance cet outil pour recommencer.' }
        Ecrire '[ok] Double verification activee pour lth-deployer. Ferme l''image du code.' 'Green'
        Noter 'MFA de lth-deployer active'
    }

    Etape '4/4  Cle de lth-deployer sur ce PC (inutilisable sans le code du telephone)'
    $bon = $false
    $t = AppelAws @('sts', 'get-caller-identity')
    if ($t.Code -eq 0 -and ([string]($t.Texte | ConvertFrom-Json).Arn).EndsWith($UserAttendu)) { $bon = $true }
    if ($bon) {
        Ecrire '[ok] Deja en place sur ce PC' 'Green'
    } else {
        # Les anciennes cles (PC change, essai interrompu) sont retirees : une seule cle vivante.
        $r = Aws-Root @('iam', 'list-access-keys', '--user-name', 'lth-deployer', '--query', 'AccessKeyMetadata[].AccessKeyId') 'text'
        foreach ($k in @($r.Texte -split '\s+' | Where-Object { $_ -match '^AKIA' })) {
            Aws-Root @('iam', 'delete-access-key', '--user-name', 'lth-deployer', '--access-key-id', $k) 'text' | Out-Null
        }
        $r = Aws-Root @('iam', 'create-access-key', '--user-name', 'lth-deployer')
        if ($r.Code -ne 0) { Deconnecter; Arreter ('Creation de la cle refusee (' + (ErreurCourte $r.Erreur) + ').') }
        $cle = ($r.Texte | ConvertFrom-Json).AccessKey
        & aws configure set aws_access_key_id $cle.AccessKeyId --profile $Profil
        & aws configure set aws_secret_access_key $cle.SecretAccessKey --profile $Profil
        & aws configure set region $Region --profile $Profil
        $cle = $null; $r = $null
        Start-Sleep -Seconds 10      # le temps qu'AWS reconnaisse la nouvelle cle
        $t = AppelAws @('sts', 'get-caller-identity')
        if ($t.Code -ne 0) { Start-Sleep -Seconds 15; $t = AppelAws @('sts', 'get-caller-identity') }
        if ($t.Code -ne 0 -or -not ([string]($t.Texte | ConvertFrom-Json).Arn).EndsWith($UserAttendu)) { Deconnecter; Arreter ('La cle posee sur ce PC ne repond pas (' + (ErreurCourte $t.Erreur) + '). Relance cet outil.') }
        Ecrire '[ok] Cle posee sur ce PC (profil lth-deploy). Elle ne s''affiche nulle part.' 'Green'
        Noter 'cle de lth-deployer posee'
    }

    Deconnecter
    Ecrire ''
    Ecrire '[ok] Compte root deconnecte de ce PC.' 'Green'
    Ecrire ''
    Ecrire 'ACCES INSTALLE. Lance maintenant TOUT_DEPLOYER.bat (racine du dossier).' 'Green'
    Ecrire 'Pense a te deconnecter aussi du site AWS dans le navigateur.' 'White'
    Noter 'TERMINE'
} finally {
    Effacer
}
exit 0
