// Les écrans : géométrie (plane ou portion de cylindre pour la tour),
// texture canvas redessinée à chaque rotation de pub, scintillement LED,
// et le bandeau boursier qui défile en continu.

import * as THREE from 'three';
import { BOARD_DEFS, TICKER_DEF } from './layout.js';
import { drawAd, BRANDS, screenFx } from '../ads/adFactory.js';
import { market } from '../market/market.js';

const ROTATION_SECONDS = 8;
const CAMPAIGN_WEIGHT = 3; // une campagne payée passe 3x plus souvent qu'une marque

function canvasSizeFor(w, h) {
  const aspect = w / h;
  const ch = aspect >= 1 ? 512 : 768;
  const cw = Math.min(2048, Math.round(ch * aspect / 64) * 64 || 256);
  return [Math.max(256, cw), ch];
}

function buildPlaylist(boardId) {
  const items = [];
  for (const c of market.campaignsFor(boardId)) {
    const ad = market.getAd(c.adId);
    if (ad) for (let i = 0; i < CAMPAIGN_WEIGHT; i++) items.push(ad);
  }
  // Deux marques de remplissage, différentes selon l'écran
  const seed = boardId.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  items.push({ kind: 'brand', brandIndex: seed % BRANDS.length });
  items.push({ kind: 'brand', brandIndex: (seed + 3) % BRANDS.length });
  return items;
}

class Board {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    const [cw, ch] = canvasSizeFor(def.w, def.h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.material = new THREE.MeshBasicMaterial({ map: this.texture });
    // > 1 pour que les écrans dépassent le seuil du bloom et irradient
    this.material.color.setScalar(1.5);

    let geo;
    if (def.curve) {
      const r = def.curve.radius;
      const arc = def.w / r;
      // Arc centré sur +Z, normales vers l'extérieur : face à la place.
      geo = new THREE.CylinderGeometry(r, r, def.h, 24, 1, true, -arc / 2, arc);
      this.mesh = new THREE.Mesh(geo, this.material);
      this.mesh.position.set(def.position[0], def.position[1], def.position[2]);
    } else {
      geo = new THREE.PlaneGeometry(def.w, def.h);
      this.mesh = new THREE.Mesh(geo, this.material);
      this.mesh.position.set(...def.position);
      this.mesh.rotation.y = def.rotY;
    }
    this.mesh.userData.boardId = def.id;

    // Cadre sombre derrière l'écran
    if (!def.curve) {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(def.w + 0.8, def.h + 0.8, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.9 })
      );
      frame.position.z = -0.3;
      this.mesh.add(frame);
    }

    this.playlist = buildPlaylist(def.id);
    this.itemIndex = index % this.playlist.length;
    this.timer = (index * 1.7) % ROTATION_SECONDS; // rotations désynchronisées
    this.current = this.playlist[this.itemIndex];
    this.redraw(0);
  }

  redraw(time) {
    drawAd(this.ctx, this.canvas.width, this.canvas.height, this.current, time);
    this.texture.needsUpdate = true;
  }

  rebuildPlaylist() {
    this.playlist = buildPlaylist(this.def.id);
    this.itemIndex = 0;
    this.current = this.playlist[0];
    this.timer = 0;
    this.redraw(performance.now() / 1000);
  }

  update(dt, time) {
    this.timer += dt;
    if (this.timer >= ROTATION_SECONDS) {
      this.timer = 0;
      this.itemIndex = (this.itemIndex + 1) % this.playlist.length;
      this.current = this.playlist[this.itemIndex];
      this.redraw(time);
    }
    // Scintillement LED + micro-glitch occasionnel
    const flicker = 1.45 + 0.07 * Math.sin(time * 9 + this.index * 2.4);
    const glitch = Math.random() < 0.002 ? 0.6 : 1;
    this.material.color.setScalar(flicker * glitch);
  }
}

// --- Bandeau boursier défilant ----------------------------------------------

class Ticker {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture });
    this.material.color.setScalar(1.6);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(TICKER_DEF.w, TICKER_DEF.h), this.material);
    this.mesh.position.set(...TICKER_DEF.position);
    this.mesh.rotation.y = TICKER_DEF.rotY;
    this.offset = 0;
    this.text = this.buildText();
    market.on('prices', () => { this.text = this.buildText(); });
  }

  buildText() {
    const parts = market.boards.map((b) => {
      const d = market.deltas[b.id];
      const arrow = d >= 0 ? '▲' : '▼';
      return `${b.name} ${market.price(b.id).toFixed(1)}¢ ${arrow}${Math.abs(d).toFixed(1)}%`;
    });
    return '  ◆  ' + parts.join('  ◆  ') + '  ◆  TSX · LE MARCHÉ NE DORT JAMAIS';
  }

  update(dt) {
    const { ctx, canvas } = this;
    this.offset = (this.offset + dt * 180) % 100000;
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 64px 'Space Grotesk', monospace";
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffc24b';
    const tw = ctx.measureText(this.text).width;
    let x = -(this.offset % (tw + 200));
    while (x < canvas.width) {
      ctx.fillText(this.text, x, canvas.height / 2 + 4);
      x += tw + 200;
    }
    screenFx(ctx, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
  }
}

export function createBillboards(scene) {
  const boards = BOARD_DEFS.map((def, i) => new Board(def, i));
  const meshes = [];
  for (const b of boards) {
    scene.add(b.mesh);
    meshes.push(b.mesh);
  }

  const ticker = new Ticker();
  scene.add(ticker.mesh);

  // Quand une campagne démarre ou s'arrête, les playlists concernées changent.
  market.on('campaigns', () => {
    for (const b of boards) b.rebuildPlaylist();
  });

  let frame = 0;
  return {
    meshes,
    boards,
    update(dt, time) {
      for (const b of boards) b.update(dt, time);
      frame++;
      if (frame % 2 === 0) ticker.update(dt * 2); // 30 fps suffisent au bandeau
    },
  };
}
