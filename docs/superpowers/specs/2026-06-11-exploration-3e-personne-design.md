# Exploration à la 3e personne — avatar, collisions, nature, ciel

**Date** : 2026-06-11 · **Statut** : validé en mode autonome (demande utilisateur explicite)

## Demande

- Ne plus pouvoir passer à travers les murs (collisions).
- Scène Three.js beaucoup plus jolie et plus grande.
- Incarner un bonhomme et pouvoir se déplacer.
- Ajouter des arbres, la nature, le ciel.

## Design

### Avatar et contrôles (`src/scene/player.js`)

Bonhomme low-poly procédural (~1,75 u) : veste jaune NYC à bandes
réfléchissantes émissives (lisible de nuit), bonnet rouge, animation de
marche procédurale (balancement bras/jambes, rebond). Déplacement par
touches physiques `KeyW/A/S/D` (= ZQSD sur AZERTY, WASD sur QWERTY) +
flèches ; Shift = courir ; Espace = sauter (gravité simple). Le
personnage s'oriente vers sa direction de déplacement (lissage
angulaire).

Caméra 3e personne : orbite autour du joueur au drag souris, zoom
molette (3–26 u), pitch borné. Le clic sur un écran conserve le focus
cinématique existant (tween) ; tout déplacement ramène la caméra au
joueur. La caméra est repoussée hors des volumes de collision (résolution
2D, rayon 0,8) pour ne pas traverser les façades.

### Collisions (`src/scene/collision.js`)

Monde 2D : cercle joueur (r ≈ 0,45) résolu par poussée (3 itérations)
contre des AABB (immeubles, tour, jardinières, étang), des boîtes
tournées (immeubles d'angle du bowtie) et des cercles (arbres,
lampadaires, bornes, poteaux). Limites du monde rectangulaires.
`groundHeightAt(x, z)` rend le sol praticable en hauteur : trottoirs
(0,5), parvis (0,4), marches rouges (escalier montable), reste à 0.
Les voitures poussent doucement le joueur (cercle mobile) au lieu de le
traverser.

### Nature et ciel (`src/scene/nature.js`)

- Dôme de ciel en shader (dégradé nuit profonde → horizon urbain ambré),
  ~900 étoiles scintillantes (Points), lune émissive avec halo sprite,
  quelques nuages dérivants discrets (sprites canvas, très faible alpha).
- Parc au sud de la rue (z ≈ 95 → 185, pleine largeur) : pelouse, chemin
  sinueux clair, étang sombre brillant, ~50 arbres low-poly (troncs +
  3 blobs de feuillage, InstancedMesh ×2 pour la perf), bancs,
  guirlandes lumineuses entre poteaux (Points émissifs), lucioles.
- Arbres en jardinières le long des trottoirs de la place.

### Monde agrandi (`layout.js`, `city.js`)

Rue prolongée au sud jusqu'au parc, sol de base élargi (~300×420), le
miroir (Reflector) reste limité à la zone rue pour la perf. Skyline
repoussée et densifiée, lampadaires le long de la rue prolongée et du
chemin du parc, brouillard ajusté à la nouvelle profondeur.

### Intégration (`main.js`, `index.html`, `style.css`)

OrbitControls remplacés par le rig 3e personne. Raycast hover/clic des
écrans conservé, marché/UI inchangés. Splash mis à jour + petite carte
de contrôles en bas à gauche. L'intro « Entrer sur la place » devient un
travelling qui descend se placer derrière l'avatar.

## Non-objectifs

Pas de modèle GLTF externe, pas de physique verticale complète (pas de
chute depuis les toits), pas de collision caméra par raycast exact, pas
de multijoueur.
