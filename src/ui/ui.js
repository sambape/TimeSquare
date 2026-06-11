// L'interface "salle des marchés" : barre du haut (crédits), panneau marché
// à droite (cours + sparklines), fiche écran à gauche (achat / revente),
// studio de création de pub, ticker bas et toasts.

import { market } from '../market/market.js';
import { drawAd, adLabel } from '../ads/adFactory.js';
import { SIZE_FACTORS } from '../scene/layout.js';

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function fmt(n) {
  return Math.round(n).toLocaleString('fr-FR');
}

function deltaBadge(d) {
  const cls = d >= 0 ? 'up' : 'down';
  const arrow = d >= 0 ? '▲' : '▼';
  return `<span class="delta ${cls}">${arrow} ${Math.abs(d).toFixed(1)}%</span>`;
}

function sparkline(canvas, data, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, color.replace(')', ',0.25)').replace('rgb', 'rgba'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = g;
  ctx.fill();
}

export function createUI({ onFocusBoard, onResetCamera }) {
  const root = $('#ui-root');
  let selectedBoardId = null;
  let buyMinutes = 5;
  let buyAdId = null;

  root.innerHTML = `
    <header id="topbar">
      <div class="brand"><span class="brand-mark">TSX</span> TIMES SQUARE EXCHANGE</div>
      <div class="top-actions">
        <div class="credits-chip" title="Vos crédits — vous gagnez 1 ¢R par seconde de présence">
          <span class="credits-label">CRÉDITS</span>
          <span id="credits-value">0</span><span class="unit">¢R</span>
        </div>
        <button id="studio-btn" class="btn btn-accent">+ STUDIO PUB</button>
        <button id="market-toggle" class="btn btn-ghost">MARCHÉ</button>
      </div>
    </header>

    <aside id="market-panel" class="panel">
      <div class="panel-head">
        <h2>MARCHÉ DES ÉCRANS</h2>
        <div class="panel-sub">¢R / minute d'antenne · cliquez pour viser l'écran</div>
      </div>
      <div id="market-list"></div>
    </aside>

    <aside id="board-panel" class="panel hidden">
      <button id="board-close" class="close-btn">✕</button>
      <div id="board-content"></div>
    </aside>

    <div id="hover-tip" class="hidden"></div>
    <div id="toasts"></div>

    <footer id="news-ticker"><div id="news-inner"></div></footer>

    <div id="studio-modal" class="modal hidden">
      <div class="modal-card">
        <button id="studio-close" class="close-btn">✕</button>
        <h2>STUDIO PUB</h2>
        <div class="studio-tabs">
          <button class="tab active" data-tab="text">COMPOSER</button>
          <button class="tab" data-tab="image">MON IMAGE</button>
        </div>
        <div class="studio-body">
          <div class="studio-form">
            <div data-pane="text">
              <label>Nom de la marque<input id="ad-text" maxlength="18" placeholder="MA MARQUE" /></label>
              <label>Accroche<input id="ad-sub" maxlength="36" placeholder="Le slogan qui claque" /></label>
              <div class="color-row">
                <label>Fond A<input type="color" id="ad-c1" value="#12002b" /></label>
                <label>Fond B<input type="color" id="ad-c2" value="#005066" /></label>
                <label>Texte<input type="color" id="ad-tc" value="#29f3ff" /></label>
              </div>
            </div>
            <div data-pane="image" class="hidden">
              <label class="file-label">
                <input type="file" id="ad-file" accept="image/*" />
                <span>Choisir une image…</span>
              </label>
              <div class="hint">L'image est recadrée plein écran et stockée localement.</div>
              <label>Nom de la pub<input id="ad-img-name" maxlength="24" placeholder="Ma campagne" /></label>
            </div>
          </div>
          <div class="studio-preview">
            <canvas id="ad-preview" width="512" height="256"></canvas>
            <div class="hint">Aperçu écran géant</div>
          </div>
        </div>
        <div class="modal-actions">
          <button id="ad-save" class="btn btn-accent">ENREGISTRER LA PUB</button>
        </div>
        <div id="my-ads">
          <h3>MON PORTFOLIO</h3>
          <div id="my-ads-list"></div>
        </div>
      </div>
    </div>
  `;

  // --- Crédits ---------------------------------------------------------------

  const creditsEl = $('#credits-value');
  let shownCredits = market.credits;
  setInterval(() => {
    shownCredits += (market.credits - shownCredits) * 0.25;
    if (Math.abs(market.credits - shownCredits) < 1) shownCredits = market.credits;
    creditsEl.textContent = fmt(shownCredits);
  }, 80);
  creditsEl.textContent = fmt(market.credits);

  // --- Liste du marché ---------------------------------------------------------

  const listEl = $('#market-list');
  const rows = new Map();

  for (const b of market.boards) {
    const row = el('div', 'market-row');
    row.innerHTML = `
      <div class="row-left">
        <span class="size-dot s-${b.size}">${b.size}</span>
        <span class="row-name">${b.name}</span>
      </div>
      <canvas class="spark" width="90" height="26"></canvas>
      <div class="row-right">
        <div class="row-price">— ¢</div>
        <div class="row-delta"></div>
      </div>`;
    row.addEventListener('click', () => selectBoard(b.id, true));
    listEl.appendChild(row);
    rows.set(b.id, row);
  }

  function refreshMarketList() {
    for (const b of market.boards) {
      const row = rows.get(b.id);
      const d = market.deltas[b.id];
      $('.row-price', row).textContent = `${market.price(b.id).toFixed(1)} ¢`;
      $('.row-delta', row).innerHTML = deltaBadge(d);
      sparkline($('.spark', row), market.history[b.id], d >= 0 ? 'rgb(54,255,160)' : 'rgb(255,80,120)');
      row.classList.toggle('selected', b.id === selectedBoardId);
    }
  }
  market.on('prices', refreshMarketList);
  refreshMarketList();

  $('#market-toggle').addEventListener('click', () => {
    $('#market-panel').classList.toggle('open');
  });

  // --- Fiche écran ---------------------------------------------------------------

  const boardPanel = $('#board-panel');
  const boardContent = $('#board-content');

  function selectBoard(id, focus) {
    selectedBoardId = id;
    if (focus) onFocusBoard(id);
    renderBoardPanel();
    refreshMarketList();
    boardPanel.classList.remove('hidden');
  }

  function closeBoardPanel() {
    selectedBoardId = null;
    boardPanel.classList.add('hidden');
    refreshMarketList();
    onResetCamera?.();
  }
  $('#board-close').addEventListener('click', closeBoardPanel);

  function renderBoardPanel() {
    const b = market.getBoard(selectedBoardId);
    if (!b) return;
    const price = market.price(b.id);
    const d = market.deltas[b.id];
    const camps = market.campaignsFor(b.id);
    const cost = market.quote(b.id, buyMinutes);
    const reach = Math.round(1200 * SIZE_FACTORS[b.size] * buyMinutes);

    boardContent.innerHTML = `
      <div class="board-head">
        <span class="size-dot s-${b.size}">${b.size}</span>
        <h2>${b.name}</h2>
      </div>
      <div class="board-price">
        <span class="big-price">${price.toFixed(1)}<span class="unit"> ¢R/min</span></span>
        <span class="delta-slot">${deltaBadge(d)}</span>
      </div>
      <canvas id="board-chart" width="290" height="70"></canvas>

      <h3>CAMPAGNES EN ONDES <span class="count">${camps.length}</span></h3>
      <div class="camp-list">
        ${camps.length === 0 ? '<div class="hint">Aucune campagne — l\'écran diffuse les marques de la ville.</div>' : ''}
        ${camps
          .map((c) => {
            const ad = market.getAd(c.adId);
            const mins = Math.ceil(c.secondsLeft / 60);
            const value = market.campaignValue(c);
            return `<div class="camp-row">
              <div>
                <div class="camp-name">${ad ? adLabel(ad) : '?'}</div>
                <div class="camp-meta">${mins} min restantes · payé ${c.pricePaid.toFixed(1)} ¢/min</div>
              </div>
              <button class="btn btn-sell" data-sell="${c.id}">REVENDRE ${value} ¢R</button>
            </div>`;
          })
          .join('')}
      </div>

      <h3>ACHETER UN CRÉNEAU</h3>
      <div class="buy-form">
        <label>Votre pub
          <select id="buy-ad">
            ${
              market.ads.length === 0
                ? '<option value="">— créez d\'abord une pub —</option>'
                : market.ads.map((a) => `<option value="${a.id}" ${a.id === buyAdId ? 'selected' : ''}>${adLabel(a)}</option>`).join('')
            }
          </select>
        </label>
        <label>Durée <strong id="buy-mins">${buyMinutes} min</strong>
          <input type="range" id="buy-range" min="1" max="30" value="${buyMinutes}" />
        </label>
        <div class="quote-row">
          <div><div class="quote-label">COÛT</div><div class="quote-value">${fmt(cost)} ¢R</div></div>
          <div><div class="quote-label">AUDIENCE EST.</div><div class="quote-value">${fmt(reach)} 👀</div></div>
        </div>
        ${
          market.ads.length === 0
            ? '<button class="btn btn-accent" id="goto-studio">CRÉER MA PREMIÈRE PUB</button>'
            : `<button class="btn btn-accent" id="buy-btn">ACHETER · ${fmt(cost)} ¢R</button>`
        }
        <div class="hint">Astuce bourse : achetez quand le cours est bas, revendez le temps restant quand il monte (-20% de frais).</div>
      </div>
    `;

    sparkline($('#board-chart'), market.history[b.id], d >= 0 ? 'rgb(54,255,160)' : 'rgb(255,80,120)');

    $('#buy-range')?.addEventListener('input', (e) => {
      buyMinutes = parseInt(e.target.value, 10);
      renderBoardPanel();
    });
    $('#buy-ad')?.addEventListener('change', (e) => { buyAdId = e.target.value; });
    $('#buy-btn')?.addEventListener('click', () => {
      const adId = $('#buy-ad').value || market.ads[0]?.id;
      market.buy(b.id, adId, buyMinutes);
      renderBoardPanel();
    });
    $('#goto-studio')?.addEventListener('click', openStudio);
    boardContent.querySelectorAll('[data-sell]').forEach((btn) =>
      btn.addEventListener('click', () => {
        market.sell(btn.dataset.sell);
      })
    );
  }

  market.on('campaigns', () => { if (selectedBoardId) renderBoardPanel(); });

  // Au tick des prix, on rafraîchit les chiffres sans reconstruire le DOM
  // (sinon le slider et le menu déroulant sauteraient en pleine manipulation).
  market.on('prices', () => {
    if (!selectedBoardId) return;
    const b = market.getBoard(selectedBoardId);
    const d = market.deltas[b.id];
    const priceEl = $('.big-price', boardContent);
    if (!priceEl) return;
    priceEl.innerHTML = `${market.price(b.id).toFixed(1)}<span class="unit"> ¢R/min</span>`;
    $('.board-price .delta-slot', boardContent).innerHTML = deltaBadge(d);
    sparkline($('#board-chart'), market.history[b.id], d >= 0 ? 'rgb(54,255,160)' : 'rgb(255,80,120)');
    const cost = market.quote(b.id, buyMinutes);
    const costEl = $('.quote-value', boardContent);
    if (costEl) costEl.textContent = `${fmt(cost)} ¢R`;
    const buyBtn = $('#buy-btn');
    if (buyBtn) buyBtn.textContent = `ACHETER · ${fmt(cost)} ¢R`;
  });

  // --- Studio ----------------------------------------------------------------------

  const modal = $('#studio-modal');
  let studioTab = 'text';
  let uploadedDataUrl = null;
  const previewCanvas = $('#ad-preview');

  function currentDraft() {
    if (studioTab === 'image') {
      return {
        kind: 'image',
        name: $('#ad-img-name').value.trim() || 'Ma campagne',
        dataUrl: uploadedDataUrl,
        id: 'draft',
      };
    }
    return {
      kind: 'text',
      name: $('#ad-text').value.trim() || 'MA MARQUE',
      text: $('#ad-text').value.trim() || 'MA MARQUE',
      sub: $('#ad-sub').value.trim(),
      c1: $('#ad-c1').value,
      c2: $('#ad-c2').value,
      tc: $('#ad-tc').value,
    };
  }

  let previewT = 0;
  setInterval(() => {
    if (modal.classList.contains('hidden')) return;
    previewT += 0.25;
    drawAd(previewCanvas.getContext('2d'), 512, 256, currentDraft(), previewT);
  }, 250);

  function openStudio() {
    modal.classList.remove('hidden');
    renderMyAds();
  }
  $('#studio-btn').addEventListener('click', openStudio);
  $('#studio-close').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  root.querySelectorAll('.studio-tabs .tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      studioTab = tab.dataset.tab;
      root.querySelectorAll('.studio-tabs .tab').forEach((t) => t.classList.toggle('active', t === tab));
      root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== studioTab));
    })
  );

  $('#ad-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      // Recompression pour tenir dans localStorage
      const max = 640;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      uploadedDataUrl = c.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    if (!$('#ad-img-name').value) $('#ad-img-name').value = file.name.replace(/\.[^.]+$/, '');
  });

  $('#ad-save').addEventListener('click', () => {
    const draft = currentDraft();
    if (draft.kind === 'image' && !draft.dataUrl) {
      market.toast('Choisissez une image avant d\'enregistrer', 'error');
      return;
    }
    delete draft.id;
    const ad = market.addUserAd(draft);
    buyAdId = ad.id;
    renderMyAds();
    if (selectedBoardId) renderBoardPanel();
  });

  function renderMyAds() {
    const list = $('#my-ads-list');
    if (market.ads.length === 0) {
      list.innerHTML = '<div class="hint">Encore aucune pub. La ville attend votre nom en lettres de néon.</div>';
      return;
    }
    list.innerHTML = '';
    for (const ad of market.ads) {
      const item = el('div', 'my-ad');
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 80;
      drawAd(c.getContext('2d'), 160, 80, ad, 1);
      item.appendChild(c);
      const meta = el('div', 'my-ad-meta', `<div>${adLabel(ad)}</div>`);
      const del = el('button', 'btn btn-ghost btn-xs', 'SUPPR.');
      del.addEventListener('click', () => {
        market.deleteAd(ad.id);
        renderMyAds();
        if (selectedBoardId) renderBoardPanel();
      });
      meta.appendChild(del);
      item.appendChild(meta);
      list.appendChild(item);
    }
  }
  market.on('ads', renderMyAds);

  // --- Ticker bas + toasts ------------------------------------------------------------

  const NEWS = [
    'TSX OUVRE LA SÉANCE DE NUIT',
    'LA TOUR · PARVIS RESTE L\'ÉCRAN LE PLUS DISPUTÉ',
    'RUMEUR : UN MYSTÉRIEUX ANNONCEUR ACHÈTE TOUT LE CÔTÉ EST',
    'LES TAXIS JAUNES EN GRÈVE DU KLAXON, LE SQUARE ENFIN SILENCIEUX',
    'MÉTÉO : PLUIE DE NÉONS TOUTE LA NUIT',
  ];
  function refreshNews() {
    const quotes = market.boards
      .slice(0, 8)
      .map((b) => `${b.name} ${market.price(b.id).toFixed(1)}¢ ${market.deltas[b.id] >= 0 ? '▲' : '▼'}`)
      .join(' · ');
    const line = `${quotes} · ${NEWS[Math.floor(Math.random() * NEWS.length)]} · `;
    $('#news-inner').textContent = line + line;
  }
  refreshNews();
  setInterval(refreshNews, 12000);

  market.on('toast', ({ msg, type }) => {
    const t = el('div', `toast toast-${type}`, msg);
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 3600);
  });

  // --- Tooltip 3D --------------------------------------------------------------------

  const tip = $('#hover-tip');
  function showTip(boardId, x, y) {
    const b = market.getBoard(boardId);
    if (!b) return hideTip();
    tip.innerHTML = `<strong>${b.name}</strong> · ${market.price(b.id).toFixed(1)} ¢/min ${deltaBadge(market.deltas[b.id])}`;
    tip.style.left = `${x + 14}px`;
    tip.style.top = `${y + 14}px`;
    tip.classList.remove('hidden');
  }
  function hideTip() {
    tip.classList.add('hidden');
  }

  return { selectBoard, showTip, hideTip };
}
