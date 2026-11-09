/* クローズ & 整序テスト（デモ）: 画面切替はすべて JS で行う（通信なし） */
(function () {
  var app = document.getElementById("app");
  var bar = document.getElementById("bottom-bar");
  var lessons = window.DEMO_DATA.lessons;

  // ---- 共通ヘルパー ----
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function clear() { app.innerHTML = ""; bar.innerHTML = ""; bar.hidden = true; window.scrollTo(0, 0); }
  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }
  var PUNCT = /[.,?!"]/g;
  function sanitize(w) { return w.replace(PUNCT, ""); }

  // ---- 選択状態 ----
  var sel = { mode: null, lesson: "", part: "" };

  // ===== トップ（モード・レッスン・パート選択） =====
  function showHome() {
    clear();
    var wrap = h("div", { class: "wrap640" });
    wrap.appendChild(h("div", { class: "title" }, [
      h("h1", { text: "Cloze Test & 整序メーカー" }),
      h("p", { text: "モードを選んで、レッスンとパートを選択してスタート" })
    ]));

    wrap.appendChild(h("p", { class: "sec-label", text: "モードを選択" }));
    var grid = h("div", { class: "mode-grid" });
    [
      { id: "cloze", icon: "📝", label: "クローズテスト", desc: "空欄に単語を入力" },
      { id: "seijo", icon: "🔀", label: "整序問題", desc: "単語を並べ替えて文を作る" }
    ].forEach(function (m) {
      grid.appendChild(h("button", {
        class: "mode-btn" + (sel.mode === m.id ? " sel" : ""),
        on: { click: function () { sel.mode = m.id; showHome(); } }
      }, [
        h("div", { class: "ic", text: m.icon }),
        h("div", { class: "nm", text: m.label }),
        h("div", { class: "ds", text: m.desc })
      ]));
    });
    wrap.appendChild(grid);

    var lessonSel = h("select", { id: "sel-lesson" }, [h("option", { value: "", text: "-- 選択してください --" })]);
    lessons.forEach(function (l) {
      var o = h("option", { value: l.name, text: l.name });
      if (sel.lesson === l.name) o.selected = true;
      lessonSel.appendChild(o);
    });
    var partSel = h("select", { id: "sel-part" }, [h("option", { value: "", text: "-- 選択してください --" })]);
    var cur = lessons.filter(function (l) { return l.name === sel.lesson; })[0];
    if (!cur) partSel.disabled = true;
    else Object.keys(cur.parts).forEach(function (p) {
      var o = h("option", { value: p, text: p });
      if (sel.part === p) o.selected = true;
      partSel.appendChild(o);
    });

    var startBtn = h("button", { class: "start-btn", text: "スタート →" });
    function refresh() { startBtn.disabled = !(sel.mode && sel.lesson && sel.part); }
    lessonSel.addEventListener("change", function () { sel.lesson = lessonSel.value; sel.part = ""; showHome(); });
    partSel.addEventListener("change", function () { sel.part = partSel.value; refresh(); });
    startBtn.addEventListener("click", function () {
      if (startBtn.disabled) return;
      if (sel.mode === "cloze") showCloze(); else showSeijo();
    });

    wrap.appendChild(h("div", { class: "panel" }, [
      h("div", { class: "field" }, [h("label", { text: "レッスン" }), lessonSel]),
      h("div", { class: "field" }, [h("label", { text: "パート" }), partSel])
    ]));
    wrap.appendChild(startBtn);
    refresh();
    app.appendChild(wrap);
  }

  function currentPart() {
    var l = lessons.filter(function (x) { return x.name === sel.lesson; })[0];
    return l.parts[sel.part];
  }

  // ===== クローズテスト =====
  function tokenize(body, interval) {
    var words = body.split(/\s+/).filter(function (w) { return w.length > 0; });
    return words.map(function (w, i) {
      return { text: w, blank: (i + 1) % interval === 0 && sanitize(w).length > 0 };
    });
  }

  function showCloze() {
    var qs = currentPart().cloze;
    var st = { mode: "tap", interval: 5, revealAll: false };

    function render() {
      clear();
      var total = 0;
      var tokenized = qs.map(function (q) {
        var t = tokenize(q.body, st.interval);
        total += t.filter(function (x) { return x.blank; }).length;
        return { q: q, tokens: t };
      });

      app.appendChild(h("div", { class: "page-head" }, [
        h("button", { class: "back-btn", text: "← 戻る", on: { click: showHome } }),
        h("h2", { text: "📝 クローズテスト" }),
        h("p", { text: sel.lesson + " / " + sel.part + " — " + qs.length + " 問 / 空欄 " + total + " 個" })
      ]));

      function seg(opts, current, onPick) {
        var box = h("div", { class: "seg" });
        opts.forEach(function (o) {
          box.appendChild(h("button", { class: current === o.v ? "on" : "", text: o.l, on: { click: function () { onPick(o.v); } } }));
        });
        return box;
      }
      app.appendChild(h("div", { class: "controls" }, [
        h("div", {}, [h("p", { class: "lb", text: "解答モード" }),
          seg([{ v: "tap", l: "タップで表示" }, { v: "input", l: "入力して採点" }], st.mode,
            function (v) { st.mode = v; st.revealAll = false; render(); })]),
        h("div", {}, [h("p", { class: "lb", text: "空欄の頻度（難易度）" }),
          seg([{ v: 7, l: "やさしい" }, { v: 5, l: "ふつう" }, { v: 3, l: "むずかしい" }], st.interval,
            function (v) { st.interval = v; st.revealAll = false; render(); })])
      ]));

      app.appendChild(h("p", { class: "note", text: st.mode === "tap"
        ? "緑のマスをタップすると答えが見えます。"
        : "空欄に入力して Enter で1問ずつ採点、または下の「答え合わせ」で一括採点。" }));

      var inputs = []; // 入力式の採点用
      var cards = h("div", { class: "cards" });
      tokenized.forEach(function (item, idx) {
        var text = h("div", { class: "cloze-text" });
        item.tokens.forEach(function (tok) {
          if (!tok.blank) { text.appendChild(h("span", { class: "w", text: tok.text })); return; }
          if (st.mode === "tap") {
            var b = h("span", { class: "blank-tap" + (st.revealAll ? " rev" : ""), title: "タップで表示/非表示", text: tok.text });
            b.addEventListener("click", function () { b.classList.toggle("rev"); });
            text.appendChild(b);
          } else {
            var inp = h("input", { type: "text", autocomplete: "off", "aria-label": "空欄" });
            inp.style.width = Math.max(4, tok.text.length + 1) + "ch";
            var wrap = h("span", { class: "blank-in" }, [inp]);
            function check() {
              var ok = sanitize(inp.value).toLowerCase() === sanitize(tok.text).toLowerCase();
              inp.className = ok ? "ok" : "ng";
              var old = wrap.querySelector(".ans"); if (old) old.remove();
              if (!ok) wrap.appendChild(h("span", { class: "ans", text: tok.text }));
            }
            inp.addEventListener("input", function () {
              inp.className = ""; var old = wrap.querySelector(".ans"); if (old) old.remove();
            });
            inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
            inputs.push(check);
            text.appendChild(wrap);
          }
        });
        cards.appendChild(h("div", { class: "card" }, [
          h("div", { class: "cloze-row" }, [
            h("span", { class: "num", text: String(idx + 1) }),
            h("div", { class: "cloze-body" }, [text, h("p", { class: "trans", text: item.q.trans })])
          ])
        ]));
      });
      app.appendChild(cards);

      // 下部バー
      bar.hidden = false;
      if (!st.revealAll) {
        bar.appendChild(h("button", { class: "btn-primary", text: (st.mode === "tap" ? "すべて表示" : "答え合わせ") + " →", on: { click: function () {
          if (st.mode === "tap") { st.revealAll = true; render(); }
          else { inputs.forEach(function (f) { f(); }); st.revealAll = true; renderBarOnly(); }
        } } }));
      } else renderBarOnly();
    }
    // 入力式は入力内容を保ったままバーだけ差し替える
    function renderBarOnly() {
      bar.innerHTML = "";
      bar.appendChild(h("button", { class: "btn-second", text: "もう一度", on: { click: function () { st.revealAll = false; render(); } } }));
      bar.appendChild(h("button", { class: "btn-second", text: "トップへ戻る", on: { click: showHome } }));
    }
    render();
  }

  // ===== 整序問題（タップで移動する方式） =====
  function initState(q) {
    return { q: q, bank: shuffle(q.sentence.split(" ")), answer: [], result: null };
  }

  function showSeijo() {
    var states = currentPart().seijo.map(initState);

    function render() {
      clear();
      var answered = states.filter(function (s) { return s.result; }).length;
      var correct = states.filter(function (s) { return s.result === "correct"; }).length;

      app.appendChild(h("div", { class: "page-head" }, [
        h("button", { class: "back-btn", text: "← 戻る", on: { click: showHome } }),
        h("h2", { text: "🔀 整序問題" }),
        h("p", { text: sel.lesson + " / " + sel.part + " — " + states.length + " 問" }),
        h("p", { class: "hint", text: "💡 タップで単語を移動して、文を組み立てます。" })
      ]));

      var cards = h("div", { class: "cards" });
      states.forEach(function (st, qi) {
        var locked = st.result !== null;
        var cls = st.result === "correct" ? "ok" : st.result === "incorrect" ? "ng" : "";
        var card = h("div", { class: "card " + cls });

        card.appendChild(h("div", { class: "q-head" }, [
          h("div", { class: "l" }, [
            h("span", { class: "num " + cls, text: st.result === "correct" ? "✓" : st.result === "incorrect" ? "✗" : String(qi + 1) }),
            h("span", { class: "tr", text: st.q.trans })
          ]),
          h("button", { class: "small-btn", text: "リセット", on: { click: function () { states[qi] = initState(st.q); render(); } } })
        ]));

        // 回答エリア
        var az = h("div", { class: "answer-zone " + (cls || (st.answer.length ? "has" : "")) });
        if (!st.answer.length) az.appendChild(h("span", { class: "ph", text: "ここに単語を並べよう" }));
        st.answer.forEach(function (w, wi) {
          az.appendChild(h("button", { class: "chip ans " + cls, text: w, disabled: locked ? "disabled" : null, on: { click: function () {
            if (locked) return; st.answer.splice(wi, 1); st.bank.push(w); render();
          } } }));
        });
        card.appendChild(h("div", { class: "zone" }, [h("p", { class: "zone-lb", text: "回答エリア（タップで戻す）" }), az]));

        if (st.result === "incorrect") {
          card.appendChild(h("div", { class: "correct-box" }, [h("p", { class: "k", text: "正解：" }), h("p", { class: "v", text: st.q.sentence })]));
        }

        // 単語バンク
        var bz = h("div", { class: "bank-zone" });
        if (!st.bank.length && !locked) bz.appendChild(h("span", { class: "ph", text: "全部使った！" }));
        st.bank.forEach(function (w, wi) {
          bz.appendChild(h("button", { class: "chip", text: w, disabled: locked ? "disabled" : null, on: { click: function () {
            if (locked) return; st.bank.splice(wi, 1); st.answer.push(w); render();
          } } }));
        });
        card.appendChild(h("div", { class: "zone" }, [h("p", { class: "zone-lb", text: "単語バンク（タップで選ぶ）" }), bz]));

        // 操作ボタン
        if (!locked) {
          var go = h("button", { class: "btn-primary wide", text: "解答する", on: { click: function () {
            st.result = st.answer.join(" ").toLowerCase() === st.q.sentence.toLowerCase() ? "correct" : "incorrect"; render();
          } } });
          if (!st.answer.length) go.disabled = true;
          card.appendChild(go);
        } else {
          card.appendChild(h("div", { class: "row2" }, [
            h("button", { class: "btn-second", text: "やり直す", on: { click: function () { st.result = null; render(); } } }),
            h("button", { class: "btn-second", text: "シャッフル", on: { click: function () { states[qi] = initState(st.q); render(); } } })
          ]));
        }
        cards.appendChild(card);
      });
      app.appendChild(cards);

      bar.hidden = false;
      bar.appendChild(h("span", { class: "score", text: "解答済み " + answered + " / " + states.length + "　正解 " + correct }));
      bar.appendChild(h("button", { class: "btn-second", text: "すべてリセット", on: { click: function () { states = states.map(function (s) { return initState(s.q); }); render(); } } }));
      bar.appendChild(h("button", { class: "btn-second", text: "トップへ戻る", on: { click: showHome } }));
    }
    render();
  }

  showHome();
})();
