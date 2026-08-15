/**
 * Cyber Strike - Complete 2D Sci-Fi Space Shooter Arcade Engine
 * Features: Starfighter combat, wave management, boss fights, power-ups,
 * multi-tier synthesized Web Audio SFX, parallax starfield, and mobile touch support.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Canvas & Context
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM HUD & Overlays
  const scoreDisplay = document.getElementById('score-display');
  const highScoreDisplay = document.getElementById('high-score-display');
  const waveDisplay = document.getElementById('wave-display');
  const shieldBarFill = document.getElementById('shield-bar-fill');

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

  const touchLeftBtn = document.getElementById('touch-left-btn');
  const touchRightBtn = document.getElementById('touch-right-btn');
  const touchFireBtn = document.getElementById('touch-fire-btn');
  const touchBombBtn = document.getElementById('touch-bomb-btn');

  const finalScoreEl = document.getElementById('final-score');
  const finalWaveEl = document.getElementById('final-wave');
  const finalKillsEl = document.getElementById('final-kills');

  // Resolution constants
  const V_WIDTH = 800;
  const V_HEIGHT = 500;

  // Sound Synthesizer (Web Audio API)
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playLaser() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.08);
      } catch (e) {}
    }

    playEnemyLaser() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {}
    }

    playExplosion(isLarge = false) {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const duration = isLarge ? 0.45 : 0.25;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isLarge ? 140 : 180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + duration);

        gain.gain.setValueAtTime(isLarge ? 0.25 : 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }

    playPowerup() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const playTone = (freq, time, dur) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);
          gain.gain.setValueAtTime(0.12, now + time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
          osc.start(now + time);
          osc.stop(now + time + dur);
        };
        playTone(523.25, 0, 0.08); // C5
        playTone(659.25, 0.08, 0.08); // E5
        playTone(783.99, 0.16, 0.08); // G5
        playTone(1046.50, 0.24, 0.15); // C6
      } catch (e) {}
    }

    playBomb() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.6);
      } catch (e) {}
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
  }

  const sound = new SoundEngine();

  // Game State
  const STATES = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
  };

  let gameState = STATES.START;
  let score = 0;
  let highScore = parseInt(localStorage.getItem('cybershoot_hi') || '0', 10);
  let wave = 1;
  let enemiesKilled = 0;
  let screenShake = 0;
  let waveAnnouncementTimer = 0;
  let waveAnnouncementText = '';

  // Background Parallax Starfield
  class Starfield {
    constructor() {
      this.stars = [];
      for (let i = 0; i < 100; i++) {
        this.stars.push({
          x: Math.random() * V_WIDTH,
          y: Math.random() * V_HEIGHT,
          size: Math.random() < 0.2 ? 2.5 : Math.random() < 0.6 ? 1.5 : 1,
          speed: 0.5 + Math.random() * 2,
          color: Math.random() < 0.2 ? '#38bdf8' : Math.random() < 0.4 ? '#c084fc' : '#ffffff'
        });
      }
    }

    update() {
      for (const s of this.stars) {
        s.y += s.speed;
        if (s.y > V_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * V_WIDTH;
        }
      }
    }

    draw(ctx) {
      for (const s of this.stars) {
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
      }
    }
  }

  const starfield = new Starfield();

  // Particle System
  const particles = [];
  const floatingTexts = [];

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

  function spawnExplosion(x, y, color = '#ff0055', count = 18, isLarge = false) {
    const explosionColors = [color, '#facc15', '#ffffff', '#00f0ff'];
    for (let i = 0; i < (isLarge ? count * 2 : count); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4 + 1.5) * (isLarge ? 1.6 : 1);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const c = explosionColors[Math.floor(Math.random() * explosionColors.length)];
      const size = Math.floor(Math.random() * 4) + 2;
      particles.push(new Particle(x, y, vx, vy, size, c, isLarge ? 35 : 22));
    }
  }

  function addFloatingText(text, x, y, color = '#00f0ff') {
    floatingTexts.push({
      text,
      x,
      y,
      color,
      life: 30,
      maxLife: 30
    });
  }

  // Player Bullet Class
  class Bullet {
    constructor(x, y, vx, vy, isPlayer = true, color = '#00f0ff') {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.isPlayer = isPlayer;
      this.color = color;
      this.width = isPlayer ? 4 : 5;
      this.height = isPlayer ? 14 : 10;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
    }

    draw(ctx) {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(Math.floor(this.x - this.width / 2), Math.floor(this.y - this.height / 2), this.width, this.height);
      ctx.shadowBlur = 0;
    }
  }

  // Power-up Class
  class PowerUp {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type; // 'weapon', 'shield', 'bomb'
      this.vy = 1.8;
      this.width = 24;
      this.height = 24;
      this.rotation = 0;
    }

    update() {
      this.y += this.vy;
      this.rotation += 0.05;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      if (this.type === 'weapon') {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.fillRect(-6, -6, 12, 12);
      } else if (this.type === 'shield') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (this.type === 'bomb') {
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(12, 12);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Player Starfighter Class
  class Player {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = V_WIDTH / 2;
      this.y = V_HEIGHT - 60;
      this.width = 40;
      this.height = 42;
      this.speed = 6.5;
      this.shield = 100;
      this.maxShield = 100;
      this.weaponLevel = 1; // 1 to 4
      this.bombs = 2;
      this.shootCooldown = 0;
      this.invincibleTimer = 0;
    }

    move(dirX, dirY) {
      this.x += dirX * this.speed;
      this.y += dirY * this.speed;

      // Bounds clamping
      this.x = Math.max(this.width / 2 + 10, Math.min(V_WIDTH - this.width / 2 - 10, this.x));
      this.y = Math.max(120, Math.min(V_HEIGHT - this.height / 2 - 10, this.y));
    }

    shoot(bullets) {
      if (this.shootCooldown > 0) return;
      sound.playLaser();

      if (this.weaponLevel === 1) {
        bullets.push(new Bullet(this.x, this.y - 18, 0, -12, true, '#00f0ff'));
        this.shootCooldown = 12;
      } else if (this.weaponLevel === 2) {
        bullets.push(new Bullet(this.x - 10, this.y - 14, 0, -12, true, '#00f0ff'));
        bullets.push(new Bullet(this.x + 10, this.y - 14, 0, -12, true, '#00f0ff'));
        this.shootCooldown = 11;
      } else if (this.weaponLevel === 3) {
        bullets.push(new Bullet(this.x, this.y - 18, 0, -13, true, '#facc15'));
        bullets.push(new Bullet(this.x - 12, this.y - 14, -2.5, -12, true, '#00f0ff'));
        bullets.push(new Bullet(this.x + 12, this.y - 14, 2.5, -12, true, '#00f0ff'));
        this.shootCooldown = 10;
      } else {
        // Barrage Level 4
        bullets.push(new Bullet(this.x - 6, this.y - 18, 0, -14, true, '#a855f7'));
        bullets.push(new Bullet(this.x + 6, this.y - 18, 0, -14, true, '#a855f7'));
        bullets.push(new Bullet(this.x - 16, this.y - 14, -3.5, -12, true, '#00f0ff'));
        bullets.push(new Bullet(this.x + 16, this.y - 14, 3.5, -12, true, '#00f0ff'));
        this.shootCooldown = 8;
      }
    }

    useBomb(enemies, enemyBullets) {
      if (this.bombs <= 0) return;
      this.bombs--;
      sound.playBomb();
      screenShake = 18;

      // Clear all enemy bullets
      enemyBullets.length = 0;

      // Damage all enemies on screen
      for (const enemy of enemies) {
        enemy.takeDamage(120);
      }

      spawnExplosion(V_WIDTH / 2, V_HEIGHT / 2, '#a855f7', 40, true);
      addFloatingText('PLASMA BOMB ACTIVATED!', V_WIDTH / 2 - 100, V_HEIGHT / 2, '#c084fc');
    }

    takeDamage(amount) {
      if (this.invincibleTimer > 0) return;
      this.shield = Math.max(0, this.shield - amount);
      this.invincibleTimer = 35;
      screenShake = 10;
      spawnExplosion(this.x, this.y, '#f43f5e', 10);
      updateShieldUI(this.shield, this.maxShield);

      if (this.shield <= 0) {
        gameOver();
      }
    }

    heal(amount) {
      this.shield = Math.min(this.maxShield, this.shield + amount);
      updateShieldUI(this.shield, this.maxShield);
    }

    update() {
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (this.invincibleTimer > 0) this.invincibleTimer--;

      // Thruster trail particles
      if (Math.random() < 0.8) {
        const flameX = this.x + (Math.random() * 8 - 4);
        const flameY = this.y + 20;
        particles.push(new Particle(flameX, flameY, (Math.random() - 0.5) * 1.5, 3 + Math.random() * 2, 3, Math.random() > 0.4 ? '#00f0ff' : '#818cf8', 12));
      }
    }

    draw(ctx) {
      if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
        return; // Flash effect during invincibility
      }

      ctx.save();
      ctx.translate(this.x, this.y);

      // Starfighter fuselage & wings
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(0, -20); // Nose tip
      ctx.lineTo(16, 12);
      ctx.lineTo(24, 18); // Right wing tip
      ctx.lineTo(8, 14);
      ctx.lineTo(0, 18);  // Engine center
      ctx.lineTo(-8, 14);
      ctx.lineTo(-24, 18); // Left wing tip
      ctx.lineTo(-16, 12);
      ctx.closePath();
      ctx.fill();

      // Cockpit Glow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -4, 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing Canons
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-18, 4, 3, 10);
      ctx.fillRect(15, 4, 3, 10);

      // Shield Aura when high shield
      if (this.shield > 20) {
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + (this.shield / 100) * 0.25})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Enemy Ships System
  class Enemy {
    constructor(type, x, y, waveNumber) {
      this.type = type; // 'scout', 'cruiser', 'stealth', 'boss'
      this.x = x;
      this.y = y;
      this.startX = x;
      this.wave = waveNumber;
      this.shootTimer = Math.random() * 60;
      this.alive = true;
      this.angle = 0;
      this.initStats();
    }

    initStats() {
      if (this.type === 'scout') {
        this.width = 30;
        this.height = 28;
        this.hp = 20 + this.wave * 5;
        this.maxHp = this.hp;
        this.vy = 2.4 + Math.random() * 0.6;
        this.points = 100;
        this.color = '#f43f5e';
      } else if (this.type === 'cruiser') {
        this.width = 44;
        this.height = 36;
        this.hp = 50 + this.wave * 12;
        this.maxHp = this.hp;
        this.vy = 1.3;
        this.points = 250;
        this.color = '#fbbf24';
      } else if (this.type === 'stealth') {
        this.width = 32;
        this.height = 30;
        this.hp = 30 + this.wave * 8;
        this.maxHp = this.hp;
        this.vy = 1.8;
        this.points = 200;
        this.color = '#c084fc';
      } else if (this.type === 'boss') {
        this.width = 110;
        this.height = 65;
        this.hp = 350 + this.wave * 100;
        this.maxHp = this.hp;
        this.vy = 0.5;
        this.points = 1500;
        this.color = '#ff0055';
        this.dirX = 1;
      }
    }

    takeDamage(amount) {
      this.hp -= amount;
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
      }
    }

    update(enemyBullets, playerX) {
      this.angle += 0.05;

      if (this.type === 'scout') {
        this.y += this.vy;
        this.x = this.startX + Math.sin(this.angle * 1.5) * 30;
        this.shootTimer++;
        if (this.shootTimer > 90) {
          this.shootTimer = 0;
          sound.playEnemyLaser();
          enemyBullets.push(new Bullet(this.x, this.y + 14, 0, 5, false, '#f43f5e'));
        }
      } else if (this.type === 'cruiser') {
        this.y += this.vy;
        this.shootTimer++;
        if (this.shootTimer > 75) {
          this.shootTimer = 0;
          sound.playEnemyLaser();
          enemyBullets.push(new Bullet(this.x - 12, this.y + 16, -1, 4.5, false, '#fbbf24'));
          enemyBullets.push(new Bullet(this.x + 12, this.y + 16, 1, 4.5, false, '#fbbf24'));
        }
      } else if (this.type === 'stealth') {
        this.y += this.vy;
        this.x = this.startX + Math.sin(this.angle * 2.5) * 80;
        this.shootTimer++;
        if (this.shootTimer > 80) {
          this.shootTimer = 0;
          sound.playEnemyLaser();
          const angleToPlayer = Math.atan2(playerX - this.x, 300);
          enemyBullets.push(new Bullet(this.x, this.y + 12, Math.sin(angleToPlayer) * 4, 4.5, false, '#c084fc'));
        }
      } else if (this.type === 'boss') {
        if (this.y < 80) {
          this.y += this.vy;
        } else {
          // Boss Patrols left & right
          this.x += this.dirX * 2.2;
          if (this.x > V_WIDTH - 120 || this.x < 120) {
            this.dirX *= -1;
          }
        }
        this.shootTimer++;
        if (this.shootTimer > 50) {
          this.shootTimer = 0;
          sound.playEnemyLaser();
          enemyBullets.push(new Bullet(this.x - 35, this.y + 25, -2, 5, false, '#ff0055'));
          enemyBullets.push(new Bullet(this.x, this.y + 30, 0, 5.5, false, '#ff0055'));
          enemyBullets.push(new Bullet(this.x + 35, this.y + 25, 2, 5, false, '#ff0055'));
        }
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      if (this.type === 'scout') {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(15, -14);
        ctx.lineTo(-15, -14);
        ctx.closePath();
        ctx.fill();
      } else if (this.type === 'cruiser') {
        ctx.fillStyle = this.color;
        ctx.fillRect(-18, -14, 36, 22);
        ctx.fillRect(-22, -6, 44, 12);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -10, 20, 6);
      } else if (this.type === 'stealth') {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(16, 0);
        ctx.lineTo(8, -15);
        ctx.lineTo(-8, -15);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
      } else if (this.type === 'boss') {
        // Boss Cruiser
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-50, -25, 100, 45);
        ctx.fillRect(-30, 20, 60, 15);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-35, -10, 70, 10);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-45, 10, 12, 12);
        ctx.fillRect(33, 10, 12, 12);

        // Boss HP Bar above ship
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-50, -38, 100, 6);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-50, -38, Math.floor(100 * hpPct), 6);
      }

      ctx.restore();
    }
  }

  // Active Instances & Arrays
  const player = new Player();
  const playerBullets = [];
  const enemyBullets = [];
  const enemies = [];
  const powerUps = [];

  // Collision Helper
  function checkCollision(r1, r2) {
    return (
      Math.abs(r1.x - r2.x) * 2 < (r1.width + r2.width) &&
      Math.abs(r1.y - r2.y) * 2 < (r1.height + r2.height)
    );
  }

  function updateShieldUI(shield, maxShield) {
    const pct = Math.max(0, Math.min(100, (shield / maxShield) * 100));
    shieldBarFill.style.width = `${pct}%`;

    shieldBarFill.classList.remove('warning', 'danger');
    if (pct <= 25) {
      shieldBarFill.classList.add('danger');
    } else if (pct <= 55) {
      shieldBarFill.classList.add('warning');
    }
  }

  function formatScore(n) {
    return Math.floor(n).toString().padStart(5, '0');
  }

  function updateHUD() {
    scoreDisplay.textContent = formatScore(score);
    highScoreDisplay.textContent = formatScore(highScore);
    waveDisplay.textContent = wave.toString();
  }

  // Wave Spawner
  let waveEnemiesToSpawn = [];
  let spawnDelayTimer = 0;

  function initWave(waveNum) {
    wave = waveNum;
    waveAnnouncementTimer = 80;
    waveAnnouncementText = `WAVE ${wave} INCOMING`;
    waveEnemiesToSpawn = [];

    const isBossWave = wave % 3 === 0;

    if (isBossWave) {
      waveEnemiesToSpawn.push({ type: 'boss', x: V_WIDTH / 2, y: -70 });
      waveAnnouncementText = `WARNING: MOTHERSHIP DETECTED!`;
    } else {
      const scoutCount = 4 + wave * 2;
      const cruiserCount = Math.floor(wave * 1.5);
      const stealthCount = wave > 1 ? 2 + wave : 0;

      for (let i = 0; i < scoutCount; i++) {
        waveEnemiesToSpawn.push({
          type: 'scout',
          x: 60 + Math.random() * (V_WIDTH - 120),
          y: -30 - i * 60
        });
      }
      for (let i = 0; i < cruiserCount; i++) {
        waveEnemiesToSpawn.push({
          type: 'cruiser',
          x: 80 + Math.random() * (V_WIDTH - 160),
          y: -60 - i * 90
        });
      }
      for (let i = 0; i < stealthCount; i++) {
        waveEnemiesToSpawn.push({
          type: 'stealth',
          x: 100 + Math.random() * (V_WIDTH - 200),
          y: -80 - i * 80
        });
      }
    }
    updateHUD();
  }

  // Lifecycle
  function startGame() {
    sound.init();
    gameState = STATES.PLAYING;
    score = 0;
    enemiesKilled = 0;
    player.reset();
    playerBullets.length = 0;
    enemyBullets.length = 0;
    enemies.length = 0;
    powerUps.length = 0;
    particles.length = 0;
    floatingTexts.length = 0;
    screenShake = 0;

    updateShieldUI(player.shield, player.maxShield);
    initWave(1);

    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
  }

  function gameOver() {
    gameState = STATES.GAMEOVER;
    sound.playExplosion(true);
    spawnExplosion(player.x, player.y, '#00f0ff', 30, true);

    if (score > highScore) {
      highScore = Math.floor(score);
      localStorage.setItem('cybershoot_hi', highScore.toString());
      updateHUD();
    }

    finalScoreEl.textContent = Math.floor(score).toString();
    finalWaveEl.textContent = wave.toString();
    finalKillsEl.textContent = enemiesKilled.toString();

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

  // Main Game Update
  function update() {
    if (gameState !== STATES.PLAYING) return;

    starfield.update();
    player.update();

    if (screenShake > 0) screenShake--;

    // Key Movement Handlers
    let dx = 0;
    let dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
      player.move(dx, dy);
    }

    if (keys.fire) {
      player.shoot(playerBullets);
    }

    // Spawn queue for current wave
    spawnDelayTimer++;
    if (spawnDelayTimer > 35 && waveEnemiesToSpawn.length > 0) {
      spawnDelayTimer = 0;
      const nextEnemy = waveEnemiesToSpawn.shift();
      enemies.push(new Enemy(nextEnemy.type, nextEnemy.x, nextEnemy.y, wave));
    }

    // Check if Wave Completed
    if (waveEnemiesToSpawn.length === 0 && enemies.length === 0) {
      addFloatingText(`WAVE ${wave} CLEARED! +500`, V_WIDTH / 2 - 70, V_HEIGHT / 2 - 40, '#facc15');
      score += 500;
      initWave(wave + 1);
    }

    // Update Player Bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.update();

      // Check hit against enemies
      let bulletHit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (checkCollision(b, e)) {
          bulletHit = true;
          e.takeDamage(25);
          spawnExplosion(b.x, b.y, b.color, 4);

          if (!e.alive) {
            sound.playExplosion(e.type === 'boss');
            spawnExplosion(e.x, e.y, e.color, 16, e.type === 'boss');
            score += e.points;
            enemiesKilled++;
            addFloatingText(`+${e.points}`, e.x, e.y, '#facc15');

            // Chance to drop power-up
            if (Math.random() < 0.22 || e.type === 'boss') {
              const types = ['weapon', 'shield', 'bomb'];
              const chosenType = types[Math.floor(Math.random() * types.length)];
              powerUps.push(new PowerUp(e.x, e.y, chosenType));
            }

            enemies.splice(j, 1);
          }
          break;
        }
      }

      if (bulletHit || b.y < -20 || b.x < -20 || b.x > V_WIDTH + 20) {
        playerBullets.splice(i, 1);
      }
    }

    // Update Enemy Bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      eb.update();

      // Check hit against player
      if (checkCollision(eb, player)) {
        player.takeDamage(15);
        enemyBullets.splice(i, 1);
        continue;
      }

      if (eb.y > V_HEIGHT + 20 || eb.x < -20 || eb.x > V_WIDTH + 20) {
        enemyBullets.splice(i, 1);
      }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.update(enemyBullets, player.x);

      // Check body collision with player
      if (checkCollision(enemy, player)) {
        player.takeDamage(30);
        enemy.takeDamage(100);
        if (!enemy.alive) {
          spawnExplosion(enemy.x, enemy.y, enemy.color, 14);
          enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.y > V_HEIGHT + 40) {
        enemies.splice(i, 1);
      }
    }

    // Update PowerUps
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const p = powerUps[i];
      p.update();

      if (checkCollision(p, player)) {
        sound.playPowerup();
        if (p.type === 'weapon') {
          player.weaponLevel = Math.min(4, player.weaponLevel + 1);
          addFloatingText('WEAPON UPGRADED!', player.x - 50, player.y - 30, '#facc15');
        } else if (p.type === 'shield') {
          player.heal(35);
          addFloatingText('+35 SHIELD RECHARGE', player.x - 60, player.y - 30, '#10b981');
        } else if (p.type === 'bomb') {
          player.bombs++;
          addFloatingText('+1 SMART BOMB', player.x - 40, player.y - 30, '#a855f7');
        }
        powerUps.splice(i, 1);
        continue;
      }

      if (p.y > V_HEIGHT + 30) {
        powerUps.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Update Floating Text
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 0.8;
      ft.life--;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
      }
    }

    updateHUD();
  }

  // Main Draw Routine
  function draw() {
    ctx.save();

    // Screen Shake Offset
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake;
      const shakeY = (Math.random() - 0.5) * screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Deep Space Background
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Starfield
    starfield.draw(ctx);

    // Power-ups
    powerUps.forEach(p => p.draw(ctx));

    // Player Bullets & Enemy Bullets
    playerBullets.forEach(b => b.draw(ctx));
    enemyBullets.forEach(eb => eb.draw(ctx));

    // Enemies
    enemies.forEach(e => e.draw(ctx));

    // Particles
    particles.forEach(p => p.draw(ctx));

    // Player
    if (gameState === STATES.PLAYING || gameState === STATES.PAUSED) {
      player.draw(ctx);
    }

    // Floating text
    for (const ft of floatingTexts) {
      ctx.fillStyle = ft.color;
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }

    // Wave Announcement Banner
    if (waveAnnouncementTimer > 0) {
      waveAnnouncementTimer--;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.font = 'bold 20px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(waveAnnouncementText, V_WIDTH / 2, 140);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // Input Handling
  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false
  };

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
    if (e.code === 'Space') {
      keys.fire = true;
      if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
        startGame();
      }
    }
    if (e.code === 'KeyB' || e.code === 'KeyE') {
      if (gameState === STATES.PLAYING) {
        player.useBomb(enemies, enemyBullets);
      }
    }
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM') {
      const isMuted = sound.toggleMute();
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'Space') keys.fire = false;
  });

  // Button Listeners
  startBtn.addEventListener('click', () => startGame());
  restartBtn.addEventListener('click', () => startGame());
  resumeBtn.addEventListener('click', () => togglePause());
  pauseBtn.addEventListener('click', () => togglePause());
  soundBtn.addEventListener('click', () => {
    sound.init();
    const isMuted = sound.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  });

  // Mobile Touch Listeners
  touchLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
  touchLeftBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });

  touchRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
  touchRightBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });

  touchFireBtn.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    keys.fire = true; 
    if (gameState === STATES.START || gameState === STATES.GAMEOVER) startGame();
  });
  touchFireBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.fire = false; });

  touchBombBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATES.PLAYING) player.useBomb(enemies, enemyBullets);
  });

  // Canvas direct touch aim & follow
  canvas.addEventListener('pointermove', (e) => {
    if (gameState === STATES.PLAYING && e.buttons > 0) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = V_WIDTH / rect.width;
      const touchX = (e.clientX - rect.left) * scaleX;
      player.x = Math.max(30, Math.min(V_WIDTH - 30, touchX));
      keys.fire = true;
    }
  });

  canvas.addEventListener('pointerup', () => {
    if (gameState === STATES.PLAYING) keys.fire = false;
  });

  // Initial Load
  updateHUD();
  updateShieldUI(100, 100);
  requestAnimationFrame(gameLoop);
});
