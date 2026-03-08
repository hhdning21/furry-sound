import { GameStats, HitRecord } from '../types';

type Props = {
  stats: GameStats;
  recentHits: HitRecord[];
};

export default function GameResults({ stats, recentHits }: Props) {
  return (
    <div className="card rhythm-results">
      <h1>Game results</h1>
      <div className="kv rhythm-kv">
        <strong>Score</strong>
        <span>{stats.score}</span>
        <strong>Accuracy</strong>
        <span>{stats.accuracy.toFixed(1)}%</span>
        <strong>Perfect / Good / Miss</strong>
        <span>
          {stats.perfect} / {stats.good} / {stats.miss}
        </span>
        <strong>Max combo</strong>
        <span>{stats.maxCombo}</span>
        <strong>Avg offset</strong>
        <span>{stats.avgOffsetMs.toFixed(1)} ms</span>
      </div>

      <div className="small rhythm-hitlog">
        <strong>Recent timing offsets</strong>
        {recentHits.length === 0 ? (
          <div>No hits yet.</div>
        ) : (
          <ul>
            {recentHits.slice(-8).reverse().map((hit, index) => (
              <li key={`${hit.noteIndex}-${hit.atTime}-${index}`} className={`hit-${hit.judgement}`}>
                L{hit.lane + 1} · {hit.judgement.toUpperCase()} ·{' '}
                {hit.offsetMs === null ? 'auto miss' : `${hit.offsetMs > 0 ? '+' : ''}${hit.offsetMs}ms`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
