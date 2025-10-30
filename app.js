const key = "poikatsu_unit_split_v1";
const $ = (s) => document.querySelector(s);
let editingIndex = null; // いま編集中の行番号（なければ null）

function flash(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove('show'), 1600);
}

/* Data */
function getData() { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; } }
function setData(arr) { localStorage.setItem(key, JSON.stringify(arr)); }
function getRecordTotal(site) {
  try {
    const arr = JSON.parse(localStorage.getItem(`poikatsu_logs_${site}`) || "[]");
    // records.html は amt フィールド（amount互換もケア）
    return arr.reduce((sum, r) => sum + Number(r.amt ?? r.amount ?? 0), 0);
  } catch (e) {
    return 0;
  }
}
// Add（新規/更新 共通）
function add() {
  const site = $("#site").value.trim();
  const minpt = Number($("#minpt").value || 0);
  const yen = Number($("#yen").value || 0);
  const p1 = Number($("#p1").value || 0);
  const p2 = Number($("#p2").value || 0);
  const memo = $("#memo").value.trim();

  if (!site) { alert("サイト名を入れてね"); return; }            // ←文言も自然に
  if (!minpt || !yen) { alert("最低換金pt と 換金額 を入れてね"); return; }

  const rec = { site, minpt, yen, p1: p1 || 0, p2: p2 || 0, memo };
  const arr = getData();

  if (editingIndex !== null) {
    // 既存行の更新
    arr[editingIndex] = rec;
    setData(arr);
    render();
    flash("更新しました");
    editingIndex = null;
    resetForm();
    return;
  }

  // 新規追加
  arr.push(rec);
  setData(arr);
  render({ scroll: true });
  flash("保存しました");
  resetForm();
}

// ← このすぐ下に入れる！
function resetForm() {
  ["#site", "#minpt", "#yen", "#p1", "#p2", "#memo"].forEach(id => $(id).value = "");
  const btn = document.getElementById("addBtn");
  btn.textContent = "追加";
  btn.classList.remove("primary");
}

/* Delete */
function delRow(i) {
  const arr = getData();
  const name = arr[i]?.site || "この行";
  if (!confirm(`「${name}」を削除しますか？`)) return;
  arr.splice(i, 1);
  setData(arr);
  render();
  flash("1件削除しました");
}

function edit(i) {
  const arr = getData();
  const r = arr[i];
  if (!r) return;

  $("#site").value = r.site || "";
  $("#minpt").value = r.minpt || "";
  $("#yen").value = r.yen || "";
  $("#p1").value = r.p1 || "";
  $("#p2").value = r.p2 || "";
  $("#memo").value = r.memo || "";

  editingIndex = i;  // ← ここで「編集モード」に入る

  // ボタンの表示を「更新」に
  const btn = document.getElementById("addBtn");
  btn.textContent = "更新";
  btn.classList.add("primary");
}

/* Calc */
function unit(r) {
  return r.minpt ? (r.yen / r.minpt) : 0;
}

// 丸めず“素の値”を返す
function yenOf(r, n) {
  const u = unit(r);
  return u * Number(n || 0);
}

/* CSV（表の並び順＆累計込みで出力） */
function exportCSV() {
  // 1) 表示用と同じ“計算済み配列”を作る
  const base = getData();
  const computed = base.map(r => {
    const u = unit(r);
    return {
      ...r,
      unit: u,
      yen1: yenOf(r, r.p1),
      yen2: yenOf(r, r.p2),
      totalYen: getRecordTotal(r.site),
    };
  });

  // 2) 画面のソート状態を反映
  const k = sortState.key, dir = sortState.dir;
  computed.sort((a, b) => {
    const va = a[k], vb = b[k];
    const isText = (k === "site" || k === "memo");
    const res = isText
      ? String(va ?? "").localeCompare(String(vb ?? ""), "ja")
      : (Number(va ?? 0) - Number(vb ?? 0));
    return dir === "asc" ? res : -res;
  });

  // 3) ヘッダー（表と同じ＋累計(円)）
  const head = [
    "サイト名", "最低換金ポイント", "換金額(円)", "1pt(円)",
    "pt1", "pt1→円", "pt2", "pt2→円", "メモ", "累計(円)"
  ];
  const lines = [head.join(",")];

  // 小数の見た目（表と同じ思想：1円未満は0.01、1円以上は0.1）
  const moneyCSV = (x) => {
    const v = Number(x) || 0;
    if (v === 0) return "0";
    return v < 1 ? v.toFixed(2) : (Math.round(v * 10) / 10).toFixed(1);
  };

  // 4) 行データ
  computed.forEach(r => {
    const row = [
      r.site,
      r.minpt,
      r.yen,
      r.unit.toFixed(4),         // 1pt(円)
      r.p1 || "",
      moneyCSV(r.yen1),          // pt1→円
      r.p2 || "",
      moneyCSV(r.yen2),          // pt2→円
      r.memo || "",
      moneyCSV(r.totalYen),      // ★ 累計(円)
    ];
    lines.push(row.map(csvEsc).join(","));
  });

  // 5) Excel文字化け対策（BOM）＋CRLF
  const bom = "\uFEFF";
  const csvText = bom + lines.join("\r\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "poikatsu_unit.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}


// ヘルパー：列名の正規化（空白/記号を外して小文字化）
function _norm(h) {
  return String(h || "")
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]→]/g, "")
    .toLowerCase();
}
// ヘルパー：数値化（"300円" や "60pt" を許容）
function _num(v) {
  const t = String(v ?? "").replace(/[^\d.\-]/g, "");
  return t ? Number(t) : 0;
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const txt = e.target.result;

    // 行分割（CRLF/CR/LFすべて対応）＋ 空行除去
    const rows = txt.replace(/\r\n?/g, "\n").split("\n").filter(r => r.trim() !== "");
    if (!rows.length) { flash?.("CSVが空です"); return; }

    // 1行目をCSVとして解析
    const firstCols = parseCSVLine(rows[0] || "");

    // 列名候補（先頭行がヘッダーならここに入る）
    const h0 = firstCols.map(_norm);

    // ターゲット列の別名（どれかにマッチしたら採用）
    const alias = {
      site: ["サイト名", "site", "サイト", "なまえ", "名称"].map(_norm),
      minpt: ["最低換金pt", "最低換金ポイント", "最低換金", "minpt"].map(_norm),
      yen: ["換金額円", "換金額", "yen", "金額"].map(_norm),
      p1: ["1pt円", "pt1円", "pt1", "pt①円", "pt①"].map(_norm),
      p2: ["pt2円", "pt2", "pt②円", "pt②"].map(_norm),
      memo: ["メモ", "memo", "備考", "コメント"].map(_norm),
    };

    // 先頭行がヘッダーかどうか判定（「サイト名」などが含まれていればヘッダー）
    const looksHeader = h0.some(h => alias.site.includes(h) || alias.minpt.includes(h) || alias.yen.includes(h));

    // 列インデックス決定
    let idx = { site: 0, minpt: 1, yen: 2, p1: 3, p2: 4, memo: 5 };
    if (looksHeader) {
      const findIdx = (names) => {
        for (let i = 0; i < h0.length; i++) if (names.includes(h0[i])) return i;
        return -1;
      };
      idx = {
        site: findIdx(alias.site),
        minpt: findIdx(alias.minpt),
        yen: findIdx(alias.yen),
        p1: findIdx(alias.p1),
        p2: findIdx(alias.p2),
        memo: findIdx(alias.memo),
      };
    }

    const start = looksHeader ? 1 : 0;
    const out = [];

    for (let i = start; i < rows.length; i++) {
      const cols = parseCSVLine(rows[i]);
      if (!cols || cols.length === 0) continue;

      const pick = (j) => (j >= 0 && j < cols.length) ? cols[j] : "";

      const site = pick(idx.site).trim();
      const minpt = _num(pick(idx.minpt));
      const yen = _num(pick(idx.yen));
      const p1 = _num(pick(idx.p1));
      const p2 = _num(pick(idx.p2));
      const memo = pick(idx.memo); // メモは文字列のまま

      // サイト名が空ならスキップ（お好みで）
      if (!site) continue;

      out.push({ site, minpt, yen, p1, p2, memo });
    }

    setData(out);
    render();
    flash?.("CSVを読み込みました");
  };
  reader.readAsText(file, "utf-8");
}

/* ===== JSON Backup / Restore ===== */

// レートの保存キー（既存）: "poikatsu_unit_split_v1"
// 各サイトの換金記録キー: "poikatsu_logs_<サイト名>"

function listLogKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('poikatsu_logs_')) out.push(k);
  }
  return out;
}

function collectLogs() {
  const logs = {};
  listLogKeys().forEach(k => {
    const site = k.replace('poikatsu_logs_', '');
    try {
      logs[site] = JSON.parse(localStorage.getItem(k) || '[]');
    } catch (_) { logs[site] = []; }
  });
  return logs;
}

// JSON出力（レート＋各サイト記録をスナップショット化）
function exportJSON() {
  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rates: getData(),          // レート一覧（indexのテーブル）
    logs: collectLogs(),       // 各サイトの換金記録 { "サイト名": [ {date,amt,memo}, ... ] }
  };
  const txt = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([txt], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");

  const pad = n => String(n).padStart(2, "0");
  const d = new Date();
  const name = `poikatsu_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  flash("JSONを出力しました");
}

// JSON読み込み（スナップショットを適用）
function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const snap = JSON.parse(e.target.result);
      if (!snap || !Array.isArray(snap.rates) || typeof snap.logs !== "object") {
        alert("JSONの形式が正しくありません"); return;
      }
      if (!confirm("現在のデータをすべて置き換えます。よい？")) return;

      // レートを置き換え
      setData(snap.rates);

      // 既存ログをいったん全削除してから、スナップショットを適用
      listLogKeys().forEach(k => localStorage.removeItem(k));
      Object.keys(snap.logs).forEach(site => {
        const key = `poikatsu_logs_${site}`;
        try {
          localStorage.setItem(key, JSON.stringify(snap.logs[site] || []));
        } catch (_) { }
      });

      render();
      flash("JSONを復元しました");
    } catch (err) {
      console.error(err);
      alert("JSONの読み込みに失敗しました");
    } finally {
      const inp = document.getElementById('json');
      if (inp) inp.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

// ボタン→隠しinput の橋渡し
function setupJSONImport() {
  const btn = document.getElementById('jsonBtn');
  const inp = document.getElementById('json');
  if (!btn || !inp) return;

  btn.addEventListener('click', () => inp.click());
  inp.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importJSONFile(f);
  });
}

/* Render & sort */
let sortState = { key: "site", dir: "asc" };
function render(opts = {}) {
  const arr = getData();
  const computed = arr.map((r, idx) => {
    const u = unit(r);
    const totalYen = getRecordTotal(r.site);
    return { ...r, _i: idx, unit: u, yen1: yenOf(r, r.p1), yen2: yenOf(r, r.p2), totalYen };
  });
  // sort
  const k = sortState.key, dir = sortState.dir;
  computed.sort((a, b) => {
    const va = a[k], vb = b[k];
    const isText = (k === "site" || k === "memo");
    const res = isText ? String(va || "").localeCompare(String(vb || ""), "ja") : (Number(va || 0) - Number(vb || 0));
    return dir === "asc" ? res : -res;
  });

  const tb = document.querySelector("#tbl tbody");
  tb.innerHTML = "";
  computed.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>
    <a href="./records.html?site=${encodeURIComponent(r.site)}"
       class="link" target="_blank" rel="noopener noreferrer">
       ${escapeHTML(r.site)}
    </a>
  </td>
  <td class="right mono">${fmtInt(r.minpt)}<span class="unit">pt</span></td>
  <td class="right mono">${fmtInt(r.yen)}<span class="unit">円</span></td>
  <td class="right mono">${r.unit.toFixed(4)}<span class="unit">円</span></td>
  <td class="right mono">${fmtInt(r.p1 || 0)}<span class="unit">pt</span></td>
  <td class="right mono">${fmtMoney(r.yen1)}<span class="unit">円</span></td>
  <td class="right mono">${fmtInt(r.p2 || 0)}<span class="unit">pt</span></td>
  <td class="right mono">${fmtMoney(r.yen2)}<span class="unit">円</span></td>
  <td>${escapeHTML(r.memo || "")}</td>
  <td class="right mono">${fmtMoney(r.totalYen)}<span class="unit">円</span></td>
  <td class="action-col">
    <button type="button" class="btn ghost small" onclick="edit(${r._i})">編集</button>
    <button type="button" class="btn warn small"  onclick="delRow(${r._i})">削除</button>
  </td>
`;
    tb.appendChild(tr); // ←←←★ここ！絶対必要！
  });

  
  // ---- ここから追加：Enterキーで次のinputに移動（textarea対応）----
  const inputs = document.querySelectorAll('.form-grid input, .form-grid textarea');
  inputs.forEach((el, i) => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        // textareaでは Shift+Enter で改行できるようにする
        if (el.tagName === 'TEXTAREA' && e.shiftKey) return;

        e.preventDefault(); // Enterで送信されるのを防ぐ
        const next = inputs[i + 1] || document.getElementById('addBtn');
        next?.focus();
        next?.select?.();
      }
    });
  });
  // ---- ここまで追加 ----

  // header indicators
  document.querySelectorAll("thead th.sortable .sort-ind").forEach(span => span.textContent = "");
  const cur = document.querySelector(`thead th.sortable[data-k="${sortState.key}"] .sort-ind`);
  if (cur) cur.textContent = sortState.dir === "asc" ? "▲" : "▼";

  if (opts.scroll) tb.lastElementChild?.scrollIntoView({ behavior: "smooth" });
}

/* Sort click */
document.addEventListener("click", (e) => {
  const th = e.target.closest("thead th.sortable");
  if (!th) return;
  const key = th.dataset.k;
  if (!key) return;
  if (sortState.key === key) sortState.dir = (sortState.dir === "asc" ? "desc" : "asc");
  else { sortState.key = key; sortState.dir = "asc"; }
  render();
});

/* Helpers */
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); }
function csvEsc(s) { const t = String(s).replace(/"/g, '""'); return /[",\n]/.test(t) ? `"${t}"` : t; }
function parseCSVLine(line) {
  const res = [], n = line.length; let i = 0, cur = "", inQ = false;
  while (i < n) {
    const ch = line[i];
    if (inQ) {
      if (ch == '"') { if (line[i + 1] == '"') { cur += '"'; i++; } else { inQ = false; } }
      else cur += ch;
    } else {
      if (ch == '"') { inQ = true; }
      else if (ch == ',') { res.push(cur); cur = ""; }
      else cur += ch;
    }
    i++;
  }
  res.push(cur);
  return res;
}

/* Seed */
(function init() {
  const arr = getData();
  if (arr.length === 0) {
    setData([
      { site: "あるくと", minpt: 100, yen: 100, p1: 5, p2: 20, memo: "歩数アプリ" },
      { site: "ハピタス", minpt: 300, yen: 300, p1: 60, p2: 120, memo: "等価交換" },
      { site: "ポイントインカム", minpt: 500, yen: 500, p1: 50, p2: 100, memo: "案件系" }
    ]);
  }
  render();
  setupCSVImport();   // ← これを追加
  setupJSONImport();
  ;
})();

// もし未定義なら追加（全削除ボタン用）
function resetAll() {
  if (!confirm("保存データを全部消しますか？")) return;
  setData([]);
  render();
  flash("データを削除しました");
}

// 金額の見た目（カンマ付＆桁数ルール）
function fmtMoney(x) {
  const v = Number(x) || 0;
  if (v === 0) return "0";
  if (v < 1) {
    // 1円未満は0.01円刻み（カンマ付）
    return Number(v.toFixed(2)).toLocaleString('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  // 1円以上は0.1円刻み（カンマ付）
  const r = Math.round(v * 10) / 10;
  return r.toLocaleString('ja-JP', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

// ←★この下に追加！
function fmtInt(n) {
  return Number(n || 0).toLocaleString('ja-JP');
}
function setupCSVImport() {
  const btn = document.getElementById('csvBtn');
  const inp = document.getElementById('csv');
  if (!btn || !inp) return;

  // 見た目ボタン→隠しinputをクリック
  btn.addEventListener('click', () => inp.click());

  // ファイル選択後に読み込み開始
  inp.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    importCSV(f);
    e.target.value = ""; // 同じファイル再選択でも発火させるためリセット
  });
}