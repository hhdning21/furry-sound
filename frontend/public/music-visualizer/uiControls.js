const THEMES = {
  neon: { primary: '#63f7ff', secondary: '#9f7cff', accent: '#3dff9c' },
  ice: { primary: '#8de8ff', secondary: '#6fa8ff', accent: '#d7f7ff' },
  sunset: { primary: '#ff8963', secondary: '#ff4fd8', accent: '#ffe26a' }
};

export function setupUI({
  fileInput,
  playBtn,
  pauseBtn,
  micBtn,
  streamBtn,
  streamUrl,
  modeSelect,
  themeSelect,
  ampSensitivity,
  beatSensitivity,
  motionSensitivity,
  hapticToggle,
  onFile,
  onPlay,
  onPause,
  onMic,
  onStream,
  onModeChange
}) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  });

  playBtn.addEventListener('click', () => onPlay());
  pauseBtn.addEventListener('click', () => onPause());
  micBtn.addEventListener('click', () => onMic());
  streamBtn.addEventListener('click', () => onStream(streamUrl.value.trim()));

  modeSelect.addEventListener('change', () => onModeChange(modeSelect.value));

  return {
    getMode: () => modeSelect.value,
    getTheme: () => THEMES[themeSelect.value] || THEMES.neon,
    getSensitivity: () => ({
      amp: Number(ampSensitivity.value),
      beat: Number(beatSensitivity.value),
      motion: Number(motionSensitivity.value)
    }),
    hapticEnabled: () => hapticToggle.checked,
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
