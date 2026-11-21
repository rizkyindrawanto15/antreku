import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueueStore } from './store.js';
import { SSEHub } from './sse.js';
import { createApiHandler, getLanAddresses } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEFAULT_STATE_FILE = path.join(ROOT_DIR, 'data', 'state.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const PAGE_ROUTES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/admin': 'admin.html',
  '/admin/': 'admin.html',
  '/admin.html': 'admin.html',
  '/display': 'display.html',
  '/display/': 'display.html',
  '/display.html': 'display.html',
};

export function createAppServer({ stateFile = DEFAULT_STATE_FILE } = {}) {
  const store = new QueueStore(stateFile);
  const sseHub = new SSEHub(store);
  let boundPort = Number(process.env.PORT) || 3100;

  const handleApi = createApiHandler({
    store,
    sseHub,
    getPort: () => boundPort,
  });

  const handleRequest = async (req, res) => {
    try {
      const host = req.headers.host || `localhost:${boundPort}`;
      const urlObj = new URL(req.url || '/', `http://${host}`);

      if (urlObj.pathname.startsWith('/api/')) {
        await handleApi(req, res, urlObj);
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      const mappedFile = PAGE_ROUTES[urlObj.pathname];
      let decodedPathname;
      try {
        decodedPathname = decodeURIComponent(urlObj.pathname);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
      }
      const relativePath = mappedFile || decodedPathname.replace(/^\/+/, '');
      const targetPath = path.resolve(PUBLIC_DIR, relativePath);

      // Guard against directory traversal
      if (!targetPath.startsWith(PUBLIC_DIR + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      fs.stat(targetPath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>404 - Halaman tidak ditemukan</h1><p><a href="/">Kembali ke Beranda AntreKu</a></p>');
          return;
        }

        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const stream = fs.createReadStream(targetPath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(500);
          }
          res.end();
        });
        stream.pipe(res);
      });
    } catch (err) {
      console.error('[Server Error]', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    }
  };

  const server = http.createServer(handleRequest);

  server.on('listening', () => {
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      boundPort = addr.port;
    }
  });

  const close = () =>
    new Promise((resolve) => {
      sseHub.close();
      server.close(() => resolve());
    });

  return { server, handleRequest, store, sseHub, close };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const port = Number(process.env.PORT) || 3100;
  const host = process.env.HOST || undefined;
  const { server, close } = createAppServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Error] Port ${port} sudah digunakan aplikasi lain.`);
      console.error(`Gunakan port lain, contoh PowerShell: $env:PORT=3101; npm start\n`);
    } else if (err.code === 'EACCES') {
      console.error(`\n[Error] Izin ditolak untuk membuka port ${port}. Coba port lain (misal PORT=3101) atau jalankan di luar sandbox.\n`);
    } else {
      console.error('\n[Server Error]', err);
    }
    process.exit(1);
  });

  const onListening = () => {
    const lan = getLanAddresses();
    console.log('\n======================================================');
    console.log('  AntreKu — Sistem Antrean & Booking Real-Time');
    console.log('======================================================');
    console.log(`  Pelanggan (HP) : http://localhost:${port}/`);
    console.log(`  Dasbor Admin   : http://localhost:${port}/admin`);
    console.log(`  Layar TV       : http://localhost:${port}/display`);
    if (lan.length > 0) {
      console.log(`  Akses HP (LAN) : http://${lan[0].address}:${port}/`);
    }
    console.log('  PIN Admin Demo : 1234');
    console.log('======================================================\n');
  };

  if (host) {
    server.listen(port, host, onListening);
  } else {
    server.listen(port, onListening);
  }

  const shutdown = async () => {
    console.log('\nMenghentikan server AntreKu...');
    await close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
