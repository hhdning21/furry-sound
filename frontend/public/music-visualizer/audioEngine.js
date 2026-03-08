/**
 * AUDIO ENGINE - Core Audio Analysis System
 * 
 * ACCESSIBILITY FOR HEARING-IMPAIRED USERS:
 * This engine analyzes music and extracts visual features that help hearing-impaired
 * users understand music structure without hearing it:
 * 
 * 1. Beat Detection: Identifies rhythm timing → visual pulses/flashes
 * 2. Frequency Bands: Separates bass/mid/treble → different colors/shapes
 * 3. Kick Detection: Low-frequency beats → large circle pulses (center)
 * 4. Snare Detection: Mid-frequency hits → triangle flashes (sides)
 * 5. Hi-hat Detection: High-frequency patterns → small particles
 * 6. Energy Levels: Overall volume → size/brightness of visuals
 * 7. Section Detection: Song structure (verse/chorus/drop) → labeled indicators
 * 
 * The visual mapping creates a "rhythm language" that makes music accessible
 * through sight instead of sound.
 */

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

    // PERFORMANCE: Cache expensive analysis values to reduce per-frame CPU load.
    this.pitch = 0;
    this.pitchFrame = 0;
    this.pitchEveryNFrames = 4;
    this.bandRanges = {};
  }

  // PERFORMANCE: Precompute frequency bin ranges once per band instead of every frame.
  _getBandRange(fromHz, toHz) {
    const key = `${fromHz}-${toHz}`;
    const cached = this.bandRanges[key];
    if (cached && cached.length === this.freqData.length && cached.sampleRate === this.ctx.sampleRate) {
      return cached;
    }

    const nyquist = this.ctx.sampleRate / 2;
    const start = Math.floor((fromHz / nyquist) * this.freqData.length);
    const end = Math.max(start + 1, Math.floor((toHz / nyquist) * this.freqData.length));
    const range = {
      start,
      end,
      span: Math.max(1, end - start),
      length: this.freqData.length,
      sampleRate: this.ctx.sampleRate
    };
    this.bandRanges[key] = range;
    return range;
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

  // ACCESSIBILITY: Analyze frequency bands to separate bass, mid, and treble
  // This allows different visual representations for different sound frequencies
  // Bass (20-220Hz) = Low drums/kick → Red colors, large shapes
  // Mid (220-2000Hz) = Vocals/snare → Blue colors, medium shapes
  // Treble (2000-9000Hz) = Cymbals/hi-hat → Purple colors, small particles
  _avgBand(fromHz, toHz) {
    const { start, end, span } = this._getBandRange(fromHz, toHz);
    let sum = 0;
    for (let i = start; i < end && i < this.freqData.length; i++) sum += this.freqData[i];
    return sum / (span * 255);
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

  // ACCESSIBILITY: Enhanced beat detection for hearing-impaired users
  // Detects different types of rhythm elements to map them to distinct visual symbols
  // - Kick drum (bass beat): Low-frequency energy spikes → triggers circle pulses
  // - Snare drum: Mid-frequency transients → triggers triangle flashes
  // - Hi-hat/cymbals: High-frequency patterns → triggers small particles
  _detectBeat(energy, now, beatSensitivity, bass, mid, treble) {
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

    // ACCESSIBILITY: Detect specific drum types by frequency analysis
    // Kick: strong bass presence (20-220Hz) - creates large circle pulses
    const kickDetected = bass > 0.5 && beat;
    
    // Snare: mid-frequency spike (220-2000Hz) with sharp attack - creates triangle flashes
    const snareDetected = mid > 0.45 && flux > 0.08 && !kickDetected;
    
    // Hi-hat: treble energy (2000-9000Hz) - creates small particle bursts
    const hihatDetected = treble > 0.35;

    if (beat) this.lastBeatTime = now;
    
    return { 
      beat, 
      beatIntensity: Math.min(1.8, beatIntensity),
      kickDetected,
  // ACCESSIBILITY: Detect song sections (Intro, Verse, Build, Chorus, Drop)
  // Helps hearing-impaired users understand song structure and energy changes
  // Different sections have different visual characteristics:
  // - Intro/Verse: Calmer, smaller visuals
  // - Build: Increasing energy and size
  // - Chorus: Medium energy, rhythmic patterns
  // - Drop: Maximum energy, largest and brightest visuals
      snareDetected,
      hihatDetected
    };
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
    const { beat, beatIntensity, kickDetected, snareDetected, hihatDetected } = 
      this._detectBeat(amplitude, now, beatSensitivity, bass, mid, treble);
    // PERFORMANCE: Pitch detection is O(n²), so run it less frequently and reuse cached value.
    this.pitchFrame += 1;
    if (this.pitchFrame % this.pitchEveryNFrames === 0) {
      this.pitch = this._estimatePitch();
    }
    const pitch = this.pitch;
    const section = this._updateSection(amplitude, beatIntensity, now);

    // ACCESSIBILITY: Return comprehensive rhythm data for visual mapping
    // Each element gets a distinct visual representation for hearing-impaired users
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
      // Specific rhythm element detection
      kickDetected,      // → Circle pulse
      snareDetected,     // → Triangle flash
      hihatDetected,     // → Particle burst
      freqBandColors: {
        bass: '#ff3b3b',
        mid: '#44b7ff',
        treble: '#8f5bff'
      }
    };
  }
}
