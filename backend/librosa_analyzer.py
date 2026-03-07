#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import librosa
import numpy as np


MOOD_TO_STYLE = {
    "calm": {"palette": ["#0f2246", "#1b5864", "#3caea3"], "animationStyle": "smooth_waves", "motionSpeed": 0.8},
    "energetic": {
        "palette": ["#3a0f0f", "#ff6b00", "#ffd400"],
        "animationStyle": "sharp_particles",
        "motionSpeed": 1.5,
    },
    "sad": {"palette": ["#15173a", "#2f3d7a", "#7366bf"], "animationStyle": "pulses", "motionSpeed": 0.65},
    "happy": {"palette": ["#2a4f0e", "#88d317", "#ffe357"], "animationStyle": "pulses", "motionSpeed": 1.15},
}


def clamp01(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def choose_mood(energy: float, tempo: float, brightness: float) -> str:
    if energy > 0.6 or tempo > 135:
        return "energetic"
    if energy < 0.24 and tempo < 95:
        return "sad" if brightness < 0.35 else "calm"
    if brightness > 0.58 and energy > 0.35:
        return "happy"
    return "calm"


def make_sections(y: np.ndarray, sr: int, num_sections: int = 4):
    if len(y) == 0:
        return []

    total_duration = len(y) / sr
    boundaries = np.linspace(0, total_duration, num_sections + 1)
    sections = []

    for i in range(num_sections):
        start = float(boundaries[i])
        end = float(boundaries[i + 1])

        start_sample = int(start * sr)
        end_sample = int(end * sr)
        seg = y[start_sample:end_sample]
        if len(seg) == 0:
            continue

        seg_rms = float(np.mean(librosa.feature.rms(y=seg)[0]))
        seg_centroid = float(np.mean(librosa.feature.spectral_centroid(y=seg, sr=sr)[0]))
        seg_energy = clamp01(seg_rms / 0.35)
        seg_brightness = clamp01(seg_centroid / (sr / 2.0))
        local_mood = choose_mood(seg_energy, 0.0, seg_brightness)

        sections.append(
            {
                "start": round(start, 2),
                "end": round(end, 2),
                "localMood": local_mood,
            }
        )

    return sections


def analyze(audio_path: Path):
    y, sr = librosa.load(str(audio_path), sr=None, mono=True)

    rms = librosa.feature.rms(y=y)[0]
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)

    stft = np.abs(librosa.stft(y=y, n_fft=2048, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)

    low_mask = freqs < 250
    mid_mask = (freqs >= 250) & (freqs < 2000)
    high_mask = freqs >= 2000

    low_energy = float(np.mean(stft[low_mask])) if np.any(low_mask) else 0.0
    mid_energy = float(np.mean(stft[mid_mask])) if np.any(mid_mask) else 0.0
    high_energy = float(np.mean(stft[high_mask])) if np.any(high_mask) else 0.0
    total_energy = max(low_energy + mid_energy + high_energy, 1e-8)

    low_norm = clamp01(low_energy / total_energy * 3)
    mid_norm = clamp01(mid_energy / total_energy * 3)
    high_norm = clamp01(high_energy / total_energy * 3)

    rms_mean = float(np.mean(rms)) if rms.size else 0.0
    volume = clamp01(rms_mean / 0.35)
    brightness = clamp01(float(np.mean(centroid)) / (sr / 2.0)) if centroid.size else 0.0
    tempo_norm = clamp01(float(tempo) / 180.0)

    chroma_mean = np.mean(chroma, axis=1) if chroma.size else np.zeros(12)
    note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    dominant_note = note_names[int(np.argmax(chroma_mean))] if chroma_mean.size else "C"

    mood = choose_mood(volume, float(tempo), brightness)
    style = MOOD_TO_STYLE[mood]

    explanation = (
        f"Librosa detected tempo {float(tempo):.1f} BPM, energy {volume:.2f}, "
        f"brightness {brightness:.2f}; mapped to {mood}."
    )

    return {
        "analysis": {
            "mood": mood,
            "palette": style["palette"],
            "animationStyle": style["animationStyle"],
            "motionSpeed": style["motionSpeed"],
            "explanation": explanation,
            "sections": make_sections(y, sr),
        },
        "audioFeatures": {
            "tempo": float(round(float(tempo), 2)),
            "tempoNorm": float(round(tempo_norm, 4)),
            "volume": float(round(volume, 4)),
            "brightness": float(round(brightness, 4)),
            "lowEnergy": float(round(low_norm, 4)),
            "midEnergy": float(round(mid_norm, 4)),
            "highEnergy": float(round(high_norm, 4)),
            "dominantNote": dominant_note,
            "beatTimes": [float(round(x, 3)) for x in beat_times[:32]],
        },
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: librosa_analyzer.py <audio_path>"}))
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    if not audio_path.exists():
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)

    try:
        result = analyze(audio_path)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
