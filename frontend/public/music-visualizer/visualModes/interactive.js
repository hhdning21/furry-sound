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
    this.fallDuration = 1.5;

    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfect = 0;
    this.good = 0;
    this.miss = 0;
    this.lastJudge = '--';

    this._lastBeatSpawnTime = -999;
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

    this._bindInput();
  }

  _bindInput() {
    if (this._boundInput) return;

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const keyLane = { d: 0, f: 1, j: 2, k: 3 };
      const lane = keyLane[key];
      if (lane === undefined) return;
      event.preventDefault();
      this._tryHitLane(lane);
    });

    window.addEventListener('pointerdown', (event) => {
      const { width, laneWidth } = this._view;
      if (width <= 1 || laneWidth <= 1) return;
      const lane = Math.max(0, Math.min(this.laneCount - 1, Math.floor(event.clientX / laneWidth)));
      this._tryHitLane(lane);
    });

    this._boundInput = true;
  }

  _spawnBeatNote(data, t) {
    if (!data.beat) return;
    if (t - this._lastBeatSpawnTime < 0.12) return;

    const lane = this._laneCursor % this.laneCount;
    this._laneCursor += data.snareDetected ? 2 : 1;

    const type = data.kickDetected ? 'accent' : 'normal';
    this.notes.push({
      lane,
      spawnTime: t,
      type,
      judged: false
    });

    this._lastBeatSpawnTime = t;
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

  _tryHitLane(lane) {
    const hitY = this._view.hitY;
    const laneWidth = this._view.laneWidth;
    if (!hitY) return;

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

    const hitX = lane * laneWidth + laneWidth * 0.5;
    const isAccent = target.type === 'accent';

    if (bestDistance <= 14) {
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

    if (bestDistance <= 28) {
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

    if (bestDistance <= 44) {
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

  render(ctx, data, t, width, height, theme) {
    this._view.width = width;
    this._view.height = height;
    this._view.laneWidth = width / this.laneCount;
    this._view.hitY = height * 0.86;

    this._spawnBeatNote(data, t);

    const laneWidth = this._view.laneWidth;
    const hitY = this._view.hitY;

    // Apply screen pulse effect
    if (this.screenPulse > 0) {
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
      if (note.judged) continue;

      const progress = (t - note.spawnTime) / this.fallDuration;
      note.y = progress * hitY;
      note.x = note.lane * laneWidth + laneWidth * 0.5;

      // auto miss
      if (note.y > hitY + 48) {
        note.judged = true;
        this.miss += 1;
        this.combo = 0;
        this.lastJudge = 'Miss';
        continue;
      }

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
    if (this.combo > 0 && this.comboAnimation.opacity > 0) {
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

    // Restore screen pulse transform
    if (this.screenPulse > 0) {
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
    ctx.fillText('Keys: D F J K', 28, 114);

    ctx.restore();
  }
}
