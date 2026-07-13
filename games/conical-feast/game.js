(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("startButton");
  const bankedBiomass = document.getElementById("bankedBiomass");
  const upgradeButtons = [...document.querySelectorAll("[data-upgrade]")];

  const TAU = Math.PI * 2;
  const DPR_MAX = 2;

  const COLORS = {
    ink: "#fffaf0",
    muted: "rgba(255,250,240,0.72)",
    faint: "rgba(255,250,240,0.16)",
    waterTop: "#13536a",
    waterMid: "#0a3447",
    waterLow: "#061724",
    cone: "rgba(91,231,214,0.18)",
    coneLine: "rgba(255,208,138,0.72)",
    player: "#ff9f86",
    playerArm: "#ffd08a",
    home: "#8dffb7",
    good: "#8dffb7",
    warm: "#ffb35f",
    danger: "#ff6f7d",
    dark: "#061015",
  };

  const PREY_TYPES = [
    {
      id: "plankton",
      label: "Plankton",
      radius: 5,
      hp: 9,
      biomass: 3,
      speed: 16,
      turn: 0.9,
      color: "#b7f4d2",
      minDepth: 1,
      weight: 48,
      threat: 0,
    },
    {
      id: "krill",
      label: "Krill",
      radius: 7,
      hp: 16,
      biomass: 5,
      speed: 28,
      turn: 1.2,
      color: "#ffd08a",
      minDepth: 1,
      weight: 36,
      threat: 0,
    },
    {
      id: "minnow",
      label: "Minnow",
      radius: 11,
      hp: 34,
      biomass: 10,
      speed: 48,
      turn: 1.6,
      color: "#5be7d6",
      minDepth: 1,
      weight: 24,
      threat: 1.5,
    },
    {
      id: "reef-fish",
      label: "Reef Fish",
      radius: 16,
      hp: 70,
      biomass: 18,
      speed: 54,
      turn: 1.3,
      color: "#f7e38b",
      minDepth: 2,
      weight: 16,
      threat: 5,
    },
    {
      id: "needlefish",
      label: "Needlefish",
      radius: 22,
      hp: 128,
      biomass: 34,
      speed: 76,
      turn: 1.0,
      color: "#b9e9ff",
      minDepth: 3,
      weight: 10,
      threat: 10,
    },
    {
      id: "brute",
      label: "Brute",
      radius: 30,
      hp: 240,
      biomass: 64,
      speed: 36,
      turn: 0.62,
      color: "#ff7f6e",
      minDepth: 4,
      weight: 6,
      threat: 18,
    },
  ];

  const UPGRADE_ORDER = ["capacity", "speed", "health", "cone", "size"];
  const UPGRADE_BASE_COST = {
    capacity: 25,
    speed: 28,
    health: 30,
    cone: 34,
    size: 38,
  };

  const upgradeLabels = {
    capacity: "Capacity",
    speed: "Speed",
    health: "Health",
    cone: "Cone",
    size: "Size",
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDiff = (a, b) => {
    let d = (a - b + Math.PI) % TAU;
    if (d < 0) d += TAU;
    return d - Math.PI;
  };
  const pct = (value, max) => `${clamp((value / max) * 100, 0, 100).toFixed(0)}%`;

  class RNG {
    constructor(seed) {
      this.state = seed >>> 0;
    }

    next() {
      let t = (this.state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
      return min + (max - min) * this.next();
    }

    pickWeighted(items, weightKey = "weight") {
      const total = items.reduce((sum, item) => sum + item[weightKey], 0);
      let roll = this.next() * total;
      for (const item of items) {
        roll -= item[weightKey];
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    }
  }

  const state = {
    running: false,
    lastTs: 0,
    time: 0,
    spawnTimer: 0,
    messageTimer: 0,
    message: "",
    rng: new RNG(0xC0FFEE),
    world: { w: 1280, h: 720 },
    banked: 0,
    upgrades: {
      capacity: 0,
      speed: 0,
      health: 0,
      cone: 0,
      size: 0,
    },
    player: {
      x: 180,
      y: 360,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      cargo: 0,
      cargoPulse: 0,
      hurtPulse: 0,
      basePulse: 0,
      bitePulse: 0,
      lastCaptureAt: 0,
    },
    prey: [],
    particles: [],
    floaters: [],
  };

  state.rng = new RNG(0xC0FFEE);

  const input = {
    keys: new Set(),
    pointer: {
      x: state.player.x + 100,
      y: state.player.y,
      down: false,
      has: false,
    },
  };

  function stats() {
    const u = state.upgrades;
    return {
      radius: 15 + u.size * 2.6,
      maxHp: 100 + u.health * 30,
      maxCargo: 18 + u.capacity * 10,
      speed: 168 + u.speed * 23 + u.size * 2,
      acceleration: 8.5 + u.speed * 0.42,
      coneLength: 168 + u.cone * 30 + u.size * 5,
      coneAngle: ((34 + u.cone * 4.2) * Math.PI) / 180,
      drain: 24 + u.size * 6 + u.cone * 2.5,
      edibleRadius: 13 + u.size * 4.4,
      depositRate: 42 + u.capacity * 7,
    };
  }

  function upgradeCost(key) {
    const level = state.upgrades[key];
    return Math.round(UPGRADE_BASE_COST[key] * Math.pow(1.58, level) + level * 9);
  }

  function depthLevel() {
    const upgradeMass = Object.values(state.upgrades).reduce((sum, value) => sum + value, 0);
    return clamp(1 + Math.floor((state.banked + upgradeMass * 42) / 145), 1, 6);
  }

  function homebase() {
    const { w, h } = state.world;
    return {
      x: clamp(w * 0.14, 86, 190),
      y: clamp(h * 0.68, 230, h - 122),
      radius: clamp(Math.min(w, h) * 0.09, 48, 68),
    };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(320, Math.floor(rect.height));
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      state.world.w = width;
      state.world.h = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      keepPlayerInBounds();
    }
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    input.pointer.x = clamp(event.clientX - rect.left, 0, rect.width);
    input.pointer.y = clamp(event.clientY - rect.top, 0, rect.height);
    input.pointer.has = true;
  }

  function startDive() {
    resizeCanvas();
    overlay.hidden = true;
    state.running = true;
    state.lastTs = 0;
    state.time = 0;
    state.spawnTimer = 0;
    state.messageTimer = 0;
    state.prey.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    const base = homebase();
    const s = stats();
    Object.assign(state.player, {
      x: base.x,
      y: base.y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: s.maxHp,
      cargo: 0,
      cargoPulse: 0,
      hurtPulse: 0,
      basePulse: 0,
      bitePulse: 0,
    });

    for (let i = 0; i < 18; i += 1) spawnPrey(true);
    setMessage("Feast started");
  }

  function buyUpgrade(key) {
    if (!UPGRADE_BASE_COST[key]) return;
    const cost = upgradeCost(key);
    if (state.banked < cost) {
      setMessage(`${upgradeLabels[key]} needs ${cost} biomass`);
      return;
    }

    const before = stats();
    state.banked -= cost;
    state.upgrades[key] += 1;
    const after = stats();
    if (key === "health") {
      state.player.hp += after.maxHp - before.maxHp;
    }
    state.player.hp = clamp(state.player.hp, 0, after.maxHp);
    setMessage(`${upgradeLabels[key]} upgraded`);
  }

  function keyVector() {
    let x = 0;
    let y = 0;
    if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) x -= 1;
    if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) x += 1;
    if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) y -= 1;
    if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) y += 1;

    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length, active: true };
    }

    if (input.pointer.down) {
      const dx = input.pointer.x - state.player.x;
      const dy = input.pointer.y - state.player.y;
      const length = Math.hypot(dx, dy);
      if (length > 22) return { x: dx / length, y: dy / length, active: true };
    }

    return { x: 0, y: 0, active: false };
  }

  function update(dt) {
    state.time += dt;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.player.cargoPulse = Math.max(0, state.player.cargoPulse - dt);
    state.player.hurtPulse = Math.max(0, state.player.hurtPulse - dt);
    state.player.basePulse = Math.max(0, state.player.basePulse - dt);
    state.player.bitePulse = Math.max(0, state.player.bitePulse - dt);

    updatePlayer(dt);
    updatePrey(dt);
    updateCapture(dt);
    updateCollisions(dt);
    updateHomebase(dt);
    updateParticles(dt);
    updateSpawning(dt);
  }

  function updatePlayer(dt) {
    const s = stats();
    const p = state.player;
    const mv = keyVector();

    if (input.pointer.has) {
      p.angle = Math.atan2(input.pointer.y - p.y, input.pointer.x - p.x);
    } else if (Math.hypot(p.vx, p.vy) > 12) {
      p.angle = Math.atan2(p.vy, p.vx);
    }

    const targetVx = mv.x * s.speed;
    const targetVy = mv.y * s.speed;
    const t = clamp(dt * s.acceleration, 0, 1);
    p.vx = lerp(p.vx, targetVx, t);
    p.vy = lerp(p.vy, targetVy, t);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    keepPlayerInBounds();
  }

  function keepPlayerInBounds() {
    const s = stats();
    const p = state.player;
    p.x = clamp(p.x, s.radius + 8, state.world.w - s.radius - 8);
    p.y = clamp(p.y, s.radius + 8, state.world.h - s.radius - 8);
  }

  function updatePrey(dt) {
    const s = stats();
    const p = state.player;
    const base = homebase();

    for (const prey of state.prey) {
      prey.hitTimer = Math.max(0, prey.hitTimer - dt);
      prey.flash = Math.max(0, prey.flash - dt);
      prey.wander -= dt;
      if (prey.wander <= 0) {
        prey.wander = state.rng.range(0.6, 2.4);
        prey.targetAngle += state.rng.range(-1.4, 1.4);
      }

      const awayFromPlayer = Math.atan2(prey.y - p.y, prey.x - p.x);
      const playerDistance = Math.hypot(prey.x - p.x, prey.y - p.y);
      const nearHome = Math.hypot(prey.x - base.x, prey.y - base.y) < base.radius + 42;
      const isTooLarge = prey.radius > s.edibleRadius;

      if (prey.hitTimer > 0 || (playerDistance < 150 && !isTooLarge)) {
        prey.targetAngle = awayFromPlayer + state.rng.range(-0.34, 0.34);
      } else if (isTooLarge && prey.threat > 0 && playerDistance < 230 && !nearHome) {
        prey.targetAngle = awayFromPlayer + Math.PI + state.rng.range(-0.24, 0.24);
      }

      prey.angle += angleDiff(prey.targetAngle, prey.angle) * clamp(dt * prey.turn, 0, 1);
      const speed = prey.speed * (prey.hitTimer > 0 ? 1.34 : 1);
      prey.x += Math.cos(prey.angle) * speed * dt;
      prey.y += Math.sin(prey.angle) * speed * dt;

      const margin = prey.radius + 12;
      if (prey.x < margin || prey.x > state.world.w - margin) {
        prey.x = clamp(prey.x, margin, state.world.w - margin);
        prey.targetAngle = Math.PI - prey.targetAngle;
      }
      if (prey.y < margin || prey.y > state.world.h - margin) {
        prey.y = clamp(prey.y, margin, state.world.h - margin);
        prey.targetAngle = -prey.targetAngle;
      }
    }
  }

  function updateCapture(dt) {
    const s = stats();
    const p = state.player;
    const cargoRoom = s.maxCargo - p.cargo;
    let lockedCount = 0;
    let blockedByCargo = false;

    for (let i = state.prey.length - 1; i >= 0; i -= 1) {
      const prey = state.prey[i];
      prey.locked = false;
      prey.tooLarge = false;

      if (!isInCone(prey, s)) continue;

      if (prey.radius > s.edibleRadius) {
        prey.tooLarge = true;
        prey.flash = 0.1;
        continue;
      }

      if (cargoRoom <= 0.01) {
        blockedByCargo = true;
        continue;
      }

      const fitBonus = clamp((s.edibleRadius - prey.radius) / Math.max(1, s.edibleRadius), 0, 0.55);
      prey.locked = true;
      prey.hitTimer = 0.18;
      prey.hp -= s.drain * (1 + fitBonus) * dt;
      lockedCount += 1;
      p.bitePulse = 0.16;

      addParticle(prey.x, prey.y, COLORS.coneLine, 1);

      if (prey.hp <= 0) {
        capturePrey(prey, i);
      }
    }

    if (lockedCount > 0) state.player.lastCaptureAt = state.time;
    if (blockedByCargo && state.time % 0.8 < dt) {
      state.player.cargoPulse = 0.28;
      setMessage("Cargo full");
    }
  }

  function isInCone(target, s) {
    const p = state.player;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < s.radius + target.radius) return true;
    if (d > s.coneLength + target.radius) return false;
    const a = Math.atan2(dy, dx);
    return Math.abs(angleDiff(a, p.angle)) <= s.coneAngle * 0.5;
  }

  function capturePrey(prey, index) {
    const s = stats();
    const p = state.player;
    const room = Math.max(0, s.maxCargo - p.cargo);
    const gained = Math.min(room, prey.biomass);
    p.cargo += gained;
    p.cargoPulse = 0.24;

    state.prey.splice(index, 1);
    addFloater(prey.x, prey.y, `+${Math.round(gained)}`, COLORS.good);
    burst(prey.x, prey.y, prey.color, Math.max(7, Math.round(prey.radius)));

    if (gained < prey.biomass) setMessage("Cargo full");
  }

  function updateCollisions(dt) {
    const s = stats();
    const p = state.player;
    const base = homebase();

    for (const prey of state.prey) {
      const dx = p.x - prey.x;
      const dy = p.y - prey.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const overlap = s.radius + prey.radius - d;
      if (overlap <= 0) continue;

      const nx = dx / d;
      const ny = dy / d;
      p.x += nx * overlap * 0.25;
      p.y += ny * overlap * 0.25;
      prey.x -= nx * overlap * 0.25;
      prey.y -= ny * overlap * 0.25;

      const safeAtBase = Math.hypot(p.x - base.x, p.y - base.y) < base.radius * 0.92;
      const dangerous = prey.threat > 0 && (prey.radius > s.edibleRadius * 0.78 || prey.tooLarge);
      if (!safeAtBase && dangerous) {
        const damage = prey.threat * dt * (prey.radius > s.edibleRadius ? 1.45 : 0.85);
        p.hp -= damage;
        p.hurtPulse = 0.16;
        prey.flash = 0.12;
      }
    }

    keepPlayerInBounds();

    if (p.hp <= 0) {
      blackout();
    }
  }

  function updateHomebase(dt) {
    const s = stats();
    const p = state.player;
    const base = homebase();
    const d = Math.hypot(p.x - base.x, p.y - base.y);

    if (d <= base.radius) {
      p.basePulse = 0.2;
      p.hp = clamp(p.hp + 34 * dt, 0, s.maxHp);
      if (p.cargo > 0) {
        const moved = Math.min(p.cargo, s.depositRate * dt);
        p.cargo -= moved;
        state.banked += moved;
        if (state.time % 0.16 < dt) addParticle(base.x, base.y, COLORS.home, 3);
      }
    }
  }

  function blackout() {
    const base = homebase();
    const s = stats();
    const lost = Math.round(state.player.cargo);
    state.player.x = base.x;
    state.player.y = base.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.hp = s.maxHp;
    state.player.cargo = 0;
    state.player.hurtPulse = 0;
    state.prey.length = Math.max(0, state.prey.length - 4);
    burst(base.x, base.y, COLORS.home, 22);
    setMessage(lost > 0 ? `Blacked out. ${lost} cargo lost.` : "Blacked out at den.");
  }

  function updateSpawning(dt) {
    const targetCount = 24 + depthLevel() * 4;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.prey.length < targetCount) {
      state.spawnTimer = Math.max(0.18, 0.72 - depthLevel() * 0.055);
      spawnPrey(false);
    }
  }

  function spawnPrey(initial) {
    const depth = depthLevel();
    const candidates = PREY_TYPES.filter((item) => item.minDepth <= depth);
    const type = state.rng.pickWeighted(candidates);
    const margin = type.radius + 18;
    let x = state.rng.range(margin, state.world.w - margin);
    let y = state.rng.range(margin, state.world.h - margin);

    if (!initial) {
      const edge = Math.floor(state.rng.next() * 4);
      if (edge === 0) x = margin;
      if (edge === 1) x = state.world.w - margin;
      if (edge === 2) y = margin;
      if (edge === 3) y = state.world.h - margin;
    }

    const base = homebase();
    for (let i = 0; i < 10; i += 1) {
      const tooCloseToBase = Math.hypot(x - base.x, y - base.y) < base.radius + 88;
      const tooCloseToPlayer = Math.hypot(x - state.player.x, y - state.player.y) < 150;
      if (!tooCloseToBase && !tooCloseToPlayer) break;
      x = state.rng.range(margin, state.world.w - margin);
      y = state.rng.range(margin, state.world.h - margin);
    }

    state.prey.push({
      ...type,
      x,
      y,
      angle: state.rng.range(0, TAU),
      targetAngle: state.rng.range(0, TAU),
      hp: type.hp,
      maxHp: type.hp,
      wander: state.rng.range(0.2, 1.4),
      hitTimer: 0,
      flash: 0,
      locked: false,
      tooLarge: false,
    });
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 5 * dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.life -= dt;
      floater.y -= 26 * dt;
      if (floater.life <= 0) state.floaters.splice(i, 1);
    }
  }

  function addParticle(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) {
      const angle = state.rng.range(0, TAU);
      const speed = state.rng.range(8, 42);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: state.rng.range(1.2, 3.4),
        color,
        life: state.rng.range(0.25, 0.82),
        maxLife: 0.82,
      });
    }
  }

  function burst(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) addParticle(x, y, color, 1);
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 0.95 });
  }

  function setMessage(text) {
    state.message = text;
    state.messageTimer = 1.8;
  }

  function render() {
    const { w, h } = state.world;
    ctx.clearRect(0, 0, w, h);
    drawWater();
    drawHomebase();
    drawCone();
    drawCaptureTethers();

    for (const prey of state.prey) drawPrey(prey);
    drawPlayer();
    drawParticles();
    drawFloaters();
    drawMessage();
  }

  function drawWater() {
    const { w, h } = state.world;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.waterTop);
    gradient.addColorStop(0.48, COLORS.waterMid);
    gradient.addColorStop(1, COLORS.waterLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "rgba(255,250,240,0.09)";
    ctx.lineWidth = 1;
    const drift = (state.time * 18) % 80;
    for (let y = -80 + drift; y < h + 80; y += 80) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 48) {
        const wave = Math.sin(x * 0.012 + state.time * 0.5) * 7;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "rgba(91,231,214,0.2)";
    for (let x = 0; x < w; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 36, h);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 22; i += 1) {
      const x = ((i * 97 + state.time * 9) % (w + 80)) - 40;
      const y = (i * 53 + Math.sin(state.time + i) * 18) % h;
      const r = 1.6 + (i % 4) * 0.75;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(255,208,138,0.28)" : "rgba(255,250,240,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHomebase() {
    const base = homebase();
    const pulse = 1 + Math.sin(state.time * 3.2) * 0.03 + state.player.basePulse * 0.22;
    ctx.save();
    ctx.translate(base.x, base.y);

    const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, base.radius * 1.58);
    glow.addColorStop(0, "rgba(141,255,183,0.28)");
    glow.addColorStop(1, "rgba(141,255,183,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, base.radius * 1.45 * pulse, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,208,138,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, base.radius * pulse, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(6,16,21,0.62)";
    ctx.beginPath();
    ctx.arc(0, 0, base.radius * 0.78, 0, TAU);
    ctx.fill();

    drawDenRock(-34, 26, 26, 19, "#285665");
    drawDenRock(-8, 18, 34, 24, "#173e4e");
    drawDenRock(26, 26, 27, 18, "#2d6974");
    drawReefBranch(-32, 20, 28, -40, "#8dffb7");
    drawReefBranch(28, 24, 24, 38, "#ffd08a");

    ctx.fillStyle = "rgba(238,247,244,0.78)";
    ctx.font = "700 10px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("DEN", 0, base.radius + 18);
    ctx.restore();
  }

  function drawDenRock(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, width, height, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,250,240,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawReefBranch(x, y, height, lean, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * 0.12, -height * 0.5, lean * 0.2, -height);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lean * 0.1, -height * 0.45);
    ctx.lineTo(lean * 0.4, -height * 0.63);
    ctx.moveTo(lean * 0.14, -height * 0.66);
    ctx.lineTo(lean * -0.08, -height * 0.83);
    ctx.stroke();
    ctx.restore();
  }

  function drawCone() {
    const s = stats();
    const p = state.player;
    const left = p.angle - s.coneAngle * 0.5;
    const right = p.angle + s.coneAngle * 0.5;
    const pulse = 0.9 + Math.sin(state.time * 7.5) * 0.1;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, s.coneLength * pulse, left, right);
    ctx.closePath();
    ctx.fillStyle = COLORS.cone;
    ctx.fill();
    ctx.strokeStyle = COLORS.coneLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = "rgba(214,242,223,0.17)";
    ctx.lineWidth = 1;
    for (let r = 48; r < s.coneLength; r += 44) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + (state.time * 24) % 44, left, right);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCaptureTethers() {
    const s = stats();
    const p = state.player;
    const locked = state.prey.filter((prey) => prey.locked);
    if (!locked.length) return;

    ctx.save();
    ctx.lineCap = "round";
    for (const prey of locked) {
      const dx = prey.x - p.x;
      const dy = prey.y - p.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / distance;
      const ny = dy / distance;
      const side = ((prey.x + prey.y) % 2 > 1 ? 1 : -1) * Math.min(42, distance * 0.16);
      const startX = p.x + nx * s.radius * 0.74 - ny * side * 0.18;
      const startY = p.y + ny * s.radius * 0.74 + nx * side * 0.18;
      const midX = (p.x + prey.x) * 0.5 - ny * side + Math.sin(state.time * 8 + prey.radius) * 6;
      const midY = (p.y + prey.y) * 0.5 + nx * side + Math.cos(state.time * 7 + prey.radius) * 6;

      ctx.strokeStyle = "rgba(255,208,138,0.78)";
      ctx.lineWidth = Math.max(3, s.radius * 0.16);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, prey.x, prey.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,250,240,0.42)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, prey.x, prey.y);
      ctx.stroke();

      const bead = (state.time * 2.8 + prey.radius * 0.03) % 1;
      const bx = (1 - bead) * (1 - bead) * startX + 2 * (1 - bead) * bead * midX + bead * bead * prey.x;
      const by = (1 - bead) * (1 - bead) * startY + 2 * (1 - bead) * bead * midY + bead * bead * prey.y;
      ctx.fillStyle = "rgba(255,250,240,0.9)";
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const s = stats();
    const p = state.player;
    const hurt = p.hurtPulse > 0 ? p.hurtPulse / 0.16 : 0;
    const cargo = p.cargoPulse > 0 ? p.cargoPulse / 0.28 : 0;
    const bite = p.bitePulse > 0 ? p.bitePulse / 0.16 : 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < 6; i += 1) {
      const offset = (i - 2.5) * s.radius * 0.22;
      const curl = Math.sin(state.time * 5 + i) * s.radius * 0.2;
      const reach = s.radius * (1.25 + (i % 2) * 0.18 + bite * 0.35);
      ctx.strokeStyle = i % 2 ? COLORS.playerArm : "#ffbf79";
      ctx.lineWidth = Math.max(4, s.radius * 0.22);
      ctx.beginPath();
      ctx.moveTo(-s.radius * 0.45, offset * 0.3);
      ctx.quadraticCurveTo(-s.radius * 0.98, offset + curl, -reach, offset * 1.15 + curl * 0.7);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,250,240,0.45)";
      ctx.beginPath();
      ctx.arc(-reach + s.radius * 0.1, offset * 1.08 + curl * 0.62, Math.max(1.5, s.radius * 0.07), 0, TAU);
      ctx.fill();
    }

    const bodyGradient = ctx.createRadialGradient(-s.radius * 0.26, -s.radius * 0.28, 2, 0, 0, s.radius * 1.45);
    bodyGradient.addColorStop(0, hurt > 0 ? "#ffd2c8" : "#ffd0b9");
    bodyGradient.addColorStop(0.58, cargo > 0 ? "#ffb35f" : COLORS.player);
    bodyGradient.addColorStop(1, "#d76472");
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.radius * (1.04 + bite * 0.08), s.radius * 0.95, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = COLORS.dark;
    ctx.beginPath();
    ctx.arc(s.radius * 0.34, -s.radius * 0.24, Math.max(2.2, s.radius * 0.12), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.radius * 0.38, s.radius * 0.24, Math.max(2.2, s.radius * 0.12), 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,250,240,0.46)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(s.radius * 0.18, 0, Math.max(3, s.radius * 0.18 + bite * 2), -0.72, 0.72);
    ctx.stroke();

    ctx.restore();
  }

  function drawPrey(prey) {
    ctx.save();
    ctx.translate(prey.x, prey.y);
    ctx.rotate(prey.angle);

    const locked = prey.locked;
    const flash = prey.flash > 0 || prey.hitTimer > 0;
    ctx.globalAlpha = locked ? 1 : 0.94;

    if (prey.id === "plankton") {
      ctx.fillStyle = flash ? COLORS.coneLine : prey.color;
      ctx.beginPath();
      ctx.arc(0, 0, prey.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(238,247,244,0.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, prey.radius + 3, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = flash ? "#eef7f4" : prey.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, prey.radius * 1.35, prey.radius * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-prey.radius * 1.0, 0);
      ctx.lineTo(-prey.radius * 1.72, -prey.radius * 0.55);
      ctx.lineTo(-prey.radius * 1.64, prey.radius * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLORS.dark;
      ctx.beginPath();
      ctx.arc(prey.radius * 0.7, -prey.radius * 0.12, Math.max(1.4, prey.radius * 0.1), 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    if (prey.hp < prey.maxHp || prey.locked || prey.tooLarge) {
      const width = Math.max(28, prey.radius * 2.8);
      const x = prey.x - width * 0.5;
      const y = prey.y - prey.radius - 14;
      ctx.fillStyle = "rgba(6,16,21,0.72)";
      ctx.fillRect(x, y, width, 4);
      ctx.fillStyle = prey.tooLarge ? COLORS.danger : COLORS.warm;
      ctx.fillRect(x, y, width * clamp(prey.hp / prey.maxHp, 0, 1), 4);
    }
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.save();
    ctx.font = "800 14px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const floater of state.floaters) {
      ctx.globalAlpha = clamp(floater.life, 0, 1);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  function drawMessage() {
    if (state.messageTimer <= 0) return;
    const { w } = state.world;
    ctx.save();
    ctx.globalAlpha = clamp(state.messageTimer, 0, 1);
    ctx.fillStyle = "rgba(6,16,21,0.76)";
    ctx.strokeStyle = "rgba(238,247,244,0.18)";
    roundRect(ctx, w * 0.5 - 128, 18, 256, 34, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "750 13px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.message, w * 0.5, 35);
    ctx.restore();
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function updateHud() {
    const s = stats();
    const p = state.player;
    const cargoFull = p.cargo >= s.maxCargo - 0.05;
    const depth = depthLevel();
    const octopusSize = Math.round(s.edibleRadius);

    hud.innerHTML = `
      <div class="meter">
        <div class="meter-label"><span>HP</span><span class="meter-value">${Math.ceil(p.hp)} / ${s.maxHp}</span></div>
        <div class="bar"><span style="--value:${pct(p.hp, s.maxHp)}; --fill:${p.hp < s.maxHp * 0.3 ? COLORS.danger : COLORS.good};"></span></div>
      </div>
      <div class="meter">
        <div class="meter-label"><span>Cargo</span><span class="meter-value">${Math.floor(p.cargo)} / ${s.maxCargo}</span></div>
        <div class="bar"><span style="--value:${pct(p.cargo, s.maxCargo)}; --fill:${cargoFull ? COLORS.danger : COLORS.warm};"></span></div>
      </div>
      <div class="meter">
        <div class="meter-label"><span>Depth</span><span class="meter-value">${depth}</span></div>
        <div class="bar"><span style="--value:${Math.min(100, depth * 16.6)}%; --fill:${COLORS.coneLine};"></span></div>
      </div>
      <div class="meter">
        <div class="meter-label"><span>Octopus</span><span class="meter-value">${octopusSize}</span></div>
        <div class="bar"><span style="--value:${Math.min(100, octopusSize * 2.7)}%; --fill:${COLORS.playerArm};"></span></div>
      </div>
    `;

    bankedBiomass.textContent = Math.floor(state.banked);

    for (const button of upgradeButtons) {
      const key = button.dataset.upgrade;
      const cost = upgradeCost(key);
      const strong = button.querySelector("strong");
      if (strong) strong.textContent = cost;
      button.disabled = state.banked < cost;
      button.classList.toggle("ready", state.banked >= cost);
      button.title = `${upgradeLabels[key]} level ${state.upgrades[key] + 1}`;
    }
  }

  function frame(ts) {
    resizeCanvas();
    const dt = state.lastTs ? Math.min(0.033, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    if (state.running) update(dt);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    if (!state.running && (event.code === "Enter" || event.code === "Space")) {
      startDive();
      return;
    }

    input.keys.add(event.code);
    const digit = Number(event.key);
    if (digit >= 1 && digit <= UPGRADE_ORDER.length) buyUpgrade(UPGRADE_ORDER[digit - 1]);
  });

  window.addEventListener("keyup", (event) => {
    input.keys.delete(event.code);
  });

  window.addEventListener("blur", () => {
    input.keys.clear();
    input.pointer.down = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    setPointerFromEvent(event);
    input.pointer.down = true;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    setPointerFromEvent(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    setPointerFromEvent(event);
    input.pointer.down = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    input.pointer.down = false;
  });

  startButton.addEventListener("click", startDive);

  for (const button of upgradeButtons) {
    button.addEventListener("click", () => buyUpgrade(button.dataset.upgrade));
  }

  resizeCanvas();
  const base = homebase();
  state.player.x = base.x;
  state.player.y = base.y;
  input.pointer.x = base.x + 120;
  input.pointer.y = base.y;
  for (let i = 0; i < 16; i += 1) spawnPrey(true);
  requestAnimationFrame(frame);
})();
