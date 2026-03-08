import { useEffect, useMemo, useState } from 'react';
import { GameStats, HitRecord, HitJudgement, RhythmBeatmap } from '../types';

const PERFECT_WINDOW_MS = 50;
const GOOD_WINDOW_MS = 100;
const MISS_WINDOW_MS = 150;
const APPROACH_SECONDS = 2;

type Props = {
  beatmap: RhythmBeatmap | null;
  currentTime: number;
  isPlaying: boolean;
  onStatsChange?: (stats: GameStats) => void;
  onHitsChange?: (hits: HitRecord[]) => void;
};

function judgementFromOffset(offsetMs: number): HitJudgement {
  const abs = Math.abs(offsetMs);
  if (abs <= PERFECT_WINDOW_MS) {
    return 'perfect';
  }
  if (abs <= GOOD_WINDOW_MS) {
    return 'good';
  }
  return 'miss';
}

function makeEmptyStats(totalNotes: number): GameStats {
  return {
    totalNotes,
    perfect: 0,
    good: 0,
    miss: 0,
    score: 0,
    accuracy: 0,
    maxCombo: 0,
    avgOffsetMs: 0
  };
}

function calculateStats(totalNotes: number, hits: HitRecord[]): GameStats {
  const perfect = hits.filter((h) => h.judgement === 'perfect').length;
  const good = hits.filter((h) => h.judgement === 'good').length;
  const miss = hits.filter((h) => h.judgement === 'miss').length;
  const score = perfect * 1000 + good * 600;
  const weighted = perfect * 1 + good * 0.7;
  const accuracy = totalNotes > 0 ? (weighted / totalNotes) * 100 : 0;

  let combo = 0;
  let maxCombo = 0;
  for (const hit of hits) {
    if (hit.judgement === 'miss') {
      combo = 0;
    } else {
      combo += 1;
      if (combo > maxCombo) {
        maxCombo = combo;
      }
    }
  }

  const offsetSource = hits.filter((h) => h.offsetMs !== null).map((h) => Math.abs(h.offsetMs as number));
  const avgOffsetMs =
    offsetSource.length > 0 ? offsetSource.reduce((sum, val) => sum + val, 0) / offsetSource.length : 0;

  return {
    totalNotes,
    perfect,
    good,
    miss,
    score,
    accuracy,
    maxCombo,
    avgOffsetMs
  };
}

export default function RhythmGame({ beatmap, currentTime, isPlaying, onStatsChange, onHitsChange }: Props) {
  const notes = beatmap?.notes ?? [];
  const [resolved, setResolved] = useState<boolean[]>([]);
  const [hits, setHits] = useState<HitRecord[]>([]);
  const [lastJudge, setLastJudge] = useState<HitJudgement | null>(null);

  useEffect(() => {
    setResolved(notes.map(() => false));
    setHits([]);
    setLastJudge(null);
  }, [beatmap, notes.length]);

  const stats = useMemo(() => calculateStats(notes.length, hits), [hits, notes.length]);

  useEffect(() => {
    onStatsChange?.(stats);
  }, [onStatsChange, stats]);

  useEffect(() => {
    onHitsChange?.(hits);
  }, [hits, onHitsChange]);

  const handleLaneInput = (lane: 0 | 1 | 2 | 3) => {
    if (!isPlaying) {
      return;
    }

    let bestIndex = -1;
    let bestAbs = Number.POSITIVE_INFINITY;
    let bestOffset = 0;

    notes.forEach((note, idx) => {
      if (resolved[idx] || note.lane !== lane) {
        return;
      }
      const offsetMs = Math.round((currentTime - note.timestamp) * 1000);
      const abs = Math.abs(offsetMs);
      if (abs <= MISS_WINDOW_MS && abs < bestAbs) {
        bestIndex = idx;
        bestAbs = abs;
        bestOffset = offsetMs;
      }
    });

    if (bestIndex === -1) {
      return;
    }

    const judgement = judgementFromOffset(bestOffset);
    setResolved((prev) => {
      const next = [...prev];
      next[bestIndex] = true;
      return next;
    });
    setHits((prev) => [
      ...prev,
      {
        noteIndex: bestIndex,
        lane,
        offsetMs: bestOffset,
        judgement,
        atTime: currentTime
      }
    ]);
    setLastJudge(judgement);
  };

  useEffect(() => {
    if (!isPlaying || notes.length === 0) {
      return;
    }

    setResolved((prev) => {
      const next = [...prev];
      let changed = false;
      const missed: HitRecord[] = [];

      notes.forEach((note, idx) => {
        if (next[idx]) {
          return;
        }
        const offsetMs = (currentTime - note.timestamp) * 1000;
        if (offsetMs > MISS_WINDOW_MS) {
          next[idx] = true;
          changed = true;
          missed.push({
            noteIndex: idx,
            lane: note.lane,
            offsetMs: Math.round(offsetMs),
            judgement: 'miss',
            atTime: currentTime
          });
        }
      });

      if (missed.length > 0) {
        setHits((curr) => [...curr, ...missed]);
        setLastJudge('miss');
      }

      return changed ? next : prev;
    });
  }, [currentTime, isPlaying, notes]);

  useEffect(() => {
    if (!beatmap) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const laneByKey: Record<string, 0 | 1 | 2 | 3> = {
        d: 0,
        f: 1,
        j: 2,
        k: 3
      };
      const lane = laneByKey[event.key.toLowerCase()];
      if (lane === undefined) {
        return;
      }
      event.preventDefault();
      handleLaneInput(lane);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beatmap, currentTime, isPlaying, notes, resolved]);

  const topNotes = notes
    .map((note, idx) => ({ note, idx }))
    .filter(({ note, idx }) => {
      if (resolved[idx]) {
        return false;
      }
      const delta = note.timestamp - currentTime;
      return delta <= APPROACH_SECONDS && delta >= -0.2;
    });

  const laneButtons: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

  const displayStats = notes.length > 0 ? stats : makeEmptyStats(0);

  return (
    <div className="card rhythm-game">
      <h1>Rhythm game</h1>
      <p className="small">Keys: D / F / J / K. Hit line near bottom. Perfect ±50ms, Good ±100ms, Miss ±150ms.</p>
      <div className="rhythm-track" role="application" aria-label="4 lane rhythm game track">
        <div className="rhythm-hitline" />
        {topNotes.map(({ note, idx }) => {
          const relative = note.timestamp - currentTime;
          const progress = 1 - relative / APPROACH_SECONDS;
          const topPercent = Math.max(0, Math.min(88, progress * 88));
          const duration = note.type === 'hold' ? note.duration ?? 0 : 0;
          const heightPercent = Math.max(4, (duration / APPROACH_SECONDS) * 88);

          return (
            <div
              key={`${idx}-${note.timestamp}-${note.lane}-${note.type}`}
              className={`rhythm-note type-${note.type}`}
              style={{
                left: `${note.lane * 25}%`,
                top: `${topPercent}%`,
                height: note.type === 'hold' ? `${heightPercent}%` : '18px'
              }}
            >
              {note.type === 'accent' ? 'A' : note.type === 'hold' ? 'H' : '•'}
            </div>
          );
        })}

        <div className="rhythm-lane-inputs">
          {laneButtons.map((lane) => (
            <button
              key={lane}
              type="button"
              className="lane-button"
              aria-label={`Lane ${lane + 1}`}
              onMouseDown={() => handleLaneInput(lane)}
              onTouchStart={() => handleLaneInput(lane)}
            >
              L{lane + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="small rhythm-inline-stats">
        <span>Notes: {displayStats.totalNotes}</span>
        <span>Perfect: {displayStats.perfect}</span>
        <span>Good: {displayStats.good}</span>
        <span>Miss: {displayStats.miss}</span>
        <span>Accuracy: {displayStats.accuracy.toFixed(1)}%</span>
      </div>

      <div className={`small judge-chip ${lastJudge ? `judge-${lastJudge}` : ''}`}>
        {lastJudge ? `Last: ${lastJudge.toUpperCase()}` : 'Last: -'}
      </div>
    </div>
  );
}
