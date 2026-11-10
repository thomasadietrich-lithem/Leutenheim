import importlib.util, sys
from PIL import Image, ImageDraw, ImageFont
src=open('guerrier_sheet_v4.py').read()
src=src[:src.index("S=6; CELL")]
ns={}; exec(src, ns)
face,back,side,pts,blank,put,render=[ns[k] for k in ("face","back","side","pts","blank","put","render")]
F_L0=ns['F_L0']; Y0=1
def arc_down(y, x0=4, x1=11):   # croissant ouvert vers le haut, ventre vers le bas
    p=[(x0-1,y,'D'),(x0,y+1,'D'),(x1,y+1,'D'),(x1+1,y,'D')]+[(x,y+2,'D') for x in range(x0+1,x1)]
    return p
def arc_up(y, x0=4, x1=11):
    return [(x0-1,y+2,'D'),(x0,y+1,'D'),(x1,y+1,'D'),(x1+1,y+2,'D')]+[(x,y,'D') for x in range(x0+1,x1)]
# FACE A : croissant devant les jambes, bras tendus vers le bas, tête penchée
def faceA(pull):
    g=face(sword=None,bob=-1)
    b=arc_down(10)
    ex=b+[(4,8,'w'),(11,8,'w'),(5,9,'w'),(10,9,'w')]
    if not pull:
        ex+=[(x,10,'T') for x in range(4,12)]+[(7,12,'S'),(8,12,'S')]
    else:
        ex+=[(4,10,'T'),(5,9,'T'),(6,8,'T'),(9,8,'T'),(10,9,'T'),(11,10,'T'),(7,7,'S'),(8,7,'S'),(7,8,'U'),(8,8,'u'),(7,9,'h'),(7,10,'h'),(7,11,'h'),(7,12,'S'),(8,12,'S'),(7,13,'M'),(7,14,'M')]
    pts(g,ex,0,Y0); return g
# FACE B : arc incliné en travers du corps, flèche vers le bas
def faceB(pull):
    g=face(sword=None)
    bowp=[(3,5,'D'),(3,6,'D'),(4,7,'D'),(5,8,'D'),(6,9,'D'),(7,10,'D'),(8,11,'D'),(9,12,'D'),(10,12,'D'),(11,12,'D')]
    ex=bowp+[(6,9,'S')]
    if not pull:
        ex+=[(4,5,'T'),(5,6,'T'),(6,7,'T'),(7,8,'T'),(8,9,'T'),(9,10,'T'),(10,11,'T')]
    else:
        ex+=[(4,5,'T'),(5,5,'T'),(6,5,'T'),(7,6,'S'),(8,7,'T'),(9,9,'T'),(10,11,'T'),(7,7,'h'),(6,8,'h'),(5,10,'h'),(4,11,'M'),(3,12,'M')]
    pts(g,ex,0,Y0); return g
# DOS A : croissant au-dessus de la tête, personnage tassé
def backA(pull):
    g=back(sword=None,bob=1)
    ex=arc_up(0,3,12)+[(4,7,'w'),(11,7,'w'),(4,6,'S'),(11,6,'S')]
    if not pull: ex+=[(4,3,'T'),(11,3,'T')]
    else: ex+=[(4,3,'T'),(11,3,'T'),(7,-1,'M'),(8,-1,'M')]
    pts(g,ex,0,Y0); return g
# DOS B : arc tenu à bout de bras sur le côté droit, vertical, flèche vers le haut
def backB(pull):
    g=back(sword=None)
    bowp=[(12,2,'D'),(13,3,'D'),(14,4,'D'),(14,5,'D'),(14,6,'D'),(14,7,'D'),(14,8,'D'),(13,9,'D'),(12,10,'D')]
    bowp=[(y_,x_,c) for (x_,y_,c) in []]  # placeholder
    # arc horizontal en haut à droite, tenu bras levé : croissant ventre vers le haut, décalé à droite de la tête
    ex=[(9,3,'D'),(10,2,'D'),(11,1,'D'),(12,1,'D'),(13,1,'D'),(14,2,'D'),(15,3,'D'),(12,7,'w'),(12,6,'w'),(12,5,'S'),(12,2,'S')]
    if not pull: ex+=[(x,3,'T') for x in range(10,15)]
    else: ex+=[(10,3,'T'),(11,4,'T'),(13,4,'T'),(14,3,'T'),(12,4,'h'),(12,3,'h'),(12,0,'M')]
    pts(g,ex,0,Y0); return g
# FACE C : arc tenu bras baissé, en bas à gauche, ventre vers le bas, flèche vers le bas
def faceC(pull):
    g=face(sword=None)
    ex=[(0,10,'D'),(1,11,'D'),(2,12,'D'),(3,12,'D'),(4,12,'D'),(5,11,'D'),(6,10,'D'),(3,7,'w'),(3,8,'w'),(3,9,'S'),(3,12,'S')]
    if not pull: ex+=[(x,10,'T') for x in range(1,6)]
    else: ex+=[(1,10,'T'),(2,9,'T'),(4,9,'T'),(5,10,'T'),(3,10,'h'),(3,11,'h'),(3,13,'M'),(3,14,'M')]
    pts(g,ex,0,Y0); return g
opts=[("FACE C",faceC),("FACE A",faceA),("FACE B",faceB),("DOS A",backA),("DOS B",backB)]
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
img.save('bow_test.png')
