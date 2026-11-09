"use strict";
/* 席替えアプリ（デモ）。本物から名簿の読み込み部分だけをサンプル名簿に差し替えたもの。通信なし。 */
const ROWS = 7;
const COLS = 6;
const TOTAL_SEATS = ROWS * COLS;
const FRONT_SEATS = 12; // 前2列
const STORAGE_KEY = 'sekigae-demo-settings-v1';

let students = [];           // 読み込んだ名簿 [{id, name, gender}]
let selectedEmptySeats = []; // 空席指定（0-41のインデックス）
let seatRules = {};          // 座席の指定 { 出席番号(文字列): [座ってよい席のインデックス] }
let currentRuleId = null;    // 座席の指定で選択中の生徒
let isNameMode = true;       // 現在の表示モード (true: 氏名, false: 番号)

// ===== 設定の保存・復元（このPCのブラウザ内だけに保存。氏名は保存しない） =====

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      frontRowInput: document.getElementById('frontRowInput').value,
      badRelationsInput: document.getElementById('badRelationsInput').value,
      emptySeats: selectedEmptySeats,
      seatRules: seatRules
    }));
  } catch (e) { /* 保存できない環境でも動作は続ける */ }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    document.getElementById('frontRowInput').value = saved.frontRowInput || '';
    document.getElementById('badRelationsInput').value = saved.badRelationsInput || '';
    selectedEmptySeats = Array.isArray(saved.emptySeats) ? saved.emptySeats : [];
    seatRules = saved.seatRules && typeof saved.seatRules === 'object' ? saved.seatRules : {};
  } catch (e) { /* 壊れた保存データは無視 */ }
}

// ===== 名簿の読み込み =====

const dropzone = document.getElementById('dropzone');

// デモ：Excel の読み込みの代わりに、架空の名簿（data.js の SAMPLE_ROSTER）を読み込む。
// 本物は SheetJS で .xlsx を読み込み、A列=出席番号／B列=氏名／C列=性別 を取り出す（ブラウザ内だけで処理）。
function loadSampleRoster() {
  setRoster(parseRoster(SAMPLE_ROSTER), 'サンプル名簿（架空の40名）.xlsx');
}
dropzone.onclick = () => showDemoNotice();
dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
dropzone.ondragleave = () => dropzone.classList.remove('dragover');
dropzone.ondrop = (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); showDemoNotice(); };
function showDemoNotice() {
  showRosterError('デモのため、手元のファイルは読み込みません。下の「サンプル名簿を読み込む」を押してください。');
}
document.getElementById('sampleButton').addEventListener('click', loadSampleRoster);
document.getElementById('reloadButton').addEventListener('click', () => {
  students = [];
  document.getElementById('rosterInfo').classList.add('hidden');
  dropzone.classList.remove('hidden');
  document.getElementById('sampleRow').classList.remove('hidden');
  document.getElementById('runButton').disabled = true;
  document.getElementById('runHint').classList.remove('hidden');
  document.getElementById('resultsArea').classList.add('hidden');
  currentRuleId = null;
  renderStudentList();
  renderAssignGrid();
});

// 行データ → 生徒配列。1行目が見出し（出席番号が数字でない）なら飛ばす
function parseRoster(rows) {
  const list = [];
  rows.forEach((row, i) => {
    const id = String(row[0] ?? '').trim();
    if (id === '') return; // 空行はスキップ
    if (i === 0 && !/^\d+$/.test(id)) return; // 見出し行
    list.push({
      id: id,
      name: String(row[1] ?? '').trim(),
      gender: normalizeGender(row[2])
    });
  });
  return list;
}

function normalizeGender(value) {
  const v = String(value ?? '').trim();
  if (/^(男|M$|m$|male)/i.test(v)) return '男';
  if (/^(女|F$|f$|female)/i.test(v)) return '女';
  return v;
}

function setRoster(list, fileName) {
  const errors = [];
  if (list.length === 0) errors.push('生徒が1人も見つかりませんでした。A列に出席番号があるか確認してください。');
  if (list.length > TOTAL_SEATS) errors.push(`生徒が${list.length}名います。座席は${TOTAL_SEATS}席までです。`);
  const seen = new Set();
  const dup = [];
  list.forEach(s => { if (seen.has(s.id)) dup.push(s.id); seen.add(s.id); });
  if (dup.length) errors.push('出席番号が重複しています: ' + [...new Set(dup)].join(', '));
  const odd = list.filter(s => s.gender !== '男' && s.gender !== '女');
  if (odd.length) errors.push('性別（C列）が「男」「女」以外の生徒がいます: ' + odd.map(s => s.id).join(', '));

  if (errors.length) {
    showRosterError(errors.join('\n'));
    return;
  }
  hideRosterError();
  students = list;
  const male = list.filter(s => s.gender === '男').length;
  document.getElementById('rosterText').textContent =
    `名簿：${fileName}（${list.length}名：男${male}・女${list.length - male}）`;
  dropzone.classList.add('hidden');
  document.getElementById('sampleRow').classList.add('hidden');
  document.getElementById('rosterInfo').classList.remove('hidden');
  document.getElementById('runButton').disabled = false;
  document.getElementById('runHint').classList.add('hidden');
  document.getElementById('resultsArea').classList.add('hidden');
  currentRuleId = null;
  renderStudentList();
  renderAssignGrid();
}

function showRosterError(msg) {
  const box = document.getElementById('rosterError');
  box.textContent = msg;
  box.classList.remove('hidden');
}
function hideRosterError() {
  document.getElementById('rosterError').classList.add('hidden');
}

function studentById(id) {
  return students.find(s => s.id === String(id));
}

// ===== 空席指定グリッド =====

function initGrid() {
  const seatSelector = document.getElementById('seatSelector');
  seatSelector.innerHTML = '';
  for (let i = 0; i < TOTAL_SEATS; i++) {
    const div = document.createElement('div');
    div.className = 'seat';
    div.dataset.index = i;
    if (selectedEmptySeats.includes(i)) div.classList.add('manual-empty');
    else div.textContent = i + 1; // 座席番号（目安）

    div.onclick = function() {
      this.classList.toggle('manual-empty');
      this.textContent = this.classList.contains('manual-empty') ? '' : i + 1;
      updateEmptySeats();
    };
    seatSelector.appendChild(div);
  }
}

function updateEmptySeats() {
  const empties = document.querySelectorAll('.seat.manual-empty');
  selectedEmptySeats = Array.from(empties).map(el => parseInt(el.dataset.index));
  saveSettings();
  renderAssignGrid();
}

// ===== 座席の指定（配慮が必要な生徒） =====

function renderStudentList() {
  const box = document.getElementById('studentList');
  box.innerHTML = '';
  document.getElementById('assignNoRoster').classList.toggle('hidden', students.length > 0);
  students.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'stu-btn';
    btn.textContent = `${s.id} ${s.name}`;
    const rule = seatRules[s.id];
    if (rule && rule.length) {
      btn.classList.add('has-rule');
      btn.dataset.count = rule.length;
    }
    if (s.id === currentRuleId) btn.classList.add('selected');
    btn.onclick = () => {
      currentRuleId = (currentRuleId === s.id) ? null : s.id;
      renderStudentList();
      renderAssignGrid();
    };
    box.appendChild(btn);
  });
  renderRuleSummary();
}

function renderAssignGrid() {
  const grid = document.getElementById('assignGrid');
  grid.innerHTML = '';
  grid.classList.toggle('inactive', currentRuleId === null);
  const s = currentRuleId !== null ? studentById(currentRuleId) : null;
  document.getElementById('assignTarget').textContent = s ? `${s.id}番 ${s.name}` : '（未選択）';
  const allowed = new Set(seatRules[currentRuleId] || []);

  // 1行目：列の一括ボタン
  grid.appendChild(Object.assign(document.createElement('div'), { className: 'axis-corner' }));
  for (let c = 0; c < COLS; c++) {
    const b = document.createElement('div');
    b.className = 'axis-btn';
    b.textContent = '▼';
    b.title = 'この列をまとめて切り替え';
    b.onclick = () => toggleSeatsBulk([...Array(ROWS).keys()].map(r => r * COLS + c));
    grid.appendChild(b);
  }

  for (let r = 0; r < ROWS; r++) {
    const rb = document.createElement('div');
    rb.className = 'axis-btn';
    rb.textContent = '▶';
    rb.title = 'この行をまとめて切り替え';
    rb.onclick = () => toggleSeatsBulk([...Array(COLS).keys()].map(c => r * COLS + c));
    grid.appendChild(rb);

    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const cell = document.createElement('div');
      cell.className = 'assign-seat';
      if (selectedEmptySeats.includes(idx)) {
        cell.classList.add('disabled');
        cell.title = '空席指定のマス';
      } else {
        if (allowed.has(idx)) cell.classList.add('allowed');
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = idx + 1;
        cell.appendChild(num);
        // この席を指定している他の生徒
        const others = Object.keys(seatRules)
          .filter(id => id !== currentRuleId && seatRules[id].includes(idx) && studentById(id));
        if (others.length) {
          const o = document.createElement('span');
          o.className = 'others';
          o.textContent = others.join(',');
          cell.appendChild(o);
        }
        cell.onclick = () => toggleSeatsBulk([idx]);
      }
      grid.appendChild(cell);
    }
  }
}

// 指定席の切り替え。複数マスのときは「全部✓済みなら外す／そうでなければ全部付ける」
function toggleSeatsBulk(indices) {
  if (currentRuleId === null) return;
  const targets = indices.filter(i => !selectedEmptySeats.includes(i));
  const current = new Set(seatRules[currentRuleId] || []);
  const allOn = targets.every(i => current.has(i));
  targets.forEach(i => allOn ? current.delete(i) : current.add(i));
  if (current.size) seatRules[currentRuleId] = [...current].sort((a, b) => a - b);
  else delete seatRules[currentRuleId];
  saveSettings();
  renderStudentList();
  renderAssignGrid();
}

function clearCurrentRule() {
  if (currentRuleId === null) return;
  delete seatRules[currentRuleId];
  saveSettings();
  renderStudentList();
  renderAssignGrid();
}

function clearAllRules() {
  if (!Object.keys(seatRules).length) return;
  if (!confirm('全員の座席の指定を解除します。よろしいですか？')) return;
  seatRules = {};
  saveSettings();
  renderStudentList();
  renderAssignGrid();
}

function renderRuleSummary() {
  const ids = Object.keys(seatRules).filter(id => studentById(id)).sort((a, b) => a - b);
  const box = document.getElementById('ruleSummary');
  if (!ids.length) { box.textContent = ''; return; }
  box.innerHTML = '<b>指定済み：</b>' + ids.map(id => {
    const s = studentById(id);
    return `${escapeHtml(id)}番 ${escapeHtml(s.name)}（${seatRules[id].length}席）`;
  }).join('　');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 席替えの実行 =====

function runSeating() {
  if (!students.length) return;
  const settings = {
    frontRowInput: document.getElementById('frontRowInput').value,
    badRelationsInput: document.getElementById('badRelationsInput').value,
    emptySeats: selectedEmptySeats,
    seatRules: seatRules
  };
  saveSettings();

  const problem = checkSettings(settings);
  if (problem) { alert(problem); return; }

  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('resultsArea').classList.add('hidden');
  isNameMode = true;
  updateToggleButton();

  // ローダーを描画してから計算する
  setTimeout(() => {
    try {
      showResults(generateSeatingPatterns(students, settings));
    } catch (e) {
      showError(e);
    }
  }, 30);
}

// 実行前のチェック（座れる席が1つもない指定などを事前に知らせる）
function checkSettings(settings) {
  const base = buildBaseSeats(students.length, settings.emptySeats);
  const usable = base.filter(s => s !== null).length;
  if (usable < students.length) {
    return `座れる席（${usable}席）が生徒数（${students.length}名）より少なくなっています。空席指定を減らしてください。`;
  }
  const noSeat = Object.keys(settings.seatRules)
    .filter(id => studentById(id))
    .filter(id => settings.seatRules[id].every(idx => base[idx] === null));
  if (noSeat.length) {
    return '次の生徒は、指定した席がすべて空席扱いになっています（空席指定、または人数が少ないため後ろの席が空く）。\n'
      + '座席の指定を見直してください: ' + noSeat.map(id => id + '番').join(', ');
  }
  return null;
}

// 空席マップを作る（null: 使用不可, undefined: 未決定）
function buildBaseSeats(studentCount, manualEmptyIndices) {
  const seats = new Array(TOTAL_SEATS).fill(undefined);
  manualEmptyIndices.forEach(idx => { seats[idx] = null; });

  // 人数が座席数より少ない場合、後ろから順に空席にする（ユーザー指定済みは飛ばす）
  let seatsNeedToRemove = seats.filter(s => s !== null).length - studentCount;
  for (let i = TOTAL_SEATS - 1; i >= 0 && seatsNeedToRemove > 0; i--) {
    if (seats[i] !== null) {
      seats[i] = null;
      seatsNeedToRemove--;
    }
  }
  return seats;
}

/**
 * 席替えを実行し、3パターン生成する（元のGAS版の処理をブラウザ内に移植）
 */
function generateSeatingPatterns(allStudents, settings) {
  const patterns = [];
  const maxPatterns = 3;
  const maxRetries = 2000;     // 1パターンあたりの最大試行回数
  const strictTryCount = 1500; // 厳格モード（斜めもNG）で粘る回数

  const frontRowIds = parseInputNumbers(settings.frontRowInput);
  const badRelationGroups = parseBadRelations(settings.badRelationsInput);
  const baseSeats = buildBaseSeats(allStudents.length, settings.emptySeats);
  const frontSet = new Set([...Array(FRONT_SEATS).keys()]);

  for (let p = 0; p < maxPatterns; p++) {
    let validLayout = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const seats = [...baseSeats];
      const remainingStudents = [...allStudents];
      shuffleArray(remainingStudents);

      // 座席の指定・前方指定のある生徒と、それ以外に分ける
      const priorityStudents = [];
      const normalStudents = [];
      remainingStudents.forEach(s => {
        const rule = settings.seatRules[s.id];
        const isFront = frontRowIds.includes(s.id);
        if ((rule && rule.length) || isFront) {
          let candidates = rule && rule.length ? rule : [...Array(TOTAL_SEATS).keys()];
          if (isFront) {
            const frontOnly = candidates.filter(i => frontSet.has(i));
            if (frontOnly.length) candidates = frontOnly; // 指定席に前方がなければ指定席を優先
          }
          priorityStudents.push({ student: s, candidates, strict: !!(rule && rule.length) });
        } else {
          normalStudents.push(s);
        }
      });

      // 候補の少ない生徒から配置する（詰まりにくくするため）
      priorityStudents.sort((a, b) => a.candidates.length - b.candidates.length);

      let failed = false;
      for (const ps of priorityStudents) {
        const open = ps.candidates.filter(i => seats[i] === undefined);
        if (open.length) {
          seats[open[Math.floor(Math.random() * open.length)]] = ps.student;
        } else if (ps.strict) {
          failed = true; // 指定席が埋まっている → この試行はやり直し
          break;
        } else {
          normalStudents.push(ps.student); // 前方が埋まっていたら通常扱い（元の仕様）
        }
      }
      if (failed) continue;

      // 残りの生徒を配置
      const remainingSeatIndices = [];
      for (let i = 0; i < TOTAL_SEATS; i++) {
        if (seats[i] === undefined) remainingSeatIndices.push(i);
      }
      for (const s of normalStudents) {
        if (!remainingSeatIndices.length) break;
        const randIdx = Math.floor(Math.random() * remainingSeatIndices.length);
        seats[remainingSeatIndices[randIdx]] = s;
        remainingSeatIndices.splice(randIdx, 1);
      }

      // 制約チェック（規定回数までは斜めもNGの厳格モード、超えたら十字のみ）
      const isStrict = attempt < strictTryCount;
      if (isValidLayout(seats, badRelationGroups, isStrict)) {
        validLayout = seats;
        break;
      }
    }
    patterns.push(validLayout); // 見つからなければ null
  }
  return patterns;
}

/**
 * レイアウトが制約を満たしているかチェック
 * @param {boolean} isStrict trueなら8方向NG、falseなら十字4方向のみNG
 */
function isValidLayout(seats, badRelationGroups, isStrict) {
  const getPos = (idx) => ({ r: Math.floor(idx / COLS), c: idx % COLS });
  const getIdx = (r, c) => r * COLS + c;
  const crossDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const allDirs = [...crossDirs, ...diagDirs];
  const checkDirsForBadRelation = isStrict ? allDirs : crossDirs;

  for (let i = 0; i < seats.length; i++) {
    const student = seats[i];
    if (!student) continue;
    const pos = getPos(i);

    // 制約1: 離したい生徒同士が近くにいないか
    for (const group of badRelationGroups) {
      if (!group.includes(student.id)) continue;
      for (const d of checkDirsForBadRelation) {
        const nr = pos.r + d[0], nc = pos.c + d[1];
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const neighbor = seats[getIdx(nr, nc)];
          if (neighbor && group.includes(neighbor.id)) return false;
        }
      }
    }

    // 制約2: 男女の孤立チェック（常に周囲8マスで判断）
    const neighbors8 = [];
    for (const d of allDirs) {
      const nr = pos.r + d[0], nc = pos.c + d[1];
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const neighbor = seats[getIdx(nr, nc)];
        if (neighbor) neighbors8.push(neighbor);
      }
    }
    if (neighbors8.length > 0 && !neighbors8.some(n => n.gender === student.gender)) return false;
  }
  return true;
}

// ===== ユーティリティ =====

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// "1, 2, 5" -> ["1", "2", "5"]
function parseInputNumbers(inputStr) {
  if (!inputStr) return [];
  return inputStr.split(/[,、\s]+/).map(s => s.trim()).filter(s => s !== '');
}

// "1,2\n3,4" -> [["1","2"], ["3","4"]]
function parseBadRelations(inputStr) {
  if (!inputStr) return [];
  return inputStr.split(/[\n;]+/).filter(s => s.trim() !== '').map(g => parseInputNumbers(g));
}

// ===== 結果表示 =====

function showResults(patterns) {
  document.getElementById('loader').classList.add('hidden');
  document.getElementById('resultsArea').classList.remove('hidden');
  renderPattern('pattern1', patterns[0], 1);
  renderPattern('pattern2', patterns[1], 2);
  renderPattern('pattern3', patterns[2], 3);
}

function renderPattern(elementId, layoutData, num) {
  const container = document.getElementById(elementId);
  container.innerHTML = `<h3>パターン ${num}</h3>`;

  if (!layoutData) {
    container.innerHTML += '<div class="fail-box">条件を満たす配置が見つかりませんでした。条件を緩和して再試行してください。</div>';
    return;
  }

  const bb = document.createElement('div');
  bb.className = 'blackboard';
  bb.textContent = '黒板';
  container.appendChild(bb);

  const grid = document.createElement('div');
  grid.className = 'seat-grid';
  layoutData.forEach((student) => {
    const cell = document.createElement('div');
    cell.className = 'result-seat';
    if (student) {
      cell.dataset.studentName = student.name;
      cell.dataset.studentId = student.id;
      cell.textContent = isNameMode ? student.name : student.id;
      cell.classList.add(student.gender === '男' ? 'is-male' : 'is-female');
      cell.classList.add('student-filled');
    } else {
      cell.textContent = '×';
      cell.classList.add('is-empty');
    }
    grid.appendChild(cell);
  });
  container.appendChild(grid);
}

function toggleDisplayMode() {
  isNameMode = !isNameMode;
  updateToggleButton();
  document.querySelectorAll('.result-seat.student-filled').forEach(seat => {
    seat.textContent = isNameMode ? seat.dataset.studentName : seat.dataset.studentId;
    seat.classList.toggle('show-number', !isNameMode);
  });
}

function updateToggleButton() {
  const btn = document.getElementById('toggleButton');
  document.getElementById('btnText').textContent = isNameMode ? '出席番号に切り替え' : '氏名に切り替え';
  btn.classList.toggle('btn-green', isNameMode);
  btn.classList.toggle('btn-indigo', !isNameMode);
}

function showError(error) {
  document.getElementById('loader').classList.add('hidden');
  alert('エラーが発生しました: ' + error.message);
}

// 隠しトリガー：「席」の字で条件設定を開閉
document.getElementById('secretTrigger').onclick = function() {
  document.getElementById('settingsArea').classList.toggle('hidden');
};

document.getElementById('frontRowInput').addEventListener('input', saveSettings);
document.getElementById('badRelationsInput').addEventListener('input', saveSettings);

// ボタン（本物では onclick 属性。デモは CSP のため addEventListener）
document.getElementById('clearCurrentBtn').addEventListener('click', clearCurrentRule);
document.getElementById('clearAllBtn').addEventListener('click', clearAllRules);
document.getElementById('runButton').addEventListener('click', runSeating);
document.getElementById('printBtn').addEventListener('click', () => window.print());
document.getElementById('toggleButton').addEventListener('click', toggleDisplayMode);

// 起動時
loadSettings();
initGrid();
renderStudentList();
renderAssignGrid();
