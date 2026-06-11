// La bourse des écrans : chaque panneau est un actif dont le prix au
// ¢/minute suit une marche aléatoire à retour vers la moyenne, gonflée par
// la demande (campagnes actives). Les joueurs achètent des minutes
// d'antenne et peuvent revendre le temps restant au cours du moment.

import { BOARD_DEFS, BASE_PRICES, SIZE_FACTORS } from '../scene/layout.js';

const STORAGE_KEY = 'tsx-state-v1';
const TICK_MS = 3000;
const HISTORY_LEN = 80;
const PASSIVE_INCOME = 1; // ¢R par seconde de présence
const SELLBACK_RATE = 0.8;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Les crédits ne s'achètent pas : ils se gagnent. Présence passive, bonus
// quotidien avec série, et succès débloqués en jouant le marché.
const ACHIEVEMENTS = [
  { id: 'first_ad', name: 'Première enseigne', desc: 'Créer votre première pub au studio', reward: 50 },
  { id: 'first_buy', name: 'En ondes', desc: 'Acheter un premier créneau de diffusion', reward: 100 },
  { id: 'profit', name: 'Trader de minuit', desc: 'Revendre un créneau avec plus-value', reward: 150 },
  { id: 'triple', name: 'Omniprésent', desc: '3 campagnes actives en même temps', reward: 200 },
  { id: 'fortune', name: 'Première fortune', desc: 'Détenir 2 500 ¢R', reward: 100 },
];

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

class Market {
  constructor() {
    this.listeners = {};
    this.boards = BOARD_DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      base: Math.round(BASE_PRICES[d.size] * (0.85 + SIZE_FACTORS[d.size] * 0.3)),
    }));

    this.credits = 1000;
    this.ads = []; // pubs créées par l'utilisateur
    this.campaigns = []; // { id, boardId, adId, secondsLeft, pricePaid, total }
    this.unlocked = {}; // succès déjà obtenus
    this.lastDaily = null; // clé jour du dernier bonus quotidien
    this.streak = 0;
    this.prices = {};
    this.history = {};
    this.deltas = {};

    for (const b of this.boards) {
      this.prices[b.id] = b.base;
      this.history[b.id] = [b.base];
      this.deltas[b.id] = 0;
    }

    this.load();
    setInterval(() => this.tick(), TICK_MS);
    setInterval(() => this.earn(), 1000);
  }

  // --- Événements -----------------------------------------------------------

  on(event, cb) {
    (this.listeners[event] ||= []).push(cb);
  }

  emit(event, payload) {
    for (const cb of this.listeners[event] || []) cb(payload);
  }

  toast(msg, type = 'info') {
    this.emit('toast', { msg, type });
  }

  // --- Boucle économique ----------------------------------------------------

  tick() {
    for (const b of this.boards) {
      const demand = 1 + 0.22 * this.campaigns.filter((c) => c.boardId === b.id).length;
      const target = b.base * demand;
      let p = this.prices[b.id];
      p += (target - p) * 0.06; // retour vers la moyenne (pondérée demande)
      p += p * 0.05 * (Math.random() * 2 - 1); // bruit de marché
      p = Math.max(b.base * 0.4, Math.min(b.base * 3, p));
      this.prices[b.id] = Math.round(p * 10) / 10;

      const hist = this.history[b.id];
      hist.push(this.prices[b.id]);
      if (hist.length > HISTORY_LEN) hist.shift();
      const ref = hist[Math.max(0, hist.length - 20)];
      this.deltas[b.id] = ref ? ((this.prices[b.id] - ref) / ref) * 100 : 0;
    }

    // Décompte des campagnes
    let changed = false;
    for (const c of this.campaigns) {
      c.secondsLeft -= TICK_MS / 1000;
      if (c.secondsLeft <= 0) changed = true;
    }
    if (changed) {
      const done = this.campaigns.filter((c) => c.secondsLeft <= 0);
      this.campaigns = this.campaigns.filter((c) => c.secondsLeft > 0);
      for (const c of done) {
        const board = this.getBoard(c.boardId);
        this.toast(`Campagne terminée sur ${board.name}`, 'info');
        this.emit('campaign-ended', c);
      }
    }

    this.emit('prices');
    if (changed) this.emit('campaigns');
    this.save();
  }

  earn() {
    this.credits += PASSIVE_INCOME;
    if (this.credits >= 2500) this.unlock('fortune');
    this.emit('credits', this.credits);
  }

  // --- Récompenses ------------------------------------------------------------

  unlock(id) {
    if (this.unlocked[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.unlocked[id] = true;
    this.credits += a.reward;
    this.emit('credits', this.credits);
    this.emit('rewards');
    this.toast(`Succès « ${a.name} » · +${a.reward} ¢R`, 'success');
    this.save();
  }

  getAchievements() {
    return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: !!this.unlocked[a.id] }));
  }

  dailyInfo() {
    const today = dayKey();
    const available = this.lastDaily !== today;
    // Série conservée si le dernier bonus date d'hier
    const yesterday = dayKey(Date.now() - 86400000);
    const nextStreak = this.lastDaily === yesterday ? this.streak + 1 : 1;
    const amount = 100 + 25 * (Math.min(available ? nextStreak : this.streak, 7) - 1);
    return { available, streak: this.streak, nextStreak, amount };
  }

  claimDaily() {
    const info = this.dailyInfo();
    if (!info.available) {
      this.toast('Bonus déjà récupéré aujourd\'hui — revenez demain', 'info');
      return;
    }
    this.streak = info.nextStreak;
    this.lastDaily = dayKey();
    this.credits += info.amount;
    this.emit('credits', this.credits);
    this.emit('rewards');
    this.toast(`Bonus quotidien +${info.amount} ¢R · série de ${this.streak} jour${this.streak > 1 ? 's' : ''}`, 'success');
    this.save();
  }

  // --- Accès ------------------------------------------------------------------

  getBoard(id) {
    return this.boards.find((b) => b.id === id);
  }

  price(id) {
    return this.prices[id];
  }

  campaignsFor(boardId) {
    return this.campaigns.filter((c) => c.boardId === boardId);
  }

  getAd(adId) {
    return this.ads.find((a) => a.id === adId);
  }

  campaignValue(c) {
    return Math.round((c.secondsLeft / 60) * this.prices[c.boardId] * SELLBACK_RATE);
  }

  // --- Actions joueur ---------------------------------------------------------

  addUserAd(def) {
    const ad = { ...def, id: uid(), createdAt: Date.now() };
    this.ads.push(ad);
    this.emit('ads');
    this.toast(`Pub « ${ad.name} » enregistrée dans votre portfolio`, 'success');
    this.unlock('first_ad');
    this.save();
    return ad;
  }

  deleteAd(adId) {
    if (this.campaigns.some((c) => c.adId === adId)) {
      this.toast('Impossible : cette pub est en cours de diffusion', 'error');
      return false;
    }
    this.ads = this.ads.filter((a) => a.id !== adId);
    this.emit('ads');
    this.save();
    return true;
  }

  quote(boardId, minutes) {
    return Math.round(this.prices[boardId] * minutes);
  }

  buy(boardId, adId, minutes) {
    const cost = this.quote(boardId, minutes);
    const board = this.getBoard(boardId);
    if (!this.getAd(adId)) {
      this.toast('Choisissez une pub à diffuser', 'error');
      return null;
    }
    if (cost > this.credits) {
      this.toast(`Crédits insuffisants (${cost} ¢R requis)`, 'error');
      return null;
    }
    this.credits -= cost;
    const campaign = {
      id: uid(),
      boardId,
      adId,
      secondsLeft: minutes * 60,
      total: minutes * 60,
      pricePaid: this.prices[boardId],
      cost,
    };
    this.campaigns.push(campaign);
    this.emit('credits', this.credits);
    this.emit('campaigns');
    this.toast(`En ondes ! ${minutes} min sur ${board.name} pour ${cost} ¢R`, 'success');
    this.unlock('first_buy');
    if (this.campaigns.length >= 3) this.unlock('triple');
    this.save();
    return campaign;
  }

  sell(campaignId) {
    const c = this.campaigns.find((x) => x.id === campaignId);
    if (!c) return;
    const value = this.campaignValue(c);
    const gain = value - Math.round((c.secondsLeft / c.total) * c.cost);
    this.campaigns = this.campaigns.filter((x) => x.id !== campaignId);
    this.credits += value;
    this.emit('credits', this.credits);
    this.emit('campaigns');
    const trend = gain >= 0 ? `plus-value de ${gain}` : `moins-value de ${-gain}`;
    this.toast(`Créneau revendu ${value} ¢R (${trend} ¢R)`, gain >= 0 ? 'success' : 'info');
    if (gain > 0) this.unlock('profit');
    this.save();
  }

  // --- Persistance --------------------------------------------------------------

  save() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            credits: this.credits,
            ads: this.ads,
            campaigns: this.campaigns,
            prices: this.prices,
            unlocked: this.unlocked,
            lastDaily: this.lastDaily,
            streak: this.streak,
          })
        );
      } catch {
        // quota dépassé : on continue sans persistance
      }
    }, 800);
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.credits === 'number') this.credits = s.credits;
      if (s.unlocked) this.unlocked = s.unlocked;
      if (s.lastDaily) this.lastDaily = s.lastDaily;
      if (typeof s.streak === 'number') this.streak = s.streak;
      if (Array.isArray(s.ads)) this.ads = s.ads;
      if (Array.isArray(s.campaigns)) {
        this.campaigns = s.campaigns.filter((c) => this.getBoard(c.boardId));
      }
      if (s.prices) {
        for (const b of this.boards) {
          if (typeof s.prices[b.id] === 'number') {
            this.prices[b.id] = s.prices[b.id];
            this.history[b.id] = [s.prices[b.id]];
          }
        }
      }
    } catch {
      // état corrompu : on repart de zéro
    }
  }
}

export const market = new Market();
