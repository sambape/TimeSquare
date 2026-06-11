// Fabrique de visuels publicitaires : tout est dessiné en Canvas 2D puis
// projeté sur les écrans 3D via CanvasTexture. Quatre sources possibles :
// les marques fictives "de remplissage", les pubs texte composées par
// l'utilisateur, les images uploadées et les vidéos uploadées (lues en
// boucle, muettes, recopiées image par image sur le canvas de l'écran).

import { getVideoURL } from './videoStore.js';

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function fitText(ctx, text, maxW, maxH, family, weight = 900) {
  let size = maxH;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 8) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

const TITLE_FONT = "'Unbounded', 'Arial Black', sans-serif";
const BODY_FONT = "'Space Grotesk', Arial, sans-serif";

function glowText(ctx, text, x, y, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur * 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function diagGradient(ctx, w, h, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

// Effet "dalle LED" : trame + vignette + reflet, appliqué en dernier.
export function screenFx(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const sheen = ctx.createLinearGradient(0, 0, 0, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.25, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// --- Marques fictives -------------------------------------------------------

export const BRANDS = [
  {
    name: 'NÉON SODA',
    draw(ctx, w, h, t) {
      ctx.fillStyle = diagGradient(ctx, w, h, '#12002b', '#3d0a55');
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(255,61,166,${0.10 + 0.07 * Math.sin(t * 2 + i)})`;
        ctx.lineWidth = h * 0.04;
        ctx.beginPath();
        ctx.arc(w * 0.8, h * 0.5, h * (0.18 + i * 0.13), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'NÉON', w * 0.5, h * 0.42, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'NÉON', w * 0.06, h * 0.36, '#ff3da6', 28);
      glowText(ctx, 'SODA', w * 0.06, h * 0.36 + s * 0.95, '#29f3ff', 28);
      ctx.font = `500 ${h * 0.09}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('LE GOÛT DE MINUIT', w * 0.06, h * 0.88);
    },
  },
  {
    name: 'LUNAR AIRLINES',
    draw(ctx, w, h, t) {
      ctx.fillStyle = diagGradient(ctx, w, h, '#001633', '#003a6b');
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe9b8';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.3, h * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 137.5 + t * 12) % w);
        const y = (i * 53.7) % (h * 0.7);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'LUNAR AIR', w * 0.72, h * 0.3, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'LUNAR AIR', w * 0.05, h * 0.62, '#7db8ff', 22);
      ctx.font = `500 ${h * 0.085}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('PARIS → LA LUNE · 3 VOLS / SEMAINE', w * 0.05, h * 0.86);
    },
  },
  {
    name: 'CYBER SUSHI',
    draw(ctx, w, h, t) {
      ctx.fillStyle = '#040d09';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(41,243,255,${0.05 + 0.04 * ((i + t) % 3)})`;
        ctx.fillRect(0, (i / 10) * h, w, h * 0.04);
      }
      ctx.strokeStyle = '#2bff88';
      ctx.lineWidth = h * 0.03;
      ctx.strokeRect(w * 0.04, h * 0.08, w * 0.92, h * 0.84);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'CYBER SUSHI', w * 0.8, h * 0.34, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'CYBER SUSHI', w * 0.5, h * 0.42, '#2bff88', 26);
      ctx.font = `500 ${h * 0.1}px ${BODY_FONT}`;
      ctx.fillStyle = '#9dffc8';
      ctx.fillText('OUVERT 25H/24', w * 0.5, h * 0.72);
    },
  },
  {
    name: 'ORBIT WATCHES',
    draw(ctx, w, h, t) {
      ctx.fillStyle = diagGradient(ctx, w, h, '#1a1206', '#3a2a08');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffc24b';
      ctx.lineWidth = h * 0.025;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.42, h * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      const a = t * 0.8;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.42);
      ctx.lineTo(w * 0.5 + Math.cos(a) * h * 0.2, h * 0.42 + Math.sin(a) * h * 0.2);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'ORBIT', w * 0.6, h * 0.2, TITLE_FONT);
      ctx.font = `700 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'ORBIT', w * 0.5, h * 0.83, '#ffc24b', 18);
    },
  },
  {
    name: 'PIXEL RUNNERS',
    draw(ctx, w, h, t) {
      ctx.fillStyle = '#0b0518';
      ctx.fillRect(0, 0, w, h);
      const cols = 14;
      for (let i = 0; i < cols; i++) {
        const hh = (Math.sin(i * 1.7 + t * 3) * 0.5 + 0.5) * h * 0.5;
        ctx.fillStyle = i % 2 ? '#ff3da6' : '#29f3ff';
        ctx.globalAlpha = 0.55;
        ctx.fillRect((i / cols) * w, h - hh, w / cols - 4, hh);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'PIXEL RUNNERS', w * 0.9, h * 0.3, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'PIXEL RUNNERS', w * 0.5, h * 0.3, '#ffffff', 24);
      ctx.font = `500 ${h * 0.09}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('LE JEU · SAISON 9', w * 0.5, h * 0.52);
    },
  },
  {
    name: 'MIDNIGHT FM',
    draw(ctx, w, h, t) {
      ctx.fillStyle = diagGradient(ctx, w, h, '#160022', '#000000');
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b96bff';
      ctx.lineWidth = h * 0.018;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = h * 0.62 + Math.sin(x * 0.045 + t * 4) * h * 0.1 * Math.sin(x * 0.008);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'MIDNIGHT FM', w * 0.85, h * 0.26, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'MIDNIGHT FM', w * 0.05, h * 0.26, '#b96bff', 26);
      ctx.font = `500 ${h * 0.09}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('104.7 · LA NUIT VOUS ÉCOUTE', w * 0.05, h * 0.88);
    },
  },
  {
    name: 'VOLT MOTORS',
    draw(ctx, w, h, t) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#031b1e');
      g.addColorStop(1, '#06343a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#29f3ff';
      ctx.lineWidth = h * 0.04;
      ctx.beginPath();
      const zx = w * (0.72 + 0.02 * Math.sin(t * 6));
      ctx.moveTo(zx, h * 0.1);
      ctx.lineTo(zx - w * 0.08, h * 0.45);
      ctx.lineTo(zx + w * 0.02, h * 0.45);
      ctx.lineTo(zx - w * 0.07, h * 0.9);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'VOLT', w * 0.5, h * 0.4, TITLE_FONT);
      ctx.font = `900 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'VOLT', w * 0.06, h * 0.38, '#29f3ff', 26);
      ctx.font = `500 ${h * 0.09}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('0 À 100 EN 1.9s', w * 0.06, h * 0.72);
    },
  },
  {
    name: 'HOTEL ÉCLIPSE',
    draw(ctx, w, h) {
      ctx.fillStyle = diagGradient(ctx, w, h, '#1c0510', '#41091f');
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,194,75,0.9)';
      for (let i = 0; i < 5; i++) {
        const x = w * (0.3 + i * 0.1);
        ctx.beginPath();
        ctx.arc(x, h * 0.2, h * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const s = fitText(ctx, 'ÉCLIPSE', w * 0.85, h * 0.32, TITLE_FONT);
      ctx.font = `700 ${s}px ${TITLE_FONT}`;
      glowText(ctx, 'ÉCLIPSE', w * 0.5, h * 0.5, '#ff9d6b', 24);
      ctx.font = `500 ${h * 0.09}px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('HÔTEL ★★★★★ · ROOFTOP 52e', w * 0.5, h * 0.78);
    },
  },
];

// --- Pubs utilisateur -------------------------------------------------------

const imageCache = new Map();

export function getAdImage(ad) {
  if (!ad.dataUrl) return null;
  // La longueur du dataUrl dans la clé invalide le cache si l'image change
  // (cas du brouillon du studio qu'on ré-uploade).
  const key = `${ad.id}:${ad.dataUrl.length}`;
  let img = imageCache.get(key);
  if (!img) {
    img = new Image();
    img.src = ad.dataUrl;
    imageCache.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function drawUserTextAd(ctx, w, h, ad, t) {
  ctx.fillStyle = diagGradient(ctx, w, h, ad.c1 || '#12002b', ad.c2 || '#003a6b');
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = h * 0.012;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.15, h * (0.15 + i * 0.16) + Math.sin(t + i) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = (ad.text || 'VOTRE PUB').toUpperCase();
  const s = fitText(ctx, text, w * 0.88, h * 0.34, TITLE_FONT);
  ctx.font = `900 ${s}px ${TITLE_FONT}`;
  glowText(ctx, text, w * 0.5, h * (ad.sub ? 0.42 : 0.5), ad.tc || '#29f3ff', 26);
  if (ad.sub) {
    ctx.font = `500 ${h * 0.1}px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(ad.sub.toUpperCase(), w * 0.5, h * 0.72);
  }
}

// --- Vidéos -------------------------------------------------------------------

const videoCache = new Map();

// Élément <video> partagé entre tous les écrans qui diffusent cette pub.
// Créé paresseusement ; la source arrive d'IndexedDB (ou d'un brouillon).
export function getAdVideo(ad) {
  if (!ad.videoId) return null;
  let v = videoCache.get(ad.videoId);
  if (!v) {
    v = makeVideoElement();
    videoCache.set(ad.videoId, v);
    getVideoURL(ad.videoId).then((url) => {
      if (url && !v.src) {
        v.src = url;
        v.play().catch(() => {});
      }
    });
  }
  return v.readyState >= 2 && v.videoWidth > 0 ? v : null;
}

function makeVideoElement() {
  const v = document.createElement('video');
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'auto';
  return v;
}

// Le studio enregistre ici la vidéo fraîchement uploadée (URL d'objet),
// pour l'aperçu immédiat et pour éviter une relecture d'IndexedDB.
export function registerVideo(videoId, objectUrl) {
  let v = videoCache.get(videoId);
  if (!v) {
    v = makeVideoElement();
    videoCache.set(videoId, v);
  }
  v.src = objectUrl;
  v.play().catch(() => {});
}

export function releaseVideo(videoId) {
  const v = videoCache.get(videoId);
  if (v) {
    v.pause();
    v.removeAttribute('src');
  }
  videoCache.delete(videoId);
}

function drawUserVideoAd(ctx, w, h, ad) {
  const v = getAdVideo(ad);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (!v) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `700 ${h * 0.12}px ${BODY_FONT}`;
    ctx.fillText('VIDÉO…', w / 2, h / 2);
    return;
  }
  // Cover fit
  const vr = v.videoWidth / v.videoHeight;
  const cr = w / h;
  let dw, dh;
  if (vr > cr) { dh = h; dw = h * vr; } else { dw = w; dh = w / vr; }
  ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawUserImageAd(ctx, w, h, ad) {
  const img = getAdImage(ad);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (!img) {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // Cover fit
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw, dh;
  if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// --- Point d'entrée ---------------------------------------------------------

// item : { kind: 'brand', brandIndex } | pub utilisateur { kind:'text'|'image'|'video', ... }
export function drawAd(ctx, w, h, item, t = 0) {
  if (item.kind === 'brand') {
    BRANDS[item.brandIndex % BRANDS.length].draw(ctx, w, h, t);
  } else if (item.kind === 'image') {
    drawUserImageAd(ctx, w, h, item);
  } else if (item.kind === 'video') {
    drawUserVideoAd(ctx, w, h, item);
  } else {
    drawUserTextAd(ctx, w, h, item, t);
  }
  screenFx(ctx, w, h);
}

export function adLabel(item) {
  if (item.kind === 'brand') return BRANDS[item.brandIndex % BRANDS.length].name;
  return item.name || item.text || 'Sans titre';
}
