from pathlib import Path
import json

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT=Path(__file__).resolve().parent
Q=ROOT/'quality'; Q.mkdir(parents=True,exist_ok=True)
BG=(83,82,86,255)

# Value-separated palette. Adjacent entries are intentionally far enough apart
# to survive at native scale, following the referenced shadow-first tutorial.
OUT='#100d15'; OUT_L='#282534'; DEEP='#211c27'; COLD='#302d3a'
SKIN_D='#3b403a'; SKIN='#596057'; SKIN_L='#818775'
STONE_D='#625d5c'; STONE='#968d7c'; BONE='#c9bda0'; BONE_L='#eee1bd'
AMBER='#d99027'


def c(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)


def mask_from(draw_fn):
    m=Image.new('L',(32,32),0); draw_fn(ImageDraw.Draw(m)); return m


def silhouette():
    # Exact Ash Hound occupancy: x=2..29, y=7..25 => 28x19.
    def draw(d):
        # Anatomical masses: rear thigh, trunk/head, eye mounds.
        d.ellipse((4,13,14,23),fill=255)
        d.ellipse((8,10,25,21),fill=255)
        d.polygon([(15,10),(18,9),(25,9),(28,11),(29,15),(27,17),(18,18),(15,16)],fill=255)
        d.ellipse((17,7,21,11),fill=255)
        d.ellipse((22,7,26,11),fill=255)
        # Folded rear shank and long foot.
        d.polygon([(5,19),(9,18),(13,20),(16,23),(14,25),(9,24),(7,22),(3,25),(2,24)],fill=255)
        # Near and far forelegs with separate planted toes.
        d.polygon([(17,17),(20,17),(20,21),(22,23),(21,25),(17,24),(16,20)],fill=255)
        d.polygon([(24,17),(27,18),(27,22),(29,23),(29,25),(25,25),(23,21)],fill=255)
        # Belly arch and arm separation are part of the silhouette design.
        d.polygon([(12,21),(15,19),(17,20),(17,23),(15,25),(12,24)],fill=0)
        d.polygon([(21,19),(23,17),(24,19),(24,22),(22,22)],fill=0)
        # Keep the folded hind foot connected after carving the belly arch.
        d.point((14,24),fill=255)
    return mask_from(draw)


def material_masks(sil):
    skin=sil.copy()
    stone=Image.new('L',(32,32),0); d=ImageDraw.Draw(stone)
    # Unequal broad plates and the flat cranial plane.
    d.polygon([(9,12),(11,10),(15,10),(17,12),(15,15),(11,15),(9,14)],fill=255)
    d.polygon([(15,12),(18,9),(21,9),(22,12),(20,14),(17,15)],fill=255)
    d.polygon([(20,11),(23,9),(27,11),(28,13),(26,15),(21,15)],fill=255)
    stone=ImageChops.multiply(stone,sil)
    throat=Image.new('L',(32,32),0); d=ImageDraw.Draw(throat)
    d.polygon([(17,15),(24,15),(27,17),(26,20),(23,21),(19,20),(16,18)],fill=255)
    throat=ImageChops.multiply(throat,sil)
    # Remove foreground materials from skin.
    skin=ImageChops.subtract(skin,ImageChops.lighter(stone,throat))
    return skin,stone,throat


def shadow_and_light_masks(sil):
    shadow=Image.new('L',(32,32),0); d=ImageDraw.Draw(shadow)
    # Strong lower/rear shadow, plus cavities between the planted limbs.
    d.polygon([(2,18),(8,16),(13,17),(17,20),(22,21),(31,21),(31,27),(1,27)],fill=255)
    d.polygon([(14,14),(18,14),(19,18),(16,20),(13,18)],fill=255)
    shadow=ImageChops.multiply(shadow,sil)
    light=Image.new('L',(32,32),0); d=ImageDraw.Draw(light)
    # Upper-left light is placed as a few connected planes, never as pixels of noise.
    d.polygon([(6,14),(8,12),(12,11),(14,12),(12,14),(8,15)],fill=255)
    d.polygon([(12,10),(15,9),(18,10),(17,11),(14,12),(12,11)],fill=255)
    d.polygon([(21,10),(23,9),(26,10),(25,11),(22,11)],fill=255)
    d.polygon([(18,16),(21,15),(24,16),(22,17),(19,17)],fill=255)
    light=ImageChops.multiply(light,sil)
    return shadow,light


def stage1(sil):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); im.paste((88,88,88,255),mask=sil); return im


def stage2(sil,shadow):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); im.paste((132,132,132,255),mask=sil); im.paste((42,42,42,255),mask=shadow); return im


def stage3(sil,shadow,light):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); im.paste((126,126,126,255),mask=sil); im.paste((46,46,46,255),mask=shadow); im.paste((205,205,205,255),mask=light)
    d=ImageDraw.Draw(im)
    # Internal separations are added only after the large value planes work.
    d.line([(5,20),(8,18),(12,19),(15,21)],fill=(25,25,25,255),width=1)
    d.line([(16,14),(26,14)],fill=(28,28,28,255),width=1)
    return im


def stage4_outline(sil,toned):
    eroded=sil.filter(ImageFilter.MinFilter(3)); border=ImageChops.subtract(sil,eroded)
    im=toned.copy(); im.paste(c(OUT),mask=border)
    d=ImageDraw.Draw(im)
    # Selective lit contour on the upper-left, matching the tutorial rather than
    # surrounding the sprite with a uniform mechanical line.
    for p in [(6,13),(7,12),(8,12),(9,11),(10,10),(11,10),(12,9),(13,9),
              (18,8),(19,7),(23,7),(24,7),(25,8)]:
        if sil.getpixel(p): d.point(p,fill=c(OUT_L))
    return im


def final_color(sil,skin,stone,throat,shadow,light):
    eroded=sil.filter(ImageFilter.MinFilter(3)); border=ImageChops.subtract(sil,eroded)
    im=Image.new('RGBA',(32,32),(0,0,0,0))

    def paint_material(mask,dark,mid,bright):
        base=ImageChops.subtract(mask,ImageChops.lighter(shadow,light))
        sm=ImageChops.multiply(mask,shadow); lm=ImageChops.multiply(mask,light)
        im.paste(c(mid),mask=base); im.paste(c(dark),mask=sm); im.paste(c(bright),mask=lm)

    paint_material(skin,SKIN_D,SKIN,SKIN_L)
    paint_material(stone,STONE_D,STONE,BONE)
    paint_material(throat,STONE_D,BONE,BONE_L)
    im.paste(c(OUT),mask=border)
    d=ImageDraw.Draw(im)

    # Selective lighter upper contour.
    for p in [(6,13),(7,12),(8,12),(9,11),(10,10),(11,10),(12,9),(13,9),
              (18,8),(19,7),(23,7),(24,7),(25,8),(26,9)]:
        if sil.getpixel(p): d.point(p,fill=c(OUT_L))

    # Plate seams follow form and use large connected runs.
    d.line([(10,13),(12,11),(15,11),(16,12)],fill=c(DEEP),width=1)
    d.line([(16,13),(18,10),(21,10)],fill=c(DEEP),width=1)
    d.line([(21,13),(23,10),(26,11)],fill=c(DEEP),width=1)

    # A few compact surface clusters create the same information density as the
    # approved sprites without turning into single-pixel noise.
    d.polygon([(7,14),(9,13),(11,13),(10,14),(8,15)],fill=c(SKIN_L))
    d.polygon([(12,11),(15,10),(16,11),(14,12),(12,12)],fill=c(BONE))
    d.polygon([(18,10),(20,9),(21,10),(20,11),(18,11)],fill=c(STONE))

    # Broad amphibian mouth and two eye mounds.
    d.line([(16,14),(27,14)],fill=c(DEEP),width=1)
    d.point((28,13),fill=c(OUT))
    d.rectangle((18,8,21,11),fill=c(DEEP)); d.point((19,9),fill=c(STONE)); d.point((20,9),fill=c(AMBER)); d.point((20,10),fill=c(OUT))
    d.rectangle((23,8,26,11),fill=c(DEEP)); d.point((24,9),fill=c(BONE)); d.point((25,9),fill=c(AMBER)); d.point((25,10),fill=c(OUT))

    # Reassert anatomical folds and three distinct ground contacts.
    d.line([(5,20),(8,18),(12,19),(15,21)],fill=c(DEEP),width=1)
    d.line([(17,19),(19,19),(19,23)],fill=c(COLD),width=1)
    d.rectangle((4,23,8,24),fill=c(SKIN)); d.line([(4,24),(8,24)],fill=c(OUT),width=1)
    d.rectangle((25,23,28,24),fill=c(STONE_D)); d.line([(25,24),(29,24)],fill=c(OUT),width=1)
    d.rectangle((5,23,7,23),fill=c(SKIN_L)); d.rectangle((25,23,27,23),fill=c(STONE))
    return im


def preview(im,scale=8):
    bg=Image.new('RGBA',(32,32),BG); bg.alpha_composite(im)
    return bg.convert('RGB').resize((32*scale,32*scale),Image.Resampling.NEAREST)


def main():
    sil=silhouette(); skin,stone,throat=material_masks(sil); shadow,light=shadow_and_light_masks(sil)
    s1=stage1(sil); s2=stage2(sil,shadow); s3=stage3(sil,shadow,light); s4=stage4_outline(sil,s3); done=final_color(sil,skin,stone,throat,shadow,light)
    stages=[('1 SILHOUETTE',s1),('2 STRONG SHADOW',s2),('3 REFINED VALUES',s3),('4 OUTLINE',s4),('5 COLOR ADJUST',done)]
    board=Image.new('RGB',(5*272,302),(38,38,42)); d=ImageDraw.Draw(board)
    for i,(label,im) in enumerate(stages):
        x=i*272+8; board.paste(preview(im),(x,38)); d.text((x,10),label,fill='white')
        im.save(Q/f'{i+1}-{label.lower().replace(" ","-")}-32.png')
    board.save(ROOT/'article-method-stages.png')
    done.save(ROOT/'ash-toad-32.png'); done.resize((256,256),Image.Resampling.NEAREST).save(ROOT/'ash-toad-32@8x.png'); preview(done).save(ROOT/'ash-toad-32-neutral@8x.png')
    px=list(done.get_flattened_data()); report={'canvas':[32,32],'bounds':list(done.getchannel('A').getbbox()),'opaque':sum(p[3]>0 for p in px),'colors':len({p[:3] for p in px if p[3]}),'alpha':sorted({p[3] for p in px}),'method':['silhouette','strong shadow','refined values','outline with lit upper edge','color adjustment']}
    (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__': main()
