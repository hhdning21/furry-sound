export class ParticleStormMode {
  constructor() {
    this.particles = [];
    this.initialized = false;
  }

  _init(width, height, count = 6000) {
    if (this.initialized) return;
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      size: Math.random() * 1.8 + 0.2
    }));
    this.initialized = true;
  }

  render(ctx, data, t, width, height, theme, sensitivity) {
    this._init(width, height);

    if (data.beat) {
      const cx = width / 2;
      const cy = height / 2;
      this.particles.forEach((p, i) => {
        if (i % 7 !== 0) return;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const boost = data.bass * 2.5 * sensitivity.beat;
        p.vx += (dx / d) * boost;
        p.vy += (dy / d) * boost;
      });
    }

    const rot = (data.mid * 0.04 + 0.003) * sensitivity.motion;
    const sin = Math.sin(rot);
    const cos = Math.cos(rot);

    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,0.3)';
    ctx.fillRect(0, 0, width, height);

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

      const flash = data.treble * 0.9;
      const alpha = 0.1 + flash * 0.7;
      ctx.fillStyle = `rgba(178, 228, 255, ${alpha})`;
      ctx.fillRect(p.x, p.y, p.size + flash * 1.5, p.size + flash * 1.5);
    }

    ctx.restore();
  }
}
