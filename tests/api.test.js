import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { createAppServer } from '../server/index.js';
import { QueueStore } from '../server/store.js';
import { computeFormatBits, generateQRMatrix, renderQRSvg, rsComputeRemainder } from '../public/js/qrcode.js';

function createMockReq(reqPath, { method = 'GET', headers = {}, body = null } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = reqPath;
  req.headers = { host: 'localhost:3000' };
  for (const [k, v] of Object.entries(headers)) {
    req.headers[k.toLowerCase()] = v;
  }
  req.destroy = () => {};

  const payload = body !== null ? JSON.stringify(body) : null;
  if (payload !== null) {
    req.headers['content-type'] = 'application/json';
    req.headers['content-length'] = String(Buffer.byteLength(payload));
  }

  queueMicrotask(() => {
    if (payload !== null) {
      req.emit('data', Buffer.from(payload, 'utf8'));
    }
    req.emit('end');
  });

  return req;
}

function invokeApp(handleRequest, reqPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = createMockReq(reqPath, options);
    const chunks = [];
    let statusCode = 200;
    let resHeaders = {};

    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });

    res.headersSent = false;
    res.writeHead = (code, hdrs = {}) => {
      statusCode = code;
      resHeaders = {};
      for (const [k, v] of Object.entries(hdrs)) {
        resHeaders[k.toLowerCase()] = v;
      }
      res.headersSent = true;
    };

    res.on('finish', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // non-json
      }
      resolve({ status: statusCode, headers: resHeaders, text, json });
    });

    res.on('error', reject);
    Promise.resolve(handleRequest(req, res)).catch(reject);
  });
}

function openSseStream(handleRequest, reqPath = '/api/events') {
  const req = new EventEmitter();
  req.method = 'GET';
  req.url = reqPath;
  req.headers = { host: 'localhost:3000' };

  const events = [];
  let buffer = '';
  let statusCode = 0;
  let headers = {};

  const res = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString('utf8');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop();
      for (const blk of blocks) {
        const eventMatch = blk.match(/^event:\s*(.+)$/m);
        const dataMatch = blk.match(/^data:\s*(.+)$/m);
        if (eventMatch && dataMatch) {
          events.push({
            event: eventMatch[1].trim(),
            data: JSON.parse(dataMatch[1]),
          });
        }
      }
      cb();
    },
  });

  res.writeHead = (code, hdrs = {}) => {
    statusCode = code;
    headers = {};
    for (const [k, v] of Object.entries(hdrs)) {
      headers[k.toLowerCase()] = v;
    }
  };

  handleRequest(req, res);

  return {
    get status() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    events,
    close() {
      req.emit('close');
    },
  };
}

describe('QR Code Generator (ISO/IEC 18004)', () => {
  it('computes exact ISO/IEC 18004 format bits for ECC-L masks', () => {
    assert.equal(computeFormatBits(0), 0x77c4);
    assert.equal(computeFormatBits(1), 0x72f3);
    assert.equal(computeFormatBits(2), 0x7daa);
    assert.equal(computeFormatBits(3), 0x789d);
  });

  it('computes Reed-Solomon error correction codewords deterministically', () => {
    const data = new Uint8Array([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17, 236, 17, 236]);
    const rem = rsComputeRemainder(data, 7);
    assert.equal(rem.length, 7);
    assert.ok(rem.some((b) => b !== 0));
  });

  it('generates valid QR matrices & SVG for short and long URLs', () => {
    const shortMat = generateQRMatrix('http://localhost:3000');
    assert.equal(shortMat.length, 25); // 21 bytes -> Version 2 (25x25)
    assert.equal(shortMat[4 * 2 + 9][8], 1); // Always-dark module

    const longUrl = 'http://192.168.100.42:3000/?ticket=tkt_1234567890abcdef';
    const longMat = generateQRMatrix(longUrl);
    assert.equal(longMat.length, 33); // 55 bytes -> Version 4 (33x33)
    assert.equal(longMat[4 * 4 + 9][8], 1);

    const svg = renderQRSvg(longUrl, { size: 160 });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('viewBox="0 0 37 37"'));
  });
});

describe('AntreKu Real-Time Queue & Booking Server', () => {
  let tmpDir;
  let stateFile;
  let app;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antreku-test-'));
    stateFile = path.join(tmpDir, 'state.json');
    app = createAppServer({ stateFile });
  });

  after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves customer, admin, display pages and blocks path traversal', async () => {
    const home = await invokeApp(app.handleRequest, '/');
    assert.equal(home.status, 200);
    assert.ok(home.headers['content-type'].includes('text/html'));
    assert.ok(home.text.includes('Ambil Nomor Antrean'));

    const admin = await invokeApp(app.handleRequest, '/admin');
    assert.equal(admin.status, 200);
    assert.ok(admin.text.includes('Dasbor Admin AntreKu'));

    const display = await invokeApp(app.handleRequest, '/display');
    assert.equal(display.status, 200);
    assert.ok(display.text.includes('Sedang Dipanggil'));

    const css = await invokeApp(app.handleRequest, '/css/tokens.css');
    assert.equal(css.status, 200);
    assert.ok(css.headers['content-type'].includes('text/css'));

    const traversal1 = await invokeApp(app.handleRequest, '/%2e%2e/package.json');
    assert.ok(traversal1.status === 403 || traversal1.status === 404);
    assert.ok(!traversal1.text.includes('"antreku"'));

    const traversal2 = await invokeApp(app.handleRequest, '/%2e%2e%5cpackage.json');
    assert.ok(traversal2.status === 403 || traversal2.status === 404);
    assert.ok(!traversal2.text.includes('"antreku"'));
  });

  it('returns sanitized public state without adminPin or raw phone numbers', async () => {
    const res = await invokeApp(app.handleRequest, '/api/state');
    assert.equal(res.status, 200);
    assert.equal(res.json.settings.adminPin, undefined);
    assert.equal(res.json.settings.presetKey, 'klinik');
    assert.ok(res.json.services.length >= 3);
    assert.ok(res.json.counters.length >= 3);
    // Customer phone should be masked on public snapshot
    const anyWithPhone = res.json.tickets.find((t) => t.phone);
    assert.ok(anyWithPhone && anyWithPhone.phone.includes('****'));
  });

  it('handles customer walk-in creation, scheduled booking check-in, and cancellation', async () => {
    const walkIn = await invokeApp(app.handleRequest, '/api/tickets', {
      method: 'POST',
      body: {
        customerName: 'Tono Wijaya',
        phone: '081234567890',
        serviceId: 'srv-umum',
        bookingType: 'walkin',
        notes: 'Cek tekanan darah',
      },
    });
    assert.equal(walkIn.status, 201);
    assert.match(walkIn.json.ticket.number, /^A-\d{3}$/);
    assert.equal(walkIn.json.ticket.status, 'waiting');
    assert.ok(walkIn.json.ticket.estimatedWaitMinutes >= 1);

    const booking = await invokeApp(app.handleRequest, '/api/tickets', {
      method: 'POST',
      body: {
        customerName: 'Lina Marlina',
        serviceId: 'srv-gigi',
        bookingType: 'scheduled',
        bookingTime: '15:00',
      },
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.json.ticket.status, 'booked');

    const checkedIn = await invokeApp(app.handleRequest, `/api/tickets/${booking.json.ticket.id}/checkin`, {
      method: 'POST',
    });
    assert.equal(checkedIn.status, 200);
    assert.equal(checkedIn.json.ticket.status, 'waiting');

    const cancelled = await invokeApp(app.handleRequest, `/api/tickets/${booking.json.ticket.id}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.ticket.status, 'cancelled');
  });

  it('protects admin routes and broadcasts real-time SSE announcements on call & recall', async () => {
    const denied = await invokeApp(app.handleRequest, '/api/admin/call-next', {
      method: 'POST',
      body: { counterId: 'ctr-1' },
    });
    assert.equal(denied.status, 401);

    const auth = await invokeApp(app.handleRequest, '/api/admin/auth', {
      method: 'POST',
      body: { pin: '1234' },
    });
    assert.equal(auth.status, 200);
    assert.equal(auth.json.ok, true);

    // Connect real-time SSE client
    const sse = openSseStream(app.handleRequest, '/api/events');
    assert.equal(sse.status, 200);
    assert.ok(sse.headers['content-type'].includes('text/event-stream'));
    assert.ok(sse.events.some((e) => e.event === 'init'));

    // Admin calls next ticket on ctr-1
    const callRes = await invokeApp(app.handleRequest, '/api/admin/call-next', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
      body: { counterId: 'ctr-1' },
    });
    assert.equal(callRes.status, 200);
    assert.ok(callRes.json.called);
    const calledId = callRes.json.called.id;
    assert.equal(callRes.json.called.status, 'called');

    // Admin recalls same ticket
    const recallRes = await invokeApp(app.handleRequest, `/api/admin/tickets/${calledId}/recall`, {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
    });
    assert.equal(recallRes.status, 200);
    assert.equal(recallRes.json.announcement.callCount, 2);

    const announcements = sse.events.filter((e) => e.event === 'announcement');
    assert.equal(announcements.length, 2);
    assert.equal(announcements[0].data.ticketId, calledId);
    assert.equal(announcements[1].data.callCount, 2);

    const stateUpdates = sse.events.filter((e) => e.event === 'state');
    assert.ok(stateUpdates.length >= 2);

    // Serve -> Complete flow
    const serveRes = await invokeApp(app.handleRequest, `/api/admin/tickets/${calledId}/serve`, {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
    });
    assert.equal(serveRes.status, 200);
    assert.equal(serveRes.json.ticket.status, 'serving');

    const compRes = await invokeApp(app.handleRequest, `/api/admin/tickets/${calledId}/complete`, {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
    });
    assert.equal(compRes.status, 200);
    assert.equal(compRes.json.ticket.status, 'completed');

    sse.close();
  });

  it('supports skip/restore, presets, service/counter CRUD, reset, and disk persistence', async () => {
    const switchRes = await invokeApp(app.handleRequest, '/api/admin/preset', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
      body: { presetKey: 'barbershop', seedDemo: true },
    });
    assert.equal(switchRes.status, 200);
    assert.equal(switchRes.json.state.settings.presetKey, 'barbershop');
    assert.ok(switchRes.json.state.settings.businessName.includes('Barbershop'));

    // Skip a waiting ticket and restore it
    const firstWaiting = switchRes.json.state.waitingQueue[0];
    assert.ok(firstWaiting);

    const skipRes = await invokeApp(app.handleRequest, `/api/admin/tickets/${firstWaiting.id}/skip`, {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
    });
    assert.equal(skipRes.status, 200);
    assert.equal(skipRes.json.ticket.status, 'skipped');

    const restoreRes = await invokeApp(app.handleRequest, `/api/admin/tickets/${firstWaiting.id}/restore`, {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
    });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.json.ticket.status, 'waiting');

    // Add custom service & counter
    const addSrv = await invokeApp(app.handleRequest, '/api/admin/services', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
      body: {
        name: 'Hair Coloring',
        code: 'D',
        durationMinutes: 45,
        price: 'Rp 180.000',
        color: '#DB2777',
      },
    });
    assert.equal(addSrv.status, 200);
    assert.ok(addSrv.json.services.some((s) => s.code === 'D' && s.name === 'Hair Coloring'));

    const addCtr = await invokeApp(app.handleRequest, '/api/admin/counters', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
      body: {
        name: 'Kursi 4',
        staffName: 'Andri Barber',
        status: 'open',
        serviceIds: [],
      },
    });
    assert.equal(addCtr.status, 200);
    assert.ok(addCtr.json.counters.some((c) => c.name === 'Kursi 4'));

    // Reset queue to empty
    const resetRes = await invokeApp(app.handleRequest, '/api/admin/reset', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '1234' },
      body: { seedDemo: false },
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.json.state.tickets.length, 0);

    // Reload from persisted disk file in a fresh QueueStore instance
    const reloaded = new QueueStore(stateFile);
    const snap = reloaded.getSnapshot({ includePrivate: false });
    assert.equal(snap.settings.presetKey, 'barbershop');
    assert.ok(snap.services.some((s) => s.code === 'D'));
    assert.ok(snap.counters.some((c) => c.name === 'Kursi 4'));
  });
});
