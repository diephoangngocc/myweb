'use strict';
/**
 * =====================================================================
 * API đồng bộ Planner 2026 — Vercel Function (Node.js)
 * Lưu toàn bộ dữ liệu planner (1 tài liệu JSON) trong Upstash Redis qua REST API.
 *
 *   GET  /api/state              → { rev, updatedAt, device, state }        (rev = 0, state = null nếu trống)
 *   GET  /api/state?since=REV    → { changed: false, rev }  nếu chưa có gì mới, ngược lại như GET đầy đủ
 *   PUT  /api/state              ← { baseRev, state, device, snapshot? }
 *                                → 200 { rev, updatedAt }  |  409 { conflict: true, rev, updatedAt, device, state }
 *   GET  /api/state?history=1    → { items: [{ index, rev, updatedAt, device, bytes }] }
 *   POST /api/state?restore=N    → { rev, updatedAt, device, state }        (khôi phục phiên bản N trong lịch sử)
 *   POST /api/state?archive=1    ← { state, device } → { ok: true }        (cất một bản vào lịch sử, không đổi dữ liệu chính)
 *
 * Biến môi trường (Vercel tự thêm khi cài "Upstash for Redis" từ Marketplace):
 *   KV_REST_API_URL, KV_REST_API_TOKEN   (hoặc UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 * =====================================================================
 */

const DOC = 'planner2026:doc';          // hash: rev, data, updatedAt, device, lastSnapAt
const HIST = 'planner2026:history';     // list: "rev|updatedAt|device|<json>"
const MAX_BYTES = 3500000;              // < 4,5 MB giới hạn body của Vercel Functions
const HISTORY_MAX = 30;                 // giữ 30 phiên bản gần nhất
const SNAP_EVERY_MS = 10 * 60 * 1000;   // tự chụp lại bản cũ tối đa 10 phút / lần

/*
 * Ghi có kiểm tra phiên bản (compare-and-set), chạy nguyên tử trong Redis.
 * KEYS: doc, history · ARGV: baseRev, data, updatedAt, device, now, forceSnap, snapEveryMs, historyMax
 * Trả về {1, newRev} nếu ghi được, {0, currentRev} nếu baseRev đã cũ (thiết bị khác vừa ghi).
 */
const SAVE_SCRIPT = `
local cur = redis.call('HGET', KEYS[1], 'rev')
if not cur then cur = '0' end
if cur ~= ARGV[1] then return {0, cur} end
if cur ~= '0' then
  local last = tonumber(redis.call('HGET', KEYS[1], 'lastSnapAt') or '0') or 0
  if ARGV[6] == '1' or (tonumber(ARGV[5]) - last) >= tonumber(ARGV[7]) then
    local prev = redis.call('HMGET', KEYS[1], 'data', 'updatedAt', 'device')
    if prev[1] then
      redis.call('LPUSH', KEYS[2], cur .. '|' .. (prev[2] or '') .. '|' .. (prev[3] or '') .. '|' .. prev[1])
      redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[8]) - 1)
    end
    redis.call('HSET', KEYS[1], 'lastSnapAt', ARGV[5])
  end
end
local nrev = tostring(tonumber(cur) + 1)
redis.call('HSET', KEYS[1], 'rev', nrev, 'data', ARGV[2], 'updatedAt', ARGV[3], 'device', ARGV[4])
return {1, nrev}
`;

function storageConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function redis(cfg, command) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* phản hồi không phải JSON */ }
  if (!r.ok || j.error) throw new Error(j.error || `Upstash HTTP ${r.status}`);
  return j.result;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function cleanDevice(d) {
  return String(d || 'Thiết bị').replace(/[|\r\n]/g, ' ').trim().slice(0, 60) || 'Thiết bị';
}

function isPlannerState(s) {
  return !!s && typeof s === 'object' && !Array.isArray(s) && typeof s.goals === 'object' && typeof s.habits === 'object';
}

/** HGETALL trả về [field, value, field, value, ...] */
function hashToObject(arr) {
  const o = {};
  for (let i = 0; Array.isArray(arr) && i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

/** Ghép JSON phản hồi mà không parse lại dữ liệu lớn (data đã là JSON hợp lệ) */
function docPayload(doc, extra = '') {
  const head = { rev: Number(doc.rev) || 0, updatedAt: doc.updatedAt || null, device: doc.device || null };
  const meta = JSON.stringify(head).slice(0, -1);
  return `${meta}${extra},"state":${doc.data || 'null'}}`;
}

function parseHistoryEntry(entry) {
  const a = entry.indexOf('|');
  const b = entry.indexOf('|', a + 1);
  const c = entry.indexOf('|', b + 1);
  if (a < 0 || b < 0 || c < 0) return null;
  return { rev: entry.slice(0, a), updatedAt: entry.slice(a + 1, b) || null, device: entry.slice(b + 1, c) || null, data: entry.slice(c + 1) };
}

function readBody(req) {
  try {
    const b = req.body;
    if (typeof b === 'string') return JSON.parse(b);
    if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8'));
    return b || null;
  } catch (e) {
    return undefined; // JSON hỏng
  }
}

async function save(cfg, { baseRev, data, device, forceSnap }) {
  const now = Date.now();
  const updatedAt = new Date(now).toISOString();
  const result = await redis(cfg, [
    'EVAL', SAVE_SCRIPT, '2', DOC, HIST,
    String(baseRev), data, updatedAt, device, String(now), forceSnap ? '1' : '0', String(SNAP_EVERY_MS), String(HISTORY_MAX),
  ]);
  return { ok: Number(result[0]) === 1, rev: Number(result[1]) || 0, updatedAt };
}

module.exports = async function handler(req, res) {
  const cfg = storageConfig();
  if (!cfg) return send(res, 503, { error: 'not_configured', message: 'Chưa kết nối cơ sở dữ liệu (thiếu KV_REST_API_URL / KV_REST_API_TOKEN).' });

  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  try {
    /* ---------- Đọc ---------- */
    if (req.method === 'GET' && q.history) {
      const list = (await redis(cfg, ['LRANGE', HIST, '0', String(HISTORY_MAX - 1)])) || [];
      const items = list.map((e, index) => {
        const p = parseHistoryEntry(e);
        return p ? { index, rev: p.rev, updatedAt: p.updatedAt, device: p.device, bytes: Buffer.byteLength(p.data) } : null;
      }).filter(Boolean);
      return send(res, 200, { items });
    }

    if (req.method === 'GET') {
      if (q.since !== undefined) {
        const rev = Number(await redis(cfg, ['HGET', DOC, 'rev'])) || 0;
        if (String(rev) === String(q.since)) return send(res, 200, { changed: false, rev });
      }
      const doc = hashToObject(await redis(cfg, ['HGETALL', DOC]));
      if (!doc.rev) return send(res, 200, { changed: true, rev: 0, updatedAt: null, device: null, state: null });
      return send(res, 200, docPayload(doc, ',"changed":true'));
    }

    /* ---------- Ghi ---------- */
    const body = readBody(req);
    if (body === undefined) return send(res, 400, { error: 'bad_json' });

    if ((req.method === 'PUT' || req.method === 'POST') && !q.restore && !q.archive) {
      if (!body || !isPlannerState(body.state)) return send(res, 400, { error: 'bad_state' });
      const data = JSON.stringify(body.state);
      if (Buffer.byteLength(data) > MAX_BYTES) return send(res, 413, { error: 'too_large', maxBytes: MAX_BYTES });
      const r = await save(cfg, { baseRev: Number(body.baseRev) || 0, data, device: cleanDevice(body.device), forceSnap: !!body.snapshot });
      if (r.ok) return send(res, 200, { rev: r.rev, updatedAt: r.updatedAt });
      const doc = hashToObject(await redis(cfg, ['HGETALL', DOC]));
      return send(res, 409, docPayload(doc, ',"conflict":true'));
    }

    if (req.method === 'POST' && q.archive) {
      if (!body || !isPlannerState(body.state)) return send(res, 400, { error: 'bad_state' });
      const data = JSON.stringify(body.state);
      if (Buffer.byteLength(data) > MAX_BYTES) return send(res, 413, { error: 'too_large', maxBytes: MAX_BYTES });
      await redis(cfg, ['LPUSH', HIST, `local|${new Date().toISOString()}|${cleanDevice(body.device)}|${data}`]);
      await redis(cfg, ['LTRIM', HIST, '0', String(HISTORY_MAX - 1)]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && q.restore !== undefined) {
      const idx = Number(q.restore);
      if (!Number.isInteger(idx) || idx < 0 || idx >= HISTORY_MAX) return send(res, 400, { error: 'bad_index' });
      const entry = await redis(cfg, ['LINDEX', HIST, String(idx)]);
      const p = entry && parseHistoryEntry(entry);
      if (!p) return send(res, 404, { error: 'not_found' });
      const device = cleanDevice((body && body.device) || 'Khôi phục');
      for (let attempt = 0; attempt < 3; attempt++) {
        const cur = Number(await redis(cfg, ['HGET', DOC, 'rev'])) || 0;
        const r = await save(cfg, { baseRev: cur, data: p.data, device, forceSnap: true });
        if (r.ok) return send(res, 200, docPayload({ rev: r.rev, updatedAt: r.updatedAt, device, data: p.data }));
      }
      return send(res, 409, { error: 'busy' });
    }

    return send(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/state]', err);
    return send(res, 502, { error: 'storage_error', message: String(err && err.message || err) });
  }
};
