"""Native-pixel revision of the existing code-authored Ash Hound.

The approved construction is loaded from its Python source, then small regions
are deliberately redrafted at native resolution. No resampling into the asset.
"""
from pathlib import Path
import importlib.util
import json
import sys
from collections import Counter, deque
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
Q = ROOT / 'quality'
Q.mkdir(exist_ok=True)
sys.path.insert(0, '/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite

SOURCE = ROOT.parent / 'ash-hound-tinyrpg-v1/build.py'
spec = importlib.util.spec_from_file_location('approved_hound', SOURCE)
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)

PAL = dict(zip('0123456789AB', [
    '#100d15', '#55545e', '#3a3945', '#252534', '#817865', '#211723',
    '#55272a', '#b9ad91', '#e0d4b5', '#8f4930', '#b8673d', '#d99a3b']))

def stamp(s, x, y, rows):
    assert len({len(row) for row in rows}) == 1
    for dy, row in enumerate(rows):
        for dx, symbol in enumerate(row):
            if symbol != '_':
                s.px(x+dx, y+dy, None if symbol == '.' else PAL[symbol])

def build():
    s = source.variant_b()
    # The approved PNG includes a broad opaque grounding shadow. Keep the new
    # reusable creature separate from that effect; give its feet their own shape.
    for y in range(19, 32):
        for x in range(32):
            if s.get(x,y) == (85,84,94,255):
                s.px(x,y,None)
    # Retain compressed limb marks from the benchmark. Extra toe/ankle outlines
    # read as little boots rather than a creature at this resolution.
    # Broad charcoal torso. Three irregular rib marks taper and stop above belly.
    stamp(s, 11, 11, [
        '2222222222',
        '2472247242',
        '2374272432',
        '2234234233',
    ])
    # Clear, small head planes. Eye / dark mouth / teeth have distinct jobs.
    stamp(s, 22, 9, [
        '21111120',
        '20B22230',
        '20002200',
        '23076660',
        '23080660',
        '23069960',
        '2347A430',
        '22111100',
        '0000000.',
    ])
    # Keep the shoulder connected to the neck instead of outlining each part.
    for x,y,c in [(20,12,'2'),(21,12,'3'),(20,13,'2'),(21,13,'3'),
                  (20,14,'2'),(21,14,'3'),(20,15,'3'),(21,15,'2')]:
        s.px(x,y,PAL[c])
    # Small tail/bone highlight; the eye remains the only amber pixel.
    s.px(4,6,PAL['7']); s.px(9,6,PAL['4'])
    # Close specific exposed edge pixels. Do not dilate the silhouette or add
    # another outline outside it. Thin distant limbs remain dark graphic marks.
    for x,y in [(5,6),(13,9),(16,9),(12,10),(15,10),(11,11),
                (18,16),(13,17),(17,17),(13,18),(13,19),
                (10,20),(13,20),(17,20),(23,20)]:
        s.px(x,y,PAL['0'])
    return s

def preview(im, scale=8, bg=(81,80,85)):
    base=Image.new('RGBA', im.size, (*bg,255)); base.alpha_composite(im)
    return base.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

def main():
    s=build(); im=s.composite().convert('RGBA')
    s.save_png(ROOT/'ash-hound-32.png')
    s.save_png(ROOT/'ash-hound-32-8x.png',scale=8)
    preview(im).save(ROOT/'preview-8x.png')
    approved=Image.open(ROOT.parent/'ash-hound-tinyrpg-v1/ash-hound-32.png').convert('RGBA')
    tiny=Image.open(ROOT.parent/'tiny-rpg-dog-reconstruction-v1/tiny-rpg-dog-32.png').convert('RGBA')
    sheet=Image.new('RGB',(848,416),(81,80,85)); d=ImageDraw.Draw(sheet)
    for i,(label,art) in enumerate([('TinyRPG study',tiny),('Approved Ash Hound',approved),('New Ash Hound',im)]):
        x=16+i*280; d.text((x,14),label,fill=(238,235,224));sheet.paste(preview(art),(x,40))
        sheet.paste(preview(art,1),(x,320));sheet.paste(preview(art,2),(x+48,304))
    sheet.save(ROOT/'comparison.png')
    sil=Image.new('RGBA',im.size,(0,0,0,0));sil.paste((16,13,21,255),mask=im.getchannel('A'))
    sil.save(Q/'silhouette-32.png');preview(sil).save(Q/'silhouette-8x.png')
    flat=im.copy()
    groups={PAL[c]:PAL['2'] for c in '01235'}
    groups.update({PAL[c]:PAL['7'] for c in '478'})
    groups.update({PAL[c]:PAL['9'] for c in '69A'})
    for y in range(32):
        for x in range(32):
            p=flat.getpixel((x,y))
            if p[3]:
                h='#%02x%02x%02x'%p[:3]
                if h in groups:
                    c=groups[h]; flat.putpixel((x,y),(*bytes.fromhex(c[1:]),255))
    flat.save(Q/'masses-32.png')
    checks=Image.new('RGB',(768,280),(38,35,43));draw=ImageDraw.Draw(checks)
    for i,bg in enumerate([(28,26,33),(81,80,85),(155,146,128)]):
        checks.paste(preview(im,8,bg),(i*256,24));draw.text((i*256+8,6),str(bg),fill=(230,230,230))
    checks.save(Q/'backgrounds.png')
    colors=Counter(p for p in im.get_flattened_data() if p[3])
    occupied={(x,y) for y in range(32) for x in range(32) if im.getpixel((x,y))[3]}
    edge=[p for p in occupied if any((p[0]+dx,p[1]+dy) not in occupied
          for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)])]
    edge_gaps=[p for p in edge if im.getpixel(p)[:3] != (16,13,21)]
    unseen=set(occupied); components=[]
    while unseen:
        todo=[unseen.pop()]; component=[]
        while todo:
            x,y=todo.pop();component.append((x,y))
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    other=(x+dx,y+dy)
                    if other in unseen:unseen.remove(other);todo.append(other)
        components.append(len(component))
    report={'size':im.size,'bbox':im.getbbox(),'colors':len(colors),
            'alpha_values':sorted(set(im.getchannel('A').get_flattened_data())),
            'four_neighbor_outline_gaps':edge_gaps,'connected_components_8way':components,
            'native_authored':True,'palette':{'#%02x%02x%02x'%k[:3]:v for k,v in colors.items()}}
    assert im.size==(32,32) and len(colors)==12 and not edge_gaps
    assert len(components)==1
    (Q/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':main()
