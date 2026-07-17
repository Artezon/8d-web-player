import freeverb from "@audio/reverb-freeverb";

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let panner: PannerNode | null = null;
let convolver: ConvolverNode | null = null;
let bassBoostFilter: BiquadFilterNode | null = null;
let playStartTime = 0;
let pauseOffset = 0;
let isPlaying = false;
let isLooping = false;
let savedAngle = 0;
let currentRPM = 0;
let currentRadius = 3;
let onEndedCallback: (() => void) | null = null;

function saveAngle(): void {
  if (!audioCtx || !isPlaying) return;
  const elapsed = audioCtx.currentTime - playStartTime;
  savedAngle += (currentRPM / 60) * 2 * Math.PI * elapsed;
  savedAngle %= Math.PI * 2;
  if (savedAngle < 0) savedAngle += Math.PI * 2;
}

function startSource(offset: number): void {
  playStartTime = audioCtx!.currentTime;
  const src = audioCtx!.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(panner!);
  src.onended = onEnded;
  src.start(0, offset);
  sourceNode = src;
}

function stopSource(): void {
  if (!sourceNode) return;
  sourceNode.onended = null;
  try {
    sourceNode.stop();
  } catch {}
  sourceNode = null;
}

export function setOnEndedCallback(callback: (() => void) | null): void {
  onEndedCallback = callback;
}

function onEnded(): void {
  sourceNode = null;
  pauseOffset = 0;
  saveAngle();
  if (isLooping && isPlaying) {
    startSource(0);
  } else {
    isPlaying = false;
    onEndedCallback?.();
  }
}

export function ensureAudioPipeline(): void {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  panner = audioCtx.createPanner();
  panner.panningModel = "HRTF";
  panner.refDistance = 2;
  panner.positionY.setValueAtTime(0, audioCtx.currentTime);
  convolver = audioCtx.createConvolver();
  bassBoostFilter = audioCtx.createBiquadFilter();
  bassBoostFilter.type = "lowshelf";
  bassBoostFilter.frequency.value = 105;
  panner.connect(convolver).connect(bassBoostFilter).connect(audioCtx.destination);
}

export async function loadAudio(data: ArrayBuffer): Promise<void> {
  if (isPlaying) {
    stopSource();
    isPlaying = false;
  }
  savedAngle = 0;
  pauseOffset = 0;
  audioBuffer = await audioCtx!.decodeAudioData(data);
}

export function play(): void {
  if (!audioCtx || !audioBuffer || !panner || isPlaying) return;

  stopSource();

  if (pauseOffset >= audioBuffer.duration) pauseOffset = 0;

  startSource(pauseOffset);
  isPlaying = true;
}

export function pause(): void {
  if (!isPlaying || !audioCtx) return;
  pauseOffset = currentOffset();
  saveAngle();
  stopSource();
  isPlaying = false;
}

export function currentOffset(): number {
  if (!isPlaying || !audioCtx || !audioBuffer) return pauseOffset;
  const elapsed = audioCtx.currentTime - playStartTime;
  return Math.min(pauseOffset + elapsed, audioBuffer.duration);
}

export function seekTo(offset: number): void {
  if (!audioBuffer) return;
  pauseOffset = Math.max(0, Math.min(offset, audioBuffer.duration));

  if (isPlaying) {
    saveAngle();
    stopSource();
    startSource(pauseOffset);
  }
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

export function getIsLooping(): boolean {
  return isLooping;
}

export function getBuffer(): AudioBuffer | null {
  return audioBuffer;
}

export function getRPM(): number {
  return currentRPM;
}

export function getAngle(): number {
  if (!isPlaying || !audioCtx) return savedAngle;
  const elapsed = audioCtx.currentTime - playStartTime;
  const total = savedAngle + (currentRPM / 60) * 2 * Math.PI * elapsed;
  const norm = total % (Math.PI * 2);
  return norm >= 0 ? norm : norm + Math.PI * 2;
}

export function setLooping(v: boolean): void {
  isLooping = v;
}

export function setRPM(rpm: number): void {
  if (currentRPM !== rpm && isPlaying) {
    pauseOffset = currentOffset();
    saveAngle();
    playStartTime = audioCtx!.currentTime;
  }
  currentRPM = rpm;
}

export function setRadius(radius: number): void {
  currentRadius = radius;
}

export function setPannerPosition(angle: number): void {
  if (!panner || !audioCtx) return;
  const x = currentRadius * Math.sin(angle);
  const z = -currentRadius * Math.cos(angle);
  panner.positionX.setValueAtTime(x, audioCtx.currentTime);
  panner.positionZ.setValueAtTime(z, audioCtx.currentTime);
}

export function updateReverb(room: number, damp: number, mix: number): void {
  if (!convolver || !audioCtx) return;
  convolver.buffer = generateFreeverbIR(audioCtx, room, damp, mix);
}

export function updateBassBoost(gain: number): void {
  if (!bassBoostFilter) return;
  bassBoostFilter.gain.value = gain;
}

export function tryResume(): Promise<void> | undefined {
  return audioCtx?.state === "suspended" ? audioCtx.resume() : undefined;
}

function generateFreeverbIR(
  ctx: AudioContext,
  room: number,
  damp: number,
  mix: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(sr * duration);
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  left[0] = 1;
  right[0] = 1;
  freeverb([left, right], { room, damp, mix, fs: sr });
  const buf = ctx.createBuffer(2, len, sr);
  buf.getChannelData(0).set(left);
  buf.getChannelData(1).set(right);
  return buf;
}
