// Shared UI Utilities & Formatters

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function applyThemeFromSettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  if (settings.accentColor) root.style.setProperty('--accent', settings.accentColor);
  if (settings.accentDark) root.style.setProperty('--accent-dark', settings.accentDark);
  if (settings.accentSoft) root.style.setProperty('--accent-soft', settings.accentSoft);
}

export function formatTimeID(isoOrDate) {
  if (!isoOrDate) return '-';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatClockFullID(date = new Date()) {
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dayDate = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { time, dayDate };
}

export function formatElapsed(isoString) {
  if (!isoString) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}j ${String(remMins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatMinutesAgo(isoString) {
  if (!isoString) return '-';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} jam ${mins % 60} mnt lalu`;
}

export const STATUS_META = {
  waiting: { label: 'Menunggu', className: 'badge-waiting' },
  booked: { label: 'Booking Jadwal', className: 'badge-booked' },
  called: { label: 'Dipanggil', className: 'badge-called' },
  serving: { label: 'Sedang Dilayani', className: 'badge-serving' },
  completed: { label: 'Selesai', className: 'badge-completed' },
  skipped: { label: 'Dilewati', className: 'badge-skipped' },
  cancelled: { label: 'Dibatalkan', className: 'badge-cancelled' },
};

export function renderStatusBadge(status) {
  const meta = STATUS_META[status] || { label: status, className: 'badge-waiting' };
  return `<span class="badge ${meta.className}">${esc(meta.label)}</span>`;
}

export const QUEUE_STATUS_META = {
  open: { label: 'Antrean Dibuka', dot: 'open' },
  paused: { label: 'Antrean Dijeda', dot: 'paused' },
  closed: { label: 'Antrean Ditutup', dot: 'closed' },
};

export function showToast(message, type = 'info', duration = 3600) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-show'));

  setTimeout(() => {
    el.classList.remove('toast-show');
    setTimeout(() => el.remove(), 260);
  }, duration);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Tautan berhasil disalin!', 'success');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Tautan berhasil disalin!', 'success');
    return true;
  }
}
