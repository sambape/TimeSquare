// Disposition du square : la rue file le long de l'axe Z, la tour aux écrans
// incurvés (notre "One Times Square") ferme la perspective en z = -70.
// Chaque écran du marché est défini ici une seule fois ; le moteur 3D et la
// bourse partagent ces définitions.

export const SIZE_FACTORS = { XL: 1.0, L: 0.7, M: 0.45, S: 0.28 };
export const BASE_PRICES = { XL: 120, L: 80, M: 50, S: 30 };

const D90 = Math.PI / 2;
const D40 = (40 * Math.PI) / 180;

// Les places disponibles : Times Square est jouable, les suivantes arrivent.
export const VENUES = [
  { id: 'times-square', name: 'Times Square', city: 'New York', status: 'open' },
  { id: 'piccadilly', name: 'Piccadilly Circus', city: 'Londres', status: 'soon' },
  { id: 'chinatown', name: 'Chinatown', city: 'San Francisco', status: 'soon' },
];

export const BOARD_DEFS = [
  // --- La tour : trois écrans incurvés empilés, face à la place ---
  { id: 'ts-top',  name: 'TOUR · COURONNE',  size: 'XL', w: 12.6, h: 18,  position: [0, 64, -70], rotY: 0, curve: { radius: 9.2 } },
  { id: 'ts-mid',  name: 'TOUR · MÉDIANE',   size: 'XL', w: 12.6, h: 15,  position: [0, 46, -70], rotY: 0, curve: { radius: 9.2 } },
  { id: 'ts-low',  name: 'TOUR · PARVIS',    size: 'XL', w: 12.6, h: 22,  position: [0, 26, -70], rotY: 0, curve: { radius: 9.2 } },

  // --- Écrans d'angle incurvés, enroulés autour des immeubles du bowtie ---
  { id: 'bow-w',   name: 'BOWTIE OUEST',     size: 'L',  w: 14,  h: 10,   position: [-19.5, 18, -58.5], rotY: D40, curve: { radius: 7 } },
  { id: 'bow-e',   name: 'BOWTIE EST',       size: 'L',  w: 14,  h: 10,   position: [19.5, 18, -58.5],  rotY: -D40, curve: { radius: 7 } },

  // --- Façades ouest (x négatif, écrans tournés vers la rue) ---
  { id: 'w-mega',  name: 'OUEST · MEGA',     size: 'XL', w: 26, h: 15,    position: [-27.7, 31, -38], rotY: D90 },
  { id: 'w-duo',   name: 'OUEST · DUO',      size: 'M',  w: 16, h: 8,     position: [-27.7, 16, -38], rotY: D90 },
  { id: 'w-tower', name: 'OUEST · COLONNE',  size: 'L',  w: 12, h: 20,    position: [-27.7, 28, -8],  rotY: D90 },
  { id: 'w-strip', name: 'OUEST · RUBAN',    size: 'S',  w: 10, h: 5.5,   position: [-27.7, 11, -8],  rotY: D90 },
  { id: 'w-plaza', name: 'OUEST · PLAZA',    size: 'L',  w: 20, h: 11,    position: [-27.7, 24, 22],  rotY: D90 },

  // --- Façades est (x positif) ---
  { id: 'e-mega',  name: 'EST · MEGA',       size: 'XL', w: 28, h: 16,    position: [27.7, 30, -42], rotY: -D90 },
  { id: 'e-mini',  name: 'EST · CARRÉ',      size: 'M',  w: 13, h: 7,     position: [27.7, 14, -42], rotY: -D90 },
  { id: 'e-totem', name: 'EST · TOTEM',      size: 'L',  w: 14, h: 20,    position: [27.7, 31, -10], rotY: -D90 },
  { id: 'e-bloc',  name: 'EST · BLOC',       size: 'M',  w: 11, h: 9,     position: [27.7, 13.5, -10], rotY: -D90 },
  { id: 'e-night', name: 'EST · NOCTURNE',   size: 'L',  w: 18, h: 10,    position: [27.7, 26, 20],  rotY: -D90 },
  { id: 'e-pop',   name: 'EST · POP',        size: 'S',  w: 9,  h: 6.5,   position: [27.7, 11.5, 20], rotY: -D90 },
];

// Bandeau défilant des cours (pas un actif du marché, il LES affiche).
export const TICKER_DEF = { w: 20, h: 1.9, position: [-27.7, 6.5, 22], rotY: D90 };

// Immeubles du canyon : [centre x, centre z, largeur x, profondeur z, hauteur]
export const BUILDING_DEFS = [
  // Côté ouest
  [-34.5, -38, 13, 30, 64],
  [-34.5, -8, 13, 26, 84],
  [-34.5, 22, 13, 28, 56],
  [-34.5, 52, 13, 24, 70],
  // Côté est
  [34.5, -42, 13, 32, 76],
  [34.5, -10, 13, 28, 96],
  [34.5, 20, 13, 26, 60],
  [34.5, 50, 13, 24, 66],
  // Fond de place, derrière la tour
  [-22, -78, 20, 14, 52],
  [22, -78, 20, 14, 58],
];

// Immeubles d'angle inclinés qui portent les écrans "bowtie".
export const ANGLED_BUILDINGS = [
  { position: [-21.5, -60.5], rotY: D40, w: 11, d: 11, h: 46 },
  { position: [21.5, -60.5], rotY: -D40, w: 11, d: 11, h: 46 },
];

export const TOWER = { position: [0, -70], w: 13, d: 13, h: 88 };
