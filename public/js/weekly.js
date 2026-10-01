'use strict';
/* =====================================================================
 * MODULE 3 — WEEKLY PLANNER (Kế hoạch tuần)
 * 7 thẻ ngày · Biết ơn & Ưu tiên · 10 việc · Time Blocking 30 phút (07:00–22:00)
 * ===================================================================== */

function tbStyle(tag) { return tag.id ? `background:${tag.soft};--tag:${tag.accent}` : '--tag:transparent'; }

const Weekly = {
  ensure(ws) {
    const W = S().weekly;
    if (!W.weeks[ws]) W.weeks[ws] = { focus: '', note: '', days: Array.from({ length: 7 }, blankDay) };
    const wk = W.weeks[ws];
    wk.focus = String(wk.focus ?? ''); wk.note = String(wk.note ?? '');
    wk.days = Array.from({ length: 7 }, (_, i) => {
      const src = (wk.days || [])[i] || {};
      const d = Object.assign(blankDay(), src);
      d.gratitude = String(d.gratitude ?? ''); d.priority = String(d.priority ?? '');
      d.tasks = Array.from({ length: TASK_ROWS }, (_, k) => { const t = (src.tasks || [])[k] || {}; return { text: String(t.text ?? ''), done: !!t.done }; });
      if (!d.blocks || typeof d.blocks !== 'object' || Array.isArray(d.blocks)) d.blocks = {};
      return d;
    });
    return wk;
  },

  dayProgress(day) {
    const total = day.tasks.filter(t => t.done || t.text.trim()).length;
    const done = day.tasks.filter(t => t.done).length;
    return { done, total, pct: percent(done, total) };
  },

  /* ------------------------------ Render ------------------------------ */
  render() {
    const el = $('#view-weekly');
    const W = S().weekly, ws = W.weekStart;
    const wk = this.ensure(ws);
    const start = D.parse(ws), end = D.add(start, 6);
    const base = `weekly.weeks.${ws}`;
    const tbOpen = S().ui.tbOpen;
    const controls = `
      <div class="seg">
        <button class="icon-btn" data-action="week-step" data-dir="-1" title="Tuần trước">${icon('chevL')}</button>
        <label class="date-chip">${icon('calendar')}<span>Thứ Hai</span>
          <input type="date" class="date-input" data-path="weekly.weekStart" value="${ws}" title="Chọn ngày bất kỳ — tự chuyển về Thứ Hai đầu tuần"></label>
        <button class="icon-btn" data-action="week-step" data-dir="1" title="Tuần sau">${icon('chevR')}</button>
      </div>
      <button class="btn btn-soft" data-action="week-today">${icon('calendar')} Tuần này</button>
      <button class="btn btn-soft" data-action="week-copy" title="Chép Time Blocking của tuần trước sang tuần này">${icon('copy')} Chép lịch tuần trước</button>`;

    el.innerHTML = `
      ${viewHeader('Sheet 03 · Weekly Planner', 'Kế hoạch tuần',
        `Tuần ${D.isoWeek(start)} · ${WD_FULL[0]} ${D.dm(start)} – ${WD_FULL[6]} ${D.dmy(end)}`, controls)}

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3 mb-6">
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('chart')} Tiến độ tuần</div><span class="count-pill" id="wk-count">0/0</span></div>
          <div class="flex items-end gap-3"><div class="big-num" id="wk-pct">0%</div><div class="text-sm muted pb-1">công việc đã hoàn thành</div></div>
          <div class="progress mt-3"><div class="bar" id="wk-bar"></div></div>
          <div class="chart-box h-28 mt-4"><canvas id="weekBar"></canvas></div>
        </div>
        <div class="card p-5">
          <div class="card-title mb-2">${icon('target')} Trọng tâm tuần</div>
          <textarea class="ghost auto boxed" rows="3" data-path="${base}.focus" placeholder="3 kết quả quan trọng nhất của tuần này...">${esc(wk.focus)}</textarea>
          <div class="card-title mt-4 mb-2">${icon('edit')} Nhìn lại tuần</div>
          <textarea class="ghost auto boxed" rows="3" data-path="${base}.note" placeholder="Điều gì hiệu quả? Điều gì cần cải thiện?">${esc(wk.note)}</textarea>
        </div>
        <div class="card p-5 md:col-span-2 2xl:col-span-1">
          <div class="card-head"><div class="card-title">${icon('clock')} Phân bổ thời gian</div><span class="text-sm muted">Time Blocking</span></div>
          <div class="tag-legend">${TAGS.slice(1).map(t => `
            <div class="tag-item" style="--accent:${t.accent};--soft:${t.soft}"><span class="tag-dot"></span>${t.name}<b id="tag-h-${t.id}">0h</b></div>`).join('')}
          </div>
          <div class="text-sm muted mt-3" id="tag-total"></div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div class="card-title">${icon('week')} 7 ngày trong tuần</div>
        <div class="flex items-center gap-2">
          <button class="btn btn-soft btn-sm" data-action="week-tb-toggle" id="tbToggleBtn">${icon('clock')} ${tbOpen ? 'Thu gọn Time Blocking' : 'Mở Time Blocking'}</button>
          <button class="icon-btn sm" data-action="week-scroll" data-dir="-1" title="Cuộn trái">${icon('chevL')}</button>
          <button class="icon-btn sm" data-action="week-scroll" data-dir="1" title="Cuộn phải">${icon('chevR')}</button>
        </div>
      </div>
      <div class="week-scroller" id="weekScroller">
        ${wk.days.map((day, i) => this.dayHTML(day, i, D.add(start, i), base, tbOpen)).join('')}
      </div>`;

    this.drawChart();
    this.refreshSummary();
    UI.autoGrowAll(el);

    const todayIso = D.today();
    if (todayIso >= ws && todayIso <= D.iso(end)) {
      const ti = D.wdIndex(new Date());
      requestAnimationFrame(() => {
        const sc = $('#weekScroller'), card = $(`#day-${ti}`);
        if (sc && card && ti > 0) { sc.style.scrollBehavior = 'auto'; sc.scrollLeft = card.offsetLeft - 4; sc.style.scrollBehavior = ''; }
      });
    }
  },

  dayHTML(day, i, date, base, tbOpen) {
    const th = PALETTE[i];
    const p = this.dayProgress(day);
    const isToday = D.iso(date) === D.today();
    const b = `${base}.days.${i}`;
    return `
    <article class="day-card card ${isToday ? 'is-today' : ''}" id="day-${i}" style="--accent:${th.accent};--soft:${th.soft};--light:${th.light}">
      <header class="dc-head">
        <div><div class="dc-name">${WD_FULL[i]} ${isToday ? '<span class="today-pill">Hôm nay</span>' : ''}</div><div class="dc-date">${D.dmy(date)}</div></div>
        <div class="ring" id="wd-ring-${i}" style="--p:${p.pct};--c:${th.accent}"><span>${p.pct}%</span></div>
      </header>
      <div class="dc-body">
        <div>
          <div class="mini-label">${icon('heart')} Biết ơn</div>
          <textarea class="ghost auto" rows="2" data-path="${b}.gratitude" placeholder="Hôm nay tôi biết ơn vì...">${esc(day.gratitude)}</textarea>
        </div>
        <div>
          <div class="mini-label">${icon('star')} Ưu tiên số 1</div>
          <input class="ghost-input prio" data-path="${b}.priority" value="${esc(day.priority)}" placeholder="Việc quan trọng nhất hôm nay">
        </div>
        <div>
          <div class="flex items-center justify-between"><div class="mini-label">${icon('checkCircle')} Việc cần làm</div><span class="count-pill" id="wd-count-${i}">${p.done}/${p.total}</span></div>
          <div class="progress thin mt-1 mb-2"><div class="bar" id="wd-bar-${i}" style="width:${p.pct}%"></div></div>
          <div class="tasks">${day.tasks.map((t, k) => `
            <div class="task-row ${t.done ? 'done' : ''}">
              <input type="checkbox" class="cbx round" data-path="${b}.tasks.${k}.done" ${t.done ? 'checked' : ''} aria-label="Hoàn thành việc ${k + 1}">
              <input class="ghost-input" data-path="${b}.tasks.${k}.text" value="${esc(t.text)}" placeholder="Việc ${k + 1}">
            </div>`).join('')}
          </div>
        </div>
        <details class="tb" ${tbOpen ? 'open' : ''}>
          <summary>${icon('clock')} Time Blocking <small>07:00 – 22:00</small></summary>
          <div class="tb-list">${TIME_SLOTS.map(t => {
            const blk = day.blocks[t] || {};
            const tag = byId(TAGS, blk.tag || '');
            return `<div class="tb-row" style="${tbStyle(tag)}">
              <span class="tb-time">${t}</span>
              <input class="ghost-input" data-path="${b}.blocks.${t}.text" value="${esc(blk.text || '')}" placeholder="—">
              <select class="tb-tag" data-path="${b}.blocks.${t}.tag" style="color:${tag.accent}" aria-label="Nhãn ${t}">${optionsHTML(TAGS, blk.tag || '')}</select>
            </div>`;
          }).join('')}</div>
        </details>
      </div>
    </article>`;
  },

  drawChart() {
    Charts.make('weekBar', $('#weekBar'), {
      type: 'bar',
      data: { labels: WD_SHORT, datasets: [{ data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: PALETTE.map(p => p.accent), borderRadius: 6, borderSkipped: false, maxBarThickness: 26 }] },
      options: {
        scales: { y: { min: 0, max: 100, display: false }, x: { grid: { display: false }, border: { display: false } } },
        plugins: { tooltip: { callbacks: { title: c => WD_FULL[c[0].dataIndex], label: c => `${c.parsed.y}% công việc` } } },
      },
    });
  },

  /* ------------------------------ Cập nhật trực tiếp ------------------------------ */
  refreshSummary() {
    if (!$('#wk-pct')) return;
    const wk = this.ensure(S().weekly.weekStart);
    let done = 0, total = 0;
    const perDay = wk.days.map(d => { const p = this.dayProgress(d); done += p.done; total += p.total; return p.pct; });
    const pct = percent(done, total);
    setText('#wk-pct', pct + '%');
    setText('#wk-count', `${done}/${total} việc`);
    setBar($('#wk-bar'), pct);
    const hours = {};
    TAGS.forEach(t => { hours[t.id] = 0; });
    wk.days.forEach(d => Object.values(d.blocks).forEach(blk => { if (blk && blk.tag && hours[blk.tag] !== undefined) hours[blk.tag] += 0.5; }));
    TAGS.slice(1).forEach(t => setText(`#tag-h-${t.id}`, fmtHours(hours[t.id])));
    const tot = TAGS.slice(1).reduce((s, t) => s + hours[t.id], 0);
    setText('#tag-total', tot ? `Tổng cộng ${fmtHours(tot)} đã được gắn nhãn trong tuần.` : 'Chọn nhãn cho các khung giờ để xem phân bổ thời gian.');
    const ch = Charts.get('weekBar');
    if (ch) { ch.data.datasets[0].data = perDay; ch.update(); }
  },

  refreshDay(i) {
    const wk = this.ensure(S().weekly.weekStart);
    const p = this.dayProgress(wk.days[i]);
    setRing($(`#wd-ring-${i}`), p.pct);
    setBar($(`#wd-bar-${i}`), p.pct);
    setText(`#wd-count-${i}`, `${p.done}/${p.total}`);
  },

  onChange(path, el) {
    if (path === 'weekly.weekStart') {
      const v = el.value;
      S().weekly.weekStart = D.iso(D.monday(D.valid(v) ? D.parse(v) : new Date()));
      Store.save();
      this.render();
      return;
    }
    const m = path.match(/^weekly\.weeks\.([\d-]+)\.days\.(\d)\.(.+)$/);
    if (!m || m[1] !== S().weekly.weekStart) return;
    const i = +m[2], field = m[3];
    if (/^tasks\.\d+\.done$/.test(field)) {
      el.closest('.task-row')?.classList.toggle('done', el.checked);
      this.refreshDay(i); this.refreshSummary();
    } else if (/^tasks\.\d+\.text$/.test(field)) {
      this.refreshDay(i); this.refreshSummary();
    } else if (/^blocks\..+\.tag$/.test(field)) {
      const tag = byId(TAGS, el.value);
      const row = el.closest('.tb-row');
      if (row) row.style.cssText = tbStyle(tag);
      el.style.color = tag.accent;
      this.refreshSummary();
    }
  },
};

/* ------------------------------ Hành động ------------------------------ */
Actions['week-step'] = el => {
  const W = S().weekly;
  W.weekStart = D.iso(D.add(D.parse(W.weekStart), 7 * Number(el.dataset.dir)));
  Store.save(); Weekly.render();
};
Actions['week-today'] = () => { S().weekly.weekStart = D.iso(D.monday(new Date())); Store.save(); Weekly.render(); };
Actions['week-scroll'] = el => { const sc = $('#weekScroller'); if (sc) sc.scrollBy({ left: Number(el.dataset.dir) * 358, behavior: 'smooth' }); };
Actions['week-tb-toggle'] = () => {
  const ui = S().ui;
  ui.tbOpen = !ui.tbOpen;
  Store.save();
  $$('#weekScroller details.tb').forEach(d => { d.open = ui.tbOpen; });
  const btn = $('#tbToggleBtn');
  if (btn) btn.innerHTML = `${icon('clock')} ${ui.tbOpen ? 'Thu gọn Time Blocking' : 'Mở Time Blocking'}`;
};
Actions['week-copy'] = async () => {
  const W = S().weekly, ws = W.weekStart;
  const prevWs = D.iso(D.add(D.parse(ws), -7));
  const prev = W.weeks[prevWs];
  const hasBlocks = wk => wk && (wk.days || []).some(d => Object.values(d.blocks || {}).some(b => b && ((b.text || '').trim() || b.tag)));
  if (!hasBlocks(prev)) { UI.toast('Tuần trước chưa có Time Blocking để sao chép', 'error'); return; }
  const cur = Weekly.ensure(ws);
  if (hasBlocks(cur)) {
    const ok = await UI.confirm({ title: 'Ghi đè lịch tuần này?', icon: 'copy', okText: 'Ghi đè', bodyHTML: '<p>Time Blocking hiện có của tuần này sẽ được thay bằng lịch của tuần trước.</p>' });
    if (!ok) return;
  }
  Weekly.ensure(prevWs);
  cur.days.forEach((d, i) => { d.blocks = JSON.parse(JSON.stringify(prev.days[i].blocks || {})); });
  Store.save(); Weekly.render();
  UI.toast('Đã chép Time Blocking từ tuần trước', 'success');
};
