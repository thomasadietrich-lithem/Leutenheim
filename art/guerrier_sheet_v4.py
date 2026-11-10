from PIL import Image, ImageDraw, ImageFont
PAL = {'O':(24,18,30),'S':(238,190,145),'s':(198,142,100),'H':(128,78,40),'G':(176,118,62),'h':(82,48,24),
 'W':(242,238,226),'w':(196,190,176),'x':(150,144,134),'B':(150,98,48),'b':(98,62,30),'Q':(120,74,38),'U':(84,150,222),'u':(52,104,176),
 'P':(78,84,116),'q':(56,60,88),'p':(66,46,30),'M':(224,230,236),'m':(132,142,156),'D':(170,116,62),'T':(232,232,220),'R':(214,74,62),'r':(160,44,40)}
def blank(): return [['.']*16 for _ in range(16)]
def put(g, rows, x0=0, y0=0):
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c!='.' and 0<=y+y0<16 and 0<=x+x0<16: g[y+y0][x+x0]=c
def pts(g, s, dx=0, dy=0):
    for x,y,c in s:
        if 0<=y+dy<16 and 0<=x+dx<16: g[y+dy][x+dx]=c
def outline(g):
    o=[r[:] for r in g]
    for y in range(16):
        for x in range(16):
            if g[y][x]=='.':
                for ax,ay in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+ax,y+ay
                    if 0<=nx<16 and 0<=ny<16 and g[ny][nx]!='.': o[y][x]='O'; break
    return o
Y0=1
# ---------- FACE (vers le bas) ----------
F_HEAD=["......HGGH",".....HGGHHH",".....HHHHHH",".....HSSSSH",".....SOSSOS","......SssS"]
F_TORSO=[".....WWWWWW","....wWWWWWWw","....SBBMBBBS",".....wWWWWx"]
F_L0=[".....PP..PP",".....pp..pp"]
F_L1=[".....PP..pp",".....PP",".....pp"]
F_L3=[".....pp..PP",".........PP",".........pp"]
F_SWORD=[(3,10,'b'),(2,11,'M'),(1,12,'M'),(2,12,'m'),(0,13,'M')]
F_QUIV=[(11,6,'U'),(11,5,'U'),(12,6,'u')]
# ---------- DOS (vers le haut) ----------
B_HEAD=["......HGGH",".....HGGHHH",".....HHHHHH",".....HHHHHH",".....hHHHHh","......hssh"]
B_TORSO=[".....WWWQQW","....wWWQQWWw","....SBQQBBBS",".....wWWWWx"]
B_QUIV=[(10,6,'U'),(11,6,'U'),(11,5,'u'),(10,5,'U')]
B_SWORD=[(12,10,'b'),(13,11,'M'),(14,12,'M'),(13,12,'m'),(15,13,'M')]
# ---------- PROFIL (vers la droite) ----------
S_HEAD=["......HGGH",".....HGGHHH",".....HHHHHH",".....HHHSSS",".....hHSSOS","......hSSS"]
S_TORSO=["......WWWW","......WWwW","......BBBM","......xWWW"]
S_L0=["......PPPP","......pp.pp"]
S_LA=["......PPPP",".....qq..PP",".....pp..ppp"]
S_LB=["......qPP",".......PP",".......ppp"]
S_QUIV=[(5,7,'Q'),(5,8,'Q'),(4,6,'U'),(4,5,'U'),(5,6,'u')]
S_ARM_UP=[(9,8,'w'),(10,9,'S'),(11,8,'b'),(12,7,'M'),(13,6,'M'),(14,5,'M'),(13,7,'m')]
S_ARM_BACK=[(6,8,'w'),(5,7,'w'),(5,6,'S'),(4,5,'b'),(4,4,'M'),(3,3,'M'),(3,2,'M'),(4,3,'m')]
S_ARM_FWD=[(8,8,'w'),(9,8,'w'),(10,8,'S'),(11,8,'b'),(12,8,'M'),(13,8,'M'),(14,8,'M'),(12,9,'m'),(13,9,'m')]
S_ARM_LOW=[(9,8,'w'),(10,9,'S'),(11,10,'b'),(12,11,'M'),(13,12,'M'),(14,13,'M')]
BOW=[(11,3,'D'),(12,4,'D'),(13,5,'D'),(13,6,'D'),(13,7,'D'),(13,8,'D'),(13,9,'D'),(12,10,'D'),(11,11,'D')]
def face(legs=F_L0, bob=0, sword=F_SWORD, extra=()):
    g=blank(); put(g,legs,0,11+Y0); put(g,F_TORSO,0,7+Y0+bob); pts(g,F_QUIV,0,Y0+bob); put(g,F_HEAD,0,1+Y0+bob)
    if sword: pts(g,sword,0,Y0+bob)
    pts(g,extra,0,Y0); return g
def back(legs=F_L0, bob=0, sword=B_SWORD, extra=()):
    g=blank(); put(g,legs,0,11+Y0); put(g,B_TORSO,0,7+Y0+bob); put(g,B_HEAD,0,1+Y0+bob); pts(g,B_QUIV,0,Y0+bob)
    if sword: pts(g,sword,0,Y0+bob)
    pts(g,extra,0,Y0); return g
F_SW_UP=[(3,9,'S'),(3,8,'b'),(3,7,'M'),(3,6,'M'),(3,5,'M'),(3,4,'M'),(2,6,'m')]
F_SW_DOWN=[(4,10,'w'),(5,11,'S'),(6,12,'b'),(6,13,'M'),(7,14,'M'),(6,14,'m')]
B_SW_BACK=[(12,10,'S'),(13,10,'b'),(14,11,'M'),(15,12,'M')]
B_SW_UP=[(12,8,'w'),(13,7,'w'),(13,6,'S'),(13,5,'b'),(13,4,'M'),(13,3,'M'),(13,2,'M'),(13,1,'M'),(14,3,'m'),(14,2,'m')]
F_BOW=[(2,10,'D'),(3,11,'D'),(4,12,'D'),(5,13,'D'),(6,13,'D'),(7,13,'D'),(8,13,'D'),(9,13,'D'),(10,13,'D'),(11,12,'D'),(12,11,'D'),(13,10,'D')]
F_BOW_REST=F_BOW+[(x,10,'T') for x in range(3,13)]+[(7,12,'S'),(8,12,'S'),(4,9,'w'),(11,9,'w')]
F_BOW_PULL=F_BOW+[(3,10,'T'),(4,9,'T'),(5,8,'T'),(10,8,'T'),(11,9,'T'),(12,10,'T'),(6,8,'S'),(9,8,'S'),(7,8,'U'),(8,8,'U'),(7,9,'h'),(7,10,'h'),(7,11,'h'),(7,12,'h'),(7,14,'M'),(8,14,'M'),(8,12,'S')]
B_BOW=[(2,7,'D'),(3,6,'D'),(3,5,'D'),(4,4,'D'),(13,7,'D'),(12,6,'D'),(12,5,'D'),(11,4,'D')]
B_BOW_REST=B_BOW+[(3,8,'S'),(12,8,'S')]
B_BOW_PULL=B_BOW+[(3,8,'S'),(12,9,'w'),(13,9,'w'),(14,10,'S'),(7,0,'M'),(8,0,'M')]
def side(legs=S_L0, bob=0, arm=S_ARM_UP, quiver=True, dx=0):
    g=blank(); put(g,legs,0,11+Y0); put(g,S_TORSO,dx,7+Y0+bob)
    if quiver: pts(g,S_QUIV,dx,Y0+bob)
    put(g,S_HEAD,dx,1+Y0+bob)
    if arm: pts(g,arm,dx,Y0+bob)
    return g
def bow(pull):
    g=side(arm=None); pts(g,BOW,0,Y0)
    if not pull:
        for y in range(4,11): g[y+Y0][11]='T'
        pts(g,[(9,8,'w'),(10,8,'w'),(12,7,'S')],0,Y0)
    else:
        pts(g,[(11,4,'T'),(10,5,'T'),(9,6,'T'),(9,8,'T'),(10,9,'T'),(11,10,'T')],0,Y0)
        for x in range(9,14): g[7+Y0][x]='h'
        pts(g,[(14,7,'M'),(8,7,'S'),(7,8,'w'),(12,6,'S')],0,Y0)
    return g
def red(g): return [[{'W':'R','w':'r','x':'r'}.get(c,c) for c in r] for r in g]
def lying():
    g=blank()
    put(g,["...HHH...S......","..HGHHSwWWw.....","..HHHSOWWWBWPPpp","..HHHSSWWWBWPP..","..hHHSOWWWBWPPpp","...hhh.wWWx.S..."],0,9)
    pts(g,[(13,9,"b"),(14,8,"M"),(15,7,"M")]); return g
ROWS=[
 ("REPOS",[("face",face()),("face",face(bob=1)),("profil",side()),("profil",side(bob=1)),("dos",back())]),
 ("MARCHE face",[("",face(F_L0)),("",face(F_L1,bob=-1)),("",face(F_L0)),("",face(F_L3,bob=-1))]),
 ("MARCHE profil",[("",side(S_LA)),("",side(S_LB,bob=-1)),("",side(S_L0)),("",side(S_LB,bob=-1))]),
 ("MARCHE dos",[("",back(F_L0)),("",back(F_L1,bob=-1)),("",back(F_L0)),("",back(F_L3,bob=-1))]),
 ("EPEE profil",[("",side(arm=S_ARM_BACK)),("",side(S_LA,arm=S_ARM_FWD)),("",side(arm=S_ARM_LOW))]),
 ("EPEE face",[("",face(sword=F_SW_UP)),("",face(F_L1,sword=F_SW_DOWN)),("",face())]),
 ("EPEE dos",[("",back(sword=B_SW_BACK)),("",back(F_L3,sword=B_SW_UP,bob=-1)),("",back())]),
 ("ARC profil",[("",bow(0)),("",bow(1)),("",bow(0))]),
 ("ARC face",[("",face(sword=None,extra=F_BOW_REST,bob=-1)),("",face(sword=None,extra=F_BOW_PULL,bob=-1)),("",face(sword=None,extra=F_BOW_REST,bob=-1))]),
 ("ARC dos",[("",back(sword=None,extra=B_BOW_REST)),("",back(sword=None,extra=B_BOW_PULL)),("",back(sword=None,extra=B_BOW_REST))]),
 ("BLESSE / MORT",[("blesse",red(side(arm=S_ARM_LOW,dx=-1))),("a terre",lying())]),
]
def render(g, scale):
    g=outline(g)
    im=Image.new('RGBA',(16*scale,16*scale),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([4*scale,13.6*scale,12*scale,15.9*scale],fill=(20,14,28,110))
    for y in range(16):
        for x in range(16):
            c=g[y][x]
            if c!='.': d.rectangle([x*scale,y*scale,(x+1)*scale-1,(y+1)*scale-1],fill=PAL[c])
    return im
S=6; CELL=16*S; PADX=150; W=PADX+5*(CELL+8)+8; H=40+len(ROWS)*(CELL+8)+190
FLOOR=(78,70,94)
img=Image.new('RGB',(W,H),(34,28,40)); d=ImageDraw.Draw(img)
f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",14); f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",11)
d.text((10,10),"HUMAIN GUERRIER v4 - 16x16, vu legerement du dessus (proposition)",fill=(230,200,120),font=f)
y=40; n=0; allf=[]
for name,frames in ROWS:
    d.text((10,y+CELL//2-8),name,fill=(220,215,200),font=f)
    for i,(lab,g) in enumerate(frames):
        x=PADX+i*(CELL+8)
        d.rectangle([x,y,x+CELL-1,y+CELL-1],fill=FLOOR)
        for k in range(1,16):
            d.line([x+k*S,y,x+k*S,y+CELL-1],fill=(84,76,100)); d.line([x,y+k*S,x+CELL-1,y+k*S],fill=(84,76,100))
        r=render(g,S); img.paste(r,(x,y),r)
        n+=1; d.text((x+3,y+2),str(n)+(" "+lab if lab else ""),fill=(170,160,185),font=f2); allf.append(g)
    y+=CELL+8
for sc,lab in ((2,"Taille reelle x2"),(3,"Taille reelle x3")):
    d.text((10,y+10),lab+" :",fill=(220,215,200),font=f2); x=PADX
    for g in allf:
        d.rectangle([x,y+4,x+16*sc-1,y+4+16*sc-1],fill=FLOOR); r=render(g,sc); img.paste(r,(x,y+4),r); x+=16*sc+3
        if x+16*sc>W-6: x=PADX; y+=16*sc+4
    y+=16*sc+12
img.save('guerrier_v4.png'); print(img.size,n)
