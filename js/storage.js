// --- GESTION DU STOCKAGE & ÉTAT GLOBAL ---

const DEFAULT_CONFIG = {
  theme: 'system',
  defaultIn: '08:30',
  defaultOut: '17:00',
  defaultPause: '30m',
  agendrixUrl: 'https://app.agendrix.com/api/calendar/74b512f9-f575-45b1-938a-2260e20c2c13.ics',
  calPastShifts: 5,
  calFutureShifts: 15,
  showScheduleTab: true,
  showHistory: true,
  showManual: true,
  showDayRemaining: true
};

// Chargement et sauvegarde de la configuration
function loadConfig() {
  const raw = localStorage.getItem('punch_config');
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  localStorage.setItem('punch_config', JSON.stringify(cfg));
}

// État du quart en cours (Punch actif)
function loadPunchState() {
  const raw = localStorage.getItem('punch_state');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function savePunchState(state) {
  if (state === null) {
    localStorage.removeItem('punch_state');
  } else {
    localStorage.setItem('punch_state', JSON.stringify(state));
  }
}

// Historique des quarts enregistrés
function loadShifts() {
  const raw = localStorage.getItem('punch_shifts');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveShifts(shifts) {
  localStorage.setItem('punch_shifts', JSON.stringify(shifts));
}

// Cache du calendrier Agendrix
function loadAgendrixCache() {
  const raw = localStorage.getItem('punch_agendrix_cache');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveAgendrixCache(data) {
  localStorage.setItem('punch_agendrix_cache', JSON.stringify(data));
}

// --- FONCTIONS UTILITAIRES DE TEMPS & CONVERSION ---

function parseTimeToMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + (m || 0);
}

function parsePauseToMin(pauseStr) {
  if (!pauseStr) return 0;
  const match = pauseStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parsePauseToSec(pauseStr) {
  return parsePauseToMin(pauseStr) * 60;
}

function formatSec(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinToHoursMins(totalMin) {
  const sign = totalMin < 0 ? '-' : '+';
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

function getTodayIsoDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowTimeStr() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Variables globales partagées initialisées
let config = loadConfig();
let shifts = loadShifts();
let isSafetyLocked = true;
