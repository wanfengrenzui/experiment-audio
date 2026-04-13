const presets = [
  {
    id: "S1",
    pitch: 300,
    amplitude: 60,
    timbre: "pure",
    description: "低频柔和提示",
  },
  {
    id: "S2",
    pitch: 300,
    amplitude: 60,
    timbre: "natural",
    description: "低频自然反馈",
  },
  {
    id: "S3",
    pitch: 300,
    amplitude: 80,
    timbre: "pure",
    description: "低频增强提示",
  },
  {
    id: "S4",
    pitch: 300,
    amplitude: 80,
    timbre: "natural",
    description: "低频增强自然",
  },
  {
    id: "S5",
    pitch: 1200,
    amplitude: 60,
    timbre: "pure",
    description: "高频提示音",
  },
  {
    id: "S6",
    pitch: 1200,
    amplitude: 60,
    timbre: "natural",
    description: "高频自然音",
  },
  {
    id: "S7",
    pitch: 1200,
    amplitude: 80,
    timbre: "pure",
    description: "高频警示音",
  },
  {
    id: "S8",
    pitch: 1200,
    amplitude: 80,
    timbre: "natural",
    description: "高频增强自然",
  },
];

const state = {
  pitch: 300,
  amplitude: 60,
  timbre: "pure",
  duration: 1.2,
  currentSource: null,
  audioContext: null,
};

const summaryLabel = document.getElementById("summaryLabel");
const summaryHint = document.getElementById("summaryHint");
const statusText = document.getElementById("statusText");
const presetGrid = document.getElementById("presetGrid");
const playButton = document.getElementById("playButton");
const downloadButton = document.getElementById("downloadButton");
const stopButton = document.getElementById("stopButton");

function getAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  return state.audioContext;
}

function getSelection() {
  const pitch = Number(document.querySelector('input[name="pitch"]:checked').value);
  const amplitude = Number(document.querySelector('input[name="amplitude"]:checked').value);
  const timbre = document.querySelector('input[name="timbre"]:checked').value;
  const duration = Number(document.querySelector('input[name="duration"]:checked').value);

  return { pitch, amplitude, timbre, duration };
}

function setSelection(nextSelection) {
  state.pitch = nextSelection.pitch;
  state.amplitude = nextSelection.amplitude;
  state.timbre = nextSelection.timbre;
  state.duration = nextSelection.duration;

  document.querySelectorAll('input[name="pitch"]').forEach((input) => {
    input.checked = Number(input.value) === state.pitch;
  });

  document.querySelectorAll('input[name="amplitude"]').forEach((input) => {
    input.checked = Number(input.value) === state.amplitude;
  });

  document.querySelectorAll('input[name="timbre"]').forEach((input) => {
    input.checked = input.value === state.timbre;
  });

  document.querySelectorAll('input[name="duration"]').forEach((input) => {
    input.checked = Number(input.value) === state.duration;
  });

  updateSummary();
  updatePresetState();
}

function findPreset(selection) {
  return presets.find(
    (preset) =>
      preset.pitch === selection.pitch &&
      preset.amplitude === selection.amplitude &&
      preset.timbre === selection.timbre,
  );
}

function getTimbreLabel(timbre) {
  return timbre === "pure" ? "纯音" : "自然音";
}

function updateSummary() {
  const preset = findPreset(state);
  summaryLabel.textContent = `${preset.id} · ${state.pitch} Hz · ${state.amplitude} dB · ${getTimbreLabel(state.timbre)} · ${state.duration.toFixed(1)} s`;
  summaryHint.textContent = `${preset.description} · 时长 ${state.duration.toFixed(1)} s`;
}

function updatePresetState() {
  document.querySelectorAll(".preset").forEach((card) => {
    const matches =
      Number(card.dataset.pitch) === state.pitch &&
      Number(card.dataset.amplitude) === state.amplitude &&
      card.dataset.timbre === state.timbre;

    card.classList.toggle("active", matches);
  });
}

function renderPresets() {
  presetGrid.innerHTML = presets
    .map(
      (preset) => `
        <button class="preset" type="button" data-pitch="${preset.pitch}" data-amplitude="${preset.amplitude}" data-timbre="${preset.timbre}">
          <strong>${preset.id}</strong>
          <span>${preset.pitch} Hz · ${preset.amplitude} dB · ${getTimbreLabel(preset.timbre)}</span>
          <span>${preset.description}</span>
        </button>
      `,
    )
    .join("");

  presetGrid.querySelectorAll(".preset").forEach((card) => {
    card.addEventListener("click", () => {
      setSelection({
        pitch: Number(card.dataset.pitch),
        amplitude: Number(card.dataset.amplitude),
        timbre: card.dataset.timbre,
      });

      playStimulus();
    });
  });
}

function createBuffer({ pitch, amplitude, timbre }) {
  const context = getAudioContext();
  const duration = state.duration;
  const sampleRate = context.sampleRate;
  const frameCount = Math.floor(duration * sampleRate);
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);

  const level = Math.pow(10, (amplitude - 80) / 20) * 0.48;
  let filteredNoise = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate;
    const fadeIn = Math.min(1, time / 0.03);
    const fadeOut = Math.min(1, (duration - time) / 0.05);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));

    let sample = Math.sin(2 * Math.PI * pitch * time);

    if (timbre === "natural") {
      const secondHarmonic = 0.28 * Math.sin(2 * Math.PI * pitch * 2 * time + 0.15);
      const thirdHarmonic = 0.14 * Math.sin(2 * Math.PI * pitch * 3 * time + 0.05);
      filteredNoise = filteredNoise * 0.985 + (Math.random() * 2 - 1) * 0.02;
      sample = sample * 0.68 + secondHarmonic + thirdHarmonic + filteredNoise * 0.08;
    }

    channel[index] = sample * level * envelope;
  }

  return buffer;
}

function stopPlayback() {
  if (state.currentSource) {
    try {
      state.currentSource.stop();
    } catch {
      // ignored on purpose
    }
    state.currentSource.disconnect();
    state.currentSource = null;
  }
}

async function playStimulus() {
  const context = getAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  stopPlayback();

  const selection = getSelection();
  const buffer = createBuffer(selection);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  source.onended = () => {
    if (state.currentSource === source) {
      state.currentSource = null;
    }
  };
  state.currentSource = source;

  const preset = findPreset(selection);
  statusText.textContent = `已播放 ${preset.id}，${selection.pitch} Hz / ${selection.amplitude} dB / ${getTimbreLabel(selection.timbre)}。`;
}

function encodeWav(buffer) {
  const channelData = buffer.getChannelData(0);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + channelData.length * bytesPerSample);
  const view = new DataView(wavBuffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  const sampleRate = buffer.sampleRate;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < channelData.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, channelData[index]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return wavBuffer;
}

function downloadCurrentStimulus() {
  const selection = getSelection();
  const buffer = createBuffer(selection);
  const wavBuffer = encodeWav(buffer);
  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const preset = findPreset(selection);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${preset.id}_${selection.pitch}Hz_${selection.amplitude}dB_${selection.timbre}_${selection.duration.toFixed(1)}s.wav`;
  anchor.click();
  URL.revokeObjectURL(url);

  statusText.textContent = `已导出 ${preset.id} 的 WAV 文件，时长 ${selection.duration.toFixed(1)} s。`;
}

function bindControls() {
  document.querySelectorAll('input[name="pitch"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.pitch = Number(input.value);
      updateSummary();
      updatePresetState();
    });
  });

  document.querySelectorAll('input[name="amplitude"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.amplitude = Number(input.value);
      updateSummary();
      updatePresetState();
    });
  });

  document.querySelectorAll('input[name="timbre"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.timbre = input.value;
      updateSummary();
      updatePresetState();
    });
  });

  document.querySelectorAll('input[name="duration"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.duration = Number(input.value);
      updateSummary();
      updatePresetState();
    });
  });

  playButton.addEventListener("click", playStimulus);
  downloadButton.addEventListener("click", downloadCurrentStimulus);
  stopButton.addEventListener("click", () => {
    stopPlayback();
    statusText.textContent = "播放已停止。";
  });
}

renderPresets();
bindControls();
setSelection({ pitch: 300, amplitude: 60, timbre: "pure", duration: 1.2 });
updateSummary();
updatePresetState();