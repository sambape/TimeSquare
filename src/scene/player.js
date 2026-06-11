// Le bonhomme : un new-yorkais low-poly en veste jaune taxi, bonnet rouge,
// animé en marche procédurale. Contrôles ZQSD/WASD (touches physiques, donc
// AZERTY et QWERTY confondus) + flèches, Maj pour courir, Espace pour sauter.
// La caméra orbite derrière lui (drag souris, molette pour la distance) et
// sait se laisser emprunter pour les focus cinématiques sur les écrans.

import * as THREE from 'three';
import { groundHeightAt } from './collision.js';

const WALK_SPEED = 4.4;
const RUN_SPEED = 8.5;
const GRAVITY = 26;
const JUMP_VELOCITY = 8.2;
const PLAYER_RADIUS = 0.45;
const STEP_UP_MAX = 0.65; // on monte une marche, pas un muret

// --- Construction du personnage ------------------------------------------------

function buildCharacter() {
  const group = new THREE.Group();

  // Légère auto-illumination : le personnage se lit dans la nuit sans
  // qu'une lumière proche ne brûle la veste sous le bloom.
  const jacket = new THREE.MeshStandardMaterial({
    color: 0xd9a514, roughness: 0.6, metalness: 0.05,
    emissive: 0xd9a514, emissiveIntensity: 0.28,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: 0x23263a, roughness: 0.8, emissive: 0x23263a, emissiveIntensity: 0.25,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xe8b58a, roughness: 0.7, emissive: 0xe8b58a, emissiveIntensity: 0.22,
  });
  const wool = new THREE.MeshStandardMaterial({
    color: 0xc0392b, roughness: 0.9, emissive: 0xc0392b, emissiveIntensity: 0.25,
  });
  const stripe = new THREE.MeshBasicMaterial({ color: 0x9fb8d8 });

  // Jambes — pivot à la hanche (géométrie décalée vers le bas)
  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.26);
  legGeo.translate(0, -0.39, 0);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.78, 0);
  const legR = new THREE.Mesh(legGeo.clone(), pants);
  legR.position.set(0.14, 0.78, 0);
  group.add(legL, legR);

  // Torse + liseré lumineux
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.36), jacket);
  torso.position.y = 1.09;
  group.add(torso);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.09, 0.38), stripe);
  band.position.y = 1.16;
  group.add(band);

  // Bras — pivot à l'épaule
  const armGeo = new THREE.BoxGeometry(0.17, 0.62, 0.2);
  armGeo.translate(0, -0.27, 0);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.41, 1.36, 0);
  const armR = new THREE.Mesh(armGeo.clone(), jacket);
  armR.position.set(0.41, 1.36, 0);
  group.add(armL, armR);

  // Tête, bonnet, yeux
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  head.position.y = 1.58;
  group.add(head);
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), wool);
  beanie.position.y = 1.64;
  group.add(beanie);
  const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0e6d8, roughness: 1 }));
  pompom.position.y = 1.86;
  group.add(pompom);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1208 });
  for (const sx of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), eyeMat);
    eye.position.set(sx, 1.6, 0.19);
    group.add(eye);
  }

  // Petite flaque de lumière chaude à ses pieds, très discrète
  const lantern = new THREE.PointLight(0xffe2bd, 1.1, 3.2, 2);
  lantern.position.set(0, 1.9, 0.5);
  group.add(lantern);

  return { group, legL, legR, armL, armR };
}

// --- Contrôleur ------------------------------------------------------------------

export function createPlayer(scene, camera, domElement, world) {
  const parts = buildCharacter();
  const player = parts.group;
  player.position.set(10, 0, 8); // bord de chaussée, hors des voies des taxis
  player.rotation.y = Math.PI; // face à la tour
  scene.add(player);

  // État physique
  const vel = new THREE.Vector3();
  let vy = 0;
  let onGround = true;
  let heading = Math.PI; // orientation visuelle du bonhomme
  let walkPhase = 0;

  // État caméra (orbite autour du joueur)
  let camYaw = 0; // azimut de la caméra autour du joueur ; 0 = derrière lui, regard vers -z
  let camPitch = 0.32;
  let camDist = 9.5;
  const camPos = new THREE.Vector3(2, 26, 72); // départ haut : travelling d'intro
  const camTargetSmooth = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, 1.9, 0));
  let focus = null; // { pos, target } pendant un focus cinématique

  // Entrées clavier — codes physiques : KeyW = Z sur AZERTY, W sur QWERTY
  const keys = new Set();
  const KEYMAP = {
    KeyW: 'fwd', ArrowUp: 'fwd',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'jump',
  };

  function onKey(e, down) {
    const action = KEYMAP[e.code];
    if (!action) return;
    // Ne pas voler les touches aux champs de saisie (studio pub…)
    if (down && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (down) keys.add(action);
    else keys.delete(action);
    if (action === 'jump' && down) e.preventDefault();
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  // Souris : drag pour orbiter, molette pour la distance
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  domElement.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    camYaw -= (e.clientX - lastX) * 0.0052;
    // Pitch négatif = caméra au ras du sol, regard levé vers les écrans
    camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - lastY) * 0.004, -0.95, 1.25);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDist = THREE.MathUtils.clamp(camDist * (1 + Math.sign(e.deltaY) * 0.09), 3.2, 26);
  }, { passive: false });

  // --- Boucle -------------------------------------------------------------------

  const camProbe = { x: 0, z: 0 };

  function update(dt, time) {
    // Direction demandée, dans le repère de la caméra
    let ix = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    let iz = (keys.has('back') ? 1 : 0) - (keys.has('fwd') ? 1 : 0);
    const moving = ix !== 0 || iz !== 0;

    const speed = keys.has('run') ? RUN_SPEED : WALK_SPEED;
    const target = new THREE.Vector3();
    if (moving) {
      const len = Math.hypot(ix, iz);
      ix /= len;
      iz /= len;
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // Avancer = s'éloigner de la caméra : fwd = (-sin, -cos), right = (cos, -sin)
      target.set(ix * cos + iz * sin, 0, -ix * sin + iz * cos).multiplyScalar(speed);
    }
    vel.lerp(target, 1 - Math.exp(-dt * 10));

    // Déplacement horizontal + collisions
    player.position.x += vel.x * dt;
    player.position.z += vel.z * dt;
    world.resolve(player.position, PLAYER_RADIUS);

    // Verticale : marches montées/descendues en douceur, gravité sinon
    const groundY = groundHeightAt(player.position.x, player.position.z);
    if (keys.has('jump') && onGround) {
      vy = JUMP_VELOCITY;
      onGround = false;
    }
    if (onGround) {
      const dy = groundY - player.position.y;
      if (Math.abs(dy) <= STEP_UP_MAX) {
        player.position.y = groundY; // marche montée ou descendue : on colle au sol
      } else if (dy < 0) {
        onGround = false; // bord d'un palier : chute
      } else {
        player.position.y = groundY; // garde-fou (la collision a normalement déjà bloqué)
      }
    }
    if (!onGround) {
      vy -= GRAVITY * dt;
      player.position.y += vy * dt;
      if (player.position.y <= groundY && vy <= 0) {
        player.position.y = groundY;
        vy = 0;
        onGround = true;
      }
    }

    // Orientation : le bonhomme regarde où il va
    const planarSpeed = Math.hypot(vel.x, vel.z);
    if (planarSpeed > 0.4) {
      const targetHeading = Math.atan2(vel.x, vel.z);
      let diff = targetHeading - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading += diff * Math.min(1, dt * 11);
      player.rotation.y = heading;
    }

    // Animation de marche procédurale
    const stride = planarSpeed / RUN_SPEED;
    walkPhase += dt * (4 + planarSpeed * 2.1);
    const swing = Math.sin(walkPhase) * 0.62 * Math.min(1, stride * 2.2);
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8;
    parts.armR.rotation.x = swing * 0.8;
    if (!onGround) {
      parts.armL.rotation.x = -1.4;
      parts.armR.rotation.x = -1.4;
      parts.legL.rotation.x = 0.5;
      parts.legR.rotation.x = -0.3;
    }
    // Respiration / rebond de pas
    const bob = onGround ? Math.abs(Math.sin(walkPhase)) * 0.05 * Math.min(1, stride * 2.2) : 0;
    const breathe = 1 + Math.sin(time * 1.7) * 0.006;
    player.scale.y = breathe;
    player.position.y += bob;

    // --- Caméra ---
    const lookTarget = focus
      ? focus.target
      : new THREE.Vector3(player.position.x, player.position.y + 1.9, player.position.z);
    // Pitch négatif : la caméra descend au ras du sol et le regard se lève —
    // la cible monte au-dessus du bonhomme, vers les écrans et le ciel.
    if (!focus && camPitch < 0) {
      lookTarget.y += -camPitch * camDist * 1.7;
    }

    let desired;
    if (focus) {
      desired = focus.pos;
    } else {
      desired = new THREE.Vector3(
        player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
        player.position.y + 1.9 + Math.sin(camPitch) * camDist,
        player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
      );
      // La caméra ne traverse pas les façades : si un mur coupe l'axe
      // joueur→caméra, elle se rapproche du joueur jusqu'à voir clair.
      const px = player.position.x;
      const pz = player.position.z;
      let t = 1;
      for (; t > 0.12; t -= 0.08) {
        if (world.circleFree(px + (desired.x - px) * t, pz + (desired.z - pz) * t, 0.55)) break;
      }
      desired.x = px + (desired.x - px) * t;
      desired.z = pz + (desired.z - pz) * t;
      desired.y = player.position.y + 1.9 + (desired.y - player.position.y - 1.9) * Math.max(t, 0.45);
      // Filet de sécurité : poussée hors des volumes + plancher
      camProbe.x = desired.x;
      camProbe.z = desired.z;
      world.resolve(camProbe, 0.5);
      desired.x = camProbe.x;
      desired.z = camProbe.z;
      const camGround = groundHeightAt(desired.x, desired.z);
      desired.y = Math.max(desired.y, camGround + 0.7);
    }

    const k = 1 - Math.exp(-dt * (focus ? 2.6 : 7));
    camPos.lerp(desired, k);
    camTargetSmooth.lerp(lookTarget, 1 - Math.exp(-dt * (focus ? 2.6 : 9)));
    camera.position.copy(camPos);
    camera.lookAt(camTargetSmooth);

    return moving;
  }

  return {
    group: player,
    get position() { return player.position; },
    update,
    isFocused: () => focus !== null,
    setFocus(pos, target) { focus = { pos, target }; },
    clearFocus() { focus = null; },
    // Replace l'orbite derrière le bonhomme (bouton « recentrer »)
    resetCamera() {
      focus = null;
      camYaw = heading + Math.PI;
      camPitch = 0.32;
      camDist = 9.5;
    },
  };
}

export { PLAYER_RADIUS };
