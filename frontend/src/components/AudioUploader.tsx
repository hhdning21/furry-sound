import { ChangeEvent } from 'react';
import { TrackSource } from '../types';

type Props = {
  onTrackSelected: (track: TrackSource) => void;
};

const presets = [
  {
    name: 'Preset A · Chill Loop',
    url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_a4f5f9f4a6.mp3'
  },
  {
    name: 'Preset B · Energetic Beat',
    url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_f52f0c8f4f.mp3'
  },
  {
    name: 'Preset C · Sad Piano',
    url: 'https://cdn.pixabay.com/audio/2022/03/31/audio_bfcf7f8f6d.mp3'
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
import { useEffect, useRef, useState } from "react";
