// La nature et le ciel : dôme nocturne en dégradé, étoiles scintillantes,
// lune avec halo, nuages dérivants — et le parc au bout de l'avenue :
// pelouse, chemin sinueux, étang-miroir, arbres low-poly instanciés,
// bancs, guirlandes lumineuses et lucioles.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PARK, STREET } from './layout.js';
import { makeNoiseTexture } from './city.js';

// Générateur déterministe : le parc est planté pareil à chaque visite.
function makeRng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Texture ronde et douce pour les Points (sinon : carrés moches de près).
let dotTexture = null;
export function makeDotTexture() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

// --- Ciel ------------------------------------------------------------------------

function addSkyDome(scene) {
  const geo = new THREE.SphereGeometry(380, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x01020a) },
      midColor: { value: new THREE.Color(0x0a1024) },
      horizonColor: { value: new THREE.Color(0x3a2438) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        // Lueur urbaine ambrée à l'horizon, bleu profond au zénith
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.18, h));
        col = mix(col, topColor, smoothstep(0.12, 0.55, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -10;
  scene.add(dome);
}

function makeStarLayer(count, size, seed) {
  const rng = makeRng(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tints = [new THREE.Color(0xcdd8ff), new THREE.Color(0xfff4e0), new THREE.Color(0xffffff)];
  for (let i = 0; i < count; i++) {
    // Coupole au-dessus de l'horizon
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(0.06 + rng() * 0.92);
    const r = 360;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const c = tints[Math.floor(rng() * tints.length)];
    const v = 0.5 + rng() * 0.5;
    colors[i * 3] = c.r * v;
    colors[i * 3 + 1] = c.g * v;
    colors[i * 3 + 2] = c.b * v;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    sizeAttenuation: false,
  });
  return new THREE.Points(geo, mat);
}

function makeGlowSprite(color, innerStop = 0.18) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(innerStop, color.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })
  );
}

function addMoon(scene) {
  // Dans l'axe de la lumière directionnelle (40, 80, 30), assez basse sur
  // l'horizon pour entrer dans le champ d'une caméra d'épaule.
  const pos = new THREE.Vector3(195, 120, 150);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff2dc, fog: false });
  moonMat.color.multiplyScalar(1.35); // au-dessus du seuil de bloom : halo doux
  const moon = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 16), moonMat);
  moon.position.copy(pos);
  scene.add(moon);

  const halo = makeGlowSprite('rgba(255,238,210,0.9)');
  halo.position.copy(pos);
  halo.scale.setScalar(95);
  scene.add(halo);
}

function makeCloudTexture(seed) {
  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 40 + rng() * 176;
    const y = 45 + rng() * 40;
    const r = 18 + rng() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(165,180,215,0.16)');
    g.addColorStop(1, 'rgba(165,180,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  return new THREE.CanvasTexture(c);
}

function addClouds(scene) {
  const clouds = [];
  const rng = makeRng(777);
  for (let i = 0; i < 6; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeCloudTexture(100 + i * 37),
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0.55,
      })
    );
    const x = (rng() * 2 - 1) * 260;
    const z = (rng() * 2 - 1) * 260;
    sprite.position.set(x, 95 + rng() * 70, z);
    sprite.scale.set(150 + rng() * 110, 52 + rng() * 30, 1);
    scene.add(sprite);
    clouds.push({ sprite, speed: 1.1 + rng() * 1.6 });
  }
  return clouds;
}

// --- Le parc ----------------------------------------------------------------------

function addLawn(scene) {
  const grassTex = makeNoiseTexture('#17301b', 8, { stains: 16 });
  grassTex.repeat.set(18, 12);
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(PARK.xMax - PARK.xMin, PARK.zMax - PARK.zMin),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set((PARK.xMin + PARK.xMax) / 2, 0.02, (PARK.zMin + PARK.zMax) / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // Esplanade de transition entre le bout de l'avenue et la pelouse
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(STREET.sidewalkOuter * 2 + 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x232530, roughness: 0.9 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.03, STREET.zMax + 2);
  scene.add(apron);
}

function addPath(scene) {
  // Le chemin : une suite de galettes claires qui suivent pathX(z)
  const mat = new THREE.MeshStandardMaterial({ color: 0x3b372f, roughness: 0.95 });
  const geo = new THREE.CircleGeometry(2.6, 14);
  const count = Math.floor((PARK.zMax - 6 - PARK.zMin) / 1.6);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const z = PARK.zMin + 2 + i * 1.6;
    m.compose(new THREE.Vector3(PARK.pathX(z), 0.045, z), q, s);
    mesh.setMatrixAt(i, m);
  }
  scene.add(mesh);
}

function addPond(scene, world) {
  const { x, z, r } = PARK.pond;
  // Miroir d'eau basse résolution : le parc se reflète dedans
  const water = new Reflector(new THREE.CircleGeometry(r, 48), {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: 0x4a5570,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.05, z);
  scene.add(water);

  // Margelle de pierre
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(r, r + 1.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x3c3f4a, roughness: 0.8 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(x, 0.06, z);
  scene.add(rim);
}

function addTrees(scene, world) {
  const rng = makeRng(20260611);
  const spots = [];

  // Arbres du parc — on évite le chemin, l'étang et l'entrée
  let guard = 0;
  while (spots.length < 46 && guard++ < 600) {
    const x = PARK.xMin + 4 + rng() * (PARK.xMax - PARK.xMin - 8);
    const z = PARK.zMin + 6 + rng() * (PARK.zMax - PARK.zMin - 10);
    if (Math.abs(x - PARK.pathX(z)) < 4.4) continue;
    const pd = Math.hypot(x - PARK.pond.x, z - PARK.pond.z);
    if (pd < PARK.pond.r + 3.5) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 5)) continue;
    spots.push({ x, z, s: 0.8 + rng() * 0.9 });
  }

  // Arbres en jardinières le long des trottoirs de la place
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x232630, roughness: 0.85 });
  for (const sx of [-20.5, 20.5]) {
    for (const z of [-18, 4, 26, 52, 72]) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.6), planterMat);
      planter.position.set(sx, 0.85, z);
      scene.add(planter);
      world.addBox(sx, z, 2.6, 2.6);
      spots.push({ x: sx, z, s: 0.55 + rng() * 0.2, baseY: 1.2 });
    }
  }

  // Deux InstancedMesh pour tout le bosquet : troncs + blobs de feuillage
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  trunks.castShadow = true;

  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length * 3);
  leaves.castShadow = true;
  const leafTints = [new THREE.Color(0x2a5a30), new THREE.Color(0x1f4a28), new THREE.Color(0x3a6a35)];

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let li = 0;
  spots.forEach((spot, i) => {
    const h = 2.6 * spot.s + 0.8;
    const baseY = spot.baseY ?? 0;
    m.makeScale(spot.s * 1.4, h, spot.s * 1.4);
    m.setPosition(spot.x, baseY + h / 2, spot.z);
    trunks.setMatrixAt(i, m);

    for (let b = 0; b < 3; b++) {
      const br = (1.5 + rng() * 0.9) * spot.s;
      e.set(rng() * 0.6, rng() * Math.PI, rng() * 0.6);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(
          spot.x + (rng() * 2 - 1) * 0.9 * spot.s,
          baseY + h + (b - 0.4) * 0.85 * spot.s,
          spot.z + (rng() * 2 - 1) * 0.9 * spot.s
        ),
        q,
        new THREE.Vector3(br, br * (0.75 + rng() * 0.3), br)
      );
      leaves.setMatrixAt(li, m);
      leaves.setColorAt(li, leafTints[Math.floor(rng() * 3)]);
      li++;
    }

    world.addCircle(spot.x, spot.z, 0.42 * spot.s + 0.18);
  });
  scene.add(trunks, leaves);
}

function addBenches(scene, world) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.5, metalness: 0.6 });
  const zs = [112, 132, 154, 172];
  zs.forEach((z, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = PARK.pathX(z) + side * 4.6;
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.85), wood);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.1), wood);
    back.position.set(0, 0.95, -0.4);
    back.rotation.x = -0.16;
    bench.add(seat, back);
    for (const bx of [-1.05, 1.05]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.7), iron);
      foot.position.set(bx, 0.28, 0);
      bench.add(foot);
    }
    bench.position.set(x, 0, z);
    bench.rotation.y = side > 0 ? Math.PI / 2 + 0.3 : -Math.PI / 2 - 0.3;
    bench.traverse((o) => { o.castShadow = true; });
    scene.add(bench);
    world.addCircle(x, z, 1.1);
  });
}

function addStringLights(scene, world) {
  // Guirlandes tendues entre des poteaux le long du chemin
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.6, metalness: 0.5 });
  const positions = [];
  const spans = [
    [108, 122], [122, 138], [138, 152], [152, 168], [168, 182],
  ];
  const poleAt = (z) => {
    const side = Math.round(z / 10) % 2 === 0 ? 1 : -1;
    return [PARK.pathX(z) + side * 5.5, z];
  };
  const placed = new Map();
  for (const [za, zb] of spans) {
    for (const z of [za, zb]) {
      if (placed.has(z)) continue;
      const [px, pz] = poleAt(z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), poleMat);
      pole.position.set(px, 2.2, pz);
      scene.add(pole);
      world.addCircle(px, pz, 0.28);
      placed.set(z, [px, 4.3, pz]);
    }
    const a = placed.get(za);
    const b = placed.get(zb);
    const n = 16;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * 1.1;
      positions.push(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t - sag,
        a[2] + (b[2] - a[2]) * t
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd9a0,
    size: 0.22,
    map: makeDotTexture(),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mat.color.multiplyScalar(1.6);
  const lights = new THREE.Points(geo, mat);
  scene.add(lights);

  // Trois vraies lumières chaudes le long du chemin (perf)
  for (const z of [120, 148, 174]) {
    const light = new THREE.PointLight(0xffc88a, 34, 26, 2);
    light.position.set(PARK.pathX(z), 4, z);
    scene.add(light);
  }
  return mat;
}

function addHedges(scene) {
  // Haies sombres en lisière du parc : la frontière du monde se voit
  const mat = new THREE.MeshStandardMaterial({ color: 0x12241a, roughness: 1 });
  const h = 1.7;
  const mk = (w, d, x, z) => {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    hedge.position.set(x, h / 2, z);
    hedge.castShadow = true;
    scene.add(hedge);
  };
  mk(PARK.xMax - PARK.xMin + 4, h, 0, PARK.zMax + 1); // fond
  mk(2.4, PARK.zMax - PARK.zMin + 2, PARK.xMin - 1, (PARK.zMin + PARK.zMax) / 2); // ouest
  mk(2.4, PARK.zMax - PARK.zMin + 2, PARK.xMax + 1, (PARK.zMin + PARK.zMax) / 2); // est
}

function addFireflies(scene) {
  const rng = makeRng(4242);
  const count = 90;
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = PARK.xMin + 6 + rng() * (PARK.xMax - PARK.xMin - 12);
    base[i * 3 + 1] = 0.6 + rng() * 2.4;
    base[i * 3 + 2] = PARK.zMin + 6 + rng() * (PARK.zMax - PARK.zMin - 12);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const mat = new THREE.PointsMaterial({
    color: 0xc8ff8a,
    size: 0.14,
    map: makeDotTexture(),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, base };
}

// --- Assemblage --------------------------------------------------------------------

export function createNature(scene, world) {
  addSkyDome(scene);
  const stars1 = makeStarLayer(620, 1.6, 11);
  const stars2 = makeStarLayer(300, 2.6, 73);
  scene.add(stars1, stars2);
  addMoon(scene);
  const clouds = addClouds(scene);

  addLawn(scene);
  addPath(scene);
  addPond(scene, world);
  addTrees(scene, world);
  addBenches(scene, world);
  const garlandMat = addStringLights(scene, world);
  addHedges(scene);
  const fireflies = addFireflies(scene);

  // Clair de lune doux orienté comme la lune visible
  const moonLight = new THREE.DirectionalLight(0x9db4e8, 0.22);
  moonLight.position.set(130, 250, 100);
  scene.add(moonLight);

  return {
    update(dt, time) {
      stars1.material.opacity = 0.75 + Math.sin(time * 1.7) * 0.18;
      stars2.material.opacity = 0.8 + Math.sin(time * 2.3 + 1.4) * 0.2;
      garlandMat.opacity = 0.85 + Math.sin(time * 3.1) * 0.12;

      for (const c of clouds) {
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > 320) c.sprite.position.x = -320;
      }

      // Les lucioles dérivent et clignotent
      const pos = fireflies.points.geometry.attributes.position;
      const arr = pos.array;
      const b = fireflies.base;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3] = b[i * 3] + Math.sin(time * 0.5 + i * 1.7) * 1.4;
        arr[i * 3 + 1] = b[i * 3 + 1] + Math.sin(time * 0.8 + i * 2.3) * 0.5;
        arr[i * 3 + 2] = b[i * 3 + 2] + Math.cos(time * 0.4 + i) * 1.4;
      }
      pos.needsUpdate = true;
      fireflies.points.material.opacity = 0.55 + Math.sin(time * 2.2) * 0.3;
    },
  };
}
