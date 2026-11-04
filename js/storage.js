// =========================================================
// SYNCHRONISATION CLOUD, CACHE LOCAL & AUTH (STORAGE.JS)
// =========================================================

const CONFIG_STORAGE_KEY = 'shift_tracker_config';
const LOGS_STORAGE_KEY = 'shift_tracker_logs';
const AGENDRIX_CACHE_KEY = 'shift_tracker_agendrix_cache';

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

// --- UTILITAIRES DE DATE & CONFIG LOCALE ---
function getTodayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
window.getTodayIsoDate = getTodayIsoDate;

function parseTimeToMin(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
window.parseTimeToMin = parseTimeToMin;

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    window.config = { ...DEFAULT_CONFIG, ...parsed };
  } catch (e) {
    window.config = { ...DEFAULT_CONFIG };
  }
  return window.config;
}
window.loadConfig = loadConfig;

function saveConfig(cfg) {
  window.config = { ...DEFAULT_CONFIG, ...(cfg || window.config) };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(window.config));
}
window.saveConfig = saveConfig;

function loadAgendrixCache() {
  try {
    const raw = localStorage.getItem(AGENDRIX_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    syncAgendrixScheduleMap(list);
    return list;
  } catch (e) {
    return [];
  }
}
window.loadAgendrixCache = loadAgendrixCache;

function saveAgendrixCache(shiftsArray) {
  const list = Array.isArray(shiftsArray) ? shiftsArray : [];
  localStorage.setItem(AGENDRIX_CACHE_KEY, JSON.stringify(list));
  syncAgendrixScheduleMap(list);
}
window.saveAgendrixCache = saveAgendrixCache;

function syncAgendrixScheduleMap(list) {
  window.agendrixSchedule = {};
  (list || []).forEach(s => {
    if (s && s.date && s.start && s.end) {
      window.agendrixSchedule[s.date] = { in: s.start, out: s.end };
    }
  });
}

// Charger la configuration dès l'initialisation du script
loadConfig();
loadAgendrixCache();

// --- CONFIGURATION FIREBASE PUNCHWORKPRO ---
const firebaseConfig = {
  apiKey: "AIzaSyDXhvynS5M5kPN_5exuO0TRbsKwe9l7mzI",
  authDomain: "punchworkpro.firebaseapp.com",
  projectId: "punchworkpro",
  storageBucket: "punchworkpro.firebasestorage.app",
  messagingSenderId: "749450545932",
  appId: "1:749450545932:web:d41d3a2cc23b1b26b69729"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

if (db) {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistance Firestore : plusieurs onglets ouverts.");
    } else if (err.code === 'unimplemented') {
      console.warn("Persistance Firestore non supportée.");
    }
  });
}

let currentUser = null;

function updateAuthUI(user) {
  const btnLogin = document.getElementById('btnGoogleLogin');
  const userProfile = document.getElementById('userProfile');
  const userName = document.getElementById('userDisplayName');
  const syncBadge = document.getElementById('syncStatusBadge') || document.querySelector('.badge-sync');

  if (user) {
    if (btnLogin) btnLogin.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    if (userName) userName.textContent = user.displayName || user.email;

    if (syncBadge) {
      syncBadge.innerHTML = '☁️ Cloud (Synchronisé)';
      syncBadge.style.color = '#4ade80';
    }
  } else {
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (userProfile) userProfile.style.display = 'none';

    if (syncBadge) {
      syncBadge.innerHTML = '💾 Local (Appareil)';
      syncBadge.style.color = '';
    }
  }
}
window.updateAuthUI = updateAuthUI;

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    updateAuthUI(user);

    if (user) {
      await loadShiftsFromCloud();
    }
  });

  auth.getRedirectResult().catch((error) => {
    console.error("Erreur redirection Google Auth :", error);
  });
}

function loginWithGoogle() {
  if (!auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    console.warn("Popup bloquée ou fermée, passage en redirection...", error.code);
    auth.signInWithRedirect(provider);
  });
}
window.loginWithGoogle = loginWithGoogle;

function logoutUser() {
  if (!auth) return;
  auth.signOut().then(() => {
    currentUser = null;
    updateAuthUI(null);
    if (typeof refreshPunchUI === 'function') refreshPunchUI();
  }).catch((err) => {
    console.error("Erreur lors de la déconnexion :", err);
  });
}
window.logoutUser = logoutUser;

// Fusion intelligente entre les quarts locaux et les quarts Cloud Firestore
async function loadShiftsFromCloud() {
  const user = (auth && auth.currentUser) || currentUser;
  if (!user || !db) return;

  try {
    const snapshot = await db.collection('users').doc(user.uid).collection('shifts').get();
    const cloudMap = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.id) {
        cloudMap.set(String(data.id), data);
      }
    });

    const localLogs = JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY) || '[]');
    const mergedMap = new Map(cloudMap);

    // Pousser vers le Cloud les quarts créés hors-ligne qui ne sont pas encore sur Firestore
    for (const localShift of localLogs) {
      if (localShift && localShift.id) {
        const key = String(localShift.id);
        if (!mergedMap.has(key)) {
          mergedMap.set(key, localShift);
          await saveShiftToCloud(localShift);
        }
      }
    }

    const mergedLogs = Array.from(mergedMap.values());
    mergedLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(mergedLogs));

    if (typeof render === 'function') render();
    if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
    if (typeof refreshPunchUI === 'function') refreshPunchUI();
  } catch (err) {
    console.error("Erreur lecture/fusion Firestore :", err);
  }
}
window.loadShiftsFromCloud = loadShiftsFromCloud;

async function saveShiftToCloud(shiftData) {
  const user = (auth && auth.currentUser) || currentUser;
  if (!user || !db || !shiftData) return;

  try {
    const docId = String(shiftData.id || Date.now());
    await db.collection('users').doc(user.uid).collection('shifts').doc(docId).set(shiftData, { merge: true });
  } catch (err) {
    console.error("Erreur écriture Firestore :", err);
  }
}
window.saveShiftToCloud = saveShiftToCloud;

async function deleteShiftFromCloud(shiftId) {
  const user = (auth && auth.currentUser) || currentUser;
  if (!user || !db || !shiftId) return;

  try {
    await db.collection('users').doc(user.uid).collection('shifts').doc(String(shiftId)).delete();
  } catch (err) {
    console.error("Erreur suppression Firestore :", err);
  }
}
window.deleteShiftFromCloud = deleteShiftFromCloud;

function bindAuthButtons() {
  const btnLogin = document.getElementById('btnGoogleLogin');
  const btnLogout = document.getElementById('btnGoogleLogout');

  if (btnLogin) {
    btnLogin.onclick = (e) => {
      e.preventDefault();
      loginWithGoogle();
    };
  }

  if (btnLogout) {
    btnLogout.onclick = (e) => {
      e.preventDefault();
      logoutUser();
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAuthButtons);
} else {
  bindAuthButtons();
}