"""Native 32px idle with explicit anatomy and connected, redrafted limbs."""
from pathlib import Path
import importlib.util
import json
import sys
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
Q=ROOT/'quality';Q.mkdir(exist_ok=True)
F=ROOT/'frames';F.mkdir(exist_ok=True)
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
spec=importlib.util.spec_from_file_location('hound_source',ROOT.parent/'ash-hound-tinyrpg-v1/build.py')
src=importlib.util.module_from_spec(spec);spec.loader.exec_module(src)
PAL=src.ASH+[src.AMBER]
POSES=[(0,0,0,0,520),(-1,0,0,0,160),(-1,-1,0,0,180),
       (-1,-1,1,1,240),(-1,-1,1,0,160),(0,-1,0,0,180),(0,0,0,0,340)]
# These are anatomical masks, with the neck underlapping the cranium.
HEAD={6:[(18,20),(23,24)],7:[(18,21),(23,25)],8:[(20,29)],9:[(21,29)],
      10:[(21,29)],11:[(21,29)],12:[(22,29)],13:[(22,29)],
      14:[(22,29)],15:[(22,29)],16:[(22,29)],17:[(22,29)]}
TAIL={5:[(4,10)],6:[(3,10)],7:[(2,9)],8:[(2,8)],9:[(2,8)],
      10:[(2,9)],11:[(3,10)],12:[(6,10)]}
TRUNK={8:[(13,19)],9:[(11,20)],10:[(10,20)],11:[(10,20)],
       12:[(10,21)],13:[(10,21)],14:[(9,21)],15:[(9,21)]}
LIMBS={
 'far_hind':{'root':(14,14),'foot':(14,20),'centers':{14:14,15:14,16:14,17:13,18:13,19:14,20:14},'far':True},
 'far_fore':{'root':(20,12),'foot':(21,20),'centers':{12:20,13:20,14:20,15:20,16:20,17:21,18:21,19:21,20:21},'far':True},
 'near_hind':{'root':(12,13),'foot':(10,20),'centers':{13:12,14:11,15:10,16:10,17:9,18:9,19:10,20:10},'far':False},
 'near_fore':{'root':(19,12),'foot':(17,20),'centers':{12:19,13:19,14:19,15:19,16:18,17:18,18:17,19:17,20:17},'far':False},
}

def cells(im):return {(x,y) for y in range(im.height) for x in range(im.width) if im.getpixel((x,y))[3]}
def reachable(points,start,diagonal=False):
    if start not in points:return set()
    seen={start};stack=[start]
    moves=[(1,0),(-1,0),(0,1),(0,-1)]+([(1,1),(1,-1),(-1,1),(-1,-1)] if diagonal else [])
    while stack:
        x,y=stack.pop()
        for dx,dy in moves:
            p=(x+dx,y+dy)
            if p in points and p not in seen:seen.add(p);stack.append(p)
    return seen
def components(im):
    remaining=cells(im);sizes=[]
    while remaining:
        part=reachable(remaining,next(iter(remaining)),True);remaining-=part;sizes.append(len(part))
    return sorted(sizes,reverse=True)
def mask_copy(s,base,spans,dx=0,dy=0):
    for y,ranges in spans.items():
        for left,right in ranges:
            for x in range(left,right+1):
                p=base.getpixel((x,y))
                if p[3]:s.px(x+dx,y+dy,p)

def pose(base,chest,head,tail,jaw):
    layers={};landmarks={}
    # The entire leg is a deliberately drawn profile down to a fixed toe.
    for name,limb in LIMBS.items():
        s=Sprite(32,32,palette=PAL);centers=dict(limb['centers'])
        rx,ry=limb['root'];root=(rx,ry+chest)
        if chest:centers[ry-1]=rx
        previous=None
        for y in sorted(centers):
            cx=centers[y]
            if limb['far']:
                # Distant limbs are compressed dark marks, not four equally
                # outlined cylinders. A one-cell elbow step keeps 4-connectivity.
                s.px(cx,y,src.OUTLINE)
                if previous is not None and previous!=cx:s.px(previous,y,src.OUTLINE)
            else:
                for dx in (-1,0,1):s.px(cx+dx,y,src.OUTLINE if dx else src.BODY)
            previous=cx
        # A compact terminal mark avoids the rectangular boot silhouette.
        fx,fy=limb['foot']
        for dx in (-1,1):s.px(fx+dx,fy,None)
        s.px(fx,fy,src.OUTLINE)
        layers[name]=s.composite();landmarks[name]={'root':root,'foot':limb['foot']}
    trunk=Sprite(32,32,palette=PAL);mask_copy(trunk,base,TRUNK,dy=chest)
    # A short overlapping neck plane connects shoulder and the skull at both heights.
    for y in range(11+min(chest,head),15+max(chest,head)):
        trunk.px(20,y,src.BODY);trunk.px(21,y,src.COLD)
    layers['trunk']=trunk.composite()
    tail_s=Sprite(32,32,palette=PAL)
    for y,ranges in TAIL.items():mask_copy(tail_s,base,{y:ranges},dx=tail if y<=9 else 0,dy=chest)
    layers['tail']=tail_s.composite()
    head_s=Sprite(32,32,palette=PAL)
    for y,ranges in HEAD.items():mask_copy(head_s,base,{y:ranges},dy=head+(jaw if y>=14 else 0))
    if jaw:
        for x in range(22,30):
            if base.getpixel((x,14))[3]:head_s.px(x,14+head,src.OUTLINE if x in (22,29) else src.MOUTH_DARK)
    layers['head']=head_s.composite()
    im=Image.new('RGBA',(32,32))
    for layer in layers.values():im.alpha_composite(layer)
    return im,layers,landmarks

def preview(im,scale=6,bg=(81,80,85)):
    out=Image.new('RGBA',im.size,(*bg,255));out.alpha_composite(im)
    return out.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

def main():
    base=src.variant_b().composite().convert('RGBA')
    frames=[];reports=[];anatomy=[];ghosts=[]
    anim=Sprite(32,32,palette=PAL)
    semantic={'far_hind':(98,112,199),'far_fore':(126,167,210),'near_hind':(208,131,72),
              'near_fore':(223,183,92),'trunk':(98,158,111),'tail':(163,113,183),'head':(207,97,107)}
    for i,(chest,head,tail,jaw,ms) in enumerate(POSES):
        im,layers,marks=pose(base,chest,head,tail,jaw);frames.append(im)
        without_head=Image.new('RGBA',(32,32))
        color_map=Image.new('RGBA',(32,32))
        for name,layer in layers.items():
            if name!='head':without_head.alpha_composite(layer)
            colored=Image.new('RGBA',(32,32),(*semantic[name],255));colored.putalpha(layer.getchannel('A'));color_map.alpha_composite(colored)
        checks={}
        for name,lm in marks.items():
            path=reachable(cells(layers[name]),lm['foot'])
            visible_path=reachable(cells(without_head),lm['foot'])
            checks[name]={'limb_connected':lm['root'] in path,'connected_without_head':lm['root'] in visible_path,
                          'root_overlaps_torso':lm['root'] in cells(layers['trunk'])}
            assert all(checks[name].values()),(i,name,checks[name])
            color_map.putpixel(lm['root'],(244,241,204,255));color_map.putpixel(lm['foot'],(244,241,204,255))
        assert len(components(im))==1,(i,components(im))
        assert im.crop((0,19,32,32)).tobytes()==frames[0].crop((0,19,32,32)).tobytes()
        bbox=im.getbbox();assert bbox[0]>0 and bbox[1]>0 and bbox[2]<32 and bbox[3]<32
        colors={p[:3] for p in im.get_flattened_data() if p[3]};assert len(colors)<=12
        im.save(F/f'{i:02d}.png');anatomy.append(color_map);ghosts.append(without_head)
        color_map.save(F/f'anatomy-{i:02d}.png');without_head.save(F/f'without-head-{i:02d}.png')
        if i:anim.add_frame(copy=False,duration=ms)
        anim.set_duration(ms)
        for x,y in cells(im):anim.px(x,y,im.getpixel((x,y)))
        reports.append({'frame':i,'bbox':bbox,'components_8way':components(im),'colors':len(colors),'limb_checks':checks})
    # The original mouth is retained, including its intentional cavities.
    assert frames[0].crop((22,9,30,18)).tobytes()==base.crop((22,9,30,18)).tobytes()
    assert frames[0].tobytes()==frames[-1].tobytes()
    anim.tag('idle',1,len(POSES));anim.save_gif(ROOT/'ash-hound-idle-32.gif',scale=1)
    anim.save_gif(ROOT/'ash-hound-idle-8x.gif',scale=8,bg='#515055')
    anim.save_spritesheet(ROOT/'ash-hound-idle-sheet.png',layout='horizontal')
    frames[0].save(ROOT/'ash-hound-rest-32.png')
    for name,images in [('frames',frames),('anatomy',anatomy),('without-head',ghosts)]:
        sheet=Image.new('RGB',(192*7,216),(81,80,85));d=ImageDraw.Draw(sheet)
        for i,im in enumerate(images):
            sheet.paste(preview(im),(192*i,24));d.text((192*i+8,6),f'{i+1} / {POSES[i][-1]}ms',fill=(242,239,223))
        sheet.save(Q/f'{name}-6x.png')
    comparison=Image.new('RGB',(640,352),(81,80,85));d=ImageDraw.Draw(comparison)
    old=Image.open(ROOT.parent/'ash-hound-idle-v1/frames/02.png').convert('RGBA')
    for x,label,art in [(24,'OLD / raised pose',old),(344,'FIXED / raised pose',frames[2])]:
        d.text((x,12),label,fill=(240,237,225));comparison.paste(preview(art,8),(x,40))
    comparison.save(Q/'comparison-raised.png')
    regression={}
    for i in range(7):
        old=Image.open(ROOT.parent/f'ash-hound-idle-v1/frames/{i:02d}.png').convert('RGBA');regression[str(i)]=components(old)
    (Q/'report.json').write_text(json.dumps({'frames':reports,'old_component_sizes':regression,
        'feet_fixed':True,'rest_mouth_exact':True,'duration_ms':sum(p[-1] for p in POSES)},indent=2)+'\n')
    print(json.dumps({'frames':len(frames),'connected_components':[r['components_8way'] for r in reports], 'old_components':regression}))

if __name__=='__main__':main()
