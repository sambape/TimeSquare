# TSX — Times Square Exchange

Times Square recréé en 3D temps réel dans le navigateur, où les écrans
publicitaires géants se tradent comme des actions.

![Stack](https://img.shields.io/badge/three.js-r182-049EF4) ![Vite](https://img.shields.io/badge/vite-6-646CFF)

## Le concept

- **Un monde 3D vivant** : canyon d'immeubles aux fenêtres allumées, la tour
  emblématique et ses trois écrans incurvés empilés, 16 panneaux
  publicitaires animés, taxis jaunes, asphalte mouillé avec reflets temps
  réel, brume, poussière lumineuse et bandeau boursier qui défile.
- **Une bourse de l'attention** : chaque écran est un actif coté en
  **¢R/minute d'antenne**. Le cours suit une marche aléatoire à retour vers
  la moyenne, dopée par la demande (plus un écran diffuse de campagnes, plus
  son cours grimpe).
- **Vos pubs dans la ville** : composez une pub néon (texte, dégradés) ou
  uploadez votre image dans le **Studio Pub**, puis achetez des minutes de
  diffusion sur l'écran de votre choix.
- **Tradez votre temps d'antenne** : revendez à tout moment le temps restant
  d'une campagne à 80 % du cours actuel. Acheté bas, revendu haut → plus-value.
- **Crédits** : vous démarrez avec 1 000 ¢R et gagnez 1 ¢R par seconde de
  présence dans le square. Tout est persisté en local (localStorage).

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
```

## Direction artistique & rendu

- Nuit permanente, palette néon assumée : cyan `#29f3ff`, magenta `#ff3da6`,
  ambre `#ffc24b` sur fond d'encre `#05060e`.
- Tone mapping **ACES Filmic** + **UnrealBloomPass** : seuls les écrans, néons
  et phares dépassent le seuil et irradient.
- Sol en **Reflector** (miroir temps réel) sous une couche d'asphalte percée
  de flaques procédurales : les écrans se reflètent dans la rue mouillée.
- Tous les visuels publicitaires sont dessinés en Canvas 2D (trame LED,
  vignette, reflet) et projetés en `CanvasTexture` — aucun asset externe.
- UI « salle des marchés » : verre dépoli, sparklines, ticker, typographies
  Unbounded / Space Grotesk.

## Architecture

```
src/
├── main.js               Rendu, post-processing, caméra, raycasting
├── scene/
│   ├── layout.js         Source de vérité : écrans + immeubles
│   ├── city.js           Décor, sol mouillé, lumières, skyline
│   ├── billboards.js     Écrans, playlists, ticker boursier 3D
│   └── traffic.js        Taxis en boucle
├── market/market.js      La bourse : cours, achats, reventes, persistance
├── ads/adFactory.js      Visuels Canvas 2D (marques fictives + pubs joueur)
└── ui/ui.js              Panneaux marché/fiche écran, studio, toasts
```

Le module `layout.js` est partagé par la scène 3D et la bourse : un écran
défini une fois existe à la fois comme objet du monde et comme actif coté.
