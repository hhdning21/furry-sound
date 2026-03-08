/**
 * COSMIC CONCERT MODE
 * 
 * ACCESSIBILITY NOTES:
 * - Stars twinkle with rhythm: Shows beat timing and treble intensity
 * - Expanding rings from center: Clear beat indicators for hearing-impaired users
 * - Ring expansion speed: Shows beat strength/intensity
 * - Wavy melody line: Shows pitch/melody movement (when present)
 * - Star brightness increases on beats: Additional visual rhythm cue
 */

export class CosmicConcertMode {
  constructor() {
    this.stars = [];
    this.trails = [];
    this.ready = false;
  }

  _init(width, height) {
    if (this.ready) return;
    this.stars = Array.from({ length: 900 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 1,
      twinkle: Math.random() * Math.PI * 2
    }));
    this.ready = true;
  }

  render(ctx, data, t, width, height, theme, sensitivity) {
    this._init(width, height);

    ctx.save();
    const nebula = ctx.createRadialGradient(
      width * 0.45,
      height * 0.45,
      10,
      width * 0.45,
      height * 0.45,
      width * 0.65
    );
    nebula.addColorStop(0, `${theme.primary}22`);
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = 'rgba(3,5,13,0.35)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // ACCESSIBILITY: Stars brighten on beat and with treble
    // Provides visual rhythm and high-frequency indicators for hearing-impaired users
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const sparkle = (Math.sin(t * 2.5 + s.twinkle) + 1) * 0.5;
      const flash = data.beat ? data.beatIntensity * 0.6 : 0;
      const alpha = 0.1 + sparkle * 0.4 + flash;
      const size = 0.8 + s.z * 1.6 + data.treble * 1.2;

      ctx.fillStyle = `rgba(220, 240, 255, ${Math.min(1, alpha)})`;
      ctx.fillRect(s.x, s.y, size, size);
    }

    // ACCESSIBILITY: Beat rings expand from center
    // Clear visual indicator of rhythm timing and beat strength
    if (data.beat) {
      this.trails.push({ r: 12, life: 1, power: Math.max(0.45, data.bass * sensitivity.beat) });
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.r += 7 + tr.power * 18;
      tr.life -= 0.014;

      if (tr.life <= 0) {
        this.trails.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `${theme.accent}${Math.round(tr.life * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.lineWidth = 2 + tr.power * 4;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, tr.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ACCESSIBILITY: Melody line shows pitch movement
    // Helps hearing-impaired users see melodic contour visually
    if (data.pitch > 0) {
      const pitchNorm = Math.min(1, data.pitch / 1100);
      ctx.strokeStyle = `${theme.secondary}aa`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 14) {
        const y = cy + Math.sin(x * 0.011 + t * 2.2) * (30 + pitchNorm * 130);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
