import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const PRESETS = {
  klinik: {
    key: 'klinik',
    label: 'Klinik Kesehatan',
    businessName: 'Klinik Sehat Sentosa',
    tagline: 'Layanan Kesehatan Terpadu & Ramah Keluarga',
    address: 'Jl. Merdeka Raya No. 48, Jakarta Selatan',
    openHours: '08:00 - 21:00 WIB',
    accentColor: '#0D9488',
    accentDark: '#0F766E',
    accentSoft: '#CCFBF1',
    counterLabel: 'Poli / Loket',
    staffLabel: 'Dokter / Petugas',
    services: [
      {
        id: 'srv-umum',
        code: 'A',
        name: 'Poli Umum & Konsultasi',
        description: 'Pemeriksaan kesehatan umum, demam, tekanan darah, dan surat sehat',
        durationMinutes: 15,
        price: 'Rp 75.000',
        color: '#0D9488',
        active: true,
      },
      {
        id: 'srv-gigi',
        code: 'B',
        name: 'Poli Gigi & Scaling',
        description: 'Pembersihan karang gigi, tambal gigi, dan konsultasi kesehatan mulut',
        durationMinutes: 25,
        price: 'Rp 150.000',
        color: '#2563EB',
        active: true,
      },
      {
        id: 'srv-lab',
        code: 'C',
        name: 'Cek Lab & Vaksinasi',
        description: 'Cek darah rutin, gula darah, kolesterol, dan layanan imunisasi',
        durationMinutes: 10,
        price: 'Rp 95.000',
        color: '#7C3AED',
        active: true,
      },
    ],
    counters: [
      {
        id: 'ctr-1',
        name: 'Poli Umum 1',
        staffName: 'dr. Ratna Dewi',
        serviceIds: ['srv-umum'],
        status: 'open',
      },
      {
        id: 'ctr-2',
        name: 'Poli Gigi',
        staffName: 'drg. Hendra Wijaya',
        serviceIds: ['srv-gigi'],
        status: 'open',
      },
      {
        id: 'ctr-3',
        name: 'Ruang Lab & Tindakan',
        staffName: 'Ns. Sari Putri',
        serviceIds: ['srv-lab', 'srv-umum'],
        status: 'open',
      },
    ],
    demoCustomers: [
      { name: 'Budi Santoso', phone: '081234567801', serviceId: 'srv-umum', status: 'completed', counterId: 'ctr-1', minsAgo: 42 },
      { name: 'Siti Aminah', phone: '081234567802', serviceId: 'srv-gigi', status: 'completed', counterId: 'ctr-2', minsAgo: 35 },
      { name: 'Andi Wijaya', phone: '081234567803', serviceId: 'srv-umum', status: 'serving', counterId: 'ctr-1', minsAgo: 18 },
      { name: 'Dewi Lestari', phone: '081234567804', serviceId: 'srv-gigi', status: 'called', counterId: 'ctr-2', minsAgo: 14 },
      { name: 'Rizky Pratama', phone: '081234567805', serviceId: 'srv-umum', status: 'waiting', minsAgo: 10 },
      { name: 'Nadia Kusuma', phone: '081234567806', serviceId: 'srv-lab', status: 'waiting', minsAgo: 7 },
      { name: 'Hendra Gunawan', phone: '081234567807', serviceId: 'srv-umum', status: 'waiting', minsAgo: 4 },
      { name: 'Fika Rahmawati', phone: '081234567808', serviceId: 'srv-gigi', status: 'booked', minsAgo: 25, slotOffsetHours: 1 },
    ],
  },

  barbershop: {
    key: 'barbershop',
    label: 'Barbershop Modern',
    businessName: 'Pangkas & Co. Barbershop',
    tagline: 'Grooming Modern, Presisi & Nyaman Tanpa Antre Lama',
    address: 'Jl. Kemang Timur No. 19, Jakarta Selatan',
    openHours: '10:00 - 22:00 WIB',
    accentColor: '#B45309',
    accentDark: '#92400E',
    accentSoft: '#FEF3C7',
    counterLabel: 'Kursi Barber',
    staffLabel: 'Capster / Barber',
    services: [
      {
        id: 'srv-cut',
        code: 'A',
        name: 'Signature Haircut & Wash',
        description: 'Potong rambut presisi, keramas dingin, pijat singkat, & pomade styling',
        durationMinutes: 30,
        price: 'Rp 65.000',
        color: '#B45309',
        active: true,
      },
      {
        id: 'srv-beard',
        code: 'B',
        name: 'Beard Trim & Hot Towel',
        description: 'Perapian kumis & jenggot lengkap dengan kompres handuk hangat',
        durationMinutes: 20,
        price: 'Rp 45.000',
        color: '#0F766E',
        active: true,
      },
      {
        id: 'srv-vip',
        code: 'C',
        name: 'Full Grooming & Creambath',
        description: 'Paket potong lengkap, creambath aromaterapi, pijat bahu, & hair tonic',
        durationMinutes: 45,
        price: 'Rp 110.000',
        color: '#7C3AED',
        active: true,
      },
    ],
    counters: [
      {
        id: 'ctr-1',
        name: 'Kursi 1 (Senior)',
        staffName: 'Bang Raka',
        serviceIds: ['srv-cut', 'srv-vip'],
        status: 'open',
      },
      {
        id: 'ctr-2',
        name: 'Kursi 2',
        staffName: 'Dimas Pratama',
        serviceIds: ['srv-cut', 'srv-beard'],
        status: 'open',
      },
      {
        id: 'ctr-3',
        name: 'Kursi 3 (VIP)',
        staffName: 'Fajar Nugroho',
        serviceIds: ['srv-vip', 'srv-cut', 'srv-beard'],
        status: 'open',
      },
    ],
    demoCustomers: [
      { name: 'Kevin Anggara', phone: '081355667701', serviceId: 'srv-cut', status: 'completed', counterId: 'ctr-1', minsAgo: 50 },
      { name: 'Bayu Setiawan', phone: '081355667702', serviceId: 'srv-cut', status: 'serving', counterId: 'ctr-1', minsAgo: 20 },
      { name: 'Reza Mahendra', phone: '081355667703', serviceId: 'srv-beard', status: 'called', counterId: 'ctr-2', minsAgo: 12 },
      { name: 'Daffa Alfarizi', phone: '081355667704', serviceId: 'srv-cut', status: 'waiting', minsAgo: 9 },
      { name: 'Ilham Saputra', phone: '081355667705', serviceId: 'srv-vip', status: 'waiting', minsAgo: 5 },
      { name: 'Galih Permana', phone: '081355667706', serviceId: 'srv-cut', status: 'booked', minsAgo: 30, slotOffsetHours: 1 },
    ],
  },

  servis: {
    key: 'servis',
    label: 'Pusat Layanan Servis',
    businessName: 'FixLab Service Center',
    tagline: 'Servis Cepat Smartphone, Laptop & Perangkat Elektronik',
    address: 'Ruko Tekno Park Blok B-12, BSD City',
    openHours: '09:00 - 20:00 WIB',
    accentColor: '#2563EB',
    accentDark: '#1D4ED8',
    accentSoft: '#DBEAFE',
    counterLabel: 'Meja Teknisi',
    staffLabel: 'Teknisi',
    services: [
      {
        id: 'srv-fast',
        code: 'A',
        name: 'Servis Ringan & Ganti Baterai',
        description: 'Penggantian baterai, layar LCD, port charger, dan pembersihan debu',
        durationMinutes: 20,
        price: 'Mulai Rp 120.000',
        color: '#2563EB',
        active: true,
      },
      {
        id: 'srv-diag',
        code: 'B',
        name: 'Diagnosa & Upgrade Hardware',
        description: 'Pengecekan kerusakan, upgrade SSD/RAM, dan instalasi ulang sistem',
        durationMinutes: 30,
        price: 'Mulai Rp 150.000',
        color: '#0D9488',
        active: true,
      },
      {
        id: 'srv-pickup',
        code: 'C',
        name: 'Ambil Unit & Klaim Garansi',
        description: 'Pengambilan perangkat selesai servis atau pengecekan status garansi',
        durationMinutes: 10,
        price: 'Gratis',
        color: '#EA580C',
        active: true,
      },
    ],
    counters: [
      {
        id: 'ctr-1',
        name: 'Meja Teknisi 1',
        staffName: 'Arief Santoso',
        serviceIds: ['srv-fast', 'srv-diag'],
        status: 'open',
      },
      {
        id: 'ctr-2',
        name: 'Meja Teknisi 2',
        staffName: 'Bagas Kurniawan',
        serviceIds: ['srv-diag', 'srv-fast'],
        status: 'open',
      },
      {
        id: 'ctr-3',
        name: 'Loket Pengambilan',
        staffName: 'Nadia Kusuma',
        serviceIds: ['srv-pickup'],
        status: 'open',
      },
    ],
    demoCustomers: [
      { name: 'Taufik Hidayat', phone: '081988776601', serviceId: 'srv-pickup', status: 'completed', counterId: 'ctr-3', minsAgo: 30 },
      { name: 'Rina Melati', phone: '081988776602', serviceId: 'srv-fast', status: 'serving', counterId: 'ctr-1', minsAgo: 15 },
      { name: 'Yoga Pratama', phone: '081988776603', serviceId: 'srv-diag', status: 'called', counterId: 'ctr-2', minsAgo: 11 },
      { name: 'Clara Wijaya', phone: '081988776604', serviceId: 'srv-fast', status: 'waiting', minsAgo: 8 },
      { name: 'Eko Purnomo', phone: '081988776605', serviceId: 'srv-pickup', status: 'waiting', minsAgo: 3 },
      { name: 'Surya Dharma', phone: '081988776606', serviceId: 'srv-diag', status: 'booked', minsAgo: 20, slotOffsetHours: 1 },
    ],
  },
};

function todayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function formatSlotTime(offsetHours = 1) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const h = Math.min(20, Math.max(9, d.getHours()));
  return `${String(h).padStart(2, '0')}:00`;
}

function maskCustomerName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || 'Pelanggan';
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '';
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

export class QueueStore {
  constructor(stateFile) {
    this.stateFile = stateFile;
    this.listeners = new Set();
    this.state = this.loadOrCreate();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(eventType, payload) {
    for (const fn of this.listeners) {
      try {
        fn(eventType, payload);
      } catch (err) {
        console.error('[QueueStore listener error]', err);
      }
    }
  }

  loadOrCreate() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.settings && Array.isArray(parsed.services) && Array.isArray(parsed.counters)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[QueueStore] Failed to load state file, recreating:', err.message);
    }
    const fresh = this.buildPresetState('klinik', true);
    this.persist(fresh);
    return fresh;
  }

  persist(targetState = this.state) {
    const dir = path.dirname(this.stateFile);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(targetState, null, 2), 'utf8');
    fs.renameSync(tmp, this.stateFile);
  }

  buildPresetState(presetKey, seedDemo = true, existingPin = '1234') {
    const preset = PRESETS[presetKey] || PRESETS.klinik;
    const services = preset.services.map((s) => ({ ...s }));
    const counters = preset.counters.map((c) => ({ ...c, serviceIds: [...c.serviceIds] }));
    const sequences = {};
    for (const s of services) sequences[s.code] = 0;

    const tickets = [];
    let lastAnnouncement = null;

    if (seedDemo) {
      const now = Date.now();
      for (const demo of preset.demoCustomers) {
        const srv = services.find((s) => s.id === demo.serviceId) || services[0];
        sequences[srv.code] = (sequences[srv.code] || 0) + 1;
        const number = `${srv.code}-${String(sequences[srv.code]).padStart(3, '0')}`;
        const createdAt = new Date(now - demo.minsAgo * 60000).toISOString();
        const ticket = {
          id: makeId('tkt'),
          number,
          sequence: sequences[srv.code],
          serviceId: srv.id,
          customerName: demo.name,
          phone: demo.phone,
          notes: '',
          bookingType: demo.status === 'booked' ? 'scheduled' : 'walkin',
          bookingTime: demo.status === 'booked' ? formatSlotTime(demo.slotOffsetHours || 1) : null,
          status: demo.status,
          counterId: demo.counterId || null,
          createdAt,
          checkedInAt: demo.status === 'booked' ? null : createdAt,
          calledAt: null,
          lastCalledAt: null,
          servedAt: null,
          completedAt: null,
          callCount: 0,
        };

        if (demo.status === 'completed') {
          ticket.calledAt = new Date(now - (demo.minsAgo - 5) * 60000).toISOString();
          ticket.lastCalledAt = ticket.calledAt;
          ticket.servedAt = new Date(now - (demo.minsAgo - 6) * 60000).toISOString();
          ticket.completedAt = new Date(now - Math.max(2, demo.minsAgo - 6 - srv.durationMinutes) * 60000).toISOString();
          ticket.callCount = 1;
        } else if (demo.status === 'serving') {
          ticket.calledAt = new Date(now - 9 * 60000).toISOString();
          ticket.lastCalledAt = ticket.calledAt;
          ticket.servedAt = new Date(now - 7 * 60000).toISOString();
          ticket.callCount = 1;
        } else if (demo.status === 'called') {
          ticket.calledAt = new Date(now - 60000).toISOString();
          ticket.lastCalledAt = ticket.calledAt;
          ticket.callCount = 1;
          const ctr = counters.find((c) => c.id === ticket.counterId);
          lastAnnouncement = {
            id: makeId('ann'),
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            customerName: maskCustomerName(ticket.customerName),
            serviceName: srv.name,
            serviceColor: srv.color,
            counterId: ctr ? ctr.id : null,
            counterName: ctr ? ctr.name : '',
            staffName: ctr ? ctr.staffName : '',
            callCount: 1,
            timestamp: ticket.lastCalledAt,
          };
        }

        tickets.push(ticket);
      }
    }

    return {
      version: 1,
      date: todayDateStr(),
      settings: {
        presetKey: preset.key,
        businessName: preset.businessName,
        tagline: preset.tagline,
        address: preset.address,
        openHours: preset.openHours,
        accentColor: preset.accentColor,
        accentDark: preset.accentDark,
        accentSoft: preset.accentSoft,
        counterLabel: preset.counterLabel,
        staffLabel: preset.staffLabel,
        queueStatus: 'open', // open | paused | closed
        ttsEnabled: true,
        showCustomerNameOnDisplay: true,
        allowBooking: true,
        adminPin: existingPin || '1234',
      },
      services,
      counters,
      sequences,
      tickets,
      lastAnnouncement,
      updatedAt: new Date().toISOString(),
    };
  }

  verifyPin(pin) {
    return String(pin || '').trim() === String(this.state.settings.adminPin || '1234');
  }

  _touch() {
    this.state.updatedAt = new Date().toISOString();
    this.persist();
  }

  _serviceMap() {
    return new Map(this.state.services.map((s) => [s.id, s]));
  }

  _counterMap() {
    return new Map(this.state.counters.map((c) => [c.id, c]));
  }

  _getEligibleCounters(serviceId) {
    const openCounters = this.state.counters.filter((c) => c.status === 'open');
    const matching = openCounters.filter(
      (c) => !c.serviceIds || c.serviceIds.length === 0 || c.serviceIds.includes(serviceId)
    );
    return matching;
  }

  _waitingQueueSorted() {
    return this.state.tickets
      .filter((t) => t.status === 'waiting')
      .sort((a, b) => {
        const ta = new Date(a.checkedInAt || a.createdAt).getTime();
        const tb = new Date(b.checkedInAt || b.createdAt).getTime();
        if (ta !== tb) return ta - tb;
        return a.sequence - b.sequence;
      });
  }

  _computeQueueMetricsForTicket(ticket, waitingSorted, serviceMap) {
    if (ticket.status !== 'waiting') {
      return { aheadCount: 0, estimatedWaitMinutes: 0 };
    }

    const eligibleCounters = this._getEligibleCounters(ticket.serviceId);
    const eligibleServiceIds = new Set([ticket.serviceId]);
    for (const c of eligibleCounters) {
      if (!c.serviceIds || c.serviceIds.length === 0) {
        for (const s of this.state.services) eligibleServiceIds.add(s.id);
      } else {
        for (const sid of c.serviceIds) eligibleServiceIds.add(sid);
      }
    }

    const myIndex = waitingSorted.findIndex((t) => t.id === ticket.id);
    if (myIndex < 0) return { aheadCount: 0, estimatedWaitMinutes: 0 };

    const aheadTickets = waitingSorted
      .slice(0, myIndex)
      .filter((t) => eligibleServiceIds.has(t.serviceId));

    const aheadSameService = waitingSorted
      .slice(0, myIndex)
      .filter((t) => t.serviceId === ticket.serviceId).length;

    const parallelCounters = Math.max(1, eligibleCounters.length);

    let totalAheadMinutes = 0;
    for (const t of aheadTickets) {
      const srv = serviceMap.get(t.serviceId);
      totalAheadMinutes += srv ? srv.durationMinutes : 15;
    }

    // Add estimated remaining duration for active tickets on eligible counters
    let activeRemainingMinutes = 0;
    const now = Date.now();
    for (const c of eligibleCounters) {
      const active = this.state.tickets.find(
        (t) => t.counterId === c.id && (t.status === 'serving' || t.status === 'called')
      );
      if (active) {
        const srv = serviceMap.get(active.serviceId);
        const dur = srv ? srv.durationMinutes : 15;
        const startTs = new Date(active.servedAt || active.calledAt || active.createdAt).getTime();
        const elapsed = Math.max(0, (now - startTs) / 60000);
        activeRemainingMinutes += Math.max(2, dur - elapsed);
      }
    }

    const rawEta = Math.round((totalAheadMinutes + activeRemainingMinutes) / parallelCounters);
    const estimatedWaitMinutes = Math.max(1, rawEta);

    return {
      aheadCount: aheadTickets.length,
      aheadSameService,
      estimatedWaitMinutes,
    };
  }

  _buildBookingSlots() {
    const slots = [];
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startHour = 9;
    const endHour = 20;

    for (let h = startHour; h <= endHour; h++) {
      for (const m of [0, 30]) {
        const slotMins = h * 60 + m;
        if (slotMins <= currentMins + 20) continue;
        if (h === endHour && m > 0) continue;
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const bookedCount = this.state.tickets.filter(
          (t) => t.status === 'booked' && t.bookingTime === label
        ).length;
        slots.push({
          time: label,
          bookedCount,
          capacity: 4,
          available: bookedCount < 4,
        });
      }
    }

    // If late at night (no slots left today), provide next-day morning slots
    if (slots.length === 0) {
      for (const label of ['Besok 09:00', 'Besok 09:30', 'Besok 10:00', 'Besok 10:30', 'Besok 11:00', 'Besok 13:00', 'Besok 14:00']) {
        const bookedCount = this.state.tickets.filter(
          (t) => t.status === 'booked' && t.bookingTime === label
        ).length;
        slots.push({
          time: label,
          bookedCount,
          capacity: 4,
          available: bookedCount < 4,
        });
      }
    }

    return slots.slice(0, 12);
  }

  getSnapshot({ includePrivate = false } = {}) {
    const serviceMap = this._serviceMap();
    const counterMap = this._counterMap();
    const waitingSorted = this._waitingQueueSorted();

    const enrichedTickets = this.state.tickets.map((t) => {
      const srv = serviceMap.get(t.serviceId);
      const ctr = t.counterId ? counterMap.get(t.counterId) : null;
      const metrics = this._computeQueueMetricsForTicket(t, waitingSorted, serviceMap);

      return {
        id: t.id,
        number: t.number,
        sequence: t.sequence,
        serviceId: t.serviceId,
        serviceName: srv ? srv.name : 'Layanan',
        serviceCode: srv ? srv.code : 'A',
        serviceColor: srv ? srv.color : this.state.settings.accentColor,
        serviceDuration: srv ? srv.durationMinutes : 15,
        customerName: includePrivate ? t.customerName : maskCustomerName(t.customerName),
        customerFullName: includePrivate ? t.customerName : undefined,
        phone: includePrivate ? t.phone : maskPhone(t.phone),
        notes: includePrivate ? t.notes : '',
        bookingType: t.bookingType,
        bookingTime: t.bookingTime,
        status: t.status,
        counterId: t.counterId,
        counterName: ctr ? ctr.name : null,
        staffName: ctr ? ctr.staffName : null,
        createdAt: t.createdAt,
        checkedInAt: t.checkedInAt,
        calledAt: t.calledAt,
        lastCalledAt: t.lastCalledAt,
        servedAt: t.servedAt,
        completedAt: t.completedAt,
        callCount: t.callCount || 0,
        aheadCount: metrics.aheadCount,
        estimatedWaitMinutes: metrics.estimatedWaitMinutes,
      };
    });

    const ticketById = new Map(enrichedTickets.map((t) => [t.id, t]));

    const enrichedServices = this.state.services.map((s) => {
      const waitingForSrv = waitingSorted.filter((t) => t.serviceId === s.id);
      const activeForSrv = this.state.tickets.filter(
        (t) => t.serviceId === s.id && (t.status === 'called' || t.status === 'serving')
      );
      const eligibleCounters = this._getEligibleCounters(s.id);
      const parallel = Math.max(1, eligibleCounters.length);
      const estWait = Math.round(((waitingForSrv.length + activeForSrv.length * 0.5) * s.durationMinutes) / parallel);
      const nextSeq = (this.state.sequences[s.code] || 0) + 1;

      return {
        ...s,
        waitingCount: waitingForSrv.length,
        activeCount: activeForSrv.length,
        estimatedWaitMinutes: estWait,
        nextNumberPreview: `${s.code}-${String(nextSeq).padStart(3, '0')}`,
        openCountersCount: eligibleCounters.length,
      };
    });

    const enrichedCounters = this.state.counters.map((c) => {
      const currentRaw = this.state.tickets.find(
        (t) => t.counterId === c.id && (t.status === 'serving' || t.status === 'called')
      );
      const eligibleWaiting = waitingSorted.filter(
        (t) => !c.serviceIds || c.serviceIds.length === 0 || c.serviceIds.includes(t.serviceId)
      );
      return {
        ...c,
        currentTicket: currentRaw ? ticketById.get(currentRaw.id) : null,
        waitingCount: eligibleWaiting.length,
        nextTicketPreview: eligibleWaiting[0] ? ticketById.get(eligibleWaiting[0].id) : null,
      };
    });

    const completed = this.state.tickets.filter((t) => t.status === 'completed');
    let totalServiceMins = 0;
    let serviceSamples = 0;
    let totalWaitMins = 0;
    let waitSamples = 0;

    for (const t of completed) {
      if (t.servedAt && t.completedAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.servedAt).getTime()) / 60000;
        if (diff >= 0 && diff < 300) {
          totalServiceMins += diff;
          serviceSamples++;
        }
      }
      if (t.checkedInAt && t.calledAt) {
        const diff = (new Date(t.calledAt).getTime() - new Date(t.checkedInAt).getTime()) / 60000;
        if (diff >= 0 && diff < 300) {
          totalWaitMins += diff;
          waitSamples++;
        }
      }
    }

    const stats = {
      totalToday: this.state.tickets.length,
      waiting: this.state.tickets.filter((t) => t.status === 'waiting').length,
      booked: this.state.tickets.filter((t) => t.status === 'booked').length,
      called: this.state.tickets.filter((t) => t.status === 'called').length,
      serving: this.state.tickets.filter((t) => t.status === 'serving').length,
      completed: completed.length,
      skipped: this.state.tickets.filter((t) => t.status === 'skipped').length,
      cancelled: this.state.tickets.filter((t) => t.status === 'cancelled').length,
      avgServiceMinutes: serviceSamples > 0 ? Math.round(totalServiceMins / serviceSamples) : 15,
      avgWaitMinutes: waitSamples > 0 ? Math.round(totalWaitMins / waitSamples) : 8,
    };

    const { adminPin: _pin, ...safeSettings } = this.state.settings;

    return {
      date: this.state.date,
      updatedAt: this.state.updatedAt,
      settings: safeSettings,
      presets: Object.values(PRESETS).map((p) => ({
        key: p.key,
        label: p.label,
        businessName: p.businessName,
        accentColor: p.accentColor,
      })),
      services: enrichedServices,
      counters: enrichedCounters,
      tickets: enrichedTickets,
      waitingQueue: waitingSorted.map((t) => ticketById.get(t.id)),
      lastAnnouncement: this.state.lastAnnouncement,
      availableSlots: this._buildBookingSlots(),
      stats,
    };
  }

  getTicketById(ticketId, { includeFullOwner = true } = {}) {
    const snapshot = this.getSnapshot({ includePrivate: includeFullOwner });
    return snapshot.tickets.find((t) => t.id === ticketId) || null;
  }

  createTicket({ customerName, phone = '', serviceId, bookingType = 'walkin', bookingTime = null, notes = '' }) {
    if (this.state.settings.queueStatus === 'closed') {
      throw Object.assign(new Error('Antrean saat ini sedang ditutup.'), { statusCode: 400 });
    }
    if (this.state.settings.queueStatus === 'paused' && bookingType !== 'scheduled') {
      throw Object.assign(new Error('Pengambilan antrean langsung sedang dijeda sementara. Silakan pilih booking jadwal atau tunggu beberapa saat.'), { statusCode: 400 });
    }

    const cleanName = String(customerName || '').trim();
    if (cleanName.length < 2) {
      throw Object.assign(new Error('Nama pelanggan minimal 2 karakter.'), { statusCode: 400 });
    }

    const srv = this.state.services.find((s) => s.id === serviceId && s.active !== false);
    if (!srv) {
      throw Object.assign(new Error('Layanan tidak ditemukan atau sedang tidak aktif.'), { statusCode: 404 });
    }

    const isScheduled = bookingType === 'scheduled';
    if (isScheduled && !bookingTime) {
      throw Object.assign(new Error('Silakan pilih jam booking terlebih dahulu.'), { statusCode: 400 });
    }

    this.state.sequences[srv.code] = (this.state.sequences[srv.code] || 0) + 1;
    const sequence = this.state.sequences[srv.code];
    const number = `${srv.code}-${String(sequence).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const ticket = {
      id: makeId('tkt'),
      number,
      sequence,
      serviceId: srv.id,
      customerName: cleanName.slice(0, 60),
      phone: String(phone || '').trim().slice(0, 24),
      notes: String(notes || '').trim().slice(0, 160),
      bookingType: isScheduled ? 'scheduled' : 'walkin',
      bookingTime: isScheduled ? String(bookingTime).trim().slice(0, 20) : null,
      status: isScheduled ? 'booked' : 'waiting',
      counterId: null,
      createdAt: nowIso,
      checkedInAt: isScheduled ? null : nowIso,
      calledAt: null,
      lastCalledAt: null,
      servedAt: null,
      completedAt: null,
      callCount: 0,
    };

    this.state.tickets.push(ticket);
    this._touch();
    this.emit('state', null);

    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  checkInBooking(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (ticket.status !== 'booked') {
      throw Object.assign(new Error('Tiket ini sudah masuk antrean atau telah diproses.'), { statusCode: 400 });
    }
    ticket.status = 'waiting';
    ticket.checkedInAt = new Date().toISOString();
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  cancelTicket(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (['completed', 'cancelled'].includes(ticket.status)) {
      throw Object.assign(new Error('Tiket sudah selesai atau dibatalkan.'), { statusCode: 400 });
    }
    ticket.status = 'cancelled';
    ticket.counterId = null;
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  callNext({ counterId, ticketId = null, previousAction = 'complete' }) {
    const counter = this.state.counters.find((c) => c.id === counterId);
    if (!counter) {
      throw Object.assign(new Error('Loket tidak ditemukan.'), { statusCode: 404 });
    }
    if (counter.status !== 'open') {
      counter.status = 'open';
    }

    // Resolve any active ticket on this counter first
    const current = this.state.tickets.find(
      (t) => t.counterId === counter.id && (t.status === 'serving' || t.status === 'called')
    );

    if (current) {
      if (current.status === 'serving' || previousAction === 'complete') {
        current.status = 'completed';
        current.completedAt = new Date().toISOString();
      } else if (previousAction === 'skip') {
        current.status = 'skipped';
        current.counterId = null;
      }
    }

    let nextTicket = null;
    if (ticketId) {
      nextTicket = this.state.tickets.find(
        (t) => t.id === ticketId && ['waiting', 'skipped', 'booked'].includes(t.status)
      );
      if (!nextTicket) {
        throw Object.assign(new Error('Nomor antrean yang dipilih tidak tersedia untuk dipanggil.'), { statusCode: 400 });
      }
      if (!nextTicket.checkedInAt) nextTicket.checkedInAt = new Date().toISOString();
    } else {
      const waiting = this._waitingQueueSorted();
      nextTicket = waiting.find(
        (t) => !counter.serviceIds || counter.serviceIds.length === 0 || counter.serviceIds.includes(t.serviceId)
      );
      if (!nextTicket) {
        // Persist completion/skip of previous ticket if any
        if (current) {
          this._touch();
          this.emit('state', null);
        }
        return { called: null, previousCompleted: Boolean(current) };
      }
    }

    const nowIso = new Date().toISOString();
    nextTicket.status = 'called';
    nextTicket.counterId = counter.id;
    nextTicket.calledAt = nextTicket.calledAt || nowIso;
    nextTicket.lastCalledAt = nowIso;
    nextTicket.callCount = (nextTicket.callCount || 0) + 1;

    const srv = this.state.services.find((s) => s.id === nextTicket.serviceId);
    const announcement = {
      id: makeId('ann'),
      ticketId: nextTicket.id,
      ticketNumber: nextTicket.number,
      customerName: maskCustomerName(nextTicket.customerName),
      serviceName: srv ? srv.name : 'Layanan',
      serviceColor: srv ? srv.color : this.state.settings.accentColor,
      counterId: counter.id,
      counterName: counter.name,
      staffName: counter.staffName,
      callCount: nextTicket.callCount,
      timestamp: nowIso,
    };

    this.state.lastAnnouncement = announcement;
    this._touch();
    this.emit('announcement', announcement);
    this.emit('state', null);

    return {
      called: this.getTicketById(nextTicket.id, { includeFullOwner: true }),
      announcement,
    };
  }

  recallTicket(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (!['called', 'serving'].includes(ticket.status)) {
      throw Object.assign(new Error('Hanya tiket yang sedang dipanggil atau dilayani yang dapat dipanggil ulang.'), { statusCode: 400 });
    }
    const counter = this.state.counters.find((c) => c.id === ticket.counterId);
    const srv = this.state.services.find((s) => s.id === ticket.serviceId);
    const nowIso = new Date().toISOString();

    ticket.lastCalledAt = nowIso;
    ticket.callCount = (ticket.callCount || 0) + 1;

    const announcement = {
      id: makeId('ann'),
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      customerName: maskCustomerName(ticket.customerName),
      serviceName: srv ? srv.name : 'Layanan',
      serviceColor: srv ? srv.color : this.state.settings.accentColor,
      counterId: counter ? counter.id : null,
      counterName: counter ? counter.name : 'Loket',
      staffName: counter ? counter.staffName : '',
      callCount: ticket.callCount,
      timestamp: nowIso,
    };

    this.state.lastAnnouncement = announcement;
    this._touch();
    this.emit('announcement', announcement);
    this.emit('state', null);

    return { ticket: this.getTicketById(ticket.id, { includeFullOwner: true }), announcement };
  }

  startServing(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (ticket.status !== 'called') {
      throw Object.assign(new Error('Tiket harus dalam status dipanggil sebelum mulai dilayani.'), { statusCode: 400 });
    }
    ticket.status = 'serving';
    ticket.servedAt = new Date().toISOString();
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  completeTicket(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (!['called', 'serving'].includes(ticket.status)) {
      throw Object.assign(new Error('Tiket tidak sedang aktif di loket.'), { statusCode: 400 });
    }
    const nowIso = new Date().toISOString();
    ticket.status = 'completed';
    ticket.servedAt = ticket.servedAt || nowIso;
    ticket.completedAt = nowIso;
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  skipTicket(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (!['called', 'waiting', 'serving'].includes(ticket.status)) {
      throw Object.assign(new Error('Tiket tidak dapat dilewati.'), { statusCode: 400 });
    }
    ticket.status = 'skipped';
    ticket.counterId = null;
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  restoreTicket(ticketId) {
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan.'), { statusCode: 404 });
    if (ticket.status !== 'skipped') {
      throw Object.assign(new Error('Hanya tiket yang dilewati yang dapat dikembalikan ke antrean.'), { statusCode: 400 });
    }
    ticket.status = 'waiting';
    ticket.counterId = null;
    ticket.checkedInAt = new Date().toISOString();
    this._touch();
    this.emit('state', null);
    return this.getTicketById(ticket.id, { includeFullOwner: true });
  }

  upsertService(data) {
    const name = String(data.name || '').trim();
    const code = String(data.code || 'A').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'A';
    if (name.length < 2) {
      throw Object.assign(new Error('Nama layanan minimal 2 karakter.'), { statusCode: 400 });
    }
    const durationMinutes = Math.max(5, Math.min(180, Number(data.durationMinutes) || 15));
    const color = /^#[0-9a-fA-F]{6}$/.test(data.color || '') ? data.color : this.state.settings.accentColor;

    if (data.id) {
      const existing = this.state.services.find((s) => s.id === data.id);
      if (!existing) throw Object.assign(new Error('Layanan tidak ditemukan.'), { statusCode: 404 });
      existing.name = name.slice(0, 60);
      existing.code = code;
      existing.description = String(data.description || '').trim().slice(0, 140);
      existing.durationMinutes = durationMinutes;
      existing.price = String(data.price || '').trim().slice(0, 30);
      existing.color = color;
      if (typeof data.active === 'boolean') existing.active = data.active;
      if (this.state.sequences[code] === undefined) this.state.sequences[code] = 0;
    } else {
      const created = {
        id: makeId('srv'),
        code,
        name: name.slice(0, 60),
        description: String(data.description || '').trim().slice(0, 140),
        durationMinutes,
        price: String(data.price || '').trim().slice(0, 30),
        color,
        active: true,
      };
      this.state.services.push(created);
      if (this.state.sequences[code] === undefined) this.state.sequences[code] = 0;
    }

    this._touch();
    this.emit('state', null);
    return this.state.services;
  }

  deleteService(serviceId) {
    if (this.state.services.length <= 1) {
      throw Object.assign(new Error('Minimal harus ada 1 layanan aktif.'), { statusCode: 400 });
    }
    const idx = this.state.services.findIndex((s) => s.id === serviceId);
    if (idx < 0) throw Object.assign(new Error('Layanan tidak ditemukan.'), { statusCode: 404 });
    this.state.services.splice(idx, 1);
    for (const c of this.state.counters) {
      c.serviceIds = (c.serviceIds || []).filter((id) => id !== serviceId);
    }
    this._touch();
    this.emit('state', null);
    return true;
  }

  upsertCounter(data) {
    const name = String(data.name || '').trim();
    if (name.length < 2) {
      throw Object.assign(new Error('Nama loket minimal 2 karakter.'), { statusCode: 400 });
    }
    const validServiceIds = Array.isArray(data.serviceIds)
      ? data.serviceIds.filter((id) => this.state.services.some((s) => s.id === id))
      : [];
    const status = ['open', 'break', 'closed'].includes(data.status) ? data.status : 'open';

    if (data.id) {
      const existing = this.state.counters.find((c) => c.id === data.id);
      if (!existing) throw Object.assign(new Error('Loket tidak ditemukan.'), { statusCode: 404 });
      existing.name = name.slice(0, 50);
      existing.staffName = String(data.staffName || '').trim().slice(0, 50);
      existing.serviceIds = validServiceIds;
      existing.status = status;
    } else {
      this.state.counters.push({
        id: makeId('ctr'),
        name: name.slice(0, 50),
        staffName: String(data.staffName || '').trim().slice(0, 50),
        serviceIds: validServiceIds,
        status,
      });
    }

    this._touch();
    this.emit('state', null);
    return this.state.counters;
  }

  deleteCounter(counterId) {
    if (this.state.counters.length <= 1) {
      throw Object.assign(new Error('Minimal harus ada 1 loket.'), { statusCode: 400 });
    }
    const idx = this.state.counters.findIndex((c) => c.id === counterId);
    if (idx < 0) throw Object.assign(new Error('Loket tidak ditemukan.'), { statusCode: 404 });
    this.state.counters.splice(idx, 1);
    this._touch();
    this.emit('state', null);
    return true;
  }

  updateSettings(patch) {
    const allowed = [
      'businessName',
      'tagline',
      'address',
      'openHours',
      'accentColor',
      'accentDark',
      'accentSoft',
      'counterLabel',
      'staffLabel',
      'queueStatus',
      'ttsEnabled',
      'showCustomerNameOnDisplay',
      'allowBooking',
    ];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        this.state.settings[key] = patch[key];
      }
    }
    if (patch.newAdminPin && String(patch.newAdminPin).trim().length >= 4) {
      this.state.settings.adminPin = String(patch.newAdminPin).trim().slice(0, 12);
    }
    this._touch();
    this.emit('state', null);
    return this.getSnapshot({ includePrivate: true }).settings;
  }

  applyPreset(presetKey, seedDemo = true) {
    if (!PRESETS[presetKey]) {
      throw Object.assign(new Error('Preset bisnis tidak dikenali.'), { statusCode: 400 });
    }
    const currentPin = this.state.settings.adminPin;
    this.state = this.buildPresetState(presetKey, seedDemo, currentPin);
    this.persist();
    this.emit('state', null);
    return this.getSnapshot({ includePrivate: true });
  }

  resetQueue(seedDemo = false) {
    if (seedDemo) {
      return this.applyPreset(this.state.settings.presetKey || 'klinik', true);
    }
    this.state.date = todayDateStr();
    this.state.tickets = [];
    this.state.lastAnnouncement = null;
    for (const s of this.state.services) {
      this.state.sequences[s.code] = 0;
    }
    this._touch();
    this.emit('state', null);
    return this.getSnapshot({ includePrivate: true });
  }
}
