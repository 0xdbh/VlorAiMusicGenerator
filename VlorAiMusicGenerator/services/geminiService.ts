// Fix: Use LiveMusicGenerationConfig as MusicGenerationConfig is deprecated.
import { GoogleGenAI, LiveMusicSession, LiveMusicGenerationConfig } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audioUtils';

let ai: GoogleGenAI;
let textGenAi: GoogleGenAI;

const getAi = (alpha: boolean = false) => {
    if (alpha) {
        if (!ai) {
            if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set");
            ai = new GoogleGenAI({ apiKey: process.env.API_KEY, apiVersion: "v1alpha" });
        }
        return ai;
    }
    if (!textGenAi) {
        if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set");
        textGenAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return textGenAi;
};


interface StartSessionParams {
  prompt: string;
  // Fix: Use LiveMusicGenerationConfig and remove non-existent 'audioFormat' from Omit.
  config: Omit<LiveMusicGenerationConfig, 'sampleRateHz'>;
  onAudioChunk: (audioBuffer: AudioBuffer) => void;
  onOpen: () => void;
  // Fix: The onError callback expects an ErrorEvent.
  onError: (error: ErrorEvent) => void;
  onClose: (event: CloseEvent) => void;
}

export const startSession = async ({
  prompt,
  config,
  onAudioChunk,
  onOpen,
  onError,
  onClose,
}: StartSessionParams): Promise<LiveMusicSession> => {
  const aiInstance = getAi(true);

  const session = await aiInstance.live.music.connect({
    model: 'models/lyria-realtime-exp',
    callbacks: {
      // FIX: The 'onopen' callback property does not exist on LiveMusicCallbacks.
      // The connection is considered open when the connect() promise resolves.
      onmessage: async (message) => {
        if (message.serverContent?.audioChunks) {
          for (const chunk of message.serverContent.audioChunks) {
            try {
              const audioData = chunk.data;
              const decodedBytes = decode(audioData);
              // Lyria outputs stereo audio at 48kHz
              const audioBuffer = await decodeAudioData(decodedBytes, 48000, 2);
              onAudioChunk(audioBuffer);
            } catch (e) {
              console.error("Error processing audio chunk:", e);
            }
          }
        }
      },
      onerror: onError,
      onclose: onClose,
    },
  });

  onOpen();

  await session.setWeightedPrompts({
      weightedPrompts: [{ text: prompt, weight: 1.0 }],
  });

  await session.setMusicGenerationConfig({
      musicGenerationConfig: {
          ...config,
          // FIX: 'sampleRateHz' is not a valid property in LiveMusicGenerationConfig.
          // The sample rate for the Lyria model is fixed at 48kHz and cannot be configured.
      },
  });

  await session.play();
  
  return session;
};

// Fix: Use Omit to match the actual data being passed from the App component.
export const updateMusicConfig = async (session: LiveMusicSession, config: Omit<LiveMusicGenerationConfig, 'sampleRateHz'>) => {
    try {
        await session.setMusicGenerationConfig({
            musicGenerationConfig: {
                ...config,
                // FIX: 'sampleRateHz' is not a valid property in LiveMusicGenerationConfig.
                // The sample rate for the Lyria model is fixed at 48kHz and cannot be configured.
            }
        });
    } catch(e) {
        console.error("Error updating music config:", e);
    }
}

export const updatePrompt = async (session: LiveMusicSession, prompt: string) => {
    try {
        await session.setWeightedPrompts({
            weightedPrompts: [{ text: prompt, weight: 1.0 }],
        });
    } catch(e) {
        console.error("Error updating prompt:", e);
    }
}

export const closeSession = async (session: LiveMusicSession) => {
  try {
    await session.stop();
    session.close();
  } catch (e) {
    console.error("Error closing session:", e);
  }
};


export const generateSurprisePrompt = async (): Promise<string> => {
    const aiInstance = getAi(false);
    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate a creative and descriptive prompt for an AI music generator. The prompt should be evocative and detailed, suitable for creating instrumental music. Don't use quotes or labels. Just provide the prompt text itself."
        });
        return response.text.trim();
    } catch (e) {
        console.error("Error generating surprise prompt:", e);
        throw e;
    }
}