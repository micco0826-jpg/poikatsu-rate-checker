// ===== ユーティリティ =====
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const site = qs.get("site") || ""; // 例：?site=ハピタス
const key  = site ? `poikatsu_logs_${site}` : `poikatsu_logs_default`;
// 先頭の const 群の下あたりに追加
const BACKUP_KEY = `poikatsu_logs_backup_${site || 'default'}`;

function flash(msg){
  const el = document.getElementById('toast'); if(!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(()=> el.classList.remove('show'), 1600);
}
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
function getData(){ try{ return JSON.parse(localStorage.getItem(key)||"[]"); } catch(e){ return []; } }
function setData(arr){ localStorage.setItem(key, JSON.stringify(arr)); }
function exportCSV(){
  const arr = getData();               // いま表示してるこのサイトの記録
  const head = ["日付","金額","メモ"];
  const lines = [head.join(",")];

  // CSV用エスケープ（" → ""、カンマ/改行があればクオート）
  const esc = s => {
    const t = String(s ?? "").replace(/"/g,'""');
    return /[",\n]/.test(t) ? `"${t}"` : t;
  };

  arr.forEach(r=>{
    lines.push([esc(r.date), esc(r.amt), esc(r.memo)].join(","));
  });

  // Excel文字化け対策：BOM + CRLF
  const bom = "\uFEFF";
  const csvText = bom + lines.join("\r\n");

  const blob = new Blob([csvText], {type: "text/csv;charset=utf-8;"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (site ? `${site}_` : "") + "cash_logs.csv";
  a.click();
  URL.revokeObjectURL(a.href);

  // 前回バックアップ時刻を覚えて表示を更新（任意）
  try{
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
    updateBackupInfo?.();
  }catch(e){}
  flash?.("CSVを出力しました");
}

// ===== 追加 =====
function add(){
  console.log('[add] clicked', {
    date: $("#date")?.value, amt: $("#amt")?.value, memo: $("#memo")?.value
  });

  const date = $("#date").value;
  const amt  = Number($("#amt").value || 0);
  const memo = $("#memo").value.trim();

  if(!date){ alert("日付を入れてね"); return; }
  if(!Number.isFinite(amt) || amt <= 0){ alert("金額(円)を入れてね"); return; }

  const arr = getData();
  arr.push({ date, amt, memo });
  setData(arr);

  render({ scroll:true });
  updateTotal();            // ← これを追加！
  $("#amt").value = "";
  $("#memo").value = "";
  flash("保存しました");
}

window.add = add; // 念のためグローバルにも公開（保険）

// ===== 削除 =====
function delRow(i){
  const arr = getData();
  const row = arr[i]; if(!row) return;
  const label = `${row.date} / ${row.amt}円`;
  if(!confirm(`「${label}」を削除しますか？`)) return;
  arr.splice(i,1);
  setData(arr);
  render();
  flash("1件削除しました");
}

// ===== 表描画 =====
function render(opts={}){
  const arr = getData().slice(); // いったん並び替えなし（追加順）

  const tb = document.querySelector("#tbl tbody");
  tb.innerHTML = "";

  arr.forEach((r, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(r.date)}</td>
      <td class="right mono">${Number(r.amt||0)}<span class="unit">円</span></td>
      <td>${escapeHTML(r.memo || "")}</td>
      <td class="actions">
        <button type="button" class="btn warn small" onclick="delRow(${i})">削除</button>
      </td>
    `;
    tb.appendChild(tr);
  });

  if(opts.scroll) tb.lastElementChild?.scrollIntoView({behavior:"smooth"});
}

// ===== クリック結びつけ & 初期化 =====
function wireEvents(){
  const btn = document.getElementById('addBtn');
  if (btn) btn.addEventListener('click', add);

  // Enterで追加（textareaは Shift+Enter で改行）
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if(tag === 'textarea'){
      if(e.shiftKey) return; // 改行
      e.preventDefault();
      add();
      return;
    }
    if(tag === 'input'){
      e.preventDefault();
      add();
    }
  });
}

(function init(){
  if(site){
    const t = document.getElementById("title");
    if(t){ t.textContent = `換金記録：${site}`; document.title = `換金記録｜${site}`; }
  }
  setPillLabel();   // ← ここを追加（ページ読み込み時にラベル反映）
  const today = new Date().toISOString().slice(0,10);
  const d = document.getElementById("date"); if(d) d.value = today;

  // ---- 初回起動時だけ、例として1件だけ登録する ----
  const arr = getData();
  if (arr.length === 0) {
    setData([
      { date: today, amt: 300, memo: `${site || "サンプル"} の初期データ` }
    ]);
  }
  // ---------------------------------------------------

  wireEvents();
  render();
  updateTotal();            // ← これを追加！
})();

function updateTotal() {
  const arr = getData();
  const total = arr.reduce((sum, r) => sum + Number(r.amt || 0), 0);
  document.getElementById("totalAmount").textContent =
    total.toLocaleString() + "円";
     setPillLabel();
}

// ページ読み込み時にも実行
updateTotal();

function setPillLabel(){
  const pill = document.querySelector('.total-card .pill');
  if (!pill) return;
  pill.textContent = site ? `💰 ${site} の換金総額` : '💰 今までの換金総額';
}