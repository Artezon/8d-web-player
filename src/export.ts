import {
  Output,
  BufferTarget,
  WavOutputFormat,
  Mp3OutputFormat,
  FlacOutputFormat,
  AudioBufferSource,
} from "mediabunny";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";
import { type AudioSettings, generateFreeverbIR } from "./audio";

let encodersRegistered = false;

function ensureEncoders(): void {
  if (encodersRegistered) return;
  registerMp3Encoder();
  registerFlacEncoder();
  encodersRegistered = true;
}

export function replaceExt(base: string, ext: string): string {
  const dot = base.lastIndexOf(".");
  const name = dot > 0 ? base.slice(0, dot) : base;
  return `${name}.${ext}`;
}

export async function render(buffer: AudioBuffer, settings: AudioSettings): Promise<AudioBuffer> {
  const duration = buffer.duration;
  if (duration <= 0) throw new Error("Track is empty");

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.refDistance = 2;
  panner.positionY.value = 0;

  const convolver = ctx.createConvolver();
  convolver.buffer = generateFreeverbIR(ctx, settings.room, settings.damp, settings.mix);

  const bassBoost = ctx.createBiquadFilter();
  bassBoost.type = "lowshelf";
  bassBoost.frequency.value = 105;
  bassBoost.gain.value = settings.bassGain;

  source.connect(panner).connect(convolver).connect(bassBoost).connect(ctx.destination);

  const interval = 0.0001;
  const numPoints = Math.ceil(duration / interval);
  const xCurve = new Float32Array(numPoints);
  const zCurve = new Float32Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const t = i * interval;
    const angle = (settings.rpm / 60) * 2 * Math.PI * t;
    xCurve[i] = settings.radius * Math.sin(angle);
    zCurve[i] = -settings.radius * Math.cos(angle);
  }
  panner.positionX.setValueCurveAtTime(xCurve, 0, duration);
  panner.positionZ.setValueCurveAtTime(zCurve, 0, duration);

  source.start(0);
  return ctx.startRendering();
}

export type ExportFormat = "wav" | "mp3" | "flac";

export async function encodeAudio(
  renderedBuf: AudioBuffer,
  format: ExportFormat,
): Promise<ArrayBuffer> {
  ensureEncoders();

  const codec = format === "wav" ? "pcm-s16" : format;
  const bitrate = format === "mp3" ? 320000 : undefined;
  const transform = format === "flac" ? { sampleFormat: "s16" as const } : undefined;
  const outputFormat = (() => {
    switch (format) {
      case "flac":
        return new FlacOutputFormat();
      case "mp3":
        return new Mp3OutputFormat();
      default:
        return new WavOutputFormat();
    }
  })();

  const output = new Output({
    format: outputFormat,
    target: new BufferTarget(),
  });
  const audioSource = new AudioBufferSource({
    codec,
    ...(bitrate ? { bitrate } : {}),
    ...(transform ? { transform } : {}),
  });
  output.addAudioTrack(audioSource);
  await output.start();
  await audioSource.add(renderedBuf);
  audioSource.close();
  await output.finalize();

  return output.target.buffer!;
}

export function downloadBuffer(data: ArrayBuffer, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
