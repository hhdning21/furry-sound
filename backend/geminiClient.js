const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function fallbackFromFilename(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('sad') || lower.includes('blue')) {
    return {
      mood: 'sad',
      palette: ['#111736', '#2b3a7e', '#6d6ab5'],
      animationStyle: 'smooth_waves',
      motionSpeed: 0.7,
      explanation: 'Fallback result: filename suggests a calmer/sadder atmosphere.'
    };
  }
  if (lower.includes('happy') || lower.includes('sun')) {
    return {
      mood: 'happy',
      palette: ['#1f4d10', '#99da24', '#ffe16d'],
      animationStyle: 'pulses',
      motionSpeed: 1.1,
      explanation: 'Fallback result: filename suggests a brighter/happier atmosphere.'
    };
  }
  if (lower.includes('rock') || lower.includes('edm') || lower.includes('beat')) {
    return {
      mood: 'energetic',
      palette: ['#2d1208', '#ff6b00', '#ffbe0b'],
      animationStyle: 'sharp_particles',
      motionSpeed: 1.45,
      explanation: 'Fallback result: filename suggests a high-energy atmosphere.'
    };
  }
  return {
    mood: 'calm',
    palette: ['#0f2448', '#1b6170', '#4bb2ad'],
    animationStyle: 'smooth_waves',
    motionSpeed: 0.9,
    explanation: 'Fallback result: default calm profile was applied.'
  };
}

function normalizeResult(raw, fallbackName) {
  const fallback = fallbackFromFilename(fallbackName);
  return {
    mood: ['calm', 'energetic', 'sad', 'happy'].includes(raw?.mood) ? raw.mood : fallback.mood,
    palette:
      Array.isArray(raw?.palette) && raw.palette.length >= 3
        ? raw.palette.slice(0, 5)
        : fallback.palette,
    animationStyle: ['pulses', 'smooth_waves', 'sharp_particles'].includes(raw?.animationStyle)
      ? raw.animationStyle
      : fallback.animationStyle,
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
            localMood: ['calm', 'energetic', 'sad', 'happy'].includes(s.localMood)
              ? s.localMood
              : fallback.mood
          }))
      : []
  };
}

function extractJsonObject(text) {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in Gemini response.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function analyzeAudioWithGemini({ audioBuffer, mimeType, fileName }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackFromFilename(fileName);
  }

  const prompt = `You are helping a hackathon MVP for converting music to visuals.
Analyze this short audio clip and return ONLY a strict JSON object.

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
- Keep motionSpeed between 0.4 and 2.0
- palette should have 3 to 5 colors
- explanation should be one short sentence
- sections is optional but if provided use up to 6 sections
- return JSON only, no markdown`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'audio/mpeg',
              data: audioBuffer.toString('base64')
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`Gemini API failed: ${reason}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
    const rawJson = extractJsonObject(text);
    return normalizeResult(rawJson, fileName);
  } catch (error) {
    console.error('Gemini analysis failed, fallback is used.', error);
    return fallbackFromFilename(fileName);
  }
}

module.exports = { analyzeAudioWithGemini };
// backend/geminiClient.js
