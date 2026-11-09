"use strict";
/* 保護者懇談会 日程調整（教員画面のみ）— デモ。通信なし・すべて架空データ。
   DAYS / TIMES / SAMPLE_ROWS は data.js で定義 */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const key = (d, t) => d + " " + t; // 枠のキー（フォームの選択肢と同じ表記）

let subs = [];         // 読み込んだ回答 {no, student, parent, slots:[key], note, ts, raw}
let assignment = null; // {assigned: Map(枠キー -> 家庭), unassigned: []}

/* 手順1：情報表示 */
$("i-days").textContent = DAYS.join(" ・ ");
$("i-times").textContent = `${TIMES[0]}〜${TIMES[TIMES.length - 1]}（各日${TIMES.length}枠）`;
$("i-total").textContent = DAYS.length * TIMES.length;

/* 手順2：スプレッドシート風の表 */
function renderSheet() {
  if (!subs.length) {
    $("t-stats").innerHTML = "";
    $("t-sheet").innerHTML = '<tbody><tr><td class="empty">まだ読み込まれていません。上の枠にファイルを入れるか、「サンプルを読み込む」を押してください。</td></tr></tbody>';
    return;
  }
  const avg = (subs.reduce((a, s) => a + s.slots.length, 0) / subs.length).toFixed(1);
  $("t-stats").innerHTML =
    `<div class="stat"><div class="num">${subs.length}</div><div class="lbl">回答数</div></div>` +
    `<div class="stat"><div class="num">${avg}</div><div class="lbl">平均の希望枠数</div></div>`;
  // フォームの「チェックボックス（グリッド）」の回答は、日付ごとの列に「15:00, 16:30」のように入る
  const COLS = "ABCDEFGHIJKLMNOP";
  const head = ["", "A タイムスタンプ", "B 生徒の出席番号", "C 生徒氏名", "D 保護者氏名",
    ...DAYS.map((d, i) => `${COLS[4 + i]} 参加できる日時 [${d}]`), `${COLS[4 + DAYS.length]} 備考`];
  const byDay = (s, d) => s.slots.filter((x) => x.startsWith(d + " ")).map((x) => x.slice(d.length + 1)).join(", ");
  $("t-sheet").innerHTML =
    "<thead><tr>" + head.map((h) => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" +
    subs.map((s, i) =>
      `<tr><td class="rownum">${i + 2}</td><td class="nowrap">${esc(s.ts)}</td><td class="col-num">${s.no}</td>` +
      `<td class="nowrap">${esc(s.student)}</td><td class="nowrap">${esc(s.parent)}</td>` +
      DAYS.map((d) => `<td class="slots-cell">${esc(byDay(s, d))}</td>`).join("") +
      `<td class="note-cell">${esc(s.note)}</td></tr>`).join("") + "</tbody>";
}
function loadSample(fileName) {
  // 「参加できる日時」のカンマ区切りを枠キーに分解（フォームの複数選択の形）
  subs = SAMPLE_ROWS.map((r) => ({ ...r, raw: r.slots, slots: r.slots.split(",").map((x) => x.trim()).filter(Boolean) }));
  assignment = null;
  $("t-preview-wrap").hidden = true;
  const drop = $("t-drop");
  drop.classList.add("is-loaded");
  drop.querySelector(".dz-main").textContent =
    "読み込みました：" + (fileName ? fileName + "（デモのため中身はサンプル）" : "サンプルの回答シート") + " ／ 回答 " + subs.length + " 件";
  renderSheet();
  renderResult();
}
$("t-load").addEventListener("click", () => loadSample(""));

/* ドラッグ＆ドロップ／ファイル選択（デモではファイルの中身は読まない） */
const dropEl = $("t-drop");
const fileEl = $("t-file");
dropEl.addEventListener("click", () => fileEl.click());
dropEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileEl.click(); }
});
fileEl.addEventListener("change", () => {
  if (fileEl.files && fileEl.files[0]) loadSample(fileEl.files[0].name);
  fileEl.value = "";
});
["dragenter", "dragover"].forEach((t) => dropEl.addEventListener(t, (e) => {
  e.preventDefault();
  dropEl.classList.add("is-over");
}));
["dragleave", "dragend"].forEach((t) => dropEl.addEventListener(t, () => dropEl.classList.remove("is-over")));
dropEl.addEventListener("drop", (e) => {
  e.preventDefault();
  dropEl.classList.remove("is-over");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  loadSample(f ? f.name : "");
});

/* 手順3：最大マッチング（増加路アルゴリズム） */
function computeAssignment() {
  const slotOwner = new Map();
  function tryAssign(fam, seen) {
    for (const k of fam.slots) {
      if (seen.has(k)) continue;
      seen.add(k);
      const cur = slotOwner.get(k);
      if (!cur || tryAssign(cur, seen)) { slotOwner.set(k, fam); return true; }
    }
    return false;
  }
  // 希望が少ない家庭から先に処理
  [...subs].sort((a, b) => a.slots.length - b.slots.length).forEach((f) => tryAssign(f, new Set()));
  const done = new Set([...slotOwner.values()].map((f) => f.no));
  return { assigned: slotOwner, unassigned: subs.filter((f) => !done.has(f.no)) };
}
$("t-assign").addEventListener("click", () => {
  if (!subs.length) return alert("先に手順2でサンプルを読み込んでください。");
  const btn = $("t-assign");
  btn.disabled = true;
  btn.textContent = "計算中…";
  setTimeout(() => {
    assignment = computeAssignment();
    btn.disabled = false;
    btn.textContent = "自動で割り当てる";
    renderResult();
  }, 800);
});
function buildGrid(el, cellFn) {
  let h = '<thead><tr><th class="corner"></th>' + TIMES.map((t) => `<th>${t}</th>`).join("") + "</tr></thead><tbody>";
  DAYS.forEach((d) => {
    h += `<tr><th class="daycell">${d}</th>`;
    TIMES.forEach((t) => { h += cellFn(d, t); });
    h += "</tr>";
  });
  el.innerHTML = h + "</tbody>";
}
function renderResult() {
  if (!assignment) {
    $("t-summary").innerHTML = "";
    $("t-result").innerHTML = "";
    $("t-unassigned").innerHTML = "";
    return;
  }
  const n = assignment.assigned.size, u = assignment.unassigned.length;
  $("t-summary").innerHTML =
    `<span class="pill">割り当て済み <b>${n}</b> 名</span><span class="pill">未割り当て <b>${u}</b> 名</span><span class="pill">重複 <b>0</b> 枠</span>`;
  buildGrid($("t-result"), (d, t) => {
    const f = assignment.assigned.get(key(d, t));
    return f ? `<td class="cell filled">${esc(f.parent.replace("（架空）", ""))}<br><span class="who-no">No.${f.no}</span></td>` : '<td class="cell empty-cell">—</td>';
  });
  $("t-unassigned").innerHTML = u
    ? `<div class="unassigned-box"><h3>未割り当ての家庭（${u}名）— 希望の枠がすべて他の家庭で埋まりました。個別に調整してください</h3><ul>${assignment.unassigned.map((f) => `<li>No.${f.no} ${esc(f.parent)}（希望 ${f.slots.length} 枠：${esc(f.raw)}）</li>`).join("")}</ul></div>`
    : "";
}

/* 手順4：出力用の行データ（CSV とプレビューで共通） */
function exportRows() {
  const rows = [["日付", "時間", "出席番号", "生徒氏名", "保護者氏名"]];
  DAYS.forEach((d) => TIMES.forEach((t) => {
    const f = assignment.assigned.get(key(d, t));
    if (f) rows.push([d, t, f.no, f.student, f.parent]);
  }));
  assignment.unassigned.forEach((f) => rows.push(["（未割り当て）", "", f.no, f.student, f.parent]));
  return rows;
}
$("t-export").addEventListener("click", () => {
  if (!assignment) return alert("先に手順3「自動で割り当てる」を押してください。");
  const rows = exportRows();
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "懇談会_割り当て結果_デモ.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  $("t-preview").innerHTML =
    "<thead><tr>" + rows[0].map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
    rows.slice(1).map((r) => "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
  $("t-preview-wrap").hidden = false;
});

renderSheet();
