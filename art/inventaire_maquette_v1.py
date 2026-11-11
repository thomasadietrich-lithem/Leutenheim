import asyncio, json
from playwright.async_api import async_playwright
ICONS = json.load(open("/home/claude/leutenheim/art/objets_v1.json"))
JS = """(data) => {
  const svg = (rows, cell) => { const w = rows[0].length, h = rows.length; let s = `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">`;
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${data.palette[c]}"/>`; })); return s + '</svg>'; };
  const bag = document.getElementById('bag');
  const h2 = bag.querySelector('h2');
  const css = document.createElement('style');
  css.textContent = `
   .mk-stats{width:min(100%,318px);display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;font-size:18px;color:var(--dim);text-transform:uppercase;margin:2px 0 6px}
   .mk-stats b{color:#fff3c8;font-weight:normal;float:right}
   .mk-top{width:min(100%,318px);display:flex;justify-content:space-between;align-items:center;font-size:20px;color:#fff3c8;text-transform:uppercase}
   .mk-gold{display:flex;align-items:center;gap:6px;color:var(--gold);font-size:24px}
   .mk-gold svg{width:30px;height:30px}
   .mk-quiver{width:min(100%,318px);display:flex;gap:8px;align-items:center}
   .mk-q{position:relative;width:52px;height:52px;padding:5px;background:#241c14;box-shadow:inset 2px 2px 0 #4a3e2a,inset -2px -2px 0 #0c0906}
   .mk-q.sel{background:#3a2c14;box-shadow:inset 0 0 0 2px var(--gold)}
   .mk-q svg{width:100%;height:100%}
   .mk-n{position:absolute;right:3px;bottom:-2px;font-size:20px;color:#fff;text-shadow:2px 2px 0 #000}
   .mk-lv{position:absolute;left:2px;top:-2px;font-size:17px;color:#ff6a6a;text-shadow:2px 2px 0 #000}
   .mk-qtxt{font-size:17px;color:var(--dim);line-height:1.1;text-align:left}`;
  document.head.append(css);
  const top = document.createElement('div');
  top.innerHTML = `<div class="mk-top"><span>Guerrier · Niv 1</span><span class="mk-gold">${svg(data.icons.bourse_A)}37</span></div>
   <div class="mk-stats"><span>PV <b>12/12</b></span><span>CA <b>12</b></span><span>Attaque <b>+4</b></span><span>XP <b>12/30</b></span>
   <span>Force <b>+4</b></span><span>Agilité <b>+2</b></span><span>Discrétion <b>-5</b></span><span>Fouille <b>+0</b></span></div>`;
  h2.after(top);
  const q = document.createElement('div');
  q.innerHTML = `<h3>Carquois</h3><div class="mk-quiver">
    <div class="mk-q sel">${data.arrow}<span class="mk-n">10</span></div>
    <div class="mk-q">${svg(data.icons.fleche_poison)}<span class="mk-n">3</span><span class="mk-lv">Lv4</span></div>
    <div class="mk-qtxt">Touchez celles<br>à tirer.<br>Lv rouge : niveau<br>trop bas.</div></div>`;
  bag.querySelector('#doll').after(q);
  // Une épée longue Lv2 dans le sac, pour montrer le niveau requis.
  const grid = document.getElementById('bag-grid');
  const it = document.createElement('div'); it.className = 'bag-item';
  it.style.cssText = 'left:calc(100%/6*5);top:0;width:calc(100%/6);height:calc(100%/4*3)';
  it.innerHTML = svg(data.icons.epee_longue) + '<span class="mk-lv">Lv2</span>';
  grid.append(it);
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
        await pg.goto("file:///home/claude/leutenheim/demo/index.html")
        await pg.evaluate("localStorage.clear()")
        await pg.reload()
        await pg.click("#menu-sandbox"); await pg.wait_for_timeout(400)
        await pg.click("#open-bag"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/tmp/shot/bag_before.png")
        arrow = await pg.evaluate("() => { const e=[...document.querySelectorAll('.bag-item svg')].map(s=>s.outerHTML); return e; }")
        ICONS["arrow"] = arrow[-1] if arrow else ""
        await pg.evaluate(JS, ICONS)
        await pg.wait_for_timeout(100)
        await pg.screenshot(path="/tmp/shot/bag_mock.png", full_page=True)
        print(len(arrow))
        await b.close()
asyncio.run(main())
