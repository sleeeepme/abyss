"""Package the current game renderer as an isolated visual-only sample."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
p=root/'proto'; dest=p/'assets/tilt-shift-dungeon'; dest.mkdir(parents=True,exist_ok=True)
s=(p/'index.html').read_text().replace('requestAnimationFrame(tick)','void 0')
s=s.replace('</body>', '<script src="demo.js"></script></body>') if '</body>' in s else s+'\n<script src="demo.js"></script>'
(dest/'index.html').write_text(s)
for name in ['game-feel.js','ally-effect-study.js','weapon-art-effect-study.js','item-icons-imported-data.js','item-icons.js']:
 shutil.copy2(p/name,dest/name)
for name in ['sprites','effects/weapon-art-v44','effects/weapon-art-v30','effects/weapon-art-v18']:
 shutil.copytree(p/'assets'/name,dest/'assets'/name,dirs_exist_ok=True)
(dest/'assets/backgrounds/hub-final-v1').mkdir(parents=True,exist_ok=True)
for name in ['loop-spritesheet.png','background.png']:
 shutil.copy2(p/'assets/backgrounds/hub-final-v1'/name,dest/'assets/backgrounds/hub-final-v1'/name)
shutil.copy2(p/'tilt-shift-dungeon.js',dest/'demo.js')
print(dest)
