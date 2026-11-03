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

let currentUser = null;

// Écouteur en direct du statut de connexion
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const btnLogin = document.getElementById('btnGoogleLogin');
  const userProfile = document.getElementById('userProfile');
  const userName = document.getElementById('userDisplayName');

  if (user) {
    if (btnLogin) btnLogin.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    if (userName) userName.textContent = user.displayName || user.email;

    // Télécharger automatiquement les données de l'utilisateur depuis le Cloud
    await loadShiftsFromCloud();
  } else {
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (userProfile) userProfile.style.display = 'none';
  }
});

// Connexion Google
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    console.warn("Popup bloquée, basculement en redirection :", error);
    auth.signInWithRedirect(provider);
  });
}
window.loginWithGoogle = loginWithGoogle;

// Déconnexion
function logoutUser() {
  auth.signOut().then(() => {
    localStorage.removeItem('shift_tracker_logs');
    if (typeof renderResults === 'function') renderResults();
    if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
  });
}
window.logoutUser = logoutUser;

// Charger les quarts de travail depuis Firestore
async function loadShiftsFromCloud() {
  if (!currentUser) return;
  try {
    const snapshot = await db.collection('users').doc(currentUser.uid).collection('shifts').get();
    const loadedLogs = [];
    snapshot.forEach(doc => {
      loadedLogs.push(doc.data());
    });

    if (loadedLogs.length > 0) {
      loadedLogs.sort((a, b) => b.date.localeCompare(a.date));
      localStorage.setItem('shift_tracker_logs', JSON.stringify(loadedLogs));
      if (typeof renderResults === 'function') renderResults();
      if (typeof updatePunchWidgets === 'function') updatePunchWidgets();
    }
  } catch (err) {
    console.error("Erreur lecture Firestore :", err);
  }
}
window.loadShiftsFromCloud = loadShiftsFromCloud;

// Enregistrer ou mettre à jour un quart dans Firestore
async function saveShiftToCloud(shiftData) {
  if (!currentUser) return;
  try {
    const docId = String(shiftData.id || Date.now());
    await db.collection('users').doc(currentUser.uid).collection('shifts').doc(docId).set(shiftData);
  } catch (err) {
    console.error("Erreur écriture Firestore :", err);
  }
}
window.saveShiftToCloud = saveShiftToCloud;

// Lier les clics sur les boutons
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGoogleLogin')?.addEventListener('click', loginWithGoogle);
  document.getElementById('btnGoogleLogout')?.addEventListener('click', logoutUser);
});