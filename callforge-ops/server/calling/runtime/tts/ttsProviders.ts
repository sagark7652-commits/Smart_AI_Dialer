import { TTSOptions, TTSProvider } from "../types";

export class CartesiaTTSProvider implements TTSProvider {
  name = "cartesia_cloned";
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey?: string, voiceId?: string) {
    this.apiKey = apiKey || process.env.CARTESIA_API_KEY || "";
    this.voiceId = voiceId || process.env.CARTESIA_VOICE_ID || "a1e4199c-8c88-4608-8491-33da880e63b8";
  }

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: true };
    }
    if (!this.apiKey) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 24000, success: false };
    }

    try {
      const res = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "sonic-3.6",
          transcript: text,
          voice: {
            mode: "id",
            id: options?.voice || this.voiceId,
          },
          output_format: {
            container: "wav",
            encoding: "pcm_s16le",
            sample_rate: 24000,
          },
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          audioBuffer: Buffer.from(arrayBuf),
          format: "wav",
          sampleRate: 24000,
          success: true,
        };
      } else {
        console.warn(`[CartesiaTTS] Failed with status ${res.status}`);
      }
    } catch (err) {
      console.warn("[CartesiaTTS] Network error:", err);
    }
    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 24000, success: false };
  }
}

export class ElevenLabsTTSProvider implements TTSProvider {
  name = "elevenlabs_cloned";
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey?: string, voiceId?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || "";
    this.voiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  }

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: true };
    }
    if (!this.apiKey) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 24000, success: false };
    }

    try {
      const vid = options?.voice || this.voiceId;
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          audioBuffer: Buffer.from(arrayBuf),
          format: "wav",
          sampleRate: 24000,
          success: true,
        };
      }
    } catch (err) {
      console.warn("[ElevenLabsTTS] Error:", err);
    }
    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 24000, success: false };
  }
}

export class HuggingFaceTTSProvider implements TTSProvider {
  name = "huggingface_tts";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY || "";
    this.model = model || process.env.HUGGINGFACE_TTS_MODEL || "facebook/mms-tts-eng";
  }

  async synthesize(
    text: string,
    _options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    if (!text || !this.apiKey) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: false };
    }

    const lang = (_options?.language || "").toLowerCase();
    let targetModel = this.model;
    if (lang.startsWith("mr") || lang.includes("marathi")) {
      targetModel = "facebook/mms-tts-mar";
    } else if (lang.startsWith("hi") || lang.includes("hindi")) {
      targetModel = "facebook/mms-tts-hin";
    }

    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${targetModel}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          audioBuffer: Buffer.from(arrayBuf),
          format: "wav",
          sampleRate: 16000,
          success: true,
        };
      }
    } catch (err) {
      console.warn("[HuggingFaceTTS] Error:", err);
    }
    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: false };
  }
}

export class OpenAITTSProvider implements TTSProvider {
  name = "openai_tts";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
  }

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: true };
    }

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.apiKey) {
        try {
          const res = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "tts-1",
              input: text,
              voice: options?.voice || "nova", // Female voice by default
              response_format: "wav",
              speed: options?.speed || 1.0,
            }),
          });

          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            return {
              audioBuffer: Buffer.from(arrayBuf),
              format: "wav",
              sampleRate: 24000,
              success: true,
            };
          } else {
            console.warn(`[OpenAITTS] Attempt ${attempt} failed with status: ${res.status}`);
          }
        } catch (err) {
          console.warn(`[OpenAITTS] Network attempt ${attempt} failed:`, err);
        }
      }
    }

    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: false };
  }
}

export class KokoroPiperTTSProvider implements TTSProvider {
  name = "kokoro_piper";
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || process.env.LOCAL_TTS_ENDPOINT || "http://localhost:8880/v1/audio/speech";
  }

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    if (!text || text.trim().length === 0) {
      return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: true };
    }

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "kokoro-v1.0",
          input: text,
          voice: options?.voice || "hi_in_aditi",
          response_format: "wav",
          speed: options?.speed || 1.0,
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          audioBuffer: Buffer.from(arrayBuf),
          format: "wav",
          sampleRate: 24000,
          success: true,
        };
      }
    } catch {
      // Local endpoint not running
    }

    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: false };
  }
}

/**
 * Unified Intelligent TTS Engine:
 * 1. Checks Cartesia (Custom User Cloned Voice - voice ID a1e4199c-8c88-4608-8491-33da880e63b8)
 * 2. Checks ElevenLabs (Instant Voice Cloning)
 * 3. Checks HuggingFace (MMS Multilingual Voice)
 * 4. Checks OpenAI Neural Speech (Nova / Shimmer female voice)
 * 5. Checks Local Kokoro/Piper
 */
export class UnifiedAdaptiveTTSProvider implements TTSProvider {
  name = "unified_adaptive_tts";
  private cartesia = new CartesiaTTSProvider();
  private elevenlabs = new ElevenLabsTTSProvider();
  private huggingface = new HuggingFaceTTSProvider();
  private openai = new OpenAITTSProvider();
  private kokoro = new KokoroPiperTTSProvider();

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    // 1. Try Cartesia Cloned Voice
    if (process.env.CARTESIA_API_KEY) {
      const res = await this.cartesia.synthesize(text, options);
      if (res.success && res.audioBuffer.length > 0) return res;
    }

    // 2. Try ElevenLabs Cloned Voice
    if (process.env.ELEVENLABS_API_KEY) {
      const res = await this.elevenlabs.synthesize(text, options);
      if (res.success && res.audioBuffer.length > 0) return res;
    }

    // 3. Try Hugging Face TTS
    if (process.env.HUGGINGFACE_API_KEY) {
      const res = await this.huggingface.synthesize(text, options);
      if (res.success && res.audioBuffer.length > 0) return res;
    }

    // 4. Try OpenAI Neural Speech
    if (process.env.OPENAI_API_KEY) {
      const res = await this.openai.synthesize(text, options);
      if (res.success && res.audioBuffer.length > 0) return res;
    }

    // 5. Try Local Kokoro
    const kokoroRes = await this.kokoro.synthesize(text, options);
    if (kokoroRes.success && kokoroRes.audioBuffer.length > 0) return kokoroRes;

    return { audioBuffer: Buffer.alloc(0), format: "pcm", sampleRate: 16000, success: false };
  }
}

export class RivaMagpieTTSProvider implements TTSProvider {
  name = "riva_magpie";
  private unified = new UnifiedAdaptiveTTSProvider();

  async synthesize(
    text: string,
    options?: TTSOptions
  ): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success: boolean }> {
    return this.unified.synthesize(text, options);
  }
}
