
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveMusicSession } from '@google/genai';
import { startSession, closeSession, updateMusicConfig, updatePrompt, generateSurprisePrompt } from './services/geminiService';
import { concatenateAudioBuffers, audioBufferToWav, createReverbImpulseResponse } from './utils/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import { LoadingIcon, PlayIcon, StopIcon, MagicWandIcon, DownloadIcon, InfoIcon } from './components/Icons';
import Slider from './components/Slider';
import PromptGuideModal from './components/PromptGuideModal';
import MultiSelect from './components/MultiSelect';

type Status = 'idle' | 'connecting' | 'generating' | 'stopping' | 'error';
type EffectType = 'none' | 'reverb' | 'echo';

interface MusicConfig {
  bpm: number;
  density: number;
  brightness: number;
  guidance: number;
}

const INSTRUMENT_LIST = [
    "Piano", "Acoustic Guitar", "Electric Guitar", "Bass Guitar", "Drums", "Violin", "Cello", "Trumpet",
    "Saxophone", "Flute", "Synth Pads", "808 Bass", "Sitar", "Marimba", "Hang Drum"
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('Electronic');
  const [finalPrompt, setFinalPrompt] = useState(prompt);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  const [musicConfig, setMusicConfig] = useState<MusicConfig>({
    bpm: 120,
    density: 0.5,
    brightness: 0.5,
    guidance: 4.0,
  });

  const [effectType, setEffectType] = useState<EffectType>('none');
  const [effectIntensity, setEffectIntensity] = useState(0.3); // Wet/Dry mix

  const sessionRef = useRef<LiveMusicSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<AudioBuffer[]>([]);
  
  // Audio effects nodes
  const dryNodeRef = useRef<GainNode | null>(null);
  const wetNodeRef = useRef<GainNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null); // Reverb
  const delayNodeRef = useRef<DelayNode | null>(null); // Echo
  const feedbackNodeRef = useRef<GainNode | null>(null); // Echo feedback
  const masterGainNodeRef = useRef<GainNode | null>(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  const isBusy = status === 'connecting' || status === 'generating' || status === 'stopping';

  useEffect(() => {
    const url = downloadUrl;
    return () => {
        if (url) {
            URL.revokeObjectURL(url);
        }
    };
  }, [downloadUrl]);

  const cleanupAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      sourcesRef.current.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            console.warn("Could not stop source", e);
        }
      });
      sourcesRef.current.clear();
      audioContextRef.current.close().catch(console.error);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    masterGainNodeRef.current = null;
    nextStartTimeRef.current = 0;
  }, []);

  const handleStop = useCallback(async () => {
    setStatus('stopping');
    if (sessionRef.current) {
      await closeSession(sessionRef.current);
      sessionRef.current = null;
    }

    if (audioChunksRef.current.length > 0) {
        setIsProcessingDownload(true);
        try {
            const concatenatedBuffer = concatenateAudioBuffers(audioChunksRef.current);
            if (concatenatedBuffer) {
                const wavBlob = audioBufferToWav(concatenatedBuffer);
                const url = URL.createObjectURL(wavBlob);
                setDownloadUrl(url);
            }
        } catch (e) {
            console.error("Failed to create download file:", e);
            setError("Could not process audio for download.");
        } finally {
            setIsProcessingDownload(false);
        }
    }

    cleanupAudio();
    setStatus('idle');
  }, [cleanupAudio]);

  const handleGenerate = useCallback(async () => {
    if (isBusy) return;
    setError(null);
    setDownloadUrl(null);
    setStatus('connecting');
    audioChunksRef.current = [];

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
      
      // Master Gain
      masterGainNodeRef.current = audioContext.createGain();
      
      // Analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      masterGainNodeRef.current.connect(analyser);
      analyser.connect(audioContext.destination);
      
      // Effect nodes setup
      dryNodeRef.current = audioContext.createGain();
      wetNodeRef.current = audioContext.createGain();
      dryNodeRef.current.connect(masterGainNodeRef.current);
      wetNodeRef.current.connect(masterGainNodeRef.current);
      
      // Reverb
      convolverNodeRef.current = audioContext.createConvolver();
      const impulseResponse = await createReverbImpulseResponse(audioContext);
      convolverNodeRef.current.buffer = impulseResponse;

      // Echo
      delayNodeRef.current = audioContext.createDelay(1.0); // Max 1s delay
      feedbackNodeRef.current = audioContext.createGain();
      delayNodeRef.current.connect(feedbackNodeRef.current);
      feedbackNodeRef.current.connect(delayNodeRef.current);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      nextStartTimeRef.current = 0;
      sourcesRef.current.clear();

      const newSession = await startSession({
        prompt: finalPrompt,
        config: musicConfig,
        onAudioChunk: (audioBuffer) => {
          if (!audioContextRef.current || !masterGainNodeRef.current || !dryNodeRef.current) return;
          
          audioChunksRef.current.push(audioBuffer);

          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          // Connect source to both dry and wet paths
          source.connect(dryNodeRef.current);
          source.connect(wetNodeRef.current);
          
          source.onended = () => {
            sourcesRef.current.delete(source);
          };

          const currentTime = audioContextRef.current.currentTime;
          const startTime = Math.max(currentTime, nextStartTimeRef.current);
          source.start(startTime);
          nextStartTimeRef.current = startTime + audioBuffer.duration;
          sourcesRef.current.add(source);
        },
        onOpen: () => {
          setStatus('generating');
        },
        onError: (err: ErrorEvent) => {
          console.error('Session error:', err);
          setError(`An error occurred: ${err.message}. This might be an experimental feature. Please try again.`);
          setStatus('error');
          handleStop();
        },
        onClose: (_event: CloseEvent) => {
          if (statusRef.current !== 'stopping') {
            handleStop();
          }
        },
      });
      sessionRef.current = newSession;

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(`Failed to start session: ${err.message}`);
      setStatus('error');
      cleanupAudio();
    }
  }, [finalPrompt, isBusy, cleanupAudio, handleStop, musicConfig]);
  
  const handleSurpriseMe = async () => {
    setIsGeneratingPrompt(true);
    setError(null);
    try {
        const newPrompt = await generateSurprisePrompt();
        setPrompt(newPrompt);
    } catch (err: any) {
        setError(`Failed to generate prompt: ${err.message}`);
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  useEffect(() => {
    const instrumentText = selectedInstruments.length > 0
        ? ` with the following instruments: ${selectedInstruments.join(', ')}.`
        : '';
    setFinalPrompt(prompt + instrumentText);
  }, [prompt, selectedInstruments]);


  useEffect(() => {
    if (status === 'generating' && sessionRef.current) {
        updateMusicConfig(sessionRef.current, musicConfig);
    }
  }, [musicConfig, status]);

  useEffect(() => {
    const handler = setTimeout(() => {
        if (status === 'generating' && sessionRef.current && finalPrompt) {
            updatePrompt(sessionRef.current, finalPrompt);
        }
    }, 500); // Debounce prompt updates
    
    return () => {
        clearTimeout(handler);
    };
  }, [finalPrompt, status]);

  // Effect routing logic
  useEffect(() => {
    if (status !== 'generating' || !wetNodeRef.current || !dryNodeRef.current || !masterGainNodeRef.current) return;

    // Disconnect all wet paths first
    wetNodeRef.current.disconnect();
    convolverNodeRef.current?.disconnect();
    delayNodeRef.current?.disconnect();
    feedbackNodeRef.current?.disconnect(delayNodeRef.current);
    
    // Set gains based on intensity (wet/dry mix)
    dryNodeRef.current.gain.setValueAtTime(1 - effectIntensity, audioContextRef.current!.currentTime);
    wetNodeRef.current.gain.setValueAtTime(effectIntensity, audioContextRef.current!.currentTime);

    if (effectType === 'reverb' && convolverNodeRef.current) {
        wetNodeRef.current.connect(convolverNodeRef.current);
        convolverNodeRef.current.connect(masterGainNodeRef.current);
    } else if (effectType === 'echo' && delayNodeRef.current && feedbackNodeRef.current) {
        // Intensity controls feedback and delay time for echo
        feedbackNodeRef.current.gain.setValueAtTime(effectIntensity * 0.7, audioContextRef.current!.currentTime); // 0.7 to avoid harsh feedback
        delayNodeRef.current.delayTime.setValueAtTime(effectIntensity * 0.5 + 0.1, audioContextRef.current!.currentTime); // 0.1s to 0.6s delay
        
        wetNodeRef.current.connect(delayNodeRef.current);
        delayNodeRef.current.connect(masterGainNodeRef.current);
        feedbackNodeRef.current.connect(delayNodeRef.current);
    } else {
        // No effect, set wet gain to 0
        wetNodeRef.current.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
        dryNodeRef.current.gain.setValueAtTime(1, audioContextRef.current!.currentTime);
    }

  }, [effectType, effectIntensity, status]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <PromptGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Real-time VlorAi Music Generator
          </h1>
          <p className="text-gray-400 mt-2">
            Describe the music you want to hear, and let Gemini create it for you live.
          </p>
        </header>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm" role="alert">
                <p>{error}</p>
            </div>
        )}

        <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300">
                        Your Music Prompt
                    </label>
                    <button onClick={() => setIsGuideOpen(true)} className="text-gray-400 hover:text-white">
                        <InfoIcon />
                    </button>
                 </div>
                <button 
                    onClick={handleSurpriseMe}
                    disabled={isBusy || isGeneratingPrompt}
                    className="flex items-center gap-1.5 text-sm text-purple-300 hover:text-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isGeneratingPrompt ? <LoadingIcon /> : <MagicWandIcon />}
                    {isGeneratingPrompt ? 'Generating...' : 'Surprise Me'}
                </button>
            </div>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isBusy}
            placeholder="e.g., relaxing lo-fi beats for studying"
            className="w-full h-24 p-3 bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 disabled:opacity-50"
          />
        </div>
        
        <div className="space-y-4">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm font-medium text-gray-300 hover:text-white w-full text-left">
                {showAdvanced ? 'Hide' : 'Show'} Advanced Controls ▼
            </button>
            {showAdvanced && (
                <div className="space-y-4 pt-2 border-t border-gray-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Slider label="BPM" min={60} max={200} step={1} value={musicConfig.bpm} onChange={v => setMusicConfig(c => ({...c, bpm: Math.round(v)}))} disabled={isBusy} />
                        <Slider label="Density" min={0} max={1} step={0.01} value={musicConfig.density} onChange={v => setMusicConfig(c => ({...c, density: v}))} disabled={isBusy} />
                        <Slider label="Brightness" min={0} max={1} step={0.01} value={musicConfig.brightness} onChange={v => setMusicConfig(c => ({...c, brightness: v}))} disabled={isBusy} />
                        <Slider label="Guidance" min={0} max={6} step={0.1} value={musicConfig.guidance} onChange={v => setMusicConfig(c => ({...c, guidance: v}))} disabled={isBusy} />
                    </div>
                     <div>
                        <label className="block text-xs text-gray-400 mb-1">Instruments</label>
                        <MultiSelect
                            options={INSTRUMENT_LIST}
                            selectedOptions={selectedInstruments}
                            onChange={setSelectedInstruments}
                            disabled={isBusy}
                        />
                    </div>
                    <div className="border-t border-gray-700/50 pt-4">
                         <h3 className="text-sm font-medium text-gray-300 mb-2">Audio Effects</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="effect-type" className="block text-xs text-gray-400 mb-1">Effect Type</label>
                                <select 
                                    id="effect-type"
                                    value={effectType}
                                    onChange={e => setEffectType(e.target.value as EffectType)}
                                    disabled={!isBusy}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                                >
                                    <option value="none">None</option>
                                    <option value="reverb">Reverb</option>
                                    <option value="echo">Echo</option>
                                </select>
                            </div>
                            <Slider label="Wet/Dry Mix" min={0} max={1} step={0.01} value={effectIntensity} onChange={setEffectIntensity} disabled={!isBusy || effectType === 'none'} />
                         </div>
                    </div>
                </div>
            )}
        </div>


        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={isBusy || !prompt}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {status === 'connecting' ? <LoadingIcon /> : <PlayIcon />}
            {status === 'connecting' ? 'Connecting...' : (status === 'generating' ? 'Generating...' : 'Generate')}
          </button>
          <button
            onClick={handleStop}
            disabled={!isBusy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-gray-200 bg-gray-700 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <StopIcon />
            Stop
          </button>
            {isProcessingDownload && (
                <button
                    disabled={true}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-gray-200 bg-blue-800/50 rounded-lg cursor-wait"
                >
                    <LoadingIcon />
                    Processing...
                </button>
            )}
            {downloadUrl && !isProcessingDownload && (
                 <a
                    href={downloadUrl}
                    download="gemini-music.wav"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105"
                >
                    <DownloadIcon />
                    Download WAV
                </a>
            )}
        </div>

        <div className="h-40 bg-gray-900/50 rounded-lg flex items-center justify-center p-4 border border-gray-700">
          {status === 'generating' && analyserRef.current ? (
            <AudioVisualizer analyserNode={analyserRef.current} />
          ) : (
            <div className="text-center text-gray-500">
                {status === 'idle' && !isBusy && !downloadUrl && 'Ready to generate music'}
                {status === 'idle' && downloadUrl && 'Generation finished. Ready to download.'}
                {status === 'connecting' && 'Connecting to Gemini...'}
                {status === 'error' && 'An error occurred'}
                {status === 'stopping' && 'Stopping generation...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
