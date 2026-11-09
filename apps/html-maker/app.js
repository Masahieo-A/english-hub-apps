// 構文図解メーカー モック：状態は画面内のみ（通信なし）
(function () {
  "use strict";
  var ROLES = window.ROLES;
  var doc = JSON.parse(JSON.stringify(window.DRAFT)); // 編集用コピー
  var cur = 0;          // 選択中の文
  var selId = null;     // 選択中ノード
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function show(name) {
    ["new", "edit", "export"].forEach(function (n) { $("screen-" + n).hidden = n !== name; });
    window.scrollTo(0, 0);
  }
  function findNode(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
      var r = list[i].children && findNode(list[i].children, id);
      if (r) return r;
    }
    return null;
  }

  // 色分け文（トップレベルのチャンク）
  function coloredHtml(sent, interactive) {
    return sent.nodes.map(function (n) {
      var r = ROLES[n.role];
      return '<span class="chunk mk-' + r.mark + (interactive && n.id === selId ? " sel" : "") +
        '" data-id="' + n.id + '" style="background:' + r.bg + ";color:" + r.color +
        ";border-color:" + r.color + '" title="' + esc(r.label) + '">' + esc(n.text) + "</span>";
    }).join(" ");
  }

  // 樹形図
  function nodeHtml(n) {
    var r = ROLES[n.role];
    var kids = n.children && n.children.length
      ? "<ul>" + n.children.map(nodeHtml).join("") + "</ul>" : "";
    return "<li><span class=\"node" + (n.id === selId ? " sel" : "") + '" data-id="' + n.id +
      '" style="color:' + r.color + ";border-color:" + r.color + ";background:" + r.bg + '">' +
      esc(n.text) + "<small>" + esc(r.label) + "</small></span>" + kids + "</li>";
  }
  function treeHtml(sent) {
    return '<ul class="tree"><li><span class="node root">S' + (cur + 1) + " 文全体</span><ul>" +
      sent.nodes.map(nodeHtml).join("") + "</ul></li></ul>";
  }

  function render() {
    var s = doc[cur];
    $("tabs").innerHTML = doc.map(function (_, i) {
      return '<button class="tab' + (i === cur ? " on" : "") + '" data-i="' + i + '">文 ' + (i + 1) + "</button>";
    }).join("");
    $("colored").innerHTML = coloredHtml(s, true) + '<p class="ja">' + esc(s.ja) + "</p>";
    $("tree").innerHTML = treeHtml(s);
    $("legend").innerHTML = Object.keys(ROLES).map(function (k) {
      var r = ROLES[k];
      return '<span class="chip" style="color:' + r.color + ";background:" + r.bg + ";border-color:" + r.color + '">' + r.label + "</span>";
    }).join("");
    renderInspector();
  }

  function renderInspector() {
    var n = selId && findNode(doc[cur].nodes, selId);
    $("insp-empty").hidden = !!n;
    $("insp-form").hidden = !n;
    if (!n) return;
    $("f-text").value = n.text;
    $("f-role").value = n.role;
    $("f-note").value = n.note || "";
  }

  // 選択（フォーム入力中の再描画を避けるため、ハイライトのみ更新）
  function select(id) {
    selId = id;
    render();
  }
  function onPick(e) {
    var t = e.target.closest("[data-id]");
    if (t) select(t.getAttribute("data-id"));
  }

  // 編集反映（入力欄のフォーカスを保つためフォームは再設定しない）
  function onEdit() {
    var n = selId && findNode(doc[cur].nodes, selId);
    if (!n) return;
    n.text = $("f-text").value || "…";
    n.role = $("f-role").value;
    n.note = $("f-note").value;
    var s = doc[cur];
    $("colored").innerHTML = coloredHtml(s, true) + '<p class="ja">' + esc(s.ja) + "</p>";
    $("tree").innerHTML = treeHtml(s);
  }

  // 書き出し用の自己完結HTML文字列
  var EXPORT_CSS =
    "body{font-family:sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.8}" +
    ".chunk{padding:2px 6px;margin:0 2px;border-radius:4px;border-bottom:3px solid}" +
    ".mk-double{border-bottom-style:double;border-bottom-width:5px}.mk-dashed{border-bottom-style:dashed}" +
    ".mk-dotted{border-bottom-style:dotted}.item{margin-top:20px;border-top:1px dashed #ccc;padding-top:12px}" +
    ".s{font-size:18px;line-height:2.3}.ja{color:#666;font-size:13px}ul{font-size:13px;color:#444}";
  function itemsHtml() {
    return doc.map(function (s, i) {
      var notes = s.nodes.filter(function (n) { return n.note; }).map(function (n) {
        return "<li><b>" + esc(n.text) + "</b>：" + esc(n.note) + "</li>";
      }).join("");
      return '<div class="item"><div class="s">' + (i + 1) + ". " + coloredHtml(s, false) +
        '</div><p class="ja">' + esc(s.ja) + "</p><ul>" + notes + "</ul></div>";
    }).join("");
  }
  var legend = function () {
    return Object.keys(ROLES).map(function (k) {
      var r = ROLES[k];
      return '<span class="chunk" style="background:' + r.bg + ";color:" + r.color + ";border-color:" + r.color + '">' + r.label + "</span>";
    }).join(" ");
  };
  function buildHtml() {
    return '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>文構造まとめ</title><style>' +
      EXPORT_CSS + "</style></head><body><h1>文構造まとめ（サンプル教材）</h1><p>" + legend() + "</p>" + itemsHtml() + "</body></html>";
  }

  // イベント登録
  $("f-role").innerHTML = Object.keys(ROLES).map(function (k) {
    return '<option value="' + k + '">' + ROLES[k].label + "</option>";
  }).join("");

  $("btn-ai").addEventListener("click", function () {
    var b = $("btn-ai");
    b.disabled = true;
    $("ai-status").textContent = "AIが文構造を解析中…";
    setTimeout(function () {
      b.disabled = false;
      $("ai-status").textContent = "";
      cur = 0; selId = null;
      doc = JSON.parse(JSON.stringify(window.DRAFT));
      render();
      show("edit");
    }, 1000);
  });
  $("tabs").addEventListener("click", function (e) {
    var t = e.target.closest("[data-i]");
    if (t) { cur = +t.getAttribute("data-i"); selId = null; render(); }
  });
  $("colored").addEventListener("click", onPick);
  $("tree").addEventListener("click", function (e) {
    if (e.target.closest(".root")) return;
    onPick(e);
  });
  ["f-text", "f-role", "f-note"].forEach(function (id) {
    $(id).addEventListener("input", onEdit);
    $(id).addEventListener("change", onEdit);
  });
  $("btn-back").addEventListener("click", function () { show("new"); });
  $("btn-edit").addEventListener("click", function () { show("edit"); });
  $("btn-export").addEventListener("click", function () {
    $("sheet").innerHTML = "<h3>文構造まとめ（サンプル教材）</h3><p>" + legend() + "</p>" + itemsHtml();
    show("export");
  });
  $("btn-dl").addEventListener("click", function () {
    var blob = new Blob([buildHtml()], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "koubun-zukai-sample.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
})();
