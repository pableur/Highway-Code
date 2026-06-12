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
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Vient du BAS, monte tout droit (voie de droite = colonne 5)
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
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
        path: [
          [8, 4],
          [5, 4],
          [4, 4],
          [3, 4],
          [0, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
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
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
      },
      {
        id: "left",
        color: "#ffce5a",
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
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
        path: [
          [8, 4],
          [5, 4],
          [4, 4],
          [3, 4],
          [0, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
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
        path: [
          [4, 0],
          [4, 3],
          [4, 4],
          [4, 5],
          [4, 8],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Vient du bas et TOURNE À GAUCHE (vers l'ouest)
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [4, 4],
          [2, 4],
          [0, 4],
        ],
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
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
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
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
      },
      {
        id: "left",
        color: "#ffce5a",
        // Arrive de la GAUCHE du joueur : c'est elle qui doit céder
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
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
      { type: "yield", col: 6.0, row: 6.0 }, // cédez le passage
      { type: "roundabout", col: 6.8, row: 6.8 }, // sens giratoire
    ],
    vehicles: [
      {
        id: "ring",
        color: "#ffce5a",
        // Déjà engagée sur l'anneau, vient de l'ouest (à gauche du joueur),
        // tourne dans le sens anti-horaire et ressort à l'est.
        path: [
          [2.78, 4.5], // ouest
          [3.28, 5.72], // sud-ouest
          [4.5, 6.23], // sud
          [5.72, 5.72], // sud-est
          [6.23, 4.5], // est
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
          [4.5, 6.23], // sud (entrée)
          [5.72, 5.72], // sud-est
          [6.23, 4.5], // est
          [5.72, 3.28], // nord-est
          [4.5, 2.77], // nord (sortie)
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
      { type: "yield", col: 6.6, row: 3.4 }, // cédez : pour la voiture qui entre
      { type: "roundabout", col: 7.3, row: 2.7 },
    ],
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Déjà sur l'anneau : du sud vers la sortie nord.
        path: [
          [4.5, 6.23], // sud
          [5.72, 5.72], // sud-est
          [6.23, 4.5], // est
          [5.72, 3.28], // nord-est
          [4.5, 2.77], // nord (sortie)
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
          [6.23, 4.5], // est (entrée) — point de conflit avec le joueur
          [5.72, 3.28], // nord-est
          [4.5, 2.77], // nord
          [3.28, 3.28], // nord-ouest
          [2.78, 4.5], // ouest
          [1.4, 4.5],
          [-0.6, 4.5], // sortie ouest
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

  /* =======================================================================
   *  SCÉNARIOS DE VITESSE  (kind: "speed")
   *  La voiture roule toute seule ; le joueur FREINE / ACCÉLÈRE pour franchir
   *  la ligne d'entrée à une vitesse <= `entry.limit`.
   *  Champs spécifiques :
   *    startSpeed : vitesse initiale (km/h)
   *    city       : { fromCol } — colonne à partir de laquelle on dessine la ville
   *    entry      : { col, limit, sign } — ligne d'entrée + limite + panneau
   *                 sign = { type:"agglo", name } | { type:"limit", value }
   * =====================================================================*/
  {
    id: "city-entry",
    kind: "speed",
    title: "Entrée en agglomération",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2 }],
    signs: [],
    city: { fromCol: 7 },
    entry: { col: 7, limit: 50, sign: { type: "agglo", name: "SAINT-CLAIR" } },
    startSpeed: 90,
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [-1.2, 4],
          [14, 4],
        ],
      },
    ],
    rule: {
      good:
        "Parfait ! Le panneau d'entrée d'agglomération (nom de la ville sur fond " +
        "clair) impose une vitesse de 50 km/h par défaut. Tu as ralenti à temps " +
        "avant la ligne d'entrée.",
      bad:
        "Excès de vitesse ! Dès le panneau d'agglomération, la limite passe à " +
        "50 km/h (sauf indication contraire). Il fallait freiner AVANT d'entrer " +
        "dans la ville.",
    },
    hint: "Panneau de ville en vue : à quelle vitesse roule-t-on en agglomération ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "zone-30",
    kind: "speed",
    title: "Zone 30 — école",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2 }],
    signs: [],
    city: { fromCol: 0 }, // déjà en ville
    entry: { col: 7, limit: 30, sign: { type: "limit", value: 30 } },
    startSpeed: 50,
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [-1.2, 4],
          [14, 4],
        ],
      },
    ],
    rule: {
      good:
        "Bien joué ! Le panneau rond cerclé de rouge « 30 » impose 30 km/h, " +
        "typique des abords d'école et des zones de rencontre. Tu as adapté ta " +
        "vitesse pour la sécurité des piétons.",
      bad:
        "Trop vite ! Le disque rouge « 30 » limite la vitesse à 30 km/h. Près " +
        "d'une école, ralentir est essentiel pour la sécurité des enfants.",
    },
    hint: "Un disque rouge avec « 30 » : quelle vitesse maximale impose-t-il ?",
  },

  /* =======================================================================
   *  FEUX TRICOLORES, PIÉTONS, CLASSES DE VÉHICULES  (kind: "order")
   *  Nouveaux champs facultatifs :
   *    lights     : [{ col, row, state: "red"|"orange"|"green"|"off" }]
   *    crosswalks : [{ col, row, w, h }]  (passage piéton, zébra)
   *    tracks     : [{ col, row, w, h }]  (voie ferrée)
   *    weather    : "rain"                (overlay pluie, scénarios vitesse)
   *  Sur un véhicule : vClass = "bus"|"truck"|"bike"|"train"|"pedestrian",
   *                    speedMul (multiplicateur de vitesse, ex. train rapide).
   * =====================================================================*/
  {
    id: "feu-vert",
    title: "Feu vert — tu passes",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
    lights: [
      { col: 6.2, row: 6.2, state: "green" }, // ton feu : vert
      { col: 2.8, row: 2.8, state: "red" }, // feu transversal : rouge
    ],
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
      },
      {
        id: "cross",
        color: "#ffce5a",
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
      },
    ],
    expectedOrder: ["player"], // tu passes ; l'autre a rouge et attend
    rule: {
      good:
        "Parfait ! Ton feu est vert : tu passes sans t'arrêter. Le véhicule de " +
        "la voie transversale a le feu rouge, c'est à lui d'attendre.",
      bad:
        "Ton feu était vert : tu avais la priorité ! Inutile de laisser passer " +
        "celui qui a le rouge — c'était à toi d'avancer.",
    },
    hint: "Regarde la couleur de TON feu : que t'autorise-t-il ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "feu-rouge",
    title: "Feu rouge — tu t'arrêtes",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
    lights: [
      { col: 6.2, row: 6.2, state: "red" }, // ton feu : rouge
      { col: 2.8, row: 2.8, state: "green" }, // feu transversal : vert
    ],
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
      },
      {
        id: "cross",
        color: "#ffce5a",
        path: [
          [0, 5],
          [3, 5],
          [4, 5],
          [5, 5],
          [8, 5],
        ],
      },
    ],
    expectedOrder: ["cross"], // tu restes à l'arrêt, l'autre (vert) passe
    rule: {
      good:
        "Bien joué ! Ton feu est rouge : tu t'arrêtes et tu laisses passer la " +
        "circulation qui a le vert. On ne franchit jamais un feu rouge.",
      bad:
        "Tu as grillé le feu rouge ! Quand ton feu est rouge, tu dois t'arrêter " +
        "et laisser passer les véhicules dont le feu est vert.",
    },
    hint: "Ton feu est rouge : as-tu le droit d'avancer ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "feu-en-panne",
    title: "Feu en panne — priorité à droite",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
    lights: [{ col: 6.2, row: 6.2, state: "off" }], // hors service (orange clignotant)
    vehicles: [
      {
        id: "right",
        color: "#ff9f5a",
        // Vient de ta droite (de l'est), file vers l'ouest
        path: [
          [8, 4],
          [5, 4],
          [4, 4],
          [3, 4],
          [0, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 6],
          [5, 5],
          [5, 4],
          [5, 0],
        ],
      },
    ],
    expectedOrder: ["right", "player"],
    rule: {
      good:
        "Excellent ! Quand un feu est en panne (éteint ou orange clignotant), il " +
        "ne donne plus la priorité : on applique la priorité à droite. La voiture " +
        "venait de ta droite, tu l'as laissée passer.",
      bad:
        "Feu hors service = retour à la priorité à droite ! La voiture arrivait " +
        "sur ta droite : elle était prioritaire, il fallait la laisser passer.",
    },
    hint: "Le feu clignote orange (en panne) : quelle règle prend le relais ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "passage-pieton",
    title: "Passage piéton",
    cols: 9,
    rows: 9,
    roads: [{ col: 4, row: 0, w: 2, h: 9 }],
    signs: [],
    crosswalks: [{ col: 4, row: 6, w: 2, h: 1 }],
    vehicles: [
      {
        id: "pieton",
        color: "#ffd21e",
        vClass: "pedestrian",
        speedMul: 0.55, // un piéton marche, il ne fonce pas
        // Traverse de gauche à droite sur le passage (rangée 6)
        path: [
          [3, 6.5],
          [4.5, 6.5],
          [6, 6.5],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8],
          [5, 7],
          [5, 6],
          [5, 5],
          [5, 0],
        ],
      },
    ],
    expectedOrder: ["pieton", "player"],
    rule: {
      good:
        "Parfait ! Tu dois t'arrêter pour laisser traverser un piéton engagé (ou " +
        "qui manifeste son intention de traverser) sur un passage piéton. Tu as " +
        "attendu qu'il finisse de traverser.",
      bad:
        "Danger ! Sur un passage piéton, le piéton est prioritaire. Tu devais " +
        "t'arrêter et le laisser traverser avant d'avancer.",
    },
    hint: "Un piéton traverse sur les bandes blanches : qui passe en premier ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "bus-arret",
    title: "Bus qui quitte son arrêt",
    cols: 11,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 11, h: 2 }],
    signs: [],
    vehicles: [
      {
        id: "bus",
        color: "#e0533a",
        vClass: "bus",
        label: "BUS",
        blinker: "left", // signale qu'il se réinsère
        // Quitte un arrêt (en contrebas) et se réinsère dans la circulation
        path: [
          [4, 5.4],
          [5, 4.4],
          [6, 4],
          [8, 4],
          [11, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [0.5, 4],
          [2, 4],
          [4.5, 4],
          [7, 4],
          [11, 4],
        ],
      },
    ],
    expectedOrder: ["bus", "player"],
    rule: {
      good:
        "Bien vu ! En agglomération, tu dois céder le passage à un bus qui " +
        "signale son intention de quitter son arrêt. Tu l'as laissé se réinsérer.",
      bad:
        "En ville, un bus qui remet son clignotant pour quitter son arrêt est " +
        "prioritaire pour se réinsérer. Il fallait le laisser partir avant toi.",
    },
    hint: "Le bus clignote pour quitter son arrêt en ville : qui est prioritaire ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "tourne-droite-velo",
    title: "Tourner à droite & cycliste",
    cols: 9,
    rows: 9,
    roads: [
      { col: 0, row: 4, w: 9, h: 2 },
      { col: 4, row: 0, w: 2, h: 9 },
    ],
    signs: [],
    vehicles: [
      {
        id: "velo",
        color: "#3ddc6a",
        vClass: "bike",
        label: "🚲",
        // Continue tout droit sur la bande cyclable (à droite), du bas vers le haut
        path: [
          [5.4, 8.3],
          [5.4, 5],
          [5.4, 1],
          [5.4, -0.5],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        // Tourne à droite : du bas vers l'est
        path: [
          [5, 8.3],
          [5, 6],
          [5, 5],
          [6, 5],
          [8, 5],
        ],
      },
    ],
    expectedOrder: ["velo", "player"],
    rule: {
      good:
        "Parfait ! Avant de tourner à droite, tu dois céder le passage aux " +
        "cyclistes qui circulent tout droit sur la bande cyclable à ta droite. " +
        "Tu as laissé passer le vélo avant de tourner.",
      bad:
        "Attention au cycliste ! En tournant à droite, tu coupes la bande " +
        "cyclable : il fallait laisser passer le vélo qui allait tout droit.",
    },
    hint: "Un vélo va tout droit à ta droite et tu veux tourner à droite : qui d'abord ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "passage-niveau",
    title: "Passage à niveau",
    cols: 9,
    rows: 9,
    roads: [{ col: 4, row: 0, w: 2, h: 9 }],
    tracks: [{ col: 0, row: 2, w: 9, h: 1.2 }],
    signs: [
      { type: "railway", col: 2.7, row: 4.2 }, // croix de Saint-André + feux
      { type: "railway", col: 7.3, row: 4.2 },
    ],
    vehicles: [
      {
        id: "train",
        color: "#2c3550",
        vClass: "train",
        label: "🚆",
        speedMul: 2.6, // le train arrive vite
        // row 2.1 = centre des rails (voie dessinée de row 2 à 3.2, centre à 2.6
        // en pixels ; comme les véhicules sont centrés sur la case, row = 2.1).
        path: [
          [0.6, 2.1],
          [3, 2.1],
          [5, 2.1],
          [11, 2.1],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [5, 8.3],
          [5, 4],
          [5, 2.1],
          [5, 1],
          [5, -0.5],
        ],
      },
    ],
    expectedOrder: ["train", "player"],
    rule: {
      good:
        "Parfait ! À un passage à niveau, on ne s'engage jamais tant qu'un train " +
        "approche ou que les barrières sont baissées. Tu as attendu le passage du " +
        "train avant de traverser.",
      bad:
        "Très dangereux ! On ne franchit jamais un passage à niveau quand un train " +
        "arrive. Il fallait attendre qu'il soit passé avant de t'engager.",
    },
    hint: "Un train arrive sur la voie ferrée : peux-tu t'engager maintenant ?",
  },

  /* =======================================================================
   *  NOUVEAUX SCÉNARIOS DE VITESSE
   * =====================================================================*/
  {
    id: "pluie-autoroute",
    title: "Autoroute sous la pluie",
    kind: "speed",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2 }],
    signs: [],
    weather: "rain",
    entry: { col: 7, limit: 110, sign: { type: "limit", value: 110 } },
    startSpeed: 130,
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [-1.2, 4],
          [14, 4],
        ],
      },
    ],
    rule: {
      good:
        "Bien joué ! Par temps de pluie, la vitesse maximale sur autoroute passe " +
        "de 130 à 110 km/h (et de 110 à 100, de 90 à 80…). Tu as adapté ton allure.",
      bad:
        "Trop vite pour la pluie ! Sur autoroute, la limite tombe à 110 km/h en " +
        "cas de précipitations. L'adhérence et la visibilité sont réduites.",
    },
    hint: "Il pleut sur l'autoroute : quelle est la vitesse maximale autorisée ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "zone-travaux",
    title: "Zone de travaux",
    kind: "speed",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2 }],
    signs: [],
    entry: { col: 7, limit: 70, sign: { type: "limit", value: 70 } },
    startSpeed: 90,
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        path: [
          [-1.2, 4],
          [14, 4],
        ],
      },
    ],
    rule: {
      good:
        "Parfait ! Une zone de travaux impose une limitation temporaire (ici 70 " +
        "km/h). On ralentit pour la sécurité des ouvriers et à cause des voies " +
        "rétrécies.",
      bad:
        "Trop vite en zone de travaux ! La limitation temporaire (70 km/h) doit " +
        "être respectée : chaussée rétrécie, ouvriers à proximité.",
    },
    hint: "Panneau de limitation en zone de chantier : à quelle vitesse rouler ?",
  },

  /* =======================================================================
   *  CHOIX (kind: "choice") — choisir la bonne réponse parmi des options
   *  Champs : question, options:[{label, correct}], + ambiance facultative
   *  ("night"|"fog"|"tunnel"). Les véhicules sont du décor (idle:true).
   * =====================================================================*/
  {
    id: "feux-nuit",
    kind: "choice",
    title: "Feux — conduite de nuit",
    cols: 11,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 11, h: 2 }],
    ambiance: "night",
    vehicles: [
      {
        id: "ahead",
        color: "#ffce5a",
        idle: true,
        path: [
          [7, 4],
          [7, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        idle: true,
        path: [
          [3, 4],
          [3, 4],
        ],
      },
    ],
    question:
      "De nuit, tu suis une voiture à courte distance. Quels feux utilises-tu ?",
    options: [
      { label: "Feux de croisement", icons: ["croisement"], correct: true },
      { label: "Feux de route", icons: ["route"], correct: false },
      { label: "Feux de position", icons: ["position"], correct: false },
    ],
    rule: {
      good:
        "Bravo ! De nuit, dès qu'on suit ou qu'on croise un véhicule, on passe " +
        "en feux de croisement pour ne pas éblouir. Les feux de route sont " +
        "réservés à la route libre et bien dégagée.",
      bad:
        "Derrière un véhicule, les feux de route l'éblouissent par ses " +
        "rétroviseurs : il faut les feux de croisement. Les feux de position " +
        "seuls ne permettent pas de bien voir.",
    },
    hint: "Tu es juste derrière une voiture : que provoquent les pleins phares ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "feux-brouillard",
    kind: "choice",
    title: "Feux — brouillard",
    cols: 11,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 11, h: 2 }],
    ambiance: "fog",
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        idle: true,
        path: [
          [4, 4],
          [4, 4],
        ],
      },
    ],
    multi: true,
    question:
      "Brouillard épais en plein jour. Allume les bons feux, puis valide.",
    options: [
      { id: "position", label: "Feux de position", icons: ["position"] },
      { id: "croisement", label: "Feux de croisement", icons: ["croisement"] },
      { id: "route", label: "Feux de route", icons: ["route"] },
      {
        id: "brouillard-av",
        label: "Feux de brouillard avant",
        icons: ["brouillard-av"],
      },
    ],
    answer: ["croisement", "brouillard-av"],
    rule: {
      good:
        "Parfait ! Par brouillard, on utilise les feux de croisement complétés " +
        "par les feux de brouillard (avant ; arrière si visibilité < 50 m). Les " +
        "feux de route sont renvoyés par les gouttelettes et éblouissent.",
      bad:
        "Surtout pas les pleins phares dans le brouillard : leur lumière est " +
        "réfléchie et réduit encore la visibilité. On utilise feux de croisement " +
        "+ feux de brouillard.",
    },
    hint: "Que deviennent les pleins phares face au brouillard ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "tunnel",
    kind: "choice",
    title: "Tunnel",
    cols: 11,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 11, h: 2 }],
    ambiance: "tunnel",
    vehicles: [
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        idle: true,
        path: [
          [4, 4],
          [4, 4],
        ],
      },
    ],
    question:
      "Tu entres dans un tunnel, en plein jour. Quels feux allumes-tu ?",
    options: [
      { label: "Feux de croisement", icons: ["croisement"], correct: true },
      { label: "Aucun feu", icons: ["none"], correct: false },
      { label: "Feux de route", icons: ["route"], correct: false },
    ],
    rule: {
      good:
        "Exact ! Les feux de croisement sont obligatoires dans un tunnel, même " +
        "de jour, pour être vu et bien voir.",
      bad:
        "Dans un tunnel, les feux de croisement sont obligatoires même de jour. " +
        "Sans feux on est quasi invisible ; les pleins phares peuvent gêner.",
    },
    hint: "Un tunnel reste sombre même de jour : que dit la règle ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "depassement-interdit",
    kind: "choice",
    title: "Dépassement — ligne continue",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2, line: "solid" }],
    ambiance: "road",
    vehicles: [
      {
        id: "tracteur",
        color: "#7bd14f",
        vClass: "truck",
        label: "🚜",
        idle: true,
        path: [
          [8, 4],
          [8, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        idle: true,
        path: [
          [3, 4],
          [3, 4],
        ],
      },
    ],
    question:
      "Tracteur lent devant toi, ligne médiane CONTINUE. Clique sur la flèche : rester derrière ou déboîter ?",
    arrows: [
      {
        id: "stay",
        path: [
          [4.6, 4],
          [6.8, 4],
        ],
        move: [
          [3, 4],
          [6.3, 4],
        ], // avance et s'arrête derrière le tracteur
        correct: true,
      },
      {
        id: "overtake",
        path: [
          [4, 4],
          [5.6, 3],
          [8.6, 3],
        ],
        move: [
          [3, 4],
          [4.8, 3],
          [7, 3],
          [9.2, 3],
          [10.6, 4],
          [13, 4],
        ],
        correct: false,
      },
    ],
    rule: {
      good:
        "Bien vu ! Une ligne blanche continue interdit le dépassement, et il est " +
        "interdit de la franchir ou de la chevaucher. On patiente derrière.",
      bad:
        "Une ligne continue interdit le dépassement, même si la voie d'en face " +
        "paraît libre : on ne la franchit jamais. Il faut rester derrière.",
    },
    hint: "Observe la ligne médiane : continue ou discontinue ?",
  },

  /* ----------------------------------------------------------------------- */
  {
    id: "depassement-autorise",
    kind: "choice",
    title: "Dépassement — ligne discontinue",
    cols: 13,
    rows: 7,
    roads: [{ col: 0, row: 3, w: 13, h: 2, line: "dashed" }],
    ambiance: "road",
    vehicles: [
      {
        id: "tracteur",
        color: "#7bd14f",
        vClass: "truck",
        label: "🚜",
        idle: true,
        path: [
          [8, 4],
          [8, 4],
        ],
      },
      {
        id: "player",
        color: "#4f8cff",
        isPlayer: true,
        idle: true,
        path: [
          [3, 4],
          [3, 4],
        ],
      },
    ],
    question:
      "Tracteur lent devant toi, ligne DISCONTINUE, voie d'en face dégagée. Clique sur la flèche : rester derrière ou déboîter ?",
    arrows: [
      {
        id: "stay",
        path: [
          [4.6, 4],
          [6.8, 4],
        ],
        move: [
          [3, 4],
          [6.3, 4],
        ],
        correct: false,
      },
      {
        id: "overtake",
        path: [
          [4, 4],
          [5.6, 3],
          [8.6, 3],
        ],
        move: [
          [3, 4],
          [4.8, 3],
          [7, 3],
          [9.2, 3],
          [10.6, 4],
          [13, 4],
        ],
        correct: true,
      },
    ],
    rule: {
      good:
        "Exact ! Ligne discontinue + bonne visibilité + voie libre : le " +
        "dépassement est autorisé. Pense au clignotant et à t'écarter " +
        "suffisamment du véhicule dépassé.",
      bad:
        "Ici tout est réuni pour dépasser : ligne discontinue, visibilité et voie " +
        "libres. Rester indéfiniment derrière un véhicule lent n'est pas justifié.",
    },
    hint: "Ligne discontinue et voie libre : qu'autorise cette ligne ?",
  },
];
