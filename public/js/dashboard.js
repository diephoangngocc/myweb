'use strict';
/* =====================================================================
 * TỔNG QUAN (Dashboard) — gom số liệu từ cả 4 sheet, bố cục giống ảnh mẫu
 * ===================================================================== */

const Dashboard = {
  tab: 'all',
  cal: null,

  today() {
    const now = new Date();
    const ws = D.iso(D.monday(now));
    const idx = D.wdIndex(now);
    const wk = Weekly.ensure(ws);
    return { now, ws, idx, day: wk.days[idx] };
  },

  habitDay(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1;
    const M = Habits.peek(y, m);
    if (!M) return { done: 0, total: 0, pct: 0 };
    const r = Habits.compute(M, y, m);
    const c = r.dayCount[date.getDate() - 1] || 0;
    return { done: c, total: r.A, pct: percent(c, r.A) };
  },

  /* ------------------------------ Render ------------------------------ */
  render() {
    const el = $('#view-dashboard');
    const st = S(), t = this.today(), cyc = App.cycle(), gs = Goals.stats();
    const h = t.now.getHours();
    const greet = h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const counts = STATUSES.map(s => gs.status[s.id] || 0);

    el.innerHTML = `
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
      <div class="space-y-6 min-w-0">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="greet">${greet}, <span id="greetName">${esc(st.profile.name.trim() || 'bạn')}</span>! <span class="wave">👋</span></h1>
            <p class="view-sub">Hôm nay là ${D.longVN(t.now)} · ${cyc.label}.</p>
          </div>
          <button class="btn btn-primary btn-lg" data-action="quick-task">${icon('plus')} Việc mới</button>
        </div>

        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4" id="dashStats">${this.statsHTML(t, gs)}</div>

        <div class="card p-5" id="dashTasks">${this.tasksHTML(t)}</div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="card p-5">
            <div class="card-head"><div class="card-title">${icon('chart')} Thói quen 7 ngày qua</div><a class="link" href="#habits">Chi tiết ${icon('chevR', 'w-4 h-4')}</a></div>
            <div class="chart-box h-56"><canvas id="dashLine"></canvas></div>
          </div>
          <div class="card p-5">
            <div class="card-head"><div class="card-title">${icon('target')} Mục tiêu theo trạng thái</div><a class="link" href="#goals">Chi tiết ${icon('chevR', 'w-4 h-4')}</a></div>
            <div class="flex flex-wrap items-center gap-6">
              <div class="chart-box w-44 h-44 shrink-0"><canvas id="dashDonut"></canvas>
                <div class="donut-center"><b>${gs.count}</b><span>mục tiêu</span></div></div>
              <div class="flex-1 min-w-[160px] space-y-3">
                ${STATUSES.map((s, i) => `<div class="legend-row"><i style="background:${s.chart}"></i>${s.name}<b>${counts[i]} <span class="muted font-normal">(${percent(counts[i], gs.count)}%)</span></b></div>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('layers')} Tiến độ theo lĩnh vực</div><a class="link" href="#goals">Mở Goal Planner ${icon('chevR', 'w-4 h-4')}</a></div>
          <div class="area-rings">${gs.areas.map(a => `
            <div class="area-ring" style="--accent:${a.accent};--soft:${a.soft}">
              ${ringHTML(a.pct, a.accent, 'lg')}
              <div class="area-ring-name">${a.name}</div>
              ${sparklineSVG(Goals.series(a.id, gs), a.accent, { w: 88, h: 22 })}
              <div class="text-xs muted">${a.count} mục tiêu</div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <aside class="space-y-6">
        <div class="card p-5" id="dashCal">${this.calHTML()}</div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('target')} Chu kỳ 90 ngày</div><b class="text-xl">${cyc.pct}%</b></div>
          <div class="progress green"><div class="bar" style="width:${cyc.pct}%"></div></div>
          <div class="text-sm muted mt-2">${cyc.short}</div>
          <div class="flex flex-wrap items-center gap-2 mt-3 text-sm">
            <span class="muted">Bắt đầu</span>
            <input type="date" class="date-input sm" data-path="profile.cycleStart" value="${st.profile.cycleStart}">
            <span class="muted">→ ${D.dmy(cyc.end)}</span>
          </div>
          <div class="divider"></div>
          <div class="flex justify-between text-sm"><span>Tiến độ mục tiêu</span><b>${gs.pct}%</b></div>
          <div class="progress mt-2"><div class="bar" style="width:${gs.pct}%"></div></div>
          <div class="text-xs muted mt-2">${gs.done}/${gs.total} bước hành động đã hoàn thành</div>
        </div>
        <div class="card p-5">${this.upcomingHTML()}</div>
        <div class="card p-5">${this.financeHTML()}</div>
      </aside>
    </div>`;

    this.drawCharts(gs);
  },

  statsHTML(t, gs) {
    const dp = Weekly.dayProgress(t.day), hd = this.habitDay(t.now);
    const items = [
      { label: 'Việc hôm nay', value: `${dp.done}/${dp.total}`, sub: dp.total ? `${dp.pct}% đã hoàn thành` : 'Chưa có việc nào', ic: 'checkCircle', th: PALETTE[0] },
      { label: 'Thói quen hôm nay', value: `${hd.done}/${hd.total}`, sub: hd.total ? `${hd.pct}% thói quen đã tick` : 'Chưa thiết lập thói quen', ic: 'repeat', th: PALETTE[1] },
      { label: 'Đang thực hiện', value: gs.status.doing || 0, sub: `trên ${gs.count} mục tiêu`, ic: 'hourglass', th: PALETTE[2] },
      { label: 'Quá hạn', value: gs.overdue, sub: gs.overdue ? 'mục tiêu cần chú ý' : 'Không có mục tiêu trễ hạn', ic: 'flag', th: PALETTE[3] },
    ];
    return items.map(it => `
      <div class="stat-card" style="--accent:${it.th.accent};--soft:${it.th.soft};--light:${it.th.light}">
        <div class="icon-tile">${icon(it.ic)}</div>
        <div class="relative z-[1] min-w-0"><div class="stat-label">${it.label}</div><div class="stat-value">${it.value}</div><div class="stat-sub">${it.sub}</div></div>
      </div>`).join('');
  },

  tasksHTML(t) {
    const base = `weekly.weeks.${t.ws}.days.${t.idx}`;
    const tasks = t.day.tasks.map((x, k) => ({ ...x, k })).filter(x => x.text.trim() || x.done);
    const done = tasks.filter(x => x.done), todo = tasks.filter(x => !x.done);
    const blocks = TIME_SLOTS.map(s => ({ s, ...(t.day.blocks[s] || {}) })).filter(b => (b.text || '').trim());
    const tabs = [['all', 'Tất cả', tasks.length], ['todo', 'Chưa xong', todo.length], ['done', 'Đã xong', done.length], ['sched', 'Lịch trình', blocks.length]];
    let body;
    if (this.tab === 'sched') {
      body = blocks.length ? blocks.map(b => {
        const tag = byId(TAGS, b.tag || '');
        return `<div class="sched-row" style="--tag:${tag.id ? tag.accent : '#C9D5EA'};--soft:${tag.id ? tag.soft : '#F5F8FE'}">
          <span class="tb-time">${b.s}</span><span class="truncate">${esc(b.text)}</span>${tag.id ? `<span class="chip" style="${chipStyle(tag)}">${tag.name}</span>` : '<span></span>'}</div>`;
      }).join('') : emptyHTML('Chưa có lịch trình (Time Blocking) cho hôm nay.', 'clock');
    } else {
      const list = this.tab === 'todo' ? todo : this.tab === 'done' ? done : tasks;
      body = list.length ? list.map(x => `
        <label class="dash-task ${x.done ? 'done' : ''}">
          <input type="checkbox" class="cbx round" data-path="${base}.tasks.${x.k}.done" ${x.done ? 'checked' : ''}>
          <span class="t-text">${esc(x.text.trim() || '(Chưa đặt tên)')}</span>
          <span class="chip" style="${chipStyle(x.done ? STATUSES[2] : STATUSES[1])}">${x.done ? 'Đã xong' : 'Đang chờ'}</span>
          <span class="t-date hidden sm:inline-flex">${icon('calendar', 'w-4 h-4')} ${D.dm(t.now)}</span>
        </label>`).join('')
        : emptyHTML(tasks.length ? 'Không có việc nào trong mục này.' : 'Chưa có việc nào cho hôm nay — bấm “Việc mới” để thêm.', 'list');
    }
    return `
      <div class="card-head"><div class="card-title">${icon('list')} Việc hôm nay · ${WD_FULL[t.idx]}</div>
        <a class="btn btn-soft btn-sm" href="#weekly">Mở kế hoạch tuần ${icon('chevR')}</a></div>
      ${t.day.priority.trim() ? `<div class="prio-banner">${icon('star', 'w-4 h-4')}<span>Ưu tiên số 1: <b>${esc(t.day.priority)}</b></span></div>` : ''}
      <div class="tabs">${tabs.map(([id, name, n]) => `<button class="tab ${this.tab === id ? 'active' : ''}" data-action="dash-tab" data-tab="${id}">${name}<span class="n">${n}</span></button>`).join('')}</div>
      <div>${body}</div>`;
  },

  calHTML() {
    const now = new Date();
    if (!this.cal) this.cal = { y: now.getFullYear(), m: now.getMonth() };
    const { y, m } = this.cal;
    const lead = D.wdIndex(new Date(y, m, 1)), n = D.dim(y, m + 1), prevN = D.dim(y, m);
    const map = Year.eventMap(), today = D.today();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += `<span class="cal-day other">${prevN - lead + 1 + i}</span>`;
    for (let d = 1; d <= n; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`, evs = map[iso] || [], wd = (lead + d - 1) % 7;
      const cat = evs.length ? byId(EVENT_CATS, evs[0].cat) : null;
      const tip = evs.length ? evs.map(e => '• ' + (e.title || '(Sự kiện)')).join('\n') : D.longVN(new Date(y, m, d));
      cells += `<button class="cal-day ${wd === 6 ? 'sun' : ''} ${iso === today ? 'today' : ''} ${evs.length ? 'has-ev' : ''}" ${cat ? `style="--dot:${cat.accent}"` : ''} title="${esc(tip)}" data-action="dash-day" data-date="${iso}">${d}</button>`;
    }
    const trail = (7 - ((lead + n) % 7)) % 7;
    for (let i = 1; i <= trail; i++) cells += `<span class="cal-day other">${i}</span>`;
    return `<div class="mcal">
      <div class="mcal-head"><div class="card-title">${icon('calendar')} ${MONTH_NAMES[m]}, ${y}</div>
        <div class="flex gap-1"><button class="icon-btn sm" data-action="dash-cal" data-dir="-1" title="Tháng trước">${icon('chevL')}</button><button class="icon-btn sm" data-action="dash-cal" data-dir="1" title="Tháng sau">${icon('chevR')}</button></div></div>
      <div class="cal-grid wd">${WD_SHORT.map((w, i) => `<span class="${i === 6 ? 'sun' : ''}">${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div></div>`;
  },

  upcomingHTML() {
    const today = D.today();
    const evs = S().year.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    return `<div class="card-head"><div class="card-title">${icon('calendarCheck')} Sự kiện sắp tới</div></div>
      ${evs.length ? evs.map(e => {
        const c = byId(EVENT_CATS, e.cat), d = D.diff(today, e.date);
        return `<div class="up-item" style="--accent:${c.accent};--soft:${c.soft}">
          <div class="up-ico">${icon('calendar')}</div>
          <div class="min-w-0 flex-1"><div class="up-title">${esc(e.title || '(Chưa đặt tên)')}</div><div class="up-date">${D.longVN(D.parse(e.date))}</div></div>
          <span class="chip" style="${chipStyle(c)}">${d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : `Còn ${d} ngày`}</span></div>`;
      }).join('') : emptyHTML('Chưa có sự kiện sắp tới.', 'calendar')}
      <a class="link mt-3" href="#year">Xem toàn năm ${icon('chevR', 'w-4 h-4')}</a>`;
  },

  financeHTML() {
    const k = Fin.curMonth(), tot = Fin.totals(S().finance.txs.filter(t => t.date.startsWith(k))), cash = Fin.cash();
    const bs = Fin.billsSummary(k), dm = Fin.debtsMonth(k);
    return `<div class="card-head"><div class="card-title">${icon('wallet')} Tài chính tháng này</div></div>
      <div class="mini-fin"><span>Thu nhập</span><b class="pos">${fmtMoney(tot.inc)}</b></div>
      <div class="mini-fin"><span>Chi tiêu</span><b class="negc">${fmtMoney(tot.exp)}</b></div>
      <div class="mini-fin"><span>Nợ còn lại</span><b>${fmtMoney(Fin.debtsTotal())}</b></div>
      ${dm.need ? `<div class="mini-fin"><span>Nợ cần trả tháng này</span><b>${fmtMoney(dm.need)}${dm.left ? ` <span class="negc">· còn ${fmtShort(dm.left)}</span>` : ' <span class="pos">✓</span>'}</b></div>` : ''}
      <div class="mini-fin"><span>Tiết kiệm</span><b>${fmtMoney(Fin.fundsTotal())}</b></div>
      ${bs.n ? `<div class="mini-fin"><span>Hoá đơn đã trả</span><b>${bs.nPaid}/${bs.n}${bs.overdue ? ` <span class="negc">· ${bs.overdue} quá hạn</span>` : ''}</b></div>` : ''}
      <div class="mini-fin total"><span>Số dư thực tế</span><b class="${cash < 0 ? 'negc' : ''}">${fmtMoney(cash)}</b></div>
      <a class="link mt-3" href="#finance">Mở Tài chính ${icon('chevR', 'w-4 h-4')}</a>`;
  },

  drawCharts(gs) {
    const days = Array.from({ length: 7 }, (_, i) => D.add(new Date(), i - 6));
    const info = days.map(d => this.habitDay(d));
    Charts.make('dashLine', $('#dashLine'), {
      type: 'line',
      data: {
        labels: days.map(d => [WD_SHORT[D.wdIndex(d)], D.dm(d)]),
        datasets: [{ data: info.map(x => x.pct), fill: true, tension: 0.42, borderColor: '#6C8EF5', borderWidth: 2.5, backgroundColor: areaGradient('108,142,245', 0.32, 0.02), pointBackgroundColor: '#fff', pointBorderColor: '#6C8EF5', pointBorderWidth: 2, pointRadius: days.map((_, i) => (i === 6 ? 6 : 4)), pointHoverRadius: 7 }],
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 25, callback: v => v + '%' }, grid: GRID, border: { display: false } },
          x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0 } },
        },
        plugins: { tooltip: { callbacks: { title: c => D.longVN(days[c[0].dataIndex]), label: c => `${c.parsed.y}% · ${info[c.dataIndex].done}/${info[c.dataIndex].total} thói quen` } } },
      },
    });
    const counts = STATUSES.map(s => gs.status[s.id] || 0), any = counts.some(Boolean);
    Charts.make('dashDonut', $('#dashDonut'), {
      type: 'doughnut',
      data: { labels: STATUSES.map(s => s.name), datasets: [{ data: any ? counts : [1], backgroundColor: any ? STATUSES.map(s => s.chart) : ['#E9EFFA'], borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }] },
      options: { cutout: '60%', plugins: { tooltip: { enabled: any } } },
    });
  },

  refresh() {
    const t = this.today(), gs = Goals.stats();
    const stats = $('#dashStats'); if (stats) stats.innerHTML = this.statsHTML(t, gs);
    const tasks = $('#dashTasks'); if (tasks) tasks.innerHTML = this.tasksHTML(t);
  },

  onChange() { this.refresh(); },
};

/* ------------------------------ Hành động ------------------------------ */
Actions['dash-tab'] = el => { Dashboard.tab = el.dataset.tab; const box = $('#dashTasks'); if (box) box.innerHTML = Dashboard.tasksHTML(Dashboard.today()); };
Actions['dash-cal'] = el => {
  const c = Dashboard.cal, d = new Date(c.y, c.m + Number(el.dataset.dir), 1);
  Dashboard.cal = { y: d.getFullYear(), m: d.getMonth() };
  const box = $('#dashCal'); if (box) box.innerHTML = Dashboard.calHTML();
};
Actions['dash-day'] = el => {
  const d = el.dataset.date;
  S().year.year = +d.slice(0, 4);
  Year.pendingDate = d;
  Store.save();
  App.go('year');
};
Actions['quick-task'] = async () => {
  const now = new Date(), ws = D.iso(D.monday(now)), start = D.parse(ws), ti = D.wdIndex(now);
  const opts = WD_FULL.map((w, i) => `<option value="${i}" ${i === ti ? 'selected' : ''}>${w} · ${D.dm(D.add(start, i))}${i === ti ? ' (hôm nay)' : ''}</option>`).join('');
  const r = await UI.modal({
    title: 'Thêm việc mới', icon: 'plus', okText: 'Thêm việc',
    bodyHTML: `<label>Nội dung công việc</label><input name="text" class="field-input" placeholder="VD: Hoàn thành slide thuyết trình">
      <label>Ngày trong tuần này</label><select name="day" class="field-input">${opts}</select>`,
  });
  if (!r) return;
  if (!r.text) { UI.toast('Bạn chưa nhập nội dung công việc', 'error'); return; }
  const day = Weekly.ensure(ws).days[+r.day];
  const slot = day.tasks.findIndex(t => !t.text.trim() && !t.done);
  if (slot < 0) { UI.toast('Ngày này đã đủ 10 việc — hãy chọn ngày khác.', 'error'); return; }
  day.tasks[slot].text = r.text;
  Store.save();
  UI.toast(`Đã thêm vào ${WD_FULL[+r.day]} · Kế hoạch tuần`, 'success');
  App.modules[App.view].render();
};
