import { useEffect, useMemo, useState } from 'react';
import AudioUploader from './components/AudioUploader';
import GameResults from './components/GameResults';
import PlayerControls from './components/PlayerControls';
import RhythmGame from './components/RhythmGame';
import VisualizerCanvas from './components/VisualizerCanvas';
import { useAudioAnalyzer } from './hooks/seAudioAnalyzer';
import {
  AnalysisResult,
  AudioFeatures,
  GameStats,
  HitRecord,
  RhythmBeatmap,
  RhythmDifficulty,
  TrackSource,
  VisualMode
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

const EMPTY_STATS: GameStats = {
  totalNotes: 0,
  perfect: 0,
  good: 0,
  miss: 0,
  score: 0,
  accuracy: 0,
  maxCombo: 0,
  avgOffsetMs: 0
};

export default function App() {
  const [track, setTrack] = useState<TrackSource | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
  const [beatmap, setBeatmap] = useState<RhythmBeatmap | null>(null);
  const [rhythmDifficulty, setRhythmDifficulty] = useState<RhythmDifficulty>('Medium');
  const [visualMode, setVisualMode] = useState<VisualMode>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [gameStats, setGameStats] = useState<GameStats>(EMPTY_STATS);
  const [hitRecords, setHitRecords] = useState<HitRecord[]>([]);

  const analyzer = useAudioAnalyzer(track?.url ?? null);

  const trackLabel = useMemo(() => (track ? `${track.name} (${track.sourceType})` : null), [track]);

  const fallbackBeatmapFromFeatures = useMemo(() => {
    return (features: AudioFeatures | null): RhythmBeatmap | null => {
      const beatTimes = features?.beatTimes;
      if (!beatTimes?.length) {
        return null;
      }

      return {
        tempo: features?.tempo ?? 120,
        difficulty: rhythmDifficulty,
        notes: beatTimes.slice(0, 140).map((timestamp, idx) => ({
          timestamp,
          lane: (idx % (rhythmDifficulty === 'Easy' ? 2 : rhythmDifficulty === 'Medium' ? 3 : 4)) as 0 | 1 | 2 | 3,
          type: idx % 4 === 0 ? 'accent' : 'tap',
          duration: 0,
          expectedIntensity: idx % 4 === 0 ? 0.8 : 0.55
        }))
      };
    };
  }, [rhythmDifficulty]);

  useEffect(() => {
    return () => {
      if (track?.sourceType === 'upload' && track.url.startsWith('blob:')) {
        URL.revokeObjectURL(track.url);
      }
    };
  }, [track]);

  const onTrackSelected = (nextTrack: TrackSource) => {
    if (track?.sourceType === 'upload' && track.url.startsWith('blob:')) {
      URL.revokeObjectURL(track.url);
    }
    analyzer.pause();
    if (nextTrack.sourceType === 'preset' && nextTrack.analysisUrl) {
      const proxyUrl = `${API_BASE_URL}/proxy-audio?url=${encodeURIComponent(nextTrack.analysisUrl)}`;
      setTrack({
        ...nextTrack,
        url: proxyUrl
      });
    } else {
      setTrack(nextTrack);
    }
    setAnalysis(null);
    setAudioFeatures(null);
    setBeatmap(null);
    setGameStats(EMPTY_STATS);
    setHitRecords([]);
    setError('');
  };

  const analyzeSong = async () => {
    if (!track) {
      return;
    }
    setError('');
    setIsAnalyzing(true);

    try {
      let response: Response;

      if (track.file) {
        const formData = new FormData();
        formData.append('audio', track.file);
        response = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          body: formData
        });
      } else {
        response = await fetch(`${API_BASE_URL}/analyze-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: track.analysisUrl ?? track.url,
            name: track.name
          })
        });
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Backend analyze request failed: ${detail}`);
      }

      const payload = (await response.json()) as { analysis: AnalysisResult; audioFeatures?: AudioFeatures | null };
      setAnalysis(payload.analysis);
      const nextAudioFeatures = payload.audioFeatures ?? null;
      setAudioFeatures(nextAudioFeatures);

      if (track.file) {
        const beatmapFormData = new FormData();
        beatmapFormData.append('audio', track.file);
        beatmapFormData.append('difficulty', rhythmDifficulty.toLowerCase());

        const beatmapResp = await fetch(`${API_BASE_URL}/generate-beatmap`, {
          method: 'POST',
          body: beatmapFormData
        });

        if (!beatmapResp.ok) {
          const detail = await beatmapResp.text();
          throw new Error(`Backend beatmap request failed: ${detail}`);
        }

        const beatmapPayload = (await beatmapResp.json()) as {
          beatmap?: {
            difficulty?: 'easy' | 'medium' | 'hard';
            beats?: Array<{ timestamp: number; type: 'normal' | 'accent'; expectedIntensity: number }>;
          };
        };

        const beats = beatmapPayload.beatmap?.beats ?? [];
        const lanes = rhythmDifficulty === 'Easy' ? 2 : rhythmDifficulty === 'Medium' ? 3 : 4;
        const mapped: RhythmBeatmap = {
          tempo: nextAudioFeatures?.tempo ?? 120,
          difficulty: rhythmDifficulty,
          notes: beats.map((beat, idx) => ({
            timestamp: beat.timestamp,
            lane: (idx % lanes) as 0 | 1 | 2 | 3,
            type: beat.type === 'accent' ? 'accent' : 'tap',
            duration: 0,
            expectedIntensity: beat.expectedIntensity
          }))
        };
        setBeatmap(mapped);
      } else {
        setBeatmap(fallbackBeatmapFromFeatures(nextAudioFeatures));
      }

      setVisualMode('auto');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown analysis error.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="panel">
        <AudioUploader onTrackSelected={onTrackSelected} />
        <PlayerControls
          selectedTrackName={trackLabel}
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          isPlaying={analyzer.isPlaying}
          visualMode={visualMode}
          rhythmDifficulty={rhythmDifficulty}
          onAnalyze={analyzeSong}
          onPlayPause={analyzer.toggle}
          onVisualModeChange={setVisualMode}
          onRhythmDifficultyChange={setRhythmDifficulty}
        />
        {error && <p className="error">{error}</p>}
        {analyzer.playbackError && <p className="error">{analyzer.playbackError}</p>}
        <p className="small">Playback status: {analyzer.playbackStatus}</p>
        <RhythmGame
          beatmap={beatmap}
          currentTime={analyzer.currentTime}
          isPlaying={analyzer.isPlaying}
          onStatsChange={setGameStats}
          onHitsChange={setHitRecords}
        />
        <GameResults stats={gameStats} recentHits={hitRecords} />
      </aside>

      <main className="canvas-wrap">
        <VisualizerCanvas
          analysis={analysis}
          visualMode={visualMode}
          features={analyzer.features}
          audioFeatures={audioFeatures}
        />
      </main>
    </div>
  );
}