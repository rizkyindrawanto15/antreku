export class SSEHub {
  constructor(store) {
    this.store = store;
    this.clients = new Set();

    this.unsubscribe = this.store.subscribe((eventType, payload) => {
      if (eventType === 'announcement') {
        this.broadcastAnnouncement(payload);
      } else if (eventType === 'state') {
        this.broadcastState();
      }
    });

    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(': ping\n\n');
        } catch {
          this.clients.delete(client);
        }
      }
    }, 20000);
    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref();
    }
  }

  addClient(req, res, { isAdmin = false } = {}) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const client = { res, isAdmin };
    this.clients.add(client);

    // Send initial snapshot immediately
    const snapshot = this.store.getSnapshot({ includePrivate: isAdmin });
    this._send(client, 'init', snapshot);

    req.on('close', () => {
      this.clients.delete(client);
    });
  }

  _send(client, event, data) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(client);
    }
  }

  broadcastState() {
    if (this.clients.size === 0) return;
    let publicSnap = null;
    let adminSnap = null;

    for (const client of this.clients) {
      if (client.isAdmin) {
        if (!adminSnap) adminSnap = this.store.getSnapshot({ includePrivate: true });
        this._send(client, 'state', adminSnap);
      } else {
        if (!publicSnap) publicSnap = this.store.getSnapshot({ includePrivate: false });
        this._send(client, 'state', publicSnap);
      }
    }
  }

  broadcastAnnouncement(announcement) {
    if (this.clients.size === 0) return;
    for (const client of this.clients) {
      this._send(client, 'announcement', announcement);
    }
  }

  getClientCount() {
    return this.clients.size;
  }

  close() {
    clearInterval(this.heartbeatTimer);
    if (this.unsubscribe) this.unsubscribe();
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
