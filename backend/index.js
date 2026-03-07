require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { analyzeAudioWithGemini } = require('./geminiClient');

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

app.post('/analyze', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded. Please use form-data key "audio".' });
    }

    const analysis = await analyzeAudioWithGemini({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname
    });

    return res.json({ analysis });
  } catch (error) {
    console.error('Analyze endpoint error:', error);
    return res.status(500).json({ error: 'Failed to analyze audio.' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Music animation backend running on http://localhost:${port}`);
});