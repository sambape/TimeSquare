// Point d'entrée : rendu Three.js (ACES + bloom), contrôles caméra avec
// focus cinématique sur les écrans, raycasting de sélection, et liaison
// scène ↔ bourse ↔ interface.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCity } from './scene/city.js';
import { createBillboards } from './scene/billboards.js';
import { createTraffic } from './scene/traffic.js';
import { createUI } from './ui/ui.js';
import { BOARD_DEFS } from './scene/layout.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);

const HOME_POS = new THREE.Vector3(14, 14, 48);
const HOME_TARGET = new THREE.Vector3(0, 22, -45);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 12;
controls.maxDistance = 140;
// L'auto-rotation sert de balancement contemplatif : la vitesse oscille en
// sinus (voir la boucle), la caméra ne fait donc jamais le tour du décor.
controls.autoRotate = true;

// --- Post-traitement ---------------------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55, // intensité
  0.65, // rayon
  0.72 // seuil : seuls les néons et écrans irradient
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- Monde -------------------------------------------------------------------

const city = createCity(scene);
const billboards = createBillboards(scene);
const traffic = createTraffic(scene);

// --- Focus caméra sur un écran -------------------------------------------------

let camTween = null;

function focusBoard(boardId) {
  const def = BOARD_DEFS.find((d) => d.id === boardId);
  if (!def) return;
  const target = new THREE.Vector3(...def.position);
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY);
  const dist = Math.max(def.w, def.h) * 1.9 + 8;
  const pos = target.clone().addScaledVector(normal, dist);
  pos.y = Math.max(6, target.y - def.h * 0.1);
  startTween(pos, target);
}

function resetCamera() {
  startTween(HOME_POS, HOME_TARGET);
}

function startTween(toPos, toTarget) {
  camTween = {
    t: 0,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos,
    toTarget,
  };
  controls.autoRotate = false;
}

function updateTween(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / 1.4);
  const e = 1 - Math.pow(1 - camTween.t, 3); // ease-out cubic
  camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
  controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
  if (camTween.t >= 1) camTween = null;
}

// --- UI ------------------------------------------------------------------------

const ui = createUI({ onFocusBoard: focusBoard, onResetCamera: resetCamera });

// --- Interaction 3D ---------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredBoard = null;
let pointerDownAt = null;

function pickBoard(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(billboards.meshes, false);
  return hits.length ? hits[0].object.userData.boardId : null;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  hoveredBoard = pickBoard(e.clientX, e.clientY);
  if (hoveredBoard) {
    ui.showTip(hoveredBoard, e.clientX, e.clientY);
    renderer.domElement.style.cursor = 'pointer';
  } else {
    ui.hideTip();
    renderer.domElement.style.cursor = 'grab';
  }
});

renderer.domElement.addEventListener('pointerleave', () => {
  hoveredBoard = null;
  ui.hideTip();
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownAt = [e.clientX, e.clientY];
  controls.autoRotate = false;
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

// Reprise de la rotation contemplative après 25 s d'inactivité
let idleTimer = null;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!camTween) controls.autoRotate = true;
  }, 25000);
}
['pointerdown', 'wheel', 'keydown'].forEach((ev) => window.addEventListener(ev, armIdle));
armIdle();

// --- Splash -------------------------------------------------------------------------

document.getElementById('enter-btn').addEventListener('click', () => {
  const splash = document.getElementById('splash');
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 900);
  // Petit travelling d'entrée
  camera.position.set(2, 6, 64);
  startTween(HOME_POS, HOME_TARGET);
});

// --- Boucle ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  updateTween(dt);
  controls.autoRotateSpeed = 0.5 * Math.sin(time * 0.13);
  controls.update();
  city.update(dt, time);
  billboards.update(dt, time);
  traffic.update(dt);

  composer.render();
});
