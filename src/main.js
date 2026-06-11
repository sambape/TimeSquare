// Point d'entrée : rendu Three.js (ACES + bloom), exploration à la 3e
// personne (le bonhomme), collisions, focus cinématique sur les écrans,
// raycasting de sélection, et liaison scène ↔ bourse ↔ interface.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCity } from './scene/city.js';
import { createBillboards } from './scene/billboards.js';
import { createTraffic } from './scene/traffic.js';
import { createNature } from './scene/nature.js';
import { buildCollisionWorld } from './scene/collision.js';
import { createPlayer, PLAYER_RADIUS } from './scene/player.js';
import { createUI } from './ui/ui.js';
import { BOARD_DEFS } from './scene/layout.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'grab';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);

// --- Post-traitement ---------------------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42, // intensité : halo discret, pas de soupe néon
  0.55, // rayon
  0.78 // seuil : seuls les écrans, phares et guirlandes irradient
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- Monde -------------------------------------------------------------------

const world = buildCollisionWorld();
const city = createCity(scene, world);
const billboards = createBillboards(scene);
const traffic = createTraffic(scene);
const nature = createNature(scene, world);
const player = createPlayer(scene, camera, renderer.domElement, world);

// --- Focus caméra sur un écran -------------------------------------------------

function focusBoard(boardId) {
  const def = BOARD_DEFS.find((d) => d.id === boardId);
  if (!def) return;
  const target = new THREE.Vector3(...def.position);
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
  const dist = Math.max(def.w, def.h) * 1.9 + 8;
  const pos = target.clone().addScaledVector(normal, dist);
  pos.y = Math.max(6, target.y - def.h * 0.1);
  player.setFocus(pos, target);
}

// --- UI ------------------------------------------------------------------------

const ui = createUI({ onFocusBoard: focusBoard, onResetCamera: () => player.resetCamera(), player });

// --- Interaction 3D ---------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownAt = null;

function pickBoard(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(billboards.meshes, false);
  return hits.length ? hits[0].object.userData.boardId : null;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return; // en plein drag caméra : pas de tooltip
  const hovered = pickBoard(e.clientX, e.clientY);
  if (hovered) {
    ui.showTip(hovered, e.clientX, e.clientY);
    renderer.domElement.style.cursor = 'pointer';
  } else {
    ui.hideTip();
    renderer.domElement.style.cursor = 'grab';
  }
});

renderer.domElement.addEventListener('pointerleave', () => {
  ui.hideTip();
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownAt = [e.clientX, e.clientY];
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDownAt) return;
  const dx = e.clientX - pointerDownAt[0];
  const dy = e.clientY - pointerDownAt[1];
  pointerDownAt = null;
  if (dx * dx + dy * dy > 36) return; // c'était un drag, pas un clic
  const id = pickBoard(e.clientX, e.clientY);
  if (id) ui.selectBoard(id, true);
});

// --- Splash -------------------------------------------------------------------------

document.getElementById('enter-btn').addEventListener('click', () => {
  const splash = document.getElementById('splash');
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 900);
  document.getElementById('controls-hint')?.classList.add('visible');
});

// --- Boucle ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

// Poignée de debug (console navigateur)
window.__dbg = { camera, player };

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  const moving = player.update(dt, time);
  // Bouger rend la caméra au joueur si elle était sur un écran
  if (moving && player.isFocused()) player.clearFocus();
  traffic.pushPlayer(player.position, PLAYER_RADIUS);

  city.update(dt, time);
  billboards.update(dt, time);
  traffic.update(dt);
  nature.update(dt, time);

  composer.render();
});
