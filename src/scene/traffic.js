// Taxis jaunes et berlines qui remontent l'avenue en boucle, phares et
// feux arrière émissifs pour nourrir le bloom et les reflets au sol.

import * as THREE from 'three';

const LANES = [
  { x: -5.5, dir: -1 },
  { x: -2, dir: -1 },
  { x: 2, dir: 1 },
  { x: 5.5, dir: 1 },
];

const Z_MIN = -88;
const Z_MAX = 64;

function buildCar(isTaxi) {
  const car = new THREE.Group();
  const bodyColor = isTaxi ? 0xd6a514 : [0x20242e, 0x3a1020, 0x102030][Math.floor(Math.random() * 3)];

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.7, 4.4),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.6 })
  );
  body.position.y = 0.65;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.2, metalness: 0.8 })
  );
  cabin.position.set(0, 1.25, -0.2);
  car.add(cabin);

  if (isTaxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe28a })
    );
    sign.material.color.multiplyScalar(1.8);
    sign.position.set(0, 1.65, -0.2);
    car.add(sign);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  headMat.color.multiplyScalar(3.5);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  tailMat.color.multiplyScalar(2.5);

  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), headMat);
    head.position.set(sx, 0.65, -2.2);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), tailMat);
    tail.position.set(sx, 0.75, 2.21);
    car.add(tail);
  }
  return car;
}

export function createTraffic(scene) {
  const cars = [];
  for (let i = 0; i < 9; i++) {
    const lane = LANES[i % LANES.length];
    const isTaxi = Math.random() < 0.55;
    const car = buildCar(isTaxi);
    car.position.set(lane.x, 0.3, Z_MIN + Math.random() * (Z_MAX - Z_MIN));
    // Les voitures pointent -Z par défaut (phares à -2.2) ; sens +Z = demi-tour
    car.rotation.y = lane.dir === 1 ? Math.PI : 0;
    scene.add(car);
    cars.push({ car, lane, speed: 9 + Math.random() * 6 });
  }

  return {
    update(dt) {
      for (const c of cars) {
        c.car.position.z += c.lane.dir * c.speed * dt;
        if (c.lane.dir === -1 && c.car.position.z < Z_MIN) c.car.position.z = Z_MAX;
        if (c.lane.dir === 1 && c.car.position.z > Z_MAX) c.car.position.z = Z_MIN;
      }
    },
  };
}
