// =========================================================
// INTÉGRATION & PARSING AGENDRIX (AGENDRIX.JS)
// =========================================================

async function fetchAgendrixShifts() {
  const statusEl = document.getElementById('agendrixStatus');
  const btnRefresh = document.getElementById('btnRefreshAgendrix');
  const btnConfig = document.getElementById('btnConfigSync');
  const cfg = window.config || {};

  const urlInput = document.getElementById('cfgAgendrixUrl');
  const targetUrl = (urlInput && urlInput.value.trim()) ? urlInput.value.trim() : cfg.agendrixUrl;

  if (!targetUrl) {
    if (statusEl) statusEl.textContent = '⚠️ Aucune URL Agendrix configurée.';
    return;
  }

  cfg.agendrixUrl = targetUrl;
  if (typeof saveConfig === 'function') saveConfig(cfg);

  if (btnRefresh) btnRefresh.disabled = true;
  if (btnConfig) btnConfig.disabled = true;
  if (statusEl) {
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = '⏳ Téléchargement du calendrier Agendrix en cours...';
  }

  try {
    let icsData = null;

    // Tentative 1 : Accès direct
    try {
      const resp = await fetch(targetUrl);
      if (resp.ok) icsData = await resp.text();
    } catch (e) {
      // Restriction CORS normale sur navigateur
    }

    // Tentative 2 : Proxy CORS sécurisé
    if (!icsData) {
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);
      const respProxy = await fetch(proxyUrl);
      if (respProxy.ok) icsData = await respProxy.text();
    }

    if (!icsData) throw new Error("Impossible de récupérer les données du calendrier.");

    const parsedShifts = parseICS(icsData);
    saveAgendrixCache(parsedShifts);
    renderAgendrixCalendar(parsedShifts);
    updateTodayShiftWidget(parsedShifts);
    if (typeof render === 'function') render();

    if (statusEl) {
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = `✅ Calendrier synchronisé : ${parsedShifts.length} quarts importés avec succès.`;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = `❌ Erreur : ${err.message}. Vous pouvez importer le fichier .ics manuellement.`;
    }
  } finally {
    if (btnRefresh) btnRefresh.disabled = false;
    if (btnConfig) btnConfig.disabled = false;
  }
}
window.fetchAgendrixShifts = fetchAgendrixShifts;

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
      if (typeof render === 'function') render();

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
window.handleICSFile = handleICSFile;

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

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
window.parseICS = parseICS;

function parseICalDateTime(line) {
  const parts = line.split(':');
  if (parts.length < 2) return null;
  const val = parts[1].trim();

  const y = val.substring(0, 4);
  const m = val.substring(4, 6);
  const d = val.substring(6, 8);

  let dateObj;
  if (val.includes('T')) {
    const hh = val.substring(9, 11);
    const mm = val.substring(11, 13);
    const ss = val.substring(13, 15) || '00';
    if (val.endsWith('Z')) {
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

function renderAgendrixCalendar(calendarData) {
  const container = document.getElementById('calendarDisplay');
  if (!container) return;

  if (!calendarData || calendarData.length === 0) {
    container.innerHTML = '<div style="color: var(--muted); font-size: 0.85rem; padding: 6px;">Aucun horaire chargé. Synchronisez dans Configuration.</div>';
    return;
  }

  const cfg = window.config || {};
  const todayStr = getTodayIsoDate();
  const pastLimit = Number(cfg.calPastShifts ?? 5);
  const futureLimit = Number(cfg.calFutureShifts ?? 15);

  const pastShifts = pastLimit > 0 ? calendarData.filter(s => s.date < todayStr).slice(-pastLimit) : [];
  const futureShifts = futureLimit > 0 ? calendarData.filter(s => s.date >= todayStr).slice(0, futureLimit) : [];
  const visibleShifts = [...pastShifts, ...futureShifts];

  if (visibleShifts.length === 0) {
    container.innerHTML = '<div style="color: var(--muted); font-size: 0.85rem; padding: 6px;">Aucun quart de travail dans la plage sélectionnée.</div>';
    return;
  }

  let html = '';
  visibleShifts.forEach(shift => {
    const [y, m, d] = shift.date.split('-').map(Number);
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
window.renderAgendrixCalendar = renderAgendrixCalendar;

function updateTodayShiftWidget(calendarData) {
  const targetEl = document.getElementById('pwTodayShiftHours');
  const subEl = document.getElementById('pwTodayShiftSub');
  if (!targetEl) return;

  const cfg = window.config || {};
  const todayStr = getTodayIsoDate();
  const list = calendarData || loadAgendrixCache();
  const match = (list || []).find(s => s.date === todayStr);

  if (match) {
    targetEl.textContent = `${match.start} ➔ ${match.end}`;
    if (subEl) subEl.textContent = 'Horaire Agendrix détecté';
  } else {
    targetEl.textContent = `${cfg.defaultIn || '08:30'} ➔ ${cfg.defaultOut || '17:00'}`;
    if (subEl) subEl.textContent = 'Horaire habituel par défaut';
  }
}
window.updateTodayShiftWidget = updateTodayShiftWidget;

function selectShiftFromCalendar(date, start, end) {
  if (typeof switchTab === 'function') {
    switchTab('results', document.getElementById('navBtn-results'));
  }
  if (typeof cancelEditMode === 'function') {
    cancelEditMode();
  }

  const cfg = window.config || {};
  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');

  if (manDate) manDate.value = date;
  if (manIn) manIn.value = start;
  if (manOut) manOut.value = end;
  if (manPause) manPause.value = cfg.defaultPause || '30m';

  const manSection = document.getElementById('manualCardSection');
  if (manSection) manSection.scrollIntoView({ behavior: 'smooth' });
}
window.selectShiftFromCalendar = selectShiftFromCalendar;