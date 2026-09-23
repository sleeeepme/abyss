/* 武器技24種＋大魔導士「崩落」のドット演出（Abyss）。
   方針（論理解像度・固定パレット・整数スナップ・状態を持たない粒子）：
   - すべて「絵の1ドット」単位の小さなバッファに描き、最後に補間なしで拡大して貼る。
     1マス = 16ドット（16px のキャラ絵と同じ格子）。ベクター線やぼかしは使わない。
   - 色は固定パレットだけ。フェードは半透明ではなく 4x4 ディザで間引く。
   - 形とポーズは 12fps（斬撃は 24fps）に量子化。粒子は毎フレーム整数に吸着。
   - 粒子は番号から決定的に位置が決まる（状態を持たない＝割り当てゼロ、巻き戻し・コマ送り可）。
   - 魔法系（杖・崩落・戦鎚の癒し打ち／ホーリーシールド）は足元に魔法陣を敷く。
   公開 API（window.PixelArtFx）：
     scene(ctx, id, age)            … 見本シーン（キャラ・床込み）
     renderEffect(ctx, {...})       … 実機用（効果だけ。床とキャラは描かない）
     timeline(id) / phaseAt(id, t)  … 見本の段取り（IDLE/CHARGE/CAST/RECOVER）
     span(id)                       … 実機で描き続ける秒数
*/
(() => {
  'use strict';
  const TILE = 16, TAU = Math.PI * 2, ANIM_FPS = 12;
  const SCENE_W = 160, SCENE_H = 112;
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const easeOut = p => 1 - (1 - p) * (1 - p);
  const easeIn = p => p * p;
  const q12 = t => Math.floor(t * ANIM_FPS) / ANIM_FPS;       // 12fps の段付き時間
  const q60 = t => Math.floor(t * 60) / 60;
  function hash(i, s) {
    let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ---------- 固定パレット（エフェクト用。キャラ絵の色は別） ---------- */
  const HEX = {
    W: '#ffffff', ink: '#0d0c12',
    ar0: '#f0dcff', ar1: '#c98adf', ar2: '#8e62a3', ar3: '#5a3a7a', ar4: '#2e2145',   // 崩落（大魔導士の紫）
    cy0: '#d6ffff', cy1: '#72d9e6', cy2: '#3a8fa8',                                   // 杖の宝石
    fi0: '#fffbe1', fi1: '#ffe36b', fi2: '#ffad3d', fi3: '#ff6a2b', fi4: '#c83a22', fi5: '#6e2418', sm0: '#3a2a2a',
    fr0: '#ecfcff', fr1: '#a1edff', fr2: '#53caff', fr3: '#2f7fc8', fr4: '#1f3f7a',
    sh0: '#fffbd0', sh1: '#fff171', sh2: '#ffcf3e', sh3: '#d88a1e', sh4: '#6e4a1a',
    st0: '#8a7f8f', st1: '#5d5566', st2: '#3b3544', st3: '#221e29', st4: '#15121b',   // 大質量の石
    fl0: '#b9caff', fl1: '#7d88b5', fl2: '#3e4670',                                   // 斬撃の尾（承認済み通常攻撃の fleck 青）
    ac0: '#fff56b',                                                                   // 斬撃の当たり黄（通常攻撃と共通）
    wd0: '#d8c0a0', wd1: '#a4825a', wd2: '#6a4c30',                                   // 斧・柄の木
    bw0: '#c8f0b8', bw1: '#7fc08a', bw2: '#3f7a4c',                                   // 弓の緑
    hl0: '#e8ffe0', hl1: '#9ff0b0', hl2: '#4fc07a', hl3: '#2a6a48',                   // 癒し
    ho0: '#fff6d0', ho1: '#e8d9a0', ho2: '#c0a050', ho3: '#7a6030',                   // 聖（戦鎚）
    du0: '#8b8672', du1: '#5f5b4c', du2: '#3d3a30',                                   // 土煙
    ag0: '#e0f0ff', ag1: '#8fc7ff', ag2: '#4a7fc0', ag3: '#26406a',                   // 鉄壁の青
    lf0: '#f0ffd0', lf1: '#c8e880', lf2: '#8ab848', lf3: '#4a6a28', lf4: '#ffc8e0',   // 命脈の若葉（＋花）
    as0: '#eee1c1', as1: '#daccae', as2: '#9799a5', as3: '#717586', as4: '#565a6c', as5: '#2b2f3d',   // 灰の大蛙（絵と同じ灰）
    tg0: '#f0b0a8', tg1: '#c86a6e', tg2: '#7a3440',                                   // 蛙の舌
    vg0: '#f4fbff', vg1: '#c8e6f5', vg2: '#8fbcd8', vg3: '#557fa0', vg4: '#2f4660',   // ヴェラの空引き（形の無い矢）
    wr0: '#ff5a46', wr1: '#8a2a22'                                                    // 見本の予兆（実機は別に描く）
  };
  const rgba32 = hex => {
    const n = parseInt(hex.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0;
  };
  const P = {}; for (const k in HEX) P[k] = rgba32(HEX[k]);
  const RAMP = {
    arcane: [P.W, P.ar0, P.ar1, P.ar2, P.ar3, P.ar4],
    cyan: [P.W, P.cy0, P.cy1, P.cy2, P.ar3, P.ar4],
    fire: [P.fi0, P.fi1, P.fi2, P.fi3, P.fi4, P.fi5, P.sm0],
    frost: [P.W, P.fr0, P.fr1, P.fr2, P.fr3, P.fr4],
    shock: [P.W, P.sh0, P.sh1, P.sh2, P.sh3, P.sh4],
    stone: [P.st0, P.st1, P.st2, P.st3, P.st4],
    steel: [P.W, P.W, P.fr0, P.fl0, P.fl1, P.fl2],
    heal: [P.W, P.hl0, P.hl1, P.hl2, P.hl3],
    holy: [P.W, P.ho0, P.ho1, P.ho2, P.ho3],
    dust: [P.du0, P.du1, P.du2],
    wood: [P.wd0, P.wd1, P.wd2],
    bow: [P.W, P.bw0, P.bw1, P.bw2],
    aegis: [P.W, P.ag0, P.ag1, P.ag2, P.ag3],
    leaf: [P.W, P.lf0, P.lf1, P.lf2, P.lf3],
    ash: [P.as0, P.as1, P.as2, P.as3, P.as4, P.as5],
    ghost: [P.W, P.vg0, P.vg1, P.vg2, P.vg3, P.vg4]
  };
  const rampAt = (r, f) => r[f <= 0 ? 0 : f >= 1 ? r.length - 1 : Math.floor(f * r.length)];

  /* ---------- 床（見本シーン用）と照り返し ---------- */
  const FLOOR = { base: rgba32('#22352c'), brick: rgba32('#26392e'), hi: rgba32('#2d4335'), mortar: rgba32('#1a2a22'),
                  wall: rgba32('#15291e'), edge: rgba32('#42523a') };
  const LIT = {   // 床の色 → 照らされた色（palette swap）
    fire:   ['#3d3322', '#4a3c26', '#63502e', '#2c251a'],
    arcane: ['#2c2840', '#352f4d', '#463c63', '#221f33'],
    frost:  ['#22394a', '#274356', '#33566c', '#1a2c38'],
    shock:  ['#3b3a26', '#48462c', '#5e5a36', '#2b2a1c'],
    heal:   ['#24403a', '#2a4c42', '#386656', '#1c3129'],
    holy:   ['#3a3a2a', '#464430', '#5e5a3c', '#2a2a1e'],
    steel:  ['#2a3a3c', '#304446', '#3e5858', '#1e2c2c'],
    aegis:  ['#243650', '#2a405e', '#34507a', '#1c2a40'],
    bloom:  ['#2c3e24', '#34492a', '#445e34', '#20301c']
  };
  const LIT_MAP = {};
  for (const k in LIT) {
    const m = new Map();
    [FLOOR.base, FLOOR.brick, FLOOR.hi, FLOOR.mortar].forEach((c, i) => m.set(c, rgba32(LIT[k][i])));
    LIT_MAP[k] = m;
  }
  const floorTile = new Uint32Array(16 * 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = y < 8 ? 0 : 1, bx = (x + (row ? 8 : 0)) % 16, yy = y % 8;
    let c = FLOOR.brick;
    if (yy === 7 || bx === 15) c = FLOOR.mortar;
    else if (yy === 0 && bx > 1 && bx < 13) c = FLOOR.hi;
    else if ((bx * 7 + y * 13) % 23 === 0) c = FLOOR.base;
    floorTile[y * 16 + x] = c;
  }

  /* ---------- 描画バッファ（伸ばすだけで作り直さない） ---------- */
  function makeBuf() { return { W: 0, H: 0, w: 0, h: 0, cv: null, cx: null, img: null, u32: null }; }
  const SCENE_BUF = makeBuf(), FX_BUF = makeBuf();
  function prep(b, w, h) {
    if (w > b.W || h > b.H) {
      b.W = Math.max(w, b.W); b.H = Math.max(h, b.H);
      b.cv = document.createElement('canvas'); b.cv.width = b.W; b.cv.height = b.H;
      b.cx = b.cv.getContext('2d'); b.img = b.cx.createImageData(b.W, b.H);
      b.u32 = new Uint32Array(b.img.data.buffer);
    }
    b.w = w; b.h = h;
    for (let y = 0; y < h; y++) b.u32.fill(0, y * b.W, y * b.W + w);
  }
  let CUR = SCENE_BUF, SX = 0, SY = 0, SCENE_MODE = true;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y, lv) => lv >= 1 || lv > (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  function px(x, y, c, lv = 1) {
    x = Math.round(x + SX); y = Math.round(y + SY);
    if (x < 0 || y < 0 || x >= CUR.w || y >= CUR.h) return;
    if (lv < 1 && !dith(x, y, lv)) return;
    CUR.u32[y * CUR.W + x] = c;
  }
  function get(x, y) {
    x = Math.round(x + SX); y = Math.round(y + SY);
    if (x < 0 || y < 0 || x >= CUR.w || y >= CUR.h) return 0;
    return CUR.u32[y * CUR.W + x];
  }
  function hline(x0, x1, y, c, lv = 1) { for (let x = Math.round(x0); x <= Math.round(x1); x++) px(x, y, c, lv); }
  function disc(cx, cy, r, c, lv = 1) {
    cx = Math.round(cx); cy = Math.round(cy);
    if (r < 0.5) { px(cx, cy, c, lv); return; }
    const rr = (r + 0.5) * (r + 0.5), ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const w = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
      hline(cx - w, cx + w, cy + dy, c, lv);
    }
  }
  function ellipse(cx, cy, rx, ry, c, lv = 1) {
    cx = Math.round(cx); cy = Math.round(cy); ry = Math.max(1, Math.round(ry));
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))));
      hline(cx - w, cx + w, cy + dy, c, lv);
    }
  }
  /* 中点円。dash があれば角度で間引く（回る破線） */
  function ring(cx, cy, r, c, lv = 1, dash = 0, phase = 0) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r <= 0) { px(cx, cy, c, lv); return; }
    const plot = (dx, dy) => {
      if (dash) { const a = Math.atan2(dy, dx) / TAU + 0.5; if ((Math.floor(a * dash + phase) & 1)) return; }
      px(cx + dx, cy + dy, c, lv);
    };
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      plot(x, y); plot(y, x); plot(-y, x); plot(-x, y); plot(-x, -y); plot(-y, -x); plot(y, -x); plot(x, -y);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  function line(x0, y0, x1, y1, c, lv = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      px(x0, y0, c, lv);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function plus(x, y, c, arm = 1, lv = 1) { for (let i = -arm; i <= arm; i++) { px(x + i, y, c, lv); px(x, y + i, c, lv); } }
  /* 床の照り返し（見本では床の色だけを差し替える。実機では床が別なので薄いディザで代用） */
  function lightPool(cx, cy, r, level, tint) {
    if (level <= 0 || r <= 0) return;
    const m = LIT_MAP[tint], ri = Math.ceil(r), rj = Math.ceil(r * 0.62);      // 床なので上下につぶす
    for (let dy = -rj; dy <= rj; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + (dy / 0.62) * (dy / 0.62)) / r; if (d > 1) continue;
      const lv = clamp(level * 1.7 * (1 - d * d));
      const X = Math.round(cx + dx + SX), Y = Math.round(cy + dy + SY);
      if (X < 0 || Y < 0 || X >= CUR.w || Y >= CUR.h || !dith(X, Y, lv)) continue;
      const i = Y * CUR.W + X;
      if (SCENE_MODE) { const s = m.get(CUR.u32[i]); if (s) CUR.u32[i] = s; }
      else if (CUR.u32[i] === 0 && dith(X, Y, lv * 0.35)) CUR.u32[i] = m.get(FLOOR.hi);
    }
  }

  /* ---------- 16px の絵（ゲームの PNG と同じドット。杖だけ別レイヤーにしてポーズを付ける） ---------- */
  const SPR = {
    archmage: {
      map: ['................', '................', '.............a..', '............aba.', '......cdddc..a..', '.....cdefedc.g..',
            '.....cdhfhfc.g..', '....ccfffffc.g..', '...ciidddddc.g..', '..cijidedddcfk..', '..cijjieddc..g..', '...cijiedc...g..',
            '...cijjic....g..', '...ciiccic...g..', '................', '................'],
      pal: { a: '#72d9e6', b: '#d6ffff', c: '#1f2843', d: '#f1ecd9', e: '#b8b4bd', f: '#e8c9a5', g: '#6a3e31', h: '#32405b', i: '#4b3565', j: '#8e62a3', k: '#a45d35' },
      staff: (x, y) => (x === 13 && y >= 2 && y <= 13) || ((x === 12 || x === 14) && y === 3) || (x === 12 && y === 9),
      gem: [13, 3], outline: 'c'
    },
    mage: {
      map: ['................', '................', '....aa..........', '...abca......a..', '....abccca..ada.', '..abbbcccca.aea.',
            '....affffa...g..', '....afhfha...g..', '....affffa...g..', '..acabibiaafag..', '..accabiba...g..', '..accabiba...g..',
            '...acabiba...g..', '....aaa.aaa..g..', '................', '................'],
      pal: { a: '#1f2843', b: '#30284f', c: '#8669ac', d: '#c7ffff', e: '#8b73d9', f: '#080c1b', g: '#6a3e31', h: '#7fe0e0', i: '#594479' },
      staff: (x, y) => (x === 13 && y >= 3 && y <= 13) || ((x === 12 || x === 14) && (y === 4 || y === 5)),
      gem: [13, 4], outline: 'a'
    },
    warrior: {
      map: ['................', '................', '.....aaaa...b...', '....acddca.aba..', '....aceeeaabba..', '....aeaeaeabba..',
            '.....aeeeaabba..', '..aaafgaaafa....', '.afgaaghgafia...', '.aggaagjgafa....', '.aggaahgfa......', '..agaaggga......',
            '....aiaaia......', '....ii..ii......', '................', '................'],
      pal: { a: '#1f2843', b: '#d7dde3', c: '#6a3e31', d: '#a85f32', e: '#e8d6ba', f: '#cd8e38', g: '#66626d', h: '#3a405c', i: '#874122', j: '#b8c1cc' },
      staff: () => false, gem: [12, 3], outline: 'a'
    },
    knight: {
      map: ['................', '.............a..', '.....aaaaaa.aba.', '....acddeeeabda.', '....aafgfgfabda.', '....acdddeeabda.',
            '....acdddeeabda.', '...aeaaddeaada..', '..acddaaaadbcba.', '..acdaacdaccaa..', '..acddacdaca....', '...acaacddda....',
            '....acdaacda....', '....ahha.ahha...', '................', '................'],
      pal: { a: '#1f2843', b: '#d7dde3', c: '#59677d', d: '#8e9bb0', e: '#bbc5d2', f: '#101626', g: '#b9e6f2', h: '#30394a' },
      staff: () => false, gem: [13, 3], outline: 'a'
    },
    rogue: {
      map: ['................', '................', '.....aaaa.......', '....abbbba......', '...accddbba.....', '...acdededa.....',
            '...acfffffa.....', '..accabbaaa.....', '..accaggggadhij.', '.jihdagkkga.....', '....aggggga.....', '....agklkga.....',
            '....aga.aga.....', '...agga.agga....', '................', '................'],
      pal: { a: '#1f2843', b: '#d6b34a', c: '#a97830', d: '#e8d6ba', e: '#171c31', f: '#3a405c', g: '#6a3e31', h: '#874122', i: '#b8c1cc', j: '#d7dde3', k: '#66626d', l: '#a85f32' },
      staff: () => false, gem: [14, 8], outline: 'a'
    },
    hunter: {
      map: ['................', '................', '...a..bccb......', '..ad.bceeeb.....', '..bdbceeeeb..f..', '..bdbcghihi.fj..',
            '...dbcgiiib.fj..', '...bdbbbbbbbkj..', '....bleelbclkj..', '....bleellbfij..', '.....bldlbccfj..', '.....bdbbbdbfj..',
            '.....bdb.bdb.f..', '.....bb..bb.....', '................', '................'],
      pal: { a: '#dae5b3', b: '#1e222d', c: '#58855f', d: '#56352a', e: '#7fc08a', f: '#b87740', g: '#d3b282', h: '#18202a', i: '#e5c79b', j: '#dad2b6', k: '#ffffff', l: '#965b39' },
      staff: () => false, gem: [12, 8], outline: 'b'
    },
    priest: {
      map: ['................', '................', '.....aaaa.......', '....abbbba...c..', '...abddddda.cec.', '...abdfghgha.c..',
            '...abdfhhhha.c..', '....aadddaa.ac..', '..aaabddbaahhc..', '..abbbddbbaa.c..', '..abbbiibba..c..', '..abbbibbbba.c..',
            '..abbbibbbba.c..', '..aaaaaaaaaa.c..', '................', '................'],
      pal: { a: '#1f2843', b: '#454a68', c: '#cd8e38', d: '#f2e8d0', e: '#f2c14e', f: '#e6c593', g: '#3a405c', h: '#e8d6ba', i: '#7fe0c0' },
      staff: (x, y) => (x === 13 && y >= 3 && y <= 13) || ((x === 12 || x === 14) && y === 4),
      gem: [13, 4], outline: 'a'
    },
    frog: {
      map: ['................................', '................................', '................................', '................................', '................................', '................................', '................................', '..............aaa...............', '.............abcca..aa..........', '...........aaaddccaadda.........', '.........aabeffdcdffdda.aaa.....', '.........accgaafddfbddaaaaga....', '........afcccgaadfbdfahhhhaca...', '......aafdddddaadaaadahihhafa...', '......aaaddeeabbbaadfahihhaffa..', '.....adbbadffaabafddcahhhhacffa.', '....addddbebbfaabfbbccaaaacccda.', '....afddfaefffgbbbfccbfddddbbda.', '....afbffaaaaggjbbfgaaaaaaaaaa..', '...abbbbfaaeggjggbggggggggggg...', '..afdbbbbaeebccgggggjjjjjjjj....', '.afdfccddaeebbbccccjjjjjjjj.....', '.adddcbddaeegbddccggggggggda....', '.affbbdffaffgdccdcaaaaaaafdda...', '.adbbfffafffdbbccfcddggafffda...', '..agbffffaeaddddffdbbga.abbbka..', '..adgdffcba.addaffddbgga.abbaca.', '...aafffaca..aaaadggdgdda.aa.a..', '.....aaa.aa......aaggdddja......', '...................aaaaaa.......', '................................', '................................'],
      pal: { a: '#1f2843', b: '#717586', c: '#9799a5', d: '#565a6c', e: '#2b2f3d', f: '#3f4352', g: '#b2a58b', h: '#e2c252', i: '#151018', j: '#daccae', k: '#eee1c1' },
      staff: () => false, gem: [25, 14], outline: 'a'
    },
    vera: {                                   // 空引きのヴェラ（見本用。狩人の型を青白く。顔はまだある）
      map: ['................', '................', '...a..bccb......', '..ad.bceeeb.....', '..bdbceeeeb..f..', '..bdbcghihi.fj..',
            '...dbcgiiib.fj..', '...bdbbbbbbbkj..', '....bleelbclkj..', '....bleellbfij..', '.....bldlbccfj..', '.....bdbbbdbfj..',
            '.....bdb.bdb.f..', '.....bb..bb.....', '................', '................'],
      pal: { a: '#dff4ff', b: '#1e222d', c: '#557fa0', d: '#3c4a5a', e: '#a8c8dc', f: '#c8e6f5', g: '#c8a882', h: '#18202a', i: '#d8bc98', j: '#8fbcd8', k: '#ffffff', l: '#6a7e90' },
      staff: () => false, gem: [12, 8], outline: 'b'
    },
    vera2: {                                  // 礫の狩人、ヴェラ（石の魔物。見本用）
      map: ['................', '................', '...a..bccb......', '..ad.bceeeb.....', '..bdbceeeeb..f..', '..bdbcghghg.fj..',
            '...dbcggggb.fj..', '...bdbbbbbbbkj..', '....bleelbclkj..', '....bleellbfij..', '.....bldlbccfj..', '.....bdbbbdbfj..',
            '.....bdb.bdb.f..', '.....bb..bb.....', '................', '................'],
      pal: { a: '#c8e6f5', b: '#15121b', c: '#5d5566', d: '#3b3544', e: '#8a7f8f', f: '#8a7f8f', g: '#5d5566', h: '#c8e6f5', i: '#3b3544', j: '#221e29', k: '#dff4ff', l: '#3b3544' },
      staff: () => false, gem: [12, 8], outline: 'b'
    },
    moss: {
      map: ['................', '................', '......aaaa......', '.....abbbba.....', '.....acbbcba....', '....abcdccca....',
            '....adececcca...', '....acddccdfa...', '...adffccfdfda..', '...afdfgdfggda..', '...agacgggfaga..', '....agcaaacfa...',
            '....afgaaffga...', '.....aa..aaa....', '................', '................'],
      pal: { a: '#1f2843', b: '#7f8040', c: '#6c6c38', d: '#616033', e: '#e9e1b6', f: '#51502d', g: '#49472a' },
      staff: () => false, gem: [8, 8], outline: 'a'
    }
  };
  for (const k in SPR) {
    const s = SPR[k]; s.body = []; s.stf = [];
    s.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const rec = [x, y, rgba32(s.pal[ch]), ch === s.outline ? 1 : 0];
      (s.staff(x, y) ? s.stf : s.body).push(rec);
    }));
  }
  const rimRight = new Int16Array(16), rimTop = new Int16Array(16);
  /* キャラを描く。fx,fy は足元。
     pose = {bob, lift, fwd, sway, rim, rimCol, gemFlash, dx, dy, z, ghost, hidden, face}
     dx/dy は体ごとの踏み込み、z は跳ね、ghost は 0..1（ディザで薄く）、face=-1 で左向き */
  function drawCaster(key, fx, fy, pose) {
    const s = SPR[key], face = pose.face || 1;
    const bx = Math.round(fx + (pose.dx || 0)), by = Math.round(fy + (pose.dy || 0)), z = Math.round(pose.z || 0);
    const left = bx - 8, top = by - 13 - z, lv = pose.ghost != null ? pose.ghost : 1;
    if (!pose.hidden) ellipse(bx, by + 1, z > 6 ? 3 : 5, 1, FLOOR.wall, z > 6 ? 0.6 : 1);   // 足元の影
    rimRight.fill(-999); rimTop.fill(999);
    if (pose.hidden) return { gx: left + s.gem[0], gy: top + s.gem[1] };
    const fxp = x => face > 0 ? x : 15 - x;
    for (const [x, y, c] of s.body) {
      const X = left + fxp(x) + (y >= 11 ? pose.sway : 0), Y = top + y + (y < 12 ? pose.bob : 0);
      px(X, Y, c, lv);
      if (X > rimRight[y]) rimRight[y] = X;
      const col = x; if (Y < rimTop[col]) rimTop[col] = Y;
    }
    for (const [x, y, c] of s.stf) px(left + fxp(x) + pose.fwd * face, top + y - pose.lift + pose.bob, c, lv);
    // リムライト：宝石側（右）の輪郭と、宝石が上にあるときは頭の上端を光らせる
    if (pose.rim >= 0.34) for (let y = 2; y < 14; y++) if (rimRight[y] > -999) {
      if (y >= 11 && pose.rim < 0.67) continue;
      px(rimRight[y], top + y + (y < 12 ? pose.bob : 0), pose.rimCol);
    }
    if (pose.rim >= 0.67) for (let x = 7; x < 12; x++) if (rimTop[x] < 999) px(left + x, rimTop[x], pose.rimCol);
    const gx = left + fxp(s.gem[0]) + pose.fwd * face, gy = top + s.gem[1] - pose.lift + pose.bob;
    if (pose.gemFlash) { px(gx, gy, P.W); if (pose.gemFlash > 1) plus(gx, gy, P.cy0, 1); px(gx, gy, P.W); }
    return { gx, gy };
  }
  /* 敵（苔玉）。st = {flash, kx, ky, z, burn, chill, shock, t} */
  function drawEnemy(fx, fy, st) {
    const s = SPR.moss, z = Math.round(st.z || 0), left = Math.round(fx + (st.kx || 0)) - 8, top = Math.round(fy + (st.ky || 0)) - 13 - z;
    ellipse(fx + (st.kx || 0), fy + (st.ky || 0) + 1, 5 - (z > 3 ? 1 : 0), 1, FLOOR.wall);
    const fr = Math.floor((st.t || 0) * 24);
    for (const [x, y, c, ol] of s.body) {
      let col = c;
      if (st.flash) col = P.W;
      else if (ol && st.shock && (fr & 1)) col = st.outline || P.sh1;
      else if (ol && st.chill) col = P.fr2;
      px(left + x, top + y, col);
    }
    if (st.burn && !st.flash) for (let i = 0; i < 3; i++) {
      const hx = left + 5 + Math.floor(hash(i, Math.floor((st.t || 0) * ANIM_FPS)) * 7), hy = top + 3 + Math.floor(hash(i + 9, Math.floor((st.t || 0) * ANIM_FPS)) * 4);
      px(hx, hy, i ? P.fi2 : P.fi1); px(hx, hy - 1, P.fi3, 0.6);
    }
    if (st.chill && !st.flash) { px(left + 5, top + 2, P.fr0); px(left + 10, top + 3, P.fr1); }
  }

  /* ---------- 共通：溜め（宝石へ渦を巻いて吸い込まれる粒） ---------- */
  function chargeFx(tc, dur, gx, gy, ramp, n = 10) {
    if (tc < 0 || tc > dur) return;
    for (let i = 0; i < n; i++) {
      const st = hash(i, 11) * dur * 0.45, life = dur * 0.55, a = q60(tc) - st;
      if (a < 0 || a > life) continue;
      const p = a / life, r = 15 * (1 - easeOut(p)) + 1, ang = hash(i, 12) * TAU + p * 3.4;
      const x = gx + Math.cos(ang) * r, y = gy + Math.sin(ang) * r * 0.8;
      px(x, y, rampAt(ramp, 1 - p * 0.85));
      const r2 = r + 2, a2 = ang - 0.35;
      px(gx + Math.cos(a2) * r2, gy + Math.sin(a2) * r2 * 0.8, rampAt(ramp, 1 - p * 0.5), 0.6);
    }
  }


  /* ============================================================
     共通の部品
     ============================================================ */
  const q24 = t => Math.floor(t * 24) / 24;
  const norm = a => { a %= TAU; return a < 0 ? a + TAU : a; };

  /* つぶれた楕円の輪（足元の魔法陣や地面の輪に使う）。dash で回る破線 */
  function ellRing(cx, cy, rx, ry, c, lv = 1, dash = 0, phase = 0) {
    cx = Math.round(cx); cy = Math.round(cy);
    if (rx < 1) { px(cx, cy, c, lv); return; }
    const n = Math.max(16, Math.round(rx * 7));
    let lx = null, ly = null;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      if (dash && (Math.floor(i / n * dash + phase) & 1)) { lx = null; continue; }
      if (lx === null || (Math.abs(x - lx) <= 1 && Math.abs(y - ly) <= 1)) px(x, y, c, lv);
      else line(lx, ly, x, y, c, lv);
      lx = x; ly = y;
    }
  }

  /* ---------- 足元の魔法陣 ----------
     参考ポストの魔法少女と同じ作り：つぶれた二重の輪＋回る刻み＋縁から立ちのぼる文字の粒。
     発動の瞬間だけ白く光り、そのあと元の色へ戻って間引かれて消える。
     t = 発動からの秒（負なら溜め中）、hold = 出している長さ、elem = 色の組 */
  const CIRCLE_COL = {
    arcane: [P.ar1, P.cy1, P.ar3, P.cy0], fire: [P.fi2, P.fi1, P.fi4, P.fi0], frost: [P.fr2, P.fr1, P.fr4, P.fr0],
    shock: [P.sh2, P.sh1, P.sh4, P.sh0], heal: [P.hl2, P.hl1, P.hl3, P.hl0], holy: [P.ho1, P.ho0, P.ho3, P.W],
    aegis: [P.ag1, P.ag0, P.ag3, P.W], bloom: [P.lf2, P.lf1, P.lf3, P.lf4]
  };
  const GLYPH = [[1, 1, 0, 1], [0, 1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 0]];   // 2x2 の文字片
  function magicCircle(cx, cy, t, hold, elem, size = 1, chargeDur = 0.3) {
    const col = CIRCLE_COL[elem] || CIRCLE_COL.arcane;
    const from = -chargeDur;
    if (t < from || t > hold + 0.2) return;
    const tq = q12(t), fr = Math.floor(t * ANIM_FPS);
    const grow = t < 0 ? easeOut(clamp((t - from) / Math.max(0.01, chargeDur))) : 1;
    const fade = t > hold ? 1 - (t - hold) / 0.2 : 1;
    const rx = Math.round((9 + 4 * grow) * size), ry = Math.max(2, Math.round(rx * 0.42));
    const flash = t >= 0 && t < 0.1;
    const c0 = flash ? P.W : col[0], c1 = flash ? P.W : col[1];
    // 外の輪（二重）
    ellRing(cx, cy, rx, ry, c0, fade);
    ellRing(cx, cy, rx - 2, ry - 1, (fr & 1) ? c1 : col[2], fade * 0.9, 18, tq * 2.5);
    // 輪の上の刻み（6つが回る）
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + tq * 1.6, x = Math.round(cx + Math.cos(a) * (rx - 1)), y = Math.round(cy + Math.sin(a) * (ry - 0.5));
      px(x, y, flash ? P.W : col[3], fade); px(x + 1, y, c0, fade * 0.7);
    }
    // 中心の菱形
    px(cx - 2, cy, c1, fade); px(cx + 2, cy, c1, fade); px(cx, cy - 1, c1, fade); px(cx, cy + 1, c1, fade);
    if (fr & 1) px(cx, cy, col[3], fade);
    // 縁から立ちのぼる文字片（溜めの間と発動直後）
    const upTo = Math.min(hold, 0.6);
    for (let i = 0; i < 10; i++) {
      const born = from + hash(i, 301) * (upTo - from), a = t - born, life = 0.55;
      if (a < 0 || a > life) continue;
      const p = a / life, ang = hash(i, 302) * TAU;
      const x = Math.round(cx + Math.cos(ang) * rx * 0.9), y = Math.round(cy + Math.sin(ang) * ry * 0.9 - p * 14 * size);
      const g = GLYPH[i & 3], c = p < 0.3 ? col[3] : p < 0.7 ? col[1] : col[2];
      for (let k = 0; k < 4; k++) if (g[k]) px(x + (k & 1), y + (k >> 1), c, fade);
    }
    // 床の照り返し
    lightPool(cx, cy, rx + 3, (flash ? 0.9 : 0.4) * fade * grow, elem === 'arcane' ? 'arcane' : elem);
  }

  /* ---------- 斬撃の三日月 ----------
     承認済みの通常攻撃と同じ「先が太く、尾は糸のように細い」形をドットで描く。
     aLead＝先端の角度、sweep＝尾までの角度（符号が回る向き）、w＝一番厚いところ、flat＝縦のつぶれ。
     erode は 0..1 で、形そのものが欠けていく（半透明にしない）。 */
  function smear(cx, cy, r, aLead, sweep, w, flat, cols, erode = 0, seed = 0, lv = 1) {
    const span = Math.abs(sweep), dir = sweep >= 0 ? 1 : -1;
    if (span < 0.02 || r < 2) return;
    const ri = Math.ceil(r) + 1, ry = Math.ceil(r * flat) + 1;
    for (let dy = -ry; dy <= ry; dy++) {
      const yy = dy / flat;
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.sqrt(dx * dx + yy * yy);
        if (d > r + 0.5 || d < r - w - 1) continue;
        const back = norm((aLead - Math.atan2(yy, dx)) * dir);
        if (back > span) continue;
        const u = 1 - back / span;
        const th = Math.max(u > 0.04 && u < 0.985 ? 1 : 0, w * Math.pow(u, 1.6) * Math.pow(1 - u, 0.7) / 0.243);   // 先は細く鉤状に
        if (d < r - th || th <= 0) continue;
        if (erode > 0 && hash(Math.floor(back / span * 9), seed + 7) < erode * (1.1 - u * 0.6)) continue;
        const depth = r - d;                         // 外側の縁 = 白、内へ行くほど本体色 → 尾の色
        let c = depth < 0.9 || u > 0.9 ? cols[0] : depth < th * 0.5 ? cols[1] : cols[2];
        if (u < 0.28) c = depth < 0.9 ? cols[1] : cols[2];
        px(cx + dx, cy + dy, c, lv);
      }
    }
  }
  /* 一振りを時間で動かす：前半で先端が回りきり、後半は尾が追いついて欠けて消える（24fps） */
  function slash(cx, cy, r, a0, a1, w, flat, cols, age, dur, seed = 0) {
    if (age < 0 || age > dur) return;
    const p = q24(age) / dur, total = a1 - a0, sg = total >= 0 ? 1 : -1;
    if (p < 0.45) {
      const k = easeOut(p / 0.45);
      smear(cx, cy, r, a0 + total * k, sg * Math.abs(total) * Math.max(0.08, k), w, flat, cols, 0, seed);
    } else {
      const k = (p - 0.45) / 0.55;
      smear(cx, cy, r, a1, sg * Math.abs(total) * (1 - k * 0.85), w * (1 - k * 0.45), flat, cols, k * 0.9, seed);
    }
  }
  const STEEL = [P.W, P.fr0, P.fl0];                 // 刃：先端白・本体・尾の青
  const tintCols = c => [P.W, c, P.fl0];

  /* 当たりの火花（白い十字＋飛び散る粒）。b = 当たってからの秒 */
  function spark(x, y, b, ramp = RAMP.steel, seed = 0, n = 7, big = 1) {
    if (b < 0 || b > 0.32) return;
    if (b < 0.05) { plus(x, y, P.W, 2 * big); px(x, y, P.ac0); }
    else if (b < 0.09) { plus(x, y, P.ac0, big); }
    for (let i = 0; i < n; i++) {
      const a = hash(i, seed + 401) * TAU, sp = (55 + hash(i, seed + 402) * 55) * big;
      const bb = q60(b);
      px(x + Math.cos(a) * sp * bb, y + Math.sin(a) * sp * bb * 0.7 + 40 * bb * bb, rampAt(ramp, bb / 0.32));
    }
  }
  const DUST_COLS = [P.du0, P.du1, P.du2];
  /* 土煙：ふくらみながら網掛け（4×4ディザ）で薄れて消える。塗りつぶしの丸にしない */
  function dust(x, y, b, n = 6, seed = 0, spread = 10, life = 0.5, cols = null, big = 1, alpha = 1) {
    const C = cols || DUST_COLS;
    if (b < 0 || b > life) return;
    const p = q12(b) / life;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, seed + 411), h2 = hash(i, seed + 412), h3 = hash(i, seed + 413);
      const a = h1 * TAU, d = spread * easeOut(Math.min(1, p * 1.4)) * (0.5 + h2 * 0.6);
      const r = (1.3 + h3 * 1.4) * (1 + p * 1.4) * big;
      const lv = (p < 0.2 ? 0.8 : 0.8 * (1 - (p - 0.2) / 0.8)) * (0.8 + 0.2 * h2) * alpha;
      if (lv <= 0.03) continue;
      const xx = x + Math.cos(a) * d, yy = y + Math.sin(a) * d * 0.5 - p * 6 - h3 * 2;
      disc(xx + 1, yy + 1, r, C[2], lv * 0.55);                           // 下の影
      disc(xx, yy, r, C[1], lv);                                          // 本体
      disc(xx + (h1 - 0.5) * r, yy - r * 0.6, r * 0.6, C[1], lv * 0.9);    // こぶ
      disc(xx - r * 0.35, yy - r * 0.4, r * 0.45, C[0], lv * 0.7);         // 上の明るい所
    }
  }
  /* 地面のひび（放射）。glow は光っている時間 */
  function cracks(x, y, b, n, L, seed, glow, life = 0.9, cGlow = P.W, cMid = P.fl1) {
    if (b < 0 || b > life) return;
    const lv = b < life * 0.6 ? 1 : 1 - (b - life * 0.6) / (life * 0.4), grow = clamp(b / 0.06);
    for (let i = 0; i < n; i++) {
      const a = (i + hash(i, seed + 421) * 0.7) * TAU / n, Li = L * (0.6 + hash(i, seed + 422) * 0.5);
      let lx = x, ly = y;
      for (let s = 1; s <= 3; s++) {
        const f = s / 3; if (f > grow + 0.01) break;
        const j = (hash(i * 5 + s, seed + 423) * 2 - 1) * 1.8;
        const nx = x + Math.cos(a) * Li * f - Math.sin(a) * j, ny = y + (Math.sin(a) * Li * f + Math.cos(a) * j) * 0.6;
        line(lx, ly, nx, ny, b < glow ? cGlow : b < glow * 2.5 ? cMid : P.st3, lv); lx = nx; ly = ny;
      }
    }
  }
  /* 地面の衝撃の輪（つぶれた楕円が広がる） */
  function groundRing(x, y, b, R, dur, ramp, flat = 0.5) {
    if (b < 0 || b > dur) return;
    const p = b / dur, r = R * easeOut(p);
    ellRing(x, y, r, r * flat, rampAt(ramp, p * 0.9), 1);
    ellRing(x, y, r - 1, (r - 1) * flat, rampAt(ramp, p * 0.9 + 0.25), 1 - p);
  }

  /* ---------- 小さな飛び道具の絵（8方向に回す） ---------- */
  function rot(dx, dy, a) { const c = Math.cos(a), s = Math.sin(a); return [dx * c - dy * s, dx * s + dy * c]; }
  const q8 = a => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  function drawAxe(x, y, a, lv = 1) {
    a = q8(a);
    const pts = [[-3, 0, P.wd2], [-2, 0, P.wd1], [-1, 0, P.wd1], [0, 0, P.wd1], [1, 0, P.wd0],
                 [2, -2, P.fl0], [2, -1, P.W], [3, -1, P.W], [2, 1, P.fr0], [3, 1, P.fl0], [3, 0, P.W], [2, 0, P.fr0], [3, -2, P.fl1], [3, 2, P.fl1], [4, -1, P.W], [4, 1, P.fl0]];
    for (const [dx, dy, c] of pts) { const [rx, ry] = rot(dx, dy, a); px(x + rx, y + ry, c, lv); }
  }
  function drawDagger(x, y, a, lv = 1) {
    a = q8(a);
    const pts = [[-3, 0, P.wd1], [-2, 0, P.wd1], [-1, -1, P.ho2], [-1, 0, P.ho1], [-1, 1, P.ho2], [0, 0, P.fr0], [1, 0, P.W], [2, 0, P.W], [3, 0, P.fl0], [4, 0, P.W]];
    for (const [dx, dy, c] of pts) { const [rx, ry] = rot(dx, dy, a); px(x + rx, y + ry, c, lv); }
  }
  function drawArrow(x, y, a, lv = 1, fire = false) {
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    for (let j = 0; j < 8; j++) px(x - ux * j, y - uy * j, j < 1 ? P.W : j < 6 ? (fire ? P.fi2 : P.wd0) : P.bw1, lv);
    px(x - ux * 1 + nx, y - uy * 1 + ny, P.fr0, lv); px(x - ux * 1 - nx, y - uy * 1 - ny, P.fr0, lv);
    px(x - ux * 7 + nx, y - uy * 7 + ny, P.bw1, lv); px(x - ux * 7 - nx, y - uy * 7 - ny, P.bw1, lv);
  }
  /* 速さの線（進む向きと反対に伸びる） */
  function speedLines(x0, y0, x1, y1, b, dur, n, seed, cols = [P.W, P.fr0, P.fl0]) {
    if (b < 0 || b > dur) return;
    const p = b / dur, L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
    for (let i = 0; i < n; i++) {
      const off = (hash(i, seed + 431) * 2 - 1) * 5, st = hash(i, seed + 432) * 0.4, len = L * (0.3 + hash(i, seed + 433) * 0.5) * (1 - p);
      const s0 = L * (st + p * 0.6);
      const ax = x0 + ux * s0 + nx * off, ay = y0 + uy * s0 + ny * off;
      line(ax, ay, ax + ux * len, ay + uy * len, cols[i % 3], 1 - p * 0.6);
    }
  }
  /* ============================================================
     崩落（大魔導士 Lv.50）：一点に大質量を落とす
     t=0 発動。0〜0.55 足元の魔法陣と影、0.25〜0.55 石が落ちる、0.55 着弾。
     ============================================================ */
  const COLLAPSE_IMPACT = 0.55, MASS_FALL = 0.12, MASS_Z = 84;
  function massShape(dx, dy, seed) {                      // 岩の輪郭（角度ごとの凸凹）
    const a = Math.atan2(dy, dx);
    return 10 + 1.4 * Math.sin(3 * a + 1.1) + 1.1 * Math.sin(5 * a + seed) + 0.8 * Math.cos(2 * a - 0.4);
  }
  function drawMass(cx, cy, t, glow) {
    cx = Math.round(cx); cy = Math.round(cy);
    const fr = Math.floor(t * ANIM_FPS);
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy), rr = massShape(dx, dy, 2.3);
      if (d > rr + 1) continue;
      if (d > rr) { if ((fr + dx + dy) & 1) px(cx + dx, cy + dy, P.ar2, 0.7); continue; }   // 紫のにじみ（ディザ）
      if (d > rr - 1) { px(cx + dx, cy + dy, P.st4); continue; }                            // 輪郭
      const n = (-dx * 0.7 - dy * 0.75) / rr;                                               // 左上から光
      let c = n > 0.42 ? P.st0 : n > 0.12 ? P.st1 : n > -0.35 ? P.st2 : P.st3;
      const v1 = Math.abs(Math.sin(dx * 0.85 + dy * 0.42 + 1.3)), v2 = Math.abs(Math.sin(-dx * 0.5 + dy * 1.05 + 0.2));
      if ((v1 < 0.13 || v2 < 0.1) && d < rr - 2) c = glow > 1 ? P.W : ((fr & 1) ? P.cy1 : P.ar1);
      px(cx + dx, cy + dy, c);
    }
    if (glow > 0) px(cx - 2, cy - 1, P.W);
  }
  const RUNES = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 1, 1, 1], [1, 0, 0, 1, 1, 1, 0, 0, 1]];
  function collapseGround(t, o) {
    const R = o.R, tx = o.x, ty = o.y;
    if (o.cx != null) magicCircle(o.cx, o.cy + 1, t, 0.6, 'arcane', 1.15, o.charge || 0);
    // 魔法陣（着弾の範囲をそのまま形にする＝予兆）
    if (t >= 0 && t < COLLAPSE_IMPACT + 0.14) {
      const g = easeOut(clamp(t / 0.2)), fade = t > COLLAPSE_IMPACT ? 1 - (t - COLLAPSE_IMPACT) / 0.14 : 1;
      const fr = Math.floor(t * ANIM_FPS), pulse = fr & 1, rot = fr * 0.07;
      const pull = t > 0.42 ? 1 - clamp((t - 0.42) / 0.13) * 0.25 : 1;
      ring(tx, ty, R * g, pulse ? P.ar1 : P.ar2, 0.9 * fade);
      ring(tx, ty, R * g - 3, P.ar3, 0.8 * fade, 28, rot * 3);
      ring(tx, ty, R * g * 0.5 * pull, P.ar2, 0.85 * fade, 12, -rot * 4);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + rot, rr = (R - 8) * g * pull, rx = Math.round(tx + Math.cos(a) * rr), ry = Math.round(ty + Math.sin(a) * rr);
        const rune = RUNES[i & 3], col = t > 0.45 && pulse ? P.W : P.ar1;
        for (let j = 0; j < 9; j++) if (rune[j]) px(rx - 1 + (j % 3), ry - 1 + Math.floor(j / 3), col, fade);
      }
      const dm = Math.round(3 + 2 * g);                                               // 中心の菱形
      for (let i = -dm; i <= dm; i++) { px(tx + i, ty - (dm - Math.abs(i)), P.ar1, fade); px(tx + i, ty + (dm - Math.abs(i)), P.ar1, fade); }
      if (pulse) px(tx, ty, P.W, fade);
      lightPool(tx, ty, R * g, 0.35 + 0.15 * pulse, 'arcane');
    }
    // 落ちてくる影
    if (t >= 0.2 && t < COLLAPSE_IMPACT) {
      const p = clamp((t - 0.2) / (COLLAPSE_IMPACT - 0.2)), rx = 4 + 10 * p;
      ellipse(tx, ty - 1, rx, rx * 0.45, P.st4, 0.35 + 0.45 * p);
    }
    const ti = t - COLLAPSE_IMPACT;
    if (ti < 0) return;
    // 着弾後：照り返し・衝撃波・ひび・クレーター
    lightPool(tx, ty, R * 1.25, ti < 0.08 ? 1 : 0.55 * (1 - clamp((ti - 0.08) / 0.5)), 'arcane');
    if (ti < 0.4) {
      const p = ti / 0.4, r = R * easeOut(p);
      ring(tx, ty, r, rampAt(RAMP.arcane, p * 0.9), 1);
      ring(tx, ty, r - 1, rampAt(RAMP.arcane, p * 0.9 + 0.2), 1 - p);
      ring(tx, ty, r * 0.72, P.ar3, 0.5 * (1 - p));
    }
    for (let i = 0; i < 8; i++) {                                                    // 放射状のひび
      const a = (i + hash(i, 31) * 0.6) * TAU / 8, L = Math.min(R * 0.7, 13 + hash(i, 32) * 20), grow = clamp(ti / 0.09);
      const col = ti < 0.3 ? P.ar1 : ti < 0.8 ? P.ar3 : P.st4, lv = ti < 1.2 ? 1 : 1 - (ti - 1.2) / 0.6;
      if (lv <= 0) continue;
      let x = tx, y = ty;
      const segs = 4;
      for (let s = 1; s <= segs; s++) {
        const f = s / segs; if (f > grow + 0.001) break;
        const j = (hash(i * 7 + s, 33) * 2 - 1) * 2.5;
        const nx = tx + Math.cos(a) * L * f - Math.sin(a) * j, ny = ty + (Math.sin(a) * L * f + Math.cos(a) * j) * 0.85;
        line(x, y, nx, ny, col, lv); x = nx; y = ny;
      }
      if (ti < 0.2) px(tx + Math.cos(a) * 3, ty + Math.sin(a) * 2.5, P.W);
    }
    ellipse(tx, ty, 8, 4, P.st4, ti < 1.3 ? 1 : 1 - (ti - 1.3) / 0.5);            // クレーター
    ellipse(tx, ty - 1, 6, 2, P.st3, ti < 1.3 ? 1 : 1 - (ti - 1.3) / 0.5);
  }
  function collapseAir(t, o) {
    const tx = o.x, ty = o.y, R = o.R, fr = Math.floor(t * ANIM_FPS);
    // 杖から空へ抜ける光（見本ではキャラの宝石から。実機では省略）
    if (o.gx != null && t >= 0 && t < 0.14) {
      const w = t < 0.06 ? 1 : 0, topY = 0 - SY;
      line(o.gx, o.gy, o.gx, topY, P.W); if (w) { line(o.gx - 1, o.gy - 2, o.gx - 1, topY, P.ar1); line(o.gx + 1, o.gy - 2, o.gx + 1, topY, P.ar1); }
      plus(o.gx, o.gy, P.W, t < 0.07 ? 3 : 2); plus(o.gx, o.gy, P.cy0, 1);
    }
    // 落下
    if (t >= MASS_FALL && t < COLLAPSE_IMPACT + 0.12) {
      const p = clamp((t - MASS_FALL) / (COLLAPSE_IMPACT - MASS_FALL)), z = MASS_Z * (1 - easeIn(p)), my = ty - 7 - z;
      // 尾：上へ伸びる筋
      if (p < 1) for (let i = 0; i < 5; i++) {
        const sx = tx - 6 + i * 3, L = (10 + hash(i, 41) * 18) * (0.4 + p);
        for (let k = 0; k < L; k++) px(sx, my - 9 - k + (i === 2 ? -2 : 0), k < 3 ? P.ar0 : k < L * 0.5 ? P.ar1 : P.ar3, 1 - k / L);
      }
      // 石から剥がれて空中に残る粒
      for (let i = 0; i < 12; i++) {
        const te = MASS_FALL + hash(i, 43) * (COLLAPSE_IMPACT - MASS_FALL - 0.05), a = t - te;
        if (a < 0 || a > 0.35) continue;
        const pe = clamp((te - MASS_FALL) / (COLLAPSE_IMPACT - MASS_FALL)), ze = MASS_Z * (1 - easeIn(pe));
        px(tx + (hash(i, 44) * 2 - 1) * 11, ty - 7 - ze - a * 14, rampAt(RAMP.arcane, a / 0.35));
      }
      drawMass(tx, t < COLLAPSE_IMPACT ? my : ty - 6, t, t > COLLAPSE_IMPACT - 0.04 ? 2 : 1);
    }
    const ti = t - COLLAPSE_IMPACT;
    if (ti < 0) return;
    // 閃光
    if (ti < 0.05) { disc(tx, ty - 4, 15, P.W); ring(tx, ty - 4, 19, P.ar0); }
    else if (ti < 0.1) disc(tx, ty - 4, 10, P.ar0, 0.6);
    // 砕けた石（放物線＋一度だけ跳ねる）
    const G = 300;
    for (let i = 0; i < 24; i++) {
      const big = i < 10, a0 = hash(i, 51) * TAU, sp = (big ? 45 : 70) + hash(i, 52) * 55, vz = (big ? 70 : 90) + hash(i, 53) * 70;
      const t0 = big ? 0.1 : 0.02, a = ti - t0; if (a < 0) continue;
      const tLand = 2 * vz / G; let z, d;
      if (a < tLand) { z = vz * a - 0.5 * G * a * a; d = sp * a; }
      else { const b = a - tLand, vz2 = vz * 0.3, tl2 = 2 * vz2 / G; z = b < tl2 ? vz2 * b - 0.5 * G * b * b : 0; d = sp * tLand + sp * 0.35 * Math.min(b, tl2 + 0.1); }
      const lv = a < 0.9 ? 1 : 1 - (a - 0.9) / 0.4; if (lv <= 0) continue;
      const x = tx + Math.cos(a0) * d, y = ty + Math.sin(a0) * d * 0.7;
      if (z > 1) px(x, y, P.st4, lv * 0.7);
      if (big) { px(x, y - z, P.st1, lv); px(x + 1, y - z, P.st2, lv); px(x, y - z + 1, P.st3, lv); px(x + 1, y - z + 1, (i & 1) ? P.ar1 : P.st3, lv); px(x, y - z - 1, P.st0, lv); }
      else px(x, y - z, (i & 3) ? P.st1 : P.st0, lv);
    }
    // 土煙（輪の先端に並ぶ）
    for (let i = 0; i < 10; i++) {
      const p = clamp(ti / 0.55), a = (i + hash(i, 61) * 0.5) * TAU / 10, r = R * 0.82 * easeOut(p);
      const k = 1 - clamp((ti - 0.3) / 0.7); if (k <= 0) continue;          // 薄くするのではなく縮めて消す
      const x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r * 0.8 - 2 - p * 4, rad = Math.round((1.5 + 2 * p) * k);
      const ox = hash(i, 62) > 0.5 ? 2 : -2;
      disc(x + ox, y + 1, rad - 1, P.st3); disc(x, y, rad, P.st2); if (rad >= 2) px(x - 1, y - rad + 1, P.st1);
    }
    // 立ちのぼる残り火
    for (let i = 0; i < 18; i++) {
      const t0 = 0.05 + hash(i, 71) * 0.6, a = ti - t0, life = 0.7; if (a < 0 || a > life) continue;
      const p = a / life, x = tx + (hash(i, 72) * 2 - 1) * 20 + Math.sin(a * 9 + i) * 1.5, y = ty - 3 - p * 24;
      if ((fr + i) % 5 === 0) continue;
      px(x, y, rampAt(i & 1 ? RAMP.cyan : RAMP.arcane, p));
    }
    if (ti < 0.12) plus(tx, ty - 6, P.W, 2);
  }

  /* ============================================================
     フレイム（杖 lv1）：前方の扇に 2.5 秒燃え続ける
     ============================================================ */
  function flameGround(t, o) {
    magicCircle(o.x, o.y + 1, t, o.life, 'fire', 1, o.charge || 0);
    if (t < 0 || t > o.life + 0.6) return;
    const on = t <= o.life, fr = Math.floor(t * ANIM_FPS);
    const lx = o.x + Math.cos(o.ang) * o.R * 0.5, ly = o.y + Math.sin(o.ang) * o.R * 0.5;
    const env = on ? 0.55 + 0.2 * (hash(fr, 5) > 0.5 ? 1 : 0) : 0.55 * (1 - (t - o.life) / 0.6);
    lightPool(lx, ly - 2, o.R * 0.62, env * 0.8, 'fire');
    // 床に残る火の粉と焦げ
    for (let s = 0; s <= fr; s++) {
      const age = t - s / ANIM_FPS; if (age > 0.7) continue;
      if (s / ANIM_FPS > o.life) break;
      for (let j = 0; j < 3; j++) {
        const u = hash(s * 3 + j, 21) * 2 - 1, d = o.R * (0.25 + 0.75 * hash(s * 3 + j, 22)), th = o.ang + u * o.arc;
        const x = o.x + Math.cos(th) * d, y = o.y + Math.sin(th) * d * 0.9;
        px(x, y, rampAt(RAMP.fire, 0.3 + age / 0.7 * 0.7), age > 0.5 ? 0.5 : 1);
      }
    }
  }
  /* 炎の一粒：丸ではなく上へ尖る涙形。先端が 12fps で左右に揺れる */
  function flamePuff(x, y, s, ci, lean) {
    const c = RAMP.fire[ci], hot = RAMP.fire[Math.max(0, ci - 2)];
    disc(x, y, s, c);
    if (s >= 2) { disc(x + lean, y - s, Math.max(0, s - 2), c); px(x + lean, y - s - Math.max(1, s - 1), c); }
    else px(x + lean, y - 2, c);
    if (s >= 2) disc(x, y + 1, s - 2, hot);
  }
  function flameAir(t, o) {
    if (t < 0 || t > o.life + 0.6) return;
    const EMIT = 64, LIFE = 0.52, tq = q60(t), fr12 = Math.floor(t * ANIM_FPS);
    const k0 = Math.max(0, Math.ceil((tq - LIFE) * EMIT)), k1 = Math.floor(Math.min(tq, o.life) * EMIT);
    const groundY = o.y - 4;
    for (let k = k0; k <= k1; k++) {
      const a = tq - k / EMIT; if (a < 0 || a > LIFE) continue;
      const f = a / LIFE, u = hash(k, 1) * 2 - 1, v = hash(k, 2);
      const th = o.ang + o.arc * u * 0.95;
      const d = o.R * (0.9 + 0.16 * v) * easeOut(f);
      const x = o.gx + Math.cos(th) * d, y = o.gy + Math.sin(th) * d * 0.85 + (groundY - o.gy) * f - 6 * f * f;
      let s = f < 0.1 ? 1 : Math.round(1 + 3.2 * Math.sin(Math.min(1, f * 1.15) * Math.PI * 0.85));
      if (hash(k, fr12) > 0.72) s += 1;
      const ci = Math.floor(f * 7);
      if (ci >= 6) { disc(x, y, s - 1, P.sm0); px(x, y - s, P.sm0); continue; }
      flamePuff(x, y, s, ci, (Math.floor(hash(k, fr12 + 7) * 3) - 1));
    }
    if (t <= o.life) {                                              // 杖先の噴き出し口
      const big = (fr12 & 1) === 0;
      plus(o.gx, o.gy, P.fi1, big ? 2 : 1); px(o.gx, o.gy, P.fi0);
      if (big) { px(o.gx + Math.cos(o.ang) * 3, o.gy, P.fi0); }
    }
  }

  /* ============================================================
     アイシクルエッジ（杖 lv2）：直線を 0.2 秒刻みで 3 回貫く氷
     ============================================================ */
  const ICE_PASSES = [0, 0.2, 0.4], ICE_TRAVEL = 0.16;
  const passTime = (tp, s, L) => tp + ICE_TRAVEL * (1 - Math.sqrt(Math.max(0, 1 - s / L)));
  function iceGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.65, 'frost', 1, o.charge || 0);
    const L = o.R, ux = Math.cos(o.ang), uy = Math.sin(o.ang);
    // 床の照り返し（通った線に沿って）
    const any = ICE_PASSES.some(tp => t >= tp && t < tp + 0.5);
    if (any) lightPool(o.x + ux * L * 0.5, o.y + uy * L * 0.5, L * 0.5, 0.3, 'frost');
    // 霜の跡
    ICE_PASSES.forEach((tp, i) => {
      for (let s = 4; s < L; s += 3) {
        const a = t - passTime(tp, s, L); if (a < 0 || a > 0.9) continue;
        const j = (hash(i * 97 + s, 81) * 2 - 1) * 4, x = o.x + ux * s - uy * j, y = o.y + uy * s + ux * j;
        px(x, y, a < 0.2 ? P.fr1 : a < 0.5 ? P.fr3 : P.fr4, 1 - a / 0.9);
      }
    });
  }
  function iceSpike(x, y, h, w, grow, c1, c2) {
    const hh = Math.max(1, Math.round(h * grow));
    for (let r = 0; r < hh; r++) {
      const hw = Math.round((1 - r / hh) * w);
      for (let dx = -hw; dx <= hw; dx++) px(x + dx, y - r, dx < 0 ? c1 : dx > 0 ? c2 : P.fr0);
    }
    px(x, y - hh, P.W);
    hline(x - w - 1, x + w + 1, y + 1, P.fr4, 0.7);
  }
  function iceAir(t, o) {
    const L = o.R, ux = Math.cos(o.ang), uy = Math.sin(o.ang), nx = -uy, ny = ux;
    ICE_PASSES.forEach((tp, i) => {
      const a = t - tp, big = i === 2;
      // 地面から生える氷（通った順に）
      const n = 7;
      for (let j = 0; j < n; j++) {
        const s = L * (j + 1) / (n + 0.4), as = t - passTime(tp, s, L) - 0.01; if (as < 0) continue;
        const side = ((j + i) & 1) ? 1 : -1, off = side * (2 + Math.floor(hash(j + i * 13, 91) * 3));
        const bx = Math.round(o.x + ux * s + nx * off), by = Math.round(o.y + uy * s + ny * off);
        const hmax = (8 + hash(j + i * 13, 92) * 6) * (big ? 1.35 : 1), w = big ? 3 : 2;
        if (as < 0.3) {
          const grow = as < 1 / ANIM_FPS ? 0.45 : 1;                           // 2コマで伸びきる
          iceSpike(bx, by, hmax, w, grow, P.fr1, P.fr3);
          iceSpike(bx - w - 1, by + 1, hmax * 0.5, 1, grow, P.fr1, P.fr3);          // 脇の小さな結晶
          if (big) iceSpike(bx + w + 1, by + 1, hmax * 0.42, 1, grow, P.fr1, P.fr3);
        } else if (as < 0.7) {                                               // 砕けて落ちる
          const b = as - 0.3;
          for (let k = 0; k < 5; k++) {
            const va = hash(k + j * 5 + i * 50, 93) * Math.PI - Math.PI, sp = 20 + hash(k + j * 5, 94) * 25, vz = 30 + hash(k, 95) * 40;
            const z = Math.max(0, hmax * 0.5 + vz * b - 0.5 * 220 * b * b);
            px(bx + Math.cos(va) * sp * b, by - z + Math.sin(va) * sp * b * 0.3, rampAt(RAMP.frost, 0.2 + b / 0.4 * 0.8));
          }
          disc(bx, by - 2, 2 + b * 8, P.fr1, 0.45 * (1 - b / 0.4));
        }
      }
      // 氷の槍
      if (a >= 0 && a <= ICE_TRAVEL + 0.03) {
        const p = clamp(a / ICE_TRAVEL), d = L * easeOut(p), len = Math.min(d, (big ? 16 : 12) + i);
        const tipx = o.x + ux * d, tipy = o.y - 5 + uy * d;
        for (let j = 0; j <= len; j++) {
          const x = tipx - ux * j, y = tipy - uy * j, f = j / Math.max(1, len);
          const c = j < 2 ? P.W : f < 0.5 ? P.fr0 : P.fr1, sc = f < 0.55 ? P.fr2 : P.fr3;
          px(x, y, c);
          if (j >= 2 && f < 0.9) { px(x + nx, y + ny, sc); px(x - nx, y - ny, sc); }
          if (j >= 3 && f < 0.7) { px(x + nx * 2, y + ny * 2, P.fr4); px(x - nx * 2, y - ny * 2, P.fr4); }
        }
        // 槍の後ろの光の粒
        for (let k = 0; k < 6; k++) {
          const s = d - len - 2 - hash(k + i * 9, 96) * 16; if (s < 0) continue;
          px(o.x + ux * s + nx * (hash(k, 97) * 6 - 3), o.y - 5 + uy * s + ny * (hash(k, 98) * 6 - 3), (Math.floor(t * 24) + k) & 1 ? P.fr0 : P.fr2);
        }
      }
      // 3回目：線の先で砕ける
      if (big && a >= ICE_TRAVEL && a < ICE_TRAVEL + 0.35) {
        const b = a - ICE_TRAVEL, ex = o.x + ux * L, ey = o.y - 5 + uy * L;
        if (b < 0.05) { plus(ex, ey, P.W, 3); disc(ex, ey, 2, P.fr0); }
        ring(ex, ey, 2 + b * 34, b < 0.1 ? P.fr0 : P.fr2, 1 - b / 0.35);
        for (let k = 0; k < 10; k++) {
          const va = k * TAU / 10 + hash(k, 99), sp = 40 + hash(k, 100) * 40;
          px(ex + Math.cos(va) * sp * b, ey + Math.sin(va) * sp * b * 0.7 + 60 * b * b, rampAt(RAMP.frost, b / 0.35));
        }
      }
    });
  }

  /* ============================================================
     ライトニング（杖 lv3）：周囲に 3 秒、0.4 秒ごとに雷が落ちる
     ============================================================ */
  function boltStrikes(o) {                    // [時刻, x, y, 大きいか, 狙った敵の番号]
    const out = [[0.02, o.x, o.y, 2, -1]];      // 最初の一本は術者（杖）へ落ちる
    const tgt = o.targets || [];
    for (let k = 1; k * 0.4 <= o.life + 0.001; k++) {
      let x, y, e = -1;
      if (tgt.length && (k % 3 !== 0)) { e = (k * 2) % tgt.length; x = tgt[e][0]; y = tgt[e][1]; }
      else { const a = hash(k, 111) * TAU, r = Math.sqrt(hash(k, 112)) * o.R * 0.85; x = o.x + Math.cos(a) * r; y = o.y + Math.sin(a) * r; }
      out.push([k * 0.4 - 0.02, x, y, 1, e]);
      const a2 = hash(k, 113) * TAU, r2 = Math.sqrt(hash(k, 114)) * o.R * 0.8;
      if (k * 0.4 + 0.2 <= o.life) out.push([k * 0.4 + 0.18, o.x + Math.cos(a2) * r2, o.y + Math.sin(a2) * r2, 0, -1]);
    }
    return out;
  }
  function boltGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.75, 'shock', 1.1, o.charge || 0);
    if (t < 0 || t > o.life + 0.9) return;
    // 範囲の輪（回る破線）
    const fin = t > o.life ? 1 - (t - o.life) / 0.25 : 1, fin0 = clamp(t / 0.1);
    const strikes = o._strikes || (o._strikes = boltStrikes(o));
    let flash = false;
    for (const s of strikes) if (s[3] && t - s[0] >= 0 && t - s[0] < 0.07) flash = true;
    if (fin > 0) ring(o.x, o.y, o.R, flash ? P.sh1 : P.sh3, fin * fin0, 32, q12(t) * 1.4);
    if (fin > 0 && flash) ring(o.x, o.y, o.R - 1, P.sh2, 0.5 * fin, 32, q12(t) * 1.4 + 0.5);
    // 輪の中のぱちぱち
    if (t <= o.life) {
      const fr = Math.floor(t * ANIM_FPS);
      for (let i = 0; i < 6; i++) {
        const a = hash(i + fr * 7, 121) * TAU, r = Math.sqrt(hash(i + fr * 7, 122)) * o.R;
        px(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r, i & 1 ? P.sh2 : P.sh3);
      }
    }
    for (const [t0, x, y, big] of strikes) {
      const b = t - t0;
      if (b >= -0.08 && b < 0) {                                           // 予兆
        if ((Math.floor(t * 24) & 1) === 0) { px(x, y, P.sh1); px(x - 2, y, P.sh3); px(x + 2, y, P.sh3); px(x, y - 2, P.sh3); px(x, y + 2, P.sh3); }
      }
      if (b < 0 || b > 0.9) continue;
      if (big && b < 0.1) lightPool(x, y, big === 2 ? 26 : 20, b < 0.05 ? 0.95 : 0.5, 'shock');
      // 焦げ跡の星
      const rays = big ? 5 : 3, lv = b < 0.4 ? 1 : 1 - (b - 0.4) / 0.5;
      for (let r = 0; r < rays; r++) {
        const a = r * TAU / rays + hash(Math.round(t0 * 100), 131), Lr = (big ? 4 : 2) + hash(r, Math.round(t0 * 100)) * 3;
        line(x, y, x + Math.cos(a) * Lr, y + Math.sin(a) * Lr * 0.7, b < 0.12 ? P.sh2 : P.sh4, lv);
      }
      px(x, y, b < 0.15 ? P.sh1 : P.sh4, lv);
    }
  }
  function boltPath(x, y, topY, seed, phase, cb) {
    const H = y - topY, n = Math.max(3, Math.ceil(H / 8));
    let px0 = x + (hash(seed, 140 + phase) * 2 - 1) * 3, py0 = topY;
    for (let i = 1; i <= n; i++) {
      const yi = topY + H * i / n, xi = i === n ? x : x + (hash(seed * 31 + i, 141 + phase) * 2 - 1) * 4.5;
      cb(px0, py0, xi, yi, i, n); px0 = xi; py0 = yi;
    }
  }
  function boltAir(t, o) {
    if (t < 0 || t > o.life + 0.9) return;
    const strikes = o._strikes || (o._strikes = boltStrikes(o));
    const topY = o.skyY;
    for (const [t0, x, yGround, big] of strikes) {
      const b = t - t0; if (b < 0 || b > 0.4) continue;
      const seed = Math.round(t0 * 1000), phase = Math.floor(b * 24) & 1;
      const y = big === 2 && o.gy != null ? o.gy : yGround;          // 最初の一本は杖の宝石に落ちる
      const X = big === 2 && o.gx != null ? o.gx : x;
      if (b < 0.16) {
        const core = b < 0.05 ? P.W : b < 0.1 ? P.sh0 : P.sh1, lvC = b < 0.1 ? 1 : 0.6;
        if (big && b < 0.1) {
          boltPath(X, y, topY, seed, phase, (a, c, d, e) => { line(a - 1, c, d - 1, e, P.sh1); line(a + 1, c, d + 1, e, P.sh1); });
          boltPath(X, y, topY, seed, phase, (a, c, d, e) => { line(a - 2, c, d - 2, e, P.sh3, 0.4); line(a + 2, c, d + 2, e, P.sh3, 0.4); });
        }
        boltPath(X, y, topY, seed, phase, (a, c, d, e, i, n) => {
          line(a, c, d, e, core, lvC);
          if (big && b < 0.1 && (i === Math.floor(n * 0.4) || i === Math.floor(n * 0.7))) {   // 枝分かれ
            const sgn = hash(seed + i, 150) > 0.5 ? 1 : -1;
            let bx = d, by = e;
            for (let s = 0; s < 3; s++) { const nx = bx + sgn * (3 + hash(seed + i * 5 + s, 151) * 3), ny = by + 4 + hash(seed + s, 152) * 3; line(bx, by, nx, ny, P.sh1); bx = nx; by = ny; }
          }
        });
      }
      // 着弾
      if (b < 0.06) { plus(X, y, P.W, big ? 3 : 1); disc(X, y, big ? 1 : 0, P.W); }
      if (big && b < 0.22) ring(X, y, 2 + b * 28, b < 0.08 ? P.sh0 : P.sh3, 1 - b / 0.22);
      if (big && b < 0.35) for (let k = 0; k < 8; k++) {
        const va = k * TAU / 8 + hash(seed + k, 160), sp = 45 + hash(seed + k, 161) * 40;
        px(X + Math.cos(va) * sp * b, y + Math.sin(va) * sp * b * 0.7 - 20 * b + 90 * b * b, rampAt(RAMP.shock, b / 0.35));
      }
    }
    // 敵から敵へ走る小さな弧
    const tg = o.targets || [];
    for (const [t0, x, y, big, e] of strikes) {
      const b = t - t0; if (!big || e < 0 || b < 0.03 || b > 0.13 || tg.length < 2) continue;
      const other = tg[(e + 1) % tg.length], mx = (x + other[0]) / 2, my = (y + other[1]) / 2 - 6;
      const ph = Math.floor(t * 24) & 1, j1 = (hash(Math.round(t0 * 100), 170 + ph) * 2 - 1) * 5, j2 = (hash(Math.round(t0 * 100), 172 + ph) * 2 - 1) * 5;
      line(x, y - 5, (x + mx) / 2, (y + my) / 2 - 5 + j1, P.sh0); line((x + mx) / 2, (y + my) / 2 - 5 + j1, mx, my - 5, P.sh1);
      line(mx, my - 5, (mx + other[0]) / 2, (my + other[1]) / 2 - 5 + j2, P.sh1); line((mx + other[0]) / 2, (my + other[1]) / 2 - 5 + j2, other[0], other[1] - 5, P.sh0);
    }
  }


  /* ============================================================
     剣・大剣・短剣
     o = {x,y: 足元, ang: 向き, R: 届く距離(ドット), life, tx,ty: 狙い(あれば), orbitA}
     体の中心は足元から 6 ドット上。
     ============================================================ */
  const body = o => [o.x, o.y - 6];
  const dirv = o => [Math.cos(o.ang), Math.sin(o.ang)];

  /* ---------- 剣 lv1 居合：踏み込み、通り道に一本の光 ---------- */
  function iaiGround(t, o) {
    const [ux, uy] = dirv(o), L = o.R, ex = o.x + ux * L, ey = o.y + uy * L;
    dust(o.x, o.y, t, 6, 11, 9, 0.45);
    dust(ex, ey, t - 0.07, 4, 12, 7, 0.4);
    if (t >= 0 && t < 0.5) lightPool(o.x + ux * L * 0.5, o.y + uy * L * 0.5, L * 0.5, 0.3 * (1 - t / 0.5), 'steel');
  }
  function iaiAir(t, o) {
    const [ux, uy] = dirv(o), L = o.R, [bx, by] = body(o), ex = bx + ux * L, ey = by + uy * L, nx = -uy, ny = ux;
    speedLines(bx, by, ex, ey, t, 0.16, 7, 13);
    // 通り道の一閃：細い線 → 太る → ちぎれて消える
    if (t >= 0.05 && t < 0.42) {
      const b = q24(t - 0.05), thick = b < 0.05 ? 0 : b < 0.12 ? 1 : 0, erode = b < 0.12 ? 0 : (b - 0.12) / 0.25;
      for (let s = 0; s <= L; s++) {
        if (erode > 0 && hash(Math.floor(s / 5), 14) < erode * 1.1) continue;
        const x = bx + ux * s, y = by + uy * s;
        px(x, y, s > L - 3 ? P.ac0 : P.W);
        if (thick) { px(x + nx, y + ny, P.fr0); px(x - nx, y - ny, P.fl0); }
      }
      // 線から横へはじける粒
      if (b >= 0.1) for (let i = 0; i < 6; i++) {
        const s = L * (0.15 + 0.7 * hash(i, 15)), sd = hash(i, 16) > 0.5 ? 1 : -1, bb = b - 0.1;
        px(bx + ux * s + nx * sd * (2 + bb * 60), by + uy * s + ny * sd * (2 + bb * 60) + bb * bb * 80, rampAt(RAMP.steel, bb / 0.3));
      }
    }
    // 抜けた先の三日月
    slash(ex, ey, 13, o.ang - 1.25, o.ang + 1.05, 4, 0.78, STEEL, t - 0.07, 0.17, 17);
  }

  /* ---------- 剣 lv2 回転斬り：一周する三日月 ---------- */
  function swspinGround(t, o) {
    groundRing(o.x, o.y, t - 0.08, o.R, 0.34, RAMP.dust, 0.5);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.3; dust(o.x + Math.cos(a) * o.R * 0.75, o.y + Math.sin(a) * o.R * 0.4, t - 0.1 - i * 0.02, 1, 20 + i, 4, 0.35); }
  }
  function swspinAir(t, o) {
    const [bx, by] = body(o);
    slash(bx, by, o.R * 0.8, o.ang + 0.6, o.ang + 0.6 - TAU * 1.02, 4, 0.78, STEEL, t, 0.3, 21);
  }

  /* ---------- 剣 lv3 多段斬り：向きを変えて3回 ---------- */
  const MULTI = [0, 0.16, 0.32];
  function swmultiGround(t, o) { MULTI.forEach((d, i) => { const [ux, uy] = dirv(o); dust(o.x + ux * 4, o.y + uy * 4, t - d, 2, 30 + i, 5, 0.3); }); }
  function swmultiAir(t, o) {
    const [bx, by] = body(o), [ux, uy] = dirv(o), r = o.R * 0.75;
    const arcs = [[-1.0, 0.95, 4], [1.0, -0.95, 4], [-1.25, 1.2, 6]];
    MULTI.forEach((d, i) => slash(bx + ux * (2 + i * 2), by + uy * (2 + i * 2), r + i * 2, o.ang + arcs[i][0], o.ang + arcs[i][1], arcs[i][2], 0.78, STEEL, t - d, 0.19, 31 + i));
  }

  /* ---------- 大剣 lv1 大回転斬り：太い輪を2回、床を擦る ---------- */
  const GTSPIN = [0, 0.22];
  function gtspinGround(t, o) {
    GTSPIN.forEach((d, i) => {
      groundRing(o.x, o.y, t - d - 0.06, o.R * 1.05, 0.36, RAMP.dust, 0.5);
      for (let k = 0; k < 10; k++) {               // 床を擦った跡の小石
        const a = k * TAU / 10 + i, b = t - d - 0.05 - k * 0.012; if (b < 0 || b > 0.45) continue;
        const r = o.R * 0.8 + b * 30;
        px(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.5 - Math.max(0, 6 * Math.sin(b / 0.45 * Math.PI)), (k & 1) ? P.du0 : P.du1);
      }
    });
    if (t >= 0 && t < 0.6) lightPool(o.x, o.y, o.R, 0.3 * (1 - t / 0.6), 'steel');
  }
  function gtspinAir(t, o) {
    const [bx, by] = body(o), cols = [P.W, P.fr1, P.fl0];
    slash(bx, by, o.R * 0.82, o.ang + 0.4, o.ang + 0.4 - TAU * 1.02, 8, 0.78, cols, t, 0.32, 41);
    slash(bx, by, o.R * 0.74, o.ang + 1.2, o.ang + 1.2 - TAU * 1.02, 7, 0.78, cols, t - 0.22, 0.32, 42);
  }

  /* ---------- 大剣 lv2 地走り：扇に走る岩の波 ---------- */
  const QUAKE_T = 0.44;
  function quakeFront(t) { return t < 0.06 ? -1 : easeOut(clamp((t - 0.06) / QUAKE_T)); }
  function gtquakeGround(t, o) {
    const [ux, uy] = dirv(o), half = 35 * Math.PI / 180, p = quakeFront(t);
    // 叩きつけた所
    cracks(o.x + ux * 8, o.y + uy * 8, t - 0.05, 6, 9, 50, 0.08, 1.0);
    dust(o.x + ux * 8, o.y + uy * 8, t - 0.05, 5, 51, 9, 0.45);
    if (p < 0) return;
    const d = o.R * p;
    // 走った跡のひび（中央の線）
    for (let s = 12; s < d; s += 2) {
      const b = t - (0.06 + QUAKE_T * (1 - Math.sqrt(Math.max(0, 1 - s / o.R)))); if (b > 0.9) continue;
      const j = (hash(s, 52) * 2 - 1) * 2;
      px(o.x + ux * s - uy * j, o.y + uy * s + ux * j, b < 0.15 ? P.du0 : P.st3, b < 0.6 ? 1 : 1 - (b - 0.6) / 0.3);
    }
    // 前線の土煙
    if (t < 0.06 + QUAKE_T + 0.2) for (let k = -3; k <= 3; k++) {
      const a = o.ang + k / 3 * half, x = o.x + Math.cos(a) * d, y = o.y + Math.sin(a) * d * 0.9;
      dust(x, y, (t * 7 + k * 0.13) % 0.35, 1, 53 + k + Math.floor(t * 7) * 11, 4, 0.35);
    }
  }
  function rockSpike(x, y, h, w) {
    h = Math.round(h); if (h <= 0) return;
    for (let r = 0; r < h; r++) {
      const hw = Math.max(0, Math.round((1 - r / h) * w));
      for (let dx = -hw; dx <= hw; dx++) px(x + dx, y - r, dx < 0 ? (r > h * 0.4 ? P.st0 : P.st1) : dx > 0 ? P.st3 : P.st2);
    }
    px(x, y - h, P.st0); px(x - 1, y - h + 1, P.du0); hline(x - w - 1, x + w + 1, y + 1, P.st4, 0.6);
  }
  function gtquakeAir(t, o) {
    const [bx, by] = body(o), [ux, uy] = dirv(o), half = 35 * Math.PI / 180, p = quakeFront(t);
    // 振り下ろし（上から前へ）
    slash(bx, by, 14, -Math.PI / 2 - 0.4 * Math.sign(ux || 1), o.ang + 0.3, 6, 0.78, [P.W, P.fr1, P.fl0], t + 0.02, 0.14, 55);
    if (p < 0) return;
    // 岩の刺：前線に並び、通り過ぎたら崩れて沈む
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      const s = o.R * (row + 1) / rows, ts = 0.06 + QUAKE_T * (1 - Math.sqrt(Math.max(0, 1 - s / o.R))), b = t - ts;
      if (b < 0 || b > 0.42) continue;
      const n = 3 + row;
      for (let k = 0; k < n; k++) {
        const a = o.ang + (k / (n - 1) * 2 - 1) * half * 0.95, x = Math.round(o.x + Math.cos(a) * s), y = Math.round(o.y + Math.sin(a) * s * 0.9);
        const hmax = 4 + hash(row * 9 + k, 56) * 3 + row * 0.6, grow = b < 1 / 12 ? 0.5 : b < 0.2 ? 1 : 1 - (b - 0.2) / 0.2;
        if (grow > 0) rockSpike(x, y, hmax * grow, 3);
        if (b > 0.2 && b < 0.35) for (let q = 0; q < 3; q++) { const bb = b - 0.3; px(x + (q - 1) * 3 * (1 + bb * 10), y - hmax * 0.6 - 30 * bb + 200 * bb * bb, P.st1); }
      }
    }
  }

  /* ---------- 大剣 lv3 レイジングアッパー：下から斬り上げ、光の柱で打ち上げる ---------- */
  function upperTarget(o) { const [ux, uy] = dirv(o); return o.tx != null ? [o.tx, o.ty] : [o.x + ux * o.R * 0.62, o.y + uy * o.R * 0.62]; }
  function gtupperGround(t, o) {
    const [tx, ty] = upperTarget(o);
    groundRing(tx, ty, t - 0.12, 20, 0.3, RAMP.steel, 0.45);
    cracks(tx, ty, t - 0.12, 7, 12, 60, 0.12, 1.0);
    dust(tx, ty, t - 0.12, 7, 61, 12, 0.5);
    if (t >= 0.1 && t < 0.5) lightPool(tx, ty, 26, t < 0.2 ? 0.8 : 0.4, 'steel');
  }
  function gtupperAir(t, o) {
    const [bx, by] = body(o), [ux] = dirv(o), sg = ux >= 0 ? 1 : -1, [tx, ty] = upperTarget(o);
    // 斬り上げ（下 → 前 → 上）
    slash(bx + sg * 8, by, 17, Math.PI / 2 + sg * 0.3, -Math.PI / 2 - sg * 0.3, 7, 0.9, [P.W, P.fr1, P.fl0], t, 0.2, 62);
    // 光の柱
    const b = t - 0.12;
    if (b >= 0 && b < 0.42) {
      const hgt = 56 * easeOut(clamp(b / 0.1)), w = b < 0.2 ? 3 : b < 0.3 ? 2 : 1, top = ty - 2 - hgt;
      for (let y = Math.round(ty - 2); y > top; y--) {
        const f = (ty - y) / 56;
        if (b > 0.2 && hash(Math.floor(y / 3), 63 + Math.floor(b * 24)) < (b - 0.2) * 3) continue;
        const ww = f > 0.85 ? w - 2 : f > 0.7 ? w - 1 : w;             // 上へ行くほど細く
        for (let dx = -ww; dx <= ww; dx++) px(tx + dx, y, Math.abs(dx) === ww && ww > 0 ? P.fl0 : Math.abs(dx) === ww - 1 ? P.fr0 : P.W);
      }
      for (let i = 0; i < 10; i++) {                    // 柱に沿って跳ね上がる破片
        const bb = b - hash(i, 64) * 0.08; if (bb < 0) continue;
        px(tx + (hash(i, 65) * 2 - 1) * (4 + bb * 30), ty - 4 - bb * (90 + hash(i, 66) * 60) + bb * bb * 120, rampAt(RAMP.steel, bb / 0.42));
      }
    }
    spark(tx, ty - 8, b, RAMP.steel, 67, 9, 1.4);
  }

  /* ---------- 短剣 lv1 乱斬り：細い斬り跡が交差する3回 ---------- */
  const DGS = [0, 0.12, 0.24];
  function dgslashGround(t, o) { const [ux, uy] = dirv(o); dust(o.x + ux * 3, o.y + uy * 3, t, 3, 70, 5, 0.3); }
  function dgslashAir(t, o) {
    const [bx, by] = body(o), [ux, uy] = dirv(o), cx = bx + ux * 13, cy = by + uy * 13;
    const arcs = [[-2.3, 0.3], [2.3, -0.3], [-Math.PI / 2 - 0.2, Math.PI / 2 + 0.2]];
    DGS.forEach((d, i) => {
      slash(cx, cy, 15, o.ang + arcs[i][0], o.ang + arcs[i][1], 3, 0.8, [P.W, P.fr0, P.fl0], t - d, 0.14, 71 + i);
      const b = t - d - 0.05; if (b >= 0 && b < 0.08) { plus(cx + (i - 1) * 3, cy + (i === 1 ? -2 : 2), P.W, b < 0.04 ? 2 : 1); }   // 交差点の光
    });
    // 刃先のきらめき
    if (t >= 0 && t < 0.4) for (let i = 0; i < 4; i++) {
      const fr = Math.floor(t * 24) + i * 5; if ((fr % 4) !== 0) continue;
      const a = o.ang + (hash(fr, 72) * 2 - 1) * 1.0, r = 6 + hash(fr, 73) * o.R * 0.6;
      plus(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.8, P.W, 1);
    }
  }

  /* ---------- 短剣 lv2 ダンシングソード：周りを回る一本の刃（当たり判定と同じ角度） ---------- */
  const DANCE_W = 4.5;                          // tickArts の f.a += dt*4.5 と同じ
  function danceAngle(t, o) { return o.orbitA != null ? o.orbitA : t * DANCE_W; }
  function dgdanceGround(t, o) {
    const fade = t > o.life ? 1 - (t - o.life) / 0.3 : clamp(t / 0.15);
    if (fade <= 0) return;
    ellRing(o.x, o.y - 2, o.R, o.R * 0.62, P.fl2, 0.5 * fade, 24, q12(t) * 2);
  }
  function dgdanceAir(t, o) {
    const fade = t > o.life ? 1 - (t - o.life) / 0.3 : 1; if (fade <= 0 || t < 0) return;
    const [bx, by] = body(o), a = danceAngle(t, o), R = o.R, fl = 0.62;
    // 残像の弧と、少し遅れて付いてくる2つの影
    smear(bx, by + 2, R, a, -1.0, 3, fl, [P.W, P.fr0, P.fl0], 0, 81, fade);
    for (let k = 1; k <= 2; k++) {
      const ak = a - k * 0.32;
      drawDagger(bx + Math.cos(ak) * R, by + 2 + Math.sin(ak) * R * fl, ak + Math.PI / 2, fade * (k === 1 ? 0.55 : 0.3));
    }
    const x = bx + Math.cos(a) * R, y = by + 2 + Math.sin(a) * R * fl;
    drawDagger(x, y, a + Math.PI / 2, fade);
    if ((Math.floor(t * 12) & 3) === 0) plus(x, y, P.W, 1, fade);
  }

  /* ---------- 短剣 lv3 ミラージュ：鏡のかけらが回り、姿が揺らぐ ---------- */
  function dgmirageGround(t, o) {
    if (t < 0 || t > o.life + 0.2) return;
    const fade = t > o.life ? 1 - (t - o.life) / 0.2 : 1;
    ellRing(o.x, o.y + 1, 8, 3, (Math.floor(t * 12) & 1) ? P.fl0 : P.fl1, 0.7 * fade, 12, q12(t) * 3);
    groundRing(o.x, o.y, t, 22, 0.3, RAMP.steel, 0.45);
  }
  function dgmirageAir(t, o) {
    if (t < 0 || t > o.life + 0.2) return;
    const fade = t > o.life ? 1 - (t - o.life) / 0.2 : 1, [bx, by] = body(o), tq = q12(t);
    // 鏡のかけら（4つ）が体の周りを回る
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + tq * 3, r = 11 + ((i & 1) ? 1 : -1) * Math.round(Math.sin(tq * 6 + i)), x = Math.round(bx + Math.cos(a) * r), y = Math.round(by + Math.sin(a) * r * 0.55);
      const back = Math.sin(a) < 0; if (back && (Math.floor(t * 12) & 1)) continue;
      px(x, y - 2, P.W, fade); px(x - 1, y - 1, P.W, fade); px(x, y - 1, P.fr0, fade); px(x + 1, y - 1, P.fl0, fade);
      px(x - 2, y, P.fr0, fade); px(x - 1, y, P.fr0, fade); px(x, y, P.fl0, fade); px(x + 1, y, P.fl0, fade); px(x + 2, y, P.fl1, fade);
      px(x - 1, y + 1, P.fl0, fade); px(x, y + 1, P.fl1, fade); px(x + 1, y + 1, P.fl1, fade); px(x, y + 2, P.fl2, fade);
    }
    if (t < 0.12) { plus(bx, by, P.W, 4); disc(bx, by, 2, P.fr0); }
  }

  /* ============================================================
     斧・槍・弓・戦鎚
     ============================================================ */
  const AXE = [P.W, P.wd0, P.fl0];

  /* ---------- 斧 lv1 トマホーク：回る斧が線を貫いて飛ぶ ---------- */
  const TOMA_T = 0.42;
  function axeFlight(o, t, T, L, oy = 0) {
    const [ux, uy] = dirv(o), [bx, by] = body(o), p = clamp(t / T), d = L * easeOut(p);
    return [bx + ux * d - uy * oy, by + uy * d + ux * oy, p];
  }
  function axtomaGround(t, o) { const [ux, uy] = dirv(o); dust(o.x + ux * 3, o.y + uy * 3, t, 3, 90, 5, 0.3); }
  function axtomaAir(t, o) {
    if (t < 0 || t > TOMA_T + 0.2) return;
    const [x, y, p] = axeFlight(o, t, TOMA_T, o.R), fade = t > TOMA_T ? 1 - (t - TOMA_T) / 0.2 : 1, spin = Math.floor(t * 24) * (Math.PI / 4);
    // 通った跡の粒
    for (let k = 1; k <= 5; k++) {
      const tk = t - k * 0.03; if (tk < 0) break;
      const [xk, yk] = axeFlight(o, tk, TOMA_T, o.R);
      px(xk, yk + ((k & 1) ? 2 : -2), k < 3 ? P.wd0 : P.wd1, fade * (1 - k / 6));
    }
    smear(x, y, 7, spin, 3.2, 2, 1, AXE, 0, 91, fade);            // 斧の周りの回転の跡
    drawAxe(x, y, spin, fade);
  }

  /* ---------- 斧 lv2 スピンアクス：重い輪、木くずと火花 ---------- */
  function axspinGround(t, o) {
    groundRing(o.x, o.y, t - 0.08, o.R, 0.36, RAMP.dust, 0.5);
    cracks(o.x, o.y, t - 0.05, 5, 8, 92, 0.08, 0.7, P.wd0, P.wd1);
  }
  function axspinAir(t, o) {
    const [bx, by] = body(o);
    slash(bx, by, o.R * 0.78, o.ang - 0.3, o.ang - 0.3 + TAU * 1.02, 7, 0.78, AXE, t, 0.3, 93);
    for (let i = 0; i < 10; i++) {                                    // 木くず
      const b = t - 0.08 - hash(i, 94) * 0.1; if (b < 0 || b > 0.4) continue;
      const a = hash(i, 95) * TAU, r = o.R * 0.75 + b * 50;
      px(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.6 + b * b * 90, (i & 1) ? P.wd0 : P.wd1);
    }
  }

  /* ---------- 斧 lv3 スパイラルホーク：小さな斧を3つ投げる ---------- */
  const SPIRAL = [0, 0.18, 0.36], SPIRAL_T = 0.3;
  function axspiralGround(t, o) { SPIRAL.forEach((d, i) => { const [ux, uy] = dirv(o); dust(o.x + ux * 3, o.y + uy * 3, t - d, 2, 96 + i, 4, 0.25); }); }
  function axspiralAir(t, o) {
    SPIRAL.forEach((d, i) => {
      const a = t - d; if (a < 0 || a > SPIRAL_T + 0.12) return;
      const oy = (i - 1) * 4, [x, y] = axeFlight(o, a, SPIRAL_T, o.R, oy), fade = a > SPIRAL_T ? 1 - (a - SPIRAL_T) / 0.12 : 1, spin = Math.floor(a * 24) * (Math.PI / 4) * (i === 1 ? -1 : 1);
      for (let k = 1; k <= 3; k++) { const tk = a - k * 0.03; if (tk < 0) break; const [xk, yk] = axeFlight(o, tk, SPIRAL_T, o.R, oy); px(xk, yk, P.wd1, fade * 0.7); }
      smear(x, y, 5, spin, 3 * (i === 1 ? -1 : 1), 2, 1, AXE, 0, 97 + i, fade);
      drawAxe(x, y, spin, fade);
      if (a > SPIRAL_T - 0.02 && a < SPIRAL_T + 0.08) spark(x, y, a - SPIRAL_T + 0.02, RAMP.wood, 98 + i, 5, 0.8);
    });
  }

  /* ---------- 槍 lv1 スウィング：穂先で輪を2度払う（細い弧＋柄） ---------- */
  const SWING = [0, 0.2];
  function spswingGround(t, o) { SWING.forEach((d, i) => groundRing(o.x, o.y, t - d - 0.08, o.R * 0.9, 0.24, RAMP.dust, 0.5)); }
  function spswingAir(t, o) {
    const [bx, by] = body(o), R = o.R * 0.9;
    SWING.forEach((d, i) => {
      const a = t - d, dur = 0.24; if (a < 0 || a > dur) return;
      const sg = i ? -1 : 1, a0 = o.ang + 0.5 * sg, a1 = a0 - sg * TAU * 1.02;
      slash(bx, by, R, a0, a1, 2, 0.78, [P.W, P.fr0, P.fl0], a, dur, 100 + i);
      const p = q24(a) / dur; if (p > 0.5) return;                  // 回っている間だけ柄を見せる
      const lead = a0 + (a1 - a0) * easeOut(p / 0.45), lx = bx + Math.cos(lead) * R, ly = by + Math.sin(lead) * R * 0.78;
      line(bx + Math.cos(lead) * 4, by + Math.sin(lead) * 3, lx, ly, P.wd1);
      plus(lx, ly, P.W, 1);
    });
  }

  /* ---------- 槍 lv2 ショットランス：一瞬で伸びる針と、根元の音の輪 ---------- */
  function splanceGround(t, o) { const [ux, uy] = dirv(o); dust(o.x - ux * 3, o.y - uy * 3, t, 4, 110, 6, 0.35); }
  function splanceAir(t, o) {
    if (t < 0 || t > 0.45) return;
    const [bx, by] = body(o), [ux, uy] = dirv(o), nx = -uy, ny = ux, L = o.R;
    const ext = L * easeOut(clamp(q24(t) / 0.1)), cut = t < 0.14 ? 0 : clamp((t - 0.14) / 0.24) * L;
    for (let s = Math.round(cut); s <= ext; s++) {
      const x = bx + ux * s, y = by + uy * s, f = s / L;
      px(x, y, P.W);
      if (f < 0.75 && t < 0.2) { px(x + nx, y + ny, P.fr0); px(x - nx, y - ny, P.fl0); }
    }
    if (ext > cut) { const x = bx + ux * ext, y = by + uy * ext; plus(x, y, P.W, t < 0.12 ? 2 : 1); px(x + ux * 3, y + uy * 3, P.fr0); }
    speedLines(bx, by + 3, bx + ux * L, by + uy * L + 3, t - 0.02, 0.16, 3, 111, [P.fl0, P.fl1, P.fl0]);
    // 根元の輪（進む向きに直交する細い楕円）
    const b = t; if (b < 0.22) {
      const r = 3 + b * 50, cx = bx + ux * (6 + b * 30), cy = by + uy * (6 + b * 30);
      for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, w = Math.cos(a) * r * 0.25, h = Math.sin(a) * r; px(cx + ux * w + nx * h, cy + uy * w + ny * h * 0.8, b < 0.08 ? P.W : P.fl0, 1 - b / 0.22); }
    }
  }

  /* ---------- 槍 lv3 ドラグーン：光の柱で跳び、1秒後に降ってくる ---------- */
  const DRAGOON_T = 1.0;
  function dragoonLanding(o) { const [ux, uy] = dirv(o); return o.tx != null ? [o.tx, o.ty] : [o.x + ux * o.R * 0.55, o.y + uy * o.R * 0.55]; }
  function spdragoonGround(t, o) {
    const [lx, ly] = dragoonLanding(o);
    dust(o.x, o.y, t, 7, 120, 10, 0.5);
    groundRing(o.x, o.y, t, 16, 0.25, RAMP.steel, 0.45);
    // 着地点の照準（縮んでいく輪＝あと何秒か）
    if (t > 0.1 && t < DRAGOON_T) {
      const k = (t - 0.1) / (DRAGOON_T - 0.1), r = Math.round(16 - 10 * k), fr = Math.floor(t * 12);
      ellRing(lx, ly, r, r * 0.45, (fr & 1) ? P.W : P.fl0, 1, 8, fr * 0.25);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; px(lx + Math.cos(a) * (r + 3), ly + Math.sin(a) * (r + 3) * 0.45, P.fr0); }
      ellipse(lx, ly, 2 + 5 * k, 1 + 2 * k, P.st4, 0.4 + 0.5 * k);       // 落ちてくる影
    }
    const b = t - DRAGOON_T;
    groundRing(lx, ly, b, 30, 0.32, RAMP.steel, 0.45);
    cracks(lx, ly, b, 7, 13, 121, 0.1, 1.0);
    dust(lx, ly, b, 8, 122, 14, 0.55);
    if (b >= 0 && b < 0.3) lightPool(lx, ly, 26, b < 0.08 ? 0.9 : 0.4, 'steel');
  }
  function spdragoonAir(t, o) {
    const [lx, ly] = dragoonLanding(o), top = o.skyY != null ? o.skyY : o.y - 90;
    // 跳ぶ：足元から空へ抜ける柱
    if (t >= 0 && t < 0.2) {
      const w = t < 0.07 ? 2 : t < 0.14 ? 1 : 0;
      for (let y = Math.round(o.y - 2); y > top; y--) for (let dx = -w; dx <= w; dx++) px(o.x + dx, y, dx ? P.fr0 : P.W, t < 0.14 ? 1 : 0.5);
      speedLines(o.x, o.y, o.x, top, t, 0.2, 5, 123);
    }
    // 降る：空から着地点へ
    const b = t - DRAGOON_T;
    if (b >= -0.08 && b < 0.06) {
      const y0 = top, y1 = ly - 2, cur = b < 0 ? y0 + (y1 - y0) * easeIn((b + 0.08) / 0.08) : y1;
      for (let y = Math.round(y0); y <= cur; y++) { px(lx, y, P.W); px(lx - 1, y, P.fr0, 0.8); px(lx + 1, y, P.fl0, 0.8); }
    }
    spark(lx, ly - 5, b, RAMP.steel, 124, 10, 1.5);
  }

  /* ---------- 弓 lv1 アローレイン：空へ放ち、狙った辺りへ降る ---------- */
  function rainArrows(o) {                     // 見本用の着弾予定（実機は W.arts の arrow ごとに描く）
    const [ux, uy] = dirv(o), tx = o.tx != null ? o.tx : o.x + ux * 80, ty = o.ty != null ? o.ty : o.y + uy * 80, out = [];
    for (let i = 0; i < 8; i++) { const a = hash(i, 131) * TAU, r = Math.sqrt(hash(i, 132)) * 2.6 * TILE; out.push([0.5 + hash(i, 133) * 0.7, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.9]); }
    return out;
  }
  function rainRing(x, y, fall, lv = 1) {       // 着弾点の輪（fall < 0 は落ち始める前）
    if (fall < 0) { ellRing(x, y, 6, 3, P.bw2, 0.6 * lv); return; }
    const r = Math.round(6 - 3 * fall);
    ellRing(x, y, r, Math.max(1, r * 0.45), fall > 0.7 ? P.bw0 : P.bw1, 0.8 * lv);
  }
  function rainArrow(x, y, fall, lv = 1) {      // 落ちてくる矢（fall: 0 → 1 で落ちきる）
    if (fall < 0 || fall >= 1) return;
    drawArrow(x, y - 2 - (1 - fall) * 30, Math.PI / 2, lv);
  }
  function rainHit(x, y, b) {
    if (b < 0 || b > 0.45) return;
    if (b < 0.25) { line(x, y, x, y - 5, P.wd0); px(x, y - 6, P.bw1); px(x - 1, y - 6, P.bw1); }   // 刺さった矢
    spark(x, y - 2, b, RAMP.bow, Math.round(x * 7 + y), 5, 0.7);
    dust(x, y, b, 2, Math.round(x + y), 4, 0.3);
  }
  function bwrainGround(t, o) {
    if (o.arrows === false) return;
    for (const [t0, x, y] of (o._rain || (o._rain = rainArrows(o)))) {
      if (t < t0 - 0.45 || t >= t0) continue;
      rainRing(x, y, clamp(1 - (t0 - t) / 0.45));
    }
  }
  function bwrainAir(t, o) {
    if (o.arrows !== false) for (const [t0, x, y] of (o._rain || (o._rain = rainArrows(o)))) {
      if (t < t0 - 0.45) continue;
      if (t < t0) rainArrow(x, y, clamp(1 - (t0 - t) / 0.45)); else rainHit(x, y, t - t0);
    }
    // 放つ：弓から空へ5本
    const [bx, by] = body(o);
    if (t >= 0 && t < 0.35) for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.16 + Math.cos(o.ang) * 0.25, d = q24(t) * 380 - i * 8;
      if (d < 0) continue;
      drawArrow(bx + Math.cos(a) * d, by + Math.sin(a) * d, a);
    }
    if (t >= 0 && t < 0.1) plus(bx + Math.cos(o.ang) * 5, by - 2, P.W, 2);
  }

  /* ---------- 弓 lv2 連射：1発ずつ相手へ（実機は撃つたびに bwshot を出す） ---------- */
  const RAPID = [0, 0.14, 0.28, 0.42, 0.56], SHOT_T = 0.1;
  function shotAir(t, x0, y0, ang, L, seed) {
    if (t < 0 || t > SHOT_T + 0.3) return;
    const ux = Math.cos(ang), uy = Math.sin(ang), p = clamp(t / SHOT_T), d = L * p;
    if (t <= SHOT_T) {
      drawArrow(x0 + ux * d, y0 + uy * d, ang);
      line(x0 + ux * Math.max(0, d - 16), y0 + uy * Math.max(0, d - 16), x0 + ux * Math.max(0, d - 8), y0 + uy * Math.max(0, d - 8), P.bw0, 0.6);
    }
    if (t < 0.05) plus(x0 + ux * 3, y0 + uy * 3, P.W, 1);
    spark(x0 + ux * L, y0 + uy * L, t - SHOT_T, RAMP.bow, seed, 6, 0.8);
  }
  function bwrapidGround() {}
  function bwrapidAir(t, o) {
    const [bx, by] = body(o), tg = o.targets;
    if (o.shots === false) { if (t < 0.08) plus(bx + Math.cos(o.ang) * 5, by, P.W, 1); return; }
    RAPID.forEach((d, i) => {
      let ang = o.ang, L = o.R * 0.7;
      if (tg && tg.length) { const e = tg[i % tg.length]; ang = Math.atan2(e[1] - 6 - by, e[0] - bx); L = Math.hypot(e[0] - bx, e[1] - 6 - by); }
      shotAir(t - d, bx, by, ang, L, 140 + i);
    });
  }
  function bwshotAir(t, o) { const [bx, by] = body(o); shotAir(t, bx, by, o.ang, o.R, 150); }

  /* ---------- 弓 lv3 バーストショット：燃える矢と、残る火の線 ---------- */
  const BURST_T = 0.2;
  function bwburstGround(t, o) {
    const [ux, uy] = dirv(o), L = o.R;
    if (t >= 0 && t < 0.7) lightPool(o.x + ux * L * 0.5, o.y + uy * L * 0.5, L * 0.45, 0.45 * (1 - t / 0.7), 'fire');
    for (let s = 6; s < L; s += 3) {                               // 床に残る焦げ
      const ts = BURST_T * (s / L), b = t - ts; if (b < 0 || b > 0.7) continue;
      px(o.x + ux * s, o.y + uy * s + (hash(s, 160) > 0.5 ? 1 : -1), b < 0.25 ? P.fi3 : P.fi5, 1 - b / 0.7);
    }
  }
  function bwburstAir(t, o) {
    if (t < 0) return;
    const [bx, by] = body(o), [ux, uy] = dirv(o), L = o.R, p = clamp(t / BURST_T), d = L * p;
    // 放った瞬間の火の輪
    if (t < 0.18) { ring(bx + ux * 4, by + uy * 4, 2 + t * 40, rampAt(RAMP.fire, t / 0.18), 1 - t / 0.18); plus(bx + ux * 4, by + uy * 4, P.fi0, 2); }
    // 通り道に残る炎の粒
    for (let s = 4; s < L; s += 4) {
      const b = t - BURST_T * (s / L); if (b < 0 || b > 0.45) continue;
      const f = b / 0.45, ci = Math.min(5, Math.floor(f * 6));
      flamePuff(bx + ux * s, by + uy * s + Math.round((hash(s, 161) - 0.5) * 3), f < 0.5 ? 2 : 1, ci, (Math.floor(t * 12) + s) % 3 - 1);
    }
    if (t <= BURST_T) { drawArrow(bx + ux * d, by + uy * d, o.ang, 1, true); plus(bx + ux * d, by + uy * d, P.fi0, 1); }
    spark(bx + ux * L, by + uy * L, t - BURST_T, RAMP.fire, 162, 8, 1.1);
  }

  /* ---------- 戦鎚 lv1 ダブルアタック：振り下ろして地面を2度打つ ---------- */
  const DOUBLE = [0, 0.2];
  function smashPoint(o, i) { const [ux, uy] = dirv(o), nx = -uy, ny = ux, sd = i ? 1 : -1; return [o.x + ux * 17 + nx * 5 * sd, o.y + uy * 17 + ny * 5 * sd]; }
  function smashGround(t, o, i, big = 1) {
    const [x, y] = smashPoint(o, i), b = t - 0.07;
    groundRing(x, y, b, 18 * big, 0.3, RAMP.holy, 0.45);
    cracks(x, y, b, 5, 9 * big, 170 + i, 0.08, 0.8, P.W, P.ho2);
    dust(x, y, b, 6, 172 + i, 10 * big, 0.45);
    if (b >= 0 && b < 0.25) lightPool(x, y, 18, b < 0.07 ? 0.8 : 0.35, 'holy');
  }
  function smashAir(t, o, i, big = 1) {
    const [bx, by] = body(o), [x, y] = smashPoint(o, i), [ux] = dirv(o), sg = ux >= 0 ? 1 : -1;
    slash(bx + sg * 4, by - 2, 13, -Math.PI / 2 - sg * 0.5, Math.atan2(y - 3 - by, x - bx), 6, 0.9, [P.W, P.ho1, P.fl0], t, 0.12, 174 + i);
    spark(x, y - 3, t - 0.07, RAMP.holy, 176 + i, 8, 1.2 * big);
  }
  function mcdoubleGround(t, o) { DOUBLE.forEach((d, i) => smashGround(t - d, o, i)); }
  function mcdoubleAir(t, o) { DOUBLE.forEach((d, i) => smashAir(t - d, o, i)); }

  /* ---------- 戦鎚 lv2 癒し打ち：打った所から癒しの輪、足元に魔法陣 ---------- */
  function healCross(x, y, c, lv = 1) { px(x, y - 1, c, lv); px(x - 1, y, c, lv); px(x, y, P.W, lv); px(x + 1, y, c, lv); px(x, y + 1, c, lv); }
  function mchealGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.9, 'heal', 1.1, o.charge || 0);
    smashGround(t, o, 1, 1.1);
    groundRing(o.x, o.y, t - 0.12, o.healR, 0.5, RAMP.heal, 0.5);
    if (t >= 0.1 && t < 0.9) lightPool(o.x, o.y, o.healR * 0.8, 0.35 * (1 - (t - 0.1) / 0.8), 'heal');
  }
  function mchealAir(t, o) {
    smashAir(t, o, 1, 1.1);
    // 範囲の中から立ちのぼる十字（仲間の位置があればそこへ多め）
    const pts = o.allies || [];
    for (let i = 0; i < 14; i++) {
      const b = t - 0.12 - hash(i, 180) * 0.35; if (b < 0 || b > 0.7) continue;
      let x, y;
      if (i < pts.length * 3 && pts.length) { const a = pts[i % pts.length]; x = a[0] + (hash(i, 181) * 2 - 1) * 6; y = a[1] - 4; }
      else { const a = hash(i, 182) * TAU, r = Math.sqrt(hash(i, 183)) * o.healR; x = o.x + Math.cos(a) * r; y = o.y + Math.sin(a) * r * 0.6; }
      const p = b / 0.7;
      if ((Math.floor(t * 12) + i) % 4 === 0 && p > 0.5) continue;
      healCross(x, y - p * 16, p < 0.3 ? P.hl0 : p < 0.7 ? P.hl1 : P.hl2);
    }
  }

  /* ---------- 戦鎚 lv3 ホーリーシールド：金の魔法陣と、体を包む殻 ---------- */
  const SHIELD_ICON = ['..aaa..', '.abbba.', 'abcbcba', 'abbbbba', '.abcba.', '..aba..', '...a...'];
  function mcshieldGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.9, 'holy', 1.1, o.charge || 0);
  }
  function mcshieldAir(t, o) {
    if (t < 0) return;
    const [bx, by] = body(o), fr = Math.floor(t * 12);
    // 殻：縦長の楕円。2コマで広がり、光ってから落ち着き、間引かれて消える
    if (t < 1.1) {
      const grow = t < 1 / 12 ? 0.6 : 1, lv = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.3, flash = t >= 0.08 && t < 0.16;
      const rx = Math.round(11 * grow), ry = Math.round(13 * grow);
      ellRing(bx, by + 1, rx, ry, flash ? P.W : P.ho1, lv);
      ellRing(bx, by + 1, rx - 1, ry - 1, flash ? P.ho0 : P.ho3, lv * 0.5);
      for (let i = 0; i < 6; i++) {                                  // 殻の上を走る光の点
        const a = i * TAU / 6 + fr * 0.4; if (Math.sin(a) > 0.3 && (fr & 1)) continue;
        px(bx + Math.cos(a) * rx, by + 1 + Math.sin(a) * ry, P.W, lv);
      }
    }
    // 残る印（頭の上の小さな盾）
    if (t > 0.3) {
      const lv = t < 1.2 ? 1 : 1 - (t - 1.2) / 0.2, ox = bx - 3, oy = by - 18 - (fr % 6 < 3 ? 0 : 1);
      SHIELD_ICON.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(ox + x, oy + y, ch === 'a' ? P.ho3 : ch === 'b' ? P.ho1 : P.W, lv); }));
    }
  }

  /* ============================================================
     通常攻撃（武器7系統）・ヒット（属性5種）・弾（矢・魔弾）
     実機では 1秒に何十回も出るので、軽く・短く・読みやすく。
     ============================================================ */
  const ELEM = {
    neutral: { cols: [P.W, P.fr0, P.fl0], ramp: RAMP.steel, acc: P.ac0, tint: 'steel' },
    fire:    { cols: [P.fi0, P.fi2, P.fi4], ramp: RAMP.fire, acc: P.fi1, tint: 'fire' },
    shock:   { cols: [P.W, P.sh1, P.sh3], ramp: RAMP.shock, acc: P.sh0, tint: 'shock' },
    frost:   { cols: [P.W, P.fr1, P.fr3], ramp: RAMP.frost, acc: P.fr0, tint: 'frost' },
    arcane:  { cols: [P.W, P.ar1, P.ar3], ramp: RAMP.arcane, acc: P.ar0, tint: 'arcane' }
  };
  const elemOf = o => ELEM[o.elem] || ELEM.neutral;

  /* ---------- 振り（武器ごとの形） ---------- */
  function swingAir(t, o) {
    const E = elemOf(o), [bx, by] = body(o), [ux, uy] = dirv(o), R = Math.max(14, o.R), a = o.ang, k = o.kind || 'swordaxe';
    if (k === 'swordaxe') slash(bx, by, R * 0.8, a - 1.0, a + 0.95, 4, 0.78, E.cols, t, 0.2, 501);
    else if (k === 'greatsword') { slash(bx, by, R * 0.85, a - 1.35, a + 1.2, 6, 0.78, E.cols, t, 0.26, 502); }
    else if (k === 'dagger') {
      const cx = bx + ux * 8, cy = by + uy * 8;
      slash(cx, cy, 10, a - 2.2, a + 0.3, 2, 0.8, E.cols, t, 0.11, 503);
      slash(cx, cy, 10, a + 2.2, a - 0.3, 2, 0.8, E.cols, t - 0.07, 0.11, 504);
    } else if (k === 'hammer') {
      const sg = ux >= 0 ? 1 : -1, hx = bx + ux * R * 0.75, hy = by + uy * R * 0.75 + 4;
      slash(bx + sg * 3, by - 2, 11, -Math.PI / 2 - sg * 0.5, Math.atan2(hy - by, hx - bx), 5, 0.9, E.cols, t, 0.12, 505);
      spark(hx, hy - 2, t - 0.07, E.ramp, 506, 6, 1);
    } else if (k === 'spear') {
      if (t < 0 || t > 0.22) return;
      const ext = R * easeOut(clamp(q24(t) / 0.06)), cut = t < 0.1 ? 0 : clamp((t - 0.1) / 0.12) * ext, nx = -uy, ny = ux;
      for (let s = Math.round(cut); s <= ext; s++) {
        const x = bx + ux * s, y = by + uy * s;
        px(x, y, E.cols[0]); if (s > ext * 0.3 && t < 0.12) { px(x + nx, y + ny, E.cols[1]); px(x - nx, y - ny, E.cols[2]); }
      }
      if (ext > cut) plus(bx + ux * ext, by + uy * ext, E.cols[0], t < 0.08 ? 2 : 1);
    } else if (k === 'bow') {
      if (t >= 0 && t < 0.1) { plus(bx + ux * 5, by + uy * 5, P.W, t < 0.05 ? 2 : 1); speedLines(bx, by, bx - ux * 10, by - uy * 10, t, 0.1, 2, 507, [P.bw0, P.bw1, P.bw0]); }
    } else if (k === 'magicbolt') {
      if (t >= 0 && t < 0.14) { const hx = bx + ux * 6, hy = by + uy * 6 - 2; ellRing(hx, hy, 2 + t * 30, 1 + t * 14, E.cols[1], 1 - t / 0.14); plus(hx, hy, E.cols[0], t < 0.06 ? 2 : 1); }
    }
  }
  function swingGround(t, o) {
    const k = o.kind || 'swordaxe', [ux, uy] = dirv(o), R = Math.max(14, o.R);
    if (k === 'hammer') {
      const hx = o.x + ux * R * 0.75, hy = o.y + uy * R * 0.75;
      groundRing(hx, hy, t - 0.07, 9, 0.22, elemOf(o).ramp, 0.45);
      cracks(hx, hy, t - 0.07, 4, 6, 511, 0.06, 0.5, P.W, P.fl1);
    }
    if (k === 'greatsword') dust(o.x + ux * R * 0.7, o.y + uy * R * 0.7, t - 0.12, 3, 512, 5, 0.3);
  }

  /* ---------- 当たり（属性ごと） ---------- */
  function hitAir(t, o) {
    if (t < 0 || t > 0.5) return;
    const E = elemOf(o), x = o.x, y = o.y, big = o.target === 'ally' ? 0.7 : 1, e = o.elem || 'neutral', fr = Math.floor(t * 24);
    spark(x, y, t, E.ramp, 520 + (o.seed || 0), e === 'neutral' ? 7 : 5, big);
    if (e === 'fire' && t < 0.42) for (let i = 0; i < 3; i++) {
      const b = t - i * 0.04; if (b < 0) continue; const f = b / 0.38;
      if (f < 1) flamePuff(x + (i - 1) * 3 * big, y - f * 9 * big, f < 0.4 ? 2 : 1, Math.min(5, Math.floor(f * 6)), (fr + i) % 3 - 1);
    }
    if (e === 'shock' && t < 0.2) for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + (fr & 1) * 0.5, L = (7 + (fr & 1) * 2) * big;
      const mx = x + Math.cos(a) * L * 0.5 + (hash(i, fr) - 0.5) * 3, my = y + Math.sin(a) * L * 0.5 + (hash(i + 3, fr) - 0.5) * 3;
      line(x, y, mx, my, P.sh0); line(mx, my, x + Math.cos(a) * L, y + Math.sin(a) * L, P.sh1);
    }
    if (e === 'frost' && t < 0.35) {
      ellRing(x, y, (3 + t * 22) * big, (2 + t * 10) * big, t < 0.12 ? P.fr0 : P.fr2, 1 - t / 0.35);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + 0.3, d = (3 + t * 40) * big, sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.7 + t * t * 60;
        px(sx, sy - 1, P.W); px(sx, sy, P.fr1); px(sx, sy + 1, P.fr3);
      }
    }
    if (e === 'arcane' && t < 0.4) {
      ring(x, y, (2 + t * 26) * big, rampAt(RAMP.arcane, t / 0.4), 1 - t / 0.4);
      for (let i = 0; i < 4; i++) { const g = GLYPH[i], gx = Math.round(x + (i - 1.5) * 4 * big), gy = Math.round(y - t * 22 - (i & 1) * 2);
        for (let k = 0; k < 4; k++) if (g[k]) px(gx + (k & 1), gy + (k >> 1), i & 1 ? P.ar1 : P.cy1, 1 - t / 0.4); }
    }
  }

  /* ---------- 弾（その場の位置に描く。age は揺らぎだけに使う） ---------- */
  function shotAirN(t, o) {
    const E = elemOf(o), x = o.x, y = o.y, a = o.ang, ux = Math.cos(a), uy = Math.sin(a), fr = Math.floor(t * 24);
    if (o.kind === 'arrow') {
      drawArrow(x, y, a, 1, o.elem === 'fire');
      if (o.elem && o.elem !== 'neutral') plus(x, y, E.acc, 1);
      for (let k = 1; k <= 3; k++) px(x - ux * (8 + k * 3), y - uy * (8 + k * 3), k === 1 ? P.bw0 : P.bw1, 1 - k / 4);
      return;
    }
    // 魔弾：芯＋属性色の輪＋うねる尾
    for (let k = 7; k >= 1; k--) {
      const wob = ((fr + k) & 1) ? 1 : -1, sx = x - ux * k * 1.6 - uy * wob * (k > 3 ? 1 : 0), sy = y - uy * k * 1.6 + ux * wob * (k > 3 ? 1 : 0);
      px(sx, sy, rampAt(E.ramp, k / 8), 1 - k / 9);
    }
    disc(x, y, 1, E.cols[1]); plus(x, y, E.cols[0], (fr & 1) ? 2 : 1); px(x, y, P.W);
  }

  /* ============================================================
     大技（主人公8種）・仲間の大技（Lv.50）・スキル技・効いている間の足元の輪
     支える技は「本人の足元の魔法陣」と「仲間ひとりずつに乗る印（*_on）」に分けて描く。
     実機では仲間ごとに *_on を積み、その仲間に付いて動かす。
     ============================================================ */
  const onEach = (o, t, fn) => (o.allies || []).forEach(([x, y], i) => fn(t - 0.1 - i * 0.05, { x, y }));

  /* ---------- 大技：震撼（周囲を叩き割る） ---------- */
  function uQuakeGround(t, o) {
    const R = o.R;
    groundRing(o.x, o.y, t, R, 0.36, RAMP.holy, 0.5);
    groundRing(o.x, o.y, t - 0.1, R * 0.7, 0.32, RAMP.dust, 0.5);
    cracks(o.x, o.y, t, 10, R * 0.55, 601, 0.12, 1.1, P.ho0, P.ho2);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + 0.2; dust(o.x + Math.cos(a) * R * 0.85, o.y + Math.sin(a) * R * 0.42, t - 0.2, 1, 602 + i, 4, 0.4); }
    if (t >= 0 && t < 0.7) lightPool(o.x, o.y, R * 0.9, t < 0.1 ? 0.9 : 0.4, 'holy');
  }
  function uQuakeAir(t, o) {
    const R = o.R, [bx, by] = body(o);
    if (t >= 0 && t < 0.1) { plus(bx, o.y - 2, P.W, 5); disc(bx, o.y - 2, 2, P.ho0); }
    for (let i = 0; i < 14; i++) {                         // 輪が通った所から岩が突き出して沈む
      const a = hash(i, 611) * TAU, r = R * (0.4 + 0.55 * hash(i, 612)), ts = 0.36 * (1 - Math.sqrt(Math.max(0, 1 - r / R))), b = t - ts;
      if (b < 0 || b > 0.45) continue;
      const x = Math.round(o.x + Math.cos(a) * r), y = Math.round(o.y + Math.sin(a) * r * 0.5), h = 4 + hash(i, 613) * 4;
      const g = b < 1 / 12 ? 0.5 : b < 0.25 ? 1 : 1 - (b - 0.25) / 0.2;
      if (g > 0) rockSpike(x, y, h * g, 2);
      if (b > 0.02 && b < 0.3) px(x + (hash(i, 614) - 0.5) * 12 * b * 6, y - h - b * 40 + b * b * 200, P.st1);
    }
  }

  /* ---------- 大技：縮地（走り抜けた線が光り、遅れて斬り跡が弾ける） ---------- */
  const BLINK_T = 0.28;
  function uBlinkGround(t, o) {
    const [ux, uy] = dirv(o), L = o.R, ex = o.x + ux * L, ey = o.y + uy * L;
    dust(o.x, o.y, t, 8, 621, 10, 0.5); dust(ex, ey, t - BLINK_T, 8, 622, 12, 0.55);
    groundRing(o.x, o.y, t, 18, 0.25, RAMP.frost, 0.45);
    groundRing(ex, ey, t - BLINK_T, 26, 0.3, RAMP.frost, 0.45);
    cracks(ex, ey, t - BLINK_T, 6, 9, 624, 0.1, 0.7, P.W, P.fr2);
    for (let s = 4; s < L; s += 2) {                                       // 走った床に残る霜の筋
      const b = t - BLINK_T * (1 - Math.sqrt(Math.max(0, 1 - s / L))); if (b < 0 || b > 0.7) continue;
      px(o.x + ux * s, o.y + uy * s + 1, b < 0.15 ? P.fr0 : P.fr2, b < 0.35 ? 0.9 : 0.9 * (1 - (b - 0.35) / 0.35));
    }
    if (t >= 0 && t < 0.8) lightPool(o.x + ux * L * 0.5, o.y + uy * L * 0.5, L * 0.6, 0.6 * (1 - t / 0.8), 'frost');
  }
  function uBlinkAir(t, o) {
    if (t < 0 || t > 0.95) return;
    const [ux, uy] = dirv(o), [bx, by] = body(o), L = o.R, nx = -uy, ny = ux, d = L * easeOut(clamp(t / BLINK_T));
    if (t < 0.08) { plus(bx, by, P.W, 6); ring(bx, by, 3 + t * 90, P.cy0, 1 - t / 0.08); }   // 踏み切りの閃光
    for (let s = 0; s <= d; s++) {                                         // 太い光の帯（白い芯＋水色の縁）
      const as = t - BLINK_T * (1 - Math.sqrt(Math.max(0, 1 - s / L))); if (as > 0.55) continue;
      const x = bx + ux * s, y = by + uy * s, lv = as < 0.18 ? 1 : 1 - (as - 0.18) / 0.37, w = as < 0.06 ? 3 : as < 0.16 ? 2 : 1;
      px(x, y, as < 0.1 ? P.W : as < 0.24 ? P.cy0 : P.fr1, lv);
      for (let k = 1; k <= w; k++) { const c = k === w ? P.fr2 : P.cy1; px(x + nx * k, y + ny * k, c, lv); px(x - nx * k, y - ny * k, c, lv); }
      if (as < 0.12 && (s % 5) === 0) { px(x + nx * (w + 2), y + ny * (w + 2), P.W); px(x - nx * (w + 2), y - ny * (w + 2), P.W); }
    }
    speedLines(bx, by, bx + ux * L, by + uy * L, t, BLINK_T + 0.15, 9, 623, [P.W, P.cy0, P.fr1]);
    for (let k = 0; k < 4; k++) {                                          // 通り道に遅れて弾ける斬り跡（X）
      const s = L * (0.2 + k * 0.2), b = t - BLINK_T * (s / L) - 0.08; if (b < 0 || b > 0.3) continue;
      const cx = bx + ux * s, cy = by + uy * s, ang = Math.atan2(uy, ux);
      slash(cx, cy, 9, ang + 2.4, ang + 0.7, 3, 0.8, [P.W, P.cy0, P.fr2], b, 0.16, 625 + k);
      slash(cx, cy, 9, ang - 2.4, ang - 0.7, 3, 0.8, [P.W, P.cy0, P.fr2], b - 0.04, 0.16, 629 + k);
      if (b < 0.06) plus(cx, cy, P.W, 3);
      spark(cx, cy, b, RAMP.frost, 630 + k, 6, 1);
    }
    const b = t - BLINK_T;                                                 // 抜けた先の破裂
    if (b >= 0 && b < 0.45) {
      const ex = bx + ux * L, ey = by + uy * L;
      if (b < 0.1) { plus(ex, ey, P.W, 7); disc(ex, ey, 3 - b * 20, P.W); }
      ring(ex, ey, 4 + b * 70, b < 0.12 ? P.W : P.cy1, 1 - b / 0.45);
      ellRing(ex, ey + 6, 5 + b * 90, 2 + b * 36, b < 0.1 ? P.W : P.fr1, 1 - b / 0.45);
      spark(ex, ey, b, RAMP.frost, 634, 12, 1.4);
      for (let i = 0; i < 8; i++) { const a2 = i * TAU / 8, r = 6 + b * 60; if (b < 0.25) line(ex + Math.cos(a2) * r * 0.5, ey + Math.sin(a2) * r * 0.35, ex + Math.cos(a2) * r, ey + Math.sin(a2) * r * 0.7, i & 1 ? P.cy0 : P.W, 1 - b / 0.25); }
    }
  }

  /* ---------- 大技：灼髄（足元の陣から、前へ順に火柱が噴き上がる） ---------- */
  const BLAZE_COLS = 6;
  function uBlazeGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.8, 'fire', 1.7, o.charge || 0);
    const [ux, uy] = dirv(o), L = o.R, W = o.wide || 18;
    if (t >= 0 && t < 1.4) lightPool(o.x + ux * L * 0.5, o.y + uy * L * 0.5, L * 0.6, 0.8 * (1 - t / 1.4), 'fire');
    for (let k = 0; k < BLAZE_COLS; k++) {                                // 火柱の根元：溶けた床のひびと焦げ
      const s = L * (k + 1) / (BLAZE_COLS + 0.5), b = t - 0.06 - k * 0.06, x = o.x + ux * s, y = o.y + uy * s;
      cracks(x, y, b, 6, W * 0.5, 640 + k, 0.2, 1.3, P.fi1, P.fi4);
      groundRing(x, y, b, W * 0.7, 0.25, RAMP.fire, 0.45);
      if (b > 0.1 && b < 1.4) ellRing(x, y, W * 0.45, W * 0.2, P.fi5, 0.7 * (1 - (b - 0.1) / 1.3));
    }
    for (let s = 8; s < L; s += 2) {                                      // 帯の縁の熾火
      const b = t - 0.3 * (s / L); if (b < 0 || b > 1.3) continue;
      for (const sg of [-1, 1]) {
        const j = sg * W * (0.55 + hash(s, 631 + sg) * 0.4);
        px(o.x + ux * s - uy * j, o.y + uy * s + ux * j, b < 0.4 ? P.fi3 : P.fi5, b < 0.7 ? 1 : 1 - (b - 0.7) / 0.6);
      }
    }
  }
  function flameColumn(x, y, b, H, fr, seed) {                            // 1本の火柱：下から伸びて、上から崩れる
    if (b < 0 || b > 0.9) return;
    const grow = easeOut(clamp(b / 0.1)), top = H * grow, fall = b > 0.45 ? (b - 0.45) / 0.45 : 0;
    for (let h = 0; h < top; h += 3) {
      const f = h / H, ci = Math.min(5, Math.floor(f * 3 + fall * 3 + (b < 0.08 ? 0 : 1)));
      if (f < fall * 0.9 && fall > 0) continue;                           // 崩れた所から消える
      const wob = ((fr + Math.floor(h / 3)) % 3) - 1;
      flamePuff(x + wob + Math.sin(h * 0.5 + seed) * 1.5, y - h, f < 0.3 ? 3 : f < 0.7 ? 2 : 1, ci, wob);
    }
    if (b < 0.12) { disc(x, y - 2, 4 - b * 20, P.W); plus(x, y - top, P.fi0, 3); }
  }
  function uBlazeAir(t, o) {
    if (t < 0) return;
    const [ux, uy] = dirv(o), [bx, by] = body(o), L = o.R, W = o.wide || 18, fr = Math.floor(t * 12);
    if (t < 0.14) { disc(bx + ux * 6, by + uy * 6, 4 - t * 20, P.W); plus(bx + ux * 6, by + uy * 6, P.fi1, 5); }
    for (let s = 6; s < L; s += 4) {                                      // 地を這う炎の帯
      const b = t - 0.3 * (s / L); if (b < 0 || b > 0.6) continue;
      for (let lane = 0; lane < 3; lane++) {
        const j = (hash(s * 3 + lane, 632) * 2 - 1) * W * 0.6, f = b / 0.6, ci = Math.min(5, 1 + Math.floor(f * 5));
        flamePuff(bx + ux * s - uy * j, by + 4 + uy * s + ux * j - b * 10, f < 0.35 ? 2 : 1, ci, (fr + s + lane) % 3 - 1);
      }
    }
    for (let k = 0; k < BLAZE_COLS; k++) {                                // 前へ順に噴き上がる火柱
      const s = L * (k + 1) / (BLAZE_COLS + 0.5), b = t - 0.06 - k * 0.06;
      flameColumn(o.x + ux * s, o.y + uy * s, b, 26 + (k & 1) * 8 + (k === BLAZE_COLS - 1 ? 10 : 0), fr, k);
    }
    for (let i = 0; i < 28; i++) {                                        // 高く舞う火の粉
      const t0 = 0.05 + hash(i, 633) * 0.7, a = t - t0; if (a < 0 || a > 0.8) continue;
      const s = L * hash(i, 634), sx = o.x + ux * s + (hash(i, 635) - 0.5) * W * 1.4;
      px(sx + Math.sin(a * 9 + i) * 2, o.y + uy * s - 6 - a * 55, rampAt(RAMP.fire, a / 0.8));
    }
  }

  /* ---------- 大技：守護・鉄壁・号令・生気（支える4つ） ---------- */
  function wardOn(t, p) {                                                  // 守護：体を覆う半球（上から閉じる）＋ 状態異常のかけらが剥がれ落ちる
    if (t < 0 || t > 0.9) return;
    const grow = clamp(t / 0.15), lv = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.3, fr = Math.floor(t * 12), rx = 10, ry = 14;
    ellRing(p.x, p.y + 1, rx, 4, t < 0.12 ? P.W : P.hl1, lv);
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI; if (i / n > grow && 1 - i / n > grow) continue;
      const x = p.x + Math.cos(a) * rx, y = p.y + 1 + Math.sin(a) * ry;
      if (((i + fr) % 3) !== 0 || t < 0.2) px(x, y, t < 0.15 ? P.W : (i & 1) ? P.hl0 : P.hl1, lv);
    }
    if (t < 0.15) plus(p.x, p.y + 1 - ry, P.W, 2);
    for (let i = 0; i < 4; i++) {                                        // 剥がれ落ちる黒いかけら
      const b = t - 0.1 - i * 0.05; if (b < 0 || b > 0.4) continue;
      const x = p.x + (hash(i, 642) - 0.5) * 14 + (i & 1 ? 1 : -1) * b * 20, y = p.y - 8 + b * b * 90;
      px(x, y, P.ink, 1 - b / 0.4); px(x + 1, y, P.sm0, 1 - b / 0.4);
    }
  }
  function aegisOn(t, p) {
    if (t < 0 || t > 1.0) return;
    const grow = t < 1 / 12 ? 0.6 : 1, lv = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3, flash = t >= 0.06 && t < 0.14, fr = Math.floor(t * 12);
    ellRing(p.x, p.y - 5, Math.round(9 * grow), Math.round(11 * grow), flash ? P.W : P.ag1, lv);
    ellRing(p.x, p.y - 5, Math.round(8 * grow), Math.round(10 * grow), P.ag3, lv * 0.5);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + fr * 0.4; if ((fr + i) & 1) px(p.x + Math.cos(a) * 9, p.y - 5 + Math.sin(a) * 11, P.W, lv); }
  }
  function rallyOn(t, p) {
    if (t < 0 || t > 0.9) return;
    for (let i = 0; i < 4; i++) { const b = t - i * 0.07; if (b < 0 || b > 0.7) continue; healCross(p.x + (hash(i, 641) - 0.5) * 12, p.y - 6 - b * 20, b < 0.25 ? P.hl0 : P.hl1, 1 - b / 0.7); }
    if (t < 0.12) plus(p.x, p.y - 6, P.W, 2);
  }
  function bloomOn(t, p) {
    if (t < 0 || t > 1.0) return;
    for (let i = 0; i < 4; i++) {
      const b = t - i * 0.06; if (b < 0 || b > 0.8) continue;
      const a = i * TAU / 4 + b * 7, r = 7 - b * 4, x = p.x + Math.cos(a) * r, y = p.y - 2 - b * 18 + Math.sin(a) * r * 0.4;
      px(x, y, P.lf1, 1 - b / 0.8); px(x + 1, y, P.lf2, 1 - b / 0.8); px(x, y - 1, i & 1 ? P.lf4 : P.lf0, 1 - b / 0.8);
    }
  }
  function supportGround(elem, ramp, R) {
    return (t, o) => {
      magicCircle(o.x, o.y + 1, t, 0.8, elem, 1.5, o.charge || 0);
      groundRing(o.x, o.y, t - 0.05, R != null ? R : o.R, 0.45, ramp, 0.5);
    };
  }
  const uWardGround = supportGround('heal', RAMP.heal), uAegisGround = supportGround('aegis', RAMP.aegis),
        uRallyGround = supportGround('heal', RAMP.heal), uBloomGround = supportGround('bloom', RAMP.leaf);
  function uWardAir(t, o) { wardOn(t, o); onEach(o, t, wardOn); }
  function uAegisAir(t, o) { aegisOn(t, o); onEach(o, t, aegisOn); }
  function uRallyAir(t, o) {
    if (t >= 0 && t < 0.6) {                                             // 頭上の大きな十字
      const b = t, y = o.y - 22 - b * 10, lv = b < 0.4 ? 1 : 1 - (b - 0.4) / 0.2, c = b < 0.1 ? P.W : P.hl1;
      for (let k = -3; k <= 3; k++) { px(o.x + k, y, c, lv); px(o.x, y + k, c, lv); }
      px(o.x, y, P.W, lv);
    }
    rallyOn(t, o); onEach(o, t, rallyOn);
  }
  function uBloomAir(t, o) {
    if (t >= 0 && t < 0.9) for (let i = 0; i < 10; i++) {                 // 渦を巻いて昇る葉
      const b = t - i * 0.04; if (b < 0 || b > 0.7) continue;
      const a = i * TAU / 10 + b * 6, r = 12 - b * 8, x = o.x + Math.cos(a) * r, y = o.y - 3 - b * 26 + Math.sin(a) * r * 0.4;
      px(x, y, P.lf1); px(x + 1, y, P.lf2); if (i % 3 === 0) px(x, y - 1, P.lf4);
    }
    bloomOn(t, o); onEach(o, t, bloomOn);
  }

  /* ---------- 大技：裂天（空が裂け、画面内の敵それぞれへ紫の雷） ---------- */
  function uRuinGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 0.8, 'arcane', 1.9, o.charge || 0);
    for (let k = 0; k < 2; k++) { const b = t - k * 0.1; if (b >= 0 && b < 0.4) ellRing(o.x, o.y, 20 + b * 320, (20 + b * 320) * 0.5, b < 0.08 ? P.W : k ? P.ar2 : P.ar0, 0.8 * (1 - b / 0.4)); }
    if (t >= 0 && t < 0.6) lightPool(o.x, o.y, 44, t < 0.12 ? 1 : 0.5 * (1 - t / 0.6), 'arcane');
    (o.targets || []).forEach(([x, y], i) => ruinHitGround(t - 0.1 - i * 0.05, { x, y }));
  }
  function skyRift(cx, top, t) {                                          // 空の裂け目（横にぎざぎざに開いて閉じる）
    if (t < 0 || t > 0.7) return;
    const open = t < 0.12 ? t / 0.12 : t < 0.45 ? 1 : 1 - (t - 0.45) / 0.25, half = 70 * easeOut(clamp(t / 0.15));
    let py = top + 6;
    for (let x = -half; x <= half; x += 3) {
      const y = top + 6 + (hash(Math.round(x / 3) + 50, 655) - 0.5) * 6, g = Math.max(0, open * (3 - Math.abs(x) / half * 3));
      line(cx + x - 3, py, cx + x, y, P.W, open);
      for (let k = 1; k <= g; k++) { px(cx + x, y - k, P.ar0, open); px(cx + x, y + k, k > 1 ? P.ar2 : P.ar1, open); }
      py = y;
    }
  }
  function uRuinAir(t, o) {
    const [bx, by] = body(o), top = o.skyY != null ? o.skyY : 0;
    if (t >= 0 && t < 0.3) {                                              // 本人から天へ抜ける太い柱
      const w = t < 0.08 ? 3 : t < 0.18 ? 2 : 1, lv = t < 0.18 ? 1 : 1 - (t - 0.18) / 0.12;
      for (let dx = -w - 1; dx <= w + 1; dx++) line(bx + dx, by - 6, bx + dx, top, Math.abs(dx) <= w - 1 ? P.W : Math.abs(dx) === w ? P.ar0 : P.ar2, lv);
      if (t < 0.1) { plus(bx, by - 8, P.W, 6); disc(bx, by - 8, 3, P.ar0); }
    }
    skyRift(bx, top, t - 0.04);
    for (let i = 0; i < 16; i++) {                                        // 裂け目から降る光の粒
      const b = t - 0.08 - hash(i, 656) * 0.4; if (b < 0 || b > 0.5) continue;
      px(bx + (hash(i, 657) - 0.5) * 120, top + 8 + b * 140, b < 0.2 ? P.W : P.ar1, 1 - b / 0.5);
    }
    (o.targets || []).forEach(([x, y], i) => ruinHitAir(t - 0.1 - i * 0.05, { x, y, skyY: o.skyY }));
  }
  function ruinHitGround(t, o) {
    if (t < 0 || t > 1.0) return;
    magicCircle(o.x, o.y + 1, t + 0.3, 0.35, 'arcane', 0.8, 0.3);
    groundRing(o.x, o.y, t, 22, 0.32, RAMP.arcane, 0.5);
    cracks(o.x, o.y, t, 7, 11, 651, 0.14, 1.0, P.ar0, P.ar2);
    if (t < 0.3) lightPool(o.x, o.y, 22, t < 0.08 ? 1 : 0.5, 'arcane');
  }
  function ruinHitAir(t, o) {
    if (t < 0 || t > 0.6) return;
    const top = o.skyY != null ? o.skyY : o.y - 80, x = o.x, y = o.y - 6, fr = Math.floor(t * 24) & 1, seed = Math.round(x * 13 + y);
    if (t < 0.16) {                                                       // 太い雷（白い芯＋紫の縁2段）と枝
      const core = t < 0.06 ? P.W : P.ar0;
      boltPath(x, y, top, seed, fr, (a, c, d, e) => { line(a - 2, c, d - 2, e, P.ar3); line(a + 2, c, d + 2, e, P.ar3); line(a - 1, c, d - 1, e, P.ar1); line(a + 1, c, d + 1, e, P.ar1); line(a, c, d, e, core); });
      boltPath(x + 8 - fr * 16, y - 20, top + 30, seed + 7, fr, (a, c, d, e) => line(a, c, d, e, P.ar1, 0.8));
    } else if (t < 0.4) {                                                 // 残光の柱（網掛けで薄れる）
      const lv = 0.7 * (1 - (t - 0.16) / 0.24);
      for (let k = y; k > top; k--) { px(x, k, P.ar1, lv); px(x - 1, k, P.ar2, lv * 0.6); px(x + 1, k, P.ar2, lv * 0.6); }
    }
    if (t < 0.1) { plus(x, y, P.W, 6); disc(x, y, 3 - t * 20, P.W); }
    spark(x, y, t, RAMP.arcane, 652, 12, 1.4);
    if (t < 0.35) { ring(x, y, 3 + t * 50, rampAt(RAMP.arcane, t / 0.35), 1 - t / 0.35); ring(x, y, 2 + t * 28, P.W, 0.6 * (1 - t / 0.35)); }
    for (let i = 0; i < 6; i++) {                                         // 跳ね上がる石くず
      const b = t - 0.02; if (b < 0 || b > 0.5) continue;
      const a = hash(i, 658) * Math.PI + Math.PI, sp = 30 + hash(i, 659) * 30;
      px(x + Math.cos(a) * sp * b, o.y - 2 + Math.sin(a) * sp * b + 120 * b * b, i & 1 ? P.st1 : P.ar2);
    }
  }

  /* ============ 仲間の大技（Lv.50） ============ */
  function aSpinGround(t, o) { groundRing(o.x, o.y, t - 0.06, o.R, 0.34, RAMP.dust, 0.5); cracks(o.x, o.y, t - 0.04, 6, 8, 661, 0.08, 0.7, P.ho0, P.ho2); }
  function aSpinAir(t, o) { const [bx, by] = body(o); slash(bx, by, o.R * 0.85, o.ang + 0.5, o.ang + 0.5 - TAU * 1.02, 7, 0.78, [P.W, P.ho1, P.ho3], t, 0.32, 662); }

  function bulwarkOn(t, p) {
    if (t < 0 || t > 1.3) return;
    const lv = t < 1.0 ? 1 : 1 - (t - 1.0) / 0.3, pop = t < 0.1 ? -3 : t < 0.2 ? -1 : 0, ox = p.x - 3, oy = p.y - 24 + pop;
    SHIELD_ICON.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(ox + x, oy + y, ch === 'a' ? P.ag3 : ch === 'b' ? P.ag1 : P.W, lv); }));
    if (t < 0.12) plus(p.x, p.y - 21, P.W, 3);
  }
  const aBulwarkGround = supportGround('aegis', RAMP.aegis);
  function aBulwarkAir(t, o) { bulwarkOn(t, o); onEach(o, t, bulwarkOn); }

  function aRainGround(t, o) { bwrainGround(t, o); }
  function aRainAir(t, o) { bwrainAir(t, o); }

  /* 焦土（置き型・6秒）：燃える円 */
  function aFieldGround(t, o) {
    if (t < 0 || t > o.life + 0.3) return;
    const R = o.R, fade = t > o.life ? 1 - (t - o.life) / 0.3 : clamp(t / 0.15), fr = Math.floor(t * 12);
    ellRing(o.x, o.y, R, R * 0.5, (fr & 1) ? P.fi2 : P.fi3, fade);
    ellRing(o.x, o.y, R - 3, (R - 3) * 0.5, P.fi4, 0.7 * fade, 24, t * 3);
    lightPool(o.x, o.y, R * 0.9, 0.55 * fade, 'fire');
    for (let i = 0; i < 24; i++) {                                       // 焦げ跡
      const a = hash(i, 671) * TAU, r = Math.sqrt(hash(i, 672)) * R * 0.9;
      px(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.5, (i & 1) ? P.fi5 : P.sm0, 0.8 * fade);
    }
  }
  function aFieldAir(t, o) {
    if (t < 0 || t > o.life + 0.3) return;
    const R = o.R, k1 = Math.floor(Math.min(t, o.life) * 26), fr = Math.floor(t * 12);
    for (let k = Math.max(0, k1 - 13); k <= k1; k++) {
      const a = t - k / 26; if (a < 0 || a > 0.5) continue;
      const ang = hash(k, 673) * TAU, r = Math.sqrt(hash(k, 674)) * R * 0.85, f = a / 0.5;
      flamePuff(o.x + Math.cos(ang) * r, o.y + Math.sin(ang) * r * 0.5 - 2 - f * 10, f < 0.3 ? 2 : 1, Math.min(5, Math.floor(f * 6)), (fr + k) % 3 - 1);
    }
  }

  function aVanishGround(t, o) { dgmirageGround(t, o); }
  function aVanishAir(t, o) { dgmirageAir(t, o); }

  function graceOn(t, p) { rallyOn(t, p); }
  const aGraceGround = supportGround('heal', RAMP.heal);
  function aGraceAir(t, o) { graceOn(t, o); onEach(o, t, graceOn); }

  /* 聖域（置き型・8秒）：大きな金の陣と光の柱 */
  function aSanctGround(t, o) {
    if (t < 0 || t > o.life + 0.3) return;
    const R = o.R, fade = t > o.life ? 1 - (t - o.life) / 0.3 : clamp(t / 0.2), tq = q12(t), fr = Math.floor(t * 12);
    ellRing(o.x, o.y, R, R * 0.5, t < 0.12 ? P.W : P.ho1, fade);
    ellRing(o.x, o.y, R - 3, (R - 3) * 0.5, P.ho3, 0.8 * fade, 32, tq * 1.5);
    ellRing(o.x, o.y, R * 0.55, R * 0.27, (fr & 1) ? P.ho1 : P.ho2, 0.8 * fade, 16, -tq * 2);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + tq * 0.5, x = Math.round(o.x + Math.cos(a) * (R - 7)), y = Math.round(o.y + Math.sin(a) * (R - 7) * 0.5), g = RUNES[i & 3];
      for (let j = 0; j < 9; j++) if (g[j]) px(x - 1 + (j % 3), y - 1 + Math.floor(j / 3), P.ho0, fade);
    }
    lightPool(o.x, o.y, R, 0.35 * fade, 'holy');
  }
  function aSanctAir(t, o) {
    if (t < 0 || t > o.life + 0.3) return;
    const R = o.R, fade = t > o.life ? 1 - (t - o.life) / 0.3 : 1, fr = Math.floor(t * 12);
    for (let i = 0; i < 4; i++) {                                         // 陣の四方に立つ光の柱
      const a = i * TAU / 4 + Math.PI / 4, x = Math.round(o.x + Math.cos(a) * R), y = Math.round(o.y + Math.sin(a) * R * 0.5), h = 22 + ((fr + i) % 3) * 2;
      for (let k = 0; k < h; k++) px(x, y - k, k < 3 ? P.W : P.ho0, fade * (1 - k / h));
      if ((fr + i) & 1) px(x - 1, y - h * 0.5, P.ho1, fade);
    }
    for (let i = 0; i < 10; i++) {
      const t0 = (i * 0.37) % 1.2, a = (t % 1.2) - t0; if (a < 0 || a > 0.8) continue;
      const ang = hash(i, 681) * TAU, r = Math.sqrt(hash(i, 682)) * R * 0.8;
      px(o.x + Math.cos(ang) * r, o.y + Math.sin(ang) * r * 0.5 - a * 24, a < 0.3 ? P.W : P.ho1, fade * (1 - a / 0.8));
    }
  }

  /* ============ スキル技 ============ */
  /* 衝撃波：前へ広がる弧の波（通常攻撃とは別の形） */
  function sWaveGround(t, o) {
    const half = (o.arc || 1.5) / 2, p = clamp(t / 0.3), d = 10 + (o.R - 10) * easeOut(p);
    if (t >= 0 && t < 0.4) for (let k = -3; k <= 3; k++) { const a = o.ang + k / 3 * half; dust(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * 0.9, t * 0.8, 1, 690 + k, 3, 0.35); }
    if (t >= 0 && t < 0.5) lightPool(o.x + Math.cos(o.ang) * o.R * 0.5, o.y + Math.sin(o.ang) * o.R * 0.5, o.R * 0.5, 0.4 * (1 - t / 0.5), 'frost');
  }
  function sWaveAir(t, o) {
    if (t < 0 || t > 0.45) return;
    const [bx, by] = body(o), half = (o.arc || 1.5) / 2, p = clamp(t / 0.3), d = 10 + (o.R - 10) * easeOut(p);
    slash(bx, by, 14, o.ang - 1.2, o.ang + 1.1, 5, 0.78, [P.W, P.fr0, P.cy1], t, 0.16, 691);
    const lv = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4 - (t > 0.3 ? (t - 0.3) / 0.15 : 0);
    if (lv <= 0) return;
    const n = Math.round(d * half * 2.2);
    for (let i = 0; i <= n; i++) {
      const a = o.ang - half + (i / n) * half * 2, e = Math.abs(i / n - 0.5) * 2;
      for (let w = 0; w < 3; w++) {
        const r = d - w, x = bx + Math.cos(a) * r, y = by + Math.sin(a) * r * 0.78;
        if (e > 0.85 && w > 0) continue;
        px(x, y, w === 0 ? P.W : w === 1 ? P.fr0 : P.cy1, lv * (e > 0.7 ? 0.6 : 1));
      }
    }
  }
  /* 瞬足：短い踏み込み */
  function sDashGround(t, o) {
    dust(o.x, o.y, t, 4, 701, 6, 0.35);
    if (t >= 0 && t < 0.2) ellRing(o.x, o.y + 1, 4 + t * 30, 2 + t * 12, t < 0.08 ? P.W : P.hl1, 1 - t / 0.2);
  }
  function sDashAir(t, o) {
    const [bx, by] = body(o), [ux, uy] = dirv(o), L = o.R;
    speedLines(bx, by + 2, bx + ux * L, by + uy * L + 2, t, 0.3, 4, 702, [P.W, P.hl0, P.hl1]);
    for (let k = 0; k < 4; k++) {                                          // 通り道に残る足跡の粒
      const s = L * (k + 0.5) / 4, b = t - 0.2 * (s / L); if (b < 0 || b > 0.25) continue;
      px(o.x + ux * s, o.y + uy * s, P.hl1, 1 - b / 0.25); px(o.x + ux * s + 1, o.y + uy * s, P.hl0, 1 - b / 0.25);
    }
  }
  /* 不屈：空から光が降り、立ち上がる */
  function sReviveGround(t, o) {
    magicCircle(o.x, o.y + 1, t, 1.0, 'holy', 1.5, o.charge || 0);
    groundRing(o.x, o.y, t - 0.1, 40, 0.5, RAMP.holy, 0.5);
  }
  function sReviveAir(t, o) {
    if (t < 0 || t > 1.3) return;
    const [bx] = body(o), top = o.skyY != null ? o.skyY : o.y - 90;
    if (t < 0.45) {
      const w = t < 0.1 ? 3 : t < 0.25 ? 2 : 1;
      for (let y = Math.round(o.y - 2); y > top; y--) for (let dx = -w; dx <= w; dx++) px(bx + dx, y, Math.abs(dx) === w ? P.ho1 : P.W, t < 0.25 ? 1 : 0.6);
    }
    if (t < 0.1) { plus(bx, o.y - 8, P.W, 6); disc(bx, o.y - 8, 3, P.ho0); }
    for (let i = 0; i < 10; i++) {                                          // 舞い落ちる羽と、昇る光の粒
      const b = t - 0.1 - hash(i, 711) * 0.4; if (b < 0 || b > 0.8) continue;
      const x = bx + (hash(i, 712) - 0.5) * 30 + Math.sin(b * 8 + i) * 3;
      if (i & 1) { const y = o.y - 40 + b * 40; px(x, y, P.W, 1 - b / 0.8); px(x + 1, y + 1, P.ho0, 1 - b / 0.8); }
      else px(x, o.y - 4 - b * 30, P.ho1, 1 - b / 0.8);
    }
  }
  /* 治癒：回復した瞬間に小さな十字 */
  function sRegenGround(t, o) { if (t >= 0 && t < 0.3) ellRing(o.x, o.y + 1, 6 + t * 12, 2 + t * 5, P.hl1, 1 - t / 0.3); }
  function sRegenAir(t, o) { for (let i = 0; i < 3; i++) { const b = t - i * 0.08; if (b < 0 || b > 0.6) continue; healCross(o.x + (i - 1) * 5, o.y - 8 - b * 16, b < 0.2 ? P.hl0 : P.hl1, 1 - b / 0.6); } }

  /* ============ 効いている間の足元の輪（守護・鉄壁・生気・聖域・恩寵） ============ */
  const AURA_COL = { ward: [P.hl1, P.hl0], aegis: [P.ag1, P.ag0], bloom: [P.lf2, P.lf1], sanct: [P.ho1, P.ho0], grace: [P.hl0, P.W] };
  function auraGround(t, o) {
    const c = AURA_COL[o.aura] || AURA_COL.ward, tq = q12(t), r = 8 + (o.ring || 0) * 2;
    ellRing(o.x, o.y + 1, r, Math.max(2, Math.round(r * 0.4)), c[0], 0.9, 10, tq * 1.5);
  }
  function auraAir(t, o) {
    const c = AURA_COL[o.aura] || AURA_COL.ward, cyc = t % 0.9, a = hash(Math.floor(t / 0.9), 721) * TAU;
    if (cyc < 0.6) px(o.x + Math.cos(a) * 6, o.y - 2 - cyc * 14, c[1], 1 - cyc / 0.6);
  }

  /* ============================================================
     ボスの攻撃（5F 灰の大蛙 ／ 10F 空引きのヴェラ・礫の狩人ヴェラ）
     **予兆（赤い円・扇・帯）は本編がそのまま描く。** ここで描くのは
     「溜めている間の本体まわり」と「当たった瞬間」だけで、形は当たり判定と同じ
     （円は円のまま。床の遠近でつぶさない）。
     o.x,o.y はボスの中心（本編の e.x,e.y と同じ所）。
     ============================================================ */
  const ASH_DUST = [P.as1, P.as3, P.as4];
  const STONE_DUST = [P.st0, P.st1, P.st2];

  /* 中心基準で絵を描く（ボスは中心が座標。16px の見本キャラは足元基準なので別にする） */
  function drawSprite(key, cx, cy, st = {}) {
    const s = SPR[key], H = s.map.length, Wd = s.map[0].length, face = st.face || 1;
    const left = Math.round(cx - Wd / 2), top = Math.round(cy - H / 2 - (st.z || 0) + (st.dy || 0)), lv = st.ghost || 1;
    const sq = st.squash || 0;                                        // 叩きつけた瞬間に横へつぶす
    for (const [x, y, c] of s.body.concat(s.stf)) {
      const fx = face > 0 ? x : Wd - 1 - x, yy = sq ? Math.round(H - 1 - (H - 1 - y) * (1 - sq * 0.25)) : y;
      const xx = sq ? Math.round(Wd / 2 + (fx - Wd / 2) * (1 + sq * 0.15)) : fx;
      px(left + xx, top + yy, st.flash ? P.W : c, lv);
    }
  }
  const embers = (x, y, b, seed, n, spreadX, spreadY) => {
    for (let i = 0; i < n; i++) {
      const bb = b - hash(i, seed) * 0.2; if (bb < 0 || bb > 0.6) continue;
      const ex = x + (hash(i, seed + 1) - 0.5) * spreadX + Math.sin(bb * 9 + i) * 2, ey = y + (hash(i, seed + 2) - 0.5) * spreadY - bb * 36;
      px(ex, ey, ((Math.floor(bb * 12) + i) & 1) ? P.fi2 : P.fi3, 1 - bb / 0.6);
    }
  };

  /* ---------- 灰の大蛙：溜め（喉がふくらむ間、灰が吸い込まれ、床が震える） ---------- */
  function btChargeGround(t, o) {
    if (t < 0) return;
    for (let k = 0; k < 8; k++) {
      const b = t - k * 0.16; if (b < 0 || b > 0.4) continue;
      const a = hash(k, 801) * TAU, r = 14 + hash(k, 802) * 12;
      dust(o.x + Math.cos(a) * r, o.y + 6 + Math.sin(a) * r * 0.5, b, 2, 803 + k, 5, 0.4, ASH_DUST);
    }
  }
  function btChargeAir(t, o) {
    if (t < 0) return;
    const life = o.life || 0.8, p = clamp(t / life), fr = Math.floor(t * 12);
    for (let i = 0; i < 18; i++) {
      const ph = (t * 1.5 + hash(i, 811)) % 1, r = (38 - 32 * ph) * (0.8 + 0.3 * hash(i, 812)), a = hash(i, 813) * TAU + ph * 1.4;
      const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r * 0.75, lv = (ph < 0.2 ? ph / 0.2 : 1) * (0.45 + 0.55 * p);
      px(x, y, ph > 0.7 ? P.as0 : P.as2, lv); if (i % 3 === 0) px(x + 1, y, P.as3, lv);
    }
    if (p > 0.7 && (fr & 1)) ring(o.x, o.y, 8 + (1 - p) * 30, P.as1, 0.7);
  }

  /* ---------- 灰の大蛙：叩きつけ（円。灰の輪・ひび・噴き上がる灰の柱・燃えさし） ---------- */
  function ashBurstGround(t, o, R, seed, big) {
    if (t < 0 || t > 1.2) return;
    if (t < 0.32) {
      const r = R * easeOut(clamp(t / 0.1)), lv = 1 - t / 0.32;
      ring(o.x, o.y, r, t < 0.06 ? P.W : P.as0, lv); ring(o.x, o.y, r - 1, P.as2, 0.8 * lv); ring(o.x, o.y, r - 3, P.as3, 0.5 * lv);
    }
    if (t < 0.9) disc(o.x, o.y, R * 0.5, P.as5, 0.35 * (1 - t / 0.9));                   // 焦げ
    cracks(o.x, o.y, t, big > 1 ? 10 : 6, R * 0.7, seed, 0.1, 1.0, P.as0, P.as4);
    const n = big > 1 ? 14 : 7;                                                         // 主人公が隠れないよう、煙は薄め
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i, seed + 1) * 0.3, rr = R * (0.72 + 0.28 * hash(i, seed + 2));
      dust(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, t - 0.03 - hash(i, seed + 3) * 0.08, 2, seed + 10 + i, 8 * big, 0.8, ASH_DUST, 1.0 + 0.3 * big, 0.6);
    }
  }
  function ashBurstAir(t, o, R, seed, big) {
    if (t < 0 || t > 1.0) return;
    if (t < 0.08) { plus(o.x, o.y, P.W, 3 + 3 * big); disc(o.x, o.y, 2 + big, P.as0); }
    for (let k = 0; k < 4 + 4 * big; k++) {                                            // 噴き上がる灰の柱
      const b = t - k * 0.03; if (b < 0 || b > 0.7) continue;
      const f = b / 0.7, y = o.y - 3 - k * 5 - f * 12, r = (2.5 + k * 0.4) * (1 + f) * (0.7 + 0.3 * big);
      disc(o.x + (hash(k, seed + 4) - 0.5) * 6, y, r, k < 2 ? P.as2 : P.as3, 0.6 * (1 - f));
      disc(o.x + (hash(k, seed + 4) - 0.5) * 6 - r * 0.3, y - r * 0.4, r * 0.5, P.as1, 0.45 * (1 - f));
    }
    for (let i = 0; i < 8 + 6 * big; i++) {                                             // 飛ぶ小石
      const b = t - 0.02; if (b < 0 || b > 0.5) continue;
      const a = hash(i, seed + 5) * TAU, sp = (40 + hash(i, seed + 6) * 50) * (0.6 + 0.4 * big);
      px(o.x + Math.cos(a) * sp * b, o.y + Math.sin(a) * sp * b * 0.7 - 60 * b + 170 * b * b, (i & 1) ? P.as2 : P.as4);
    }
    embers(o.x, o.y, t - 0.05, seed + 7, 6 + 5 * big, R * 1.3, R * 0.8);
  }
  const btSlamGround = (t, o) => ashBurstGround(t, o, o.R, 820, 2);
  const btSlamAir = (t, o) => ashBurstAir(t, o, o.R, 840, 2);

  /* ---------- 灰の大蛙：薙ぎ払い（扇。舌で薙ぎ、灰の三日月と土煙） ---------- */
  function tongue(x0, y0, a, L, lv = 1) {
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    for (let s = 5; s < L; s++) {
      const x = x0 + ca * s, y = y0 + sa * s;
      px(x, y, P.tg0, lv); px(x + nx, y + ny, P.tg1, lv); px(x - nx, y - ny, P.tg1, lv);
      if (s % 3 === 0) { px(x + nx * 2, y + ny * 2, P.tg2, lv); px(x - nx * 2, y - ny * 2, P.tg2, lv); }
    }
    disc(x0 + ca * L, y0 + sa * L, 2.5, P.tg1, lv); disc(x0 + ca * L - 1, y0 + sa * L - 1, 1.2, P.tg0, lv);
  }
  function btCleaveGround(t, o) {
    const R = o.R, h = o.arc || 1.3, a0 = o.ang - h, a1 = o.ang + h;
    for (let k = 0; k < 12; k++) {
      const a = a0 + (a1 - a0) * k / 11, b = t - 0.12 * k / 11;
      dust(o.x + Math.cos(a) * R * 0.88, o.y + Math.sin(a) * R * 0.88, b, 2, 860 + k, 6, 0.7, ASH_DUST, 1.1, 0.65);
    }
    for (let k = 0; k < 5; k++) {                                                       // 床を擦った跡
      const a = a0 + (a1 - a0) * (k + 0.5) / 5, b = t - 0.12 * (k + 0.5) / 5; if (b < 0 || b > 0.8) continue;
      const lv = b < 0.3 ? 0.8 : 0.8 * (1 - (b - 0.3) / 0.5);
      for (let s = R * 0.35; s < R * 0.85; s += 2) px(o.x + Math.cos(a) * s, o.y + Math.sin(a) * s, P.as4, lv);
    }
  }
  function btCleaveAir(t, o) {
    const R = o.R, h = o.arc || 1.3, a0 = o.ang - h, a1 = o.ang + h;
    slash(o.x, o.y, R * 0.9, a0, a1, 9, 1, [P.as0, P.as2, P.as4], t, 0.14, 850);
    if (t >= 0 && t < 0.2) {
      const a = a0 + (a1 - a0) * easeOut(clamp(t / 0.063)), L = R * 0.9 * (t < 0.14 ? 1 : 1 - (t - 0.14) / 0.06);   // 斬り跡（slash）の先端と同じ速さ
      tongue(o.x, o.y - 2, a, L);
    }
    embers(o.x + Math.cos(o.ang) * R * 0.6, o.y + Math.sin(o.ang) * R * 0.6, t - 0.08, 870, 6, R, R * 0.6);
  }

  /* ---------- 灰の大蛙：落石（＝飲み込んだ灰の塊を吐き出す。溜めの終わりに弧を描いて落ちる） ---------- */
  function btSpitGround(t, o) {                                                         // 着弾点の影
    const L = o.life || 1, f = clamp((t - (L - 0.5)) / 0.5);
    if (f > 0) disc(o.x, o.y, 2 + f * 6, P.as5, 0.25 + 0.45 * f);
  }
  function btSpitAir(t, o) {
    const L = o.life || 1, f = (t - (L - 0.5)) / 0.5; if (f < 0 || f > 1 || o.cx == null) return;
    const pos = g => { const x = o.cx + (o.x - o.cx) * g, y = o.cy - 6 + (o.y + 6 - o.cy) * g - 55 * 4 * g * (1 - g); return [x, y]; };
    for (let k = 3; k >= 1; k--) { const g = f - k * 0.05; if (g < 0) continue; const [x, y] = pos(g); disc(x, y, 2.5 - k * 0.4, P.as3, 0.8 - k * 0.2); }
    const [x, y] = pos(f);
    disc(x, y, 3.5, P.as4); disc(x - 1, y - 1, 2, P.as2); px(x - 1, y - 2, P.as0); px(x + 1, y + 1, (Math.floor(t * 12) & 1) ? P.fi2 : P.fi3);
  }
  const btPillarGround = (t, o) => ashBurstGround(t, o, o.R, 880, 1);
  const btPillarAir = (t, o) => ashBurstAir(t, o, o.R, 890, 1);

  /* ---------- 灰の大蛙：通常攻撃（舌を突き出す） ---------- */
  function btJabAir(t, o) {
    if (t < 0 || t > 0.24) return;
    const L = Math.max(10, o.R) * (t < 0.06 ? easeOut(t / 0.06) : t < 0.1 ? 1 : 1 - (t - 0.1) / 0.14);
    tongue(o.x, o.y - 2, o.ang, L);
    if (t >= 0.05 && t < 0.12) plus(o.x + Math.cos(o.ang) * o.R, o.y - 2 + Math.sin(o.ang) * o.R, P.W, 2);
  }
  function btJabGround(t, o) { dust(o.x + Math.cos(o.ang) * o.R, o.y + 4 + Math.sin(o.ang) * o.R, t - 0.06, 3, 895, 6, 0.4, ASH_DUST); }

  /* ================= ヴェラ ================= */
  const isStone = o => o.kind === 'stone';
  /* 溜め（貫き）：弓を引く。形の無い矢が光で組み上がる／石の槍に礫が集まる */
  function bvChargeGround(t, o) {
    if (t < 0) return;
    if (isStone(o)) return rockChargeGround(t, o);
    const fr = Math.floor(t * 12);
    ellRing(o.x, o.y + 8, 9, 3, isStone(o) ? P.st1 : ((fr & 1) ? P.vg2 : P.vg3), 0.7, 10, q12(t) * 2);
  }
  function bvChargeAir(t, o) {
    if (t < 0) return;
    if (isStone(o)) return rockChargeAir(t, o);
    const life = o.life || 0.7, p = clamp(t / life), [ux, uy] = dirv(o), nx = -uy, ny = ux, fr = Math.floor(t * 12);
    const bx = o.x + ux * 8, by = o.y - 2 + uy * 8, stone = isStone(o);
    for (let k = -6; k <= 6; k++) {                                                    // 弓
      const bend = (1 - (k / 6) * (k / 6)) * 3;
      px(bx + nx * k + ux * bend, by + ny * k + uy * bend, stone ? P.st0 : P.vg2);
    }
    const nock = 2 + 6 * easeOut(p), kx = bx - ux * nock, ky = by - uy * nock;
    line(bx + nx * 6, by + ny * 6, kx, ky, stone ? P.st1 : P.vg1); line(bx - nx * 6, by - ny * 6, kx, ky, stone ? P.st1 : P.vg1);
    const len = 4 + 12 * p;                                                             // 組み上がる矢
    for (let s = 0; s < len; s++) px(kx + ux * s, ky + uy * s, stone ? (s > len - 3 ? P.st0 : P.st1) : (s > len - 3 ? P.W : P.vg0), stone ? 1 : 0.6 + 0.4 * p);
    for (let i = 0; i < 14; i++) {                                                     // 集まる光／礫
      const ph = (t * 1.8 + hash(i, 901)) % 1, r = 26 * (1 - ph), a = hash(i, 902) * TAU + ph;
      const x = kx + Math.cos(a) * r, y = ky + Math.sin(a) * r * 0.8, lv = (ph < 0.25 ? ph / 0.25 : 1) * (0.4 + 0.6 * p);
      if (stone) { px(x, y, P.st1, lv); px(x + 1, y, P.st2, lv); px(x, y - 1, P.st0, lv); } else px(x, y, ph > 0.6 ? P.W : P.vg1, lv);
    }
    if (p > 0.78 && (fr & 1)) plus(kx + ux * len, ky + uy * len, P.W, 2);
  }

  /* 貫き：12マスの帯を一瞬で走る（空引き＝光の矢／礫＝石の槍と砂利） */
  function bvBeamGround(t, o) {
    if (isStone(o)) return boulderGround(t, o);
    const [ux, uy] = dirv(o), L = o.R, stone = isStone(o);
    for (let s = 12; s < L; s += 12) {
      const b = t - 0.1 * (s / L);
      dust(o.x + ux * s, o.y + uy * s + 4, b, stone ? 3 : 2, 910 + s, stone ? 8 : 5, 0.6, stone ? STONE_DUST : null, stone ? 1.3 : 0.9);
    }
  }
  function bvBeamAir(t, o) {
    if (isStone(o)) return boulderAir(t, o);
    if (t < 0 || t > 0.8) return;
    const [ux, uy] = dirv(o), nx = -uy, ny = ux, L = o.R, Wd = Math.max(4, o.wide || 10), stone = isStone(o), hs = L * easeOut(clamp(t / 0.1));
    const ox = o.x + ux * 6, oy = o.y - 2 + uy * 6;
    const core = stone ? P.st0 : P.W, c1 = stone ? P.st1 : P.vg0, c2 = stone ? P.st2 : P.vg1, edge = stone ? P.vg2 : P.vg2;
    for (let s = 0; s <= hs; s++) {
      const as = t - 0.1 * (s / L); if (as > 0.5) continue;
      const lv = as < 0.12 ? 1 : 1 - (as - 0.12) / 0.38, x = ox + ux * s, y = oy + uy * s;
      const cw = as < 0.06 ? 2 : 1, bw = Math.round(Wd * (as < 0.1 ? 1 : 0.55));
      px(x, y, core, lv);
      for (let k = 1; k <= bw; k++) {                                                   // 白い芯から外へ、色も網掛けも薄く
        const f = k / bw, c = k <= cw ? c1 : k === bw ? edge : f < 0.45 ? c2 : stone ? P.st2 : P.vg2;
        const l2 = k <= cw ? lv : lv * (k === bw ? 0.9 : 0.85 - 0.55 * f);
        if (k === bw && (s + Math.floor(t * 24)) % 3) continue;
        px(x + nx * k, y + ny * k, c, l2); px(x - nx * k, y - ny * k, c, l2);
      }
    }
    if (t < 0.12) {                                                                     // 矢じり
      const hx = ox + ux * hs, hy = oy + uy * hs;
      for (let j = 0; j < 7; j++) { const w = Math.round((7 - j) * 0.7); for (let k = -w; k <= w; k++) px(hx - ux * j + nx * k, hy - uy * j + ny * k, j < 2 ? P.W : stone ? P.st0 : P.vg0); }
      plus(hx, hy, P.W, 2);
    }
    for (let q = 1; q <= 3; q++) {                                                     // 帯に直交する衝撃の輪
      const f = q / 4, b = t - 0.1 * f; if (b < 0 || b > 0.3) continue;
      const cx = ox + ux * L * f, cy = oy + uy * L * f, ra = 2 + b * 16, rb = Wd + 2 + b * 50, lv = 1 - b / 0.3;
      for (let i = 0; i < 40; i++) {
        const a = i * TAU / 40, u = Math.cos(a) * ra, v = Math.sin(a) * rb;
        px(cx + ux * u + nx * v, cy + uy * u + ny * v, b < 0.08 ? P.W : c2, lv);
      }
    }
    for (let i = 0; i < 20; i++) {                                                     // はがれる羽根／砂利
      const s = L * hash(i, 921), b = t - 0.1 * (s / L); if (b < 0 || b > 0.45) continue;
      const side = hash(i, 922) < 0.5 ? -1 : 1, off = 3 + b * (stone ? 20 : 40);
      const x = ox + ux * (s - b * 30) + nx * off * side, y = oy + uy * (s - b * 30) + ny * off * side + (stone ? 90 * b * b : 0);
      px(x, y, stone ? ((i & 1) ? P.st1 : P.st2) : ((i & 1) ? P.vg1 : P.vg0), 1 - b / 0.45);
      if (stone && (i % 3 === 0)) px(x + 1, y, P.st0, 1 - b / 0.45);
    }
    if (t < 0.12) { plus(ox, oy, P.W, 5); ring(ox, oy, 3 + t * 80, c2, 1 - t / 0.12); }   // 放った瞬間
    const b = t - 0.1;                                                                  // 帯の終わり
    if (b >= 0) { const ex = ox + ux * L, ey = oy + uy * L; spark(ex, ey, b, stone ? RAMP.stone : RAMP.ghost, 930, 12, 1.3); if (b < 0.2) ring(ex, ey, 3 + b * 60, c2, 1 - b / 0.2); }
  }

  /* 散弾：弓を空へ鳴らし、全方位へ形の無い矢（礫）を撒く。1本ずつは bv_arrow */
  function bvReleaseAir(t, o) {
    if (isStone(o)) return rockBurstAir(t, o);
    if (t < 0 || t > 0.4) return;
    const stone = isStone(o), n = 14, lv = 1 - t / 0.4;
    if (t < 0.08) { plus(o.x, o.y - 2, P.W, 5); disc(o.x, o.y - 2, 2, stone ? P.st0 : P.vg0); }
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, r0 = 6 + t * 30, r1 = r0 + 8;
      line(o.x + Math.cos(a) * r0, o.y - 2 + Math.sin(a) * r0, o.x + Math.cos(a) * r1, o.y - 2 + Math.sin(a) * r1, (i & 1) ? (stone ? P.st0 : P.vg1) : P.W, lv);
    }
    ring(o.x, o.y - 2, 4 + t * 70, stone ? P.st1 : P.vg2, lv);
  }
  function bvReleaseGround(t, o) { if (isStone(o)) rockBurstGround(t, o); }
  function bvArrowAir(t, o) {
    const a = o.ang, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, x = o.x, y = o.y, fr = Math.floor(t * 24);
    if (isStone(o)) {                                                                   // 礫：回りながら飛ぶ岩と砂の尾
      for (let k = 1; k <= 3; k++) px(x - ux * (3 + k * 3), y - uy * (3 + k * 3) + k, P.st2, 0.7 - k * 0.18);
      rock(x, y, 3, fr >> 1, 1, 0.9);
      return;
    }
    for (let s = 0; s < 10; s++) px(x - ux * s, y - uy * s, s < 4 ? P.W : P.vg1, s < 7 ? 1 : 0.6);
    px(x + ux, y + uy, P.W); px(x + nx, y + ny, P.vg0); px(x - nx, y - ny, P.vg0);          // 矢じり
    for (let k = 1; k <= 2; k++) { px(x - ux * (9 + k) + nx * k, y - uy * (9 + k) + ny * k, P.vg2); px(x - ux * (9 + k) - nx * k, y - uy * (9 + k) - ny * k, P.vg2); }
    for (let k = 1; k <= 3; k++) px(x - ux * (12 + k * 3), y - uy * (12 + k * 3), P.vg2, 0.8 - k * 0.2);   // 残像
  }

  /* 波動（礫の狩人）：輪の先で岩の棘が床から突き出し、通り過ぎると崩れて石くずが跳ねる。**円のまま**（当たり判定と同じ） */
  function bvWaveGround(t, o) {
    const R = o.R, maxR = (o.life || 9) * TILE, fade = clamp(1 - Math.pow(R / maxR, 3));
    if (R <= 0 || fade <= 0) return;
    ring(o.x, o.y, R + 1, P.st3, 0.7 * fade);                                            // 割れていく床の線
    const n = Math.max(10, Math.floor(TAU * R / 6));
    for (let i = 0; i < n; i++) {                                                       // 通り過ぎた跡の瓦礫
      const a = i * TAU / n + hash(i, 951) * 0.2, r = R - 5 - hash(i, 952) * 7;
      if (r <= 2) continue;
      const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
      px(x, y, P.st2, 0.8 * fade); if (i & 1) px(x + 1, y, P.st3, 0.8 * fade);
      if (i % 4 === 0) disc(x, y - 1, 1.5, P.st1, 0.35 * fade);
    }
  }
  function bvWaveAir(t, o) {
    const R = o.R, maxR = (o.life || 9) * TILE, fade = clamp(1 - Math.pow(R / maxR, 3));
    if (R <= 0 || fade <= 0) return;
    const n = Math.max(10, Math.floor(TAU * R / 7)), fr = Math.floor(t * 12);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i, 961) * 0.2, x = Math.round(o.x + Math.cos(a) * R), y = Math.round(o.y + Math.sin(a) * R);
      const h = (4 + hash(i, 962) * 6) * fade * (((fr + i) % 4) === 0 ? 0.7 : 1);         // 輪の先の岩の棘
      rockSpike(x, y, h, 2);
      if (i % 3 === 0) px(x, y - h - 1, P.vg1, fade);
      const b = (t * 3 + hash(i, 963)) % 1, bx = o.x + Math.cos(a) * (R - 3 - b * 6), by = o.y + Math.sin(a) * (R - 3 - b * 6) - 10 * b + 18 * b * b;   // 跳ねる石くず
      if (i % 2 === 0) { px(bx, by, P.st1, fade); px(bx + 1, by, P.st2, fade); }
    }
  }

  /* 落石（礫の狩人・激昂）：ヴェラが床から岩を引き剥がして投げる。弧を描いて落ち、砕ける */
  function bvRockGround(t, o) {
    const L = o.life || 1, f = clamp((t - (L - 0.55)) / 0.55);
    if (f > 0) { disc(o.x, o.y, 2 + f * 8, P.st3, 0.25 + 0.45 * f); if (f > 0.7) ring(o.x, o.y, 10 - f * 4, P.st2, 0.6); }
  }
  function bvRockAir(t, o) {
    const L = o.life || 1, f = (t - (L - 0.55)) / 0.55; if (f < 0 || f > 1) return;
    const sx = o.cx != null ? o.cx : o.x - 60, sy = o.cy != null ? o.cy : o.y;
    const pos = g => [sx + (o.x - sx) * g, sy - 10 + (o.y + 4 - sy + 10) * g - 70 * 4 * g * (1 - g)];
    for (let k = 1; k <= 3; k++) { const g = f - k * 0.06; if (g < 0) continue; const [x, y] = pos(g); px(x, y, P.st2, 0.8 - k * 0.2); px(x + 1, y + 1, P.st3, 0.6 - k * 0.15); }
    const [x, y] = pos(f);
    rock(x, y, 5 + 2 * Math.sin(Math.PI * f), Math.floor(t * 10), 1, 1);
  }
  function bvRockHitGround(t, o) {
    if (t < 0 || t > 1.2) return;
    const R = o.R;
    if (t < 0.3) { const r = R * easeOut(clamp(t / 0.08)), lv = 1 - t / 0.3; ring(o.x, o.y, r, t < 0.06 ? P.W : P.st0, lv); ring(o.x, o.y, r - 2, P.st2, 0.6 * lv); }
    if (t < 1.1) disc(o.x, o.y, R * 0.4, P.st3, 0.45 * (1 - t / 1.1));               // くぼみ
    cracks(o.x, o.y, t, 8, R * 0.85, 970, 0.1, 1.1, P.vg1, P.st2);
    for (let i = 0; i < 7; i++) {                                                     // 残る岩のかけら
      const a = hash(i, 974) * TAU, r = R * (0.3 + 0.5 * hash(i, 975)), b = t - 0.05; if (b < 0) continue;
      const lv = b < 0.7 ? 1 : 1 - (b - 0.7) / 0.4; if (lv <= 0) continue;
      rock(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r, 1.6 + hash(i, 976) * 1.4, i, lv, 0);
    }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + hash(i, 971) * 0.3, rr = R * (0.6 + 0.3 * hash(i, 972)); dust(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, t - 0.03, 2, 973 + i, 7, 0.7, STONE_DUST, 1.1, 0.55); }
  }
  function bvRockHitAir(t, o) {
    if (t < 0 || t > 0.8) return;
    if (t < 0.08) { plus(o.x, o.y, P.W, 6); disc(o.x, o.y, 3, P.st0); }
    for (let i = 0; i < 10; i++) {                                                     // 砕けて跳ぶ岩
      const b = t - 0.01; if (b > 0.65) continue;
      const a = hash(i, 981) * TAU, sp = 30 + hash(i, 982) * 45, x = o.x + Math.cos(a) * sp * b, y = o.y + Math.sin(a) * sp * b * 0.7 - 80 * b + 220 * b * b;
      rock(x, y, 1.2 + hash(i, 983) * 1.8, Math.floor(t * 12) + i, 1, 0);
    }
  }

  /* ================= 礫の狩人（第二形態）：岩を投げる ================= */
  /* 岩ひとつ。光は左上から固定、輪郭だけが回る（転がって見える）。rim＝ヴェラの青白い縁取り */
  function rock(cx, cy, r, rot, lv = 1, rim = 0.8) {
    if (r < 0.8) { px(cx, cy, P.st1, lv); return; }
    const ri = Math.ceil(r) + 1, lx = -0.6, ly = -0.8;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), bucket = Math.floor(((a / TAU + 1) * 6 + rot * 0.5)) % 6;
      const rr = r * (0.78 + 0.22 * hash(bucket, 991 + (rot & 3)));                     // ごつごつした輪郭（6面）
      if (d > rr) continue;
      const sh = d < 0.5 ? 0.3 : (dx * lx + dy * ly) / d * (d / rr);
      let c = sh > 0.45 ? P.st0 : sh > 0.05 ? P.st1 : sh > -0.45 ? P.st2 : P.st3;
      if (d > rr - 1) c = sh > 0.3 && rim ? P.vg1 : P.st4;
      if (((dx + dy + rot) & 7) === 0 && d < rr - 1.5) c = P.st3;                       // 割れ目
      px(cx + dx, cy + dy, c, c === P.vg1 ? lv * rim : lv);
    }
  }
  /* 溜め：床から岩が浮き上がって周りを回り、前に構えた大岩へ寄り集まる */
  function rockChargeGround(t, o) {
    for (let k = 0; k < 6; k++) {                                                     // 岩が抜けた床の穴と土煙
      const b = t - k * 0.1; if (b < 0) continue;
      const a = hash(k, 1001) * TAU, r = 12 + hash(k, 1002) * 10, x = o.x + Math.cos(a) * r, y = o.y + 6 + Math.sin(a) * r * 0.5;
      disc(x, y, 2, P.st4, 0.6); dust(x, y, b, 2, 1003 + k, 4, 0.4, STONE_DUST, 0.8, 0.6);
    }
  }
  function rockChargeAir(t, o) {
    const life = o.life || 0.7, p = clamp(t / life), [ux, uy] = dirv(o);
    const hx = o.x + ux * 10, hy = o.y - 6 + uy * 10;                                    // 構えた大岩の位置
    for (let k = 0; k < 6; k++) {
      const b = t - k * 0.1; if (b < 0) continue;
      const a0 = hash(k, 1001) * TAU, r0 = 12 + hash(k, 1002) * 10;
      const sx = o.x + Math.cos(a0) * r0, sy = o.y + 6 + Math.sin(a0) * r0 * 0.5;
      const rise = clamp(b / 0.25), orbit = a0 + b * 5, gather = clamp((p - 0.55) / 0.45);
      let x = sx + Math.cos(orbit) * 3 * rise, y = sy - 14 * easeOut(rise);
      x += (hx - x) * gather; y += (hy - y) * gather;
      if (gather < 1) rock(x, y, 1.6 + hash(k, 1004) * 1.2, Math.floor(t * 8) + k, 1, 0.6);
    }
    rock(hx, hy, 1.5 + 6.5 * clamp((p - 0.45) / 0.55), Math.floor(t * 6), 1, 1);
    if (p > 0.8 && (Math.floor(t * 12) & 1)) plus(hx - 3, hy - 4, P.vg0, 1);
  }
  /* 貫き：大岩を投げる。回りながら帯をまっすぐ飛び、道の床を削り、小岩が後を追い、終わりで砕ける */
  const BOULDER_T = 0.2;
  function boulderGround(t, o) {
    const [ux, uy] = dirv(o), nx = -uy, ny = ux, L = o.R, Wd = Math.max(4, o.wide || 10);
    for (let s = 10; s < L; s += 3) {                                                 // 削れた床（帯の中だけ）
      const b = t - BOULDER_T * (s / L); if (b < 0 || b > 1.0) continue;
      const lv = b < 0.5 ? 0.8 : 0.8 * (1 - (b - 0.5) / 0.5), j = (hash(s, 1011) - 0.5) * Wd * 0.6;
      px(o.x + ux * s + nx * j, o.y + 4 + uy * s + ny * j, P.st3, lv); px(o.x + ux * s + nx * (j + 1), o.y + 4 + uy * s + ny * (j + 1), P.st4, lv * 0.7);
    }
    for (let s = 14; s < L; s += 14) dust(o.x + ux * s, o.y + 6 + uy * s, t - BOULDER_T * (s / L), 3, 1012 + s, 7, 0.6, STONE_DUST, 1.2, 0.55);
    const b = t - BOULDER_T;                                                          // 終わりで砕けた跡
    if (b >= 0) bvRockHitGround(b, { x: o.x + ux * L, y: o.y + uy * L, R: Wd + 6 });
  }
  function boulderAir(t, o) {
    if (t < 0 || t > 1.0) return;
    const [ux, uy] = dirv(o), nx = -uy, ny = ux, L = o.R, Wd = Math.max(4, o.wide || 10), f = clamp(t / BOULDER_T);
    const x0 = o.x + ux * 10, y0 = o.y - 6 + uy * 10;
    if (t < 0.1) { plus(x0, y0, P.W, 4); ring(x0, y0, 4 + t * 90, P.st1, 1 - t / 0.1); }
    if (f < 1) {
      const d = L * f, x = x0 + ux * d, y = y0 + uy * d + 6 * f;                      // 大岩（少し沈みながら飛ぶ）
      for (let k = 1; k <= 5; k++) {                                                  // 速さの筋
        const bx = x - ux * k * 5, by = y - uy * k * 5;
        px(bx + nx * 5, by + ny * 5, P.st2, 0.8 - k * 0.14); px(bx - nx * 5, by - ny * 5, P.st2, 0.8 - k * 0.14); px(bx, by + 6, P.vg2, 0.6 - k * 0.1);
      }
      rock(x, y, 9, Math.floor(t * 30), 1, 1);
    }
    for (let i = 0; i < 6; i++) {                                                     // 後を追う小岩（帯の幅の中）
      const g = clamp((t - 0.03 - i * 0.02) / BOULDER_T); if (g <= 0 || g >= 1) continue;
      const j = (hash(i, 1021) - 0.5) * Wd * 1.4, d = L * g;
      rock(x0 + ux * d + nx * j, y0 + uy * d + ny * j + 6 * g, 1.8 + hash(i, 1022) * 1.2, Math.floor(t * 24) + i, 1, 0.5);
    }
    const b = t - BOULDER_T;
    if (b >= 0) bvRockHitAir(b, { x: x0 + ux * L, y: y0 + uy * L + 6 });
  }
  /* 散弾：足元の岩盤を砕いて全方位へ投げる。1個ずつは bv_arrow（kind:'stone'）の岩 */
  function rockBurstGround(t, o) {
    if (t < 0 || t > 0.9) return;
    if (t < 0.25) { const r = 6 + t * 80, lv = 1 - t / 0.25; ring(o.x, o.y + 4, r, P.st1, lv); }
    cracks(o.x, o.y + 4, t, 8, 14, 1031, 0.08, 0.9, P.vg1, P.st2);
    dust(o.x, o.y + 6, t, 7, 1032, 16, 0.6, STONE_DUST, 1.2, 0.6);
  }
  function rockBurstAir(t, o) {
    if (t < 0 || t > 0.5) return;
    if (t < 0.08) { plus(o.x, o.y, P.W, 5); disc(o.x, o.y, 3, P.st0); }
    for (let i = 0; i < 10; i++) {                                                    // 割れて舞う岩片
      const a = hash(i, 1033) * TAU, sp = 20 + hash(i, 1034) * 30;
      rock(o.x + Math.cos(a) * sp * t, o.y + Math.sin(a) * sp * t * 0.7 - 50 * t + 150 * t * t, 1.2 + hash(i, 1035), i + Math.floor(t * 12), 1 - t / 0.5, 0);
    }
  }

  /* ---------- 見本シーン用：予兆（本編の赤い図形の代わりにドットで） ---------- */
  function teleFill(test, x0, y0, x1, y1, p) {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      const k = test(x, y); if (!k) continue;
      if (k === 2) px(x, y, P.wr0, 0.6 + 0.4 * p); else px(x, y, P.wr1, k > 1 ? 0.45 + 0.3 * p : 0.18 + 0.3 * p);
    }
  }
  function teleCircle(cx, cy, R, p) {
    teleFill((x, y) => { const d = Math.hypot(x - cx, y - cy); return d > R ? 0 : d > R - 1.2 || Math.abs(d - R * p) < 0.7 ? 2 : 1; }, cx - R, cy - R, cx + R, cy + R, p);
  }
  function teleFan(cx, cy, R, a, h, p) {
    teleFill((x, y) => { const d = Math.hypot(x - cx, y - cy), da = Math.abs(norm(Math.atan2(y - cy, x - cx) - a + Math.PI) - Math.PI); if (d > R || da > h) return 0;
      return d > R - 1.2 || da > h - 1.2 / Math.max(d, 1) || Math.abs(d - R * p) < 0.7 ? 2 : 1; }, cx - R, cy - R, cx + R, cy + R, p);
  }
  function teleBand(cx, cy, a, L, Wd, p) {
    const ux = Math.cos(a), uy = Math.sin(a);
    teleFill((x, y) => { const s = (x - cx) * ux + (y - cy) * uy, w = Math.abs(-(x - cx) * uy + (y - cy) * ux); if (s < 0 || s > L || w > Wd) return 0;
      return w > Wd - 1.2 || s > L - 1.2 ? 2 : s < L * p ? 1.5 : 1; }, cx - L - Wd, cy - L - Wd, cx + L + Wd, cy + L + Wd, p);
  }

  /* ============================================================
     技の一覧（見本シーンの配置・段取り・当たりの時刻）
     ============================================================ */
  const T16 = v => Math.round(v * TILE);
  // 当たりの時刻を返す小道具。戻り値は [{t, k:押し返し, z:打ち上げ, src:[x,y]}]
  const H = {
    ring(times, dur, a0Off, sweepSign) {
      return (o, e) => {
        const [bx, by] = body(o), d = Math.hypot(e[0] - bx, (e[1] - 6 - by) / 0.78);
        if (d > o.R + 8) return [];
        const ae = Math.atan2((e[1] - 6 - by) / 0.78, e[0] - bx), k = clamp(norm((ae - (o.ang + a0Off)) * sweepSign) / TAU);
        return times.map(t0 => ({ t: t0 + 0.45 * dur * (1 - Math.sqrt(1 - k)), k: 2 }));
      };
    },
    cone(times, extra = 0.04, k = 1.5) {
      return (o, e) => {
        const d = Math.hypot(e[0] - o.x, e[1] - o.y), a = Math.abs(((Math.atan2(e[1] - o.y, e[0] - o.x) - o.ang + Math.PI * 3) % TAU) - Math.PI);
        return d <= o.R + 8 && a <= 1.1 ? times.map(t0 => ({ t: t0 + extra, k })) : [];
      };
    },
    line(times, T, lin, wide = 8, k = 1.5) {
      return (o, e) => {
        const [ux, uy] = dirv(o), s = (e[0] - o.x) * ux + (e[1] - o.y) * uy, off = Math.abs(-(e[0] - o.x) * uy + (e[1] - o.y) * ux);
        if (s < 0 || s > o.R + 6 || off > wide) return [];
        const f = clamp(s / o.R), dt = lin ? T * f : T * (1 - Math.sqrt(1 - f));
        return times.map(t0 => ({ t: t0 + dt, k }));
      };
    }
  };

  const MAGIC = { collapse: 'arcane', stflame: 'fire', sticicle: 'frost', stbolt: 'shock', mcheal: 'heal', mcshield: 'holy',
                  u_blaze: 'fire', u_ruin: 'arcane', u_ward: 'heal', u_aegis: 'aegis', u_rally: 'heal', u_bloom: 'leaf',
                  a_field: 'fire', a_bulwark: 'aegis', a_grace: 'heal', a_sanct: 'holy', s_revive: 'holy' };
  /* 通常攻撃の見本：振り＋当たり（近接）／放つ＋飛ぶ＋当たり（弓・杖） */
  function nMelee(kind, caster, label, rTiles, enemies) {
    return { group: 'normal', label, who: '通常攻撃（' + kind + '）', caster, kind, castAt: 0.25, span: 0.3, loop: 0.95, charge: 0.08, recover: [0.2, 0.35], pose: 'melee', swings: [0],
      cx: 50, cy: 66, ang: 0, R: T16(rTiles), enemies,
      hits: (o, e) => Math.hypot(e[0] - o.x, e[1] - o.y) <= o.R + 12 ? [{ t: kind === 'dagger' ? 0.04 : 0.06, k: 1.5 }].concat(kind === 'dagger' ? [{ t: 0.11, k: 1 }] : []) : [],
      ground: swingGround,
      air(t, o) { swingAir(t, o); (o.targets || []).forEach((e, i) => { for (const h of this.hits(o, e)) hitAir(t - h.t, { x: e[0], y: e[1] - 6, elem: o.elem, seed: i }); }); } };
  }
  const SHOT_TRAVEL = 0.22;
  function nShot(kind, shot, caster, label, enemies, elems, note) {
    const gap = elems.length > 1 ? 0.28 : 0;
    const d = { group: 'normal', label, who: note || '通常攻撃（' + kind + '）', caster, kind, castAt: 0.3, span: 0.3, loop: 0.7 + gap * elems.length + 0.5, charge: 0.1, recover: [0.25 + gap * elems.length, 0.4 + gap * elems.length],
      pose: kind === 'magicbolt' ? 'thrust' : 'melee', swings: elems.map((_, i) => i * gap), cx: 26, cy: 70, ang: 0, R: T16(6), enemies, ramp: 'arcane', rimCol: P.ar1,
      hits: (o, e, i) => [{ t: i * gap + SHOT_TRAVEL, k: 1 }],
      ground() {},
      air(t, o) {
        const [bx, by] = body(o);
        (o.targets || []).forEach((e, i) => {
          const tt = t - i * gap, elem = elems[i] || elems[0], ang = Math.atan2(e[1] - 6 - by, e[0] - bx);
          swingAir(tt, { ...o, ang, elem });
          if (tt >= 0 && tt < SHOT_TRAVEL) { const f = tt / SHOT_TRAVEL; shotAirN(tt, { x: bx + (e[0] - bx) * f, y: by + (e[1] - 6 - by) * f, ang, kind: shot, elem }); }
          hitAir(tt - SHOT_TRAVEL, { x: e[0], y: e[1] - 6, elem, seed: i });
        });
      } };
    return d;
  }
  /* 支える大技の見本：本人＋仲間2人 */
  function uSupport(label, id, ramp, rimCol, ground, air, who, group = 'ult', caster = 'warrior') {
    return { group, label, who: (group === 'ult' ? '大技・' : '') + who, caster, ramp, rimCol, castAt: 0.5, span: 1.4, loop: 2.4, charge: 0.35, recover: [0.6, 1.0], pose: caster === 'priest' ? 'high' : 'melee', swings: [0],
      cx: 80, cy: 62, ang: 0, R: T16(2.6), enemies: [], allies: [['hunter', 46, 78], ['mage', 116, 80]], hits: () => [], ground, air };
  }

  /* ボスの見本：本体は中心基準で大きく描き、狙われる側（主人公）を置く。t<0 が溜め（予兆） */
  function bossScene(d) {
    return Object.assign({ group: 'boss', boss: true, castAt: d.charge + 0.15, span: 1, recover: [0.6, 1.0], ang: 0, enemies: [], hits: () => [] }, d);
  }
  function burstTele(o, p) {                                   // 散弾の予兆（本編と同じ放射の線）
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; line(o.x + Math.cos(a) * 12, o.y + Math.sin(a) * 12, o.x + Math.cos(a) * (12 + 35 * p), o.y + Math.sin(a) * (12 + 35 * p), P.wr0, 0.5 + 0.5 * p); }
    bvChargeAir(p * 0.5, { ...o, life: 0.5 });
  }
  function burstArrows(t, o, n) {
    for (let i = 0; i < n; i++) { const a = i / n * TAU + hash(i, 999) * 0.25, d = 10 + t * 90; if (d > 110) continue; bvArrowAir(t, { x: o.x + Math.cos(a) * d, y: o.y - 2 + Math.sin(a) * d, ang: a, kind: o.kind }); }
  }
  const DEFS = {
    /* ---- 大魔導士 ---- */
    collapse: {
      group: 'archmage', label: '崩落', who: '大魔導士 Lv.50 の専用技', caster: 'archmage', ramp: 'cyan', rimCol: P.cy1,
      castAt: 0.75, span: 2.0, loop: 3.1, charge: 0.45, recover: [0.6, 1.3], pose: 'high',
      cx: 24, cy: 84, target: [106, 66], R: T16(3.0), status: 'arcane',
      enemies: [[93, 52], [124, 74], [100, 88], [130, 48]],
      hits: (o, e) => Math.hypot(e[0] - o.x, e[1] - o.y) <= o.R + 6 ? [{ t: COLLAPSE_IMPACT, k: 4, z: 6, zt: 0.32, src: [o.x, o.y] }] : [],
      ground: collapseGround, air: collapseAir
    },
    /* ---- 杖 ---- */
    stflame: {
      group: 'staff', label: 'フレイム', who: '杖 lv1', caster: 'mage', ramp: 'fire', rimCol: P.fi2,
      castAt: 0.55, span: 3.1, loop: 3.9, charge: 0.25, recover: [2.5, 2.8], life: 2.5, pose: 'thrust',
      cx: 30, cy: 70, ang: 0, R: T16(3.6), arc: 35 * Math.PI / 180, status: 'burn',
      enemies: [[76, 56], [92, 70], [80, 86]],
      hits: (o, e) => { const gx = o.x + 6, gy = o.y - 9, a = Math.atan2(e[1] - gy, e[0] - gx);
        if (Math.hypot(e[0] - gx, e[1] - gy) > o.R + 4 || Math.abs(a - o.ang) > o.arc + 0.08) return [];
        const out = []; for (let k = 0; 0.18 + k * 0.4 <= o.life; k++) out.push({ t: 0.18 + k * 0.4, k: 0 }); return out; },
      ground: flameGround, air: flameAir
    },
    sticicle: {
      group: 'staff', label: 'アイシクルエッジ', who: '杖 lv2', caster: 'mage', ramp: 'frost', rimCol: P.fr1,
      castAt: 0.6, span: 1.35, loop: 2.45, charge: 0.3, recover: [0.45, 0.9], pose: 'thrust',
      cx: 22, cy: 74, ang: 0, R: T16(5.5), status: 'chill',
      enemies: [[68, 76], [102, 72]],
      hits: (o, e) => ICE_PASSES.map((tp, n) => ({ t: passTime(tp, e[0] - o.x, o.R), k: n === 2 ? 4 : 2 })),
      ground: iceGround, air: iceAir
    },
    stbolt: {
      group: 'staff', label: 'ライトニング', who: '杖 lv3', caster: 'mage', ramp: 'shock', rimCol: P.sh1,
      castAt: 0.6, span: 3.9, loop: 4.3, charge: 0.3, recover: [3.0, 3.3], life: 3.0, pose: 'high',
      cx: 80, cy: 64, R: T16(3.2), status: 'shock',
      enemies: [[46, 44], [118, 52], [112, 94], [50, 92], [86, 26]],
      hits: (o, e, i) => (o._strikes || []).filter(s => s[3] && s[4] === i).map(s => ({ t: s[0], k: 1 })),
      ground: boltGround, air: boltAir
    },
    /* ---- 剣 ---- */
    iai: {
      group: 'sword', label: '居合', who: '剣 lv1', caster: 'warrior', castAt: 0.35, span: 0.6, loop: 1.8, charge: 0.2, recover: [0.25, 0.6], pose: 'dash',
      cx: 22, cy: 72, ang: 0, R: T16(3.4), enemies: [[52, 70], [66, 76], [118, 56]],
      hits: H.line([0.07], 0.001, true, 9, 3), ground: iaiGround, air: iaiAir
    },
    swspin: {
      group: 'sword', label: '回転斬り', who: '剣 lv2', caster: 'warrior', castAt: 0.35, span: 0.45, loop: 1.8, charge: 0.2, recover: [0.3, 0.55], pose: 'spin', spinEnd: 0.3,
      cx: 80, cy: 64, ang: 0, R: T16(2.7), enemies: [[50, 56], [108, 52], [104, 84], [58, 86]],
      hits: H.ring([0], 0.3, 0.6, -1), ground: swspinGround, air: swspinAir
    },
    swmulti: {
      group: 'sword', label: '多段斬り', who: '剣 lv3', caster: 'warrior', castAt: 0.35, span: 0.6, loop: 1.9, charge: 0.2, recover: [0.45, 0.75], pose: 'melee', swings: MULTI,
      cx: 50, cy: 68, ang: 0, R: T16(2.0), enemies: [[76, 62], [80, 78]],
      hits: H.cone(MULTI, 0.05, 1.5), ground: swmultiGround, air: swmultiAir
    },
    /* ---- 大剣 ---- */
    gtspin: {
      group: 'great', label: '大回転斬り', who: '大剣 lv1', caster: 'knight', castAt: 0.4, span: 0.7, loop: 2.1, charge: 0.25, recover: [0.55, 0.85], pose: 'spin', spinEnd: 0.54, shake: [[0.05, 1], [0.27, 1]],
      cx: 80, cy: 62, ang: 0, R: T16(3.2), enemies: [[40, 58], [120, 56], [98, 96], [62, 32]],
      hits: (o, e) => [...H.ring([0], 0.32, 0.4, -1)(o, e), ...H.ring([0.22], 0.32, 1.2, -1)(o, e)].map(h => ({ ...h, k: 2.5 })),
      ground: gtspinGround, air: gtspinAir
    },
    gtquake: {
      group: 'great', label: '地走り', who: '大剣 lv2', caster: 'knight', castAt: 0.4, span: 1.1, loop: 2.3, charge: 0.25, recover: [0.2, 0.6], pose: 'melee', swings: [0], shake: [[0.05, 2]],
      cx: 22, cy: 68, ang: 0, R: T16(5.0), enemies: [[70, 58], [96, 76], [90, 46]],
      hits: (o, e) => { const s = Math.hypot(e[0] - o.x, e[1] - o.y); return H.cone([0])(o, e).length ? [{ t: 0.06 + QUAKE_T * (1 - Math.sqrt(Math.max(0, 1 - s / o.R))), k: 4, z: 5, zt: 0.25 }] : []; },
      ground: gtquakeGround, air: gtquakeAir
    },
    gtupper: {
      group: 'great', label: 'レイジングアッパー', who: '大剣 lv3', caster: 'knight', castAt: 0.4, span: 0.8, loop: 2.2, charge: 0.25, recover: [0.25, 0.6], pose: 'melee', swings: [0], shake: [[0.12, 2]],
      cx: 48, cy: 72, ang: 0, R: T16(2.6), target: 0, enemies: [[82, 70], [120, 56]],
      hits: (o, e, i) => i === 0 ? [{ t: 0.12, k: 5, z: 26, zt: 0.6 }] : [],
      ground: gtupperGround, air: gtupperAir
    },
    /* ---- 短剣 ---- */
    dgslash: {
      group: 'dagger', label: '乱斬り', who: '短剣 lv1', caster: 'rogue', castAt: 0.3, span: 0.5, loop: 1.6, charge: 0.15, recover: [0.35, 0.6], pose: 'melee', swings: DGS,
      cx: 56, cy: 66, ang: 0, R: T16(1.7), enemies: [[80, 62], [82, 74]],
      hits: H.cone(DGS, 0.04, 1), ground: dgslashGround, air: dgslashAir
    },
    dgdance: {
      group: 'dagger', label: 'ダンシングソード', who: '短剣 lv2（実機は6秒）', caster: 'rogue', castAt: 0.3, span: 6.3, loop: 3.4, charge: 0.15, recover: [2.6, 2.8], life: 2.6, pose: 'melee', swings: [0],
      cx: 80, cy: 62, ang: 0, R: T16(1.9), enemies: [[46, 56], [112, 70], [84, 92]],
      hits: (o, e) => { const [bx, by] = body(o), ae = Math.atan2((e[1] - 4 - by) / 0.62, e[0] - bx), out = [];
        if (Math.hypot(e[0] - bx, (e[1] - 4 - by) / 0.62) > o.R + 14) return out;
        for (let n = 0; n < 4; n++) { const t = (norm(ae) + n * TAU) / DANCE_W; if (t < o.life) out.push({ t, k: 1 }); } return out; },
      ground: dgdanceGround, air: dgdanceAir
    },
    dgmirage: {
      group: 'dagger', label: 'ミラージュ', who: '短剣 lv3', caster: 'rogue', castAt: 0.3, span: 2.8, loop: 3.3, charge: 0.15, recover: [2.6, 2.8], life: 2.6, pose: 'mirage',
      cx: 80, cy: 66, ang: 0, R: T16(1), enemies: [[52, 62], [108, 70]],
      hits: () => [], ground: dgmirageGround, air: dgmirageAir
    },
    /* ---- 斧 ---- */
    axtoma: {
      group: 'axe', label: 'トマホーク', who: '斧 lv1', caster: 'warrior', castAt: 0.35, span: 0.65, loop: 1.8, charge: 0.2, recover: [0.1, 0.4], pose: 'melee', swings: [0],
      cx: 20, cy: 70, ang: 0, R: T16(6.0), enemies: [[62, 70], [96, 72]],
      hits: H.line([0], TOMA_T, false, 9, 1.5), ground: axtomaGround, air: axtomaAir
    },
    axspin: {
      group: 'axe', label: 'スピンアクス', who: '斧 lv2', caster: 'warrior', castAt: 0.35, span: 0.5, loop: 1.8, charge: 0.2, recover: [0.3, 0.55], pose: 'spin', spinEnd: 0.3, shake: [[0.08, 1]],
      cx: 80, cy: 64, ang: 0, R: T16(3.0), enemies: [[46, 56], [116, 60], [100, 94], [58, 92]],
      hits: (o, e) => H.ring([0], 0.3, -0.3, 1)(o, e).map(h => ({ ...h, k: 3 })), ground: axspinGround, air: axspinAir
    },
    axspiral: {
      group: 'axe', label: 'スパイラルホーク', who: '斧 lv3', caster: 'warrior', castAt: 0.35, span: 0.8, loop: 2.0, charge: 0.2, recover: [0.4, 0.7], pose: 'melee', swings: SPIRAL,
      cx: 20, cy: 70, ang: 0, R: T16(5.0), enemies: [[70, 68], [98, 72]],
      hits: H.line(SPIRAL, SPIRAL_T, false, 10, 2), ground: axspiralGround, air: axspiralAir
    },
    /* ---- 槍 ---- */
    spswing: {
      group: 'spear', label: 'スウィング', who: '槍 lv1', caster: 'warrior', castAt: 0.35, span: 0.5, loop: 1.8, charge: 0.2, recover: [0.42, 0.6], pose: 'spin', spinEnd: 0.42,
      cx: 80, cy: 62, ang: 0, R: T16(2.9), enemies: [[42, 58], [118, 60], [84, 96], [86, 26]],
      hits: (o, e) => [...H.ring([0], 0.24, 0.5, -1)(o, e), ...H.ring([0.2], 0.24, -0.5, 1)(o, e)], ground: spswingGround, air: spswingAir
    },
    splance: {
      group: 'spear', label: 'ショットランス', who: '槍 lv2', caster: 'warrior', castAt: 0.35, span: 0.45, loop: 1.7, charge: 0.2, recover: [0.15, 0.45], pose: 'melee', swings: [0],
      cx: 14, cy: 70, ang: 0, R: T16(7.0), enemies: [[58, 70], [94, 72], [124, 68]],
      hits: H.line([0], 0.1, false, 8, 2.5), ground: splanceGround, air: splanceAir
    },
    spdragoon: {
      group: 'spear', label: 'ドラグーン', who: '槍 lv3', caster: 'warrior', castAt: 0.35, span: 1.6, loop: 2.9, charge: 0.2, recover: [1.0, 1.3], pose: 'dragoon',
      cx: 26, cy: 76, ang: 0, R: T16(6.5), target: 0, enemies: [[110, 58], [132, 74]],
      hits: (o, e, i) => i === 0 ? [{ t: DRAGOON_T, k: 3, z: 8, zt: 0.3 }] : [],
      ground: spdragoonGround, air: spdragoonAir
    },
    /* ---- 弓 ---- */
    bwrain: {
      group: 'bow', label: 'アローレイン', who: '弓 lv1', caster: 'hunter', castAt: 0.35, span: 0.4, loop: 2.6, charge: 0.2, recover: [0.25, 0.5], pose: 'melee', swings: [0],
      cx: 22, cy: 78, ang: 0, R: T16(2.6), rainAt: [104, 62], enemies: [[96, 56], [116, 66], [100, 74], [86, 64]],
      hits: (o, e) => (o._rain || []).filter(a => Math.hypot(a[1] - e[0], a[2] - e[1]) < 10).map(a => ({ t: a[0], k: 1 })),
      ground: bwrainGround, air: bwrainAir
    },
    bwrapid: {
      group: 'bow', label: '連射', who: '弓 lv2', caster: 'hunter', castAt: 0.35, span: 0.15, loop: 1.9, charge: 0.2, recover: [0.6, 0.8], pose: 'melee', swings: RAPID,
      cx: 24, cy: 70, ang: 0, R: T16(6.0), enemies: [[92, 50], [108, 70], [94, 90]],
      hits: (o, e, i) => RAPID.map((d, n) => n % 3 === i ? { t: d + SHOT_T, k: 1 } : null).filter(Boolean),
      ground: bwrapidGround, air: bwrapidAir
    },
    bwburst: {
      group: 'bow', label: 'バーストショット', who: '弓 lv3', caster: 'hunter', castAt: 0.35, span: 0.9, loop: 1.9, charge: 0.25, recover: [0.2, 0.5], pose: 'melee', swings: [0], status: 'burn',
      cx: 14, cy: 70, ang: 0, R: T16(7.5), enemies: [[70, 68], [110, 72]],
      hits: H.line([0], BURST_T, true, 8, 2), ground: bwburstGround, air: bwburstAir
    },
    /* ---- 戦鎚 ---- */
    mcdouble: {
      group: 'mace', label: 'ダブルアタック', who: '戦鎚 lv1', caster: 'knight', castAt: 0.35, span: 0.8, loop: 1.9, charge: 0.2, recover: [0.35, 0.6], pose: 'melee', swings: DOUBLE, shake: [[0.07, 1], [0.27, 1]],
      cx: 54, cy: 66, ang: 0, R: T16(2.0), enemies: [[76, 58], [78, 76]],
      hits: (o, e) => DOUBLE.map((d, i) => { const [x, y] = smashPoint(o, i); return Math.hypot(e[0] - x, e[1] - y) < 16 ? { t: d + 0.07, k: 2, z: 3, zt: 0.2 } : null; }).filter(Boolean),
      ground: mcdoubleGround, air: mcdoubleAir
    },
    mcheal: {
      group: 'mace', label: '癒し打ち', who: '戦鎚 lv2', caster: 'knight', ramp: 'heal', castAt: 0.45, span: 1.1, loop: 2.4, charge: 0.3, recover: [0.35, 0.7], pose: 'melee', swings: [0], shake: [[0.07, 1]],
      cx: 64, cy: 66, ang: 0, R: T16(2.2), healR: T16(4.0), enemies: [[84, 72]], allies: [['warrior', 34, 52], ['hunter', 38, 86]],
      hits: (o, e) => { const [x, y] = smashPoint(o, 1); return Math.hypot(e[0] - x, e[1] - y) < 18 ? [{ t: 0.07, k: 2 }] : []; },
      ground: mchealGround, air: mchealAir
    },
    mcshield: {
      group: 'mace', label: 'ホーリーシールド', who: '戦鎚 lv3', caster: 'knight', ramp: 'holy', castAt: 0.45, span: 1.45, loop: 2.4, charge: 0.3, recover: [0.25, 0.6], pose: 'high',
      cx: 80, cy: 68, ang: 0, R: T16(1), enemies: [[112, 66]],
      hits: () => [], ground: mcshieldGround, air: mcshieldAir
    },
    /* ==== 通常攻撃（武器7系統・属性5種） ==== */
    n_sword: nMelee('swordaxe', 'warrior', '剣・斧', 1.5, [[74, 64]]),
    n_great: nMelee('greatsword', 'knight', '大剣', 1.8, [[78, 60], [80, 74]]),
    n_dagger: nMelee('dagger', 'rogue', '短剣', 1.1, [[70, 66]]),
    n_hammer: nMelee('hammer', 'knight', '戦鎚', 1.6, [[76, 70]]),
    n_spear: nMelee('spear', 'warrior', '槍', 2.4, [[92, 68]]),
    n_bow: nShot('bow', 'arrow', 'hunter', '弓', [[124, 62]], ['neutral']),
    n_bolt: nShot('magicbolt', 'bolt', 'mage', '杖（魔弾）', [[120, 60]], ['arcane']),
    n_elem: nShot('magicbolt', 'bolt', 'mage', '属性ごとの当たり', [[110, 34], [124, 52], [128, 72], [118, 92], [100, 104]],
                  ['neutral', 'fire', 'shock', 'frost', 'arcane'], '無・炎・雷・氷・魔の順。剣や弓でも当たりの形は属性で決まる'),

    /* ==== 大技（主人公） ==== */
    u_quake: {
      group: 'ult', label: '地脈断', who: '大技・周囲の地脈を断ち割る', caster: 'warrior', castAt: 0.4, span: 1.0, loop: 2.2, charge: 0.3, recover: [0.4, 0.7], pose: 'melee', swings: [0], shake: [[0.02, 2], [0.2, 1]],
      cx: 80, cy: 64, ang: 0, R: T16(3.9), enemies: [[40, 56], [124, 60], [100, 86], [60, 84]],
      hits: (o, e) => { const d = Math.hypot(e[0] - o.x, (e[1] - o.y) / 0.5); return d <= o.R + 8 ? [{ t: 0.36 * (1 - Math.sqrt(Math.max(0, 1 - Math.min(1, d / o.R)))), k: 3, z: 5, zt: 0.3 }] : []; },
      ground: uQuakeGround, air: uQuakeAir
    },
    u_blink: {
      group: 'ult', label: '縮地', who: '大技・走り抜けて斬る', caster: 'warrior', castAt: 0.35, span: 1.0, loop: 2.0, charge: 0.2, recover: [0.4, 0.8], pose: 'blink', dashT: BLINK_T,
      cx: 26, cy: 70, ang: 0, R: T16(4.5), enemies: [[62, 66], [84, 74]],
      hits: H.line([0], BLINK_T, false, 10, 2), ground: uBlinkGround, air: uBlinkAir
    },
    u_blaze: {
      group: 'ult', label: '灼髄', who: '大技・前へ火柱が噴き上がる', caster: 'warrior', ramp: 'fire', rimCol: P.fi2, castAt: 0.55, span: 1.6, loop: 2.8, charge: 0.4, recover: [0.5, 0.9], pose: 'melee', swings: [0], status: 'burn',
      cx: 14, cy: 70, ang: 0, R: T16(6.5), wide: T16(1.15), enemies: [[60, 64], [92, 76], [116, 66]],
      hits: H.line([0], 0.25, true, 20, 1.5), ground: uBlazeGround, air: uBlazeAir
    },
    u_ward: uSupport('守護', 'ward', 'heal', P.hl1, uWardGround, uWardAir, '6秒〜・被ダメージを削り、状態異常を消す'),
    u_aegis: uSupport('鉄壁', 'aegis', 'aegis', P.ag1, uAegisGround, uAegisAir, '防御を掛け算する'),
    u_rally: uSupport('回帰', 'rally', 'heal', P.hl1, uRallyGround, uRallyAir, '全員をその場で回復'),
    u_bloom: uSupport('命脈', 'bloom', 'leaf', P.lf1, uBloomGround, uBloomAir, 'しばらく自動回復'),
    u_ruin: {
      group: 'ult', label: '裂天', who: '大技・空を裂き、画面内の敵すべてへ紫の雷', caster: 'warrior', ramp: 'arcane', rimCol: P.ar1, castAt: 0.55, span: 1.1, loop: 2.6, charge: 0.4, recover: [0.5, 0.9], pose: 'melee', swings: [0], status: 'arcane',
      cx: 30, cy: 76, ang: 0, R: T16(1.6), enemies: [[74, 40], [110, 58], [132, 84], [86, 96], [124, 30]],
      hits: (o, e, i) => [{ t: 0.1 + i * 0.05, k: 2 }], ground: uRuinGround, air: uRuinAir
    },
    /* ==== 仲間の大技（Lv.50） ==== */
    a_spin: {
      group: 'ally', label: '回転斬り', who: '戦士 Lv.50', caster: 'warrior', castAt: 0.35, span: 0.6, loop: 1.8, charge: 0.2, recover: [0.35, 0.6], pose: 'spin', spinEnd: 0.32, shake: [[0.06, 1]],
      cx: 80, cy: 64, ang: 0, R: T16(2.4), enemies: [[52, 56], [110, 56], [100, 84], [58, 84]],
      hits: (o, e) => H.ring([0], 0.32, 0.5, -1)(o, e).map(h => ({ ...h, k: 2.5 })), ground: aSpinGround, air: aSpinAir
    },
    a_bulwark: uSupport('守護陣', 'bulwark', 'aegis', P.ag1, aBulwarkGround, aBulwarkAir, '騎士 Lv.50・全員に3発ぶんの盾', 'ally', 'knight'),
    a_rain: {
      group: 'ally', label: '矢の雨', who: '狩人 Lv.50（25本）', caster: 'hunter', castAt: 0.35, span: 0.4, loop: 2.6, charge: 0.2, recover: [0.25, 0.5], pose: 'melee', swings: [0],
      cx: 22, cy: 78, ang: 0, R: T16(2.6), rainAt: [104, 62], enemies: [[96, 56], [116, 66], [100, 74], [86, 64]],
      hits: (o, e) => (o._rain || []).filter(a => Math.hypot(a[1] - e[0], a[2] - e[1]) < 10).map(a => ({ t: a[0], k: 1 })),
      ground: aRainGround, air: aRainAir
    },
    a_field: {
      group: 'ally', label: '焦土', who: '魔法使い Lv.50（実機は6秒）', caster: 'mage', ramp: 'fire', rimCol: P.fi2, castAt: 0.5, span: 6.3, loop: 3.4, charge: 0.3, recover: [2.4, 2.7], life: 2.4, pose: 'thrust', status: 'burn',
      cx: 24, cy: 68, ang: 0, at: [104, 68], R: T16(2.6), enemies: [[96, 60], [116, 74], [134, 58]],
      hits: (o, e) => Math.hypot(e[0] - o.x, (e[1] - o.y) / 0.5) <= o.R ? [0.2, 0.7, 1.2, 1.7, 2.2].map(t => ({ t, k: 0 })) : [],
      ground: aFieldGround, air: aFieldAir
    },
    a_vanish: {
      group: 'ally', label: '幻影', who: '盗賊 Lv.50（3秒無敵）', caster: 'rogue', castAt: 0.3, span: 3.3, loop: 3.8, charge: 0.15, recover: [3.0, 3.2], life: 3.0, pose: 'mirage',
      cx: 80, cy: 66, ang: 0, R: T16(1), enemies: [[52, 62], [108, 70]],
      hits: () => [], ground: aVanishGround, air: aVanishAir
    },
    a_grace: uSupport('恩寵', 'grace', 'heal', P.hl1, aGraceGround, aGraceAir, '僧侶 Lv.50・6秒のあいだ回復し続ける', 'ally', 'priest'),
    a_sanct: {
      group: 'ally', label: '聖域', who: '聖騎士 Lv.50（実機は8秒）', caster: 'knight', ramp: 'holy', rimCol: P.ho1, castAt: 0.5, span: 8.3, loop: 3.6, charge: 0.3, recover: [2.6, 2.9], life: 2.6, pose: 'high',
      cx: 80, cy: 66, ang: 0, R: T16(4.0), enemies: [], allies: [['hunter', 50, 58], ['mage', 108, 74]],
      hits: () => [], ground: aSanctGround, air: aSanctAir
    },
    /* ==== スキル技 ==== */
    s_wave: {
      group: 'skill', label: '衝撃波', who: 'スキル・前へ扇の波', caster: 'warrior', castAt: 0.3, span: 0.5, loop: 1.7, charge: 0.15, recover: [0.3, 0.55], pose: 'melee', swings: [0],
      cx: 34, cy: 68, ang: 0, R: T16(3.4), arc: 1.5, enemies: [[70, 56], [86, 70], [74, 86]],
      hits: (o, e) => { const d = Math.hypot(e[0] - o.x, e[1] - o.y); return d <= o.R + 8 ? [{ t: 0.3 * Math.min(1, (d - 10) / (o.R - 10)) * 0.6, k: 3 }] : []; },
      ground: sWaveGround, air: sWaveAir
    },
    s_dash: {
      group: 'skill', label: '瞬足', who: 'スキル・短い踏み込み', caster: 'warrior', castAt: 0.25, span: 0.45, loop: 1.4, charge: 0.1, recover: [0.25, 0.5], pose: 'blink', dashT: 0.2,
      cx: 40, cy: 70, ang: 0, R: T16(2.6), enemies: [],
      hits: () => [], ground: sDashGround, air: sDashAir
    },
    s_revive: {
      group: 'skill', label: '不屈', who: 'スキル・倒れても一度だけ立つ', caster: 'warrior', ramp: 'holy', rimCol: P.ho1, castAt: 0.6, span: 1.4, loop: 2.6, charge: 0.4, recover: [0.6, 1.2], pose: 'revive',
      cx: 80, cy: 72, ang: 0, R: T16(1), enemies: [[118, 66]],
      hits: () => [], ground: sReviveGround, air: sReviveAir
    },
    s_regen: {
      group: 'skill', label: '治癒', who: 'スキル・一定時間ごとに少し回復', caster: 'warrior', castAt: 0.3, span: 0.7, loop: 1.4, charge: 0.05, recover: [0.5, 0.7], pose: 'idle',
      cx: 80, cy: 68, ang: 0, R: T16(1), enemies: [],
      hits: () => [], ground: sRegenGround, air: sRegenAir
    },
    aura: {
      group: 'skill', label: '効いている間の輪', who: '守護・鉄壁・生気・聖域・恩寵が続くあいだ、各自の足元に', caster: 'knight', castAt: 0.1, span: 1e9, loop: 2.7, charge: 0.05, recover: [2.5, 2.6], pose: 'idle',
      cx: 80, cy: 60, ang: 0, R: T16(1), enemies: [], allies: [['hunter', 44, 70], ['mage', 116, 72], ['priest', 62, 92], ['rogue', 100, 94]],
      hits: () => [],
      ground: (t, o) => { const ts = t + 0.1; auraGround(ts, { x: o.x, y: o.y, aura: 'ward' }); ['aegis', 'bloom', 'sanct', 'grace'].forEach((k, i) => o.allies && o.allies[i] && auraGround(ts + i * 0.2, { x: o.allies[i][0], y: o.allies[i][1], aura: k })); },
      air: (t, o) => { const ts = t + 0.1; auraAir(ts, { x: o.x, y: o.y, aura: 'ward' }); ['aegis', 'bloom', 'sanct', 'grace'].forEach((k, i) => o.allies && o.allies[i] && auraAir(ts + i * 0.2, { x: o.allies[i][0], y: o.allies[i][1], aura: k })); }
    },


    /* ==== ボス（5F 灰の大蛙・10F ヴェラ） ==== */
    bs_toad_slam: bossScene({ label: '叩きつけ', who: '灰の大蛙（5F）・通常技', caster: 'frog', cx: 80, cy: 56, R: T16(3.55), charge: 0.85, loop: 2.5,
      allies: [['warrior', 118, 90]], pose: t => t < 0 && t > -0.25 ? { z: Math.round(8 * easeOut((t + 0.25) / 0.25)) } : t >= 0 && t < 0.12 ? { squash: 1, flash: t < 0.04 } : {},
      ground(t, o) { if (t < 0) { teleCircle(o.x, o.y, o.R, clamp((t + this.charge) / this.charge)); btChargeGround(t + this.charge, o); } else btSlamGround(t, o); },
      air(t, o) { if (t < 0) btChargeAir(t + this.charge, { ...o, life: this.charge }); else btSlamAir(t, o); } }),
    bs_toad_cleave: bossScene({ label: '薙ぎ払い', who: '灰の大蛙（5F）・通常技', caster: 'frog', cx: 38, cy: 58, R: T16(4.45), arc: 75 * Math.PI / 180, charge: 0.62, loop: 2.1,
      allies: [['warrior', 100, 74]], pose: t => t >= 0 && t < 0.1 ? { squash: 0.6 } : {},
      ground(t, o) { if (t < 0) { teleFan(o.x, o.y, o.R, o.ang, o.arc, clamp((t + this.charge) / this.charge)); btChargeGround(t + this.charge, o); } else btCleaveGround(t, o); },
      air(t, o) { if (t < 0) btChargeAir(t + this.charge, { ...o, life: this.charge }); else btCleaveAir(t, o); } }),
    bs_toad_pillars: bossScene({ label: '落石（吐き出す灰）', who: '灰の大蛙（5F）・激昂で開く', caster: 'frog', cx: 28, cy: 58, R: T16(1.7), charge: 1.05, loop: 2.8,
      spots: [[96, 44], [124, 76], [84, 90], [132, 36]], allies: [['warrior', 100, 70]], pose: t => t < 0 && t > -0.5 ? { squash: 0.3 * Math.sin((t + 0.5) * 30) } : {},
      ground(t, o) { const L = this.charge; this.spots.forEach(([x, y], i) => { if (t < 0) { teleCircle(x, y, o.R, clamp((t + L) / L)); btSpitGround(t + L, { x, y, life: L }); } else btPillarGround(t, { x, y, R: o.R }); }); if (t < 0) btChargeGround(t + L, o); },
      air(t, o) { const L = this.charge; if (t < 0) btChargeAir(t + L, { ...o, life: L }); this.spots.forEach(([x, y], i) => { if (t < 0) btSpitAir(t + L + i * 0.03, { x, y, life: L + i * 0.03, cx: o.x + 10, cy: o.y }); else btPillarAir(t, { x, y, R: o.R }); }); } }),
    bs_toad_jab: bossScene({ label: '舌（通常攻撃）', who: '灰の大蛙（5F）', caster: 'frog', cx: 46, cy: 58, R: 42, charge: 0.4, loop: 1.4,
      allies: [['warrior', 90, 66]],
      ground(t, o) { if (t >= 0) btJabGround(t, o); }, air(t, o) { if (t >= 0) btJabAir(t, o); } }),
    bs_vera_beam: bossScene({ label: '貫き', who: '空引きのヴェラ（10F・第一形態）', caster: 'vera', kind: 'ghost', cx: 18, cy: 64, R: T16(12), wide: T16(0.62), charge: 0.72, loop: 2.2,
      allies: [['warrior', 104, 70]],
      ground(t, o) { if (t < 0) { teleBand(o.x, o.y, o.ang, o.R, o.wide, clamp((t + this.charge) / this.charge)); bvChargeGround(t + this.charge, o); } else bvBeamGround(t, o); },
      air(t, o) { if (t < 0) bvChargeAir(t + this.charge, { ...o, life: this.charge }); else bvBeamAir(t, o); } }),
    bs_vera_burst: bossScene({ label: '散弾', who: '空引きのヴェラ（10F）・形の無い矢を撒く', caster: 'vera', kind: 'ghost', cx: 80, cy: 60, R: T16(1), charge: 0.5, loop: 1.9,
      allies: [['warrior', 124, 86]],
      ground(t, o) { if (t < 0) bvChargeGround(t + this.charge, o); else bvReleaseGround(t, o); },
      air(t, o) { if (t < 0) { burstTele(o, clamp((t + this.charge) / this.charge)); return; } bvReleaseAir(t, o); burstArrows(t, o, 14); } }),
    bs_vera_shot: bossScene({ label: '矢（通常攻撃）', who: '空引きのヴェラ（10F・第一形態）', caster: 'vera', kind: 'ghost', cx: 22, cy: 64, R: T16(1), charge: 0.62, loop: 1.6,
      allies: [['warrior', 132, 66]],
      ground(t, o) { if (t < 0) bvChargeGround(t + this.charge, o); },
      air(t, o) { if (t < 0) { bvChargeAir(t + this.charge, { ...o, life: this.charge }); return; } const f = t * 120; if (f < 104) bvArrowAir(t, { x: o.x + 8 + f, y: o.y - 4, ang: 0, kind: o.kind }); else hitAir(t - 0.87, { x: 132, y: 58, elem: 'frost' }); } }),
    bs_vera2_beam: bossScene({ label: '貫き（礫）', who: '礫の狩人、ヴェラ（10F・第二形態）・大岩を投げる', caster: 'vera2', kind: 'stone', cx: 18, cy: 64, R: T16(12), wide: T16(0.62), charge: 0.72, loop: 2.2, big: 2,
      allies: [['warrior', 104, 70]],
      ground(t, o) { if (t < 0) { teleBand(o.x, o.y, o.ang, o.R, o.wide, clamp((t + this.charge) / this.charge)); bvChargeGround(t + this.charge, o); } else bvBeamGround(t, o); },
      air(t, o) { if (t < 0) bvChargeAir(t + this.charge, { ...o, life: this.charge }); else bvBeamAir(t, o); } }),
    bs_vera2_burst: bossScene({ label: '散弾（礫）', who: '礫の狩人、ヴェラ（10F・第二形態）・岩盤を砕いて投げる', caster: 'vera2', kind: 'stone', cx: 80, cy: 60, R: T16(1), charge: 0.5, loop: 2.0,
      allies: [['warrior', 124, 86]],
      ground(t, o) { if (t < 0) bvChargeGround(t + this.charge, o); else bvReleaseGround(t, o); },
      air(t, o) { if (t < 0) { burstTele(o, clamp((t + this.charge) / this.charge)); return; } bvReleaseAir(t, o); burstArrows(t, o, 14); } }),
    bs_vera2_wave: bossScene({ label: '波動（礫）', who: '礫の狩人、ヴェラ（10F・第二形態）', caster: 'vera2', kind: 'stone', cx: 80, cy: 58, R: T16(4.05), charge: 0.95, loop: 3.0, big: 2,
      allies: [['warrior', 112, 88]],
      ground(t, o) { if (t < 0) { teleCircle(o.x, o.y, o.R, clamp((t + this.charge) / this.charge)); return; } const r = 18 + 83 * t; if (r < 144) bvWaveGround(t, { ...o, R: r, life: 9 }); },
      air(t, o) { if (t < 0) return; const r = 18 + 83 * t; if (t < 0.3) bvReleaseAir(t, o); if (r < 144) bvWaveAir(t, { ...o, R: r, life: 9 }); } }),
    bs_vera2_rocks: bossScene({ label: '落石（礫）', who: '礫の狩人、ヴェラ（10F）・激昂で開く・岩を投げ込む', caster: 'vera2', kind: 'stone', cx: 28, cy: 60, R: T16(1.7), charge: 1.05, loop: 2.8, big: 2,
      spots: [[96, 44], [124, 76], [84, 90], [132, 36]], allies: [['warrior', 100, 70]],
      ground(t, o) { const L = this.charge; if (t < 0) rockChargeGround(t + L, o); this.spots.forEach(([x, y]) => { if (t < 0) { teleCircle(x, y, o.R, clamp((t + L) / L)); bvRockGround(t + L, { x, y, life: L }); } else bvRockHitGround(t, { x, y, R: o.R }); }); },
      air(t, o) { const L = this.charge; if (t < 0) rockChargeAir(t + L, { ...o, life: L }); this.spots.forEach(([x, y], i) => { if (t < 0) bvRockAir(t + L + i * 0.04, { x, y, life: L + i * 0.04, cx: o.x + 8, cy: o.y - 4 }); else bvRockHitAir(t, { x, y, R: o.R }); }); } }),
    /* ---- 実機だけで使う部品（見本シーンなし） ---- */

    bt_charge: { aux: true, span: 5, ext: 44, pad: 8, sky: 20, ground: btChargeGround, air: btChargeAir },
    bt_slam: { aux: true, span: 1.2, pad: 20, sky: 60, ground: btSlamGround, air: btSlamAir },
    bt_cleave: { aux: true, span: 0.8, pad: 16, sky: 30, ground: btCleaveGround, air: btCleaveAir },
    bt_spit: { aux: true, span: 5, pad: 12, sky: 80, ground: btSpitGround, air: btSpitAir },
    bt_pillar: { aux: true, span: 1.2, pad: 20, sky: 50, ground: btPillarGround, air: btPillarAir },
    bt_jab: { aux: true, span: 0.4, pad: 12, sky: 14, ground: btJabGround, air: btJabAir },
    bv_charge: { aux: true, span: 5, ext: 40, pad: 8, sky: 16, ground: bvChargeGround, air: bvChargeAir },
    bv_beam: { aux: true, span: 1.4, pad: 24, sky: 20, ground: bvBeamGround, air: bvBeamAir },
    bv_release: { aux: true, span: 0.5, ext: 40, pad: 8, sky: 16, ground: bvReleaseGround, air: bvReleaseAir },
    bv_arrow: { aux: true, span: 1e9, ext: 24, pad: 4, sky: 4, ground() {}, air: bvArrowAir },
    bv_wave: { aux: true, span: 1e9, pad: 10, sky: 10, ground: bvWaveGround, air: bvWaveAir },
    bv_rock: { aux: true, span: 5, ext: 20, pad: 10, sky: 90, ground: bvRockGround, air: bvRockAir },
    bv_rockhit: { aux: true, span: 1.1, pad: 16, sky: 40, ground: bvRockHitGround, air: bvRockHitAir },
    n_swing: { aux: true, span: 0.3, ext: 44, pad: 8, ground: swingGround, air: swingAir },
    n_hit: { aux: true, span: 0.5, ext: 12, pad: 8, ground() {}, air: hitAir },
    n_shot: { aux: true, span: 1e9, ext: 12, pad: 6, ground() {}, air: shotAirN },
    u_ward_on: { aux: true, span: 0.8, ext: 16, pad: 8, sky: 24, ground() {}, air: wardOn },
    u_aegis_on: { aux: true, span: 1.0, ext: 16, pad: 8, sky: 20, ground() {}, air: aegisOn },
    u_rally_on: { aux: true, span: 0.9, ext: 16, pad: 8, sky: 24, ground() {}, air: rallyOn },
    u_bloom_on: { aux: true, span: 1.0, ext: 16, pad: 8, sky: 24, ground() {}, air: bloomOn },
    a_bulwark_on: { aux: true, span: 1.3, ext: 16, pad: 8, sky: 28, ground() {}, air: bulwarkOn },
    a_grace_on: { aux: true, span: 0.9, ext: 16, pad: 8, sky: 24, ground() {}, air: graceOn },
    u_ruin_hit: { aux: true, span: 1.0, ext: 24, pad: 10, sky: 110, ground: ruinHitGround, air: ruinHitAir },
    aura_on: { aux: true, span: 1e9, ext: 14, pad: 6, sky: 16, ground: auraGround, air: auraAir },
    bwshot: { aux: true, span: 0.45, ground() {}, air: bwshotAir },
    bwrain_hit: { aux: true, span: 0.5, ground() {}, air: (t, o) => rainHit(o.x, o.y, t) },
    a_rain_hit: { aux: true, span: 0.5, ground() {}, air: (t, o) => rainHit(o.x, o.y, t) },
    bwrain_arrow: { aux: true, span: 1, ground: (t, o) => rainRing(o.x, o.y, o.fall != null ? o.fall : t), air: (t, o) => rainArrow(o.x, o.y, o.fall != null ? o.fall : t) }
  };
  const GROUPS = [['archmage', '大魔導士'], ['staff', '杖'], ['sword', '剣'], ['great', '大剣'], ['dagger', '短剣'], ['axe', '斧'], ['spear', '槍'], ['bow', '弓'], ['mace', '戦鎚'], ['normal', '通常攻撃'], ['ult', '大技'], ['ally', '仲間の大技'], ['skill', 'スキル技'], ['boss', 'ボスの攻撃（5F・10F）']];

  function timeline(key) {
    const d = DEFS[key];
    const cs = d.castAt - d.charge, recS = d.castAt + d.recover[0], recE = d.castAt + d.recover[1];
    return { loop: d.loop, phases: [['IDLE', 0, cs], ['CHARGE', cs, d.castAt], ['CAST', d.castAt, recS], ['RECOVER', recS, recE], ['IDLE', recE, d.loop]] };
  }
  function phaseAt(key, ts) { for (const p of timeline(key).phases) if (ts >= p[1] && ts < p[2]) return p[0]; return 'IDLE'; }

  /* ---------- ポーズ ---------- */
  function poseFor(d, ts, o) {
    const tq = q12(ts), tc = tq - (d.castAt - d.charge), t = tq - d.castAt;
    const pose = { bob: 0, lift: 0, fwd: 0, sway: 0, rim: 0, rimCol: d.rimCol || P.W, gemFlash: 0, dx: 0, dy: 0, z: 0, ghost: 1, hidden: false, face: 1 };
    const recS = d.recover[0], recE = d.recover[1];
    const staff = d.pose === 'thrust' || (d.pose === 'high' && SPR[d.caster].stf.length);
    if (d.pose === 'idle') { pose.bob = Math.floor(tq * 4) & 1; return pose; }
    if (d.pose === 'revive') {                                              // 倒れている → 光で立つ
      if (t < 0.1) { pose.ghost = 0.45; pose.bob = 1; pose.dy = 1; return pose; }
      if (t < 0.3) { pose.z = Math.round(3 * Math.sin(Math.PI * (t - 0.1) / 0.2)); pose.rim = 1; pose.rimCol = P.ho0; return pose; }
      pose.bob = Math.floor(tq * 4) & 1; return pose;
    }
    if (tc < 0 || t > recE) { pose.bob = Math.floor(tq * 4) & 1; if ((d.pose === 'dash' || d.pose === 'blink') && t > recE) pose.dx = Math.round(o.R); return pose; }
    if (t < 0) {                                                         // 溜め
      const p = clamp(tc / d.charge);
      if (staff) { pose.lift = Math.round(3 * easeOut(p)); pose.rim = p; pose.gemFlash = (Math.floor(tq * ANIM_FPS) & 1) ? 2 : 1; }
      else { pose.bob = 1; pose.dx = -1; }
      return pose;
    }
    if (d.pose === 'blink') { const p = clamp(t / d.dashT); pose.dx = Math.round(o.R * easeOut(p)); pose.ghost = p < 1 ? ((Math.floor(t * 24) & 1) ? 0.45 : 0.75) : 1; pose.sway = p < 1 ? -1 : 0; return pose; }
    if (d.pose === 'dash') { pose.dx = Math.round(o.R * clamp(t / 0.06)); pose.sway = t < 0.2 ? -1 : 0; if (t > recS) pose.bob = Math.floor(tq * 4) & 1; return pose; }
    if (d.pose === 'spin' && t < d.spinEnd) { pose.face = (Math.floor(t * 16) & 1) ? -1 : 1; pose.bob = 1; return pose; }
    if (d.pose === 'mirage') { pose.ghost = t < d.life ? ((Math.floor(t * 12) & 1) ? 0.45 : 0.7) : 1; return pose; }
    if (d.pose === 'dragoon') {
      if (t < 0.08) { pose.z = Math.round(8 * t / 0.08); return pose; }
      if (t < DRAGOON_T) { pose.hidden = true; return pose; }
      const [lx, ly] = dragoonLanding(o); pose.dx = Math.round(lx - 10 - d.cx); pose.dy = Math.round(ly + 2 - d.cy); pose.bob = t < DRAGOON_T + 0.15 ? 1 : 0; return pose;
    }
    if (t < recS) {                                                      // 放つ
      if (staff) {
        if (d.pose === 'high') { pose.lift = 3; } else { pose.lift = 1; pose.fwd = 1; }
        pose.sway = t < 0.25 ? -1 : 0; pose.rim = (Math.floor(tq * ANIM_FPS) % 3 === 0) ? 0.7 : 1; pose.gemFlash = t < 0.25 ? 2 : 1;
        return pose;
      }
      for (const s of (d.swings || [0])) if (t >= s && t < s + 0.1) { pose.dx = 2; pose.sway = -1; }
      return pose;
    }
    const p = clamp((t - recS) / Math.max(0.01, recE - recS));             // 戻る
    if (staff) { const from = d.pose === 'high' ? 3 : 1; pose.lift = Math.round(from * (1 - p)); pose.fwd = d.pose === 'high' ? 0 : (p < 0.5 ? 1 : 0); pose.rim = 1 - p; }
    if (d.pose === 'dragoon') { const [lx, ly] = dragoonLanding(o); pose.dx = Math.round((lx - 10 - d.cx) * (1 - p)); pose.dy = Math.round((ly + 2 - d.cy) * (1 - p)); pose.ghost = p > 0.2 && p < 0.9 ? 0.5 : 1; }
    return pose;
  }

  /* ---------- 見本の敵の反応（当たりの時刻から） ---------- */
  function enemyState(d, i, e, t, o) {
    const st = { t: Math.max(0, t), flash: 0, kx: 0, ky: 0, z: 0 };
    if (t < 0) return st;
    const hs = d.hits(o, e, i);
    let first = Infinity;
    const [sx0, sy0] = [o.x, o.y];
    for (const h of hs) {
      const b = t - h.t; if (b < 0) continue;
      first = Math.min(first, h.t);
      if (b < 0.045) st.flash = 1;
      const src = h.src || [sx0, sy0], dx = e[0] - src[0], dy = e[1] - src[1], dist = Math.hypot(dx, dy) || 1, k = (h.k || 0) * easeOut(clamp(b / 0.1));
      st.kx += dx / dist * k; st.ky += dy / dist * k * 0.7;
      if (h.z) st.z = Math.max(st.z, h.z * Math.sin(Math.PI * clamp(b / (h.zt || 0.3))));
    }
    const back = clamp((t - d.recover[1] - 0.15) / 0.3);
    st.kx *= 1 - back; st.ky *= 1 - back;
    if (t >= first && t < d.recover[1] + 0.4) {
      if (d.status === 'burn') st.burn = t < (d.life || 0.6) + 0.4;
      if (d.status === 'chill') st.chill = true;
      if (d.status === 'shock') st.shock = t - first < 0.5;
      if (d.status === 'arcane') { st.shock = t - first < 0.9; st.outline = P.ar1; }
    }
    return st;
  }
  function drawSceneFloor() {
    const u = CUR.u32, W = CUR.W;
    for (let y = 0; y < CUR.h; y++) for (let x = 0; x < CUR.w; x++) {
      let c = floorTile[(y & 15) * 16 + (x & 15)];
      if (y < 10) c = FLOOR.wall; else if (y === 10) c = FLOOR.edge;
      u[y * W + x] = c;
    }
  }
  function sceneO(key, d, gx, gy) {
    const o = d._o || (d._o = {});
    Object.assign(o, { x: d.cx, y: d.cy, R: d.R, ang: d.ang || 0, arc: d.arc || 0, life: d.life || 0, gx, gy, skyY: 0, charge: d.charge,
                       targets: d.enemies, healR: d.healR, allies: d.allies ? d.allies.map(a => [a[1], a[2]]) : null, cx: null, cy: null, tx: null, ty: null,
                       kind: d.kind, elem: d.elem, wide: d.wide || 0 });
    if (d.at) { o.x = d.at[0]; o.y = d.at[1]; }
    if (key === 'collapse') Object.assign(o, { x: d.target[0], y: d.target[1], cx: d.cx, cy: d.cy });
    if (d.target === 0) { const e = d.enemies[0]; o.tx = e[0]; o.ty = e[1]; if (key === 'spdragoon') { o.tx = e[0] - 10; o.ty = e[1] + 2; } }
    if (d.rainAt) { o.tx = d.rainAt[0]; o.ty = d.rainAt[1]; if (!o._rain) o._rain = rainArrows(o); }
    if (key === 'stbolt' && !o._strikes) o._strikes = boltStrikes(o);
    return o;
  }
  /* 見本シーンを 160x112 のバッファに描いて ctx にぴったり（整数倍優先）貼る */
  function scene(ctx, key, age) {
    const d = DEFS[key]; if (!d || d.aux) return;
    const ts = ((age % d.loop) + d.loop) % d.loop, t = ts - d.castAt;
    CUR = SCENE_BUF; SCENE_MODE = true; SX = 0; SY = 0;
    prep(SCENE_BUF, SCENE_W, SCENE_H);
    const fr = Math.floor(ts * ANIM_FPS);
    let shake = 0;
    if (key === 'collapse') { const ti = t - COLLAPSE_IMPACT; if (ti >= 0 && ti < 0.3) shake = ti < 0.1 ? 2 : 1; }
    if (key === 'sticicle') { const b = t - 0.4 - ICE_TRAVEL; if (b >= 0 && b < 0.12) shake = 1; }
    for (const [at, amp] of (d.shake || [])) if (t >= at && t < at + 0.16) shake = Math.max(shake, t < at + 0.08 ? amp : 1);
    drawSceneFloor();
    const shx = shake ? ((fr & 1) ? shake : -shake) : 0, shy = shake && fr % 3 === 0 ? shake : 0;
    const o0 = d._o || {};
    const pose = d.boss ? { bob: 0, lift: 0, fwd: 0, sway: 0, rim: 0, dx: 0, dy: 0, z: 0, face: 1 }
                        : poseFor(d, ts, Object.assign(o0, { x: d.cx, y: d.cy, R: d.R, ang: d.ang || 0, tx: o0.tx, ty: o0.ty }));
    const s = SPR[d.caster], face = pose.face || 1;
    const gx = Math.round(d.cx + pose.dx) - 8 + (face > 0 ? s.gem[0] : 15 - s.gem[0]) + pose.fwd, gy = Math.round(d.cy + pose.dy) - 13 - Math.round(pose.z) + s.gem[1] - pose.lift + pose.bob;
    const o = sceneO(key, d, gx, gy);
    d.ground(t, o);
    // キャラと敵を足元の y で並べて描く
    const actors = d.enemies.map((e, i) => [e[1], () => drawEnemy(e[0], e[1], enemyState(d, i, e, t, o))]);
    (d.allies || []).forEach(([k, ax, ay]) => actors.push([ay, () => drawCaster(k, ax, ay, { bob: Math.floor(ts * 4) & 1, lift: 0, fwd: 0, sway: 0, rim: 0, rimCol: P.W, face: 1 })]));
    if (d.boss) actors.push([d.cy + SPR[d.caster].map.length / 2 - 2, () => drawSprite(d.caster, d.cx, d.cy, (d.pose && d.pose(t)) || {})]);
    else actors.push([d.cy + pose.dy, () => {
      if (d.pose === 'mirage' && t >= 0 && t < d.life) {                   // 左右にずれた残像
        const side = (Math.floor(t * 12) & 1) ? 1 : -1;                  // 左右に交互に一枚ずつ
        drawCaster(d.caster, d.cx + side * 6, d.cy, { ...pose, ghost: 0.5 });
      }
      drawCaster(d.caster, d.cx, d.cy, pose);
    }]);
    actors.sort((a, b) => a[0] - b[0]).forEach(a => a[1]());
    if (MAGIC[key]) chargeFx(ts - (d.castAt - d.charge), d.charge + 0.05, gx, gy, RAMP[d.ramp || 'arcane']);
    else if (!d.boss && t < 0 && t > -d.charge && (fr & 1)) { plus(gx, gy, P.W, 2); px(gx, gy, P.ac0); }     // 刃のきらめき
    d.air(t, o);
    blit(ctx, SCENE_BUF, shx, shy, ctx.canvas.width, ctx.canvas.height, true);
  }
  /* fit=true のときは dx,dy を「揺れ（ドット単位）」として扱う */
  function blit(ctx, b, dx, dy, dw, dh, fit) {
    b.cx.putImageData(b.img, 0, 0, 0, 0, b.w, b.h);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (fit) {
      const kf = Math.min(dw / b.w, dh / b.h); let k = Math.floor(kf);
      if (k < 1 || k < kf * 0.8) k = kf;
      const ww = Math.round(b.w * k), hh = Math.round(b.h * k);
      ctx.fillStyle = '#0d0c12'; ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(b.cv, 0, 0, b.w, b.h, Math.round((dw - ww) / 2 + dx * k), Math.round((dh - hh) / 2 + dy * k), ww, hh);
    } else ctx.drawImage(b.cv, 0, 0, b.w, b.h, dx, dy, dw, dh);
    ctx.restore();
  }

  /* ============================================================
     実機用：効果だけを描く。
     x,y       … 画面座標（術者の足元。崩落は着弾点）
     scale     … TS/48（今の実機と同じ）。1 ドット = 3*scale 画面px
     range     … マス。life … 持続秒（フレイム・ライトニング・ダンシングソード・ミラージュ）
     age       … 発動からの実時間（持続技も周期で割らずに渡す）
     layer     … 'ground'（キャラの下）/'air'（キャラの上）/'all'
     tx,ty     … 狙いの画面座標（アッパー・ドラグーン・アローレイン）
     casterX,casterY … 崩落の術者の画面座標（足元の魔法陣と光の柱）
     orbitA    … ダンシングソードの今の角度（当たり判定と同じ f.a）
     fall      … アローレインの矢1本の落ち具合 0..1
     ============================================================ */
  const GAME_O = {};
  const SKY = { stbolt: 72, collapse: 130, spdragoon: 90, gtupper: 60, bwrain: 60, a_rain: 60, u_ruin: 140, s_revive: 110, u_rally: 40, u_bloom: 40,
                u_ward: 24, u_aegis: 24, a_bulwark: 32, a_grace: 24, a_sanct: 34, a_field: 24, u_quake: 24, u_blaze: 64 };
  function span(id) { const d = DEFS[id]; return d ? d.span : 0; }
  function renderEffect(ctx, p) {
    const id = p.id, d = DEFS[id], age = p.age || 0;
    if (!d || age < 0 || age > d.span) return;
    const k = 3 * (p.scale || 1);
    const R = Math.round((p.range != null ? p.range : (d.R || TILE) / TILE) * TILE);
    const toBuf = (sx, sy, ox, oy) => [ox + (sx - p.x) / k, oy + (sy - p.y) / k];
    let ext = d.ext != null ? (id === 'n_swing' ? Math.max(d.ext, R + 8) : d.ext) : Math.max(R, d.healR || 0, 24);
    if (p.tx != null) ext = Math.max(ext, Math.hypot(p.tx - p.x, p.ty - p.y) / k + 20);
    if (p.casterX != null) ext = Math.max(ext, Math.hypot(p.casterX - p.x, p.casterY - p.y) / k + 20);
    const pad = d.pad != null ? d.pad : 26, sky = d.sky != null ? d.sky : (SKY[id] || 14);
    const w = Math.ceil(2 * (ext + pad)), h = Math.ceil(2 * (ext + pad) + sky), ox = Math.ceil(ext + pad), oy = Math.ceil(ext + pad + sky);
    CUR = FX_BUF; SCENE_MODE = false; SX = 0; SY = 0;
    prep(FX_BUF, w, h);
    const o = GAME_O;
    for (const key in o) delete o[key];
    const ang = p.angle || 0;
    Object.assign(o, { x: ox, y: oy, R, ang, arc: d.arc || 0, life: p.life != null ? p.life : (d.life || 0), skyY: 4, charge: 0,
                       gx: ox + Math.round(Math.cos(ang) * 6), gy: oy - 9, targets: null, healR: d.healR, orbitA: p.orbitA, fall: p.fall,
                       arrows: false, shots: false, kind: p.kind || d.kind, elem: p.elem || d.elem, target: p.target, aura: p.aura, ring: p.ring || 0,
                       wide: p.wide != null ? p.wide * TILE : (d.wide || 0), seed: p.seed || 0 });
    if (p.arc != null) o.arc = p.arc;
    if (p.tx != null) { const [a, b] = toBuf(p.tx, p.ty, ox, oy); o.tx = a; o.ty = b; }
    if (p.casterX != null && id !== 'collapse') { const [a, b] = toBuf(p.casterX, p.casterY, ox, oy); o.cx = a; o.cy = b; }
    if (id === 'collapse') { o.gx = null; if (p.casterX != null) { const [a, b] = toBuf(p.casterX, p.casterY, ox, oy); o.cx = a; o.cy = b; o.gx = a + 5; o.gy = b - 12; } }
    if (id === 'stbolt') o.gx = null;
    const layer = p.layer || 'all';
    if (layer !== 'air') d.ground(age, o);
    if (layer !== 'ground') d.air(age, o);
    blit(ctx, FX_BUF, Math.round(p.x - ox * k), Math.round(p.y - oy * k), Math.round(w * k), Math.round(h * k), false);
  }

  window.PixelArtFx = Object.freeze({
    keys: Object.keys(DEFS).filter(k => !DEFS[k].aux), groups: GROUPS, defs: DEFS, palette: HEX,
    magic: MAGIC, timeline, phaseAt, scene, renderEffect, span,
    impact: { collapse: COLLAPSE_IMPACT }, size: { w: SCENE_W, h: SCENE_H }
  });
})();
