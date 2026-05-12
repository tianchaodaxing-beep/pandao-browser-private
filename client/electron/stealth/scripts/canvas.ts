export function buildCanvasScript() {
  return `
  const canvasNoise = (index) => {
    const value = (fp.canvasSeed + index * 17) % 3;
    return value - 1;
  };

  const applyCanvasNoise = (canvas) => {
    const context = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) {
      return () => {};
    }

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const original = new Uint8ClampedArray(imageData.data);
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + canvasNoise(i)));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + canvasNoise(i + 1)));
      }
      context.putImageData(imageData, 0, 0);
      return () => {
        imageData.data.set(original);
        context.putImageData(imageData, 0, 0);
      };
    } catch {
      return () => {};
    }
  };

  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    const restore = applyCanvasNoise(this);
    try {
      return originalToDataURL.apply(this, args);
    } finally {
      restore();
    }
  };

  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
    const restore = applyCanvasNoise(this);
    return originalToBlob.call(this, (...blobArgs) => {
      restore();
      callback(...blobArgs);
    }, ...args);
  };

  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    const imageData = originalGetImageData.apply(this, args);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + canvasNoise(i)));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + canvasNoise(i + 1)));
    }
    return imageData;
  };
`;
}
