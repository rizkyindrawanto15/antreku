// REST API + Real-Time Server-Sent Events (SSE) Client

export async function apiRequest(path, { method = 'GET', body = null, adminPin = null } = {}) {
  const headers = {};
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }
  if (adminPin) {
    headers['X-Admin-Pin'] = adminPin;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Permintaan gagal (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function createRealtimeClient({ role = 'public', adminPin = '', onState, onAnnouncement, onStatus }) {
  let source = null;
  let closed = false;
  let reconnectTimer = null;

  function setStatus(status) {
    if (typeof onStatus === 'function') onStatus(status);
  }

  function connect() {
    if (closed) return;
    if (source) {
      source.close();
      source = null;
    }

    const params = new URLSearchParams();
    if (role === 'admin' && adminPin) {
      params.set('role', 'admin');
      params.set('pin', adminPin);
    }
    const qs = params.toString();
    const url = `/api/events${qs ? `?${qs}` : ''}`;

    setStatus('connecting');
    source = new EventSource(url);

    source.addEventListener('init', (e) => {
      setStatus('connected');
      try {
        const snapshot = JSON.parse(e.data);
        if (typeof onState === 'function') onState(snapshot, 'init');
      } catch (err) {
        console.error('[SSE init parse error]', err);
      }
    });

    source.addEventListener('state', (e) => {
      setStatus('connected');
      try {
        const snapshot = JSON.parse(e.data);
        if (typeof onState === 'function') onState(snapshot, 'state');
      } catch (err) {
        console.error('[SSE state parse error]', err);
      }
    });

    source.addEventListener('announcement', (e) => {
      try {
        const ann = JSON.parse(e.data);
        if (typeof onAnnouncement === 'function') onAnnouncement(ann);
      } catch (err) {
        console.error('[SSE announcement parse error]', err);
      }
    });

    source.onerror = () => {
      setStatus('reconnecting');
      if (source) {
        source.close();
        source = null;
      }
      if (!closed) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 2500);
      }
    };
  }

  connect();

  return {
    reconnect() {
      clearTimeout(reconnectTimer);
      connect();
    },
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      if (source) {
        source.close();
        source = null;
      }
    },
  };
}
