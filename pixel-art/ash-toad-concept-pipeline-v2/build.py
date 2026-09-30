from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
QUALITY = ROOT / "quality"
QUALITY.mkdir(exist_ok=True)

OUT = "#100d15"
DEEP = "#211c27"
COLD = "#302d3a"
OLIVE_D = "#46452f"
OLIVE = "#66633a"
OLIVE_L = "#8b8550"
STONE_D = "#706a62"
STONE = "#9c9484"
BONE_D = "#a99f8b"
BONE = "#d1c4a6"
BONE_L = "#eee1bd"
AMBER = "#d99027"
BG = (83, 82, 86, 255)


def c(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)


def make_final():
    # Silhouette follows the 32px reduction: a long low rear, a stepped rise to
    # the eye, and a round throat mass that owns the front half of the sprite.
    mask = Image.new("L", (32, 32), 0)
    m = ImageDraw.Draw(mask)
    m.polygon([(3,20),(4,16),(7,13),(10,12),(12,10),(16,10),
               (18,7),(21,6),(25,8),(28,11),(29,15),(29,21),
               (27,24),(23,25),(18,24),(15,23),(11,23),(8,25),(3,25)], fill=255)
    # Folded hind foot, front foot, and the two small ground contacts.
    m.polygon([(4,22),(2,24),(2,26),(8,26),(11,23)], fill=255)
    m.polygon([(20,23),(23,25),(28,25),(29,26),(28,27),(23,27),(19,25)], fill=255)
    m.polygon([(12,22),(11,26),(15,26),(16,23)], fill=255)

    outline = mask.filter(ImageFilter.MaxFilter(3))
    im = Image.new("RGBA", (32, 32), (0,0,0,0))
    im.paste(c(OUT), mask=outline)
    im.paste(c(OLIVE_D), mask=mask)
    d = ImageDraw.Draw(im)

    # Rear body and folded thigh: three broad clusters, all taken from the
    # reduced guide's large value masses rather than its noisy pixels.
    d.polygon([(3,20),(5,16),(8,14),(12,13),(16,15),(17,20),(14,23),(9,23),(7,25),(3,24)], fill=c(OLIVE))
    d.polygon([(5,17),(8,14),(11,13),(14,14),(12,16),(8,17)], fill=c(OLIVE_L))
    d.polygon([(3,21),(7,18),(11,18),(13,21),(10,23),(7,25),(3,24)], fill=c(OLIVE_D))
    d.polygon([(4,22),(7,20),(10,20),(8,23),(7,25),(3,25)], fill=c(OLIVE))
    d.line([(3,25),(7,25),(9,24)], fill=c(DEEP), width=1)

    # The torso rises diagonally toward the eye, preserving the concept's gesture.
    d.polygon([(10,12),(13,10),(17,10),(20,12),(21,17),(18,21),(14,22),(12,18)], fill=c(OLIVE_D))
    d.polygon([(13,11),(16,10),(19,11),(18,14),(14,15),(11,14)], fill=c(OLIVE))
    d.polygon([(14,11),(17,10),(18,11),(16,13),(13,13)], fill=c(OLIVE_L))

    # Four stone plates, deliberately unequal. Their broad clusters retain the
    # concept's armored back without turning cracks into 1px noise.
    d.polygon([(6,14),(8,11),(12,10),(14,12),(12,15),(8,16)], fill=c(STONE_D))
    d.polygon([(8,12),(11,11),(13,12),(11,14),(8,14)], fill=c(STONE))
    d.polygon([(12,10),(14,8),(17,8),(18,10),(16,12),(13,12)], fill=c(STONE_D))
    d.polygon([(14,9),(17,9),(16,11),(13,11)], fill=c(STONE))
    d.polygon([(16,10),(18,7),(21,7),(22,10),(20,13),(17,13)], fill=c(STONE_D))
    d.polygon([(19,7),(21,8),(20,10),(18,11),(18,9)], fill=c(STONE))
    d.polygon([(20,10),(23,8),(26,9),(28,11),(27,14),(23,15),(20,13)], fill=c(STONE_D))
    d.polygon([(23,9),(26,10),(27,11),(26,12),(22,12)], fill=c(STONE))

    # Raised eye bump is a compact four-pixel symbol with a dark socket.
    d.rectangle((20,7,23,10), fill=c(DEEP))
    d.rectangle((21,7,22,9), fill=c(AMBER))
    d.point((22,7), fill=c(BONE_L))
    d.point((22,9), fill=c(OUT))

    # Wedge muzzle and a single continuous mouth seam.
    d.polygon([(22,11),(27,11),(29,13),(28,15),(23,15),(20,14)], fill=c(STONE))
    d.polygon([(24,11),(27,12),(28,13),(26,13),(22,13)], fill=c(BONE_D))
    d.line([(21,14),(28,14),(29,15)], fill=c(DEEP), width=1)

    # Inflated throat: one large round mass, with upper-left light and a lower
    # shadow crescent. The final shape remains connected to the jaw at 1x.
    d.polygon([(20,15),(23,14),(27,15),(29,18),(29,22),(27,24),(23,25),(20,23),(18,20),(18,17)], fill=c(BONE_D))
    d.polygon([(21,15),(25,15),(28,17),(29,20),(27,23),(23,24),(20,22),(19,19)], fill=c(BONE))
    d.polygon([(22,15),(25,16),(27,17),(27,18),(25,19),(22,19),(20,18),(20,17)], fill=c(BONE_L))
    d.polygon([(20,21),(23,22),(27,21),(27,23),(24,24),(21,23)], fill=c(STONE_D))

    # Forelimb crosses behind the sac; toes form one cluster, not five prongs.
    d.polygon([(16,17),(18,16),(20,18),(19,22),(22,24),(20,26),(16,24),(15,21)], fill=c(OLIVE_D))
    d.polygon([(17,17),(19,18),(18,21),(20,23),(19,24),(17,22),(16,20)], fill=c(OLIVE))
    d.polygon([(19,24),(23,25),(28,25),(29,26),(27,27),(22,26),(19,26)], fill=c(STONE_D))
    d.rectangle((22,25,27,26), fill=c(STONE))
    d.point((28,26), fill=c(BONE_D))

    # Reassert selected one-pixel separations that describe overlap.
    d.line([(12,16),(15,16),(16,18)], fill=c(DEEP), width=1)
    d.line([(15,22),(14,25),(12,25)], fill=c(DEEP), width=1)
    return im


def neutral(im, scale=8):
    bg = Image.new("RGBA", im.size, BG)
    bg.alpha_composite(im)
    return bg.convert("RGB").resize((32*scale,32*scale),Image.Resampling.NEAREST)


def silhouette_stage(im):
    s=Image.new("RGBA",im.size,(0,0,0,0))
    s.paste(c(OUT),mask=im.getchannel("A"))
    return s


def make_process_board(final):
    concept=Image.open(ROOT/"01-concept.png").convert("RGB")
    master=Image.open(ROOT/"02-pixel-master.png").convert("RGB")
    guide=Image.open(ROOT/"03-reduced-guide-32.png").convert("RGB")
    board=Image.new("RGB",(1100,650),(38,38,42)); d=ImageDraw.Draw(board)
    for label,src,x in [("1  CONCEPT",concept,10),("2  PIXEL MASTER",master,375)]:
        thumb=src.copy(); thumb.thumbnail((350,500),Image.Resampling.LANCZOS)
        board.paste(thumb,(x,40)); d.text((x,15),label,fill="white")
    board.paste(guide.resize((256,256),Image.Resampling.NEAREST),(738,40))
    d.text((738,15),"3  REDUCED GUIDE 32x32",fill="white")
    board.paste(neutral(final),(738,350)); d.text((738,325),"4  HAND-AUTHORED FINAL 32x32",fill="white")
    board.save(ROOT/"process-comparison.png")


def main():
    # Step 3 is reproducible and intentionally allowed to blur; it is a layout
    # guide only, never the delivered sprite.
    master=Image.open(ROOT/"02-pixel-master.png").convert("RGB")
    crop=master.crop((70,70,1465,910))
    reduced=crop.resize((30,18),Image.Resampling.LANCZOS)
    guide=Image.new("RGB",(32,32),(83,82,86)); guide.paste(reduced,(1,7))
    guide.save(ROOT/"03-reduced-guide-32.png")
    guide.resize((256,256),Image.Resampling.NEAREST).save(ROOT/"03-reduced-guide-32@8x.png")

    final=make_final()
    final.save(ROOT/"04-ash-toad-final-32.png")
    final.resize((256,256),Image.Resampling.NEAREST).save(ROOT/"04-ash-toad-final-32@8x.png")
    neutral(final).save(ROOT/"04-ash-toad-final-32-neutral@8x.png")
    neutral(silhouette_stage(final)).save(QUALITY/"silhouette@8x.png")
    make_process_board(final)

    pixels=list(final.get_flattened_data())
    report={"canvas":[32,32],"visible_bounds":list(final.getchannel('A').getbbox()),
            "colors":len({p[:3] for p in pixels if p[3]}),
            "alpha_values":sorted({p[3] for p in pixels}),
            "native_authored":True,"final_uses_resized_pixels":False,
            "workflow":["concept illustration","pixel-art master","32x32 reduced guide","native 32x32 redraw"]}
    (QUALITY/"design-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")


if __name__=="__main__":
    main()
