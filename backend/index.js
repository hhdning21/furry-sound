require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { mkdtemp, rm, writeFile } = require('fs/promises');

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

    return res.json({
      analysis: librosaResult.analysis,
      audioFeatures: librosaResult.audioFeatures || null
    });
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

    const remote = await fetch(url);
    if (!remote.ok) {
      return res.status(400).json({ error: `Failed to download remote audio: ${remote.status}` });
    }

    const arrayBuffer = await remote.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const librosaResult = await runLibrosaAnalyzer(buffer, name || 'preset.mp3');
    if (!librosaResult?.analysis) {
      return res.status(500).json({ error: 'Analyzer did not return a valid analysis object.' });
    }

    return res.json({
      analysis: librosaResult.analysis,
      audioFeatures: librosaResult.audioFeatures || null
    });
  } catch (error) {
    console.error('Analyze-url endpoint error:', error);
    return res.status(500).json({ error: 'Failed to analyze audio URL.' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Music animation backend running on http://localhost:${port}`);
});