import { useEffect, useMemo, useState } from 'react';
import AudioUploader from './components/AudioUploader';
import PlayerControls from './components/PlayerControls';
import VisualizerCanvas from './components/VisualizerCanvas';
import { useAudioAnalyzer } from './hooks/seAudioAnalyzer';
import { AnalysisResult, TrackSource, VisualMode } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export default function App() {
  const [track, setTrack] = useState<TrackSource | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');

  const analyzer = useAudioAnalyzer(track?.url ?? null);

  const trackLabel = useMemo(() => (track ? `${track.name} (${track.sourceType})` : null), [track]);

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
    setTrack(nextTrack);
    setAnalysis(null);
    setError('');
  };

  const analyzeSong = async () => {
    if (!track) {
      return;
    }
    setError('');
    setIsAnalyzing(true);

    try {
      let file: File;
      if (track.file) {
        file = track.file;
      } else {
        const fetched = await fetch(track.url);
        if (!fetched.ok) {
          throw new Error('Failed to fetch preset audio file.');
        }
        const blob = await fetched.blob();
        file = new File([blob], `${track.name}.mp3`, { type: blob.type || 'audio/mpeg' });
      }

      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Backend analyze request failed.');
      }

      const payload = (await response.json()) as { analysis: AnalysisResult };
      setAnalysis(payload.analysis);
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
          onAnalyze={analyzeSong}
          onPlayPause={analyzer.toggle}
          onVisualModeChange={setVisualMode}
        />
        {error && <p className="error">{error}</p>}
      </aside>

      <main className="canvas-wrap">
        <VisualizerCanvas analysis={analysis} visualMode={visualMode} features={analyzer.features} />
      </main>
    </div>
  );
}