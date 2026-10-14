/* ==========================================================================
   Hand Slice — Corta frutas con la mano (estilo Fruit Ninja)
   Proyecto STEAM: Visión por computadora + Física + Geometría + Audio digital
   Versión mejorada: 5 vidas, bombas, media vida, ranking y trail mejorado
   Compatible con iOS / iPad (audio unlock + cámara frontal + safe areas)
   ========================================================================== */

/* ---------------------- Referencias DOM ---------------------- */
const videoEl = document.getElementById("input-video");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const scoreValueEl = document.getElementById("score-value");
const livesValueEl = document.getElementById("lives-value");
const comboBoxEl = document.getElementById("combo-box");

const screenLoading = document.getElementById("screen-loading");
const loadingText = document.getElementById("loading-text");
const screenStart = document.getElementById("screen-start");
const screenInfo = document.getElementById("screen-info");
const screenGameover = document.getElementById("screen-gameover");
const screenError = document.getElementById("screen-error");
const errorText = document.getElementById("error-text");
const finalScoreEl = document.getElementById("final-score");
const finalMessageEl = document.getElementById("final-message");
const highScoreEl = document.getElementById("high-score");
const rankingListEl = document.getElementById("ranking-list");
const rankingContainerEl = document.getElementById("ranking-container");

const btnStart = document.getElementById("btn-start");
const btnInfo = document.getElementById("btn-info");
const btnInfoClose = document.getElementById("btn-info-close");
const btnRestart = document.getElementById("btn-restart");

const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

/* ---------------------- Detección de iOS ---------------------- */
const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ---------------------- Estado del juego ---------------------- */
const STATE = { LOADING: "loading", START: "start", INFO: "info", PLAYING: "playing", GAMEOVER: "gameover", ERROR: "error" };
let state = STATE.LOADING;

let score = 0;
let lives = 5;
const MAX_LIVES = 5;

let fruits = [];
let bombs = [];
let particles = [];
let floatingTexts = [];
let sliceFlashes = [];
let starBursts = [];
let trailParticles = [];

let lastComboTime = 0;
let comboCount = 0;
let comboTimeoutHandle = null;

let lastFrameTime = performance.now();

let spawnTimer = 0;
let spawnInterval = 1400;
let bombSpawnTimer = 0;
let bombSpawnInterval = 5000;
let elapsedPlayTime = 0;
let difficultySpeedMul = 1;

/* ---------------------- Manos / trails ---------------------- */
let handTrails = [[], []];
const TRAIL_MAX_AGE = 200;
const TRAIL_MAX_POINTS = 20;

let handsReady = false;
let cameraStarted = false;
let cameraError = false;

/* ---------------------- Definición de frutas ---------------------- */
const FRUIT_TYPES = [
  { emoji: "🍎", radius: 46, juice: "#e0432b", points: 10 },
  { emoji: "🍊", radius: 44, juice: "#ff9f2e", points: 8 },
  { emoji: "🍋", radius: 40, juice: "#f4e04d", points: 8 },
  { emoji: "🍇", radius: 42, juice: "#7b4fa6", points: 12 },
  { emoji: "🍉", radius: 58, juice: "#ff5c7c", points: 15 },
  { emoji: "🥝", radius: 38, juice: "#8bc34a", points: 10 },
  { emoji: "🍓", radius: 36, juice: "#ff2d55", points: 10 },
  { emoji: "🍑", radius: 40, juice: "#ffb3ba", points: 8 },
  { emoji: "🍍", radius: 45, juice: "#efc185", points: 10 },
  { emoji: "🍒", radius: 36, juice: "#c21425", points: 15 },
];

const BOMB_EMOJI = "💣";
const BOMB_RADIUS = 46;

/* ==========================================================================
   AUDIO — generado matemáticamente con Web Audio API
   ========================================================================== */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    } catch (e) {
      console.warn("No se pudo crear AudioContext:", e);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

/* iOS: desbloquear AudioContext al primer toque/clic en cualquier parte */
function installIOSAudioUnlock() {
  const unlock = () => {
    ensureAudio();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    try {
      if (audioCtx) {
        const buf = audioCtx.createBuffer(1, 1, 22050);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.start(0);
      }
    } catch (e) {}
  };

  ["touchstart", "touchend", "pointerdown", "click", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlock, { passive: true });
  });
}

function playSlice(pitch = 1, isBomb = false) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    if (isBomb) {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(900 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(120 * pitch, now + 0.12);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    }
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + (isBomb ? 0.32 : 0.15));
  } catch (e) {}
}

function playMiss() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {}
}

function playGameOver() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [440, 349, 261].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.16);
      gain.gain.setValueAtTime(0.2, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.32);
    });
  } catch (e) {}
}

function playBombExplosion() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.25;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 2.5);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(gain).connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.25);

    const osc = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain2.gain.setValueAtTime(0.25, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain2).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {}
}

function playLifeUp() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.14);
    });
  } catch (e) {}
}

/* ==========================================================================
   MEDIAPIPE HANDS
   ========================================================================== */
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.5,
});

hands.onResults(onHandResults);

function onHandResults(results) {
  if (!handsReady && !cameraError) {
    handsReady = true;
    console.log("MediaPipe Hands listo, mostrando pantalla de inicio");
    if (state === STATE.LOADING) {
      showScreen(STATE.START);
    }
  }

  const now = performance.now();
  const seenHands = [false, false];

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks, i) => {
      if (i > 1) return;
      seenHands[i] = true;
      const tip = landmarks[8];
      const x = (1 - tip.x) * CANVAS_W;
      const y = tip.y * CANVAS_H;
      const trail = handTrails[i];
      trail.push({ x, y, t: now });
      while (trail.length > TRAIL_MAX_POINTS) trail.shift();

      if (state === STATE.PLAYING && trail.length > 2) {
        const speed = Math.sqrt(
          Math.pow(trail[trail.length - 1].x - trail[trail.length - 2].x, 2) +
          Math.pow(trail[trail.length - 1].y - trail[trail.length - 2].y, 2)
        );
        if (speed > 5) {
          generateTrailParticles(x, y, speed, i);
        }
      }
    });
  }

  for (let i = 0; i < 2; i++) {
    if (!seenHands[i] && handTrails[i].length && now - handTrails[i][handTrails[i].length - 1].t > 250) {
      handTrails[i] = [];
    }
    handTrails[i] = handTrails[i].filter((p) => now - p.t < TRAIL_MAX_AGE);
  }
}

function generateTrailParticles(x, y, speed, handIndex) {
  const colors = ["#ffdf5e", "#ffcc33", "#ffaa00", "#ffffff"];
  const count = Math.min(Math.floor(speed / 15) + 1, 5);
  for (let i = 0; i < count; i++) {
    const angle = randRange(-0.5, 0.5);
    trailParticles.push({
      x: x + randRange(-5, 5),
      y: y + randRange(-5, 5),
      vx: Math.cos(angle) * randRange(20, 80) + randRange(-10, 10),
      vy: Math.sin(angle) * randRange(20, 80) + randRange(-10, 10) - 20,
      radius: randRange(1.5, 4),
      color: colors[Math.floor(Math.random() * colors.length)],
      life: randRange(0.15, 0.35),
      age: 0,
      handIndex: handIndex,
    });
  }
}

let camera = null;
async function startCamera() {
  try {
    loadingText.textContent = "Solicitando acceso a la cámara…";

    camera = new Camera(videoEl, {
      onFrame: async () => {
        try {
          await hands.send({ image: videoEl });
        } catch (e) {}
      },
      width: IS_IOS ? 960 : 1280,
      height: IS_IOS ? 540 : 720,
      facingMode: "user",
    });

    await camera.start();
    cameraStarted = true;
    console.log("Cámara iniciada correctamente (iOS:", IS_IOS, ")");
    loadingText.textContent = "Cargando modelo de detección de manos…";

    if (IS_IOS) {
      const ensurePlaying = () => {
        const p = videoEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      };
      ensurePlaying();
      videoEl.addEventListener("loadeddata", ensurePlaying, { once: true });
      document.addEventListener("touchstart", ensurePlaying, { passive: true, once: true });
    }

    setTimeout(() => {
      if (state === STATE.LOADING && !handsReady) {
        console.warn("Timeout: Forzando transición a pantalla de inicio");
        showScreen(STATE.START);
      }
    }, IS_IOS ? 8000 : 5000);

  } catch (err) {
    console.error("Error accediendo a la cámara:", err);
    cameraError = true;
    errorText.textContent =
      "No se pudo acceder a la cámara. En iPad asegúrate de abrir la página con HTTPS o desde localhost, " +
      "y acepta el permiso de cámara en Safari. Luego recarga la página.";
    showScreen(STATE.ERROR);
  }
}

/* ==========================================================================
   UTILIDADES
   ========================================================================== */
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq === 0 ? 0 : (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function addTapListener(el, handler) {
  if (!el) return;
  let lastTouch = 0;
  el.addEventListener("touchend", (e) => {
    lastTouch = Date.now();
    e.preventDefault();
    handler(e);
  }, { passive: false });
  el.addEventListener("click", (e) => {
    if (Date.now() - lastTouch < 500) return;
    handler(e);
  });
}

/* ==========================================================================
   ENTIDADES DEL JUEGO
   ========================================================================== */
function spawnFruit() {
  const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
  const x = randRange(CANVAS_W * 0.15, CANVAS_W * 0.85);
  const targetHeight = randRange(CANVAS_H * 0.15, CANVAS_H * 0.45);
  const g = 1500 * difficultySpeedMul;
  const vy = -Math.sqrt(2 * g * (CANVAS_H - targetHeight));
  const vx = randRange(-160, 160) * difficultySpeedMul;

  fruits.push({
    x, y: CANVAS_H + 60, vx, vy, g,
    radius: type.radius,
    emoji: type.emoji,
    juice: type.juice,
    points: type.points,
    rotation: randRange(0, Math.PI * 2),
    rotationSpeed: randRange(-3, 3),
    sliced: false,
    isBomb: false,
    scale: 1,
  });
}

function spawnBomb() {
  const x = randRange(CANVAS_W * 0.15, CANVAS_W * 0.85);
  const targetHeight = randRange(CANVAS_H * 0.2, CANVAS_H * 0.5);
  const g = 1500 * difficultySpeedMul;
  const vy = -Math.sqrt(2 * g * (CANVAS_H - targetHeight));
  const vx = randRange(-120, 120) * difficultySpeedMul;

  bombs.push({
    x, y: CANVAS_H + 60, vx, vy, g,
    radius: BOMB_RADIUS,
    emoji: BOMB_EMOJI,
    rotation: randRange(0, Math.PI * 2),
    rotationSpeed: randRange(-2, 2),
    sliced: false,
    isBomb: true,
    scale: 1,
    pulsePhase: randRange(0, Math.PI * 2),
    sparkPhase: randRange(0, Math.PI * 2),
  });
}

function shouldSpawnBomb() {
  const baseChance = 0.15;
  const difficultyBonus = Math.min(elapsedPlayTime / 120, 0.15);
  return Math.random() < (baseChance + difficultyBonus);
}

function sliceFruit(fruit, hitX, hitY) {
  fruit.sliced = true;

  const numParticles = randInt(18, 30);
  for (let i = 0; i < numParticles; i++) {
    const angle = randRange(0, Math.PI * 2);
    const speed = randRange(150, 500);
    particles.push({
      x: fruit.x, y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 150,
      g: 1200,
      radius: randRange(3, 9),
      color: fruit.juice,
      life: randRange(0.5, 1.0),
      age: 0,
      trail: [],
    });
  }

  for (let i = 0; i < 12; i++) {
    const angle = randRange(0, Math.PI * 2);
    const speed = randRange(80, 200);
    starBursts.push({
      x: fruit.x, y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.3, 0.6),
      age: 0,
      size: randRange(4, 10),
      color: fruit.juice,
    });
  }

  const now = performance.now();
  if (now - lastComboTime < 500) {
    comboCount++;
  } else {
    comboCount = 1;
  }
  lastComboTime = now;

  const comboMultiplier = Math.min(comboCount, 5);
  const points = fruit.points * comboMultiplier;
  const oldScore = score;
  score += points;
  scoreValueEl.textContent = score;

  const newScoreMultiple = Math.floor(score / 50);
  const oldScoreMultiple = Math.floor(oldScore / 50);
  if (newScoreMultiple > oldScoreMultiple) {
    addHalfLife();
  }

  floatingTexts.push({
    x: fruit.x, y: fruit.y,
    text: `+${points}`,
    age: 0, life: 0.8,
    color: "#ffdf5e",
    size: comboMultiplier > 1 ? 40 + comboMultiplier * 6 : 32,
  });

  if (comboCount >= 2) {
    comboBoxEl.textContent = `🔥 Combo x${comboMultiplier}!`;
    comboBoxEl.style.opacity = "1";
    clearTimeout(comboTimeoutHandle);
    comboTimeoutHandle = setTimeout(() => (comboBoxEl.style.opacity = "0"), 700);
  }

  sliceFlashes.push({ x: hitX, y: hitY, age: 0, life: 0.2, radius: 30 });
  ensureAudio();
  playSlice(randRange(0.85, 1.2));
}

function sliceBomb(bomb, hitX, hitY) {
  if (bomb.sliced) return;
  bomb.sliced = true;

  for (let i = 0; i < 50; i++) {
    const angle = randRange(0, Math.PI * 2);
    const speed = randRange(200, 650);
    particles.push({
      x: bomb.x, y: bomb.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      g: 800,
      radius: randRange(4, 14),
      color: ["#ff4444", "#ff8800", "#ffcc00", "#ff2200", "#ff6600"][randInt(0, 4)],
      life: randRange(0.6, 1.2),
      age: 0,
      trail: [],
    });
  }

  sliceFlashes.push({ x: hitX, y: hitY, age: 0, life: 0.35, radius: 100 });

  floatingTexts.push({
    x: bomb.x, y: bomb.y - 40,
    text: "💥 BOOM!",
    age: 0, life: 0.9,
    color: "#ff4444",
    size: 50,
  });

  comboCount = 0;
  comboBoxEl.textContent = "💥";
  comboBoxEl.style.opacity = "1";
  clearTimeout(comboTimeoutHandle);
  comboTimeoutHandle = setTimeout(() => (comboBoxEl.style.opacity = "0"), 500);

  lives = Math.max(0, lives - 1);
  updateLivesHud();
  ensureAudio();
  playBombExplosion();
  playSlice(0.5, true);

  if (lives <= 0) {
    endGame();
  }
}

function loseLife() {
  lives = Math.max(0, lives - 1);
  updateLivesHud();
  ensureAudio();
  playMiss();

  floatingTexts.push({
    x: CANVAS_W / 2 + randRange(-100, 100),
    y: CANVAS_H / 2 + randRange(-50, 50),
    text: "💔",
    age: 0, life: 0.6,
    color: "#ff2222",
    size: 60,
  });

  if (lives <= 0) {
    endGame();
  }
}

function addHalfLife() {
  if (lives >= MAX_LIVES) return;
  lives = Math.min(MAX_LIVES, lives + 0.5);
  updateLivesHud();
  ensureAudio();
  playLifeUp();

  floatingTexts.push({
    x: CANVAS_W / 2 + randRange(-80, 80),
    y: CANVAS_H / 2 + randRange(-40, 40),
    text: "❤️ +½",
    age: 0, life: 0.8,
    color: "#ff6b6b",
    size: 36,
  });
}

function updateLivesHud() {
  let display = "";
  const fullLives = Math.floor(lives);
  const hasHalf = lives % 1 >= 0.5;

  for (let i = 0; i < fullLives; i++) display += "🍎";
  if (hasHalf) display += "🍎";
  const remaining = MAX_LIVES - Math.ceil(lives);
  for (let i = 0; i < remaining; i++) display += "🖤";

  livesValueEl.textContent = display || "🖤".repeat(MAX_LIVES);
}

/* ==========================================================================
   RANKING / HIGH SCORE
   ========================================================================== */
function getHighScores() {
  try {
    const data = localStorage.getItem("handSliceHighScores");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHighScores(scores) {
  try {
    localStorage.setItem("handSliceHighScores", JSON.stringify(scores));
  } catch (e) {}
}

function updateHighScores(score) {
  const scores = getHighScores();
  scores.push(score);
  scores.sort((a, b) => b - a);
  const topScores = scores.slice(0, 10);
  saveHighScores(topScores);
  return topScores;
}

function isNewHighScore(score) {
  const scores = getHighScores();
  return scores.length < 10 || score > scores[scores.length - 1];
}

function displayRanking(scores, currentScore) {
  if (!rankingListEl) return;

  let html = "";
  const isNew = isNewHighScore(currentScore);

  if (scores.length === 0) {
    html = "<div style='color: #999;'>Sin puntajes aún</div>";
  } else {
    scores.forEach((s, index) => {
      const isCurrent = s === currentScore && scores.indexOf(s) === index;
      const highlight = isCurrent ? ' style="color: #ffdf5e; font-weight: bold;"' : '';
      const medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : `${index + 1}. `;
      html += `<div${highlight}>${medal}${s}${isCurrent && isNew ? " ✨" : ""}</div>`;
    });
  }

  rankingListEl.innerHTML = html;

  if (isNew && currentScore > 0) {
    finalMessageEl.textContent = "🎉 ¡Nuevo récord! 🎉";
  }
}

/* ==========================================================================
   BUCLE PRINCIPAL
   ========================================================================== */
function update(dt) {
  if (state !== STATE.PLAYING) return;

  elapsedPlayTime += dt;

  difficultySpeedMul = 1 + Math.min(elapsedPlayTime / 15, 1.8);
  spawnInterval = Math.max(600, 1400 - elapsedPlayTime * 18);
  bombSpawnInterval = Math.max(2500, 5000 - elapsedPlayTime * 30);

  spawnTimer += dt * 1000;
  if (spawnTimer > spawnInterval) {
    spawnTimer = 0;

    if (shouldSpawnBomb()) {
      spawnBomb();
    } else {
      spawnFruit();
    }

    if (Math.random() < 0.12 + Math.min(elapsedPlayTime / 60, 0.12)) {
      if (shouldSpawnBomb()) {
        spawnBomb();
      } else {
        spawnFruit();
      }
    }
  }

  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    if (f.sliced) { fruits.splice(i, 1); continue; }
    f.vy += f.g * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.rotation += f.rotationSpeed * dt;

    if (f.y - f.radius > CANVAS_H + 40) {
      fruits.splice(i, 1);
      loseLife();
    }
  }

  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (b.sliced) { bombs.splice(i, 1); continue; }
    b.vy += b.g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rotation += b.rotationSpeed * dt;
    b.pulsePhase += dt * 3;
    b.sparkPhase += dt * 8;

    if (b.y - b.radius > CANVAS_H + 40) {
      bombs.splice(i, 1);
    }
  }

  const now = performance.now();
  for (const trail of handTrails) {
    if (trail.length < 2) continue;

    const trailPointA = trail[trail.length - 2];
    const trailPointB = trail[trail.length - 1];

    if (now - trailPointB.t > TRAIL_MAX_AGE) continue;

    for (const fruit of fruits) {
      if (fruit.sliced) continue;
      const dist = pointToSegmentDistance(
        fruit.x, fruit.y,
        trailPointA.x, trailPointA.y,
        trailPointB.x, trailPointB.y
      );
      if (dist < fruit.radius * 0.9) {
        sliceFruit(fruit, trailPointB.x, trailPointB.y);
      }
    }

    for (const bomb of bombs) {
      if (bomb.sliced) continue;
      const dist = pointToSegmentDistance(
        bomb.x, bomb.y,
        trailPointA.x, trailPointA.y,
        trailPointB.x, trailPointB.y
      );
      if (dist < bomb.radius * 0.85) {
        sliceBomb(bomb, trailPointB.x, trailPointB.y);
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age > p.life) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.trail) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) p.trail.shift();
    }
  }

  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const p = trailParticles[i];
    p.age += dt;
    if (p.age > p.life) { trailParticles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;
    p.radius *= (1 - dt * 0.5);
  }

  for (let i = starBursts.length - 1; i >= 0; i--) {
    const s = starBursts[i];
    s.age += dt;
    if (s.age > s.life) { starBursts.splice(i, 1); continue; }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 300 * dt;
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.age += dt;
    if (t.age > t.life) floatingTexts.splice(i, 1);
  }

  for (let i = sliceFlashes.length - 1; i >= 0; i--) {
    const s = sliceFlashes[i];
    s.age += dt;
    if (s.age > s.life) sliceFlashes.splice(i, 1);
  }
}

/* ---------------------- Render ---------------------- */
function drawVideoFrame() {
  if (!cameraStarted || videoEl.readyState < 2) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    return;
  }
  ctx.save();
  ctx.translate(CANVAS_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTrails() {
  for (const trail of handTrails) {
    if (trail.length < 2) continue;

    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const alpha = i / trail.length;
      const alphaSmooth = alpha * alpha;

      ctx.shadowColor = `rgba(255, 223, 94, ${alphaSmooth * 0.5})`;
      ctx.shadowBlur = 25;
      ctx.strokeStyle = `rgba(255, 223, 94, ${alphaSmooth * 0.8})`;
      ctx.lineWidth = 8 * alphaSmooth + 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alphaSmooth * 0.7})`;
      ctx.lineWidth = 3 * alphaSmooth + 1;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const tip = trail[trail.length - 1];
    const gradient = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 25);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,223,94,0.8)");
    gradient.addColorStop(0.7, "rgba(255,200,50,0.4)");
    gradient.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const p of trailParticles) {
    const alpha = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(p.radius, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawBombs() {
  for (const b of bombs) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    const pulse = 1 + Math.sin(b.pulsePhase) * 0.04;
    ctx.scale(pulse, pulse);

    const glow = ctx.createRadialGradient(0, 0, b.radius * 0.3, 0, 0, b.radius * 1.5);
    glow.addColorStop(0, "rgba(255,0,0,0.3)");
    glow.addColorStop(0.5, "rgba(255,0,0,0.1)");
    glow.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    const sparkSize = 8 + Math.sin(b.sparkPhase) * 3;
    ctx.fillStyle = "#ff8800";
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(8, -12, sparkSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.shadowColor = "rgba(255,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.font = `${b.radius * 2.2}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.emoji, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawFruits() {
  for (const f of fruits) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);

    const glow = ctx.createRadialGradient(0, 0, f.radius * 0.2, 0, 0, f.radius * 1.3);
    glow.addColorStop(0, "rgba(0,0,0,0.5)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 16;
    ctx.font = `${f.radius * 2.3}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.emoji, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = 1 - p.age / p.life;
    if (p.trail && p.trail.length > 1) {
      for (let i = 1; i < p.trail.length; i++) {
        const tAlpha = (i / p.trail.length) * alpha * 0.3;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = tAlpha;
        ctx.beginPath();
        ctx.arc(p.trail[i].x, p.trail[i].y, p.radius * (i / p.trail.length) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawStarBursts() {
  for (const s of starBursts) {
    const alpha = 1 - s.age / s.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 15;

    const size = s.size * (1 + s.age * 2);
    ctx.translate(s.x, s.y);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + s.age * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * size * 0.3, Math.sin(angle) * size * 0.3, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawFloatingTexts() {
  for (const t of floatingTexts) {
    const alpha = 1 - t.age / t.life;
    ctx.save();
    ctx.globalAlpha = Math.max(alpha, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = t.color || "#ffdf5e";
    ctx.font = `bold ${t.size || 32}px sans-serif`;
    ctx.fillText(t.text, t.x, t.y - t.age * 70);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawSliceFlashes() {
  for (const s of sliceFlashes) {
    const alpha = 1 - s.age / s.life;
    const radius = s.radius || 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius + s.age * 200);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.3, "rgba(255,223,94,0.5)");
    gradient.addColorStop(1, "rgba(255,223,94,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius + s.age * 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function render() {
  drawVideoFrame();
  if (state === STATE.PLAYING || state === STATE.START || state === STATE.INFO) {
    drawBombs();
    drawFruits();
    drawParticles();
    drawStarBursts();
    drawFloatingTexts();
    drawSliceFlashes();
    drawTrails();
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

/* ==========================================================================
   MÁQUINA DE ESTADOS / UI
   ========================================================================== */
function showScreen(next) {
  state = next;
  screenLoading.classList.toggle("hidden", next !== STATE.LOADING);
  screenStart.classList.toggle("hidden", next !== STATE.START);
  screenInfo.classList.toggle("hidden", next !== STATE.INFO);
  screenGameover.classList.toggle("hidden", next !== STATE.GAMEOVER);
  screenError.classList.toggle("hidden", next !== STATE.ERROR);
  hud.classList.toggle("hidden", next !== STATE.PLAYING);

  if (next === STATE.START) {
    const scores = getHighScores();
    highScoreEl.textContent = scores[0] || 0;
  }
}

function startGame() {
  ensureAudio();
  score = 0;
  lives = MAX_LIVES;
  fruits = [];
  bombs = [];
  particles = [];
  floatingTexts = [];
  sliceFlashes = [];
  starBursts = [];
  trailParticles = [];
  comboCount = 0;
  elapsedPlayTime = 0;
  spawnTimer = 0;
  bombSpawnTimer = 0;
  spawnInterval = 1400;
  bombSpawnInterval = 5000;
  difficultySpeedMul = 1;
  scoreValueEl.textContent = "0";
  updateLivesHud();
  showScreen(STATE.PLAYING);
}

function endGame() {
  const scores = updateHighScores(score);
  finalScoreEl.textContent = score;
  displayRanking(scores, score);

  if (!finalMessageEl.textContent.includes("Nuevo récord")) {
    finalMessageEl.textContent =
      score >= 300 ? "¡Manos de ninja! 🥷" :
      score >= 150 ? "¡Muy buen corte!" :
      "Sigue practicando tu técnica 🍓";
  }

  playGameOver();
  showScreen(STATE.GAMEOVER);
}

addTapListener(btnStart, startGame);
addTapListener(btnRestart, startGame);
addTapListener(btnInfo, () => showScreen(STATE.INFO));
addTapListener(btnInfoClose, () => showScreen(STATE.START));

/* ---------------------- Arranque ---------------------- */
async function init() {
  console.log("Inicializando Hand Slice... (iOS:", IS_IOS, ")");

  installIOSAudioUnlock();

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  await startCamera();
  requestAnimationFrame(loop);
}

init();
