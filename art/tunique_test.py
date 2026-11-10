from PIL import Image, ImageDraw, ImageFont
src=open('guerrier_sheet_v5.py').read()
src=src[:src.index("S=6; CELL")]
def build(beige):
    ns={}; exec(src, ns)
    if beige:
        ns['PAL'].update({'W':(208,186,146),'w':(170,146,108),'x':(134,112,82)})
    rows=dict(ns['ROWS'])
    pick=[rows["REPOS"][0][1],rows["REPOS"][2][1],rows["REPOS"][4][1],rows["EPEE profil"][1][1],rows["ARC profil"][1][1],rows["ARC face"][0][1],rows["ARC face"][1][1],rows["ARC dos"][0][1],rows["ARC dos"][1][1]]
    return [ (ns['render'](g,8), ns['render'](g,3)) for g in pick]
img=Image.new('RGB',(150+9*136+10, 30+2*200),(34,28,40)); d=ImageDraw.Draw(img)
f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",14)
for r,(lab,beige) in enumerate((("TUNIQUE BLANCHE",False),("TUNIQUE BEIGE",True))):
    y=20+r*200; d.text((10,y+56),lab,fill=(220,215,200),font=f)
    for i,(big,small) in enumerate(build(beige)):
        x=150+i*136; d.rectangle([x,y,x+127,y+127],fill=(78,70,94)); img.paste(big,(x,y),big)
        d.rectangle([x+40,y+134,x+87,y+181],fill=(78,70,94)); img.paste(small,(x+40,y+134),small)
img.save('guerrier_tunique_essai.png'); print(img.size)
