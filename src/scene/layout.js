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
  [-34.5, 79, 13, 26, 46],
  // Côté est
  [34.5, -42, 13, 32, 76],
  [34.5, -10, 13, 28, 96],
  [34.5, 20, 13, 26, 60],
  [34.5, 50, 13, 24, 66],
  [34.5, 78, 13, 24, 72],
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

// --- Géométrie du sol praticable -----------------------------------------------

// La rue file le long de Z ; les trottoirs (h 0,5) bordent la chaussée.
// zMin déborde volontairement des WORLD_BOUNDS : le décor continue derrière
// la tour, mais le joueur n'y va pas.
export const STREET = { roadHalf: 13.5, sidewalkOuter: 27.5, zMin: -105, zMax: 95 };

// Parvis devant la tour (h 0,4) et marches rouges montables (façon TKTS).
export const PLAZA = { xHalf: 17, zMin: -64, zMax: -46 };
export const STEPS = { xHalf: 8.5, startZ: -47.5, depth: 1.15, count: 11, baseY: 0.65, stepH: 0.5 };

// Le parc au bout de l'avenue : pelouse, étang, chemin sinueux.
export const PARK = {
  xMin: -68, xMax: 68, zMin: 98, zMax: 188,
  pond: { x: 18, z: 150, r: 12 },
  // Chemin : x = pathX(z), praticable partout mais guide la promenade
  pathX: (z) => Math.sin((z - 98) * 0.075) * 9 - 4,
};

// Limites du monde pour le joueur et la caméra — affleurent les faces
// intérieures des haies du parc (x ±67,8 ; z 188,15) pour éviter tout mur
// invisible avant l'obstacle visible.
export const WORLD_BOUNDS = { xMin: -67.3, xMax: 67.3, zMin: -86, zMax: 187.6 };
