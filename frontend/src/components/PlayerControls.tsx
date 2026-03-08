import { AnalysisResult, RhythmDifficulty, VisualMode } from '../types';

type Props = {
	selectedTrackName: string | null;
	analysis: AnalysisResult | null;
	isAnalyzing: boolean;
	isPlaying: boolean;
	visualMode: VisualMode;
	rhythmDifficulty: RhythmDifficulty;
	onAnalyze: () => void;
	onPlayPause: () => void;
	onVisualModeChange: (mode: VisualMode) => void;
	onRhythmDifficultyChange: (difficulty: RhythmDifficulty) => void;
};

export default function PlayerControls({
	selectedTrackName,
	analysis,
	isAnalyzing,
	isPlaying,
	visualMode,
	rhythmDifficulty,
	onAnalyze,
	onPlayPause,
	onVisualModeChange,
	onRhythmDifficultyChange
}: Props) {
	return (
		<>
			<div className="card">
				<h1>2) Analyze and play</h1>
				<div className="small">Selected: {selectedTrackName ?? 'No track selected'}</div>
				<select
					value={rhythmDifficulty}
					onChange={(event) => onRhythmDifficultyChange(event.target.value as RhythmDifficulty)}
				>
					<option value="Easy">Beatmap difficulty: Easy</option>
					<option value="Medium">Beatmap difficulty: Medium</option>
					<option value="Hard">Beatmap difficulty: Hard</option>
				</select>
				<button onClick={onAnalyze} disabled={!selectedTrackName || isAnalyzing}>
					{isAnalyzing ? 'Analyzing & generating beatmap…' : 'Analyze + Generate beatmap'}
				</button>

				<button onClick={onPlayPause} disabled={!selectedTrackName}>
					{isPlaying ? 'Pause' : 'Play'}
				</button>

				<select
					value={visualMode}
					onChange={(event) => onVisualModeChange(event.target.value as VisualMode)}
				>
					<option value="auto">Visual mode: Auto (Gemini mood)</option>
					<option value="calm">Visual mode: Calm</option>
					<option value="energetic">Visual mode: Energetic</option>
					<option value="sad">Visual mode: Sad</option>
					<option value="happy">Visual mode: Happy</option>
				</select>
			</div>

			<div className="card">
				<h1>Simple mapping legend</h1>
				<div className="kv">
					<strong>Low freq</strong>
					<span>Main shape scale (kick / bass)</span>
					<strong>Mid freq</strong>
					<span>Background wave movement (vocal body)</span>
					<strong>High freq</strong>
					<span>Particle count + sharpness (hihat / synth)</span>
					<strong>Volume</strong>
					<span>Overall brightness</span>
				</div>
			</div>

			{analysis && (
				<div className="card">
					<h1>Gemini output</h1>
					<p className="small">
						<strong>Mood:</strong> {analysis.mood}
						<br />
						<strong>Style:</strong> {analysis.animationStyle}
						<br />
						<strong>Motion speed:</strong> {analysis.motionSpeed.toFixed(2)}
					</p>
					<p className="small">{analysis.explanation}</p>
				</div>
			)}
		</>
	);
}
