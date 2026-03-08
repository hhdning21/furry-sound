export class AudioAnalyzer {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.audioEl = null;
    this.stream = null;
    this.mediaElementNode = null;
    this.mediaStreamNode = null;
    this.inputMode = 'element';

    this.meydaAnalyzer = null;
    this.latestRaw = null;

    this.prevSpectrum = null;
    this.energyHistory = [];
    this.featureHistory = {
      volume: [],
      energy: [],
      brightness: [],
      rhythmIntensity: [],
      spectralRolloff: [],
      bass: [],
      mid: [],
      treble: [],
      beatIntensity: [],
      tempo: [],
      pitch: []
    };

    this.beatDetected = false;
    this.beatIntensity = 0;
    this.lastBeatTime = 0;
    this.beatTimes = [];
    this.tempoEstimate = 0;

    this.smooth = {
      volume: 0,
      energy: 0,
      brightness: 0,
      rhythmIntensity: 0,
      spectralRolloff: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      beatIntensity: 0,
      tempo: 0,
      pitch: 0
    };

    this.spectrumSmooth = [];
    this.chromaSmooth = new Array(12).fill(0);
    this.mfccSmooth = new Array(13).fill(0);

    this.section = 'Intro';
    this.sectionHoldUntil = 0;
  }

  async initWithMediaElement(audioEl) {
    this.audioEl = audioEl;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.88;
    }

    if (!this.mediaElementNode) {
      this.mediaElementNode = this.ctx.createMediaElementSource(audioEl);
    }

    this._connectSource(this.mediaElementNode, 'element');
  }

  _connectSource(node, mode) {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
    }
    this.sourceNode = node;
    this.inputMode = mode;
    this.sourceNode.connect(this.analyser);

    try {
      this.analyser.disconnect();
    } catch {}
    this.analyser.connect(this.ctx.destination);

    this._startMeyda();
  }

  _startMeyda() {
    const MeydaLib = window.Meyda;
    if (!MeydaLib || !this.ctx || !this.sourceNode) return;

    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
      this.meydaAnalyzer = null;
    }

    this.meydaAnalyzer = MeydaLib.createMeydaAnalyzer({
      audioContext: this.ctx,
      source: this.sourceNode,
      bufferSize: 512,
      featureExtractors: [
        'rms',
        'energy',
        'spectralCentroid',
        'spectralRolloff',
        'spectralFlatness',
        'chroma',
        'mfcc',
        'amplitudeSpectrum'
      ],
      callback: (features) => {
        this.latestRaw = features;
      }
    });

    this.meydaAnalyzer.start();
  }

  async loadFile(file) {
    const url = URL.createObjectURL(file);
    this.audioEl.src = url;
    this.disableMicrophone();
    return url;
  }

  async useMicrophone() {
    if (!this.ctx) {
      await this.initWithMediaElement(this.audioEl);
    }
    if (this.stream) {
      this.disableMicrophone();
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.mediaStreamNode = this.ctx.createMediaStreamSource(this.stream);
    this._connectSource(this.mediaStreamNode, 'mic');
  }

  disableMicrophone() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.mediaElementNode) {
      this._connectSource(this.mediaElementNode, 'element');
    }
  }

  isMicrophoneActive() {
    return this.inputMode === 'mic' && !!this.stream;
  }

  async useStream(streamUrl) {
    if (!streamUrl) throw new Error('Missing stream URL');
    this.disableMicrophone();
    this.audioEl.src = streamUrl;
    this.audioEl.crossOrigin = 'anonymous';
    await this.play();
  }

  async play() {
    if (!this.ctx) throw new Error('Audio analyzer not initialized');
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.audioEl && this.audioEl.src) {
      await this.audioEl.play();
    }
  }

  pause() {
    if (this.audioEl) this.audioEl.pause();
  }

  _movingAverage(arr, maxLen, value) {
    arr.push(value);
    if (arr.length > maxLen) arr.shift();
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _normalize(value, history, maxLen = 120) {
    history.push(value);
    if (history.length > maxLen) history.shift();

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < history.length; i++) {
      const v = history[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max - min < 1e-6) return 0;
    return (value - min) / (max - min);
  }

  _smooth(key, value, alpha = 0.2) {
    this.smooth[key] += alpha * (value - this.smooth[key]);
    return this.smooth[key];
  }

  _smoothArray(prev, next, alpha = 0.2) {
    const out = new Array(next.length);
    for (let i = 0; i < next.length; i++) {
      const p = Number(prev[i] || 0);
      const n = Number(next[i] || 0);
      out[i] = p + alpha * (n - p);
    }
    return out;
  }

  _normalizeArrayByMax(values) {
    let max = 1e-6;
    for (let i = 0; i < values.length; i++) {
      const v = Math.abs(values[i] || 0);
      if (v > max) max = v;
    }
    return values.map((v) => v / max);
  }

  _fallbackRawFromAnalyser() {
    if (!this.analyser || !this.ctx) return null;

    const freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freq);

    const spectrum = Array.from(freq);
    const avg = (from, to) => {
      let sum = 0;
      let count = 0;
      for (let i = from; i < to; i++) {
        sum += spectrum[i] || 0;
        count += 1;
      }
      return count ? sum / count : 0;
    };

    const n = spectrum.length;
    const bass = avg(0, Math.floor(n * 0.08));
    const mid = avg(Math.floor(n * 0.08), Math.floor(n * 0.35));
    const treble = avg(Math.floor(n * 0.35), n);
    const energy = (bass * 0.4 + mid * 0.35 + treble * 0.25) / 255;

    return {
      rms: energy,
      energy,
      spectralCentroid: (treble / 255) * 5000,
      spectralRolloff: (mid / 255) * 8000,
      spectralFlatness: treble / 255,
      chroma: new Array(12).fill(0),
      mfcc: new Array(13).fill(0),
      amplitudeSpectrum: spectrum
    };
  }

  _smoothSpectrum(spectrum, alpha = 0.2) {
    if (!Array.isArray(spectrum) || !spectrum.length) return [];
    if (this.spectrumSmooth.length !== spectrum.length) {
      this.spectrumSmooth = spectrum.slice();
      return this.spectrumSmooth;
    }
    for (let i = 0; i < spectrum.length; i++) {
      this.spectrumSmooth[i] += alpha * ((spectrum[i] || 0) - this.spectrumSmooth[i]);
    }
    return this.spectrumSmooth;
  }

  _estimateSpectrumBands(spectrum) {
    if (!spectrum?.length) return { bass: 0, mid: 0, treble: 0 };
    const n = spectrum.length;
    const avg = (s, e) => {
      let sum = 0;
      for (let i = s; i < e; i++) sum += spectrum[i] || 0;
      return sum / Math.max(1, e - s);
    };
    const bass = avg(0, Math.floor(n * 0.08));
    const mid = avg(Math.floor(n * 0.08), Math.floor(n * 0.35));
    const treble = avg(Math.floor(n * 0.35), n);
    return { bass, mid, treble };
  }

  _computeSpectralFlux(spectrum) {
    if (!this.prevSpectrum || !spectrum) {
      this.prevSpectrum = spectrum ? [...spectrum] : null;
      return 0;
    }
    let flux = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const diff = (spectrum[i] || 0) - (this.prevSpectrum[i] || 0);
      if (diff > 0) flux += diff;
    }
    this.prevSpectrum = [...spectrum];
    return flux / Math.max(1, spectrum.length);
  }

  _detectBeat(energy, spectralFlux, now, sensitivity = 1) {
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 64) this.energyHistory.shift();

    const mean = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const variance =
      this.energyHistory.reduce((a, b) => a + (b - mean) * (b - mean), 0) / this.energyHistory.length;
    const std = Math.sqrt(variance);

    const cooldown = 0.12;
    const energySpike = energy > mean + std * (0.9 / Math.max(0.25, sensitivity));
    const fluxSpike = spectralFlux > 0.005 + std * 0.35;

    const beat = energySpike && fluxSpike && now - this.lastBeatTime > cooldown;
    const intensity = Math.max(0, (energy - mean) * 2.8 + spectralFlux * 22);

    if (beat) {
      this.lastBeatTime = now;
      this.beatTimes.push(now);
      if (this.beatTimes.length > 10) this.beatTimes.shift();

      if (this.beatTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
          intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval > 0.001) {
          this.tempoEstimate = Math.max(40, Math.min(220, 60 / avgInterval));
        }
      }
    }

    return { beatDetected: beat, beatIntensity: Math.min(1.8, intensity) };
  }

  _updateSection(energy, beatIntensity, now) {
    if (now < this.sectionHoldUntil) return this.section;

    let next = this.section;
    if (beatIntensity > 1.05 && energy > 0.52) next = 'Drop';
    else if (beatIntensity > 0.65 && energy > 0.42) next = 'Chorus';
    else if (energy > 0.28) next = 'Build';
    else next = 'Verse';

    if (next !== this.section) {
      this.section = next;
      this.sectionHoldUntil = now + 0.8;
    }
    return this.section;
  }

  update({ beatSensitivity = 1 } = {}) {
    if (!this.ctx) return null;

    const raw = this.latestRaw || this._fallbackRawFromAnalyser();
    if (!raw) return null;

    const volumeRaw = Number(raw.rms || 0);
    const energyRaw = Number(raw.energy || 0);
    const brightnessRaw = Number(raw.spectralCentroid || 0);
    const flatnessRaw = Number(raw.spectralFlatness || 0);

    const volumeNorm = this._normalize(volumeRaw, this.featureHistory.volume);
    const energyNorm = this._normalize(energyRaw, this.featureHistory.energy);
    const brightnessNorm = this._normalize(brightnessRaw, this.featureHistory.brightness);
    const rhythmNorm = this._normalize(flatnessRaw, this.featureHistory.rhythmIntensity);

    const volume = this._smooth('volume', volumeNorm, 0.26);
    const energy = this._smooth('energy', energyNorm, 0.24);
    const brightness = this._smooth('brightness', brightnessNorm, 0.2);
    const rhythmIntensity = this._smooth('rhythmIntensity', rhythmNorm, 0.24);

    const spectrumRaw = raw.amplitudeSpectrum || [];
    const spectrum = this._smoothSpectrum(spectrumRaw, 0.22);
    const spectralFlux = this._computeSpectralFlux(spectrum);
    const beat = this._detectBeat(energy, spectralFlux, this.ctx.currentTime, beatSensitivity);

    this.beatDetected = beat.beatDetected;
    const beatIntensityNorm = this._normalize(beat.beatIntensity, this.featureHistory.beatIntensity);
    this.beatIntensity = this._smooth('beatIntensity', beatIntensityNorm, 0.35);

    const bandsRaw = this._estimateSpectrumBands(spectrum);
    const bassNorm = this._normalize(bandsRaw.bass / 255, this.featureHistory.bass);
    const midNorm = this._normalize(bandsRaw.mid / 255, this.featureHistory.mid);
    const trebleNorm = this._normalize(bandsRaw.treble / 255, this.featureHistory.treble);
    const bands = {
      bass: this._smooth('bass', bassNorm, 0.26),
      mid: this._smooth('mid', midNorm, 0.24),
      treble: this._smooth('treble', trebleNorm, 0.22)
    };

    const spectralRolloffNorm = this._normalize(Number(raw.spectralRolloff || 0), this.featureHistory.spectralRolloff);
    const spectralRolloff = this._smooth('spectralRolloff', spectralRolloffNorm, 0.2);

    const pitchRaw = Math.max(0, brightnessRaw);
    const pitchNorm = this._normalize(pitchRaw, this.featureHistory.pitch);
    const pitch = this._smooth('pitch', pitchNorm, 0.2) * 1500;

    const tempoNorm = this._normalize(this.tempoEstimate || 0, this.featureHistory.tempo);
    const tempoEstimate = this._smooth('tempo', tempoNorm, 0.2) * 220;

    const chromaRaw = Array.isArray(raw.chroma) ? raw.chroma : new Array(12).fill(0);
    const chromaNorm = this._normalizeArrayByMax(chromaRaw);
    this.chromaSmooth = this._smoothArray(this.chromaSmooth, chromaNorm, 0.24);

    const mfccRaw = Array.isArray(raw.mfcc) ? raw.mfcc.slice(0, 13) : [];
    while (mfccRaw.length < 13) mfccRaw.push(0);
    const mfccNorm = mfccRaw.map((v) => (Math.tanh(v / 100) + 1) * 0.5);
    this.mfccSmooth = this._smoothArray(this.mfccSmooth, mfccNorm, 0.18);

    const section = this._updateSection(energy, this.beatIntensity, this.ctx.currentTime);

    return {
      time: this.ctx.currentTime,
      volume,
      energy,
      brightness,
      rhythmIntensity,
      harmony: this.chromaSmooth,
      mfcc: this.mfccSmooth,
      spectralRolloff,
      beatDetected: this.beatDetected,
      beatIntensity: this.beatIntensity,
      tempoEstimate,

      // Compatibility fields for existing visual modes
      amplitude: volume,
      beat: this.beatDetected,
      spectrum: spectrum.map((v) => Math.max(0, Math.min(255, v))),
      bass: bands.bass,
      mid: bands.mid,
      treble: bands.treble,
      pitch,
      section,
      freqBandColors: {
        bass: '#ff3b3b',
        mid: '#44b7ff',
        treble: '#8f5bff'
      }
    };
  }
}
