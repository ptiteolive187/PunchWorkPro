// =========================================================
// MOTEUR DU CHRONOMÈTRE & POINTAGE (PUNCH.JS)
// =========================================================

let punchInterval = null;

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

function formatSecToHMSLabel(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs}h ${padZero(mins)}m ${padZero(secs)}s`;
}

function getNowTimeStr() {
  const d = new Date();
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}

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

// --- HORLOGE & DATE EN DIRECT ---
function updateLiveClockAndDate() {
  const now = new Date();
  const clockEl = document.getElementById('liveClockDisplay');
  const dateEl = document.getElementById('punchLiveDate');

  if (clockEl) {
    clockEl.textContent = `${padZero(now.getHours())}:${padZero(now.getMinutes())}:${padZero(now.getSeconds())}`;
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('fr-CA', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    });
  }
}

// --- ACTIONS DE POINTAGE ---
function startWorkDay() {
  let st = getPunch();
  if (st && st.status !== 'stopped') return;

  const now = Date.now();
  const todayStr = typeof getTodayIsoDate === 'function' ? getTodayIsoDate() : new Date().toISOString().split('T')[0];

  st = {
    status: 'working',
    date: todayStr,
    timeIn: getNowTimeStr(),
    workStart: now,
    workedSec: 0,
    pauseStart: null,
    pauseSec: 0
  };

  setPunch(st);
  refreshPunchUI();
}

function togglePause() {
  const st = getPunch();
  if (!st || st.status === 'stopped') return;

  const now = Date.now();
  if (st.status === 'working') {
    st.workedSec = (st.workedSec || 0) + Math.floor((now - st.workStart) / 1000);
    st.workStart = null;
    st.pauseStart = now;
    st.status = 'paused';
  } else if (st.status === 'paused') {
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
  } else if (st.status === 'paused') {
    totalPause += Math.floor((now - st.pauseStart) / 1000);
  }

  const outStr = getNowTimeStr();
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');

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

  logs.push(newShift);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('shift_tracker_logs', JSON.stringify(logs));

  if (typeof window.saveShiftToCloud === 'function') {
    window.saveShiftToCloud(newShift);
  }

  setPunch(null);
  refreshPunchUI();
  if (typeof render === 'function') render();
}

// --- RAFRAÎCHISSEMENT VISUEL DU CHRONO & BANNIÈRES ---
function updateTimerDisplay() {
  updateLiveClockAndDate();

  const st = getPunch();
  const timerMain = document.getElementById('punchTimerDisplay');
  const pauseSub = document.getElementById('punchPauseDisplay');
  const dayRemBanner = document.getElementById('dayRemainingBanner');
  const dayRemTitle = document.getElementById('dayRemTitle');
  const dayRemTimer = document.getElementById('dayRemTimer');
  const dayRemSub = document.getElementById('dayRemSub');
  const returnBanner = document.getElementById('returnBanner');
  const returnRemText = document.getElementById('returnRemainingText');
  const returnTimeText = document.getElementById('returnTimeText');

  const cfg = window.config || {};
  const targetPauseStr = cfg.defaultPause || '30m';
  const targetPauseSec = typeof parsePauseToSec === 'function' ? parsePauseToSec(targetPauseStr) : 1800;

  if (!st || st.status === 'stopped') {
    if (timerMain) timerMain.textContent = '00:00:00';
    if (pauseSub) pauseSub.innerHTML = `Temps de pause : <strong>0m</strong> (sur ${targetPauseStr})`;
    if (dayRemBanner) dayRemBanner.style.display = 'none';
    if (returnBanner) returnBanner.style.display = 'none';
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
    const pLabel = typeof formatPauseTime === 'function' ? formatPauseTime(currentPause) : `${Math.floor(currentPause / 60)}m`;
    pauseSub.innerHTML = `Temps de pause : <strong>${pLabel}</strong> (sur ${targetPauseStr})`;
  }

  // 1. Bandeau Temps restant du jour
  const showRem = cfg.showDayRemaining ?? true;
  if (dayRemBanner) {
    if (showRem) {
      dayRemBanner.style.display = 'block';
      const targetWorkSec = typeof getPrescribedDaySeconds === 'function' ? getPrescribedDaySeconds(st.date) : (8 * 3600);
      const remainingWorkSec = targetWorkSec - currentWork;
      const unpaidPauseLeft = st.status === 'working' ? Math.max(0, targetPauseSec - currentPause) : 0;

      if (remainingWorkSec > 0) {
        dayRemBanner.style.background = 'rgba(56, 189, 248, 0.08)';
        dayRemBanner.style.border = '1px solid rgba(56, 189, 248, 0.25)';
        if (dayRemTitle) {
          dayRemTitle.textContent = '⏳ TEMPS RESTANT DU JOUR';
          dayRemTitle.style.color = 'var(--blue)';
        }
        if (dayRemTimer) dayRemTimer.textContent = formatSecToHMSLabel(remainingWorkSec);

        const estEndDate = new Date(now + (remainingWorkSec + unpaidPauseLeft) * 1000);
        const estEndStr = `${padZero(estEndDate.getHours())}:${padZero(estEndDate.getMinutes())}`;
        if (dayRemSub) dayRemSub.textContent = `Fin estimée à ${estEndStr} (cible ${(targetWorkSec / 3600).toFixed(2)}h)`;
      } else {
        const overtimeSec = Math.abs(remainingWorkSec);
        dayRemBanner.style.background = 'rgba(34, 197, 94, 0.12)';
        dayRemBanner.style.border = '1px solid rgba(34, 197, 94, 0.35)';
        if (dayRemTitle) {
          dayRemTitle.textContent = '✅ OBJECTIF DU JOUR ATTEINT';
          dayRemTitle.style.color = 'var(--green)';
        }
        if (dayRemTimer) dayRemTimer.textContent = `+${formatSecToHMSLabel(overtimeSec)}`;
        if (dayRemSub) dayRemSub.textContent = 'Temps supplémentaire accumulé dans la banque';
      }
    } else {
      dayRemBanner.style.display = 'none';
    }
  }

  // 2. Bannière Pause en cours
  if (returnBanner) {
    if (st.status === 'paused') {
      returnBanner.style.display = 'flex';
      const remPauseSec = targetPauseSec - currentPause;
      const expectedReturnDate = new Date((st.pauseStart || now) + Math.max(0, targetPauseSec - (st.pauseSec || 0)) * 1000);
      const returnStr = `${padZero(expectedReturnDate.getHours())}:${padZero(expectedReturnDate.getMinutes())}`;

      if (returnTimeText) returnTimeText.textContent = returnStr;

      if (remPauseSec >= 0) {
        returnBanner.classList.remove('overtime');
        const rm = Math.floor(remPauseSec / 60);
        const rs = remPauseSec % 60;
        if (returnRemText) returnRemText.textContent = `Pause restante : ${rm}m ${padZero(rs)}s`;
      } else {
        returnBanner.classList.add('overtime');
        const over = Math.abs(remPauseSec);
        const om = Math.floor(over / 60);
        const os = over % 60;
        if (returnRemText) returnRemText.textContent = `Pause dépassée de +${om}m ${padZero(os)}s`;
      }
    } else {
      returnBanner.style.display = 'none';
    }
  }
}

function refreshPunchUI() {
  const st = getPunch();
  const statusBadge = document.getElementById('punchStatusBadge');
  const btnStart = document.getElementById('btnStartDay');
  const btnPause = document.getElementById('btnTogglePause');
  const btnFinish = document.getElementById('btnFinishDay');
  const startSub = document.getElementById('startSub');
  const pauseTitle = document.getElementById('pauseBtnTitle');
  const pauseSub = document.getElementById('pauseBtnSub');
  const pauseIcon = document.getElementById('pauseBtnIcon');
  const storageBadge = document.getElementById('syncStatusBadge');

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
      statusBadge.textContent = '● HORS SERVICE';
      statusBadge.className = 'status-pill';
    }
    if (btnStart) {
      btnStart.disabled = false;
      if (startSub) startSub.textContent = "Punch IN à l'heure exacte";
    }
    if (btnPause) {
      btnPause.disabled = true;
      btnPause.className = 'btn-hero btn-pause';
      if (pauseTitle) pauseTitle.textContent = 'Prendre une pause';
      if (pauseSub) pauseSub.textContent = 'Gèle le travail & cumule la pause';
      if (pauseIcon) pauseIcon.textContent = '☕';
    }
    if (btnFinish) btnFinish.disabled = true;
  } else if (st.status === 'working') {
    if (statusBadge) {
      statusBadge.textContent = '● EN SERVICE';
      statusBadge.className = 'status-pill working';
    }
    if (btnStart) {
      btnStart.disabled = true;
      if (startSub) startSub.textContent = `Démarré à ${st.timeIn}`;
    }
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.className = 'btn-hero btn-pause';
      if (pauseTitle) pauseTitle.textContent = 'Prendre une pause';
      if (pauseSub) pauseSub.textContent = 'Gèle le travail & cumule la pause';
      if (pauseIcon) pauseIcon.textContent = '☕';
    }
    if (btnFinish) btnFinish.disabled = false;
  } else if (st.status === 'paused') {
    if (statusBadge) {
      statusBadge.textContent = '● EN PAUSE';
      statusBadge.className = 'status-pill paused';
    }
    if (btnStart) {
      btnStart.disabled = true;
      if (startSub) startSub.textContent = `Démarré à ${st.timeIn}`;
    }
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.className = 'btn-hero btn-resume';
      if (pauseTitle) pauseTitle.textContent = 'Reprendre le travail';
      if (pauseSub) pauseSub.textContent = 'Termine la pause & relance le chrono';
      if (pauseIcon) pauseIcon.textContent = '▶';
    }
    if (btnFinish) btnFinish.disabled = false;
  }

  updateTimerDisplay();
}

function startPunchTimer() {
  if (punchInterval) clearInterval(punchInterval);
  punchInterval = setInterval(updateTimerDisplay, 1000);
}

function updatePunchWidgets() {
  const bankDisplay = document.getElementById('punchBankDisplay');
  const totalBalanceSec = typeof calculateGlobalBankSeconds === 'function' ? calculateGlobalBankSeconds() : 0;

  if (bankDisplay) {
    const isPos = totalBalanceSec >= 0;
    const absMin = Math.round(Math.abs(totalBalanceSec) / 60);
    const hrs = Math.floor(absMin / 60);
    const mins = absMin % 60;
    const sign = isPos ? '+' : '-';

    bankDisplay.textContent = `${sign}${hrs}h ${padZero(mins)}m`;
    bankDisplay.className = `widget-val-main ${isPos ? 'pos' : 'neg'}`;
  }
}

function initPunchEngine() {
  startPunchTimer();
  refreshPunchUI();
  updatePunchWidgets();
  // Note : Aucun addEventListener redondant ici car les boutons utilisent onclick dans index.html
}

window.initPunchEngine = initPunchEngine;
window.refreshPunchUI = refreshPunchUI;
window.updatePunchWidgets = updatePunchWidgets;
window.updateTimerDisplay = updateTimerDisplay;
window.startWorkDay = startWorkDay;
window.togglePause = togglePause;
window.toggleWorkPause = togglePause;
window.finishWorkDay = finishWorkDay;
window.getPunch = getPunch;
window.setPunch = setPunch;