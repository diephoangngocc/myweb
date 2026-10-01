'use strict';
/* =====================================================================
 * BỘ 4 SHEETS 2026 — core.js
 * Hằng số · tiện ích ngày tháng · kho dữ liệu (localStorage) · UI helpers · icon
 * ===================================================================== */

const APP_KEY = 'bo4sheets2026.v1';   // bản lưu trên máy (cache offline) — bản chính nằm trên máy chủ khi bật đồng bộ

/* ------------------------------ Hằng số ------------------------------ */
const AREAS = [
  { id: 'health',   name: 'Sức khỏe',            icon: 'heart',     accent: '#2FAE84', soft: '#DDF5EC', light: '#7FD8B6' },
  { id: 'finance',  name: 'Tài chính',           icon: 'wallet',    accent: '#E3A23B', soft: '#FFF1D6', light: '#F5CD83' },
  { id: 'career',   name: 'Sự nghiệp',           icon: 'briefcase', accent: '#4F86F0', soft: '#DCEBFF', light: '#8DB4FF' },
  { id: 'growth',   name: 'Phát triển bản thân', icon: 'sprout',    accent: '#8B74E8', soft: '#ECE6FF', light: '#B9A9F5' },
  { id: 'relation', name: 'Mối quan hệ',         icon: 'users',     accent: '#E86A82', soft: '#FFE3E8', light: '#F5A3B3' },
];
const STATUSES = [
  { id: 'todo',  name: 'Chưa bắt đầu',   accent: '#7F8DAD', soft: '#EEF2F9', chart: '#B7C4DE' },
  { id: 'doing', name: 'Đang thực hiện', accent: '#C98A1E', soft: '#FFF1D6', chart: '#F5C95F' },
  { id: 'done',  name: 'Hoàn thành',     accent: '#23996F', soft: '#DDF5EC', chart: '#6FD0A8' },
];
const TAGS = [
  { id: '',         name: 'Nhãn',      accent: '#9AA7BF', soft: 'transparent' },
  { id: 'work',     name: 'Công việc', accent: '#3F74E6', soft: '#DCEBFF' },
  { id: 'study',    name: 'Học tập',   accent: '#7A62DE', soft: '#ECE6FF' },
  { id: 'health',   name: 'Sức khỏe',  accent: '#23996F', soft: '#DDF5EC' },
  { id: 'personal', name: 'Cá nhân',   accent: '#DB5873', soft: '#FFE3E8' },
  { id: 'appt',     name: 'Lịch hẹn',  accent: '#C98A1E', soft: '#FFF1D6' },
  { id: 'home',     name: 'Nhà cửa',   accent: '#1F95A5', soft: '#D9F3F6' },
];
const EVENT_CATS = [
  { id: 'important', name: 'Quan trọng', accent: '#DB5873', soft: '#FFE3E8' },
  { id: 'work',      name: 'Công việc',  accent: '#3F74E6', soft: '#DCEBFF' },
  { id: 'study',     name: 'Học tập',    accent: '#7A62DE', soft: '#ECE6FF' },
  { id: 'personal',  name: 'Cá nhân',    accent: '#23996F', soft: '#DDF5EC' },
  { id: 'holiday',   name: 'Ngày lễ',    accent: '#C98A1E', soft: '#FFF1D6' },
];
/* Tài chính: danh mục, loại giao dịch, loại quỹ, loại hoá đơn */
const FIN_CATS = [
  { id: 'salary',   name: 'Lương',                icon: 'wallet',     accent: '#23996F', soft: '#DDF5EC', light: '#7FD8B6', kind: 'income' },
  { id: 'bonus',    name: 'Thưởng',               icon: 'gift',       accent: '#C98A1E', soft: '#FFF1D6', light: '#F5CD83', kind: 'income' },
  { id: 'food',     name: 'Ăn uống',              icon: 'coffee',     accent: '#E05C79', soft: '#FFE3E8', light: '#F5A3B3', kind: 'expense' },
  { id: 'shopping', name: 'Mua sắm',              icon: 'bag',        accent: '#7A62DE', soft: '#ECE6FF', light: '#B9A9F5', kind: 'expense' },
  { id: 'concert',  name: 'Vé Concert/Phòng trà', icon: 'mic',        accent: '#D0489A', soft: '#FCE4F2', light: '#EE9DCB', kind: 'expense' },
  { id: 'bills',    name: 'Hóa đơn',              icon: 'zap',        accent: '#3F74E6', soft: '#DCEBFF', light: '#8DB4FF', kind: 'expense' },
  { id: 'debt',     name: 'Trả nợ',               icon: 'creditCard', accent: '#1F95A5', soft: '#D9F3F6', light: '#7DD0DA', kind: 'expense' },
  { id: 'other',    name: 'Khác',                 icon: 'layers',     accent: '#7F8DAD', soft: '#EEF2F9', light: '#B7C4DE', kind: 'both' },
];
const FIN_CAT_MIGRATE = { home: 'bills', fun: 'shopping', invest: 'other' };   // danh mục của phiên bản trước
const TX_TYPES = [
  { id: 'expense', name: 'Chi', accent: '#D94F6B', soft: '#FFE6EB' },
  { id: 'income',  name: 'Thu', accent: '#1F9A6C', soft: '#DDF5EC' },
];
const FUND_KINDS = [
  { id: 'concert',   name: 'Concert',          icon: 'mic',    accent: '#D0489A', soft: '#FCE4F2', light: '#EE9DCB' },
  { id: 'liveshow',  name: 'Phòng trà',        icon: 'music',  accent: '#7A62DE', soft: '#ECE6FF', light: '#B9A9F5' },
  { id: 'merch',     name: 'Album / Merch',    icon: 'disc',   accent: '#C98A1E', soft: '#FFF1D6', light: '#F5CD83' },
  { id: 'emergency', name: 'Khẩn cấp',         icon: 'shield', accent: '#23996F', soft: '#DDF5EC', light: '#7FD8B6' },
  { id: 'travel',    name: 'Du lịch / Fanmeet', icon: 'star',  accent: '#E26A3C', soft: '#FFE9DE', light: '#F6AE8E' },
  { id: 'other',     name: 'Tiết kiệm khác',   icon: 'piggy',  accent: '#3F74E6', soft: '#DCEBFF', light: '#8DB4FF' },
];
const BILL_KINDS = [
  { id: 'home',     name: 'Nhà',        icon: 'home',    accent: '#3F74E6', soft: '#DCEBFF' },
  { id: 'power',    name: 'Điện',       icon: 'zap',     accent: '#C98A1E', soft: '#FFF1D6' },
  { id: 'water',    name: 'Nước',       icon: 'droplet', accent: '#1F95A5', soft: '#D9F3F6' },
  { id: 'internet', name: 'Internet',   icon: 'wifi',    accent: '#7A62DE', soft: '#ECE6FF' },
  { id: 'phone',    name: 'Điện thoại', icon: 'phone',   accent: '#E05C79', soft: '#FFE3E8' },
  { id: 'other',    name: 'Khác',       icon: 'receipt', accent: '#7F8DAD', soft: '#EEF2F9' },
];

/* 7 bảng màu pastel (thẻ mục tiêu, thẻ ngày, tuần thói quen, tháng) */
const PALETTE = [
  { soft: '#DCEBFF', accent: '#4F86F0', light: '#8DB4FF' }, // xanh dương
  { soft: '#DDF5EC', accent: '#2FAE84', light: '#7FD8B6' }, // bạc hà
  { soft: '#FFF1D6', accent: '#E3A23B', light: '#F5CD83' }, // mơ
  { soft: '#FFE3E8', accent: '#E86A82', light: '#F5A3B3' }, // hồng
  { soft: '#ECE6FF', accent: '#8B74E8', light: '#B9A9F5' }, // lavender
  { soft: '#D9F3F6', accent: '#2BA5B5', light: '#7DD0DA' }, // ngọc
  { soft: '#E3EAFF', accent: '#5B73D6', light: '#9FB0EE' }, // chàm nhạt
];
const QUESTIONS = [
  'Vì sao mục tiêu này quan trọng với tôi?',
  'Điều gì có thể cản trở tôi — và tôi sẽ vượt qua thế nào?',
  'Khi đạt được, cuộc sống của tôi sẽ thay đổi ra sao?',
];
const WD_FULL = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);
const HABIT_ROWS = 12, TASK_ROWS = 10, STEP_ROWS = 5, GOAL_CARDS = 6, CYCLE_DAYS = 90;
const TIME_SLOTS = (() => {
  const out = [];
  for (let m = 7 * 60; m < 22 * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out; // 07:00 → 21:30 (30 khung, kết thúc lúc 22:00)
})();

/** Bảng hành động cho các nút có data-action (mỗi module tự đăng ký) */
const Actions = {};

/* ------------------------------ Tiện ích chung ------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const percent = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const byId = (list, id) => list.find(x => x.id === id) || list[0];
const S = () => Store.state;
const fold = s => String(s ?? '').normalize('NFC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const fmtHours = h => (Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')) + 'h';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}
function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (b && typeof b === 'object') {
    const out = (a && typeof a === 'object' && !Array.isArray(a)) ? { ...a } : {};
    for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
    return out;
  }
  return b === undefined ? a : b;
}

/* ------------------------------ Ngày tháng ------------------------------ */
const D = {
  iso: d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  parse: s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); },
  today: () => D.iso(new Date()),
  add: (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; },
  monday: d => D.add(d, -((d.getDay() + 6) % 7)),
  dim: (y, m1) => new Date(y, m1, 0).getDate(),          // số ngày của tháng m1 (1–12)
  wdIndex: d => (d.getDay() + 6) % 7,                     // 0 = Thứ Hai … 6 = Chủ Nhật
  valid: s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(D.parse(s).getTime()),
  diff(a, b) {                                            // số ngày từ a → b (chuỗi ISO)
    const A = D.parse(a), B = D.parse(b);
    return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 864e5);
  },
  isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 864e5 + 1) / 7);
  },
  dm: d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
  dmy: d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
  longVN: d => `${WD_FULL[(d.getDay() + 6) % 7]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
};

/* ------------------------------ Trạng thái mặc định ------------------------------ */
const blankStep = () => ({ text: '', done: false });
const blankTask = () => ({ text: '', done: false });
const blankGoal = i => ({
  id: uid(), title: '', image: '', area: AREAS[i % AREAS.length].id, status: 'todo',
  deadline: '', reward: '', answers: ['', '', ''], steps: Array.from({ length: STEP_ROWS }, blankStep),
});
const blankDay = () => ({ gratitude: '', priority: '', tasks: Array.from({ length: TASK_ROWS }, blankTask), blocks: {} });

function defaultState() {
  const now = new Date();
  return {
    version: 1,
    profile: { name: 'Diep', subtitle: 'Kế hoạch 90 ngày', cycleStart: D.today() },
    ui: { sidebarMode: 'auto', tbOpen: true },
    goals: { vision: '', priorities: ['', '', '', '', ''], cards: Array.from({ length: GOAL_CARDS }, (_, i) => blankGoal(i)), history: {} },
    habits: { year: now.getFullYear(), month: now.getMonth() + 1, months: {} },
    weekly: { weekStart: D.iso(D.monday(now)), weeks: {} },
    year: { year: now.getFullYear(), events: [], monthGoals: {} },
    finance: { opening: 0, period: D.today().slice(0, 7), txs: [], budgets: {}, filter: { type: 'all', cat: 'all', q: '' }, debts: [], funds: [], bills: [] },
  };
}

/** Chuẩn hoá dữ liệu (khi tải từ localStorage / nhập JSON) để luôn đúng cấu trúc */
function normalizeState(raw) {
  const base = defaultState();
  const st = deepMerge(base, raw && typeof raw === 'object' ? raw : {});
  const cards = Array.isArray(st.goals.cards) ? st.goals.cards : [];
  st.goals.cards = Array.from({ length: GOAL_CARDS }, (_, i) => {
    const g = Object.assign(blankGoal(i), cards[i] || {});
    ['title', 'image', 'deadline', 'reward'].forEach(k => { g[k] = String(g[k] ?? ''); });
    if (!AREAS.some(a => a.id === g.area)) g.area = AREAS[i % AREAS.length].id;
    if (!STATUSES.some(s => s.id === g.status)) g.status = 'todo';
    g.answers = Array.from({ length: 3 }, (_, k) => String((g.answers || [])[k] ?? ''));
    g.steps = Array.from({ length: STEP_ROWS }, (_, k) => {
      const s = (g.steps || [])[k] || {};
      return { text: String(s.text ?? ''), done: !!s.done };
    });
    return g;
  });
  st.goals.vision = String(st.goals.vision ?? '');
  st.goals.priorities = Array.from({ length: 5 }, (_, k) => String((st.goals.priorities || [])[k] ?? ''));
  if (!st.habits.months || typeof st.habits.months !== 'object' || Array.isArray(st.habits.months)) st.habits.months = {};
  st.habits.year = Number(st.habits.year) || base.habits.year;
  st.habits.month = clamp(Number(st.habits.month) || 1, 1, 12);
  if (!st.weekly.weeks || typeof st.weekly.weeks !== 'object' || Array.isArray(st.weekly.weeks)) st.weekly.weeks = {};
  if (!D.valid(st.weekly.weekStart)) st.weekly.weekStart = base.weekly.weekStart;
  st.weekly.weekStart = D.iso(D.monday(D.parse(st.weekly.weekStart)));
  st.year.year = clamp(Number(st.year.year) || base.year.year, 1900, 2100);
  st.year.events = (Array.isArray(st.year.events) ? st.year.events : [])
    .filter(e => e && D.valid(e.date))
    .map(e => ({ id: e.id || uid(), date: e.date, title: String(e.title ?? ''), cat: EVENT_CATS.some(c => c.id === e.cat) ? e.cat : 'important' }));
  if (!st.year.monthGoals || typeof st.year.monthGoals !== 'object' || Array.isArray(st.year.monthGoals)) st.year.monthGoals = {};
  if (!D.valid(st.profile.cycleStart)) st.profile.cycleStart = D.today();
  if (!st.goals.history || typeof st.goals.history !== 'object' || Array.isArray(st.goals.history)) st.goals.history = {};
  // Tài chính
  const F = st.finance;
  F.opening = Number(F.opening) || 0;
  if (F.period !== 'all' && !/^\d{4}-\d{2}$/.test(F.period || '')) F.period = D.today().slice(0, 7);
  const money = v => Math.max(0, Math.round(Number(v) || 0));
  const catOf = c => { c = FIN_CAT_MIGRATE[c] || c; return FIN_CATS.some(x => x.id === c) ? c : 'other'; };
  const arr = v => (Array.isArray(v) ? v : []);
  F.debts = arr(F.debts).filter(d => d && typeof d === 'object').map(d => ({
    id: d.id || uid(), name: String(d.name ?? ''), lender: String(d.lender ?? ''), total: money(d.total), initialPaid: money(d.initialPaid), monthly: money(d.monthly),
    due: D.valid(d.due) ? d.due : '', created: D.valid(d.created) ? d.created : D.today(), closed: !!d.closed,
  }));
  F.funds = arr(F.funds).filter(f => f && typeof f === 'object').map(f => ({
    id: f.id || uid(), name: String(f.name ?? ''), kind: FUND_KINDS.some(k => k.id === f.kind) ? f.kind : 'other',
    target: money(f.target), deadline: D.valid(f.deadline) ? f.deadline : '', note: String(f.note ?? ''),
    entries: arr(f.entries).filter(e => e && D.valid(e.date)).map(e => ({ id: e.id || uid(), date: e.date, amount: Math.round(Number(e.amount) || 0), note: String(e.note ?? ''), external: !!e.external })),
  }));
  F.bills = arr(F.bills).filter(b => b && typeof b === 'object').map(b => ({
    id: b.id || uid(), name: String(b.name ?? ''), kind: BILL_KINDS.some(k => k.id === b.kind) ? b.kind : 'other',
    amount: money(b.amount), dueDay: clamp(Math.round(Number(b.dueDay) || 1), 1, 31),
  }));
  F.txs = arr(F.txs)
    .filter(t => t && D.valid(t.date))
    .map(t => {
      const tx = { id: t.id || uid(), date: t.date, desc: String(t.desc ?? ''), type: t.type === 'income' ? 'income' : 'expense', cat: catOf(t.cat), amount: money(t.amount) };
      if (t.link && (t.link.kind === 'debt' || t.link.kind === 'bill') && t.link.id) tx.link = { kind: t.link.kind, id: String(t.link.id), ...(t.link.kind === 'bill' ? { month: String(t.link.month || t.date.slice(0, 7)) } : {}) };
      return tx;
    });
  if (!F.budgets || typeof F.budgets !== 'object' || Array.isArray(F.budgets)) F.budgets = {};
  const budgets = {};
  Object.keys(F.budgets).forEach(k => { const c = catOf(k); budgets[c] = (budgets[c] || 0) + money(F.budgets[k]); });
  F.budgets = budgets;
  F.filter = { type: ['all', 'income', 'expense'].includes(F.filter && F.filter.type) ? F.filter.type : 'all',
    cat: F.filter && (F.filter.cat === 'all' || FIN_CATS.some(c => c.id === F.filter.cat)) ? F.filter.cat : 'all',
    q: String((F.filter && F.filter.q) ?? '') };
  if (!['auto', 'pinned'].includes(st.ui.sidebarMode)) st.ui.sidebarMode = 'auto';
  delete st.ui.sidebarCollapsed;
  delete st.ui.autoLock;
  st.profile.name = String(st.profile.name ?? '');
  st.profile.subtitle = String(st.profile.subtitle ?? '');
  st.version = 1;
  return st;
}

/* ------------------------------ Kho dữ liệu (localStorage + đồng bộ) ------------------------------ */
/*
 * Mọi thay đổi được lưu ngay vào localStorage (chạy được cả khi mất mạng),
 * sau đó Sync (sync.js) đẩy lên máy chủ để các thiết bị khác cùng thấy.
 */
const Store = {
  state: null,
  hadData: false,
  _timer: null,
  load() {
    let raw = null;
    try { raw = localStorage.getItem(APP_KEY); } catch (e) { /* trình duyệt chặn storage */ }
    this.hadData = !!raw;
    try { this.state = normalizeState(raw ? JSON.parse(raw) : null); }
    catch (e) { console.warn('Dữ liệu hỏng, khởi tạo lại.', e); this.state = defaultState(); }
  },
  /** opts.fromSync = true: dữ liệu vừa nhận từ máy chủ → chỉ lưu máy, không đẩy ngược lên */
  save(opts = {}) {
    clearTimeout(this._timer); this._timer = null;
    try {
      localStorage.setItem(APP_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error(e);
      UI.toast('Không thể lưu vào trình duyệt (bộ nhớ đầy hoặc bị chặn). Hãy dùng URL ảnh thay vì tải ảnh lớn lên.', 'error');
      return false;
    }
    this.hadData = true;
    if (!opts.fromSync && typeof Sync !== 'undefined') Sync.onLocalChange();
    return true;
  },
  saveSoon() { clearTimeout(this._timer); this._timer = setTimeout(() => this.save(), 300); if (typeof Sync !== 'undefined') Sync.onTyping(); },
  flush() { if (this._timer) this.save(); },
  replace(next) { this.state = normalizeState(next); return this.save(); },
};

/* ------------------------------ Icon (nét, 24×24) ------------------------------ */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="16" width="7" height="5" rx="1.6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  week: '<rect x="3" y="4" width="18" height="18" rx="2.2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M7 14h4M13 18h4M7 18h2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2.2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calendarCheck: '<rect x="3" y="4" width="18" height="18" rx="2.2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  collapse: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v5M16.5 18.5h5"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2.2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>',
  hourglass: '<path d="M5 22h14M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  layers: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v2"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7a4 4 0 0 1 7.75-1.4"/><path d="M12 15v2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-2.16 3.19"/><path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M2 2l20 20"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2.2"/><path d="M9 3v18"/><path d="M14 9l3 3-3 3"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>',
  cloudCheck: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
  cloudOff: '<path d="M2 2l20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.19"/><path d="M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  trendUp: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  trendDown: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0z"/><path d="M8 21h8"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  bars: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7L16 1l-3 2-3-2-3 2-3-2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4M8 22h8"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5A6.5 6.5 0 0 1 12 5.5"/>',
  piggy: '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2.2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  droplet: '<path d="M12 2.7s7 7.1 7 12.3a7 7 0 0 1-14 0c0-5.2 7-12.3 7-12.3z"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  arrowDown: '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  link2: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/>',
};
function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ------------------------------ HTML helpers ------------------------------ */
function optionsHTML(list, selected) {
  return list.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
}
function chipStyle(item) { return `background-color:${item.soft};color:${item.accent};border-color:${item.accent}33`; }
function ringHTML(p, accent, extra = '') { return `<div class="ring ${extra}" style="--p:${p};--c:${accent}"><span>${p}%</span></div>`; }
function setRing(el, p) { if (!el) return; el.style.setProperty('--p', p); const s = el.querySelector('span'); if (s) s.textContent = p + '%'; }
function setBar(el, p) { if (el) el.style.width = clamp(p, 0, 100) + '%'; }
function setText(sel, txt) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = txt; }
function emptyHTML(msg, ic = 'list') { return `<div class="empty">${icon(ic)}<div>${msg}</div></div>`; }
function viewHeader(eyebrow, title, sub, rightHTML = '') {
  return `<div class="view-head">
    <div class="min-w-0"><div class="eyebrow">${eyebrow}</div><h1 class="view-title">${title}</h1>${sub ? `<p class="view-sub">${sub}</p>` : ''}</div>
    ${rightHTML ? `<div class="view-actions">${rightHTML}</div>` : ''}
  </div>`;
}

/* ------------------------------ Tiền tệ (VND) ------------------------------ */
const VND = new Intl.NumberFormat('vi-VN');
function fmtNum(n) { return VND.format(Math.round(Number(n) || 0)); }
function fmtMoney(n, sign = false) {
  const v = Math.round(Number(n) || 0);
  const s = VND.format(Math.abs(v)) + ' ₫';
  return v < 0 ? '−' + s : sign && v > 0 ? '+' + s : s;
}
function fmtShort(n) {
  const v = Math.abs(Number(n) || 0), sg = n < 0 ? '−' : '';
  const t = x => String(Math.round(x * 10) / 10).replace('.', ',');
  if (v >= 1e9) return `${sg}${t(v / 1e9)} tỷ`;
  if (v >= 1e6) return `${sg}${t(v / 1e6)}tr`;
  if (v >= 1e3) return `${sg}${Math.round(v / 1e3)}k`;
  return `${sg}${v}`;
}
/** "50k" → 50.000 · "1,5tr" → 1.500.000 · "1.250.000" → 1.250.000 · "2 triệu" → 2.000.000 */
function parseMoney(str) {
  const s = String(str ?? '').toLowerCase().replace(/\s+/g, '').replace(/₫|đ|vnd|vnđ/g, '');
  const m = s.match(/^([0-9][0-9.,]*)(k|n|nghìn|ngàn|tr|triệu|m|tỷ|ty|b)?$/);
  if (!m) { const d = s.replace(/[^0-9]/g, ''); return d ? Number(d) : 0; }
  if (m[2]) {
    let num = m[1];
    if ((num.match(/[.,]/g) || []).length > 1) num = num.replace(/[.,]/g, ''); else num = num.replace(',', '.');
    const mul = { k: 1e3, n: 1e3, 'nghìn': 1e3, 'ngàn': 1e3, tr: 1e6, 'triệu': 1e6, m: 1e6, 'tỷ': 1e9, ty: 1e9, b: 1e9 }[m[2]];
    return Math.round((parseFloat(num) || 0) * mul);
  }
  return Number(m[1].replace(/[.,]/g, '')) || 0;
}

/* ------------------------------ Sparkline (SVG nhỏ, không cần thư viện) ------------------------------ */
function sparklineSVG(vals, color = '#4F86F0', { w = 96, h = 28, fill = true } = {}) {
  const v = (vals || []).filter(x => Number.isFinite(x));
  if (v.length < 2) {
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="3" y1="${h / 2}" x2="${w - 3}" y2="${h / 2}" stroke="${color}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/></svg>`;
  }
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1, p = 3;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * (w - 2 * p) + p, max === min ? h / 2 : h - p - ((y - min) / span) * (h - 2 * p)]);
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const gid = 'sg' + Math.random().toString(36).slice(2, 9);
  const area = `${d} L${last[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    ${fill ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${gid})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="#fff" stroke="${color}" stroke-width="2"/></svg>`;
}

/** Nén ảnh tải lên (tối đa 900px, JPEG) để không làm đầy localStorage */
function compressImage(file, maxW = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / (img.width || maxW));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((img.width || maxW) * scale));
        c.height = Math.max(1, Math.round((img.height || maxW * 0.5) * scale));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------ Biểu đồ (Chart.js) ------------------------------ */
const Charts = {
  registry: {},
  make(id, canvas, config) {
    this.destroy(id);
    if (!window.Chart || !canvas) return null;
    const c = new Chart(canvas, config);
    this.registry[id] = c;
    return c;
  },
  destroy(id) { if (this.registry[id]) { this.registry[id].destroy(); delete this.registry[id]; } },
  get(id) { return this.registry[id] || null; },
};
const GRID = { color: '#EDF2FA' };
function areaGradient(rgb, a1 = 0.35, a2 = 0.02) {
  return ctx => {
    const { ctx: c, chartArea } = ctx.chart;
    if (!chartArea) return `rgba(${rgb},${a1 / 2})`;
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, `rgba(${rgb},${a1})`);
    g.addColorStop(1, `rgba(${rgb},${a2})`);
    return g;
  };
}

/* ------------------------------ UI: toast, modal, tiện ích ------------------------------ */
const UI = {
  toast(msg, type = 'info', action = null) {
    const root = $('#toastRoot'); if (!root) return;
    if (type === 'clear') { root.innerHTML = ''; return; }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'success' ? 'checkCircle' : 'info')}<span>${esc(msg)}</span>${action ? `<button class="toast-btn">${esc(action.label)}</button>` : ''}`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const dismiss = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
    if (action) el.querySelector('.toast-btn').addEventListener('click', () => { action.onClick(); dismiss(); });
    setTimeout(dismiss, action ? 6500 : type === 'error' ? 5200 : 2600);
  },
  // Trạng thái lưu/đồng bộ do Sync (sync.js) hiển thị ở nút #saveStatus
  flashSaving() {},
  flashSaved() {},
  /** Hộp thoại chung. Trả về object các trường [name] khi bấm OK, hoặc null khi huỷ */
  modal({ title, bodyHTML = '', okText = 'Đồng ý', cancelText = 'Huỷ', danger = false, icon: ic = null, validate = null, wide = false }) {
    return new Promise(resolve => {
      const root = $('#modalRoot');
      root.innerHTML = `<div class="modal-backdrop"><div class="modal card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">${ic ? `<div class="modal-ico ${danger ? 'danger' : ''}">${icon(ic)}</div>` : ''}<h3>${esc(title)}</h3></div>
        <div class="modal-body">${bodyHTML}<div class="modal-err" hidden></div></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-m="cancel">${esc(cancelText)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="ok">${esc(okText)}</button></div>
      </div></div>`;
      const bd = root.firstElementChild;
      requestAnimationFrame(() => bd.classList.add('show'));
      const collect = () => {
        const data = {};
        $$('[name]', bd).forEach(f => {
          if (f.type === 'radio') { if (f.checked) data[f.name] = f.value; }
          else if (f.type === 'checkbox') data[f.name] = f.checked;
          else data[f.name] = typeof f.value === 'string' ? f.value.trim() : f.value;
        });
        return data;
      };
      const okBtn = () => $('[data-m="ok"]', bd);
      let busy = false;
      const submit = async () => {
        if (busy) return;
        const data = collect();
        if (validate) {
          busy = true; okBtn().disabled = true; okBtn().classList.add('is-busy');
          let err = null;
          try { err = await validate(data, bd); } catch (e) { err = e.message || String(e); }
          busy = false; okBtn().disabled = false; okBtn().classList.remove('is-busy');
          if (err) {
            const box = $('.modal-err', bd); box.textContent = err; box.hidden = false;
            $('.modal', bd).classList.remove('shake'); void bd.offsetWidth; $('.modal', bd).classList.add('shake');
            return;
          }
        }
        close(data);
      };
      const close = val => {
        document.removeEventListener('keydown', onKey, true);
        bd.classList.remove('show');
        setTimeout(() => { if (root.firstElementChild === bd) root.innerHTML = ''; }, 180);
        resolve(val);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && !danger && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); e.stopPropagation(); submit(); }
      };
      document.addEventListener('keydown', onKey, true);
      bd.addEventListener('click', e => {
        if (e.target === bd) return busy ? null : close(null);
        const b = e.target.closest('[data-m]');
        if (b) { if (b.dataset.m === 'ok') submit(); else if (!busy) close(null); }
      });
      setTimeout(() => { const f = $('input:not([type=radio]):not([type=checkbox]),textarea,select', bd) || $('[data-m="ok"]', bd); f && f.focus(); }, 60);
    });
  },
  async confirm(opts) { return (await this.modal(opts)) !== null; },
  autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; },
  autoGrowAll(root = document) { $$('textarea.auto', root).forEach(t => this.autoGrow(t)); },
  flash(el, block = 'center') {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block, inline: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1800);
  },
};
