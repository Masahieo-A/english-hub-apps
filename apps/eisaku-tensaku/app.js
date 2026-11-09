/* 英作文 文法添削 モック：画面切り替え・ヒント段階開示・辞書（すべて用意済みデータ） */
(function () {
  "use strict";
  var D = window.DEMO;
  var $ = function (id) { return document.getElementById(id); };

  /* 語数カウント（空白区切り） */
  function countWords(s) {
    var m = s.trim().match(/\S+/g);
    return m ? m.length : 0;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* 解答比較用の正規化 */
  function norm(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:"'’”“]/g, "");
  }

  /* ===== 入力画面 ===== */
  var topicEl = $("topic"), essayEl = $("essay");
  function loadSample() {
    topicEl.value = D.topic;
    essayEl.value = D.essay;
    updateWc();
  }
  function updateWc() {
    var n = countWords(essayEl.value);
    $("wc-inline").textContent = n;
    $("wc-bar").textContent = n;
    $("essay-err").textContent = "";
  }
  essayEl.addEventListener("input", updateWc);
  $("btn-sample").addEventListener("click", loadSample);

  function setStep(n) {
    var d1 = $("dot1"), d2 = $("dot2");
    if (n === 1) {
      d1.className = "dot dot-active"; d1.textContent = "1";
      d2.className = "dot dot-idle"; $("lab1").className = "step-label active"; $("lab2").className = "step-label";
    } else {
      d1.className = "dot dot-done"; d1.textContent = "✓";
      d2.className = "dot dot-active"; $("lab1").className = "step-label"; $("lab2").className = "step-label active";
    }
  }

  /* 「AIフィードバックを取得」：少し待ってから用意済みの結果を表示 */
  $("btn-submit").addEventListener("click", function () {
    var n = countWords(essayEl.value);
    if (n < 10) {
      $("essay-err").textContent = "英文が短すぎます。もう少し書いてから送信してください。";
      return;
    }
    var btn = $("btn-submit");
    btn.disabled = true;
    btn.textContent = "添削中…";
    setTimeout(function () {
      btn.disabled = false;
      btn.textContent = "AIフィードバックを取得 →";
      showResult();
    }, 600 + Math.floor(Math.random() * 600));
  });

  function showResult() {
    var essay = essayEl.value.trim();
    var n = countWords(essay);
    var req = $("wc-req").value.trim() || D.wordReq;
    var m = req.match(/^(\d+)\s*[-〜~]\s*(\d+)$/);
    var ok = m ? (n >= +m[1] && n <= +m[2]) : (/^\d+$/.test(req) ? n >= +req : true);
    $("r-topic").textContent = topicEl.value.trim();
    $("r-essay").textContent = essay;
    $("r-sat").textContent = ok ? "✓ 満たしている" : "✗ 満たしていない";
    $("r-sat").className = ok ? "ok" : "ng";
    $("r-wc").textContent = "（" + n + " 語 / 条件: " + req + "）";
    $("r-count").textContent = D.result.errors.length + " 件";
    $("r-good").textContent = D.result.positive;
    renderCards();
    $("view-input").hidden = true;
    $("bottombar").hidden = true;
    $("view-result").hidden = false;
    setStep(2);
    window.scrollTo(0, 0);
  }

  $("btn-again").addEventListener("click", function () {
    $("view-result").hidden = true;
    $("view-input").hidden = false;
    $("bottombar").hidden = false;
    setStep(1);
    window.scrollTo(0, 0);
  });

  /* ===== エラーカード（ヒント段階開示＋解答練習） ===== */
  function renderCards() {
    var box = $("cards");
    box.innerHTML = "";
    D.result.errors.forEach(function (e, i) { box.appendChild(buildCard(e, i)); });
  }

  function buildCard(e, idx) {
    var el = document.createElement("div");
    el.className = "card";
    var revealed = 1; // 開示済みの最大段階
    var labels = ["文法的な観点", "もう少し詳しく", "丁寧な説明"];

    el.innerHTML =
      '<div class="ec-head"><span class="num">' + (idx + 1) + '</span><div style="min-width:0;flex:1">' +
      '<span class="badge">' + esc(e.type) + '</span><p class="sent">&ldquo;' + esc(e.sentence) + '&rdquo;</p></div></div>' +
      '<div class="ec-body"><p class="mini" style="margin-bottom:12px">ヒント（段階的に確認できます）</p>' +
      '<div class="hints"></div><div class="practice-slot"></div></div>';
    var hintsBox = el.querySelector(".hints");

    function drawHints() {
      hintsBox.innerHTML = "";
      for (var k = 1; k <= 3; k++) {
        var row = document.createElement("div");
        row.className = "hint-row";
        var shown = k <= revealed, next = !shown && k === revealed + 1;
        var circle = '<div class="hn ' + (shown ? "shown" : next ? "next" : "lock") + '" data-k="' + k + '">' + k + "</div>";
        var body = "";
        if (shown) {
          body = '<p class="hlabel">' + labels[k - 1] + '</p><p class="htext">' + esc(e.hints[k - 1]) + "</p>";
          if (k === 3) body += '<p class="hterm">📖 文法用語：' + esc(e.term) + "</p>";
        } else if (next) {
          body = '<button type="button" class="hnext" data-k="' + k + '">ヒント ' + k + " を見る →</button>";
        } else {
          body = '<p class="hlock">ヒント ' + (k - 1) + " を見た後に解放されます</p>";
        }
        row.innerHTML = circle + '<div class="hbody">' + body + "</div>";
        hintsBox.appendChild(row);
      }
    }
    hintsBox.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-k]");
      if (!t) return;
      var k = +t.getAttribute("data-k");
      if (k === revealed + 1) { revealed = k; drawHints(); }
    });
    drawHints();
    el.querySelector(".practice-slot").appendChild(buildPractice(e));
    return el;
  }

  /* 解答練習ウィジェット：下線部のみ入力 → 答え合わせ → 解答表示 */
  function buildPractice(e) {
    var w = document.createElement("div");
    w.className = "practice";
    w.innerHTML =
      '<p class="mini" style="margin-bottom:8px">✏️ 解答を入力して練習</p>' +
      '<p class="warn"><span aria-hidden="true">⚠️</span>下線部のみ解答欄に入力してください。</p>' +
      '<p class="masked">' + esc(e.masked) + "</p>" +
      '<input class="pinput" type="text" placeholder="下線部に入る語だけを入力">' +
      '<div class="pres-slot"></div>' +
      '<div class="pbtns"><button type="button" class="btn-fill chk" disabled>答え合わせをする</button>' +
      '<button type="button" class="btn-sub show">解答を見る</button></div>' +
      '<div class="ans-slot"></div>';
    var input = w.querySelector(".pinput"), res = w.querySelector(".pres-slot");
    var chk = w.querySelector(".chk"), show = w.querySelector(".show"), ans = w.querySelector(".ans-slot");
    var open = false;

    function check() {
      if (!input.value.trim()) return;
      var ok = e.answers.some(function (a) { return norm(a) === norm(input.value); });
      res.innerHTML = ok
        ? '<p class="pres good-c"><span style="font-size:18px">◯</span> 正解です！よくできました。</p>'
        : '<p class="pres bad-c"><span style="font-size:18px">✕</span> もう一度挑戦してみましょう。</p>';
    }
    input.addEventListener("input", function () { res.innerHTML = ""; chk.disabled = !input.value.trim(); });
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") check(); });
    chk.addEventListener("click", check);
    show.addEventListener("click", function () {
      open = !open;
      show.textContent = open ? "解答を隠す" : "解答を見る";
      ans.innerHTML = open
        ? '<div class="answer"><p class="mini green" style="margin-bottom:4px">模範解答</p>' +
          '<p>空欄：<b class="ok mono">' + esc(e.answers.join(" / ")) + "</b></p>" +
          '<p class="mono">' + esc(e.corrected) + "</p></div>"
        : "";
    });
    return w;
  }

  /* ===== 辞書（架空・数語のみ） ===== */
  function buildDict(openInit) {
    var wrap = document.createElement("div");
    wrap.className = "card";
    wrap.innerHTML =
      '<button type="button" class="dict-head"><span class="ico">📖</span>' +
      '<div><p class="t">辞書</p><p class="s">日英変換・英語類義語を検索</p></div><span class="arrow"></span></button>' +
      '<div class="dict-body">' +
      '<div><p class="mini" style="margin-bottom:8px">日本語 → 英語候補</p>' +
      '<div class="dict-row"><input class="ja-q" type="text" placeholder="例：感動"><select class="ja-pos"><option value="">品詞</option><option>名詞</option><option>動詞</option><option>形容詞</option><option>副詞</option></select><button type="button" class="ja-go">検索</button></div>' +
      '<div class="dict-res ja-res"><p class="empty">検索結果がここに表示されます</p></div>' +
      '<p class="dict-hint">デモ用の収録語：感動 / 感動する / 手伝う / 思い出 / 美しい / たびたび</p></div>' +
      '<div><p class="mini" style="margin-bottom:8px">英語 → 類義語</p>' +
      '<div class="dict-row"><input class="en-q" type="text" placeholder="e.g. happy"><button type="button" class="en-go">Search</button></div>' +
      '<div class="dict-res en-res"><p class="empty">検索結果がここに表示されます</p></div>' +
      '<p class="dict-hint">デモ用の収録語：happy / big / important / interesting / help</p></div></div>';
    var body = wrap.querySelector(".dict-body"), arrow = wrap.querySelector(".arrow"), head = wrap.querySelector(".dict-head");
    var isOpen = openInit;
    function sync() { body.hidden = !isOpen; arrow.textContent = isOpen ? "▲" : "▼"; head.style.borderBottom = isOpen ? "" : "0"; }
    head.addEventListener("click", function () { isOpen = !isOpen; sync(); });
    sync();

    var jaQ = wrap.querySelector(".ja-q"), jaPos = wrap.querySelector(".ja-pos"), jaRes = wrap.querySelector(".ja-res");
    function jaSearch() {
      var q = jaQ.value.trim();
      if (!q) return;
      jaRes.innerHTML = '<p class="empty">検索中…</p>';
      setTimeout(function () {
        var hit = D.jaEn.filter(function (x) { return x.q === q; })[0];
        var list = hit ? hit.list.filter(function (r) { return !jaPos.value || r[1] === jaPos.value; }) : [];
        if (!list.length) { jaRes.innerHTML = '<p class="empty">該当する単語が見つかりませんでした（デモ辞書は数語のみ）</p>'; return; }
        jaRes.innerHTML = "<ul>" + list.map(function (r) {
          return '<li><span class="w">' + esc(r[0]) + '</span><span class="p">' + esc(r[1]) + "</span></li>";
        }).join("") + "</ul>";
      }, 300);
    }
    wrap.querySelector(".ja-go").addEventListener("click", jaSearch);
    jaQ.addEventListener("keydown", function (ev) { if (ev.key === "Enter") jaSearch(); });

    var enQ = wrap.querySelector(".en-q"), enRes = wrap.querySelector(".en-res");
    function enSearch() {
      var q = enQ.value.trim().toLowerCase();
      if (!q) return;
      enRes.innerHTML = '<p class="empty">検索中…</p>';
      setTimeout(function () {
        var hit = D.enSyn.filter(function (x) { return x.q === q; })[0];
        if (!hit) { enRes.innerHTML = '<p class="empty">類義語が見つかりませんでした（デモ辞書は数語のみ）</p>'; return; }
        enRes.innerHTML = "<ul>" + hit.list.map(function (r) {
          return '<li><span class="w">' + esc(r[0]) + '</span><span class="p">' + esc(r[1]) + '</span><span class="d">— ' + esc(r[2]) + "</span></li>";
        }).join("") + "</ul>";
      }, 300);
    }
    wrap.querySelector(".en-go").addEventListener("click", enSearch);
    enQ.addEventListener("keydown", function (ev) { if (ev.key === "Enter") enSearch(); });
    return wrap;
  }
  Array.prototype.forEach.call(document.querySelectorAll(".dict-slot"), function (slot) {
    slot.appendChild(buildDict(slot.getAttribute("data-open") === "1"));
  });

  loadSample();
})();
