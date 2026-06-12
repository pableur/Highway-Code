/* =============================================================================
 *  SCÉNARIOS — Données du jeu (data-driven)
 * =============================================================================
 *
 *  Le moteur (game.js) est générique : il ne connaît rien des règles du code de
 *  la route. Toute la "connaissance" vit ici, sous forme de données.
 *
 *  Pour AJOUTER un scénario : ajoute un objet à la liste SCENARIOS ci-dessous.
 *
 *  Repère : la scène est une GRILLE de `cols` × `rows` cases.
 *  Les coordonnées sont toujours [colonne, ligne], origine en haut-à-gauche.
 *
 *  Champs d'un scénario :
 *  ---------------------------------------------------------------------------
 *  id            : identifiant unique (string)
 *  title         : titre affiché dans le sélecteur
 *  cols, rows    : dimensions de la grille
 *  roads         : liste de rectangles de route { col, row, w, h }
 *                  (w = largeur en cases, h = hauteur en cases)
 *  signs         : liste de panneaux { type, col, row }
 *                  type ∈ "yield" (cédez-le-passage), "stop", "priority"
 *  vehicles      : liste de véhicules
 *      { id, color, isPlayer?, path: [[col,row], ...] }
 *      - path : suite de cases parcourues. La 1re case = position de départ,
 *               la dernière = sortie de scène. L'orientation est déduite du path.
 *      - isPlayer : true pour la voiture incarnée par le joueur (mise en avant).
 *  expectedOrder : ordre CORRECT des clics, ex. ["left", "player"].
 *  rule          : { good, bad } textes pédagogiques affichés en fin de puzzle.
 *  hint          : indice court montré en temps réel après quelques secondes.
 * ===========================================================================*/

const SCENARIOS = [
  /* ----------------------------------------------------------------------- */
  {
    id: "yield-left",
    title: "Cédez le passage — voiture à gauche",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 }, // route horizontale (2 voies)
      { col: 4, row: 0, w: 2, h: 9 }, // route verticale (2 voies)
    ],
    signs: [
      // Cédez-le-passage sur l'approche du joueur (il vient du bas)
      { type: "yield", col: 6, row: 6 },
    ],
    vehicles: [
      {
        id: "left",
        color: "#ffce5a",
        // Vient de la GAUCHE, file vers la droite (voie du bas)
        path: [[0, 5], [3, 5], [4, 5], [5, 5], [8, 5]],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Vient du BAS, monte tout droit (voie de droite = colonne 5)
        path: [[5, 8], [5, 6], [5, 5], [5, 4], [5, 0]],
      },
    ],
    expectedOrder: ["left", "player"],
    rule: {
      good:
        "Parfait ! Face à un panneau « Cédez le passage », tu dois laisser " +
        "passer les véhicules circulant sur la route que tu croises. Tu as " +
        "laissé la voiture de gauche s'engager, puis tu t'es avancé sans risque.",
      bad:
        "Attention : avec un panneau « Cédez le passage », tu n'as pas la " +
        "priorité. Tu devais d'abord laisser passer la voiture qui circulait " +
        "sur la route croisée avant de t'engager.",
    },
    hint: "Tu as un « Cédez le passage » : qui doit passer en premier ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "priority-right",
    title: "Priorité à droite",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [], // aucun panneau : règle par défaut = priorité à droite
    vehicles: [
      {
        id: "right",
        color: "#ff9f5a",
        // Vient de la DROITE du joueur (donc de l'est), file vers la gauche
        path: [[8, 4], [5, 4], [4, 4], [3, 4], [0, 4]],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [[5, 8], [5, 6], [5, 5], [5, 4], [5, 0]],
      },
    ],
    expectedOrder: ["right", "player"],
    rule: {
      good:
        "Bravo ! En l'absence de panneau ou de feu, c'est la priorité à droite " +
        "qui s'applique. La voiture arrivait sur ta droite : tu devais la " +
        "laisser passer avant de continuer.",
      bad:
        "Raté : à une intersection sans signalisation, on cède le passage à " +
        "tout véhicule venant de sa droite. La voiture venait de ta droite, " +
        "elle était prioritaire.",
    },
    hint: "Aucun panneau ici… quelle règle s'applique par défaut ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "priority-road",
    title: "Tu es prioritaire",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [
      // Panneau « route prioritaire » pour le joueur
      { type: "priority", col: 6, row: 6 },
    ],
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [[5, 8], [5, 6], [5, 5], [5, 4], [5, 0]],
      },
      {
        id: "left",
        color: "#ffce5a",
        path: [[0, 5], [3, 5], [4, 5], [5, 5], [8, 5]],
      },
    ],
    // Ici, c'est le joueur qui passe en premier : il est prioritaire !
    expectedOrder: ["player", "left"],
    rule: {
      good:
        "Exact ! Le panneau « route prioritaire » (losange jaune) t'indique que " +
        "tu as la priorité. Inutile de t'arrêter : tu passes, puis l'autre " +
        "véhicule s'engage après toi.",
      bad:
        "Tu étais prioritaire ! Le losange jaune signale une route prioritaire : " +
        "c'était à toi de passer en premier, sans céder le passage.",
    },
    hint: "Ce losange jaune change tout : qui est prioritaire ?",
  },
];
