from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,random
P=Path(__file__).resolve().parent
ROOT=P.parents[2]
sources=[
 'pixel-art/tinyrpg-native-study-v1/demon-original-32.png',
 'pixel-art/tinyrpg-native-study-v1/blood-original-32.png',
 'pixel-art/ash-hound-tinyrpg-v1/ash-hound-32.png',
 'pixel-art/stone-benchmark-v2/crawling-dead-32.png',
 'pixel-art/ash-toad-form-restore-v10/ash-toad-32.png',
 'pixel-art/dust-spider-native-v9/dust-spider-32.png',
 'pixel-art/stone-bog-native-v1/bog-crawler-32.png',
 'pixel-art/stone-bog-native-v1/reed-serpent-32.png',
 'pixel-art/stone-bog-native-v1/silt-jelly-32.png',
 'pixel-art/stone-bog-native-v1/bloat-grub-32.png',
 'pixel-art/ash-toad-native-v3/ash-toad-32.png',
 'pixel-art/ash-toad-native-v9/ash-toad-32.png',
]
random.Random(9212026).shuffle(sources)
board=Image.new('RGB',(1024,930),'#26252d'); d=ImageDraw.Draw(board)
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',18)
mapping={}
for i,s in enumerate(sources):
 name=f'{i+1:02d}'; im=Image.open(ROOT/s).convert('RGBA')
 assert im.size==(32,32)
 mapping[name]=s
 im.save(P/'blind'/f'{name}.png')
 bg=Image.new('RGBA',(32,32),'#656369');bg.alpha_composite(im)
 preview=bg.convert('RGB').resize((192,192),Image.Resampling.NEAREST)
 preview.save(P/'blind'/f'{name}-6x.png')
 x=(i%4)*256+20;y=(i//4)*310+20
 d.text((x,y),f'CASE {name}',font=font,fill='white')
 board.paste(preview,(x,y+30));board.paste(bg.convert('RGB'),(x+80,y+242))
board.save(P/'blind'/'board.png')
(P/'case-key.json').write_text(json.dumps(mapping,indent=2))
print('12 unmodified samples; 6x nearest-neighbor display copies.')
