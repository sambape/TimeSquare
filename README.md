# TSX — Times Square Exchange

Times Square recréé en 3D temps réel dans le navigateur, où les écrans
publicitaires géants se tradent comme des actions.

![Stack](https://img.shields.io/badge/three.js-r182-049EF4) ![Vite](https://img.shields.io/badge/vite-6-646CFF)

## Le concept

- **Un monde 3D vivant, à pied** : vous incarnez un petit new-yorkais en
  veste jaune (ZQSD/WASD pour marcher, Maj pour courir, Espace pour sauter,
  souris pour la caméra, molette pour zoomer). Collisions avec les façades
  et le mobilier, marches rouges montables, taxis qui vous écartent doucement.
- **La place** : ses marches rouges emblématiques, la tour et ses trois
  écrans incurvés empilés, deux écrans d'angle enroulés autour des immeubles
  du bowtie, 16 panneaux animés au total, asphalte mouillé avec reflets
  temps réel, brume et bandeau boursier qui défile.
- **Un parc au bout de l'avenue** : pelouse, chemin sinueux, étang-miroir,
  arbres low-poly, bancs, guirlandes lumineuses et lucioles — sous un dôme
  de ciel étoilé avec lune et nuages dérivants.
- **Plusieurs places à terme** : Times Square est jouable ; Piccadilly
  Circus (Londres) et Chinatown (San Francisco) sont annoncées dans le
  sélecteur de places — même marché, autres écrans.
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
  présence dans le square, plus un **bonus quotidien avec série** et des
  **succès** récompensés (première pub, première plus-value, etc.). Les
  crédits ne s'achètent pas : ils se gagnent. Tout est persisté en local
  (localStorage).

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
```

## Direction artistique & rendu

- La scène fait le spectacle, l'interface s'efface : UI minimaliste claire
  (cartes blanches, traits fins, typographie Inter, un seul accent rouge
  `#e63312`), aucun glow côté DOM.
- Nuit permanente côté 3D : tone mapping **ACES Filmic** +
  **UnrealBloomPass** discret — seuls les écrans et les phares irradient.
- Sol en **Reflector** (miroir temps réel) sous une couche d'asphalte percée
  de flaques procédurales : les écrans se reflètent dans la rue mouillée.
- Détails de place : marches rouges, bollards, passages piétons, fenêtres
  atténuées, trafic réduit — l'attention reste sur les écrans.
- Tous les visuels publicitaires sont dessinés en Canvas 2D (trame LED,
  vignette, reflet) et projetés en `CanvasTexture` — aucun asset externe.

## Architecture

```
src/
├── main.js               Rendu, post-processing, raycasting, liaison scène/UI
├── scene/
│   ├── layout.js         Source de vérité : écrans, immeubles, rue, parc
│   ├── city.js           Décor, sol mouillé, lumières, skyline
│   ├── billboards.js     Écrans, playlists, ticker boursier 3D
│   ├── traffic.js        Taxis en boucle (et qui écartent le piéton)
│   ├── collision.js      Monde de collision 2D + hauteur du sol praticable
│   ├── player.js         Le bonhomme : avatar, contrôles, caméra d'épaule
│   └── nature.js         Ciel, lune, étoiles, nuages, parc, arbres, étang
├── market/market.js      La bourse : cours, achats, reventes, persistance
├── ads/adFactory.js      Visuels Canvas 2D (marques fictives + pubs joueur)
└── ui/ui.js              Panneaux marché/fiche écran, studio, toasts
```

Le module `layout.js` est partagé par la scène 3D et la bourse : un écran
défini une fois existe à la fois comme objet du monde et comme actif coté.
