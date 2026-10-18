// @ts-check
// Exposition : filtres ND, obturateur, gain, diaphragmes, conditions d'éclairage du stade.

export const ND_FILTERS = [
  { label: 'CLEAR', f: 1 }, { label: '1/4 (ND 0.6)', f: 1 / 4 }, { label: '1/8 (ND 0.9)', f: 1 / 8 }, { label: '1/16 (ND 1.2)', f: 1 / 16 }, { label: '1/64 (ND 1.8)', f: 1 / 64 },
];
export const SHUTTERS = [
  { label: 'OFF', v: 0 }, { label: '1/100', v: 100 }, { label: '1/250', v: 250 }, { label: '1/500', v: 500 }, { label: '1/1000', v: 1000 }, { label: '1/2000', v: 2000 },
];
export const GAINS = [-3, 0, 3, 6, 9, 12];
export const IRIS_STOPS = [1.4, 1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 22];

export const LIGHTING = {
  jour: { label: 'Après-midi ensoleillé', cct: 5600, desc: 'Soleil à 35° : une partie de la pelouse est à l\'ombre de la tribune. L\'ingé vision doit suivre l\'iris entre soleil et ombre.' },
  fin: { label: 'Fin de journée (soleil rasant)', cct: 3600, desc: 'Lumière chaude et rasante, grande ombre portée : contraste très fort.' },
  couvert: { label: 'Ciel couvert', cct: 6500, desc: 'Lumière douce et homogène, plus froide, environ 2 diaphragmes de moins qu\'en plein soleil.' },
  nuit: { label: 'Nuit – éclairage LED du stade', cct: 5700, desc: 'Éclairage de stade (environ 2000 lux) : environ 5 diaphragmes de moins qu\'en plein soleil.' },
};
