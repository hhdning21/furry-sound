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

export default function VisualizerCanvas({ analysis, visualMode, features, audioFeatures }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      }

      const tempoBoost = 0.8 + (audioFeatures?.tempoNorm ?? 0.5) * 0.5;
      const backendHigh = audioFeatures?.highEnergy ?? 0.5;
      const noteGlow = (() => {
        const note = (audioFeatures?.dominantNote ?? 'C').replace('#', '');
        return (note.charCodeAt(0) % 7) / 10;
      })();

      const brightness = 0.32 + features.volume * 0.62 + (audioFeatures?.brightness ?? 0.4) * 0.25;
      const centerX = width / 2;
      const centerY = height / 2;
      const pulse = (features.low * 90 + features.beat * 30) * (theme.mood === 'energetic' ? 1.15 : 1);
      const radius = Math.min(width, height) * 0.13 + pulse;
      const phase = (time / 1000) * theme.speed * tempoBoost;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, theme.palette[0] ?? '#0a1020');
      gradient.addColorStop(0.5, theme.palette[1] ?? '#202b48');
      gradient.addColorStop(1, theme.palette[2] ?? '#334a8a');
      ctx.fillStyle = gradient;
      ctx.globalAlpha = Math.max(0.2, Math.min(1, brightness));
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const amp = 14 + features.mid * 30;
        const y = centerY + Math.sin(x * 0.015 + phase) * amp;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.beginPath();
      const points = 72;
      for (let i = 0; i <= points; i += 1) {
        const angle = (Math.PI * 2 * i) / points;
        const noise = Math.sin(angle * 3 + phase) * features.high * 50 * (1 - theme.smoothness + 0.2);
        const r = radius + noise;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.92, 0.18 + features.volume * 0.55 + noteGlow * 0.2)})`;
      ctx.fill();

      const particles = Math.floor((12 + (features.high * 0.65 + backendHigh * 0.35) * 130) * theme.particleFactor);
      for (let i = 0; i < particles; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = radius + 18 + Math.random() * (60 + features.high * 120);
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        const size = 1 + features.high * 3;

        ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.75})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (analysis?.animationStyle === 'sharp_particles') {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * (6 + features.high * 16), y + Math.sin(angle) * (6 + features.high * 16));
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
// frontend/src/components/VisualizerCanvas.tsx
