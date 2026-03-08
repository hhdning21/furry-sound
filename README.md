# 🎵 Music Visualizer with Interactive Rhythm Game

A real-time music visualization and interactive rhythm game project with comprehensive **accessibility features** designed for hearing-impaired users.

## ✨ Key Features

- 🎮 **Interactive Rhythm Mode** - 4-lane rhythm game with keyboard/touch support
- 🎨 **Multiple Visualization Modes** - Real-time audio analysis with various visual effects
- ♿ **Accessibility First** - Visual rhythm language designed for hearing-impaired users
- 🌈 **Theme System** - Ice/Sunset theme switching
- 🎯 **Difficulty Levels** - Easy/Mid/Hard adjustable difficulty
- 📊 **Real-time Audio Analysis** - Using Web Audio API and librosa

---

## 🎮 Game Modes

### 1. Interactive Rhythm Mode ⭐
- **4-lane rhythm game**: Use D/F/J/K keys or touch controls
- **Hold notes**: Long press note system
- **Judgment system**: Perfect/Good/Miss timing windows
- **Combo tracking**: Combo system with score statistics
- **Dynamic particle background**: Integrated Particle Storm effects
- **Difficulty selection**: Easy/Mid/Hard

### 2. Other Visualization Modes
- **Resonance Water** - Ripple-based beat visualization
- **Rhythm Pulse Wall** - Frequency spectrum bars
- **Accessible Rhythm** - High contrast mode for hearing-impaired users

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+
- Python 3.10+ (3.11 recommended)

Check versions:
```bash
node -v    # Should be >= 18
npm -v     # Should be >= 9
python3 --version  # Should be >= 3.10
```

---

## 📦 Installation Steps

### 1️⃣ Backend Setup

#### Step 1: Install Node dependencies

```bash
cd backend
npm install
```

#### Step 2: Create Python virtual environment

```bash
# In backend directory
python3 -m venv fuzzy

# Activate virtual environment
# macOS/Linux:
source fuzzy/bin/activate
# Windows:
# fuzzy\Scripts\activate
```

#### Step 3: Install Python dependencies

```bash
pip install -r requirements.txt
```

> This will install librosa, numpy, scipy and other audio analysis libraries

#### Step 4: Configure environment variables

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` file:
```env
PORT=8787
PYTHON_BIN=python3  # Or: fuzzy/bin/python
GEMINI_API_KEY=your_api_key_here  # Optional
```

#### Step 5: Start backend server

```bash
npm run dev
```

Test backend:
```bash
curl http://localhost:8787/health
# Should return: {"status":"ok"}
```

---

### 2️⃣ Frontend Setup

#### Step 1: Install dependencies

```bash
cd frontend
npm install
```

#### Step 2: Configure environment (optional)

Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:8787
```

#### Step 3: Start frontend dev server

```bash
npm run dev
```

Open browser:
```
http://localhost:5173
```

---

## 🎯 Usage Guide

### Main Application

1. **Upload Music**
   - Click "Choose File" to upload MP3/WAV files
   - Or use preset music links

2. **Analyze Music**
   - Click "Analyze this song" button
   - Backend uses librosa to analyze audio features
   - View analysis results (tempo, pitch, mood, etc.)

3. **Play and Visualize**
   - Click "Play" to start playback
   - Real-time visualization responds to audio changes

### Music Visualizer

Visit `http://localhost:5173/music-visualizer/` for the full experience:

1. **Select Visualization Mode**:
   - Water (Ripple effects)
   - Pulse Wall (Spectrum bars)
   - Accessible (High contrast mode)
   - **Interactive** (Rhythm game mode) ⭐

2. **Interactive Mode Controls**:
   - **Keyboard**: D (Lane 1) / F (Lane 2) / J (Lane 3) / K (Lane 4)
   - **Touch**: Tap directly on lanes
   - **Judgments**:
     - Perfect: Hit within ±18px range
     - Good: Hit within ±34px range
     - Miss: Outside range or no hit

3. **Difficulty Selection**:
   - Easy: Longer note intervals, slower fall speed
   - Mid: Balanced mode
   - Hard: Dense notes, fast fall speed

4. **Theme Selection**:
   - Ice: Blue-cyan color scheme
   - Sunset: Red-orange color scheme

---

## 🏗️ 项目结构 / Project Structure

```
fuzzy-garbanzo/
├── backend/                    # 后端服务 / Backend service
│   ├── index.js               # Express服务器入口 / Express server entry
│   ├── librosa_analyzer.py    # Python音频分析脚本 / Python audio analysis
│   ├── geminiClient.js        # Gemini AI客户端 / Gemini AI client
│   ├── requirements.txt       # Python依赖 / Python dependencies
│   └── package.json           # Node依赖 / Node dependencies
│
├── frontend/                   # 前端应用 / Frontend application
│   ├── src/                   # React主应用源码 / React main app source
│   │   ├── App.tsx           # 主应用组件 / Main app component
│   │   ├── components/        # React组件 / React components
│   │   └── hooks/             # React Hooks
│   │
│   └── public/
│       └── music-visualizer/  # 独立音乐可视化器 / Standalone visualizer
│           ├── index.html     # 可视化器入口 / Visualizer entry
│           ├── main.js        # 主控制器 / Main controller
│           ├── audioEngine.js # 音频分析引擎 / Audio analysis engine
│           ├── uiControls.js  # UI控制 / UI controls
│           └── visualModes/   # 可视化模式 / Visualization modes
│               ├── interactive.js  # 🎮 互动节奏游戏 / Rhythm game
│               ├── water.js        # 水波效果 / Water effect
│               ├── pulseWall.js    # 脉冲墙 / Pulse wall
│               └── accessible.js   # 无障碍模式 / Accessible mode
│
└── fuzzy/                      # Python虚拟环境 / Python venv
    └── ...
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Audio Processing**: Web Audio API
- **Rendering**: Canvas 2D API
- **Styling**: CSS3 with modern features

### Backend
- **Runtime**: Node.js 18+ with Express
- **Audio Analysis**: Python 3.11 + librosa
- **AI Integration**: Google Gemini API (optional)
- **File Processing**: Multer for file uploads

### Core Libraries
- `librosa` - Audio feature extraction
- `numpy` - Numerical computation
- `scipy` - Signal processing
- `Web Audio API` - Real-time audio analysis

---

## 🎵 How It Works

### Audio Analysis Flow

```
1. User uploads audio file
   ↓
2. Frontend sends to backend
   ↓
3. Python librosa analysis:
   - Tempo
   - Beat frames
   - Spectral features
   - Onset strength
   ↓
4. Return analysis JSON
   ↓
5. Frontend real-time rendering:
   - Web Audio API gets frequency data
   - Canvas 2D draws visualization
   - Rhythm detection and note generation
```

### Interactive Mode Features

- **Beat Detection**: Real-time kick/snare/bass recognition
- **Note Generation**: Dynamically generated based on rhythm
- **Judgment System**: Pixel-distance based precise judgment
- **Visual Feedback**:
  - Hit explosion particles
  - Lane flash effects
  - Combo animations
  - Screen pulse on perfect hits
- **Particle Background**: 
  - Beat-driven bursts
  - Mid-frequency rotation
  - Treble brightness modulation

---

## 🧪 Testing

### Browser Test

1. Open main app: `http://localhost:5173`
2. Upload audio file (30-60s recommended)
3. Click "Analyze this song"
4. View analysis results
5. Click "Play" to start visualization

### Interactive Mode Test

1. Visit: `http://localhost:5173/music-visualizer/`
2. Select **Interactive** mode
3. Upload music and play
4. Test hit detection using D/F/J/K keys
5. Observe:
   - Note falling animation
   - Judgment display (Perfect/Good/Miss)
   - Combo count
   - Score statistics
   - Particle background effects

### API Test

```bash
# Health check
curl http://localhost:8787/health

# Audio analysis
curl -X POST http://localhost:8787/analyze \
  -F "audio=@/path/to/your/music.mp3"
```

Expected response:
```json
{
  "analysis": {
    "tempo": 120,
    "beats": [...],
    "mood": "energetic"
  },
  "audioFeatures": {
    "spectral_centroid": [...],
    "onset_strength": [...]
  }
}
```

---

## 🐞 Troubleshooting

### Backend won't start

```bash
# Check Python path
which python3

# Update PYTHON_BIN in .env
PYTHON_BIN=/path/to/python3
```

### librosa installation fails

```bash
# Ensure system dependencies
# macOS:
brew install portaudio

# Ubuntu/Debian:
sudo apt-get install libportaudio2

# Then reinstall:
pip install -r requirements.txt
```

### Frontend can't connect to backend

```bash
# Check if backend is running
curl http://localhost:8787/health

# Check frontend env
cat frontend/.env
# Should be: VITE_API_BASE_URL=http://localhost:8787
```

### Notes not spawning

- Ensure audio is playing (not paused)
- Check browser console for errors
- Try different audio files
- Adjust difficulty settings

---

## 📝 Development Notes

### Adding New Visualization Modes

1. Create new file in `frontend/public/music-visualizer/visualModes/`
2. Implement `render(ctx, data, t, width, height, theme)` method
3. Import and register in `main.js`
4. Add option in `index.html`

### Adjusting Judgment Windows

Edit judgment distances in `interactive.js`:
```javascript
// Perfect window
if (bestDistance <= 18) { ... }

// Good window  
if (bestDistance <= 34) { ... }

// Miss window
if (bestDistance <= 52) { ... }
```

### Modifying Particle Effects

Adjust particle count in `_initBgParticles()`:
```javascript
const targetCount = Math.min(1700, Math.max(700, ...));
```

---

## ♿ Accessibility Features

### Visual Rhythm Language

- **🔴 Large Circle Pulse (Center)** → Kick/Bass Beat - Main rhythm
- **🔷 Triangle Flash (Sides)** → Snare Hit - Rhythm accent
- **✨ Small Particles** → Hi-hat/Treble - High frequency details
- **🌊 Expanding Waves** → Bass Energy - Low frequency power

### Enhanced Accessibility Mode

- **50% larger shapes** for easier visibility
- **High contrast colors** with pure black background
- **Simplified visualization** with reduced clutter
- **On-screen legend** explaining all visual symbols
- **Color-coded rhythm markers** (kick=red, snare=blue, beat=cyan)
- **Haptic feedback** for beat awareness (mobile devices)

📖 **[View Complete Accessibility Guide](frontend/public/music-visualizer/ACCESSIBILITY.md)**

---

## 📄 License

This project is for educational and demonstration purposes.

---

## 🙏 Acknowledgments

- **librosa** - Python audio analysis library
- **Web Audio API** - Browser audio processing
- **Canvas API** - 2D graphics rendering
- **Google Gemini** - AI music feature mapping (optional)

---

## 📧 Contact

For questions or suggestions, please submit an Issue.

---

**Enjoy the music, enjoy the game! 🎮🎵**
