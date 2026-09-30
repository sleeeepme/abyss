from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
QUALITY = ROOT / "quality"
QUALITY.mkdir(parents=True, exist_ok=True)

OUT = "#100d15"
DEEP = "#211723"
COLD = "#252534"
CHAR = "#3a3945"
ASH = "#55545e"
STONE_D = "#817865"
STONE = "#b9ad91"
BONE = "#e0d4b5"
RUST = "#8f4930"
EMBER = "#b8673d"
AMBER = "#d99a3b"
OLIVE_D = "#4b4930"
OLIVE = "#6d6a3d"
OLIVE_L = "#96905a"
BG = (83, 82, 86, 255)


def rgba(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)


def canvas():
    return Image.new("RGBA", (32, 32), (0, 0, 0, 0))


def silhouette(polygons=(), rectangles=(), ellipses=()):
    mask = Image.new("L", (32, 32), 0)
    d = ImageDraw.Draw(mask)
    for p in polygons:
        d.polygon(p, fill=255)
    for r in rectangles:
        d.rectangle(r, fill=255)
    for e in ellipses:
        d.ellipse(e, fill=255)
    outline = mask.filter(ImageFilter.MaxFilter(3))
    im = canvas()
    im.paste(rgba(OUT), mask=outline)
    im.paste(rgba(CHAR), mask=mask)
    return im, mask


def dust_spider():
    # A wide, low circling silhouette. Eight legs form four paired arches rather
    # than eight parallel sticks, preserving readable negative spaces at 1x.
    polys = [
        [(11,12),(8,10),(5,10),(3,8),(2,8),(2,10),(5,12),(9,14)],
        [(10,14),(6,14),(3,13),(2,14),(2,16),(6,16),(10,17)],
        [(11,16),(7,18),(4,19),(2,22),(4,22),(6,20),(11,19)],
        [(13,17),(10,20),(9,24),(11,24),(12,21),(15,19)],
        [(19,12),(22,9),(26,8),(29,8),(29,10),(26,10),(22,13)],
        [(20,14),(24,13),(29,14),(29,16),(28,17),(25,16),(21,17)],
        [(19,17),(24,18),(27,21),(29,22),(27,23),(24,20),(20,19)],
        [(17,18),(20,21),(21,24),(19,25),(18,21),(15,19)],
        # abdomen and cephalothorax
        [(7,12),(10,9),(17,9),(20,12),(21,17),(18,20),(10,20),(7,17)],
        [(18,12),(22,11),(27,13),(29,16),(27,19),(22,20),(18,18)],
    ]
    im, _ = silhouette(polygons=polys)
    d = ImageDraw.Draw(im)
    # Far legs recede into cold blue-black; near legs keep warm stone joints.
    d.polygon([(3,9),(6,11),(10,14),(9,15),(5,13),(2,10)], fill=rgba(COLD))
    d.polygon([(2,15),(6,15),(10,16),(9,18),(5,17),(2,16)], fill=rgba(DEEP))
    d.polygon([(4,21),(7,18),(11,17),(12,19),(8,20),(5,23)], fill=rgba(COLD))
    d.polygon([(27,9),(23,11),(20,14),(21,15),(25,12),(29,10)], fill=rgba(COLD))
    d.polygon([(29,15),(24,14),(21,16),(22,18),(25,16),(29,17)], fill=rgba(DEEP))
    d.polygon([(28,22),(24,19),(20,18),(19,20),(23,20),(27,23)], fill=rgba(COLD))
    # Abdomen is a dusty stone shell with one broad light plane and a broken seam.
    d.polygon([(8,12),(11,10),(16,10),(19,12),(19,17),(16,19),(10,18),(8,16)], fill=rgba(ASH))
    d.polygon([(10,11),(15,10),(18,12),(17,14),(10,14)], fill=rgba(STONE_D))
    d.polygon([(11,11),(15,11),(17,12),(15,13),(11,13)], fill=rgba(STONE))
    d.line([(9,15),(12,15),(13,17),(16,17),(18,15)], fill=rgba(DEEP), width=1)
    d.polygon([(19,13),(22,12),(26,14),(28,16),(26,18),(22,19),(19,17)], fill=rgba(DEEP))
    d.polygon([(21,13),(25,14),(27,16),(25,17),(21,17)], fill=rgba(RUST))
    d.rectangle((22,14,24,15), fill=rgba(EMBER))
    # Two-eye cluster reads as a face without bead-like pixel noise.
    d.rectangle((26,14,27,14), fill=rgba(AMBER))
    d.point((25,15), fill=rgba(AMBER))
    d.point((27,16), fill=rgba(BONE))
    # Reassert exterior contour around thin limbs after internal painting.
    return im


def ash_toad():
    # Stationary projectile archetype: a grounded rear mass and an oversized,
    # pale throat sac aimed to the right.
    polys = [
        [(4,20),(6,15),(10,12),(14,11),(18,12),(21,15),(23,20),(20,23),(7,23)],
        [(14,12),(17,8),(22,7),(27,9),(29,13),(28,18),(24,20),(19,18)],
        [(5,21),(2,23),(3,25),(9,25),(12,23)],
        [(18,21),(22,23),(27,24),(29,23),(29,25),(25,26),(19,24)],
    ]
    im, _ = silhouette(polygons=polys)
    d = ImageDraw.Draw(im)
    # Rear body and folded hind leg.
    d.polygon([(5,20),(7,15),(11,13),(16,13),(20,16),(21,21),(18,23),(8,23)], fill=rgba(OLIVE_D))
    d.polygon([(6,19),(9,15),(13,13),(16,14),(13,17),(9,18)], fill=rgba(OLIVE))
    d.polygon([(8,15),(12,13),(15,14),(12,15)], fill=rgba(OLIVE_L))
    d.polygon([(4,22),(8,20),(13,20),(11,23),(8,25),(3,24)], fill=rgba(DEEP))
    d.polygon([(6,22),(10,21),(9,23),(5,24)], fill=rgba(OLIVE))
    # Head cap. Top-left light separates it from the throat.
    d.polygon([(15,12),(18,8),(22,7),(27,9),(29,12),(28,16),(25,18),(20,17)], fill=rgba(CHAR))
    d.polygon([(18,9),(22,8),(26,9),(27,11),(20,11),(17,13)], fill=rgba(ASH))
    d.rectangle((23,9,25,10), fill=rgba(STONE_D))
    d.point((26,10), fill=rgba(AMBER))
    # Broad mouth, with a single lower lip cluster.
    d.line([(20,13),(28,13),(27,15),(22,15)], fill=rgba(OUT), width=1)
    d.rectangle((24,14,27,14), fill=rgba(RUST))
    # Pale inflated throat is the turret tell.
    d.polygon([(18,16),(21,15),(27,16),(28,19),(26,22),(21,23),(18,21)], fill=rgba(STONE_D))
    d.polygon([(21,16),(26,16),(27,18),(25,20),(21,20),(19,18)], fill=rgba(STONE))
    d.polygon([(22,16),(26,17),(25,18),(21,18)], fill=rgba(BONE))
    d.line([(19,21),(22,22),(26,21)], fill=rgba(DEEP), width=1)
    # Near forefoot ties the pale throat to the ground.
    d.polygon([(19,21),(22,22),(27,24),(29,23),(29,25),(25,25),(20,23)], fill=rgba(OLIVE_D))
    d.rectangle((24,24,28,24), fill=rgba(OLIVE))
    return im


def stone_boar():
    # Heavy forward wedge: the head occupies nearly half the visible width while
    # the rear stays short. That makes the swarm/charge role legible at 1x.
    polys = [
        [(4,13),(7,10),(14,9),(20,11),(23,15),(22,20),(18,22),(8,21),(4,18)],
        [(18,10),(22,7),(27,9),(29,13),(29,18),(26,21),(21,21),(18,17)],
        [(6,20),(5,24),(9,24),(11,21)],
        [(16,20),(16,24),(20,24),(21,21)],
        [(28,15),(29,14),(29,17),(28,19)],
        [(5,13),(2,11),(2,14),(5,16)],
    ]
    im, _ = silhouette(polygons=polys)
    d = ImageDraw.Draw(im)
    # Compact rear body; one top plane and one underside mass.
    d.polygon([(4,13),(8,10),(14,10),(19,12),(21,16),(19,20),(9,20),(5,18)], fill=rgba(CHAR))
    d.polygon([(7,11),(14,10),(18,12),(16,14),(8,14),(5,16)], fill=rgba(ASH))
    d.polygon([(5,17),(10,15),(18,16),(19,20),(9,20)], fill=rgba(COLD))
    # Raised bristles are grouped into two clusters, not repeated spikes.
    d.polygon([(7,11),(8,8),(10,10),(12,7),(13,10),(15,8),(16,11)], fill=rgba(DEEP))
    d.polygon([(9,10),(10,9),(11,11),(13,9),(14,11)], fill=rgba(ASH))
    # Stone head: dark rear plane, broad lit brow, chipped cheek.
    d.polygon([(18,11),(22,8),(26,9),(29,13),(28,18),(25,21),(20,20),(18,16)], fill=rgba(STONE_D))
    d.polygon([(22,9),(26,10),(28,13),(27,15),(21,14),(19,13)], fill=rgba(STONE))
    d.polygon([(23,9),(26,10),(27,12),(22,12)], fill=rgba(BONE))
    d.polygon([(20,15),(24,14),(27,16),(26,19),(22,20),(19,18)], fill=rgba(ASH))
    d.polygon([(22,16),(25,16),(26,18),(24,19),(21,18)], fill=rgba(STONE_D))
    d.point((25,12), fill=rgba(AMBER))
    d.point((26,17), fill=rgba(OUT))
    # One large ivory tusk, with a dark root and no anti-aliasing.
    d.polygon([(27,17),(30,14),(30,17),(28,20),(26,20)], fill=rgba(OUT))
    d.polygon([(28,17),(30,15),(29,18),(27,19)], fill=rgba(BONE))
    # Short weight-bearing legs.
    d.polygon([(7,19),(11,19),(10,23),(9,24),(6,24)], fill=rgba(DEEP))
    d.polygon([(16,19),(20,19),(20,23),(19,24),(16,24)], fill=rgba(COLD))
    d.rectangle((6,23,10,24), fill=rgba(OUT))
    d.rectangle((16,23,20,24), fill=rgba(OUT))
    d.rectangle((7,23,9,23), fill=rgba(ASH))
    d.rectangle((17,23,19,23), fill=rgba(ASH))
    return im


def save_sprite(name, im):
    im.save(ROOT / f"{name}-32.png")
    im.resize((256, 256), Image.Resampling.NEAREST).save(ROOT / f"{name}-32@8x.png")
    bg = Image.new("RGBA", im.size, BG)
    bg.alpha_composite(im)
    bg.convert("RGB").resize((256, 256), Image.Resampling.NEAREST).save(ROOT / f"{name}-32-neutral@8x.png")


def silhouette_preview(im):
    alpha = im.getchannel("A")
    s = canvas(); s.paste(rgba("#18141d"), mask=alpha)
    return s


def make_board(named):
    # Includes the approved hound and the unchanged moss ball so scale and family
    # cohesion can be judged in one place. The moss source is read-only.
    hound = Image.open(ROOT.parent / "ash-hound-tinyrpg-v1" / "ash-hound-32.png").convert("RGBA")
    moss = Image.open(ROOT.parents[1] / "proto/assets/sprites/enemies/moss-ball/front-idle-v1.png").convert("RGBA")
    moss32 = Image.new("RGBA", (32, 32), (0,0,0,0))
    moss32.alpha_composite(moss, ((32-moss.width)//2, (32-moss.height)//2))
    all_items = [("ASH HOUND", hound)] + [(n.upper().replace('-', ' '), im) for n,im in named] + [("MOSS BALL / UNCHANGED", moss32)]
    sheet = Image.new("RGB", (5*272, 304), (42,42,46))
    d = ImageDraw.Draw(sheet)
    for i,(label,im) in enumerate(all_items):
        bg = Image.new("RGBA", (32,32), BG); bg.alpha_composite(im)
        sheet.paste(bg.convert("RGB").resize((256,256),Image.Resampling.NEAREST),(i*272+8,32))
        d.text((i*272+8,10),label,fill=(238,238,238))
    sheet.save(ROOT / "floor1-lineup-neutral@8x.png")

    gates = Image.new("RGB", (3*272, 2*286), (42,42,46))
    gd = ImageDraw.Draw(gates)
    for i,(name,im) in enumerate(named):
        for row,(stage,tag) in enumerate([(silhouette_preview(im),"SILHOUETTE"),(im,"FINAL")]):
            bg=Image.new("RGBA",(32,32),BG); bg.alpha_composite(stage)
            x=i*272+8; y=row*286+24
            gates.paste(bg.convert("RGB").resize((256,256),Image.Resampling.NEAREST),(x,y))
            gd.text((x,row*286+7),f"{name.upper()} / {tag}",fill=(238,238,238))
    gates.save(QUALITY / "stage-gates.png")


def report_for(name, im):
    getter = getattr(im, "get_flattened_data", None)
    px = list(getter() if getter else im.getdata())
    a=im.getchannel('A')
    return {"name":name,"canvas":[32,32],"visible_bounds":list(a.getbbox()),
            "visible_colors":len({p[:3] for p in px if p[3]}),
            "alpha_values":sorted({p[3] for p in px}),"native_authored":True,
            "resized_from_source":False}


def main():
    named=[("dust-spider",dust_spider()),("ash-toad",ash_toad()),("stone-boar",stone_boar())]
    for name,im in named: save_sprite(name,im)
    make_board(named)
    (QUALITY/"design-report.json").write_text(json.dumps({"assets":[report_for(n,i) for n,i in named],
        "benchmark_grammar":{"canvas":[32,32],"outline":"1 logical pixel","light":"upper-left",
        "palette_target":"12 colors or fewer per sprite","authored":"native target grid"},
        "moss_ball":"unchanged; included only in lineup preview"},ensure_ascii=False,indent=2),encoding="utf-8")


if __name__ == "__main__":
    main()
