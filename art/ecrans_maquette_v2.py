import asyncio, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
V3 = json.load(open("/home/claude/leutenheim/art/objets_v3.json"))
PAL = V3["palette"]
def render(rows, s):
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGBA", (w*s, h*s), (0,0,0,0)); d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".": d.rectangle([x*s, y*s, x*s+s-1, y*s+s-1], fill=PAL[c])
    return im
CSS = """
 #bag { overflow: hidden !important; }
 .mk-x{position:absolute;right:10px;top:8px;width:40px;height:40px;padding:0;font-size:26px;line-height:1;z-index:5}
 #bag h3{margin:2px 0}
 .hero-tabs{margin-right:44px}
 #doll{grid-template-areas:"amulet hat artifact" "melee armor ranged" "quiver bag ." !important}
 .slot-box{width:58px!important;height:58px!important}
 .mk-quiverslot{grid-area:quiver;display:flex;flex-direction:column;align-items:center}
 .mk-quiverslot .slot-box{position:relative}
 .mk-n{position:absolute;right:2px;bottom:-4px;font-size:18px;color:#fff;text-shadow:2px 2px 0 #000}
 .slot-bag{grid-column:auto!important;grid-area:bag}
 .mk-card{position:relative;width:min(100%,318px);padding:6px 8px;background:#2a2014;box-shadow:inset 0 0 0 2px #6a5a3a;font-size:16px;color:var(--dim);display:flex;gap:8px;align-items:center}
 .mk-card svg{width:40px;height:40px;flex:none}.mk-card .t{color:#fff3c8;font-size:19px;text-transform:uppercase}
 .mk-btns{display:flex;gap:8px;justify-content:center;width:min(100%,318px)}
 .mk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;width:min(100%,330px);font-size:18px;text-transform:uppercase;color:var(--dim)}
 .mk-grid2 .r{display:flex;align-items:center;gap:4px}.mk-grid2 .r span{flex:1}.mk-grid2 b{color:#fff3c8;font-weight:normal}
 .mk-grid2 button{width:28px;height:26px;padding:0;font-size:20px;line-height:1}
 .mk-sec{width:min(100%,330px);font-size:18px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid #3a2e1e;margin-top:4px}
 .mk-voie{width:min(100%,330px);display:flex;gap:8px;align-items:center;padding:6px;box-shadow:inset 0 0 0 2px var(--gold);background:#3a2c14;font-size:15px;color:var(--dim)}
 .mk-voie svg{width:36px;height:36px;flex:none}.mk-voie b{color:#fff3c8;font-weight:normal;font-size:18px;text-transform:uppercase;display:block}
 .mk-pows{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;width:min(100%,330px)}
 .mk-pow{padding:5px 3px;background:#241c14;box-shadow:inset 2px 2px 0 #4a3e2a,inset -2px -2px 0 #0c0906;text-align:center;font-size:14px;color:var(--dim);line-height:1.1}
 .mk-pow b{display:block;color:#fff3c8;font-weight:normal;font-size:15px;text-transform:uppercase}
 .mk-pow.own{box-shadow:inset 0 0 0 2px var(--gold);background:#3a2c14}.mk-pow.lock{opacity:.45}
 .mk-status{display:flex;gap:4px;padding:2px 0 0 2px}.mk-status span{width:26px;height:26px;padding:2px;background:#1a140e;box-shadow:inset 0 0 0 2px #4a3e2a;display:block}
 .mk-status span svg{width:100%;height:100%}.mk-status .n{position:relative}
 .mk-pop{position:absolute;left:8px;top:96px;z-index:9;width:250px;padding:8px;background:#241c14;box-shadow:inset 0 0 0 2px var(--gold);font-size:16px;color:var(--dim)}
 .mk-pop b{color:#fff3c8;font-weight:normal;font-size:19px;text-transform:uppercase;display:block}
"""
SVG = """(rows, pal) => { const w = rows[0].length, h = rows.length; let s = `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">`;
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`; })); return s + '</svg>'; }"""
INV = """(d) => { const svg = """ + SVG + """;
  const st = document.createElement('style'); st.textContent = d.css; document.head.append(st);
  const bag = document.getElementById('bag');
  bag.insertAdjacentHTML('afterbegin', '<button class="mk-x">×</button>');
  document.getElementById('bag-close').remove();
  document.getElementById('quiver-box').remove();
  const q = document.createElement('div'); q.className = 'slot mk-quiverslot';
  q.innerHTML = `<div class="slot-box">${document.querySelector('#aim svg').outerHTML}<span class="mk-n">10</span></div>`;
  document.getElementById('doll').append(q);
  document.getElementById('bag-info').innerHTML = `<div class="mk-card">${svg(d.icons.potion_feu, d.pal)}<div><div class="t">Potion de feu</div>La case visée et ses voisines brûlent 5 tours, plus une éclaboussure.</div></div>`;
  document.querySelector('.bag-buttons').innerHTML = '<div class="mk-btns"><button>Lancer</button><button>Jeter</button></div>';
}"""
CHAR = """(d) => { const svg = """ + SVG + """;
  const pane = document.getElementById('pane-char');
  pane.innerHTML = `
   <div class="bag-top"><span class="char-head">${svg(d.head, d.headPal)}Guerrier · Niv 4</span><span style="color:var(--dim)">XP 0/30</span></div>
   <div id="char-points" style="display:block">2 points à attribuer</div>
   <div class="mk-grid2">
     <div class="r"><span>Vie</span><b>16</b><button>+</button></div><div class="r"><span>Force</span><b>+4</b><button>+</button></div>
     <div class="r"><span>Agilité</span><b>+2</b><button>+</button></div><div class="r"><span>Intellig.</span><b>+0</b><button>+</button></div>
     <div class="r"><span>Charisme</span><b>+0</b><button>+</button></div><div class="r"><span>Fouille</span><b>+0</b></div>
     <div class="r"><span>Discrétion</span><b>-5</b></div><div class="r"><span>Attaque</span><b>+4</b></div>
     <div class="r" style="grid-column:1/-1"><span>Classe d'armure</span><b>12</b></div>
   </div>
   <div class="mk-sec">Voie</div>
   <div class="mk-voie">${svg(d.icons.voie_rouge, d.pal)}<div><b>Voie rouge · Double frappe</b>Deux coups en un tour, 3 fois par étage (3 restantes)</div></div>
   <div class="mk-sec">Pouvoirs</div>
   <div class="mk-pows">
     <div class="mk-pow own"><b>Coup puissant</b>Critique sur 19-20<br>✓ acquis</div>
     <div class="mk-pow"><b>Enchaînement</b>Tuer rend une double frappe<br>à choisir</div>
     <div class="mk-pow lock"><b>Rage</b>+2 dégâts sous ½ PV<br>niveau 6</div>
   </div>`;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
        await pg.goto("file:///home/claude/leutenheim/demo/index.html")
        await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.click("#menu-sandbox"); await pg.wait_for_timeout(400)
        V2 = json.load(open("/home/claude/leutenheim/art/objets_v2.json"))
        pal = dict(V2["palette"]); pal.update(PAL)
        data = {"css": CSS, "icons": {**V2["icons"], **V3["icons"]}, "pal": pal, "head": V2["head"], "headPal": V2["headPalette"]}
        # --- Carte : héros face aux Schrats, statuts
        await pg.evaluate("""() => { const g = window.leutenheim.game(); g.hero.x = g.hero.fromX = 21; g.hero.y = g.hero.fromY = 15;
           g.monsters.forEach(m => { m.alerted = true; m.asleep = false; m.patrol = undefined; });
           const [a, c] = g.monsters.filter(m => m.y > 12); a.x = a.fromX = 23; a.y = a.fromY = 15; c.x = c.fromX = 20; c.y = c.fromY = 17; g.wait(); }""")
        await pg.wait_for_timeout(700)
        pos = await pg.evaluate("""() => { const g = window.leutenheim.game(), r = window.leutenheim.renderer(); const f = document.querySelector('.frame').getBoundingClientRect();
           const t = (x, y) => { const p = r.tileCenter(x, y); return [p.x + f.left, p.y + f.top]; };
           const ms = g.monsters.filter(m => m.y > 12);
           return { tile: r.tileCenter(1,0).x - r.tileCenter(0,0).x, a: t(ms[0].x, ms[0].y), c: t(ms[1].x, ms[1].y), hero: t(g.hero.x, g.hero.y), gauges: document.querySelector('.gauges').getBoundingClientRect().bottom }; }""")
        await pg.screenshot(path="/tmp/shot/m3_map.png")
        await pg.close()
        # --- Inventaire plein écran
        pg = await b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
        await pg.goto("file:///home/claude/leutenheim/demo/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.click("#menu-sandbox"); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const g = window.leutenheim.game(); g.inventory.add('potion_feu',2); g.inventory.add('pomme',2); g.gold = 37; }")
        await pg.click("#open-bag"); await pg.wait_for_timeout(200)
        await pg.evaluate(INV, data); await pg.wait_for_timeout(100)
        await pg.screenshot(path="/tmp/shot/m3_inv.png")
        await pg.evaluate("() => { document.getElementById('tab-char').click(); }"); await pg.wait_for_timeout(100)
        await pg.evaluate(CHAR, data); await pg.wait_for_timeout(100)
        await pg.screenshot(path="/tmp/shot/m3_char.png")
        await b.close()
    # --- Composer la carte avec bulles, feu, sang, statuts sous les jauges
    im = Image.open("/tmp/shot/m3_map.png").convert("RGBA"); S = 2
    T = pos["tile"] * S
    def at(p): return (int(p[0]*S), int(p[1]*S))
    # sang au sol (vert) près des Schrats, rouge près du héros
    for key, splat, dx, dy in (("a", "sang_vert_sol1", -0.5, 0.3), ("c", "sang_vert_sol2", 0.6, -0.2), ("hero", "sang_rouge_sol2", -0.7, 0.4)):
        sp = render(V3["icons"][splat], max(1, int(T/16))); x, y = at(pos[key]); im.alpha_composite(sp, (int(x + dx*T - sp.width/2), int(y + dy*T - sp.height/2)))
    # Schrat c dans le feu : flammes sur sa case
    fl = render(V3["icons"]["feu_2"], max(1, int(T/16))); x, y = at(pos["c"])
    fl.putalpha(fl.getchannel("A").point(lambda a: int(a*0.75)))
    im.alpha_composite(fl, (int(x - fl.width/2), int(y - fl.height/2)))
    # bulles au-dessus des têtes
    def bubble(key, icons):
        x, y = at(pos[key]); s = int(T*0.42); n = len(icons); total = n*s + (n-1)*4
        x0 = int(x - total/2); y0 = int(y - T*0.95)
        dr = ImageDraw.Draw(im)
        for i, ic in enumerate(icons):
            bx = x0 + i*(s+4)
            dr.rectangle([bx-3, y0-3, bx+s+2, y0+s+2], fill=(20,15,10,230), outline=(214,170,84,255), width=2)
            ico = render(V3["icons"]["statut_"+ic], 1).resize((s, s), Image.NEAREST); im.alpha_composite(ico, (bx, y0))
    bubble("a", ["poison", "ralenti"]); bubble("c", ["feu"])
    # statuts du héros sous les jauges
    dr = ImageDraw.Draw(im); gy = int(pos["gauges"]*S) + 6; x0 = 16
    for ic in ("arme_poison", "accelere", "torche"):
        s = 44; dr.rectangle([x0, gy, x0+s+8, gy+s+8], fill=(26,20,14,255), outline=(74,62,42,255), width=3)
        ico = render(V3["icons"]["statut_"+ic], 1).resize((s, s), Image.NEAREST); im.alpha_composite(ico, (x0+4, gy+4)); x0 += s + 16
    # bulle de détail (au toucher)
    px, py = 16, gy + 64
    dr.rectangle([px, py, px+470, py+120], fill=(36,28,20,250), outline=(240,192,80,255), width=3)
    from PIL import ImageFont
    fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 26); fr = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 22)
    dr.text((px+16, py+12), "ARME EMPOISONNÉE", fill=(255,243,200), font=fb)
    dr.text((px+16, py+52), "Vos coups qui portent empoisonnent.", fill=(200,190,170), font=fr)
    dr.text((px+16, py+82), "Encore 12 coups.", fill=(200,190,170), font=fr)
    im.convert("RGB").save("/tmp/shot/m3_map_c.png")
    a, c, m = Image.open("/tmp/shot/m3_inv.png"), Image.open("/tmp/shot/m3_char.png"), Image.open("/tmp/shot/m3_map_c.png")
    out = Image.new("RGB", (a.width*3 + 80, a.height), (26,20,14))
    out.paste(m, (0,0)); out.paste(a, (a.width+40, 0)); out.paste(c, (2*a.width+80, 0))
    out = out.resize((out.width//2, out.height//2), Image.LANCZOS)
    out.save("/home/claude/leutenheim/art/ecrans_maquette_v2.png"); print(out.size)
asyncio.run(main())
