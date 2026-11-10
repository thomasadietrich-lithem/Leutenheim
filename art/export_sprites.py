"""Exporte la grille du Guerrier (v6) vers src/render/sprites/guerrier.ts. Lancer depuis art/ : python3 export_sprites.py"""
src=open('guerrier_sheet_v6.py').read()
src=src[:src.index("def render(g, scale):")]
ns={}; exec(src, ns)
rows=dict(ns['ROWS']); outline=ns['outline']; PAL=ns['PAL']
def fr(name, idx): return [ ''.join(r) for r in outline(rows[name][i][1]) ] if False else None
def frames(name, idxs): return [[''.join(r) for r in outline(rows[name][i][1])] for i in idxs]
SETS={
 'idleDown':frames("REPOS",[0,1]), 'idleSide':frames("REPOS",[2,3]), 'idleUp':frames("REPOS",[4]),
 'walkDown':frames("MARCHE face",[0,1,2,3]), 'walkSide':frames("MARCHE profil",[0,1,2,3]), 'walkUp':frames("MARCHE dos",[0,1,2,3]),
 'swordDown':frames("EPEE face",[0,1,2]), 'swordSide':frames("EPEE profil",[0,1,2]), 'swordUp':frames("EPEE dos",[0,1,2]),
 'bowDown':frames("ARC face",[1,0]), 'bowSide':frames("ARC profil",[1,0]), 'bowUp':frames("ARC dos",[1,0]),
 'hurt':frames("BLESSE / MORT",[0]), 'dead':frames("BLESSE / MORT",[1]),
}
used=sorted({c for fs in SETS.values() for f in fs for r in f for c in r if c!='.'})
out=["// Fichier généré par art/export_sprites.py à partir de la grille validée (art/guerrier_v6.png). Ne pas modifier à la main.",
     "",
     "/** Couleur de chaque lettre des images ci-dessous. Le point est transparent. */",
     "export const GUERRIER_PALETTE: Record<string, string> = {"]
for c in used: out.append("  %s: \"#%02x%02x%02x\"," % ((c,)+tuple(PAL[c])))
out+=["};","","/** Images 16×16 du Humain Guerrier, personnage tourné vers la droite pour les vues de profil. */","export const GUERRIER = {"]
for k,fs in SETS.items():
    out.append("  %s: [" % k)
    for f in fs:
        out.append("    [")
        for r in f: out.append('      "%s",' % r)
        out.append("    ],")
    out.append("  ],")
out+=["} as const;",""]
import os
os.makedirs('../src/render/sprites',exist_ok=True)
open('../src/render/sprites/guerrier.ts','w').write('\n'.join(out))
print(len(used),"couleurs,",sum(len(v) for v in SETS.values()),"images")
