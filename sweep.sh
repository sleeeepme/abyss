#!/usr/bin/env bash
# 全テストを走らせて「false になった項目」だけを並べる。
#
# 所要 約2分20秒（以前は5分21秒）。
# 縮んだぶんは「実時間で寝ていた時間」で、stepSim() に置き換えてある（index.html 参照）。
# まだ遅いスイートは、遅いことに理由があるもの:
#   adtest   ダミー広告の実タイマー。報酬が完了後にしか出ないことが本題なので飛ばせない
#   scaletest 実 fps を測っている。速く回したら測定にならない
#   touchtest / hubtest  実際のタップを DOM に投げている
#   fxtest / pacetest の live  rAF ループが止まらないことの確認（フリーズ回帰）
#
# 各テストは {errs, R} を JSON で吐く。R の中の真偽値は
# すべて「true = 期待どおり」に揃えてあるので、false が1つでも出れば失敗。
# 既知の期待 false は KNOWN に書いてある（理由もそこに書く）。
cd "$(dirname "$0")"
# proto/_*.mjs は掃引に入れない（_h.mjs = 共通部品 / _intrperf.mjs = 単発の計測）
SUITES="verify touchtest scrolltest bagtest gravetest hubtest gearttest rangedtest
        elemtest afftest bosstest pacetest partytest fxtest bossaoe zonetest kitetest
        adtest basetest looptest forgetest movetest ulttest allytest cursetest
        scaletest intrtest mournrest boontest allyuptest allyidtest arttest nametest npctest tunetest titletest towntest hudtest masttest relictest ubosstest"
for f in $SUITES; do
  timeout 180 node "proto/$f.mjs" 2>&1 | SUITE="$f" python3 -c '
import json,os,sys
raw=sys.stdin.read(); name=os.environ["SUITE"]
try: d=json.loads(raw)
except Exception:
    print("CRASH  "+name+"  "+" / ".join(raw.strip().splitlines()[:3])); sys.exit()
bad=[]
def walk(k,v):
    if isinstance(v,bool):
        if not v: bad.append(k)
    elif isinstance(v,dict):
        for kk,vv in v.items(): walk(k+"."+kk,vv)
walk("",d.get("R",{}))
errs=d.get("errs",[])
tag = "ERR   " if errs else ("FAIL  " if bad else "ok    ")
line = tag+name
if errs: line += "  errs="+str(errs[:2])
if bad:  line += "  false="+",".join(bad)
print(line)
'
done
cat <<'NOTE'

--- 既知の期待 false（失敗ではない）---
hubtest  .hub.townHasShopGrid        拠点は縦並び。格子レイアウトを捨てたときの残り
pacetest .bossHidden.revealed など    ボスは殴るまで名乗らない＝出た直後は未公開が正しい
partytest .fallen.deadAfter など      倒れた仲間は「死亡扱いにしない」（広告蘇生の余地）
fxtest   .noAutoHelp.helpShown       操作説明は自動で出さない
zonetest .banner.sameZone            同じ層ではバナーを出し直さない
kitetest .hud.melee.shown            近接には引き撃ちHUDを出さない
adtest   .reviveDone.dead            蘇生後は死亡フラグが下りている
basetest .durWarn.healthy.shown      健全な装備には警告を出さない
NOTE
