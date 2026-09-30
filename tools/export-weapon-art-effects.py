"""Rasterize sword/spear weapon-art study into review GIFs."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from canvas_command_rasterizer import render
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'output/weapon-art-effects-v44'
frames=json.loads((OUT/'frames.json').read_text()); font=ImageFont.load_default(size=11)
groups=[
    ('sword',['iai','swspin','swmulti'],['IAI','SPIN SLASH','MULTI SLASH']),
    ('spear',['spswing','splance','spdragoon'],['SWING','SHOT LANCE','DRAGOON']),
    ('axe',['axtoma','axspin','axspiral'],['TOMAHAWK','SPIN AXE','SPIRAL HAWK']),
    ('bow',['bwrain','bwrapid','bwburst'],['ARROW RAIN','RAPID FIRE','BURST SHOT']),
    ('dagger',['dgslash','dgdance','dgmirage'],['FLURRY','DANCING SWORD','MIRAGE']),
    ('mace',['mcdouble','mcheal','mcshield'],['DOUBLE ATTACK','HEALING BLOW','HOLY SHIELD']),
    ('staff',['stflame','sticicle','stbolt'],['FLAME','ICICLE EDGE','LIGHTNING']),
    ('great',['gtspin','gtquake','gtupper'],['GRAND SPIN','GROUND WAVE','RAGING UPPER']),
]
def save_group(name,keys,labels):
    out=[]
    for f in frames:
        im=Image.new('RGB',(960,198),'#101713'); d=ImageDraw.Draw(im)
        for i,(key,label) in enumerate(zip(keys,labels)):
            im.paste(render(f[key],(320,170)),(i*320,0)); d.rectangle((i*320,170,i*320+319,197),fill='#101713'); d.text((i*320+8,178),label,font=font,fill='#dfe8d4')
        out.append(im.resize((1920,396),Image.Resampling.NEAREST))
    pal=Image.new('RGB',(960,198*len(out)))
    for i,im in enumerate(out):pal.paste(im.resize((960,198)),(0,i*198))
    pal=pal.quantize(colors=256); idx=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in out]
    idx[0].save(OUT/f'{name}-weapon-arts.gif',save_all=True,append_images=idx[1:],duration=20,loop=0,optimize=False,disposal=2)
    out[20].save(OUT/f'{name}-preview.png')
    return out
sword=save_group(*groups[0]); spear=save_group(*groups[1]); axe=save_group(*groups[2]); bow=save_group(*groups[3]); dagger=save_group(*groups[4]); mace=save_group(*groups[5]); staff=save_group(*groups[6]); great=save_group(*groups[7])
# Flame alone at game scale for focused motion review.
flame_only=[im.crop((0,0,640,396)) for im in staff]
flame_palette=Image.new('RGB',(640,396*len(flame_only)))
for i,im in enumerate(flame_only): flame_palette.paste(im,(0,i*396))
flame_palette=flame_palette.quantize(colors=256)
flame_only=[im.quantize(palette=flame_palette,dither=Image.Dither.NONE) for im in flame_only]
flame_only[0].save(OUT/'flame-v44.gif',save_all=True,append_images=flame_only[1:],duration=20,loop=0,optimize=False,disposal=2)
contact=Image.new('RGB',(1920,3168),'#101713')
# Each art peaks at a different moment; use its own representative frame.
for i,frame_i in enumerate((11,15,25)): contact.paste(sword[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,0))
for i,frame_i in enumerate((14,16,43)): contact.paste(spear[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,396))
for i,frame_i in enumerate((18,16,27)): contact.paste(axe[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,792))
for i,frame_i in enumerate((18,18,18)): contact.paste(bow[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,1188))
for i,frame_i in enumerate((15,18,14)): contact.paste(dagger[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,1584))
for i,frame_i in enumerate((17,20,20)): contact.paste(mace[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,1980))
for i,frame_i in enumerate((34,25,22)): contact.paste(staff[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,2376))
for i,frame_i in enumerate((16,29,14)): contact.paste(great[frame_i].crop((i*640,0,(i+1)*640,396)),(i*640,2772))
contact.save(OUT/'contact-sheet.png')
for name in ('sword','spear','axe','bow','dagger','mace','staff','great'):
    gif=Image.open(OUT/f'{name}-weapon-arts.gif'); total=0
    for i in range(gif.n_frames):gif.seek(i);total+=gif.info['duration']
    # GIF merges identical rest frames; total playback time is the invariant.
    assert gif.size==(1920,396) and total==1400 and gif.n_frames>30
    print(name, gif.n_frames, total, (OUT/f'{name}-weapon-arts.gif').stat().st_size)

# Focused review file: Flame and the original Ground Wave at useful scale.
focused=[]
for i in range(len(staff)):
    im=Image.new('RGB',(1280,396),'#101713')
    im.paste(staff[i].crop((0,0,640,396)),(0,0))
    im.paste(great[i].crop((640,0,1280,396)),(640,0))
    focused.append(im)
palette=Image.new('RGB',(1280,396*len(focused)))
for i,im in enumerate(focused): palette.paste(im,(0,i*396))
palette=palette.quantize(colors=256)
focused=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in focused]
focused[0].save(OUT/'flame-groundwave-v44.gif',save_all=True,append_images=focused[1:],duration=20,loop=0,optimize=False,disposal=2)

# The three remade V16 candidates in one compact review GIF.
remade=[]
for i in range(len(staff)):
    im=Image.new('RGB',(1920,396),'#101713')
    im.paste(staff[i].crop((0,0,640,396)),(0,0))
    im.paste(great[i].crop((640,0,1280,396)),(640,0))
    im.paste(great[i].crop((1280,0,1920,396)),(1280,0))
    remade.append(im)
palette=Image.new('RGB',(1920,396*len(remade)))
for i,im in enumerate(remade): palette.paste(im,(0,i*396))
palette=palette.quantize(colors=256)
remade=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in remade]
remade[0].save(OUT/'remade-three-v44.gif',save_all=True,append_images=remade[1:],duration=20,loop=0,optimize=False,disposal=2)
