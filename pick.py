#!/usr/bin/env python3
"""変更に関係するテストスイートだけを選ぶ。sweep.sh --since から呼ばれる。

**なぜ手書きの対応表を持たないか。**
「index.html のこの関数を触ったら、このスイート」という表を人が書くと、
必ず更新を忘れる。忘れた瞬間、掃引は「速くなった」まま**黙って見逃す**ようになる。
遅いより悪い。

なので表は持たず、**テスト自身に語らせる**。
各スイートが本文中で触れている識別子（guardbtn, BLEED_MIN_DEPTH, masteryMul …）を
その場で読み取り、diff に出てきた識別子と突き合わせる。
テストを書けば対応表は勝手に増える。これなら忘れようがない。

**判断がつかないときは黙って全部回す。**
絞り込みが効きすぎて壊れたのに気づかない、が一番まずい。全部回す条件は3つ:
  1. 変更された識別子が、どのスイートにも出てこない（＝未知の領域）
  2. 触ったのが「共通語」だけ（stats, maxHp のように半数超のスイートが見る物）
  3. 選ばれた数が全体の 6 割を超える（絞る意味がない。素直に全部回したほうが速い）
"""
import re, sys, os, glob, subprocess, collections

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

# 半数を超えるスイートが見ている語は「共通語」。触れたら全部回す。
GENERIC_RATIO = 0.50
# 選ばれた数がこの割合を超えたら、絞らず全部回す
GIVEUP_RATIO = 0.60

ID = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]{3,}')

# JS/DOM/Playwright の語彙。ゲーム側の識別子ではないので数えない。
STOP = set('''
const await async function return import export from this null true false
undefined length push pop shift unshift slice splice concat join split
map filter find findIndex some every forEach reduce sort reverse includes
Math round floor ceil abs sign sqrt hypot atan cos sin tan pow min max random
JSON parse stringify Object keys values entries assign Array isArray Number
String Boolean parseInt parseFloat isNaN Infinity
document window location navigator querySelector querySelectorAll getElementById
classList contains toggle remove add getBoundingClientRect getComputedStyle
elementFromPoint dispatchEvent MouseEvent TouchEvent Event bubbles cancelable
innerHTML textContent innerWidth innerHeight addEventListener removeEventListener
console error warn info debug trace
Promise resolve reject setTimeout setInterval clearTimeout requestAnimationFrame
playwright chromium devices launch newContext newPage goto evaluate waitForTimeout
hasTouch isMobile iPhone pageerror PAGEERROR CONSOLE errs boot install done
page browser context path file proto html
break case catch class continue default delete else finally instanceof typeof
switch throw while with yield let var new try for while
'''.split())


def suite_names():
    """_ 始まりは掃引に入れない（_h.mjs = 共通部品 / _intrperf.mjs = 単発の計測）。"""
    out = []
    for p in sorted(glob.glob('proto/*.mjs')):
        b = os.path.basename(p)
        if not b.startswith('_'):
            out.append(b[:-4])
    return out


def suite_vocab(names):
    voc = {}
    for s in names:
        with open(f'proto/{s}.mjs', encoding='utf8') as fh:
            voc[s] = {w for w in ID.findall(fh.read()) if w not in STOP}
    return voc


def changed(base):
    """base からの diff。base が空なら未コミットの変更（HEAD との差）。"""
    cmd = ['git', 'diff', '--unified=0']
    if base:
        cmd.append(base)
    else:
        cmd.append('HEAD')
    try:
        d = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except Exception as e:
        return None, None, f'git diff が動かない: {e}'
    if d.returncode != 0:
        return None, None, 'git diff が失敗: ' + d.stderr.strip().splitlines()[0]

    files, words = set(), set()
    cur = None
    for line in d.stdout.splitlines():
        if line.startswith('+++ b/') or line.startswith('--- a/'):
            p = line[6:]
            if p != '/dev/null':
                cur = p
                files.add(p)
            continue
        if line.startswith('@@') or line.startswith('+++') or line.startswith('---'):
            continue
        if line[:1] in '+-' and cur and cur.endswith(('.html', '.mjs')):
            words.update(w for w in ID.findall(line[1:]) if w not in STOP)
    return files, words, None


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else ''
    names = suite_names()
    files, words, err = changed(base)

    def emit(sel, why):
        print(' '.join(sel), file=sys.stdout)
        print(why, file=sys.stderr)

    if err:
        return emit(names, f'判断できないので全部回す（{err}）')
    if not files:
        return emit([], '変更なし')

    # 触られたスイートそのものは必ず回す
    touched = {os.path.basename(f)[:-4] for f in files
               if f.startswith('proto/') and f.endswith('.mjs')
               and not os.path.basename(f).startswith('_')}

    src_changed = any(f.endswith('.html') for f in files)
    helper_changed = any(os.path.basename(f).startswith('_') and f.endswith('.mjs')
                         for f in files)

    if helper_changed:
        return emit(names, '共通部品（proto/_*.mjs）が変わったので全部回す')

    if not src_changed:
        if not touched:
            return emit([], f'テストにも本体にも変更なし（{", ".join(sorted(files))}）')
        return emit(sorted(touched), '本体は無変更。触ったスイートだけ回す')

    voc = suite_vocab(names)
    df = collections.Counter()
    for ws in voc.values():
        for w in ws:
            df[w] += 1

    n = len(names)
    limit = n * GENERIC_RATIO
    generic = {w for w in words if df.get(w, 0) > limit}
    specific = {w for w in words if 0 < df.get(w, 0) <= limit}
    unknown = {w for w in words if df.get(w, 0) == 0}

    if generic:
        g = ', '.join(sorted(generic)[:6])
        return emit(names, f'共通語に触れたので全部回す（{g}）')

    if not specific:
        return emit(names, 'どのスイートにも紐づかない変更なので全部回す')

    sel = {s for s in names if voc[s] & specific} | touched
    sel.add('verify')                    # 起動できることの確認は毎回。安い保険

    if len(sel) > n * GIVEUP_RATIO:
        return emit(names, f'{len(sel)}/{n} が該当。絞る意味がないので全部回す')

    why = f'{len(sel)}/{n} スイートを選択。手掛かり: ' + ', '.join(sorted(specific)[:8])
    if unknown:
        # 見逃しの手掛かりになるので必ず出す（黙って落とさない）
        why += '\n  どのスイートも見ていない語: ' + ', '.join(sorted(unknown)[:10])
    return emit(sorted(sel), why)


if __name__ == '__main__':
    main()
