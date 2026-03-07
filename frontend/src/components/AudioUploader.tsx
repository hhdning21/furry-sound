import { ChangeEvent } from 'react';
import { TrackSource } from '../types';

type Props = {
  onTrackSelected: (track: TrackSource) => void;
};

const presets = [
  {
    name: 'Preset A · SoundHelix 1',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    name: 'Preset B · SoundHelix 2',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    name: 'Preset C · SoundHelix 3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  }
];

export default function AudioUploader({ onTrackSelected }: Props) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isAudio = file.type.includes('audio') || /\.(mp3|wav)$/i.test(file.name);
    if (!isAudio) {
      alert('Please upload an MP3 or WAV file.');
      return;
    }

    const url = URL.createObjectURL(file);
    onTrackSelected({
      name: file.name,
      url,
      file,
      sourceType: 'upload'
    });
  };

  const handlePreset = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = presets.find((preset) => preset.url === event.target.value);
    if (!selected) {
      return;
    }

    onTrackSelected({
      name: selected.name,
      url: selected.url,
      analysisUrl: selected.url,
      file: null,
      sourceType: 'preset'
    });
  };

  return (
    <div className="card">
      <h1>1) Upload or pick a song</h1>
      <input type="file" accept="audio/mp3,audio/wav,audio/*" onChange={handleUpload} />

      <select defaultValue="" onChange={handlePreset}>
        <option value="" disabled>
          Select a preset track
        </option>
        {presets.map((preset) => (
          <option key={preset.url} value={preset.url}>
            {preset.name}
          </option>
        ))}
      </select>
      <p className="small">Recommended length: 30–60 seconds for hackathon demo speed.</p>
    </div>
  );
}
