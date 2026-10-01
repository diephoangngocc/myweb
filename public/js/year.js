'use strict';
/* =====================================================================
 * MODULE 4 — YEAR AT A GLANCE (Cái nhìn toàn năm)
 * Lịch 12 tháng (4×3) · sự kiện quan trọng (thêm/sửa/xoá) · mục tiêu tháng
 * ===================================================================== */

const Year = {
  pendingDate: null,

  goals(y) {
    const MG = S().year.monthGoals;
    if (!Array.isArray(MG[y])) {
      const src = MG[y] && typeof MG[y] === 'object' ? MG[y] : {};
      MG[y] = Array.from({ length: 12 }, (_, i) => String(src[i] ?? ''));
    }
    return MG[y];
  },

  eventMap() {
    const map = {};
    S().year.events.forEach(e => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  },

  /* ------------------------------ Render ------------------------------ */
  render() {
    const el = $('#view-year');
    const y = S().year.year;
    this.goals(y);
    const nowY = new Date().getFullYear();
    const defDate = this.pendingDate || (y === nowY ? D.today() : `${y}-01-01`);
    const controls = `
      <div class="seg">
        <button class="icon-btn" data-action="year-step" data-dir="-1" title="Năm trước">${icon('chevL')}</button>
        <input type="number" class="year-input" data-path="year.year" data-num min="1900" max="2100" value="${y}" aria-label="Năm">
        <button class="icon-btn" data-action="year-step" data-dir="1" title="Năm sau">${icon('chevR')}</button>
      </div>
      <button class="btn btn-soft" data-action="year-today">${icon('calendar')} Năm nay</button>`;

    el.innerHTML = `
      ${viewHeader('Sheet 04 · Year at a Glance', `Cái nhìn toàn năm ${y}`, 'Toàn cảnh 12 tháng: đánh dấu sự kiện quan trọng và đặt mục tiêu cho từng tháng. Bấm vào một ngày để thêm sự kiện nhanh.', controls)}

      <div class="card p-5 mb-6" id="eventPanel">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <div class="card-title mb-3">${icon('flag')} Sự kiện quan trọng</div>
            <div class="ev-form">
              <label class="field"><span>Ngày</span><input type="date" id="evDate" class="date-input w-full" value="${defDate}"></label>
              <label class="field"><span>Tên sự kiện</span><input id="evTitle" class="field-input" placeholder="VD: Bảo vệ đồ án"></label>
              <label class="field"><span>Nhãn màu</span><select id="evCat" class="field-input">${optionsHTML(EVENT_CATS, 'important')}</select></label>
              <button class="btn btn-primary w-full" data-action="event-add">${icon('plus')} Thêm sự kiện</button>
            </div>
            <div class="legend mt-4">
              ${EVENT_CATS.map(c => `<span class="legend-item"><i style="background:${c.accent}"></i>${c.name}</span>`).join('')}
              <span class="legend-item"><i class="today-sw"></i>Hôm nay</span>
            </div>
          </div>
          <div class="min-w-0">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div class="font-bold text-[16px]">Danh sách sự kiện năm ${y}</div>
              <span class="count-pill" id="evCount"></span>
            </div>
            <div id="evList" class="ev-list"></div>
          </div>
        </div>
      </div>

      <section class="year-grid" id="yearGrid">${this.gridHTML(y)}</section>`;

    this.renderList();
    UI.autoGrowAll(el);

    if (this.pendingDate) {
      const d = this.pendingDate;
      this.pendingDate = null;
      setTimeout(() => { UI.flash($('#eventPanel'), 'start'); $('#evTitle')?.focus({ preventScroll: true }); this.flashRows(d); }, 120);
    }
  },

  gridHTML(y) {
    const map = this.eventMap(), goals = this.goals(y), today = D.today();
    return MONTH_NAMES.map((name, m) => {
      const th = PALETTE[m % PALETTE.length];
      const first = new Date(y, m, 1), lead = D.wdIndex(first), n = D.dim(y, m + 1);
      let cells = '', count = 0;
      for (let i = 0; i < lead; i++) cells += '<span class="cal-day blank"></span>';
      for (let d = 1; d <= n; d++) {
        const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
        const evs = map[iso] || [];
        count += evs.length;
        const wd = (lead + d - 1) % 7;
        const cat = evs.length ? byId(EVENT_CATS, evs[0].cat) : null;
        const tip = evs.length ? evs.map(e => `• ${e.title || '(Chưa đặt tên)'}`).join('\n') : `${WD_FULL[wd]}, ${pad(d)}/${pad(m + 1)}/${y}`;
        cells += `<button class="cal-day ${wd === 6 ? 'sun' : ''} ${iso === today ? 'today' : ''} ${evs.length ? 'has-ev' : ''}"
          ${cat ? `style="background:${cat.soft};color:${cat.accent}"` : ''} title="${esc(tip)}" data-action="year-day" data-date="${iso}">${d}${evs.length > 1 ? `<i class="ev-n">${evs.length}</i>` : ''}</button>`;
      }
      return `
      <div class="month-card card" style="--accent:${th.accent};--soft:${th.soft}">
        <div class="month-head"><div class="month-name">${name}</div>${count ? `<span class="count-pill">${count} sự kiện</span>` : ''}</div>
        <div class="cal-grid wd">${WD_SHORT.map((w, i) => `<span class="${i === 6 ? 'sun' : ''}">${w}</span>`).join('')}</div>
        <div class="cal-grid cal-days">${cells}</div>
        <div class="month-goal">
          <div class="mini-label">${icon('target')} Mục tiêu tháng</div>
          <textarea class="ghost auto" rows="2" data-path="year.monthGoals.${y}.${m}" placeholder="Mục tiêu tháng ${m + 1}...">${esc(goals[m])}</textarea>
        </div>
      </div>`;
    }).join('');
  },

  renderGrid() {
    const box = $('#yearGrid');
    if (!box) return;
    box.innerHTML = this.gridHTML(S().year.year);
    UI.autoGrowAll(box);
  },
  renderGridSoon() { clearTimeout(this._gt); this._gt = setTimeout(() => this.renderGrid(), 400); },

  renderList() {
    const box = $('#evList');
    if (!box) return;
    const y = S().year.year;
    const list = S().year.events.map((e, idx) => ({ e, idx }))
      .filter(x => x.e.date.startsWith(y + '-'))
      .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.idx - b.idx);
    setText('#evCount', `${list.length} sự kiện`);
    box.innerHTML = list.length
      ? list.map(({ e, idx }) => this.rowHTML(e, idx)).join('')
      : emptyHTML(`Chưa có sự kiện nào trong năm ${y}. Bấm vào một ngày trên lịch để thêm nhanh.`, 'calendar');
    // Cuộn tới sự kiện sắp tới gần nhất
    const next = box.querySelector('.ev-row:not(.past)');
    box.scrollTop = next ? next.offsetTop - box.offsetTop - 4 : box.scrollHeight;
  },

  rowHTML(e, idx) {
    const c = byId(EVENT_CATS, e.cat);
    const d = D.diff(D.today(), e.date);
    const when = d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : d > 0 ? `Còn ${d} ngày` : `${-d} ngày trước`;
    return `
    <div class="ev-row ${d < 0 ? 'past' : ''}" data-date="${e.date}" style="--accent:${c.accent};--soft:${c.soft}">
      <span class="ev-dot"></span>
      <input type="date" class="date-input sm" data-path="year.events.${idx}.date" value="${e.date}" aria-label="Ngày">
      <input class="ghost-input ev-title" data-path="year.events.${idx}.title" value="${esc(e.title)}" placeholder="Tên sự kiện">
      <select class="chip-select sm" data-path="year.events.${idx}.cat" style="${chipStyle(c)}" aria-label="Nhãn">${optionsHTML(EVENT_CATS, e.cat)}</select>
      <span class="ev-when">${when}</span>
      <button class="icon-btn sm danger" data-action="event-del" data-id="${e.id}" title="Xoá sự kiện">${icon('trash')}</button>
    </div>`;
  },

  flashRows(date) { $$(`.ev-row[data-date="${date}"]`).forEach(r => { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }); },

  onChange(path, el) {
    if (path === 'year.year') {
      const v = Number(el.value);
      S().year.year = v >= 1900 && v <= 2100 ? v : new Date().getFullYear();
      Store.save();
      this.render();
      return;
    }
    const m = path.match(/^year\.events\.(\d+)\.(date|cat|title)$/);
    if (!m) return;
    const ev = S().year.events[+m[1]];
    if (m[2] === 'date') {
      if (!D.valid(el.value)) return;
      const y = +el.value.slice(0, 4);
      if (y !== S().year.year) UI.toast(`Sự kiện đã chuyển sang năm ${y}`, 'info');
      this.renderList(); this.renderGrid(); App.updateBell();
    } else if (m[2] === 'cat') {
      el.style.cssText = chipStyle(byId(EVENT_CATS, ev.cat));
      el.closest('.ev-row')?.style.setProperty('--accent', byId(EVENT_CATS, ev.cat).accent);
      this.renderGrid();
    } else {
      this.renderGridSoon(); App.updateBellSoon();
    }
  },
};

/* ------------------------------ Hành động ------------------------------ */
Actions['event-add'] = () => {
  const date = $('#evDate')?.value, titleEl = $('#evTitle'), title = (titleEl?.value || '').trim(), cat = $('#evCat')?.value || 'important';
  if (!D.valid(date)) { UI.toast('Vui lòng chọn ngày hợp lệ', 'error'); return; }
  if (!title) { titleEl?.focus(); UI.toast('Vui lòng nhập tên sự kiện', 'error'); return; }
  S().year.events.push({ id: uid(), date, title, cat });
  const y = +date.slice(0, 4);
  if (y !== S().year.year) { S().year.year = y; Store.save(); Year.render(); }
  else { Store.save(); Year.renderList(); Year.renderGrid(); titleEl.value = ''; titleEl.focus(); }
  UI.toast(`Đã thêm “${title}” · ${D.dmy(D.parse(date))}`, 'success');
  App.updateBell();
  Year.flashRows(date);
};
Actions['event-del'] = el => {
  const list = S().year.events;
  const idx = list.findIndex(e => e.id === el.dataset.id);
  if (idx < 0) return;
  const [removed] = list.splice(idx, 1);
  Store.save(); Year.renderList(); Year.renderGrid(); App.updateBell();
  UI.toast(`Đã xoá “${removed.title || 'sự kiện'}”`, 'info', {
    label: 'Hoàn tác',
    onClick: () => { S().year.events.splice(idx, 0, removed); Store.save(); if (App.view === 'year') { Year.renderList(); Year.renderGrid(); } App.updateBell(); },
  });
};
Actions['year-step'] = el => { S().year.year = clamp(S().year.year + Number(el.dataset.dir), 1900, 2100); Store.save(); Year.render(); };
Actions['year-today'] = () => { S().year.year = new Date().getFullYear(); Store.save(); Year.render(); };
Actions['year-day'] = el => {
  const d = el.dataset.date;
  const inp = $('#evDate'); if (inp) inp.value = d;
  UI.flash($('#eventPanel'), 'start');
  setTimeout(() => $('#evTitle')?.focus({ preventScroll: true }), 400);
  Year.flashRows(d);
};
