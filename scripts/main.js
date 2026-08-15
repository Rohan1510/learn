/**
 * Dino Runner - Complete Arcade Net Game Engine
 * Features: Procedural pixel graphics, Web Audio synthesized SFX, 
 * Day/Night cycles, accurate collision hitboxes, responsive touch controls.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  
  const currentScoreDisplay = document.getElementById('current-score-display');
  const highScoreDisplay = document.getElementById('high-score-display');
  
  const startOverlay = document.getElementById('start-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');
  const pauseBtn = document.getElementById('pause-btn');
  const pauseIcon = document.getElementById('pause-icon');
  
  const touchDuckBtn = document.getElementById('touch-duck-btn');
  const touchJumpBtn = document.getElementById('touch-jump-btn');
  
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const finalObstaclesEl = document.getElementById('final-obstacles');

  // Virtual Game Resolution
  const V_WIDTH = 900;
  const V_HEIGHT = 300;
  const GROUND_Y = 240;

  // Sound Engine (Web Audio API)
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playJump() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'square';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        osc.start(now);
        osc.stop(now + 0.12);
      } catch (e) {
        // Audio error handle
      }
    }

    playScore() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const playBeep = (freq, delay) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + delay);
          gain.gain.setValueAtTime(0.12, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.08);
          
          osc.start(now + delay);
          osc.stop(now + delay + 0.08);
        };
        playBeep(659.25, 0); // E5
        playBeep(880.00, 0.09); // A5
      } catch (e) {}
    }

    playGameOver() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.35);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
  }

  const sound = new SoundEngine();

  // Game Constants & State
  const STATES = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
  };

  let gameState = STATES.START;
  let score = 0;
  let highScore = parseInt(localStorage.getItem('dino_high_score') || '0', 10);
  let obstaclesCleared = 0;
  let speed = 7;
  const BASE_SPEED = 7;
  const MAX_SPEED = 15;
  const GRAVITY = 0.65;
  const JUMP_FORCE = -12.5;

  let lastTime = 0;
  let dayNightCycle = 0; // 0 = day, 1 = night (interpolated)
  let isNight = false;
  let nextObstacleTimer = 0;

  // Particle System
  const particles = [];

  class Particle {
    constructor(x, y, vx, vy, size, color, life) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.size = size;
      this.color = color;
      this.life = life;
      this.maxLife = life;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life--;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
      ctx.globalAlpha = 1.0;
    }
  }

  function spawnDust(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const vx = -speed * 0.4 + (Math.random() * 2 - 1);
      const vy = -Math.random() * 1.5;
      const size = Math.floor(Math.random() * 3) + 2;
      const color = isNight ? '#94a3b8' : '#737373';
      particles.push(new Particle(x, y, vx, vy, size, color, 18));
    }
  }

  function spawnCrashDebris(x, y) {
    for (let i = 0; i < 20; i++) {
      const vx = (Math.random() - 0.5) * 8;
      const vy = (Math.random() - 0.8) * 8;
      const size = Math.floor(Math.random() * 4) + 2;
      const color = Math.random() > 0.5 ? '#f43f5e' : (isNight ? '#ffffff' : '#475569');
      particles.push(new Particle(x, y, vx, vy, size, color, 30));
    }
  }

  // Dino Character Class
  class Dino {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = 60;
      this.y = GROUND_Y - 48;
      this.width = 44;
      this.height = 48;
      this.vy = 0;
      this.isGrounded = true;
      this.isDucking = false;
      this.duckWidth = 58;
      this.duckHeight = 30;
      this.animFrame = 0;
      this.animTimer = 0;
      this.jumpBuffer = false;
    }

    jump() {
      if (this.isGrounded) {
        this.vy = JUMP_FORCE;
        this.isGrounded = false;
        sound.init();
        sound.playJump();
        spawnDust(this.x + 10, GROUND_Y, 5);
      }
    }

    setDucking(ducking) {
      if (this.isDucking === ducking) return;
      this.isDucking = ducking;
      if (!this.isGrounded && ducking) {
        // Fast drop when ducking mid-air
        this.vy += 6;
      }
    }

    update() {
      // Apply Gravity
      this.vy += GRAVITY;
      this.y += this.vy;

      const currentH = this.isDucking ? this.duckHeight : this.height;

      // Ground Collision
      if (this.y + currentH >= GROUND_Y) {
        if (!this.isGrounded) {
          spawnDust(this.x + 15, GROUND_Y, 4);
        }
        this.y = GROUND_Y - currentH;
        this.vy = 0;
        this.isGrounded = true;
      }

      // Running Animation
      this.animTimer += speed;
      if (this.animTimer > 35) {
        this.animFrame = (this.animFrame + 1) % 2;
        this.animTimer = 0;
        if (this.isGrounded && !this.isDucking && Math.random() < 0.3) {
          spawnDust(this.x + 5, GROUND_Y, 1);
        }
      }
    }

    getHitbox() {
      if (this.isDucking) {
        return {
          x: this.x + 4,
          y: this.y + 4,
          w: this.duckWidth - 8,
          h: this.duckHeight - 6
        };
      }
      return {
        x: this.x + 8,
        y: this.y + 4,
        w: this.width - 14,
        h: this.height - 6
      };
    }

    draw(ctx, color) {
      ctx.fillStyle = color;
      const x = Math.floor(this.x);
      const y = Math.floor(this.y);

      if (gameState === STATES.GAMEOVER) {
        // Dead Dino Sprite (with 'X' eye)
        this.drawDead(ctx, x, y);
      } else if (this.isDucking) {
        // Ducking Dino Sprite
        this.drawDucking(ctx, x, y);
      } else if (!this.isGrounded) {
        // Jumping Dino Sprite
        this.drawJumping(ctx, x, y);
      } else {
        // Running Dino Sprite
        this.drawRunning(ctx, x, y);
      }
    }

    drawRunning(ctx, x, y) {
      // Body & Head
      ctx.fillRect(x + 22, y, 20, 16); // Head top
      ctx.fillRect(x + 22, y + 16, 22, 10); // Snout
      ctx.fillRect(x + 18, y + 16, 10, 16); // Neck
      ctx.fillRect(x + 8, y + 22, 20, 14); // Body
      ctx.fillRect(x, y + 24, 10, 6); // Tail
      ctx.fillRect(x + 2, y + 30, 8, 4); // Tail lower
      ctx.fillRect(x + 26, y + 26, 4, 6); // Arms

      // Eye
      ctx.fillStyle = isNight ? '#141a29' : '#f7f9fa';
      ctx.fillRect(x + 26, y + 4, 4, 4);
      ctx.fillStyle = isNight ? '#e2e8f0' : '#535353';

      // Legs Animation (Frame 0 vs Frame 1)
      if (this.animFrame === 0) {
        // Left Leg Down, Right Leg Up
        ctx.fillRect(x + 12, y + 36, 4, 12);
        ctx.fillRect(x + 12, y + 46, 6, 2);
        ctx.fillRect(x + 22, y + 36, 4, 6);
        ctx.fillRect(x + 24, y + 40, 6, 2);
      } else {
        // Right Leg Down, Left Leg Up
        ctx.fillRect(x + 12, y + 36, 4, 6);
        ctx.fillRect(x + 10, y + 40, 6, 2);
        ctx.fillRect(x + 22, y + 36, 4, 12);
        ctx.fillRect(x + 22, y + 46, 6, 2);
      }
    }

    drawJumping(ctx, x, y) {
      // Body & Head
      ctx.fillRect(x + 22, y, 20, 16);
      ctx.fillRect(x + 22, y + 16, 22, 10);
      ctx.fillRect(x + 18, y + 16, 10, 16);
      ctx.fillRect(x + 8, y + 22, 20, 14);
      ctx.fillRect(x, y + 24, 10, 6);
      ctx.fillRect(x + 2, y + 30, 8, 4);
      ctx.fillRect(x + 26, y + 26, 4, 6);

      // Eye
      ctx.fillStyle = isNight ? '#141a29' : '#f7f9fa';
      ctx.fillRect(x + 26, y + 4, 4, 4);
      ctx.fillStyle = isNight ? '#e2e8f0' : '#535353';

      // Legs Together
      ctx.fillRect(x + 14, y + 36, 4, 8);
      ctx.fillRect(x + 14, y + 42, 6, 2);
      ctx.fillRect(x + 20, y + 36, 4, 8);
      ctx.fillRect(x + 20, y + 42, 6, 2);
    }

    drawDucking(ctx, x, y) {
      // Lower profile body & extended neck
      ctx.fillRect(x, y + 10, 8, 6); // Tail
      ctx.fillRect(x + 6, y + 8, 24, 14); // Low Body
      ctx.fillRect(x + 28, y + 10, 18, 10); // Extended Neck/Jaw
      ctx.fillRect(x + 36, y + 2, 20, 16); // Lowered Head
      ctx.fillRect(x + 44, y + 16, 4, 4); // Low Arm

      // Eye
      ctx.fillStyle = isNight ? '#141a29' : '#f7f9fa';
      ctx.fillRect(x + 40, y + 6, 4, 4);
      ctx.fillStyle = isNight ? '#e2e8f0' : '#535353';

      // Legs cycling
      if (this.animFrame === 0) {
        ctx.fillRect(x + 16, y + 22, 4, 8);
        ctx.fillRect(x + 16, y + 28, 6, 2);
        ctx.fillRect(x + 26, y + 22, 4, 5);
      } else {
        ctx.fillRect(x + 16, y + 22, 4, 5);
        ctx.fillRect(x + 26, y + 22, 4, 8);
        ctx.fillRect(x + 26, y + 28, 6, 2);
      }
    }

    drawDead(ctx, x, y) {
      // Body
      ctx.fillRect(x + 22, y, 20, 16);
      ctx.fillRect(x + 22, y + 16, 22, 10);
      ctx.fillRect(x + 18, y + 16, 10, 16);
      ctx.fillRect(x + 8, y + 22, 20, 14);
      ctx.fillRect(x, y + 24, 10, 6);
      ctx.fillRect(x + 2, y + 30, 8, 4);
      ctx.fillRect(x + 26, y + 26, 4, 6);

      // Dead Eye 'X'
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x + 26, y + 4, 2, 2);
      ctx.fillRect(x + 30, y + 4, 2, 2);
      ctx.fillRect(x + 28, y + 6, 2, 2);
      ctx.fillRect(x + 26, y + 8, 2, 2);
      ctx.fillRect(x + 30, y + 8, 2, 2);
      ctx.fillStyle = isNight ? '#e2e8f0' : '#535353';

      // Legs
      ctx.fillRect(x + 12, y + 36, 4, 12);
      ctx.fillRect(x + 22, y + 36, 4, 12);
    }
  }

  // Obstacle Base & Types
  class Obstacle {
    constructor(type, x) {
      this.type = type;
      this.x = x;
      this.passed = false;
      this.initType();
    }

    initType() {
      if (this.type === 'cactus_small_single') {
        this.width = 18;
        this.height = 36;
        this.y = GROUND_Y - this.height;
      } else if (this.type === 'cactus_small_double') {
        this.width = 34;
        this.height = 36;
        this.y = GROUND_Y - this.height;
      } else if (this.type === 'cactus_large_single') {
        this.width = 24;
        this.height = 50;
        this.y = GROUND_Y - this.height;
      } else if (this.type === 'cactus_cluster') {
        this.width = 54;
        this.height = 50;
        this.y = GROUND_Y - this.height;
      } else if (this.type === 'pterodactyl') {
        this.width = 44;
        this.height = 34;
        // 3 heights: High (fly above standing), Mid (must duck), Low (must jump)
        const heights = [GROUND_Y - 80, GROUND_Y - 52, GROUND_Y - 32];
        this.y = heights[Math.floor(Math.random() * heights.length)];
        this.animFrame = 0;
        this.animTimer = 0;
      }
    }

    update() {
      this.x -= speed;
      if (this.type === 'pterodactyl') {
        this.animTimer += speed;
        if (this.animTimer > 25) {
          this.animFrame = (this.animFrame + 1) % 2;
          this.animTimer = 0;
        }
      }
    }

    getHitbox() {
      // Inner padding for fair collision
      return {
        x: this.x + 3,
        y: this.y + 3,
        w: this.width - 6,
        h: this.height - 6
      };
    }

    draw(ctx, color) {
      ctx.fillStyle = color;
      const x = Math.floor(this.x);
      const y = Math.floor(this.y);

      if (this.type.startsWith('cactus')) {
        this.drawCactus(ctx, x, y);
      } else if (this.type === 'pterodactyl') {
        this.drawPterodactyl(ctx, x, y);
      }
    }

    drawCactus(ctx, x, y) {
      if (this.type === 'cactus_small_single') {
        ctx.fillRect(x + 6, y, 6, 36); // Main stem
        ctx.fillRect(x, y + 8, 6, 14); // Left arm
        ctx.fillRect(x + 12, y + 14, 6, 12); // Right arm
        ctx.fillRect(x, y + 20, 18, 4); // Cross branches
      } else if (this.type === 'cactus_small_double') {
        // First
        ctx.fillRect(x + 4, y + 4, 6, 32);
        ctx.fillRect(x, y + 12, 4, 10);
        ctx.fillRect(x + 10, y + 14, 4, 10);
        ctx.fillRect(x, y + 20, 14, 3);
        // Second
        ctx.fillRect(x + 22, y, 6, 36);
        ctx.fillRect(x + 16, y + 8, 4, 12);
        ctx.fillRect(x + 28, y + 12, 4, 12);
        ctx.fillRect(x + 16, y + 18, 16, 3);
      } else if (this.type === 'cactus_large_single') {
        ctx.fillRect(x + 8, y, 8, 50); // Stem
        ctx.fillRect(x, y + 12, 8, 18); // Left
        ctx.fillRect(x + 16, y + 18, 8, 18); // Right
        ctx.fillRect(x, y + 26, 24, 6);
      } else if (this.type === 'cactus_cluster') {
        // Triple large
        ctx.fillRect(x + 6, y + 8, 8, 42);
        ctx.fillRect(x, y + 18, 6, 14);
        ctx.fillRect(x, y + 28, 14, 4);

        ctx.fillRect(x + 22, y, 10, 50);
        ctx.fillRect(x + 16, y + 12, 6, 16);
        ctx.fillRect(x + 32, y + 14, 6, 16);
        ctx.fillRect(x + 16, y + 24, 22, 5);

        ctx.fillRect(x + 42, y + 10, 8, 40);
        ctx.fillRect(x + 48, y + 20, 6, 12);
        ctx.fillRect(x + 40, y + 28, 14, 4);
      }
    }

    drawPterodactyl(ctx, x, y) {
      // Body & Beak
      ctx.fillRect(x + 12, y + 12, 20, 8); // Body
      ctx.fillRect(x + 28, y + 14, 16, 4); // Beak
      ctx.fillRect(x + 8, y + 8, 8, 6); // Head crest

      // Eye
      ctx.fillStyle = isNight ? '#141a29' : '#f7f9fa';
      ctx.fillRect(x + 24, y + 10, 3, 3);
      ctx.fillStyle = isNight ? '#e2e8f0' : '#535353';

      if (this.animFrame === 0) {
        // Wings Up
        ctx.fillRect(x + 14, y, 6, 12);
        ctx.fillRect(x + 8, y + 2, 6, 6);
      } else {
        // Wings Down
        ctx.fillRect(x + 14, y + 20, 6, 14);
        ctx.fillRect(x + 8, y + 24, 6, 6);
      }
    }
  }

  // Cloud & Scenery System
  class Cloud {
    constructor() {
      this.reset(Math.random() * V_WIDTH);
    }

    reset(startX = V_WIDTH + Math.random() * 100) {
      this.x = startX;
      this.y = 30 + Math.random() * 80;
      this.speedRatio = 0.2 + Math.random() * 0.15;
      this.width = 46;
      this.height = 14;
    }

    update() {
      this.x -= speed * this.speedRatio;
      if (this.x + this.width < 0) {
        this.reset();
      }
    }

    draw(ctx, color) {
      ctx.fillStyle = color;
      const x = Math.floor(this.x);
      const y = Math.floor(this.y);
      ctx.fillRect(x, y + 4, 46, 6);
      ctx.fillRect(x + 8, y, 24, 4);
      ctx.fillRect(x + 4, y + 10, 34, 4);
    }
  }

  // Ground Line with rolling details
  class Ground {
    constructor() {
      this.offsetX = 0;
      this.bumps = [];
      for (let i = 0; i < 60; i++) {
        this.bumps.push({
          x: Math.random() * V_WIDTH * 2,
          y: GROUND_Y + Math.floor(Math.random() * 18) + 2,
          w: Math.floor(Math.random() * 8) + 2
        });
      }
    }

    update() {
      this.offsetX = (this.offsetX + speed) % V_WIDTH;
      for (const bump of this.bumps) {
        bump.x -= speed;
        if (bump.x < 0) {
          bump.x += V_WIDTH * 2;
        }
      }
    }

    draw(ctx, color) {
      ctx.fillStyle = color;
      // Main baseline
      ctx.fillRect(0, GROUND_Y, V_WIDTH, 2);

      // Bumps & Pebbles
      for (const bump of this.bumps) {
        ctx.fillRect(Math.floor(bump.x), Math.floor(bump.y), bump.w, 2);
      }
    }
  }

  // Game Instances
  const dino = new Dino();
  const ground = new Ground();
  const clouds = [new Cloud(), new Cloud(), new Cloud(), new Cloud()];
  let obstacles = [];

  // Stars for night mode
  const stars = [];
  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * V_WIDTH,
      y: Math.random() * (GROUND_Y - 80),
      size: Math.random() > 0.7 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2
    });
  }

  // Collision Detection
  function checkCollision(r1, r2) {
    return !(
      r2.x > r1.x + r1.w ||
      r2.x + r2.w < r1.x ||
      r2.y > r1.y + r1.h ||
      r2.y + r2.h < r1.y
    );
  }

  // UI Helpers
  function formatScore(n) {
    return Math.floor(n).toString().padStart(5, '0');
  }

  function updateScoreDisplay() {
    currentScoreDisplay.textContent = formatScore(score);
    highScoreDisplay.textContent = formatScore(highScore);
  }

  function triggerMilestoneScore() {
    sound.playScore();
    currentScoreDisplay.classList.remove('score-flash');
    void currentScoreDisplay.offsetWidth; // trigger reflow
    currentScoreDisplay.classList.add('score-flash');
  }

  // Game Lifecycle Controls
  function startGame() {
    sound.init();
    gameState = STATES.PLAYING;
    score = 0;
    speed = BASE_SPEED;
    obstaclesCleared = 0;
    obstacles = [];
    particles.length = 0;
    dino.reset();
    nextObstacleTimer = 60;
    
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    
    updateScoreDisplay();
  }

  function gameOver() {
    gameState = STATES.GAMEOVER;
    sound.playGameOver();
    spawnCrashDebris(dino.x + 20, dino.y + 20);

    if (score > highScore) {
      highScore = Math.floor(score);
      localStorage.setItem('dino_high_score', highScore.toString());
      updateScoreDisplay();
    }

    finalScoreEl.textContent = Math.floor(score).toString();
    finalBestEl.textContent = highScore.toString();
    finalObstaclesEl.textContent = obstaclesCleared.toString();

    gameOverOverlay.classList.remove('hidden');
  }

  function togglePause() {
    if (gameState === STATES.PLAYING) {
      gameState = STATES.PAUSED;
      pauseOverlay.classList.remove('hidden');
      pauseIcon.textContent = '▶';
    } else if (gameState === STATES.PAUSED) {
      gameState = STATES.PLAYING;
      pauseOverlay.classList.add('hidden');
      pauseIcon.textContent = '⏸';
    }
  }

  // Obstacle Spawner
  function spawnObstacle() {
    const obstacleTypes = ['cactus_small_single', 'cactus_small_double', 'cactus_large_single', 'cactus_cluster'];
    
    // Introduce flying pterodactyls once score exceeds 200
    if (score > 200 && Math.random() < 0.35) {
      obstacleTypes.push('pterodactyl');
    }

    const randomType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push(new Obstacle(randomType, V_WIDTH + 20));

    // Dynamic distance between obstacles based on speed
    const minDistanceFrames = Math.max(45, 90 - Math.floor(speed * 3));
    const variance = Math.floor(Math.random() * 50);
    nextObstacleTimer = minDistanceFrames + variance;
  }

  // Main Update Routine
  function update(dt) {
    if (gameState !== STATES.PLAYING) return;

    // Increment Score & Speed
    score += 0.15;
    if (Math.floor(score) > 0 && Math.floor(score) % 100 === 0 && Math.floor(score - 0.15) % 100 !== 0) {
      triggerMilestoneScore();
    }

    speed = Math.min(MAX_SPEED, BASE_SPEED + Math.floor(score / 150) * 0.6);

    // Day / Night Cycle (smooth fade every 600 points)
    const cyclePhase = (Math.floor(score) % 800);
    isNight = cyclePhase > 400;

    // Update Dino & Scenery
    dino.update();
    ground.update();
    clouds.forEach(cloud => cloud.update());

    // Update Obstacles & Check Collisions
    nextObstacleTimer--;
    if (nextObstacleTimer <= 0) {
      spawnObstacle();
    }

    const dinoHitbox = dino.getHitbox();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.update();

      // Check obstacle passed for stats
      if (!obs.passed && obs.x + obs.width < dino.x) {
        obs.passed = true;
        obstaclesCleared++;
      }

      // Collision Check
      if (checkCollision(dinoHitbox, obs.getHitbox())) {
        gameOver();
        return;
      }

      // Cleanup offscreen obstacles
      if (obs.x + obs.width < -50) {
        obstacles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }

    updateScoreDisplay();
  }

  // Main Render Routine
  function draw() {
    // Canvas Theme Colors
    const canvasBg = isNight ? '#141a29' : '#f7f9fa';
    const mainColor = isNight ? '#e2e8f0' : '#535353';
    const cloudColor = isNight ? '#334155' : '#cbd5e1';

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Draw Night Sky Elements (Moon & Stars)
    if (isNight) {
      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(V_WIDTH - 120, 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = canvasBg;
      ctx.beginPath();
      ctx.arc(V_WIDTH - 128, 46, 18, 0, Math.PI * 2);
      ctx.fill();

      // Stars
      ctx.fillStyle = '#94a3b8';
      for (const s of stars) {
        s.twinkle += 0.05;
        const starAlpha = 0.4 + Math.sin(s.twinkle) * 0.4;
        ctx.globalAlpha = Math.max(0.1, starAlpha);
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1.0;
    }

    // Draw Clouds & Scenery
    clouds.forEach(cloud => cloud.draw(ctx, cloudColor));
    ground.draw(ctx, mainColor);

    // Draw Obstacles
    obstacles.forEach(obs => obs.draw(ctx, mainColor));

    // Draw Particles
    particles.forEach(p => p.draw(ctx));

    // Draw Dino
    dino.draw(ctx, mainColor);
  }

  // Main Animation Loop
  function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
  }

  // Keyboard Event Listeners
  const keyState = {
    jump: false,
    duck: false
  };

  window.addEventListener('keydown', (e) => {
    // Prevent scrolling with Space & Arrow keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
        startGame();
      } else if (gameState === STATES.PAUSED) {
        togglePause();
      } else if (gameState === STATES.PLAYING) {
        keyState.jump = true;
        dino.jump();
      }
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      if (gameState === STATES.PLAYING) {
        keyState.duck = true;
        dino.setDucking(true);
      }
    } else if (e.code === 'KeyP') {
      if (gameState === STATES.PLAYING || gameState === STATES.PAUSED) {
        togglePause();
      }
    } else if (e.code === 'KeyM') {
      const isMuted = sound.toggleMute();
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      keyState.jump = false;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      keyState.duck = false;
      dino.setDucking(false);
    }
  });

  // Touch & Click Event Listeners
  startBtn.addEventListener('click', () => startGame());
  restartBtn.addEventListener('click', () => startGame());
  resumeBtn.addEventListener('click', () => togglePause());

  pauseBtn.addEventListener('click', () => togglePause());
  soundBtn.addEventListener('click', () => {
    sound.init();
    const isMuted = sound.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  });

  // Mobile Touch Controls
  touchJumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATES.PLAYING) {
      dino.jump();
    } else if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
      startGame();
    }
  });

  touchDuckBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATES.PLAYING) {
      dino.setDucking(true);
    }
  });

  touchDuckBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === STATES.PLAYING) {
      dino.setDucking(false);
    }
  });

  // Direct Canvas Tap / Click to Jump
  canvas.addEventListener('pointerdown', (e) => {
    sound.init();
    if (gameState === STATES.PLAYING) {
      dino.jump();
    } else if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
      startGame();
    }
  });

  // Initial display setup
  updateScoreDisplay();
  requestAnimationFrame(gameLoop);
});
