import asyncio, json
from playwright.async_api import async_playwright
from PIL import Image
D = json.load(open("/home/claude/leutenheim/art/objets_v2.json"))
V1 = json.load(open("/home/claude/leutenheim/art/objets_v1.json"))
D["palette"].update(V1["palette"]); D["icons"]["bourse_A"] = V1["icons"]["bourse_A"]
COMMON = """(data) => {
  window.svg = (rows, pal) => { pal = pal || data.palette; const w = rows[0].length, h = rows.length; let s = `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">`;
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`; })); return s + '</svg>'; };
  const css = document.createElement('style');
  css.textContent = `
   .mk-tabs{display:flex;width:min(100%,318px);gap:0;margin-bottom:6px}
   .mk-tab{flex:1;text-align:center;padding:6px 0;font-size:22px;text-transform:uppercase;color:var(--dim);background:#1a140e;box-shadow:inset 2px 2px 0 #3a2e1e,inset -2px -2px 0 #0c0906}
   .mk-tab.on{color:#fff3c8;background:#3a2c14;box-shadow:inset 0 0 0 2px var(--gold)}
   .mk-tab .bang{color:#ffd75e;margin-left:6px}
   .mk-top{width:min(100%,318px);display:flex;justify-content:space-between;align-items:center;font-size:20px;color:#fff3c8;text-transform:uppercase}
   .mk-gold{display:flex;align-items:center;gap:6px;color:var(--gold);font-size:24px} .mk-gold svg{width:30px;height:30px}
   .mk-head{display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:19px} .mk-head svg{width:44px;height:25px}
   .mk-points{width:min(100%,318px);padding:6px 8px;margin:6px 0;color:#ffd75e;font-size:20px;text-transform:uppercase;box-shadow:inset 0 0 0 2px var(--gold);background:#2a2010;text-align:center}
   .mk-stat{width:min(100%,318px);display:flex;align-items:center;gap:8px;font-size:20px;text-transform:uppercase;color:var(--dim);margin:3px 0}
   .mk-stat .n{flex:1;text-align:left} .mk-stat b{color:#fff3c8;font-weight:normal;min-width:64px;text-align:right}
   .mk-stat .hint{font-size:15px;color:#8a8070;text-transform:none;display:block}
   .mk-plus{width:34px;height:30px;padding:0;font-size:24px;line-height:1}
   .mk-sep{width:min(100%,318px);border-top:2px solid #3a2e1e;margin:6px 0}
   .mk-paths{width:min(100%,318px);display:flex;gap:6px}
   .mk-path{flex:1;padding:6px 4px;background:#241c14;box-shadow:inset 2px 2px 0 #4a3e2a,inset -2px -2px 0 #0c0906;text-align:center;font-size:15px;color:var(--dim);line-height:1.1}
   .mk-path svg{width:40px;height:40px;display:block;margin:0 auto 4px}
   .mk-path b{display:block;font-size:18px;color:#fff3c8;font-weight:normal;text-transform:uppercase}
   .mk-card{position:relative;width:min(100%,318px);padding:8px 30px 8px 8px;background:#2a2014;box-shadow:inset 0 0 0 2px #6a5a3a;font-size:16px;color:var(--dim);display:flex;gap:8px}
   .mk-card svg{width:44px;height:44px;flex:none} .mk-card .t{color:#fff3c8;font-size:20px;text-transform:uppercase}
   .mk-x{position:absolute;right:4px;top:4px;width:24px;height:24px;padding:0;font-size:18px;line-height:1}
   .mk-q{position:relative;width:52px;height:52px;padding:5px;background:#241c14;box-shadow:inset 2px 2px 0 #4a3e2a,inset -2px -2px 0 #0c0906}
   .mk-q.sel{background:#3a2c14;box-shadow:inset 0 0 0 2px var(--gold)} .mk-q svg{width:100%;height:100%}
   .mk-n{position:absolute;right:3px;bottom:-2px;font-size:20px;color:#fff;text-shadow:2px 2px 0 #000}
   .mk-slotsac{display:flex;justify-content:center;width:min(100%,318px);margin-top:4px}
   .mk-slotsac .box{width:60px;height:60px;padding:6px;box-shadow:inset 0 0 0 3px #4a3e2a;background:#0c0906} .mk-slotsac svg{width:100%;height:100%}`;
  document.head.append(css);
}"""
INV = """(data) => {
  const bag = document.getElementById('bag');
  bag.querySelector('h2').outerHTML = `<div class="mk-tabs"><div class="mk-tab on">Inventaire</div><div class="mk-tab">Personnage<span class="bang">!</span></div></div>`;
  document.querySelector('.bag-top').innerHTML = `<span>Équipement</span><span class="mk-gold">${svg(data.icons.bourse_A || data.icons.or_petit)}37</span>`;
  document.getElementById('bag-stats').remove();
  const s = document.createElement('div'); s.className='mk-slotsac';
  s.innerHTML = `<div class="box" title="Sac">${svg(data.icons.sac_toile)}</div>`;
  document.getElementById('doll').after(s);
  const info = document.getElementById('bag-info');
  info.innerHTML = `<div class="mk-card">${svg(data.icons.potion_feu)}<div><div class="t">Potion de feu</div>À lancer : la case visée et ses quatre voisines brûlent pendant 5 tours.<br>Lancer · portée 5</div><button class="mk-x">×</button></div>`;
  document.getElementById('bag-equip').hidden = false; document.getElementById('bag-equip').textContent = 'Lancer';
}"""
PERSO = """(data) => {
  const bag = document.getElementById('bag');
  [...bag.children].forEach(c => { if (!c.classList.contains('mk-tabs') && c.id !== 'bag-close' && !c.classList.contains('bag-buttons')) c.remove(); });
  bag.querySelectorAll('.mk-tab')[0].classList.remove('on'); bag.querySelectorAll('.mk-tab')[1].classList.add('on');
  const tabs = bag.querySelector('.mk-tabs');
  const html = `
   <div class="mk-top"><span class="mk-head">${svg(data.head, data.headPalette)}Guerrier · Niv 3</span><span style="color:var(--dim);white-space:nowrap">XP 4/20</span></div>
   <div class="mk-points">1 point à attribuer</div>
   <div class="mk-stat"><span class="n">Vie<span class="hint">+4 PV max</span></span><b>18/18</b><button class="mk-plus">+</button></div>
   <div class="mk-stat"><span class="n">Force<span class="hint">pousser, dégâts au contact</span></span><b>+4</b><button class="mk-plus">+</button></div>
   <div class="mk-stat"><span class="n">Agilité<span class="hint">se dégager, tir à l'arc</span></span><b>+2</b><button class="mk-plus">+</button></div>
   <div class="mk-sep"></div>
   <div class="mk-stat"><span class="n">Fouille<span class="hint">à part : ne prend pas de points</span></span><b>+0</b></div>
   <div class="mk-stat"><span class="n">Discrétion</span><b>-5</b></div>
   <div class="mk-stat"><span class="n">CA</span><b>12</b></div>
   <div class="mk-stat"><span class="n">Attaque</span><b>+4</b></div>
   <div class="mk-sep"></div>
   <h3>Choisir une voie</h3>
   <div class="mk-paths">
     <div class="mk-path">${svg(data.icons.voie_bleue)}<b>Second souffle</b>+10 PV, 1 tour, 1 fois par étage</div>
     <div class="mk-path">${svg(data.icons.voie_rouge)}<b>Double frappe</b>deux coups d'un coup, 3 fois par étage</div>
     <div class="mk-path">${svg(data.icons.voie_verte)}<b>Bousculade</b>repousse de 3 cases et ralentit</div>
   </div>
   <div style="font-size:15px;color:#ff8a7a;width:min(100%,318px);text-align:center;margin-top:4px">Choix définitif</div>`;
  tabs.insertAdjacentHTML('afterend', html);
}"""
BAR = """(data) => {
  const b = document.getElementById('open-bag');
  b.innerHTML = svg(data.head, data.headPalette) + '<span style="position:absolute;right:6px;top:0;color:#ffd75e;font-size:28px;text-shadow:2px 2px 0 #000">!</span>';
  b.style.position = 'relative'; b.querySelector('svg').style.cssText = 'width:44px;height:25px';
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
        await pg.goto("file:///home/claude/leutenheim/demo/index.html")
        await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.click("#menu-sandbox"); await pg.wait_for_timeout(400)
        await pg.evaluate(COMMON, D)
        await pg.evaluate(BAR, D)
        await pg.screenshot(path="/tmp/shot/pm_bar.png", clip={"x":0,"y":744,"width":390,"height":100})
        await pg.evaluate("() => { const g = window.leutenheim.game(); g.inventory.add('pomme',2); g.inventory.add('fleche_poison',6); }")
        await pg.click("#open-bag"); await pg.wait_for_timeout(200)
        await pg.evaluate(INV, D); await pg.wait_for_timeout(100)
        await pg.screenshot(path="/tmp/shot/pm_inv.png", full_page=True)
        await pg.evaluate(PERSO, D); await pg.wait_for_timeout(100)
        await pg.screenshot(path="/tmp/shot/pm_perso.png", full_page=True)
        await b.close()
    a, c, bar = Image.open("/tmp/shot/pm_inv.png"), Image.open("/tmp/shot/pm_perso.png"), Image.open("/tmp/shot/pm_bar.png")
    W = a.width + c.width + 40; H = max(a.height, c.height) + bar.height + 60
    out = Image.new("RGB", (W, H), (26, 20, 14)); out.paste(a, (0, 0)); out.paste(c, (a.width + 40, 0)); out.paste(bar, (0, max(a.height, c.height) + 40))
    out.save("/home/claude/leutenheim/art/personnage_maquette_v1.png"); print(out.size)
asyncio.run(main())
