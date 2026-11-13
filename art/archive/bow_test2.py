from PIL import Image, ImageDraw, ImageFont
src=open('guerrier_sheet_v4.py').read()
src=src[:src.index("S=6; CELL")]
ns={}; exec(src, ns)
blank,put,pts,render,PAL=[ns[k] for k in ("blank","put","pts","render","PAL")]
PAL['D']=(226,202,140); PAL['d']=(168,136,78)      # bois clair, bien distinct des cheveux
PAL['k']=(60,52,66)                                 # corde sombre sur la tunique
F_HEAD,B_HEAD,S_HEAD=ns['F_HEAD'],ns['B_HEAD'],ns['S_HEAD']
def stamp(g, P):
    """Pose un objet avec son propre contour sombre, même par-dessus le corps."""
    for x,y,c in P:
        for ax,ay in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+ax,y+ay
            if 0<=nx<16 and 0<=ny<16 and g[ny][nx]!='.': g[ny][nx]='O'
    for x,y,c in P:
        if 0<=x<16 and 0<=y<16: g[y][x]=c
def string(g, P):
    for x,y in P:
        if 0<=x<16 and 0<=y<16: g[y][x]='k' if g[y][x] in 'WwxBbM' else 'T'
LEGS=[".....PP..PP",".....pp..pp"]
# ---- FACE E : arc à la taille, bras ramenés devant, flèche entre les jambes
def faceE(pull):
    g=blank(); put(g,LEGS,0,12)
    put(g,[".....WWWWWW",".....wWWWWw","......BMBB",".....wWWWWx"],0,8)
    pts(g,[(11,7,'U'),(11,6,'U'),(12,7,'u')]); put(g,F_HEAD,0,2)
    bowp=[(3,9,'D'),(4,10,'D'),(5,11,'D'),(6,11,'d'),(7,11,'D'),(8,11,'D'),(9,11,'d'),(10,11,'D'),(11,10,'D'),(12,9,'D')]
    stamp(g,bowp)
    if not pull:
        string(g,[(x,9) for x in range(4,12)])
        stamp(g,[(7,11,'S'),(8,11,'S')])
    else:
        string(g,[(4,9),(5,8),(10,8),(11,9)])
        stamp(g,[(7,9,'h'),(7,10,'h'),(7,12,'h'),(7,13,'M'),(7,14,'M')])
        pts(g,[(7,11,'S'),(8,11,'S'),(6,8,'S'),(7,8,'U'),(8,8,'U'),(9,8,'S')])
    return g
# ---- FACE D : arc tenu debout sur le côté, flèche encochée pointe en bas
def faceD(pull):
    g=blank(); put(g,LEGS,0,12)
    put(g,[".....WWWWWW","....wWWWWWWw",".....BBMBBBS",".....wWWWWx"],0,8)
    pts(g,[(11,7,'U'),(11,6,'U'),(12,7,'u')]); put(g,F_HEAD,0,2)
    stave=[(3,3,'D'),(2,4,'D'),(1,5,'D'),(1,6,'D'),(1,7,'d'),(1,8,'D'),(1,9,'D'),(1,10,'d'),(1,11,'D'),(2,12,'D')]
    stamp(g,stave)
    if not pull:
        string(g,[(3,y) for y in range(4,13)])
        pts(g,[(4,9,'w'),(2,8,'S'),(3,9,'w')])
    else:
        string(g,[(3,4),(3,12)])
        stamp(g,[(3,5,'U'),(3,6,'U'),(3,7,'h'),(3,8,'h'),(3,9,'h'),(3,10,'h'),(3,11,'h'),(3,13,'M'),(3,14,'M')])
        pts(g,[(4,9,'w'),(2,8,'S'),(4,6,'S'),(4,7,'w')])
    return g
# ---- DOS E : arc au-dessus de la tête (bois clair), personnage un rien tassé, pointe de flèche au-dessus
def backE(pull):
    g=blank(); put(g,[".....pp..pp"],0,14)
    put(g,[".....WWWQQW","....wWWQQWWw","....SBQQBBBS",".....wWWWWx"],0,10)
    put(g,B_HEAD,0,4); pts(g,[(10,9,'U'),(11,9,'U'),(11,8,'u'),(10,8,'U')])
    bowp=[(2,5,'D'),(3,4,'D'),(4,3,'D'),(5,2,'d'),(6,2,'D'),(7,2,'D'),(8,2,'D'),(9,2,'D'),(10,2,'d'),(11,3,'D'),(12,4,'D'),(13,5,'D')]
    stamp(g,bowp)
    if pull: stamp(g,[(7,1,'M'),(8,1,'M'),(7,0,'M')]); pts(g,[(3,10,'S'),(12,10,'S')])
    return g
# ---- DOS D : arc tenu debout sur le côté droit, flèche encochée pointe en haut
def backD(pull):
    g=blank(); put(g,LEGS,0,12)
    put(g,[".....WWWQQW","....wWWQQWWw","....SBQQBBB",".....wWWWWx"],0,8)
    put(g,B_HEAD,0,2); pts(g,[(10,7,'U'),(10,6,'U')])
    stave=[(12,3,'D'),(13,4,'D'),(14,5,'D'),(14,6,'D'),(14,7,'d'),(14,8,'D'),(14,9,'D'),(14,10,'d'),(14,11,'D'),(13,12,'D'),(12,13,'D')]
    stamp(g,stave)
    if not pull:
        string(g,[(12,y) for y in range(4,13)]); pts(g,[(11,9,'w'),(12,9,'w'),(13,8,'S')])
    else:
        string(g,[(12,12)])
        stamp(g,[(12,2,'M'),(12,1,'M'),(12,4,'h'),(12,5,'h'),(12,6,'h'),(12,7,'h'),(12,8,'h'),(12,9,'h'),(12,10,'U'),(12,11,'U')])
        pts(g,[(11,9,'w'),(13,8,'S')])
    return g
opts=[("FACE D",faceD),("FACE E",faceE),("DOS D",backD),("DOS E",backE)]
S=10; W=120+2*(16*S+10)+140; H=30+len(opts)*(16*S+10)
img=Image.new('RGB',(W,H),(34,28,40)); d=ImageDraw.Draw(img)
f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",14)
y=20
for name,fn in opts:
    d.text((10,y+70),name,fill=(220,215,200),font=f)
    for i,p in enumerate((0,1)):
        x=120+i*(16*S+10); d.rectangle([x,y,x+16*S-1,y+16*S-1],fill=(78,70,94)); r=render(fn(p),S); img.paste(r,(x,y),r)
    x=120+2*(16*S+10)
    for i,p in enumerate((0,1)):
        d.rectangle([x+i*54,y+50,x+i*54+47,y+97],fill=(78,70,94)); r=render(fn(p),3); img.paste(r,(x+i*54,y+50),r)
    y+=16*S+10
img.save('bow_test2.png')
