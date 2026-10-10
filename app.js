let field = null, struct = null, cast = 0, tide = null;
const sel = {};
const formEl = document.getElementById('form');

function chipRow(label, opts, get, set){
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = '<div class="row-h">' + label + '</div>';
  const chips = document.createElement('div'); chips.className = 'chips';
  opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.textContent = o;
    b.setAttribute('aria-pressed', String(get() === i));
    b.onclick = () => { set(get() === i ? null : i); build(); render(); };
    chips.appendChild(b);
  });
  row.appendChild(chips); return row;
}
function build(){
  formEl.innerHTML = '';
  const p1 = document.createElement('div'); p1.className = 'panel';
  p1.innerHTML = '<p class="ph">① FIELD</p>';
  p1.appendChild(chipRow('フィールド', FIELDS, () => field, v => { if (field !== v) struct = null; field = v; }));
  if (field !== null) {
    p1.appendChild(chipRow('地形', STRUCT[FIELDS[field]].map(s => s.n), () => struct, v => struct = v));
  }
  formEl.appendChild(p1);

  const p2 = document.createElement('div'); p2.className = 'panel';
  p2.innerHTML = '<p class="ph">② CONDITIONS</p>';
  DIMS.slice(0, 5).forEach(d => p2.appendChild(chipRow(d.label, d.opts,
    () => sel[d.k] === undefined ? null : sel[d.k], v => { if (v === null) delete sel[d.k]; else sel[d.k] = v; })));
  p2.appendChild(chipRow('潮の状況', TIDES, () => tide, v => tide = v));
  formEl.appendChild(p2);

  const p3 = document.createElement('div'); p3.className = 'panel';
  p3.innerHTML = '<p class="ph">③ BAIT</p>';
  const db = DIMS[5];
  p3.appendChild(chipRow(db.label, db.opts, () => sel.b === undefined ? null : sel.b,
    v => { if (v === null) delete sel.b; else sel.b = v; }));
  formEl.appendChild(p3);

  const p4 = document.createElement('div'); p4.className = 'panel';
  p4.innerHTML = '<p class="ph">④ PURPOSE</p>';
  const dg = DIMS[6];
  p4.appendChild(chipRow(dg.label, dg.opts, () => sel.g === undefined ? null : sel.g,
    v => { if (v === null) delete sel.g; else sel.g = v; }));
  p4.appendChild(chipRow('投げる方向（任意）', CAST, () => cast, v => cast = v === null ? 0 : v));
  formEl.appendChild(p4);
}
document.getElementById('reset').onclick = () => {
  field = null; struct = null; cast = 0; tide = null;
  Object.keys(sel).forEach(k => delete sel[k]);
  build(); render();
};

function esc(t){return String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function curStruct(){ return (field !== null && struct !== null) ? STRUCT[FIELDS[field]][struct] : null; }
function castScore(L){
  if (!cast) return 0;
  if (cast === 1) return L.g[2] + (L.wv <= 1 ? 2 : -1) + (L.main <= 1 ? 1 : 0);
  if (cast === 2) return 1 + Math.round(L.g[0] / 2);
  return L.f[2] + (L.wv >= 1 ? 1 : 0) + (L.main >= 2 ? 1 : 0);
}
function score(L){
  let total = 0, n = 0; const parts = [];
  DIMS.forEach(d => { if (sel[d.k] === undefined) return;
    const v = L[d.k][sel[d.k]]; total += v; n++; parts.push({label: d.opts[sel[d.k]], v}); });
  if (field !== null){ total += L.fl[field]; n++; }
  if (tide !== null && sel.f === undefined){ total += L.f[tide === 2 ? 0 : (tide === 0 ? 1 : 2)]; n++; }
  const st = curStruct();
  if (st){ st.need.forEach(([k, i, w]) => { total += L[k][i] * w; n += w; }); }
  total += castScore(L);
  return {total, n: Math.max(n, 1)};
}
function stars(s){ const k = Math.max(1, Math.min(5, Math.round(s.total / (3 * s.n) * 5)));
  return '★'.repeat(k) + '☆'.repeat(5 - k); }
function famScore(f){ const F = COLOR_FAM[f]; if (!F) return 0; let s = 0;
  ['t','l','b'].forEach(k => { if (sel[k] !== undefined) s += F[k][sel[k]]; }); return s; }
function condLine(){
  const xs = [];
  if (field !== null) xs.push(FIELDS[field]);
  const st = curStruct(); if (st) xs.push(st.n);
  DIMS.forEach(d => { if (sel[d.k] !== undefined) xs.push(d.opts[sel[d.k]]); });
  if (tide !== null) xs.push(TIDES[tide]);
  if (cast) xs.push(CAST[cast]);
  return xs.join(' × ');
}
function needLine(L){
  const ns = [];
  if (field !== null && L.fl[field] >= 2) ns.push(FIELD_NEED[field]);
  DIMS.forEach(d => { if (sel[d.k] !== undefined && L[d.k][sel[d.k]] >= 2) ns.push(NEED[d.k][sel[d.k]]); });
  const st = curStruct();
  if (st) st.need.forEach(([k, i]) => { if (L[k][i] >= 2 && NEED[k]) { const t = NEED[k][i]; if (ns.indexOf(t) < 0) ns.push(t); } });
  if (!ns.length) return '突出した強みはないが、選んだ条件全体で大きな弱点がない';
  return ns.slice(0, 3).join('、') + 'を満たせる';
}
function colorBlock(L){
  const own = L.fam.map(f => ({f, s: famScore(f)})).sort((a, b) => b.s - a.s);
  const all = Object.keys(COLOR_FAM).map(f => ({f, s: famScore(f)})).sort((a, b) => b.s - a.s);
  const max = Math.max(1, Math.abs(all[0].s));
  const st = v => { const k = Math.max(1, Math.min(5, Math.round(v / max * 5))); return '★'.repeat(k) + '☆'.repeat(5 - k); };
  const ownHtml = own.map(o => '<div class="ownc">' + esc(L.c) + '（' + esc(o.f) + '）　<span class="stars">' + st(o.s) + '</span></div>' +
    '<div class="meta">' + esc(COLOR_FAM[o.f].why) + '</div>').join('');
  const top = all.slice(0, 3).map(a => '<span class="famtag">' + esc(a.f) + ' ' + st(a.s) + '</span>').join('');
  return '<div class="col"><b class="meta">カラー</b>' + ownHtml +
    '<div class="meta" style="margin-top:6px">今の条件で強い系統</div><div class="fam">' + top + '</div></div>';
}
function castDir(L){
  if (cast) return CAST[cast];
  const st = curStruct();
  if (st) return st.dir;
  if (sel.f === 2) return L.main >= 2 ? 'クロス〜ダウンクロス' : 'アップクロス';
  return 'クロス';
}
// 速度：ルアーの種類を基準に、光量・水色・流れ・ベイト・目的・フィールドで前後させる（経験則）
const SPEED_SCALE = ['デッドスロー','スロー','スロー〜ミディアム','ミディアム','ミディアム〜速め'];
const SPEED_BASE = {top:3, minnow:2, deep:3, pencil:1, rb:2, vibe:3, metal:4, heavy:3, worm:2, wake:0};
function speedCalc(L){
  let v = SPEED_BASE[L.ty], why = [];
  if (sel.l === 2){ v -= 1; why.push('夜は見せる時間を長く'); }
  if (sel.l === 0 && sel.t === 0){ v += 1; why.push('昼のクリアは見切られる前に'); }
  if (sel.t === 2){ v -= 1; why.push('濁りは気づかせる間が要る'); }
  if (sel.f === 2){ v -= 1; why.push('流れが強い分、巻きは抑える'); }
  if (sel.f === 0){ v += 1; why.push('流れが弱いので自分から動かす'); }
  if (sel.b === 3 || sel.b === 0){ v -= 1; why.push('小さい・弱いベイトに合わせる'); }
  if (sel.b === 1){ v += 1; why.push('イワシは速い動きにも反応する'); }
  if (sel.b === 4){ v -= 1; why.push('落ち鮎はゆっくり流れる'); }
  if (sel.g === 0){ v += 1; why.push('広く探すので手返し重視'); }
  if (sel.g === 1 || sel.g === 2){ v -= 1; why.push('一点で見せる・流れに乗せる'); }
  if (field === 2){ v += 1; why.push('サーフは広く探る'); }
  if (field === 3 || field === 4){ v -= 1; why.push('狭い場所は丁寧に'); }
  const st = curStruct();
  if (st && /明暗|ヨレ|反転流|際/.test(st.n)){ v -= 1; why.push(st.n + 'は、ゆっくり通す'); }
  v = Math.max(0, Math.min(4, v));
  return {text: SPEED_SCALE[v], why: why.slice(0,3).join('、') || L.a[1] + 'が出る速度を基準に'};
}
function howto(L){
  const st = curStruct();
  const g1 = [
    ['キャスト方向', castDir(L)],
    ['通すコース', st ? st.course : (field !== null ? FIELDS[field] + 'の、流れや地形の変化を横切らせる' : '流れや地形の変化を横切らせる')],
    ['レンジ', L.a[0]],
  ];
  const g2 = [
    ['流し方', st ? st.drift : (L.ty === 'minnow' || L.ty === 'pencil' || L.ty === 'wake' ? '流れに乗せ、ラインを張りすぎない' : 'レンジをキープして横に引く')],
    ['ラインの操作', DRIFT[L.ty]],
  ];
  const sp = speedCalc(L);
  const g3 = [
    ['速度', sp.text + '（' + sp.why + '）。反応がなければ、速い・遅いの両方を試す'],
    ['アクション', ACT[L.ty]],
  ];
  const tn = tide !== null ? [['潮', TIDE_NOTE[tide]]] : [];
  const blk = (title, rows) => '<div class="sub">' + title + '</div><ul class="flow">' +
    rows.map(r => '<li><span class="fk">' + r[0] + '</span><span>' + esc(r[1]) + '</span></li>').join('') + '</ul>';
  return '<div class="card"><div class="meta">' + esc(L.n) + '　' + esc(L.c) + '</div>' +
    blk('どこへ、どう通すか【経験則】', g1.concat(tn)) + blk('どう流すか【経験則】', g2) + blk('速度・アクション【経験則】', g3) +
    '<div class="meta" style="margin-top:8px">レンジはメーカーなどの仕様・表示を基準とした目安で、実釣時の実レンジを保証するものではありません。キャスト方向・コース・流し方・速度・アクションは、経験則に基づく選定の目安です。</div></div>';
}
function firstCard(x, needDeep){
  const L = x.L;
  const v = [L.a[0], L.a[1] + '（' + WAVE[L.wv] + '）', L.a[2], L.a[3]];
  return '<div class="card first">' +
    '<div class="card-top"><div class="name">' + esc(L.n) + '</div><div class="stars">' + stars(x.s) + '</div></div>' +
    '<div class="meta">' + esc(L.c) + '　' + (L.wt ? esc(L.wt) + '　' : '') + RANGE[L.main] + '</div>' +
    '<div class="reason"><b>選定理由</b>' +
      '<div class="step s1">' + esc(condLine()) + '</div><div class="arrow">↓</div>' +
      '<div class="step">' + esc(needLine(L)) + '</div><div class="arrow">↓</div>' +
      '<div class="step s3">' + esc(L.n) + ' を選定</div>' +
      '<div class="meta" style="margin-top:6px">' + (needDeep ? 'レンジを下げる条件（目的または深場）があるため、全体から選んでいます。' : '基本は表層〜シャローのミノー系から入ります。反応がなければ、下の「反応がなかったら」でレンジを下げます。') + '</div></div>' +
    '<div class="sub">この1本を選んだ理由</div>' +
    '<div class="kv">' + ATTR_LABEL.map((k, i) => '<div><span class="k">' + k + '</span><span>' + esc(v[i]) + '</span></div>').join('') + '</div>' +
    '<div class="kv"><div><span class="k">得意</span><span>' + esc(L.good) + '</span></div>' +
    '<div><span class="k bad">弱点</span><span class="bad">' + esc(L.weak) + '</span></div></div>' +
    colorBlock(L) + '</div>';
}

function render(){
  const resEl = document.getElementById('results'), howEl = document.getElementById('howto'), rotEl = document.getElementById('rotation');
  if (field === null && tide === null && !Object.keys(sel).length){
    resEl.innerHTML = '<div class="empty">フィールドか条件を1つ以上選んでください。</div>';
    howEl.innerHTML = ''; rotEl.innerHTML = '<li class="empty">条件を選ぶと表示されます。</li>'; return;
  }
  const ranked = LURES.map(L => ({L, s: score(L)})).sort((a, b) => b.s.total - a.s.total || a.L.main - b.L.main);
  // 基本はミノー系（表層〜シャロー）から入る。レンジを下げる必要がある時だけ、全体から選ぶ
  const needDeep = sel.g === 3 || sel.dp === 2;
  const pool = needDeep ? ranked : ranked.filter(y => y.L.main <= 1);
  const first = pool[0] || ranked[0];
  resEl.innerHTML = firstCard(first, needDeep);
  howEl.innerHTML = howto(first.L);

  const used = new Set([first.L.n]);
  const take = fn => { const x = ranked.find(y => !used.has(y.L.n) && fn(y)); if (x) used.add(x.L.n); return x; };
  const F = first.L, deeper = F.main <= 1, bigger = F.sz <= 1;
  const steps = [];
  const r1 = take(y => deeper ? y.L.main >= Math.max(2, F.main + 1) : y.L.main <= F.main - 1);
  if (r1) steps.push({c: deeper ? 'レンジを下げる' : 'レンジを上げる',
    d: '同じコースを10〜15分通して反応がない時。魚が浮いていない可能性がある', why: r1.L.a[0] + 'を通せる', x: r1});
  const r2 = take(y => bigger ? y.L.sz > F.sz : y.L.sz < F.sz);
  if (r2) steps.push({c: bigger ? 'シルエットを大きくする' : 'シルエットを小さくする',
    d: '出るが乗らない、追うだけで食わない時。ベイトのサイズが合っていない可能性がある', why: r2.L.a[2] + 'に変える', x: r2});
  const r3 = take(y => Math.abs(y.L.wv - F.wv) >= 1 && y.L.main === F.main) || take(y => Math.abs(y.L.wv - F.wv) >= 2);
  if (r3) steps.push({c: F.wv >= 1 ? '波動を弱くする' : '波動を強くする',
    d: 'スレている、または気づかれていないと感じた時', why: r3.L.a[1] + '（' + WAVE[r3.L.wv] + '）に変える', x: r3});
  const r4 = take(y => !y.L.fam.some(f => F.fam.includes(f)));
  if (r4) steps.push({c: 'カラーの系統を変える',
    d: 'レンジもシルエットも合っているはずなのに出ない時', why: F.fam[0] + ' から ' + r4.L.fam[0] + ' へ', x: r4});

  rotEl.innerHTML = steps.map((s, i) =>
    '<li><div class="chg">' + ['①','②','③','④'][i] + ' ' + esc(s.c) + '</div>' +
    '<div class="meta">' + esc(s.d) + '</div>' +
    '<div class="nextlure">→ <b>' + esc(s.x.L.n) + '</b><span class="meta">　' + esc(s.x.L.c) + '　' + RANGE[s.x.L.main] + '</span></div>' +
    '<div class="meta">' + esc(s.why) + '</div></li>').join('') +
    '<li class="meta">ルアーを替える前に、引く速さとコース（流れの上・横切り・下）を変えるのも一手です。</li>';
}
build();
render();

// BOX一覧（手持ちの確認用）
(function(){
  const el = document.getElementById('boxlist'); if (!el) return;
  const names = ['表層','シャロー','中層','ボトム'];
  el.innerHTML = '<div class="card">' + names.map((nm, r) => {
    const xs = LURES.filter(L => L.main === r);
    if (!xs.length) return '';
    return '<div class="sub">' + nm + '（' + xs.length + '本）</div><ul class="flow">' +
      xs.map(L => '<li><span class="fk" style="min-width:12em">' + esc(L.n) + '</span><span>' + esc(L.c) + (L.wt ? '　' + esc(L.wt) : '') + '</span></li>').join('') + '</ul>';
  }).join('') + '<div class="meta" style="margin-top:8px">合計 ' + LURES.length + ' 本。ここにあるルアーだけが、判定の候補です。</div></div>';
})();

// ===== 潮汐（新潟西港の推算潮位）。tide.js が無くても本体は動く =====
function tideInfo(now){
  if (typeof TIDE_DATA === 'undefined') return null;
  const pad = n => String(n).padStart(2, '0');
  const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = TIDE_DATA.days[key(now)];
  if (!today) return {out: true};
  const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1);
  const next = TIDE_DATA.days[key(tmr)];
  const hh = now.getHours(), mm = now.getMinutes();
  const a = today.h[hh];
  const b = hh < 23 ? today.h[hh + 1] : (next ? next.h[0] : a);
  const level = Math.round(a + (b - a) * mm / 60);
  const prev = hh > 0 ? today.h[hh - 1] : a;
  const slope = (b - prev) / 2;               // cm/時（前後1時間の平均）
  let state = 2;                               // 0上げ 1下げ 2止まり付近
  if (slope >= 1.5) state = 0; else if (slope <= -1.5) state = 1;
  const range = Math.max(...today.h) - Math.min(...today.h);
  return {today, next, level, slope, state, range, hh, mm};
}
function tideSvg(h, hh, mm){
  const W = 300, H = 70, mn = Math.min(...h) - 2, mx = Math.max(...h) + 2;
  const x = i => i / 23 * W, y = v => H - (v - mn) / (mx - mn) * H;
  const pts = h.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const nx = x(hh + mm / 60).toFixed(1);
  return '<svg viewBox="0 0 ' + W + ' ' + (H + 14) + '" style="width:100%;max-width:420px;display:block;margin-top:6px" role="img" aria-label="今日の潮位グラフ">' +
    '<polyline points="' + pts + '" fill="none" stroke="var(--good)" stroke-width="2"/>' +
    '<line x1="' + nx + '" y1="0" x2="' + nx + '" y2="' + H + '" stroke="var(--accent)" stroke-width="2"/>' +
    [0, 6, 12, 18, 23].map(i => '<text x="' + Math.min(x(i), W - 12).toFixed(1) + '" y="' + (H + 12) + '" font-size="10" fill="var(--sub)">' + i + '時</text>').join('') +
    '</svg>';
}
function renderTide(){
  const el = document.getElementById('tidebox'); if (!el) return;
  const t = tideInfo(new Date());
  if (!t){ el.innerHTML = ''; return; }
  if (t.out){
    el.innerHTML = '<div class="panel"><p class="ph">🌊 潮汐（' + esc(TIDE_DATA.short || TIDE_DATA.station) + '）</p><p class="meta" style="margin-bottom:12px">潮汐データの期間外です（' +
      esc(TIDE_DATA.from) + '〜' + esc(TIDE_DATA.to) + '）。tide.js の更新が必要です。</p></div>';
    return;
  }
  const fmt = arr => arr.length ? arr.map(s => { const [tm, cm] = s.split('/'); return tm + '（' + cm + 'cm）'; }).join('　') : 'なし';
  const STATE = ['上げ潮', '下げ潮', '潮止まり付近'];
  el.innerHTML = '<div class="panel"><p class="ph">🌊 潮汐（' + esc(TIDE_DATA.short || TIDE_DATA.station) + '・予測値）</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline">' +
      '<div><span class="meta">今の潮位</span> <b style="font-size:20px">' + t.level + 'cm</b></div>' +
      '<div><span class="meta">潮の動き</span> <b style="font-size:18px;color:var(--accent)">' + STATE[t.state] + '</b></div>' +
      '<div class="meta">今日の潮位差 ' + t.range + 'cm</div>' +
    '</div>' +
    tideSvg(t.today.h, t.hh, t.mm) +
    '<div class="kv"><div><span class="k">満潮</span><span>' + fmt(t.today.hi) + '</span></div>' +
    '<div><span class="k">干潮</span><span>' + fmt(t.today.lo) + '</span></div>' +
    (t.next ? '<div><span class="k">明日の満潮</span><span>' + fmt(t.next.hi) + '</span></div><div><span class="k">明日の干潮</span><span>' + fmt(t.next.lo) + '</span></div>' : '') +
    '</div>' +
    '<button class="reset" id="useTide" type="button" style="margin-top:8px">この潮（' + STATE[t.state].replace('付近','') + '）を条件に使う</button>' +
    '<p class="meta" style="margin:4px 0 12px">気象庁の新潟西港・新潟東港の予測値を平均した目安で、実測ではありません。新潟は潮位差が数十cmと小さく、河口の流れは川の流量・雨・放流の影響の方が大きいことが多いです。</p></div>';
  document.getElementById('useTide').onclick = () => { tide = t.state; build(); render(); };
}
renderTide();
setInterval(renderTide, 10 * 60 * 1000);
