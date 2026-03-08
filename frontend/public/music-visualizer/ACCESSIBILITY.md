# Music Visualizer - Accessibility Features for Hearing-Impaired Users

## Overview

This music visualization system has been enhanced with comprehensive accessibility features designed specifically for hearing-impaired users. The system translates audio features into clear, consistent visual symbols that convey rhythm, melody, and musical structure without requiring the ability to hear.

## Visual Rhythm Language

The system uses a consistent **visual language** to map musical elements to distinct symbols:

### Core Symbol Mapping

| Musical Element | Visual Symbol | Location | Meaning |
|----------------|--------------|----------|---------|
| **Kick Drum / Bass Beat** | Large pulsing **circle** | Center screen | Main rhythm / heartbeat of the song |
| **Snare Drum** | Sharp **triangle** flash | Left/right sides | Rhythm accents / backbeat |
| **Hi-hat / Cymbals** | Small **particles** | Floating upward | High-frequency texture and details |
| **Bass Energy** | Expanding **waves** | From center | Sustained low-frequency power |

### Additional Visual Cues

- **Intensity Bar**: Bottom of screen shows overall music energy level
- **Rhythm Markers**: Bottom center shows beat timing in sequence
- **Section Labels**: Shows song structure (Intro, Verse, Chorus, Drop, Build)
- **Color Coding**: 
  - Red/Orange = Bass frequencies (low sounds)
  - Blue = Mid frequencies (vocals, snare)
  - Purple = Treble frequencies (high sounds)

## Accessibility Mode

### How to Enable

1. Select **"Accessible Rhythm"** from the Visualization Mode dropdown
2. Enable **"Enhanced Accessibility Mode"** checkbox for maximum clarity
3. The visual legend appears automatically showing all symbol meanings

### Enhanced Accessibility Mode Features

When enabled, this mode provides:

- **50% larger shapes** for easier visibility
- **High contrast colors** with pure black background
- **Simplified visualization** with less visual clutter
- **Stronger borders** on shapes for clarity
- **Brighter, clearer symbols**

## Visualization Modes

### Accessible Rhythm Mode (Recommended)
**Purpose**: Specifically designed for hearing-impaired users

**Features**:
- Clear, predictable symbol positions
- Large, simple shapes
- Minimal visual complexity
- Consistent visual language
- On-screen legend explaining all symbols

**Best for**: Understanding rhythm structure, beat timing, and frequency content

### Other Modes (Also Accessible)

All visualization modes include accessibility-friendly features:

#### Resonance Water Mode
- **Ripples** = Beat timing (like stones dropped in water)
- **Ripple size** = Beat strength
- **Wave lines** = Treble/high-frequency activity

#### Particle Storm Mode
- **Particle explosions** = Beat occurrences
- **Particle brightness** = Treble intensity
- **Rotation speed** = Mid-frequency activity

#### Rhythm Pulse Wall Mode
- **Vertical bars** = Frequency spectrum
- **Bar height** = Volume at each frequency
- **Upward pulses** = Beat indicators
- **Color gradient** = Frequency range (red=low, purple=high)

#### Cosmic Concert Mode
- **Star brightness** = Beat timing and treble
- **Expanding rings** = Beat indicators
- **Wavy line** = Melody/pitch movement

## Accessibility Features Across All Modes

### 1. Visual Beat Indicators
- **Beat indicator** (bottom right corner): Pulses and changes size on beats
- **Rhythm markers** (bottom center): Sequential bar graph showing beat timing
- **Color-coded beats**: Kick drums = red, snare = blue, general beats = cyan

### 2. Haptic Feedback (Optional)
- Enable "Haptic Cues (Mobile)" for vibration on beats (supported devices)
- The toggle is automatically disabled on unsupported browsers/devices
- Cues are rate-limited to reduce fatigue and prevent vibration spam
- Different patterns for beat types:
  - Kick drum: Double pulse pattern (18ms + pause + 18ms)
  - Snare: Medium single pulse (14ms)
  - General beat: Short single pulse (10ms)

### 3. Text Status Panel
- **Section**: Current song part (Intro, Verse, Build, Chorus, Drop)
- **Pitch**: Detected frequency in Hz (when melody is present)
- **Beat**: Type of beat detected (Kick, Snare, or Yes/No)

### 4. Frequency Band Visualization
- Color-coded bars at bottom of screen:
  - Left bar (red): Bass energy (20-220 Hz)
  - Middle bar (blue): Mid energy (220-2000 Hz)
  - Right bar (purple): Treble energy (2000-9000 Hz)

## Understanding Music Through Visuals

### Rhythm Timing
- **Steady pulses** = Consistent beat/tempo
- **Fast pulses** = Fast rhythm/tempo
- **Irregular pulses** = Syncopated/complex rhythm
- **No pulses** = Ambient/no clear beat

### Energy Levels
- **Large, bright shapes** = High energy, loud music
- **Small, dim shapes** = Low energy, quiet music
- **Growing shapes** = Building energy (heading to chorus/drop)
- **Shrinking shapes** = Decreasing energy (ending section)

### Frequency Content
- **Red/warm colors dominant** = Bass-heavy (electronic, hip-hop, drums)
- **Blue/cool colors dominant** = Mid-range focused (vocals, instruments)
- **Purple colors dominant** = Treble-rich (cymbals, bright sounds)
- **Mixed colors** = Full-spectrum sound (orchestral, rock)

### Song Structure
The "Section" label helps identify:
- **Intro**: Opening of the song, building atmosphere
- **Verse**: Main storytelling part, moderate energy
- **Build**: Tension increasing, energy rising
- **Chorus**: Main hook, higher energy
- **Drop**: Peak energy moment (in electronic music)

## Tips for Best Experience

1. **Start with Accessible Rhythm Mode** to learn the visual language
2. **Enable Enhanced Accessibility Mode** if shapes are too small
3. **Keep the visual legend visible** (shown in Accessible Rhythm mode)
4. **Watch the rhythm markers** at the bottom to see beat timing
5. **Enable haptic feedback** if available for additional beat awareness
6. **Try different visualization modes** to see which works best for you
7. **Adjust sensitivity sliders** to tune visual responsiveness

## Technical Implementation

### Audio Analysis Features
- **Beat detection**: Identifies rhythm timing using energy flux analysis
- **Frequency separation**: Splits audio into bass, mid, and treble bands
- **Kick detection**: Identifies low-frequency beats (20-220 Hz spikes)
- **Snare detection**: Identifies mid-frequency transients (220-2000 Hz)
- **Hi-hat detection**: Identifies high-frequency patterns (2000-9000 Hz)
- **Section detection**: Analyzes energy patterns to identify song structure
- **Pitch estimation**: Detects melody when present using autocorrelation

### Design Principles
1. **Consistency**: Same symbols always mean the same thing
2. **Clarity**: Large, simple shapes over complex graphics
3. **Contrast**: High-contrast colors for visibility
4. **Predictability**: Symbols appear in expected locations
5. **Simplicity**: Minimal visual clutter
6. **Smoothness**: Gentle animations, no jarring movements

## Browser Compatibility

- **Chrome/Edge**: Full support including haptic feedback
- **Firefox**: Full support (limited haptic on mobile)
- **Safari**: Full support on macOS and iOS
- **Mobile browsers**: Full support with touch controls and haptics

## Feedback Welcome

This system was designed with accessibility in mind. If you have suggestions for improvements or experience any issues, please provide feedback to help make it even more accessible.

---

**Remember**: Music is for everyone. This system proves that rhythm, structure, and musical emotion can be experienced visually, making music truly accessible to hearing-impaired users.
