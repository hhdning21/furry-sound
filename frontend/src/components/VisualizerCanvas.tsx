import { useEffect, useMemo, useRef } from 'react';
import { AnalysisResult, AudioFeatures, Mood, RealtimeFeatures, VisualMode } from '../types';

type Props = {
  analysis: AnalysisResult | null;
  visualMode: VisualMode;
  features: RealtimeFeatures;
  audioFeatures: AudioFeatures | null;
};

type ThemeConfig = {
  mood: Mood;
  palette: string[];
  speed: number;
  particleFactor: number;
  smoothness: number;
};

type Circle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  alpha: number;
};

type Blob = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  points: number;
  seed: number;
  wobble: number;
};

type FrameInput = {
  time: number;
  rms: number;
  tempo: number;
  spectral: number;
  emotion: string;
  beatFrame: boolean;
};

const fallbackPalettes: Record<Mood, string[]> = {
  calm: ['#0f2246', '#1b5864', '#3caea3'],
  energetic: ['#3a0f0f', '#ff6b00', '#ffd400'],
  sad: ['#15173a', '#2f3d7a', '#7366bf'],
  happy: ['#2a4f0e', '#88d317', '#ffe357']
};

function resolveTheme(analysis: AnalysisResult | null, visualMode: VisualMode): ThemeConfig {
  const mood = visualMode === 'auto' ? analysis?.mood ?? 'calm' : visualMode;
  const palette = analysis?.palette?.length ? analysis.palette : fallbackPalettes[mood];
  const speed = (analysis?.motionSpeed ?? 1) * (mood === 'calm' ? 0.7 : mood === 'energetic' ? 1.35 : 1);
  const particleFactor = mood === 'energetic' ? 1.35 : mood === 'sad' ? 0.7 : 1;
  const smoothness = mood === 'sad' ? 0.95 : mood === 'energetic' ? 0.68 : 0.82;

  return { mood, palette, speed, particleFactor, smoothness };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) => {
    const v = Math.round((value + m) * 255);
    return v.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function complementaryPaletteByEmotion(emotion: string): string[] {
  const map: Record<string, number> = {
    快乐: 45,
    兴奋: 12,
    平静: 195,
    忧郁: 250,
    sad: 250,
    happy: 45,
    energetic: 12,
    calm: 195
  };
  const baseHue = map[emotion] ?? 210;
  const comp = (baseHue + 180) % 360;
  return [hslToHex(baseHue, 0.85, 0.54), hslToHex(comp, 0.82, 0.5)];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3
    ? normalized
        .split('')
        .map((c) => c + c)
        .join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  return rgbToHex(ar.r + (br.r - ar.r) * t, ar.g + (br.g - ar.g) * t, ar.b + (br.b - ar.b) * t);
}

function mapMoodToEmotion(mood?: Mood): string {
  if (mood === 'happy') return '快乐';
  if (mood === 'energetic') return '兴奋';
  if (mood === 'sad') return '忧郁';
  return '平静';
}

function createCircles(count: number, width: number, height: number): Circle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    baseRadius: 3 + Math.random() * 14,
    alpha: 0.2 + Math.random() * 0.5
  }));
}

function createSpacedBlobs(width: number, height: number, count: number): Blob[] {
  const blobs: Blob[] = [];
  const minDistance = Math.min(width, height) * 0.16;
  let attempts = 0;
  while (blobs.length < count && attempts < 2200) {
    attempts += 1;
    const candidateX = width * 0.1 + Math.random() * width * 0.8;
    const candidateY = height * 0.1 + Math.random() * height * 0.8;
    const ok = blobs.every((b) => Math.hypot(b.x - candidateX, b.y - candidateY) >= minDistance);
    if (!ok) continue;

    blobs.push({
      x: candidateX,
      y: candidateY,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      baseSize: 26 + Math.random() * 48,
      points: 5 + Math.floor(Math.random() * 4),
      seed: Math.random() * Math.PI * 2,
      wobble: 0.25 + Math.random() * 0.5
    });
  }
  return blobs;
}

export default function VisualizerCanvas({ analysis, visualMode, features, audioFeatures }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const circlesRef = useRef<Circle[]>([]);
  const blobsRef = useRef<Blob[]>([]);
  const emaRef = useRef({ rms: 0, spectral: 0 });
  const reactiveRef = useRef({ rms: 0, spectral: 0 });
  const beatPulseRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const prevBeatRef = useRef(false);
  const beatIndexRef = useRef(0);
  const beatVolumeEmaRef = useRef(0.4);
  const bgPaletteRef = useRef<[string, string]>(['#1f2a44', '#101625']);

  const theme = useMemo(() => resolveTheme(analysis, visualMode), [analysis, visualMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let raf = 0;

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        circlesRef.current = createCircles(55, width, height);
        blobsRef.current = createSpacedBlobs(width, height, 10);
      }

      if (!circlesRef.current.length) circlesRef.current = createCircles(55, width, height);
      if (!blobsRef.current.length) blobsRef.current = createSpacedBlobs(width, height, 10);

      const frameInput: FrameInput = {
        time: time / 1000,
        rms: features.volume,
        tempo: audioFeatures?.tempo ?? 110,
        spectral: 250 + (features.high * 0.6 + features.mid * 0.25 + features.low * 0.15) * 5600,
        emotion: mapMoodToEmotion(analysis?.mood),
        beatFrame: features.beat > 0.45
      };

      const frameDelta = lastFrameTimeRef.current ? Math.min(0.05, frameInput.time - lastFrameTimeRef.current) : 1 / 60;
      lastFrameTimeRef.current = frameInput.time;

      const alpha = 0.28;
      emaRef.current.rms += alpha * (frameInput.rms - emaRef.current.rms);
      emaRef.current.spectral += alpha * (frameInput.spectral - emaRef.current.spectral);

      const gateThresholdRms = 0.02;
      const gateThresholdSpectral = 90;
      if (Math.abs(frameInput.rms - reactiveRef.current.rms) > gateThresholdRms) {
        reactiveRef.current.rms += 0.42 * (emaRef.current.rms - reactiveRef.current.rms);
      } else {
        reactiveRef.current.rms += 0.08 * (emaRef.current.rms - reactiveRef.current.rms);
      }
      if (Math.abs(frameInput.spectral - reactiveRef.current.spectral) > gateThresholdSpectral) {
        reactiveRef.current.spectral += 0.34 * (emaRef.current.spectral - reactiveRef.current.spectral);
      } else {
        reactiveRef.current.spectral += 0.06 * (emaRef.current.spectral - reactiveRef.current.spectral);
      }

      const reactiveRms = Math.max(0, Math.min(1, reactiveRef.current.rms));
      const reactiveSpectral = Math.max(120, Math.min(6200, reactiveRef.current.spectral));
      const spectralNorm = Math.max(0, Math.min(1, (reactiveSpectral - 120) / 6080));
      const energy = 0.6 * reactiveRms + 0.4 * spectralNorm;

      const emotionPalette = complementaryPaletteByEmotion(frameInput.emotion);
      bgPaletteRef.current = [
        lerpHex(bgPaletteRef.current[0], emotionPalette[0], 0.04),
        lerpHex(bgPaletteRef.current[1], emotionPalette[1], 0.04)
      ];
      const [c1, c2] = bgPaletteRef.current;

      const beatInterval = 60 / Math.max(60, Math.min(190, frameInput.tempo));
      const beatRising = frameInput.beatFrame && !prevBeatRef.current;
      prevBeatRef.current = frameInput.beatFrame;
      if (beatRising) {
        beatIndexRef.current += 1;
        const isStrongBeat = beatIndexRef.current % 4 === 1; // 4/4: 1 is strong beat

        beatVolumeEmaRef.current += 0.25 * (frameInput.rms - beatVolumeEmaRef.current);
        const relativeVolume = frameInput.rms / Math.max(0.18, beatVolumeEmaRef.current);
        const volumeAccent = Math.max(0.7, Math.min(1.45, relativeVolume));
        const strongWeakAccent = isStrongBeat ? 1.25 : 0.82;
        const beatAccent = strongWeakAccent * volumeAccent;

        beatPulseRef.current = Math.max(0.22, Math.min(1.85, beatAccent));
      }

      const decay = Math.exp(-frameDelta / Math.max(0.12, beatInterval * 0.62));
      beatPulseRef.current *= decay;
      const phase = (frameInput.time % beatInterval) / beatInterval;
      const metronomePulse = Math.exp(-phase * 8);
      const beatBreath = Math.max(beatPulseRef.current, metronomePulse * 0.42);
      const breath = 0.18 + beatBreath * 0.82;
      const beatFlash = beatRising ? 0.16 : beatBreath * 0.04;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, c1);
      gradient.addColorStop(1, c2);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.24 + energy * 0.35 + beatFlash;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      const blobs = blobsRef.current;
      const blobRepulsion = 0.014 + energy * 0.028;
      const blobDamping = 0.99;
      const blobMaxSpeed = 1.05 + energy * 1.05;
      const blobPadding = 60;

      for (let i = 0; i < blobs.length; i += 1) {
        const a = blobs[i];
        for (let j = i + 1; j < blobs.length; j += 1) {
          const b = blobs[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const minDist = (a.baseSize + b.baseSize) * 1.25;
          if (d < minDist) {
            const force = (minDist - d) * blobRepulsion;
            const ux = dx / d;
            const uy = dy / d;
            a.vx -= ux * force;
            a.vy -= uy * force;
            b.vx += ux * force;
            b.vy += uy * force;
          }
        }
      }

      for (let i = 0; i < blobs.length; i += 1) {
        const b = blobs[i];
        const v = Math.hypot(b.vx, b.vy);
        if (v > blobMaxSpeed) {
          b.vx = (b.vx / v) * blobMaxSpeed;
          b.vy = (b.vy / v) * blobMaxSpeed;
        }
        b.vx *= blobDamping;
        b.vy *= blobDamping;
        b.x += b.vx * Math.max(0.55, theme.speed * 0.72);
        b.y += b.vy * Math.max(0.55, theme.speed * 0.72);

        if (b.x < blobPadding || b.x > width - blobPadding) {
          b.vx *= -1;
          b.x = Math.max(blobPadding, Math.min(width - blobPadding, b.x));
        }
        if (b.y < blobPadding || b.y > height - blobPadding) {
          b.vy *= -1;
          b.y = Math.max(blobPadding, Math.min(height - blobPadding, b.y));
        }
      }

      for (let i = 0; i < blobs.length; i += 1) {
        const b = blobs[i];
        const phase = frameInput.time * (0.2 + b.wobble + (frameInput.tempo / 220) * 0.22) + b.seed;
        const sizeScale = 0.72 + breath * 0.95 + reactiveRms * 0.22 + Math.sin(phase) * 0.04;

        ctx.beginPath();
        for (let p = 0; p <= b.points; p += 1) {
          const a = (Math.PI * 2 * p) / b.points;
          const jitter = 1 + Math.sin(phase + p * 0.9) * (0.08 + spectralNorm * 0.18);
          const r = b.baseSize * sizeScale * jitter;
          const x = b.x + Math.cos(a) * r;
          const y = b.y + Math.sin(a) * r;
          if (p === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `${emotionPalette[i % 2]}66`;
        ctx.fill();
      }

      const circles = circlesRef.current;
      const speedMul = (0.38 + reactiveRms * 1.75 + spectralNorm * 0.45) * theme.speed;
      for (let i = 0; i < circles.length; i += 1) {
        const c = circles[i];
        c.x += c.vx * speedMul;
        c.y += c.vy * speedMul;
        if (c.x < 0 || c.x > width) c.vx *= -1;
        if (c.y < 0 || c.y > height) c.vy *= -1;

        const radius = c.baseRadius * (0.64 + reactiveRms * 1.1 + breath * 0.28);
        const alphaCircle = Math.min(0.95, c.alpha + reactiveRms * 0.35);
        ctx.fillStyle = `${emotionPalette[i % 2]}${Math.round(alphaCircle * 255)
          .toString(16)
          .padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const maxDist = 66 + energy * 110 * theme.particleFactor;
      const connectionBoost = analysis?.animationStyle === 'sharp_particles' ? 1.4 : 1;
      for (let i = 0; i < circles.length; i += 1) {
        for (let j = i + 1; j < circles.length; j += 1) {
          const a = circles[i];
          const b = circles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > maxDist) continue;

          const t = 1 - d / maxDist;
          const widthLine = (0.4 + t * 2.4 * energy) * connectionBoost;
          const alphaLine = Math.min(0.5, t * (0.05 + energy * 0.55));
          ctx.strokeStyle = `rgba(255,255,255,${alphaLine})`;
          ctx.lineWidth = widthLine;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analysis, audioFeatures, features.beat, features.high, features.low, features.mid, features.volume, theme]);

  return <canvas ref={canvasRef} />;
}
