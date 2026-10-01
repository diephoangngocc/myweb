'use strict';
/* =====================================================================
 * app.js — Khởi động ứng dụng, điều hướng, binding sửa trực tiếp,
 * tìm kiếm, thông báo, hồ sơ, dữ liệu mẫu / xoá / sao lưu
 * ===================================================================== */

const App = {
  view: 'dashboard',
  modules: {
    dashboard: Dashboard, goals: Goals, habits: Habits, weekly: Weekly, year: Year,
    finance: FinOverview, transactions: FinLedger, budget: FinBudget, debts: FinDebts, funds: FinFunds, bills: FinBills,
  },
  titles: {
    dashboard: 'Tổng quan', goals: 'Mục tiêu', habits: 'Thói quen', weekly: 'Kế hoạch tuần', year: 'Toàn năm',
    finance: 'Tổng quan tài chính', transactions: 'Sổ giao dịch', budget: 'Ngân sách', debts: 'Khoản nợ', funds: 'Tiết kiệm', bills: 'Hóa đơn định kỳ',
  },
  FIN_VIEWS: ['finance', 'transactions', 'budget', 'debts', 'funds', 'bills'],
  lastView: { planner: 'dashboard', finance: 'finance' },
  sectionOf(v) { return this.FIN_VIEWS.includes(v) ? 'finance' : 'planner'; },
  section() { return this.sectionOf(this.view); },
  pendingFocus: null,
  results: [],
  srIdx: 0,

  init() {
    if (!Store.state) Store.load();
    this.setupCharts();
    this.hydrateIcons(document);
    this.initSidebar();
    this.bindGlobal();
    this.renderProfile();
    this.renderCycleCard();
    this.updateBell();
    window.addEventListener('hashchange', () => this.route());
    this.route();
    document.body.classList.remove('is-booting');
    if (!window.Chart) UI.toast('Không tải được thư viện biểu đồ — biểu đồ tạm ẩn, các chức năng khác vẫn hoạt động.', 'error');
  },
  /** Gọi bởi Sync khi đã biết chắc không có dữ liệu ở cả máy này lẫn máy chủ */
  welcome() {
    setTimeout(() => UI.toast('Chào mừng bạn! Muốn xem thử với dữ liệu mẫu?', 'info', { label: 'Tải dữ liệu mẫu', onClick: () => Actions['load-sample']() }), 500);
  },

  setupCharts() {
    if (!window.Chart) return;
    const f = '"Times New Roman", Times, serif';
    Chart.defaults.font.family = f;
    Chart.defaults.font.size = 12.5;
    Chart.defaults.color = '#7A88A6';
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    Chart.defaults.animation.duration = 550;
    Chart.defaults.plugins.legend.display = false;
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: '#1D2946', padding: 10, cornerRadius: 10, displayColors: false,
      titleFont: { family: f, size: 13, weight: 'bold' }, bodyFont: { family: f, size: 13 },
    });
  },

  hydrateIcons(root) { $$('i[data-icon]', root).forEach(el => { el.outerHTML = icon(el.dataset.icon, el.className); }); },

  /* ------------------------------ Điều hướng ------------------------------ */
  route() {
    const v = (location.hash || '#dashboard').slice(1);
    this.show(this.modules[v] ? v : 'dashboard');
  },
  go(v) { if (location.hash === '#' + v) this.show(v); else location.hash = v; },
  show(v) {
    Store.flush();
    this.view = v;
    $$('.view').forEach(s => s.classList.toggle('active', s.dataset.view === v));
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === v));
    const sec = this.sectionOf(v);
    const secChanged = document.body.dataset.section !== sec;
    this.lastView[sec] = v;
    document.body.dataset.section = sec;
    $$('.main-switch [data-section]').forEach(b => { const on = b.dataset.section === sec; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $$('.nav-group').forEach(g => g.classList.toggle('current', g.dataset.group === sec));
    setText('#brandSub', sec === 'finance' ? 'Tài chính cá nhân' : 'Bộ 4 Sheets · 90 ngày');
    if (secChanged) this.renderCycleCard();
    this.modules[v].render();
    document.title = `${this.titles[v]} · Planner 2026`;
    document.body.classList.remove('sb-open');
    if (this.pendingFocus) {
      const path = this.pendingFocus;
      this.pendingFocus = null;
      setTimeout(() => {
        const el = $(`[data-path="${CSS.escape(path)}"]`);
        if (!el) return;
        const det = el.closest('details'); if (det) det.open = true;
        UI.flash(el);
        setTimeout(() => el.focus({ preventScroll: true }), 450);
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },
  rerender() {
    Dashboard.cal = null; Dashboard.tab = 'all';
    this.renderProfile();
    this.renderCycleCard();
    this.updateBell();
    this.modules[this.view].render();
  },

  /* ------------------------------ Binding sửa trực tiếp ------------------------------ */
  bindGlobal() {
    const commitTypes = new Set(['checkbox', 'radio', 'date', 'number', 'file', 'month', 'week', 'time', 'color', 'range']);
    const isCommitField = el => el.tagName === 'SELECT' || (el.tagName === 'INPUT' && commitTypes.has(el.type));

    // Gõ chữ (input / textarea / contenteditable) → lưu (debounce) ngay khi gõ
    document.addEventListener('input', e => {
      const el = e.target;
      const path = el && el.dataset && el.dataset.path;
      if (!path || isCommitField(el)) return;
      let val;
      if (el.isContentEditable) {
        if (!el.textContent.trim() && el.innerHTML !== '') el.innerHTML = '';
        val = el.textContent;
      } else val = 'money' in el.dataset ? parseMoney(el.value) : el.value;
      setPath(S(), path, val);
      Store.saveSoon();
      if (el.tagName === 'TEXTAREA' && el.classList.contains('auto')) UI.autoGrow(el);
      this.onDataChange(path, el, 'input');
    });

    // Checkbox / select / date / number → lưu ngay lập tức
    document.addEventListener('change', e => {
      const el = e.target;
      if (el && el.matches && el.matches('[data-img-url]')) { Goals.setImageUrl(+el.dataset.imgUrl, el.value); return; }
      const path = el && el.dataset && el.dataset.path;
      if (!path || !isCommitField(el)) return;
      let val = el.type === 'checkbox' ? el.checked : el.value;
      if ('num' in el.dataset) val = Number(val);
      setPath(S(), path, val);
      Store.save();
      this.onDataChange(path, el, 'change');
    });

    // Rời khỏi ô contenteditable → cắt khoảng trắng thừa · ô tiền → định dạng lại 1.500.000
    document.addEventListener('focusout', e => {
      const el = e.target;
      if (el && el.dataset && 'money' in el.dataset && el.dataset.path) {
        const v = Number(getPath(S(), el.dataset.path)) || 0;
        el.value = v ? fmtNum(v) : (el.placeholder ? '' : '0');
      }
      if (el && el.id === 'txAmt' && el.value.trim()) { const v = parseMoney(el.value); el.value = v ? fmtNum(v) : ''; }
      if (el && el.isContentEditable && el.dataset.path) {
        const v = el.textContent.replace(/\s+/g, ' ').trim();
        if (v !== el.textContent) { el.textContent = v; setPath(S(), el.dataset.path, v); Store.saveSoon(); }
      }
    });

    // Ảnh Vision Board lỗi (URL hỏng) → hiện thông báo thay vì ảnh vỡ
    document.addEventListener('error', e => {
      const t = e.target;
      if (t && t.tagName === 'IMG' && t.parentElement && t.parentElement.classList.contains('goal-cover')) t.parentElement.classList.add('broken');
    }, true);

    // Dán vào contenteditable → chỉ giữ chữ thuần
    document.addEventListener('paste', e => {
      const el = e.target.closest && e.target.closest('[contenteditable="true"]');
      if (!el) return;
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, text);
    });

    // Click: nút hành động + đóng dropdown khi bấm ra ngoài
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (a && Actions[a.dataset.action]) { e.preventDefault(); Actions[a.dataset.action](a, e); }
      if (!e.target.closest('.search-wrap')) $('#searchResults').classList.add('hidden');
      if (!e.target.closest('.bell-wrap')) $('#bellMenu').classList.add('hidden');
    });

    // Bàn phím
    document.addEventListener('keydown', e => {
      const t = e.target;
      const typing = t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '/' && !typing) { e.preventDefault(); $('#searchInput').focus(); return; }
      if (e.key === 'Escape') {
        $('#searchResults').classList.add('hidden'); $('#bellMenu').classList.add('hidden');
        document.body.classList.remove('sb-open');
        if (t.id === 'searchInput' || t.isContentEditable) t.blur();
        return;
      }
      if (t.id === 'searchInput') { this.searchKeys(e); return; }
      if (e.key !== 'Enter' || e.isComposing) return;
      if (t.isContentEditable && t.hasAttribute('data-single')) { e.preventDefault(); t.blur(); return; }
      if (t.id === 'evTitle') { e.preventDefault(); Actions['event-add'](); return; }
      if (t.id === 'txDesc' || t.id === 'txAmt') { e.preventDefault(); Actions['tx-add'](); return; }
      if (t.dataset && 'money' in t.dataset) { e.preventDefault(); t.blur(); return; }
      if (t.matches('[data-img-url]')) { e.preventDefault(); t.blur(); return; }
      if (t.matches('input.ghost-input')) {
        // Enter → chuyển xuống dòng kế tiếp trong cùng danh sách (như sổ tay)
        e.preventDefault();
        const scope = t.closest('.steps, .tasks, .tb-list, .prio-list, tbody');
        const list = scope ? $$('input.ghost-input', scope) : [];
        const next = list[list.indexOf(t) + 1];
        if (next) next.focus(); else t.blur();
      }
    });

    // Tìm kiếm
    const search = $('#searchInput');
    search.addEventListener('input', debounce(() => this.runSearch(search.value), 120));
    search.addEventListener('focus', () => { if (search.value.trim()) this.runSearch(search.value); });

    // Lưu ngay khi rời trang / chuyển tab
    window.addEventListener('beforeunload', () => Store.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });
  },

  /** Điều phối sau mỗi thay đổi dữ liệu → cập nhật tiến độ / biểu đồ real-time */
  onDataChange(path, el, kind) {
    if (path.startsWith('finance.')) { Fin.onChange(path, el, kind); return; }
    if (path.startsWith('profile.')) {
      this.renderProfile(false);
      if (path === 'profile.name') setText('#greetName', S().profile.name.trim() || 'bạn');
      if (path === 'profile.cycleStart' && kind === 'change') { this.renderCycleCard(); this.modules[this.view].render(); }
      return;
    }
    if (this.view === 'dashboard') { Dashboard.onChange(path, el, kind); this.renderCycleCardSoon(); return; }
    const mod = { goals: Goals, habits: Habits, weekly: Weekly, year: Year }[path.split('.')[0]];
    if (mod) mod.onChange(path, el, kind);
    if (path.startsWith('goals.')) { this.renderCycleCardSoon(); this.updateBellSoon(); }
  },

  /* ------------------------------ Sidebar: ghim / tự ẩn ------------------------------ */
  isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; },
  isAutoSidebar() { return S().ui.sidebarMode === 'auto' && this.isDesktop(); },
  applySidebarMode() {
    const auto = S().ui.sidebarMode === 'auto';
    document.body.classList.toggle('sb-auto', auto);
    if (!auto) document.body.classList.remove('sb-peek');
    const btn = $('#sbPinBtn');
    if (btn) btn.innerHTML = auto
      ? `${icon('pin')}<span class="sb-label">Ghim menu</span>`
      : `${icon('sidebar')}<span class="sb-label">Tự ẩn menu</span>`;
  },
  peek(on) {
    clearTimeout(this._peekT);
    if (on) document.body.classList.add('sb-peek');
    else document.body.classList.remove('sb-peek');
  },
  initSidebar() {
    this.applySidebarMode();
    const sb = $('#sidebar'), edge = $('#sbEdge'), handle = $('#sbHandle');
    const hideSoon = (ms = 280) => {
      clearTimeout(this._peekT);
      this._peekT = setTimeout(() => {
        if (sb.matches(':hover') || (this._kbd && sb.contains(document.activeElement))) return;
        document.body.classList.remove('sb-peek');
      }, ms);
    };
    const enter = () => { if (this.isAutoSidebar()) this.peek(true); };
    edge.addEventListener('mouseenter', enter);
    handle.addEventListener('mouseenter', enter);
    sb.addEventListener('mouseenter', () => clearTimeout(this._peekT));
    sb.addEventListener('mouseleave', () => { if (this.isAutoSidebar()) hideSoon(); });
    [edge, handle].forEach(el => el.addEventListener('mouseleave', e => { if (this.isAutoSidebar() && !sb.contains(e.relatedTarget)) hideSoon(); }));
    // Bàn phím: Tab vào menu thì mở, Tab ra thì đóng
    document.addEventListener('keydown', e => { if (e.key === 'Tab') this._kbd = true; }, true);
    document.addEventListener('pointerdown', () => { this._kbd = false; }, true);
    sb.addEventListener('focusin', () => { if (this.isAutoSidebar() && this._kbd) this.peek(true); });
    sb.addEventListener('focusout', e => { if (this.isAutoSidebar() && !sb.contains(e.relatedTarget) && !sb.matches(':hover')) this.peek(false); });
    // Chọn một mục menu → tự thu lại
    sb.addEventListener('click', e => {
      if (!this.isAutoSidebar()) return;
      if (e.target.closest('.nav-item, [data-action="go"]')) { document.activeElement && document.activeElement.blur(); this.peek(false); }
    });
    // Chạm / bấm ra ngoài → thu lại (thiết bị cảm ứng)
    document.addEventListener('pointerdown', e => {
      if (document.body.classList.contains('sb-peek') && !sb.contains(e.target) && !e.target.closest('#sbHandle, .menu-btn, #modalRoot')) this.peek(false);
    });
  },

  pickFile(sel, cb) {
    const inp = $(sel);
    inp.value = '';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) cb(f); };
    inp.click();
  },

  /* ------------------------------ Chu kỳ 90 ngày ------------------------------ */
  cycle() {
    const startIso = S().profile.cycleStart;
    const start = D.parse(startIso), end = D.add(start, CYCLE_DAYS - 1);
    const day = D.diff(startIso, D.today()) + 1;
    let label, short;
    if (day < 1) { label = `Chu kỳ 90 ngày bắt đầu sau ${1 - day} ngày`; short = `Bắt đầu sau ${1 - day} ngày`; }
    else if (day > CYCLE_DAYS) { label = 'Chu kỳ 90 ngày đã kết thúc — hãy đặt chu kỳ mới'; short = `Đã kết thúc ${D.dm(end)}`; }
    else { label = `Ngày ${day}/${CYCLE_DAYS} của chu kỳ`; short = `Ngày ${day}/${CYCLE_DAYS} · còn ${CYCLE_DAYS - day} ngày`; }
    const d = clamp(day, 0, CYCLE_DAYS);
    return { start, end, day: d, pct: percent(d, CYCLE_DAYS), label, short };
  },
  renderCycleCard() {
    if (this.section() === 'finance') return this.renderFinanceCard();
    const c = this.cycle(), gs = Goals.stats();
    $('#cycleCard').innerHTML = `
      <div class="cc-ico" title="${esc(c.label)}">${icon('target')}</div>
      <div class="sb-label">
        <div class="cc-title">Chu kỳ 90 ngày</div>
        <div class="cc-sub">${c.short}</div>
        <div class="progress thin my-3"><div class="bar" style="width:${c.pct}%"></div></div>
        <div class="cc-row"><span>Tiến độ mục tiêu</span><b>${gs.pct}%</b></div>
        <button class="btn btn-primary btn-sm w-full mt-3" data-action="go" data-view="goals">Xem mục tiêu</button>
      </div>`;
  },
  renderFinanceCard() {
    const cash = Fin.cash(), k = Fin.curMonth();
    const tot = Fin.totals(S().finance.txs.filter(t => t.date.startsWith(k)));
    const buds = Fin.budgets(k), tb = buds.reduce((a, b) => a + b.budget, 0), ts = buds.reduce((a, b) => a + b.spent, 0);
    const bs = Fin.billsSummary(k), dm = Fin.debtsMonth(k);
    $('#cycleCard').innerHTML = `
      <div class="cc-ico fin" title="Số dư thực tế">${icon('wallet')}</div>
      <div class="sb-label">
        <div class="cc-title">Số dư thực tế</div>
        <div class="cc-money ${cash < 0 ? 'neg' : ''}">${fmtMoney(cash)}</div>
        <div class="cc-row mt-2"><span>Tháng này</span><b class="${tot.net < 0 ? 'text-rose-600' : 'text-emerald-700'}">${fmtMoney(tot.net, true)}</b></div>
        <div class="cc-row"><span>Nợ còn lại</span><b>${fmtShort(Fin.debtsTotal())}</b></div>
        ${dm.need ? `<div class="cc-row"><span>Nợ cần trả tháng này</span><b class="${dm.left ? 'text-amber-700' : 'text-emerald-700'}">${dm.left ? fmtShort(dm.left) : '✓ đủ'}</b></div>` : ''}
        <div class="cc-row"><span>Tiết kiệm</span><b>${fmtShort(Fin.fundsTotal())}</b></div>
        ${bs.n ? `<div class="cc-row"><span>Hoá đơn đã trả</span><b>${bs.nPaid}/${bs.n}</b></div>` : ''}
        <div class="progress thin my-2 ${tb && ts > tb ? 'over' : ''}"><div class="bar" style="width:${tb ? Math.min(100, Math.round((ts / tb) * 100)) : 0}%"></div></div>
        <div class="cc-sub text-left">${tb ? `Đã dùng ${Math.round((ts / tb) * 100)}% ngân sách tháng` : 'Chưa đặt ngân sách tháng'}</div>
        <button class="btn btn-primary btn-sm w-full mt-3" data-action="tx-quick">${icon('plus')} Giao dịch mới</button>
      </div>`;
  },
  renderCycleCardSoon() { clearTimeout(this._cc); this._cc = setTimeout(() => this.renderCycleCard(), 300); },

  /* ------------------------------ Hồ sơ ------------------------------ */
  renderProfile(updateText = true) {
    const p = S().profile;
    const word = p.name.trim().split(/\s+/).pop() || '';
    setText('#avatar', (word[0] || '☺').toUpperCase());
    if (updateText) {
      const n = $('#profileName'), s = $('#profileSub');
      if (n && document.activeElement !== n) n.textContent = p.name;
      if (s && document.activeElement !== s) s.textContent = p.subtitle;
    }
  },

  /* ------------------------------ Thông báo ------------------------------ */
  notifications() {
    const today = D.today(), out = [];
    S().year.events.forEach(e => {
      const d = D.diff(today, e.date);
      if (d >= 0 && d <= 7) out.push({ ic: 'calendar', c: byId(EVENT_CATS, e.cat), title: e.title || '(Sự kiện)', sub: d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : `Còn ${d} ngày · ${D.dm(D.parse(e.date))}`, view: 'year', order: d });
    });
    S().goals.cards.forEach((g, i) => {
      if (g.status === 'done' || !D.valid(g.deadline) || !Goals.defined(g)) return;
      const d = D.diff(today, g.deadline);
      const c = { accent: '#DB5873', soft: '#FFE3E8' };
      if (d < 0) out.push({ ic: 'flag', c, title: g.title || `Mục tiêu ${i + 1}`, sub: `Quá hạn ${-d} ngày`, view: 'goals', order: -100 + d });
      else if (d <= 7) out.push({ ic: 'flag', c: { accent: '#C98A1E', soft: '#FFF1D6' }, title: g.title || `Mục tiêu ${i + 1}`, sub: `Hạn chót còn ${d} ngày`, view: 'goals', order: d });
    });
    const red = { accent: '#DB5873', soft: '#FFE3E8' }, amber = { accent: '#C98A1E', soft: '#FFF1D6' };
    const k = Fin.curMonth(), F = S().finance;
    Fin.budgets(k).forEach(b => {
      if (b.level === 'over') out.push({ ic: 'wallet', c: red, title: `Vượt ngân sách ${b.name}`, sub: `Đã chi ${fmtMoney(b.spent)} / ${fmtMoney(b.budget)} (${b.pct}%)`, view: 'budget', order: -50 });
      else if (b.level === 'warn') out.push({ ic: 'wallet', c: amber, title: `Sắp chạm ngân sách ${b.name}`, sub: `Đã dùng ${b.pct}% · còn ${fmtMoney(b.budget - b.spent)}`, view: 'budget', order: 20 });
    });
    F.bills.forEach(b => {
      const st = Fin.billStatus(b, k);
      if (st.state === 'overdue') out.push({ ic: 'zap', c: red, title: `Hoá đơn quá hạn: ${b.name || 'Hoá đơn'}`, sub: `${fmtMoney(b.amount)} · hạn ${D.dm(D.parse(st.due))} (trễ ${-st.days} ngày)`, view: 'bills', order: -90 + st.days });
      else if (st.state === 'soon') out.push({ ic: 'zap', c: amber, title: `Sắp đến hạn: ${b.name || 'Hoá đơn'}`, sub: `${fmtMoney(b.amount)} · ${st.days === 0 ? 'hạn hôm nay' : `còn ${st.days} ngày (${D.dm(D.parse(st.due))})`}`, view: 'bills', order: st.days });
    });
    Fin.activeDebts().forEach(d => {
      if (!D.valid(d.due)) return;
      const n = D.diff(today, d.due), rem = Fin.debtRemaining(d);
      if (n < 0) out.push({ ic: 'creditCard', c: red, title: `Nợ quá hạn: ${d.name || 'Khoản nợ'}`, sub: `Còn ${fmtMoney(rem)} · trễ ${-n} ngày`, view: 'debts', order: -80 + n });
      else if (n <= 7) out.push({ ic: 'creditCard', c: amber, title: `Sắp đáo hạn: ${d.name || 'Khoản nợ'}`, sub: `Còn ${fmtMoney(rem)} · ${n === 0 ? 'hôm nay' : `còn ${n} ngày`}`, view: 'debts', order: n });
    });
    // Kỳ trả góp hằng tháng
    F.debts.forEach(d => {
      const m = Fin.debtMonth(d, k);
      if (m.kind !== 'monthly' || !m.left || !m.due) return;
      const n = D.diff(today, m.due);
      if (n > 7) return;
      out.push({ ic: 'creditCard', c: n < 0 ? red : amber, title: `Kỳ trả nợ tháng này: ${d.name || 'Khoản nợ'}`, sub: `Cần trả ${fmtMoney(m.left)} · ${n < 0 ? `trễ ${-n} ngày` : n === 0 ? 'hạn hôm nay' : `hạn ${D.dm(D.parse(m.due))}`}`, view: 'debts', order: n < 0 ? -70 + n : n });
    });
    F.funds.forEach(f => {
      const pl = Fin.fundPlan(f);
      if (!f.target || pl.reached || pl.days === null || pl.days < 0 || pl.days > 14) return;
      out.push({ ic: 'mic', c: { accent: '#D0489A', soft: '#FCE4F2' }, title: `${f.name || 'Quỹ'}: còn ${pl.days} ngày`, sub: `Còn thiếu ${fmtMoney(pl.left)} (${pl.pct}%)`, view: 'funds', order: pl.days + 1 });
    });
    return out.sort((a, b) => a.order - b.order);
  },
  updateBell() {
    const n = this.notifications().length, b = $('#bellBadge');
    b.textContent = n > 9 ? '9+' : n;
    b.classList.toggle('hidden', !n);
  },
  updateBellSoon() { clearTimeout(this._bt); this._bt = setTimeout(() => this.updateBell(), 400); },

  /* ------------------------------ Tìm kiếm ------------------------------ */
  searchIndex() {
    const st = S(), out = [];
    const push = (text, where, ic, view, path, set) => { if (text && String(text).trim()) out.push({ text: String(text), where, ic, view, path, set }); };
    st.goals.cards.forEach((g, i) => {
      const where = `Mục tiêu ${i + 1}${g.title.trim() ? ' · ' + g.title.trim() : ''}`;
      push(g.title, 'Goal Planner', 'target', 'goals', `goals.cards.${i}.title`);
      g.steps.forEach((s, k) => push(s.text, `${where} · Bước ${k + 1}`, 'list', 'goals', `goals.cards.${i}.steps.${k}.text`));
      g.answers.forEach((a, k) => push(a, `${where} · Tự vấn ${k + 1}`, 'edit', 'goals', `goals.cards.${i}.answers.${k}`));
      push(g.reward, `${where} · Phần thưởng`, 'gift', 'goals', `goals.cards.${i}.reward`);
    });
    push(st.goals.vision, 'Tầm nhìn', 'sun', 'goals', 'goals.vision');
    st.goals.priorities.forEach((p, k) => push(p, `Ưu tiên hàng đầu #${k + 1}`, 'star', 'goals', `goals.priorities.${k}`));
    const seen = new Set();
    Object.keys(st.habits.months).sort().reverse().forEach(key => {
      const M = st.habits.months[key], [y, m] = key.split('-').map(Number);
      (M.names || []).forEach((nm, i) => {
        const f = fold(nm);
        if (!nm || !nm.trim() || seen.has(f)) return;
        seen.add(f);
        push(nm, `Thói quen · Tháng ${m}/${y}`, 'repeat', 'habits', `habits.months.${key}.names.${i}`, () => { st.habits.year = y; st.habits.month = m; });
      });
    });
    Object.keys(st.weekly.weeks).sort().reverse().forEach(ws => {
      const wk = st.weekly.weeks[ws], start = D.parse(ws), setW = () => { st.weekly.weekStart = ws; };
      push(wk.focus, `Trọng tâm tuần ${D.dm(start)}`, 'target', 'weekly', `weekly.weeks.${ws}.focus`, setW);
      (wk.days || []).forEach((d, i) => {
        const where = `${WD_FULL[i]} ${D.dmy(D.add(start, i))}`, b = `weekly.weeks.${ws}.days.${i}`;
        (d.tasks || []).forEach((t, k) => push(t.text, `${where} · Việc ${k + 1}`, 'checkCircle', 'weekly', `${b}.tasks.${k}.text`, setW));
        push(d.priority, `${where} · Ưu tiên số 1`, 'star', 'weekly', `${b}.priority`, setW);
        push(d.gratitude, `${where} · Biết ơn`, 'heart', 'weekly', `${b}.gratitude`, setW);
        Object.entries(d.blocks || {}).forEach(([slot, blk]) => push(blk && blk.text, `${where} · ${slot}`, 'clock', 'weekly', `${b}.blocks.${slot}.text`, setW));
      });
    });
    const finSet = () => { st.finance.period = Fin.curMonth(); };
    st.finance.debts.forEach((d, idx) => {
      push(d.name, `Khoản nợ · còn ${fmtMoney(Fin.debtRemaining(d))}`, 'creditCard', 'debts', `finance.debts.${idx}.name`);
      push(d.lender, `Chủ nợ · ${d.name || 'Khoản nợ'}`, 'creditCard', 'debts', `finance.debts.${idx}.lender`);
    });
    st.finance.funds.forEach((f, idx) => {
      push(f.name, `Quỹ · ${fmtMoney(Fin.fundSaved(f))} / ${fmtMoney(f.target)}`, 'piggy', 'funds', `finance.funds.${idx}.name`);
      push(f.note, `Ghi chú quỹ · ${f.name || 'Quỹ'}`, 'piggy', 'funds', `finance.funds.${idx}.note`);
    });
    st.finance.bills.forEach((b, idx) => push(b.name, `Hoá đơn định kỳ · ngày ${b.dueDay} hằng tháng · ${fmtMoney(b.amount)}`, 'zap', 'bills', `finance.bills.${idx}.name`, finSet));
    st.finance.txs.forEach((t, idx) => push(t.desc, `Giao dịch · ${D.dmy(D.parse(t.date))} · ${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}`, 'receipt', 'transactions', `finance.txs.${idx}.desc`, () => { st.finance.period = t.date.slice(0, 7); st.finance.filter = { type: 'all', cat: 'all', q: '' }; }));
    st.year.events.forEach((e, idx) => push(e.title, `Sự kiện · ${D.longVN(D.parse(e.date))}`, 'flag', 'year', `year.events.${idx}.title`, () => { st.year.year = +e.date.slice(0, 4); }));
    Object.entries(st.year.monthGoals).forEach(([y, arr]) => {
      Object.values(arr || {}).forEach((txt, m) => push(txt, `Mục tiêu tháng ${m + 1}/${y}`, 'target', 'year', `year.monthGoals.${y}.${m}`, () => { st.year.year = +y; }));
    });
    return out;
  },
  highlight(text, q) {
    text = text.normalize('NFC');
    const f = fold(text), fq = fold(q.trim());
    const i = f.indexOf(fq);
    if (i < 0 || !fq) return esc(text.slice(0, 90));
    const from = Math.max(0, i - 30);
    const pre = (from > 0 ? '…' : '') + text.slice(from, i);
    return esc(pre) + '<mark>' + esc(text.slice(i, i + fq.length)) + '</mark>' + esc(text.slice(i + fq.length, i + fq.length + 60));
  },
  runSearch(q) {
    const box = $('#searchResults');
    const fq = fold(q.trim());
    if (!fq) { box.classList.add('hidden'); return; }
    this.results = this.searchIndex().filter(x => fold(x.text).includes(fq)).slice(0, 12);
    this.srIdx = 0;
    box.innerHTML = this.results.length
      ? `<div class="dd-title">${this.results.length} kết quả</div>` + this.results.map((r, k) => `
        <button class="sr-item ${k === 0 ? 'active' : ''}" data-action="search-open" data-k="${k}">
          <span class="sr-ico">${icon(r.ic, 'w-4 h-4')}</span>
          <span class="min-w-0 flex-1"><span class="sr-title block">${this.highlight(r.text, q)}</span><span class="sr-where block">${esc(r.where)}</span></span>
        </button>`).join('')
      : `<div class="empty">Không tìm thấy kết quả cho “${esc(q.trim())}”</div>`;
    box.classList.remove('hidden');
  },
  searchKeys(e) {
    const box = $('#searchResults'), items = $$('.sr-item', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      this.srIdx = (this.srIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, k) => it.classList.toggle('active', k === this.srIdx));
      items[this.srIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && items.length && !box.classList.contains('hidden')) {
      e.preventDefault();
      this.openResult(this.srIdx);
    }
  },
  openResult(k) {
    const r = this.results[k];
    if (!r) return;
    $('#searchResults').classList.add('hidden');
    $('#searchInput').value = '';
    $('#searchInput').blur();
    if (r.set) { r.set(); Store.save(); }
    this.pendingFocus = r.path;
    this.go(r.view);
  },
};

/* ------------------------------ Hành động chung ------------------------------ */
Actions['go'] = el => App.go(el.dataset.view);
Actions['section'] = el => { const sec = el.dataset.section; if (App.section() !== sec) App.go(App.lastView[sec]); };
Actions['search-open'] = el => App.openResult(+el.dataset.k);
Actions['sidebar-open'] = () => {
  if (!App.isDesktop()) document.body.classList.add('sb-open');
  else if (App.isAutoSidebar()) App.peek(!document.body.classList.contains('sb-peek'));
};
Actions['sidebar-close'] = () => document.body.classList.remove('sb-open');
Actions['sidebar-peek'] = () => { if (App.isAutoSidebar()) App.peek(!document.body.classList.contains('sb-peek')); };
Actions['sidebar-pin'] = () => {
  const ui = S().ui;
  ui.sidebarMode = ui.sidebarMode === 'auto' ? 'pinned' : 'auto';
  App.applySidebarMode();
  Store.save();
  UI.toast(ui.sidebarMode === 'auto' ? 'Menu sẽ tự ẩn — rê chuột vào mép trái để mở' : 'Đã ghim menu', 'info');
};
Actions['bell-toggle'] = () => {
  const menu = $('#bellMenu');
  if (!menu.classList.contains('hidden')) { menu.classList.add('hidden'); return; }
  const list = App.notifications();
  menu.innerHTML = `<div class="dd-title">Thông báo &amp; nhắc hạn</div>` + (list.length ? list.map(n => `
    <button class="bell-item" data-action="go" data-view="${n.view}">
      <span class="sr-ico" style="background:${n.c.soft};color:${n.c.accent}">${icon(n.ic, 'w-4 h-4')}</span>
      <span class="min-w-0 flex-1"><span class="sr-title block">${esc(n.title)}</span><span class="sr-where block">${esc(n.sub)}</span></span>
    </button>`).join('') : emptyHTML('Không có gì cần chú ý. Tuyệt vời!', 'bell'));
  menu.classList.remove('hidden');
};

Actions['load-sample'] = async () => {
  const ok = await UI.confirm({
    title: 'Tải dữ liệu mẫu?', icon: 'sparkles', okText: 'Tải dữ liệu mẫu',
    bodyHTML: '<p>Toàn bộ dữ liệu hiện tại sẽ được <b>thay thế</b> bằng bộ dữ liệu mẫu để bạn trải nghiệm.</p><p class="muted">Mẹo: bấm “Sao lưu (JSON)” trước nếu muốn giữ lại dữ liệu hiện có.</p>',
  });
  if (!ok) return;
  Sync.snapshotNext();
  Store.replace(buildSampleState());
  UI.toast('', 'clear');
  App.rerender();
  UI.toast('Đã tải dữ liệu mẫu', 'success');
};
Actions['clear-data'] = async () => {
  const ok = await UI.confirm({
    title: 'Xoá sạch dữ liệu?', icon: 'trash', danger: true, okText: 'Xoá tất cả',
    bodyHTML: '<p>Mọi mục tiêu, thói quen, kế hoạch tuần, sự kiện và toàn bộ dữ liệu tài chính (giao dịch, ngân sách, nợ, quỹ, hoá đơn) sẽ bị xoá — trên máy này và trên mọi thiết bị đồng bộ.</p><p class="muted">Nếu đang bật đồng bộ, bản hiện tại được cất vào “Lịch sử đồng bộ” để khôi phục khi cần.</p>',
  });
  if (!ok) return;
  const keep = { profile: { ...S().profile, cycleStart: D.today() } };
  Sync.snapshotNext();
  Store.replace(keep);
  App.rerender();
  UI.toast('Đã xoá sạch dữ liệu', 'success');
};
Actions['export-json'] = () => {
  Store.flush();
  const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bo-4-sheets-2026_sao-luu_${D.today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  UI.toast('Đã tải xuống tệp sao lưu JSON', 'success');
};
Actions['import-json'] = () => {
  App.pickFile('#fileJson', async file => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.goals || !data.habits) throw new Error('Sai định dạng');
      const ok = await UI.confirm({ title: 'Khôi phục dữ liệu?', icon: 'upload', okText: 'Khôi phục', bodyHTML: `<p>Dữ liệu hiện tại sẽ được thay bằng nội dung tệp <b>${esc(file.name)}</b>.</p>` });
      if (!ok) return;
      Sync.snapshotNext();
      Store.replace(data);
      App.rerender();
      UI.toast('Khôi phục dữ liệu thành công', 'success');
    } catch (e) {
      UI.toast('Tệp không hợp lệ — hãy chọn tệp JSON được sao lưu từ ứng dụng này.', 'error');
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();     // hiện ngay dữ liệu đang có trên máy
  Sync.start();   // rồi kết nối máy chủ để lấy / đẩy dữ liệu mới nhất
});
