'use strict';
/* =====================================================================
 * MODULE 2 — HABIT TRACKER (Theo dõi thói quen)
 * 12 thói quen · lưới ngày 1–31 chia 5 tuần · thống kê & biểu đồ real-time
 * ===================================================================== */

const Habits = {
  key(y, m) { return `${y}-${pad(m)}`; },

  /** Lấy (hoặc tạo) dữ liệu tháng. Tháng mới kế thừa tên thói quen của tháng gần nhất trước đó. */
  ensure(y, m) {
    const H = S().habits, k = this.key(y, m);
    if (!H.months[k]) {
      const keys = Object.keys(H.months).sort();
      const prev = keys.filter(x => x < k);
      const src = H.months[prev[prev.length - 1]] || H.months[keys[0]];
      H.months[k] = {
        names: Array.from({ length: HABIT_ROWS }, (_, i) => (src && src.names && src.names[i]) || ''),
        checks: Array.from({ length: HABIT_ROWS }, () => []),
      };
    }
    const M = H.months[k];
    M.names = Array.from({ length: HABIT_ROWS }, (_, i) => String((M.names || [])[i] ?? ''));
    M.checks = Array.from({ length: HABIT_ROWS }, (_, i) => {
      const arr = Array.isArray((M.checks || [])[i]) ? M.checks[i] : [];
      return [...new Set(arr.map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 31))];
    });
    return M;
  },
  /** Chỉ đọc — không tạo tháng mới */
  peek(y, m) { return S().habits.months[this.key(y, m)] ? this.ensure(y, m) : null; },

  /** 5 tuần cố định: 1–7, 8–14, 15–21, 22–28, 29–hết tháng */
  weeks(y, m) {
    const n = D.dim(y, m);
    return [0, 1, 2, 3, 4].map(w => {
      const s = w * 7 + 1, e = Math.min(n, s + 6);
      return s <= n ? { w, s, e, empty: false } : { w, s, e: s - 1, empty: true };
    });
  },

  compute(M, y, m) {
    const n = D.dim(y, m);
    const sets = M.checks.map(arr => new Set(arr.filter(d => d >= 1 && d <= n)));
    const active = M.names.map((nm, i) => nm.trim() !== '' || sets[i].size > 0);
    const A = active.filter(Boolean).length;
    const rows = sets.map(s => ({ count: s.size, pct: percent(s.size, n) }));
    const dayCount = [];
    for (let d = 1; d <= n; d++) {
      let c = 0;
      for (let i = 0; i < HABIT_ROWS; i++) if (active[i] && sets[i].has(d)) c++;
      dayCount.push(c);
    }
    const dayPct = dayCount.map(c => percent(c, A));
    const weeks = this.weeks(y, m).map(wk => {
      if (wk.empty) return { ...wk, count: 0, cap: 0, pct: 0 };
      let c = 0;
      for (let d = wk.s; d <= wk.e; d++) c += dayCount[d - 1];
      const cap = A * (wk.e - wk.s + 1);
      return { ...wk, count: c, cap, pct: percent(c, cap) };
    });
    const total = dayCount.reduce((a, b) => a + b, 0);
    const cap = A * n;
    let run = 0;
    const cumulative = dayCount.map((c, i) => { run += c; return percent(run, A * (i + 1)); });
    const perfect = A ? dayPct.filter(p => p === 100).length : 0;
    let best = -1;
    rows.forEach((r, i) => { if (active[i] && r.count > 0 && (best < 0 || r.count > rows[best].count)) best = i; });
    return { n, A, active, rows, dayCount, dayPct, weeks, total, cap, pct: percent(total, cap), cumulative, perfect, best };
  },

  /* ------------------------------ Render ------------------------------ */
  render() {
    const el = $('#view-habits');
    const H = S().habits, y = H.year, m = H.month;
    const M = this.ensure(y, m), k = this.key(y, m), n = D.dim(y, m);
    const today = D.today();
    const wks = this.weeks(y, m);
    const weekOf = d => Math.min(4, Math.floor((d - 1) / 7));
    const yNow = new Date().getFullYear();
    const years = [];
    for (let v = Math.min(y, yNow) - 3; v <= Math.max(y, yNow) + 3; v++) years.push(v);

    const controls = `
      <div class="seg">
        <button class="icon-btn" data-action="habit-step" data-dir="-1" title="Tháng trước">${icon('chevL')}</button>
        <select class="sel" data-path="habits.month" data-num aria-label="Chọn tháng">${MONTH_NAMES.map((nm, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${nm}</option>`).join('')}</select>
        <select class="sel" data-path="habits.year" data-num aria-label="Chọn năm">${years.map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="icon-btn" data-action="habit-step" data-dir="1" title="Tháng sau">${icon('chevR')}</button>
      </div>
      <button class="btn btn-soft" data-action="habit-now">${icon('calendar')} Tháng này</button>`;

    const days = Array.from({ length: n }, (_, i) => i + 1);
    const dayMeta = days.map(d => {
      const date = new Date(y, m - 1, d), iso = D.iso(date);
      return { d, wd: D.wdIndex(date), iso, today: iso === today, future: iso > today, w: weekOf(d), start: d > 1 && (d - 1) % 7 === 0 };
    });

    const stat = (id, label, ic, th, sm = false) => `
      <div class="stat-card" style="--accent:${th.accent};--soft:${th.soft};--light:${th.light}">
        <div class="icon-tile">${icon(ic)}</div>
        <div class="relative z-[1] min-w-0 flex-1"><div class="stat-label">${label}</div>
          <div class="stat-value ${sm ? 'sm' : ''}" id="${id}">—</div><div class="stat-sub" id="${id}-sub"></div></div>
      </div>`;

    el.innerHTML = `
      ${viewHeader('Sheet 02 · Habit Tracker', 'Theo dõi thói quen', `Tháng ${m}/${y} · ${n} ngày — bấm vào ô để đánh dấu hoàn thành, bấm lại để bỏ.`, controls)}

      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 mb-6">
        ${stat('hs-pct', 'Hoàn thành cả tháng', 'checkCircle', PALETTE[0])}
        ${stat('hs-total', 'Tổng lượt đạt', 'repeat', PALETTE[1])}
        ${stat('hs-best', 'Thói quen tốt nhất', 'star', PALETTE[2], true)}
        ${stat('hs-perfect', 'Ngày đạt 100%', 'sparkles', PALETTE[4])}
      </div>

      <div class="card mb-6 overflow-hidden">
        <div class="card-head px-5 pt-5 mb-2">
          <div class="card-title">${icon('repeat')} Bảng theo dõi tháng ${m}/${y}</div>
          <div class="legend">${wks.filter(w => !w.empty).map(w => `<span class="legend-item"><i style="background:${PALETTE[w.w].accent}"></i>Tuần ${w.w + 1}</span>`).join('')}</div>
        </div>
        <div class="habit-scroll">
          <table class="habit-table">
            <thead>
              <tr>
                <th class="sticky-col h-name-head" rowspan="2">Thói quen</th>
                ${wks.filter(w => !w.empty).map(w => `<th class="wk-head ${w.w ? 'wk-start' : ''}" colspan="${w.e - w.s + 1}" style="--wk:${PALETTE[w.w].accent};--wks:${PALETTE[w.w].soft}"><div>Tuần ${w.w + 1}</div></th>`).join('')}
                <th class="stat-head wk-start" rowspan="2">Đạt</th>
                <th class="stat-head" rowspan="2">% tháng</th>
              </tr>
              <tr>${dayMeta.map(x => `<th class="dh ${x.wd === 6 ? 'sun' : ''} ${x.today ? 'today' : ''} ${x.start ? 'wk-start' : ''}"><span>${x.d}</span><small>${WD_SHORT[x.wd]}</small></th>`).join('')}</tr>
            </thead>
            <tbody>
              ${M.names.map((nm, i) => `
              <tr id="hr-${i}">
                <td class="sticky-col"><div class="h-name"><span class="h-idx">${i + 1}</span>
                  <input class="ghost-input" data-path="habits.months.${k}.names.${i}" value="${esc(nm)}" placeholder="Thói quen ${i + 1}..."></div></td>
                ${dayMeta.map(x => `<td class="${x.start ? 'wk-start' : ''}"><button class="hcell ${M.checks[i].includes(x.d) ? 'on' : ''} ${x.today ? 'today' : ''} ${x.future ? 'future' : ''}" style="--wk:${PALETTE[x.w].accent}" data-action="habit-toggle" data-h="${i}" data-d="${x.d}" title="${esc(nm || 'Thói quen ' + (i + 1))} · ${WD_SHORT[x.wd]} ${pad(x.d)}/${pad(m)}" aria-label="Ngày ${x.d}"></button></td>`).join('')}
                <td class="stat-cell wk-start" id="hr-count-${i}">0</td>
                <td><div class="mini-pct"><span id="hr-pct-${i}">0%</span><div class="progress thin"><div class="bar" id="hr-bar-${i}"></div></div></div></td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td class="sticky-col foot-label">Số thói quen đạt</td>${dayMeta.map(x => `<td class="${x.start ? 'wk-start' : ''}" id="hd-count-${x.d}"></td>`).join('')}<td class="wk-start stat-cell" colspan="2" id="hm-total"></td></tr>
              <tr><td class="sticky-col foot-label">% theo ngày</td>${dayMeta.map(x => `<td class="${x.start ? 'wk-start' : ''}"><span class="dpct" id="hd-pct-${x.d}"></span></td>`).join('')}<td class="wk-start" colspan="2"></td></tr>
              <tr><td class="sticky-col foot-label">% theo tuần</td>${wks.filter(w => !w.empty).map(w => `<td colspan="${w.e - w.s + 1}" class="${w.w ? 'wk-start' : ''}"><div class="wk-pct" style="--wk:${PALETTE[w.w].accent}"><b id="hw-pct-${w.w}">0%</b><div class="progress thin mt-1"><div class="bar" id="hw-bar-${w.w}"></div></div></div></td>`).join('')}<td class="wk-start" colspan="2"><b class="text-base" id="hm-pct" style="color:var(--primary-2)">0%</b></td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('chart')} Xu hướng tháng</div><span class="text-sm muted">Tỷ lệ hoàn thành lũy kế</span></div>
          <div class="chart-box h-64"><canvas id="habitArea"></canvas></div>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('chart')} % hoàn thành theo ngày</div><span class="text-sm muted">Mỗi cột = 1 ngày</span></div>
          <div class="chart-box h-64"><canvas id="habitBar"></canvas></div>
        </div>
      </div>

      <div class="card p-5">
        <div class="card-head"><div class="card-title">${icon('target')} Tỷ lệ hoàn thành theo tuần</div></div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          ${wks.map(w => `
          <div class="wk-donut" style="--accent:${PALETTE[w.w].accent};--soft:${PALETTE[w.w].soft}">
            <div class="chart-box h-32"><canvas id="habitWk${w.w}"></canvas><div class="donut-center"><b id="hw-dpct-${w.w}">${w.empty ? '—' : '0%'}</b></div></div>
            <div class="wk-label">Tuần ${w.w + 1}</div>
            <div class="wk-range">${w.empty ? 'Không có ngày' : `${pad(w.s)}–${pad(w.e)}/${pad(m)}`}</div>
          </div>`).join('')}
        </div>
      </div>`;

    const r = this.compute(M, y, m);
    this.drawCharts(r, y, m);
    this.refresh();
  },

  /* ------------------------------ Biểu đồ ------------------------------ */
  maskFuture(arr, y, m) {
    const today = D.today();
    return arr.map((v, i) => (D.iso(new Date(y, m - 1, i + 1)) > today ? null : v));
  },
  barColors(vals) { return vals.map(v => (v >= 80 ? '#4F86F0' : v >= 50 ? '#8DB4FF' : v > 0 ? '#C6D9FF' : '#E6EEFB')); },

  drawCharts(r, y, m) {
    const labels = Array.from({ length: r.n }, (_, i) => i + 1);
    const pctAxis = { min: 0, max: 100, ticks: { stepSize: 25, callback: v => v + '%' }, grid: GRID, border: { display: false } };
    const xAxis = { grid: { display: false }, border: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 16, maxRotation: 0 } };
    Charts.make('habitArea', $('#habitArea'), {
      type: 'line',
      data: { labels, datasets: [{ data: this.maskFuture(r.cumulative, y, m), fill: true, tension: 0.4, borderColor: '#4F86F0', borderWidth: 2.5, backgroundColor: areaGradient('79,134,240', 0.34, 0.02), pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: '#fff', pointHoverBorderWidth: 2, spanGaps: false }] },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { y: pctAxis, x: xAxis },
        plugins: { tooltip: { callbacks: { title: c => `Đến ngày ${c[0].label}/${m}`, label: c => `Lũy kế: ${c.parsed.y}%` } } },
      },
    });
    Charts.make('habitBar', $('#habitBar'), {
      type: 'bar',
      data: { labels, datasets: [{ data: r.dayPct, backgroundColor: this.barColors(r.dayPct), borderRadius: 6, borderSkipped: false, maxBarThickness: 18 }] },
      options: {
        scales: { y: pctAxis, x: xAxis },
        plugins: { tooltip: { callbacks: { title: c => `Ngày ${c[0].label}/${m}`, label: c => `${c.parsed.y}% · ${this._last ? this._last.dayCount[c.dataIndex] : 0}/${this._last ? this._last.A : 0} thói quen` } } },
      },
    });
    r.weeks.forEach(w => {
      Charts.make('habitWk' + w.w, $(`#habitWk${w.w}`), {
        type: 'doughnut',
        data: { datasets: [{ data: w.empty ? [0, 1] : [w.pct, 100 - w.pct], backgroundColor: [PALETTE[w.w].accent, 'rgba(255,255,255,.95)'], borderWidth: 0, borderRadius: 6 }] },
        options: { cutout: '74%', plugins: { tooltip: { enabled: false } } },
      });
    });
  },

  updateCharts(r, y, m) {
    const area = Charts.get('habitArea');
    if (area) { area.data.datasets[0].data = this.maskFuture(r.cumulative, y, m); area.update(); }
    const bar = Charts.get('habitBar');
    if (bar) { bar.data.datasets[0].data = r.dayPct; bar.data.datasets[0].backgroundColor = this.barColors(r.dayPct); bar.update(); }
    r.weeks.forEach(w => {
      const c = Charts.get('habitWk' + w.w);
      if (c) { c.data.datasets[0].data = w.empty ? [0, 1] : [w.pct, 100 - w.pct]; c.update(); }
    });
  },

  /* ------------------------------ Cập nhật trực tiếp ------------------------------ */
  refresh() {
    if (!$('#hm-pct')) return;
    const H = S().habits, y = H.year, m = H.month;
    const M = this.ensure(y, m);
    const r = this.compute(M, y, m);
    this._last = r;
    r.rows.forEach((row, i) => {
      setText(`#hr-count-${i}`, row.count);
      setText(`#hr-pct-${i}`, row.pct + '%');
      setBar($(`#hr-bar-${i}`), row.pct);
      $(`#hr-${i}`)?.classList.toggle('inactive', !r.active[i]);
    });
    for (let d = 1; d <= r.n; d++) {
      setText(`#hd-count-${d}`, r.A ? r.dayCount[d - 1] : '');
      const el = $(`#hd-pct-${d}`);
      if (el) {
        const p = r.dayPct[d - 1];
        el.textContent = r.A ? p : '';
        el.style.background = r.A ? `rgba(79,134,240,${((p / 100) * 0.42).toFixed(3)})` : 'transparent';
        el.style.color = p >= 75 ? '#1B3E91' : '';
      }
    }
    r.weeks.forEach(w => {
      setText(`#hw-pct-${w.w}`, w.pct + '%');
      setBar($(`#hw-bar-${w.w}`), w.pct);
      setText(`#hw-dpct-${w.w}`, w.empty ? '—' : w.pct + '%');
    });
    setText('#hm-pct', r.pct + '%');
    setText('#hm-total', `${r.total}/${r.cap}`);
    setText('#hs-pct', r.pct + '%');
    setText('#hs-pct-sub', r.A ? `${r.A} thói quen đang theo dõi` : 'Hãy đặt tên cho thói quen đầu tiên');
    setText('#hs-total', r.total);
    setText('#hs-total-sub', `trên ${r.cap} lượt có thể`);
    setText('#hs-best', r.best >= 0 ? (M.names[r.best].trim() || `Thói quen ${r.best + 1}`) : '—');
    setText('#hs-best-sub', r.best >= 0 ? `${r.rows[r.best].count} ngày · ${r.rows[r.best].pct}% tháng` : 'Chưa có dữ liệu');
    setText('#hs-perfect', r.perfect);
    setText('#hs-perfect-sub', `trên ${r.n} ngày của tháng`);
    this.updateCharts(r, y, m);
  },
  refreshSoon() { clearTimeout(this._rt); this._rt = setTimeout(() => this.refresh(), 250); },

  onChange(path) {
    if (path === 'habits.month' || path === 'habits.year') { this.render(); return; }
    if (/\.names\.\d+$/.test(path)) this.refreshSoon();
  },
};

/* ------------------------------ Hành động ------------------------------ */
Actions['habit-toggle'] = el => {
  const H = S().habits;
  const M = Habits.ensure(H.year, H.month);
  const h = +el.dataset.h, d = +el.dataset.d;
  const arr = M.checks[h];
  const idx = arr.indexOf(d);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(d);
  el.classList.toggle('on', idx < 0);
  Store.save();
  Habits.refresh();
};
Actions['habit-step'] = el => {
  const H = S().habits;
  const d = new Date(H.year, H.month - 1 + Number(el.dataset.dir), 1);
  H.year = d.getFullYear(); H.month = d.getMonth() + 1;
  Store.save(); Habits.render();
};
Actions['habit-now'] = () => {
  const now = new Date();
  S().habits.year = now.getFullYear(); S().habits.month = now.getMonth() + 1;
  Store.save(); Habits.render();
};
