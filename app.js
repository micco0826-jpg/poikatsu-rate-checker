const key = "poikatsu_unit_split_v1";
const $ = (s)=>document.querySelector(s);

function flash(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(()=> el.classList.remove('show'), 1600);
}

/* Data */
function getData(){ try{ return JSON.parse(localStorage.getItem(key)||"[]"); } catch(e){ return []; } }
function setData(arr){ localStorage.setItem(key, JSON.stringify(arr)); }

/* Add */
function add(){
  const site = $("#site").value.trim();
  const minpt = Number($("#minpt").value||0);
  const yen = Number($("#yen").value||0);
  const p1 = Number($("#p1").value||0);
  const p2 = Number($("#p2").value||0);
  const memo = $("#memo").value.trim();
  if(!site){ alert("サイト名を入れてね"); return; }
  if(!minpt || !yen){ alert("最低換金pt と 換金額 を入れてね"); return; }
  const arr = getData();
  arr.push({site, minpt, yen, p1: p1||0, p2: p2||0, memo});
  setData(arr);
 ["#site","#minpt","#yen","#p1","#p2","#memo"].forEach(id=>$(id).value="");
  render({scroll:true});
  // 既存 add() の最後に追加
  flash("保存しました");
  
}

/* Delete */
function delRow(i){
  const arr = getData();
  arr.splice(i,1);
  setData(arr);
  render();
}

/* Edit -> load to form */
function edit(i){
  const arr = getData();
  const r = arr[i];
  if(!r) return;
  $("#site").value = r.site||"";
  $("#minpt").value = r.minpt||"";
  $("#yen").value = r.yen||"";
  $("#p1").value = r.p1||"";
  $("#p2").value = r.p2||"";
  delRow(i);
  // 既存 delRow() の最後に追加
  flash("1件削除しました");
}

/* Calc */
function unit(r){ 
  return r.minpt ? (r.yen / r.minpt) : 0; 
}

// 丸めず“素の値”を返す
function yenOf(r, n){
  const u = unit(r);
  return u * Number(n || 0);
}

/* CSV */
function exportCSV(){
  const arr = getData();
  const head = ["サイト名","最低換金ポイント","換金額","pt1","pt2","メモ"];
  const lines = [head.join(",")];
  arr.forEach(r=>{
    const row = [r.site, r.minpt, r.yen, r.p1||"", r.p2||"", r.memo||""];
    lines.push(row.map(csvEsc).join(","));
  });
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "poikatsu_unit.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importCSV(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const txt = e.target.result;
    const rows = txt.split(/\r?\n/).filter(Boolean);
    const out = [];
    let start = 0;
    if(/サイト名/.test(rows[0])) start = 1;
    for(let i=start;i<rows.length;i++){
      const cols = parseCSVLine(rows[i]);
      if(cols.length<3) continue;
      out.push({
        site: cols[0],
        minpt: Number(cols[1]||0),
        yen: Number(cols[2]||0),
        p1: Number(cols[3]||0),
        p2: Number(cols[4]||0),
        memo: cols[5]||""
      });
    }
    setData(out);
    render();
  };
  reader.readAsText(file,"utf-8");
  // CSV読み込み完了時に追加
  flash("CSVを読み込みました");
}

/* Render & sort */
let sortState = { key:"site", dir:"asc" };
function render(opts={}){
  const arr = getData();
  const computed = arr.map((r,idx)=>{
    const u = unit(r);
    return {...r, _i:idx, unit:u, yen1:yenOf(r,r.p1), yen2:yenOf(r,r.p2)};
  });
  // sort
  const k = sortState.key, dir = sortState.dir;
  computed.sort((a,b)=>{
    const va = a[k], vb = b[k];
    const isText = (k==="site" || k==="memo");
    const res = isText ? String(va||"").localeCompare(String(vb||""), "ja") : (Number(va||0) - Number(vb||0));
    return dir==="asc" ? res : -res;
  });

  const tb = document.querySelector("#tbl tbody");
  tb.innerHTML = "";
  computed.forEach(r=>{
    const tr = document.createElement("tr");
 tr.innerHTML = `
  <td>${escapeHTML(r.site)}</td>
  <td class="right mono">${r.minpt}<span class="unit">pt</span></td>
  <td class="right mono">${r.yen}<span class="unit">円</span></td>
  <td class="right mono">${r.unit.toFixed(4)}<span class="unit">円</span></td>
  <td class="right mono">${r.p1 || 0}<span class="unit">pt</span></td>
  <td class="right mono">${fmtMoney(r.yen1)}<span class="unit">円</span></td>
  <td class="right mono">${r.p2 || 0}<span class="unit">pt</span></td>
  <td class="right mono">${fmtMoney(r.yen2)}<span class="unit">円</span></td>
  <td>${escapeHTML(r.memo || "")}</td>
  <td>
    <button class="btn ghost small" onclick="edit(${r._i})">編集</button>
    <button class="btn warn small" onclick="delRow(${r._i})">削除</button>
  </td>
`;
    tb.appendChild(tr);
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
  document.querySelectorAll("thead th.sortable .sort-ind").forEach(span=> span.textContent="");
  const cur = document.querySelector(`thead th.sortable[data-k="${sortState.key}"] .sort-ind`);
  if(cur) cur.textContent = sortState.dir==="asc" ? "▲" : "▼";

  if(opts.scroll) tb.lastElementChild?.scrollIntoView({behavior:"smooth"});
}

/* Sort click */
document.addEventListener("click",(e)=>{
  const th = e.target.closest("thead th.sortable");
  if(!th) return;
  const key = th.dataset.k;
  if(!key) return;
  if(sortState.key===key) sortState.dir = (sortState.dir==="asc" ? "desc" : "asc");
  else { sortState.key=key; sortState.dir="asc"; }
  render();
});

/* Helpers */
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function csvEsc(s){ const t = String(s).replace(/"/g,'""'); return /[",\n]/.test(t) ? `"${t}"` : t; }
function parseCSVLine(line){
  const res=[], n=line.length; let i=0, cur="", inQ=false;
  while(i<n){
    const ch=line[i];
    if(inQ){
      if(ch=='"'){ if(line[i+1]=='"'){cur+='"'; i++;} else {inQ=false;} }
      else cur+=ch;
    } else {
      if(ch=='"'){ inQ=true; }
      else if(ch==','){ res.push(cur); cur=""; }
      else cur+=ch;
    }
    i++;
  }
  res.push(cur);
  return res;
}

/* Seed */
(function init(){
  const arr = getData();
  if(arr.length===0){
    setData([
      {site:"あるくと", minpt:100, yen:100, p1:5, p2:20, memo:"歩数アプリ"},
      {site:"ハピタス", minpt:300, yen:300, p1:60, p2:120, memo:"等価交換"},
      {site:"ポイントインカム", minpt:500, yen:500, p1:50, p2:100, memo:"案件系"}
    ]);
  }
  render();
})();
// もし未定義なら追加（全削除ボタン用）
function resetAll(){
  if(!confirm("保存データを全部消します。よい？")) return;
  setData([]);
  render();
  flash("データを削除しました");
}

// 金額の見た目だけを整える
function fmtMoney(x){
  const v = Number(x) || 0;
  if (v === 0) return "0";
  if (v < 1)  return v.toFixed(2);          // 1円未満は0.01円単位
  return (Math.round(v * 10) / 10).toFixed(1); // 1円以上は0.1円単位
}
