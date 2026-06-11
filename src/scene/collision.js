// Monde de collision 2D : le joueur est un cercle au sol, poussé hors des
// volumes (immeubles, tour, arbres, mobilier) par itérations successives.
// La hauteur de sol (trottoirs, parvis, marches rouges) est traitée à part :
// on y monte, on n'y bute pas.

import { BUILDING_DEFS, ANGLED_BUILDINGS, TOWER, STREET, PLAZA, STEPS, PARK, WORLD_BOUNDS } from './layout.js';

export class CollisionWorld {
  constructor() {
    this.boxes = []; // { minX, maxX, minZ, maxZ }
    this.rotBoxes = []; // { cx, cz, halfW, halfD, cos, sin }
    this.circles = []; // { x, z, r }
    this.bounds = WORLD_BOUNDS;
  }

  addBox(cx, cz, w, d) {
    this.boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  addRotBox(cx, cz, w, d, rotY) {
    this.rotBoxes.push({ cx, cz, halfW: w / 2, halfD: d / 2, cos: Math.cos(rotY), sin: Math.sin(rotY) });
  }

  addCircle(x, z, r) {
    this.circles.push({ x, z, r });
  }

  // Pousse le cercle (x, z, radius) hors d'une AABB. Retourne le déplacement appliqué.
  static pushOutOfBox(p, radius, box) {
    const nx = Math.max(box.minX, Math.min(p.x, box.maxX));
    const nz = Math.max(box.minZ, Math.min(p.z, box.maxZ));
    let dx = p.x - nx;
    let dz = p.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) return false;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      p.x += (dx / d) * push;
      p.z += (dz / d) * push;
    } else {
      // Centre à l'intérieur : sortie par la face la plus proche
      const left = p.x - box.minX;
      const right = box.maxX - p.x;
      const near = p.z - box.minZ;
      const far = box.maxZ - p.z;
      const m = Math.min(left, right, near, far);
      if (m === left) p.x = box.minX - radius;
      else if (m === right) p.x = box.maxX + radius;
      else if (m === near) p.z = box.minZ - radius;
      else p.z = box.maxZ + radius;
    }
    return true;
  }

  // Le cercle (x, z, r) est-il libre de toute collision ?
  circleFree(x, z, radius) {
    for (const b of this.boxes) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    for (const rb of this.rotBoxes) {
      const lx = (x - rb.cx) * rb.cos - (z - rb.cz) * rb.sin;
      const lz = (x - rb.cx) * rb.sin + (z - rb.cz) * rb.cos;
      const nx = Math.max(-rb.halfW, Math.min(lx, rb.halfW));
      const nz = Math.max(-rb.halfD, Math.min(lz, rb.halfD));
      const dx = lx - nx;
      const dz = lz - nz;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    // Les cercles fins (arbres, lampadaires…) n'occluent pas la caméra : on
    // ne teste que les volumes pleins. (Utilisé uniquement par la caméra.)
    return true;
  }

  // Résout la position (objet mutable {x, z}) contre tout le monde.
  resolve(p, radius) {
    for (let iter = 0; iter < 3; iter++) {
      let hit = false;

      for (const b of this.boxes) {
        if (CollisionWorld.pushOutOfBox(p, radius, b)) hit = true;
      }

      for (const rb of this.rotBoxes) {
        // Passage dans le repère local de la boîte
        const lx = (p.x - rb.cx) * rb.cos - (p.z - rb.cz) * rb.sin;
        const lz = (p.x - rb.cx) * rb.sin + (p.z - rb.cz) * rb.cos;
        const local = { x: lx, z: lz };
        const box = { minX: -rb.halfW, maxX: rb.halfW, minZ: -rb.halfD, maxZ: rb.halfD };
        if (CollisionWorld.pushOutOfBox(local, radius, box)) {
          hit = true;
          p.x = rb.cx + local.x * rb.cos + local.z * rb.sin;
          p.z = rb.cz - local.x * rb.sin + local.z * rb.cos;
        }
      }

      for (const c of this.circles) {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          p.x = c.x + (dx / d) * min;
          p.z = c.z + (dz / d) * min;
          hit = true;
        }
      }

      // Limites du monde
      const b = this.bounds;
      if (p.x < b.xMin) { p.x = b.xMin; hit = true; }
      if (p.x > b.xMax) { p.x = b.xMax; hit = true; }
      if (p.z < b.zMin) { p.z = b.zMin; hit = true; }
      if (p.z > b.zMax) { p.z = b.zMax; hit = true; }

      if (!hit) break;
    }
  }
}

// Hauteur du sol praticable sous (x, z) : marches > parvis > trottoirs > 0.
export function groundHeightAt(x, z) {
  // Marches rouges : l'escalier monte vers -z depuis startZ
  if (Math.abs(x) <= STEPS.xHalf) {
    const zTop = STEPS.startZ - STEPS.count * STEPS.depth - 2.1; // palier sommital compris
    if (z <= STEPS.startZ + STEPS.depth / 2 && z >= zTop) {
      const i = Math.min(STEPS.count, Math.floor((STEPS.startZ + STEPS.depth / 2 - z) / STEPS.depth));
      return STEPS.baseY + i * STEPS.stepH + 0.25;
    }
  }
  if (Math.abs(x) <= PLAZA.xHalf && z >= PLAZA.zMin && z <= PLAZA.zMax) return 0.4;
  const ax = Math.abs(x);
  if (ax >= STREET.roadHalf && ax <= STREET.sidewalkOuter && z >= STREET.zMin && z <= STREET.zMax) return 0.5;
  return 0;
}

// Construit le monde statique depuis le plan de la ville. Les éléments ajoutés
// au fil du décor (arbres, lampadaires…) s'enregistrent ensuite directement.
export function buildCollisionWorld() {
  const world = new CollisionWorld();

  for (const [x, z, w, d] of BUILDING_DEFS) world.addBox(x, z, w, d);
  for (const b of ANGLED_BUILDINGS) world.addRotBox(b.position[0], b.position[1], b.w, b.d, b.rotY);
  world.addBox(TOWER.position[0], TOWER.position[1], TOWER.w, TOWER.d);

  // Murs invisibles derrière les façades : les ruelles entre immeubles ne
  // débouchent pas sur le vide. Le monde ne s'ouvre en largeur qu'au parc
  // (ils couvrent x 27,5 → 68,5, au-delà des WORLD_BOUNDS).
  world.addBox(-48, -3.5, 41, 203);
  world.addBox(48, -3.5, 41, 203);

  // L'étang : on se promène autour, pas dedans.
  world.addCircle(PARK.pond.x, PARK.pond.z, PARK.pond.r + 0.4);

  return world;
}
