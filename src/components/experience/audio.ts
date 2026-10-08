export type AmbientAudioController = {
  enable(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  dispose(): Promise<void>;
  isEnabled(): boolean;
};

type AudioContextConstructor = new () => AudioContext;
type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: AudioContextConstructor;
};

const ENABLED_GAIN = 0.012;
const GAIN_RAMP_SECONDS = 0.24;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as WindowWithWebkitAudio;
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function fillNoise(buffer: AudioBuffer) {
  const samples = buffer.getChannelData(0);
  let state = 0x6d2b79f5;

  for (let index = 0; index < samples.length; index += 1) {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    const normalized = ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
    samples[index] = (normalized * 2 - 1) * 0.08;
  }
}

export function createAmbientAudio(): AmbientAudioController {
  let context: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let noise: AudioBufferSourceNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let master: GainNode | null = null;
  let enabled = false;
  let disposed = false;

  const rampGain = (nextEnabled: boolean) => {
    if (!context || !master || context.state === "closed") return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(
      nextEnabled ? ENABLED_GAIN : 0,
      now + GAIN_RAMP_SECONDS,
    );
  };

  const setEnabled = async (nextEnabled: boolean) => {
    if (disposed || !context || !master || context.state === "closed") {
      enabled = false;
      return;
    }

    if (nextEnabled && context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        enabled = false;
        return;
      }
    }

    enabled = nextEnabled;
    rampGain(enabled);
  };

  const enable = async () => {
    if (disposed) return;
    if (context) {
      await setEnabled(true);
      return;
    }

    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return;

    let nextContext: AudioContext | null = null;
    try {
      nextContext = new AudioContextClass();
      const nextOscillator = nextContext.createOscillator();
      const nextNoise = nextContext.createBufferSource();
      const nextFilter = nextContext.createBiquadFilter();
      const nextMaster = nextContext.createGain();

      nextOscillator.type = "sine";
      nextOscillator.frequency.setValueAtTime(54, nextContext.currentTime);

      const noiseBuffer = nextContext.createBuffer(
        1,
        Math.max(1, Math.floor(nextContext.sampleRate * 2)),
        nextContext.sampleRate,
      );
      fillNoise(noiseBuffer);
      nextNoise.buffer = noiseBuffer;
      nextNoise.loop = true;

      nextFilter.type = "lowpass";
      nextFilter.frequency.setValueAtTime(320, nextContext.currentTime);
      nextFilter.Q.setValueAtTime(0.7, nextContext.currentTime);
      nextMaster.gain.setValueAtTime(0, nextContext.currentTime);

      nextOscillator.connect(nextFilter);
      nextNoise.connect(nextFilter);
      nextFilter.connect(nextMaster);
      nextMaster.connect(nextContext.destination);

      nextOscillator.start();
      nextNoise.start();

      context = nextContext;
      oscillator = nextOscillator;
      noise = nextNoise;
      filter = nextFilter;
      master = nextMaster;
    } catch {
      try {
        await nextContext?.close();
      } catch {
        // A partially constructed context is already unusable.
      }
      return;
    }

    await setEnabled(true);
  };

  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    enabled = false;
    rampGain(false);

    try {
      oscillator?.stop();
    } catch {
      // A stopped source cannot be stopped twice.
    }
    try {
      noise?.stop();
    } catch {
      // A stopped source cannot be stopped twice.
    }

    oscillator?.disconnect();
    noise?.disconnect();
    filter?.disconnect();
    master?.disconnect();

    const closingContext = context;
    context = null;
    oscillator = null;
    noise = null;
    filter = null;
    master = null;

    if (closingContext && closingContext.state !== "closed") {
      try {
        await closingContext.close();
      } catch {
        // Disposal is best-effort and must remain safe during page teardown.
      }
    }
  };

  return {
    enable,
    setEnabled,
    dispose,
    isEnabled: () => enabled,
  };
}
