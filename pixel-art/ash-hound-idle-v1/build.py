"""Native pixel animation based on the approved code-authored Ash Hound."""
from pathlib import Path
import importlib.util
import json
import sys
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
Q=ROOT/'quality';Q.mkdir(exist_ok=True)
FRAMES=ROOT/'frames';FRAMES.mkdir(exist_ok=True)
sys.path.insert(0,'/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
spec=importlib.util.spec_from_file_location('approved_hound',ROOT.parent/'ash-hound-tinyrpg-v1/build.py')
source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)

# chest y, head y, tail-tip x, jaw opening, milliseconds
POSES=[(0,0,0,0,520),(-1,0,0,0,160),(-1,-1,0,0,180),
       (-1,-1,1,1,240),(-1,-1,1,0,160),(0,-1,0,0,180),(0,0,0,0,340)]

def draw_pose(base,chest,head,tail,jaw):
    s=Sprite(32,32,palette=source.ASH+[source.AMBER])
    parts={name:[] for name in ['legs','body','tail','head','jaw']}
    for y in range(32):
        for x in range(32):
            p=base.getpixel((x,y))
            if not p[3]:continue
            if y>=19 and p[:3]==(85,84,94):continue
            if x>=22 and 14<=y<=17:part='jaw'
            elif x>=21 and y<=17 or x>=18 and y<=8:part='head'
            elif y>=17:part='legs'
            elif x<=10 and y<=12:part='tail'
            else:part='body'
            parts[part].append((x,y,p))
    # Static contact marks first, then the upper bodies that overlap their roots.
    for name in ['legs','body','tail','head','jaw']:
        for x,y,p in parts[name]:
            dy=chest if name in ['body','tail'] else head if name in ['head','jaw'] else 0
            dx=tail if name=='tail' and y<=9 else 0
            if name=='jaw':dy+=jaw
            s.px(x+dx,y+dy,p)
    if chest:
        # Preserve the original hip/knee junction while feet remain planted.
        for x in range(8,21):
            p=base.getpixel((x,16))
            if p[3] and base.getpixel((x,17))[3]:s.px(x,16,p)
    if jaw:
        # A dark seam opens between upper mouth and the preserved lower-jaw row.
        for x in range(22,30):
            p=base.getpixel((x,14))
            if p[3]:s.px(x,14+head,source.OUTLINE if x in (22,29) else source.MOUTH_DARK)
    return s

def bg_preview(im,scale=8,shadow=None):
    b=Image.new('RGBA',(32,32),(81,80,85,255))
    if shadow:b.alpha_composite(shadow)
    b.alpha_composite(im)
    return b.convert('RGB').resize((32*scale,32*scale),Image.Resampling.NEAREST)

def main():
    base=source.variant_b().composite().convert('RGBA')
    shadow=Image.new('RGBA',base.size)
    for y in range(19,32):
        for x in range(32):
            if base.getpixel((x,y))==(85,84,94,255):shadow.putpixel((x,y),(59,54,64,255))
    shadow.save(ROOT/'preview-shadow.png')
    animation=Sprite(32,32,palette=source.ASH+[source.AMBER])
    frames=[];report=[]
    for i,(chest,head,tail,jaw,ms) in enumerate(POSES):
        pose=draw_pose(base,chest,head,tail,jaw);im=pose.composite().convert('RGBA');frames.append(im)
        if i:animation.add_frame(copy=False,duration=ms)
        animation.set_duration(ms)
        for y in range(32):
            for x in range(32):
                if im.getpixel((x,y))[3]:animation.px(x,y,im.getpixel((x,y)))
        im.save(FRAMES/f'{i:02d}.png')
        bbox=im.getbbox()
        assert bbox[0]>0 and bbox[1]>0 and bbox[2]<32 and bbox[3]<32
        assert im.crop((0,18,32,32)).tobytes()==frames[0].crop((0,18,32,32)).tobytes()
        colors={p[:3] for p in im.get_flattened_data() if p[3]}
        assert len(colors)<=12
        report.append({'frame':i,'duration_ms':ms,'bbox':bbox,'colors':len(colors)})
    assert frames[0].crop((21,6,30,18)).tobytes()==base.crop((21,6,30,18)).tobytes()
    animation.tag('idle',1,len(POSES))
    animation.save_gif(ROOT/'ash-hound-idle-32.gif',scale=1)
    animation.save_gif(ROOT/'ash-hound-idle-8x.gif',scale=8,bg='#515055')
    animation.save_spritesheet(ROOT/'ash-hound-idle-sheet.png',layout='horizontal')
    animation.save_project(ROOT/'ash-hound-idle.pixelstudio')
    frames[0].save(ROOT/'ash-hound-rest-32.png')
    sheet=Image.new('RGB',(7*192,216),(81,80,85));d=ImageDraw.Draw(sheet)
    for i,im in enumerate(frames):
        d.text((i*192+8,6),f'{i+1}: {POSES[i][-1]}ms',fill=(240,238,232))
        sheet.paste(bg_preview(im,6,shadow),(i*192,24))
    sheet.save(Q/'frames-6x.png')
    (Q/'report.json').write_text(json.dumps({'frame_size':[32,32],'duration_ms':sum(p[-1] for p in POSES),
        'frames':report,'feet_fixed':True,'rest_face_matches_approved':True,'native_authored':True},indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':main()
