import { apiRequest, createRealtimeClient } from './api.js';
import { renderQRSvg } from './qrcode.js';
import { playCustomerAlert, playSoftPing, unlockAudio } from './sound.js';
import {
  applyThemeFromSettings,
  copyToClipboard,
  esc,
  formatTimeID,
  QUEUE_STATUS_META,
  renderStatusBadge,
  showToast,
} from './utils.js';

const STORAGE_KEY = 'antreku_my_tickets_v1';

const appState = {
  snapshot: null,
  activeView: 'book', // 'book' | 'ticket'
  selectedServiceId: null,
  bookingType: 'walkin', // 'walkin' | 'scheduled'
  selectedSlot: null,
  myTicketIds: loadSavedTicketIds(),
  ownerNames: loadSavedOwnerNames(),
  activeTicketId: null,
  soundNotifiedIds: new Set(),
};

function loadSavedTicketIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTicketIds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.myTicketIds));
  } catch {
    // ignore storage errors
  }
}

function loadSavedOwnerNames() {
  try {
    return JSON.parse(localStorage.getItem('antreku_ticket_names_v1') || '{}');
  } catch {
    return {};
  }
}

function saveOwnerName(ticketId, fullName) {
  if (!fullName) return;
  appState.ownerNames[ticketId] = fullName;
  try {
    localStorage.setItem('antreku_ticket_names_v1', JSON.stringify(appState.ownerNames));
  } catch {
    // ignore
  }
}

function addMyTicket(ticketId, fullName) {
  if (!appState.myTicketIds.includes(ticketId)) {
    appState.myTicketIds.unshift(ticketId);
    appState.myTicketIds = appState.myTicketIds.slice(0, 8);
    saveTicketIds();
  }
  if (fullName) saveOwnerName(ticketId, fullName);
  appState.activeTicketId = ticketId;
}

function getMyValidTickets() {
  if (!appState.snapshot) return [];
  const byId = new Map(appState.snapshot.tickets.map((t) => [t.id, t]));
  return appState.myTicketIds
    .map((id) => byId.get(id))
    .filter(Boolean);
}

// Check URL query param ?ticket=<id>
async function checkDeepLinkTicket() {
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('ticket');
  if (!ticketId) return;
  try {
    const res = await apiRequest(`/api/tickets/${encodeURIComponent(ticketId)}`);
    if (res.ticket) {
      addMyTicket(res.ticket.id, res.ticket.customerFullName || res.ticket.customerName);
      setView('ticket');
    }
  } catch {
    showToast('Tiket pada tautan tersebut tidak ditemukan atau sudah direset.', 'warning');
  }
}

function setView(view) {
  appState.activeView = view;
  document.getElementById('tab-book').classList.toggle('active', view === 'book');
  document.getElementById('tab-ticket').classList.toggle('active', view === 'ticket');
  document.getElementById('view-book').style.display = view === 'book' ? 'block' : 'none';
  document.getElementById('view-ticket').style.display = view === 'ticket' ? 'block' : 'none';
  if (view === 'ticket') {
    renderMyTicketView();
  }
}

function renderHeaderAndHero(snap) {
  const s = snap.settings;
  applyThemeFromSettings(s);

  document.title = `${s.businessName} — AntreKu Real-Time`;
  document.getElementById('brand-mark').textContent = (s.businessName || 'A')[0].toUpperCase();
  document.getElementById('topbar-business-name').textContent = s.businessName;
  document.getElementById('topbar-business-tagline').textContent = s.tagline;
  document.getElementById('hero-business-name').textContent = s.businessName;
  document.getElementById('hero-tagline').textContent = s.tagline;
  document.getElementById('business-hours').textContent = s.openHours || 'Buka Hari Ini';

  const addrSpan = document.querySelector('#hero-address span');
  if (addrSpan) addrSpan.textContent = s.address || 'Lokasi Utama';

  const waitSpan = document.querySelector('#hero-waiting-summary span');
  if (waitSpan) {
    waitSpan.textContent = `${snap.stats.waiting} orang menunggu • Est. rata-rata ${snap.stats.avgWaitMinutes} mnt`;
  }

  const qMeta = QUEUE_STATUS_META[s.queueStatus] || QUEUE_STATUS_META.open;
  document.getElementById('queue-status-label').textContent = qMeta.label;
  const dot = document.getElementById('queue-status-dot');
  dot.className = `status-chip-dot ${qMeta.dot}`;

  // Booking allow toggle
  const schedBtn = document.getElementById('btn-type-scheduled');
  if (schedBtn) {
    schedBtn.style.display = s.allowBooking === false ? 'none' : '';
    if (s.allowBooking === false && appState.bookingType === 'scheduled') {
      setBookingType('walkin');
    }
  }

  const submitBtn = document.getElementById('btn-submit-ticket');
  if (s.queueStatus === 'closed') {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Antrean Sedang Ditutup';
  } else if (s.queueStatus === 'paused' && appState.bookingType === 'walkin') {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Antrean Langsung Dijeda Sementara';
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent =
      appState.bookingType === 'scheduled'
        ? 'Konfirmasi Booking Jadwal'
        : 'Ambil Nomor Antrean Sekarang';
  }
}

function renderServices(snap) {
  const listEl = document.getElementById('service-list');
  const activeServices = snap.services.filter((s) => s.active !== false);

  if (activeServices.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>Belum ada layanan yang aktif saat ini.</p></div>`;
    return;
  }

  if (!appState.selectedServiceId || !activeServices.some((s) => s.id === appState.selectedServiceId)) {
    appState.selectedServiceId = activeServices[0].id;
  }

  listEl.innerHTML = activeServices
    .map((srv) => {
      const selected = srv.id === appState.selectedServiceId;
      return `
        <button type="button" class="service-option ${selected ? 'selected' : ''}" data-service-id="${esc(srv.id)}">
          <div class="service-code-badge" style="background:${esc(srv.color)}">${esc(srv.code)}</div>
          <div class="service-body">
            <div class="service-title-row">
              <span class="service-name">${esc(srv.name)}</span>
              ${srv.price ? `<span class="service-price">${esc(srv.price)}</span>` : ''}
            </div>
            ${srv.description ? `<p class="service-desc-text">${esc(srv.description)}</p>` : ''}
            <div class="service-stats-row">
              <span class="service-stat-pill">Antrean: <strong class="tabular">${srv.waitingCount}</strong></span>
              <span class="service-stat-pill">Est. Tunggu: <strong class="tabular">~${srv.estimatedWaitMinutes} mnt</strong></span>
              <span class="service-stat-pill">Berikutnya: <strong class="tabular">${esc(srv.nextNumberPreview)}</strong></span>
            </div>
          </div>
        </button>
      `;
    })
    .join('');
}

function renderSlots(snap) {
  const grid = document.getElementById('slots-grid');
  const slots = snap.availableSlots || [];
  if (!slots.some((s) => s.time === appState.selectedSlot && s.available)) {
    const firstAvail = slots.find((s) => s.available);
    appState.selectedSlot = firstAvail ? firstAvail.time : null;
  }

  grid.innerHTML = slots
    .map((slot) => {
      const active = slot.time === appState.selectedSlot;
      const sisa = Math.max(0, slot.capacity - slot.bookedCount);
      return `
        <button type="button" class="slot-btn ${active ? 'active' : ''}" data-slot="${esc(slot.time)}" ${slot.available ? '' : 'disabled'}>
          ${esc(slot.time)}
          <small>${slot.available ? `Sisa ${sisa}` : 'Penuh'}</small>
        </button>
      `;
    })
    .join('');
}

function renderLiveBoard(snap) {
  const openCounters = snap.counters.filter((c) => c.status === 'open');
  document.getElementById('open-counters-badge').textContent = `${openCounters.length} Aktif`;

  const servingEl = document.getElementById('now-serving-list');
  if (snap.counters.length === 0) {
    servingEl.innerHTML = `<div class="empty-state"><p>Belum ada loket terdaftar.</p></div>`;
  } else {
    servingEl.innerHTML = snap.counters
      .map((ctr) => {
        const t = ctr.currentTicket;
        const isClosed = ctr.status !== 'open';
        return `
          <div class="counter-live-item ${t ? 'active' : ''}">
            <div class="counter-live-info">
              <strong>${esc(ctr.name)}</strong>
              <span>${esc(ctr.staffName || (isClosed ? 'Sedang istirahat' : 'Siap melayani'))}</span>
            </div>
            <div class="counter-live-number">
              ${
                t
                  ? `<div class="counter-live-code tabular">${esc(t.number)}</div>
                     <div>${renderStatusBadge(t.status)}</div>`
                  : `<div class="counter-live-code idle">${isClosed ? 'Istirahat' : 'Menunggu'}</div>`
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  const waiting = snap.waitingQueue || [];
  document.getElementById('waiting-strip-count').textContent = `${waiting.length} nomor`;
  const pillsEl = document.getElementById('waiting-pills');

  if (waiting.length === 0) {
    pillsEl.innerHTML = `<span style="font-size:12.5px;color:var(--ink-muted);">Belum ada antrean menunggu — Anda bisa langsung dilayani!</span>`;
  } else {
    pillsEl.innerHTML = waiting
      .slice(0, 12)
      .map((t) => {
        const isMine = appState.myTicketIds.includes(t.id);
        return `<span class="queue-pill tabular ${isMine ? 'is-mine' : ''}">${esc(t.number)}${isMine ? ' (Anda)' : ''}</span>`;
      })
      .join('') + (waiting.length > 12 ? `<span class="queue-pill">+${waiting.length - 12} lagi</span>` : '');
  }

  document.getElementById('stat-waiting').textContent = snap.stats.waiting;
  document.getElementById('stat-completed').textContent = snap.stats.completed;
  document.getElementById('stat-avg-wait').textContent = `~${snap.stats.avgWaitMinutes}m`;
}

function renderMyTicketView() {
  const myTickets = getMyValidTickets();
  document.getElementById('my-tickets-count').textContent = myTickets.filter((t) =>
    ['waiting', 'booked', 'called', 'serving'].includes(t.status)
  ).length;

  const switcherEl = document.getElementById('ticket-switcher');
  const containerEl = document.getElementById('ticket-container');

  if (myTickets.length === 0) {
    switcherEl.innerHTML = '';
    containerEl.innerHTML = `
      <div class="section-card empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>
        <h3 style="margin:0 0 6px;color:var(--ink);">Belum Ada Tiket Aktif</h3>
        <p>Ambil nomor antrean atau buat booking jadwal terlebih dahulu untuk memantau posisi Anda secara real-time.</p>
        <button type="button" class="btn btn-primary" style="margin-top:16px;" id="btn-go-book">Ambil Nomor Antrean</button>
      </div>
    `;
    document.getElementById('btn-go-book')?.addEventListener('click', () => setView('book'));
    return;
  }

  if (!appState.activeTicketId || !myTickets.some((t) => t.id === appState.activeTicketId)) {
    appState.activeTicketId = myTickets[0].id;
  }

  if (myTickets.length > 1) {
    switcherEl.innerHTML = myTickets
      .map(
        (t) => `
          <button type="button" class="ticket-chip ${t.id === appState.activeTicketId ? 'active' : ''}" data-select-ticket="${esc(t.id)}">
            <span class="tabular">${esc(t.number)}</span>
            ${renderStatusBadge(t.status)}
          </button>
        `
      )
      .join('');
  } else {
    switcherEl.innerHTML = '';
  }

  const ticket = myTickets.find((t) => t.id === appState.activeTicketId) || myTickets[0];
  const displayName = appState.ownerNames[ticket.id] || ticket.customerName;
  const ticketUrl = `${window.location.origin}/?ticket=${encodeURIComponent(ticket.id)}`;
  const qrSvg = renderQRSvg(ticketUrl, { size: 96 });

  let alertBanner = '';
  if (ticket.status === 'called') {
    alertBanner = `<div class="ticket-alert-banner">GILIRAN ANDA DIPANGGIL! Silakan menuju ${esc(ticket.counterName || 'Loket')}</div>`;
  } else if (ticket.status === 'serving') {
    alertBanner = `<div class="ticket-alert-banner is-serving">Sedang Dilayani di ${esc(ticket.counterName || 'Loket')}</div>`;
  } else if (ticket.status === 'waiting' && ticket.aheadCount === 0) {
    alertBanner = `<div class="ticket-alert-banner is-next">Anda Giliran Berikutnya! Harap bersiap di ruang tunggu.</div>`;
  }

  const showMetrics = ticket.status === 'waiting';
  const showCounterCallout = ['called', 'serving'].includes(ticket.status) && ticket.counterName;
  const canCheckIn = ticket.status === 'booked';
  const canCancel = ['waiting', 'booked', 'called'].includes(ticket.status);

  const notifSupported = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default';

  containerEl.innerHTML = `
    <article class="digital-ticket ${ticket.status === 'called' ? 'is-called' : ''}">
      ${alertBanner}
      <div class="ticket-top">
        <div class="ticket-service-tag">
          <span class="ticket-service-dot" style="background:${esc(ticket.serviceColor)}"></span>
          ${esc(ticket.serviceName)}
        </div>
        <div class="ticket-number-label">Nomor Antrean Anda</div>
        <div class="ticket-big-number tabular">${esc(ticket.number)}</div>
        <div class="ticket-customer-name">${esc(displayName)}</div>
        <div>${renderStatusBadge(ticket.status)}</div>
      </div>

      <div class="ticket-divider">
        <span class="ticket-notch-l"></span>
        <span class="ticket-notch-r"></span>
      </div>

      ${
        showMetrics
          ? `
            <div class="ticket-metrics">
              <div class="metric-box highlight">
                <div class="metric-value tabular">${ticket.aheadCount}</div>
                <div class="metric-label">Antrean di Depan Anda</div>
              </div>
              <div class="metric-box">
                <div class="metric-value tabular">~${ticket.estimatedWaitMinutes} mnt</div>
                <div class="metric-label">Estimasi Waktu Tunggu</div>
              </div>
            </div>
          `
          : ''
      }

      ${
        canCheckIn
          ? `
            <div style="padding:8px 20px 18px;">
              <div class="metric-box highlight" style="margin-bottom:12px;">
                <div class="metric-value tabular">${esc(ticket.bookingTime)}</div>
                <div class="metric-label">Jadwal Booking Anda • Tekan Check-In saat tiba di lokasi</div>
              </div>
              <button type="button" class="btn btn-primary btn-lg btn-block" data-checkin-ticket="${esc(ticket.id)}">
                Check-In Sekarang (Saya Sudah Tiba)
              </button>
            </div>
          `
          : ''
      }

      ${
        showCounterCallout
          ? `
            <div class="ticket-counter-callout">
              <div>
                <span>Silakan Menuju</span>
                <strong>${esc(ticket.counterName)}</strong>
                ${ticket.staffName ? `<span>Petugas: ${esc(ticket.staffName)}</span>` : ''}
              </div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </div>
          `
          : ''
      }

      ${
        ticket.status === 'completed'
          ? `<div style="padding:8px 20px 18px;text-align:center;color:var(--ink-secondary);font-size:13.5px;">
               Terima kasih telah menggunakan layanan kami! Kunjungan selesai pukul <strong>${esc(formatTimeID(ticket.completedAt))}</strong>.
             </div>`
          : ''
      }

      ${
        ticket.status === 'skipped'
          ? `<div style="padding:8px 20px 18px;text-align:center;color:#9A3412;font-size:13.5px;">
               Nomor antrean Anda sempat dilewati karena belum hadir saat dipanggil. Silakan hubungi petugas di meja resepsionis untuk dipanggil kembali.
             </div>`
          : ''
      }

      <div class="ticket-qr-row">
        <div class="ticket-qr-box">${qrSvg}</div>
        <div class="ticket-qr-info">
          <strong>Tiket Digital Aktif</strong>
          <div>Diambil pukul ${esc(formatTimeID(ticket.createdAt))} • Terupdate otomatis secara real-time tanpa perlu refresh.</div>
        </div>
      </div>

      <div class="ticket-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-copy-link="${esc(ticketUrl)}">Salin Link Tiket</button>
        ${
          notifSupported
            ? `<button type="button" class="btn btn-soft btn-sm" id="btn-enable-notif">Aktifkan Notifikasi HP</button>`
            : ''
        }
        <button type="button" class="btn btn-secondary btn-sm" id="btn-new-ticket">+ Ambil Antrean Baru</button>
        ${
          canCancel
            ? `<button type="button" class="btn btn-danger btn-sm" style="margin-left:auto;" data-cancel-ticket="${esc(ticket.id)}">Batalkan</button>`
            : ''
        }
      </div>
    </article>
  `;
}

function setBookingType(type) {
  appState.bookingType = type;
  document.querySelectorAll('#booking-type-toggle .type-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  document.getElementById('slot-picker-wrap').style.display = type === 'scheduled' ? 'flex' : 'none';
  if (appState.snapshot) renderHeaderAndHero(appState.snapshot);
}

function notifyBrowserIfAllowed(title, body) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // ignore
    }
  }
}

function handleStateUpdate(snapshot, eventKind) {
  appState.snapshot = snapshot;

  // Clean out expired/reset ticket IDs if server reset
  const existingSet = new Set(snapshot.tickets.map((t) => t.id));
  const filtered = appState.myTicketIds.filter((id) => existingSet.has(id));
  if (filtered.length !== appState.myTicketIds.length) {
    appState.myTicketIds = filtered;
    saveTicketIds();
  }

  renderHeaderAndHero(snapshot);
  renderServices(snapshot);
  renderSlots(snapshot);
  renderLiveBoard(snapshot);

  const activeMineCount = getMyValidTickets().filter((t) =>
    ['waiting', 'booked', 'called', 'serving'].includes(t.status)
  ).length;
  document.getElementById('my-tickets-count').textContent = activeMineCount;

  // Auto-open ticket tab on initial load if user already has an active ticket
  if (eventKind === 'init' && activeMineCount > 0 && appState.activeView === 'book') {
    setView('ticket');
  } else if (appState.activeView === 'ticket') {
    renderMyTicketView();
  }
}

function handleAnnouncement(ann) {
  if (!ann || !appState.myTicketIds.includes(ann.ticketId)) return;
  const dedupKey = `${ann.id}`;
  if (appState.soundNotifiedIds.has(dedupKey)) return;
  appState.soundNotifiedIds.add(dedupKey);

  appState.activeTicketId = ann.ticketId;
  setView('ticket');
  playCustomerAlert();
  showToast(`GILIRAN ANDA! Nomor ${ann.ticketNumber} dipanggil ke ${ann.counterName}`, 'warning', 7000);
  notifyBrowserIfAllowed(
    `Giliran Anda: ${ann.ticketNumber}`,
    `Silakan menuju ${ann.counterName} sekarang.`
  );
}

function bindEvents() {
  // Tabs
  document.getElementById('tab-book').addEventListener('click', () => setView('book'));
  document.getElementById('tab-ticket').addEventListener('click', () => setView('ticket'));

  // Service selection delegation
  document.getElementById('service-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-service-id]');
    if (!btn) return;
    unlockAudio();
    appState.selectedServiceId = btn.dataset.serviceId;
    if (appState.snapshot) renderServices(appState.snapshot);
  });

  // Booking type toggle
  document.getElementById('booking-type-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    unlockAudio();
    setBookingType(btn.dataset.type);
  });

  // Slot picker delegation
  document.getElementById('slots-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-slot]');
    if (!btn || btn.disabled) return;
    appState.selectedSlot = btn.dataset.slot;
    if (appState.snapshot) renderSlots(appState.snapshot);
  });

  // Submit booking form
  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    unlockAudio();

    const nameEl = document.getElementById('input-name');
    const phoneEl = document.getElementById('input-phone');
    const notesEl = document.getElementById('input-notes');
    const submitBtn = document.getElementById('btn-submit-ticket');

    const customerName = nameEl.value.trim();
    if (customerName.length < 2) {
      showToast('Mohon masukkan nama Anda (minimal 2 karakter).', 'error');
      nameEl.focus();
      return;
    }

    if (appState.bookingType === 'scheduled' && !appState.selectedSlot) {
      showToast('Mohon pilih slot waktu booking terlebih dahulu.', 'error');
      return;
    }

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Memproses nomor antrean...';

    try {
      const res = await apiRequest('/api/tickets', {
        method: 'POST',
        body: {
          customerName,
          phone: phoneEl.value.trim(),
          notes: notesEl.value.trim(),
          serviceId: appState.selectedServiceId,
          bookingType: appState.bookingType,
          bookingTime: appState.bookingType === 'scheduled' ? appState.selectedSlot : null,
        },
      });

      const ticket = res.ticket;
      addMyTicket(ticket.id, customerName);
      playSoftPing();
      showToast(`Berhasil! Nomor antrean Anda: ${ticket.number}`, 'success');

      notesEl.value = '';
      setView('ticket');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  });

  // Ticket switcher & actions delegation
  document.getElementById('view-ticket').addEventListener('click', async (e) => {
    const switchBtn = e.target.closest('[data-select-ticket]');
    if (switchBtn) {
      appState.activeTicketId = switchBtn.dataset.selectTicket;
      renderMyTicketView();
      return;
    }

    const copyBtn = e.target.closest('[data-copy-link]');
    if (copyBtn) {
      copyToClipboard(copyBtn.dataset.copyLink);
      return;
    }

    if (e.target.closest('#btn-new-ticket')) {
      setView('book');
      return;
    }

    if (e.target.closest('#btn-enable-notif')) {
      unlockAudio();
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          showToast('Notifikasi aktif! Anda akan diberi tahu saat nomor dipanggil.', 'success');
        } else {
          showToast('Izin notifikasi tidak diaktifkan.', 'warning');
        }
        renderMyTicketView();
      }
      return;
    }

    const checkInBtn = e.target.closest('[data-checkin-ticket]');
    if (checkInBtn) {
      unlockAudio();
      checkInBtn.disabled = true;
      try {
        await apiRequest(`/api/tickets/${encodeURIComponent(checkInBtn.dataset.checkinTicket)}/checkin`, {
          method: 'POST',
        });
        playSoftPing();
        showToast('Check-in berhasil! Anda sekarang masuk antrean aktif.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
        checkInBtn.disabled = false;
      }
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-ticket]');
    if (cancelBtn) {
      const id = cancelBtn.dataset.cancelTicket;
      if (!window.confirm('Yakin ingin membatalkan nomor antrean ini?')) return;
      cancelBtn.disabled = true;
      try {
        await apiRequest(`/api/tickets/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
        showToast('Nomor antrean berhasil dibatalkan.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
        cancelBtn.disabled = false;
      }
    }
  });
}

// Initialize
bindEvents();
checkDeepLinkTicket();

const livePill = document.getElementById('live-status');
const liveText = document.getElementById('live-status-text');

createRealtimeClient({
  role: 'public',
  onState: handleStateUpdate,
  onAnnouncement: handleAnnouncement,
  onStatus(status) {
    livePill.className = `live-pill ${status}`;
    liveText.textContent =
      status === 'connected'
        ? 'Live'
        : status === 'reconnecting'
        ? 'Menyambung...'
        : 'Menghubungkan...';
  },
});
