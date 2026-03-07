import { useEffect, useMemo, useState } from 'react';
import AudioUploader from './components/AudioUploader';
import PlayerControls from './components/PlayerControls';
import VisualizerCanvas from './components/VisualizerCanvas';
import { useAudioAnalyzer } from './hooks/seAudioAnalyzer';
import { AnalysisResult, AudioFeatures, TrackSource, VisualMode } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export default function App() {
  const [track, setTrack] = useState<TrackSource | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
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
      setAudioFeatures(payload.audioFeatures ?? null);
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
        {analyzer.playbackError && <p className="error">{analyzer.playbackError}</p>}
        <p className="small">Playback status: {analyzer.playbackStatus}</p>
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