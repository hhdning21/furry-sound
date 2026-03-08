/**
 * PARTICLE STORM MODE
 * 
 * ACCESSIBILITY NOTES:
 * - Particles expand outward on beats to show rhythm visually
 * - Treble frequency creates brightness flashes for texture awareness
 * - Mid-frequency causes rotation for movement awareness
 * - Clear visual feedback for hearing-impaired users through motion patterns
 */

export class ParticleStormMode {
  constructor() {
    this.particles = [];
    this.initialized = false;
    this.lastWidth = 0;
    this.lastHeight = 0;
  }

  _init(width, height) {
    // PERFORMANCE: Scale particle count by screen area and cap it to avoid CPU spikes.
    const targetCount = Math.min(3200, Math.max(1400, Math.floor((width * height) / 650)));
    if (this.initialized && this.lastWidth === width && this.lastHeight === height && this.particles.length === targetCount) {
      return;
    }

    this.particles = Array.from({ length: targetCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      size: Math.random() * 1.8 + 0.2
    }));
    this.initialized = true;
    this.lastWidth = width;
    this.lastHeight = height;
  }

  render(ctx, data, t, width, height, theme, sensitivity) {
    this._init(width, height);

    // ACCESSIBILITY: Beat detection causes visible particle explosion
    // Helps hearing-impaired users see when beats occur
    if (data.beat) {
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (i % 7 !== 0) continue;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const boost = data.bass * 2.5 * sensitivity.beat;
        p.vx += (dx / d) * boost;
        p.vy += (dy / d) * boost;
      }
    }

    const rot = (data.mid * 0.04 + 0.003) * sensitivity.motion;
    const sin = Math.sin(rot);
    const cos = Math.cos(rot);

    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,0.3)';
    ctx.fillRect(0, 0, width, height);

    // PERFORMANCE: Compute flash color once per frame (same for all particles).
    const flash = data.treble * 0.9;
    const alpha = 0.1 + flash * 0.7;
    const extraSize = flash * 1.5;
    ctx.fillStyle = `rgba(178, 228, 255, ${alpha})`;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      const vx = p.vx * cos - p.vy * sin;
      const vy = p.vx * sin + p.vy * cos;
      p.vx = vx * 0.992;
      p.vy = vy * 0.992;

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x += width;
      if (p.x > width) p.x -= width;
      if (p.y < 0) p.y += height;
      if (p.y > height) p.y -= height;

      // ACCESSIBILITY: Treble frequency controls brightness
      // Brighter particles = higher frequencies, helping visualize sound texture
      ctx.fillRect(p.x, p.y, p.size + extraSize, p.size + extraSize);
    }

    ctx.restore();
  }
}
