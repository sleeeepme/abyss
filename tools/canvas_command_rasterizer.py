import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageColor, ImageFilter, ImageEnhance
ROOT=Path(__file__).resolve().parents[1]
sprites={}
font=ImageFont.load_default(size=10)
def render(commands, size=(320,188)):
    im=Image.new('RGBA',size)
    for cmd in commands:
        layer=Image.new('RGBA',im.size)
        d=ImageDraw.Draw(layer)
        t=cmd['type']
        if t in ('polygon','line'):
            pts=[tuple(p) for p in cmd['points']]
            col=(*ImageColor.getrgb(cmd['color']),round(255*max(0,min(1,cmd['alpha']))))
            if t=='polygon' and len(pts)>2:d.polygon(pts,fill=col)
            elif t=='line' and len(pts)>1:d.line(pts,fill=col,width=max(1,round(cmd['width'])))
        elif t=='image':
            src=cmd['src']
            if src not in sprites:sprites[src]=Image.open(ROOT/'proto'/src).convert('RGBA')
            sprite=sprites[src].resize((cmd['w'],cmd['h']),Image.Resampling.NEAREST)
            brightness=re.search(r'brightness\(([\d.]+)\)',cmd.get('filter','none'))
            if brightness:sprite=ImageEnhance.Brightness(sprite).enhance(float(brightness[1]))
            if cmd.get('alpha',1)<1:
                opacity=max(0,min(1,cmd['alpha']))
                sprite=Image.merge('RGBA',(*sprite.split()[:3],sprite.getchannel('A').point(lambda a:round(a*opacity))))
            layer.alpha_composite(sprite,tuple(round(v) for v in cmd['xy']))
        elif t=='text':
            x,y=cmd['xy'];d.text((x,y-8),cmd['text'],font=font,fill=cmd['color'])
        blur=re.search(r'blur\(([\d.]+)px\)',cmd.get('filter','none'))
        if blur:
            # Blur coverage only: straight RGB blur would introduce dark fringes.
            alpha=layer.getchannel('A').filter(ImageFilter.GaussianBlur(float(blur[1])))
            layer=Image.new('RGBA',im.size,ImageColor.getrgb(cmd['color'])+(255,))
            layer.putalpha(alpha)
        im=Image.alpha_composite(im,layer)
    return im.convert('RGB')
