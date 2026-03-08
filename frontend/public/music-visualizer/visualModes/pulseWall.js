export class RhythmPulseWallMode {
  render(ctx, data, t, width, height, theme, sensitivity) {
    const bars = 64;
    const gap = 4;
    const barW = width / bars;

    ctx.save();
    ctx.fillStyle = 'rgba(5,8,18,0.28)';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < bars; i++) {
      const x = i * barW;
      const specIndex = Math.floor((i / bars) * data.spectrum.length);
      const spec = (data.spectrum[specIndex] || 0) / 255;

      const pulse = data.beat ? data.beatIntensity * sensitivity.beat * 0.85 : 0;
      const h = Math.max(8, (spec * 0.9 + data.amplitude * 0.4) * height * 0.88);
      const y = height - h;
      const push = pulse * 22;

      const hue = 260 - spec * 220;
      const glow = 14 + data.amplitude * 22;

      ctx.fillStyle = `hsla(${hue}, 92%, ${50 + spec * 25}%, ${0.24 + data.amplitude * 0.65})`;
      ctx.shadowColor = theme.primary;
      ctx.shadowBlur = glow;
      ctx.fillRect(x + gap / 2, y - push, barW - gap, h + push);
    }

    ctx.restore();
  }
}
