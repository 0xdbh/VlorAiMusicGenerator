
import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fix: Initialize useRef with null for better type safety.
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#a855f7'); // purple-500
      gradient.addColorStop(0.5, '#ec4899'); // pink-500
      gradient.addColorStop(1, '#f59e0b'); // amber-500
      
      canvasCtx.fillStyle = gradient;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        canvasCtx.fillRect(
          x,
          canvas.height - barHeight,
          barWidth,
          barHeight
        );

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode]);

  return <canvas ref={canvasRef} width="600" height="150" className="w-full h-full" />;
};

export default AudioVisualizer;
