import "@fontsource-variable/inter/wght.css";
import "./assets/main.css";
import * as Audio from "./audio";
import * as Visualizer from "./visualizer";
import { fmtPercent, fmtTime } from "./utils";
import { render, encodeAudio, downloadBuffer, replaceExt, type ExportFormat } from "./export";

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

const saveRow = document.querySelector<HTMLDivElement>(".save-row")!;

function createSaveButton(ext: ExportFormat, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "save-btn";
  const defaultContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;flex-shrink:0"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z" fill="currentColor"/></svg><span>${label}</span>`;
  btn.innerHTML = defaultContent;
  btn.disabled = true;
  const restore = () => {
    btn.innerHTML = defaultContent;
    btn.disabled = false;
  };
  btn.onclick = async () => {
    const audioBuf = Audio.getBuffer();
    if (!audioBuf) return;
    btn.disabled = true;
    try {
      btn.textContent = "Exporting...";
      const rendered = await render(audioBuf, Audio.getSettings());
      const encoded = await encodeAudio(rendered, ext);
      const mime = ext === "flac" ? "audio/flac" : ext === "mp3" ? "audio/mpeg" : "audio/wav";
      const defaultName = replaceExt(fileName.textContent!, ext).replace(/\.[^.]+$/, " (8D)$&");
      downloadBuffer(encoded, defaultName, mime);
      restore();
    } catch (err) {
      restore();
      alert(String(err));
    }
  };
  return btn;
}

function setControlsEnabled(enabled: boolean): void {
  playBtn.disabled = progressBar.disabled = !enabled;
  saveRow.querySelectorAll<HTMLButtonElement>(".save-btn").forEach((b) => (b.disabled = !enabled));
}

saveRow.appendChild(createSaveButton("wav", "WAV"));
saveRow.appendChild(createSaveButton("flac", "FLAC"));
saveRow.appendChild(createSaveButton("mp3", "MP3"));

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
  setControlsEnabled(false);

  try {
    Audio.ensureAudioPipeline();
    updateReverb();
    Audio.updateBassBoost(0);
    const arrayBuffer = await file.arrayBuffer();
    await Audio.loadAudio(arrayBuffer);
    fileHint.textContent = "File loaded";
    const buf = Audio.getBuffer()!;
    updateStatus(true, 0, buf.duration);
    setControlsEnabled(true);
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
