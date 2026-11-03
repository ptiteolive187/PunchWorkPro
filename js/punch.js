// =========================================================
// GESTION DU POINTAGE (PUNCH CLOCK)
// =========================================================

let punchTicker = null;

function getPunch() { 
  return JSON.parse(localStorage.getItem('punch_state') || 'null'); 
}

function setPunch(st) {
  if (!st) localStorage.removeItem('punch_state');
  else localStorage.setItem('punch_state', JSON.stringify(st));
}

function getNowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSec(sec) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Mise à jour des deux widgets du bas (Prévu aujourd'hui & Banque cumulée)
function updatePunchWidgets() {
  const today = new Date().toISOString().split('T')[0];
  const todayEl = document.getElementById('pwTodayShiftHours');
  const todaySubEl = document.getElementById('pwTodayShiftSub');

  const defaultIn = (window.config && window.config.defaultIn) ? window.config.defaultIn : "08:30";
  const defaultOut = (window.config && window.config.defaultOut) ? window.config.defaultOut : "17:00";

  if (window.agendrixSchedule && window.agendrixSchedule[today]) {
    if (todayEl) todayEl.textContent = `${window.agendrixSchedule[today].in} ➔ ${window.agendrixSchedule[today].out}`;
    if (todaySubEl) todaySubEl.textContent = "Planifié sur Agendrix";
  } else {
    if (todayEl) todayEl.textContent = `${defaultIn} ➔ ${defaultOut}`;
    if (todaySubEl) todaySubEl.textContent = "Horaire habituel par défaut";
  }

  // Calcul du solde cumulé pour le widget du bas
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  let totalBankSec = 0;
  const weeks = {};

  logs.forEach(l => {
    const p = l.date.split('-');
    const d = new Date(p[0], p[1] - 1, p[2]);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(d.setDate(diff)).toISOString().split('T')[0];
    if (!weeks[m]) weeks[m] = [];
    weeks[m].push(l);
  });

  Object.keys(weeks).forEach(monday => {
    let weekWork = 0;
    let weekTarget = 0;
    const daysCounted = new Set();

    weeks[monday].forEach(l => {
      weekWork += (l.actualNetSeconds || 0);
      if (!daysCounted.has(l.date)) {
        weekTarget += (typeof getPrescribedDaySeconds === 'function') 
          ? getPrescribedDaySeconds(l.date) 
          : 8 * 3600;
        daysCounted.add(l.date);
      }
    });
    totalBankSec += (weekWork - weekTarget);
  });

  const bH = Math.floor(Math.abs(totalBankSec) / 3600);
  const bM = Math.floor((Math.abs(totalBankSec) % 3600) / 60);
  const sign = totalBankSec >= 0 ? '+' : '-';

  const pwBank = document.getElementById('pwBankDisplay');
  const pwBankSub = document.getElementById('pwBankSub');
  if (pwBank) {
    pwBank.className = `widget-val-main ${totalBankSec >= 0 ? 'pos' : 'neg'}`;
    pwBank.textContent = `${sign}${bH}h ${bM.toString().padStart(2, '0')}m`;
  }
  if (pwBankSub) {
    pwBankSub.textContent = totalBankSec >= 0 ? "Solde cumulé en avance" : "Déficit à compenser";
  }
}

// Rafraîchissement complet de l'interface en direct
function refreshPunchUI() {
  const state = getPunch();
  const pill = document.getElementById('statusPill');
  const timer = document.getElementById('timerDisplay');
  const pauseDisp = document.getElementById('pauseDisplay');
  const returnBanner = document.getElementById('returnBanner');
  const returnTimeText = document.getElementById('returnTimeText');
  const returnRemainingText = document.getElementById('returnRemainingText');
  const bStart = document.getElementById('btnStart');
  const bPause = document.getElementById('btnPause');
  const bStop = document.getElementById('btnStop');
  const pTitle = document.getElementById('pauseBtnTitle');
  const pSub = document.getElementById('pauseBtnSub');
  const pIcon = document.getElementById('pauseBtnIcon');

  const defaultPauseText = (window.config && window.config.defaultPause) ? window.config.defaultPause : '30m';

  if (!state) {
    if (punchTicker) {
      clearInterval(punchTicker);
      punchTicker = null;
    }
    if (pill) {
      pill.className = 'status-pill';
      pill.textContent = '● HORS SERVICE';
    }
    if (timer) timer.textContent = '00:00:00';
    if (pauseDisp) pauseDisp.innerHTML = `Temps de pause : <strong>0m</strong> (sur ${defaultPauseText})`;
    if (returnBanner) returnBanner.style.display = 'none';

    const dayRemBanner = document.getElementById('dayRemainingBanner');
    if (dayRemBanner) dayRemBanner.style.display = 'none';

    if (bStart) bStart.disabled = false;
    if (bPause) {
      bPause.disabled = true;
      bPause.className = 'btn-hero btn-pause';
    }
    if (bStop) bStop.disabled = true;

    if (pTitle) pTitle.textContent = 'Prendre une pause';
    if (pSub) pSub.textContent = 'Gèle le travail & cumule la pause';
    if (pIcon) pIcon.textContent = '☕';
    return;
  }

  // --- En cours (Travail ou Pause) ---
  if (bStart) bStart.disabled = true;
  if (bStop) bStop.disabled = false;
  if (bPause) bPause.disabled = false;

  const now = Date.now();
  let worked = state.workedSec || 0;
  let pause = state.pauseSec || 0;

  if (state.status === 'working') {
    if (state.workStart) {
      worked += Math.floor((now - state.workStart) / 1000);
    }
    if (pill) {
      pill.className = 'status-pill working';
      pill.textContent = '● EN SERVICE';
    }
    if (returnBanner) returnBanner.style.display = 'none';

    if (bPause) bPause.className = 'btn-hero btn-pause';
    if (pTitle) pTitle.textContent = 'Prendre une pause';
    if (pSub) pSub.textContent = 'Gèle le chrono de travail';
    if (pIcon) pIcon.textContent = '☕';
  } else {
    if (state.pauseStart) {
      pause += Math.floor((now - state.pauseStart) / 1000);
    }
    if (pill) {
      pill.className = 'status-pill paused';
      pill.textContent = '❚❚ EN PAUSE';
    }

    if (state.expectedReturnTimestamp && returnBanner) {
      const remainingSec = Math.round((state.expectedReturnTimestamp - now) / 1000);

      if (remainingSec >= 0) {
        returnBanner.className = 'return-banner';
        const m = Math.floor(remainingSec / 60);
        const s = remainingSec % 60;
        if (returnRemainingText) returnRemainingText.textContent = `Temps restant : ${m}m ${s.toString().padStart(2, '0')}s`;
      } else {
        returnBanner.className = 'return-banner overtime';
        const overSec = Math.abs(remainingSec);
        const m = Math.floor(overSec / 60);
        const s = overSec % 60;
        if (returnRemainingText) returnRemainingText.textContent = `Pause dépassée de : ${m}m ${s.toString().padStart(2, '0')}s`;
      }

      if (returnTimeText) returnTimeText.textContent = state.expectedReturnTime || '--:--';
      returnBanner.style.display = 'flex';
    }

    if (bPause) bPause.className = 'btn-hero btn-resume';
    if (pTitle) pTitle.textContent = '▶ Reprendre le travail';
    if (pSub) pSub.textContent = 'Relance le chrono de travail';
    if (pIcon) pIcon.textContent = '▶';
  }

  if (timer) timer.textContent = formatSec(worked);
  if (pauseDisp) pauseDisp.innerHTML = `Temps de pause : <strong>${typeof formatPauseTime === 'function' ? formatPauseTime(pause) : pause + 's'}</strong> (sur ${defaultPauseText})`;

  // Bandeau optionnel temps restant
  try {
    const isEnabled = window.config ? (window.config.showDayRemaining ?? true) : true;
    const remBanner = document.getElementById('dayRemainingBanner');

    if (remBanner) {
      if (!isEnabled) {
        remBanner.style.display = 'none';
      } else {
        const targetSec = (typeof getPrescribedDaySeconds === 'function') 
          ? getPrescribedDaySeconds(state.date) 
          : 8 * 3600;
        const remSec = targetSec - worked;
        const remTitle = document.getElementById('dayRemTitle');
        const remTimer = document.getElementById('dayRemTimer');
        const remSub = document.getElementById('dayRemSub');

        remBanner.style.display = 'block';

        if (remSec > 0) {
          const rH = Math.floor(remSec / 3600);
          const rM = Math.floor((remSec % 3600) / 60);
          const rS = remSec % 60;

          remBanner.style.background = 'rgba(56, 189, 248, 0.12)';
          remBanner.style.borderColor = 'rgba(56, 189, 248, 0.4)';
          if (remTitle) {
            remTitle.style.color = 'var(--blue)';
            remTitle.textContent = '⏳ TEMPS RESTANT DU JOUR';
          }
          if (remTimer) {
            remTimer.textContent = `${rH}h ${String(rM).padStart(2, '0')}m ${String(rS).padStart(2, '0')}s`;
          }

          const expectedEndTimestamp = Date.now() + remSec * 1000;
          const endD = new Date(expectedEndTimestamp);
          const eh = String(endD.getHours()).padStart(2, '0');
          const em = String(endD.getMinutes()).padStart(2, '0');
          if (remSub) remSub.textContent = `Cible : ${(targetSec / 3600).toFixed(2)}h net • Fin estimée vers ${eh}:${em}`;
        } else {
          const overSec = Math.abs(remSec);
          const oH = Math.floor(overSec / 3600);
          const oM = Math.floor((overSec % 3600) / 60);
          const oS = overSec % 60;

          remBanner.style.background = 'rgba(34, 197, 94, 0.15)';
          remBanner.style.borderColor = 'rgba(34, 197, 94, 0.5)';
          if (remTitle) {
            remTitle.style.color = 'var(--green)';
            remTitle.textContent = '🎯 OBJECTIF ATTEINT (TEMPS SUPPLÉMENTAIRE)';
          }
          if (remTimer) {
            remTimer.textContent = `+${oH}h ${String(oM).padStart(2, '0')}m ${String(oS).padStart(2, '0')}s`;
          }
          if (remSub) remSub.textContent = "Le temps accumulé s'ajoute directement à votre banque !";
        }
      }
    }
  } catch (err) {
    console.error("Erreur bandeau:", err);
  }
}

// Démarrage de la journée
function startWorkDay() {
  const now = Date.now();
  const dStr = new Date().toISOString().split('T')[0];
  const inStr = getNowTimeStr();

  setPunch({
    status: 'working',
    date: dStr,
    timeIn: inStr,
    workedSec: 0,
    pauseSec: 0,
    workStart: now,
    pauseStart: null,
    expectedReturnTimestamp: null,
    expectedReturnTime: null
  });

  const manIn = document.getElementById('manIn');
  const manDate = document.getElementById('manDate');
  if (manIn) manIn.value = inStr;
  if (manDate) manDate.value = dStr;

  if (punchTicker) clearInterval(punchTicker);
  refreshPunchUI();
  punchTicker = setInterval(refreshPunchUI, 1000);
}

// Mise en pause / reprise
function toggleWorkPause() {
  const st = getPunch();
  if (!st) return;
  const now = Date.now();

  if (st.status === 'working') {
    st.workedSec = (st.workedSec || 0) + Math.floor((now - st.workStart) / 1000);
    st.workStart = null;
    st.pauseStart = now;
    st.status = 'paused';

    const defaultPauseStr = (window.config && window.config.defaultPause) ? window.config.defaultPause : "30m";
    const pauseDurationSec = (typeof parsePauseToSec === 'function') 
      ? parsePauseToSec(defaultPauseStr) 
      : 1800;
    const remainingSec = Math.max(0, pauseDurationSec - (st.pauseSec || 0));
    const returnTimestamp = now + remainingSec * 1000;
    const returnDate = new Date(returnTimestamp);
    const hh = String(returnDate.getHours()).padStart(2, '0');
    const mm = String(returnDate.getMinutes()).padStart(2, '0');

    st.expectedReturnTimestamp = returnTimestamp;
    st.expectedReturnTime = `${hh} h ${mm}`;
  } else {
    st.pauseSec = (st.pauseSec || 0) + Math.floor((now - st.pauseStart) / 1000);
    st.pauseStart = null;
    st.workStart = now;
    st.status = 'working';
    st.expectedReturnTimestamp = null;
    st.expectedReturnTime = null;
  }

  setPunch(st);
  refreshPunchUI();
}

// Fin de journée et enregistrement
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

  logs.push({
    id: Date.now(),
    date: st.date,
    in: st.timeIn,
    out: outStr,
    pauseSeconds: totalPause,
    actualNetSeconds: totalWork
  });

  logs.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('shift_tracker_logs', JSON.stringify(logs));

  setPunch(null);
  refreshPunchUI();
  updatePunchWidgets();

  if (typeof render === 'function') {
    render();
  }
}

// Initialisation au chargement de la page
if (getPunch()) {
  refreshPunchUI();
  if (punchTicker) clearInterval(punchTicker);
  punchTicker = setInterval(refreshPunchUI, 1000);
}

// Exposition globale
window.startWorkDay = startWorkDay;
window.toggleWorkPause = toggleWorkPause;
window.finishWorkDay = finishWorkDay;
window.refreshPunchUI = refreshPunchUI;
window.updatePunchWidgets = updatePunchWidgets;