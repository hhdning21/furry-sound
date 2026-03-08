require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { spawn } = require('child_process');
const { mkdtemp, rm, writeFile } = require('fs/promises');
const { mapFeaturesWithGemini, fallbackVisualFromFeatures, generateBeatmap } = require('./geminiClient');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'music-animation-backend' });
});

app.get('/proxy-audio', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Invalid preset URL.' });
    }

    const remote = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (MusicAnimationMVP)'
      }
    });

    if (!remote.ok || !remote.body) {
      return res.status(400).json({ error: `Failed to stream remote audio: ${remote.status}` });
    }

    const contentType = remote.headers.get('content-type') || 'audio/mpeg';
    const contentLength = remote.headers.get('content-length');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(remote.body).pipe(res);
  } catch (error) {
    console.error('Proxy-audio endpoint error:', error);
    return res.status(500).json({ error: 'Failed to proxy audio.' });
  }
});

async function runLibrosaAnalyzer(fileBuffer, originalName) {
  const pythonBin = process.env.PYTHON_BIN || 'python3';
  const analyzerPath = path.join(__dirname, 'librosa_analyzer.py');
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'music-animation-'));
  const extension = path.extname(originalName || '') || '.wav';
  const audioPath = path.join(tempDir, `input${extension}`);

  try {
    await writeFile(audioPath, fileBuffer);

    const output = await new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [analyzerPath, audioPath]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => reject(error));

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Python analyzer exited with code ${code}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(new Error(`Failed to parse analyzer output: ${stdout}\n${parseError}`));
        }
      });
    });

    return output;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

app.post('/analyze', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded. Please use form-data key "audio".' });
    }

    const librosaResult = await runLibrosaAnalyzer(req.file.buffer, req.file.originalname);

    if (!librosaResult?.analysis) {
      return res.status(500).json({ error: 'Analyzer did not return a valid analysis object.' });
    }

    const mapped = await mapFeaturesWithGemini({
      audioFeatures: librosaResult.audioFeatures || {},
      fileName: req.file.originalname,
      baseAnalysis: librosaResult.analysis
    });

    return res.json({ analysis: mapped, audioFeatures: librosaResult.audioFeatures || null });
  } catch (error) {
    console.error('Analyze endpoint error:', error);
    return res.status(500).json({ error: 'Failed to analyze audio.' });
  }
});

app.post('/analyze-url', async (req, res) => {
  try {
    const { url, name } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing audio URL.' });
    }

    const remote = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (MusicAnimationMVP)'
      }
    });
    if (!remote.ok) {
      const fallbackFeatures = {
        tempo: 110,
        tempoNorm: 0.61,
        volume: 0.48,
        brightness: 0.52,
        lowEnergy: 0.5,
        midEnergy: 0.5,
        highEnergy: 0.5,
        dominantNote: 'A',
        beatTimes: []
      };
      const fallbackAnalysis = fallbackVisualFromFeatures(fallbackFeatures, name || 'preset.mp3');
      const mapped = await mapFeaturesWithGemini({
        audioFeatures: fallbackFeatures,
        fileName: name || 'preset.mp3',
        baseAnalysis: fallbackAnalysis
      });

      return res.json({
        analysis: {
          ...mapped,
          explanation: `${mapped.explanation} Preset URL download was blocked (${remote.status}), so fallback profile was used.`
        },
        audioFeatures: fallbackFeatures,
        warning: `Remote audio provider blocked backend download (${remote.status}).`
      });
    }

    const arrayBuffer = await remote.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const librosaResult = await runLibrosaAnalyzer(buffer, name || 'preset.mp3');
    if (!librosaResult?.analysis) {
      return res.status(500).json({ error: 'Analyzer did not return a valid analysis object.' });
    }

    const mapped = await mapFeaturesWithGemini({
      audioFeatures: librosaResult.audioFeatures || {},
      fileName: name || 'preset.mp3',
      baseAnalysis: librosaResult.analysis
    });

    return res.json({ analysis: mapped, audioFeatures: librosaResult.audioFeatures || null });
  } catch (error) {
    console.error('Analyze-url endpoint error:', error);
    return res.status(500).json({ error: 'Failed to analyze audio URL.' });
  }
});

app.post('/generate-beatmap', upload.single('audio'), async (req, res) => {
  try {
    const difficulty = req.body?.difficulty || 'medium';
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty. Must be "easy", "medium", or "hard".' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded. Please use form-data key "audio".' });
    }

    // Run librosa analyzer to extract beat frames, tempo, sections, and energy
    const librosaResult = await runLibrosaAnalyzer(req.file.buffer, req.file.originalname);

    if (!librosaResult?.audioFeatures) {
      return res.status(500).json({ error: 'Analyzer did not return valid audio features.' });
    }

    // Merge sections from analysis into audioFeatures for beatmap generation
    const enrichedFeatures = {
      ...librosaResult.audioFeatures,
      sections: librosaResult.analysis?.sections || []
    };

    // Generate beatmap using Gemini AI
    const beatmap = await generateBeatmap({
      audioFeatures: enrichedFeatures,
      difficulty
    });

    return res.json({
      beatmap,
      audioFeatures: librosaResult.audioFeatures
    });
  } catch (error) {
    console.error('Generate-beatmap endpoint error:', error);
    return res.status(500).json({ error: 'Failed to generate beatmap.' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Music animation backend running on http://localhost:${port}`);
});