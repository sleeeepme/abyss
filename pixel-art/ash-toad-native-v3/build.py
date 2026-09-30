from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
Q = ROOT / "quality"
Q.mkdir(parents=True, exist_ok=True)

BG = (83, 82, 86, 255)
OUT = "#100d15"
DEEP = "#211c27"
COLD = "#302d3a"
OLIVE_D = "#47472e"
OLIVE = "#67643a"
OLIVE_L = "#8b8550"
STONE_D = "#716b63"
STONE = "#9f9787"
BONE_D = "#9b917f"
BONE = "#d1c4a6"
BONE_L = "#eee1bd"
AMBER = "#d99027"


def rgba(h):
    h=h.lstrip('#')
    return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)


def new_mask():
    return Image.new('L',(32,32),0)


def clear(mask, polygons=(), rectangles=()):
    d=ImageDraw.Draw(mask)
    for p in polygons: d.polygon(p,fill=0)
    for r in rectangles: d.rectangle(r,fill=0)


def silhouette_a():
    m=new_mask(); d=ImageDraw.Draw(m)
    d.polygon([(3,18),(5,14),(10,12),(15,12),(18,9),(22,8),(27,10),(29,13),(28,18),(25,21),(20,21),(17,19),(14,20),(11,23),(5,23)],fill=255)
    d.polygon([(4,21),(2,24),(3,26),(9,26),(12,22)],fill=255)
    d.polygon([(15,19),(17,22),(16,26),(20,26),(21,22),(19,19)],fill=255)
    d.polygon([(23,19),(25,22),(29,23),(30,25),(28,26),(23,25),(20,22)],fill=255)
    clear(m,polygons=[[(10,22),(13,20),(16,20),(16,23),(15,25),(11,25)]])
    return m


def silhouette_b():
    m=new_mask(); d=ImageDraw.Draw(m)
    # Longer rear leg and a smaller throat; closest to the pack's low dog ratio.
    d.polygon([(3,19),(5,15),(9,13),(15,13),(18,10),(22,9),(27,11),(29,14),(28,18),(25,20),(20,20),(17,18),(13,19),(10,22),(5,23)],fill=255)
    d.polygon([(4,20),(2,23),(2,25),(8,26),(12,22)],fill=255)
    d.polygon([(14,19),(17,20),(18,23),(17,26),(21,26),(22,23),(20,20)],fill=255)
    d.polygon([(23,19),(25,21),(29,22),(30,24),(29,26),(24,25),(21,22)],fill=255)
    clear(m,polygons=[[(9,23),(12,20),(15,20),(16,22),(15,25),(11,25)]])
    return m


def silhouette_c():
    m=new_mask(); d=ImageDraw.Draw(m)
    # Compact wedge with the eye bump and throat as separate contour events.
    d.polygon([(4,18),(6,14),(11,12),(16,12),(18,9),(21,8),(24,9),(25,10),(28,11),(29,14),(28,17),(25,18),(22,18),(20,17),(17,18),(13,20),(10,23),(5,23)],fill=255)
    d.polygon([(5,21),(2,24),(3,26),(9,26),(12,22)],fill=255)
    d.polygon([(14,19),(17,19),(19,21),(18,25),(20,26),(22,24),(21,21),(19,19)],fill=255)
    d.polygon([(22,17),(26,17),(28,19),(29,23),(27,25),(23,25),(21,22)],fill=255)
    d.polygon([(22,23),(25,25),(29,25),(30,26),(28,27),(23,27),(20,25)],fill=255)
    clear(m,polygons=[[(10,22),(13,20),(16,20),(17,22),(16,25),(12,25)]])
    return m


def silhouette_d():
    m=new_mask(); d=ImageDraw.Draw(m)
    # Strong frog crouch: high rump, low head and pronounced belly arch.
    d.polygon([(4,18),(6,13),(10,11),(14,12),(17,13),(19,10),(23,9),(27,11),(29,14),(28,17),(25,19),(21,19),(18,17),(15,18),(12,21),(9,23),(5,23)],fill=255)
    d.polygon([(6,20),(2,23),(2,25),(5,26),(10,25),(12,22)],fill=255)
    d.polygon([(14,18),(17,19),(18,21),(17,25),(20,26),(22,24),(21,20),(18,17)],fill=255)
    d.polygon([(23,18),(27,18),(29,21),(29,24),(27,25),(23,24),(21,21)],fill=255)
    clear(m,polygons=[[(9,23),(13,20),(16,20),(17,22),(16,25),(12,25)]])
    return m


def silhouette_e():
    m=new_mask(); d=ImageDraw.Draw(m)
    # Forward-leaning turret pose with the best separation between arm and sac.
    d.polygon([(3,19),(5,15),(9,13),(14,12),(18,12),(19,9),(22,8),(26,10),(29,12),(29,15),(27,18),(23,18),(20,17),(17,18),(13,20),(10,23),(5,23)],fill=255)
    d.polygon([(5,21),(2,24),(3,26),(9,26),(12,22)],fill=255)
    d.polygon([(14,19),(17,18),(19,20),(18,23),(17,26),(21,26),(22,23),(20,20)],fill=255)
    d.polygon([(23,17),(27,17),(29,20),(29,23),(27,25),(24,25),(22,22)],fill=255)
    d.polygon([(22,24),(25,26),(29,26),(30,27),(28,28),(23,27),(20,25)],fill=255)
    clear(m,polygons=[[(10,22),(13,20),(16,20),(17,22),(16,25),(12,25)],[(20,19),(22,18),(23,20),(22,22),(20,22)]])
    return m


def silhouette_f():
    m=new_mask(); d=ImageDraw.Draw(m)
    # Smallest, most icon-like option; deliberately restrained throat volume.
    d.polygon([(4,19),(6,15),(10,13),(15,13),(18,10),(21,9),(25,10),(28,12),(29,15),(27,18),(23,19),(19,18),(16,19),(12,22),(6,23)],fill=255)
    d.polygon([(5,21),(3,23),(3,25),(8,26),(11,23)],fill=255)
    d.polygon([(14,20),(17,19),(19,21),(18,25),(21,26),(22,23),(20,20)],fill=255)
    d.polygon([(23,18),(27,19),(29,22),(28,25),(24,25),(21,22)],fill=255)
    clear(m,polygons=[[(10,23),(13,21),(16,21),(17,23),(16,25),(12,25)]])
    return m


def mask_to_rgba(mask,color=OUT):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); im.paste(rgba(color),mask=mask); return im


def preview(im,scale=8):
    bg=Image.new('RGBA',(32,32),BG); bg.alpha_composite(im)
    return bg.convert('RGB').resize((32*scale,32*scale),Image.Resampling.NEAREST)


def metrics(mask):
    b=mask.getbbox(); opaque=sum(v for v in mask.get_flattened_data())//255
    area=(b[2]-b[0])*(b[3]-b[1])
    return {'bounds':list(b),'size':[b[2]-b[0],b[3]-b[1]],'opaque':opaque,'density':round(opaque/area,3)}


def flat_stage(mask):
    # Selected silhouette C. Four visual functions only: outline, body, stone
    # head/back, and throat. Every fill remains one pixel inside the silhouette.
    im=mask_to_rgba(mask)
    d=ImageDraw.Draw(im)
    d.polygon([(4,18),(6,14),(11,13),(16,13),(18,15),(17,18),(13,20),(10,23),(5,23)],fill=rgba(OLIVE))
    d.polygon([(10,13),(16,12),(18,9),(21,8),(24,9),(25,10),(28,11),(28,15),(25,17),(21,17),(18,15)],fill=rgba(STONE))
    d.polygon([(22,18),(26,18),(28,20),(28,23),(26,24),(23,24),(21,22)],fill=rgba(BONE))
    d.polygon([(5,22),(3,24),(4,25),(9,25),(11,22)],fill=rgba(OLIVE))
    d.polygon([(15,20),(18,20),(18,24),(20,25),(21,24),(20,21),(18,19)],fill=rgba(OLIVE))
    d.polygon([(22,24),(25,25),(28,25),(29,26),(27,26),(23,26),(21,25)],fill=rgba(BONE))
    return im


def final_sprite(mask):
    im=flat_stage(mask); d=ImageDraw.Draw(im)
    # Rear body: lower plane is one continuous cluster; highlight follows the
    # upper-left contour instead of tracing every edge.
    d.polygon([(4,19),(6,15),(10,13),(14,13),(16,15),(14,17),(9,18),(7,21),(4,22)],fill=rgba(OLIVE_D))
    d.polygon([(7,14),(11,13),(14,13),(15,14),(12,15),(8,16)],fill=rgba(OLIVE_L))
    d.polygon([(4,22),(7,19),(11,19),(10,22),(8,24),(4,24)],fill=rgba(OLIVE))
    # One bent contour turns the rear wedge into a recognisable folded frog leg.
    d.line([(4,21),(6,18),(10,17),(13,18)],fill=rgba(DEEP),width=1)
    d.line([(6,19),(9,18),(11,18)],fill=rgba(OLIVE_L),width=1)

    # Three unequal plates. The empty dark seams are authored clusters, not
    # automatic outlines, matching the Tiny RPG pack's internal line economy.
    d.polygon([(9,13),(11,11),(15,11),(17,13),(15,15),(11,15)],fill=rgba(STONE_D))
    d.polygon([(11,11),(15,11),(16,12),(14,13),(11,13)],fill=rgba(STONE))
    d.polygon([(15,12),(18,9),(21,8),(22,10),(20,13),(17,14)],fill=rgba(STONE_D))
    d.polygon([(19,9),(21,9),(20,11),(18,12),(17,11)],fill=rgba(STONE))
    d.polygon([(21,10),(24,9),(27,11),(28,13),(27,15),(23,16),(20,14)],fill=rgba(STONE_D))
    d.polygon([(24,10),(27,11),(27,13),(24,13),(22,12)],fill=rgba(STONE))

    # Eye uses the same economy as the approved dog: one amber focal pixel in a
    # compact socket, with one adjacent light pixel for the raised brow.
    d.rectangle((21,9,23,11),fill=rgba(DEEP))
    d.point((22,10),fill=rgba(AMBER))
    d.point((21,9),fill=rgba(BONE_L))

    # Wedge mouth: a single seam with a short pale lip, not a rectangular head.
    d.polygon([(22,12),(27,12),(28,14),(27,16),(23,16),(20,14)],fill=rgba(BONE_D))
    d.polygon([(23,12),(27,13),(27,14),(23,14),(21,13)],fill=rgba(STONE))
    d.line([(21,15),(27,15)],fill=rgba(DEEP),width=1)

    # Throat keeps the round contour from silhouette C. Broad crescent shading
    # leaves the upper-left highlight as a connected 6px cluster.
    d.polygon([(22,18),(25,17),(27,18),(28,20),(28,23),(26,24),(23,24),(21,22),(21,20)],fill=rgba(BONE_D))
    d.polygon([(23,18),(26,18),(27,20),(27,22),(25,23),(23,22),(22,20)],fill=rgba(BONE))
    d.polygon([(23,18),(25,18),(26,19),(25,20),(23,20),(22,19)],fill=rgba(BONE_L))

    # Folded rear foot, arm, and front toes keep three distinct ground contacts.
    d.polygon([(5,22),(3,24),(4,25),(8,25),(10,23)],fill=rgba(OLIVE_D))
    d.rectangle((4,24,7,24),fill=rgba(OLIVE_L))
    d.polygon([(15,20),(17,19),(19,21),(18,24),(20,25),(21,24),(20,21),(18,19)],fill=rgba(COLD))
    d.polygon([(16,20),(18,20),(18,23),(19,24),(18,24),(16,22)],fill=rgba(OLIVE))
    d.polygon([(22,24),(25,25),(28,25),(29,26),(27,26),(23,26),(21,25)],fill=rgba(STONE_D))
    d.rectangle((24,25,27,25),fill=rgba(STONE))
    return im


def board(candidates, selected, flat, final):
    sheet=Image.new('RGB',(3*272,2*292),(38,38,42)); d=ImageDraw.Draw(sheet)
    for i,(label,m) in enumerate(candidates):
        x=(i%3)*272+8; y=(i//3)*292+28
        sheet.paste(preview(mask_to_rgba(m)),(x,y)); met=metrics(m)
        d.text((x,8+(i//3)*292),f'{label}  {met["size"][0]}x{met["size"][1]}  {met["opaque"]}px',fill='white')
    sheet.save(Q/'silhouette-candidates.png')

    stages=Image.new('RGB',(4*272,296),(38,38,42)); sd=ImageDraw.Draw(stages)
    for i,(label,im) in enumerate([('SILHOUETTE C',mask_to_rgba(selected)),('4-COLOR MASS',flat),('FINAL',final),('FINAL FLIPPED',final.transpose(Image.Transpose.FLIP_LEFT_RIGHT))]):
        x=i*272+8; stages.paste(preview(im),(x,30)); sd.text((x,9),label,fill='white')
    stages.save(ROOT/'stage-comparison.png')


def main():
    candidates=list(zip('ABCDEF',[silhouette_a(),silhouette_b(),silhouette_c(),silhouette_d(),silhouette_e(),silhouette_f()]))
    selected=candidates[2][1]
    flat=flat_stage(selected); final=final_sprite(selected)
    board(candidates,selected,flat,final)
    for label,m in candidates: mask_to_rgba(m).save(Q/f'silhouette-{label.lower()}-32.png')
    flat.save(Q/'flat-4color-32.png')
    final.save(ROOT/'ash-toad-32.png')
    final.resize((256,256),Image.Resampling.NEAREST).save(ROOT/'ash-toad-32@8x.png')
    preview(final).save(ROOT/'ash-toad-32-neutral@8x.png')
    report={'candidates':{l:metrics(m) for l,m in candidates},'selected':'C',
            'final':{'canvas':[32,32],'bounds':list(final.getchannel('A').getbbox()),
                     'opaque':sum(v>0 for v in final.getchannel('A').get_flattened_data()),
                     'colors':len({p[:3] for p in final.get_flattened_data() if p[3]}),
                     'alpha':sorted(set(final.getchannel('A').get_flattened_data()))},
            'method':'native 32x32 silhouette-first; no concept art, resize, generated outline, or high-resolution source'}
    (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__': main()
