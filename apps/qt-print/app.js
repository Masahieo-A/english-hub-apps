// Question Time（デモ）— 架空データだけで動く。通信・ファイル読み込みはしない
(function () {
  "use strict";
  const D = window.QT_DATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- 文言 ----------
  const MODES = {
    batch: "Googleフォームの回答をまとめて読み込み、全員分の用紙を作ります。",
    absent: "essay を出していない生徒用に、トピックから sample essay を作り、その essay で用紙を作ります（氏名欄は空欄・同じ用紙を必要な枚数だけ印刷）。",
    manual: "フォームを出し忘れた生徒の essay を手で入力して用紙を作ります。手順3からは一斉作成と同じ流れです。",
  };
  const Q_TYPES = [
    { label: "どっち型", structure: "選択と理由（I choose ... because）" },
    { label: "なぜ型", structure: "理由の説明（because / One reason is that）" },
    { label: "もしも型", structure: "条件と予想（If ..., I think ... because）" },
  ];
  const LANGUAGE_RUBRIC = [
    ["2", "指定構造、または機能が同じ構造（等価構造）を使い、意味が通る"],
    ["1", "構造を使おうとしているが誤りがあり、意味が不明瞭"],
    ["0", "指定構造・等価構造が見られない／日本語で解答"],
  ];
  // 汎用予備問題（essayに依存しない）
  const BACKUP = [
    ["Think about the main idea of your essay. Is this idea more important for you or for people around you? Choose one and give one reason.", "あなたのessayの主な考えは、あなた自身と、あなたの周りの人のどちらにとって、より大切だと思いますか。どちらかを選び、理由を1つ書きましょう（1文でよい）。"],
    ["Choose the most important reason in your essay. Why is this reason important to you? Give one reason.", "あなたのessayでいちばん大事な理由を1つ選びましょう。それがあなたにとって大事なのはなぜですか。自分の考えを1文で書きましょう。"],
    ["Think about the main idea of your essay. If you lived in another country, do you think your idea would still be true? Give one reason.", "もし外国に住んでいたら、あなたのessayの主な考えはそれでも当てはまると思いますか。予想と理由を1つ書きましょう（1文でよい）。"],
  ];
  const PROMPT_TEXT = "（デモ用の短縮版です。本物は約8,000字のシステムプロンプトです）\n\nあなたは高校英語の「Question Time」担当です。\n生徒の essay（ID と本文のみ）を受け取り、次の形式で表（TSV）を出力します。\n\n- 各生徒に3問。Q1 どっち型 → Q2 なぜ型 → Q3 もしも型\n- 各問は essay の一字一句の引用（5〜30語）に基づく\n- 質問は12〜35語・中学2年までの語彙\n- 文法の使用は指示しない\n- 論点・A例・B例・等価構造を付ける";

  // ---------- 状態 ----------
  const state = {
    mode: "batch", kind: "student", status: "all", idx: 0,
    batchLoaded: false, absentLoaded: false,
    manual: [], // {cls, num, name, essay, sample}
    copied: new Set(),
    touched: new Set(), // 編集パネルで直した生徒ID（✗でも編集中は用紙を消さない）
    edId: null,         // 編集パネルに表示中の生徒ID
    view: "preview",    // preview | edit
  };
  // サンプルの初期状態（「元に戻す」用）
  const ORIG = JSON.stringify({ students: D.students, absent: D.absent, manualSample: D.manualSample });
  const EDIT_WHERE = {
    主張: "採点シート", 理由: "採点シート", 質問: "解答用紙・採点シート・返却シート", 和訳: "解答用紙・返却シート",
    引用: "解答用紙の下線（essayの本文と一字一句同じにする）", 論点: "採点シート・返却シート（A基準）",
    A例: "採点シート・返却シート", B例: "採点シート", 等価構造: "採点シート・返却シート", 意図: "採点シート",
  };
  const ED_Q_FIELDS = [["質問", "q"], ["和訳", "ja"], ["引用", "quote"], ["論点", "point"], ["A例", "a"], ["B例", "b"], ["等価構造", "eq"], ["意図", "intent"]];

  // ---------- 文字列処理（引用の点検用） ----------
  const normalize = (t) => String(t || "").normalize("NFKC").toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  const words = (t) => normalize(t).match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];
  const joined = (t) => " " + words(t).join(" ") + " ";
  const containsQuote = (hay, quote) => words(quote).length > 0 && joined(hay).includes(joined(quote));
  function sharesNgram(a, b, n) {
    n = n || 4;
    const wa = words(a), wb = joined(b);
    for (let i = 0; i + n <= wa.length; i++) if (wb.includes(" " + wa.slice(i, i + n).join(" ") + " ")) return true;
    return false;
  }

  /** 点検：質問がなければ missing、引用が本文にない等は ng、語数や B例の重なりは warn */
  function check(s) {
    if (!s.q) return { level: "missing", problems: [{ level: "memo", msg: "質問なし" }] };
    const problems = [];
    s.q.forEach((x, i) => {
      const n = i + 1;
      if (!containsQuote(s.essay, x.quote)) problems.push({ level: "ng", msg: `Q${n}: 引用がessayの本文にない` });
      const qw = words(x.quote).length;
      if (qw < 5 || qw > 30) problems.push({ level: "ng", msg: `Q${n}: 引用が${qw}語（5〜30語にする）` });
      const w = words(x.q).length;
      if (w < 12 || w > 40) problems.push({ level: "warn", msg: `Q${n}: 質問が${w}語（12〜35語が目安）` });
      if (sharesNgram(x.quote, x.b)) problems.push({ level: "warn", msg: `Q${n}: B例が引用の語句を使っている（B例は一般論にする）` });
    });
    const level = problems.some((p) => p.level === "ng") ? "ng" : problems.length ? "warn" : "ok";
    return { level, problems };
  }

  // ---------- 生徒リスト ----------
  function manualStudents() {
    return state.manual.map((m, i) => {
      const num = parseInt(m.num, 10) || 0;
      const base = m.sample ? D.manualSample : null;
      return {
        id: m.cls && num ? `${m.cls}-${String(num).padStart(2, "0")}` : `手入力${i + 1}`,
        cls: m.cls, num, name: m.name, essay: m.essay,
        claim: base ? base.claim : "", reasons: base ? base.reasons : "",
        q: base && m.essay === base.essay ? base.q : null,
      };
    });
  }
  function students() {
    if (state.mode === "batch") return state.batchLoaded ? D.students : [];
    if (state.mode === "absent") return state.absentLoaded ? [D.absent] : [];
    return manualStudents().filter((s) => s.essay.trim());
  }

  // ---------- 表示のしくみ ----------
  function settings() {
    return { title: $("s-title").value, date: $("s-date").value, topic: $("s-topic").value };
  }
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); } catch (e) { /* 失敗しても演出だけ続ける */ }
    toast(msg);
  }

  function setMode(mode) {
    state.mode = mode; state.idx = 0;
    [...$("mode-bar").children].forEach((b) => { b.classList.toggle("on", b.dataset.mode === mode); b.setAttribute("aria-selected", String(b.dataset.mode === mode)); });
    document.querySelectorAll("[data-only]").forEach((el) => { el.hidden = el.dataset.only !== mode; });
    document.querySelectorAll("[data-hide]").forEach((el) => { el.hidden = el.dataset.hide === mode; });
    $("mode-note").textContent = MODES[mode];
    refreshAll();
  }

  function refreshAll() {
    renderSummaries(); renderBatches(); renderCheck(); renderSheets();
  }

  function renderSummaries() {
    const n = D.students.length;
    $("load-summary").innerHTML = state.batchLoaded ? `<div class="notice">サンプルを読み込みました：essay ${n}人分・質問 ${n}人分（IDで結び付け済み）。</div>` : "";
    $("absent-summary").innerHTML = state.absentLoaded ? `<div class="notice">sample essay（${words(D.absent.essay).length}語）と質問3問を取り込みました。氏名欄は空欄で印刷されます。</div>` : "";
    const ms = manualStudents();
    $("manual-summary").innerHTML = ms.length ? `<div class="notice">入力済み ${ms.length}人（essayあり ${ms.filter((s) => s.essay.trim()).length}人・質問あり ${ms.filter((s) => s.q).length}人）</div>` : "";
  }

  function renderManual() {
    const box = $("manual-list");
    box.innerHTML = "";
    state.manual.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "manual-item";
      el.innerHTML = `<div class="manual-head">
        <input class="input" data-f="cls" placeholder="クラス（例 2A）" value="${esc(m.cls)}" />
        <input class="input narrow" data-f="num" type="number" min="1" max="45" placeholder="番号" value="${esc(m.num)}" />
        <input class="input" data-f="name" placeholder="氏名" value="${esc(m.name)}" />
        <button type="button" class="btn btn-secondary btn-sm manual-del">削除</button></div>
        <textarea class="input" data-f="essay" rows="5" lang="en" placeholder="essay の本文をそのまま入力">${esc(m.essay)}</textarea>`;
      el.querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("input", () => {
        m[inp.dataset.f] = inp.value; refreshAll();
      }));
      el.querySelector(".manual-del").addEventListener("click", () => { state.manual.splice(i, 1); renderManual(); refreshAll(); });
      box.appendChild(el);
    });
  }

  // 手順3：Gemに渡すバッチのボタン
  function renderBatches() {
    const size = Math.max(1, Math.min(10, parseInt($("batch-size").value, 10) || 5));
    const onlyMissing = $("batch-missing-only").checked;
    const list = students().filter((s) => !onlyMissing || !s.q);
    const box = $("batches");
    box.innerHTML = "";
    if (state.mode !== "absent" && students().length && !list.length) {
      box.innerHTML = '<span class="muted small">質問がまだない生徒はいません（チェックを外すと全員分のボタンが出ます）。</span>';
      return;
    }
    for (let i = 0; i < list.length; i += size) {
      const chunk = list.slice(i, i + size);
      const key = chunk.map((s) => s.id).join(",");
      const b = document.createElement("button");
      b.type = "button";
      const label = () => `${state.copied.has(key) ? "✓ " : ""}${chunk[0].id} 〜 ${chunk[chunk.length - 1].id}（${chunk.length}人）`;
      b.className = "btn btn-secondary btn-sm batch" + (state.copied.has(key) ? " done" : "");
      b.textContent = label();
      b.addEventListener("click", () => {
        const text = `次の${chunk.length}人分を作成してください。\n` + chunk.map((s) => `${s.id}\t${s.essay.replace(/\s+/g, " ")}`).join("\n");
        copy(text, `${chunk.length}人分をコピーしました。Gemに貼り付けてください。`);
        state.copied.add(key); b.classList.add("done"); b.textContent = label();
      });
      box.appendChild(b);
    }
  }

  // 手順4：点検の表
  function renderCheck() {
    const rows = students().map((s) => ({ s, r: check(s) }));
    const counts = { ok: 0, warn: 0, ng: 0, missing: 0 };
    rows.forEach(({ r }) => counts[r.level]++);
    const shown = rows.filter(({ r }) => state.status === "all" || (state.status === "ng" && ["ng", "warn"].includes(r.level)) || (state.status === "missing" && r.level === "missing"));
    const label = { ok: ["ok", "OK"], warn: ["warn", "注意"], ng: ["ng", "✗ 要修正"], missing: ["", "質問なし"] };
    $("check-table").innerHTML =
      "<thead><tr><th>ID</th><th>氏名</th><th>語数</th><th>判定</th><th>内容</th></tr></thead><tbody>" +
      (shown.length ? shown.map(({ s, r }) => `<tr class="${r.level === "ng" ? "row-ng" : ""}"><td>${esc(s.id)}</td><td>${esc(s.name || "（空欄）")}</td><td>${words(s.essay).length}</td>
        <td><span class="badge ${label[r.level][0]}">${label[r.level][1]}</span></td>
        <td class="small">${r.level === "ok" ? "引用3つとも本文に一字一句あり" : r.problems.map((p) => `<div class="issue-${p.level}">${p.level === "ng" ? "✗ " : p.level === "warn" ? "△ " : ""}${esc(p.msg)}</div>`).join("")}</td></tr>`).join("")
        : '<tr><td colspan="5" class="muted">まだ読み込んでいません</td></tr>') + "</tbody>";
    const f = $("status-filter").children;
    f[0].textContent = `全員 ${rows.length}`;
    f[1].textContent = `要確認 ${counts.ng + counts.warn}`;
    f[2].textContent = `質問なし ${counts.missing}`;
  }

  // ---------- A4 用紙の組み立て ----------
  function markQuotes(essay, quotes) {
    const spans = [];
    quotes.forEach((q, i) => {
      const w = words(q);
      if (!w.length) return;
      const re = new RegExp(w.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]")).join("[^A-Za-z0-9'’]+"), "i");
      const m = re.exec(essay);
      if (m && !spans.some((s) => m.index < s.end && m.index + m[0].length > s.start)) spans.push({ start: m.index, end: m.index + m[0].length, n: i + 1 });
    });
    spans.sort((a, b) => a.start - b.start);
    let out = "", pos = 0;
    spans.forEach((s) => {
      out += esc(essay.slice(pos, s.start)) + `<u>${esc(essay.slice(s.start, s.end))}</u><sup>Q${s.n}</sup>`;
      pos = s.end;
    });
    return out + esc(essay.slice(pos));
  }
  const qType = (q, i) => {
    if (/choose one/i.test(q)) return Q_TYPES[0];
    if (/\bif\b/i.test(q)) return Q_TYPES[2];
    if (/\bwhy\b/i.test(q)) return Q_TYPES[1];
    return Q_TYPES[i] || Q_TYPES[0];
  };
  const rubricFor = (quote, point) => ({
    A: `問いに答え、essayの「${quote}」とつなげて説明している（論点: ${point}）`,
    B: `問いには答えているが、essayの「${quote}」とつながらない一般論`,
    C: "問いに答えていない／無回答／essayの丸写しだけ",
  });
  const footId = (s) => (s.absent ? "未提出者用" : s.id);
  const idLabel = (s) => (s.absent ? "未提出者用" : `${s.cls} ${s.num ? s.num + "番" : ""}`.trim());

  function headBlock(s, st, subtitle) {
    return `<div class="s-head">
      <div class="s-title">
        <div class="brand">QUESTION TIME ・ ${esc(subtitle)}</div>
        <h1>${esc(st.title)}</h1>
        ${st.topic ? `<div class="topic" lang="en">${esc(st.topic)}</div>` : ""}
      </div>
      <div class="idbox">
        <div>クラス・番号</div><div>${s.absent ? "" : esc(s.cls) + "　" + (s.num ? s.num + "番" : "")}</div>
        <div>氏名</div><div class="name">${esc(s.name)}</div>
        <div>実施日</div><div>${esc(st.date ? st.date.replace(/-/g, "/") : "")}</div>
      </div>
    </div>`;
  }

  /** 印刷に使う質問。点検が✗または質問なしなら、予備問題のチェックがあるときだけ予備問題にする */
  function questionsFor(s) {
    const r = check(s);
    if (s.q && (r.level !== "ng" || state.touched.has(s.id))) return { backup: false, items: s.q, claim: s.claim, reasons: s.reasons };
    if (!$("use-backup").checked) return null;
    return { backup: true, items: BACKUP.map(([t, ja]) => ({ quote: "", q: t, ja, intent: "汎用予備問題", point: "", a: "", b: "", eq: "" })), claim: s.claim, reasons: "" };
  }

  function studentSheet(s, qd, st) {
    return `<section class="sheet student"><div class="sheet-inner">
      ${headBlock(s, st, "解答用紙")}
      <div class="essay-box"><div class="label">YOUR ESSAY</div><div class="essay-text" lang="en">${qd.backup ? esc(s.essay) : markQuotes(s.essay, qd.items.map((x) => x.quote))}</div></div>
      ${qd.items.map((x, i) => `<div class="q">
        <div class="q-head"><span class="q-no">Q${i + 1}</span><span class="q-text" lang="en">${esc(x.q)}</span>
          <span class="q-score">内容<span></span> 英語<span></span></span></div>
        ${x.ja ? `<div class="q-ja">${esc(x.ja)}</div>` : ""}
        <div class="lines">${'<div class="line"></div>'.repeat(4)}</div>
      </div>`).join("")}
    </div>
    <div class="sheet-foot"><span>${esc(footId(s))}${qd.backup ? "　予備問題" : ""}</span></div>
    </section>`;
  }

  function teacherSheet(s, qd, st) {
    return `<section class="sheet teacher"><div class="sheet-inner">
      <div class="t-head">
        <div>
          <div class="s-title"><div class="brand">QUESTION TIME ・ 採点シート</div></div>
          <h1>${esc(idLabel(s))}　${esc(s.name)}</h1>
          <div class="muted">${esc(st.title)}${st.date ? `（${esc(st.date.replace(/-/g, "/"))}）` : ""}</div>
        </div>
        <div class="t-total"><div>内容 <span></span>/${qd.backup ? "—" : "6"}</div><div>英語 <span></span>/6</div></div>
      </div>
      ${qd.backup
        ? '<p class="backup-note">汎用予備問題で実施（内容は評価対象外。英語のみ採点）</p>'
        : `<div class="t-claim"><b>主張：</b>${esc(qd.claim)}<br /><b>理由：</b>${esc(qd.reasons)}</div>`}
      ${qd.items.map((x, i) => {
        const rb = rubricFor(x.quote, x.point);
        const t = qType(x.q, i);
        return `<div class="t-q">
          <div class="q-head"><span><span class="q-no">Q${i + 1}</span> <span class="t-type">${t.label}</span>　指定構造: ${t.structure}</span>
            <span class="t-scores">
              <span class="box">内容 <span class="opt">0</span><span class="opt">1</span><span class="opt">2</span></span>
              <span class="box">英語 <span class="opt">0</span><span class="opt">1</span><span class="opt">2</span></span>
            </span></div>
          <div lang="en"><b>Q:</b> ${esc(x.q)}</div>
          ${qd.backup ? "" : `<div class="muted">意図：${esc(x.intent)}</div>
          <div class="t-grid"><b>A 2点</b><span>${esc(rb.A)}</span><b>B 1点</b><span>${esc(rb.B)}</span><b>C 0点</b><span>${esc(rb.C)}</span></div>
          <div class="t-samples"><div><b>A例</b> <span lang="en">${esc(x.a)}</span></div><div><b>B例</b> <span lang="en">${esc(x.b)}</span></div></div>
          <div><b>等価構造（英語2点）：</b><span lang="en">${esc(x.eq)}</span></div>`}
        </div>`;
      }).join("")}
      <div class="t-rules">
        <b>英語（Language）全問共通：</b>${LANGUAGE_RUBRIC.map(([p, t]) => `${p}＝${esc(t)}`).join("　")}<br />
        <b>逐語コピー：</b>essayの連続15語以上の写しは内容の加点根拠にしない。
        <b>日本語：</b>内容は日本語でも満点可・英語は0。
        解答の「真偽」ではなく「essayの論理との接続」を見る。
      </div>
    </div>
    <div class="sheet-foot"><span>${esc(footId(s))}</span><span>essayの内容は引用で確認できます（essayを読み返さずに採点できる設計）</span></div>
    </section>`;
  }

  function feedbackSheet(s, qd, st) {
    return `<section class="sheet teacher feedback"><div class="sheet-inner">
      ${headBlock(s, st, "返却シート")}
      <p>点数よりも、<b>A基準と解答例</b>を読んで「自分のessayの理由と、どうつなげればよかったか」を確かめましょう。解答用紙と一緒に見てください。</p>
      ${qd.items.map((x, i) => {
        const rb = rubricFor(x.quote, x.point);
        return `<div class="f-q">
          <div class="q-head"><span class="q-no">Q${i + 1}</span><span class="q-text" lang="en">${esc(x.q)}</span></div>
          ${x.ja ? `<div class="q-ja">${esc(x.ja)}</div>` : ""}
          ${qd.backup ? "" : `<div class="f-row"><b>内容のA基準</b><span>${esc(rb.A)}</span></div>
          <div class="f-row"><b>解答例</b><span lang="en">${esc(x.a)}</span></div>
          <div class="f-row"><b>使える表現</b><span lang="en">${esc(x.eq)}</span></div>`}
          <div class="f-row"><b>直すなら</b><span class="lines"><div class="line"></div><div class="line"></div></span></div>
        </div>`;
      }).join("")}
      <div class="f-self">
        <b>次のessayに向けて（想定問答）</b>
        <p class="small">essayはAIや友だちの力を借りて書いてもかまいません。でも最後に説明するのは自分です。次に書くときは、書き終える前に次の2つを準備しておこう。</p>
        <div class="f-row"><b>来そうな反論</b><span class="lines"><div class="line"></div><div class="line"></div></span></div>
        <div class="f-row"><b>それへの答え</b><span class="lines"><div class="line"></div><div class="line"></div><div class="line"></div></span></div>
      </div>
    </div>
    <div class="sheet-foot"><span>${esc(footId(s))}</span></div>
    </section>`;
  }

  // 印刷対象の一覧（未提出者用は枚数ぶん複製。複製は画面では隠し、印刷でだけ出す）
  function printList() {
    const out = [];
    students().forEach((s) => {
      const qd = questionsFor(s);
      if (!qd) return;
      out.push({ s, qd, dup: false });
      if (s.absent && state.kind !== "teacher") {
        const copies = Math.max(1, Math.min(60, parseInt($("absent-copies").value, 10) || 1));
        for (let i = 1; i < copies; i++) out.push({ s, qd, dup: true });
      }
    });
    return out;
  }

  function renderSheets() {
    const st = settings();
    const list = printList();
    const total = students().length;
    const uniq = list.filter((x) => !x.dup);
    state.idx = Math.max(0, Math.min(state.idx, uniq.length - 1));
    const make = { student: studentSheet, teacher: teacherSheet, feedback: feedbackSheet }[state.kind];
    $("sheets").innerHTML = list.map((x) => `<div class="sheet-wrap${x.dup ? " dup off-screen" : ""}">${make(x.s, x.qd, st)}</div>`).join("");
    const empty = $("sheet-empty");
    if (!uniq.length) {
      empty.hidden = false;
      empty.textContent = total ? "印刷できる生徒がいません（質問がない・✗の生徒は「予備問題で印刷する」にチェックを入れると印刷できます）" : "印刷できる生徒がいません（手順2でサンプルを読み込んでください）";
    } else empty.hidden = true;
    $("preview-nav").hidden = !uniq.length || state.view === "edit";
    const sheetWord = state.kind === "teacher" ? "採点シート" : state.kind === "feedback" ? "返却シート" : "解答用紙";
    $("print-count").textContent = total ? `印刷対象：${uniq.length}人（${list.length}枚の${sheetWord}）${total - uniq.length ? `／対象外 ${total - uniq.length}人` : ""}` : "（まだ生徒が読み込まれていません）";
    applyScale(); markCurrent();
  }

  // ---------- 編集パネル（表示中の1人分を直す。3種類の用紙すべてに反映） ----------
  const curStudent = () => { const l = printList().filter((x) => !x.dup); return l[state.idx] ? l[state.idx].s : null; };
  const isManualSample = (s) => state.mode === "manual";
  function renderEditor(force) {
    const ed = $("editor"), s = curStudent();
    ed.hidden = !s || state.view !== "edit";
    if (!s) { state.edId = null; $("ed-student").innerHTML = ""; return; }
    if (state.view !== "edit") return;
    refreshSelect(s);
    if (!force && state.edId === s.id) return;
    state.edId = s.id;
    $("ed-essay-input").value = s.essay;
    $("ed-essay-input").disabled = isManualSample(s);
    const fld = (key, label, name, val) => `<label class="ed-field"><span class="ed-head">${esc(label)} <span class="ed-where">→ ${esc(EDIT_WHERE[label])}</span></span>
      <textarea class="input" data-name="${name}" rows="${Math.min(5, Math.max(1, Math.ceil(String(val || "").length / 70)))}">${esc(val || "")}</textarea></label>`;
    if (!s.q) { $("ed-form").innerHTML = '<p class="muted small">この生徒には質問がないため、編集する項目がありません（essay の本文だけ直せます）。</p>'; updateEdCheck(s); return; }
    $("ed-form").innerHTML = `<div class="ed-group"><h3>essay全体</h3>${fld("claim", "主張", "claim", s.claim)}${fld("reasons", "理由", "reasons", s.reasons)}</div>` +
      s.q.map((x, i) => `<div class="ed-group"><h3>Q${i + 1}　<span class="ed-type" data-i="${i}">${qType(x.q, i).label}</span><span class="ed-where">（型は質問文から自動で決まります）</span></h3>${ED_Q_FIELDS.map(([lb, k]) => fld(k, lb, `q.${i}.${k}`, x[k])).join("")}</div>`).join("");
    updateEdCheck(s);
  }
  // 生徒セレクトの更新（点検結果と「修正あり」を表示）
  function refreshSelect(s) {
    const list = printList().filter((x) => !x.dup);
    $("ed-student").innerHTML = list.map((x) => {
      const r = check(x.s);
      const mark = { ok: "", warn: "（注意）", ng: "（✗要修正）", missing: "（質問なし）" }[r.level] || "";
      const ed = state.touched.has(x.s.id) ? "【修正あり】" : "";
      const label = x.s.absent ? "未提出者用" : `${x.s.id}　${x.s.name}`;
      return `<option value="${esc(x.s.id)}"${x.s.id === s.id ? " selected" : ""}>${esc(label + mark + ed)}</option>`;
    }).join("");
  }
  // 見出し下の説明文（編集の ON/OFF で変わる）
  function updateViewNote() {
    $("view-note").textContent = state.view === "edit"
      ? `左のプレビューで用紙をクリックするか、右で生徒を選んで書き換えてください。変更はすぐ反映され、プレビュー・点検・印刷に出ます（修正あり ${state.touched.size}人）。`
      : "印刷される用紙を1枚ずつ表示します（「次へ」または → キーで切り替え）。直したい所は「編集」をONにすると、右側で生徒ごとに書き換えられます。";
  }
  function setView(v) {
    state.view = v;
    const on = v === "edit";
    const sw = $("edit-switch");
    sw.setAttribute("aria-checked", String(on));
    sw.querySelector(".lbl").textContent = on ? "編集 ON" : "編集 OFF";
    $("workspace").classList.toggle("split", on);
    $("preview-nav").hidden = on || !printList().length;
    updateViewNote();
    renderEditor(true);
    applyScale();
  }
  function updateEdCheck(s) {
    const r = check(s);
    const q = s.q || [];
    $("ed-essay").innerHTML = markQuotes(s.essay, q.map((x) => x.quote || ""));
    $("ed-essay-badge").hidden = !state.touched.has(s.id);
    const ng = r.problems.filter((p) => p.level !== "memo");
    const badge = { ok: ["ok", "点検OK"], warn: ["warn", "注意（印刷はできます）"], ng: ["ng", "✗ 要修正"], missing: ["", "質問なし"] }[r.level] || ["", ""];
    $("ed-check").innerHTML = !s.q ? '<span class="badge">質問なし</span>' : ng.length ? `<span class="badge ${badge[0]}">${badge[1]}</span><ul>` + ng.map((p) => `<li class="${p.level === "ng" ? "ed-ng" : ""}">${esc(p.msg)}</li>`).join("") + "</ul>" + (r.level === "ng" ? '<div class="muted small">✗のままでも、このデモでは編集中の用紙を表示し続けます。</div>' : "") : `<span class="badge ${badge[0]}">${badge[1]}</span>`;
    document.querySelectorAll(".ed-type").forEach((el) => { const x = s.q && s.q[el.dataset.i]; if (x) el.textContent = qType(x.q, +el.dataset.i).label; });
  }
  function onEdit(e) {
    const s = curStudent(); if (!s) return;
    const t = e.target;
    if (t.id === "ed-essay-input") s.essay = t.value;
    else if (t.dataset && t.dataset.name) {
      const p = t.dataset.name.split(".");
      if (p.length === 1) { s[p[0]] = t.value; if (state.mode === "manual") D.manualSample[p[0]] = t.value; } else s.q[+p[1]][p[2]] = t.value;
    } else return;
    state.touched.add(s.id);
    renderCheck(); renderSheets(); updateEdCheck(s); refreshSelect(s); updateViewNote();
  }
  function resetEdits() {
    const o = JSON.parse(ORIG);
    D.students.splice(0, D.students.length, ...o.students);
    D.absent = o.absent; D.manualSample = o.manualSample;
    state.touched.clear(); state.edId = null;
    refreshAll(); renderEditor(true); updateViewNote();
    toast("サンプルの状態に戻しました");
  }

  // 画面幅に合わせて用紙を縮小する（A4 = 約794px）
  function applyScale() {
    const avail = $("preview-col").clientWidth - 8;
    const scale = Math.min(1, avail / (210 * 96 / 25.4));
    $("workspace").style.setProperty("--sheet-scale", String(Math.max(0.3, scale)));
  }
  function markCurrent() {
    const wraps = [...document.querySelectorAll("#sheets .sheet-wrap:not(.dup)")];
    document.querySelectorAll("#sheets .sheet-wrap:not(.dup)").forEach((w, i) => w.classList.toggle("off-screen", i !== state.idx));
    const list = printList().filter((x) => !x.dup);
    const cur = list[state.idx];
    $("pv-label").textContent = cur ? `${cur.s.absent ? "未提出者用（氏名空欄）" : cur.s.id + " " + cur.s.name} ・ ${state.idx + 1} / ${wraps.length}` : "";
    renderEditor(false);
    $("pv-prev").disabled = state.idx <= 0;
    $("pv-next").disabled = state.idx >= wraps.length - 1;
  }
  function step(d) { state.idx += d; markCurrent(); }

  // ---------- 初期化・イベント ----------
  function init() {
    $("mode-bar").addEventListener("click", (e) => { const b = e.target.closest("button[data-mode]"); if (b) setMode(b.dataset.mode); });
    $("load-sample").addEventListener("click", () => { state.batchLoaded = true; state.idx = 0; toast("サンプルデータを読み込みました（架空の生徒4人）"); refreshAll(); });
    $("absent-apply").addEventListener("click", () => {
      const b = $("absent-apply"); b.disabled = true; b.textContent = "取り込み中…";
      setTimeout(() => { state.absentLoaded = true; b.disabled = false; b.textContent = "サンプルを取り込む（Gem の出力の代わり）"; refreshAll(); }, 800);
    });
    $("absent-clear").addEventListener("click", () => { state.absentLoaded = false; refreshAll(); });
    $("absent-copy").addEventListener("click", () => copy("未提出者用の sample essay と Question Time の質問を作成してください。（デモ）", "依頼文をコピーしました。Gemに貼り付けてください。"));
    $("manual-add").addEventListener("click", () => { state.manual.push({ cls: "2A", num: "", name: "", essay: "" }); renderManual(); refreshAll(); });
    $("manual-sample").addEventListener("click", () => {
      state.manual.push({ cls: D.manualSample.cls, num: D.manualSample.num, name: D.manualSample.name, essay: D.manualSample.essay, sample: true });
      renderManual(); refreshAll();
    });
    $("manual-clear").addEventListener("click", () => { state.manual = []; renderManual(); refreshAll(); });
    $("copy-prompt").addEventListener("click", () => copy(PROMPT_TEXT, "システムプロンプトをコピーしました（デモ用の短縮版）"));
    $("toggle-prompt").addEventListener("click", () => {
      const v = $("prompt-view"); v.hidden = !v.hidden;
      v.textContent = PROMPT_TEXT; $("toggle-prompt").textContent = v.hidden ? "中身を表示" : "中身を隠す";
    });
    $("copy-kickoff").addEventListener("click", () => copy("これから Question Time を始めます。課題: " + $("s-topic").value + "（デモ）", "課題開始メッセージをコピーしました。"));
    ["batch-size", "batch-missing-only"].forEach((id) => $(id).addEventListener("input", renderBatches));
    $("status-filter").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]"); if (!b) return;
      state.status = b.dataset.f;
      [...$("status-filter").children].forEach((x) => x.classList.toggle("on", x === b));
      renderCheck();
    });
    $("kind").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      state.kind = b.dataset.k;
      [...$("kind").children].forEach((x) => x.classList.toggle("on", x === b));
      renderSheets();
    });
    ["s-title", "s-date", "s-topic", "use-backup", "absent-copies"].forEach((id) => $(id).addEventListener("input", refreshAll));
    $("print").addEventListener("click", () => { if (!printList().length) { toast("印刷できる生徒がいません"); return; } window.print(); });
    $("export-xlsx").addEventListener("click", () => toast("デモでは保存されません（本物では .xlsx を保存します）"));
    $("editor").addEventListener("input", onEdit);
    $("ed-reset").addEventListener("click", resetEdits);
    $("edit-switch").addEventListener("click", () => setView(state.view === "edit" ? "preview" : "edit"));
    $("ed-student").addEventListener("change", (e) => {
      const i = printList().filter((x) => !x.dup).findIndex((x) => x.s.id === e.target.value);
      if (i >= 0) { state.idx = i; markCurrent(); }
    });
    $("ed-prev").addEventListener("click", () => { if (state.idx > 0) step(-1); });
    $("ed-next").addEventListener("click", () => { if (state.idx < printList().filter((x) => !x.dup).length - 1) step(1); });
    // 用紙をクリックすると、その生徒が右パネルで選ばれる（編集ON時）
    $("sheets").addEventListener("click", (e) => {
      if (state.view !== "edit") return;
      const w = e.target.closest(".sheet-wrap"); if (!w) return;
      const i = [...document.querySelectorAll("#sheets .sheet-wrap:not(.dup)")].indexOf(w);
      if (i >= 0 && i !== state.idx) { state.idx = i; markCurrent(); }
    });
    $("pv-prev").addEventListener("click", () => step(-1));
    $("pv-next").addEventListener("click", () => step(1));
    document.addEventListener("keydown", (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1);
    });
    window.addEventListener("resize", applyScale);
    setMode("batch");
    updateViewNote();
  }
  init();
})();
