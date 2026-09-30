"""Rasterize recorded sample commands to a browser-independent looping GIF."""
import json, math, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageColor, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/ally-effects-v3'
frames=json.loads((OUT/'frames.json').read_text())
from canvas_command_rasterizer import render, font
results=[]
for f in frames:
    canvas=Image.new('RGB',(656,242),'#111917');d=ImageDraw.Draw(canvas)
    d.text((8,8),'01 / SLASH',font=font,fill='#d9e5c4')
    d.text((336,8),'02 / STRIKE',font=font,fill='#efd6a4')
    canvas.paste(render(f['slash']),(4,27));canvas.paste(render(f['blunt']),(332,27))
    d.text((8,225),'ABYSS / BURST + GLOW V3',font=font,fill='#b7c5aa')
    d.text((462,225),'2x SWING / NORMAL PLAY',font=font,fill='#b7c5aa')
    results.append(canvas.resize((1312,484),Image.Resampling.NEAREST))
palette=Image.new('RGB',(656,242*len(results)))
for i,im in enumerate(results):palette.paste(im.resize((656,242)),(0,242*i))
palette=palette.quantize(colors=256)
indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in results]
indexed[0].save(OUT/'ally-slash-strike.gif',save_all=True,append_images=indexed[1:],duration=20,loop=0,optimize=False,disposal=2)
results[4].save(OUT/'ally-slash-strike-preview.png')
slow=[]
for im in results:
    im=im.copy();d=ImageDraw.Draw(im);d.rectangle((950,438,1311,483),fill='#111917')
    d.text((964,450),'0.5x SPEED / LOOP',font=ImageFont.load_default(size=20),fill='#b7c5aa')
    slow.append(im.quantize(palette=palette,dither=Image.Dither.NONE))
slow[0].save(OUT/'ally-slash-strike-slow.gif',save_all=True,append_images=slow[1:],duration=40,loop=0,optimize=False,disposal=2)
sheet=Image.new('RGB',(1312,484*3),'#111917')
for row,i in enumerate([4,8,14]):sheet.paste(results[i],(0,row*484))
sheet.save(OUT/'contact-sheet.png')
gif=Image.open(OUT/'ally-slash-strike.gif')
assert gif.n_frames>1  # Identical rest frames are coalesced by the GIF encoder.
total=0
for i in range(gif.n_frames):gif.seek(i);total+=gif.info['duration']
assert total==860
print(f'GIF: {gif.size}, {gif.n_frames} frames, {total} ms, {(OUT/"ally-slash-strike.gif").stat().st_size} bytes')
