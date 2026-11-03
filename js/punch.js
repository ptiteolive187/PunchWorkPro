// =========================================================
// MOTEUR DU CHRONOMÈTRE & POINTAGE (PUNCH.JS)
// =========================================================

let punchInterval = null;

// Helpers utilitaires de formatage
function padZero(num) {
  return String(num).padStart(2, '0');
}

function formatSecToHHMMSS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${padZero(hrs)}:${padZero(mins)}:${padZero(secs)}`;
}

function getNowTimeStr() {
  const d = new Date();
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

// Récupération et écriture de l'état du punch
function getPunch() {
  try {
    return JSON.parse(localStorage.getItem('shift_tracker_punch_state'));
  } catch (e) {
    return null;
  }
}

function setPunch(state) {
  if (state === null) {
    localStorage.removeItem('shift_tracker_punch_state');
  } else {
    localStorage.setItem('shift_tracker_punch_state', JSON.stringify(state));
  }
}

// ---------------------------------------------------------
// ACTIONS DE POINTAGE
// ---------------------------------------------------------

function startWorkDay() {
  let st = getPunch();
  if (st && st.status !== 'stopped') return;

  const now = Date.now();
  st = {
    status: 'working',
    date: getTodayDateStr(),
    timeIn: getNowTimeStr(),
    workStart: now,
    workedSec: 0,
    pauseStart: null,
    pauseSec: 0
  };

  setPunch(st);
  refreshPunchUI();
  startPunchTimer();
}

function togglePause() {
  const st = getPunch();
  if (!st || st.status === 'stopped') return;

  const now = Date.now();
  if (st.status === 'working') {
    // Passage en pause
    st.workedSec = (st.workedSec || 0) + Math.floor((now - st.workStart) / 1000);
    st.workStart = null;
    st.pauseStart = now;
    st.status = 'paused';
  } else if (st.status === 'paused') {
    // Reprise du travail
    st.pauseSec = (st.pauseSec || 0) + Math.floor((now - st.pauseStart) / 1000);
    st.pauseStart = null;
    st.workStart = now;
    st.status = 'working';
  }

  setPunch(st);
  refreshPunchUI();
}

function finishWorkDay() {
  const st = getPunch();
  if (!st) return;
  if (!confirm('Voulez-vous terminer et enregistrer la journée ?')) return;

  const now = Date.now();
  let totalWork = st.workedSec || 0;
  let totalPause = st.pauseSec || 0;

  if (st.status === 'working') {
    totalWork += Math.floor((now - st.workStart) / 1000);
  } else {
    totalPause += Math.floor((now - st.pauseStart) / 1000);
  }

  const outStr = getNowTimeStr();
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');

  // Objet complet harmonisé pour Firestore et l'affichage des résultats
  const newShift = {
    id: Date.now(),
    date: st.date,
    in: st.timeIn,
    timeIn: st.timeIn,
    out: outStr,
    timeOut: outStr,
    pauseSeconds: totalPause,
    totalPause: totalPause,
    actualNetSeconds: totalWork,
    workedSec: totalWork,
    source: 'punch'
  };

  // 1. Sauvegarde locale
  logs.push(newShift);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('shift_tracker_logs', JSON.stringify(logs));

  // 2. Sauvegarde Cloud (Firestore) si connecté
  if (typeof window.saveShiftToCloud === 'function') {
    window.saveShiftToCloud(newShift);
  }

  // 3. Réinitialisation du punch et actualisation visuelle
  setPunch(null);
  stopPunchTimer();
  refreshPunchUI();
  updatePunchWidgets();

  if (typeof renderResults === 'function') renderResults();
  if (typeof render === 'function') render();
}

// ---------------------------------------------------------
// RAFRAÎCHISSEMENT VISUEL & CHRONOMÈTRE
// ---------------------------------------------------------

function updateTimerDisplay() {
  const st = getPunch();
  const timerMain = document.getElementById('punchTimerDisplay') || document.querySelector('.timer-main');
  const pauseSub = document.getElementById('punchPauseDisplay') || document.querySelector('.pause-sub');

  if (!st || st.status === 'stopped') {
    if (timerMain) timerMain.textContent = '00:00:00';
    if (pauseSub) pauseSub.textContent = 'Temps de pause : 0m (sur 30m)';
    return;
  }

  const now = Date.now();
  let currentWork = st.workedSec || 0;
  let currentPause = st.pauseSec || 0;

  if (st.status === 'working') {
    currentWork += Math.floor((now - st.workStart) / 1000);
  } else if (st.status === 'paused') {
    currentPause += Math.floor((now - st.pauseStart) / 1000);
  }

  if (timerMain) {
    timerMain.textContent = formatSecToHHMMSS(currentWork);
  }

  if (pauseSub) {
    const pauseMins = Math.floor(currentPause / 60);
    const targetPause = (window.config && window.config.defaultPause) ? window.config.defaultPause : '30m';
    pauseSub.textContent = `Temps de pause : ${pauseMins}m (sur ${targetPause})`;
  }
}

function refreshPunchUI() {
  const st = getPunch();
  const statusBadge = document.getElementById('punchStatusBadge') || document.querySelector('.status-pill');
  const btnStart = document.getElementById('btnStartDay');
  const btnPause = document.getElementById('btnTogglePause');
  const btnFinish = document.getElementById('btnFinishDay');

  // Gestion du badge Local / Cloud
  const storageBadge = document.getElementById('syncStatusBadge') || 
                       document.querySelector('.badge-sync') || 
                       document.getElementById('storageMode');

  const isCloud = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;

  if (storageBadge) {
    if (isCloud) {
      storageBadge.innerHTML = '☁️ Cloud (Synchronisé)';
      storageBadge.style.color = '#4ade80';
    } else {
      storageBadge.innerHTML = '💾 Local (Appareil)';
      storageBadge.style.color = '';
    }
  }

  if (!st || st.status === 'stopped') {
    if (statusBadge) {
      statusBadge.textContent = '• HORS SERVICE';
      statusBadge.style.background = '';
    }
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '1';
    }
    if (btnPause) {
      btnPause.disabled = true;
      btnPause.style.opacity = '0.5';
      btnPause.querySelector('.btn-title')?.replaceChildren('Prendre une pause');
    }
    if (btnFinish) {
      btnFinish.disabled = true;
      btnFinish.style.opacity = '0.5';
    }
  } else if (st.status === 'working') {
    if (statusBadge) {
      statusBadge.textContent = '• EN SERVICE';
      statusBadge.style.background = 'rgba(74, 222, 128, 0.2)';
    }
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.style.opacity = '0.5';
    }
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.style.opacity = '1';
      const title = btnPause.querySelector('.btn-title');
      if (title) title.textContent = 'Prendre une pause';
    }
    if (btnFinish) {
      btnFinish.disabled = false;
      btnFinish.style.opacity = '1';
    }
  } else if (st.status === 'paused') {
    if (statusBadge) {
      statusBadge.textContent = '• EN PAUSE';
      statusBadge.style.background = 'rgba(251, 191, 36, 0.2)';
    }
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.style.opacity = '0.5';
    }
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.style.opacity = '1';
      const title = btnPause.querySelector('.btn-title');
      if (title) title.textContent = 'Reprendre le travail';
    }
    if (btnFinish) {
      btnFinish.disabled = false;
      btnFinish.style.opacity = '1';
    }
  }

  updateTimerDisplay();
}

function startPunchTimer() {
  stopPunchTimer();
  punchInterval = setInterval(updateTimerDisplay, 1000);
}

function stopPunchTimer() {
  if (punchInterval) {
    clearInterval(punchInterval);
    punchInterval = null;
  }
}

// ---------------------------------------------------------
// WIDGETS DU TABLEAU DE BORD (PRÉVU & BANQUE)
// ---------------------------------------------------------

function updatePunchWidgets() {
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  const bankDisplay = document.getElementById('punchBankDisplay');

  // Calcul du solde cumulé de la banque d'heures
  let totalBalanceSec = 0;
  logs.forEach(log => {
    const net = log.actualNetSeconds ?? log.workedSec ?? 0;
    // Base standard de 8h (28800s) par quart
    const expected = 8 * 3600;
    totalBalanceSec += (net - expected);
  });

  if (bankDisplay) {
    const isPos = totalBalanceSec >= 0;
    const absSec = Math.abs(totalBalanceSec);
    const hrs = Math.floor(absSec / 3600);
    const mins = Math.floor((absSec % 3600) / 60);
    const sign = isPos ? '+' : '-';

    bankDisplay.textContent = `${sign}${hrs}h ${padZero(mins)}m`;
    bankDisplay.style.color = isPos ? '#4ade80' : '#f87171';
  }
}

function initPunchEngine() {
  const st = getPunch();
  if (st && (st.status === 'working' || st.status === 'paused')) {
    startPunchTimer();
  }
  refreshPunchUI();
  updatePunchWidgets();

  // Écouteurs de boutons
  document.getElementById('btnStartDay')?.addEventListener('click', startWorkDay);
  document.getElementById('btnTogglePause')?.addEventListener('click', togglePause);
  document.getElementById('btnFinishDay')?.addEventListener('click', finishWorkDay);
}

// Exposer globalement
window.initPunchEngine = initPunchEngine;
window.refreshPunchUI = refreshPunchUI;
window.updatePunchWidgets = updatePunchWidgets;
window.startWorkDay = startWorkDay;
window.togglePause = togglePause;
window.finishWorkDay = finishWorkDay;
window.getPunch = getPunch;
window.setPunch = setPunch;