# =============================================================================
#  CHANGER_REGLAGES.ps1 - LTH Studio - courriel des alertes et mot de passe du tableau de bord
#  (24/11/2026). Meme double verification que TOUT_DEPLOYER. Les deux valeurs partent chez AWS
#  et ne sont ecrites nulle part ailleurs (ni dans ce dossier, ni dans le journal).
#  Messages sans accents : PowerShell 5.1 les lirait mal.
# =============================================================================
$NomOutil = 'REGLAGES'
. (Join-Path $PSScriptRoot 'commun.ps1')

Ecrire '============================================================' 'Cyan'
Ecrire '  LTH Studio - changer le courriel des alertes ou le mot de passe du tableau de bord' 'Cyan'
Ecrire '============================================================' 'Cyan'
Noter 'debut'
try {
    $reglages = @()
    $courriel = ([string](Read-Host 'Nouveau courriel des alertes (Entree = ne pas changer)')).Trim()
    if ($courriel) {
        if ($courriel -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Arreter 'Cette adresse n''a pas la forme d''une adresse de courriel. Rien n''a ete fait.' }
        $reglages += ('AlertEmail=' + $courriel)
    }
    Ecrire 'Nouveau mot de passe du tableau de bord : 12 signes au moins, lettres et chiffres seulement.' 'White'
    Ecrire 'Rien ne s''affiche pendant la frappe. Entree seule = ne pas changer.' 'DarkGray'
    $s1 = Read-Host 'Mot de passe' -AsSecureString
    $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
    if ($p1) {
        $s2 = Read-Host 'Encore une fois' -AsSecureString
        $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
        if ($p1 -cne $p2) { Arreter 'Les deux mots de passe sont differents. Rien n''a ete fait.' }
        if ($p1 -notmatch '^[A-Za-z0-9]{12,}$') { Arreter 'Il faut au moins 12 signes, lettres et chiffres seulement. Rien n''a ete fait.' }
        $reglages += ('DashboardPassword=' + $p1)
    }
    if ($reglages.Count -eq 0) { Ecrire 'Rien a changer.' 'Green'; Noter 'rien a changer'; Effacer; exit 0 }

    Etape 'Double verification'
    OuvrirSession
    Etape 'Envoi des reglages'
    $modele = Join-Path $AD '1_AWS\cloudformation.yaml'
    $arguments = @('cloudformation', 'deploy', '--stack-name', $Pile, '--template-file', $modele, '--capabilities', 'CAPABILITY_IAM',
        '--no-fail-on-empty-changeset', '--parameter-overrides', ('Empreinte=' + (Empreinte $modele))) + $reglages
    $r = AppelAws $arguments 'stats' 'text'
    $p1 = $null; $p2 = $null; $reglages = $null; $arguments = $null
    if ($r.Code -ne 0) { Arreter ('Reglages refuses (' + (ErreurCourte $r.Erreur) + '). Rien n''a change.') }
    Ecrire '[ok] Reglages enregistres chez AWS.' 'Green'
    if ($courriel) { Ecrire '     Courriel : AWS envoie un message de confirmation, clique sur le lien dedans.' 'White' }
    Noter 'reglages enregistres'
} finally {
    Effacer
}
exit 0
