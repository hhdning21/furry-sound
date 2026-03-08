const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const MOODS = ['calm', 'energetic', 'sad', 'happy'];
const STYLES = ['pulses', 'smooth_waves', 'sharp_particles'];

function moodFromName(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('sad') || lower.includes('blue') || lower.includes('rain')) {
    return 'sad';
  }
  if (lower.includes('happy') || lower.includes('sun') || lower.includes('joy')) {
    return 'happy';
  }
  if (lower.includes('rock') || lower.includes('edm') || lower.includes('beat') || lower.includes('energy')) {
    return 'energetic';
  }
  return 'calm';
}

function fallbackVisualFromFeatures(audioFeatures = {}, fileName = '') {
  const inferredMood = moodFromName(fileName);
  const tempoNorm = Number(audioFeatures.tempoNorm || 0.5);
  const brightness = Number(audioFeatures.brightness || 0.4);
  const highEnergy = Number(audioFeatures.highEnergy || 0.4);
  const volume = Number(audioFeatures.volume || 0.4);

  let mood = inferredMood;
  if (tempoNorm > 0.72 || volume > 0.62) {
    mood = 'energetic';
  } else if (brightness > 0.65 && volume > 0.35) {
    mood = 'happy';
  } else if (tempoNorm < 0.45 && brightness < 0.42) {
    mood = 'sad';
  }

  const profiles = {
    calm: {
      palette: ['#0f2448', '#1b6170', '#4bb2ad'],
      animationStyle: 'smooth_waves',
      motionSpeed: 0.85
    },
    energetic: {
      palette: ['#2d1208', '#ff6b00', '#ffbe0b'],
      animationStyle: 'sharp_particles',
      motionSpeed: 1.45
    },
    sad: {
      palette: ['#111736', '#2b3a7e', '#6d6ab5'],
      animationStyle: 'pulses',
      motionSpeed: 0.7
    },
    happy: {
      palette: ['#1f4d10', '#99da24', '#ffe16d'],
      animationStyle: 'pulses',
      motionSpeed: 1.1
    }
  };

  const chosen = profiles[mood];
  const style = highEnergy > 0.68 ? 'sharp_particles' : chosen.animationStyle;
  const speed = Math.max(0.45, Math.min(1.9, chosen.motionSpeed * (0.8 + tempoNorm * 0.55)));

  return {
    mood,
    palette: chosen.palette,
    animationStyle: style,
    motionSpeed: Number(speed.toFixed(2)),
    explanation: 'Mapped from librosa features with local fallback logic.',
    sections: []
  };
}

function normalizeResult(raw, fallback) {
  return {
    mood: MOODS.includes(raw?.mood) ? raw.mood : fallback.mood,
    palette:
      Array.isArray(raw?.palette) && raw.palette.length >= 3
        ? raw.palette.map((c) => String(c)).slice(0, 5)
        : fallback.palette,
    animationStyle: STYLES.includes(raw?.animationStyle) ? raw.animationStyle : fallback.animationStyle,
    motionSpeed:
      typeof raw?.motionSpeed === 'number' && Number.isFinite(raw.motionSpeed)
        ? Math.min(2, Math.max(0.4, raw.motionSpeed))
        : fallback.motionSpeed,
    explanation:
      typeof raw?.explanation === 'string' && raw.explanation.trim().length
        ? raw.explanation
        : fallback.explanation,
    sections: Array.isArray(raw?.sections)
      ? raw.sections
          .slice(0, 8)
          .map((s) => ({
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            localMood: MOODS.includes(s.localMood) ? s.localMood : fallback.mood
          }))
      : fallback.sections || []
  };
}

function extractJsonObject(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in Gemini response.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function mapFeaturesWithGemini({ audioFeatures = {}, fileName = '', baseAnalysis = null }) {
  const fallback = baseAnalysis || fallbackVisualFromFeatures(audioFeatures, fileName);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const prompt = `You are helping a hackathon MVP that maps music features to visuals.
Given librosa features, return ONLY strict JSON.

Input features:
${JSON.stringify({ fileName, audioFeatures }, null, 2)}

JSON schema:
{
  "mood": "calm" | "energetic" | "sad" | "happy",
  "palette": ["#hex", "#hex", "#hex"],
  "animationStyle": "pulses" | "smooth_waves" | "sharp_particles",
  "motionSpeed": number,
  "explanation": string,
  "sections": [{ "start": number, "end": number, "localMood": "calm" | "energetic" | "sad" | "happy" }]
}

Rules:
- motionSpeed in [0.4, 2.0]
- palette length 3..5
- short explanation mentioning beat/tempo or note/brightness
- JSON only, no markdown`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 420
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`Gemini API failed: ${reason}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
    const raw = extractJsonObject(text);
    return normalizeResult(raw, fallback);
  } catch (error) {
    console.error('Gemini mapping failed, fallback is used.', error);
    return fallback;
  }
}

async function generateBeatmap({ audioFeatures = {}, difficulty = 'medium' }) {
  const fallback = {
    difficulty,
    beats: (audioFeatures.beatTimes || []).map((timestamp, idx) => ({
      timestamp,
      type: idx % 4 === 0 ? 'accent' : 'normal',
      expectedIntensity: 0.5
    })),
    explanation: 'Fallback beatmap generated from beat times.'
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const prompt = `You are a rhythm game beatmap generator. Based on audio analysis data, create a difficulty-graded beatmap.

Input data:
- Tempo: ${audioFeatures.tempo || 120} BPM
- Beat frames: ${JSON.stringify((audioFeatures.beatFrames || []).slice(0, 50))}
- Beat times (seconds): ${JSON.stringify((audioFeatures.beatTimes || []).slice(0, 50))}
- Energy levels: low=${audioFeatures.lowEnergy || 0.5}, mid=${audioFeatures.midEnergy || 0.5}, high=${audioFeatures.highEnergy || 0.5}
- Sections: ${JSON.stringify(audioFeatures.sections || [])}
- Difficulty: ${difficulty}

Generate a beatmap JSON with this schema:
{
  "difficulty": "easy" | "medium" | "hard",
  "beats": [
    {
      "timestamp": number (seconds),
      "type": "normal" | "accent",
      "expectedIntensity": number (0.0-1.0)
    }
  ],
  "explanation": string
}

Rules:
- For "easy": place beats on strong downbeats only (every 2-4 beats), expectedIntensity 0.3-0.6
- For "medium": place beats on most detected beats, accent every 4th beat, expectedIntensity 0.4-0.7
- For "hard": place beats on all detected beats plus syncopation, accent on high-energy moments, expectedIntensity 0.5-0.9
- Use energy levels and sections to vary expectedIntensity throughout the song
- Mark beats as "accent" during high-energy sections or on downbeats
- Ensure timestamps are sorted chronologically
- Limit to 100 beats maximum
- Return ONLY valid JSON, no markdown`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`Gemini API failed: ${reason}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
    const raw = extractJsonObject(text);

    // Validate and normalize beatmap
    const normalizedBeats = Array.isArray(raw.beats)
      ? raw.beats
          .filter(b => typeof b.timestamp === 'number' && b.timestamp >= 0)
          .map(b => ({
            timestamp: Number(b.timestamp.toFixed(3)),
            type: ['normal', 'accent'].includes(b.type) ? b.type : 'normal',
            expectedIntensity: Math.max(0, Math.min(1, Number(b.expectedIntensity) || 0.5))
          }))
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, 100)
      : fallback.beats;

    return {
      difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : difficulty,
      beats: normalizedBeats,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : fallback.explanation
    };
  } catch (error) {
    console.error('Gemini beatmap generation failed, using fallback.', error);
    return fallback;
  }
}

module.exports = {
  mapFeaturesWithGemini,
  fallbackVisualFromFeatures,
  generateBeatmap
};
