import { VADEvent, VADProvider } from "../types";

export class SileroVADProvider implements VADProvider {
  name = "silero_vad";
  private sensitivity: number;
  private consecutiveSpeechFrames = 0;
  private consecutiveSilenceFrames = 0;
  private speechThreshold = 3;
  private silenceThreshold = 6;
  private currentlySpeaking = false;

  constructor(sensitivity: number = 0.65) {
    this.sensitivity = sensitivity;
  }

  async processAudioChunk(pcmChunk: Buffer): Promise<VADEvent> {
    if (!pcmChunk || pcmChunk.length === 0) {
      return { isSpeaking: false, confidence: 0 };
    }

    // Compute root-mean-square (RMS) energy over 16-bit linear PCM audio chunk
    let sumSquares = 0;
    const sampleCount = Math.floor(pcmChunk.length / 2);
    if (sampleCount === 0) return { isSpeaking: false, confidence: 0 };

    for (let i = 0; i < pcmChunk.length - 1; i += 2) {
      const sample = pcmChunk.readInt16LE(i);
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    // Dynamic normalized energy score (0.0 to 1.0)
    const normalizedEnergy = Math.min(1, rms / 32768);
    const confidence = Number((normalizedEnergy * (1 / (1 - this.sensitivity + 0.05))).toFixed(3));
    const isFrameSpeech = confidence >= this.sensitivity;

    if (isFrameSpeech) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveSpeechFrames = 0;
    }

    let isBargeIn = false;
    if (!this.currentlySpeaking && this.consecutiveSpeechFrames >= this.speechThreshold) {
      this.currentlySpeaking = true;
      isBargeIn = true;
    } else if (this.currentlySpeaking && this.consecutiveSilenceFrames >= this.silenceThreshold) {
      this.currentlySpeaking = false;
    }

    return {
      isSpeaking: this.currentlySpeaking,
      confidence: Math.min(1, confidence),
      isBargeIn,
    };
  }

  reset(): void {
    this.consecutiveSpeechFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.currentlySpeaking = false;
  }
}
