from pathlib import Path
import json

from PIL import Image, ImageDraw


ROOT=Path(__file__).resolve().parent
Q=ROOT/'quality'; Q.mkdir(parents=True,exist_ok=True)
BG=(83,82,86,255)
OUT='#100d15'; DEEP='#211c27'; COLD='#302d3a'
ASH_D='#4b4a43'; ASH='#68675b'; ASH_L='#898777'
STONE_D='#716b63'; STONE='#9f9787'; BONE_D='#9b917f'; BONE='#d1c4a6'; BONE_L='#eee1bd'; AMBER='#d99027'


def c(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)


def blank_mask(): return Image.new('L',(32,32),0)


def side_profile():
    m=blank_mask(); d=ImageDraw.Draw(m)
    # Large rear thigh and compact trunk are based on crouched anuran anatomy.
    d.ellipse((3,14,14,25),fill=255)
    d.ellipse((8,11,24,23),fill=255)
    d.polygon([(16,11),(19,8),(23,8),(25,10),(28,11),(29,15),(27,18),(20,19),(16,17)],fill=255)
    # Single visible eye mound.
    d.ellipse((19,6,24,11),fill=255)
    # Folded hind shank and long foot.
    d.polygon([(6,21),(10,20),(15,22),(18,25),(16,27),(10,26),(7,24),(3,26),(2,25)],fill=255)
    # Slender front support and toes.
    d.polygon([(19,18),(22,18),(22,23),(25,25),(24,27),(19,26),(18,22)],fill=255)
    d.polygon([(24,24),(29,24),(30,26),(28,27),(23,27)],fill=255)
    # Belly arch and leg separation.
    d.polygon([(13,23),(16,22),(18,23),(18,26),(16,27),(13,26)],fill=0)
    return m


def three_quarter():
    m=blank_mask(); d=ImageDraw.Draw(m)
    # Two eye mounds and a broad mouth follow the most readable 32px frog
    # references; the pose remains biased toward the right for battle use.
    d.ellipse((4,14,15,25),fill=255)       # rear thigh
    d.ellipse((8,11,25,23),fill=255)       # trunk
    d.polygon([(15,11),(18,9),(25,9),(28,11),(29,16),(27,19),(17,19),(14,16)],fill=255)
    d.ellipse((17,7,22,12),fill=255)       # far eye mound
    d.ellipse((22,6,27,12),fill=255)       # near eye mound
    # Folded hind leg travels forward under the body, rather than tapering away.
    d.polygon([(5,20),(9,19),(13,21),(16,24),(15,26),(10,26),(7,24),(3,26),(2,25)],fill=255)
    # Two narrow front legs with separate planted feet.
    d.polygon([(17,18),(20,18),(20,23),(22,25),(21,27),(17,26),(16,22)],fill=255)
    d.polygon([(24,18),(27,19),(27,23),(30,25),(29,27),(25,27),(23,23)],fill=255)
    d.polygon([(21,24),(25,25),(27,27),(24,28),(20,27)],fill=255)
    # Negative spaces identify the belly, near arm and far arm at 1x.
    d.polygon([(12,23),(15,21),(17,22),(17,26),(15,27),(12,26)],fill=0)
    d.polygon([(21,21),(23,19),(24,21),(24,24),(22,24)],fill=0)
    return m


def low_toad():
    m=blank_mask(); d=ImageDraw.Draw(m)
    # Flatter Bufo-like option: broad skull, lower eyes, heavier rear haunch.
    d.ellipse((3,14,15,26),fill=255)
    d.ellipse((8,12,24,24),fill=255)
    d.polygon([(15,12),(18,9),(24,9),(28,11),(29,15),(28,18),(24,20),(16,19)],fill=255)
    d.ellipse((17,7,22,12),fill=255)
    d.ellipse((22,7,27,12),fill=255)
    d.polygon([(5,21),(10,20),(14,22),(17,25),(15,27),(10,26),(7,24),(3,27),(2,26)],fill=255)
    d.polygon([(18,18),(21,18),(21,23),(24,25),(22,27),(18,26),(17,22)],fill=255)
    d.polygon([(24,19),(27,20),(27,24),(30,25),(29,27),(25,27),(23,23)],fill=255)
    d.polygon([(12,24),(15,22),(17,23),(17,26),(15,27),(12,26)],fill=0)
    d.polygon([(22,22),(24,20),(25,22),(25,25),(23,25)],fill=0)
    return m


def to_rgba(mask,color=OUT):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); im.paste(c(color),mask=mask); return im


def preview(im,scale=8):
    bg=Image.new('RGBA',(32,32),BG); bg.alpha_composite(im)
    return bg.convert('RGB').resize((32*scale,32*scale),Image.Resampling.NEAREST)


def metric(mask):
    b=mask.getbbox(); opaque=sum(v>0 for v in mask.get_flattened_data()); area=(b[2]-b[0])*(b[3]-b[1])
    return {'bounds':list(b),'size':[b[2]-b[0],b[3]-b[1]],'opaque':opaque,'density':round(opaque/area,3)}


def flat_mass(mask):
    # Candidate B: 3/4 side view. Four functional colors, preserving the exact
    # anatomy gate before any plate cracks or highlights are introduced.
    im=to_rgba(mask); d=ImageDraw.Draw(im)
    # Rear haunch and trunk leave one logical pixel of the authored outline.
    d.ellipse((5,15,14,24),fill=c(ASH))
    d.ellipse((9,12,24,22),fill=c(ASH))
    # Broad neckless head bridges directly into the trunk.
    d.polygon([(15,12),(18,10),(25,10),(27,12),(28,16),(26,18),(17,18),(15,16)],fill=c(STONE))
    d.ellipse((18,8,21,11),fill=c(STONE)); d.ellipse((23,7,26,11),fill=c(STONE))
    # Throat is an internal mass below the mouth, not a separate balloon body.
    d.polygon([(18,16),(25,16),(27,18),(26,21),(23,22),(19,21),(17,19)],fill=c(BONE))
    # Limbs.
    d.polygon([(5,20),(9,20),(13,22),(15,24),(14,25),(10,25),(7,23),(3,25)],fill=c(ASH))
    d.polygon([(17,19),(19,19),(19,23),(21,25),(20,26),(18,25),(17,22)],fill=c(ASH))
    d.polygon([(24,19),(26,20),(26,23),(29,25),(28,26),(25,26),(24,23)],fill=c(ASH))
    return im


def final(mask):
    im=flat_mass(mask); d=ImageDraw.Draw(im)
    # Haunch: round rear thigh, angular shin, flat forward-pointing foot.
    d.ellipse((5,16,13,24),fill=c(ASH_D))
    d.polygon([(7,16),(10,14),(14,15),(15,18),(12,20),(8,20),(5,19)],fill=c(ASH))
    d.polygon([(8,15),(11,14),(14,16),(12,17),(8,17)],fill=c(ASH_L))
    d.line([(5,21),(8,19),(12,20),(14,22)],fill=c(DEEP),width=1)
    d.polygon([(5,21),(9,20),(13,22),(15,24),(13,25),(9,24),(7,23),(3,25)],fill=c(ASH_D))
    d.rectangle((4,24,9,25),fill=c(ASH))

    # Trunk planes are compact so the haunch stays the largest body mass.
    d.polygon([(10,12),(15,12),(19,14),(19,18),(16,20),(12,19),(8,17)],fill=c(ASH_D))
    d.polygon([(11,12),(15,12),(18,14),(15,15),(11,14)],fill=c(ASH_L))

    # Three broad ash-stone plates. No tiny cracks or scattered texture.
    d.polygon([(10,13),(12,11),(16,11),(18,13),(16,15),(12,15)],fill=c(STONE_D))
    d.polygon([(12,11),(16,11),(17,12),(15,13),(12,13)],fill=c(STONE))
    d.polygon([(15,13),(18,10),(21,10),(22,13),(20,15),(17,15)],fill=c(STONE_D))
    d.polygon([(18,10),(21,10),(21,12),(19,13),(17,12)],fill=c(STONE))

    # Head remains broad and neckless. A long horizontal mouth is an amphibian
    # marker that was missing from the rejected silhouettes.
    d.polygon([(17,12),(19,10),(25,10),(27,12),(28,15),(26,17),(18,17),(16,15)],fill=c(ASH))
    d.polygon([(19,10),(24,10),(27,12),(26,13),(19,13),(17,12)],fill=c(ASH_L))
    d.line([(17,15),(27,15)],fill=c(DEEP),width=1)
    d.point((27,14),fill=c(OUT))

    # Two eye mounds; near eye is larger, preserving right-facing bias.
    d.rectangle((18,8,21,11),fill=c(DEEP)); d.rectangle((19,8,20,10),fill=c(STONE))
    d.point((20,9),fill=c(AMBER)); d.point((20,10),fill=c(OUT))
    d.rectangle((23,7,26,11),fill=c(DEEP)); d.rectangle((24,8,25,10),fill=c(BONE_D))
    d.point((25,9),fill=c(AMBER)); d.point((25,10),fill=c(OUT))

    # Small idle throat sac. Its expansion belongs to the attack animation.
    d.polygon([(18,16),(24,16),(26,18),(25,20),(22,21),(19,20),(17,18)],fill=c(BONE_D))
    d.polygon([(19,16),(23,16),(25,17),(24,19),(21,20),(19,19)],fill=c(BONE))
    d.polygon([(20,16),(23,16),(24,17),(22,18),(19,18)],fill=c(BONE_L))

    # Slender supports and planted toes, with explicit gaps between them.
    d.polygon([(17,19),(19,19),(19,23),(21,25),(20,26),(18,25),(17,22)],fill=c(COLD))
    d.polygon([(18,19),(19,20),(18,23),(20,25),(19,25),(17,23)],fill=c(ASH))
    d.polygon([(24,19),(26,20),(26,23),(29,25),(28,26),(25,26),(24,23)],fill=c(ASH_D))
    d.rectangle((25,25,28,25),fill=c(ASH_L))
    return im


def make_boards(candidates,chosen,flat,done):
    sheet=Image.new('RGB',(3*272,302),(38,38,42)); d=ImageDraw.Draw(sheet)
    for i,(label,m) in enumerate(candidates):
        x=i*272+8; sheet.paste(preview(to_rgba(m)),(x,38)); mt=metric(m)
        d.text((x,10),f'{label}  {mt["size"][0]}x{mt["size"][1]}  {mt["opaque"]}px',fill='white')
    sheet.save(Q/'anatomy-silhouettes.png')
    stage=Image.new('RGB',(3*272,302),(38,38,42)); sd=ImageDraw.Draw(stage)
    for i,(label,im) in enumerate([('ANATOMY SILHOUETTE B',to_rgba(chosen)),('4-COLOR MASS',flat),('FINAL 12-COLOR',done)]):
        x=i*272+8; stage.paste(preview(im),(x,38)); sd.text((x,10),label,fill='white')
    stage.save(ROOT/'stage-comparison.png')


def main():
    candidates=[('A SIDE PROFILE',side_profile()),('B 3/4 CROUCH',three_quarter()),('C LOW TOAD',low_toad())]
    chosen=candidates[1][1]; flat=flat_mass(chosen); done=final(chosen)
    make_boards(candidates,chosen,flat,done)
    for i,(_,m) in enumerate(candidates): to_rgba(m).save(Q/f'silhouette-{chr(97+i)}-32.png')
    flat.save(Q/'flat-4color-32.png')
    done.save(ROOT/'ash-toad-32.png')
    done.resize((256,256),Image.Resampling.NEAREST).save(ROOT/'ash-toad-32@8x.png')
    preview(done).save(ROOT/'ash-toad-32-neutral@8x.png')
    report={'references':['Frogs | Pixel Monsters 17 (~32px)', 'Pixel Art Field Enemies frog animation', 'Lil Froggy (16px abstraction)', 'Ragnarok Online Poisonous Toad', 'real crouched frog/toad silhouettes'],
            'observed_features':['two raised eye mounds','neckless broad mouth','rear thigh is largest mass','folded shin and planted long foot','thin forelegs','idle throat stays under jaw'],
            'candidates':{n:metric(m) for n,m in candidates},'selected':'B 3/4 CROUCH',
            'final':{'bounds':list(done.getchannel('A').getbbox()),'opaque':sum(v>0 for v in done.getchannel('A').get_flattened_data()),'colors':len({p[:3] for p in done.get_flattened_data() if p[3]}),'alpha':sorted(set(done.getchannel('A').get_flattened_data()))}}
    (Q/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__': main()
