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
  analysisUrl?: string;
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

export type AudioFeatures = {
  tempo: number;
  tempoNorm: number;
  volume: number;
  brightness: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  dominantNote?: string;
  beatTimes?: number[];
};

export type RhythmDifficulty = 'Easy' | 'Medium' | 'Hard';

export type RhythmNoteType = 'tap' | 'accent' | 'hold';

export type RhythmNote = {
  timestamp: number;
  lane: 0 | 1 | 2 | 3;
  type: RhythmNoteType;
  duration?: number;
  expectedIntensity: number;
};

export type RhythmBeatmap = {
  tempo: number;
  difficulty: RhythmDifficulty;
  notes: RhythmNote[];
};

export type HitJudgement = 'perfect' | 'good' | 'miss';

export type HitRecord = {
  noteIndex: number;
  lane: number;
  offsetMs: number | null;
  judgement: HitJudgement;
  atTime: number;
};

export type GameStats = {
  totalNotes: number;
  perfect: number;
  good: number;
  miss: number;
  score: number;
  accuracy: number;
  maxCombo: number;
  avgOffsetMs: number;
};
