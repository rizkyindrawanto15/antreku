import { apiRequest, createRealtimeClient } from './api.js';
import { renderQRSvg } from './qrcode.js';
import { announceQueueCall, playSoftPing, unlockAudio } from './sound.js';
import { applyThemeFromSettings, esc, formatClockFullID, formatTimeID, showToast } from './utils.js';

const tvState = {
  snapshot: null,
  audioEnabled: false,
  lastAnnouncedId: null,
};

function updateClock() {
  const { time, dayDate } = formatClockFullID(new Date());
  document.getElementById('tv-clock-time').textContent = time;
  document.getElementById('tv-clock-date').textContent = dayDate;
}

function updateAudioButton() {
  const btn = document.getElementById('btn-audio-toggle');
  const lbl = document.getElementById('audio-toggle-label');
  if (tvState.audioEnabled) {
    btn.classList.remove('needs-unlock');
    btn.classList.add('active');
    lbl.textContent = 'Suara Panggilan Aktif';
  } else {
    btn.classList.add('needs-unlock');
    btn.classList.remove('active');
    lbl.textContent = 'Aktifkan Suara Panggilan';
  }
}

function triggerSpotlightFlash() {
  const card = document.getElementById('spotlight-card');
  card.classList.remove('flash-call');
  void card.offsetWidth; // restart CSS animation
  card.classList.add('flash-call');
}

function renderSpotlight(ann, settings) {
  const numEl = document.getElementById('spotlight-number');
  const custEl = document.getElementById('spotlight-customer');
  const ctrEl = document.getElementById('spotlight-counter');
  const srvEl = document.getElementById('spotlight-service');
  const staffEl = document.getElementById('spotlight-staff');
  const metaEl = document.getElementById('spotlight-call-meta');

  if (!ann) {
    numEl.textContent = '—';
    custEl.textContent = 'Menunggu panggilan berikutnya...';
    ctrEl.textContent = settings?.businessName || 'Ruang Tunggu';
    srvEl.textContent = 'Silakan ambil nomor antrean dari HP Anda';
    staffEl.textContent = '';
    metaEl.textContent = '';
    return;
  }

  numEl.textContent = ann.ticketNumber;
  const showName = settings ? settings.showCustomerNameOnDisplay !== false : true;
  custEl.textContent = showName && ann.customerName ? ann.customerName : ann.serviceName;
  ctrEl.textContent = ann.counterName || 'Loket Aktif';
  srvEl.textContent = ann.serviceName || 'Layanan';
  staffEl.textContent = ann.staffName ? `Petugas: ${ann.staffName}` : '';
  metaEl.textContent = `Panggilan ke-${ann.callCount || 1} • ${formatTimeID(ann.timestamp)}`;
}

function renderDisplay(snap) {
  tvState.snapshot = snap;
  const s = snap.settings;
  applyThemeFromSettings(s);

  document.title = `TV Display • ${s.businessName}`;
  document.getElementById('tv-logo').textContent = (s.businessName || 'A')[0].toUpperCase();
  document.getElementById('tv-business-name').textContent = s.businessName;
  document.getElementById('tv-tagline').textContent = s.tagline;

  renderSpotlight(snap.lastAnnouncement, s);

  // Counters
  const openCount = snap.counters.filter((c) => c.status === 'open').length;
  document.getElementById('tv-counters-heading').textContent = `${s.counterLabel || 'Loket'} Aktif`;
  document.getElementById('tv-counters-count').textContent = `${openCount}/${snap.counters.length} buka`;

  const cList = document.getElementById('tv-counters-list');
  cList.innerHTML = snap.counters
    .map((ctr) => {
      const cur = ctr.currentTicket;
      const isCalled = cur && cur.status === 'called';
      return `
        <div class="tv-counter-card ${cur ? 'active' : ''}">
          <div>
            <div class="tv-counter-name">${esc(ctr.name)}</div>
            <div class="tv-counter-staff">${esc(ctr.staffName || (ctr.status === 'open' ? 'Siap Melayani' : 'Istirahat'))}</div>
          </div>
          <div class="tv-counter-num tabular ${isCalled ? 'called' : cur ? '' : 'idle'}">
            ${cur ? esc(cur.number) : ctr.status === 'open' ? 'Tersedia' : 'Istirahat'}
          </div>
        </div>
      `;
    })
    .join('');

  // Up Next
  const waiting = snap.waitingQueue || [];
  document.getElementById('tv-waiting-count').textContent = `${waiting.length} menunggu`;
  const upNextEl = document.getElementById('tv-up-next');
  if (waiting.length === 0) {
    upNextEl.innerHTML = `<span style="color:#94A3B8;font-size:14px;">Belum ada antrean menunggu — silakan scan QR Code untuk mengambil nomor.</span>`;
  } else {
    upNextEl.innerHTML = waiting
      .slice(0, 8)
      .map(
        (t) => `
          <div class="up-next-chip tabular">
            ${esc(t.number)}
            <span>${esc(t.serviceCode)} • ~${t.estimatedWaitMinutes}m</span>
          </div>
        `
      )
      .join('');
  }
}

async function initQr() {
  let url = window.location.origin;
  try {
    const net = await apiRequest('/api/network');
    if (net.primaryUrl) url = net.primaryUrl;
  } catch {
    // fallback to origin
  }
  document.getElementById('tv-qr-frame').innerHTML = renderQRSvg(url, { size: 120 });
  document.getElementById('tv-qr-url').textContent = url;
}

document.getElementById('btn-audio-toggle').addEventListener('click', () => {
  tvState.audioEnabled = !tvState.audioEnabled;
  if (tvState.audioEnabled) {
    unlockAudio();
    playSoftPing();
    showToast('Suara bel & panggilan otomatis Bahasa Indonesia aktif!', 'success');
  } else {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    showToast('Suara panggilan dimatikan.', 'info');
  }
  updateAudioButton();
});

// Start clock & QR
updateClock();
setInterval(updateClock, 1000);
updateAudioButton();
initQr();

const livePill = document.getElementById('tv-live-pill');
const liveText = document.getElementById('tv-live-text');

createRealtimeClient({
  role: 'public',
  onState: renderDisplay,
  onAnnouncement(ann) {
    if (!ann || ann.id === tvState.lastAnnouncedId) return;
    tvState.lastAnnouncedId = ann.id;
    renderSpotlight(ann, tvState.snapshot?.settings);
    triggerSpotlightFlash();

    if (tvState.audioEnabled) {
      const ttsEnabled = tvState.snapshot?.settings?.ttsEnabled !== false;
      announceQueueCall({
        ticketNumber: ann.ticketNumber,
        counterName: ann.counterName,
        ttsEnabled,
      });
    }
  },
  onStatus(status) {
    livePill.className = `live-pill display-live-pill ${status}`;
    liveText.textContent =
      status === 'connected'
        ? 'Real-Time Live'
        : status === 'reconnecting'
        ? 'Menyambung ulang...'
        : 'Menghubungkan...';
  },
});
