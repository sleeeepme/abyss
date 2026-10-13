"""Redraft six existing code-authored familiars at W-2 / H-2 logical pixels."""
from pathlib import Path
import importlib.util
import json
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
spec=importlib.util.spec_from_file_location('npc_px',REPO/'tools/npc_px.py')
src=importlib.util.module_from_spec(spec);spec.loader.exec_module(src)

# Native grids. Dots are transparent; palette symbols reuse the existing roles.
GRIDS={
 'wisp':[
 '...A..',
 '..AwA.',
 '.AwcA.',
 'AwcccA',
 'CAccAC',
 'AccccA',
 '.ACcA.',
 '..AA..',
 ],
 'bat':[
 '..A.A..A.A..',
 '.AVAvvvAAVA.',
 'AVvArvrAvvVA',
 '.AuVAvvAVuA.',
 '..AA.AA.AA..',
 ],
 'owl':[
 '.A....A.',
 '.AoAAoA.',
 'AOOooOOA',
 'AOAooAOA',
 'AOOyyOOA',
 '.AoOOoA.',
 '.AAyyAA.',
 '..A..A..',
 ],
 'eye':[
 '....AAAA....',
 '...AeeeeA...',
 '.A.AeiieA.A.',
 'AmAeiikieAmA',
 '.AAeiikieAA.',
 '...AeeeeA...',
 '...AEEeeA...',
 '....AAAA....',
 ],
 'skull':[
 '..A..A..',
 '.AfAAfA.',
 'AAssssAA',
 'AsAssAsA',
 'AsfssfSA',
 'ASsAAsSA',
 '.AsSsSA.',
 '..AAAA..',
 ],
 'jelly':[
 '..AAAA..',
 '.AtttjA.',
 'AtjjjjJA',
 'AjAjAjJA',
 'AJJJJJJA',
 '.AgAgAgA',
 '.Ag.AgA.',
 '..A..A..',
 ],
}
NAMES={'wisp':'鬼火','bat':'蝙蝠','owl':'梟','eye':'目玉','skull':'骸骨','jelly':'海月'}

def centered(rows,old):
    w,h=len(rows[0]),len(rows);assert all(len(row)==w for row in rows)
    x0,y0,x1,y1=old.getbbox()
    assert (w,h)==(x1-x0-2,y1-y0-2)
    # One native pixel removed from either side of the previous bounding box.
    ox,oy=x0+1,y0+1
    out=['.'*16 for _ in range(16)]
    for y,row in enumerate(rows):out[oy+y]='.'*ox+row+'.'*(16-ox-w)
    return out

def composite(im,scale,bg):
    b=Image.new('RGBA',im.size,(*bg,255));b.alpha_composite(im)
    return b.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

def main():
    for sub in ['native','runtime-4x','original','quality']:(ROOT/sub).mkdir(exist_ok=True)
    stats={};original=[];compact=[]
    for name,rows in GRIDS.items():
        old=src.render(src.KIN[name],src.KIN_PAL,scale=1)
        grid=centered(rows,old);new=src.render(grid,src.KIN_PAL,scale=1)
        old.save(ROOT/f'original/kin-{name}.png');new.save(ROOT/f'native/kin-{name}.png')
        src.render(grid,src.KIN_PAL,scale=4).save(ROOT/f'runtime-4x/kin-{name}.png')
        oldbox=old.getbbox();newbox=new.getbbox()
        before=[oldbox[2]-oldbox[0],oldbox[3]-oldbox[1]];after=[newbox[2]-newbox[0],newbox[3]-newbox[1]]
        assert after==[before[0]-2,before[1]-2]
        assert set(new.getchannel('A').get_flattened_data())=={0,255}
        stats[name]={'name':NAMES[name],'old_size':before,'new_size':after,'bbox':newbox,
                     'colors':len({p[:3] for p in new.get_flattened_data() if p[3]})}
        original.append(old);compact.append(new)
    # A readable two-row contact sheet, identical native grid and magnification.
    sheet=Image.new('RGB',(6*152,440),(51,51,59));d=ImageDraw.Draw(sheet)
    for i,name in enumerate(GRIDS):
        x=i*152;v=stats[name];d.text((x+10,8),name.upper(),fill=(239,235,224))
        for y,im,size,label in [(50,original[i],v['old_size'],'CURRENT'),(230,compact[i],v['new_size'],'COMPACT')]:
            d.text((x+10,y-20),f'{label} {size[0]} x {size[1]}',fill=(195,191,184))
            sheet.paste(composite(im,8,(69,69,77)),(x+12,y))
            sheet.paste(composite(im,1,(51,51,59)),(x+14,y+132))
            sheet.paste(composite(im,2,(51,51,59)),(x+44,y+130))
    sheet.save(ROOT/'comparison.png')
    out=Image.new('RGB',(6*160,192),(69,69,77));d=ImageDraw.Draw(out)
    for i,name in enumerate(GRIDS):
        out.paste(composite(compact[i],8,(69,69,77)),(i*160+16,24));d.text((i*160+16,8),name,fill='white')
    out.save(ROOT/'compact-preview.png')
    (ROOT/'quality/report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(stats,ensure_ascii=False))

if __name__=='__main__':main()
