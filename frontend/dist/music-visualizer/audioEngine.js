export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.audioEl = null;
    this.timeData = null;
    this.freqData = null;
    this.stream = null;
    this.mediaSourceNode = null;
    this.mediaStreamNode = null;
    this.inputMode = 'element';
    this.outputConnected = false;

    this.lastEnergy = 0;
    this.energyHistory = [];
    this.lastBeatTime = 0;
    this.section = 'Intro';
    this.sectionHoldUntil = 0;
  }

  async initWithMediaElement(audioEl) {
    this.audioEl = audioEl;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.86;
      this.timeData = new Float32Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (!this.mediaSourceNode) {
      this.mediaSourceNode = this.ctx.createMediaElementSource(audioEl);
    }
    this._connectSource(this.mediaSourceNode);
    this.inputMode = 'element';
  }

  _connectSource(node) {
    if (!node) return;
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
    }
    this.sourceNode = node;
    this.sourceNode.connect(this.analyser);
    if (!this.outputConnected) {
      this.analyser.connect(this.ctx.destination);
      this.outputConnected = true;
    }
  }

  async loadFile(file) {
    const url = URL.createObjectURL(file);
    this.audioEl.src = url;
    return url;
  }

  async useMicrophone() {
    await this._useUserMedia({ audio: true, video: false });
    this.inputMode = 'mic';
  }

  disableMicrophone() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.mediaSourceNode) {
      this._connectSource(this.mediaSourceNode);
      this.inputMode = 'element';
    }
  }

  isMicrophoneActive() {
    return this.inputMode === 'mic' && !!this.stream;
  }

  async useStream(streamUrl) {
    if (!streamUrl) throw new Error('Missing stream URL');
    this.audioEl.src = streamUrl;
    this.audioEl.crossOrigin = 'anonymous';
    this.inputMode = 'element';
    if (this.mediaSourceNode) this._connectSource(this.mediaSourceNode);
    await this.play();
  }

  async _useUserMedia(constraints) {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.timeData = new Float32Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.mediaStreamNode = this.ctx.createMediaStreamSource(this.stream);
    this._connectSource(this.mediaStreamNode);
  }

  async play() {
    if (!this.ctx) throw new Error('Audio engine not initialized');
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

  _avgBand(fromHz, toHz) {
    const nyquist = this.ctx.sampleRate / 2;
    const start = Math.floor((fromHz / nyquist) * this.freqData.length);
    const end = Math.max(start + 1, Math.floor((toHz / nyquist) * this.freqData.length));
    let sum = 0;
    for (let i = start; i < end && i < this.freqData.length; i++) sum += this.freqData[i];
    return sum / ((end - start) * 255);
  }

  _estimatePitch() {
    this.analyser.getFloatTimeDomainData(this.timeData);
    const data = this.timeData;
    const size = data.length;

    let rms = 0;
    for (let i = 0; i < size; i++) rms += data[i] * data[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return 0;

    let bestOffset = -1;
    let bestCorr = 0;
    const maxOffset = Math.floor(size / 2);

    for (let offset = 24; offset < maxOffset; offset++) {
      let corr = 0;
      for (let i = 0; i < maxOffset; i++) {
        corr += data[i] * data[i + offset];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestOffset = offset;
      }
    }

    if (bestOffset <= 0) return 0;
    return this.ctx.sampleRate / bestOffset;
  }

  _detectBeat(energy, now, beatSensitivity) {
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 48) this.energyHistory.shift();

    const mean = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const variance =
      this.energyHistory.reduce((a, b) => a + (b - mean) * (b - mean), 0) / this.energyHistory.length;
    const std = Math.sqrt(variance);

    const flux = Math.max(0, energy - this.lastEnergy);
    this.lastEnergy = energy;

    const cooldown = 0.13;
    const dynamicThreshold = mean + std * (0.55 / Math.max(0.2, beatSensitivity));
    const beatIntensity = Math.max(0, (energy - dynamicThreshold) * 3.8 + flux * 2.2);
    const beat = beatIntensity > 0.1 && now - this.lastBeatTime > cooldown;

    if (beat) this.lastBeatTime = now;
    return { beat, beatIntensity: Math.min(1.8, beatIntensity) };
  }

  _updateSection(energy, beatIntensity, now) {
    if (now < this.sectionHoldUntil) return this.section;

    let next = this.section;
    if (beatIntensity > 0.85 && energy > 0.55) next = 'Drop';
    else if (beatIntensity > 0.45 && energy > 0.4) next = 'Chorus';
    else if (energy > 0.32) next = 'Build';
    else next = 'Verse';

    if (next !== this.section) {
      this.section = next;
      this.sectionHoldUntil = now + 0.75;
    }
    return this.section;
  }

  update({ beatSensitivity = 1 } = {}) {
    if (!this.analyser || !this.ctx) {
      return null;
    }

    this.analyser.getByteFrequencyData(this.freqData);

    const bass = this._avgBand(20, 220);
    const mid = this._avgBand(220, 2000);
    const treble = this._avgBand(2000, 9000);
    const amplitude = Math.min(1, bass * 0.4 + mid * 0.35 + treble * 0.25);
    const spectrum = this.freqData;

    const now = this.ctx.currentTime;
    const { beat, beatIntensity } = this._detectBeat(amplitude, now, beatSensitivity);
    const pitch = this._estimatePitch();
    const section = this._updateSection(amplitude, beatIntensity, now);

    return {
      time: now,
      amplitude,
      beat,
      beatIntensity,
      spectrum,
      bass,
      mid,
      treble,
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
