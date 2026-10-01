'use strict';
/* =====================================================================
 * sync.js — Đồng bộ dữ liệu giữa các thiết bị qua /api/state
 *
 *  • Offline-first: mọi thay đổi lưu ngay trên máy (localStorage), ~1,2 giây sau đẩy lên máy chủ.
 *  • Kéo dữ liệu mới khi mở trang, khi quay lại tab, khi có mạng trở lại và mỗi 30 giây.
 *  • Mỗi lần ghi kèm số phiên bản (rev). Nếu thiết bị khác đã ghi trước → hỏi giữ bản nào,
 *    bản không được chọn vẫn được cất vào "Lịch sử đồng bộ" (30 phiên bản gần nhất).
 *  • Không có API (mở file trực tiếp / chưa cấu hình CSDL) → chạy chế độ "chỉ lưu trên máy này".
 * ===================================================================== */

const SYNC_META_KEY = 'bo4sheets2026.sync';
const DEVICE_KEY = 'bo4sheets2026.device';
const SYNC_API = 'api/state';
const PUSH_DELAY = 1200;
const POLL_MS = 30000;
const RETRY_STEPS = [5, 15, 30, 60, 120];

const SYNC_MODES = {
  connecting: ['refresh', 'Đang kết nối…', 'muted', true],
  synced:     ['cloudCheck', 'Đã đồng bộ', 'ok'],
  pending:    ['cloud', 'Chờ đồng bộ…', 'muted'],
  syncing:    ['refresh', 'Đang đồng bộ…', 'muted', true],
  offline:    ['cloudOff', 'Mất kết nối · đã lưu trên máy', 'warn'],
  local:      ['cloudOff', 'Chỉ lưu trên máy này', 'muted'],
  error:      ['alert', 'Lỗi đồng bộ', 'err'],
  conflict:   ['alert', 'Cần chọn phiên bản', 'err'],
};

const Sync = {
  mode: 'connecting',
  enabled: false,        // đã kết nối được API đồng bộ
  reason: '',            // lý do ở chế độ "chỉ lưu trên máy"
  meta: { rev: 0, dirty: false, lastSync: null, known: false },
  device: '',
  localVer: 0,
  inflight: false,
  again: false,
  forceSnap: false,
  pendingRemote: null,
  retry: 0,
  _asking: false,

  /* ------------------------------ Tiện ích ------------------------------ */
  detectDevice() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Mac OS X/i.test(ua) ? 'macOS'
      : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : 'Thiết bị';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt';
    return `${br} · ${os}`;
  },
  loadMeta() {
    let m = null;
    try { m = JSON.parse(localStorage.getItem(SYNC_META_KEY) || 'null'); } catch (e) { /* bỏ qua */ }
    // Máy chưa từng đồng bộ nhưng đã có dữ liệu → coi như "có thay đổi chưa gửi"
    this.meta = m && typeof m === 'object' ? { rev: 0, dirty: false, lastSync: null, known: false, ...m } : { rev: 0, dirty: Store.hadData, lastSync: null, known: false };
    try { this.device = localStorage.getItem(DEVICE_KEY) || ''; } catch (e) { /* bỏ qua */ }
    if (!this.device) { this.device = this.detectDevice(); this.saveDevice(); }
  },
  saveMeta() { try { localStorage.setItem(SYNC_META_KEY, JSON.stringify(this.meta)); } catch (e) { /* bỏ qua */ } },
  saveDevice() { try { localStorage.setItem(DEVICE_KEY, this.device); } catch (e) { /* bỏ qua */ } },

  async api(query = '', { method = 'GET', body, timeout = 15000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(SYNC_API + query, {
        method, cache: 'no-store', signal: ctrl.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try { data = await r.json(); } catch (e) { /* không phải JSON (vd: 404 của server tĩnh) */ }
      return { status: r.status, data };
    } finally { clearTimeout(t); }
  },

  /** Giữ lại các lựa chọn hiển thị riêng của từng thiết bị khi nhận dữ liệu từ máy chủ */
  keepViewPrefs(next) {
    const cur = Store.state;
    if (!cur) return next;
    next.ui = { ...next.ui, ...cur.ui };
    next.habits.year = cur.habits.year; next.habits.month = cur.habits.month;
    next.weekly.weekStart = cur.weekly.weekStart;
    next.year.year = cur.year.year;
    next.finance.period = cur.finance.period;
    next.finance.filter = { ...cur.finance.filter };
    return next;
  },
  isEditing() {
    const a = document.activeElement;
    const typing = a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && a.closest('#main, .topbar');
    return !!typing || !!document.querySelector('#modalRoot .modal-backdrop');
  },
  timeLabel(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const today = D.today() === D.iso(d);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}${today ? ' hôm nay' : ' · ' + D.dmy(d)}`;
  },

  /* ------------------------------ Hiển thị trạng thái ------------------------------ */
  setMode(mode) {
    this.mode = mode;
    const el = $('#saveStatus');
    if (!el) return;
    const [ic, text, tone, spin] = SYNC_MODES[mode] || SYNC_MODES.local;
    el.className = `save-status ${tone}`;
    el.innerHTML = `${icon(ic, 'w-4 h-4' + (spin ? ' spin' : ''))}<span>${text}</span>`;
    const tips = {
      local: this.reason || 'Dữ liệu chỉ lưu trên trình duyệt này.',
      offline: 'Không kết nối được máy chủ. Thay đổi vẫn được lưu trên máy và sẽ tự đồng bộ khi có mạng.',
      synced: `Đã đồng bộ${this.meta.lastSync ? ' lúc ' + this.timeLabel(new Date(this.meta.lastSync).toISOString()) : ''} — bấm để xem chi tiết`,
    };
    el.title = tips[mode] || 'Trạng thái đồng bộ — bấm để xem chi tiết';
  },
  bump() { const el = $('#saveStatus'); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } },

  /* ------------------------------ Khởi động ------------------------------ */
  async start() {
    this.loadMeta();
    this.setMode('connecting');
    this.bindEvents();
    let res = null;
    try { res = await this.api(''); } catch (e) { res = null; }

    const ok = res && res.status === 200 && res.data && typeof res.data === 'object' && 'rev' in res.data;
    if (!ok) {
      if (!res && this.meta.known) {
        // Máy đã từng đồng bộ, chỉ tạm mất mạng → vẫn bật đồng bộ và thử lại sau
        this.enabled = true;
        this.setMode('offline');
        this.scheduleRetry();
      } else {
        this.enabled = false;
        this.reason = res && res.data && res.data.error === 'not_configured'
          ? 'Máy chủ chưa kết nối cơ sở dữ liệu (xem README → Bật đồng bộ). Dữ liệu đang chỉ lưu trên máy này.'
          : 'Không tìm thấy API đồng bộ (đang mở file trực tiếp hoặc server tĩnh). Dữ liệu chỉ lưu trên máy này.';
        this.setMode('local');
        if (!Store.hadData) App.welcome();
      }
      return;
    }
    this.enabled = true;
    this.meta.known = true;
    this.saveMeta();
    await this.reconcile(res.data);
    this.startPolling();
  },

  /** So sánh bản trên máy với bản trên máy chủ lúc mở trang */
  async reconcile(srv) {
    const srvRev = Number(srv.rev) || 0;
    if (srvRev === 0 || !srv.state) {
      // Máy chủ còn trống → đưa dữ liệu của máy này lên (nếu có)
      this.meta.rev = 0;
      if (Store.hadData) { this.meta.dirty = true; this.saveMeta(); await this.push(); }
      else { this.saveMeta(); this.markClean(); this.setMode('synced'); App.welcome(); }
      return;
    }
    if (this.meta.rev === srvRev) {
      if (this.meta.dirty && Store.hadData) return this.push();
      if (!Store.hadData) return this.adopt(srv, false);
      this.meta.lastSync = Date.now(); this.saveMeta(); this.markClean();
      return this.setMode('synced');
    }
    // Máy chủ có bản khác bản gốc của máy này
    if (this.meta.dirty && Store.hadData && !this.sameAsLocal(srv.state)) return this.askConflict(srv);
    this.adopt(srv, false);
  },

  /** Nội dung cần đồng bộ (bỏ các lựa chọn hiển thị riêng của từng thiết bị: tháng đang xem, bộ lọc, chế độ menu…) */
  contentJSON(st) {
    const { ui, ...rest } = st;
    return JSON.stringify({
      ...rest,
      habits: { ...st.habits, year: 0, month: 0 },
      weekly: { ...st.weekly, weekStart: '' },
      year: { ...st.year, year: 0 },
      finance: { ...st.finance, period: '', filter: null },
    });
  },
  markClean() { try { this.lastContent = this.contentJSON(Store.state); } catch (e) { this.lastContent = null; } },
  sameAsLocal(state) {
    try { return this.contentJSON(normalizeState(state)) === this.contentJSON(Store.state); }
    catch (e) { return false; }
  },

  /** Nhận dữ liệu từ máy chủ và hiển thị */
  adopt(srv, notify) {
    Store.state = this.keepViewPrefs(normalizeState(srv.state));
    Store.save({ fromSync: true });
    this.meta.rev = Number(srv.rev) || 0;
    this.meta.dirty = false;
    this.meta.lastSync = Date.now();
    this.saveMeta();
    this.pendingRemote = null;
    this.markClean();
    App.rerender();
    this.setMode('synced');
    if (notify) UI.toast(`Đã cập nhật dữ liệu mới từ ${srv.device || 'thiết bị khác'}`, 'info');
  },

  /* ------------------------------ Gửi thay đổi ------------------------------ */
  onTyping() {
    if (!this.enabled || this.mode === 'conflict' || this.mode === 'offline') return;
    const a = document.activeElement;
    if (a && a.dataset && /^finance\.filter\./.test(a.dataset.path || '')) return;   // ô tìm kiếm/lọc: không phải dữ liệu
    this.setMode('pending');
  },
  onLocalChange() {
    this.localVer++;
    if (!this.enabled) { this.bump(); return; }
    // Chỉ đổi lựa chọn hiển thị (tháng đang xem, bộ lọc…) → không cần gửi lên máy chủ
    if (!this.meta.dirty && this.lastContent && this.contentJSON(Store.state) === this.lastContent) {
      if (this.mode === 'pending') this.setMode('synced');
      return;
    }
    this.meta.dirty = true;
    this.saveMeta();
    if (this.mode === 'conflict') return;
    if (this.mode !== 'offline') this.setMode('pending');
    this.schedulePush(PUSH_DELAY);
  },
  /** Thao tác lớn (tải mẫu, xoá, khôi phục JSON): yêu cầu máy chủ cất bản cũ vào lịch sử trước khi ghi đè */
  snapshotNext() { this.forceSnap = true; },
  schedulePush(ms) { clearTimeout(this._pushT); this._pushT = setTimeout(() => this.push(), ms); },

  async push() {
    if (!this.enabled || this.mode === 'conflict') return;
    if (this.inflight) { this.again = true; return; }
    Store.flush();                 // ghi nốt thay đổi đang gõ dở (có thể hẹn lại một lần đẩy → huỷ ngay dưới đây)
    clearTimeout(this._pushT);
    this.inflight = true;
    this.setMode('syncing');
    const ver = this.localVer;
    const snap = this.forceSnap;
    let res = null;
    try { res = await this.api('', { method: 'PUT', body: { baseRev: this.meta.rev, state: Store.state, device: this.device, snapshot: snap } }); }
    catch (e) { res = null; }
    this.inflight = false;

    if (!res) { this.setMode('offline'); this.scheduleRetry(); return; }
    if (res.status === 200 && res.data && res.data.rev) {
      this.retry = 0;
      if (snap) this.forceSnap = false;
      this.meta.rev = res.data.rev;
      this.meta.lastSync = Date.now();
      const changedMeanwhile = this.again || this.localVer !== ver;
      this.again = false;
      this.meta.dirty = changedMeanwhile;
      this.saveMeta();
      if (!changedMeanwhile) this.markClean();
      if (changedMeanwhile) { this.setMode('pending'); this.schedulePush(400); }
      else this.setMode('synced');
      return;
    }
    if (res.status === 409 && res.data) { this.again = false; return this.askConflict(res.data); }
    if (res.status === 413) {
      this.setMode('error');
      UI.toast('Dữ liệu quá lớn để đồng bộ (tối đa khoảng 3,5 MB). Hãy xoá bớt ảnh tải lên hoặc dùng URL ảnh.', 'error');
      return;
    }
    if (res.status === 503) { this.enabled = false; this.reason = 'Máy chủ chưa kết nối cơ sở dữ liệu.'; this.setMode('local'); return; }
    this.setMode('error');
    this.scheduleRetry();
  },

  scheduleRetry() {
    const s = RETRY_STEPS[Math.min(this.retry, RETRY_STEPS.length - 1)];
    this.retry++;
    clearTimeout(this._retryT);
    this._retryT = setTimeout(() => (this.meta.dirty ? this.push() : this.pull()), s * 1000);
  },

  /* ------------------------------ Nhận thay đổi ------------------------------ */
  async pull(manual = false) {
    if (!this.enabled || this.inflight || this.mode === 'conflict') return;
    if (this.meta.dirty) return this.push();   // gửi trước; nếu máy chủ đã đổi sẽ nhận 409 và hỏi
    let res = null;
    try { res = await this.api(`?since=${this.meta.rev}`); } catch (e) { res = null; }
    if (!res) { this.setMode('offline'); this.scheduleRetry(); return; }
    if (res.status !== 200 || !res.data) { if (res.status === 503) { this.enabled = false; this.setMode('local'); } else { this.setMode('error'); this.scheduleRetry(); } return; }
    this.retry = 0;
    if (res.data.changed === false) {
      this.meta.lastSync = Date.now(); this.saveMeta();
      this.setMode('synced');
      if (manual) UI.toast('Dữ liệu đã là mới nhất', 'success');
      return;
    }
    if (!res.data.state) { this.setMode('synced'); return; }
    if (this.meta.dirty) return this.askConflict(res.data);
    if (this.isEditing()) { this.pendingRemote = res.data; return; }   // đợi rời ô đang gõ
    this.adopt(res.data, true);
  },

  startPolling() {
    clearInterval(this._pollT);
    this._pollT = setInterval(() => { if (!document.hidden) this.pull(); }, POLL_MS);
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.enabled) return;
      if (document.hidden) { Store.flush(); if (this.meta.dirty) this.push(); }
      else this.pull();
    });
    window.addEventListener('online', () => { if (this.enabled) { this.retry = 0; this.pull(); } });
    window.addEventListener('offline', () => { if (this.enabled) this.setMode('offline'); });
    // Có bản mới từ máy chủ trong lúc đang gõ → áp dụng khi rời ô
    document.addEventListener('focusout', () => setTimeout(() => {
      if (this.pendingRemote && !this.isEditing() && !this.meta.dirty) this.adopt(this.pendingRemote, true);
    }, 150));
  },

  /* ------------------------------ Xung đột ------------------------------ */
  async askConflict(srv) {
    if (this._asking) return;
    if (srv.state && this.sameAsLocal(srv.state)) {       // thực ra giống hệt → chỉ cập nhật số phiên bản
      this.meta.rev = Number(srv.rev) || 0; this.meta.dirty = false; this.meta.lastSync = Date.now(); this.saveMeta();
      this.markClean();
      this.setMode('synced');
      return;
    }
    this.setMode('conflict');
    if (document.querySelector('#modalRoot .modal-backdrop')) return;   // đang mở hộp thoại khác → để người dùng bấm trạng thái sau
    this._asking = true;
    const r = await UI.modal({
      title: 'Có thay đổi từ thiết bị khác', icon: 'repeat', okText: 'Xác nhận', cancelText: 'Để sau',
      bodyHTML: `<p>Trên máy chủ có phiên bản mới hơn từ <b>${esc(srv.device || 'thiết bị khác')}</b> (${this.timeLabel(srv.updatedAt)}), trong khi máy này cũng có thay đổi chưa đồng bộ. Bạn muốn giữ bản nào?</p>
        <div class="opt-list">
          <label class="opt"><input type="radio" name="op" value="server" checked><span><b>Dùng bản trên máy chủ</b><small>Bản của máy này được cất vào “Lịch sử đồng bộ” để khôi phục nếu cần.</small></span></label>
          <label class="opt"><input type="radio" name="op" value="local"><span><b>Giữ bản trên máy này</b><small>Ghi đè máy chủ; bản trên máy chủ được cất vào “Lịch sử đồng bộ”.</small></span></label>
        </div>`,
    });
    this._asking = false;
    if (!r) { UI.toast('Đã tạm dừng đồng bộ — bấm vào trạng thái “Cần chọn phiên bản” để quyết định.', 'info'); return; }
    if (r.op === 'local') {
      this.meta.rev = Number(srv.rev) || 0;
      this.forceSnap = true;
      this.mode = 'pending';
      return this.push();
    }
    try { await this.api('?archive=1', { method: 'POST', body: { state: Store.state, device: this.device } }); } catch (e) { /* vẫn tiếp tục */ }
    this.adopt(srv, false);
    UI.toast('Đã dùng bản trên máy chủ (bản của máy này nằm trong Lịch sử đồng bộ)', 'success');
  },

  async resolveConflictNow() {
    let res = null;
    try { res = await this.api(''); } catch (e) { res = null; }
    if (!res || res.status !== 200 || !res.data) { UI.toast('Chưa kết nối được máy chủ, thử lại sau.', 'error'); return; }
    this.mode = 'pending';
    if (!res.data.state || Number(res.data.rev) === this.meta.rev) return this.push();
    return this.askConflict(res.data);
  },

  /* ------------------------------ Bảng đồng bộ & lịch sử ------------------------------ */
  async openPanel() {
    if (this.mode === 'conflict') return this.resolveConflictNow();
    if (!this.enabled) {
      await UI.modal({
        title: 'Chỉ lưu trên máy này', icon: 'cloudOff', okText: 'Đã hiểu', cancelText: 'Đóng',
        bodyHTML: `<p>${esc(this.reason || 'Chưa kết nối được máy chủ đồng bộ.')}</p>
          <p class="muted">Để đồng bộ giữa các thiết bị: deploy lên Vercel và thêm cơ sở dữ liệu <b>Upstash for Redis</b> (Storage → Create Database) cho project, rồi deploy lại. Chi tiết trong README.</p>`,
      });
      return;
    }
    const r = await UI.modal({
      title: 'Đồng bộ dữ liệu', icon: 'cloudCheck', okText: 'Thực hiện', cancelText: 'Đóng',
      bodyHTML: `<dl class="sync-info">
          <dt>Trạng thái</dt><dd>${SYNC_MODES[this.mode][1]}</dd>
          <dt>Phiên bản</dt><dd>#${this.meta.rev}</dd>
          <dt>Đồng bộ lần cuối</dt><dd>${this.meta.lastSync ? this.timeLabel(new Date(this.meta.lastSync).toISOString()) : '—'}</dd>
        </dl>
        <label>Tên thiết bị này (hiện trong lịch sử)</label>
        <input name="device" class="field-input" value="${esc(this.device)}" maxlength="60">
        <div class="opt-list">
          <label class="opt"><input type="radio" name="op" value="now" checked><span><b>Đồng bộ ngay</b><small>Gửi thay đổi và lấy bản mới nhất từ máy chủ.</small></span></label>
          <label class="opt"><input type="radio" name="op" value="history"><span><b>Lịch sử phiên bản</b><small>Xem và khôi phục 30 phiên bản gần nhất.</small></span></label>
        </div>`,
    });
    if (!r) return;
    if (r.device && r.device !== this.device) { this.device = r.device.slice(0, 60); this.saveDevice(); }
    if (r.op === 'history') return this.openHistory();
    if (this.meta.dirty) await this.push(); else await this.pull(true);
  },

  async openHistory() {
    if (!this.enabled) return this.openPanel();
    let res = null;
    try { res = await this.api('?history=1'); } catch (e) { res = null; }
    if (!res || res.status !== 200 || !res.data) { UI.toast('Không tải được lịch sử đồng bộ.', 'error'); return; }
    const items = res.data.items || [];
    const list = items.length
      ? items.map((it, k) => `<label class="opt"><input type="radio" name="idx" value="${it.index}" ${k === 0 ? 'checked' : ''}><span>
          <b>${this.timeLabel(it.updatedAt)}</b><small>${esc(it.device || 'Thiết bị')} · ${it.rev === 'local' ? 'bản chưa đồng bộ' : 'phiên bản #' + esc(it.rev)} · ${Math.max(1, Math.round(it.bytes / 1024))} KB</small></span></label>`).join('')
      : '<div class="hist-empty">Chưa có phiên bản nào. Lịch sử được tạo tự động (tối đa 10 phút / lần) khi dữ liệu thay đổi.</div>';
    const r = await UI.modal({
      title: 'Lịch sử đồng bộ', icon: 'history', okText: items.length ? 'Khôi phục bản đã chọn' : 'Đóng', cancelText: 'Đóng',
      bodyHTML: `<p class="muted">Khôi phục sẽ thay dữ liệu hiện tại trên mọi thiết bị; bản hiện tại được cất lại vào lịch sử.</p>
        <div class="opt-list hist-list">${list}</div>`,
    });
    if (!r || !items.length || r.idx === undefined) return;
    Store.flush();
    if (this.meta.dirty) await this.push();
    let rr = null;
    try { rr = await this.api(`?restore=${encodeURIComponent(r.idx)}`, { method: 'POST', body: { device: this.device } }); } catch (e) { rr = null; }
    if (!rr || rr.status !== 200 || !rr.data || !rr.data.state) { UI.toast('Khôi phục không thành công, thử lại sau.', 'error'); return; }
    this.adopt(rr.data, false);
    UI.toast('Đã khôi phục phiên bản đã chọn', 'success');
  },
};

Actions['sync-panel'] = () => Sync.openPanel();
Actions['sync-history'] = () => Sync.openHistory();
