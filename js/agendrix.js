// --- INTÉGRATION & PARSING AGENDRIX (iCal) ---

// Récupération des quarts via URL (avec proxy CORS de secours si nécessaire)
async function fetchAgendrixShifts() {
  const statusEl = document.getElementById('agendrixStatus');
  const btnRefresh = document.getElementById('btnRefreshAgendrix');
  const btnConfig = document.getElementById('btnConfigSync');

  if (!config.agendrixUrl) {
    if (statusEl) statusEl.textContent = '❌ Aucune URL Agendrix configurée.';
    return;
  }

  if (btnRefresh) btnRefresh.disabled = true;
  if (btnConfig) btnConfig.disabled = true;
  if (statusEl) statusEl.textContent = '🔄 Téléchargement du calendrier Agendrix en cours...';

  try {
    let icsData = null;

    // Tentative 1 : Accès direct
    try {
      const resp = await fetch(config.agendrixUrl);
      if (resp.ok) icsData = await resp.text();
    } catch (e) {
      // Échec direct (souvent dû aux restrictions CORS du navigateur)
    }

    // Tentative 2 : Passage par un proxy CORS sécurisé si le direct est bloqué
    if (!icsData) {
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(config.agendrixUrl);
      const respProxy = await fetch(proxyUrl);
      if (respProxy.ok) icsData = await respProxy.text();
    }

    if (!icsData) throw new Error("Impossible de récupérer les données du calendrier.");

    const parsedShifts = parseICS(icsData);
    saveAgendrixCache(parsedShifts);
    renderAgendrixCalendar(parsedShifts);
    updateTodayShiftWidget(parsedShifts);

    if (statusEl) {
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = `✅ Calendrier synchronisé : ${parsedShifts.length} quarts importés avec succès.`;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = `⚠️ Erreur : ${err.message}. Vous pouvez importer le fichier .ics manuellement.`;
    }
  } finally {
    if (btnRefresh) btnRefresh.disabled = false;
    if (btnConfig) btnConfig.disabled = false;
  }
}

// Importation locale d'un fichier .ics téléchargé
function handleICSFile(event) {
  const file = event.target.files[0];
  const statusEl = document.getElementById('agendrixStatus');
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsedShifts = parseICS(e.target.result);
      saveAgendrixCache(parsedShifts);
      renderAgendrixCalendar(parsedShifts);
      updateTodayShiftWidget(parsedShifts);

      if (statusEl) {
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = `✅ Fichier chargé localement : ${parsedShifts.length} quarts trouvés.`;
      }
    } catch (err) {
      if (statusEl) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = '❌ Échec de la lecture du fichier .ics.';
      }
    }
  };
  reader.readAsText(file);
}

// Analyse syntaxique du format iCalendar (VEVENT)
function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split(/\r\n|\n|\r/);
  let inEvent = false;
  let curStart = null;
  let curEnd = null;
  let curSummary = '';

  for (let line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      curStart = null;
      curEnd = null;
      curSummary = '';
    } else if (line.startsWith('END:VEVENT')) {
      if (inEvent && curStart && curEnd) {
        events.push({
          date: curStart.date,
          start: curStart.time,
          end: curEnd.time,
          summary: curSummary || 'Quart de travail'
        });
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        curStart = parseICalDateTime(line);
      } else if (line.startsWith('DTEND')) {
        curEnd = parseICalDateTime(line);
      } else if (line.startsWith('SUMMARY:')) {
        curSummary = line.substring(8).trim();
      }
    }
  }

  // Tri par date chronologique
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

// Décomposition date/heure depuis le format UTC ou Local iCal
function parseICalDateTime(line) {
  const parts = line.split(':');
  if (parts.length < 2) return null;
  let val = parts[1].trim();

  // Format type YYYYMMDDTHHMMSSZ
  const y = val.substring(0, 4);
  const m = val.substring(4, 6);
  const d = val.substring(6, 8);

  let dateObj;
  if (val.includes('T')) {
    const hh = val.substring(9, 11);
    const mm = val.substring(11, 13);
    const ss = val.substring(13, 15) || '00';

    if (val.endsWith('Z')) {
      // Date UTC convertie en heure locale de l'appareil
      dateObj = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
    } else {
      dateObj = new Date(+y, +m - 1, +d, +hh, +mm, +ss);
    }
  } else {
    dateObj = new Date(+y, +m - 1, +d);
  }

  const outYear = dateObj.getFullYear();
  const outMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
  const outDay = String(dateObj.getDate()).padStart(2, '0');
  const outH = String(dateObj.getHours()).padStart(2, '0');
  const outM = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    date: `${outYear}-${outMonth}-${outDay}`,
    time: `${outH}:${outM}`
  };
}

// Récupération de la cible d'heures nettes d'un jour donné (Agendrix ou par défaut)
function getPrescribedDaySeconds(dateStr) {
  const cache = loadAgendrixCache();
  const pauseSec = parsePauseToSec(config.defaultPause);

  if (cache && cache.length > 0) {
    const match = cache.find(s => s.date === dateStr);
    if (match) {
      const spanMin = parseTimeToMin(match.end) - parseTimeToMin(match.start);
      return Math.max(0, (spanMin * 60) - pauseSec);
    }
  }

  // Sinon fallback sur les horaires prescrits habituels
  const defaultSpanMin = parseTimeToMin(config.defaultOut) - parseTimeToMin(config.defaultIn);
  return Math.max(0, (defaultSpanMin * 60) - pauseSec);
}

// Rendu graphique de l'onglet Calendrier Agendrix
function renderAgendrixCalendar(calendarData) {
  const container = document.getElementById('calendarDisplay');
  if (!container) return;

  if (!calendarData || calendarData.length === 0) {
    container.innerHTML = '<div style="color: var(--muted); font-size: 0.85rem; padding: 6px;">Aucun horaire chargé. Synchronisez dans Configuration.</div>';
    return;
  }

  const todayStr = getTodayIsoDate();
  const pastLimit = Number(config.calPastShifts ?? 5);
  const futureLimit = Number(config.calFutureShifts ?? 15);

  const pastShifts = calendarData.filter(s => s.date < todayStr).slice(-pastLimit);
  const futureShifts = calendarData.filter(s => s.date >= todayStr).slice(0, futureLimit);
  const visibleShifts = [...pastShifts, ...futureShifts];

  if (visibleShifts.length === 0) {
    container.innerHTML = '<div style="color: var(--muted); font-size: 0.85rem; padding: 6px;">Aucun quart de travail dans la plage sélectionnée.</div>';
    return;
  }

  let html = '';
  visibleShifts.forEach(shift => {
    const [y, m, d] = shift.date.split('-');
    const shiftDateObj = new Date(y, m - 1, d);
    const dateFormatted = shiftDateObj.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    const isToday = shift.date === todayStr;

    html += `
      <div class="cal-day-card ${isToday ? 'is-today' : ''}" onclick="selectShiftFromCalendar('${shift.date}', '${shift.start}', '${shift.end}')">
        <div class="cal-date-label">
          <span>${dateFormatted}</span>
          ${isToday ? '<span class="badge-today">Aujourd\'hui</span>' : ''}
        </div>
        <div class="cal-hours-badge">
          ${shift.start} ➔ ${shift.end}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Mise à jour de l'aperçu "Prévu aujourd'hui" dans l'onglet Pointage
function updateTodayShiftWidget(calendarData) {
  const targetEl = document.getElementById('pwTodayShiftHours');
  const subEl = document.getElementById('pwTodayShiftSub');
  if (!targetEl) return;

  const todayStr = getTodayIsoDate();
  const match = (calendarData || []).find(s => s.date === todayStr);

  if (match) {
    targetEl.textContent = `${match.start} ➔ ${match.end}`;
    if (subEl) subEl.textContent = 'Horaire Agendrix détecté';
  } else {
    targetEl.textContent = `${config.defaultIn} ➔ ${config.defaultOut}`;
    if (subEl) subEl.textContent = 'Horaire habituel par défaut';
  }
}

// Préremplissage du formulaire manuel si l'on touche une carte du calendrier
function selectShiftFromCalendar(date, start, end) {
  switchTab('results', document.getElementById('navBtn-results'));
  document.getElementById('manDate').value = date;
  document.getElementById('manIn').value = start;
  document.getElementById('manOut').value = end;
  document.getElementById('manPause').value = config.defaultPause;
}
