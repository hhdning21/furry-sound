export type Mood = 'calm' | 'energetic' | 'sad' | 'happy';

export type AnimationStyle = 'pulses' | 'smooth_waves' | 'sharp_particles';

export type Section = {
  start: number;
  end: number;
  localMood: Mood;
};

export type AnalysisResult = {
  mood: Mood;
  palette: string[];
  animationStyle: AnimationStyle;
  motionSpeed: number;
  explanation: string;
  sections?: Section[];
};

export type TrackSource = {
  name: string;
  url: string;
  file: File | null;
  sourceType: 'upload' | 'preset';
};

export type VisualMode = 'auto' | Mood;

export type RealtimeFeatures = {
  low: number;
  mid: number;
  high: number;
  volume: number;
  beat: number;
};
// frontend/src/types.ts
