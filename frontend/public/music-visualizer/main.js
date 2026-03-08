import { AudioEngine } from './audioEngine.js';
import { ResonanceWaterMode } from './visualModes/water.js';
import { RhythmPulseWallMode } from './visualModes/pulseWall.js';
import { AccessibleRhythmMode } from './visualModes/accessible.js';
import { InteractiveRhythmMode } from './visualModes/interactive.js';
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
const controlPanel = document.getElementById('controlPanel');
const panelToggleBtn = document.getElementById('panelToggleBtn');
const visualLegend = document.getElementById('visualLegend');
const accessibilityToggle = document.getElementById('accessibilityToggle');

const rhythmMarkers = setupRhythmMarkers(rhythmMarkersEl, 16);

const engine = new AudioEngine();
await engine.initWithMediaElement(audioPlayer);

// ACCESSIBILITY: Visualization modes including hearing-impaired friendly mode
const modes = {
  water: new ResonanceWaterMode(),
  pulseWall: new RhythmPulseWallMode(),
  accessible: new AccessibleRhythmMode(),  // Designed for hearing-impaired users
  interactive: new InteractiveRhythmMode()
};

// Set audio element for interactive mode
if (modes.interactive) {
  modes.interactive.audioElement = audioPlayer;
}

let activeMode = 'water';
let prevMode = 'water';
let transition = 1;
let beatPulse = 0;
let markerHead = 0;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
const supportsHaptics = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const prefersReducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const hapticState = {
  lastTriggerTs: 0,
  minIntervalMs: 90
};

// Rendering fix: keep canvas bitmap resolution in sync with screen size and DPI.
// This prevents blurry upscaling and keeps drawing in full-screen CSS pixels.
function resizeCanvas() {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(viewportWidth * dpr);
  canvas.height = Math.floor(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;

  // Draw using CSS-pixel coordinates while keeping high-DPI sharpness.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI: Collapsible left panel to free up screen space when needed.
if (controlPanel && panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => {
    const collapsed = controlPanel.classList.toggle('collapsed');
    panelToggleBtn.textContent = collapsed ? '▶' : '◀';
    panelToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    panelToggleBtn.title = collapsed ? 'Expand panel' : 'Collapse panel';
  });
}

// ACCESSIBILITY: Handle accessibility mode toggle
// Enables enhanced contrast, larger shapes, and simplified visuals
accessibilityToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  if (modes.accessible) {
    modes.accessible.enableAccessibilityMode(enabled);
  }
});

const ui = setupUI({
  fileInput: document.getElementById('fileInput'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  micBtn: document.getElementById('micBtn'),
  modeSelect: document.getElementById('modeSelect'),
  difficultySelect: document.getElementById('difficultySelect'),
  themeSelect: document.getElementById('themeSelect'),
  hapticToggle: document.getElementById('hapticToggle'),
  hapticGroup: document.getElementById('hapticGroup'),
  onFile: async (file) => {
    await engine.loadFile(file);
  },
  onPlay: async () => {
    if (activeMode === 'interactive' && modes.interactive?.startCountdown) {
      modes.interactive.startCountdown(3);
    }
    await engine.play();
  },
  onPause: () => {
    engine.pause();
    if (supportsHaptics) {
      navigator.vibrate(0);
    }
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
  onModeChange: (nextMode) => {

ui.setHapticSupport(supportsHaptics, 'Haptic feedback is unavailable on this device/browser.');
if (prefersReducedMotion) {
  ui.setHapticEnabled(false);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && supportsHaptics) {
    navigator.vibrate(0);
  }
});

function triggerHapticCue(data) {
  if (!supportsHaptics || !ui.hapticEnabled()) return;

  const now = performance.now();
  if (now - hapticState.lastTriggerTs < hapticState.minIntervalMs) return;
  hapticState.lastTriggerTs = now;

  // Short patterns keep cues clear without becoming intrusive.
  if (data.kickDetected) {
    navigator.vibrate([18, 16, 18]);
  } else if (data.snareDetected) {
    navigator.vibrate(14);
  } else {
    navigator.vibrate(10);
  }
}

    if (nextMode === activeMode) return;
    prevMode = activeMode;
    activeMode = nextMode;
    transition = 0;
    
    // ACCESSIBILITY: Show/hide visual legend when accessible mode is selected
    // The legend helps hearing-impaired users understand the visual language
    if (nextMode === 'accessible') {
      visualLegend.style.display = 'block';
    } else {
      visualLegend.style.display = 'none';
    }
  },
  onDifficultyChange: (difficulty) => {
    if (modes.interactive?.setDifficulty) {
      modes.interactive.setDifficulty(difficulty);
    }
  }
});

if (modes.interactive?.setDifficulty) {
  modes.interactive.setDifficulty('mid');
}
// ACCESSIBILITY: Update visual indicators for hearing-impaired users
// Provides clear, non-audio feedback about rhythm and musical structure
function updateAccessibility(data) {
  sectionLabel.textContent = data.section;
  pitchLabel.textContent = data.pitch > 0 ? `${Math.round(data.pitch)} Hz` : '-- Hz';
  
  // Enhanced beat indication
  const beatStatus = data.kickDetected ? 'Kick' : 
                     data.snareDetected ? 'Snare' : 
                     data.beat ? 'Yes' : 'No';
  beatLabel.textContent = beatStatus;

  if (data.beat) {
    beatPulse = 1;
    markerHead = (markerHead + 1) % rhythmMarkers.length;
    rhythmMarkers.forEach((node, i) => {
      const isHead = i === markerHead;
      // Color-code by beat type for accessibility
      const beatColor = data.kickDetected ? 'rgba(255, 100, 100, 0.95)' :
                        data.snareDetected ? 'rgba(100, 200, 255, 0.95)' :
                        'rgba(129, 244, 255, 0.95)';
      node.style.background = isHead ? beatColor : 'rgba(255,255,255,0.16)';
      node.style.transform = isHead ? 'scaleY(1.7)' : 'scaleY(1)';
    });

    triggerHapticCue(data);
  }

  beatPulse *= 0.9;
  beatIndicator.style.transform = `scale(${1 + beatPulse * 1.2})`;
  beatIndicator.style.opacity = `${0.45 + beatPulse * 0.55}`;
}

function drawColorBandCue(data) {
  const w = viewportWidth;
  const h = viewportHeight;

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

  const data = engine.update();
  if (!data) return;

  const t = ts / 1000;
  const theme = ui.getTheme();

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  if (transition < 1 && modes[prevMode]) {
    transition = Math.min(1, transition + 0.045);

    ctx.save();
    ctx.globalAlpha = 1 - transition;
    modes[prevMode].render(ctx, data, t, viewportWidth, viewportHeight, theme);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = transition;
  modes[activeMode].render(ctx, data, t, viewportWidth, viewportHeight, theme);
  ctx.restore();

  updateAccessibility(data);
  drawColorBandCue(data);
}

requestAnimationFrame(frame);
