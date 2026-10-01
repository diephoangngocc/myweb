'use strict';
/* =====================================================================
 * PHÂN VÙNG 2 — TÀI CHÍNH (Smart Financial & Fan Tracker)
 *   A. Tổng quan        — Thu nhập · Chi tiêu · Số dư thực tế · Nợ còn lại · Quỹ tiết kiệm/Concert
 *   B. Sổ giao dịch     — thêm / sửa trực tiếp / xoá, lọc tháng & danh mục, xuất CSV
 *   C. Ngân sách tháng  — hạn mức theo danh mục, % đã dùng, cảnh báo vàng 80% / đỏ 100%
 *   D. Khoản nợ         — tổng, đã trả, còn lại, đáo hạn, “Ghi nhận trả bớt”, hoàn thành
 *   E. Tiết kiệm (quỹ & mục tiêu fan) — mục tiêu, đã tích luỹ, “Nạp thêm” / “Rút”, gợi ý cần nạp mỗi tháng
 *   F. Hoá đơn định kỳ  — Đã trả / Chưa trả theo tháng, nhắc hạn
 *
 * Nguồn dữ liệu duy nhất cho tiền mặt là sổ giao dịch + lịch sử quỹ:
 *   Số dư thực tế = Số dư đầu kỳ + Σ thu − Σ chi − Σ tiền nạp vào quỹ + Σ tiền rút về
 *   Trả nợ / thanh toán hoá đơn tạo giao dịch “Trả nợ” / “Hoá đơn” có liên kết (link) tới khoản nợ / hoá đơn.
 * ===================================================================== */

const Fin = {
  curMonth: () => D.today().slice(0, 7),
  monthLabel(k) { if (k === 'all') return 'Tất cả thời gian'; const [y, m] = k.split('-'); return `Tháng ${+m}/${y}`; },
  monthShort(k) { const [y, m] = k.split('-'); return `T${+m}/${y.slice(2)}`; },
  shiftMonth(k, n) { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; },
  viewMonth() { const p = S().finance.period; return p === 'all' ? this.curMonth() : p; },
  inPeriod(t, p) { return p === 'all' || t.date.startsWith(p); },
  upTo(date, upto) { return !upto || date.slice(0, 7) <= upto; },
  cat: id => byId(FIN_CATS, id),
  type: id => byId(TX_TYPES, id),
  fundKind: id => byId(FUND_KINDS, id),
  billKind: id => byId(BILL_KINDS, id),
  expenseCats: () => FIN_CATS.filter(c => c.kind !== 'income'),

  periodOptions() {
    const F = S().finance, set = new Set(F.txs.map(t => t.date.slice(0, 7)));
    set.add(this.curMonth());
    if (F.period !== 'all') set.add(F.period);
    return [...set].sort().reverse();
  },
  totals(list) {
    let inc = 0, exp = 0;
    list.forEach(t => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
    return { inc, exp, net: inc - exp, n: list.length };
  },
  byCat(list, type = 'expense') {
    const m = {};
    FIN_CATS.forEach(c => { m[c.id] = 0; });
    list.forEach(t => { if (t.type === type) m[t.cat] += t.amount; });
    return m;
  },

  /* ---------- Quỹ ---------- */
  fundSaved(f, upto = null) { return f.entries.reduce((s, e) => (this.upTo(e.date, upto) ? s + e.amount : s), 0); },
  fundsTotal(upto = null) { return S().finance.funds.reduce((s, f) => s + this.fundSaved(f, upto), 0); },
  fundCashOut(upto = null) {
    let s = 0;
    S().finance.funds.forEach(f => f.entries.forEach(e => { if (!e.external && this.upTo(e.date, upto)) s += e.amount; }));
    return s;
  },
  fundPlan(f) {
    const saved = this.fundSaved(f), left = Math.max(0, f.target - saved);
    const pct = f.target ? Math.min(100, Math.round((saved / f.target) * 100)) : 0;
    let days = null, perMonth = null, perWeek = null;
    if (f.deadline) {
      days = D.diff(D.today(), f.deadline);
      if (left > 0 && days > 0) { perMonth = Math.min(left, Math.ceil(left / Math.max(1, days / 30.44) / 10000) * 10000); perWeek = Math.min(left, Math.ceil(left / Math.max(1, days / 7) / 1000) * 1000); }
    }
    return { saved, left, pct, days, perMonth, perWeek, reached: f.target > 0 && saved >= f.target };
  },

  /* ---------- Tiền mặt ---------- */
  cash(upto = null) {
    const F = S().finance;
    let b = Number(F.opening) || 0;
    F.txs.forEach(t => { if (this.upTo(t.date, upto)) b += t.type === 'income' ? t.amount : -t.amount; });
    return b - this.fundCashOut(upto);
  },

  /* ---------- Nợ ---------- */
  debtTxs(d) { return S().finance.txs.filter(t => t.link && t.link.kind === 'debt' && t.link.id === d.id); },
  debtPaid(d, upto = null) { return d.initialPaid + this.debtTxs(d).reduce((s, t) => (this.upTo(t.date, upto) ? s + t.amount : s), 0); },
  debtRemaining(d, upto = null) { return Math.max(0, d.total - this.debtPaid(d, upto)); },
  debtDone(d) { return d.closed || (d.total > 0 && this.debtRemaining(d) === 0); },
  debtsTotal(upto = null) {
    return S().finance.debts.reduce((s, d) => {
      if (upto && d.created.slice(0, 7) > upto) return s;
      if (!upto && this.debtDone(d)) return s;
      if (d.closed && !upto) return s;
      return s + this.debtRemaining(d, upto);
    }, 0);
  },
  activeDebts() { return S().finance.debts.filter(d => !this.debtDone(d)); },
  /**
   * Số nợ cần trả trong tháng k của một khoản:
   *  - Hạn cuối (Ngày đáo hạn) rơi vào tháng k hoặc đã qua → phải trả hết phần còn lại.
   *  - Có “Trả mỗi tháng” → cần trả min(số mỗi tháng, phần còn lại); hạn kỳ = ngày của Ngày đáo hạn trong tháng k.
   *  - Không có cả hai → tháng này không có kỳ trả.
   */
  debtMonth(d, k = this.curMonth()) {
    const txs = this.debtTxs(d);
    const paid = txs.filter(t => t.date.startsWith(k)).reduce((s, t) => s + t.amount, 0);
    const before = d.initialPaid + txs.filter(t => t.date.slice(0, 7) < k).reduce((s, t) => s + t.amount, 0);
    const remStart = Math.max(0, d.total - before);
    const out = { need: 0, paid, left: 0, due: '', kind: 'none', remStart };
    if (d.created.slice(0, 7) > k && !paid) return out;
    if (d.closed || remStart === 0) { out.need = paid; out.kind = paid ? 'done' : 'none'; return out; }
    if (D.valid(d.due) && d.due.slice(0, 7) <= k) { out.need = remStart; out.due = d.due; out.kind = 'final'; }
    else if (d.monthly > 0) {
      out.need = Math.min(d.monthly, remStart); out.kind = 'monthly';
      if (D.valid(d.due)) { const [y, m] = k.split('-').map(Number); out.due = `${k}-${pad(Math.min(+d.due.slice(8, 10), D.dim(y, m)))}`; }
    }
    out.left = Math.max(0, out.need - paid);
    return out;
  },
  debtsMonth(k = this.curMonth()) {
    let need = 0, paid = 0, left = 0, n = 0;
    S().finance.debts.forEach(d => {
      const m = this.debtMonth(d, k);
      if (!m.need) return;
      need += m.need; paid += Math.min(m.paid, m.need); left += m.left; n++;
    });
    return { need, paid, left, n };
  },
  monthChip(m) {
    if (m.kind === 'none') return '<span class="due-chip">Không có kỳ trả</span>';
    if (!m.left) return '<span class="due-chip ok">✓ Đã trả đủ</span>';
    if (!m.due) return `<span class="due-chip warn">Còn ${fmtShort(m.left)}</span>`;
    const n = D.diff(D.today(), m.due);
    const when = n < 0 ? `trễ ${-n} ngày` : n === 0 ? 'hạn hôm nay' : `hạn ${D.dm(D.parse(m.due))}`;
    return `<span class="due-chip ${n < 0 ? 'late' : n <= 7 ? 'warn' : ''}">Còn ${fmtShort(m.left)} · ${when}</span>`;
  },

  /* ---------- Hoá đơn ---------- */
  billTx(b, month) { return S().finance.txs.find(t => t.link && t.link.kind === 'bill' && t.link.id === b.id && t.link.month === month) || null; },
  billDueDate(b, month) { const [y, m] = month.split('-').map(Number); return `${month}-${pad(Math.min(b.dueDay, D.dim(y, m)))}`; },
  billStatus(b, month) {
    const tx = this.billTx(b, month), due = this.billDueDate(b, month), days = D.diff(D.today(), due);
    const state = tx ? 'paid' : days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'todo';
    return { tx, due, days, state };
  },
  billsSummary(month) {
    let total = 0, paid = 0, overdue = 0;
    S().finance.bills.forEach(b => {
      const st = this.billStatus(b, month);
      total += b.amount;
      if (st.tx) paid += st.tx.amount; else if (st.state === 'overdue') overdue++;
    });
    return { total, paid, left: Math.max(0, total - paid), overdue, n: S().finance.bills.length, nPaid: S().finance.bills.filter(b => this.billTx(b, month)).length };
  },

  netWorth() { return this.cash() + this.fundsTotal() - this.debtsTotal(); },

  series(endKey, n = 6) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = this.shiftMonth(endKey, -i);
      out.push({ key: k, ...this.totals(S().finance.txs.filter(t => t.date.startsWith(k))), cash: this.cash(k), funds: this.fundsTotal(k), debt: this.debtsTotal(k) });
    }
    return out;
  },
  /** Danh sách kèm chỉ số thật trong mảng (để sửa trực tiếp qua data-path), mới nhất trước */
  indexed(list = S().finance.txs) {
    const pos = new Map(S().finance.txs.map((t, i) => [t, i]));
    return list.map(t => ({ t, idx: pos.get(t) })).sort((a, b) => b.t.date.localeCompare(a.t.date) || b.idx - a.idx);
  },

  /* ---------- Ngân sách ---------- */
  budgets(k = this.viewMonth()) {
    const spent = this.byCat(S().finance.txs.filter(t => t.date.startsWith(k)));
    return this.expenseCats().map(c => {
      const budget = Number(S().finance.budgets[c.id]) || 0, sp = spent[c.id] || 0;
      const pct = budget ? Math.round((sp / budget) * 100) : 0;
      return { ...c, budget, spent: sp, pct, level: !budget ? 'none' : pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
    });
  },
  overBudget(k = this.curMonth()) { return this.budgets(k).filter(b => b.level === 'over'); },
  avgSpend(catId, k = this.viewMonth(), months = 3) {
    let s = 0, n = 0;
    for (let i = 1; i <= months; i++) {
      const m = this.shiftMonth(k, -i);
      if (!S().finance.txs.some(t => t.date.startsWith(m))) continue;
      n++;
      s += S().finance.txs.filter(t => t.date.startsWith(m) && t.type === 'expense' && t.cat === catId).reduce((a, t) => a + t.amount, 0);
    }
    return n ? Math.round(s / n) : 0;
  },
  pctChange(cur, prev) { if (!prev) return null; return Math.round(((cur - prev) / prev) * 100); },

  /* ---------- HTML dùng chung ---------- */
  controlsHTML() {
    const p = S().finance.period;
    return `<div class="seg">
        <button class="icon-btn" data-action="fin-step" data-dir="-1" title="Tháng trước">${icon('chevL')}</button>
        <select class="sel" data-path="finance.period" aria-label="Chọn kỳ">
          ${this.periodOptions().map(k => `<option value="${k}" ${k === p ? 'selected' : ''}>${this.monthLabel(k)}</option>`).join('')}
          <option value="all" ${p === 'all' ? 'selected' : ''}>Tất cả thời gian</option>
        </select>
        <button class="icon-btn" data-action="fin-step" data-dir="1" title="Tháng sau">${icon('chevR')}</button>
      </div>`;
  },
  amountHTML(t) { return `<span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${fmtNum(t.amount)} ₫</span>`; },
  linkLabel(t) {
    if (!t.link) return '';
    if (t.link.kind === 'debt') { const d = S().finance.debts.find(x => x.id === t.link.id); return `${icon('creditCard', 'w-3 h-3')} ${d ? esc(d.name || 'Khoản nợ') : 'Khoản nợ đã xoá'}`; }
    const b = S().finance.bills.find(x => x.id === t.link.id);
    return `${icon('zap', 'w-3 h-3')} ${b ? esc(b.name || 'Hoá đơn') : 'Hoá đơn đã xoá'} · ${this.monthShort(t.link.month)}`;
  },
  dueBadge(date, done) {
    if (done) return '<span class="due-chip ok">✓ Hoàn thành</span>';
    if (!D.valid(date)) return '<span class="due-chip">Chưa đặt hạn</span>';
    const d = D.diff(D.today(), date);
    if (d < 0) return `<span class="due-chip late">Quá hạn ${-d} ngày</span>`;
    if (d === 0) return '<span class="due-chip warn">Đến hạn hôm nay</span>';
    return `<span class="due-chip ${d <= 7 ? 'warn' : ''}">Còn ${d} ngày</span>`;
  },
  levelColor: lv => ({ ok: '#2FAE84', warn: '#E3A23B', over: '#E5566F', none: '#B7C4DE' }[lv]),

  onChange(path, el, kind) {
    if (path === 'finance.period') { App.modules[App.view].render(); App.renderCycleCard(); return; }
    const mod = App.modules[App.view];
    if (mod && mod.onChange) mod.onChange(path, el, kind);
    App.renderCycleCardSoon();
    App.updateBellSoon();
  },
  /** Vẽ lại phần đang xem sau một hành động (thêm / xoá / nạp …) */
  refreshView() {
    const mod = App.modules[App.view];
    if (mod && mod.refresh) mod.refresh(); else if (mod) mod.render();
    App.renderCycleCard();
    App.updateBell();
  },
};

function finCard({ label, value, ic, th, trend = '', sub = '', spark = null, neg = false, id = '', extra = '' }) {
  return `<div class="fin-card card" style="--accent:${th.accent};--soft:${th.soft};--light:${th.light}">
    <div class="fin-card-top"><div class="icon-tile sm">${icon(ic)}</div><div class="stat-label">${label}</div>${trend}</div>
    <div class="fin-value ${neg ? 'neg' : ''}" ${id ? `id="${id}"` : ''}>${value}</div>
    <div class="fin-card-foot"><div class="stat-sub">${sub}</div>${spark ? sparklineSVG(spark, th.accent, { w: 88, h: 30 }) : ''}</div>
    ${extra ? `<div class="fin-extra">${extra}</div>` : ''}
  </div>`;
}
const TH = {
  green: { accent: '#1F9A6C', soft: '#DDF5EC', light: '#7FD8B6' },
  red: { accent: '#D94F6B', soft: '#FFE3E8', light: '#F5A3B3' },
  blue: { accent: '#3F74E6', soft: '#DCEBFF', light: '#8DB4FF' },
  teal: { accent: '#1F95A5', soft: '#D9F3F6', light: '#7DD0DA' },
  pink: { accent: '#D0489A', soft: '#FCE4F2', light: '#EE9DCB' },
  violet: { accent: '#7A62DE', soft: '#ECE6FF', light: '#B9A9F5' },
  amber: { accent: '#C98A1E', soft: '#FFF1D6', light: '#F5CD83' },
};

/* =====================================================================
 * A. TỔNG QUAN TÀI CHÍNH
 * ===================================================================== */
const FinOverview = {
  chartType: 'doughnut',

  render() {
    const el = $('#view-finance');
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Tổng quan tài chính', `${Fin.monthLabel(S().finance.period)} · thu chi, nợ, quỹ fan và hoá đơn trong một trang`,
        `${Fin.controlsHTML()}<button class="btn btn-primary" data-action="tx-quick">${icon('plus')} Giao dịch mới</button>`)}
      <div class="fin-cards mb-6" id="finCards"></div>
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] mb-6">
        <div class="card p-5 flex flex-col">
          <div class="card-head"><div class="card-title">${icon('bars')} Dòng tiền 6 tháng</div>
            <div class="legend"><span class="legend-item"><i style="background:#6FCFA8"></i>Thu</span><span class="legend-item"><i style="background:#F29BAD"></i>Chi</span><span class="legend-item"><i style="background:#4F86F0;border-radius:99px"></i>Số dư</span><span class="legend-item"><i style="background:#D0489A;border-radius:99px"></i>Quỹ</span></div></div>
          <div class="chart-box chart-fill"><canvas id="finFlow"></canvas></div>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('pie')} Chi tiêu theo danh mục</div>
            <div class="seg-mini">
              <button class="${this.chartType === 'doughnut' ? 'active' : ''}" data-action="fin-chart" data-type="doughnut" title="Biểu đồ tròn">${icon('pie', 'w-4 h-4')}</button>
              <button class="${this.chartType === 'bar' ? 'active' : ''}" data-action="fin-chart" data-type="bar" title="Biểu đồ cột">${icon('bars', 'w-4 h-4')}</button>
            </div></div>
          <div class="chart-box h-56"><canvas id="finCat"></canvas><div class="donut-center" id="finCatCenter"></div></div>
          <div class="cat-legend mt-4" id="finCatLegend"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3 mb-6">
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('piggy')} Tiết kiệm</div><a class="link" href="#funds">Tất cả ${icon('chevR', 'w-4 h-4')}</a></div>
          <div id="ovFunds"></div>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('zap')} Hoá đơn ${Fin.monthLabel(Fin.viewMonth()).toLowerCase()}</div><a class="link" href="#bills">Quản lý ${icon('chevR', 'w-4 h-4')}</a></div>
          <div id="ovBills"></div>
        </div>
        <div class="card p-5 lg:col-span-2 2xl:col-span-1">
          <div class="card-head"><div class="card-title">${icon('creditCard')} Khoản nợ đang trả</div><a class="link" href="#debts">Chi tiết ${icon('chevR', 'w-4 h-4')}</a></div>
          <div id="ovDebts"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('target')} Ngân sách ${Fin.monthLabel(Fin.viewMonth()).toLowerCase()}</div><a class="link" href="#budget">Thiết lập ${icon('chevR', 'w-4 h-4')}</a></div>
          <div id="ovBudget"></div>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('receipt')} Giao dịch gần đây</div><a class="link" href="#transactions">Mở sổ giao dịch ${icon('chevR', 'w-4 h-4')}</a></div>
          <div id="finRecent"></div>
        </div>
      </div>`;
    this.refresh();
  },

  refresh() {
    if (!$('#finCards')) return;
    const F = S().finance, p = F.period;
    const list = F.txs.filter(t => Fin.inPeriod(t, p));
    const tot = Fin.totals(list);
    const ser = Fin.series(Fin.viewMonth(), 6);
    const prev = p === 'all' ? null : Fin.totals(F.txs.filter(t => t.date.startsWith(Fin.shiftMonth(p, -1))));
    $('#finCards').innerHTML = this.cardsHTML(tot, prev, ser);
    this.drawFlow(ser);
    this.drawCat(list);
    this.renderFunds(); this.renderBills(); this.renderDebts(); this.renderBudget(); this.renderRecent(list);
  },
  refreshSoon() { clearTimeout(this._rt); this._rt = setTimeout(() => this.refresh(), 250); },

  cardsHTML(tot, prev, ser) {
    const trend = (cur, old, goodUp) => {
      const c = Fin.pctChange(cur, old);
      if (c === null || !Number.isFinite(c)) return '';
      const up = c >= 0, good = goodUp ? up : !up;
      return `<span class="fin-trend ${good ? 'good' : 'bad'}">${up ? '▲' : '▼'} ${Math.abs(c)}%</span>`;
    };
    const F = S().finance;
    const cash = Fin.cash(), debt = Fin.debtsTotal(), funds = Fin.fundsTotal(), dm = Fin.debtsMonth();
    const target = F.funds.reduce((s, f) => s + f.target, 0);
    const act = Fin.activeDebts().filter(d => d.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    const nIn = F.txs.filter(t => Fin.inPeriod(t, F.period) && t.type === 'income').length;
    const nOut = F.txs.filter(t => Fin.inPeriod(t, F.period) && t.type === 'expense').length;
    return [
      finCard({ label: 'Tổng thu nhập', value: fmtMoney(tot.inc), ic: 'trendUp', th: TH.green, trend: prev ? trend(tot.inc, prev.inc, true) : '', sub: `${nIn} khoản thu`, spark: ser.map(s => s.inc) }),
      finCard({ label: 'Tổng chi tiêu', value: fmtMoney(tot.exp), ic: 'trendDown', th: TH.red, trend: prev ? trend(tot.exp, prev.exp, false) : '', sub: `${nOut} khoản chi · chênh lệch ${fmtShort(tot.net)}`, spark: ser.map(s => s.exp) }),
      finCard({ label: 'Số dư thực tế', id: 'finBalValue', value: fmtMoney(cash), ic: 'wallet', th: TH.blue, neg: cash < 0, spark: ser.map(s => s.cash),
        sub: `Tài sản ròng: <b id="finNetWorth">${fmtMoney(Fin.netWorth())}</b>`,
        extra: `<label title="Số tiền bạn có trước giao dịch đầu tiên — bấm để sửa">Đầu kỳ <input class="ghost-input opening-input" data-path="finance.opening" data-money inputmode="decimal" value="${fmtNum(F.opening)}" aria-label="Số dư đầu kỳ"> ₫</label>` }),
      finCard({ label: 'Khoản nợ còn lại', value: fmtMoney(debt), ic: 'creditCard', th: TH.teal, spark: ser.map(s => s.debt),
        sub: Fin.activeDebts().length ? `${Fin.activeDebts().length} khoản${act ? ` · gần nhất ${D.dm(D.parse(act.due))}` : ''}<br>Tháng này cần trả: <b>${fmtMoney(dm.need)}</b>${dm.need ? (dm.left ? ` · còn ${fmtShort(dm.left)}` : ' ✓') : ''}` : 'Không còn khoản nợ nào' }),
      finCard({ label: 'Quỹ tiết kiệm / Concert', value: fmtMoney(funds), ic: 'piggy', th: TH.pink, spark: ser.map(s => s.funds),
        sub: F.funds.length ? `${F.funds.length} quỹ · đạt ${target ? Math.round((funds / target) * 100) : 0}% mục tiêu` : 'Chưa tạo quỹ nào' }),
    ].join('');
  },

  drawFlow(ser) {
    Charts.make('finFlow', $('#finFlow'), {
      type: 'bar',
      data: {
        labels: ser.map(s => Fin.monthShort(s.key)),
        datasets: [
          { type: 'bar', label: 'Thu', data: ser.map(s => s.inc), backgroundColor: '#6FCFA8', borderRadius: 7, borderSkipped: false, maxBarThickness: 24, order: 3 },
          { type: 'bar', label: 'Chi', data: ser.map(s => s.exp), backgroundColor: '#F29BAD', borderRadius: 7, borderSkipped: false, maxBarThickness: 24, order: 3 },
          { type: 'line', label: 'Số dư thực tế', data: ser.map(s => s.cash), yAxisID: 'y1', borderColor: '#4F86F0', backgroundColor: '#4F86F0', borderWidth: 2.5, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderWidth: 2, order: 1 },
          { type: 'line', label: 'Quỹ', data: ser.map(s => s.funds), yAxisID: 'y1', borderColor: '#D0489A', backgroundColor: '#D0489A', borderWidth: 2, borderDash: [5, 4], tension: 0.35, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderWidth: 2, order: 2 },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: GRID, border: { display: false } },
          y1: { position: 'right', beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: { display: false }, border: { display: false } },
          x: { grid: { display: false }, border: { display: false } },
        },
        plugins: { tooltip: { displayColors: true, callbacks: { label: c => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } } },
      },
    });
  },

  drawCat(list) {
    const by = Fin.byCat(list, 'expense');
    const cats = FIN_CATS.filter(c => by[c.id] > 0).sort((a, b) => by[b.id] - by[a.id]);
    const total = cats.reduce((s, c) => s + by[c.id], 0);
    const center = $('#finCatCenter');
    if (center) center.innerHTML = this.chartType === 'doughnut' && total ? `<b>${fmtShort(total)}</b><span>tổng chi</span>` : '';
    $('#finCatLegend').innerHTML = cats.length ? cats.map(c => `
      <div class="cat-row" style="--accent:${c.accent};--soft:${c.soft}">
        <span class="cat-ico">${icon(c.icon)}</span><span class="cat-name">${c.name}</span>
        <span class="cat-amt">${fmtMoney(by[c.id])}</span><span class="cat-pct">${percent(by[c.id], total)}%</span>
      </div>`).join('') : '<div class="empty">Chưa có khoản chi nào trong kỳ này.</div>';
    const data = cats.map(c => by[c.id]), colors = cats.map(c => c.accent);
    if (this.chartType === 'doughnut') {
      Charts.make('finCat', $('#finCat'), {
        type: 'doughnut',
        data: { labels: cats.map(c => c.name), datasets: [{ data: total ? data : [1], backgroundColor: total ? colors : ['#E9EFFA'], borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }] },
        options: { cutout: '64%', plugins: { tooltip: { enabled: !!total, callbacks: { label: c => ` ${c.label}: ${fmtMoney(c.parsed)} (${percent(c.parsed, total)}%)` } } } },
      });
    } else {
      Charts.make('finCat', $('#finCat'), {
        type: 'bar',
        data: { labels: cats.map(c => c.name), datasets: [{ data, backgroundColor: colors, borderRadius: 8, borderSkipped: false, maxBarThickness: 22 }] },
        options: {
          indexAxis: 'y',
          scales: { x: { beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: GRID, border: { display: false } }, y: { grid: { display: false }, border: { display: false } } },
          plugins: { tooltip: { callbacks: { label: c => ` ${fmtMoney(c.parsed.x)} (${percent(c.parsed.x, total)}%)` } } },
        },
      });
    }
  },

  renderFunds() {
    const box = $('#ovFunds'); if (!box) return;
    const funds = S().finance.funds.slice().sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 4);
    box.innerHTML = funds.length ? funds.map(f => {
      const k = Fin.fundKind(f.kind), pl = Fin.fundPlan(f);
      return `<div class="ov-fund" style="--accent:${k.accent};--soft:${k.soft};--light:${k.light}">
        <span class="cat-ico">${icon(k.icon)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between gap-2"><b class="truncate">${esc(f.name || 'Quỹ chưa đặt tên')}</b><span class="ov-pct">${pl.pct}%</span></div>
          <div class="progress thin my-1"><div class="bar" style="width:${pl.pct}%"></div></div>
          <div class="ov-sub">${fmtShort(pl.saved)} / ${fmtShort(f.target)}${pl.perMonth ? ` · cần ~${fmtShort(pl.perMonth)}/tháng` : pl.reached ? ' · đã đạt mục tiêu 🎉' : ''}</div>
        </div>
        <button class="btn btn-soft btn-sm" data-action="fund-deposit" data-id="${f.id}" title="Nạp thêm tiền vào quỹ">${icon('arrowDown')} Nạp</button>
      </div>`;
    }).join('') : emptyHTML('Chưa có quỹ nào — tạo “Quỹ Concert” đầu tiên ở mục Tiết kiệm.', 'piggy');
  },

  renderBills() {
    const box = $('#ovBills'); if (!box) return;
    const m = Fin.viewMonth(), bills = S().finance.bills, sum = Fin.billsSummary(m);
    if (!bills.length) { box.innerHTML = emptyHTML('Chưa có hoá đơn định kỳ nào.', 'zap'); return; }
    box.innerHTML = `<div class="flex justify-between text-sm mb-1"><span class="muted">Đã trả ${sum.nPaid}/${sum.n}</span><b>${fmtShort(sum.paid)} / ${fmtShort(sum.total)}</b></div>
      <div class="progress thin mb-3"><div class="bar" style="width:${percent(sum.paid, sum.total)}%"></div></div>
      ${bills.slice().sort((a, b) => a.dueDay - b.dueDay).map(b => {
        const st = Fin.billStatus(b, m), k = Fin.billKind(b.kind);
        return `<label class="ov-bill ${st.state}" style="--accent:${k.accent};--soft:${k.soft}">
          <input type="checkbox" class="cbx round" data-action="bill-toggle" data-id="${b.id}" ${st.tx ? 'checked' : ''} aria-label="Đã trả ${esc(b.name)}">
          <span class="truncate">${esc(b.name || k.name)}</span><span class="ov-bill-amt">${fmtShort(b.amount)}</span>${this.billChip(st)}</label>`;
      }).join('')}`;
  },
  billChip(st) {
    if (st.state === 'paid') return '<span class="due-chip ok">Đã trả</span>';
    if (st.state === 'overdue') return `<span class="due-chip late">Quá hạn ${-st.days}n</span>`;
    if (st.state === 'soon') return `<span class="due-chip warn">${st.days === 0 ? 'Hôm nay' : 'Còn ' + st.days + 'n'}</span>`;
    return `<span class="due-chip">${D.dm(D.parse(st.due))}</span>`;
  },

  renderDebts() {
    const box = $('#ovDebts'); if (!box) return;
    const list = Fin.activeDebts().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 4);
    box.innerHTML = list.length ? list.map(d => {
      const paid = Fin.debtPaid(d), rem = Fin.debtRemaining(d), pct = d.total ? Math.round((paid / d.total) * 100) : 0;
      return `<div class="ov-debt">
        <span class="cat-ico" style="--accent:#1F95A5;--soft:#D9F3F6">${icon('creditCard')}</span>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between gap-2"><b class="truncate">${esc(d.name || 'Khoản nợ')}</b><span class="ov-rem">${fmtShort(rem)}</span></div>
          <div class="progress thin my-1" style="--accent:#1F95A5;--light:#7DD0DA"><div class="bar" style="width:${pct}%"></div></div>
          <div class="ov-sub">Đã trả ${pct}% · ${Fin.dueBadge(d.due, false)}${Fin.debtMonth(d).need ? ` · tháng này ${Fin.monthChip(Fin.debtMonth(d))}` : ''}</div>
        </div>
        <button class="btn btn-soft btn-sm" data-action="debt-pay" data-id="${d.id}">Trả bớt</button>
      </div>`;
    }).join('') : emptyHTML('Không có khoản nợ nào đang trả. Tuyệt vời!', 'creditCard');
  },

  renderBudget() {
    const box = $('#ovBudget'); if (!box) return;
    const list = Fin.budgets().filter(b => b.budget > 0);
    box.innerHTML = list.length ? list.map(b => `
      <div class="ov-bud ${b.level}" style="--accent:${b.accent};--soft:${b.soft}">
        <span class="cat-ico">${icon(b.icon)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between gap-2"><b class="truncate">${b.name}</b><span>${fmtShort(b.spent)} / ${fmtShort(b.budget)}</span></div>
          <div class="progress thin mt-1"><div class="bar" style="width:${Math.min(100, b.pct)}%;background:${Fin.levelColor(b.level)}"></div></div>
        </div>
        <span class="bud-pct ${b.level}">${b.pct}%</span>
      </div>`).join('') : emptyHTML('Chưa đặt ngân sách — vào mục Ngân sách để đặt hạn mức cho từng danh mục.', 'target');
  },

  renderRecent(list) {
    const box = $('#finRecent'); if (!box) return;
    const rows = Fin.indexed(list).slice(0, 6);
    box.innerHTML = rows.length ? rows.map(({ t }) => {
      const c = Fin.cat(t.cat);
      return `<div class="recent-tx" style="--accent:${c.accent};--soft:${c.soft}">
        <span class="cat-ico lg">${icon(c.icon)}</span>
        <div class="min-w-0 flex-1"><div class="recent-desc">${esc(t.desc || c.name)}</div><div class="recent-meta">${D.dmy(D.parse(t.date))} · ${c.name}</div></div>
        ${Fin.amountHTML(t)}</div>`;
    }).join('') : emptyHTML('Chưa có giao dịch nào trong kỳ này. Bấm “Giao dịch mới” để thêm.', 'receipt');
  },

  onChange(path) {
    if (path === 'finance.opening') {
      const v = $('#finBalValue');
      if (v) { const b = Fin.cash(); v.textContent = fmtMoney(b); v.classList.toggle('neg', b < 0); }
      setText('#finNetWorth', fmtMoney(Fin.netWorth()));
      clearTimeout(this._ot);
      this._ot = setTimeout(() => this.drawFlow(Fin.series(Fin.viewMonth(), 6)), 300);
      return;
    }
    this.refreshSoon();
  },
};

/* =====================================================================
 * B. SỔ GIAO DỊCH
 * ===================================================================== */
const FinLedger = {
  newType: 'expense',

  render() {
    const el = $('#view-transactions');
    const F = S().finance;
    const defDate = F.period === 'all' || F.period === Fin.curMonth() ? D.today() : `${F.period}-01`;
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Sổ giao dịch', `${Fin.monthLabel(F.period)} · bấm vào bất kỳ ô nào để sửa trực tiếp`,
        `${Fin.controlsHTML()}<button class="btn btn-soft" data-action="tx-export">${icon('download')} Xuất CSV</button>`)}
      <div class="card p-5 mb-5">
        <div class="card-title mb-3">${icon('plus')} Thêm giao dịch</div>
        <div class="tx-form">
          <label class="field"><span>Ngày</span><input type="date" id="txDate" class="date-input" value="${defDate}"></label>
          <label class="field tx-f-desc"><span>Mô tả / tên giao dịch</span><input id="txDesc" class="field-input" placeholder="VD: Vé phòng trà cuối tuần" maxlength="120"></label>
          <div class="field"><span>Loại</span>
            <div class="type-toggle" id="txType">
              <button class="${this.newType === 'expense' ? 'active' : ''}" data-action="tx-type" data-type="expense">${icon('trendDown', 'w-4 h-4')} Chi</button>
              <button class="${this.newType === 'income' ? 'active' : ''}" data-action="tx-type" data-type="income">${icon('trendUp', 'w-4 h-4')} Thu</button>
            </div></div>
          <label class="field"><span>Danh mục</span><select id="txCat" class="field-input">${optionsHTML(FIN_CATS, this.newType === 'income' ? 'salary' : 'food')}</select></label>
          <label class="field"><span>Số tiền (₫)</span><input id="txAmt" class="field-input tx-amt-input" inputmode="decimal" placeholder="VD: 50k · 1,5tr · 250.000"></label>
          <button class="btn btn-primary tx-add-btn" data-action="tx-add">${icon('plus')} Thêm</button>
        </div>
      </div>
      <div class="card p-0 overflow-hidden">
        <div class="tx-toolbar">
          <div class="type-pills">${[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']].map(([v, n]) => `<button class="${F.filter.type === v ? 'active' : ''}" data-action="tx-filter-type" data-type="${v}">${n}</button>`).join('')}</div>
          <select class="field-input tx-filter-cat" data-path="finance.filter.cat" aria-label="Lọc danh mục">
            <option value="all" ${F.filter.cat === 'all' ? 'selected' : ''}>Mọi danh mục</option>${optionsHTML(FIN_CATS, F.filter.cat)}
          </select>
          <div class="tx-search">${icon('search', 'w-4 h-4')}<input class="field-input" data-path="finance.filter.q" value="${esc(F.filter.q)}" placeholder="Tìm mô tả..."></div>
          <div class="flex-1"></div>
          <div class="tx-sum" id="txSum"></div>
        </div>
        <div class="tx-head"><span>Ngày</span><span>Mô tả / Tên giao dịch</span><span>Loại</span><span>Danh mục</span><span class="text-right">Số tiền</span><span></span></div>
        <div id="txList"></div>
      </div>`;
    this.renderList();
  },
  refresh() { this.renderList(); },

  filtered() {
    const F = S().finance, q = fold(F.filter.q.trim());
    return F.txs.filter(t => Fin.inPeriod(t, F.period)
      && (F.filter.type === 'all' || t.type === F.filter.type)
      && (F.filter.cat === 'all' || t.cat === F.filter.cat)
      && (!q || fold(t.desc).includes(q) || fold(Fin.cat(t.cat).name).includes(q)));
  },

  renderList() {
    const box = $('#txList'); if (!box) return;
    const rows = Fin.indexed(this.filtered());
    box.innerHTML = rows.length ? rows.map(({ t, idx }) => this.rowHTML(t, idx)).join('')
      : emptyHTML(S().finance.txs.length ? 'Không có giao dịch nào khớp bộ lọc.' : 'Chưa có giao dịch nào — thêm giao dịch đầu tiên ở khung phía trên.', 'receipt');
    this.updateSum();
  },

  rowHTML(t, idx) {
    const c = Fin.cat(t.cat), ty = Fin.type(t.type), b = `finance.txs.${idx}`;
    return `<div class="tx-row ${t.type}" data-id="${t.id}" style="--accent:${c.accent};--soft:${c.soft}">
      <input type="date" class="date-input sm tx-date" data-path="${b}.date" value="${t.date}" aria-label="Ngày">
      <div class="tx-desc-cell"><input class="ghost-input tx-desc" data-path="${b}.desc" value="${esc(t.desc)}" placeholder="Mô tả giao dịch" aria-label="Mô tả">${t.link ? `<span class="tx-link">${Fin.linkLabel(t)}</span>` : ''}</div>
      <select class="chip-select sm tx-type-sel" data-path="${b}.type" style="${chipStyle(ty)}" aria-label="Loại">${optionsHTML(TX_TYPES, t.type)}</select>
      <select class="chip-select sm tx-cat-sel" data-path="${b}.cat" style="${chipStyle(c)}" aria-label="Danh mục">${optionsHTML(FIN_CATS, t.cat)}</select>
      <div class="tx-amt-wrap"><span class="tx-sign">${t.type === 'income' ? '+' : '−'}</span><input class="ghost-input tx-amt" data-path="${b}.amount" data-money inputmode="decimal" value="${fmtNum(t.amount)}" aria-label="Số tiền"><span class="tx-cur">₫</span></div>
      <button class="icon-btn sm danger" data-action="tx-del" data-id="${t.id}" title="Xoá giao dịch">${icon('trash')}</button>
    </div>`;
  },

  updateSum() {
    const tot = Fin.totals(this.filtered());
    const el = $('#txSum');
    if (el) el.innerHTML = `<span class="sum-in">Thu ${fmtMoney(tot.inc)}</span><span class="sum-out">Chi ${fmtMoney(tot.exp)}</span><span class="sum-net ${tot.net < 0 ? 'neg' : ''}">= ${fmtMoney(tot.net, true)}</span><span class="muted">· ${tot.n} giao dịch</span>`;
  },
  sumSoon() { clearTimeout(this._st); this._st = setTimeout(() => this.updateSum(), 200); },
  listSoon() { clearTimeout(this._lt); this._lt = setTimeout(() => this.renderList(), 250); },

  onChange(path, el, kind) {
    if (path === 'finance.filter.cat') return this.renderList();
    if (path === 'finance.filter.q') return this.listSoon();
    const m = path.match(/^finance\.txs\.(\d+)\.(\w+)$/);
    if (!m) return;
    const t = S().finance.txs[+m[1]], field = m[2], row = el.closest('.tx-row');
    if (field === 'type' && row) {
      row.classList.remove('income', 'expense'); row.classList.add(t.type);
      el.style.cssText = chipStyle(Fin.type(t.type));
      row.querySelector('.tx-sign').textContent = t.type === 'income' ? '+' : '−';
    }
    if (field === 'cat' && row) {
      const c = Fin.cat(t.cat);
      el.style.cssText = chipStyle(c);
      row.style.setProperty('--accent', c.accent); row.style.setProperty('--soft', c.soft);
    }
    if (field === 'date' && kind === 'change') {
      if (!D.valid(t.date)) return;
      if (!Fin.inPeriod(t, S().finance.period)) UI.toast(`Giao dịch đã chuyển sang ${Fin.monthLabel(t.date.slice(0, 7)).toLowerCase()}`, 'info');
      return this.renderList();
    }
    this.sumSoon();
  },
};

/* =====================================================================
 * C. NGÂN SÁCH THÁNG & CẢNH BÁO
 * ===================================================================== */
const FinBudget = {
  render() {
    const el = $('#view-budget');
    const k = Fin.viewMonth();
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Ngân sách tháng', `${Fin.monthLabel(k)} · đặt hạn mức cho từng danh mục chi — vàng khi dùng 80%, đỏ khi vượt 100%`,
        `${Fin.controlsHTML()}<button class="btn btn-soft" data-action="budget-suggest-all" title="Đặt hạn mức theo mức chi trung bình 3 tháng gần nhất">${icon('sparkles')} Gợi ý theo 3 tháng</button>`)}
      ${S().finance.period === 'all' ? '<p class="text-sm muted -mt-3 mb-4">Đang xem “Tất cả thời gian” — số liệu ngân sách tính cho tháng hiện tại.</p>' : ''}
      <div class="fin-cards four mb-6" id="budCards"></div>
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('target')} Hạn mức theo danh mục</div>
            <div class="legend"><span class="legend-item"><i style="background:#2FAE84"></i>&lt; 80%</span><span class="legend-item"><i style="background:#E3A23B"></i>80–100%</span><span class="legend-item"><i style="background:#E5566F"></i>&gt; 100%</span></div></div>
          <div class="space-y-4" id="budList"></div>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('bars')} Ngân sách vs thực chi</div></div>
          <div class="chart-box h-80"><canvas id="budChart"></canvas></div>
        </div>
      </div>`;
    this.renderList();
    this.refresh();
  },

  renderList() {
    const box = $('#budList'); if (!box) return;
    box.innerHTML = Fin.budgets().map(b => {
      const avg = Fin.avgSpend(b.id);
      return `<div class="bud-row" id="bud-${b.id}" style="--accent:${b.accent};--soft:${b.soft};--light:${b.light}">
        <span class="cat-ico">${icon(b.icon)}</span>
        <div class="min-w-0">
          <div class="bud-name">${b.name}</div>
          <div class="bud-sub" id="bud-sub-${b.id}"></div>
        </div>
        <label class="bud-input" title="Hạn mức tháng — bấm để sửa (vd: 3tr, 500k)">
          <span id="bud-spent-${b.id}"></span> / <input class="ghost-input" data-path="finance.budgets.${b.id}" data-money inputmode="decimal" value="${b.budget ? fmtNum(b.budget) : ''}" placeholder="đặt hạn mức"> ₫
        </label>
        <div class="progress thin bud-bar"><div class="bar" id="bud-bar-${b.id}"></div></div>
        <div class="bud-hint">${avg ? `TB 3 tháng: ${fmtMoney(avg)} <button class="link-btn" data-action="budget-suggest" data-cat="${b.id}">Dùng mức này</button>` : 'Chưa đủ dữ liệu để gợi ý'}</div>
      </div>`;
    }).join('');
  },

  refresh() {
    const list = Fin.budgets();
    let tb = 0, ts = 0, nOver = 0, nWarn = 0;
    list.forEach(b => {
      if (b.budget) { tb += b.budget; ts += b.spent; }
      if (b.level === 'over') nOver++; else if (b.level === 'warn') nWarn++;
      const row = $(`#bud-${b.id}`); if (!row) return;
      row.classList.remove('ok', 'warn', 'over', 'none'); row.classList.add(b.level);
      setText(`#bud-spent-${b.id}`, fmtNum(b.spent));
      setBar($(`#bud-bar-${b.id}`), b.budget ? b.pct : 0);
      setText(`#bud-sub-${b.id}`, !b.budget ? (b.spent ? `Đã chi ${fmtMoney(b.spent)} · chưa đặt hạn mức` : 'Chưa đặt hạn mức') : b.level === 'over' ? `⚠ Vượt ${fmtMoney(b.spent - b.budget)} (${b.pct}%)` : `${b.level === 'warn' ? '⚠ Sắp chạm hạn mức · ' : ''}Còn ${fmtMoney(b.budget - b.spent)} · đã dùng ${b.pct}%`);
    });
    const cards = $('#budCards');
    if (cards) cards.innerHTML = [
      finCard({ label: 'Tổng hạn mức', value: fmtMoney(tb), ic: 'target', th: TH.blue, sub: `${list.filter(b => b.budget).length}/${list.length} danh mục đã đặt` }),
      finCard({ label: 'Đã chi (có hạn mức)', value: fmtMoney(ts), ic: 'trendDown', th: TH.red, sub: tb ? `Đã dùng ${Math.round((ts / tb) * 100)}% tổng hạn mức` : '—' }),
      finCard({ label: 'Còn lại', value: fmtMoney(Math.max(0, tb - ts)), ic: 'wallet', th: TH.green, neg: ts > tb && tb > 0, sub: ts > tb && tb ? `Vượt tổng ${fmtMoney(ts - tb)}` : 'Có thể chi thêm trong tháng' }),
      finCard({ label: 'Cảnh báo', value: `${nOver} vượt · ${nWarn} sắp chạm`, ic: 'alert', th: nOver ? TH.red : nWarn ? TH.amber : TH.green, sub: nOver || nWarn ? 'Xem các danh mục màu vàng / đỏ' : 'Mọi danh mục đều trong hạn mức' }),
    ].join('');
    const withB = list.filter(b => b.budget || b.spent);
    Charts.make('budChart', $('#budChart'), {
      type: 'bar',
      data: {
        labels: withB.map(b => b.name),
        datasets: [
          { label: 'Hạn mức', data: withB.map(b => b.budget), backgroundColor: '#DCE6F7', borderRadius: 7, borderSkipped: false, maxBarThickness: 18 },
          { label: 'Thực chi', data: withB.map(b => b.spent), backgroundColor: withB.map(b => Fin.levelColor(b.level === 'none' ? 'ok' : b.level)), borderRadius: 7, borderSkipped: false, maxBarThickness: 18 },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: GRID, border: { display: false } }, y: { grid: { display: false }, border: { display: false } } },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } }, tooltip: { displayColors: true, callbacks: { label: c => ` ${c.dataset.label}: ${fmtMoney(c.parsed.x)}` } } },
      },
    });
  },
  refreshSoon() { clearTimeout(this._rt); this._rt = setTimeout(() => this.refresh(), 200); },
  onChange(path) { if (path.startsWith('finance.budgets.')) this.refreshSoon(); },
};

/* =====================================================================
 * D. KHOẢN VAY & KHOẢN NỢ
 * ===================================================================== */
const FinDebts = {
  render() {
    const el = $('#view-debts');
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Khoản vay &amp; khoản nợ', 'Theo dõi số đã trả, số còn lại và ngày đáo hạn — mỗi lần trả được ghi vào sổ giao dịch (danh mục “Trả nợ”)',
        `<button class="btn btn-primary" data-action="debt-add">${icon('plus')} Thêm khoản nợ</button>`)}
      <div class="fin-cards mb-6" id="debtCards"></div>
      <div class="card p-0 overflow-hidden debt-table mb-6">
        <div class="debt-head"><span>Tên khoản nợ</span><span>Tổng số tiền</span><span>Đã trả</span><span>Còn lại</span><span>Cần trả tháng này</span><span>Ngày đáo hạn</span><span></span></div>
        <div id="debtList"></div>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div class="card p-5">
          <div class="card-title mb-2">${icon('pie')} Tiến độ trả nợ</div>
          <div class="chart-box h-56"><canvas id="debtChart"></canvas><div class="donut-center" id="debtCenter"></div></div>
          <p class="text-sm muted mt-3">Mẹo: bấm “Ghi nhận trả bớt” mỗi lần trả. Xoá giao dịch “Trả nợ” trong sổ giao dịch cũng tự cập nhật lại số đã trả.</p>
        </div>
        <div class="card p-5">
          <div class="card-head"><div class="card-title">${icon('bars')} Số tiền trả nợ 6 tháng gần nhất</div></div>
          <div class="chart-box h-72"><canvas id="debtMonthly"></canvas></div>
        </div>
      </div>`;
    this.renderList();
  },
  refresh() { this.renderList(); },

  sorted() {
    const F = S().finance;
    return F.debts.map((d, idx) => ({ d, idx })).sort((a, b) => {
      const da = Fin.debtDone(a.d), db = Fin.debtDone(b.d);
      if (da !== db) return da ? 1 : -1;
      return (a.d.due || '9999').localeCompare(b.d.due || '9999');
    });
  },

  renderList() {
    const box = $('#debtList'); if (!box) return;
    const rows = this.sorted();
    box.innerHTML = rows.length ? rows.map(({ d, idx }) => this.rowHTML(d, idx)).join('') : emptyHTML('Chưa có khoản nợ nào. Bấm “Thêm khoản nợ” để bắt đầu theo dõi.', 'creditCard');
    this.updateSummary();
  },

  rowHTML(d, idx) {
    const b = `finance.debts.${idx}`, done = Fin.debtDone(d);
    const paid = Fin.debtPaid(d), rem = Fin.debtRemaining(d), pct = d.total ? Math.min(100, Math.round((paid / d.total) * 100)) : 0;
    const txs = Fin.debtTxs(d).sort((x, y) => y.date.localeCompare(x.date));
    return `<div class="debt-row ${done ? 'done' : ''}" id="debt-${d.id}">
      <div class="debt-name">
        <span class="cat-ico" style="--accent:${done ? '#23996F' : '#1F95A5'};--soft:${done ? '#DDF5EC' : '#D9F3F6'}">${icon(done ? 'checkCircle' : 'creditCard')}</span>
        <div class="min-w-0 flex-1">
          <input class="ghost-input debt-title" data-path="${b}.name" value="${esc(d.name)}" title="${esc(d.name)}" placeholder="Tên khoản nợ (vd: Trả góp điện thoại)">
          <input class="ghost-input debt-lender" data-path="${b}.lender" value="${esc(d.lender)}" placeholder="Chủ nợ / ghi chú">
        </div>
      </div>
      <div class="debt-cell"><small>Tổng số tiền</small><div class="money-edit"><input class="ghost-input" data-path="${b}.total" data-money inputmode="decimal" value="${fmtNum(d.total)}"> ₫</div></div>
      <div class="debt-cell"><small>Đã trả</small><b class="paid" id="debt-paid-${d.id}">${fmtMoney(paid)}</b>
        <div class="progress thin mt-1" style="--accent:#1F95A5;--light:#7DD0DA"><div class="bar" id="debt-bar-${d.id}" style="width:${pct}%"></div></div></div>
      <div class="debt-cell"><small>Còn lại</small><b class="rem" id="debt-rem-${d.id}">${fmtMoney(rem)}</b><span class="debt-pct" id="debt-pct-${d.id}">${pct}% đã trả</span></div>
      <div class="debt-cell debt-month"><small>Cần trả tháng này</small>${this.monthHTML(d)}
        <label class="debt-monthly" title="Số tiền phải trả mỗi tháng (trả góp). Bỏ trống nếu trả một lần vào ngày đáo hạn.">Mỗi tháng <span class="money-edit"><input class="ghost-input" data-path="${b}.monthly" data-money inputmode="decimal" value="${d.monthly ? fmtNum(d.monthly) : ''}" placeholder="—"> ₫</span></label></div>
      <div class="debt-cell"><small>Ngày đáo hạn</small><input type="date" class="date-input sm" data-path="${b}.due" value="${d.due}"><div id="debt-due-${d.id}">${Fin.dueBadge(d.due, done)}</div></div>
      <div class="debt-actions">
        ${done ? `<button class="btn btn-soft btn-sm" data-action="debt-reopen" data-id="${d.id}">Mở lại</button>`
          : `<button class="btn btn-primary btn-sm" data-action="debt-pay" data-id="${d.id}">${icon('arrowDown')} Ghi nhận trả bớt</button>
             <button class="btn btn-soft btn-sm" data-action="debt-done" data-id="${d.id}" title="Đánh dấu đã trả hết">${icon('check')} Hoàn thành</button>`}
        <button class="icon-btn sm danger" data-action="debt-del" data-id="${d.id}" title="Xoá khoản nợ">${icon('trash')}</button>
      </div>
      ${txs.length || d.initialPaid ? `<details class="debt-hist"><summary>Lịch sử trả (${txs.length + (d.initialPaid ? 1 : 0)})</summary><div>
        ${txs.map(t => `<div class="hist-line"><span>${D.dmy(D.parse(t.date))}</span><span class="truncate">${esc(t.desc)}</span><b>−${fmtNum(t.amount)} ₫</b></div>`).join('')}
        ${d.initialPaid ? `<div class="hist-line"><span>${D.dmy(D.parse(d.created))}</span><span>Đã trả trước khi theo dõi</span><b>−${fmtNum(d.initialPaid)} ₫</b></div>` : ''}
      </div></details>` : ''}
    </div>`;
  },

  monthHTML(d) {
    const m = Fin.debtMonth(d), chip = Fin.debtDone(d) && !m.paid ? '' : Fin.monthChip(m);
    return `<div id="debt-month-${d.id}"><b class="need">${m.need ? fmtMoney(m.need) : '—'}</b><div>${chip}</div></div>`;
  },

  updateRow(d) {
    const done = Fin.debtDone(d), paid = Fin.debtPaid(d), rem = Fin.debtRemaining(d), pct = d.total ? Math.min(100, Math.round((paid / d.total) * 100)) : 0;
    setText(`#debt-paid-${d.id}`, fmtMoney(paid)); setText(`#debt-rem-${d.id}`, fmtMoney(rem)); setText(`#debt-pct-${d.id}`, `${pct}% đã trả`);
    setBar($(`#debt-bar-${d.id}`), pct);
    const due = $(`#debt-due-${d.id}`); if (due) due.innerHTML = Fin.dueBadge(d.due, done);
    const mo = $(`#debt-month-${d.id}`); if (mo) mo.outerHTML = this.monthHTML(d);
  },

  updateSummary() {
    const F = S().finance, act = Fin.activeDebts();
    const total = act.reduce((s, d) => s + d.total, 0), paid = act.reduce((s, d) => s + Math.min(d.total, Fin.debtPaid(d)), 0), rem = Fin.debtsTotal();
    const next = act.filter(d => d.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    const k = Fin.curMonth(), paidMonth = F.txs.filter(t => t.cat === 'debt' && t.type === 'expense' && t.date.startsWith(k)).reduce((s, t) => s + t.amount, 0);
    const mon = Fin.debtsMonth(k);
    const cards = $('#debtCards');
    if (cards) cards.innerHTML = [
      finCard({ label: 'Tổng nợ đang trả', value: fmtMoney(total), ic: 'creditCard', th: TH.teal, sub: `${act.length} khoản · ${F.debts.length - act.length} đã hoàn thành` }),
      finCard({ label: 'Đã trả', value: fmtMoney(paid), ic: 'checkCircle', th: TH.green, sub: `Tháng này đã trả ${fmtMoney(paidMonth)}` }),
      finCard({ label: 'Còn lại', value: fmtMoney(rem), ic: 'hourglass', th: TH.red, sub: total ? `Đã trả ${Math.round((paid / total) * 100)}% tổng nợ` : 'Không còn nợ' }),
      finCard({ label: `Cần trả ${Fin.monthLabel(k).toLowerCase()}`, value: fmtMoney(mon.need), ic: 'wallet', th: mon.left ? TH.amber : TH.green,
        sub: !mon.need ? 'Không có kỳ trả nợ nào trong tháng' : mon.left ? `Đã trả ${fmtMoney(mon.paid)} · <b>còn ${fmtMoney(mon.left)}</b>` : `Đã trả đủ ${mon.n} khoản tháng này 🎉`,
        extra: mon.need ? `<div class="progress thin" style="--accent:${mon.left ? '#C98A1E' : '#1F9A6C'};--light:${mon.left ? '#F5CD83' : '#7FD8B6'}"><div class="bar" style="width:${percent(mon.paid, mon.need)}%"></div></div>` : '' }),
      finCard({ label: 'Đáo hạn gần nhất', value: next ? D.dmy(D.parse(next.due)) : '—', ic: 'calendar', th: TH.amber, sub: next ? `${esc(next.name || 'Khoản nợ')} · ${Fin.dueBadge(next.due, false)}` : 'Không có hạn sắp tới' }),
    ].join('');
    const center = $('#debtCenter');
    if (center) center.innerHTML = total ? `<b>${Math.round((paid / total) * 100)}%</b><span>đã trả</span>` : '<b>0</b><span>khoản nợ</span>';
    Charts.make('debtChart', $('#debtChart'), {
      type: 'doughnut',
      data: { labels: ['Đã trả', 'Còn lại'], datasets: [{ data: total ? [paid, rem] : [1], backgroundColor: total ? ['#6FD0A8', '#F29BAD'] : ['#E9EFFA'], borderWidth: 3, borderColor: '#fff' }] },
      options: { cutout: '68%', plugins: { legend: { display: !!total, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } }, tooltip: { enabled: !!total, callbacks: { label: c => ` ${c.label}: ${fmtMoney(c.parsed)}` } } } },
    });
    const months = Array.from({ length: 6 }, (_, i) => Fin.shiftMonth(k, i - 5));
    const paidBy = months.map(m => F.txs.filter(t => t.cat === 'debt' && t.type === 'expense' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0));
    Charts.make('debtMonthly', $('#debtMonthly'), {
      type: 'bar',
      data: { labels: months.map(m => Fin.monthShort(m)), datasets: [{ label: 'Đã trả', data: paidBy, backgroundColor: months.map(m => (m === k ? '#1F95A5' : '#8FD3DC')), borderRadius: 8, borderSkipped: false, maxBarThickness: 42 }] },
      options: {
        scales: { y: { beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: GRID, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } },
        plugins: { tooltip: { callbacks: { label: c => ` Đã trả: ${fmtMoney(c.parsed.y)}` } } },
      },
    });
  },
  summarySoon() { clearTimeout(this._st); this._st = setTimeout(() => this.updateSummary(), 250); },

  onChange(path, el, kind) {
    const m = path.match(/^finance\.debts\.(\d+)\.(\w+)$/);
    if (!m) return;
    const d = S().finance.debts[+m[1]];
    if (!d) return;
    if (m[2] === 'total' || m[2] === 'due' || m[2] === 'monthly') {
      this.updateRow(d);
      if (m[2] === 'monthly') { this.summarySoon(); return; }
      if (kind === 'change' || m[2] === 'total') this.summarySoon();
      if (Fin.debtDone(d) !== $(`#debt-${d.id}`)?.classList.contains('done') && kind !== 'input') this.renderList();
    }
  },
};

/* =====================================================================
 * E. QUỸ TIẾT KIỆM & MỤC TIÊU CONCERT / PHÒNG TRÀ IDOL
 * ===================================================================== */
const FinFunds = {
  render() {
    const el = $('#view-funds');
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Tiết kiệm', 'Quỹ Concert, Phòng trà, Album/Merch, Khẩn cấp… — “Nạp thêm” sẽ trừ vào số dư thực tế và cộng vào quỹ',
        `<button class="btn btn-primary" data-action="fund-add">${icon('plus')} Tạo quỹ mới</button>`)}
      <div class="fin-cards four mb-6" id="fundCards"></div>
      <div class="fund-grid" id="fundGrid"></div>
      <div class="card p-5 mt-6">
        <div class="card-head"><div class="card-title">${icon('bars')} Tiến độ các quỹ</div></div>
        <div class="chart-box" id="fundChartBox"><canvas id="fundChart"></canvas></div>
      </div>`;
    this.renderGrid();
  },
  refresh() { this.renderGrid(); },

  renderGrid() {
    const box = $('#fundGrid'); if (!box) return;
    const F = S().finance;
    box.innerHTML = F.funds.length ? F.funds.map((f, idx) => this.cardHTML(f, idx)).join('')
      : `<div class="card p-6 col-span-full">${emptyHTML('Chưa có quỹ nào. Tạo “Quỹ Concert [tên nghệ sĩ]” hoặc “Quỹ đi Phòng trà Idol” để bắt đầu tích luỹ!', 'piggy')}</div>`;
    this.updateSummary();
  },

  cardHTML(f, idx) {
    const k = Fin.fundKind(f.kind), pl = Fin.fundPlan(f), b = `finance.funds.${idx}`;
    const hist = f.entries.slice().sort((x, y) => y.date.localeCompare(x.date));
    return `<article class="fund-card card ${pl.reached ? 'reached' : ''}" id="fund-${f.id}" style="--accent:${k.accent};--soft:${k.soft};--light:${k.light}">
      <div class="fund-head">
        <div class="fund-ico">${icon(k.icon)}</div>
        <div class="min-w-0 flex-1">
          <input class="ghost-input fund-name" data-path="${b}.name" value="${esc(f.name)}" placeholder="Tên quỹ (vd: Quỹ Concert …)">
          <select class="chip-select sm fund-kind" data-path="${b}.kind" style="${chipStyle(k)}">${optionsHTML(FUND_KINDS, f.kind)}</select>
        </div>
        <div class="ring lg" id="fund-ring-${f.id}" style="--p:${pl.pct};--c:${k.accent}"><span>${pl.pct}%</span></div>
      </div>
      <div class="fund-amounts">
        <div><small>Đã tích luỹ</small><b id="fund-saved-${f.id}">${fmtMoney(pl.saved)}</b></div>
        <div class="text-right"><small>Mục tiêu</small><div class="money-edit justify-end"><input class="ghost-input" data-path="${b}.target" data-money inputmode="decimal" value="${fmtNum(f.target)}"> ₫</div></div>
      </div>
      <div class="progress"><div class="bar" id="fund-bar-${f.id}" style="width:${pl.pct}%"></div></div>
      <div class="fund-meta" id="fund-meta-${f.id}">${this.metaHTML(f, pl)}</div>
      <div class="fund-fields">
        <label>Hạn chót <input type="date" class="date-input sm" data-path="${b}.deadline" value="${f.deadline}"></label>
        <input class="ghost-input fund-note" data-path="${b}.note" value="${esc(f.note)}" placeholder="Ghi chú (vd: concert tháng 12 tại Hà Nội)">
      </div>
      <div class="fund-actions">
        <button class="btn btn-primary btn-sm" data-action="fund-deposit" data-id="${f.id}">${icon('arrowDown')} Nạp thêm tiền</button>
        <button class="btn btn-soft btn-sm" data-action="fund-withdraw" data-id="${f.id}" ${pl.saved > 0 ? '' : 'disabled'}>${icon('arrowUp')} Rút / chi</button>
        <div class="flex-1"></div>
        <button class="icon-btn sm danger" data-action="fund-del" data-id="${f.id}" title="Xoá quỹ">${icon('trash')}</button>
      </div>
      <div class="fund-hist">${hist.length ? hist.slice(0, 3).map(e => this.entryHTML(e)).join('') : '<div class="hist-empty">Chưa có lần nạp nào</div>'}
        ${hist.length > 3 ? `<details><summary>Xem thêm ${hist.length - 3} lần</summary>${hist.slice(3).map(e => this.entryHTML(e)).join('')}</details>` : ''}</div>
    </article>`;
  },
  entryHTML(e) {
    return `<div class="hist-line"><span>${D.dm(D.parse(e.date))}</span><span class="truncate">${esc(e.note || (e.amount >= 0 ? 'Nạp tiền' : 'Rút tiền'))}${e.external ? ' <em>(ngoài số dư)</em>' : ''}</span><b class="${e.amount >= 0 ? 'in' : 'out'}">${e.amount >= 0 ? '+' : '−'}${fmtNum(Math.abs(e.amount))} ₫</b></div>`;
  },
  metaHTML(f, pl) {
    if (!f.target) return 'Đặt mục tiêu để theo dõi tiến độ';
    if (pl.reached) return '🎉 Đã đạt mục tiêu — sẵn sàng săn vé!';
    let s = `Còn thiếu <b>${fmtMoney(pl.left)}</b>`;
    if (pl.days !== null) s += pl.days < 0 ? ` · <span class="late">đã quá hạn ${-pl.days} ngày</span>` : pl.days === 0 ? ' · hạn chót hôm nay' : ` · còn ${pl.days} ngày`;
    if (pl.perMonth) s += `<br>Gợi ý: nạp ~<b>${fmtMoney(pl.perMonth)}</b>/tháng (≈ ${fmtShort(pl.perWeek)}/tuần) để kịp hạn`;
    return s;
  },

  updateCard(f) {
    const pl = Fin.fundPlan(f);
    setRing($(`#fund-ring-${f.id}`), pl.pct);
    setBar($(`#fund-bar-${f.id}`), pl.pct);
    setText(`#fund-saved-${f.id}`, fmtMoney(pl.saved));
    const m = $(`#fund-meta-${f.id}`); if (m) m.innerHTML = this.metaHTML(f, pl);
    $(`#fund-${f.id}`)?.classList.toggle('reached', pl.reached);
  },

  updateSummary() {
    const F = S().finance, total = Fin.fundsTotal(), target = F.funds.reduce((s, f) => s + f.target, 0);
    const k = Fin.curMonth();
    const depMonth = F.funds.reduce((s, f) => s + f.entries.filter(e => e.amount > 0 && e.date.startsWith(k)).reduce((a, e) => a + e.amount, 0), 0);
    const fan = F.funds.filter(f => ['concert', 'liveshow', 'merch', 'travel'].includes(f.kind)).reduce((s, f) => s + Fin.fundSaved(f), 0);
    const cards = $('#fundCards');
    if (cards) cards.innerHTML = [
      finCard({ label: 'Tổng đã tích luỹ', value: fmtMoney(total), ic: 'piggy', th: TH.pink, sub: `${F.funds.length} quỹ đang theo dõi` }),
      finCard({ label: 'Tổng mục tiêu', value: fmtMoney(target), ic: 'target', th: TH.violet, sub: target ? `Đạt ${Math.round((total / target) * 100)}% · còn thiếu ${fmtShort(Math.max(0, target - total))}` : 'Chưa đặt mục tiêu' }),
      finCard({ label: 'Quỹ Fan (concert, phòng trà, merch)', value: fmtMoney(fan), ic: 'mic', th: TH.amber, sub: `Quỹ khác: ${fmtShort(total - fan)}` }),
      finCard({ label: 'Đã nạp tháng này', value: fmtMoney(depMonth), ic: 'arrowDown', th: TH.green, sub: `Số dư thực tế còn ${fmtMoney(Fin.cash())}` }),
    ].join('');
    const box = $('#fundChartBox');
    if (box) box.style.height = Math.max(180, F.funds.length * 46 + 60) + 'px';
    Charts.make('fundChart', $('#fundChart'), {
      type: 'bar',
      data: {
        labels: F.funds.map(f => f.name || 'Quỹ'),
        datasets: [
          { label: 'Đã tích luỹ', data: F.funds.map(f => Fin.fundSaved(f)), backgroundColor: F.funds.map(f => Fin.fundKind(f.kind).accent), borderRadius: 7, borderSkipped: false, maxBarThickness: 20, stack: 's' },
          { label: 'Còn thiếu', data: F.funds.map(f => Math.max(0, f.target - Fin.fundSaved(f))), backgroundColor: '#E6ECF7', borderRadius: 7, borderSkipped: false, maxBarThickness: 20, stack: 's' },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: { x: { stacked: true, beginAtZero: true, ticks: { callback: v => fmtShort(v) }, grid: GRID, border: { display: false } }, y: { stacked: true, grid: { display: false }, border: { display: false } } },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } }, tooltip: { displayColors: true, callbacks: { label: c => ` ${c.dataset.label}: ${fmtMoney(c.parsed.x)}` } } },
      },
    });
  },
  summarySoon() { clearTimeout(this._st); this._st = setTimeout(() => this.updateSummary(), 250); },

  onChange(path, el) {
    const m = path.match(/^finance\.funds\.(\d+)\.(\w+)$/);
    if (!m) return;
    const f = S().finance.funds[+m[1]];
    if (!f) return;
    if (m[2] === 'kind') {
      const k = Fin.fundKind(f.kind), card = $(`#fund-${f.id}`);
      el.style.cssText = chipStyle(k);
      if (card) { card.style.setProperty('--accent', k.accent); card.style.setProperty('--soft', k.soft); card.style.setProperty('--light', k.light); card.querySelector('.fund-ico').innerHTML = icon(k.icon); $(`#fund-ring-${f.id}`)?.style.setProperty('--c', k.accent); }
      this.summarySoon();
    } else if (m[2] === 'target' || m[2] === 'deadline') { this.updateCard(f); this.summarySoon(); }
    else if (m[2] === 'name') this.summarySoon();
  },
};

/* =====================================================================
 * F. HOÁ ĐƠN ĐỊNH KỲ
 * ===================================================================== */
const FinBills = {
  render() {
    const el = $('#view-bills');
    const m = Fin.viewMonth();
    el.innerHTML = `
      ${viewHeader('Tài chính', 'Hoá đơn định kỳ', `${Fin.monthLabel(m)} · tick “Đã trả” để tự ghi giao dịch “Hoá đơn” vào sổ, bỏ tick để huỷ`,
        `${Fin.controlsHTML()}<button class="btn btn-primary" data-action="bill-add">${icon('plus')} Thêm hoá đơn</button>`)}
      <div class="fin-cards four mb-6" id="billCards"></div>
      <div class="card p-0 overflow-hidden">
        <div class="bill-toolbar"><div class="card-title">${icon('zap')} Danh sách hoá đơn ${Fin.monthLabel(m).toLowerCase()}</div>
          <div class="flex items-center gap-3"><span class="text-sm muted" id="billProgressText"></span><div class="progress thin w-40"><div class="bar" id="billProgress"></div></div></div></div>
        <div class="bill-head"><span>Đã trả</span><span>Tên hoá đơn</span><span>Loại</span><span>Hạn hằng tháng</span><span class="text-right">Số tiền</span><span>Trạng thái</span><span></span></div>
        <div id="billList"></div>
      </div>`;
    this.renderList();
  },
  refresh() { this.renderList(); },

  renderList() {
    const box = $('#billList'); if (!box) return;
    const m = Fin.viewMonth(), F = S().finance;
    const rows = F.bills.map((b, idx) => ({ b, idx })).sort((x, y) => x.b.dueDay - y.b.dueDay);
    box.innerHTML = rows.length ? rows.map(({ b, idx }) => {
      const st = Fin.billStatus(b, m), k = Fin.billKind(b.kind), p = `finance.bills.${idx}`;
      return `<div class="bill-row ${st.state}" id="bill-${b.id}" style="--accent:${k.accent};--soft:${k.soft}">
        <input type="checkbox" class="cbx round bill-cbx" data-action="bill-toggle" data-id="${b.id}" ${st.tx ? 'checked' : ''} aria-label="Đã trả">
        <div class="bill-name"><span class="cat-ico">${icon(k.icon)}</span><input class="ghost-input" data-path="${p}.name" value="${esc(b.name)}" placeholder="Tên hoá đơn"></div>
        <select class="chip-select sm" data-path="${p}.kind" style="${chipStyle(k)}">${optionsHTML(BILL_KINDS, b.kind)}</select>
        <label class="bill-day">Ngày <input type="number" min="1" max="31" class="day-input" data-path="${p}.dueDay" data-num value="${b.dueDay}"> <span class="muted">(${D.dm(D.parse(st.due))})</span></label>
        <div class="money-edit justify-end"><input class="ghost-input" data-path="${p}.amount" data-money inputmode="decimal" value="${fmtNum(b.amount)}"> ₫</div>
        <div class="bill-status">${this.statusHTML(st)}</div>
        <button class="icon-btn sm danger" data-action="bill-del" data-id="${b.id}" title="Xoá hoá đơn">${icon('trash')}</button>
      </div>`;
    }).join('') : emptyHTML('Chưa có hoá đơn định kỳ nào. Thêm tiền nhà, điện, nước, internet… để không bao giờ quên hạn.', 'zap');
    this.updateSummary();
  },
  statusHTML(st) {
    if (st.state === 'paid') return `<span class="due-chip ok">✓ Đã trả ${D.dm(D.parse(st.tx.date))}</span>`;
    if (st.state === 'overdue') return `<span class="due-chip late">Quá hạn ${-st.days} ngày</span>`;
    if (st.state === 'soon') return `<span class="due-chip warn">${st.days === 0 ? 'Đến hạn hôm nay' : `Còn ${st.days} ngày`}</span>`;
    return `<span class="due-chip">Chưa trả · còn ${st.days} ngày</span>`;
  },
  updateSummary() {
    const m = Fin.viewMonth(), s = Fin.billsSummary(m);
    const cards = $('#billCards');
    if (cards) cards.innerHTML = [
      finCard({ label: 'Tổng hoá đơn tháng', value: fmtMoney(s.total), ic: 'receipt', th: TH.blue, sub: `${s.n} hoá đơn định kỳ` }),
      finCard({ label: 'Đã trả', value: fmtMoney(s.paid), ic: 'checkCircle', th: TH.green, sub: `${s.nPaid}/${s.n} hoá đơn` }),
      finCard({ label: 'Còn phải trả', value: fmtMoney(s.left), ic: 'hourglass', th: TH.amber, sub: s.left ? 'Đừng quên hạn thanh toán nhé' : 'Đã trả hết tháng này 🎉' }),
      finCard({ label: 'Quá hạn', value: String(s.overdue), ic: 'alert', th: s.overdue ? TH.red : TH.green, sub: s.overdue ? 'hoá đơn cần trả ngay' : 'Không có hoá đơn trễ hạn' }),
    ].join('');
    setText('#billProgressText', `${s.nPaid}/${s.n} đã trả`);
    setBar($('#billProgress'), percent(s.nPaid, s.n));
  },
  onChange(path, el, kind) {
    const m = path.match(/^finance\.bills\.(\d+)\.(\w+)$/);
    if (!m) return;
    const b = S().finance.bills[+m[1]];
    if (!b) return;
    if (m[2] === 'kind') { const k = Fin.billKind(b.kind); el.style.cssText = chipStyle(k); const row = $(`#bill-${b.id}`); if (row) { row.style.setProperty('--accent', k.accent); row.style.setProperty('--soft', k.soft); row.querySelector('.cat-ico').innerHTML = icon(k.icon); } }
    if (m[2] === 'dueDay' && kind === 'change') { b.dueDay = clamp(Math.round(b.dueDay) || 1, 1, 31); Store.save(); this.renderList(); return; }
    if (m[2] === 'amount') this.updateSummarySoon();
  },
  updateSummarySoon() { clearTimeout(this._st); this._st = setTimeout(() => this.updateSummary(), 250); },
};

/* =====================================================================
 * HÀNH ĐỘNG
 * ===================================================================== */
function addTransaction({ date, desc, type, cat, amount, link = null }) {
  const tx = { id: uid(), date, desc: String(desc || '').trim(), type: type === 'income' ? 'income' : 'expense', cat, amount: Math.round(amount) };
  if (link) tx.link = link;
  S().finance.txs.push(tx);
  Store.save();
  return tx;
}
const findById = (list, id) => list.find(x => x.id === id);
const todayIn = month => (D.today().startsWith(month) ? D.today() : `${month}-01`);

/* ---------- Kỳ, biểu đồ, giao dịch ---------- */
Actions['fin-step'] = el => {
  const F = S().finance;
  F.period = Fin.shiftMonth(F.period === 'all' ? Fin.curMonth() : F.period, Number(el.dataset.dir));
  Store.save();
  App.modules[App.view].render();
  App.renderCycleCard();
};
Actions['fin-chart'] = el => {
  FinOverview.chartType = el.dataset.type;
  $$('.seg-mini button').forEach(b => b.classList.toggle('active', b.dataset.type === FinOverview.chartType));
  FinOverview.drawCat(S().finance.txs.filter(t => Fin.inPeriod(t, S().finance.period)));
};
Actions['tx-type'] = el => {
  FinLedger.newType = el.dataset.type;
  $$('#txType button').forEach(b => b.classList.toggle('active', b.dataset.type === FinLedger.newType));
  const cat = $('#txCat');
  if (cat) {
    const kind = Fin.cat(cat.value).kind;
    if (FinLedger.newType === 'income' && kind === 'expense') cat.value = 'salary';
    if (FinLedger.newType === 'expense' && kind === 'income') cat.value = 'food';
  }
};
Actions['tx-add'] = () => {
  const date = $('#txDate').value, desc = $('#txDesc').value.trim(), cat = $('#txCat').value, amount = parseMoney($('#txAmt').value);
  if (!D.valid(date)) { UI.toast('Vui lòng chọn ngày hợp lệ', 'error'); return; }
  if (!amount) { $('#txAmt').focus(); UI.toast('Vui lòng nhập số tiền (vd: 50k, 1,5tr)', 'error'); return; }
  const tx = addTransaction({ date, desc, type: FinLedger.newType, cat, amount });
  $('#txDesc').value = ''; $('#txAmt').value = '';
  if (!Fin.inPeriod(tx, S().finance.period)) { S().finance.period = date.slice(0, 7); Store.save(); FinLedger.render(); }
  else FinLedger.renderList();
  $(`.tx-row[data-id="${tx.id}"]`)?.classList.add('flash');
  $('#txDesc')?.focus();
  UI.toast(`Đã thêm: ${tx.type === 'income' ? '+' : '−'}${fmtMoney(tx.amount)} · ${Fin.cat(tx.cat).name}`, 'success');
  App.renderCycleCard(); App.updateBell();
};
Actions['tx-del'] = el => {
  const list = S().finance.txs;
  const idx = list.findIndex(t => t.id === el.dataset.id);
  if (idx < 0) return;
  const [removed] = list.splice(idx, 1);
  Store.save();
  Fin.refreshView();
  const note = removed.link ? (removed.link.kind === 'debt' ? ' (số đã trả của khoản nợ đã cập nhật)' : ' (hoá đơn chuyển về “Chưa trả”)') : '';
  UI.toast(`Đã xoá “${removed.desc || Fin.cat(removed.cat).name}”${note}`, 'info', { label: 'Hoàn tác', onClick: () => { S().finance.txs.splice(idx, 0, removed); Store.save(); Fin.refreshView(); } });
};
Actions['tx-filter-type'] = el => {
  S().finance.filter.type = el.dataset.type;
  Store.save();
  $$('.type-pills button').forEach(b => b.classList.toggle('active', b.dataset.type === el.dataset.type));
  FinLedger.renderList();
};
Actions['tx-quick'] = async () => {
  const defDate = todayIn(Fin.viewMonth());
  const r = await UI.modal({
    title: 'Thêm giao dịch', icon: 'receipt', okText: 'Thêm giao dịch',
    bodyHTML: `<div class="opt-list tx-quick-type">
        <label class="opt"><input type="radio" name="type" value="expense" checked><span><b>Khoản chi</b></span></label>
        <label class="opt"><input type="radio" name="type" value="income"><span><b>Khoản thu</b></span></label>
      </div>
      <label>Số tiền (₫)</label><input name="amount" class="field-input" inputmode="decimal" placeholder="VD: 50k · 1,5tr · 250.000">
      <label>Mô tả</label><input name="desc" class="field-input" placeholder="VD: Vé phòng trà" maxlength="120">
      <div class="grid grid-cols-2 gap-3"><div><label>Danh mục</label><select name="cat" class="field-input">${optionsHTML(FIN_CATS, 'food')}</select></div>
      <div><label>Ngày</label><input type="date" name="date" class="field-input" value="${defDate}"></div></div>`,
    validate: d => (!parseMoney(d.amount) ? 'Vui lòng nhập số tiền (vd: 50k, 1,5tr).' : !D.valid(d.date) ? 'Ngày không hợp lệ.' : null),
  });
  if (!r) return;
  let cat = r.cat;
  if (r.type === 'income' && Fin.cat(cat).kind === 'expense') cat = 'salary';
  if (r.type === 'expense' && Fin.cat(cat).kind === 'income') cat = 'other';
  const tx = addTransaction({ date: r.date, desc: r.desc, type: r.type, cat, amount: parseMoney(r.amount) });
  UI.toast(`Đã thêm: ${tx.type === 'income' ? '+' : '−'}${fmtMoney(tx.amount)} · ${Fin.cat(tx.cat).name}`, 'success');
  App.modules[App.view].render(); App.renderCycleCard(); App.updateBell();
};
Actions['tx-export'] = () => {
  const rows = Fin.indexed(FinLedger.filtered()).map(({ t }) => [t.date, t.desc, Fin.type(t.type).name, Fin.cat(t.cat).name, (t.type === 'income' ? 1 : -1) * t.amount]);
  const csvCell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [['Ngày', 'Mô tả', 'Loại', 'Danh mục', 'Số tiền (VND)'], ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `so-giao-dich_${S().finance.period}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  UI.toast(`Đã xuất ${rows.length} giao dịch ra CSV`, 'success');
};

/* ---------- Ngân sách ---------- */
const roundUp = (v, step = 100000) => Math.ceil(v / step) * step;
Actions['budget-suggest'] = el => {
  const avg = Fin.avgSpend(el.dataset.cat);
  if (!avg) return;
  S().finance.budgets[el.dataset.cat] = roundUp(avg);
  Store.save(); FinBudget.renderList(); FinBudget.refresh(); App.updateBell();
  UI.toast(`Đã đặt hạn mức ${Fin.cat(el.dataset.cat).name}: ${fmtMoney(roundUp(avg))}`, 'success');
};
Actions['budget-suggest-all'] = async () => {
  const sug = Fin.expenseCats().map(c => ({ c, v: roundUp(Fin.avgSpend(c.id)) })).filter(x => x.v > 0);
  if (!sug.length) { UI.toast('Chưa đủ dữ liệu 3 tháng trước để gợi ý', 'info'); return; }
  const ok = await UI.confirm({ title: 'Đặt hạn mức theo gợi ý?', icon: 'sparkles', okText: 'Áp dụng',
    bodyHTML: `<p>Hạn mức được làm tròn lên từ mức chi trung bình 3 tháng gần nhất:</p><div class="sug-list">${sug.map(x => `<div><span>${x.c.name}</span><b>${fmtMoney(x.v)}</b></div>`).join('')}</div>` });
  if (!ok) return;
  sug.forEach(x => { S().finance.budgets[x.c.id] = x.v; });
  Store.save(); FinBudget.renderList(); FinBudget.refresh(); App.updateBell();
  UI.toast('Đã áp dụng hạn mức gợi ý', 'success');
};

/* ---------- Khoản nợ ---------- */
Actions['debt-add'] = async () => {
  const r = await UI.modal({
    title: 'Thêm khoản nợ', icon: 'creditCard', okText: 'Thêm khoản nợ',
    bodyHTML: `<label>Tên khoản nợ</label><input name="name" class="field-input" placeholder="VD: Trả góp điện thoại, Nợ bạn Minh…" maxlength="80">
      <label>Chủ nợ / ghi chú</label><input name="lender" class="field-input" placeholder="VD: Ngân hàng, bạn bè…" maxlength="80">
      <div class="grid grid-cols-2 gap-3">
        <div><label>Tổng số tiền (₫)</label><input name="total" class="field-input" inputmode="decimal" placeholder="VD: 12tr"></div>
        <div><label>Đã trả trước đó (₫)</label><input name="paid" class="field-input" inputmode="decimal" placeholder="0"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label>Trả mỗi tháng (₫)</label><input name="monthly" class="field-input" inputmode="decimal" placeholder="Bỏ trống nếu trả 1 lần"></div>
        <div><label>Ngày đáo hạn</label><input type="date" name="due" class="field-input"></div>
      </div>
      <p class="text-sm muted mt-3">Khoản trả góp: ngày của “Ngày đáo hạn” được dùng làm hạn trả hằng tháng (vd đáo hạn 08/03/2027 → mỗi tháng trả trước ngày 08).</p>`,
    validate: d => (!d.name ? 'Hãy đặt tên cho khoản nợ.' : !parseMoney(d.total) ? 'Vui lòng nhập tổng số tiền.' : parseMoney(d.paid) > parseMoney(d.total) ? 'Số đã trả không thể lớn hơn tổng số tiền.' : null),
  });
  if (!r) return;
  S().finance.debts.push({ id: uid(), name: r.name, lender: r.lender, total: parseMoney(r.total), initialPaid: parseMoney(r.paid), monthly: parseMoney(r.monthly), due: D.valid(r.due) ? r.due : '', created: D.today(), closed: false });
  Store.save(); Fin.refreshView();
  UI.toast(`Đã thêm khoản nợ “${r.name}”`, 'success');
};
Actions['debt-pay'] = async el => {
  const d = findById(S().finance.debts, el.dataset.id);
  if (!d) return;
  const rem = Fin.debtRemaining(d), mon = Fin.debtMonth(d);
  const r = await UI.modal({
    title: `Ghi nhận trả bớt · ${d.name || 'Khoản nợ'}`, icon: 'creditCard', okText: 'Ghi nhận',
    bodyHTML: `<dl class="sync-info"><dt>Tổng nợ</dt><dd>${fmtMoney(d.total)}</dd><dt>Đã trả</dt><dd>${fmtMoney(Fin.debtPaid(d))}</dd><dt>Còn lại</dt><dd>${fmtMoney(rem)}</dd>${mon.need ? `<dt>Cần trả tháng này</dt><dd>${fmtMoney(mon.need)}${mon.left ? ` · còn ${fmtMoney(mon.left)}` : ' · đã đủ ✓'}</dd>` : ''}</dl>
      <div class="grid grid-cols-2 gap-3">
        <div><label>Số tiền trả lần này (₫)</label><input name="amount" class="field-input" inputmode="decimal" placeholder="VD: 1tr" value="${mon.left ? fmtNum(mon.left) : ''}"></div>
        <div><label>Ngày trả</label><input type="date" name="date" class="field-input" value="${D.today()}"></div>
      </div>
      <p class="text-sm muted mt-3">Khoản trả được ghi vào sổ giao dịch (Chi · Trả nợ) và trừ vào số dư thực tế.</p>`,
    validate: x => { const a = parseMoney(x.amount); return !a ? 'Vui lòng nhập số tiền.' : a > rem ? `Số tiền vượt quá số còn lại (${fmtMoney(rem)}).` : !D.valid(x.date) ? 'Ngày không hợp lệ.' : null; },
  });
  if (!r) return;
  const amt = parseMoney(r.amount);
  addTransaction({ date: r.date, desc: `Trả nợ: ${d.name || 'Khoản nợ'}`, type: 'expense', cat: 'debt', amount: amt, link: { kind: 'debt', id: d.id } });
  Fin.refreshView();
  UI.toast(Fin.debtRemaining(d) === 0 ? `Đã trả hết “${d.name}” — chúc mừng bạn!` : `Đã ghi nhận trả ${fmtMoney(amt)} · còn ${fmtMoney(Fin.debtRemaining(d))}`, 'success');
};
Actions['debt-done'] = async el => {
  const d = findById(S().finance.debts, el.dataset.id);
  if (!d) return;
  const rem = Fin.debtRemaining(d);
  if (rem > 0) {
    const r = await UI.modal({
      title: 'Hoàn thành khoản nợ?', icon: 'checkCircle', okText: 'Hoàn thành',
      bodyHTML: `<p>Khoản “${esc(d.name)}” còn <b>${fmtMoney(rem)}</b>.</p>
        <div class="opt-list">
          <label class="opt"><input type="radio" name="op" value="pay" checked><span><b>Ghi nhận trả nốt ${fmtMoney(rem)}</b><small>Tạo giao dịch “Trả nợ” hôm nay và trừ vào số dư.</small></span></label>
          <label class="opt"><input type="radio" name="op" value="close"><span><b>Chỉ đánh dấu hoàn thành</b><small>Đã trả ngoài ứng dụng hoặc được xoá nợ.</small></span></label>
        </div>`,
    });
    if (!r) return;
    if (r.op === 'pay') addTransaction({ date: D.today(), desc: `Trả nợ: ${d.name || 'Khoản nợ'} (tất toán)`, type: 'expense', cat: 'debt', amount: rem, link: { kind: 'debt', id: d.id } });
  }
  d.closed = true;
  Store.save(); Fin.refreshView();
  UI.toast(`Đã hoàn thành “${d.name || 'Khoản nợ'}” 🎉`, 'success');
};
Actions['debt-reopen'] = el => {
  const d = findById(S().finance.debts, el.dataset.id);
  if (!d) return;
  d.closed = false;
  Store.save(); Fin.refreshView();
  if (Fin.debtRemaining(d) === 0) UI.toast('Khoản này đã trả đủ — tăng “Tổng số tiền” nếu còn phải trả thêm.', 'info');
};
Actions['debt-del'] = async el => {
  const list = S().finance.debts, idx = list.findIndex(x => x.id === el.dataset.id);
  if (idx < 0) return;
  const d = list[idx], n = Fin.debtTxs(d).length;
  const ok = await UI.confirm({ title: 'Xoá khoản nợ?', icon: 'trash', danger: true, okText: 'Xoá',
    bodyHTML: `<p>Xoá “${esc(d.name || 'Khoản nợ')}” khỏi danh sách theo dõi.</p>${n ? `<p class="muted">${n} giao dịch “Trả nợ” đã ghi vẫn được giữ trong sổ giao dịch.</p>` : ''}` });
  if (!ok) return;
  list.splice(idx, 1);
  Store.save(); Fin.refreshView();
  UI.toast('Đã xoá khoản nợ', 'info', { label: 'Hoàn tác', onClick: () => { S().finance.debts.splice(idx, 0, d); Store.save(); Fin.refreshView(); } });
};

/* ---------- Quỹ ---------- */
Actions['fund-add'] = async () => {
  const r = await UI.modal({
    title: 'Tạo quỹ mới', icon: 'piggy', okText: 'Tạo quỹ',
    bodyHTML: `<label>Tên quỹ</label><input name="name" class="field-input" placeholder="VD: Quỹ Concert [tên nghệ sĩ] 2026" maxlength="80">
      <label>Loại quỹ</label><select name="kind" class="field-input">${optionsHTML(FUND_KINDS, 'concert')}</select>
      <div class="grid grid-cols-2 gap-3">
        <div><label>Mục tiêu (₫)</label><input name="target" class="field-input" inputmode="decimal" placeholder="VD: 5tr"></div>
        <div><label>Hạn chót</label><input type="date" name="deadline" class="field-input"></div>
      </div>
      <label>Số tiền đã có sẵn (₫, không trừ vào số dư)</label><input name="initial" class="field-input" inputmode="decimal" placeholder="0">
      <label>Ghi chú</label><input name="note" class="field-input" placeholder="VD: concert tháng 12 tại Hà Nội" maxlength="120">`,
    validate: d => (!d.name ? 'Hãy đặt tên cho quỹ.' : null),
  });
  if (!r) return;
  const f = { id: uid(), name: r.name, kind: r.kind, target: parseMoney(r.target), deadline: D.valid(r.deadline) ? r.deadline : '', note: r.note, entries: [] };
  const init = parseMoney(r.initial);
  if (init) f.entries.push({ id: uid(), date: D.today(), amount: init, note: 'Số dư ban đầu', external: true });
  S().finance.funds.push(f);
  Store.save(); Fin.refreshView();
  UI.toast(`Đã tạo “${r.name}”`, 'success');
};
Actions['fund-deposit'] = async el => {
  const f = findById(S().finance.funds, el.dataset.id);
  if (!f) return;
  const pl = Fin.fundPlan(f), cash = Fin.cash();
  const r = await UI.modal({
    title: `Nạp thêm tiền · ${f.name || 'Quỹ'}`, icon: 'arrowDown', okText: 'Nạp vào quỹ',
    bodyHTML: `<dl class="sync-info"><dt>Đã tích luỹ</dt><dd>${fmtMoney(pl.saved)}${f.target ? ` / ${fmtMoney(f.target)}` : ''}</dd><dt>Số dư thực tế</dt><dd>${fmtMoney(cash)}</dd>${pl.perMonth ? `<dt>Gợi ý</dt><dd>~${fmtMoney(pl.perMonth)}/tháng</dd>` : ''}</dl>
      <div class="grid grid-cols-2 gap-3">
        <div><label>Số tiền nạp (₫)</label><input name="amount" class="field-input" inputmode="decimal" placeholder="VD: 500k" value="${pl.perMonth ? fmtNum(Math.min(pl.perMonth, pl.left)) : ''}"></div>
        <div><label>Ngày</label><input type="date" name="date" class="field-input" value="${D.today()}"></div>
      </div>
      <label>Ghi chú</label><input name="note" class="field-input" placeholder="VD: Tiết kiệm từ lương tháng này" maxlength="100">
      <label class="opt mt-3"><input type="checkbox" name="fromCash" checked><span><b>Trừ vào số dư thực tế</b><small>Bỏ chọn nếu tiền đến từ nguồn ngoài (quà, lì xì…).</small></span></label>`,
    validate: d => (!parseMoney(d.amount) ? 'Vui lòng nhập số tiền.' : !D.valid(d.date) ? 'Ngày không hợp lệ.' : null),
  });
  if (!r) return;
  const amt = parseMoney(r.amount), before = Fin.fundPlan(f).reached;
  f.entries.push({ id: uid(), date: r.date, amount: amt, note: r.note || 'Nạp tiền', external: !r.fromCash });
  Store.save(); Fin.refreshView();
  const after = Fin.fundPlan(f);
  if (!before && after.reached) {
    UI.toast(`🎉 “${f.name}” đã đạt mục tiêu ${fmtMoney(f.target)}!`, 'success');
    const card = $(`#fund-${f.id}`); if (card) { card.classList.remove('celebrate'); void card.offsetWidth; card.classList.add('celebrate'); }
  } else UI.toast(`Đã nạp ${fmtMoney(amt)} vào “${f.name}” · đạt ${after.pct}%`, 'success');
};
Actions['fund-withdraw'] = async el => {
  const f = findById(S().finance.funds, el.dataset.id);
  if (!f) return;
  const saved = Fin.fundSaved(f);
  const defCat = ['concert', 'liveshow'].includes(f.kind) ? 'concert' : f.kind === 'merch' ? 'shopping' : 'other';
  const r = await UI.modal({
    title: `Rút tiền · ${f.name || 'Quỹ'}`, icon: 'arrowUp', okText: 'Xác nhận',
    bodyHTML: `<p>Quỹ đang có <b>${fmtMoney(saved)}</b>.</p>
      <div class="grid grid-cols-2 gap-3">
        <div><label>Số tiền (₫)</label><input name="amount" class="field-input" inputmode="decimal" placeholder="VD: 1,2tr"></div>
        <div><label>Ngày</label><input type="date" name="date" class="field-input" value="${D.today()}"></div>
      </div>
      <div class="opt-list">
        <label class="opt"><input type="radio" name="op" value="spend" checked><span><b>Dùng để chi tiêu</b><small>Ghi vào sổ giao dịch (vd: mua vé concert). Số dư thực tế không đổi.</small></span></label>
        <label class="opt"><input type="radio" name="op" value="cash"><span><b>Rút về số dư thực tế</b><small>Tiền quay lại ví, không ghi chi tiêu.</small></span></label>
      </div>
      <div class="grid grid-cols-2 gap-3"><div><label>Danh mục chi</label><select name="cat" class="field-input">${optionsHTML(Fin.expenseCats(), defCat)}</select></div>
      <div><label>Mô tả</label><input name="desc" class="field-input" placeholder="VD: Vé concert hạng VIP" maxlength="100"></div></div>`,
    validate: d => { const a = parseMoney(d.amount); return !a ? 'Vui lòng nhập số tiền.' : a > saved ? `Quỹ chỉ còn ${fmtMoney(saved)}.` : !D.valid(d.date) ? 'Ngày không hợp lệ.' : null; },
  });
  if (!r) return;
  const amt = parseMoney(r.amount);
  if (r.op === 'spend') {
    const desc = r.desc || `Chi từ ${f.name || 'quỹ'}`;
    f.entries.push({ id: uid(), date: r.date, amount: -amt, note: desc, external: false });
    addTransaction({ date: r.date, desc, type: 'expense', cat: r.cat, amount: amt });
  } else {
    f.entries.push({ id: uid(), date: r.date, amount: -amt, note: 'Rút về số dư', external: false });
    Store.save();
  }
  Fin.refreshView();
  UI.toast(r.op === 'spend' ? `Đã chi ${fmtMoney(amt)} từ “${f.name}” và ghi vào sổ giao dịch` : `Đã rút ${fmtMoney(amt)} về số dư thực tế`, 'success');
};
Actions['fund-del'] = async el => {
  const list = S().finance.funds, idx = list.findIndex(x => x.id === el.dataset.id);
  if (idx < 0) return;
  const f = list[idx], saved = Fin.fundSaved(f);
  const ok = await UI.confirm({ title: 'Xoá quỹ?', icon: 'trash', danger: true, okText: 'Xoá quỹ',
    bodyHTML: `<p>Xoá “${esc(f.name || 'Quỹ')}” và lịch sử nạp/rút của quỹ.</p>${saved ? `<p class="muted">Số tiền đã nạp từ số dư (${fmtMoney(Fin.fundSaved({ entries: f.entries.filter(e => !e.external) }))}) sẽ được cộng trả lại vào số dư thực tế.</p>` : ''}` });
  if (!ok) return;
  list.splice(idx, 1);
  Store.save(); Fin.refreshView();
  UI.toast('Đã xoá quỹ', 'info', { label: 'Hoàn tác', onClick: () => { S().finance.funds.splice(idx, 0, f); Store.save(); Fin.refreshView(); } });
};

/* ---------- Hoá đơn ---------- */
Actions['bill-add'] = async () => {
  const r = await UI.modal({
    title: 'Thêm hoá đơn định kỳ', icon: 'zap', okText: 'Thêm hoá đơn',
    bodyHTML: `<label>Tên hoá đơn</label><input name="name" class="field-input" placeholder="VD: Tiền điện, Internet FPT…" maxlength="80">
      <div class="grid grid-cols-2 gap-3">
        <div><label>Loại</label><select name="kind" class="field-input">${optionsHTML(BILL_KINDS, 'power')}</select></div>
        <div><label>Hạn trả</label><input type="number" name="day" min="1" max="31" class="field-input" value="10" title="Ngày trong tháng (1–31)"></div>
      </div>
      <label>Số tiền mỗi tháng (₫)</label><input name="amount" class="field-input" inputmode="decimal" placeholder="VD: 650k">`,
    validate: d => (!d.name ? 'Hãy đặt tên cho hoá đơn.' : !parseMoney(d.amount) ? 'Vui lòng nhập số tiền.' : null),
  });
  if (!r) return;
  S().finance.bills.push({ id: uid(), name: r.name, kind: r.kind, amount: parseMoney(r.amount), dueDay: clamp(Math.round(Number(r.day) || 1), 1, 31) });
  Store.save(); Fin.refreshView();
  UI.toast(`Đã thêm hoá đơn “${r.name}”`, 'success');
};
Actions['bill-toggle'] = el => {
  const b = findById(S().finance.bills, el.dataset.id);
  if (!b) return;
  const m = Fin.viewMonth(), tx = Fin.billTx(b, m);
  if (tx) {
    const list = S().finance.txs, idx = list.indexOf(tx);
    list.splice(idx, 1);
    Store.save(); Fin.refreshView();
    UI.toast(`“${b.name}” chuyển về Chưa trả (đã xoá giao dịch)`, 'info', { label: 'Hoàn tác', onClick: () => { S().finance.txs.splice(idx, 0, tx); Store.save(); Fin.refreshView(); } });
  } else {
    const date = D.today().startsWith(m) ? D.today() : Fin.billDueDate(b, m);
    addTransaction({ date, desc: `${b.name || 'Hoá đơn'} ${Fin.monthShort(m)}`, type: 'expense', cat: 'bills', amount: b.amount, link: { kind: 'bill', id: b.id, month: m } });
    Fin.refreshView();
    UI.toast(`Đã trả “${b.name}” · ghi ${fmtMoney(b.amount)} vào sổ giao dịch`, 'success');
  }
};
Actions['bill-del'] = async el => {
  const list = S().finance.bills, idx = list.findIndex(x => x.id === el.dataset.id);
  if (idx < 0) return;
  const b = list[idx];
  const ok = await UI.confirm({ title: 'Xoá hoá đơn định kỳ?', icon: 'trash', danger: true, okText: 'Xoá', bodyHTML: `<p>Xoá “${esc(b.name || 'Hoá đơn')}”. Các giao dịch đã trả trước đây vẫn được giữ trong sổ giao dịch.</p>` });
  if (!ok) return;
  list.splice(idx, 1);
  Store.save(); Fin.refreshView();
  UI.toast('Đã xoá hoá đơn', 'info', { label: 'Hoàn tác', onClick: () => { S().finance.bills.splice(idx, 0, b); Store.save(); Fin.refreshView(); } });
};
