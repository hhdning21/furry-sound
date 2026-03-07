import { useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeFeatures } from '../types';

const INITIAL_FEATURES: RealtimeFeatures = {
	low: 0,
	mid: 0,
	high: 0,
	volume: 0,
	beat: 0
};

function averageBand(values: Uint8Array, fromHz: number, toHz: number, sampleRate: number): number {
	if (!values.length) {
		return 0;
	}
	const nyquist = sampleRate / 2;
	const startIndex = Math.floor((fromHz / nyquist) * values.length);
	const endIndex = Math.max(startIndex + 1, Math.floor((toHz / nyquist) * values.length));

	let sum = 0;
	for (let i = startIndex; i < endIndex && i < values.length; i += 1) {
		sum += values[i];
	}
	return sum / ((endIndex - startIndex) * 255);
}

export function useAudioAnalyzer(src: string | null) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const contextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
	const frameRef = useRef<number>(0);
	const beatEnergyRef = useRef(0);

	const [isPlaying, setIsPlaying] = useState(false);
	const [features, setFeatures] = useState<RealtimeFeatures>(INITIAL_FEATURES);
	const [playbackError, setPlaybackError] = useState<string>('');
	const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');

	useEffect(() => {
		const audio = new Audio();
		audio.crossOrigin = 'anonymous';
		audio.preload = 'auto';
		if (src) {
			audio.src = src;
		}
		audioRef.current = audio;

		const handlePlay = () => setIsPlaying(true);
		const handlePause = () => setIsPlaying(false);
		const handleEnd = () => setIsPlaying(false);
		const handleLoadStart = () => setPlaybackStatus('loading');
		const handleCanPlay = () => setPlaybackStatus('ready');
		const handleError = () => {
			setPlaybackStatus('error');
			setPlaybackError('Audio failed to play. Try local upload MP3/WAV.');
		};

		audio.addEventListener('play', handlePlay);
		audio.addEventListener('pause', handlePause);
		audio.addEventListener('ended', handleEnd);
		audio.addEventListener('loadstart', handleLoadStart);
		audio.addEventListener('canplay', handleCanPlay);
		audio.addEventListener('error', handleError);

		return () => {
			cancelAnimationFrame(frameRef.current);
			audio.pause();
			audio.removeEventListener('play', handlePlay);
			audio.removeEventListener('pause', handlePause);
			audio.removeEventListener('ended', handleEnd);
			audio.removeEventListener('loadstart', handleLoadStart);
			audio.removeEventListener('canplay', handleCanPlay);
			audio.removeEventListener('error', handleError);

			sourceRef.current?.disconnect();
			analyserRef.current?.disconnect();
			contextRef.current?.close();

			sourceRef.current = null;
			analyserRef.current = null;
			contextRef.current = null;
			beatEnergyRef.current = 0;
		};
	}, [src]);

	const ensureGraph = async () => {
		if (!audioRef.current) {
			return;
		}
		if (contextRef.current && analyserRef.current && sourceRef.current) {
			return;
		}

		const context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.85;

		const source = context.createMediaElementSource(audioRef.current);
		source.connect(analyser);
		analyser.connect(context.destination);

		contextRef.current = context;
		analyserRef.current = analyser;
		sourceRef.current = source;
	};

	const tick = () => {
		const analyser = analyserRef.current;
		const context = contextRef.current;
		if (!analyser || !context) {
			return;
		}

		const freq = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(freq);

		const low = averageBand(freq, 0, 250, context.sampleRate);
		const mid = averageBand(freq, 250, 2000, context.sampleRate);
		const high = averageBand(freq, 2000, 8000, context.sampleRate);
		const volume = Math.min(1, low * 0.4 + mid * 0.35 + high * 0.25);

		const flux = Math.max(0, low - beatEnergyRef.current);
		beatEnergyRef.current = beatEnergyRef.current * 0.9 + low * 0.1;
		const beat = Math.min(1, flux * 5);

		setFeatures({ low, mid, high, volume, beat });
		frameRef.current = requestAnimationFrame(tick);
	};

	const play = async () => {
		if (!audioRef.current || !src) {
			return;
		}
		setPlaybackError('');
		setPlaybackStatus('loading');
		await ensureGraph();
		if (contextRef.current?.state === 'suspended') {
			await contextRef.current.resume();
		}
		try {
			await audioRef.current.play();
			setPlaybackStatus('playing');
		} catch (_error) {
			setPlaybackStatus('error');
			setPlaybackError('Playback was blocked or failed. Try clicking Play again or upload a local file.');
			return;
		}

		cancelAnimationFrame(frameRef.current);
		frameRef.current = requestAnimationFrame(tick);
	};

	const pause = () => {
		audioRef.current?.pause();
	};

	const toggle = () => {
		if (isPlaying) {
			pause();
		} else {
			void play();
		}
	};

	return useMemo(
		() => ({
			isPlaying,
			features,
			playbackError,
			playbackStatus,
			play,
			pause,
			toggle
		}),
		[features, isPlaying, playbackError, playbackStatus]
	);
}
