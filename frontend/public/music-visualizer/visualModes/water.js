export class ResonanceWaterMode {
  constructor() {
    this.ripples = [];
  }

  render(ctx, data, t, width, height, theme, sensitivity) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 16, 0.28)';
    ctx.fillRect(0, 0, width, height);

    if (data.beat) {
      this.ripples.push({
        x: width * 0.5,
        y: height * 0.55,
        r: 8,
        life: 1,
        power: Math.max(0.5, data.amplitude * sensitivity.amp)
      });
    }

    this.ripples.forEach((r) => {
      r.r += (4 + data.amplitude * 12) * sensitivity.motion;
      r.life -= 0.012;
    });
    this.ripples = this.ripples.filter((r) => r.life > 0);

    for (let y = 0; y < height; y += 8) {
      const wave = Math.sin(y * 0.06 + t * 1.2) * (4 + data.treble * 12);
      const alpha = 0.04 + data.treble * 0.08;
      ctx.strokeStyle = `rgba(120,220,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      ctx.lineTo(width, y - wave);
      ctx.stroke();
    }

    this.ripples.forEach((r) => {
      ctx.strokeStyle = `${theme.accent}${Math.round(r.life * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.lineWidth = 1.5 + r.power * 6;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (1 + r.power), 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  }
}
