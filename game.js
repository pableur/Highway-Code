/* =============================================================================
 *  MOTEUR DE JEU — générique, data-driven (voir scenarios.js)
 * =============================================================================
 *  Responsabilités :
 *   - dessiner une scène (grille, routes, panneaux, véhicules) au Canvas 2D
 *   - animer le déplacement des véhicules le long de leur `path`
 *   - gérer les clics et valider l'ordre attendu (expectedOrder)
 *   - fournir des indices en temps réel + un feedback pédagogique
 * ===========================================================================*/

(() => {
  "use strict";

  // --- Constantes de rendu ---------------------------------------------------
  const CELL = 64; // taille d'une case en pixels
  const CAR_LEN = CELL * 0.74; // longueur d'une voiture
  const CAR_W = CELL * 0.42; // largeur d'une voiture
  const DRIVE_SPEED = 3.2; // vitesse en cases / seconde
  const HINT_DELAY = 4.0; // secondes avant d'afficher un indice

  // --- Constantes des scénarios de vitesse -----------------------------------
  const SPEED_MAX = 130; // km/h max
  const BRAKE_RATE = 55; // km/h perdus par seconde (frein)
  const ACCEL_RATE = 30; // km/h gagnés par seconde (accélérateur)
  const SPEED_TO_CELLS = 0.0011; // cases parcourues / seconde par km/h

  // --- Références DOM ---------------------------------------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const selectEl = document.getElementById("scenarioSelect");
  const restartBtn = document.getElementById("restartBtn");
  const bannerEl = document.getElementById("banner");
  const bannerTextEl = document.getElementById("bannerText");
  const rulePanel = document.getElementById("rulePanel");
  const ruleIcon = document.getElementById("ruleIcon");
  const ruleTitle = document.getElementById("ruleTitle");
  const ruleText = document.getElementById("ruleText");
  const retryBtn = document.getElementById("retryBtn");
  const nextBtn = document.getElementById("nextBtn");
  const progressInfo = document.getElementById("progressInfo");
  // HUD de vitesse
  const speedHud = document.getElementById("speedHud");
  const speedo = document.getElementById("speedo");
  const speedValue = document.getElementById("speedValue");
  const speedLimitInfo = document.getElementById("speedLimitInfo");
  const brakeBtn = document.getElementById("brakeBtn");
  const accelBtn = document.getElementById("accelBtn");
  // Duel 1v1
  const toolbar = document.getElementById("toolbar");
  const duelBtn = document.getElementById("duelBtn");
  const duelHud = document.getElementById("duelHud");
  const duelTimer = document.querySelector(".duel-hud__timer");
  const duelTime = document.getElementById("duelTime");
  const duelScore = document.getElementById("duelScore");
  const duelFautes = document.getElementById("duelFautes");
  const duelOppScore = document.getElementById("duelOppScore");
  const duelOppFautes = document.getElementById("duelOppFautes");
  const duelOverlay = document.getElementById("duelOverlay");
  const duelClose = document.getElementById("duelClose");
  const duelLobby = document.getElementById("duelLobby");
  const duelResults = document.getElementById("duelResults");
  const duelResultIcon = document.getElementById("duelResultIcon");
  const duelResultTitle = document.getElementById("duelResultTitle");
  const duelResultDetail = document.getElementById("duelResultDetail");
  const duelReplay = document.getElementById("duelReplay");
  const createBtn = document.getElementById("createBtn");
  const joinBtn = document.getElementById("joinBtn");
  const joinCode = document.getElementById("joinCode");
  const duelCode = document.getElementById("duelCode");
  const duelCodeValue = document.getElementById("duelCodeValue");
  const duelLinkInput = document.getElementById("duelLinkInput");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const duelStatus = document.getElementById("duelStatus");
  const startBtn = document.getElementById("startBtn");

  // --- État courant -----------------------------------------------------------
  let scenarioIndex = 0;
  let scene = null; // scénario instancié et "vivant"
  let lastTs = 0; // timestamp précédent (pour le delta-time)
  let elapsed = 0; // temps écoulé depuis le dernier événement (pour l'indice)

  // --- Duel 1v1 (réseau WebRTC via PeerJS) -----------------------------------
  const MATCH_DURATION = 30; // durée d'un duel en secondes
  let match = null; // null en mode solo ; objet "match vivant" en duel
  let peer = null; // instance PeerJS
  let conn = null; // canal de données vers l'adversaire
  let myRole = null; // "host" | "guest"

  /* ===========================================================================
   *  HELPERS GÉOMÉTRIE
   * =========================================================================*/

  // Centre d'une case (en pixels)
  const cellCenter = (col, row) => ({
    x: (col + 0.5) * CELL,
    y: (row + 0.5) * CELL,
  });

  // Interpole la position d'un véhicule le long de son path selon `progress`
  // (progress = index flottant dans le tableau path)
  function posAlongPath(path, progress) {
    const maxIdx = path.length - 1;
    const p = Math.max(0, Math.min(progress, maxIdx));
    const seg = Math.min(Math.floor(p), maxIdx - 1);
    const t = p - seg;
    const a = cellCenter(path[seg][0], path[seg][1]);
    const b = cellCenter(path[seg + 1][0], path[seg + 1][1]);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  /* ===========================================================================
   *  CHARGEMENT D'UN SCÉNARIO
   * =========================================================================*/

  function loadScenario(index) {
    const data = SCENARIOS[index];
    scenarioIndex = index;

    // Adapte la taille et le ratio du canvas à la grille
    canvas.width = data.cols * CELL;
    canvas.height = data.rows * CELL;
    canvas.style.aspectRatio = `${data.cols} / ${data.rows}`;

    const kind = data.kind || "order";

    // Instancie un état "vivant" pour chaque véhicule
    const vehicles = data.vehicles.map((v) => ({
      ...v,
      progress: 0, // position le long du path
      // En mode vitesse, la voiture roule en continu ("moving").
      state: kind === "speed" ? "moving" : "waiting",
    }));

    scene = {
      data,
      kind,
      vehicles,
      nextIndex: 0, // prochaine voiture attendue dans expectedOrder
      status: "playing", // "playing" | "won" | "lost"
      resolved: false, // verrou : empêche un 2e dénouement (utile en duel)
    };

    if (kind === "speed") {
      scene.speed = {
        value: data.startSpeed, // vitesse courante (km/h)
        brake: false,
        accel: false,
        checked: false, // ligne d'entrée déjà évaluée ?
        passed: false, // franchie à la bonne vitesse ?
      };
      speedHud.hidden = false;
      speedLimitInfo.textContent = `Limite à respecter : ${data.entry.limit} km/h`;
      updateSpeedHud();
      setBanner(
        "info",
        "La voiture roule ! Freine pour entrer en ville à la bonne vitesse.",
      );
    } else {
      speedHud.hidden = true;
      setBanner(
        "info",
        "Observe la scène, puis clique sur les véhicules dans le bon ordre.",
      );
    }

    elapsed = 0;
    hideRulePanel();
    updateProgressInfo();
    selectEl.value = String(index);
  }

  function vehicleById(id) {
    return scene.vehicles.find((v) => v.id === id);
  }

  // Le véhicule attendu pour le prochain clic
  function expectedVehicle() {
    if (scene.kind !== "order" || scene.status !== "playing") return null;
    const id = scene.data.expectedOrder[scene.nextIndex];
    return vehicleById(id);
  }

  /* ===========================================================================
   *  DESSIN
   * =========================================================================*/

  function draw() {
    const { data } = scene;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrass();
    data.roads.forEach(drawRoad);
    if (data.tracks) data.tracks.forEach(drawTracks);
    if (data.roundabout) drawRoundabout(data.roundabout);
    if (scene.kind === "speed") drawCity(data);
    // Les marquages droits n'ont pas de sens à travers un rond-point
    if (!data.roundabout) drawLaneMarkings(data.roads);
    if (data.crosswalks) data.crosswalks.forEach(drawCrosswalk);
    if (scene.kind === "speed") drawEntrySign(data);
    (data.signs || []).forEach(drawSign);
    if (data.lights) data.lights.forEach(drawTrafficLight);

    // Véhicules : on dessine ceux qui ne sont pas encore "done"
    scene.vehicles.forEach((v) => {
      if (v.state === "done") return;
      drawVehicle(v);
    });

    if (data.weather === "rain") drawRain();
  }

  function drawGrass() {
    ctx.fillStyle = "#2b7a3b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawRoad(r) {
    ctx.fillStyle = "#3a3f4b";
    ctx.fillRect(r.col * CELL, r.row * CELL, r.w * CELL, r.h * CELL);
    // léger liseré sur les bords de la route
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      r.col * CELL + 1,
      r.row * CELL + 1,
      r.w * CELL - 2,
      r.h * CELL - 2,
    );
  }

  // Rond-point : anneau d'asphalte + îlot central engazonné
  // rb = { cx, cy, rOuter, rInner } en unités de cases
  function drawRoundabout(rb) {
    const cx = rb.cx * CELL;
    const cy = rb.cy * CELL;
    const ro = rb.rOuter * CELL;
    const ri = rb.rInner * CELL;

    // Disque d'asphalte (relie les routes d'accès en un anneau)
    ctx.beginPath();
    ctx.arc(cx, cy, ro, 0, Math.PI * 2);
    ctx.fillStyle = "#3a3f4b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();

    // Ligne d'anneau discontinue
    ctx.setLineDash([12, 12]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, (ro + ri) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Îlot central (gazon) avec bordure blanche
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.fillStyle = "#2b7a3b";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.stroke();
  }

  // Ville : bandes de bâtiments de part et d'autre de la route, à partir de
  // data.city.fromCol. (Scénarios de vitesse uniquement.)
  function drawCity(data) {
    if (!data.city) return;
    const road = data.roads[0];
    const roadTop = road.row * CELL;
    const roadBottom = (road.row + road.h) * CELL;
    const x0 = data.city.fromCol * CELL;
    const x1 = data.cols * CELL;
    drawBuildingBand(x0, x1, 0, roadTop, "top");
    drawBuildingBand(x0, x1, roadBottom, data.rows * CELL, "bottom");
  }

  function drawBuildingBand(x0, x1, yTop, yBottom, anchor) {
    const palette = ["#566077", "#6d5f54", "#4b5668", "#71664f", "#5b5160"];
    const bandH = yBottom - yTop;
    let i = Math.floor(x0 / CELL) + 1;
    for (let bx = x0 + 4; bx < x1 - 6; bx += CELL * 1.05) {
      const bw = CELL * 0.82;
      const h = bandH * (0.55 + 0.13 * (i % 4));
      const by = anchor === "top" ? yTop : yBottom - h;
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(bx, by, bw, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.strokeRect(bx, by, bw, h);
      drawWindows(bx, by, bw, h);
      i++;
    }
  }

  function drawWindows(bx, by, bw, bh) {
    ctx.fillStyle = "rgba(255, 221, 130, 0.5)";
    const cols = 2;
    const pad = 6;
    const ww = (bw - pad * (cols + 1)) / cols;
    const wh = 8;
    for (let wy = by + pad; wy + wh < by + bh - 4; wy += wh + 6) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + pad + c * (ww + pad);
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  // Panneau d'entrée de zone + ligne d'entrée (scénarios de vitesse).
  function drawEntrySign(data) {
    const entry = data.entry;
    const road = data.roads[0];
    const x = entry.col * CELL;
    const baseY = road.row * CELL - 6; // juste au-dessus de la route

    if (entry.sign.type === "agglo") {
      // Panneau d'agglomération : rectangle clair, bord rouge, nom de la ville
      const w = CELL * 1.8;
      const h = CELL * 0.5;
      const px = x - w / 2;
      const py = baseY - h;
      ctx.fillStyle = "#ece6d6";
      roundRect(ctx, px, py, w, h, 4);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#c23b2b";
      ctx.stroke();
      ctx.fillStyle = "#22262e";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.sign.name, x, py + h / 2);
    } else if (entry.sign.type === "limit") {
      // Panneau de limitation : disque blanc, gros bord rouge, valeur
      const r = CELL * 0.34;
      const cy = baseY - r;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#d11e1e";
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(entry.sign.value), x, cy + 1);
    }

    // Ligne d'entrée en pointillés sur la route
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(x, road.row * CELL);
    ctx.lineTo(x, (road.row + road.h) * CELL);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Voie ferrée : ballast + 2 rails + traverses. t = { col, row, w, h }
  function drawTracks(t) {
    const x = t.col * CELL,
      y = t.row * CELL,
      w = t.w * CELL,
      h = t.h * CELL;
    const horizontal = w >= h;
    ctx.fillStyle = "#4f4334";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 3;
    if (horizontal) {
      const y1 = y + h * 0.34,
        y2 = y + h * 0.66;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x + w, y1);
      ctx.moveTo(x, y2);
      ctx.lineTo(x + w, y2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 5;
      for (let tx = x + 9; tx < x + w; tx += 18) {
        ctx.beginPath();
        ctx.moveTo(tx, y1 - 7);
        ctx.lineTo(tx, y2 + 7);
        ctx.stroke();
      }
    } else {
      const x1 = x + w * 0.34,
        x2 = x + w * 0.66;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1, y + h);
      ctx.moveTo(x2, y);
      ctx.lineTo(x2, y + h);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 5;
      for (let ty = y + 9; ty < y + h; ty += 18) {
        ctx.beginPath();
        ctx.moveTo(x1 - 7, ty);
        ctx.lineTo(x2 + 7, ty);
        ctx.stroke();
      }
    }
  }

  // Passage piéton : bandes blanches (zébra). c = { col, row, w, h }
  function drawCrosswalk(c) {
    const x = c.col * CELL,
      y = c.row * CELL,
      w = c.w * CELL,
      h = c.h * CELL;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    if (w >= h) {
      for (let sx = x + 4; sx < x + w - 4; sx += 14) {
        ctx.fillRect(sx, y + 3, 7, h - 6);
      }
    } else {
      for (let sy = y + 4; sy < y + h - 4; sy += 14) {
        ctx.fillRect(x + 3, sy, w - 6, 7);
      }
    }
  }

  // Feu tricolore. l = { col, row, state: "red"|"orange"|"green"|"off" }
  function drawTrafficLight(l) {
    const { x, y } = cellCenter(l.col, l.row);
    const bw = CELL * 0.28,
      bh = CELL * 0.62;
    ctx.fillStyle = "#181818";
    roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();

    const lamps = [
      ["red", "#ff3b3b"],
      ["orange", "#ffb02e"],
      ["green", "#3ddc6a"],
    ];
    const r = bw * 0.3;
    // Feu hors service : orange clignotant
    const blinkOrange =
      l.state === "off" && Math.floor(performance.now() / 500) % 2 === 0;
    lamps.forEach((lp, i) => {
      const ly = y - bh * 0.3 + i * (bh * 0.3);
      const on = l.state === lp[0] || (blinkOrange && lp[0] === "orange");
      ctx.beginPath();
      ctx.arc(x, ly, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? lp[1] : "rgba(255,255,255,0.1)";
      if (on) {
        ctx.shadowColor = lp[1];
        ctx.shadowBlur = 10;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // Pluie : fines hachures animées par-dessus la scène.
  function drawRain() {
    ctx.strokeStyle = "rgba(180,200,255,0.35)";
    ctx.lineWidth = 2;
    const off = Math.floor(performance.now() / 6);
    for (let i = 0; i < 70; i++) {
      const x = (i * 67) % canvas.width;
      const y = (i * 113 + off) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 13);
      ctx.stroke();
    }
  }

  // Lignes blanches discontinues au centre de chaque route
  function drawLaneMarkings(roads) {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    roads.forEach((r) => {
      ctx.beginPath();
      if (r.w >= r.h) {
        // route horizontale -> ligne centrale horizontale
        const y = (r.row + r.h / 2) * CELL;
        ctx.moveTo(r.col * CELL, y);
        ctx.lineTo((r.col + r.w) * CELL, y);
      } else {
        const x = (r.col + r.w / 2) * CELL;
        ctx.moveTo(x, r.row * CELL);
        ctx.lineTo(x, (r.row + r.h) * CELL);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // Dimensions selon la classe de véhicule.
  function vehicleDims(v) {
    switch (v.vClass) {
      case "bus":
        return { len: CAR_LEN * 1.7, w: CAR_W * 1.15 };
      case "truck":
        return { len: CAR_LEN * 1.95, w: CAR_W * 1.2 };
      case "train":
        return { len: CAR_LEN * 2.6, w: CAR_W * 1.3 };
      case "bike":
        return { len: CAR_LEN * 0.62, w: CAR_W * 0.5 };
      default:
        return { len: CAR_LEN, w: CAR_W };
    }
  }

  function drawVehicle(v) {
    const { x, y, angle } = posAlongPath(v.path, v.progress);
    const isExpected =
      scene.kind === "order" &&
      scene.status === "playing" &&
      expectedVehicle() === v;
    const dims = vehicleDims(v);

    // Halo d'indice : pulse autour des usagers cliquables
    if (v.state === "waiting") {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      const strong = isExpected && elapsed > HINT_DELAY; // accentue le bon choix
      ctx.beginPath();
      ctx.arc(x, y, Math.max(dims.len * 0.72, CELL * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = strong
        ? `rgba(255, 206, 90, ${0.18 + pulse * 0.3})`
        : `rgba(255, 255, 255, ${0.06 + pulse * 0.12})`;
      ctx.fill();
    }

    // Piéton : silhouette simple, pas de carrosserie.
    if (v.vClass === "pedestrian") {
      drawPedestrian(v, x, y);
    } else {
      const L = dims.len;
      const W = dims.w;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Carrosserie
      roundRect(ctx, -L / 2, -W / 2, L, W, v.vClass === "bike" ? 4 : 8);
      ctx.fillStyle = v.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = v.isPlayer ? "#ffffff" : "rgba(0,0,0,0.35)";
      ctx.stroke();

      if (v.vClass === "bus" || v.vClass === "train") {
        // Rangée de fenêtres
        ctx.fillStyle = "rgba(20,30,50,0.55)";
        for (let i = -1; i <= 1; i++) {
          roundRect(ctx, i * L * 0.26 - L * 0.06, -W * 0.3, L * 0.12, W * 0.6, 2);
          ctx.fill();
        }
      } else if (v.vClass !== "bike") {
        // Pare-brise (vers l'avant = +x)
        roundRect(ctx, L * 0.06, -W * 0.34, L * 0.26, W * 0.68, 4);
        ctx.fillStyle = "rgba(20,30,50,0.78)";
        ctx.fill();
      }

      // Flèche de direction sur le capot
      ctx.beginPath();
      ctx.moveTo(L * 0.4, 0);
      ctx.lineTo(L * 0.26, -W * 0.22);
      ctx.lineTo(L * 0.26, W * 0.22);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();

      // Clignotant orange (avant + arrière du côté indiqué), clignote
      if (v.blinker) {
        const on = Math.floor(performance.now() / 350) % 2 === 0;
        if (on) {
          // côté "left" = gauche du sens de marche (vers -y), "right" = +y
          const sy = (v.blinker === "left" ? -1 : 1) * W * 0.5;
          ctx.fillStyle = "#ffb02e";
          ctx.shadowColor = "#ffb02e";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(L * 0.4, sy, W * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-L * 0.4, sy, W * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Gyrophare clignotant bleu/rouge pour les véhicules prioritaires
      if (v.emergency) {
        const on = Math.floor(performance.now() / 220) % 2 === 0;
        ctx.beginPath();
        ctx.arc(0, 0, W * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = on ? "#2f6bff" : "#ff2d2d";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.stroke();
      }

      ctx.restore();
    }

    // Libellé au-dessus de l'usager ("MOI" pour le joueur, sinon v.label)
    const label = v.isPlayer ? "MOI" : v.label;
    if (label) {
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, x, y - dims.len * 0.62 - 6);
    }
  }

  // Silhouette de piéton vue de dessus (corps + tête).
  function drawPedestrian(v, x, y) {
    const r = CELL * 0.13;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = v.color || "#ffd21e";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - r * 1.7, r * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = "#f0d0a0";
    ctx.fill();
    ctx.stroke();
  }

  // --- Panneaux ---------------------------------------------------------------
  function drawSign(sign) {
    const { x, y } = cellCenter(sign.col, sign.row);
    const r = CELL * 0.3;
    ctx.save();
    ctx.translate(x, y);

    if (sign.type === "yield") {
      // Triangle pointe en bas, bord rouge, intérieur blanc
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.85);
      ctx.lineTo(r, -r * 0.85);
      ctx.lineTo(0, r);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#e23b3b";
      ctx.stroke();
    } else if (sign.type === "stop") {
      // Octogone rouge avec "STOP"
      drawPolygon(ctx, 8, r, Math.PI / 8);
      ctx.fillStyle = "#e23b3b";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("STOP", 0, 0);
    } else if (sign.type === "roundabout") {
      // Cercle bleu avec 3 flèches tournant (sens giratoire)
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#1b66c9";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 3;
      const ar = r * 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i / 3) * Math.PI * 2);
        ctx.beginPath();
        ctx.arc(0, 0, ar, Math.PI * 0.12, Math.PI * 0.58);
        ctx.stroke();
        const a2 = Math.PI * 0.58;
        const hx = Math.cos(a2) * ar;
        const hy = Math.sin(a2) * ar;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - r * 0.17, hy - r * 0.03);
        ctx.lineTo(hx + r * 0.02, hy + r * 0.17);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (sign.type === "priority") {
      // Losange jaune (route prioritaire), liseré blanc
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ffd21e";
      roundRect(ctx, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 5);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    } else if (sign.type === "railway") {
      // Passage à niveau : 2 feux rouges clignotants (alternés) + croix de Saint-André
      const phase = Math.floor(performance.now() / 400) % 2 === 0;
      const lr = r * 0.26;
      [
        [-r * 0.5, phase],
        [r * 0.5, !phase],
      ].forEach(([lx, lit]) => {
        ctx.beginPath();
        ctx.arc(lx, -r * 1.25, lr, 0, Math.PI * 2);
        ctx.fillStyle = lit ? "#ff2d2d" : "rgba(255,45,45,0.18)";
        if (lit) {
          ctx.shadowColor = "#ff2d2d";
          ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      // Croix de Saint-André (saltire blanc bordé de rouge)
      ctx.lineCap = "round";
      ctx.strokeStyle = "#d11e1e";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.45);
      ctx.lineTo(r, r * 0.85);
      ctx.moveTo(r, -r * 0.45);
      ctx.lineTo(-r, r * 0.85);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.45);
      ctx.lineTo(r, r * 0.85);
      ctx.moveTo(r, -r * 0.45);
      ctx.lineTo(-r, r * 0.85);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.restore();
  }

  /* ===========================================================================
   *  UTILITAIRES DE DESSIN
   * =========================================================================*/
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawPolygon(c, sides, radius, rotation) {
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotation + (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.closePath();
  }

  /* ===========================================================================
   *  BOUCLE D'ANIMATION
   * =========================================================================*/
  function tick(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
    lastTs = ts;

    if (match && match.started && !match.localDone) updateMatchTimer();

    if (scene.kind === "speed") {
      tickSpeed(dt);
    } else {
      tickOrder(dt);
    }

    draw();
    requestAnimationFrame(tick);
  }

  // Mode "ordre de passage" : indices + avance des véhicules cliqués.
  function tickOrder(dt) {
    if (scene.status === "playing") {
      elapsed += dt;
      if (elapsed > HINT_DELAY && bannerEl.dataset.kind !== "hint") {
        setBanner("hint", "💡 " + scene.data.hint);
      }
    }
    scene.vehicles.forEach((v) => {
      if (v.state !== "moving") return;
      v.progress += DRIVE_SPEED * (v.speedMul || 1) * dt;
      if (v.progress >= v.path.length - 1) {
        v.progress = v.path.length - 1;
        v.state = "done";
        onVehicleArrived();
      }
    });
  }

  // Mode "vitesse" : la voiture roule, le joueur freine/accélère pour franchir
  // la ligne d'entrée à une vitesse <= limite.
  function tickSpeed(dt) {
    const s = scene.speed;
    const car = scene.vehicles[0];

    if (scene.status === "playing" && !scene.resolved && !(match && match.localDone)) {
      if (s.brake) s.value -= BRAKE_RATE * dt;
      if (s.accel) s.value += ACCEL_RATE * dt;
      s.value = Math.max(0, Math.min(SPEED_MAX, s.value));

      const maxIdx = car.path.length - 1;
      car.progress = Math.min(
        car.progress + s.value * SPEED_TO_CELLS * dt,
        maxIdx,
      );

      const { x } = posAlongPath(car.path, car.progress);
      const entryX = scene.data.entry.col * CELL;

      // Franchissement de la ligne d'entrée : on évalue la vitesse une fois.
      if (!s.checked && x >= entryX) {
        s.checked = true;
        const over = s.value > scene.data.entry.limit + 0.5;
        if (over) {
          scene.resolved = true;
          if (match) {
            matchFault();
          } else {
            scene.status = "lost";
            triggerShake();
            setBanner(
              "bad",
              `💥 Excès de vitesse : ${Math.round(s.value)} km/h pour ${scene.data.entry.limit} !`,
            );
            showRulePanel(false);
            track("partie-solo", "Partie solo terminée");
            track("partie-solo-echec", "Partie solo échouée");
          }
        } else if (match) {
          // En duel : succès immédiat dès le franchissement (pas d'attente).
          scene.resolved = true;
          matchSolved();
        } else {
          s.passed = true;
          setBanner("ok", "✅ Bonne vitesse, tu entres en sécurité.");
        }
      }

      // Solo : victoire confirmée à la sortie de scène.
      if (s.passed && car.progress >= maxIdx) {
        scene.status = "won";
        showRulePanel(true);
        track("partie-solo", "Partie solo terminée");
        track("partie-solo-reussie", "Partie solo réussie");
      }
    }

    updateSpeedHud();
  }

  function updateSpeedHud() {
    const s = scene.speed;
    speedValue.textContent = String(Math.round(s.value));
    const over = s.value > scene.data.entry.limit + 0.5;
    speedo.classList.toggle("speedo--over", over);
    speedo.classList.toggle("speedo--ok", !over);
  }

  /* ===========================================================================
   *  INTERACTIONS
   * =========================================================================*/

  // Convertit un événement pointeur en coordonnées canvas
  function eventToCanvas(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  function handleClick(evt) {
    if (scene.kind !== "order" || scene.status !== "playing") return;
    if (scene.resolved || (match && match.localDone)) return;
    const { x, y } = eventToCanvas(evt);

    // Trouve un véhicule "waiting" sous le clic
    const hit = scene.vehicles.find((v) => {
      if (v.state !== "waiting") return false;
      const p = posAlongPath(v.path, v.progress);
      const radius = Math.max(vehicleDims(v).len * 0.6, CELL * 0.45);
      return Math.hypot(p.x - x, p.y - y) < radius;
    });
    if (!hit) return;

    elapsed = 0; // reset du timer d'indice
    const expected = scene.data.expectedOrder[scene.nextIndex];

    if (hit.id === expected) {
      // Bon choix : le véhicule s'engage
      hit.state = "moving";
      scene.nextIndex += 1;
      updateProgressInfo();
      if (scene.nextIndex >= scene.data.expectedOrder.length) {
        // Scénario résolu
        scene.resolved = true;
        if (match) return matchSolved();
        scene.status = "won";
        setBanner("ok", "✅ Bien joué ! Tout le monde passe en sécurité.");
        track("partie-solo", "Partie solo terminée");
        track("partie-solo-reussie", "Partie solo réussie");
      } else {
        setBanner("ok", "👍 Bon choix, continue.");
      }
    } else {
      // Mauvais ordre
      scene.resolved = true;
      if (match) return matchFault();
      scene.status = "lost";
      triggerShake();
      setBanner("bad", "💥 Mauvais ordre de passage !");
      showRulePanel(false);
      track("partie-solo", "Partie solo terminée");
      track("partie-solo-echec", "Partie solo échouée");
    }
  }

  // Appelée quand un véhicule a fini son trajet.
  // On affiche la règle quand plus aucun véhicule n'est en mouvement (gère aussi
  // les scénarios où le joueur ne bouge pas, ex. feu rouge respecté).
  function onVehicleArrived() {
    if (scene.status !== "won") return;
    const stillMoving = scene.vehicles.some((v) => v.state === "moving");
    if (!stillMoving) showRulePanel(true);
  }

  /* ===========================================================================
   *  UI : bannière, panneau de règle, progression
   * =========================================================================*/

  function setBanner(kind, text) {
    bannerEl.className = "banner banner--" + kind;
    bannerEl.dataset.kind = kind;
    bannerTextEl.textContent = text;
  }

  // Envoie un événement personnalisé à GoatCounter (sans rien casser si absent,
  // ex. en local file://). Apparaît dans le tableau de bord comme "event".
  function track(name, title) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === "function") {
        window.goatcounter.count({
          path: name,
          title: title || name,
          event: true,
        });
      }
    } catch (e) {
      /* analytics ne doit jamais interrompre le jeu */
    }
  }

  function showRulePanel(success) {
    const r = scene.data.rule;
    rulePanel.hidden = false;
    rulePanel.className =
      "rule-panel " + (success ? "rule-panel--ok" : "rule-panel--bad");
    ruleIcon.textContent = success ? "✅" : "❌";
    ruleTitle.textContent = success ? "Bravo, bien vu !" : "Pas tout à fait…";
    ruleText.textContent = success ? r.good : r.bad;
    // Le bouton "suivant" n'a de sens que s'il reste des scénarios
    nextBtn.style.display = scenarioIndex < SCENARIOS.length - 1 ? "" : "none";
  }

  function hideRulePanel() {
    rulePanel.hidden = true;
  }

  function updateProgressInfo() {
    if (scene.kind === "speed") {
      progressInfo.textContent = `Scénario ${scenarioIndex + 1}/${SCENARIOS.length} — gestion de la vitesse`;
      return;
    }
    const total = scene.data.expectedOrder.length;
    progressInfo.textContent =
      `Scénario ${scenarioIndex + 1}/${SCENARIOS.length} — ` +
      `étape ${Math.min(scene.nextIndex + 1, total)}/${total}`;
  }

  function triggerShake() {
    canvas.classList.remove("shake");
    void canvas.offsetWidth; // force reflow pour rejouer l'animation
    canvas.classList.add("shake");
  }

  /* ===========================================================================
   *  DUEL 1v1 — contrôleur de match
   * =========================================================================*/

  // Génère une série de scénarios identique pour les deux joueurs.
  // Mélange les indices puis répète la liste (assez long pour 30 s).
  function makeOrder() {
    const idx = SCENARIOS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return [...idx, ...idx, ...idx];
  }

  function beginMatch(order) {
    closeDuelOverlay();
    toolbar.hidden = true;
    duelHud.hidden = false;
    match = {
      started: true,
      order,
      pos: 0,
      score: 0,
      fautes: 0,
      startTime: performance.now(),
      timeLeft: MATCH_DURATION,
      localDone: false,
      reason: null,
      opp: { score: 0, fautes: 0, done: false, reason: null },
    };
    updateDuelHud();
    loadScenario(order[0]);
  }

  function matchSolved() {
    if (!match || match.localDone) return;
    match.score += 1;
    setBanner("ok", "✅ +1 point !");
    sendProgress();
    updateDuelHud();
    nextMatchScenario();
  }

  function matchFault() {
    if (!match || match.localDone) return;
    match.fautes += 1;
    triggerShake();
    setBanner("bad", `💥 Faute ! (${match.fautes}/3)`);
    sendProgress();
    updateDuelHud();
    if (match.fautes >= 3) {
      finishLocalRun("eliminated");
    } else {
      nextMatchScenario();
    }
  }

  function nextMatchScenario() {
    // Petite pause pour laisser voir le feedback, puis scénario suivant.
    setTimeout(() => {
      if (!match || match.localDone) return;
      match.pos += 1;
      loadScenario(match.order[match.pos % match.order.length]);
    }, 450);
  }

  function updateMatchTimer() {
    const left = Math.max(
      0,
      MATCH_DURATION - (performance.now() - match.startTime) / 1000,
    );
    match.timeLeft = left;
    updateDuelHud();
    if (left <= 0) finishLocalRun("time");
  }

  function finishLocalRun(reason) {
    if (!match || match.localDone) return;
    match.localDone = true;
    match.reason = reason;
    sendResult();
    updateDuelHud();
    if (!match.opp.done) {
      setBanner(
        "info",
        reason === "eliminated"
          ? "Éliminé (3 fautes). En attente de l'adversaire…"
          : "Temps écoulé ! En attente de l'adversaire…",
      );
    }
    checkBothDone();
  }

  function checkBothDone() {
    if (match && match.localDone && match.opp.done) showResults();
  }

  function showResults() {
    duelOverlay.hidden = false;
    duelLobby.hidden = true;
    duelResults.hidden = false;

    const me = match;
    const opp = match.opp;
    const meElim = me.reason === "eliminated";
    const oppElim = opp.reason === "eliminated";

    let outcome;
    if (meElim && !oppElim) outcome = "lose";
    else if (oppElim && !meElim) outcome = "win";
    else if (me.score > opp.score) outcome = "win";
    else if (me.score < opp.score) outcome = "lose";
    else if (me.fautes < opp.fautes) outcome = "win";
    else if (me.fautes > opp.fautes) outcome = "lose";
    else outcome = "draw";

    duelResultIcon.textContent =
      outcome === "win" ? "🏆" : outcome === "lose" ? "😞" : "🤝";
    duelResultTitle.textContent =
      outcome === "win" ? "Victoire !" : outcome === "lose" ? "Défaite" : "Égalité";
    duelResultDetail.textContent =
      `Toi : ${me.score} pt(s), ${me.fautes} faute(s)${meElim ? " — éliminé" : ""}. ` +
      `Adversaire : ${opp.score} pt(s), ${opp.fautes} faute(s)${oppElim ? " — éliminé" : ""}.`;

    // Comptage des duels terminés : seul l'hôte émet, pour ne pas compter 2 fois.
    if (myRole === "host") track("duel-termine", "Duel terminé");
  }

  function updateDuelHud() {
    if (!match) return;
    duelTime.textContent = String(Math.ceil(match.timeLeft));
    duelTimer.classList.toggle("is-urgent", match.timeLeft <= 5);
    duelScore.textContent = String(match.score);
    duelFautes.textContent = `${match.fautes}/3`;
    duelOppScore.textContent = String(match.opp.score);
    duelOppFautes.textContent = `${match.opp.fautes}/3`;
  }

  /* ===========================================================================
   *  DUEL 1v1 — réseau (PeerJS / WebRTC)
   * =========================================================================*/

  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1 ambigus
    let s = "";
    for (let i = 0; i < 4; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // Namespace propre au déploiement : dérivé de l'hôte + du chemin de la page.
  // L'hôte et l'invité chargent la même URL → même namespace → ils se trouvent ;
  // un autre déploiement (ou site tiers utilisant PeerJS) a un namespace différent,
  // ce qui évite les collisions de codes sur le broker public mondial.
  function deployNamespace() {
    // Normalise "/repo/" et "/repo/index.html" vers la même valeur.
    const path = location.pathname.replace(/index\.html?$/i, "");
    const raw = (location.host + path).toLowerCase();
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).slice(0, 6) || "local";
  }

  const NS = deployNamespace();
  const peerId = (code) => `cdr-${NS}-${code}`; // ex. cdr-3f9k2a-ABCD

  // Lien d'invitation : URL courante + ?duel=CODE
  function buildShareUrl(code) {
    const base = location.href.split("#")[0].split("?")[0];
    return `${base}?duel=${code}`;
  }

  function copyShareLink() {
    const url = duelLinkInput.value;
    if (!url) return;
    const done = () => {
      const old = copyLinkBtn.textContent;
      copyLinkBtn.textContent = "✅ Copié !";
      setTimeout(() => {
        copyLinkBtn.textContent = old;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        duelLinkInput.select();
        document.execCommand("copy");
        done();
      });
    } else {
      duelLinkInput.select();
      document.execCommand("copy");
      done();
    }
  }

  function setDuelStatus(text) {
    duelStatus.textContent = text;
  }

  function openDuelOverlay() {
    duelOverlay.hidden = false;
    duelLobby.hidden = false;
    duelResults.hidden = true;
    duelCode.hidden = true;
    startBtn.hidden = true;
    setDuelStatus("");
  }

  function closeDuelOverlay() {
    duelOverlay.hidden = true;
  }

  // Quitte complètement le duel et revient au mode solo.
  function exitDuel() {
    closeDuelOverlay();
    duelHud.hidden = true;
    toolbar.hidden = false;
    match = null;
    if (conn) {
      try { conn.close(); } catch (e) {}
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    myRole = null;
    createBtn.disabled = false;
    duelCode.hidden = true;
    startBtn.hidden = true;
    setDuelStatus("");
    // Retire ?duel=… de l'URL pour éviter un re-join au rechargement.
    try {
      history.replaceState(null, "", location.href.split("?")[0].split("#")[0]);
    } catch (e) {}
    loadScenario(scenarioIndex);
  }

  function createGame() {
    if (typeof Peer === "undefined") {
      setDuelStatus("PeerJS indisponible (vérifie ta connexion Internet).");
      return;
    }
    myRole = "host";
    track("duel-cree", "Duel créé");
    createBtn.disabled = true;
    const code = genCode();
    setDuelStatus("Création de la partie…");
    peer = new Peer(peerId(code));
    peer.on("open", () => {
      duelCode.hidden = false;
      duelCodeValue.textContent = code;
      duelLinkInput.value = buildShareUrl(code);
      setDuelStatus("Partage le code ou le lien, puis attends ton adversaire…");
    });
    peer.on("connection", (c) => {
      conn = c;
      bindConn();
    });
    peer.on("error", (err) => {
      setDuelStatus("Erreur réseau : " + err.type);
      createBtn.disabled = false;
    });
  }

  function joinGame() {
    if (typeof Peer === "undefined") {
      setDuelStatus("PeerJS indisponible (vérifie ta connexion Internet).");
      return;
    }
    const code = joinCode.value.trim().toUpperCase();
    if (code.length < 4) {
      setDuelStatus("Saisis le code à 4 caractères.");
      return;
    }
    myRole = "guest";
    setDuelStatus("Connexion…");
    peer = new Peer();
    peer.on("open", () => {
      conn = peer.connect(peerId(code));
      bindConn();
    });
    peer.on("error", (err) => setDuelStatus("Erreur réseau : " + err.type));
  }

  function bindConn() {
    conn.on("open", () => {
      if (myRole === "host") {
        startBtn.hidden = false;
        setDuelStatus("Adversaire connecté ✅ — lance le duel !");
      } else {
        track("duel-rejoint", "Duel rejoint");
        setDuelStatus("Connecté ✅ — en attente du lancement par l'hôte…");
      }
    });
    conn.on("data", onData);
    conn.on("close", () => {
      if (!match || !match.localDone) setDuelStatus("Adversaire déconnecté.");
    });
  }

  function send(msg) {
    if (conn && conn.open) conn.send(msg);
  }
  function sendProgress() {
    send({ type: "progress", score: match.score, fautes: match.fautes });
  }
  function sendResult() {
    send({
      type: "result",
      score: match.score,
      fautes: match.fautes,
      reason: match.reason,
    });
  }

  function onData(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "start") {
      beginMatch(msg.order);
    } else if (msg.type === "progress") {
      if (!match) return;
      match.opp.score = msg.score;
      match.opp.fautes = msg.fautes;
      updateDuelHud();
    } else if (msg.type === "result") {
      if (!match) return;
      match.opp.score = msg.score;
      match.opp.fautes = msg.fautes;
      match.opp.done = true;
      match.opp.reason = msg.reason;
      updateDuelHud();
      checkBothDone();
    }
  }

  function hostStart() {
    track("duel-demarre", "Duel démarré");
    const order = makeOrder();
    send({ type: "start", order });
    beginMatch(order);
  }

  // Nouvelle manche (en gardant la connexion).
  function replayDuel() {
    match = null;
    duelHud.hidden = true;
    duelResults.hidden = true;
    duelLobby.hidden = false;
    duelOverlay.hidden = false;
    if (myRole === "host") {
      startBtn.hidden = false;
      setDuelStatus("Prêt pour une nouvelle manche — lance le duel !");
    } else {
      setDuelStatus("En attente du lancement par l'hôte…");
    }
  }

  /* ===========================================================================
   *  INITIALISATION
   * =========================================================================*/

  function populateSelect() {
    SCENARIOS.forEach((s, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i + 1}. ${s.title}`;
      selectEl.appendChild(opt);
    });
  }

  // Événements UI
  selectEl.addEventListener("change", (e) =>
    loadScenario(Number(e.target.value)),
  );
  restartBtn.addEventListener("click", () => loadScenario(scenarioIndex));
  retryBtn.addEventListener("click", () => loadScenario(scenarioIndex));
  nextBtn.addEventListener("click", () => {
    if (scenarioIndex < SCENARIOS.length - 1) loadScenario(scenarioIndex + 1);
  });
  canvas.addEventListener("click", handleClick);

  // Boutons frein / accélérateur (maintien enfoncé) pour les scénarios vitesse
  function bindHold(btn, flag) {
    const press = (e) => {
      e.preventDefault();
      if (scene && scene.speed) scene.speed[flag] = true;
    };
    const release = () => {
      if (scene && scene.speed) scene.speed[flag] = false;
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  }
  bindHold(brakeBtn, "brake");
  bindHold(accelBtn, "accel");

  // Événements du duel 1v1
  duelBtn.addEventListener("click", openDuelOverlay);
  duelClose.addEventListener("click", exitDuel);
  createBtn.addEventListener("click", createGame);
  joinBtn.addEventListener("click", joinGame);
  joinCode.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinGame();
  });
  startBtn.addEventListener("click", hostStart);
  duelReplay.addEventListener("click", replayDuel);
  copyLinkBtn.addEventListener("click", copyShareLink);

  // Go !
  populateSelect();
  loadScenario(0);
  requestAnimationFrame(tick);

  // Auto-join si l'URL contient ?duel=CODE (lien d'invitation)
  const joinParam = new URLSearchParams(location.search).get("duel");
  if (joinParam) {
    openDuelOverlay();
    joinCode.value = joinParam.toUpperCase().slice(0, 4);
    joinGame();
  }
})();
