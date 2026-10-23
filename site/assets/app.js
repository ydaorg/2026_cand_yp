(function () {
  'use strict';
  const D = ['emp', 'edu', 'house', 'health', 'partic', 'family', 'incl', 'global', 'climate'];
  const MAX = D.length * 4;
  const COUNTY_ORDER = ['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
  const ICONS = {
    emp: '<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16"/>',
    edu: '<path d="M3 9l9-4 9 4-9 4-9-4zM7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4"/>',
    house: '<path d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5"/>',
    health: '<path d="M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19z"/>',
    partic: '<path d="M5 6h14v9H10l-4 3v-3H5zM9 10h6"/>',
    family: '<circle cx="8" cy="7" r="2.2"/><circle cx="16" cy="9" r="1.8"/><path d="M4 19v-4a4 4 0 0 1 8 0v4M13 19v-3a3 3 0 0 1 6 0v3"/>',
    incl: '<path d="M12 4v16M5 8h14M5 8l-2.5 6h5zM19 8l-2.5 6h5z"/>',
    global: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
    climate: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  };
  const SHORTN = { emp: '就業', edu: '教育技能', house: '居住', health: '身心健康', partic: '參與治理', family: '成家照顧', incl: '平等包容', global: '國際交流', climate: '氣候' };
  const PARTY_COLOR = { '民主進步黨': 'var(--p-dpp)', '中國國民黨': 'var(--p-kmt)', '台灣民眾黨': 'var(--p-tpp)', '台灣團結聯盟': 'var(--p-tsu)', '無黨籍': 'var(--p-ind)' };
  const DASHES = ['', '7 4', '2 3'];
  const partyStyle = (list) => { const seen = {}; return list.map((c) => { const n = seen[c.party] = (seen[c.party] || 0) + 1; return { color: PARTY_COLOR[c.party] || 'var(--p-other)', dash: DASHES[(n - 1) % DASHES.length] }; }); };
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const short = (n) => String(n).slice(0, 2);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('yp-state') || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem('yp-state', JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  let DATA = null;
  const saved = store.get();
  const state = { county: saved.county || '', focus: saved.focus || '', q: '', open: new Set(), cmp: saved.cmp || '' };
  const persist = () => store.set({ county: state.county, focus: state.focus, cmp: state.cmp });

  const total = (c) => Math.round(D.reduce((s, k) => s + Number(c[k]), 0) / MAX * 100);
  const points = (c) => D.reduce((s, k) => s + Number(c[k]), 0);
  const weighted = (c, w) => {
    const den = D.reduce((s, k) => s + 4 * Number(w['w_' + k]), 0);
    return Math.round(D.reduce((s, k) => s + Number(c[k]) * Number(w['w_' + k]), 0) / den * 100);
  };
  const focusW = () => DATA.weights.find((w) => w.focus === state.focus) || null;
  const hotSet = () => { const w = focusW(); return new Set(w ? D.filter((k) => Number(w['w_' + k]) > 1) : []); };

  async function load() {
    document.body.classList.add('loading');
    const names = ['candidates', 'dimensions', 'unscored', 'weights', 'frameworks', 'meta'];
    try {
      const res = await Promise.all(names.map((n) => fetch('data/' + n + '.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); })));
      DATA = Object.fromEntries(names.map((n, i) => [n, res[i]]));
      DATA.dimensions.sort((a, b) => Number(a.order) - Number(b.order));
      DATA.candidates.forEach((c) => { c._total = total(c); c._points = points(c); });
      document.body.classList.remove('loading');
      init();
    } catch (err) {
      const p = el('p', 'empty', '資料載入失敗，請重新整理頁面。若持續發生，請確認 data 資料夾已一併部署。');
      $('#list').replaceWith(p);
      console.error(err);
    }
  }

  function init() {
    const m = DATA.meta;
    $('#updated').textContent = m.updated.slice(5).replace('-', '/');
    $('#version').textContent = m.version;
    $('#bulletin-note').textContent = `${m.election}。${m.bulletin}。`;
    const log = $('#log');
    m.changelog.forEach((x) => { const li = el('li'); const t = el('time', null, x.date); t.dateTime = x.date; li.append(t, document.createTextNode(x.text)); log.append(li); });
    if (m.repo) { const a = el('a', null, '原始碼與資料（GitHub）'); a.href = m.repo; a.rel = 'noopener'; $('#foot-repo').append(a, document.createTextNode('・發現錯誤歡迎回報。')); }

    const counties = COUNTY_ORDER.filter((c) => DATA.candidates.some((x) => x.county === c) || DATA.unscored.some((x) => x.county === c));
    const fc = $('#f-county');
    fc.append(new Option('全部縣市', ''), ...counties.map((c) => new Option(c, c)));
    fc.value = state.county;
    fc.addEventListener('change', () => { state.county = fc.value; if (fc.value) state.cmp = fc.value; persist(); renderAll(); });
    const cc = $('#c-county');
    cc.append(...counties.map((c) => new Option(c, c)));
    cc.addEventListener('change', () => { state.cmp = cc.value; persist(); renderCompare(); });
    $('#f-q').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderList(); });

    renderKpis();
    renderIndicators();
    renderWeightsTable();
    initUnscoredFilters(counties);
    document.querySelectorAll('.grp-ctl .chip').forEach((b) => b.addEventListener('click', () => { grpBy = b.dataset.grp; renderGroups(); }));
    renderUnscored();
    renderAll();
    const h = location.hash.slice(1);
    if (h && document.getElementById(h)) setTimeout(() => document.getElementById(h).scrollIntoView(), 80);
  }

  function renderAll() {
    renderChips();
    renderList();
    renderCompare();
    renderGaps();
    renderGroups();
    renderUnscored();
  }

  function renderKpis() {
    const c = DATA.candidates;
    $('#k-total').textContent = c.length + DATA.unscored.length;
    $('#k-scored').textContent = c.length;
    $('#k-avg').textContent = Math.round(c.reduce((s, x) => s + x._total, 0) / c.length);
    const avg = dimAverages().slice().sort((a, b) => a.avg - b.avg);
    $('#k-low').textContent = `${SHORTN[avg[0].key]}、${SHORTN[avg[1].key]}`;
  }

  function dimAverages() {
    const c = DATA.candidates;
    return DATA.dimensions.map((d) => ({ key: d.key, name: d.name, avg: c.reduce((s, x) => s + Number(x[d.key]), 0) / c.length, zero: c.filter((x) => Number(x[d.key]) === 0).length }));
  }

  function renderChips() {
    const mk = (type, box) => {
      box.replaceChildren(...DATA.weights.filter((w) => w.type === type).map((w) => {
        const dim = DATA.dimensions.find((d) => d.name === w.focus);
        const b = el('button', 'chip', dim ? SHORTN[dim.key] : w.focus);
        b.type = 'button';
        b.title = w.note;
        b.setAttribute('aria-pressed', String(w.focus === state.focus));
        b.addEventListener('click', () => { state.focus = state.focus === w.focus ? '' : w.focus; persist(); renderAll(); });
        return b;
      }));
    };
    mk('身分', $('#f-who'));
    mk('議題', $('#f-issue'));
    const hint = $('#f-hint');
    const w = focusW();
    if (!w) { hint.textContent = '選一個身分或議題，排名會改用加權分數，並標出與你最相關的面向。'; return; }
    hint.replaceChildren();
    const parts = DATA.dimensions.filter((d) => Number(w['w_' + d.key]) > 1);
    hint.append(document.createTextNode(`「${w.focus}」加權：`));
    parts.forEach((d, i) => { hint.append(document.createTextNode(d.name + '×'), el('b', null, String(w['w_' + d.key])), document.createTextNode(i < parts.length - 1 ? '、' : '')); });
    hint.append(document.createTextNode('，其餘×1。'));
    const x = el('button', null, '取消');
    x.type = 'button';
    x.addEventListener('click', () => { state.focus = ''; persist(); renderAll(); });
    hint.append(x);
  }

  function parseEvidence(text) {
    if (!text) return [];
    return text.split(/；(?=【)/).map((seg) => {
      const m = seg.match(/^【(直接|隱含|延續)】(.*)$/);
      return m ? { tag: m[1], text: m[2] } : { tag: '', text: seg };
    });
  }
  const TAGCLS = { 直接: 'tg-d', 隱含: 'tg-i', 延續: 'tg-c' };

  function renderList() {
    const list = $('#list');
    const w = focusW();
    const hot = hotSet();
    $('#rank-title').textContent = w ? `加權分數：${w.focus}` : '青年政策總分';
    $('#rank-sub').textContent = w ? '紅色圓環是加權分數，右側小字是原始總分。點一位候選人展開逐項計分依據與來源。' : '九個面向各 0–4 分，加總換算為 0–100。點一位候選人展開逐項計分依據與來源。';
    let rows = DATA.candidates.map((c) => ({ c, score: w ? weighted(c, w) : c._total }));
    if (state.county) rows = rows.filter((r) => r.c.county === state.county);
    if (state.q) rows = rows.filter((r) => r.c.name.includes(state.q) || r.c.county.includes(state.q) || r.c.party.includes(state.q));
    rows.sort((a, b) => b.score - a.score || b.c._total - a.c._total || COUNTY_ORDER.indexOf(a.c.county) - COUNTY_ORDER.indexOf(b.c.county));
    $('#list-empty').hidden = rows.length > 0;
    list.replaceChildren(...rows.map((r, i) => item(r, i, w, hot)));
  }

  function item(r, i, w, hot) {
    const c = r.c;
    const li = el('li', 'item' + (state.open.has(c.id) ? ' open' : ''));
    li.id = 'c-' + c.id;
    const btn = el('button', 'row-btn');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(state.open.has(c.id)));
    btn.setAttribute('aria-controls', 'd-' + c.id);
    const n = el('span', 'rank-n', String(i + 1));
    const ring = el('span', 'ring' + (w ? ' w' : ''));
    ring.style.setProperty('--p', r.score);
    ring.append(el('span', null, String(r.score)));
    ring.setAttribute('aria-label', (w ? '加權分數 ' : '總分 ') + r.score);
    const who = el('span', 'who');
    const top = el('span', 'who-top');
    top.append(el('span', 'nm', c.name), el('span', 'meta', `${c.county}・${c.party}`));
    if (c.incumbent) top.append(el('span', 'inc', '現任'));
    const strip = el('span', 'strip');
    strip.setAttribute('aria-hidden', 'true');
    DATA.dimensions.forEach((d) => { const s = Number(c[d.key]); const x = el('i', 'c' + s + (hot.has(d.key) ? ' hot' : '')); x.title = `${d.name} ${s}/4`; strip.append(x); });
    who.append(top, strip);
    const right = el('span', 'base', w ? `總分 ${c._total}` : `${c._points}/${MAX}`);
    const wrapR = el('span');
    wrapR.style.display = 'flex'; wrapR.style.alignItems = 'center'; wrapR.style.gap = '10px';
    wrapR.append(right, el('span', 'chev'));
    btn.append(n, ring, who, wrapR);
    btn.addEventListener('click', () => {
      if (state.open.has(c.id)) state.open.delete(c.id); else state.open.add(c.id);
      const open = state.open.has(c.id);
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      const d = li.querySelector('.detail');
      if (open && !d) li.append(detail(c, hot)); else if (d) d.hidden = !open;
    });
    li.append(btn);
    if (state.open.has(c.id)) li.append(detail(c, hot));
    return li;
  }

  function detail(c, hot) {
    const box = el('div', 'detail');
    box.id = 'd-' + c.id;
    const side = el('div', 'd-side');
    const rb = el('div', 'radar-box');
    rb.append(radar([{ values: DATA.dimensions.map((d) => Number(c[d.key])), color: 'var(--s1)' }], hot, 280));
    const badges = el('div', 'badges');
    badges.append(el('span', 'badge', '公開程度 ' + c.completeness), el('span', 'badge', c.source_level.replace(/^[AB] /, '')));
    side.append(rb, badges);
    if (c.direct) { const p = el('p', 'note'); p.append(el('b', null, '青年政見：'), document.createTextNode(c.direct)); side.append(p); }

    const main = el('div', 'd-main');
    const evWrap = el('div');
    evWrap.append(el('h4', 'd-h', '逐項計分依據'));
    const ul = el('ul', 'ev');
    DATA.dimensions.forEach((d) => {
      const s = Number(c[d.key]);
      const li = el('li');
      li.append(el('span', 'dn' + (hot.has(d.key) ? ' hot' : ''), d.name));
      const sc = el('span', 'sc');
      sc.setAttribute('aria-label', `${s} 分`);
      for (let i = 0; i < 4; i++) sc.append(el('i', i < s ? 'on' : ''));
      li.append(sc);
      const tx = el('span', 'tx' + (s ? '' : ' none'));
      const segs = parseEvidence(c['ev_' + d.key]);
      if (!segs.length) tx.textContent = '未見相關政見';
      segs.forEach((g) => { const p = el('span', 'piece'); if (g.tag) p.append(el('span', 'tg ' + TAGCLS[g.tag], g.tag)); p.append(document.createTextNode(g.text)); tx.append(p); });
      li.append(tx);
      ul.append(li);
    });
    evWrap.append(ul);
    main.append(evWrap);
    if (c.impact) { const im = el('div'); im.append(el('h4', 'd-h', '對生活的意義'), el('p', 'impact', c.impact)); main.append(im); }
    if (c.not_counted) main.append(el('p', 'nc', '任內政策（不計分）：' + c.not_counted));
    const srcs = el('div');
    srcs.append(el('h4', 'd-h', '資料來源'));
    const sl = el('ul', 'srcs');
    [1, 2, 3, 4, 5, 6].forEach((i) => {
      const u = c['src' + i + '_url'], t = c['src' + i + '_title'];
      if (u && /^https:\/\//.test(u)) { const li = el('li'); const a = el('a', null, t || u); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); sl.append(li); }
    });
    srcs.append(sl);
    main.append(srcs);
    box.append(side, main);
    return box;
  }

  function radar(series, hot, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = size, H = size, cx = W / 2, cy = H / 2, r = W / 2 - 40, n = DATA.dimensions.length;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '九面向雷達圖');
    const ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / n;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * r * v / 4, cy + Math.sin(ang(i)) * r * v / 4];
    const add = (tag, attrs, cls) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (cls) e.setAttribute('class', cls); svg.append(e); return e; };
    [1, 2, 3, 4].forEach((lv) => add('polygon', { points: DATA.dimensions.map((d, i) => pt(i, lv).join(',')).join(' ') }, 'rd-grid'));
    DATA.dimensions.forEach((d, i) => {
      const [x2, y2] = pt(i, 4);
      add('line', { x1: cx, y1: cy, x2, y2 }, 'rd-axis');
      const [lx, ly] = pt(i, 4.7);
      const c = Math.cos(ang(i));
      const t = add('text', { x: lx, y: ly, dy: '0.35em', 'text-anchor': Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end' }, 'rd-lbl' + (hot.has(d.key) ? ' hot' : ''));
      t.textContent = short(d.name);
    });
    series.forEach((s) => {
      const pts = s.values.map((v, i) => pt(i, v));
      const poly = add('polygon', { points: pts.map((p) => p.join(',')).join(' '), 'stroke-width': 2.2, 'stroke-linejoin': 'round' });
      if (s.dash) poly.setAttribute('stroke-dasharray', s.dash);
      poly.style.fill = s.color; poly.style.fillOpacity = series.length > 1 ? '0.08' : '0.18'; poly.style.stroke = s.color;
      pts.forEach((p) => { const ci = add('circle', { cx: p[0], cy: p[1], r: 3 }); ci.style.fill = s.color; });
    });
    return svg;
  }

  function renderCompare() {
    const cmp = state.cmp || state.county || '臺北市';
    $('#c-county').value = cmp;
    const hot = hotSet();
    const list = DATA.candidates.filter((c) => c.county === cmp).sort((a, b) => b._total - a._total);
    const others = DATA.unscored.filter((u) => u.county === cmp);
    const box = $('#c-radar'), lg = $('#c-legend'), tb = $('#c-table');
    box.replaceChildren(); lg.replaceChildren(); tb.replaceChildren();
    if (!list.length) {
      box.append(el('p', 'empty', '此縣市的候選人目前都沒有可評分的具體青年政見。'));
    } else {
      const st = partyStyle(list);
      box.append(radar(list.map((c, i) => ({ values: DATA.dimensions.map((d) => Number(c[d.key])), color: st[i].color, dash: st[i].dash })), hot, 320));
      list.forEach((c, i) => { const s = el('span'); const k = el('i', st[i].dash ? 'dash' : ''); k.style.borderColor = st[i].color; s.append(k, document.createTextNode(c.name), el('small', null, c.party)); lg.append(s); });
      const thead = el('thead'); const hr = el('tr');
      hr.append(el('th', null, '面向'));
      list.forEach((c, i) => { const th = el('th', 'n'); const dot = el('i', 'pdot' + (st[i].dash ? ' dash' : '')); dot.style.borderColor = st[i].color; th.append(dot, document.createTextNode(c.name)); hr.append(th); });
      thead.append(hr);
      const tbody = el('tbody');
      DATA.dimensions.forEach((d) => {
        const tr = el('tr');
        tr.append(el('td', hot.has(d.key) ? 'hot' : '', d.name));
        const max = Math.max(...list.map((c) => Number(c[d.key])));
        list.forEach((c) => { const v = Number(c[d.key]); const td = el('td', 'n', String(v)); if (v === max && v > 0 && list.length > 1) td.style.fontWeight = '700'; tr.append(td); });
        tbody.append(tr);
      });
      const tr = el('tr'); tr.append(el('td', null, '總分'));
      list.forEach((c) => { const td = el('td', 'n', String(c._total)); td.style.fontWeight = '700'; tr.append(td); });
      tbody.append(tr);
      tb.append(thead, tbody);
    }
    $('#c-others').textContent = others.length ? '同選區尚未評分：' + others.map((u) => `${u.name}（${u.party}）`).join('、') : '';
  }

  function renderGaps() {
    const box = $('#gap-list');
    const avg = dimAverages();
    const low = new Set(avg.slice().sort((a, b) => a.avg - b.avg).slice(0, 2).map((d) => d.key));
    const hot = hotSet();
    box.replaceChildren(...avg.map((d) => {
      const row = el('div', 'gap' + (low.has(d.key) ? ' low' : ''));
      const nm = el('span', 'gap-n', d.name);
      nm.dataset.v = d.avg.toFixed(2);
      if (hot.has(d.key)) nm.style.textDecoration = 'underline';
      const bar = el('span', 'gap-bar'); const fill = el('i'); fill.style.width = (d.avg / 4 * 100) + '%'; bar.append(fill);
      bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `${d.name} 平均 ${d.avg.toFixed(2)} 分`);
      row.append(nm, bar, el('span', 'gap-v', d.avg.toFixed(2)), el('span', 'gap-z', `${d.zero} 人未提`));
      return row;
    }));
  }

  let grpBy = 'county';
  function renderGroups() {
    const w = focusW();
    const box = $('#grp-list');
    const keyOf = (x) => x[grpBy];
    const groups = new Map();
    DATA.candidates.forEach((c) => { const k = keyOf(c); if (!groups.has(k)) groups.set(k, { k, s: [], u: 0 }); groups.get(k).s.push(w ? weighted(c, w) : c._total); });
    DATA.unscored.forEach((u) => { const k = keyOf(u); if (!groups.has(k)) groups.set(k, { k, s: [], u: 0 }); groups.get(k).u += 1; });
    let rows = [...groups.values()].map((g) => ({ ...g, avg: g.s.length ? g.s.reduce((a, b) => a + b, 0) / g.s.length : null }));
    rows.sort((a, b) => grpBy === 'county' ? COUNTY_ORDER.indexOf(a.k) - COUNTY_ORDER.indexOf(b.k) : (b.avg ?? -1) - (a.avg ?? -1) || b.s.length - a.s.length);
    $('#grp-title').textContent = w ? `各縣市、政黨的平均分（加權：${w.focus}）` : '各縣市、政黨的平均分';
    $('#grp-note').textContent = '只計已評分的候選人，未評分者不列入平均；人數少的組別容易受單一候選人影響，僅供參考。';
    document.querySelectorAll('.grp-ctl .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.grp === grpBy)));
    box.replaceChildren(...rows.map((g) => {
      const row = el('div', 'gap');
      const v = g.avg == null ? '—' : String(Math.round(g.avg));
      const nm = el('span', 'gap-n', g.k);
      nm.dataset.v = v;
      if (grpBy === 'county' && state.county === g.k) nm.style.textDecoration = 'underline';
      const bar = el('span', 'gap-bar'); const fill = el('i'); fill.style.width = (g.avg || 0) + '%'; bar.append(fill);
      bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `${g.k} 平均 ${v} 分`);
      row.append(nm, bar, el('span', 'gap-v', v), el('span', 'gap-z', g.s.length ? `已評分 ${g.s.length} 人` + (g.u ? `・未評分 ${g.u}` : '') : `未評分 ${g.u} 人`));
      return row;
    }));
  }

  function renderIndicators() {
    $('#fw-grid').replaceChildren(...DATA.frameworks.map((f) => {
      const card = el('article', 'fw');
      card.append(el('span', 'fw-org', `${f.org}・${f.year}`), el('h4', null, f.name), el('p', null, f.what), el('p', 'fw-use', '本站如何使用：' + f.use));
      const a = el('a', null, '查看官方資料 ↗'); a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      card.append(a);
      return card;
    }));
    $('#dims').replaceChildren(...DATA.dimensions.map((d) => {
      const card = el('article', 'dim');
      const h = el('div', 'dim-h');
      const ico = el('span', 'dim-ico');
      ico.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.key] || ''}</svg>`;
      h.append(ico, el('h4', null, d.name));
      const dl = el('dl');
      [['計入', d.scope], ['國際對應', d.intl]].forEach(([k, v]) => { dl.append(el('dt', null, k), el('dd', null, v)); });
      card.append(h, el('p', 'life', d.life), dl);
      return card;
    }));
  }

  function renderWeightsTable() {
    const t = $('#w-table');
    const thead = el('thead'); const hr = el('tr');
    hr.append(el('th', null, '身分／議題'));
    DATA.dimensions.forEach((d) => { const th = el('th', 'n', short(d.name)); th.title = d.name; hr.append(th); });
    thead.append(hr);
    const tbody = el('tbody');
    DATA.weights.forEach((w) => {
      const tr = el('tr');
      tr.append(el('td', 'nmc', w.focus));
      DATA.dimensions.forEach((d) => { const v = Number(w['w_' + d.key]); tr.append(el('td', 'n' + (v > 1 ? ' on' : ''), String(v))); });
      tbody.append(tr);
    });
    t.replaceChildren(thead, tbody);
    $('#w-notes').replaceChildren(...DATA.weights.filter((w) => w.type === '身分').map((w) => { const li = el('li'); li.append(el('b', null, w.focus + '：'), document.createTextNode(w.note)); return li; }));
  }

  const uState = { county: '', party: '' };
  function initUnscoredFilters(counties) {
    const uc = $('#u-county'), up = $('#u-party');
    uc.append(new Option('全部縣市', ''), ...counties.filter((c) => DATA.unscored.some((u) => u.county === c)).map((c) => new Option(c, c)));
    const parties = [...new Set(DATA.unscored.map((u) => u.party))].sort((a, b) => DATA.unscored.filter((u) => u.party === b).length - DATA.unscored.filter((u) => u.party === a).length || a.localeCompare(b, 'zh-Hant'));
    up.append(new Option('全部政黨', ''), ...parties.map((p) => new Option(p, p)));
    uc.addEventListener('change', () => { uState.county = uc.value; renderUnscored(); });
    up.addEventListener('change', () => { uState.party = up.value; renderUnscored(); });
  }

  function renderUnscored() {
    const t = $('#u-table');
    const uc = $('#u-county');
    if (uc && [...uc.options].some((o) => o.value === state.county) && renderUnscored._lastMain !== state.county) { uState.county = state.county; uc.value = state.county; }
    renderUnscored._lastMain = state.county;
    let rows = DATA.unscored.slice();
    if (uState.county) rows = rows.filter((u) => u.county === uState.county);
    if (uState.party) rows = rows.filter((u) => u.party === uState.party);
    rows.sort((a, b) => COUNTY_ORDER.indexOf(a.county) - COUNTY_ORDER.indexOf(b.county));
    $('#u-count').textContent = `共 ${rows.length} 位`;
    const thead = el('thead'); const hr = el('tr');
    [['縣市', 'u-cty'], ['候選人', 'u-nm'], ['政黨', 'u-pt'], ['目前查得的情況', '']].forEach(([h, cls]) => hr.append(el('th', cls, h)));
    thead.append(hr);
    const tbody = el('tbody');
    rows.forEach((u) => { const tr = el('tr'); tr.append(el('td', 'u-cty', u.county), el('td', 'u-nm', u.name), el('td', 'u-pt', u.party), el('td', null, u.note)); tbody.append(tr); });
    if (!rows.length) { const tr = el('tr'); const td = el('td', null, '這個條件下沒有未評分的候選人。'); td.colSpan = 4; tr.append(td); tbody.append(tr); }
    t.replaceChildren(thead, tbody);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
