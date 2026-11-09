"use strict";
/* 保護者向けフォームの見本：日付×時刻のチェックボックス（グリッド）。送信はしない（通信なし）。
   DAYS / TIMES は data.js で定義（割り当て画面のサンプルと同じ日程） */

const $ = (id) => document.getElementById(id);
const grid = $("f-grid");

// 表を作る：行＝日付、列＝時刻（Google フォームの「チェックボックス（グリッド）」と同じ並び）
let html = "<thead><tr><th class=\"corner\"></th>" + TIMES.map((t) => `<th scope="col">${t}</th>`).join("") + "</tr></thead><tbody>";
DAYS.forEach((d, di) => {
  html += `<tr><th scope="row">${d}</th>`;
  TIMES.forEach((t, ti) => {
    html += `<td><label class="cell"><input type="checkbox" data-d="${di}" data-t="${ti}" aria-label="${d} ${t}"><span></span></label></td>`;
  });
  html += "</tr>";
});
grid.innerHTML = html + "</tbody>";

function updatePicked() {
  const n = grid.querySelectorAll("input:checked").length;
  $("f-picked").textContent = `選択中：${n} 枠`;
}
grid.addEventListener("change", updatePicked);

// 送信：見本なので案内を出すだけ
$("f-submit").addEventListener("click", () => {
  const msg = $("f-msg");
  msg.hidden = false;
  msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

$("f-clear").addEventListener("click", () => {
  document.querySelectorAll(".form input, .form textarea").forEach((el) => {
    if (el.type === "checkbox") el.checked = false; else el.value = "";
  });
  $("f-msg").hidden = true;
  updatePicked();
});
