// @ts-check
// ----------------------------------------------------------------------------------
// Les comptes (v19.24) : le projet Firebase de l'établissement.
//
// Ces valeurs viennent de la console Firebase (Paramètres du projet → Vos applications → application
// Web → « Configuration du SDK »). Elles ne sont PAS secrètes : toute page web Firebase les publie, la
// sécurité vient des règles de Firestore (firestore.rules, à déployer) et de l'authentification. Tant
// qu'elles sont vides, le simulateur marche comme avant, sans compte (progression dans le navigateur).
// ----------------------------------------------------------------------------------
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/**
 * Domaine des adresses de connexion des élèves : un élève se connecte avec un identifiant
 * (« lea.martin »), le compte Firebase porte l'adresse « lea.martin@<domaine> ». Le domaine de
 * premier niveau « .invalid » est réservé (RFC 2606) : personne ne peut l'acheter, aucun courrier ne
 * part vers ces adresses (pas de réinitialisation de mot de passe détournée). Ne plus le changer une
 * fois des élèves créés : leurs identifiants ne marcheraient plus.
 */
export const DOMAINE_ELEVES = 'eleves.tiee-simulator.invalid';
