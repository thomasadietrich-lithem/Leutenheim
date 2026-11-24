# =============================================================================
#  TOUT_DEPLOYER.ps1 - LTH Studio - TOUTE la mise en ligne en un double-clic
#  (24/11/2026, demande de Thomas : meme structure et meme rigueur que NeuroVision).
#  Lance par TOUT_DEPLOYER.bat (racine du dossier).
#
#   1. UNE double verification (code du telephone) pour toute la mise en ligne. Les jetons restent
#      EN MEMOIRE, jamais sur le disque, et sont effaces a la fin, quoi qu'il arrive. Duree : 1 heure.
#   2. UN apercu : chaque piece de A_DEPLOYER est comparee a ce qui est DEJA en ligne. Ce qui est
#      identique ne repart pas. Rien a envoyer = on s'arrete la.
#   3. UN "O".
#   4. Envoi dans l'ordre impose : modele AWS (statistiques) -> page du tableau de bord -> recalcul
#      des chiffres. Puis verification de chaque piece EN LIGNE (empreintes, adresses qui repondent).
#   Plus tard : les versions du jeu (A_DEPLOYER\3_Jeu), meme code, meme "O".
#  Messages sans accents : PowerShell 5.1 les lirait mal.
# =============================================================================
$NomOutil = 'TOUT'
. (Join-Path $PSScriptRoot 'commun.ps1')

$Modele = Join-Path $AD '1_AWS\cloudformation.yaml'
$DossierPage = Join-Path $AD '2_TableauDeBord'
$Page = @(
    @{ Fichier = 'index.html';      Type = 'text/html; charset=utf-8' },
    @{ Fichier = 'logo_studio.png'; Type = 'image/png' },
    @{ Fichier = 'logo_titre.png';  Type = 'image/png' }
)

# Rangement : retire les fichiers des anciennes organisations de ce dossier (remplaces par cet outil).
function Ranger {
    $anciens = @('Cave Roller - AWS.cmd', '1 - Mettre a jour AWS.cmd', '2 - Etiquettes des joueurs.cmd',
        '3 - Ouvrir le tableau de bord.cmd', '4 - Changer courriel ou mot de passe.cmd', 'installer.ps1',
        'etiquettes.ps1', 'cloudformation.yaml', 'dashboard\index.html', 'dashboard\logo_studio.png',
        'dashboard\logo_titre.png', 'systeme\menu.ps1', 'systeme\installer.ps1', 'systeme\cloudformation.yaml',
        'systeme\dashboard\index.html', 'systeme\dashboard\logo_studio.png', 'systeme\dashboard\logo_titre.png')
    $retires = 0
    foreach ($nom in $anciens) {
        $f = Join-Path $Racine $nom
        if (Test-Path -LiteralPath $f -PathType Leaf) { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue; $retires++ }
    }
    foreach ($d in @('systeme\dashboard', 'systeme', 'dashboard')) {
        $p = Join-Path $Racine $d
        if ((Test-Path -LiteralPath $p -PathType Container) -and -not (Get-ChildItem -LiteralPath $p -Force)) { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue }
    }
    if ($retires -gt 0) { Ecrire ('[ok] Dossier range : ' + $retires + ' ancien(s) fichier(s) retire(s)') 'Green'; Noter ('rangement : ' + $retires + ' fichier(s) retire(s)') }
}

# Code de reponse d'une adresse (sans suivre les erreurs).
function CodeHttp([string]$url) {
    try { return [int](Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0).StatusCode }
    catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode } else { return 0 } }
}
function EtiquetteEnLigne([string]$bucket, [string]$cle) {
    $r = AppelAws @('s3api', 'head-object', '--bucket', $bucket, '--key', $cle, '--query', 'ETag') 'stats' 'text'
    if ($r.Code -ne 0) { return '' }
    return ($r.Texte.Trim() -replace '"', '').ToLower()
}

Ecrire '============================================================' 'Cyan'
Ecrire '  LTH Studio - TOUTE la mise en ligne' 'Cyan'
Ecrire '  (statistiques de Cave Roller, tableau de bord : un seul code, un seul "O")' 'Cyan'
Ecrire '============================================================' 'Cyan'
Noter 'debut'
if (-not (Test-Path $Modele)) { Arreter ('Fichier introuvable : ' + $Modele) }
foreach ($p in $Page) { if (-not (Test-Path (Join-Path $DossierPage $p.Fichier))) { Arreter ('Fichier introuvable : ' + (Join-Path $DossierPage $p.Fichier)) } }
Ranger

try {
    # --- 1. Une seule double verification -------------------------------------------------------
    Etape '1/3  Double verification (une seule fois pour tout)'
    OuvrirSession

    # --- 2. Un seul apercu : ce qui differe de ce qui est en ligne ------------------------------
    Etape '2/3  Ce qui va partir (compare a ce qui est en ligne)'
    $aEnvoyer = @()
    $r = AppelAws @('cloudformation', 'describe-stacks', '--stack-name', $Pile, '--query', 'Stacks[0].StackStatus') 'stats' 'text'
    if ($r.Code -ne 0) { Arreter ('La pile "' + $Pile + '" est illisible (' + (ErreurCourte $r.Erreur) + '). Rien n''a ete envoye.') }
    $etat = $r.Texte.Trim()
    if ($etat -notmatch '_COMPLETE$' -or $etat -match 'IN_PROGRESS') { Arreter ('La pile AWS n''est pas dans un etat stable (' + $etat + '). Rien n''a ete envoye.') }
    $empLocale = Empreinte $Modele
    $empEnLigne = SortiePile 'Empreinte'
    if ($empLocale -eq $empEnLigne) { Ecrire '[=] Modele AWS : deja en ligne, identique' 'DarkGray' }
    else { Ecrire ('[+] Modele AWS : A ENVOYER (en ligne : ' + $(if ($empEnLigne) { $empEnLigne.Substring(0, 8) } else { 'ancienne version' }) + ', ici : ' + $empLocale.Substring(0, 8) + ')') 'Yellow'; $aEnvoyer += 'modele' }

    $bucket = SortiePile 'DashboardBucketName'
    if (-not $bucket) { Arreter 'Bucket du tableau de bord introuvable dans la pile. Rien n''a ete envoye.' }
    $pageAEnvoyer = @()
    foreach ($p in $Page) {
        $local = Empreinte (Join-Path $DossierPage $p.Fichier) 'MD5'
        if ($local -eq (EtiquetteEnLigne $bucket $p.Fichier)) { Ecrire ('[=] Page ' + $p.Fichier + ' : deja en ligne, identique') 'DarkGray' }
        else { Ecrire ('[+] Page ' + $p.Fichier + ' : A ENVOYER') 'Yellow'; $pageAEnvoyer += $p }
    }
    if ($pageAEnvoyer.Count -gt 0) { $aEnvoyer += 'page' }

    # Coupe-circuit : si l'adresse des statistiques a ete fermee (trop d'appels), on le dit et on propose de rouvrir.
    $r = AppelAws @('lambda', 'get-function-concurrency', '--function-name', 'caveroller-stats', '--query', 'ReservedConcurrentExecutions') 'stats' 'text'
    if ($r.Code -eq 0 -and $r.Texte.Trim() -eq '0') {
        Ecrire '[!] L''adresse des statistiques est FERMEE par le coupe-circuit (trop d''appels). Elle sera rouverte.' 'Yellow'
        $aEnvoyer += 'reouverture'
    }

    Ecrire ''
    if ($aEnvoyer.Count -eq 0) {
        Ecrire 'Rien a mettre en ligne : tout est deja a jour.' 'Green'
        Noter 'rien a mettre en ligne'
        Effacer
        exit 0
    }
    $rep = Read-Host 'Tout mettre en ligne maintenant ? Tape O puis Entree (toute autre reponse annule)'
    if ($rep.Trim().ToUpper() -ne 'O') {
        Ecrire 'Annule : rien n''a ete envoye.' 'Yellow'
        Noter 'annule apres l''apercu'
        Effacer
        exit 0
    }

    # --- 3. Envoi, dans l'ordre, puis verification en ligne ------------------------------------
    Etape '3/3  Mise en ligne'
    Noter ('envoi : ' + ($aEnvoyer -join ', '))
    if ($aEnvoyer -contains 'modele') {
        Ecrire '[..] Modele AWS : envoi en cours (quelques minutes, ne ferme pas la fenetre)...' 'White'
        $r = AppelAws @('cloudformation', 'deploy', '--template-file', $Modele, '--stack-name', $Pile, '--capabilities', 'CAPABILITY_IAM',
            '--no-fail-on-empty-changeset', '--parameter-overrides', ('Empreinte=' + $empLocale)) 'stats' 'text'
        if ($r.Code -ne 0) {
            $d = AppelAws @('cloudformation', 'describe-stack-events', '--stack-name', $Pile, '--max-items', '40', '--query', "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId, ResourceStatusReason]") 'stats' 'text'
            Ecrire $d.Texte 'DarkYellow'
            Noter ('echec du modele : ' + ($d.Texte -replace "`r?`n", ' | '))
            Arreter ('Le modele AWS a ete refuse (' + (ErreurCourte $r.Erreur) + '). AWS est revenu a la version precedente ; la page n''a PAS ete envoyee. Copie tout ce qui est affiche pour Claude.')
        }
        if ((SortiePile 'Empreinte') -ne $empLocale) { Arreter 'Verification : l''empreinte en ligne ne correspond pas au modele envoye. La page n''a PAS ete envoyee.' }
        Ecrire '[ok] Modele AWS en ligne et verifie (empreinte identique)' 'Green'
        Noter ('modele en ligne : ' + $empLocale.Substring(0, 8))
    }
    if ($aEnvoyer -contains 'page') {
        foreach ($p in $pageAEnvoyer) {
            $f = Join-Path $DossierPage $p.Fichier
            $r = AppelAws @('s3', 'cp', $f, ('s3://' + $bucket + '/' + $p.Fichier), '--content-type', $p.Type, '--cache-control', 'no-store', '--only-show-errors') 'stats' 'text'
            if ($r.Code -ne 0) { Arreter ('Envoi de ' + $p.Fichier + ' refuse (' + (ErreurCourte $r.Erreur) + ').') }
            if ((EtiquetteEnLigne $bucket $p.Fichier) -ne (Empreinte $f 'MD5')) { Arreter ('Verification : ' + $p.Fichier + ' en ligne ne correspond pas au fichier envoye.') }
            Ecrire ('[ok] Page ' + $p.Fichier + ' en ligne et verifiee') 'Green'
            Noter ('page en ligne : ' + $p.Fichier)
        }
    }
    if ($aEnvoyer -contains 'reouverture') {
        $r = AppelAws @('lambda', 'delete-function-concurrency', '--function-name', 'caveroller-stats') 'stats' 'text'
        if ($r.Code -ne 0) { Arreter ('Reouverture de l''adresse refusee (' + (ErreurCourte $r.Erreur) + ').') }
        Ecrire '[ok] Adresse des statistiques rouverte' 'Green'
        Noter 'adresse rouverte'
    }
    if ($aEnvoyer -contains 'modele') {
        $sortie = Join-Path $Tmp 'bilan.json'
        $r = AppelAws @('lambda', 'invoke', '--function-name', 'caveroller-stats-bilan', $sortie, '--query', 'StatusCode') 'stats' 'text'
        if ($r.Code -eq 0 -and (Test-Path $sortie)) { Ecrire ('[ok] Chiffres recalcules : ' + (Get-Content -Raw $sortie)) 'Green' }
        else { Ecrire ('[attention] Le recalcul des chiffres n''a pas marche (' + (ErreurCourte $r.Erreur) + '). Ils seront recalcules cette nuit.') 'DarkYellow'; Noter 'recalcul en echec' }
    }

    # Verification finale : les deux adresses repondent comme prevu, vues de l'exterieur.
    $urlStats = SortiePile 'StatsUrl'
    $urlPage = SortiePile 'DashboardUrl'
    if ($urlStats) {
        $c = CodeHttp $urlStats
        if ($c -eq 405) { Ecrire '[ok] Adresse des statistiques : repond (refuse bien autre chose que les envois du jeu)' 'Green' }
        else { Ecrire ('[attention] Adresse des statistiques : reponse inattendue (' + $c + ').') 'DarkYellow'; Noter ('adresse des statistiques : reponse ' + $c) }
    }
    if ($urlPage) {
        $c = CodeHttp $urlPage
        if ($c -eq 401) { Ecrire '[ok] Tableau de bord : en ligne et ferme sans mot de passe' 'Green' }
        else { Ecrire ('[ATTENTION] Tableau de bord : reponse ' + $c + ' sans mot de passe (attendu : 401). A signaler a Claude.') 'Red'; Noter ('tableau de bord : reponse ' + $c + ' sans mot de passe') }
        Ecrire ('     ' + $urlPage + '   (utilisateur lth)') 'White'
    } else {
        Ecrire '[info] Tableau de bord : pas en ligne (aucun mot de passe regle). Voir Outils\CHANGER_REGLAGES.bat.' 'DarkYellow'
    }
    Ecrire ''
    Ecrire 'TOUT EST EN LIGNE ET VERIFIE.' 'Green'
    Noter 'TERMINE'
} finally {
    Effacer
}
exit 0
