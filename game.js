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
  const CELL = 64;             // taille d'une case en pixels
  const CAR_LEN = CELL * 0.74; // longueur d'une voiture
  const CAR_W = CELL * 0.42;   // largeur d'une voiture
  const DRIVE_SPEED = 3.2;     // vitesse en cases / seconde
  const HINT_DELAY = 4.0;      // secondes avant d'afficher un indice

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

  // --- État courant -----------------------------------------------------------
  let scenarioIndex = 0;
  let scene = null;       // scénario instancié et "vivant"
  let lastTs = 0;         // timestamp précédent (pour le delta-time)
  let elapsed = 0;        // temps écoulé depuis le dernier événement (pour l'indice)

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

    // Adapte la taille du canvas à la grille
    canvas.width = data.cols * CELL;
    canvas.height = data.rows * CELL;

    // Instancie un état "vivant" pour chaque véhicule
    const vehicles = data.vehicles.map((v) => ({
      ...v,
      progress: 0,                 // position le long du path
      state: "waiting",            // "waiting" | "moving" | "done"
    }));

    scene = {
      data,
      vehicles,
      nextIndex: 0,                // prochaine voiture attendue dans expectedOrder
      status: "playing",           // "playing" | "won" | "lost"
    };

    elapsed = 0;
    hideRulePanel();
    setBanner("info", "Observe la scène, puis clique sur les véhicules dans le bon ordre.");
    updateProgressInfo();
    selectEl.value = String(index);
  }

  function vehicleById(id) {
    return scene.vehicles.find((v) => v.id === id);
  }

  // Le véhicule attendu pour le prochain clic
  function expectedVehicle() {
    if (scene.status !== "playing") return null;
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
    if (data.roundabout) drawRoundabout(data.roundabout);
    // Les marquages droits n'ont pas de sens à travers un rond-point
    if (!data.roundabout) drawLaneMarkings(data.roads);
    data.signs.forEach(drawSign);

    // Véhicules : on dessine ceux qui ne sont pas encore "done"
    scene.vehicles.forEach((v) => {
      if (v.state === "done") return;
      drawVehicle(v);
    });
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
    ctx.strokeRect(r.col * CELL + 1, r.row * CELL + 1, r.w * CELL - 2, r.h * CELL - 2);
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

  function drawVehicle(v) {
    const { x, y, angle } = posAlongPath(v.path, v.progress);
    const isExpected = scene.status === "playing" && expectedVehicle() === v;

    // Halo d'indice : pulse autour des véhicules cliquables
    if (v.state === "waiting") {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      const strong = isExpected && elapsed > HINT_DELAY; // accentue le bon choix
      ctx.beginPath();
      ctx.arc(x, y, CAR_LEN * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = strong
        ? `rgba(255, 206, 90, ${0.18 + pulse * 0.30})`
        : `rgba(255, 255, 255, ${0.06 + pulse * 0.12})`;
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Carrosserie
    roundRect(ctx, -CAR_LEN / 2, -CAR_W / 2, CAR_LEN, CAR_W, 8);
    ctx.fillStyle = v.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = v.isPlayer ? "#ffffff" : "rgba(0,0,0,0.35)";
    ctx.stroke();

    // Pare-brise (vers l'avant = +x)
    roundRect(ctx, CAR_LEN * 0.06, -CAR_W * 0.34, CAR_LEN * 0.26, CAR_W * 0.68, 4);
    ctx.fillStyle = "rgba(20,30,50,0.78)";
    ctx.fill();

    // Flèche de direction sur le capot
    ctx.beginPath();
    ctx.moveTo(CAR_LEN * 0.40, 0);
    ctx.lineTo(CAR_LEN * 0.26, -CAR_W * 0.22);
    ctx.lineTo(CAR_LEN * 0.26, CAR_W * 0.22);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    // Gyrophare clignotant bleu/rouge pour les véhicules prioritaires
    if (v.emergency) {
      const on = Math.floor(performance.now() / 220) % 2 === 0;
      ctx.beginPath();
      ctx.arc(0, 0, CAR_W * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = on ? "#2f6bff" : "#ff2d2d";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
    }

    ctx.restore();

    // Libellé au-dessus du véhicule ("MOI" pour le joueur, sinon v.label)
    const label = v.isPlayer ? "MOI" : v.label;
    if (label) {
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, x, y - CAR_LEN * 0.78);
    }
  }

  // --- Panneaux ---------------------------------------------------------------
  function drawSign(sign) {
    const { x, y } = cellCenter(sign.col, sign.row);
    const r = CELL * 0.30;
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

    if (scene.status === "playing") {
      elapsed += dt;
      // Affiche l'indice si le joueur hésite
      if (elapsed > HINT_DELAY && bannerEl.dataset.kind !== "hint") {
        setBanner("hint", "💡 " + scene.data.hint);
      }
    }

    // Avance les véhicules en mouvement
    scene.vehicles.forEach((v) => {
      if (v.state !== "moving") return;
      v.progress += DRIVE_SPEED * dt;
      if (v.progress >= v.path.length - 1) {
        v.progress = v.path.length - 1;
        v.state = "done";
        onVehicleArrived();
      }
    });

    draw();
    requestAnimationFrame(tick);
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
    if (scene.status !== "playing") return;
    const { x, y } = eventToCanvas(evt);

    // Trouve un véhicule "waiting" sous le clic
    const hit = scene.vehicles.find((v) => {
      if (v.state !== "waiting") return false;
      const p = posAlongPath(v.path, v.progress);
      return Math.hypot(p.x - x, p.y - y) < CAR_LEN * 0.6;
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
        // Tous les bons clics ont été faits : victoire (on attend l'arrivée)
        scene.status = "won";
        setBanner("ok", "✅ Bien joué ! Tout le monde passe en sécurité.");
      } else {
        setBanner("ok", "👍 Bon choix, continue.");
      }
    } else {
      // Mauvais ordre : échec pédagogique
      scene.status = "lost";
      triggerShake();
      setBanner("bad", "💥 Mauvais ordre de passage !");
      showRulePanel(false);
    }
  }

  // Appelée quand un véhicule a fini son trajet
  function onVehicleArrived() {
    if (scene.status !== "won") return;
    // Victoire confirmée seulement quand la voiture du joueur est sortie
    const player = scene.vehicles.find((v) => v.isPlayer);
    if (player && player.state === "done") {
      showRulePanel(true);
    }
  }

  /* ===========================================================================
   *  UI : bannière, panneau de règle, progression
   * =========================================================================*/

  function setBanner(kind, text) {
    bannerEl.className = "banner banner--" + kind;
    bannerEl.dataset.kind = kind;
    bannerTextEl.textContent = text;
  }

  function showRulePanel(success) {
    const r = scene.data.rule;
    rulePanel.hidden = false;
    rulePanel.className = "rule-panel " + (success ? "rule-panel--ok" : "rule-panel--bad");
    ruleIcon.textContent = success ? "✅" : "❌";
    ruleTitle.textContent = success ? "Bravo, bien vu !" : "Pas tout à fait…";
    ruleText.textContent = success ? r.good : r.bad;
    // Le bouton "suivant" n'a de sens que s'il reste des scénarios
    nextBtn.style.display =
      scenarioIndex < SCENARIOS.length - 1 ? "" : "none";
  }

  function hideRulePanel() {
    rulePanel.hidden = true;
  }

  function updateProgressInfo() {
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
  selectEl.addEventListener("change", (e) => loadScenario(Number(e.target.value)));
  restartBtn.addEventListener("click", () => loadScenario(scenarioIndex));
  retryBtn.addEventListener("click", () => loadScenario(scenarioIndex));
  nextBtn.addEventListener("click", () => {
    if (scenarioIndex < SCENARIOS.length - 1) loadScenario(scenarioIndex + 1);
  });
  canvas.addEventListener("click", handleClick);

  // Go !
  populateSelect();
  loadScenario(0);
  requestAnimationFrame(tick);
})();
