from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).resolve().parent
Q=P/'quality';Q.mkdir(exist_ok=True)
SOURCE=P.parent/'stone-small-enemies-v8/ash-toad-32.png'
# Restore the user's preferred form exactly; consolidate color roles only.
MAPPING={
 '100d15':'100d15','262330':'33313f','393746':'33313f',
 '52505f':'666273','777180':'666273','656556':'777764',
 '95917b':'777764','999187':'97909a','92512a':'91816a',
 'b7ad94':'c4b79a','e4d8b8':'c4b79a','efb54b':'dd9b43',
}
def rgba(s):return (*bytes.fromhex(s),255)
def preview(im,scale=8,bg='#565358'):
 out=Image.new('RGBA',im.size,bg);out.alpha_composite(im)
 return out.convert('RGB').resize((32*scale,32*scale),Image.Resampling.NEAREST)
def main():
 src=Image.open(SOURCE).convert('RGBA');out=src.copy()
 for y in range(32):
  for x in range(32):
   p=src.getpixel((x,y))
   if p[3]:out.putpixel((x,y),rgba(MAPPING['%02x%02x%02x'%p[:3]]))
 alpha_equal=out.getchannel('A').tobytes()==src.getchannel('A').tobytes()
 outline_equal=all((p==rgba('100d15'))==(q==rgba('100d15')) for p,q in zip(src.get_flattened_data(),out.get_flattened_data()))
 assert alpha_equal and outline_equal
 out.save(P/'ash-toad-32.png');preview(out).save(P/'ash-toad-8x.png')
 out.resize((256,256),Image.Resampling.NEAREST).save(P/'ash-toad-8x-transparent.png')
 font='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
 board=Image.new('RGB',(848,376),'#25232a');d=ImageDraw.Draw(board)
 d.text((16,12),'ASH TOAD / 前回の造形を維持',font=ImageFont.truetype(font,22),fill='white')
 last=Image.open(P.parent/'ash-toad-native-v9/ash-toad-32.png').convert('RGBA')
 for i,(label,im) in enumerate([('前回の造形 / v8',src),('直前の試作 / v9',last),('造形を戻して色面を整理 / v10',out)]):
  x=16+i*280;d.text((x,52),label,font=ImageFont.truetype(font,13),fill='#eee7da');board.paste(preview(im),(x,80))
  for j,bg in enumerate(['#565358','#20202c','#b8b1a2']):board.paste(preview(im,1,bg),(x+30+j*75,340))
 board.save(P/'comparison.png')
 b=out.getbbox();report={'source':str(SOURCE),'canvas':[32,32],'visible_size':[b[2]-b[0],b[3]-b[1]],'colors':len({p for p in out.get_flattened_data() if p[3]}),'alpha_identical_to_v8':alpha_equal,'all_outline_and_internal_ink_pixels_identical_to_v8':outline_equal}
 (Q/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=='__main__':main()
