// =========================================================
// SYNCHRONISATION CLOUD & AUTHENTIFICATION (STORAGE.JS)
// =========================================================

// Configuration Firebase PunchWorkPro
const firebaseConfig = {
  apiKey: "AIzaSyDXhvynS5M5kPN_5exuO0TRbsKwe9l7mzI",
  authDomain: "punchworkpro.firebaseapp.com",
  projectId: "punchworkpro",
  storageBucket: "punchworkpro.firebasestorage.app",
  messagingSenderId: "749450545932",
  appId: "1:749450545932:web:d41d3a2cc23b1b26b69729"
};

// Initialisation de Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Activer le cache hors ligne local pour Firestore
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistance Firestore : plusieurs onglets ouverts en même temps.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistance Firestore non supportée par ce navigateur.");
  }
});

let currentUser = null;

// Mise à jour visuelle du statut (Header et Badge chrono)
function updateAuthUI(user) {
  const btnLogin = document.getElementById('btnGoogleLogin');
  const userProfile = document.getElementById('userProfile');
  const userName = document.getElementById('userDisplayName');
  
  // Cherche le badge de stockage dans l'écran de pointage
  const syncBadge = document.querySelector('.badge-sync') || 
                    document.getElementById('syncStatusBadge') || 
                    document.querySelector('.status-pill');

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

// Écouteur en temps réel de l'état de connexion Firebase
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  updateAuthUI(user);

  if (user) {
    console.log("Connecté avec le compte :", user.email);
    await loadShiftsFromCloud();
  }
});

// Traitement du retour si la connexion a utilisé signInWithRedirect
auth.getRedirectResult().then((result) => {
  if (result && result.user) {
    console.log("Connexion réussie via redirection :", result.user.displayName);
  }
}).catch((error) => {
  console.error("Erreur de retour de redirection Google Auth :", error);
});

// Connexion Google (tente Popup d'abord, puis Redirection si bloquée)
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    console.warn("Popup bloquée ou fermée, passage en redirection...", error.code);
    auth.signInWithRedirect(provider);
  });
}
window.loginWithGoogle = loginWithGoogle;

// Déconnexion de l'utilisateur
function logoutUser() {
  auth.signOut().then(() => {
    localStorage.removeItem('shift_tracker_logs');
    updateAuthUI(null);
    if (typeof renderResults === 'function') renderResults();
    if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
    if (typeof refreshPunchUI === 'function') refreshPunchUI();
  }).catch((err) => {
    console.error("Erreur lors de la déconnexion :", err);
  });
}
window.logoutUser = logoutUser;

// Charger les quarts enregistrés dans Firestore
async function loadShiftsFromCloud() {
  const user = firebase.auth().currentUser || currentUser;
  if (!user) return;

  try {
    const snapshot = await db.collection('users').doc(user.uid).collection('shifts').get();
    const loadedLogs = [];
    snapshot.forEach(doc => {
      loadedLogs.push(doc.data());
    });

    if (loadedLogs.length > 0) {
      loadedLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      localStorage.setItem('shift_tracker_logs', JSON.stringify(loadedLogs));
      
      // Rafraîchir les interfaces
      if (typeof renderResults === 'function') renderResults();
      if (typeof render === 'function') render();
      if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
      if (typeof refreshPunchUI === 'function') refreshPunchUI();
    }
  } catch (err) {
    console.error("Erreur lecture Firestore :", err);
  }
}
window.loadShiftsFromCloud = loadShiftsFromCloud;

// Enregistrer ou modifier un quart dans Firestore
async function saveShiftToCloud(shiftData) {
  const user = firebase.auth().currentUser || currentUser;
  if (!user) {
    console.warn("Utilisateur non connecté : quart conservé uniquement en local.");
    return;
  }

  try {
    const docId = String(shiftData.id || Date.now());
    await db.collection('users').doc(user.uid).collection('shifts').doc(docId).set(shiftData, { merge: true });
    console.log("Quart synchronisé sur le Cloud Firestore avec succès :", docId);
  } catch (err) {
    console.error("Erreur écriture Firestore :", err);
  }
}
window.saveShiftToCloud = saveShiftToCloud;

// Supprimer un quart dans Firestore
async function deleteShiftFromCloud(shiftId) {
  const user = firebase.auth().currentUser || currentUser;
  if (!user || !shiftId) return;

  try {
    await db.collection('users').doc(user.uid).collection('shifts').doc(String(shiftId)).delete();
    console.log("Quart supprimé de Firestore :", shiftId);
  } catch (err) {
    console.error("Erreur suppression Firestore :", err);
  }
}
window.deleteShiftFromCloud = deleteShiftFromCloud;

// Attachement résistant des boutons d'authentification
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