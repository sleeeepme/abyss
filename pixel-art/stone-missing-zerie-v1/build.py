from pathlib import Path
import json, sys, html, zipfile
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/Users/daisukey.oshida/.codex/skills/pixel-art-studio/scripts')
from pixelstudio import Sprite
ROOT=Path(__file__).resolve().parent
ENTRIES=json.loads((ROOT/'manifest.json').read_text())
OUTLINE='#19141f'
FONT='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
def font(n):
    try:return ImageFont.truetype(FONT,n)
    except OSError:return ImageFont.load_default()

def build(e,n):
    im=Image.open(ROOT/'sources'/f"{e['id']}.png").convert('RGBA')
    mask=im.getchannel('A').point(lambda a:255 if a>=180 else 0)
    im.putalpha(mask);im=im.crop(mask.getbbox())
    k=(n-6)/max(im.size)
    dims=tuple(max(1,round(v*k)) for v in im.size)
    small=im.resize(dims,Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(n,n));canvas.paste(small,((n-dims[0])//2,n-3-dims[1]))
    if e['id']=='the-hush':
        solid=Image.new('RGBA',canvas.size,(21,19,28,255));solid.putalpha(canvas.getchannel('A'));canvas=solid
    tmp=ROOT/'quality'/f"{e['id']}-{n}-sample.png";canvas.save(tmp)
    s=Sprite.from_png(str(tmp),scale=1)
    s.clean(max_colors=22 if n==32 else 28,harden=True,despeckle_min=2,dedupe_tol=5)
    if e['id']!='the-hush':s.outline(OUTLINE,where='outside')
    folder=ROOT/f'native-{n}';folder.mkdir(exist_ok=True)
    target=folder/f"{e['id']}.png";s.save_png(str(target))
    s.save_png(str(folder/f"{e['id']}@8x.png"),scale=8)
    s.save_silhouette(str(ROOT/'quality'/f"{e['id']}-{n}-silhouette.png"),scale=4)
    final=Image.open(target).convert('RGBA')
    alpha=set(final.getchannel('A').getdata());box=final.getbbox()
    report={'id':e['id'],'size':[n,n],'colors':len({c[:3] for c in final.getdata() if c[3]}),'alpha':sorted(alpha),'bbox':box,'margin_ok':box[0]>0 and box[1]>0 and box[2]<n and box[3]<n}
    assert alpha=={0,255} and report['margin_ok'],report
    return final,report

reports=[];images={}
for e in ENTRIES:
    for n in (32,64):
        im,r=build(e,n);images[e['id'],n]=im;reports.append(r)
(ROOT/'quality'/'mechanical-report.json').write_text(json.dumps(reports,indent=2))
for bg,name in [('#707073','overview'),('#26262d','overview-dark'),('#dfded8','overview-light')]:
    board=Image.new('RGB',(1120,1060),bg);d=ImageDraw.Draw(board)
    d.text((28,20),'ABYSS / 石の層 — 未作成モンスター 11種',font=font(26),fill='#fff4de' if name!='overview-light' else '#24222a')
    for i,e in enumerate(ENTRIES):
        x=20+(i%4)*275;y=80+(i//4)*320;n=e['size'];im=images[e['id'],n]
        display=im.resize((256,256),Image.Resampling.NEAREST)
        board.paste(display,(x,y),display)
        color='#fff4de' if name!='overview-light' else '#24222a'
        d.text((x+2,y+264),e['name'],font=font(17),fill=color)
        d.text((x+2,y+288),f'{n} × {n}  /  idle',font=font(13),fill=color)
    board.save(ROOT/f'{name}.png')

cards=[]
for e in ENTRIES:
    i=e['id'];n=e['size']
    cards.append(f'''<article><div class="stage"><img class="sprite" data-id="{i}" data-native="{n}" src="native-{n}/{i}.png" width="{n*4}" height="{n*4}"></div><h2>{e['name']}</h2><p>{i}</p><div class="links"><a href="native-32/{i}.png" download>32px PNG</a><a href="native-64/{i}.png" download>64px PNG</a><a href="sources/{i}.png" target="_blank">原画</a></div></article>''')
page='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>石の層 モンスター原画</title><style>
*{box-sizing:border-box}body{margin:0;background:#18191e;color:#ece4d6;font:15px system-ui,sans-serif}header{padding:32px 5vw 24px}h1{font-size:28px;margin:8px 0}header p{color:#b7b2aa;line-height:1.7;max-width:900px}.eyebrow{color:#bd9860;letter-spacing:.12em;font-size:12px}nav{position:sticky;top:0;z-index:2;padding:16px 5vw;background:#202128;display:flex;gap:22px;flex-wrap:wrap}select{background:#34353d;color:#fff;border:1px solid #666;padding:7px;margin-left:6px}main{padding:24px 5vw;display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:20px}article{background:#23242b;border:1px solid #3a3a43;padding:14px}.stage{height:280px;display:flex;align-items:center;justify-content:center;background:#707073;overflow:auto}.sprite{image-rendering:pixelated;object-fit:contain;flex-shrink:0}h2{font-size:18px;margin:15px 0 3px}article p{font-size:12px;color:#9695a1;margin:0 0 12px}.links{display:flex;gap:16px}a{color:#d4b783;font-size:13px}footer{padding:20px 5vw 40px;color:#aaa}
</style><header><div class="eyebrow">ABYSS · STONE STRATUM · CHARACTER STUDY 01</div><h1>石の層 — 新規モンスター11種</h1><p>公開参照の暗い輪郭・大きな頭や手・面で分けた陰影を基準に、石の層の設定から制作。ディテールを残した全種64pxの待機絵です。32px版は縮小比較用として収録。無音は設定どおり黒一色、巡回者の鎧意匠は新規提案です。</p></header>
<nav><label>表示サイズ<select id="size"><option value="native">主案64px</option><option value="32">比較用32px</option><option value="64">全て64px</option><option value="source">生成原画</option></select></label><label>倍率<select id="zoom"><option value="4">4倍</option><option value="1">原寸</option><option value="8">8倍</option></select></label><label>背景<select id="bg"><option value="#707073">中間グレー</option><option value="#26262d">暗い床</option><option value="#dfded8">明るい床</option></select></label><a href="sprites.zip" download>PNG一式 ZIP</a></nav><main>'''+''.join(cards)+'''</main><footer>静止画のデザイン確認用。ゲームへの組み込み・歩行や攻撃アニメーションは未実施。<a href="https://zerie.itch.io/tiny-rpg-character-asset-pack-02">公開ベンチマーク：Zerie Tiny RPG Character Asset Pack 02</a></footer><script>
function update(){let size=document.querySelector('#size').value,z=+document.querySelector('#zoom').value,bg=document.querySelector('#bg').value;document.querySelectorAll('.sprite').forEach(im=>{let n=size==='native'?+im.dataset.native:+size;im.src=size==='source'?'sources/'+im.dataset.id+'.png':'native-'+n+'/'+im.dataset.id+'.png';im.style.width=im.style.height=(size==='source'?256:n*z)+'px';im.style.imageRendering=size==='source'?'auto':'pixelated'});document.querySelectorAll('.stage').forEach(el=>el.style.background=bg)}document.querySelectorAll('select').forEach(el=>el.onchange=update);
</script></html>'''
(ROOT/'index.html').write_text(page)
with zipfile.ZipFile(ROOT/'sprites.zip','w',zipfile.ZIP_DEFLATED) as z:
    for n in (32,64):
        for e in ENTRIES:
            p=ROOT/f'native-{n}'/f"{e['id']}.png";z.write(p,p.relative_to(ROOT))
    z.writestr('README.txt','ABYSS 石の層11種。32/64px透過PNG、各1フレーム。右向き寄り。静止画デザイン候補。ゲーム未組み込み。')
print(json.dumps({'sprites':len(reports),'all_binary_alpha':all(r['alpha']==[0,255] for r in reports),'all_margin_ok':all(r['margin_ok'] for r in reports)},indent=2))
