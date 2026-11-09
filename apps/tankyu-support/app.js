/* 探究サポート（デモ）— 通信なし。data.js の決まった文章を表示するだけ。 */
(function () {
  "use strict";
  var D = window.TS_DATA;
  var log = document.getElementById("chat-log");
  var chatView = document.getElementById("chat-view");
  var interView = document.getElementById("inter-view");
  var form = document.getElementById("input-form");
  var input = document.getElementById("input-text");
  var busy = false;
  var state = { genre: null };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
  }

  function scrollDown() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function lockAll(lock) {
    var btns = log.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = lock; }
  }

  function userMsg(text) {
    log.appendChild(el("div", "msg-user", text));
    scrollDown();
  }

  /* 0.6〜1秒の「考え中…」のあとで AI 応答を出す */
  function aiReply(build) {
    busy = true;
    lockAll(true);
    var wait = el("div", "msg-ai");
    var t = el("div", "thinking");
    var dots = el("span", "dots");
    dots.appendChild(el("span")); dots.appendChild(el("span")); dots.appendChild(el("span"));
    t.appendChild(dots);
    t.appendChild(document.createTextNode("AIが考えています…"));
    wait.appendChild(t);
    log.appendChild(wait);
    scrollDown();
    window.setTimeout(function () {
      log.removeChild(wait);
      var msg = el("div", "msg-ai");
      build(msg);
      log.appendChild(msg);
      busy = false;
      // 最新のAIメッセージ内のボタンだけ有効、過去のものは無効のまま
      var latest = msg.querySelectorAll("button");
      for (var i = 0; i < latest.length; i++) { latest[i].disabled = false; }
      scrollDown();
    }, 600 + Math.floor(Math.random() * 400));
  }

  function bubble(msg, text) { msg.appendChild(el("div", "bubble", text)); }

  /* ① 挨拶＋9分野 */
  function greet() {
    aiReply(function (msg) {
      bubble(msg, "こんにちは！ 探究サポートAIです。一緒に、君だけの「問い」を見つけていこう。まずは、気になる分野を1つ選んでみてね。");
      var grid = el("div", "opt-grid");
      D.GENRES.forEach(function (g) {
        var b = el("button", "opt");
        b.type = "button";
        b.appendChild(el("span", "ic", g.icon));
        b.appendChild(el("span", null, g.name));
        b.addEventListener("click", function () { pickGenre(g); });
        grid.appendChild(b);
      });
      msg.appendChild(grid);
    });
  }

  /* ② 4視点カード */
  function pickGenre(g) {
    if (busy) { return; }
    state.genre = g;
    userMsg(g.name);
    aiReply(function (msg) {
      bubble(msg, g.intro + "\n\n" + D.FIXED_TAIL);
      msg.firstChild.style.whiteSpace = "pre-wrap";
      D.PERSP.forEach(function (p, i) {
        var sec = el("section", "persp tone-" + p.tone);
        sec.appendChild(el("div", "persp-head", p.display));
        var body = el("div", "persp-body");
        g.q[i].forEach(function (q) {
          var c = el("button", "persp-card");
          c.type = "button";
          c.appendChild(el("b", null, q));
          c.appendChild(el("small", null, "タップしてこの視点で進む"));
          c.addEventListener("click", function () { pickQuestion(q); });
          body.appendChild(c);
        });
        sec.appendChild(body);
        msg.appendChild(sec);
      });
    });
  }

  /* ③ レンズ */
  function pickQuestion(q) {
    if (busy) { return; }
    userMsg(q);
    aiReply(function (msg) {
      bubble(msg, "いい疑問だね！ そこに着目したんだ。じゃあ次は、ちょっと発想を変えてみよう。「全く違う分野のメガネをかけてみよう」。今の疑問に別の視点を掛け合わせると、思いがけない問いが生まれるよ。");
      var mm = el("div", "matrix-mini");
      mm.appendChild(el("div", "t", "いま探しているのは「交差点」"));
      mm.appendChild(el("div", "small", "1つ目（X軸）で選んだテーマに、2つ目（Y軸）のレンズをかけると、新しい問いが生まれます。次は「どのレンズで見るか」を選ぼう。"));
      var grid = el("div", "matrix-grid");
      grid.appendChild(el("div", null, "X軸：テーマ"));
      grid.appendChild(el("div", null, "×"));
      grid.appendChild(el("div", null, "Y軸：レンズ"));
      grid.appendChild(el("div", "wide", "交差点 → 探究の問い"));
      mm.appendChild(grid);
      msg.appendChild(mm);
      var chips = el("div", "chips");
      D.LENSES.forEach(function (l) {
        var b = el("button", "chip");
        b.type = "button";
        b.title = l.desc;
        b.appendChild(el("span", null, l.icon));
        b.appendChild(el("span", null, l.name));
        b.addEventListener("click", function () { pickLens(l); });
        chips.appendChild(b);
      });
      msg.appendChild(chips);
      msg.appendChild(el("div", "lens-notes", "心理学＝人の気持ち／テクノロジー＝技術／ジェンダー＝性別による違い／デザイン＝形や使いやすさ／言語＝言葉の違い／マスメディア＝伝え方／インフラ＝暮らしの土台"));
    });
  }

  /* ④ 交差点まとめ画面 */
  function pickLens(l) {
    if (busy || !state.genre) { return; }
    var g = state.genre;
    document.getElementById("x-genre").textContent = g.name;
    document.getElementById("x-focus").textContent = g.focus;
    document.getElementById("y-lens").textContent = l.name;
    document.getElementById("y-desc").textContent = l.y;
    var ol = document.getElementById("q-list");
    ol.textContent = "";
    D.questions(g.name, l.name).forEach(function (q) { ol.appendChild(el("li", null, q)); });
    document.getElementById("closing").textContent = D.CLOSING;
    chatView.hidden = true;
    interView.hidden = false;
    window.scrollTo(0, 0);
  }

  function backToChat() {
    interView.hidden = true;
    chatView.hidden = false;
    scrollDown();
  }

  function reset() {
    log.textContent = "";
    state.genre = null;
    busy = false;
    interView.hidden = true;
    chatView.hidden = false;
    input.value = "";
    window.scrollTo(0, 0);
    greet();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) { return; }
    var v = input.value.trim();
    if (!v) { return; }
    input.value = "";
    userMsg(v);
    aiReply(function (msg) {
      bubble(msg, "デモでは選択肢から選んで進めます。上のボタンやカードから選んでみてね。");
    });
    // 直前の選択肢は引き続き使えるように再有効化（案内メッセージ後）
    window.setTimeout(function () {
      var msgs = log.querySelectorAll(".msg-ai");
      for (var i = msgs.length - 1; i >= 0; i--) {
        var bs = msgs[i].querySelectorAll("button");
        if (bs.length) { for (var j = 0; j < bs.length; j++) { bs[j].disabled = false; } break; }
      }
    }, 1100);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });

  document.getElementById("reset-btn").addEventListener("click", reset);
  document.getElementById("to-top").addEventListener("click", reset);
  document.getElementById("to-chat").addEventListener("click", backToChat);

  greet();
})();
