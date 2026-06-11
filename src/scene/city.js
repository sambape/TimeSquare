// Le décor : canyon d'immeubles aux fenêtres allumées, tour emblématique,
// asphalte mouillé (miroir temps réel + couche d'asphalte à flaques),
// trottoirs, lampadaires, skyline lointaine et poussière lumineuse.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BUILDING_DEFS, ANGLED_BUILDINGS, TOWER, STREET, STEPS } from './layout.js';
import { makeDotTexture } from './nature.js';

// --- Textures procédurales ---------------------------------------------------

function makeWindowTexture(seed, tint) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 256);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 4; y < 252; y += 9) {
    for (let x = 4; x < 124; x += 7) {
      if (rnd() < 0.26) {
        const warm = rnd() < 0.65;
        const a = 0.35 + rnd() * 0.65;
        ctx.fillStyle = warm
          ? `rgba(255,${200 + Math.floor(rnd() * 40)},140,${a})`
          : `rgba(${140 + Math.floor(rnd() * 60)},220,255,${a})`;
        ctx.fillRect(x, y, 4, 6);
      }
    }
  }
  if (tint) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 128, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePuddleAlpha() {
  // Carte d'opacité de l'asphalte : sombre = flaque (le miroir transparaît).
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 14 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const depth = 40 + Math.random() * 110;
    g.addColorStop(0, `rgba(${depth},${depth},${depth},0.95)`);
    g.addColorStop(1, 'rgba(232,232,232,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  return tex;
}

// --- Construction --------------------------------------------------------------

function addBuildings(scene) {
  const windowTextures = [
    makeWindowTexture(1234),
    makeWindowTexture(98765),
    makeWindowTexture(4242, '#aaccff'),
    makeWindowTexture(777, '#ffd9aa'),
  ];

  const makeMat = (i) =>
    new THREE.MeshStandardMaterial({
      color: 0x0c0d14,
      roughness: 0.85,
      metalness: 0.1,
      emissive: 0xffffff,
      emissiveMap: windowTextures[i % windowTextures.length],
      emissiveIntensity: 0.35,
    });

  BUILDING_DEFS.forEach(([x, z, w, d, h], i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(i));
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    // Fin liseré blanc sur quelques toits, discret
    if (i % 4 === 0) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2),
        new THREE.MeshBasicMaterial({ color: 0xcfd6e6 })
      );
      trim.position.set(x, h + 0.12, z);
      scene.add(trim);
    }
  });

  ANGLED_BUILDINGS.forEach((b, i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), makeMat(i + 1));
    mesh.position.set(b.position[0], b.h / 2, b.position[1]);
    mesh.rotation.y = b.rotY;
    scene.add(mesh);
  });

  // La tour aux trois écrans
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(TOWER.w, TOWER.h, TOWER.d),
    new THREE.MeshStandardMaterial({ color: 0x101019, roughness: 0.7, metalness: 0.3 })
  );
  tower.position.set(TOWER.position[0], TOWER.h / 2, TOWER.position[1]);
  scene.add(tower);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.4, 14, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4455 })
  );
  spire.position.set(0, TOWER.h + 7, TOWER.position[1]);
  scene.add(spire);
}

function addSkyline(scene) {
  // Silhouettes lointaines pour la profondeur, fenêtres très atténuées.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x07080f,
    roughness: 1,
    emissive: 0x223355,
    emissiveIntensity: 0.12,
  });
  let s = 31;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const count = 150;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 2000) {
    // Une ceinture urbaine tout autour du monde jouable : derrière la tour,
    // au-delà du parc, et sur les flancs.
    const x = (rnd() * 2 - 1) * 290;
    const z = -160 + rnd() * 460;
    if (x > -95 && x < 95 && z > -110 && z < 215) continue; // zone jouable
    const w = 10 + rnd() * 20;
    const h = 26 + rnd() * (z < -60 ? 120 : 90);
    m.makeScale(w, h, 10 + rnd() * 16);
    m.setPosition(x, h / 2, z);
    mesh.setMatrixAt(placed, m);
    placed++;
  }
  mesh.count = placed;
  scene.add(mesh);
}

function addGround(scene, world) {
  // Grand sol de base sous tout le monde (rue, arrière-cours, parc)
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 460),
    new THREE.MeshStandardMaterial({ color: 0x0b0c12, roughness: 1 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.02, 30);
  scene.add(base);

  // Miroir temps réel sous une couche d'asphalte percée de flaques (zone rue).
  const reflector = new Reflector(new THREE.PlaneGeometry(140, 215), {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x9aa0b8,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0, -12.5);
  scene.add(reflector);

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 215),
    new THREE.MeshStandardMaterial({
      color: 0x14151d,
      roughness: 0.95,
      transparent: true,
      opacity: 0.85,
      alphaMap: makePuddleAlpha(),
      depthWrite: false,
    })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0.04, -12.5);
  scene.add(asphalt);

  // Marquage central jaune
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x8f7a22 });
  for (let z = -85; z < 92; z += 8) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.06, z);
    scene.add(line);
  }

  // Passages piétons
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.8 });
  for (const cz of [-32, 34, 88]) {
    for (let x = -11; x <= 11; x += 2.2) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 4.4), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.062, cz);
      scene.add(stripe);
    }
  }

  // Trottoirs — la rue file maintenant jusqu'au parc
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x1c1d26, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, STREET.zMax - STREET.zMin), sideMat);
    sw.position.set(sx * 20.5, 0.25, (STREET.zMin + STREET.zMax) / 2);
    scene.add(sw);
  }
  // Parvis devant la tour
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 18), sideMat);
  plaza.position.set(0, 0.2, -55);
  scene.add(plaza);

  // Bollards le long des trottoirs
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x2a2c36, roughness: 0.5, metalness: 0.7 });
  const capMat = new THREE.MeshBasicMaterial({ color: 0xb8c2d8 });
  for (const sx of [-13.2, 13.2]) {
    for (let z = -44; z <= 89; z += 11) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.1, 8), bollardMat);
      b.position.set(sx, 0.55, z);
      scene.add(b);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 8), capMat);
      cap.position.set(sx, 1.12, z);
      scene.add(cap);
      world.addCircle(sx, z, 0.32);
    }
  }
}

// Les marches rouges emblématiques de la place (façon escaliers TKTS),
// posées sur le parvis face à la tour.
function addRedSteps(scene) {
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x5e0a14,
    roughness: 0.25,
    metalness: 0.1,
    emissive: 0xc41a2e,
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.92,
  });
  // Mêmes constantes que groundHeightAt : l'escalier se monte à pied.
  for (let i = 0; i < STEPS.count; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(STEPS.xHalf * 2, 0.5, STEPS.depth), stepMat);
    // L'escalier monte vers la tour (vers -z)
    step.position.set(0, STEPS.baseY + i * STEPS.stepH, STEPS.startZ - i * STEPS.depth);
    scene.add(step);
  }
  // Palier sommital
  const top = new THREE.Mesh(new THREE.BoxGeometry(STEPS.xHalf * 2, 0.5, 2.6), stepMat);
  top.position.set(0, STEPS.baseY + STEPS.count * STEPS.stepH, STEPS.startZ - STEPS.count * STEPS.depth - 0.8);
  scene.add(top);
  // Lueur douce au pied des marches
  const glow = new THREE.PointLight(0xff4455, 26, 26, 2);
  glow.position.set(0, 4, -50);
  scene.add(glow);
}

function addLamps(scene, world) {
  const lampPositions = [
    [-14, -40], [14, -28], [-14, -4], [14, 8], [-14, 32], [14, 44],
    [-14, 58], [14, 70], [-14, 84],
  ];
  const postMat = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.6, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  bulbMat.color.multiplyScalar(2.2);

  for (const [x, z] of lampPositions) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6), postMat);
    post.position.set(x, 3.75, z);
    scene.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), bulbMat);
    bulb.position.set(x, 7.6, z);
    scene.add(bulb);
    world.addCircle(x, z, 0.3);
  }
  // Quelques vraies lumières seulement (perf) : une sur deux
  for (let i = 0; i < lampPositions.length; i += 2) {
    const [x, z] = lampPositions[i];
    const light = new THREE.PointLight(0xffc88a, 60, 36, 2);
    light.position.set(x, 7.4, z);
    scene.add(light);
  }
}

function addDust(scene) {
  const count = 350;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * 40;
    positions[i * 3 + 1] = Math.random() * 45 + 1;
    positions[i * 3 + 2] = -80 + Math.random() * 140;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x88aaff,
    size: 0.18,
    map: makeDotTexture(),
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}

export function createCity(scene, world) {
  scene.background = new THREE.Color(0x05060c);
  // Brouillard plus lointain : le monde est grand, le parc doit se voir
  // depuis la place (le dôme de ciel n'est pas embrumé).
  scene.fog = new THREE.FogExp2(0x090a14, 0.0028);

  scene.add(new THREE.AmbientLight(0x39405c, 0.7));
  const moon = new THREE.DirectionalLight(0x55628c, 0.45);
  moon.position.set(40, 80, 30);
  scene.add(moon);
  // Lueur d'ensemble du square : les écrans "éclairent" la place en
  // blancs chauds/froids neutres plutôt qu'en néons saturés.
  const glow = new THREE.PointLight(0xffe7d2, 110, 90, 2);
  glow.position.set(0, 24, -50);
  scene.add(glow);
  const glow2 = new THREE.PointLight(0xd6e4ff, 70, 80, 2);
  glow2.position.set(0, 20, 5);
  scene.add(glow2);

  addGround(scene, world);
  addRedSteps(scene);
  addBuildings(scene);
  addSkyline(scene);
  addLamps(scene, world);
  const dust = addDust(scene);

  return {
    update(dt, time) {
      dust.rotation.y = time * 0.004;
      glow.intensity = 104 + Math.sin(time * 2.1) * 12;
    },
  };
}
