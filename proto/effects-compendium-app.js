(function(){
  "use strict";

  var CATS = [
    {id:"normal", label:"通常攻撃", short:"通常", color:"var(--cat-normal)", desc:"武器種ごとの通常攻撃モーション・属性別エフェクト。全種実装済み。プレビューは ally-effect-study.js / weapon-effect-gallery.js の実装コードをそのまま再生しています。"},
    {id:"arts",   label:"武器技",   short:"武器技", color:"var(--cat-arts)",   desc:"8武器種×lv1〜3＝24種。閃きで習得する武器固有アーツ。全種実装済み。プレビューは weapon-art-pixel.js（ドット演出）の見本シーンをそのまま再生しています。"},
    {id:"ult",    label:"大技",     short:"大技",   color:"var(--cat-ult)",    desc:"CD24〜40秒の切り札枠。確認できている名称のみ仮登録、詳細設計はこれから。プレビューコードはまだ存在しません。"},
    {id:"skill",  label:"スキル技", short:"スキル", color:"var(--cat-skill)", desc:"スキルツリーのリキャスト技・キーストーン由来の常時発動系。"},
    {id:"enemy",  label:"敵の攻撃", short:"敵",     color:"var(--cat-enemy)", desc:"雑魚共通の4形式（寄・回・飛・溜）、中ボス5体、大ボス4体、ラスボス級2体。"}
  ];

  // preview.type "normal" -> AllyEffectStudy / WeaponEffectGallery weapon key
  // preview.type "art"    -> PixelArtFx（weapon-art-pixel.js）の技 id。無ければ旧 WeaponArtEffectStudy
  var ITEMS = [
    // ---- 通常攻撃：8武器種（実装済み） ----
    {id:"n-sword", cat:"normal", group:"", name:"剣｜通常攻撃", meta:"Sword ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"swordaxe"}},
    {id:"n-great", cat:"normal", group:"", name:"大剣｜通常攻撃", meta:"Greatsword ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"greatsword"}},
    {id:"n-dagger",cat:"normal", group:"", name:"短剣｜通常攻撃", meta:"Dagger ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"dagger"}},
    {id:"n-axe",   cat:"normal", group:"", name:"斧｜通常攻撃", meta:"Axe ／ 剣と同じ「剣・斧」演出を共有", desc:"", status:"done", preview:{type:"normal", key:"swordaxe"}},
    {id:"n-spear", cat:"normal", group:"", name:"槍｜通常攻撃", meta:"Spear ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"spear"}},
    {id:"n-bow",   cat:"normal", group:"", name:"弓｜通常攻撃", meta:"Bow ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"bow"}},
    {id:"n-mace",  cat:"normal", group:"", name:"戦鎚｜通常攻撃", meta:"Warhammer ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"hammer"}},
    {id:"n-staff", cat:"normal", group:"", name:"杖｜通常攻撃", meta:"Staff（魔弾） ／ 属性別エフェクト反映済み", desc:"", status:"done", preview:{type:"normal", key:"magicbolt"}},

    // ---- 武器技：24種（実装済み） ----
    {id:"a-sword-1", cat:"arts", group:"剣", name:"居合", meta:"lv1 ／ dash", desc:"踏み込み斬り", status:"done", preview:{type:"art", key:"iai"}},
    {id:"a-sword-2", cat:"arts", group:"剣", name:"回転斬り", meta:"lv2 ／ ring", desc:"周囲・ノックバック", status:"done", preview:{type:"art", key:"swspin"}},
    {id:"a-sword-3", cat:"arts", group:"剣", name:"多段斬り", meta:"lv3 ／ line×3", desc:"前方3回", status:"done", preview:{type:"art", key:"swmulti"}},

    {id:"a-great-1", cat:"arts", group:"大剣", name:"大回転斬り", meta:"lv1 ／ ring×2", desc:"周囲2回・ノックバック", status:"done", preview:{type:"art", key:"gtspin"}},
    {id:"a-great-2", cat:"arts", group:"大剣", name:"地走り", meta:"lv2 ／ cone", desc:"扇・ノックバック", status:"done", preview:{type:"art", key:"gtquake"}},
    {id:"a-great-3", cat:"arts", group:"大剣", name:"レイジングアッパー", meta:"lv3 ／ single", desc:"単体・強ノックバック", status:"done", preview:{type:"art", key:"gtupper"}},

    {id:"a-dagger-1", cat:"arts", group:"短剣", name:"乱斬り", meta:"lv1 ／ line×3", desc:"前方3回", status:"done", preview:{type:"art", key:"dgslash"}},
    {id:"a-dagger-2", cat:"arts", group:"短剣", name:"ダンシングソード", meta:"lv2 ／ orbit", desc:"6秒間まわる刃", status:"done", preview:{type:"art", key:"dgdance"}},
    {id:"a-dagger-3", cat:"arts", group:"短剣", name:"ミラージュ", meta:"lv3 ／ invuln", desc:"2.6秒無敵", status:"done", preview:{type:"art", key:"dgmirage"}},

    {id:"a-axe-1", cat:"arts", group:"斧", name:"トマホーク", meta:"lv1 ／ line貫通", desc:"直線貫通", status:"done", preview:{type:"art", key:"axtoma"}},
    {id:"a-axe-2", cat:"arts", group:"斧", name:"スピンアクス", meta:"lv2 ／ ring", desc:"周囲・ノックバック", status:"done", preview:{type:"art", key:"axspin"}},
    {id:"a-axe-3", cat:"arts", group:"斧", name:"スパイラルホーク", meta:"lv3 ／ line×3", desc:"直線3回・貫通なし", status:"done", preview:{type:"art", key:"axspiral"}},

    {id:"a-spear-1", cat:"arts", group:"槍", name:"スウィング", meta:"lv1 ／ ring×2", desc:"周囲2回", status:"done", preview:{type:"art", key:"spswing"}},
    {id:"a-spear-2", cat:"arts", group:"槍", name:"ショットランス", meta:"lv2 ／ line貫通", desc:"直線貫通", status:"done", preview:{type:"art", key:"splance"}},
    {id:"a-spear-3", cat:"arts", group:"槍", name:"ドラグーン", meta:"lv3 ／ dragoon", desc:"消えて1秒後に跳びかかる", status:"done", preview:{type:"art", key:"spdragoon"}},

    {id:"a-bow-1", cat:"arts", group:"弓", name:"アローレイン", meta:"lv1 ／ rain", desc:"範囲に6〜10本", status:"done", preview:{type:"art", key:"bwrain"}},
    {id:"a-bow-2", cat:"arts", group:"弓", name:"連射", meta:"lv2 ／ volley", desc:"近くの敵へ5回", status:"done", preview:{type:"art", key:"bwrapid"}},
    {id:"a-bow-3", cat:"arts", group:"弓", name:"バーストショット", meta:"lv3 ／ line貫通・炎", desc:"直線貫通・炎属性", status:"done", preview:{type:"art", key:"bwburst"}},

    {id:"a-mace-1", cat:"arts", group:"戦鎚", name:"ダブルアタック", meta:"lv1 ／ line×2", desc:"前方2回", status:"done", preview:{type:"art", key:"mcdouble"}},
    {id:"a-mace-2", cat:"arts", group:"戦鎚", name:"癒し打ち", meta:"lv2 ／ heal ／ 魔法陣", desc:"打って味方を9%回復", status:"done", preview:{type:"art", key:"mcheal"}},
    {id:"a-mace-3", cat:"arts", group:"戦鎚", name:"ホーリーシールド", meta:"lv3 ／ barrier ／ 魔法陣", desc:"1回無効の盾", status:"done", preview:{type:"art", key:"mcshield"}},

    {id:"a-staff-1", cat:"arts", group:"杖", name:"フレイム", meta:"lv1 ／ conefield・炎 ／ 魔法陣", desc:"前方扇に2.5秒の炎", status:"done", preview:{type:"art", key:"stflame"}},
    {id:"a-staff-2", cat:"arts", group:"杖", name:"アイシクルエッジ", meta:"lv2 ／ line×3・氷 ／ 魔法陣", desc:"直線3回・氷・ノックバック", status:"done", preview:{type:"art", key:"sticicle"}},
    {id:"a-staff-3", cat:"arts", group:"杖", name:"ライトニング", meta:"lv3 ／ field・雷 ／ 魔法陣", desc:"周囲に3秒の雷", status:"done", preview:{type:"art", key:"stbolt"}},

    // ---- 大技：確認できている名称のみ（未実装） ----
    {id:"u-shinkan", cat:"ult", group:"", name:"震撼 Lv.1", meta:"大技（ULT） ／ 実測ATK倍率 約2.70", desc:"武器技システム比較時のベンチマーク名として言及のみ。演出未設計。", status:"todo"},
    {id:"u-gokuka",  cat:"ult", group:"", name:"業火 Lv.1", meta:"大技（ULT） ／ 実測ATK倍率 約6.93", desc:"武器技システム比較時のベンチマーク名として言及のみ。演出未設計。", status:"todo"},
    {id:"u-collapse-ally", cat:"ult", group:"", name:"崩落（大魔導士 Lv.50）", meta:"仲間の大技 ／ 着弾点から半径3マス・0.55秒後に着弾", desc:"魔法陣→影→岩が落ちる→衝撃波。足元にも魔法陣。", status:"done", preview:{type:"art", key:"collapse"}},

    // ---- スキル技：リキャスト技・キーストーン ----
    {id:"s-shockwave", cat:"skill", group:"", name:"衝撃波", meta:"CD8秒 ／ 前方3.4マスの扇", desc:"［刃］キーストーン。HUD通常技ボタン。威力実測 5.35。", status:"todo"},
    {id:"s-renzan",    cat:"skill", group:"", name:"連斬", meta:"CD10秒 ／ 3連撃", desc:"［刃］段3キーストーン。", status:"todo"},
    {id:"s-fukutsu",   cat:"skill", group:"", name:"不屈", meta:"探索1回に1度 ／ HP100%で復活", desc:"［躯］段3キーストーン。比を÷2する生存の要。", status:"todo"},
    {id:"s-chiyu",     cat:"skill", group:"", name:"治癒／治癒II", meta:"12秒毎に4% → 10秒毎に8%回復", desc:"［躯］段2〜3。継続回復の常時発動エフェクト。", status:"todo"},
    {id:"s-shunsoku",  cat:"skill", group:"", name:"瞬足／瞬足II", meta:"CD6→4秒 ／ 無敵0.2秒", desc:"［影］ダッシュ。Codex実装により演出も実装済み（別モジュール・本ページでは未対応）。", status:"done"},
    {id:"s-dasshutsu", cat:"skill", group:"", name:"脱出", meta:"探索1回に1度 ／ その場から帰還", desc:"［影］段3キーストーン。帰還ポータル演出が必要。", status:"todo"},

    // ---- 敵の攻撃：雑魚共通4形式 ----
    {id:"e-rush",   cat:"enemy", group:"雑魚共通（4形式）", name:"寄（Rush）", meta:"まっすぐ突進・止まらない", desc:"アッシュハウンド系など8系統に共通する挙動の型。", status:"todo"},
    {id:"e-circle", cat:"enemy", group:"雑魚共通（4形式）", name:"回（Circle）", meta:"距離を保って回り込む", desc:"ダストスパイダー系など。", status:"todo"},
    {id:"e-cast",   cat:"enemy", group:"雑魚共通（4形式）", name:"飛（Cast）", meta:"離れた場所から撃つ", desc:"アッシュトード系など。", status:"todo"},
    {id:"e-charge", cat:"enemy", group:"雑魚共通（4形式）", name:"溜（Charge）", meta:"溜めて一直線に突進", desc:"ストーンボア系など。", status:"todo"},

    // ---- 敵の攻撃：中ボス（現象体） ----
    {id:"e-toad",   cat:"enemy", group:"中ボス｜現象体", name:"灰の大蛙", meta:"5F ／ 乾", desc:"飲み込んだものを一度に吐き出す。", status:"todo"},
    {id:"e-leech",  cat:"enemy", group:"中ボス｜現象体", name:"沼の大蛭", meta:"15F ／ 滞", desc:"周期的に吸引し、周囲の水位が下がる。", status:"todo"},
    {id:"e-spider", cat:"enemy", group:"中ボス｜現象体", name:"根の大蜘蛛", meta:"25F ／ 生", desc:"掴んだものを離す機能がない。", status:"todo"},
    {id:"e-serpent",cat:"enemy", group:"中ボス｜現象体", name:"炉の大蛇", meta:"35F ／ 熱", desc:"全長不明の胴から熱を放ち続ける。", status:"todo"},
    {id:"e-eye",    cat:"enemy", group:"中ボス｜現象体", name:"白の大眼", meta:"45F ／ 欠", desc:"開くと部屋の大きさが変わる。", status:"todo"},

    // ---- 敵の攻撃：大ボス（登録名持ち） ----
    {id:"e-vela",   cat:"enemy", group:"大ボス｜登録名持ち", name:"空引きのヴェラ", meta:"10F ／ 弓", desc:"距離を詰めても常に一定距離を保って撃ち続ける。", status:"todo"},
    {id:"e-brecht", cat:"enemy", group:"大ボス｜登録名持ち", name:"打ち直しのブレヒト", meta:"20F ／ 鎚", desc:"戦いながら自分の壊れた部分を打ち直す。", status:"todo"},
    {id:"e-mareth", cat:"enemy", group:"大ボス｜登録名持ち", name:"施しのマレット", meta:"30F ／ 薬", desc:"効果がランダムに変わる薬を撒く。", status:"todo"},
    {id:"e-ort",    cat:"enemy", group:"大ボス｜登録名持ち", name:"凍てついた盾、オルト", meta:"40F ／ 盾", desc:"周期的に周囲ごと凍りつかせる。", status:"todo"},

    // ---- 敵の攻撃：ラスボス級 ----
    {id:"e-offering", cat:"enemy", group:"ラスボス級", name:"初めの供物", meta:"50F", desc:"大ボス4体の型を順に使ってくる。取り巻きを召喚。", status:"todo"},
    {id:"e-mouth",     cat:"enemy", group:"ラスボス級", name:"アビスの口", meta:"51F", desc:"分身・跳躍・全体攻撃・4体同時・逃走撃ちの5段階変化。", status:"todo"}
  ];

  var ELEMENTS = [
    {key:"neutral", label:"無"},
    {key:"fire",    label:"火"},
    {key:"shock",   label:"雷"},
    {key:"frost",   label:"冷"},
    {key:"arcane",  label:"魔"}
  ];

  var STORE_KEY = "abyss-effects-v1";
  var state = {activeCat:"all", query:"", overrides:{}, notes:{}, playing:true};

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) state.playing = false;

  var hasNormalPreview = !!window.WeaponEffectGallery && !!window.AllyEffectStudy;
  var PX = window.PixelArtFx;
  var hasArtPreview = !!PX || !!window.WeaponArtEffectStudy;

  function loadStore(){
    try{
      var raw = localStorage.getItem(STORE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        state.overrides = parsed.overrides || {};
        state.notes = parsed.notes || {};
      }
    }catch(e){/* private mode etc: fall back to defaults */}
  }
  function saveStore(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify({overrides:state.overrides, notes:state.notes}));
    }catch(e){/* ignore */}
  }

  function effectiveStatus(item){
    var o = state.overrides[item.id];
    return o === "done" || o === "todo" ? o : item.status;
  }

  // ---------- preview registry & shared animation loop ----------
  var registry = [];
  var observer = null;
  if (window.IntersectionObserver) {
    observer = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ en.target.__visible = en.isIntersecting; });
    }, {threshold: 0.01});
  }

  function makePreview(item, container){
    if (item.preview.type === "normal" && hasNormalPreview) {
      var wrap = document.createElement("div");
      wrap.className = "preview-wrap";
      var canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 170;
      canvas.className = "preview-canvas";
      canvas.__visible = true;
      canvas.setAttribute("aria-label", item.name + " のプレビュー");
      var chips = document.createElement("div");
      chips.className = "elem-chips";
      var elState = {value:"neutral"};
      ELEMENTS.forEach(function(el){
        var b = document.createElement("button");
        b.type = "button";
        b.className = "elem-chip" + (el.key==="neutral" ? " active":"");
        b.textContent = el.label;
        b.addEventListener("click", function(){
          elState.value = el.key;
          chips.querySelectorAll(".elem-chip").forEach(function(x){x.classList.remove("active");});
          b.classList.add("active");
        });
        chips.appendChild(b);
      });
      wrap.appendChild(canvas);
      wrap.appendChild(chips);
      container.appendChild(wrap);
      if (observer) observer.observe(canvas);
      var ctx = canvas.getContext("2d");
      registry.push({
        canvas: canvas,
        cycle: 1.0,
        start: performance.now(),
        draw: function(age){
          var el = elState.value;
          window.WeaponEffectGallery.scene(ctx, item.preview.key, age, {
            hit: true, element: el, elementHit: el !== "neutral"
          });
        }
      });
    } else if (item.preview.type === "art" && hasArtPreview) {
      var wrap2 = document.createElement("div");
      wrap2.className = "preview-wrap";
      var canvas2 = document.createElement("canvas");
      canvas2.width = 320; canvas2.height = 170;
      canvas2.className = "preview-canvas";
      canvas2.__visible = true;
      canvas2.setAttribute("aria-label", item.name + " のプレビュー");
      wrap2.appendChild(canvas2);
      container.appendChild(wrap2);
      if (observer) observer.observe(canvas2);
      var ctx2 = canvas2.getContext("2d");
      var duration = PX ? PX.timeline(item.preview.key).loop : (window.WeaponArtEffectStudy.duration || 1.4);
      if (PX) { canvas2.width = 320; canvas2.height = 224; canvas2.style.aspectRatio = "320/224"; }
      registry.push({
        canvas: canvas2,
        cycle: duration,
        start: performance.now(),
        draw: function(age){
          if (PX) PX.scene(ctx2, item.preview.key, age);
          else window.WeaponArtEffectStudy.scene(ctx2, item.preview.key, age);
        }
      });
    }
  }

  function tickFrame(now){
    if (state.playing) {
      registry.forEach(function(entry){
        if (entry.canvas.__visible === false) return;
        var age = ((now - entry.start) / 1000) % entry.cycle;
        try { entry.draw(age); } catch(e) { /* keep the loop alive even if one scene throws */ }
      });
    }
    requestAnimationFrame(tickFrame);
  }
  requestAnimationFrame(tickFrame);

  // draw one static, representative frame for a freshly-mounted (paused) canvas
  function drawStaticFrame(){
    registry.forEach(function(entry){
      try { entry.draw(entry.cycle * 0.32); } catch(e) {}
    });
  }

  function catInfo(id){
    for(var i=0;i<CATS.length;i++) if(CATS[i].id===id) return CATS[i];
    return null;
  }

  function renderTabs(){
    var tabs = document.getElementById("tabs");
    tabs.innerHTML = "";
    tabs.appendChild(makeTab("all", "すべて", ITEMS.length));
    CATS.forEach(function(c){
      var count = ITEMS.filter(function(i){return i.cat===c.id;}).length;
      tabs.appendChild(makeTab(c.id, c.short, count));
    });
  }
  function makeTab(id, label, count){
    var b = document.createElement("button");
    b.className = "tab" + (state.activeCat===id ? " active":"");
    b.innerHTML = label + ' <span class="n">' + count + "</span>";
    b.addEventListener("click", function(){ state.activeCat = id; render(); });
    return b;
  }

  function matchesQuery(item){
    if(!state.query) return true;
    var q = state.query.toLowerCase();
    return (item.name + item.meta + item.desc + item.group).toLowerCase().indexOf(q) !== -1;
  }

  function renderProgress(){
    var visible = ITEMS;
    var total = visible.length;
    var done = visible.filter(function(i){return effectiveStatus(i)==="done";}).length;
    document.getElementById("progressCount").innerHTML = done + ' <small>/ ' + total + " エフェクト実装済み</small>";
    document.getElementById("barSeg").style.width = (total? (done/total*100):0) + "%";

    var bd = document.getElementById("breakdown");
    bd.innerHTML = "";
    CATS.forEach(function(c){
      var items = ITEMS.filter(function(i){return i.cat===c.id;});
      var d = items.filter(function(i){return effectiveStatus(i)==="done";}).length;
      var span = document.createElement("span");
      span.innerHTML = '<i class="dot" style="background:'+c.color+'"></i>' + c.label + " <b>" + d + "/" + items.length + "</b>";
      bd.appendChild(span);
    });
  }

  function render(){
    if (observer) observer.disconnect();
    registry = [];

    renderTabs();
    renderProgress();
    var content = document.getElementById("content");
    content.innerHTML = "";

    var cats = state.activeCat === "all" ? CATS : CATS.filter(function(c){return c.id===state.activeCat;});
    var anyShown = false;

    cats.forEach(function(cat){
      var items = ITEMS.filter(function(i){return i.cat===cat.id && matchesQuery(i);});
      if(!items.length) return;
      anyShown = true;

      var intro = document.createElement("div");
      intro.className = "cat-intro";
      intro.innerHTML = '<i class="dot" style="background:'+cat.color+'"></i><h2>' + cat.label + "</h2>";
      content.appendChild(intro);
      var p = document.createElement("p");
      p.textContent = cat.desc;
      p.style.marginTop = "-2px";
      content.appendChild(p);

      var groups = {};
      var order = [];
      items.forEach(function(i){
        var g = i.group || "";
        if(!groups[g]){groups[g]=[]; order.push(g);}
        groups[g].push(i);
      });

      order.forEach(function(g){
        if(g){
          var gt = document.createElement("div");
          gt.className = "group-title";
          gt.textContent = g;
          content.appendChild(gt);
        }
        var grid = document.createElement("div");
        grid.className = "grid";
        groups[g].forEach(function(item){ grid.appendChild(renderCard(item, cat)); });
        content.appendChild(grid);
      });
    });

    if(!anyShown){
      var msg = document.createElement("div");
      msg.className = "empty-msg";
      msg.textContent = "該当するエフェクトが見つかりません。";
      content.appendChild(msg);
    }

    if (!state.playing) drawStaticFrame();
  }

  function renderCard(item, cat){
    var card = document.createElement("div");
    card.className = "card" + (item.preview ? " has-preview":"");
    card.style.setProperty("--cat-c", cat.color);

    var top = document.createElement("div");
    top.className = "card-top";
    var name = document.createElement("div");
    name.className = "card-name";
    name.textContent = item.name;
    top.appendChild(name);

    var pill = document.createElement("button");
    var status = effectiveStatus(item);
    pill.className = "pill " + status;
    pill.textContent = status === "done" ? "済" : "未";
    pill.title = "クリックで切り替え";
    pill.addEventListener("click", function(){
      var cur = effectiveStatus(item);
      state.overrides[item.id] = cur === "done" ? "todo" : "done";
      saveStore();
      render();
    });
    top.appendChild(pill);
    card.appendChild(top);

    if (item.preview && ((item.preview.type==="normal"&&hasNormalPreview) || (item.preview.type==="art"&&hasArtPreview))) {
      makePreview(item, card);
    }

    var meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = item.meta;
    card.appendChild(meta);

    if(item.desc){
      var desc = document.createElement("div");
      desc.className = "card-desc";
      desc.textContent = item.desc;
      card.appendChild(desc);
    }

    var noteBtn = document.createElement("button");
    noteBtn.className = "note-toggle";
    var hasNote = !!(state.notes[item.id] && state.notes[item.id].length);
    noteBtn.textContent = hasNote ? "メモを編集" : "＋ メモを追加";
    var ta = document.createElement("textarea");
    ta.className = "note-area" + (hasNote ? " open":"");
    ta.placeholder = "制作メモ（例：発注先・参考動画・優先度など）";
    ta.value = state.notes[item.id] || "";
    ta.id = "note-" + item.id;
    noteBtn.addEventListener("click", function(){
      ta.classList.toggle("open");
      if(ta.classList.contains("open")) ta.focus();
    });
    ta.addEventListener("input", function(){
      state.notes[item.id] = ta.value;
      saveStore();
      noteBtn.textContent = ta.value.length ? "メモを編集" : "＋ メモを追加";
    });
    card.appendChild(noteBtn);
    card.appendChild(ta);

    return card;
  }

  document.getElementById("search").addEventListener("input", function(e){
    state.query = e.target.value;
    render();
  });

  var playBtn = document.getElementById("playToggle");
  if (playBtn) {
    function syncPlayBtn(){ playBtn.textContent = state.playing ? "⏸ 再生中" : "▶ 一時停止中"; playBtn.classList.toggle("playing", state.playing); }
    syncPlayBtn();
    playBtn.addEventListener("click", function(){
      state.playing = !state.playing;
      syncPlayBtn();
      if (!state.playing) drawStaticFrame();
      else registry.forEach(function(entry){ entry.start = performance.now() - (entry.cycle*0.32*1000); });
    });
  }

  function start(data){
    if(data && data.overrides) state.overrides = data.overrides;
    if(data && data.notes) state.notes = data.notes;
    loadStore();
    render();
  }
  if(window.claude && window.claude.hot){
    window.claude.hot.snapshot(function(){ return {overrides:state.overrides, notes:state.notes}; });
    window.claude.hot.ready ? window.claude.hot.ready(start) : start(window.claude.hot.data || {});
  } else {
    start({});
  }
})();
