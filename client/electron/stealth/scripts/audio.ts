export function buildAudioScript() {
  return `
  if (window.AnalyserNode && AnalyserNode.prototype.getFloatFrequencyData) {
    const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function (array) {
      originalGetFloatFrequencyData.call(this, array);
      for (let i = 0; i < array.length; i += 1) {
        array[i] = array[i] + fp.audioOffset;
      }
    };
  }

  if (window.AudioBuffer && AudioBuffer.prototype.getChannelData) {
    const audioPatched = Symbol.for('pandao.audio.patched');
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (...args) {
      const data = originalGetChannelData.apply(this, args);
      if (!data[audioPatched]) {
        for (let i = 0; i < data.length; i += 100) {
          data[i] = data[i] + fp.audioOffset;
        }
        Object.defineProperty(data, audioPatched, { value: true });
      }
      return data;
    };
  }
`;
}
