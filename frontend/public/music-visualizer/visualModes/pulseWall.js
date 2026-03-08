/**
 * RHYTHM PULSE WALL MODE
 * 
 * ACCESSIBILITY NOTES:
 * - Vertical bars show frequency spectrum across the audio range
 * - Left side: Bass frequencies (low pitch) - Red colors
 * - Right side: Treble frequencies (high pitch) - Purple/Blue colors
 * - Bar height changes: Shows volume at each frequency
 * - Pulse upward on beat: Clear visual beat indicator for hearing-impaired users
 * - Color coding helps distinguish different frequency ranges without hearing
 */

export class RhythmPulseWallMode {
  render(ctx, data, t, width, height, theme) {
    const bars = 72;
    const gap = 4;
    const barW = width / bars;

    ctx.save();
    ctx.fillStyle = 'rgba(5,8,18,0.28)';
    ctx.fillRect(0, 0, width, height);

    // PERFORMANCE: Set expensive shadow state once per frame instead of per bar.
    const glow = 14 + data.amplitude * 22;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = glow;

    for (let i = 0; i < bars; i++) {
      const x = i * barW;
      const norm = i / (bars - 1);
      const curved = Math.pow(norm, 1.85); // log-like mapping, emphasizes right-side detail
      const specIndex = Math.floor(curved * (data.spectrum.length - 1));
      const rawSpec = (data.spectrum[specIndex] || 0) / 255;
      const sideWeight = 0.65 + norm * 0.85;
      const animFloor = 0.03 + (Math.sin(t * 3.8 + i * 0.43) + 1) * 0.04;
      const spec = Math.min(1, rawSpec * sideWeight + animFloor);

      // ACCESSIBILITY: Beat causes visible upward pulse
      // Makes rhythm visible for hearing-impaired users
      const pulse = data.beat ? data.beatIntensity * 0.85 : 0;
      const h = Math.max(10, (spec * 0.95 + data.amplitude * 0.42) * height * 0.9);
      const y = height - h;
      const push = pulse * 22;

      // ACCESSIBILITY: Color coding by frequency
      // Low frequency (bass) = red/orange, High frequency (treble) = blue/purple
      // Helps hearing-impaired users distinguish frequency ranges visually
      const hue = 270 - spec * 240;

      ctx.fillStyle = `hsla(${hue}, 92%, ${50 + spec * 25}%, ${0.24 + data.amplitude * 0.65})`;
      ctx.fillRect(x + gap / 2, y - push, barW - gap, h + push);
    }

    ctx.restore();
  }
}
