// Web Audio Chime Synthesizer + Indonesian Text-to-Speech (TTS)

let audioCtx = null;

function ensureAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
    return true;
  } catch {
    return false;
  }
}

export function isAudioUnlocked() {
  return Boolean(audioCtx && audioCtx.state === 'running');
}

function playBellTone(ctx, freq, startTime, duration, volume = 0.16) {
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  overtone.type = 'triangle';
  overtone.frequency.setValueAtTime(freq * 2, startTime);

  const overtoneGain = ctx.createGain();
  overtoneGain.gain.setValueAtTime(0.18, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  overtone.connect(overtoneGain);
  overtoneGain.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  overtone.start(startTime);
  osc.stop(startTime + duration + 0.04);
  overtone.stop(startTime + duration + 0.04);
}

export function playCallChime() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;
  // Classic welcoming 3-note lounge/clinic chime (E5 -> G#5 -> B5)
  playBellTone(ctx, 659.25, now, 0.42, 0.17);
  playBellTone(ctx, 830.61, now + 0.22, 0.45, 0.17);
  playBellTone(ctx, 987.77, now + 0.46, 0.72, 0.2);
}

export function playCustomerAlert() {
  const ctx = ensureAudioContext();
  if (ctx) {
    const now = ctx.currentTime + 0.02;
    playBellTone(ctx, 587.33, now, 0.3, 0.18);
    playBellTone(ctx, 880.0, now + 0.18, 0.55, 0.2);
    playBellTone(ctx, 1174.66, now + 0.42, 0.65, 0.18);
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([220, 110, 220, 110, 320]);
    } catch {
      // ignore vibration unsupported
    }
  }
}

export function playSoftPing() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  playBellTone(ctx, 783.99, now, 0.25, 0.12);
}

function spellTicketIndonesian(ticketNumber) {
  // Turn "A-004" into "A, nol nol empat" or "A, empat" -> actually "A, kosong kosong empat" sounds very authentic in Indonesia!
  const digitWords = {
    '0': 'kosong',
    '1': 'satu',
    '2': 'dua',
    '3': 'tiga',
    '4': 'empat',
    '5': 'lima',
    '6': 'enam',
    '7': 'tujuh',
    '8': 'delapan',
    '9': 'sembilan',
  };
  const [prefix, numPart] = String(ticketNumber || '').split('-');
  if (!numPart) return String(ticketNumber || '');
  const spokenDigits = numPart
    .split('')
    .map((ch) => digitWords[ch] || ch)
    .join(' ');
  return `${prefix}, ${spokenDigits}`;
}

export function speakAnnouncement({ ticketNumber, counterName }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const spokenNumber = spellTicketIndonesian(ticketNumber);
    const dest = counterName ? `, silakan menuju ${counterName}` : '';
    const text = `Nomor antrean ${spokenNumber}${dest}.`;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'id-ID';
    utter.rate = 0.92;
    utter.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utter.voice = idVoice;

    // Slight delay so the bell chime finishes cleanly first
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore
      }
    }, 850);
  } catch {
    // ignore speech errors
  }
}

export function announceQueueCall({ ticketNumber, counterName, ttsEnabled = true }) {
  playCallChime();
  if (ttsEnabled) {
    speakAnnouncement({ ticketNumber, counterName });
  }
}
