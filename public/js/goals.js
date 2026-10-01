'use strict';
/* =====================================================================
 * MODULE 1 — GOAL PLANNER (Mục tiêu & Tầm nhìn)
 * 6 thẻ mục tiêu · tổng hợp 5 lĩnh vực · donut % · ưu tiên hàng đầu
 * ===================================================================== */

const Goals = {
  /** Mục tiêu đã được "khai báo" (có tên / có bước / đã đổi trạng thái) */
  defined(g) {
    return !!(g.title.trim() || g.steps.some(s => s.text.trim() || s.done) || g.status !== 'todo' || g.image);
  },

  /** Tiến độ 1 mục tiêu: số bước xong / số bước có nội dung */
  progress(g) {
    const active = g.steps.filter(s => s.done || s.text.trim()).length;
    const done = g.steps.filter(s => s.done).length;
    if (!active) return g.status === 'done' ? { done: 1, total: 1, pct: 100, steps: 0 } : { done: 0, total: STEP_ROWS, pct: 0, steps: 0 };
    return { done, total: active, pct: percent(done, active), steps: active };
  },

  /** Tổng hợp theo 5 lĩnh vực + trạng thái + quá hạn */
  stats() {
    const cards = S().goals.cards.filter(g => this.defined(g));
    const areas = AREAS.map(a => {
      const gs = cards.filter(g => g.area === a.id);
      let done = 0, total = 0;
      gs.forEach(g => { const p = this.progress(g); done += p.done; total += p.total; });
      return { ...a, count: gs.length, done, total, pct: percent(done, total) };
    });
    const done = areas.reduce((s, a) => s + a.done, 0);
    const total = areas.reduce((s, a) => s + a.total, 0);
    const status = { todo: 0, doing: 0, done: 0 };
    cards.forEach(g => { status[g.status] = (status[g.status] || 0) + 1; });
    const today = D.today();
    const overdue = cards.filter(g => g.status !== 'done' && D.valid(g.deadline) && g.deadline < today).length;
    return { areas, done, total, pct: percent(done, total), status, overdue, count: cards.length };
  },

  /* ------------------------------ Lịch sử tiến độ (cho sparkline) ------------------------------ */
  /** Ghi tiến độ hôm nay của từng lĩnh vực — chỉ gọi khi người dùng thật sự sửa mục tiêu */
  recordHistory() {
    const s = this.stats();
    const h = S().goals.history, today = D.today();
    const entry = { o: s.pct };
    s.areas.forEach(a => { entry[a.id] = a.pct; });
    if (JSON.stringify(h[today]) === JSON.stringify(entry)) return;
    h[today] = entry;
    const keys = Object.keys(h).sort();
    while (keys.length > 120) delete h[keys.shift()];
    Store.saveSoon();
  },
  /** Chuỗi 30 ngày (giá trị gần nhất đến từng ngày), điểm cuối = tiến độ hiện tại */
  series(id, stats = null, days = 30) {
    const h = S().goals.history, keys = Object.keys(h).sort();
    const s = stats || this.stats();
    const live = id === 'o' ? s.pct : (s.areas.find(a => a.id === id) || {}).pct || 0;
    const out = [];
    let k = 0, last = null;
    const start = D.add(new Date(), -(days - 1));
    for (let i = 0; i < days - 1; i++) {
      const day = D.iso(D.add(start, i));
      while (k < keys.length && keys[k] <= day) { last = h[keys[k]][id]; k++; }
      if (last !== null && last !== undefined) out.push(last);
    }
    out.push(live);
    return out;
  },

  /* ------------------------------ Render ------------------------------ */
  render() {
    const el = $('#view-goals');
    const cyc = App.cycle();
    const right = `<div class="seg">
        <span class="date-chip">${icon('calendar')}<span>Bắt đầu chu kỳ</span></span>
        <input type="date" class="date-input" data-path="profile.cycleStart" value="${S().profile.cycleStart}" title="Ngày bắt đầu chu kỳ 90 ngày">
      </div>
      <span class="chip" style="${chipStyle(PALETTE[0])}">${icon('target', 'w-4 h-4')} ${cyc.short}</span>`;
    el.innerHTML = `
      ${viewHeader('Sheet 01 · Goal Planner', 'Mục tiêu &amp; Tầm nhìn',
        'Luồng <b>MỤC TIÊU → HÀNH ĐỘNG → KẾT QUẢ</b>: chọn điều quan trọng nhất, chia nhỏ thành 5 bước và theo dõi trong 90 ngày.', right)}
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside class="goal-aside">${this.asideHTML()}</aside>
        <section class="goal-grid">${S().goals.cards.map((g, i) => this.cardHTML(g, i)).join('')}</section>
      </div>`;
    this.drawDonut();
    this.refreshOverview();
    UI.autoGrowAll(el);
  },

  asideHTML() {
    const st = S();
    return `
    <div class="card p-5">
      <div class="card-title mb-2">${icon('sun')} Tầm nhìn ${new Date().getFullYear()}</div>
      <textarea class="ghost auto vision" rows="3" data-path="goals.vision" placeholder="Một năm tuyệt vời của tôi trông như thế nào?">${esc(st.goals.vision)}</textarea>
    </div>
    <div class="card p-5">
      <div class="card-head"><div class="card-title">${icon('layers')} Tổng quan lĩnh vực</div></div>
      <div class="donut-wrap"><canvas id="goalDonut" aria-label="Biểu đồ tiến độ theo lĩnh vực"></canvas>
        <div class="donut-center"><b id="goalOverallPct">0%</b><span>hoàn thành</span></div></div>
      <div class="overall-trend"><span>Xu hướng 30 ngày</span><span id="goalOverallSpark"></span></div>
      <div class="space-y-4 mt-5">${AREAS.map(a => `
        <div class="area-row" style="--accent:${a.accent};--soft:${a.soft};--light:${a.light}">
          <div class="area-ico">${icon(a.icon)}</div>
          <div class="min-w-0"><div class="area-name">${a.name}</div><div class="area-sub" id="area-sub-${a.id}"></div></div>
          <span class="area-spark" id="area-spark-${a.id}" title="Tiến độ 30 ngày qua"></span>
          <div class="area-pct" id="area-pct-${a.id}">0%</div>
          <div class="progress thin"><div class="bar" id="area-bar-${a.id}"></div></div>
        </div>`).join('')}
      </div>
    </div>
    <div class="card p-5">
      <div class="card-title mb-3">${icon('flag')} Trạng thái mục tiêu</div>
      <div class="status-grid">${STATUSES.map(s => `
        <div class="status-pill" style="--accent:${s.accent};--soft:${s.soft}"><b id="status-count-${s.id}">0</b><span>${s.name}</span></div>`).join('')}
      </div>
    </div>
    <div class="card p-5">
      <div class="card-title mb-1">${icon('star')} Ưu tiên hàng đầu</div>
      <p class="text-sm muted mb-3">3–5 điều quan trọng nhất trong chu kỳ này.</p>
      <div class="space-y-2 prio-list">${st.goals.priorities.map((p, k) => `
        <div class="prio-row"><span class="prio-num">${k + 1}</span>
          <input class="ghost-input" data-path="goals.priorities.${k}" value="${esc(p)}" placeholder="Ưu tiên #${k + 1}${k >= 3 ? ' (tuỳ chọn)' : ''}"></div>`).join('')}
      </div>
    </div>`;
  },

  cardHTML(g, i) {
    const th = PALETTE[i % PALETTE.length];
    const p = this.progress(g);
    const area = byId(AREAS, g.area), status = byId(STATUSES, g.status);
    const b = `goals.cards.${i}`;
    return `
    <article class="goal-card card" id="goal-${i}" style="--accent:${th.accent};--soft:${th.soft};--light:${th.light}">
      <div class="goal-cover" id="goal-cover-${i}">${this.coverHTML(g, i)}</div>
      <div class="goal-body">
        <div>
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <div class="goal-num">Mục tiêu ${pad(i + 1)}</div>
              <h3 class="goal-title editable" contenteditable="true" spellcheck="false" data-single data-path="${b}.title" data-placeholder="Nhập tên mục tiêu...">${esc(g.title)}</h3>
            </div>
            <div class="ring lg" id="goal-ring-${i}" style="--p:${p.pct};--c:${th.accent}"><span>${p.pct}%</span></div>
          </div>
          <div class="mt-3"><div class="progress"><div class="bar" id="goal-bar-${i}" style="width:${p.pct}%"></div></div>
            <div class="goal-meta" id="goal-meta-${i}">${this.metaHTML(g)}</div></div>
        </div>

        <div class="field-grid">
          <label class="field"><span>Lĩnh vực</span>
            <select class="chip-select" data-path="${b}.area" style="${chipStyle(area)}">${optionsHTML(AREAS, g.area)}</select></label>
          <label class="field"><span>Trạng thái</span>
            <select class="chip-select" id="goal-status-${i}" data-path="${b}.status" style="${chipStyle(status)}">${optionsHTML(STATUSES, g.status)}</select></label>
          <label class="field"><span>Thời hạn</span>
            <input type="date" class="date-input" data-path="${b}.deadline" value="${esc(g.deadline)}">
            <div id="goal-due-${i}">${this.dueHTML(g)}</div></label>
          <label class="field"><span>Phần thưởng</span>
            <input class="ghost-input" data-path="${b}.reward" value="${esc(g.reward)}" placeholder="Tự thưởng khi đạt..."></label>
        </div>

        <div class="section-label">${icon('edit')} Câu hỏi tự vấn</div>
        ${QUESTIONS.map((q, k) => `
          <div class="qa"><div class="q">${k + 1}. ${q}</div>
            <textarea class="ghost auto" rows="1" data-path="${b}.answers.${k}" placeholder="Viết câu trả lời của bạn...">${esc(g.answers[k])}</textarea></div>`).join('')}

        <div class="section-label">${icon('list')} 5 bước hành động</div>
        <div class="steps">${g.steps.map((s, k) => `
          <div class="step-row ${s.done ? 'done' : ''}">
            <input type="checkbox" class="cbx" data-path="${b}.steps.${k}.done" ${s.done ? 'checked' : ''} aria-label="Hoàn thành bước ${k + 1}">
            <span class="step-no">${k + 1}</span>
            <input class="ghost-input" data-path="${b}.steps.${k}.text" value="${esc(s.text)}" placeholder="Bước ${k + 1}...">
          </div>`).join('')}
        </div>
      </div>
    </article>`;
  },

  coverHTML(g, i) {
    if (g.image) {
      return `<img src="${esc(g.image)}" alt="Ảnh Vision Board" loading="lazy">
        <div class="cover-broken">Không tải được ảnh — hãy kiểm tra lại URL.</div>
        <div class="cover-actions">
          <button class="cover-btn" data-action="goal-img-url" data-i="${i}" title="Đổi URL ảnh">${icon('link')}</button>
          <button class="cover-btn" data-action="goal-img-upload" data-i="${i}" title="Tải ảnh lên">${icon('upload')}</button>
          <button class="cover-btn" data-action="goal-img-remove" data-i="${i}" title="Xoá ảnh">${icon('trash')}</button>
        </div>`;
    }
    return `<div class="cover-empty">
        <div class="cover-ico">${icon('image')}</div>
        <div class="cover-hint">Ảnh Vision Board</div>
        <div class="cover-inputs">
          <input class="cover-url" data-img-url="${i}" placeholder="Dán URL ảnh rồi nhấn Enter...">
          <button class="btn btn-soft btn-sm" data-action="goal-img-upload" data-i="${i}">${icon('upload')} Tải lên</button>
        </div>
      </div>`;
  },

  metaHTML(g) {
    const p = this.progress(g);
    const left = p.steps ? `${p.done}/${p.steps} bước hoàn thành` : (g.status === 'done' ? 'Đã hoàn thành' : 'Chưa có bước hành động');
    return `<span>${left}</span><span>${g.reward.trim() ? icon('gift', 'w-4 h-4') + ' ' + esc(g.reward.trim()) : ''}</span>`;
  },

  dueHTML(g) {
    if (!D.valid(g.deadline)) return '<span class="due">Chưa đặt hạn</span>';
    if (g.status === 'done') return '<span class="due ok">✓ Đã hoàn thành</span>';
    const d = D.diff(D.today(), g.deadline);
    if (d > 0) return `<span class="due ${d <= 7 ? 'warn' : ''}">Còn ${d} ngày</span>`;
    if (d === 0) return '<span class="due warn">Hạn chót hôm nay</span>';
    return `<span class="due late">Quá hạn ${-d} ngày</span>`;
  },

  drawDonut() {
    const s = this.stats();
    Charts.make('goalDonut', $('#goalDonut'), {
      type: 'doughnut',
      data: {
        labels: [...AREAS.map(a => a.name), 'Còn lại'],
        datasets: [{ data: this.donutData(s), backgroundColor: [...AREAS.map(a => a.accent), '#E9EFFA'], borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }],
      },
      options: {
        cutout: '72%',
        plugins: { tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} bước` } } },
      },
    });
  },
  donutData(s) {
    if (s.total === 0) return [0, 0, 0, 0, 0, 1];
    return [...s.areas.map(a => a.done), Math.max(0, s.total - s.done)];
  },

  /* ------------------------------ Cập nhật trực tiếp ------------------------------ */
  refreshOverview() {
    if (!$('#goalOverallPct')) return;
    const s = this.stats();
    s.areas.forEach(a => {
      setText(`#area-pct-${a.id}`, a.pct + '%');
      setBar($(`#area-bar-${a.id}`), a.pct);
      setText(`#area-sub-${a.id}`, a.count ? `${a.count} mục tiêu · ${a.done}/${a.total} bước` : 'Chưa có mục tiêu');
    });
    setText('#goalOverallPct', s.pct + '%');
    s.areas.forEach(a => { const el = $(`#area-spark-${a.id}`); if (el) el.innerHTML = sparklineSVG(this.series(a.id, s), a.accent, { w: 78, h: 24 }); });
    const os = $('#goalOverallSpark'); if (os) os.innerHTML = sparklineSVG(this.series('o', s), '#4F86F0', { w: 140, h: 28 });
    STATUSES.forEach(st => setText(`#status-count-${st.id}`, s.status[st.id] || 0));
    const ch = Charts.get('goalDonut');
    if (ch) { ch.data.datasets[0].data = this.donutData(s); ch.update(); }
  },
  refreshOverviewSoon() { clearTimeout(this._ot); this._ot = setTimeout(() => this.refreshOverview(), 220); },

  refreshCard(i) {
    const g = S().goals.cards[i];
    const p = this.progress(g);
    setRing($(`#goal-ring-${i}`), p.pct);
    setBar($(`#goal-bar-${i}`), p.pct);
    const meta = $(`#goal-meta-${i}`); if (meta) meta.innerHTML = this.metaHTML(g);
    const due = $(`#goal-due-${i}`); if (due) due.innerHTML = this.dueHTML(g);
    const sel = $(`#goal-status-${i}`);
    if (sel) { sel.value = g.status; sel.style.cssText = chipStyle(byId(STATUSES, g.status)); }
  },

  /** Tự động đồng bộ trạng thái theo các bước đã tick */
  autoStatus(i) {
    const g = S().goals.cards[i];
    const p = this.progress(g);
    const prev = g.status;
    if (p.steps && p.done >= p.total) g.status = 'done';
    else if (p.done > 0 && g.status !== 'doing') g.status = 'doing';
    else if (p.done === 0 && g.status === 'done') g.status = 'todo';
    if (prev !== g.status) {
      Store.save();
      if (g.status === 'done') {
        UI.toast(`Tuyệt vời! Bạn đã hoàn thành “${g.title.trim() || 'Mục tiêu ' + (i + 1)}”`, 'success');
        const card = $(`#goal-${i}`);
        if (card) { card.classList.remove('celebrate'); void card.offsetWidth; card.classList.add('celebrate'); }
      }
    }
  },

  onChange(path, el, kind) {
    const m = path.match(/^goals\.cards\.(\d+)\.(.+)$/);
    if (!m) return;
    const i = +m[1], field = m[2], g = S().goals.cards[i];
    if (/^steps\.\d+\.(done|text)$/.test(field) || field === 'status' || field === 'area' || field === 'title') {
      clearTimeout(this._ht); this._ht = setTimeout(() => this.recordHistory(), 600);
    }
    if (/^steps\.\d+\.done$/.test(field)) {
      el.closest('.step-row')?.classList.toggle('done', el.checked);
      this.autoStatus(i);
      this.refreshCard(i);
      this.refreshOverview();
    } else if (/^steps\.\d+\.text$/.test(field) || field === 'title' || field === 'reward') {
      this.refreshCard(i);
      this.refreshOverviewSoon();
    } else if (field === 'area') {
      el.style.cssText = chipStyle(byId(AREAS, g.area));
      this.refreshOverview();
    } else if (field === 'status' || field === 'deadline') {
      this.refreshCard(i);
      this.refreshOverview();
    }
  },

  /* ------------------------------ Ảnh Vision Board ------------------------------ */
  renderCover(i) {
    const box = $(`#goal-cover-${i}`);
    if (!box) return;
    box.classList.remove('broken');
    box.innerHTML = this.coverHTML(S().goals.cards[i], i);
  },
  setImage(i, url) {
    const g = S().goals.cards[i];
    const prev = g.image;
    g.image = url;
    if (!Store.save()) { g.image = prev; Store.save(); return false; }
    this.renderCover(i);
    this.refreshOverview();
    return true;
  },
  setImageUrl(i, url) {
    url = String(url || '').trim();
    if (!url) return;
    if (!/^(https?:\/\/|data:image\/)/i.test(url)) { UI.toast('URL ảnh cần bắt đầu bằng http:// hoặc https://', 'error'); return; }
    if (this.setImage(i, url)) UI.toast('Đã cập nhật ảnh Vision Board', 'success');
  },
};

/* ------------------------------ Hành động ------------------------------ */
Actions['goal-img-upload'] = el => {
  const i = +el.dataset.i;
  App.pickFile('#fileImage', async file => {
    if (!file.type.startsWith('image/')) { UI.toast('Vui lòng chọn một tệp ảnh', 'error'); return; }
    try {
      const data = await compressImage(file);
      if (Goals.setImage(i, data)) UI.toast('Đã tải ảnh lên (ảnh được nén để tiết kiệm bộ nhớ)', 'success');
    } catch (e) { UI.toast('Không đọc được ảnh này', 'error'); }
  });
};
Actions['goal-img-url'] = async el => {
  const i = +el.dataset.i;
  const cur = S().goals.cards[i].image;
  const r = await UI.modal({
    title: 'Ảnh Vision Board', icon: 'link', okText: 'Cập nhật',
    bodyHTML: `<label>URL ảnh</label><input name="url" class="field-input" value="${cur.startsWith('data:') ? '' : esc(cur)}" placeholder="https://...">`,
  });
  if (r && r.url) Goals.setImageUrl(i, r.url);
};
Actions['goal-img-remove'] = el => {
  const i = +el.dataset.i;
  const prev = S().goals.cards[i].image;
  Goals.setImage(i, '');
  UI.toast('Đã xoá ảnh', 'info', { label: 'Hoàn tác', onClick: () => { if (App.view === 'goals') Goals.setImage(i, prev); else { S().goals.cards[i].image = prev; Store.save(); } } });
};
