
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Use an OfflineAudioContext for decoding. It's designed for this purpose
  // and avoids issues with the main AudioContext lifecycle.
  const ctx = new OfflineAudioContext(numChannels, data.length / 2 / numChannels, sampleRate);
  
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // De-interleave the PCM data
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export function concatenateAudioBuffers(buffers: AudioBuffer[]): AudioBuffer | null {
  if (buffers.length === 0) {
    return null;
  }

  const firstBuffer = buffers[0];
  const { numberOfChannels, sampleRate } = firstBuffer;

  let totalLength = 0;
  for (const buffer of buffers) {
    if (buffer.numberOfChannels !== numberOfChannels || buffer.sampleRate !== sampleRate) {
        console.error("Cannot concatenate AudioBuffers with different channel counts or sample rates.");
        return null;
    }
    totalLength += buffer.length;
  }

  // Use an OfflineAudioContext to create the new buffer.
  const context = new OfflineAudioContext(numberOfChannels, totalLength, sampleRate);
  const newBuffer = context.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      newBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  }

  return newBuffer;
}


function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function interleave(inputL: Float32Array, inputR: Float32Array): Int16Array {
  const length = inputL.length + inputR.length;
  const result = new Int16Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex] * 32767;
    result[index++] = inputR[inputIndex] * 32767;
    inputIndex++;
  }
  return result;
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2;
  const bufferLength = buffer.length;
  const sampleRate = buffer.sampleRate;

  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, 16, true);
  
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  if (numOfChan === 2) {
    const pcm = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
     for (let i = 0; i < pcm.length; i++) {
        view.setInt16(44 + i * 2, pcm[i], true);
    }
  } else {
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
        view.setInt16(44 + i * 2, channelData[i] * 32767, true);
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

export async function createReverbImpulseResponse(audioContext: AudioContext): Promise<AudioBuffer> {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds reverb
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Simple exponential decay
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / 2, 2);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / 2, 2);
    }
    return impulse;
}
