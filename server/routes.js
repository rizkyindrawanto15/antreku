import os from 'node:os';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    const MAX_BYTES = 128 * 1024;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error('Payload terlalu besar.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Format JSON tidak valid.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function getLanAddresses() {
  const results = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ iface: name, address: net.address });
      }
    }
  }
  return results;
}

export function createApiHandler({ store, sseHub, getPort }) {
  function requireAdmin(req) {
    const pin = req.headers['x-admin-pin'];
    if (!store.verifyPin(pin)) {
      throw Object.assign(new Error('Akses ditolak. PIN Admin tidak valid.'), { statusCode: 401 });
    }
  }

  return async function handleApi(req, res, urlObj) {
    const method = req.method || 'GET';
    const pathname = urlObj.pathname;

    try {
      // Health check
      if (method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          clients: sseHub.getClientCount(),
          timestamp: new Date().toISOString(),
        });
      }

      // Network URLs for QR codes
      if (method === 'GET' && pathname === '/api/network') {
        const port = getPort();
        const lan = getLanAddresses();
        const hostHeader = req.headers.host || `localhost:${port}`;
        const origin = `http://${hostHeader}`;
        const lanUrls = lan.map((l) => `http://${l.address}:${port}`);
        const primaryUrl = lanUrls[0] || origin;
        return sendJson(res, 200, {
          origin,
          primaryUrl,
          lanUrls,
          connectedClients: sseHub.getClientCount(),
        });
      }

      // Real-Time Server-Sent Events stream
      if (method === 'GET' && pathname === '/api/events') {
        const role = urlObj.searchParams.get('role');
        const pin = urlObj.searchParams.get('pin');
        const isAdmin = role === 'admin' && store.verifyPin(pin);
        sseHub.addClient(req, res, { isAdmin });
        return true;
      }

      // State snapshot
      if (method === 'GET' && pathname === '/api/state') {
        const pin = req.headers['x-admin-pin'];
        const isAdmin = Boolean(pin) && store.verifyPin(pin);
        return sendJson(res, 200, store.getSnapshot({ includePrivate: isAdmin }));
      }

      // Create customer ticket or booking
      if (method === 'POST' && pathname === '/api/tickets') {
        const body = await readJsonBody(req);
        const ticket = store.createTicket(body);
        return sendJson(res, 201, { ticket });
      }

      // Ticket detail / check-in / cancel
      const ticketMatch = pathname.match(/^\/api\/tickets\/([^/]+)(?:\/(checkin|cancel))?$/);
      if (ticketMatch) {
        const ticketId = decodeURIComponent(ticketMatch[1]);
        const action = ticketMatch[2];

        if (method === 'GET' && !action) {
          const ticket = store.getTicketById(ticketId, { includeFullOwner: true });
          if (!ticket) return sendJson(res, 404, { error: 'Tiket tidak ditemukan.' });
          return sendJson(res, 200, { ticket });
        }

        if (method === 'POST' && action === 'checkin') {
          const ticket = store.checkInBooking(ticketId);
          return sendJson(res, 200, { ticket });
        }

        if (method === 'POST' && action === 'cancel') {
          const ticket = store.cancelTicket(ticketId);
          return sendJson(res, 200, { ticket });
        }
      }

      // Admin Auth
      if (method === 'POST' && pathname === '/api/admin/auth') {
        const body = await readJsonBody(req);
        if (!store.verifyPin(body.pin)) {
          return sendJson(res, 401, { error: 'PIN Admin salah. Default PIN adalah 1234.' });
        }
        return sendJson(res, 200, {
          ok: true,
          state: store.getSnapshot({ includePrivate: true }),
        });
      }

      // Admin-protected routes
      if (pathname.startsWith('/api/admin/')) {
        requireAdmin(req);

        if (method === 'POST' && pathname === '/api/admin/call-next') {
          const body = await readJsonBody(req);
          const result = store.callNext({
            counterId: body.counterId,
            ticketId: body.ticketId || null,
            previousAction: body.previousAction || 'complete',
          });
          return sendJson(res, 200, result);
        }

        const adminTicketMatch = pathname.match(
          /^\/api\/admin\/tickets\/([^/]+)\/(recall|serve|complete|skip|restore)$/
        );
        if (method === 'POST' && adminTicketMatch) {
          const ticketId = decodeURIComponent(adminTicketMatch[1]);
          const action = adminTicketMatch[2];
          if (action === 'recall') {
            return sendJson(res, 200, store.recallTicket(ticketId));
          }
          if (action === 'serve') {
            return sendJson(res, 200, { ticket: store.startServing(ticketId) });
          }
          if (action === 'complete') {
            return sendJson(res, 200, { ticket: store.completeTicket(ticketId) });
          }
          if (action === 'skip') {
            return sendJson(res, 200, { ticket: store.skipTicket(ticketId) });
          }
          if (action === 'restore') {
            return sendJson(res, 200, { ticket: store.restoreTicket(ticketId) });
          }
        }

        if (method === 'POST' && pathname === '/api/admin/services') {
          const body = await readJsonBody(req);
          const services = store.upsertService(body);
          return sendJson(res, 200, { services });
        }

        const delServiceMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)$/);
        if (method === 'DELETE' && delServiceMatch) {
          store.deleteService(decodeURIComponent(delServiceMatch[1]));
          return sendJson(res, 200, { ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/counters') {
          const body = await readJsonBody(req);
          const counters = store.upsertCounter(body);
          return sendJson(res, 200, { counters });
        }

        const delCounterMatch = pathname.match(/^\/api\/admin\/counters\/([^/]+)$/);
        if (method === 'DELETE' && delCounterMatch) {
          store.deleteCounter(decodeURIComponent(delCounterMatch[1]));
          return sendJson(res, 200, { ok: true });
        }

        if ((method === 'PATCH' || method === 'POST') && pathname === '/api/admin/settings') {
          const body = await readJsonBody(req);
          const settings = store.updateSettings(body);
          return sendJson(res, 200, { settings });
        }

        if (method === 'POST' && pathname === '/api/admin/preset') {
          const body = await readJsonBody(req);
          const state = store.applyPreset(body.presetKey, body.seedDemo !== false);
          return sendJson(res, 200, { state });
        }

        if (method === 'POST' && pathname === '/api/admin/reset') {
          const body = await readJsonBody(req);
          const state = store.resetQueue(Boolean(body.seedDemo));
          return sendJson(res, 200, { state });
        }
      }

      return sendJson(res, 404, { error: 'Endpoint API tidak ditemukan.' });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[API Error]', err);
      return sendJson(res, code, { error: err.message || 'Terjadi kesalahan server.' });
    }
  };
}
