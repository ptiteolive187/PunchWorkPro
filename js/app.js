// --- POINT D'ENTRÉE PRINCIPAL & NAVIGATION ---

// Navigation entre les onglets
function switchTab(tabName, clickedBtn) {
  // Masquer tous les onglets
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Désactiver tous les boutons de navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Activer l'onglet demandé
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Activer le bouton correspondant
  if (clickedBtn) {
    clickedBtn.classList.add('active');
  } else {
    const defaultBtn = document.getElementById(`navBtn-${tabName}`);
    if (defaultBtn) defaultBtn.classList.add('active');
  }

  // Actions spécifiques lors de l'ouverture d'un onglet
  if (tabName === 'results') {
    renderResults();
  } else if (tabName === 'schedule') {
    const cache = loadAgendrixCache();
    if (cache) renderAgendrixCalendar(cache);
  }
}

// Gestion des thèmes visuels
function applyTheme(themeChoice) {
  const body = document.body;
  if (themeChoice === 'dark') {
    body.classList.remove('light-theme');
  } else if (themeChoice === 'light') {
    body.classList.add('light-theme');
  } else {
    // Mode système automatique
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
    }
  }
}

function changeTheme(themeChoice) {
  config.theme = themeChoice;
  applyTheme(themeChoice);
}

// Écouteur en direct des changements de mode système de l'appareil
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (config.theme === 'system') {
    applyTheme('system');
  }
});

// Gestion de la visibilité des sections selon la configuration
function updateVisibility() {
  const showSched = document.getElementById('cfgShowScheduleTab')?.checked ?? true;
  const showHist = document.getElementById('cfgShowHistory')?.checked ?? true;
  const showMan = document.getElementById('cfgShowManual')?.checked ?? true;
  const showRem = document.getElementById('cfgShowDayRemaining')?.checked ?? true;

  const navSched = document.getElementById('navBtn-schedule');
  if (navSched) navSched.style.display = showSched ? 'flex' : 'none';

  const secHist = document.getElementById('historyCardSection');
  if (secHist) secHist.style.display = showHist ? 'block' : 'none';

  const secMan = document.getElementById('manualCardSection');
  if (secMan) secMan.style.display = showMan ? 'block' : 'none';
}

// Remplissage du formulaire de configuration avec les valeurs actuelles
function populateConfigUI() {
  const themeSel = document.getElementById('cfgTheme');
  if (themeSel) themeSel.value = config.theme || 'system';

  const defIn = document.getElementById('cfgDefaultIn');
  if (defIn) defIn.value = config.defaultIn || '08:30';

  const defOut = document.getElementById('cfgDefaultOut');
  if (defOut) defOut.value = config.defaultOut || '17:00';

  const defPause = document.getElementById('cfgDefaultPause');
  if (defPause) defPause.value = config.defaultPause || '30m';

  const agUrl = document.getElementById('cfgAgendrixUrl');
  if (agUrl) agUrl.value = config.agendrixUrl || '';

  const pastSh = document.getElementById('cfgCalPastShifts');
  if (pastSh) pastSh.value = config.calPastShifts ?? 5;

  const futSh = document.getElementById('cfgCalFutureShifts');
  if (futSh) futSh.value = config.calFutureShifts ?? 15;

  const cbSched = document.getElementById('cfgShowScheduleTab');
  if (cbSched) cbSched.checked = config.showScheduleTab ?? true;

  const cbHist = document.getElementById('cfgShowHistory');
  if (cbHist) cbHist.checked = config.showHistory ?? true;

  const cbMan = document.getElementById('cfgShowManual');
  if (cbMan) cbMan.checked = config.showManual ?? true;

  const cbRem = document.getElementById('cfgShowDayRemaining');
  if (cbRem) cbRem.checked = config.showDayRemaining ?? true;
}

// Sauvegarde des paramètres modifiés par l'utilisateur
function saveConfiguration() {
  config.theme = document.getElementById('cfgTheme').value;
  config.defaultIn = document.getElementById('cfgDefaultIn').value;
  config.defaultOut = document.getElementById('cfgDefaultOut').value;
  config.defaultPause = document.getElementById('cfgDefaultPause').value;
  config.agendrixUrl = document.getElementById('cfgAgendrixUrl').value.trim();
  config.calPastShifts = parseInt(document.getElementById('cfgCalPastShifts').value, 10) || 0;
  config.calFutureShifts = parseInt(document.getElementById('cfgCalFutureShifts').value, 10) || 15;

  config.showScheduleTab = document.getElementById('cfgShowScheduleTab').checked;
  config.showHistory = document.getElementById('cfgShowHistory').checked;
  config.showManual = document.getElementById('cfgShowManual').checked;
  config.showDayRemaining = document.getElementById('cfgShowDayRemaining').checked;

  saveConfig(config);
  applyTheme(config.theme);
  updateVisibility();

  // Actualisation des données d'affichage
  const cache = loadAgendrixCache();
  updateTodayShiftWidget(cache);
  renderResults();
  refreshPunchUI();

  alert('Configuration enregistrée avec succès !');
}


// Fonction de soumission manuelle d'un quart
function handleManualSubmit(e) {
  if (e) e.preventDefault();

  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');

  if (!manDate || !manIn || !manOut) return;

  const dateVal = manDate.value;
  const inVal = manIn.value;
  const outVal = manOut.value;
  const pauseVal = (manPause && manPause.value) ? manPause.value : "30m";

  // Calcul des secondes de travail
  const [inH, inM] = inVal.split(':').map(Number);
  const [outH, outM] = outVal.split(':').map(Number);
  const startSec = inH * 3600 + inM * 60;
  const endSec = outH * 3600 + outM * 60;
  const grossSec = Math.max(0, endSec - startSec);

  const pauseSec = (typeof parsePauseToSec === 'function') 
    ? parsePauseToSec(pauseVal) 
    : 1800;

  const actualNet = Math.max(0, grossSec - pauseSec);

  const currentLogs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  currentLogs.push({
    id: Date.now(),
    date: dateVal,
    in: inVal,
    out: outVal,
    pauseSeconds: pauseSec,
    actualNetSeconds: actualNet
  });

  currentLogs.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('shift_tracker_logs', JSON.stringify(currentLogs));

  if (typeof render === 'function') render();
  if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
  if (typeof resetManualToDefaults === 'function') resetManualToDefaults();

  alert('Quart de travail enregistré avec succès !');
}
window.handleManualSubmit = handleManualSubmit;

// Fonction de réinitialisation sécurisée du formulaire manuel
function resetManualToDefaults() {
  const defaultIn = (window.config && window.config.defaultIn) ? window.config.defaultIn : "08:30";
  const defaultOut = (window.config && window.config.defaultOut) ? window.config.defaultOut : "17:00";
  const defaultPause = (window.config && window.config.defaultPause) ? window.config.defaultPause : "30m";

  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');

  if (manDate) manDate.value = new Date().toISOString().split('T')[0];
  if (manIn) manIn.value = defaultIn;
  if (manOut) manOut.value = defaultOut;
  if (manPause) manPause.value = defaultPause;
}
window.resetManualToDefaults = resetManualToDefaults;

// INITIALISATION AU CHARGEMENT DE LA PAGE
document.addEventListener('DOMContentLoaded', () => {
  // 1. Appliquer le thème sauvegardé
  applyTheme(config.theme);

  // 2. Charger les valeurs dans l'écran de configuration
  populateConfigUI();
  updateVisibility();

  // 3. Initialiser les formulaires
  resetManualToDefaults();
  const manualForm = document.getElementById('manualEntryForm');
if (manualForm) {
  manualForm.addEventListener('submit', (e) => {
    if (typeof window.handleManualSubmit === 'function') {
      window.handleManualSubmit(e);
    }
  });
}

  // 4. Charger et afficher le calendrier Agendrix en cache
  const agendrixCache = loadAgendrixCache();
  if (agendrixCache && agendrixCache.length > 0) {
    renderAgendrixCalendar(agendrixCache);
    updateTodayShiftWidget(agendrixCache);
  } else {
    // Premier chargement automatique si URL configurée
    if (config.agendrixUrl) {
      fetchAgendrixShifts();
    }
  }

  // 5. Mettre à jour l'onglet Résultats
  renderResults();

  // 6. Lancer le moteur du chronomètre de pointage
  initPunchEngine();
});
