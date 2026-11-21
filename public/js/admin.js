import { apiRequest, createRealtimeClient } from './api.js';
import { renderQRSvg } from './qrcode.js';
import { playSoftPing, unlockAudio } from './sound.js';
import {
  applyThemeFromSettings,
  copyToClipboard,
  esc,
  formatElapsed,
  formatMinutesAgo,
  formatTimeID,
  renderStatusBadge,
  showToast,
} from './utils.js';

const PIN_SESSION_KEY = 'antreku_admin_pin_v1';

const state = {
  pin: sessionStorage.getItem(PIN_SESSION_KEY) || '',
  snapshot: null,
  networkInfo: null,
  realtime: null,
  section: 'desk', // 'desk' | 'bookings' | 'manage' | 'settings'
  selectedCounterId: null,
  queueFilter: 'waiting',
  searchQuery: '',
  settingsDirty: false,
};

const SECTION_META = {
  desk: {
    title: 'Meja Panggilan Antrean',
    subtitle: 'Panggil nomor berikutnya, pantau loket aktif, dan kelola antrean secara langsung.',
  },
  bookings: {
    title: 'Booking Jadwal Terdaftar',
    subtitle: 'Kelola pelanggan yang memesan slot waktu dan lakukan check-in saat mereka tiba.',
  },
  manage: {
    title: 'Manajemen Layanan & Loket',
    subtitle: 'Atur jenis layanan, durasi estimasi, petugas, dan pembagian loket aktif.',
  },
  settings: {
    title: 'Pengaturan Bisnis & Preset',
    subtitle: 'Sesuaikan profil usaha, ganti preset bisnis dalam 1 klik, atau cetak QR Code.',
  },
};

function adminReq(path, opts = {}) {
  return apiRequest(path, { ...opts, adminPin: state.pin });
}

// Modal helpers
function openModal({ title, bodyHtml, footerHtml, onBind }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  if (typeof onBind === 'function') onBind(backdrop);
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('admin-app').classList.add('hidden');
  if (state.realtime) {
    state.realtime.close();
    state.realtime = null;
  }
}

async function authenticateWithPin(pin) {
  const res = await apiRequest('/api/admin/auth', {
    method: 'POST',
    body: { pin },
  });
  state.pin = pin;
  sessionStorage.setItem(PIN_SESSION_KEY, pin);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');

  handleSnapshot(res.state, 'init');
  startRealtime();
  loadNetworkInfo();
}

async function loadNetworkInfo() {
  try {
    state.networkInfo = await apiRequest('/api/network');
    renderShareQr();
  } catch {
    renderShareQr();
  }
}

function startRealtime() {
  if (state.realtime) state.realtime.close();
  const pill = document.getElementById('admin-live-pill');
  const txt = document.getElementById('admin-live-text');

  state.realtime = createRealtimeClient({
    role: 'admin',
    adminPin: state.pin,
    onState: handleSnapshot,
    onStatus(status) {
      pill.className = `live-pill ${status}`;
      txt.textContent =
        status === 'connected'
          ? 'Real-Time Aktif'
          : status === 'reconnecting'
          ? 'Menyambung ulang...'
          : 'Menghubungkan...';
    },
  });
}

function setSection(section) {
  state.section = section;
  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  for (const key of Object.keys(SECTION_META)) {
    document.getElementById(`section-${key}`).classList.toggle('hidden', key !== section);
  }
  const meta = SECTION_META[section];
  document.getElementById('section-title').textContent = meta.title;
  document.getElementById('section-subtitle').textContent = meta.subtitle;

  if (section === 'settings' && state.snapshot) {
    populateSettingsForm(state.snapshot);
    renderShareQr();
  }
}

function handleSnapshot(snap, kind) {
  state.snapshot = snap;
  const s = snap.settings;
  applyThemeFromSettings(s);

  document.title = `Admin • ${s.businessName}`;
  document.getElementById('sidebar-logo').textContent = (s.businessName || 'A')[0].toUpperCase();
  document.getElementById('sidebar-business-name').textContent = s.businessName;
  const activePreset = snap.presets.find((p) => p.key === s.presetKey);
  document.getElementById('sidebar-preset-label').textContent = activePreset ? activePreset.label : 'Dasbor Operator';

  document.getElementById('nav-badge-waiting').textContent = snap.stats.waiting;
  document.getElementById('nav-badge-booked').textContent = snap.stats.booked;
  document.getElementById('header-queue-status').value = s.queueStatus || 'open';

  if (!state.selectedCounterId || !snap.counters.some((c) => c.id === state.selectedCounterId)) {
    state.selectedCounterId = snap.counters[0]?.id || null;
  }

  renderKpis(snap);
  renderCallStation(snap);
  renderQueueList(snap);
  renderBookingsList(snap);
  renderManageLists(snap);
  renderPresetCards(snap);

  if (kind === 'init' || (!state.settingsDirty && state.section === 'settings')) {
    populateSettingsForm(snap);
  }
}

function renderKpis(snap) {
  const st = snap.stats;
  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Menunggu Giliran</div>
      <div class="kpi-value tabular">${st.waiting}</div>
      <div class="kpi-sub">${st.booked} booking terjadwal</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sedang Aktif di Loket</div>
      <div class="kpi-value tabular">${st.serving + st.called}</div>
      <div class="kpi-sub">${st.called} dipanggil • ${st.serving} dilayani</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Selesai Hari Ini</div>
      <div class="kpi-value tabular">${st.completed}</div>
      <div class="kpi-sub">Total ${st.totalToday} tiket masuk</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Rata-Rata Layanan</div>
      <div class="kpi-value tabular">${st.avgServiceMinutes} <span style="font-size:15px;font-weight:700;color:var(--ink-muted);">mnt</span></div>
      <div class="kpi-sub">Rata-rata tunggu ~${st.avgWaitMinutes} mnt</div>
    </div>
  `;
}

function renderCallStation(snap) {
  const heading = document.getElementById('counter-selector-heading');
  heading.textContent = `Pilih ${snap.settings.counterLabel || 'Loket'} Aktif`;

  const tabsEl = document.getElementById('counter-tabs');
  tabsEl.innerHTML = snap.counters
    .map((ctr) => {
      const active = ctr.id === state.selectedCounterId;
      const curNum = ctr.currentTicket ? ctr.currentTicket.number : ctr.status === 'open' ? 'Kosong' : 'Istirahat';
      return `
        <button type="button" class="counter-tab ${active ? 'active' : ''}" data-select-counter="${esc(ctr.id)}">
          <strong>${esc(ctr.name)}</strong>
          <span>${esc(ctr.staffName || 'Operator')} • <b class="tabular">${esc(curNum)}</b></span>
        </button>
      `;
    })
    .join('');

  const counter = snap.counters.find((c) => c.id === state.selectedCounterId);
  const stageEl = document.getElementById('active-ticket-stage');
  const controlsEl = document.getElementById('call-controls-wrap');
  const previewEl = document.getElementById('next-up-preview');
  const toggleBtn = document.getElementById('btn-toggle-counter-status');

  if (!counter) {
    stageEl.innerHTML = `<div class="stage-empty"><strong>Belum ada loket</strong>Tambahkan loket di menu Layanan & Loket.</div>`;
    controlsEl.innerHTML = '';
    previewEl.innerHTML = '';
    return;
  }

  toggleBtn.textContent = counter.status === 'open' ? 'Set Istirahat' : 'Buka Kembali Loket';

  const cur = counter.currentTicket;
  if (cur) {
    const startRef = cur.status === 'serving' ? cur.servedAt : cur.lastCalledAt || cur.calledAt;
    const timerLabel = cur.status === 'serving' ? 'Durasi Layanan' : 'Menunggu Pelanggan';
    stageEl.innerHTML = `
      <div class="stage-top-meta">
        <span>${esc(counter.name)} • ${esc(counter.staffName || 'Petugas')}</span>
        ${renderStatusBadge(cur.status)}
      </div>
      <div class="stage-number tabular">${esc(cur.number)}</div>
      <div class="stage-customer">${esc(cur.customerFullName || cur.customerName)}</div>
      <div class="stage-service">${esc(cur.serviceName)}${cur.phone ? ` • ${esc(cur.phone)}` : ''}</div>
      ${cur.notes ? `<div class="stage-service" style="color:#FDE68A;margin-top:6px;">Catatan: ${esc(cur.notes)}</div>` : ''}
      <div class="stage-timer" id="live-stage-timer" data-since="${esc(startRef)}">
        <span>${timerLabel}:</span>
        <span class="timer-val">${formatElapsed(startRef)}</span>
      </div>
    `;
  } else {
    stageEl.innerHTML = `
      <div class="stage-top-meta">
        <span>${esc(counter.name)}</span>
        <span class="badge ${counter.status === 'open' ? 'badge-serving' : 'badge-skipped'}">${counter.status === 'open' ? 'Siap Memanggil' : 'Sedang Istirahat'}</span>
      </div>
      <div class="stage-empty">
        <strong>Tidak Ada Antrean Aktif</strong>
        <div>${counter.waitingCount > 0 ? `${counter.waitingCount} pelanggan menunggu untuk loket ini.` : 'Belum ada pelanggan yang menunggu saat ini.'}</div>
      </div>
    `;
  }

  const hasNext = Boolean(counter.nextTicketPreview);
  const nextLabel = cur
    ? cur.status === 'serving'
      ? hasNext
        ? `Selesai & Panggil Berikutnya (${counter.nextTicketPreview.number})`
        : 'Selesaikan Antrean Saat Ini'
      : hasNext
      ? `Panggil Berikutnya (${counter.nextTicketPreview.number})`
      : 'Panggil Antrean Berikutnya'
    : hasNext
    ? `Panggil Antrean Berikutnya (${counter.nextTicketPreview.number})`
    : 'Belum Ada Antrean Menunggu';

  controlsEl.innerHTML = `
    <button type="button" class="btn btn-primary call-primary-btn" id="btn-call-next" ${!hasNext && !cur ? 'disabled' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
      ${esc(nextLabel)}
    </button>

    ${
      cur
        ? `
          <div class="call-secondary-grid">
            ${
              cur.status === 'called'
                ? `<button type="button" class="btn btn-success" data-ticket-action="serve" data-id="${esc(cur.id)}">✓ Mulai Layani</button>`
                : `<button type="button" class="btn btn-success" data-ticket-action="complete" data-id="${esc(cur.id)}">✓ Tandai Selesai</button>`
            }
            <button type="button" class="btn btn-soft" data-ticket-action="recall" data-id="${esc(cur.id)}">🔊 Panggil Ulang (${cur.callCount}x)</button>
            ${
              cur.status === 'called'
                ? `<button type="button" class="btn btn-secondary" data-ticket-action="complete" data-id="${esc(cur.id)}">Selesai Langsung</button>`
                : `<div></div>`
            }
            <button type="button" class="btn btn-warning" data-ticket-action="skip" data-id="${esc(cur.id)}">↷ Lewati (Skip)</button>
          </div>
        `
        : ''
    }
  `;

  if (counter.nextTicketPreview) {
    const nt = counter.nextTicketPreview;
    previewEl.innerHTML = `
      <div>
        <span style="color:var(--ink-muted);font-size:12px;">Antrean Terdepan untuk Loket Ini</span>
        <div><strong class="tabular">${esc(nt.number)}</strong> — ${esc(nt.customerFullName || nt.customerName)} (${esc(nt.serviceName)})</div>
      </div>
      <span class="badge badge-waiting">${counter.waitingCount} menunggu</span>
    `;
  } else {
    previewEl.innerHTML = `
      <span style="color:var(--ink-muted);">Semua antrean untuk loket ini sudah tertangani.</span>
      <span class="badge badge-completed">0 menunggu</span>
    `;
  }
}

function renderQueueList(snap) {
  const listEl = document.getElementById('admin-queue-list');
  const q = state.searchQuery.trim().toLowerCase();

  let items = [...snap.tickets];
  if (state.queueFilter === 'waiting') {
    items = snap.waitingQueue;
  } else if (state.queueFilter === 'active') {
    items = items.filter((t) => ['called', 'serving'].includes(t.status));
  } else if (state.queueFilter === 'skipped') {
    items = items.filter((t) => t.status === 'skipped');
  } else if (state.queueFilter === 'done') {
    items = items.filter((t) => ['completed', 'cancelled'].includes(t.status)).reverse();
  } else {
    items = items.reverse();
  }

  if (q) {
    items = items.filter((t) =>
      `${t.number} ${t.customerFullName || t.customerName} ${t.serviceName} ${t.phone || ''}`
        .toLowerCase()
        .includes(q)
    );
  }

  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>Tidak ada tiket antrean pada filter ini.</p></div>`;
    return;
  }

  listEl.innerHTML = items
    .map((t) => {
      const actions = [];
      if (['waiting', 'skipped', 'booked'].includes(t.status)) {
        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-call-specific="${esc(t.id)}">Panggil</button>`);
      }
      if (t.status === 'skipped') {
        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-ticket-action="restore" data-id="${esc(t.id)}">Kembalikan</button>`);
      }
      if (t.status === 'called') {
        actions.push(`<button type="button" class="btn btn-success btn-sm" data-ticket-action="serve" data-id="${esc(t.id)}">Layani</button>`);
        actions.push(`<button type="button" class="btn btn-soft btn-sm" data-ticket-action="recall" data-id="${esc(t.id)}">Panggil Ulang</button>`);
      }
      if (t.status === 'serving') {
        actions.push(`<button type="button" class="btn btn-success btn-sm" data-ticket-action="complete" data-id="${esc(t.id)}">Selesai</button>`);
      }
      if (['waiting', 'booked', 'called'].includes(t.status)) {
        actions.push(`<button type="button" class="btn btn-danger btn-sm" data-ticket-action="cancel" data-id="${esc(t.id)}">Batal</button>`);
      }

      const waitMeta =
        t.status === 'waiting'
          ? `Est. ~${t.estimatedWaitMinutes} mnt • Masuk ${formatMinutesAgo(t.checkedInAt || t.createdAt)}`
          : t.counterName
          ? `${t.counterName} • ${formatTimeID(t.lastCalledAt || t.createdAt)}`
          : `Dibuat ${formatTimeID(t.createdAt)}`;

      return `
        <div class="queue-row">
          <div class="queue-row-left">
            <div class="queue-num-box tabular" style="background:${esc(t.serviceColor)}">${esc(t.number)}</div>
            <div class="queue-row-info">
              <div class="queue-row-name">
                <span>${esc(t.customerFullName || t.customerName)}</span>
                ${renderStatusBadge(t.status)}
                ${t.bookingType === 'scheduled' && t.bookingTime ? `<span class="badge badge-booked">Slot ${esc(t.bookingTime)}</span>` : ''}
              </div>
              <div class="queue-row-meta">
                ${esc(t.serviceName)}${t.phone ? ` • ${esc(t.phone)}` : ''} • ${esc(waitMeta)}
                ${t.notes ? `<br/><span style="color:var(--ink-secondary);">Catatan: ${esc(t.notes)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="queue-row-actions">${actions.join('')}</div>
        </div>
      `;
    })
    .join('');
}

function renderBookingsList(snap) {
  const el = document.getElementById('bookings-list');
  const booked = snap.tickets
    .filter((t) => t.status === 'booked')
    .sort((a, b) => String(a.bookingTime || '').localeCompare(String(b.bookingTime || '')));

  if (booked.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>Belum ada booking jadwal yang menunggu check-in.</p></div>`;
    return;
  }

  el.innerHTML = booked
    .map(
      (t) => `
        <div class="queue-row">
          <div class="queue-row-left">
            <div class="queue-num-box tabular" style="background:${esc(t.serviceColor)}">${esc(t.bookingTime || t.number)}</div>
            <div class="queue-row-info">
              <div class="queue-row-name">
                <span>${esc(t.customerFullName || t.customerName)}</span>
                <span class="badge badge-booked tabular">${esc(t.number)}</span>
              </div>
              <div class="queue-row-meta">
                ${esc(t.serviceName)}${t.phone ? ` • ${esc(t.phone)}` : ''} • Dibooking ${formatTimeID(t.createdAt)}
                ${t.notes ? `<br/>Catatan: ${esc(t.notes)}` : ''}
              </div>
            </div>
          </div>
          <div class="queue-row-actions">
            <button type="button" class="btn btn-primary btn-sm" data-checkin-id="${esc(t.id)}">✓ Check-In ke Antrean</button>
            <button type="button" class="btn btn-soft btn-sm" data-call-specific="${esc(t.id)}">Panggil Langsung</button>
            <button type="button" class="btn btn-danger btn-sm" data-ticket-action="cancel" data-id="${esc(t.id)}">Batal</button>
          </div>
        </div>
      `
    )
    .join('');
}

function renderManageLists(snap) {
  const srvGrid = document.getElementById('services-manage-grid');
  srvGrid.innerHTML = snap.services
    .map(
      (s) => `
        <div class="entity-card">
          <div class="entity-card-top">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;border-radius:10px;background:${esc(s.color)};color:#fff;font-weight:800;display:grid;place-items:center;">${esc(s.code)}</div>
              <div>
                <strong style="display:block;font-size:14.5px;">${esc(s.name)}</strong>
                <span style="font-size:12px;color:var(--ink-muted);">Durasi ${s.durationMinutes} mnt ${s.price ? `• ${esc(s.price)}` : ''}</span>
              </div>
            </div>
            <span class="badge ${s.active !== false ? 'badge-serving' : 'badge-completed'}">${s.active !== false ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <p style="margin:0;font-size:12.5px;color:var(--ink-secondary);">${esc(s.description || 'Tanpa deskripsi')}</p>
          <div style="font-size:12px;color:var(--ink-muted);">Menunggu: <b>${s.waitingCount}</b> • Berikutnya: <b class="tabular">${esc(s.nextNumberPreview)}</b></div>
          <div class="entity-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-edit-service="${esc(s.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-service="${esc(s.id)}">Hapus</button>
          </div>
        </div>
      `
    )
    .join('');

  document.getElementById('manage-counters-title').textContent = `Daftar ${snap.settings.counterLabel || 'Loket'} & ${snap.settings.staffLabel || 'Petugas'}`;
  const serviceMap = new Map(snap.services.map((s) => [s.id, s]));
  const ctrGrid = document.getElementById('counters-manage-grid');
  ctrGrid.innerHTML = snap.counters
    .map((c) => {
      const handledNames =
        c.serviceIds && c.serviceIds.length > 0
          ? c.serviceIds.map((id) => serviceMap.get(id)?.name).filter(Boolean).join(', ')
          : 'Semua Layanan';
      return `
        <div class="entity-card">
          <div class="entity-card-top">
            <div>
              <strong style="display:block;font-size:15px;">${esc(c.name)}</strong>
              <span style="font-size:12.5px;color:var(--ink-muted);">${esc(c.staffName || 'Tanpa nama petugas')}</span>
            </div>
            <span class="badge ${c.status === 'open' ? 'badge-serving' : 'badge-skipped'}">${c.status === 'open' ? 'Buka' : c.status === 'break' ? 'Istirahat' : 'Tutup'}</span>
          </div>
          <div style="font-size:12.5px;color:var(--ink-secondary);">
            <strong>Layanan:</strong> ${esc(handledNames)}
          </div>
          <div style="font-size:12px;color:var(--ink-muted);">
            Saat ini: <b>${c.currentTicket ? esc(c.currentTicket.number) : 'Kosong'}</b> • Antrean cocok: <b>${c.waitingCount}</b>
          </div>
          <div class="entity-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-edit-counter="${esc(c.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-counter="${esc(c.id)}">Hapus</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderPresetCards(snap) {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = snap.presets
    .map(
      (p) => `
        <button type="button" class="preset-card ${snap.settings.presetKey === p.key ? 'active' : ''}" data-apply-preset="${esc(p.key)}">
          <div class="preset-swatch" style="background:${esc(p.accentColor)}"></div>
          <strong>${esc(p.label)}</strong>
          <span>${esc(p.businessName)}</span>
        </button>
      `
    )
    .join('');
}

function populateSettingsForm(snap) {
  const s = snap.settings;
  document.getElementById('set-business-name').value = s.businessName || '';
  document.getElementById('set-tagline').value = s.tagline || '';
  document.getElementById('set-address').value = s.address || '';
  document.getElementById('set-hours').value = s.openHours || '';
  document.getElementById('set-accent').value = s.accentColor || '#0D9488';
  document.getElementById('set-new-pin').value = '';
  document.getElementById('set-tts-enabled').checked = s.ttsEnabled !== false;
  document.getElementById('set-show-name').checked = s.showCustomerNameOnDisplay !== false;
  document.getElementById('set-allow-booking').checked = s.allowBooking !== false;
  state.settingsDirty = false;
}

function renderShareQr() {
  const url = state.networkInfo?.primaryUrl || window.location.origin;
  const frame = document.getElementById('admin-qr-frame');
  const urlEl = document.getElementById('admin-qr-url');
  if (frame) frame.innerHTML = renderQRSvg(url, { size: 170 });
  if (urlEl) urlEl.textContent = url;
}

// Modals
function openManualTicketModal(defaultType = 'walkin') {
  if (!state.snapshot) return;
  const srvOptions = state.snapshot.services
    .filter((s) => s.active !== false)
    .map((s) => `<option value="${esc(s.id)}">[${esc(s.code)}] ${esc(s.name)}</option>`)
    .join('');
  const slotOptions = (state.snapshot.availableSlots || [])
    .map((sl) => `<option value="${esc(sl.time)}">${esc(sl.time)}</option>`)
    .join('');

  openModal({
    title: defaultType === 'scheduled' ? 'Tambah Booking Jadwal' : 'Tambah Antrean Walk-In Manual',
    bodyHtml: `
      <form id="modal-ticket-form" style="display:grid;gap:12px;">
        <div class="field">
          <label>Nama Pelanggan</label>
          <input class="input" name="customerName" required placeholder="Nama lengkap pelanggan" />
        </div>
        <div class="field">
          <label>Layanan</label>
          <select class="select" name="serviceId">${srvOptions}</select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="field">
            <label>Jenis</label>
            <select class="select" name="bookingType" id="modal-booking-type">
              <option value="walkin" ${defaultType === 'walkin' ? 'selected' : ''}>Antre Langsung</option>
              <option value="scheduled" ${defaultType === 'scheduled' ? 'selected' : ''}>Booking Jam</option>
            </select>
          </div>
          <div class="field" id="modal-slot-field" style="${defaultType === 'scheduled' ? '' : 'display:none;'}">
            <label>Slot Waktu</label>
            <select class="select" name="bookingTime">${slotOptions}</select>
          </div>
        </div>
        <div class="field">
          <label>No. HP (Opsional)</label>
          <input class="input" name="phone" placeholder="08xxxxxxxxxx" />
        </div>
        <div class="field">
          <label>Catatan (Opsional)</label>
          <input class="input" name="notes" placeholder="Catatan singkat untuk petugas" />
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-close-modal>Batal</button>
      <button type="submit" form="modal-ticket-form" class="btn btn-primary">Simpan & Cetak Nomor</button>
    `,
    onBind() {
      const typeSel = document.getElementById('modal-booking-type');
      const slotField = document.getElementById('modal-slot-field');
      typeSel.addEventListener('change', () => {
        slotField.style.display = typeSel.value === 'scheduled' ? '' : 'none';
      });
      document.getElementById('modal-ticket-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const res = await apiRequest('/api/tickets', {
            method: 'POST',
            body: {
              customerName: fd.get('customerName'),
              serviceId: fd.get('serviceId'),
              bookingType: fd.get('bookingType'),
              bookingTime: fd.get('bookingType') === 'scheduled' ? fd.get('bookingTime') : null,
              phone: fd.get('phone'),
              notes: fd.get('notes'),
            },
          });
          showToast(`Nomor ${res.ticket.number} berhasil ditambahkan!`, 'success');
          closeModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    },
  });
}

function openServiceModal(service = null) {
  openModal({
    title: service ? 'Edit Layanan' : 'Tambah Layanan Baru',
    bodyHtml: `
      <form id="modal-service-form" style="display:grid;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 90px;gap:10px;">
          <div class="field">
            <label>Nama Layanan</label>
            <input class="input" name="name" required value="${esc(service?.name || '')}" placeholder="Contoh: Poli Anak" />
          </div>
          <div class="field">
            <label>Kode</label>
            <input class="input" name="code" required maxlength="2" value="${esc(service?.code || 'D')}" placeholder="D" style="text-transform:uppercase;text-align:center;font-weight:800;" />
          </div>
        </div>
        <div class="field">
          <label>Deskripsi Singkat</label>
          <input class="input" name="description" value="${esc(service?.description || '')}" placeholder="Deskripsi layanan untuk pelanggan" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 70px;gap:10px;">
          <div class="field">
            <label>Durasi (menit)</label>
            <input class="input" name="durationMinutes" type="number" min="5" max="180" value="${service?.durationMinutes || 20}" />
          </div>
          <div class="field">
            <label>Tarif / Harga</label>
            <input class="input" name="price" value="${esc(service?.price || '')}" placeholder="Rp 75.000" />
          </div>
          <div class="field">
            <label>Warna</label>
            <input class="input" name="color" type="color" value="${esc(service?.color || '#0D9488')}" style="height:43px;padding:3px;" />
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;">
          <input type="checkbox" name="active" ${service?.active !== false ? 'checked' : ''} />
          Layanan Aktif (tampil di halaman pelanggan)
        </label>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-close-modal>Batal</button>
      <button type="submit" form="modal-service-form" class="btn btn-primary">Simpan Layanan</button>
    `,
    onBind() {
      document.getElementById('modal-service-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await adminReq('/api/admin/services', {
            method: 'POST',
            body: {
              id: service?.id || null,
              name: fd.get('name'),
              code: fd.get('code'),
              description: fd.get('description'),
              durationMinutes: Number(fd.get('durationMinutes')),
              price: fd.get('price'),
              color: fd.get('color'),
              active: fd.get('active') === 'on',
            },
          });
          showToast('Layanan berhasil disimpan!', 'success');
          closeModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    },
  });
}

function openCounterModal(counter = null) {
  const services = state.snapshot?.services || [];
  const selectedIds = new Set(counter?.serviceIds || []);

  openModal({
    title: counter ? 'Edit Loket / Kursi' : 'Tambah Loket / Kursi Baru',
    bodyHtml: `
      <form id="modal-counter-form" style="display:grid;gap:12px;">
        <div class="field">
          <label>Nama Loket / Kursi / Meja</label>
          <input class="input" name="name" required value="${esc(counter?.name || '')}" placeholder="Contoh: Poli Umum 2 / Kursi 4" />
        </div>
        <div class="field">
          <label>Nama Petugas / Dokter / Barber</label>
          <input class="input" name="staffName" value="${esc(counter?.staffName || '')}" placeholder="Contoh: dr. Andi / Bang Reza" />
        </div>
        <div class="field">
          <label>Status Loket</label>
          <select class="select" name="status">
            <option value="open" ${(!counter || counter.status === 'open') ? 'selected' : ''}>Buka (Aktif)</option>
            <option value="break" ${counter?.status === 'break' ? 'selected' : ''}>Istirahat</option>
            <option value="closed" ${counter?.status === 'closed' ? 'selected' : ''}>Tutup</option>
          </select>
        </div>
        <div class="field">
          <label>Layanan yang Ditangani <span class="hint">(kosongkan untuk melayani semua layanan)</span></label>
          <div style="display:grid;gap:7px;margin-top:4px;">
            ${services
              .map(
                (s) => `
                  <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;">
                    <input type="checkbox" name="serviceIds" value="${esc(s.id)}" ${selectedIds.has(s.id) ? 'checked' : ''} />
                    <span>[${esc(s.code)}] ${esc(s.name)}</span>
                  </label>
                `
              )
              .join('')}
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-close-modal>Batal</button>
      <button type="submit" form="modal-counter-form" class="btn btn-primary">Simpan Loket</button>
    `,
    onBind() {
      document.getElementById('modal-counter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await adminReq('/api/admin/counters', {
            method: 'POST',
            body: {
              id: counter?.id || null,
              name: fd.get('name'),
              staffName: fd.get('staffName'),
              status: fd.get('status'),
              serviceIds: fd.getAll('serviceIds'),
            },
          });
          showToast('Loket berhasil disimpan!', 'success');
          closeModal();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    },
  });
}

async function performTicketAction(action, id) {
  unlockAudio();
  try {
    if (action === 'cancel') {
      if (!window.confirm('Batalkan nomor antrean ini?')) return;
      await apiRequest(`/api/tickets/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      showToast('Antrean dibatalkan.', 'info');
      return;
    }
    const res = await adminReq(`/api/admin/tickets/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    if (action === 'recall') {
      playSoftPing();
      showToast(`Memanggil ulang ${res.announcement?.ticketNumber || ''}...`, 'success');
    } else if (action === 'serve') {
      showToast('Status diubah ke Sedang Dilayani.', 'success');
    } else if (action === 'complete') {
      showToast('Layanan selesai!', 'success');
    } else if (action === 'skip') {
      showToast('Nomor dilewati (dapat dipanggil kembali nanti).', 'warning');
    } else if (action === 'restore') {
      showToast('Nomor dikembalikan ke daftar tunggu.', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function performCallNext(specificTicketId = null) {
  unlockAudio();
  if (!state.selectedCounterId) {
    showToast('Pilih loket aktif terlebih dahulu.', 'error');
    return;
  }
  try {
    const res = await adminReq('/api/admin/call-next', {
      method: 'POST',
      body: {
        counterId: state.selectedCounterId,
        ticketId: specificTicketId,
        previousAction: 'complete',
      },
    });
    if (res.called) {
      playSoftPing();
      showToast(`Memanggil ${res.called.number} (${res.called.customerFullName || res.called.customerName})!`, 'success');
    } else if (res.previousCompleted) {
      showToast('Antrean sebelumnya selesai. Belum ada antrean berikutnya.', 'info');
    } else {
      showToast('Tidak ada antrean menunggu untuk loket ini.', 'warning');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindEvents() {
  // Auth form
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('auth-pin-input').value.trim();
    try {
      await authenticateWithPin(pin);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-auth-demo').addEventListener('click', async () => {
    try {
      await authenticateWithPin('1234');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    state.pin = '';
    showAuthScreen();
  });

  // Sidebar navigation
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-section]');
    if (!btn) return;
    setSection(btn.dataset.section);
  });

  // Header queue status selector
  document.getElementById('header-queue-status').addEventListener('change', async (e) => {
    try {
      await adminReq('/api/admin/settings', {
        method: 'PATCH',
        body: { queueStatus: e.target.value },
      });
      showToast('Status penerimaan antrean diperbarui.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-open-manual-modal').addEventListener('click', () => openManualTicketModal('walkin'));
  document.getElementById('btn-add-booking-modal').addEventListener('click', () => openManualTicketModal('scheduled'));

  // Counter switcher & toggle counter status
  document.getElementById('counter-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-counter]');
    if (!btn) return;
    state.selectedCounterId = btn.dataset.selectCounter;
    if (state.snapshot) renderCallStation(state.snapshot);
  });

  document.getElementById('btn-toggle-counter-status').addEventListener('click', async () => {
    const ctr = state.snapshot?.counters.find((c) => c.id === state.selectedCounterId);
    if (!ctr) return;
    const nextStatus = ctr.status === 'open' ? 'break' : 'open';
    try {
      await adminReq('/api/admin/counters', {
        method: 'POST',
        body: { ...ctr, status: nextStatus },
      });
      showToast(`${ctr.name} sekarang ${nextStatus === 'open' ? 'Buka' : 'Istirahat'}.`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Call station action delegation
  document.getElementById('call-controls-wrap').addEventListener('click', (e) => {
    if (e.target.closest('#btn-call-next')) {
      performCallNext(null);
      return;
    }
    const actBtn = e.target.closest('[data-ticket-action]');
    if (actBtn) {
      performTicketAction(actBtn.dataset.ticketAction, actBtn.dataset.id);
    }
  });

  // Filter pills & search
  document.getElementById('queue-filter-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.queueFilter = btn.dataset.filter;
    document.querySelectorAll('#queue-filter-pills .filter-pill').forEach((p) => {
      p.classList.toggle('active', p.dataset.filter === state.queueFilter);
    });
    if (state.snapshot) renderQueueList(state.snapshot);
  });

  document.getElementById('queue-search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    if (state.snapshot) renderQueueList(state.snapshot);
  });

  // Queue list & bookings actions delegation
  document.getElementById('admin-app').addEventListener('click', async (e) => {
    const callSpec = e.target.closest('[data-call-specific]');
    if (callSpec) {
      performCallNext(callSpec.dataset.callSpecific);
      return;
    }

    const checkInBtn = e.target.closest('[data-checkin-id]');
    if (checkInBtn) {
      try {
        await apiRequest(`/api/tickets/${encodeURIComponent(checkInBtn.dataset.checkinId)}/checkin`, { method: 'POST' });
        showToast('Booking berhasil di-check-in ke antrean aktif!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const actBtn = e.target.closest('[data-ticket-action]');
    if (actBtn && !e.target.closest('#call-controls-wrap')) {
      performTicketAction(actBtn.dataset.ticketAction, actBtn.dataset.id);
      return;
    }

    // Manage Services
    if (e.target.closest('#btn-add-service')) {
      openServiceModal(null);
      return;
    }
    const editSrv = e.target.closest('[data-edit-service]');
    if (editSrv) {
      const srv = state.snapshot?.services.find((s) => s.id === editSrv.dataset.editService);
      if (srv) openServiceModal(srv);
      return;
    }
    const delSrv = e.target.closest('[data-delete-service]');
    if (delSrv) {
      if (!window.confirm('Hapus layanan ini?')) return;
      try {
        await adminReq(`/api/admin/services/${encodeURIComponent(delSrv.dataset.deleteService)}`, { method: 'DELETE' });
        showToast('Layanan dihapus.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    // Manage Counters
    if (e.target.closest('#btn-add-counter')) {
      openCounterModal(null);
      return;
    }
    const editCtr = e.target.closest('[data-edit-counter]');
    if (editCtr) {
      const ctr = state.snapshot?.counters.find((c) => c.id === editCtr.dataset.editCounter);
      if (ctr) openCounterModal(ctr);
      return;
    }
    const delCtr = e.target.closest('[data-delete-counter]');
    if (delCtr) {
      if (!window.confirm('Hapus loket ini?')) return;
      try {
        await adminReq(`/api/admin/counters/${encodeURIComponent(delCtr.dataset.deleteCounter)}`, { method: 'DELETE' });
        showToast('Loket dihapus.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    // Apply Preset
    const presetBtn = e.target.closest('[data-apply-preset]');
    if (presetBtn) {
      const key = presetBtn.dataset.applyPreset;
      if (!window.confirm('Ganti ke preset bisnis ini? Layanan, loket, dan data simulasi akan disesuaikan secara real-time di semua layar.')) {
        return;
      }
      try {
        await adminReq('/api/admin/preset', {
          method: 'POST',
          body: { presetKey: key, seedDemo: true },
        });
        state.settingsDirty = false;
        showToast('Preset bisnis berhasil diterapkan di semua perangkat!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }
  });

  // Settings form
  const settingsForm = document.getElementById('settings-form');
  settingsForm.addEventListener('input', () => {
    state.settingsDirty = true;
  });
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPin = document.getElementById('set-new-pin').value.trim();
    const accent = document.getElementById('set-accent').value;
    try {
      await adminReq('/api/admin/settings', {
        method: 'PATCH',
        body: {
          businessName: document.getElementById('set-business-name').value.trim(),
          tagline: document.getElementById('set-tagline').value.trim(),
          address: document.getElementById('set-address').value.trim(),
          openHours: document.getElementById('set-hours').value.trim(),
          accentColor: accent,
          accentDark: accent,
          accentSoft: `color-mix(in srgb, ${accent} 18%, #FFFFFF)`,
          ttsEnabled: document.getElementById('set-tts-enabled').checked,
          showCustomerNameOnDisplay: document.getElementById('set-show-name').checked,
          allowBooking: document.getElementById('set-allow-booking').checked,
          newAdminPin: newPin || undefined,
        },
      });
      if (newPin && newPin.length >= 4) {
        state.pin = newPin;
        sessionStorage.setItem(PIN_SESSION_KEY, newPin);
        startRealtime();
      }
      state.settingsDirty = false;
      showToast('Pengaturan berhasil disimpan!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-copy-customer-url').addEventListener('click', () => {
    const url = state.networkInfo?.primaryUrl || window.location.origin;
    copyToClipboard(url);
  });

  document.getElementById('btn-reset-empty').addEventListener('click', async () => {
    if (!window.confirm('Kosongkan seluruh antrean hari ini dan reset nomor kembali ke 001?')) return;
    try {
      await adminReq('/api/admin/reset', { method: 'POST', body: { seedDemo: false } });
      showToast('Antrean berhasil dikosongkan dan direset ke 001.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-reset-demo').addEventListener('click', async () => {
    if (!window.confirm('Muat ulang data simulasi demo untuk bisnis aktif saat ini?')) return;
    try {
      await adminReq('/api/admin/reset', { method: 'POST', body: { seedDemo: true } });
      showToast('Data simulasi demo berhasil dimuat ulang!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Modal close handlers
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop' || e.target.closest('[data-close-modal]')) {
      closeModal();
    }
  });
}

// Live ticking timer for Call Station (every 1s, lightweight text update only)
setInterval(() => {
  const timerEl = document.getElementById('live-stage-timer');
  if (!timerEl) return;
  const since = timerEl.dataset.since;
  const valEl = timerEl.querySelector('.timer-val');
  if (since && valEl) {
    valEl.textContent = formatElapsed(since);
  }
}, 1000);

// Boot
bindEvents();
apiRequest('/api/state')
  .then((snap) => {
    applyThemeFromSettings(snap.settings);
    const logo = document.getElementById('auth-logo');
    if (logo && snap.settings?.businessName) {
      logo.textContent = snap.settings.businessName[0].toUpperCase();
    }
  })
  .catch(() => {});

if (state.pin) {
  authenticateWithPin(state.pin).catch(() => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    state.pin = '';
    showAuthScreen();
  });
} else {
  showAuthScreen();
}
