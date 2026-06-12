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

  /* ----------------------------------------------------------------------- */
  {
    id: "stop",
    title: "Panneau STOP",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [
      { type: "stop", col: 6, row: 6 }, // STOP sur l'approche du joueur
    ],
    vehicles: [
      {
        id: "cross",
        color: "#ff9f5a",
        // Circule sur la route croisée (vient de la droite, file vers la gauche)
        path: [[8, 4], [5, 4], [4, 4], [3, 4], [0, 4]],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [[5, 8], [5, 6], [5, 5], [5, 4], [5, 0]],
      },
    ],
    expectedOrder: ["cross", "player"],
    rule: {
      good:
        "Très bien ! Au panneau STOP, l'arrêt est OBLIGATOIRE (marquage des roues " +
        "à l'arrêt complet), puis tu cèdes le passage. Tu as laissé passer le " +
        "véhicule sur la route croisée avant de repartir.",
      bad:
        "Le panneau STOP impose de t'arrêter complètement et de céder le passage " +
        "à toute la circulation de la route croisée. Tu ne pouvais pas repartir " +
        "avant que l'autre véhicule soit passé.",
    },
    hint: "STOP : arrêt obligatoire. Qui passe pendant que tu es à l'arrêt ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "turn-left",
    title: "Tourner à gauche",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
    vehicles: [
      {
        id: "oncoming",
        color: "#ffce5a",
        // Arrive d'en face (du haut) et continue tout droit
        path: [[4, 0], [4, 3], [4, 4], [4, 5], [4, 8]],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Vient du bas et TOURNE À GAUCHE (vers l'ouest)
        path: [[5, 8], [5, 6], [5, 5], [4, 4], [2, 4], [0, 4]],
      },
    ],
    expectedOrder: ["oncoming", "player"],
    rule: {
      good:
        "Parfait ! Pour tourner à gauche, tu dois laisser passer les véhicules " +
        "qui arrivent en face et vont tout droit (ou tournent à leur droite). Tu " +
        "as attendu que la voie soit libre avant de virer.",
      bad:
        "En tournant à gauche, tu coupes la trajectoire des véhicules venant d'en " +
        "face : tu dois leur céder le passage. Il fallait laisser passer la " +
        "voiture d'en face avant de tourner.",
    },
    hint: "Tu veux tourner à gauche : qui coupes-tu en virant ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "emergency",
    title: "Véhicule prioritaire",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [
      { type: "priority", col: 6, row: 6 }, // le joueur est pourtant prioritaire…
    ],
    vehicles: [
      {
        id: "ambulance",
        color: "#f4f7ff",
        label: "SAMU",
        emergency: true, // gyrophare + sirène
        path: [[0, 5], [3, 5], [4, 5], [5, 5], [8, 5]],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [[5, 8], [5, 6], [5, 5], [5, 4], [5, 0]],
      },
    ],
    expectedOrder: ["ambulance", "player"],
    rule: {
      good:
        "Excellent réflexe ! Même avec une route prioritaire, on cède TOUJOURS le " +
        "passage à un véhicule d'intérêt général prioritaire en intervention " +
        "(gyrophare bleu + sirène). Tu l'as laissé passer avant de repartir.",
      bad:
        "Un véhicule prioritaire en intervention (gyrophare + sirène) prime sur " +
        "tout, même sur ta priorité ! Tu devais te ranger et le laisser passer " +
        "avant de t'engager.",
    },
    hint: "Gyrophare bleu et sirène… cela prime-t-il sur ta priorité ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "priority-right-mine",
    title: "Priorité à droite — à toi de passer",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
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
        // Arrive de la GAUCHE du joueur : c'est elle qui doit céder
        path: [[0, 5], [3, 5], [4, 5], [5, 5], [8, 5]],
      },
    ],
    expectedOrder: ["player", "left"],
    rule: {
      good:
        "Bien vu ! Sans signalisation, la priorité à droite s'applique. L'autre " +
        "voiture arrive sur ta GAUCHE : tu es donc à sa droite, c'est toi qui es " +
        "prioritaire. Tu passes en premier, sans hésiter.",
      bad:
        "Tu étais prioritaire ! L'autre véhicule venait de ta gauche : tu te " +
        "trouvais à sa droite, c'était donc à toi de passer en premier (priorité " +
        "à droite).",
    },
    hint: "L'autre vient de ta gauche… de quel côté es-tu pour elle ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "roundabout-enter",
    title: "Rond-point — s'engager",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 }, // accès est / ouest
      { col: 4, row: 0, w: 2, h: 9 }, // accès nord / sud
    ],
    roundabout: { cx: 4.5, cy: 4.5, rOuter: 2.3, rInner: 1.15 },
    signs: [
      { type: "yield", col: 6.0, row: 6.0 },       // cédez le passage
      { type: "roundabout", col: 6.8, row: 6.8 },  // sens giratoire
    ],
    vehicles: [
      {
        id: "ring",
        color: "#ffce5a",
        // Déjà engagée sur l'anneau, vient de l'ouest (à gauche du joueur),
        // tourne dans le sens anti-horaire et ressort à l'est.
        path: [
          [2.78, 4.5],  // ouest
          [3.28, 5.72], // sud-ouest
          [4.5, 6.23],  // sud
          [5.72, 5.72], // sud-est
          [6.23, 4.5],  // est
          [7.6, 4.5],
          [9.5, 4.5],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Arrive du sud, s'engage et ressort au nord (par la droite de l'îlot).
        path: [
          [5, 8.6],
          [5, 6.9],
          [4.5, 6.23],  // sud (entrée)
          [5.72, 5.72], // sud-est
          [6.23, 4.5],  // est
          [5.72, 3.28], // nord-est
          [4.5, 2.77],  // nord (sortie)
          [4.4, 1],
          [4.4, -0.6],
        ],
      },
    ],
    expectedOrder: ["ring", "player"],
    rule: {
      good:
        "Parfait ! À l'entrée d'un rond-point (sens giratoire), tu cèdes le " +
        "passage aux véhicules DÉJÀ engagés sur l'anneau, qui arrivent sur ta " +
        "gauche. Tu as attendu son passage avant de t'insérer.",
      bad:
        "Au sens giratoire, la priorité est à l'anneau : tu dois laisser passer " +
        "les véhicules déjà engagés (ils arrivent de ta gauche) avant de " +
        "t'insérer. Là, tu lui as coupé la route.",
    },
    hint: "Une voiture tourne déjà sur l'anneau, à ta gauche : qui est prioritaire ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "roundabout-inside",
    title: "Rond-point — tu y circules",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    roundabout: { cx: 4.5, cy: 4.5, rOuter: 2.3, rInner: 1.15 },
    signs: [
      { type: "yield", col: 6.6, row: 3.4 },       // cédez : pour la voiture qui entre
      { type: "roundabout", col: 7.3, row: 2.7 },
    ],
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Déjà sur l'anneau : du sud vers la sortie nord.
        path: [
          [4.5, 6.23],  // sud
          [5.72, 5.72], // sud-est
          [6.23, 4.5],  // est
          [5.72, 3.28], // nord-est
          [4.5, 2.77],  // nord (sortie)
          [4.4, 1],
          [4.4, -0.6],
        ],
      },
      {
        id: "entering",
        color: "#ff9f5a",
        // Veut s'insérer depuis l'accès est : doit céder le passage au joueur.
        // Circule ensuite dans le sens ANTI-HORAIRE (est → nord → ouest).
        path: [
          [8.6, 4.0],
          [7.0, 4.2],
          [6.23, 4.5],  // est (entrée) — point de conflit avec le joueur
          [5.72, 3.28], // nord-est
          [4.5, 2.77],  // nord
          [3.28, 3.28], // nord-ouest
          [2.78, 4.5],  // ouest
          [1.4, 4.5],
          [-0.6, 4.5],  // sortie ouest
        ],
      },
    ],
    expectedOrder: ["player", "entering"],
    rule: {
      good:
        "Très bien ! Une fois engagé sur l'anneau, c'est TOI qui es prioritaire " +
        "sur les véhicules qui veulent entrer. Tu as continué ta route, l'autre " +
        "voiture s'insère après ton passage.",
      bad:
        "Tu étais déjà sur l'anneau : tu avais la priorité ! Inutile de t'arrêter " +
        "pour celui qui veut entrer — c'est à lui de te céder le passage. Continue " +
        "ta trajectoire.",
    },
    hint: "Tu es déjà sur l'anneau et l'autre veut entrer : qui doit céder ?",
  },
];
