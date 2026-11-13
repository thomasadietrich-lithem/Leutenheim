from PIL import Image, ImageDraw, ImageFont
PAL = {'O':(26,20,32),'S':(232,185,138),'s':(196,142,98),'H':(107,66,38),'h':(74,44,24),
 'W':(236,232,220),'w':(185,180,166),'B':(138,90,43),'b':(94,59,26),'P':(74,79,106),'q':(54,58,82),
 'p':(58,42,28),'M':(214,221,228),'m':(125,135,148),'D':(154,106,58),'T':(225,225,215),'R':(190,60,50)}
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
                    if 0<=nx<16 and 0<=ny<16 and g[ny][nx] not in '.':
                        o[y][x]='O'; break
    return o
HEAD=[".....HHHHH",".....HHHSS",".....HSSOS",".....hSSSS","......SSS."]
TORSO=[".....WWWWW",".....WWWWW",".....wWWWW",".....BBBbB",".....wWWWW"]
LEG_STAND=[".....PP.PP",".....PP.PP",".....pp.ppp"]
LEG_A=[".....PP.PP","....qq...PP","....pp...ppp"]
LEG_A2=[".....PP.qq","....PP...qq","....pp...ppp"]
LEG_B=["......PPq","......PPq","......ppp"]
LEG_KNEEL=["","","....ppPPPPp"]
SWORD_UP=[(9,8,'w'),(10,9,'S'),(11,8,'b'),(12,7,'M'),(13,6,'M'),(14,5,'M'),(13,7,'m')]
SWORD_BACK=[(5,8,'w'),(4,7,'w'),(4,6,'S'),(3,5,'b'),(3,4,'M'),(2,3,'M'),(2,2,'M'),(3,3,'m')]
SWORD_FWD=[(8,8,'w'),(9,8,'w'),(10,8,'S'),(11,8,'b'),(12,8,'M'),(13,8,'M'),(14,8,'M'),(12,9,'m'),(13,9,'m')]
SWORD_LOW=[(9,8,'w'),(10,9,'S'),(11,10,'b'),(12,11,'M'),(13,12,'M'),(14,13,'M')]
BOW=[(11,3,'D'),(12,4,'D'),(13,5,'D'),(13,6,'D'),(13,7,'D'),(13,8,'D'),(13,9,'D'),(12,10,'D'),(11,11,'D')]
def body(legs=LEG_STAND, bob=0, lean=0, arm=None, head_dx=0):
    g=blank()
    put(g, legs, 0, 12)
    put(g, TORSO, lean, 7+bob)
    put(g, HEAD, lean+head_dx, 2+bob)
    if arm: pts(g, arm, lean, bob)
    return g
def bow_frame(pull):
    g=body()
    pts(g,BOW)
    if not pull:
        for y in range(4,11): g[y][11]='T'
        pts(g,[(9,8,'w'),(10,8,'w'),(12,7,'S')])
    else:
        pts(g,[(11,4,'T'),(10,5,'T'),(9,6,'T'),(9,8,'T'),(10,9,'T'),(11,10,'T')])
        for x in range(9,14): g[7][x]='h'
        pts(g,[(14,7,'M'),(8,7,'S'),(7,8,'w'),(12,6,'S')])
    return g
def tint(g, col):
    return [[('R' if c in 'Ww' else c) for c in r] for r in g] if col else g
def rot(g):  # couché sur le dos, tête à gauche
    r=blank()
    for y in range(16):
        for x in range(16):
            r[15-x][y]=g[y][x]
    # recaler au sol
    rows=[row for row in r if any(c!='.' for c in row)]
    out=blank()
    for i,row in enumerate(rows[-14:]): out[15-len(rows[-14:])+i]=row
    return out
ROWS=[
 ("REPOS",[body(arm=SWORD_UP), body(bob=1,arm=SWORD_UP)]),
 ("MARCHE",[body(LEG_A,arm=SWORD_UP), body(LEG_B,bob=-1,arm=SWORD_UP), body(LEG_A2,arm=SWORD_UP), body(LEG_B,bob=-1,arm=SWORD_UP)]),
 ("COUP D'EPEE",[body(arm=SWORD_BACK), body(LEG_A,arm=SWORD_FWD), body(arm=SWORD_LOW)]),
 ("TIR A L'ARC",[bow_frame(0), bow_frame(2), bow_frame(0)]),
 ("BLESSE",[tint(body(lean=-1,arm=SWORD_LOW,head_dx=-1),True)]),
 ("MORT",[body(LEG_KNEEL,bob=2,arm=SWORD_LOW), rot(body())]),
]
def render(g, scale):
    g=outline(g)
    im=Image.new('RGBA',(16*scale,16*scale),(0,0,0,0)); d=ImageDraw.Draw(im)
    for y in range(16):
        for x in range(16):
            c=g[y][x]
            if c!='.': d.rectangle([x*scale,y*scale,(x+1)*scale-1,(y+1)*scale-1],fill=PAL[c])
    return im
S=9; CELL=16*S; PADX=150; W=PADX+4*(CELL+10)+10; H=40+len(ROWS)*(CELL+10)+200
FLOOR=(74,66,88)
img=Image.new('RGB',(W,H),(34,28,40)); d=ImageDraw.Draw(img)
try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",15); f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",12)
except: f=f2=ImageFont.load_default()
d.text((10,10),"HUMAIN GUERRIER - grille 16x16, profil droit (proposition)",fill=(230,200,120),font=f)
y=40; n=0
for name,frames in ROWS:
    d.text((10,y+CELL//2-8),name,fill=(220,215,200),font=f)
    for i,g in enumerate(frames):
        x=PADX+i*(CELL+10)
        d.rectangle([x,y,x+CELL-1,y+CELL-1],fill=FLOOR)
        for k in range(1,16): 
            d.line([x+k*S,y,x+k*S,y+CELL-1],fill=(80,72,95)); d.line([x,y+k*S,x+CELL-1,y+k*S],fill=(80,72,95))
        img.paste(render(g,S),(x,y),render(g,S))
        n+=1; d.text((x+3,y+2),str(n),fill=(160,150,175),font=f2)
    y+=CELL+10
for sc,lab in ((2,"Taille reelle x2"),(3,"Taille reelle x3")):
    d.text((10,y+10),lab+" :",fill=(220,215,200),font=f2)
    x=PADX
    for name,frames in ROWS:
        for g in frames:
            d.rectangle([x,y+4,x+16*sc-1,y+4+16*sc-1],fill=FLOOR)
            img.paste(render(g,sc),(x,y+4),render(g,sc)); x+=16*sc+(6 if sc==2 else 2)
            if x+16*sc>W-6: x=PADX; y+=16*sc+4
    y+=16*sc+14
img.save('guerrier_v1.png')  # lancer depuis le dossier art/ : python3 guerrier_sheet.py; print(img.size, n)
