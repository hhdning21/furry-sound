/**
 * ACCESSIBLE RHYTHM MODE
 * 
 * Designed specifically for hearing-impaired users to understand music through clear visual rhythm language.
 * 
 * VISUAL LANGUAGE MAPPING:
 * - Kick/Bass Beat → Large pulsing CIRCLE (center) - represents the heartbeat of the song
 * - Snare Hit → Sharp TRIANGLE flash (sides) - represents punctuation and rhythm accents
 * - Hi-hat/Treble → Small PARTICLES (floating) - represents texture and high-frequency details
 * - Bass Energy → Expanding WAVES (from center) - represents sustained low-frequency power
 * 
 * ACCESSIBILITY FEATURES:
 * - High contrast colors (easy to distinguish)
 * - Large, simple shapes (easy to see and understand)
 * - Consistent positioning (predictable visual locations)
 * - Clear size differentiation (importance hierarchy)
 * - Smooth animations (no jarring movements)
 */

export class AccessibleRhythmMode {
  constructor() {
    // Kick drum visualization state
    this.kickPulse = 0;
    this.kickWaves = [];
    
    // Snare drum visualization state
    this.snareFlash = { left: 0, right: 0 };
    this.snareAlternate = false;
    
    // Hi-hat/treble particles
    this.particles = [];
    
    // Bass wave rings
    this.bassWaves = [];
    
    // Accessibility mode settings
    this.accessibilityMode = false;

    // PERFORMANCE: Reuse arrays in-place and keep dynamic object counts bounded.
    this.maxParticles = 140;
    this.maxBassWaves = 28;
  }

  /**
   * Enable enhanced accessibility mode
   * - Increases shape sizes by 50%
   * - Boosts color contrast
   * - Simplifies visual complexity
   */
  enableAccessibilityMode(enabled) {
    this.accessibilityMode = enabled;
  }

  /**
   * Draw a large pulsing circle for kick/bass beats
   * HEARING-IMPAIRED BENEFIT: Shows the main rhythm/heartbeat of the music
   */
  _drawKickPulse(ctx, cx, cy, intensity, theme, scaleFactor) {
    if (this.kickPulse > 0) {
      const baseSize = 80 * scaleFactor;
      const size = baseSize + this.kickPulse * 120 * scaleFactor;
      const alpha = this.kickPulse * 0.8;
      
      // Outer glow
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      gradient.addColorStop(0, `rgba(255, 60, 60, ${alpha * 0.9})`);
      gradient.addColorStop(0.5, `rgba(255, 100, 100, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 60, 60, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner circle (always visible to show center position)
      ctx.fillStyle = `rgba(255, 80, 80, ${0.3 + alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(cx, cy, baseSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      // High contrast border in accessibility mode
      if (this.accessibilityMode) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + alpha * 0.2})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    
    this.kickPulse *= 0.88; // Smooth decay
  }

  /**
   * Draw triangular flashes for snare hits
   * HEARING-IMPAIRED BENEFIT: Shows rhythm accents and backbeat
   */
  _drawSnareFlashes(ctx, width, height, theme, scaleFactor) {
    const baseSize = 60 * scaleFactor;
    const y = height / 2;
    
    // Left triangle
    if (this.snareFlash.left > 0) {
      const x = width * 0.2;
      const size = baseSize + this.snareFlash.left * 80 * scaleFactor;
      const alpha = this.snareFlash.left * 0.85;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 6 * this.snareFlash.left);
      
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.866, size * 0.5);
      ctx.lineTo(-size * 0.866, size * 0.5);
      ctx.closePath();
      ctx.fill();
      
      // High contrast border in accessibility mode
      if (this.accessibilityMode) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    // Right triangle
    if (this.snareFlash.right > 0) {
      const x = width * 0.8;
      const size = baseSize + this.snareFlash.right * 80 * scaleFactor;
      const alpha = this.snareFlash.right * 0.85;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 6 * this.snareFlash.right);
      
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.866, size * 0.5);
      ctx.lineTo(-size * 0.866, size * 0.5);
      ctx.closePath();
      ctx.fill();
      
      // High contrast border in accessibility mode
      if (this.accessibilityMode) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    this.snareFlash.left *= 0.85;
    this.snareFlash.right *= 0.85;
  }

  /**
   * Draw floating particles for hi-hat and high frequencies
   * HEARING-IMPAIRED BENEFIT: Shows texture and rhythm details
   */
  _drawParticles(ctx, treble, theme, scaleFactor) {
    // PERFORMANCE: In-place particle compaction (avoids creating a new array every frame).
    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= 0.015;
      p.y -= p.vy;
      p.x += p.vx;

      if (p.life > 0) {
        this.particles[writeIndex++] = p;
        const size = p.size * scaleFactor;
        const alpha = p.life * 0.7;
        ctx.fillStyle = `rgba(180, 140, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.particles.length = writeIndex;
    
    // Create new particles on treble activity
    if (treble > 0.3 && Math.random() < treble * 0.5) {
      const count = this.accessibilityMode ? 2 : 4;
      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.maxParticles) break;
        this.particles.push({
          x: Math.random() * ctx.canvas.clientWidth,
          y: ctx.canvas.clientHeight * 0.8,
          vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 2,
          size: (3 + Math.random() * 4) * (this.accessibilityMode ? 1.5 : 1),
          life: 1
        });
      }
    }
  }

  /**
   * Draw expanding wave rings for sustained bass energy
   * HEARING-IMPAIRED BENEFIT: Shows low-frequency power and energy levels
   */
  _drawBassWaves(ctx, cx, cy, bass, theme, scaleFactor) {
    // Create new wave on strong bass
    if (bass > 0.5 && Math.random() < 0.1) {
      this.bassWaves.push({
        radius: 40 * scaleFactor,
        alpha: 0.8,
        speed: 3 + bass * 4
      });
      if (this.bassWaves.length > this.maxBassWaves) this.bassWaves.shift();
    }
    
    // PERFORMANCE: In-place compaction avoids per-frame filter allocations.
    let writeIndex = 0;
    for (let i = 0; i < this.bassWaves.length; i++) {
      const wave = this.bassWaves[i];
      wave.radius += wave.speed;
      wave.alpha *= 0.96;
      
      if (wave.alpha > 0.05) {
        this.bassWaves[writeIndex++] = wave;
        ctx.strokeStyle = `rgba(255, 100, 50, ${wave.alpha})`;
        ctx.lineWidth = this.accessibilityMode ? 4 : 2;
        ctx.beginPath();
        ctx.arc(cx, cy, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    this.bassWaves.length = writeIndex;
  }

  render(ctx, data, t, width, height, theme) {
    const cx = width / 2;
    const cy = height / 2;
    
    // Scale factor for accessibility mode (50% larger shapes)
    const scaleFactor = this.accessibilityMode ? 1.5 : 1;
    
    // Clear with dark background (high contrast)
    ctx.fillStyle = this.accessibilityMode ? '#000000' : '#0a0c14';
    ctx.fillRect(0, 0, width, height);
    
    // ACCESSIBILITY: Process rhythm events and map to visual symbols
    
    // Bass waves (expanding rings from center)
    this._drawBassWaves(ctx, cx, cy, data.bass, theme, scaleFactor);
    
    // Hi-hat particles (small floating elements)
    this._drawParticles(ctx, data.treble, theme, scaleFactor);
    
    // Kick pulse (large center circle) - triggered on kick detection
    if (data.kickDetected) {
      this.kickPulse = Math.max(this.kickPulse, 1);
    }
    this._drawKickPulse(ctx, cx, cy, data.beatIntensity, theme, scaleFactor);
    
    // Snare flashes (side triangles) - triggered on snare detection
    if (data.snareDetected) {
      // Alternate between left and right for visual variety
      if (this.snareAlternate) {
        this.snareFlash.left = Math.max(this.snareFlash.left, 1);
      } else {
        this.snareFlash.right = Math.max(this.snareFlash.right, 1);
      }
      this.snareAlternate = !this.snareAlternate;
    }
    this._drawSnareFlashes(ctx, width, height, theme, scaleFactor);
    
    // ACCESSIBILITY: Draw visual intensity indicator at bottom
    // Shows overall energy level as a simple bar
    const barHeight = 8 * scaleFactor;
    const barWidth = width * 0.6;
    const barX = (width - barWidth) / 2;
    const barY = height - 50;
    
    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Energy level bar (changes color based on intensity)
    const energyWidth = barWidth * data.amplitude;
    const energyColor = data.amplitude > 0.7 ? '#ff4444' : 
                        data.amplitude > 0.4 ? '#ffaa44' : '#44ff88';
    ctx.fillStyle = energyColor;
    ctx.fillRect(barX, barY, energyWidth, barHeight);
  }
}
