import { AudioEngine } from './audioEngine.js';
import { ResonanceWaterMode } from './visualModes/water.js';
import { ParticleStormMode } from './visualModes/particles.js';
import { RhythmPulseWallMode } from './visualModes/pulseWall.js';
import { CosmicConcertMode } from './visualModes/cosmos.js';
import { setupUI, setupRhythmMarkers } from './uiControls.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const audioPlayer = document.getElementById('audioPlayer');
const sectionLabel = document.getElementById('sectionLabel');
const pitchLabel = document.getElementById('pitchLabel');
const beatLabel = document.getElementById('beatLabel');
const beatIndicator = document.getElementById('beatIndicator');
const rhythmMarkersEl = document.getElementById('rhythmMarkers');
const micBtn = document.getElementById('micBtn');

const rhythmMarkers = setupRhythmMarkers(rhythmMarkersEl, 16);

const engine = new AudioEngine();
await engine.initWithMediaElement(audioPlayer);

const modes = {
  water: new ResonanceWaterMode(),
  particles: new ParticleStormMode(),
  pulseWall: new RhythmPulseWallMode(),
  cosmos: new CosmicConcertMode()
};

let activeMode = 'water';
let prevMode = 'water';
let transition = 1;
let beatPulse = 0;
let markerHead = 0;

const ui = setupUI({
  fileInput: document.getElementById('fileInput'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  micBtn: document.getElementById('micBtn'),
  streamBtn: document.getElementById('streamBtn'),
  streamUrl: document.getElementById('streamUrl'),
  modeSelect: document.getElementById('modeSelect'),
  themeSelect: document.getElementById('themeSelect'),
  ampSensitivity: document.getElementById('ampSensitivity'),
  beatSensitivity: document.getElementById('beatSensitivity'),
  motionSensitivity: document.getElementById('motionSensitivity'),
  hapticToggle: document.getElementById('hapticToggle'),
  onFile: async (file) => {
    await engine.loadFile(file);
  },
  onPlay: async () => {
    await engine.play();
  },
  onPause: () => {
    engine.pause();
  },
  onMic: async () => {
    if (engine.isMicrophoneActive()) {
      engine.disableMicrophone();
      micBtn.textContent = 'Mic: Off';
    } else {
      await engine.useMicrophone();
      micBtn.textContent = 'Mic: On';
    }
  },
  onStream: async (url) => {
    await engine.useStream(url);
  },
  onModeChange: (nextMode) => {
    if (nextMode === activeMode) return;
    prevMode = activeMode;
    activeMode = nextMode;
    transition = 0;
  }
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function updateAccessibility(data) {
  sectionLabel.textContent = data.section;
  pitchLabel.textContent = data.pitch > 0 ? `${Math.round(data.pitch)} Hz` : '-- Hz';
  beatLabel.textContent = data.beat ? 'Yes' : 'No';

  if (data.beat) {
    beatPulse = 1;
    markerHead = (markerHead + 1) % rhythmMarkers.length;
    rhythmMarkers.forEach((node, i) => {
      const isHead = i === markerHead;
      node.style.background = isHead ? 'rgba(129, 244, 255, 0.95)' : 'rgba(255,255,255,0.16)';
      node.style.transform = isHead ? 'scaleY(1.7)' : 'scaleY(1)';
    });

    if (ui.hapticEnabled() && navigator.vibrate) {
      navigator.vibrate(15);
    }
  }

  beatPulse *= 0.9;
  beatIndicator.style.transform = `scale(${1 + beatPulse * 1.2})`;
  beatIndicator.style.opacity = `${0.45 + beatPulse * 0.55}`;
}

function drawColorBandCue(data) {
  const w = canvas.width;
  const h = canvas.height;

  const bassW = Math.max(2, data.bass * w * 0.28);
  const midW = Math.max(2, data.mid * w * 0.28);
  const trebleW = Math.max(2, data.treble * w * 0.28);

  const y = h - 14;
  ctx.fillStyle = data.freqBandColors.bass;
  ctx.fillRect(18, y, bassW, 6);
  ctx.fillStyle = data.freqBandColors.mid;
  ctx.fillRect(24 + w * 0.3, y, midW, 6);
  ctx.fillStyle = data.freqBandColors.treble;
  ctx.fillRect(30 + w * 0.6, y, trebleW, 6);
}

function frame(ts) {
  requestAnimationFrame(frame);

  const sensitivity = ui.getSensitivity();
  const data = engine.update({ beatSensitivity: sensitivity.beat });
  if (!data) return;

  const t = ts / 1000;
  const theme = ui.getTheme();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (transition < 1 && modes[prevMode]) {
    transition = Math.min(1, transition + 0.045);

    ctx.save();
    ctx.globalAlpha = 1 - transition;
    modes[prevMode].render(ctx, data, t, canvas.width, canvas.height, theme, sensitivity);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = transition;
  modes[activeMode].render(ctx, data, t, canvas.width, canvas.height, theme, sensitivity);
  ctx.restore();

  updateAccessibility(data);
  drawColorBandCue(data);
}

requestAnimationFrame(frame);
