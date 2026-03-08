export class SoundLandscapeMode {
  constructor() {
    this.terrain = [];
  }

  ensureTerrain(width, points = 96) {
    if (this.terrain.length === points) return;
    this.terrain = Array.from({ length: points }, (_, i) => ({
      x: (i / (points - 1)) * width,
      base: Math.random() * 0.7 + 0.2,
      noise: Math.random() * Math.PI * 2
    }));
  }

  render(ctx, data, t, width, height, theme) {
    this.ensureTerrain(width);
    const horizon = height * 0.62;

    ctx.save();
    ctx.fillStyle = 'rgba(5,8,16,0.35)';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, horizon, 0, height);
    grad.addColorStop(0, `${theme.primary}44`);
    grad.addColorStop(1, `${theme.secondary}14`);

    ctx.beginPath();
    this.terrain.forEach((p, i) => {
      const raise = data.bass * 180;
      const y =
        horizon +
        Math.sin(p.noise + t * 0.8 + i * 0.3) * 18 +
        (1 - p.base) * 120 -
        raise * p.base;
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const melodyY = height * 0.43 - (data.pitch > 0 ? Math.min(1, data.pitch / 1200) * height * 0.25 : 0);
    ctx.strokeStyle = `${theme.accent}bb`;
    ctx.lineWidth = 2 + data.beatIntensity * 5;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const y = melodyY + Math.sin(x * 0.01 + t * 2.1) * (20 + data.mid * 55);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (data.beat) {
      ctx.strokeStyle = `${theme.primary}99`;
      ctx.lineWidth = 2 + data.beatIntensity * 4;
      ctx.beginPath();
      ctx.ellipse(width * 0.5, horizon, 80 + data.beatIntensity * 200, 20 + data.beatIntensity * 40, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
