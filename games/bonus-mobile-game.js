(function () {
  "use strict";

  const meta = document.body.dataset;
  const mode = meta.bonusGame || "arcade";
  const title = meta.gameTitle || "Bonus Game";
  const subtitle = meta.gameSubtitle || "Touch-ready browser game.";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("start");

  const TAU = Math.PI * 2;
  const keys = new Set();
  const pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0 };
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  let W = 1;
  let H = 1;
  let last = 0;
  let running = false;
  let score = 0;
  let message = "Tap Start";
  let game = {};

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(320, innerWidth);
    H = Math.max(420, innerHeight - 116);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setScore(value) {
    score = Math.max(0, Math.floor(value));
    scoreEl.textContent = score;
  }

  function setMessage(value) {
    message = value;
    statusEl.textContent = value;
  }

  function pressed(...codes) {
    return codes.some((code) => keys.has(code));
  }

  function start() {
    running = true;
    setScore(0);
    setMessage("Playing");
    game = createGame();
  }

  function gameOver(text = "Game over") {
    running = false;
    setMessage(`${text}. Tap Start`);
  }

  function createGame() {
    if (mode === "2048") return init2048();
    if (mode === "mahjong") return initMahjong();
    if (mode === "snake") return initSnake();
    if (mode === "flappy") return initFlappy();
    if (mode === "invaders") return initInvaders();
    if (mode === "asteroids") return initAsteroids();
    if (mode === "ski") return initSki();
    if (mode === "coil") return initCoil();
    return initHex();
  }

  function init2048() {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    const add = () => {
      const empty = [];
      for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) if (!board[y][x]) empty.push([x, y]);
      if (!empty.length) return false;
      const [x, y] = empty[Math.floor(Math.random() * empty.length)];
      board[y][x] = Math.random() < 0.9 ? 2 : 4;
      return true;
    };
    add(); add();
    return { board, add, moved: false, cooldown: 0 };
  }

  function move2048(dir) {
    const b = game.board;
    let moved = false;
    const get = (x, y) => dir === "left" || dir === "right" ? b[y][x] : b[x][y];
    const set = (x, y, v) => { if (dir === "left" || dir === "right") b[y][x] = v; else b[x][y] = v; };
    for (let y = 0; y < 4; y += 1) {
      const line = [];
      for (let x = 0; x < 4; x += 1) {
        const i = dir === "right" || dir === "down" ? 3 - x : x;
        const v = get(i, y);
        if (v) line.push(v);
      }
      for (let i = 0; i < line.length - 1; i += 1) {
        if (line[i] === line[i + 1]) {
          line[i] *= 2;
          setScore(score + line[i]);
          line.splice(i + 1, 1);
        }
      }
      while (line.length < 4) line.push(0);
      for (let x = 0; x < 4; x += 1) {
        const i = dir === "right" || dir === "down" ? 3 - x : x;
        if (get(i, y) !== line[x]) moved = true;
        set(i, y, line[x]);
      }
    }
    if (moved) game.add();
  }

  function initMahjong() {
    const values = [];
    for (let i = 1; i <= 12; i += 1) values.push(i, i);
    values.sort(() => Math.random() - 0.5);
    return { tiles: values.map((v, i) => ({ v, i, gone: false })), selected: -1 };
  }

  function initSnake() {
    return { snake: [{ x: 8, y: 8 }], dir: { x: 1, y: 0 }, next: { x: 1, y: 0 }, food: { x: 14, y: 8 }, tick: 0 };
  }

  function initFlappy() {
    return { bird: { x: W * 0.28, y: H * 0.45, vy: 0 }, pipes: [], spawn: 0 };
  }

  function initInvaders() {
    const enemies = [];
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 8; x += 1) enemies.push({ x: 52 + x * 38, y: 62 + y * 32, alive: true });
    return { player: { x: W * 0.5 }, shots: [], enemyShots: [], enemies, dir: 1, fire: 0 };
  }

  function initAsteroids() {
    return {
      ship: { x: W * 0.5, y: H * 0.5, vx: 0, vy: 0, a: -Math.PI / 2 },
      shots: [],
      rocks: Array.from({ length: 6 }, () => ({ x: rand(20, W - 20), y: rand(20, H - 20), vx: rand(-42, 42), vy: rand(-42, 42), r: rand(18, 38) })),
      fire: 0,
    };
  }

  function initSki() {
    return { skier: { x: W * 0.5, y: 110 }, trees: [], spawn: 0, speed: 130 };
  }

  function initCoil() {
    return { player: { x: W * 0.5, y: H * 0.5, vx: 0, vy: 0 }, trail: [], dots: Array.from({ length: 8 }, () => ({ x: rand(30, W - 30), y: rand(40, H - 40) })) };
  }

  function initHex() {
    return { angle: 0, blocks: [], spawn: 0, lives: 5 };
  }

  function update(dt) {
    if (!running) return;
    if (mode === "2048") update2048(dt);
    else if (mode === "mahjong") updateMahjong();
    else if (mode === "snake") updateSnake(dt);
    else if (mode === "flappy") updateFlappy(dt);
    else if (mode === "invaders") updateInvaders(dt);
    else if (mode === "asteroids") updateAsteroids(dt);
    else if (mode === "ski") updateSki(dt);
    else if (mode === "coil") updateCoil(dt);
    else updateHex(dt);
  }

  function update2048(dt) {
    game.cooldown = Math.max(0, game.cooldown - dt);
    if (game.cooldown) return;
    const dir = pressed("ArrowLeft", "KeyA") ? "left" : pressed("ArrowRight", "KeyD") ? "right" : pressed("ArrowUp", "KeyW") ? "up" : pressed("ArrowDown", "KeyS") ? "down" : "";
    if (dir) {
      move2048(dir);
      game.cooldown = 0.16;
    }
  }

  function updateMahjong() {}

  function updateSnake(dt) {
    if (pressed("ArrowLeft", "KeyA") && game.dir.x !== 1) game.next = { x: -1, y: 0 };
    if (pressed("ArrowRight", "KeyD") && game.dir.x !== -1) game.next = { x: 1, y: 0 };
    if (pressed("ArrowUp", "KeyW") && game.dir.y !== 1) game.next = { x: 0, y: -1 };
    if (pressed("ArrowDown", "KeyS") && game.dir.y !== -1) game.next = { x: 0, y: 1 };
    game.tick += dt;
    if (game.tick < 0.12) return;
    game.tick = 0;
    game.dir = game.next;
    const head = { x: game.snake[0].x + game.dir.x, y: game.snake[0].y + game.dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= 24 || head.y >= 18 || game.snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();
    game.snake.unshift(head);
    if (head.x === game.food.x && head.y === game.food.y) {
      setScore(score + 1);
      game.food = { x: Math.floor(rand(0, 24)), y: Math.floor(rand(0, 18)) };
    } else {
      game.snake.pop();
    }
  }

  function updateFlappy(dt) {
    if (pressed("Space", "ArrowUp") || pointer.down) game.bird.vy = -260;
    game.bird.vy += 680 * dt;
    game.bird.y += game.bird.vy * dt;
    game.spawn -= dt;
    if (game.spawn <= 0) {
      game.spawn = 1.25;
      game.pipes.push({ x: W + 40, gap: rand(135, H - 175), scored: false });
    }
    for (const p of game.pipes) {
      p.x -= 150 * dt;
      if (!p.scored && p.x < game.bird.x) { p.scored = true; setScore(score + 1); }
      const hitX = Math.abs(p.x - game.bird.x) < 24;
      const hitY = game.bird.y < p.gap - 62 || game.bird.y > p.gap + 62;
      if (hitX && hitY) return gameOver();
    }
    game.pipes = game.pipes.filter((p) => p.x > -80);
    if (game.bird.y < 0 || game.bird.y > H) gameOver();
  }

  function updateInvaders(dt) {
    if (pressed("ArrowLeft", "KeyA")) game.player.x -= 260 * dt;
    if (pressed("ArrowRight", "KeyD")) game.player.x += 260 * dt;
    game.player.x = clamp(game.player.x, 24, W - 24);
    game.fire -= dt;
    if (pressed("Space", "ArrowUp") && game.fire <= 0) {
      game.fire = 0.26;
      game.shots.push({ x: game.player.x, y: H - 52 });
    }
    let edge = false;
    for (const e of game.enemies) if (e.alive) {
      e.x += game.dir * 38 * dt;
      if (e.x < 24 || e.x > W - 24) edge = true;
    }
    if (edge) for (const e of game.enemies) { e.y += 18; game.dir *= -1; }
    for (const s of game.shots) s.y -= 430 * dt;
    for (const s of game.shots) for (const e of game.enemies) if (e.alive && Math.hypot(s.x - e.x, s.y - e.y) < 18) {
      e.alive = false; s.dead = true; setScore(score + 10);
    }
    game.shots = game.shots.filter((s) => !s.dead && s.y > -10);
    if (!game.enemies.some((e) => e.alive)) gameOver("Wave clear");
    if (game.enemies.some((e) => e.alive && e.y > H - 95)) gameOver();
  }

  function updateAsteroids(dt) {
    const s = game.ship;
    if (pressed("ArrowLeft", "KeyA")) s.a -= 4.5 * dt;
    if (pressed("ArrowRight", "KeyD")) s.a += 4.5 * dt;
    if (pressed("ArrowUp", "KeyW")) { s.vx += Math.cos(s.a) * 180 * dt; s.vy += Math.sin(s.a) * 180 * dt; }
    game.fire -= dt;
    if (pressed("Space") && game.fire <= 0) {
      game.fire = 0.22;
      game.shots.push({ x: s.x, y: s.y, vx: Math.cos(s.a) * 420, vy: Math.sin(s.a) * 420, life: 0.9 });
    }
    s.x = (s.x + s.vx * dt + W) % W; s.y = (s.y + s.vy * dt + H) % H; s.vx *= 0.992; s.vy *= 0.992;
    for (const r of game.rocks) { r.x = (r.x + r.vx * dt + W) % W; r.y = (r.y + r.vy * dt + H) % H; if (Math.hypot(r.x - s.x, r.y - s.y) < r.r + 12) return gameOver(); }
    for (const sh of game.shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt; for (const r of game.rocks) if (!r.dead && Math.hypot(r.x - sh.x, r.y - sh.y) < r.r) { r.dead = true; sh.life = 0; setScore(score + 25); } }
    game.shots = game.shots.filter((sh) => sh.life > 0);
    game.rocks = game.rocks.filter((r) => !r.dead);
    if (!game.rocks.length) game.rocks = initAsteroids().rocks;
  }

  function updateSki(dt) {
    const skier = game.skier;
    if (pressed("ArrowLeft", "KeyA")) skier.x -= 250 * dt;
    if (pressed("ArrowRight", "KeyD")) skier.x += 250 * dt;
    skier.x = clamp(skier.x, 25, W - 25);
    game.speed += 6 * dt;
    setScore(score + dt * 10);
    game.spawn -= dt;
    if (game.spawn <= 0) {
      game.spawn = 0.22;
      game.trees.push({ x: rand(20, W - 20), y: H + 30, kind: Math.random() < 0.25 ? "flag" : "tree" });
    }
    for (const t of game.trees) {
      t.y -= game.speed * dt;
      if (Math.abs(t.x - skier.x) < 22 && Math.abs(t.y - skier.y) < 26 && t.kind === "tree") return gameOver();
    }
    game.trees = game.trees.filter((t) => t.y > -40);
  }

  function updateCoil(dt) {
    const p = game.player;
    const ax = (pressed("ArrowLeft", "KeyA") ? -1 : 0) + (pressed("ArrowRight", "KeyD") ? 1 : 0);
    const ay = (pressed("ArrowUp", "KeyW") ? -1 : 0) + (pressed("ArrowDown", "KeyS") ? 1 : 0);
    p.vx = (p.vx + ax * 480 * dt) * 0.9;
    p.vy = (p.vy + ay * 480 * dt) * 0.9;
    p.x = clamp(p.x + p.vx * dt, 14, W - 14);
    p.y = clamp(p.y + p.vy * dt, 14, H - 14);
    game.trail.push({ x: p.x, y: p.y });
    if (game.trail.length > 80) game.trail.shift();
    for (const d of game.dots) if (!d.dead && Math.hypot(d.x - p.x, d.y - p.y) < 22) { d.dead = true; setScore(score + 1); }
    if (!game.dots.some((d) => !d.dead)) game.dots = initCoil().dots;
  }

  function updateHex(dt) {
    if (pressed("ArrowLeft", "KeyA")) game.angle -= 4 * dt;
    if (pressed("ArrowRight", "KeyD")) game.angle += 4 * dt;
    game.spawn -= dt;
    if (game.spawn <= 0) {
      game.spawn = 0.7;
      game.blocks.push({ lane: Math.floor(rand(0, 6)), r: Math.max(W, H) * 0.58, color: ["#5be7d6", "#ffd08a", "#ff7f6e"][Math.floor(rand(0, 3))] });
    }
    for (const b of game.blocks) {
      b.r -= 115 * dt;
      const activeLane = Math.round(((game.angle % TAU + TAU) % TAU) / TAU * 6) % 6;
      if (b.r < 45 && b.lane === activeLane) { b.dead = true; setScore(score + 5); }
      if (b.r < 28 && !b.dead) { b.dead = true; game.lives -= 1; if (game.lives <= 0) gameOver(); }
    }
    game.blocks = game.blocks.filter((b) => !b.dead);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#123b3d");
    g.addColorStop(1, "#061015");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,250,240,0.9)";
    ctx.font = "800 18px ui-sans-serif, system-ui";
    ctx.fillText(title, 16, 30);
    ctx.font = "600 12px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(255,250,240,0.65)";
    ctx.fillText(subtitle, 16, 50);
    if (mode === "2048") draw2048();
    else if (mode === "mahjong") drawMahjong();
    else if (mode === "snake") drawSnake();
    else if (mode === "flappy") drawFlappy();
    else if (mode === "invaders") drawInvaders();
    else if (mode === "asteroids") drawAsteroids();
    else if (mode === "ski") drawSki();
    else if (mode === "coil") drawCoil();
    else drawHex();
    if (!running) {
      ctx.fillStyle = "rgba(6,16,21,0.62)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fffaf0";
      ctx.font = "900 26px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(message, W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  function draw2048() {
    const size = Math.min(W - 28, H - 110);
    const x0 = (W - size) / 2, y0 = 82, cell = size / 4;
    ctx.fillStyle = "rgba(255,250,240,0.18)";
    ctx.fillRect(x0, y0, size, size);
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
      const v = game.board[y][x];
      ctx.fillStyle = v ? `hsl(${40 + Math.log2(v) * 18},75%,62%)` : "rgba(255,250,240,0.16)";
      ctx.fillRect(x0 + x * cell + 5, y0 + y * cell + 5, cell - 10, cell - 10);
      if (v) { ctx.fillStyle = "#061015"; ctx.font = "900 24px ui-sans-serif"; ctx.textAlign = "center"; ctx.fillText(v, x0 + x * cell + cell / 2, y0 + y * cell + cell / 2 + 8); ctx.textAlign = "left"; }
    }
  }

  function drawMahjong() {
    const cols = 6, rows = 4, cell = Math.min((W - 28) / cols, (H - 100) / rows), x0 = (W - cell * cols) / 2, y0 = 84;
    for (const t of game.tiles) if (!t.gone) {
      const x = t.i % cols, y = Math.floor(t.i / cols);
      ctx.fillStyle = t.i === game.selected ? "#ffd08a" : "#fffaf0";
      ctx.fillRect(x0 + x * cell + 4, y0 + y * cell + 4, cell - 8, cell - 8);
      ctx.fillStyle = "#123b3d"; ctx.font = "900 22px ui-sans-serif"; ctx.textAlign = "center"; ctx.fillText(t.v, x0 + x * cell + cell / 2, y0 + y * cell + cell / 2 + 7); ctx.textAlign = "left";
    }
  }

  function drawSnake() {
    const cell = Math.min(W / 24, (H - 78) / 18), x0 = (W - cell * 24) / 2, y0 = 74;
    ctx.fillStyle = "#ffd08a"; ctx.fillRect(x0 + game.food.x * cell, y0 + game.food.y * cell, cell, cell);
    ctx.fillStyle = "#8dffb7"; for (const s of game.snake) ctx.fillRect(x0 + s.x * cell, y0 + s.y * cell, cell - 1, cell - 1);
  }

  function drawFlappy() {
    ctx.fillStyle = "#ffd08a"; ctx.beginPath(); ctx.arc(game.bird.x, game.bird.y, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = "#8dffb7"; for (const p of game.pipes) { ctx.fillRect(p.x - 22, 70, 44, p.gap - 62 - 70); ctx.fillRect(p.x - 22, p.gap + 62, 44, H); }
  }

  function drawInvaders() {
    ctx.fillStyle = "#5be7d6"; ctx.fillRect(game.player.x - 22, H - 40, 44, 16);
    ctx.fillStyle = "#fffaf0"; for (const s of game.shots) ctx.fillRect(s.x - 2, s.y, 4, 12);
    ctx.fillStyle = "#ffb35f"; for (const e of game.enemies) if (e.alive) { ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, TAU); ctx.fill(); }
  }

  function drawAsteroids() {
    const s = game.ship;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-14, -10); ctx.lineTo(-8, 0); ctx.lineTo(-14, 10); ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = "#ffd08a"; for (const r of game.rocks) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = "#5be7d6"; for (const sh of game.shots) { ctx.beginPath(); ctx.arc(sh.x, sh.y, 3, 0, TAU); ctx.fill(); }
  }

  function drawSki() {
    ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.moveTo(game.skier.x, game.skier.y - 16); ctx.lineTo(game.skier.x - 16, game.skier.y + 18); ctx.lineTo(game.skier.x + 16, game.skier.y + 18); ctx.fill();
    for (const t of game.trees) { ctx.fillStyle = t.kind === "flag" ? "#ffb35f" : "#8dffb7"; ctx.beginPath(); ctx.moveTo(t.x, t.y - 20); ctx.lineTo(t.x - 16, t.y + 20); ctx.lineTo(t.x + 16, t.y + 20); ctx.fill(); }
  }

  function drawCoil() {
    ctx.strokeStyle = "#5be7d6"; ctx.lineWidth = 5; ctx.beginPath(); game.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.fillStyle = "#ffd08a"; for (const d of game.dots) if (!d.dead) { ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(game.player.x, game.player.y, 12, 0, TAU); ctx.fill();
  }

  function drawHex() {
    const cx = W / 2, cy = H / 2 + 20;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(game.angle); ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 5; ctx.beginPath(); for (let i = 0; i < 6; i += 1) { const a = i / 6 * TAU; const x = Math.cos(a) * 34, y = Math.sin(a) * 34; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); ctx.restore();
    for (const b of game.blocks) { const a = b.lane / 6 * TAU; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * b.r, cy + Math.sin(a) * b.r, 12, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#fffaf0"; ctx.fillText(`Lives ${game.lives}`, 16, 70);
  }

  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function canvasPoint(event) {
    const point = event.touches ? event.touches[0] : event;
    const rect = canvas.getBoundingClientRect();
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function pointerStart(event) {
    event.preventDefault();
    const p = canvasPoint(event);
    pointer.down = true; pointer.x = p.x; pointer.y = p.y; pointer.sx = p.x; pointer.sy = p.y;
    if (mode === "flappy") keys.add("Space");
    if (mode === "mahjong" && running) {
      const cols = 6, rows = 4, cell = Math.min((W - 28) / cols, (H - 100) / rows), x0 = (W - cell * cols) / 2, y0 = 84;
      const x = Math.floor((p.x - x0) / cell), y = Math.floor((p.y - y0) / cell), i = y * cols + x;
      const tile = game.tiles[i];
      if (tile && !tile.gone) {
        if (game.selected >= 0 && game.tiles[game.selected].v === tile.v && game.selected !== i) {
          game.tiles[game.selected].gone = true; tile.gone = true; game.selected = -1; setScore(score + 10);
          if (!game.tiles.some((t) => !t.gone)) gameOver("Board clear");
        } else game.selected = i;
      }
    }
  }

  function pointerMove(event) {
    if (!pointer.down) return;
    const p = canvasPoint(event);
    pointer.x = p.x; pointer.y = p.y;
    const dx = p.x - pointer.sx, dy = p.y - pointer.sy;
    if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
      keys.delete("ArrowLeft"); keys.delete("ArrowRight"); keys.delete("ArrowUp"); keys.delete("ArrowDown");
      if (Math.abs(dx) > Math.abs(dy)) keys.add(dx > 0 ? "ArrowRight" : "ArrowLeft");
      else keys.add(dy > 0 ? "ArrowDown" : "ArrowUp");
    }
  }

  function pointerEnd() {
    pointer.down = false;
    keys.delete("Space");
    keys.delete("ArrowLeft"); keys.delete("ArrowRight"); keys.delete("ArrowUp"); keys.delete("ArrowDown");
  }

  addEventListener("keydown", (event) => { keys.add(event.code); if (event.code === "Enter" && !running) start(); });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("resize", () => { resize(); if (running) start(); });
  canvas.addEventListener("pointerdown", pointerStart);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
  canvas.addEventListener("touchstart", pointerStart, { passive: false });
  canvas.addEventListener("touchmove", pointerMove, { passive: false });
  canvas.addEventListener("touchend", pointerEnd, { passive: false });
  startBtn.addEventListener("click", start);

  resize();
  game = createGame();
  draw();
  requestAnimationFrame(frame);
})();
