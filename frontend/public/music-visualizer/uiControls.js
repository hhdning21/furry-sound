// ACCESSIBILITY: Color themes optimized for visibility
// High contrast options to help hearing-impaired users distinguish visual elements
const THEMES = {
  ice: { primary: '#b8f1ff', secondary: '#4d8dff', accent: '#effbff' },
  sunset: { primary: '#ff2a2a', secondary: '#ff7a00', accent: '#ffd166' }
};

export function setupUI({
  fileInput,
  playBtn,
  pauseBtn,
  micBtn,
  modeSelect,
  difficultySelect,
  themeSelect,
  hapticToggle,
  hapticGroup,
  onFile,
  onPlay,
  onPause,
  onMic,
  onModeChange,
  onDifficultyChange
}) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  });

  playBtn.addEventListener('click', () => onPlay());
  pauseBtn.addEventListener('click', () => onPause());
  micBtn.addEventListener('click', () => onMic());

  modeSelect.addEventListener('change', () => onModeChange(modeSelect.value));
  if (difficultySelect && onDifficultyChange) {
    difficultySelect.addEventListener('change', () => onDifficultyChange(difficultySelect.value));
  }

  return {
    getMode: () => modeSelect.value,
    getTheme: () => THEMES[themeSelect.value] || THEMES.sunset,
    hapticEnabled: () => Boolean(hapticToggle?.checked),
    setHapticEnabled: (enabled) => {
      if (!hapticToggle) return;
      hapticToggle.checked = Boolean(enabled);
    },
    setHapticSupport: (isSupported, reason = '') => {
      if (!hapticToggle) return;

      if (!isSupported) {
        hapticToggle.checked = false;
      }

      hapticToggle.disabled = !isSupported;
      hapticToggle.title = !isSupported ? (reason || 'Haptic feedback is not supported on this device/browser.') : '';

      if (hapticGroup) {
        hapticGroup.style.opacity = isSupported ? '1' : '0.6';
      }
    },
    themes: THEMES
  };
}

export function setupRhythmMarkers(container, count = 16) {
  container.innerHTML = '';
  const nodes = Array.from({ length: count }, () => {
    const el = document.createElement('span');
    container.appendChild(el);
    return el;
  });
  return nodes;
}
