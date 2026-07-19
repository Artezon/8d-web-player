import "@fontsource-variable/inter/wght.css";
import "./assets/main.css";
import * as Audio from "./audio";
import * as Visualizer from "./visualizer";
import { fmtPercent, fmtTime } from "./utils";

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const dropZone = document.getElementById("dropZone") as HTMLLabelElement;
const fileName = document.getElementById("fileName") as HTMLSpanElement;
const fileHint = document.getElementById("fileHint") as HTMLSpanElement;
const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
const playIcon = document.getElementById("playIcon") as Element as SVGElement;
const pauseIcon = document.getElementById("pauseIcon") as Element as SVGElement;
const statusText = document.getElementById("statusText") as HTMLDivElement;
const progressBar = document.getElementById("progressBar") as HTMLInputElement;
const loopToggle = document.getElementById("loopToggle") as HTMLButtonElement;

function updateProgress(override?: number): void {
  const buf = Audio.getBuffer();
  if (!buf) return;
  const offset = override ?? Audio.currentOffset();
  updateStatus(true, offset, buf.duration);
}

function updateStatus(loaded: boolean, current: number, total: number): void {
  statusText.textContent = loaded ? `${fmtTime(current)} / ${fmtTime(total)}` : "No track loaded";
  const percent = loaded && total ? Math.min(100, (current / total) * 100) : 0;
  progressBar.value = String(percent / 100);
  progressBar.style.setProperty("--percent", fmtPercent(percent));
}

function setPlayIcon(playing: boolean): void {
  playIcon.style.display = playing ? "none" : "block";
  pauseIcon.style.display = playing ? "block" : "none";
  playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function updateReverb(): void {
  Audio.updateReverb(
    parseFloat(roomSlider.value) / 100,
    parseFloat(dampSlider.value) / 100,
    parseFloat(reverbSlider.value) / 100,
  );
}

interface SliderConfig {
  id: string;
  label: string;
  formatter: (v: number) => string;
  onChange?: (v: number) => void;
  defaultValue: number;
  min: number;
  max: number;
  step: string;
}

function createSlider(config: SliderConfig): HTMLInputElement {
  const container = document.querySelector(".controls")!;

  const row = document.createElement("div");
  row.className = "control-row";

  const labelDiv = document.createElement("div");
  labelDiv.className = "control-label";
  const labelSpan = document.createElement("span");
  labelSpan.textContent = config.label;
  const valSpan = document.createElement("span");
  valSpan.className = "val";
  valSpan.id = config.id + "Val";
  labelDiv.appendChild(labelSpan);
  labelDiv.appendChild(valSpan);

  const input = document.createElement("input");
  input.type = "range";
  input.className = "param-slider";
  input.id = config.id;
  input.min = String(config.min);
  input.max = String(config.max);
  input.step = config.step;

  row.appendChild(labelDiv);
  row.appendChild(input);
  container.appendChild(row);

  function refresh(): void {
    valSpan.textContent = config.formatter(parseFloat(input.value));
  }
  input.oninput = () => {
    refresh();
    config.onChange?.(parseFloat(input.value));
  };
  input.value = String(config.defaultValue);
  refresh();

  return input;
}

const velocitySlider = createSlider({
  id: "velocity",
  label: "Orbit velocity",
  min: -60,
  max: 60,
  step: "1",
  formatter: (v) => `${Math.abs(v)} RPM${v > 0 ? " clockwise" : v < 0 ? " counterclockwise" : ""}`,
  onChange: (v) => Audio.setRPM(v),
  defaultValue: 12,
});
const radiusSlider = createSlider({
  id: "radius",
  label: "Distance",
  min: 1,
  max: 10,
  step: "0.1",
  formatter: (v) => v.toFixed(1) + " m",
  onChange: (v) => Audio.setRadius(v),
  defaultValue: 3,
});
const reverbSlider = createSlider({
  id: "reverb",
  label: "Reverb Mix",
  min: 0,
  max: 100,
  step: "1",
  formatter: fmtPercent,
  onChange: updateReverb,
  defaultValue: 33,
});
const roomSlider = createSlider({
  id: "room",
  label: "Room Size",
  min: 0,
  max: 100,
  step: "1",
  formatter: fmtPercent,
  onChange: updateReverb,
  defaultValue: 50,
});
const dampSlider = createSlider({
  id: "damp",
  label: "Dampening",
  min: 0,
  max: 100,
  step: "1",
  formatter: fmtPercent,
  onChange: updateReverb,
  defaultValue: 25,
});
createSlider({
  id: "bass",
  label: "Bass Boost",
  min: -10,
  max: 10,
  step: "0.1",
  formatter: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + " dB",
  onChange: (v) => Audio.updateBassBoost(v),
  defaultValue: 0,
});

Audio.setRPM(parseFloat(velocitySlider.value));
Audio.setRadius(parseFloat(radiusSlider.value));

fileInput.onchange = async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (Audio.getIsPlaying()) {
    Audio.pause();
    setPlayIcon(false);
  }
  stopRendering();

  fileName.textContent = file.name;
  fileHint.textContent = "Reading audio file...";
  updateStatus(false, 0, 0);
  playBtn.disabled = progressBar.disabled = true;

  try {
    Audio.ensureAudioPipeline();
    updateReverb();
    Audio.updateBassBoost(0);
    const arrayBuffer = await file.arrayBuffer();
    await Audio.loadAudio(arrayBuffer);
    fileHint.textContent = "File loaded";
    const buf = Audio.getBuffer()!;
    updateStatus(true, 0, buf.duration);
    playBtn.disabled = progressBar.disabled = false;
    Visualizer.resetTrail(Audio.getAngle());
  } catch {
    fileHint.textContent = "File format is not supported";
    updateStatus(false, 0, 0);
  }
};

dropZone.ondragover = (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
};
dropZone.ondragleave = () => {
  dropZone.classList.remove("drag-over");
};
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const data = e.dataTransfer;
  if (data && data.files && data.files[0]) {
    fileInput.files = data.files;
    fileInput.dispatchEvent(new Event("change"));
  }
};

let rafId = 0;
let lastFrameTime = 0;

function renderLoop(timestamp: number): void {
  const dt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
  lastFrameTime = timestamp;

  const isPlaying = Audio.getIsPlaying();
  const speed = Math.abs(Audio.getRPM());
  const angle = Audio.getAngle();

  Visualizer.renderFrame(dt, angle, isPlaying, speed);

  if (Audio.getBuffer() && !isDragging) {
    updateProgress();
  }

  if (isPlaying || Visualizer.hasParticles()) {
    rafId = requestAnimationFrame(renderLoop);
  }
}

function startRendering(): void {
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(renderLoop);
}

function stopRendering(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

Audio.setOnEndedCallback(() => {
  setPlayIcon(false);
  updateProgress();
});

playBtn.onclick = async () => {
  if (!Audio.getBuffer()) return;
  Audio.ensureAudioPipeline();
  await Audio.tryResume();

  if (!Audio.getIsPlaying()) {
    Audio.play();
    stopRendering();
    startRendering();
    Visualizer.resetTrail(Audio.getAngle());
    setPlayIcon(true);
  } else {
    Audio.pause();
    updateProgress();
    setPlayIcon(false);
  }
};

loopToggle.onclick = () => {
  const v = !Audio.getIsLooping();
  Audio.setLooping(v);
  loopToggle.classList.toggle("on", v);
};

let isDragging = false;

progressBar.oninput = () => {
  if (!Audio.getBuffer()) return;
  isDragging = true;
  updateProgress(Number(progressBar.value) * Audio.getBuffer()!.duration);
};

progressBar.onchange = () => {
  if (!Audio.getBuffer()) return;
  isDragging = false;
  Audio.seekTo(Number(progressBar.value) * Audio.getBuffer()!.duration);
  updateProgress();
};
