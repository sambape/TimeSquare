// Stockage des vidéos publicitaires : les blobs vont dans IndexedDB (le
// localStorage est bien trop petit), les métadonnées restent dans l'état
// du marché. Chaque vidéo est référencée par l'id `videoId` de sa pub.

const DB_NAME = 'tsx-videos';
const STORE = 'videos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveVideo(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const urlCache = new Map();

// Rend une URL d'objet (ou null si la vidéo a disparu de la base).
export async function getVideoURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  try {
    const db = await openDB();
    const blob = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const url = blob ? URL.createObjectURL(blob) : null;
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export async function deleteVideo(id) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  try {
    const db = await openDB();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
  } catch {
    // base indisponible : tant pis, le blob orphelin sera ignoré
  }
}
