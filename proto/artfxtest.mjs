// 演出（FEEL.weaponArts と W.arts）が、たくさん出ても消えない・変な場所に残らないこと。
//
// きっかけは報告「たまにフレイムのエフェクトが本体とは別に変な場所に出ることが
// あったり描画欠損があった。一度に多くのエフェクトを出すとバグるような印象」。
//
// 実際に見つかったのは、**同じ配列を2つの違う上限で切っていた**こと。
//   feelWeaponArtStart … 24 で切る
//   feelPixelArt      … 64 で切る
// つまり演出が24個より多く出ているところへ武器技を1つ出すと、
// まだ生きている演出が最大40個、その場で消えた。
// 見た目には「出したはずの物が出ない／途中で消える」＝描画欠損になる。
//
// ここで見るのは4つ。
//   1) どちらの入口から出しても、上限は同じ1つ
//   2) 生きている演出は、別の演出を出したくらいでは消えない
//   3) 上限を超えたときに消えるのは、いちばん古い物（新しく出した物が消えない）
//   4) 階を移ったら、前の階の演出が残らない（＝前の階の座標に描かれない）
import { boot, install, done } from './_h.mjs';
const {b, pg, errs} = await boot(); await install(pg);
const R={};

/* ============ 1. 上限は1つだけ ============ */
R.oneLimit = await pg.evaluate(()=>{
  TH.run(3,{seed:41}); setScreen('game');
  // 単発の演出（矢の着弾・崩落など）側から溢れさせる
  FEEL.weaponArts.length=0;
  for(let i=0;i<400;i++) feelPixelArt('a_field', P.x, P.y, {});
  const viaPixel=FEEL.weaponArts.length;
  // 武器技側から溢れさせる
  FEEL.weaponArts.length=0;
  const def=WEAPON_ARTS.sword[0];
  for(let i=0;i<400;i++) feelWeaponArtStart(S.hero, def, P.x, P.y, 0);
  const viaArt=FEEL.weaponArts.length;
  return {viaPixel, viaArt, same: viaPixel===viaArt,
          ok: viaPixel===viaArt && viaPixel>=64};
});

/* ============ 2. 生きている演出が、別の演出を出したくらいで消えない ============
   これが報告そのもの。上限より手前の数で試す。 */
R.noSilentLoss = await pg.evaluate(()=>{
  TH.run(3,{seed:42}); setScreen('game');
  FEEL.weaponArts.length=0;
  for(let i=0;i<40;i++) feelPixelArt('a_field', P.x+i*0.1, P.y, {});
  const before=FEEL.weaponArts.length;
  feelWeaponArtStart(S.hero, WEAPON_ARTS.sword[0], P.x, P.y, 0);
  const after=FEEL.weaponArts.length;
  return {before, after, lost: before+1-after,
          ok: before===40 && after===41};
});

/* ============ 3. 溢れたら消えるのは古いほうから ============
   新しく出した物が消えると、「出したのに出ない」になる。 */
R.dropsOldestFirst = await pg.evaluate(()=>{
  TH.run(3,{seed:43}); setScreen('game');
  FEEL.weaponArts.length=0;
  for(let i=0;i<300;i++) feelPixelArt('a_field', P.x, P.y+i, {});
  const arr=FEEL.weaponArts;
  const last=arr[arr.length-1];
  // 最後に出した物がちゃんと残っている（y で見分ける）
  const newestKept = last && last.y===P.y+299;
  // 残っているのは連続した「新しい側」の並び
  const ys=arr.map(f=>f.y-P.y);
  const contiguous = ys.every((v,i)=> i===0 || v===ys[i-1]+1);
  return {kept:arr.length, newestKept, contiguous,
          ok: newestKept && contiguous};
});

/* ============ 4. 階を移ったら前の階の演出は残らない ============
   残ると、前の階の座標のまま新しい階に描かれる＝「本体とは別の変な場所に出る」。 */
R.clearedOnFloorChange = await pg.evaluate(()=>{
  TH.run(3,{seed:44}); setScreen('game');
  FEEL.weaponArts.length=0;
  for(let i=0;i<8;i++) feelPixelArt('a_field', P.x+5, P.y+5, {});
  // 置き型（フレイム・ライトニング）も積んでおく
  const before={arts:FEEL.weaponArts.length, wArts:(W.arts||[]).length};
  TH.floor(4);
  const after={arts:FEEL.weaponArts.length, wArts:(W.arts||[]).length};
  return {before, after,
          ok: before.arts===8 && after.arts===0 && after.wArts===0};
});

/* ============ 5. フレイムの扇は本人に付いて動く ============
   置き型のうち扇（conefield）だけは本人の向きに付いて回る作りなので、
   動いたあとも本体と同じ場所にあることを見る。 */
R.flameFollows = await pg.evaluate(()=>{
  TH.run(3,{seed:45}); setScreen('game');
  TH.clearEnemies(); TH.immortal();
  S.hero.equip.weapon = buildItem(BASES.find(x=>x.id==='staff'), RARITY[0], 5);
  S.arts={staff:1};
  W.arts.length=0;
  fireArt(WEAPON_ARTS.staff[0], S.hero);      // フレイム
  const cone=W.arts.find(f=>f.kind==='artcone');
  const at0 = cone ? {dx:+(cone.x-P.x).toFixed(3), dy:+(cone.y-P.y).toFixed(3)} : null;
  TH.move(0.6, 1, 0);                          // 右へ歩く
  const lag = cone ? {dx:+(cone.x-P.x).toFixed(3), dy:+(cone.y-P.y).toFixed(3)} : null;
  draw();                                      // 描く直前の合わせ直しが効いているか
  const at1 = cone ? {dx:+(cone.x-P.x).toFixed(3), dy:+(cone.y-P.y).toFixed(3)} : null;
  return {found: !!cone, at0, lagBeforeDraw:lag, at1,
          staysOnPlayer: !!cone && Math.abs(cone.x-P.x)<0.001 && Math.abs(cone.y-P.y)<0.001,
          ok: !!cone && Math.abs(cone.x-P.x)<0.001 && Math.abs(cone.y-P.y)<0.001};
});

await done(b, errs, R);
