// 落ちている装備の「今の装備より強い」印（緑の↑）と、商人・蛍石の描画が落ちないこと
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R = {};
R.upgrade = await pg.evaluate(()=>{
  TH.run(4, {seed:3});
  const cur = S.hero.equip.weapon;
  const good = genBaseItem(cur ? cur.base : 'sword', 30, 2); good.ident = true;
  const bad  = genBaseItem(cur ? cur.base : 'sword', 1, 0);  bad.ident = true; bad.atk = 1;
  const hidden = genBaseItem(cur ? cur.base : 'sword', 30, 2); hidden.ident = false;
  const goodUp = isGearUpgrade(good), badUp = isGearUpgrade(bad), hiddenUp = isGearUpgrade(hidden);
  // 着けている物そのものには出さない
  const selfUp = cur ? isGearUpgrade(cur) : false;
  // 空いているスロットなら何でも↑
  const acc = S.hero.equip.accessory; S.hero.equip.accessory = null;
  const ring = genBaseItem('ring', 5, 0); ring.ident = true;
  const emptyUp = ring.slot ? isGearUpgrade(ring) : true;
  S.hero.equip.accessory = acc;
  // 比べたあと装備が元に戻っている
  const restored = S.hero.equip.weapon === cur;
  // 掃引の約束（R の真偽値は true が期待どおり）に合わせ、「出ないのが正解」の値は言い換えて返す
  return {goodUp, badNoMark: !badUp, hiddenNoMark: !hiddenUp, selfNoMark: !selfUp, emptyUp, restored,
          ok: goodUp && !badUp && !hiddenUp && !selfUp && emptyUp && restored};
});
R.draws = await pg.evaluate(async ()=>{
  setScreen('game'); TH.immortal();
  if(!W.shop) W.shop = {x:P.x+3, y:P.y, seed:1, stock:[]};
  W.shop.x = P.x+3; W.shop.y = P.y;
  W.drops.push({x:P.x-2, y:P.y, stone:true});
  const g = genBaseItem('sword', 30, 2); g.ident = true; W.drops.push({x:P.x, y:P.y+1, it:g});
  for(let i=0;i<6;i++) await new Promise(r=>requestAnimationFrame(r));
  const art = !!CharacterArt.image('merchant_b');
  return {art, ok: art};
});
await done(b, errs, R);
