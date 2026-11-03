// =========================================================
// POINT D'ENTRÉE PRINCIPAL & NAVIGATION (APP.JS)
// =========================================================

// Configuration par défaut sécurisée si non initialisée
window.config = window.config || {
  theme: 'system',
  defaultIn: '08:30',
  defaultOut: '17:00',
  defaultPause: '30m',
  agendrixUrl: '',
  calPastShifts: 5,
  calFutureShifts: 15,
  showScheduleTab: true,
  showHistory: true,
  showManual: true,
  showDayRemaining: true
};

// --- GESTION DU THÈME ---
function applyTheme(themeChoice) {
  const body = document.body;
  if (!body) return;
  const choice = themeChoice || (window.config ? window.config.theme : 'system');

  if (choice === 'dark') {
    body.classList.remove('light-theme');
  } else if (choice === 'light') {
    body.classList.add('light-theme');
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
    }
  }
}
window.applyTheme = applyTheme;

function changeTheme(themeChoice) {
  if (window.config) window.config.theme = themeChoice;
  applyTheme(themeChoice);
}
window.changeTheme = changeTheme;

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (window.config && window.config.theme === 'system') {
      applyTheme('system');
    }
  });
}

// --- NAVIGATION ENTRE ONGLETS ---
function switchTab(tabName, clickedBtn) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  if (clickedBtn) {
    clickedBtn.classList.add('active');
  } else {
    const defaultBtn = document.getElementById(`navBtn-${tabName}`);
    if (defaultBtn) defaultBtn.classList.add('active');
  }

  if (tabName === 'results' && typeof renderResults === 'function') {
    renderResults();
  } else if (tabName === 'schedule') {
    if (typeof loadAgendrixCache === 'function' && typeof renderAgendrixCalendar === 'function') {
      const cache = loadAgendrixCache();
      if (cache) renderAgendrixCalendar(cache);
    }
  }
}
window.switchTab = switchTab;

// --- GESTION DE LA CONFIGURATION ---
function updateVisibility() {
  const showSched = document.getElementById('cfgShowScheduleTab')?.checked ?? true;
  const showHist = document.getElementById('cfgShowHistory')?.checked ?? true;
  const showMan = document.getElementById('cfgShowManual')?.checked ?? true;

  const navSched = document.getElementById('navBtn-schedule');
  if (navSched) navSched.style.display = showSched ? 'flex' : 'none';

  const secHist = document.getElementById('historyCardSection');
  if (secHist) secHist.style.display = showHist ? 'block' : 'none';

  const secMan = document.getElementById('manualCardSection');
  if (secMan) secMan.style.display = showMan ? 'block' : 'none';
}
window.updateVisibility = updateVisibility;

function populateConfigUI() {
  const cfg = window.config || {};
  const themeSel = document.getElementById('cfgTheme');
  if (themeSel) themeSel.value = cfg.theme || 'system';

  const defIn = document.getElementById('cfgDefaultIn');
  if (defIn) defIn.value = cfg.defaultIn || '08:30';

  const defOut = document.getElementById('cfgDefaultOut');
  if (defOut) defOut.value = cfg.defaultOut || '17:00';

  const defPause = document.getElementById('cfgDefaultPause');
  if (defPause) defPause.value = cfg.defaultPause || '30m';

  const agUrl = document.getElementById('cfgAgendrixUrl');
  if (agUrl) agUrl.value = cfg.agendrixUrl || '';

  const pastSh = document.getElementById('cfgCalPastShifts');
  if (pastSh) pastSh.value = cfg.calPastShifts ?? 5;

  const futSh = document.getElementById('cfgCalFutureShifts');
  if (futSh) futSh.value = cfg.calFutureShifts ?? 15;

  const cbSched = document.getElementById('cfgShowScheduleTab');
  if (cbSched) cbSched.checked = cfg.showScheduleTab ?? true;

  const cbHist = document.getElementById('cfgShowHistory');
  if (cbHist) cbHist.checked = cfg.showHistory ?? true;

  const cbMan = document.getElementById('cfgShowManual');
  if (cbMan) cbMan.checked = cfg.showManual ?? true;

  const cbRem = document.getElementById('cfgShowDayRemaining');
  if (cbRem) cbRem.checked = cfg.showDayRemaining ?? true;
}
window.populateConfigUI = populateConfigUI;

function saveConfiguration() {
  const cfg = window.config || {};
  cfg.theme = document.getElementById('cfgTheme')?.value || 'system';
  cfg.defaultIn = document.getElementById('cfgDefaultIn')?.value || '08:30';
  cfg.defaultOut = document.getElementById('cfgDefaultOut')?.value || '17:00';
  cfg.defaultPause = document.getElementById('cfgDefaultPause')?.value || '30m';
  cfg.agendrixUrl = document.getElementById('cfgAgendrixUrl')?.value.trim() || '';
  cfg.calPastShifts = parseInt(document.getElementById('cfgCalPastShifts')?.value, 10) || 5;
  cfg.calFutureShifts = parseInt(document.getElementById('cfgCalFutureShifts')?.value, 10) || 15;

  cfg.showScheduleTab = document.getElementById('cfgShowScheduleTab')?.checked ?? true;
  cfg.showHistory = document.getElementById('cfgShowHistory')?.checked ?? true;
  cfg.showManual = document.getElementById('cfgShowManual')?.checked ?? true;
  cfg.showDayRemaining = document.getElementById('cfgShowDayRemaining')?.checked ?? true;

  if (typeof saveConfig === 'function') {
    saveConfig(cfg);
  } else {
    localStorage.setItem('shift_tracker_config', JSON.stringify(cfg));
  }

  applyTheme(cfg.theme);
  updateVisibility();

  if (typeof loadAgendrixCache === 'function' && typeof updateTodayShiftWidget === 'function') {
    const cache = loadAgendrixCache();
    updateTodayShiftWidget(cache);
  }
  if (typeof renderResults === 'function') renderResults();
  if (typeof refreshPunchUI === 'function') refreshPunchUI();

  alert('Configuration enregistrée avec succès !');
}
window.saveConfiguration = saveConfiguration;

// --- GESTION DU FORMULAIRE MANUEL ---
function resetManualToDefaults() {
  const cfg = window.config || {};
  const dIn = cfg.defaultIn || "08:30";
  const dOut = cfg.defaultOut || "17:00";
  const dPause = cfg.defaultPause || "30m";

  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');

  if (manDate) manDate.value = new Date().toISOString().split('T')[0];
  if (manIn) manIn.value = dIn;
  if (manOut) manOut.value = dOut;
  if (manPause) manPause.value = dPause;
}
window.resetManualToDefaults = resetManualToDefaults;

function handleManualSubmit(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');

  if (!manDate || !manIn || !manOut) return;

  const dateVal = manDate.value;
  const inVal = manIn.value;
  const outVal = manOut.value;
  const pauseVal = (manPause && manPause.value) ? manPause.value : "30m";

  if (!dateVal || !inVal || !outVal) {
    alert('Veuillez remplir au moins la date, l\'heure d\'arrivée et l\'heure de départ.');
    return;
  }

  const [inH, inM] = inVal.split(':').map(Number);
  const [outH, outM] = outVal.split(':').map(Number);
  const startSec = (inH || 0) * 3600 + (inM || 0) * 60;
  const endSec = (outH || 0) * 3600 + (outM || 0) * 60;
  const grossSec = Math.max(0, endSec - startSec);

  const pauseSec = (typeof parsePauseToSec === 'function')
    ? parsePauseToSec(pauseVal)
    : 1800;

  const actualNet = Math.max(0, grossSec - pauseSec);

  const newShift = {
    id: Date.now(),
    date: dateVal,
    in: inVal,
    timeIn: inVal,
    out: outVal,
    timeOut: outVal,
    pauseSeconds: pauseSec,
    totalPause: pauseSec,
    actualNetSeconds: actualNet,
    workedSec: actualNet,
    source: 'manual'
  };

  const currentLogs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  currentLogs.push(newShift);
  currentLogs.sort((a, b) => b.date.localeCompare(a.date));

  // Sauvegarde locale
  localStorage.setItem('shift_tracker_logs', JSON.stringify(currentLogs));

  // Sauvegarde Cloud (Firestore)
  if (typeof window.saveShiftToCloud === 'function') {
    window.saveShiftToCloud(newShift);
  }

  if (typeof renderResults === 'function') renderResults();
  if (typeof render === 'function') render();
  if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
  resetManualToDefaults();

  alert('Quart de travail enregistré avec succès !');
}
window.handleManualSubmit = handleManualSubmit;

// --- INITIALISATION DOM ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Thème
  applyTheme(window.config ? window.config.theme : 'system');

  // 2. Écran de config et visibilité
  populateConfigUI();
  updateVisibility();

  // 3. Réinitialiser et lier le formulaire manuel
  resetManualToDefaults();
  const manualForm = document.getElementById('manualEntryForm');
  if (manualForm) {
    manualForm.onsubmit = function(e) {
      handleManualSubmit(e);
      return false;
    };
  }

  // 4. Calendrier Agendrix
  if (typeof loadAgendrixCache === 'function') {
    const agendrixCache = loadAgendrixCache();
    if (agendrixCache && agendrixCache.length > 0) {
      if (typeof renderAgendrixCalendar === 'function') renderAgendrixCalendar(agendrixCache);
      if (typeof updateTodayShiftWidget === 'function') updateTodayShiftWidget(agendrixCache);
    } else if (window.config && window.config.agendrixUrl && typeof fetchAgendrixShifts === 'function') {
      fetchAgendrixShifts();
    }
  }

  // 5. Résultats & Widgets
  if (typeof renderResults === 'function') renderResults();
  if (typeof updatePunchWidgets === 'function') updatePunchWidgets();

  // 6. Chronomètre
  if (typeof initPunchEngine === 'function') {
    initPunchEngine();
  }
});