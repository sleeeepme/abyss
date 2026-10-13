"""Glow layers for the existing native, code-authored familiar sprites."""
from pathlib import Path
import json
import zipfile
import argparse
import base64
import re
from PIL import Image,ImageDraw,ImageFilter,ImageChops

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'kin-compact-v2/native'
NAMES=['wisp','bat','owl','eye','skull','jelly']
SIZE=24
PAD=4

def exterior_mask(alpha):
    empty={(x,y) for y in range(SIZE) for x in range(SIZE) if alpha.getpixel((x,y))==0}
    seen={(0,0)};todo=[(0,0)]
    while todo:
        x,y=todo.pop()
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            p=x+dx,y+dy
            if p in empty and p not in seen:seen.add(p);todo.append(p)
    mask=Image.new('L',(SIZE,SIZE))
    for p in seen:mask.putpixel(p,255)
    return mask

def spirit(base):
    core=Image.new('RGBA',(SIZE,SIZE));core.alpha_composite(base,(PAD,PAD))
    alpha=core.getchannel('A');exterior=exterior_mask(alpha)
    ring=Image.new('L',(SIZE,SIZE))
    for y in range(1,SIZE-1):
        for x in range(1,SIZE-1):
            if exterior.getpixel((x,y)) and any(alpha.getpixel((x+dx,y+dy)) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):
                ring.putpixel((x,y),255)
    outline=Image.new('RGBA',(SIZE,SIZE))
    bounds=alpha.getbbox();middle=(bounds[1]+bounds[3])/2
    for y in range(SIZE):
        for x in range(SIZE):
            if ring.getpixel((x,y)):
                outline.putpixel((x,y),(184,240,255,212) if y<middle else (110,209,245,190))
    # Blur only emitted light. The character and 1px rim stay on the native grid.
    near=ring.filter(ImageFilter.GaussianBlur(0.8)).point(lambda a:round(a*.75))
    far=ring.filter(ImageFilter.GaussianBlur(1.7)).point(lambda a:round(a*.70))
    glow=Image.new('RGBA',(SIZE,SIZE))
    for mask,color in [(far,(67,140,234)),(near,(79,201,251))]:
        mask=ImageChops.multiply(mask,exterior)
        layer=Image.new('RGBA',(SIZE,SIZE),(*color,0));layer.putalpha(mask);glow.alpha_composite(layer)
    effect=glow.copy();effect.alpha_composite(outline)
    final=effect.copy();final.alpha_composite(core)
    return core,outline,glow,effect,final,ring

def preview(im,scale=6,bg=(26,28,40)):
    b=Image.new('RGBA',im.size,(*bg,255));b.alpha_composite(im)
    return b.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

def main():
    for folder in ['native','body-16','layers','quality']:(ROOT/folder).mkdir(parents=True,exist_ok=True)
    report={};images=[]
    for name in NAMES:
        path=SOURCE/f'kin-{name}.png';base=Image.open(path).convert('RGBA')
        edits=[]
        if name=='wisp':
            # Close the two blue side gaps with the existing near-black outline.
            for p in [(5,8),(10,8)]:
                assert base.getpixel(p)==(74,163,216,255)
                base.putpixel(p,(31,40,67,255));edits.append(list(p))
        elif name=='eye':
            # A centered 2px pupil straddles the sprite's x=7.5 symmetry axis.
            for p in [(7,8),(7,9)]:
                assert base.getpixel(p)==(58,143,122,255)
                base.putpixel(p,(18,24,40,255));edits.append(list(p))
            for p in [(7,10),(8,10)]:
                assert base.getpixel(p)==(242,236,224,255)
                base.putpixel(p,(58,143,122,255));edits.append(list(p))
        core,outline,glow,effect,final,ring=spirit(base)
        if edits:base.save(ROOT/f'body-16/kin-{name}.png')
        else:(ROOT/f'body-16/kin-{name}.png').write_bytes(path.read_bytes())
        final.save(ROOT/f'native/kin-{name}-spirit.png')
        for suffix,layer in [('body',core),('outline',outline),('glow',glow),('effect',effect)]:
            layer.save(ROOT/f'layers/kin-{name}-{suffix}.png')
        # Compositing preserves every opaque body pixel, including eyes.
        for y in range(16):
            for x in range(16):
                if base.getpixel((x,y))[3]:assert base.getpixel((x,y))==final.getpixel((x+PAD,y+PAD))
        a=final.getchannel('A')
        edges=[a.getpixel((x,y)) for y in range(SIZE) for x in range(SIZE) if x in (0,SIZE-1) or y in (0,SIZE-1)]
        assert max(edges)==0,(name,max(edges))
        body=base.getbbox();report[name]={'body_size':[body[2]-body[0],body[3]-body[1]],
            'effect_canvas':[24,24],'body_offset':[4,4],'body_pixels_unchanged':not edits,
            'body_edits_native_coordinates':edits,
            'rim_width_native_px':1,'edge_alpha_max':max(edges),'partial_alpha_only_in_effect':True}
        images.append((core,final))
    sheet=Image.new('RGB',(960,416),(26,28,40));d=ImageDraw.Draw(sheet)
    for i,name in enumerate(NAMES):
        x=i*160;d.text((x+12,10),name.upper(),fill=(227,234,243))
        for y,art,label in [(44,images[i][0],'BASE'),(230,images[i][1],'SPIRIT')]:
            d.text((x+12,y-17),label,fill=(139,172,191));sheet.paste(preview(art),(x+8,y))
            sheet.paste(preview(art,1),(x+68,y+146))
    sheet.save(ROOT/'comparison.png')
    display=Image.new('RGB',(960,220),(26,28,40));d=ImageDraw.Draw(display)
    for i,name in enumerate(NAMES):
        x=i*160;d.text((x+12,10),name.upper(),fill=(213,235,247))
        display.paste(preview(images[i][1]),(x+8,30));display.paste(preview(images[i][1],1),(x+68,186))
    display.save(ROOT/'spirit-preview.png')
    preview(images[0][1],12).save(ROOT/'wisp-preview.png')
    preview(images[NAMES.index('eye')][1],12).save(ROOT/'eye-preview.png')
    backgrounds=Image.new('RGB',(960,3*144))
    for row,bg in enumerate([(16,18,27),(60,59,66),(134,128,115)]):
        for i,(_,im) in enumerate(images):backgrounds.paste(preview(im,6,bg),(i*160,row*144))
    backgrounds.save(ROOT/'quality/backgrounds.png')
    (ROOT/'quality/report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'kin-spirit-pngs.zip','w',zipfile.ZIP_DEFLATED) as z:
        for folder in ['native','body-16','layers']:
            for p in sorted((ROOT/folder).glob('*.png')):z.write(p,p.relative_to(ROOT))
    print(json.dumps(report))

def install_game():
    repo=ROOT.parents[1]
    page=repo/'proto/index.html'
    html=page.read_text()
    for name in NAMES:
        data=(ROOT/f'native/kin-{name}-spirit.png').read_bytes()
        uri='data:image/png;base64,'+base64.b64encode(data).decode('ascii')
        html,count=re.subn(r"('kin-"+name+r"': ')[^']+(')",lambda m:m[1]+uri+m[2],html)
        assert count==1,(name,count)
        (repo/f'proto/assets/sprites/characters/kin/kin-{name}.png').write_bytes(data)
    page.write_text(html)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--install-game',action='store_true')
    args=parser.parse_args()
    main()
    if args.install_game:install_game()
