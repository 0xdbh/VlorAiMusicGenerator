
import React from 'react';

interface PromptGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PromptGuideModal: React.FC<PromptGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-guide-title"
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg text-white border border-gray-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="prompt-guide-title" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Prompting Guide
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            aria-label="Close prompt guide"
          >
            &times;
          </button>
        </div>
        <div className="space-y-4 text-gray-300 text-sm md:text-base">
          <p>
            To get the best results, be descriptive and combine elements like genre, mood, instrumentation, and tempo. The AI will blend these ideas together.
          </p>
          
          <div>
            <h3 className="font-semibold text-lg text-gray-200 mb-2">Key Elements to Include:</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Genre:</strong> e.g., <span className="text-purple-300">lo-fi hip hop</span>, <span className="text-purple-300">cinematic orchestral</span>, <span className="text-purple-300">deep house</span></li>
              <li><strong>Mood:</strong> e.g., <span className="text-pink-300">relaxing</span>, <span className="text-pink-300">energetic</span>, <span className="text-pink-300">melancholy</span>, <span className="text-pink-300">dreamy</span></li>
              <li><strong>Instruments:</strong> e.g., <span className="text-indigo-300">acoustic guitar</span>, <span className="text-indigo-300">booming 808 bass</span>, <span className="text-indigo-300">ethereal synth pads</span></li>
              <li><strong>Tempo/Rhythm:</strong> e.g., <span className="text-teal-300">slow and steady beat</span>, <span className="text-teal-300">fast-paced percussion</span>, <span className="text-teal-300">four-on-the-floor</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-200 mb-2">Example Prompts:</h3>
            <div className="space-y-2">
              <p className="bg-gray-700/50 p-3 rounded-md">"A chill, lo-fi hip hop track with a slow, steady beat, featuring a jazzy piano melody and soft, vinyl crackle sounds."</p>
              <p className="bg-gray-700/50 p-3 rounded-md">"Energetic synthwave with a driving retro beat, neon-drenched synth pads, and an electric guitar solo."</p>
              <p className="bg-gray-700/50 p-3 rounded-md">"A mysterious and ambient soundscape with deep drones, sparse piano notes, and ethereal vocal textures."</p>
            </div>
          </div>
          <p className="pt-2">Experiment by changing parts of your prompt in real-time to steer the music in new directions!</p>
        </div>
      </div>
    </div>
  );
};

export default PromptGuideModal;
