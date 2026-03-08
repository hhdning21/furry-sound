const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');
const fileInput = document.getElementById('fileInput');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const statusEl = document.getElementById('status');

let audioCtx;
let analyser;
let source;
let dataArray;
let particles = [];
let phase = 0;
let beatPulse = 0;
let lowHistory = [];
let state = 'opening';
let prevState = 'opening';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function setupAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;

  source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function avgBand(fromHz, toHz) {
  if (!analyser || !audioCtx) return 0;
  const nyquist = audioCtx.sampleRate / 2;
  const start = Math.floor((fromHz / nyquist) * dataArray.length);
  const end = Math.max(start + 1, Math.floor((toHz / nyquist) * dataArray.length));
  let sum = 0;
  for (let i = start; i < end && i < dataArray.length; i++) sum += dataArray[i];
  return sum / ((end - start) * 255);
}

function calcAudioFeatures() {
  analyser.getByteFrequencyData(dataArray);

  const bass = avgBand(20, 220);
  const mids = avgBand(220, 2000);
  const highs = avgBand(2000, 9000);
  const volume = clamp(bass * 0.45 + mids * 0.35 + highs * 0.2, 0, 1);

  const spectralCentroidApprox = 400 + (highs * 0.7 + mids * 0.3) * 4500;

  lowHistory.push(bass);
  if (lowHistory.length > 43) lowHistory.shift();
  const meanLow = lowHistory.reduce((a, b) => a + b, 0) / lowHistory.length;
  const variance = lowHistory.reduce((a, b) => a + (b - meanLow) ** 2, 0) / lowHistory.length;
  const std = Math.sqrt(variance);
  const beatIntensity = clamp((bass - (meanLow + std * 0.7)) * 5.5, 0, 1.8);
  const beatFrame = beatIntensity > 0.2;

  return { bass, mids, highs, volume, spectralCentroidApprox, beatIntensity, beatFrame };
}

function setStateByMusic(t, duration, feat) {
  const progress = duration > 0 ? t / duration : 0;

  if (progress < 0.16) {
    state = 'opening';
  } else if (progress < 0.4 && feat.beatIntensity > 0.15) {
    state = 'beat';
  } else if (progress < 0.72) {
    state = 'melody';
  } else if (progress < 0.9 && (feat.beatIntensity > 0.25 || feat.volume > 0.55)) {
    state = 'drop';
  } else {
    state = 'ending';
  }

  if (state !== prevState) {
    statusEl.textContent = `Section: ${state}`;
    prevState = state;
  }
}

function spectrumColor(highs, mids, bass) {
  const h = Math.round(clamp(250 - highs * 180 + bass * 80, 0, 300));
  const s = Math.round(70 + mids * 25);
  const l = Math.round(45 + highs * 12);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function drawCenterLine(feat, t) {
  const w = canvas.width;
  const h = canvas.height;
  const centerYBase = h * 0.5;

  const pitchOffset = ((feat.spectralCentroidApprox - 2300) / 2300) * h * 0.2;
  const centerY = centerYBase - pitchOffset;

  const lineThickness = 1.5 + feat.volume * 10;
  const bassVibe = feat.bass * (state === 'opening' ? 8 : 24);

  ctx.save();
  ctx.strokeStyle = spectrumColor(feat.highs, feat.mids, feat.bass);
  ctx.lineWidth = lineThickness + beatPulse * 3;
  ctx.shadowBlur = 18 + feat.highs * 26;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.beginPath();

  const amp =
    state === 'opening'
      ? bassVibe
      : state === 'beat'
      ? bassVibe + feat.beatIntensity * 44
      : state === 'melody'
      ? bassVibe + feat.highs * 60
      : state === 'drop'
      ? bassVibe + feat.beatIntensity * 84
      : bassVibe * 0.5;

  const freq = state === 'melody' ? 0.018 : 0.012;
  for (let x = 0; x <= w; x += 8) {
    const y =
      centerY +
      Math.sin(x * freq + t * 2 + phase) * amp * 0.45 +
      Math.sin(x * 0.007 + t * 1.2) * amp * 0.25;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function spawnDropParticles(feat) {
  if (state !== 'drop') return;
  const count = 26 + Math.floor(feat.beatIntensity * 48);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.25;
    const speed = 1.8 + Math.random() * 4.6 + feat.volume * 2.8;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 1,
      size: 1 + Math.random() * 3.5,
      hue: 170 + Math.random() * 160
    });
  }
}

function updateAndDrawParticles(feat) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    if (state === 'ending') {
      const dx = cx - p.x;
      const dy = cy - p.y;
      p.vx += dx * 0.0007;
      p.vy += dy * 0.0007;
      p.life -= 0.005;
    } else {
      p.life -= 0.008;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.986;
    p.vy *= 0.986;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    const c = `hsla(${p.hue + feat.highs * 35}, 90%, 64%, ${Math.max(0, p.life)})`;
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size + feat.volume * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLightTrails(feat, t) {
  if (state !== 'melody') return;
  const w = canvas.width;
  const h = canvas.height;
  const trails = 4;
  for (let n = 0; n < trails; n++) {
    ctx.beginPath();
    const hue = 200 + n * 30 + feat.highs * 50;
    ctx.strokeStyle = `hsla(${hue}, 95%, 65%, 0.35)`;
    ctx.lineWidth = 1.2 + feat.volume * 3;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    for (let x = 0; x <= w; x += 12) {
      const drift = (feat.spectralCentroidApprox - 2200) * 0.022;
      const y = h * 0.5 + Math.sin(x * 0.011 + t * 2.3 + n) * (22 + feat.highs * 85) - drift;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function renderFrame(ts) {
  requestAnimationFrame(renderFrame);
  if (!analyser || audio.paused) return;

  const t = ts / 1000;
  const feat = calcAudioFeatures();
  setStateByMusic(audio.currentTime, audio.duration || 0, feat);

  if (feat.beatFrame) beatPulse = Math.min(1.2, beatPulse + feat.beatIntensity * 0.28 + 0.08);
  beatPulse *= 0.92;
  phase += 0.01 + feat.highs * 0.05;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgA = `rgba(8, 10, 20, ${0.3 + feat.volume * 0.2})`;
  const bgB = `rgba(5, 7, 13, 0.95)`;
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, bgA);
  bg.addColorStop(1, bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCenterLine(feat, t);
  drawLightTrails(feat, t);

  if (feat.beatFrame && state === 'drop') {
    spawnDropParticles(feat);
  }
  updateAndDrawParticles(feat);

  if (state === 'ending' && particles.length < 10) {
    // collapse back to single line visual clarity
    particles = [];
  }
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  audio.src = url;
  statusEl.textContent = `Loaded: ${file.name}`;
  playBtn.disabled = false;
  pauseBtn.disabled = false;
});

playBtn.addEventListener('click', async () => {
  setupAudioGraph();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  await audio.play();
  statusEl.textContent = 'Playing...';
});

pauseBtn.addEventListener('click', () => {
  audio.pause();
  statusEl.textContent = 'Paused';
});

audio.addEventListener('play', () => {
  requestAnimationFrame(renderFrame);
});

audio.addEventListener('ended', () => {
  state = 'ending';
  statusEl.textContent = 'Track ended: collapsed to center line.';
});
