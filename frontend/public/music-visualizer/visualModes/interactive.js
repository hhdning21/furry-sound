/**
 * INTERACTIVE RHYTHM MODE
 *
 * 4-lane lightweight interaction mode built on top of existing analyzer data.
 * - Notes spawn when beats are detected.
 * - Player hits lanes with D / F / J / K or mouse/touch on lane area.
 * - Judgement windows are pixel-distance based around the hit line.
 * - Rich visual feedback with hit effects, particles, and animations
 */

export class InteractiveRhythmMode {
  constructor() {
    this.notes = [];
    this.laneCount = 4;
    this.fallDuration = 1.45;

    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfect = 0;
    this.good = 0;
    this.miss = 0;
    this.lastJudge = '--';

    // Track audio playing state
    this.audioElement = null;
    this.isAudioPlaying = false;

    // Hold note tracking
    this.activeHolds = {}; // lane -> { note, startTime, isHolding }

    this._lastBeatSpawnTime = -999;
    this._lastSpawnTime = -999;
    this._lastRealBeatTime = -999;
    this._estimatedBeatInterval = 0.5;
    this._nextExpectedBeatAt = -1;
    this._nextSubdivisionAt = -1;
    this._laneCursor = 0;

    this._view = { width: 1, height: 1, laneWidth: 1, hitY: 1 };
    this._boundInput = false;

    // Visual feedback systems
    this.hitEffects = [];
    this.particles = [];
    this.judgementTexts = [];
    this.laneFlashes = [0, 0, 0, 0];
    this.screenPulse = 0;
    this.comboAnimation = { value: 0, scale: 1, opacity: 0 };

    this.difficulty = 'mid';
    this._difficultyConfig = {
      minGap: 0.16,
      maxGap: 0.56,
      subdivisionProb: 0.22,
      accentEvery: 4,
      fallDuration: 1.45
    };

    this.countdownFrom = 3;
    this.countdownStartAt = 0;
    this.countdownEndsAt = 0;

    this._bindInput();
  }

  setDifficulty(level = 'mid') {
    const normalized = String(level).toLowerCase();
    this.difficulty = normalized;

    if (normalized === 'easy') {
      this._difficultyConfig = {
        minGap: 0.2,
        maxGap: 0.74,
        subdivisionProb: 0.08,
        accentEvery: 5,
        fallDuration: 1.72
      };
    } else if (normalized === 'hard') {
      this._difficultyConfig = {
        minGap: 0.11,
        maxGap: 0.4,
        subdivisionProb: 0.46,
        accentEvery: 3,
        fallDuration: 1.18
      };
    } else {
      this._difficultyConfig = {
        minGap: 0.16,
        maxGap: 0.56,
        subdivisionProb: 0.22,
        accentEvery: 4,
        fallDuration: 1.45
      };
    }

    this.fallDuration = this._difficultyConfig.fallDuration;
  }

  startCountdown(from = 3) {
    const now = performance.now() / 1000;
    this.countdownFrom = Math.max(1, Number(from) || 3);
    this.countdownStartAt = now;
    this.countdownEndsAt = now + this.countdownFrom;
    this._nextExpectedBeatAt = -1;
    this._nextSubdivisionAt = -1;
    this._lastRealBeatTime = -999;
    this._lastSpawnTime = -999;
    this.notes = [];
  }

  _countdownActive(t) {
    return this.countdownEndsAt > t;
  }

  _bindInput() {
    if (this._boundInput) return;

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const keyLane = { d: 0, f: 1, j: 2, k: 3 };
      const lane = keyLane[key];
      if (lane === undefined) return;
      event.preventDefault();
      this._tryHitLane(lane, true); // true = key down
    });

    window.addEventListener('keyup', (event) => {
      const key = event.key.toLowerCase();
      const keyLane = { d: 0, f: 1, j: 2, k: 3 };
      const lane = keyLane[key];
      if (lane === undefined) return;
      this._releaseHold(lane);
    });

    window.addEventListener('pointerdown', (event) => {
      const { width, laneWidth } = this._view;
      if (width <= 1 || laneWidth <= 1) return;
      const lane = Math.max(0, Math.min(this.laneCount - 1, Math.floor(event.clientX / laneWidth)));
      this._tryHitLane(lane, true);
    });

    window.addEventListener('pointerup', (event) => {
      const { width, laneWidth } = this._view;
      if (width <= 1 || laneWidth <= 1) return;
      const lane = Math.max(0, Math.min(this.laneCount - 1, Math.floor(event.clientX / laneWidth)));
      this._releaseHold(lane);
    });

    this._boundInput = true;
  }

  _spawnNote(t, { isAccent = false, isHold = false, holdDuration = 0 } = {}) {
    const lane = this._laneCursor % this.laneCount;
    this._laneCursor += isAccent ? 2 : 1;

    let type = 'normal';
    if (isHold) {
      type = 'hold';
    } else if (isAccent) {
      type = 'accent';
    }

    this.notes.push({
      lane,
      spawnTime: t,
      type,
      judged: false,
      isHold,
      holdDuration, // in seconds
      holdJudged: false
    });

    this._lastSpawnTime = t;
  }

  _updateRhythmSpawn(data, t) {
    // Only spawn notes when audio is playing
    if (!this.isAudioPlaying) return;

    const minGap = this._difficultyConfig.minGap;

    if (this._nextExpectedBeatAt < 0) {
      this._nextExpectedBeatAt = t + this._estimatedBeatInterval;
      this._nextSubdivisionAt = t + this._estimatedBeatInterval * 0.5;
    }

    // Real beat: strongest source of rhythm truth.
    if (data.beat && t - this._lastBeatSpawnTime > 0.1) {
      if (this._lastRealBeatTime > 0) {
        const delta = Math.max(0.28, Math.min(1.1, t - this._lastRealBeatTime));
        this._estimatedBeatInterval = this._estimatedBeatInterval * 0.75 + delta * 0.25;
      }

      this._lastRealBeatTime = t;
      this._lastBeatSpawnTime = t;
      this._nextExpectedBeatAt = t + this._estimatedBeatInterval;
      this._nextSubdivisionAt = t + this._estimatedBeatInterval * 0.5;

      const accentByGrid = (this.perfect + this.good + this.miss + this.notes.length) % this._difficultyConfig.accentEvery === 0;
      const isAccent = data.kickDetected || accentByGrid;
      
      // Randomly spawn hold notes (15% chance on kick beats)
      const shouldSpawnHold = data.kickDetected && Math.random() < 0.15;
      const holdDuration = shouldSpawnHold ? (0.4 + Math.random() * 0.6) : 0;
      
      if (t - this._lastSpawnTime > minGap) {
        this._spawnNote(t, { isAccent, isHold: shouldSpawnHold, holdDuration });
      }
      return;
    }

    // Fallback beat grid for long detector gaps (keeps musical continuity).
    while (t >= this._nextExpectedBeatAt + 0.015) {
      if (t - this._lastSpawnTime > this._difficultyConfig.maxGap) {
        this._spawnNote(t, { isAccent: false });
      }
      this._nextExpectedBeatAt += this._estimatedBeatInterval;
    }

    // Subdivision notes (mid/hard density).
    if (this._nextSubdivisionAt > 0 && t >= this._nextSubdivisionAt) {
      if (Math.random() < this._difficultyConfig.subdivisionProb && t - this._lastSpawnTime > minGap) {
        this._spawnNote(t, { isAccent: false });
      }
      this._nextSubdivisionAt += this._estimatedBeatInterval;
    }
  }

  _createHitExplosion(x, y, judgement, isAccent) {
    const particleCount = judgement === 'perfect' ? 20 : judgement === 'good' ? 12 : 6;
    const colors = {
      perfect: ['#FFD700', '#FFA500', '#FF69B4'],
      good: ['#00BFFF', '#87CEEB', '#4169E1'],
      miss: ['#888888', '#555555', '#333333']
    };
    const palette = colors[judgement] || colors.miss;

    // Create burst particles
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 2 + Math.random() * 3;
      const size = isAccent ? 4 + Math.random() * 3 : 2 + Math.random() * 2;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        life: 1,
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }

    // Create expanding ring
    this.hitEffects.push({
      x,
      y,
      radius: 0,
      maxRadius: isAccent ? 80 : 50,
      life: 1,
      color: palette[0]
    });
  }

  _createJudgementText(x, y, judgement) {
    const colors = {
      perfect: '#FFD700',
      good: '#00BFFF',
      miss: '#FF4444'
    };
    
    this.judgementTexts.push({
      x,
      y: y - 40,
      text: judgement.toUpperCase(),
      scale: 0.5,
      life: 1,
      color: colors[judgement] || '#FFFFFF'
    });
  }

  _triggerLaneFlash(lane, judgement, isAccent) {
    const intensity = judgement === 'perfect' ? 1 : judgement === 'good' ? 0.6 : 0.3;
    const boost = isAccent ? 1.5 : 1;
    this.laneFlashes[lane] = intensity * boost;
  }

  _triggerScreenPulse() {
    this.screenPulse = 1;
  }

  _updateComboAnimation() {
    if (this.combo > 0 && this.comboAnimation.value !== this.combo) {
      this.comboAnimation.value = this.combo;
      this.comboAnimation.scale = 1.8;
      this.comboAnimation.opacity = 1;
    }
  }

  _tryHitLane(lane, isKeyDown = false) {
    const hitY = this._view.hitY;
    const laneWidth = this._view.laneWidth;
    if (!hitY) return;

    const now = performance.now() / 1000;
    if (this._countdownActive(now)) return;

    let target = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const note of this.notes) {
      if (note.judged || note.lane !== lane) continue;
      const distance = Math.abs(note.y - hitY);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = note;
      }
    }

    if (!target) return;

    // Handle hold notes
    if (target.isHold && isKeyDown) {
      // Start hold
      if (bestDistance <= 52) {
        this.activeHolds[lane] = {
          note: target,
          startTime: now,
          isHolding: true
        };
        target.holdStarted = true;
        return;
      }
    }

    // Skip regular hit if this is a hold note (must hold, not tap)
    if (target.isHold) return;

    const hitX = lane * laneWidth + laneWidth * 0.5;
    const isAccent = target.type === 'accent';

    // Relaxed judgement windows (more forgiving)
    if (bestDistance <= 18) {
      this.perfect += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += isAccent ? 1200 : 1000;
      this.lastJudge = 'Perfect';
      target.judged = true;
      
      // Visual feedback
      this._createHitExplosion(hitX, hitY, 'perfect', isAccent);
      this._createJudgementText(hitX, hitY, 'perfect');
      this._triggerLaneFlash(lane, 'perfect', isAccent);
      this._triggerScreenPulse();
      this._updateComboAnimation();
      return;
    }

    if (bestDistance <= 34) {
      this.good += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += isAccent ? 800 : 650;
      this.lastJudge = 'Good';
      target.judged = true;
      
      // Visual feedback
      this._createHitExplosion(hitX, hitY, 'good', isAccent);
      this._createJudgementText(hitX, hitY, 'good');
      this._triggerLaneFlash(lane, 'good', isAccent);
      this._updateComboAnimation();
      return;
    }

    if (bestDistance <= 52) {
      this.miss += 1;
      this.combo = 0;
      this.lastJudge = 'Miss';
      target.judged = true;
      
      // Visual feedback
      this._createHitExplosion(hitX, hitY, 'miss', false);
      this._createJudgementText(hitX, hitY, 'miss');
      this._triggerLaneFlash(lane, 'miss', false);
      this.comboAnimation.opacity = 0;
    }
  }

  _releaseHold(lane) {
    const hold = this.activeHolds[lane];
    if (!hold || !hold.isHolding) return;

    const now = performance.now() / 1000;
    const holdTime = now - hold.startTime;
    const note = hold.note;

    if (!note || note.holdJudged) {
      delete this.activeHolds[lane];
      return;
    }

    const requiredDuration = note.holdDuration || 0.5;
    const hitX = lane * this._view.laneWidth + this._view.laneWidth * 0.5;
    const hitY = this._view.hitY;

    // Judge hold accuracy
    const accuracy = holdTime / requiredDuration;
    if (accuracy >= 0.85) {
      // Perfect hold
      this.perfect += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += 1500;
      this.lastJudge = 'Perfect Hold';
      note.judged = true;
      note.holdJudged = true;
      this._createHitExplosion(hitX, hitY, 'perfect', true);
      this._createJudgementText(hitX, hitY, 'perfect');
      this._triggerLaneFlash(lane, 'perfect', true);
      this._triggerScreenPulse();
      this._updateComboAnimation();
    } else if (accuracy >= 0.6) {
      // Good hold
      this.good += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += 1000;
      this.lastJudge = 'Good Hold';
      note.judged = true;
      note.holdJudged = true;
      this._createHitExplosion(hitX, hitY, 'good', false);
      this._createJudgementText(hitX, hitY, 'good');
      this._triggerLaneFlash(lane, 'good', false);
      this._updateComboAnimation();
    } else {
      // Released too early
      this.miss += 1;
      this.combo = 0;
      this.lastJudge = 'Miss (Early Release)';
      note.judged = true;
      note.holdJudged = true;
      this._createHitExplosion(hitX, hitY, 'miss', false);
      this._createJudgementText(hitX, hitY, 'miss');
      this._triggerLaneFlash(lane, 'miss', false);
      this.comboAnimation.opacity = 0;
    }

    delete this.activeHolds[lane];
  }

  render(ctx, data, t, width, height, theme) {
    this._view.width = width;
    this._view.height = height;
    this._view.laneWidth = width / this.laneCount;
    this._view.hitY = height * 0.86;

    // Track audio playing state
    if (this.audioElement) {
      this.isAudioPlaying = !this.audioElement.paused && !this.audioElement.ended;
    }

    const nowSec = performance.now() / 1000;
    const countdownActive = this._countdownActive(nowSec);
    if (!countdownActive) {
      this._updateRhythmSpawn(data, t);
    }

    const laneWidth = this._view.laneWidth;
    const hitY = this._view.hitY;

    // Apply screen pulse effect
    const hasScreenPulse = this.screenPulse > 0;
    if (hasScreenPulse) {
      const scale = 1 + this.screenPulse * 0.03;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);
      this.screenPulse *= 0.85;
      if (this.screenPulse < 0.01) this.screenPulse = 0;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(5, 7, 16, 0.28)';
    ctx.fillRect(0, 0, width, height);

    // Lanes with flash effect
    for (let i = 0; i < this.laneCount; i++) {
      const x = i * laneWidth;
      
      // Lane flash effect
      if (this.laneFlashes[i] > 0) {
        const alpha = this.laneFlashes[i] * 0.4;
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.fillRect(x, 0, laneWidth, height);
        this.laneFlashes[i] *= 0.88;
        if (this.laneFlashes[i] < 0.01) this.laneFlashes[i] = 0;
      }
      
      ctx.strokeStyle = 'rgba(138, 180, 255, 0.18)';
      ctx.strokeRect(x + 0.5, 0.5, laneWidth - 1, height - 1);
    }

    // Hit line
    ctx.fillStyle = 'rgba(129, 244, 255, 0.95)';
    ctx.fillRect(0, hitY - 2, width, 4);

    // Notes update + draw
    for (const note of this.notes) {
      if (note.judged && !note.isHold) continue;
      if (note.holdJudged) continue;

      const progress = (t - note.spawnTime) / this.fallDuration;
      note.y = progress * hitY;
      note.x = note.lane * laneWidth + laneWidth * 0.5;

      // Hold note logic
      if (note.isHold) {
        const holdPixels = (note.holdDuration / this.fallDuration) * hitY;
        note.tailY = Math.max(0, note.y - holdPixels);

        // Check if hold is being held correctly
        const hold = this.activeHolds[note.lane];
        const isBeingHeld = hold && hold.note === note && hold.isHolding;

        // Auto miss if note head passed hit line without starting hold
        if (note.y > hitY + 52 && !note.holdStarted && !countdownActive) {
          note.judged = true;
          note.holdJudged = true;
          this.miss += 1;
          this.combo = 0;
          this.lastJudge = 'Miss (Hold)';
          if (this.activeHolds[note.lane]) {
            delete this.activeHolds[note.lane];
          }
          continue;
        }

        // Auto complete if held long enough
        if (isBeingHeld) {
          const holdTime = nowSec - hold.startTime;
          if (holdTime >= note.holdDuration) {
            // Successfully completed hold
            this.perfect += 1;
            this.combo += 1;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            this.score += 1500;
            this.lastJudge = 'Perfect Hold';
            note.judged = true;
            note.holdJudged = true;
            const hitX = note.lane * laneWidth + laneWidth * 0.5;
            this._createHitExplosion(hitX, hitY, 'perfect', true);
            this._createJudgementText(hitX, hitY, 'perfect');
            this._triggerLaneFlash(note.lane, 'perfect', true);
            this._triggerScreenPulse();
            this._updateComboAnimation();
            delete this.activeHolds[note.lane];
            continue;
          }
        }

        // Draw hold note with trail (meteor effect)
        const trailLength = Math.min(holdPixels, note.y - note.tailY);
        const gradient = ctx.createLinearGradient(note.x, note.tailY, note.x, note.y);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 0)');
        gradient.addColorStop(0.3, isBeingHeld ? 'rgba(100, 255, 150, 0.4)' : 'rgba(255, 200, 100, 0.4)');
        gradient.addColorStop(1, isBeingHeld ? 'rgba(100, 255, 150, 0.95)' : 'rgba(255, 180, 80, 0.95)');

        ctx.fillStyle = gradient;
        const trailWidth = 18;
        ctx.fillRect(note.x - trailWidth / 2, note.tailY, trailWidth, trailLength);

        // Draw hold note head (different color when being held)
        ctx.beginPath();
        ctx.fillStyle = isBeingHeld ? 'rgba(100, 255, 150, 0.98)' : 'rgba(255, 180, 80, 0.98)';
        ctx.arc(note.x, note.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isBeingHeld ? 'rgba(200, 255, 220, 0.95)' : 'rgba(255, 220, 150, 0.95)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw pulsing ring on hold head
        if (isBeingHeld) {
          const pulseSize = 16 + Math.sin(nowSec * 8) * 3;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(100, 255, 150, 0.6)';
          ctx.lineWidth = 2;
          ctx.arc(note.x, note.y, pulseSize, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Regular note - auto miss
        if (note.y > hitY + 52 && !countdownActive) {
          note.judged = true;
          this.miss += 1;
          this.combo = 0;
          this.lastJudge = 'Miss';
          continue;
        }

        // Draw meteor trail for regular notes
        const trailLength = 40;
        const gradient = ctx.createLinearGradient(note.x, note.y - trailLength, note.x, note.y);
        const baseColor = note.type === 'accent' ? 'rgba(255, 130, 90, ' : 'rgba(124, 188, 255, ';
        gradient.addColorStop(0, baseColor + '0)');
        gradient.addColorStop(0.5, baseColor + '0.3)');
        gradient.addColorStop(1, baseColor + '0.95)');

        ctx.fillStyle = gradient;
        const trailWidth = note.type === 'accent' ? 10 : 8;
        ctx.fillRect(note.x - trailWidth / 2, note.y - trailLength, trailWidth, trailLength);

        // Draw note head
        ctx.beginPath();
        ctx.fillStyle = note.type === 'accent' ? 'rgba(255,130,90,0.96)' : 'rgba(124,188,255,0.95)';
        ctx.arc(note.x, note.y, note.type === 'accent' ? 14 : 11, 0, Math.PI * 2);
        ctx.fill();

        if (note.type === 'accent') {
          ctx.strokeStyle = 'rgba(255, 225, 190, 0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Render particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life -= 0.02;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Render hit effects (expanding rings)
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      effect.radius += 4;
      effect.life -= 0.02;

      if (effect.life <= 0 || effect.radius > effect.maxRadius) {
        this.hitEffects.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = effect.color;
      ctx.globalAlpha = effect.life;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Render judgement texts
    for (let i = this.judgementTexts.length - 1; i >= 0; i--) {
      const text = this.judgementTexts[i];
      text.y -= 1.5; // float upward
      text.scale = Math.min(1.5, text.scale + 0.08);
      text.life -= 0.012;

      if (text.life <= 0) {
        this.judgementTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(text.x, text.y);
      ctx.scale(text.scale, text.scale);
      ctx.fillStyle = text.color;
      ctx.globalAlpha = text.life;
      ctx.font = 'bold 24px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(text.text, 0, 0);
      ctx.fillText(text.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Render combo animation
    if (!countdownActive && this.combo > 0 && this.comboAnimation.opacity > 0) {
      this.comboAnimation.scale *= 0.92;
      this.comboAnimation.scale = Math.max(1, this.comboAnimation.scale);
      this.comboAnimation.opacity *= 0.97;

      const comboX = width / 2;
      const comboY = hitY - 100;

      ctx.save();
      ctx.translate(comboX, comboY);
      ctx.scale(this.comboAnimation.scale, this.comboAnimation.scale);
      ctx.globalAlpha = this.comboAnimation.opacity;
      
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 36px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 5;
      ctx.strokeText(`${this.combo}`, 0, 0);
      ctx.fillText(`${this.combo}`, 0, 0);
      
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#FFA500';
      ctx.strokeText('COMBO', 0, 28);
      ctx.fillText('COMBO', 0, 28);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // keep buffer small
    this.notes = this.notes.filter((n) => !n.judged || (t - n.spawnTime) < 3.5).slice(-220);

    // Countdown overlay (3,2,1)
    if (countdownActive) {
      const remain = this.countdownEndsAt - nowSec;
      const number = Math.max(1, Math.ceil(remain));
      const phase = 1 - (remain - Math.floor(remain));
      const scale = 0.9 + phase * 0.35;
      const alpha = 1 - phase * 0.65;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width * 0.5, height * 0.45);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 120px Inter, system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 8;
      ctx.strokeText(String(number), 0, 0);
      ctx.fillStyle = '#fff1a8';
      ctx.fillText(String(number), 0, 0);
      ctx.restore();

      ctx.fillStyle = '#eaf2ff';
      ctx.font = '600 20px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Get Ready', width * 0.5, height * 0.62);
    }

    // Restore screen pulse transform
    if (hasScreenPulse) {
      ctx.restore();
    }

    // HUD
    ctx.fillStyle = 'rgba(12, 18, 38, 0.75)';
    ctx.fillRect(16, 16, 250, 104);
    ctx.strokeStyle = 'rgba(130, 184, 255, 0.32)';
    ctx.strokeRect(16, 16, 250, 104);

    ctx.fillStyle = theme.accent || '#dff3ff';
    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillText('Interactive Rhythm', 28, 40);

    ctx.fillStyle = '#e7efff';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillText(`Score: ${this.score}`, 28, 62);
    ctx.fillText(`Combo: ${this.combo} (Best ${this.bestCombo})`, 28, 80);
    ctx.fillText(`P/G/M: ${this.perfect}/${this.good}/${this.miss}  ${this.lastJudge}`, 28, 98);
    ctx.fillText(`Keys: D F J K · ${this.difficulty.toUpperCase()}`, 28, 114);

    ctx.restore();
  }
}
