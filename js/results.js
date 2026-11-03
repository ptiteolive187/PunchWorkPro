// ==========================================
// js/results.js - Rendu & Gestion des Résultats
// ==========================================

// État initial du verrou de sécurité
let isLocked = localStorage.getItem('safety_lock') !== 'false';

// ==========================================
// UTILITAIRES DE CONVERSION DE TEMPS
// ==========================================

function parsePauseToSec(str) {
  if (!str) return 1800;
  const s = String(str).trim().toLowerCase();
  if (s.includes('s') && !s.includes('m')) return parseInt(s, 10) || 0;
  if (s.includes('m')) {
    const p = s.split('m');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  return Math.round((parseFloat(s.replace(',', '.')) || 30) * 60);
}

function formatPauseTime(sec) {
  if (!sec || sec <= 0) return '0m';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getMonday(dStr) {
  const p = dStr.split('-');
  const d = new Date(p[0], p[1] - 1, p[2]);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getDayNameFr(dateStr) {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return dayNames[d.getDay()];
}

function getPrescribedDaySeconds(dateStr) {
  let inStr = (window.config && window.config.defaultIn) ? window.config.defaultIn : "08:30";
  let outStr = (window.config && window.config.defaultOut) ? window.config.defaultOut : "17:00";
  let pauseStr = (window.config && window.config.defaultPause) ? window.config.defaultPause : "30m";

  if (window.agendrixSchedule && window.agendrixSchedule[dateStr]) {
    inStr = window.agendrixSchedule[dateStr].in;
    outStr = window.agendrixSchedule[dateStr].out;
  }

  const [h1, m1] = inStr.split(':').map(Number);
  const [h2, m2] = outStr.split(':').map(Number);
  let span = (h2 * 3600 + m2 * 60) - (h1 * 3600 + m1 * 60);
  if (span < 0) span += 86400;
  return Math.max(0, span - parsePauseToSec(pauseStr));
}

// ==========================================
// CALCUL & AFFICHAGE DE L'HISTORIQUE (RENDER)
// ==========================================

function render() {
  const logsContainer = document.getElementById('logs');
  const resB = document.getElementById('resBankDisplay');
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');

  if (logsContainer) logsContainer.innerHTML = '';

  if (!logs || logs.length === 0) {
    if (logsContainer) {
      logsContainer.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 30px;">Aucun quart de travail enregistré.</div>';
    }
    if (resB) {
      resB.className = 'bank-val pos';
      resB.textContent = '+0h 00m';
    }
    return;
  }

  // Regroupement par semaine du lundi
  const weeks = {};
  logs.forEach(l => {
    const m = getMonday(l.date);
    if (!weeks[m]) weeks[m] = [];
    weeks[m].push(l);
  });

  const sortedMondays = Object.keys(weeks).sort((a, b) => b.localeCompare(a));
  let totalBankSec = 0;

  sortedMondays.forEach(monday => {
    let weekWork = 0;
    let weekTarget = 0;
    const daysCounted = new Set();

    weeks[monday].forEach(l => {
      const worked = (l.actualNetSeconds || 0);
      weekWork += worked;

      if (!daysCounted.has(l.date)) {
        weekTarget += getPrescribedDaySeconds(l.date);
        daysCounted.add(l.date);
      }
    });

    const delta = weekWork - weekTarget;
    totalBankSec += delta;

    if (logsContainer) {
    // Calcul du numéro de semaine ISO
    const weekHeader = document.createElement('div');
    weekHeader.className = 'results-week-title';
    weekHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 4px 10px; margin-top: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';

    // Formatage de la date du lundi
    const [my, mm, md] = monday.split('-').map(Number);
    const monthsFull = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthsFull[mm - 1];

    // Calculs décimaux de la semaine
    const wHours = (weekWork / 3600).toFixed(2);
    const targetHours = (weekTarget / 3600).toFixed(2);
    const dHours = (delta >= 0 ? '+' : '-') + (Math.abs(delta) / 3600).toFixed(2);
    const deltaColor = delta >= 0 ? 'var(--green)' : 'var(--red)';

    weekHeader.innerHTML = `
      <div style="font-weight: 800; font-size: 0.95rem; color: #ffffff; line-height: 1.25;">
        Semaine Du Lundi ${md}<br>${monthName}
      </div>
      <div style="text-align: right; line-height: 1.3;">
        <div style="font-weight: 800; font-size: 0.92rem; color: ${deltaColor};">
          ${wHours}h / Cible : ${targetHours}h
        </div>
        <div style="font-weight: 800; font-size: 0.88rem; color: ${deltaColor};">
          (${dHours}h)
        </div>
      </div>
    `;

    logsContainer.appendChild(weekHeader);

      // Tri des jours de la semaine du plus récent au plus ancien
      weeks[monday].sort((a, b) => b.date.localeCompare(a.date));

      weeks[monday].forEach(l => {
        const netSec = (l.actualNetSeconds || 0);
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.cssText = 'background: #0d131f; border: 1px solid #1c2738; border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';

        if (!isLocked) {
          card.style.cursor = 'pointer';
          card.onclick = (e) => {
            if (e.target.closest('.btn-card-action')) return;
            if (typeof editLog === 'function') editLog(l.id);
          };
        }

        const dayName = getDayNameFr(l.date);

        // Date abrégée : "30 Oct."
        const [y, m, d] = l.date.split('-').map(Number);
        const monthsShort = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
        const dateShortStr = `${d} ${monthsShort[m - 1]}`;
        const pauseLabel = formatPauseTime(l.pauseSeconds);

        const targetSec = getPrescribedDaySeconds(l.date);
        const diffSec = netSec - targetSec;

        // Calcul du solde affiché en texte simple (+0h 07m / -0h 15m)
        const diffMin = Math.round(diffSec / 60);
        const absM = Math.abs(diffMin);
        const bH = Math.floor(absM / 60);
        const bM = absM % 60;
        const balanceSign = diffMin >= 0 ? '+' : '-';
        const balanceText = `${balanceSign}${bH}h ${String(bM).padStart(2, '0')}m`;
        const balanceColor = diffMin >= 0 ? 'var(--green)' : 'var(--red)';

        card.innerHTML = `
          <!-- Bloc de Gauche -->
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="font-weight: 800; font-size: 1.05rem; color: #ffffff;">${dayName}</div>
            <div style="font-size: 0.80rem; color: #7f93aa; font-weight: 500;">
              ${dateShortStr} • ${l.in} ➔ ${l.out}
            </div>
            <div style="font-size: 0.75rem; color: #7f93aa;">
              Pause : ${pauseLabel}
            </div>
          </div>

          <!-- Bloc de Droite (Heures, Cible, Solde sans badge) -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="text-align: right; display: flex; flex-direction: column; gap: 3px;">
              <div style="font-weight: 800; font-size: 0.98rem; color: #38bdf8; letter-spacing: -0.01em;">
                ${l.in} - ${l.out}
              </div>
              <div style="font-size: 0.78rem; color: #7f93aa; font-weight: 500;">
                Cible : ${(targetSec / 3600).toFixed(2)}h
              </div>
              <div style="font-weight: 800; font-size: 0.88rem; color: ${balanceColor};">
                ${balanceText}
              </div>
            </div>

            ${!isLocked ? `
              <div style="display: flex; flex-direction: column; gap: 4px; margin-left: 4px;">
                <button class="btn-card-action" style="color: var(--blue);" onclick="editLog(${l.id})">✏️</button>
                <button class="btn-card-action" style="color: var(--red);" onclick="delLog(${l.id})">✕</button>
              </div>
            ` : ''}
          </div>
        `;

        logsContainer.appendChild(card);
      });
    }
  });

  // Calcul du solde cumulé global en haut
  const bH = Math.floor(Math.abs(totalBankSec) / 3600);
  const bM = Math.floor((Math.abs(totalBankSec) % 3600) / 60);
  const sign = totalBankSec >= 0 ? '+' : '-';

  if (resB) {
    resB.className = `bank-val ${totalBankSec >= 0 ? 'pos' : 'neg'}`;
    resB.textContent = `${sign}${bH}h ${bM.toString().padStart(2, '0')}m`;
  }

  if (typeof updatePunchWidgets === 'function') {
    updatePunchWidgets();
  }
}

// ==========================================
// VERROUILLAGE / DÉVERROUILLAGE
// ==========================================

function toggleSafetyLock() {
  isLocked = !isLocked;
  localStorage.setItem('safety_lock', isLocked);
  const lockIcon = document.getElementById('lockIcon');
  const lockText = document.getElementById('lockText');
  if (lockIcon) lockIcon.textContent = isLocked ? '🔒' : '🔓';
  if (lockText) lockText.textContent = isLocked ? 'Verrouillé' : 'Déverrouillé';
  render();
}

// ==========================================
// ÉDITION & SUPPRESSION DES QUARTS
// ==========================================

function editLog(id) {
  if (isLocked) return;
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  const l = logs.find(x => Number(x.id) === Number(id));
  if (!l) return;

  const manSection = document.getElementById('manualCardSection');
  if (manSection) manSection.style.display = 'block';

  const editId = document.getElementById('editId');
  const manDate = document.getElementById('manDate');
  const manIn = document.getElementById('manIn');
  const manOut = document.getElementById('manOut');
  const manPause = document.getElementById('manPause');
  const manHeader = document.getElementById('manualFormHeader');
  const submitBtn = document.getElementById('btnSubmitShift');
  const cancelBtn = document.getElementById('cancelEditBtn');

  if (editId) editId.value = String(l.id);
  if (manDate) manDate.value = l.date;
  if (manIn) manIn.value = l.in;
  if (manOut) manOut.value = l.out;
  if (manPause) manPause.value = formatPauseTime(l.pauseSeconds);

  if (manHeader) manHeader.textContent = "Modification du quart";
  if (submitBtn) {
    submitBtn.textContent = "Appliquer la modification";
    submitBtn.className = "btn-action-main btn-action-modify";
  }
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  if (manSection) manSection.scrollIntoView({ behavior: 'smooth' });
}

function delLog(id) {
  if (isLocked) return;
  if (!confirm('Supprimer ce quart de travail ?')) return;

  let logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  logs = logs.filter(x => Number(x.id) !== Number(id));
  localStorage.setItem('shift_tracker_logs', JSON.stringify(logs));

  if (typeof cancelEditMode === 'function') cancelEditMode();
  render();
}

// ==========================================
// IMPORTATION CSV (Précision Seconde & Centésimal)
// ==========================================

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const rawLines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);

      if (rawLines.length < 2) {
        alert("Fichier CSV vide ou incomplet.");
        return;
      }

      const firstLine = rawLines[0];
      const delimiter = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
      const headers = firstLine.split(delimiter).map(h => h.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase());

      let idxDate = headers.findIndex(h => h.includes('date'));
      let idxIn = headers.findIndex(h => h.includes('arrive') || h.includes('in') || h.includes('debut'));
      let idxOut = headers.findIndex(h => h.includes('depart') || h.includes('out') || h.includes('fin'));
      let idxPause = headers.findIndex(h => h.includes('pause'));

      if (idxDate === -1) idxDate = 0;
      if (idxIn === -1) idxIn = 1;
      if (idxOut === -1) idxOut = 2;
      if (idxPause === -1) idxPause = 3;

      let logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');

      const replaceAll = confirm("Voulez-vous remplacer TOUT l'historique actuel par celui du fichier CSV ?\n\n• OK = Remplacement complet (recommandé)\n• Annuler = Fusionner les quarts");

      if (replaceAll) {
        logs = [];
      }

      let importedCount = 0;
      let updatedCount = 0;

      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) continue;

        const cols = line.split(delimiter).map(c => c.replace(/^["'\s]+|["'\s]+$/g, '').trim());
        const shiftDate = cols[idxDate];
        const shiftIn = cols[idxIn];
        const shiftOut = cols[idxOut];
        const shiftPauseStr = (idxPause !== -1 && cols[idxPause]) ? cols[idxPause] : '30m';

        if (shiftDate && shiftIn && shiftOut) {
          const pauseSec = parsePauseToSec(shiftPauseStr);
          const [h1, m1] = shiftIn.split(':').map(Number);
          const [h2, m2] = shiftOut.split(':').map(Number);
          let span = (h2 * 3600 + m2 * 60) - (h1 * 3600 + m1 * 60);
          if (span < 0) span += 86400;
          const netSec = Math.max(0, span - pauseSec);

          const existingIndex = logs.findIndex(l => l.date === shiftDate);

          const shiftObj = {
            id: Date.now() + i,
            date: shiftDate,
            in: shiftIn,
            out: shiftOut,
            pauseSeconds: pauseSec,
            actualNetSeconds: netSec
          };

          if (existingIndex !== -1) {
            logs[existingIndex] = shiftObj;
            updatedCount++;
          } else {
            logs.push(shiftObj);
            importedCount++;
          }
        }
      }

      logs.sort((a, b) => b.date.localeCompare(a.date));
      localStorage.setItem('shift_tracker_logs', JSON.stringify(logs));

      render();

      alert(`Importation réussie !\n• ${importedCount} quart(s) ajouté(s)\n• ${updatedCount} quart(s) mis à jour\n\nSolde exact recalculé.`);
      event.target.value = '';

    } catch (err) {
      alert("Erreur lors de l'importation : " + err.message);
    }
  };

  reader.readAsText(file);
}

// ==========================================
// EXPORTATION CSV
// ==========================================

function exportCSV() {
  const logs = JSON.parse(localStorage.getItem('shift_tracker_logs') || '[]');
  if (!logs || !logs.length) {
    alert("Aucun quart enregistré à exporter.");
    return;
  }

  let csvContent = "Date,Arrivee,Depart,Pause,Net_Heures\n";
  logs.forEach(l => {
    const netH = ((l.actualNetSeconds || 0) / 3600).toFixed(2);
    const pauseStr = formatPauseTime(l.pauseSeconds);
    csvContent += `${l.date},${l.in},${l.out},"${pauseStr}",${netH}\n`;
  });

  const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `heures_travaillees_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// EXPOSITION GLOBALE (Pour index.html & app.js)
// ==========================================

window.render = render;
window.renderResults = render;
window.toggleSafetyLock = toggleSafetyLock;
window.editLog = editLog;
window.delLog = delLog;
window.importCSV = importCSV;
window.exportCSV = exportCSV;
window.parsePauseToSec = parsePauseToSec;
window.formatPauseTime = formatPauseTime;
window.getPrescribedDaySeconds = getPrescribedDaySeconds;