"""Jauge du Tocsin (proposition, rien en jeu). Lancer depuis la racine du dépôt après `npm run build`.

Une cloche à côté du numéro d'étage, de la couleur du palier (calme gris, agité jaune, alerte orange, hallali rouge),
avec une petite barre qui se remplit sous elle. Écrit art/tocsin_v1.png (et art/tocsin_v1.json : la cloche).
"""
import asyncio, json, importlib.util
from PIL import Image, ImageDraw, ImageFont
spec = importlib.util.spec_from_file_location("v1", "art/objets_v1.py"); v1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v1)

BELL = [
    "",
    ".......dd.......",
    "......dLLd......",
    ".....LLLLMd.....",
    "....LWLLLMMd....",
    "....LWLLLMMd....",
    "....LWLLLMMd....",
    "...LLWLLLMMMd...",
    "...LLLLLLMMMd...",
    "..LLLLLLLMMMMd..",
    ".ddddddddddddd..",
    "......dMMd......",
    ".......dd.......",
]
STAGES = [("calme", ("#c8c8d0", "#8a8a98", "#4a4a58")), ("agité", ("#ffe27a", "#d6aa2a", "#7a5a10")),
          ("alerte", ("#ffb060", "#e0782a", "#7a3410")), ("hallali", ("#ff7a7a", "#d03a44", "#6a1018"))]
bell = v1.outline(v1.pad(BELL))

def render(rows, s, pal):
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * s, y * s, x * s + s - 1, y * s + s - 1], fill=pal[c])
    return im

SVG = """(a) => { const [rows, pal, level, color] = a; const w = rows[0].length, h = rows.length;
  let svg = `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="width:30px;height:30px;display:block">`;
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`; })); svg += '</svg>';
  const old = document.getElementById('mk-bell'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'mk-bell';
  el.style.cssText = 'flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0 2px';
  el.innerHTML = svg + `<div style="width:30px;height:5px;background:#281e14"><div style="width:${level}%;height:100%;background:${color}"></div></div>`;
  document.getElementById('floor-badge').before(el); }"""

async def shot():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.goto("file:///home/claude/leutenheim/demo/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.click("#menu-new"); await pg.wait_for_timeout(200); await pg.click("#new-start"); await pg.wait_for_timeout(500)
        for i, (name, (light, mid, dark)) in enumerate(STAGES):
            await pg.evaluate(SVG, [bell, {"d": "#120d08", "K": "#120d08", "L": mid, "M": dark, "W": light}, [10, 32, 58, 90][i], mid])
            await pg.wait_for_timeout(80)
            await pg.screenshot(path=f"/tmp/shot/tocsin_bar{i}.png", clip={"x": 0, "y": 0, "width": 390, "height": 60})
        # bulle de détail sur l'état « agité »
        await pg.evaluate(SVG, [bell, {"d": "#120d08", "K": "#120d08", "L": STAGES[1][1][1], "M": STAGES[1][1][2], "W": STAGES[1][1][0]}, 32, STAGES[1][1][1]])
        await pg.evaluate("""() => { const pop = document.getElementById('status-pop'); pop.hidden = false; pop.style.left = 'auto'; pop.style.right = '6px';
          pop.innerHTML = '<b>Tocsin : agité</b>32 / 100. Plus de promeneurs. À 50, des traqueurs sont lâchés. Le bruit (portes enfoncées, combats) le fait monter.'; }""")
        await pg.wait_for_timeout(80)
        await pg.screenshot(path="/tmp/shot/tocsin_pop.png", clip={"x": 0, "y": 0, "width": 390, "height": 200})
        await b.close()

if __name__ == "__main__":
    json.dump({"bell": bell}, open("art/tocsin_v1.json", "w"))
    asyncio.run(shot())
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    bars = [Image.open(f"/tmp/shot/tocsin_bar{i}.png") for i in range(4)]
    pop = Image.open("/tmp/shot/tocsin_pop.png")
    W = 20 + bars[0].width + 40 + pop.width + 20; H = 100 + 4 * (bars[0].height + 30)
    sheet = Image.new("RGB", (W, max(H, 100 + pop.height + 20)), (26, 20, 14)); d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "TOCSIN — jauge proposée (rien en jeu)", fill=(255, 243, 200), font=f, anchor="mm")
    d.text((20, 44), "Une cloche entre les jauges et l'étage, couleur du palier, petite barre qui se remplit dessous.", fill=(220, 210, 190), font=fs)
    d.text((20, 64), "Calme (gris), agité (jaune), alerte (orange), hallali (rouge). La toucher ouvre le détail.", fill=(220, 210, 190), font=fs)
    for i, im in enumerate(bars):
        y = 100 + i * (im.height + 30)
        sheet.paste(im, (20, y))
        d.text((24 + im.width // 2, y + im.height + 12), STAGES[i][0], fill=(220, 210, 190), font=fs, anchor="mm")
    sheet.paste(pop, (20 + bars[0].width + 40, 100))
    sheet.save("art/tocsin_v1.png"); print(sheet.size)
