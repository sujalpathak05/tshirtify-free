import state from "../store";

export const downloadCanvasToImage = () => {
  const canvas = document.querySelector("canvas");

  if (!canvas) {
    return false;
  }

  const dataURL = canvas.toDataURL();
  const link = document.createElement("a");

  link.href = dataURL;
  link.download = "canvas.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Delay revoke slightly so browsers on slower devices can start download reliably.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1200);
};

const STAGE_IMAGE_PRESETS = {
  "mockup-soft-gray": "/mockups/soft-gray-minimal.png",
  "mockup-brick-wall": "/mockups/brick-wall-closeup.png",
  "mockup-graphic-split": "/mockups/graphic-split.jpg",
};

const stageImageCache = new Map();

const getCachedStageImage = (src) => {
  if (!src) {
    return null;
  }

  const cached = stageImageCache.get(src);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  stageImageCache.set(src, image);
  return image;
};

const drawImageCover = (context, image, width, height) => {
  if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) {
    return false;
  }

  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return true;
};

const drawStageGradientBackground = (context, width, height, stageKey) => {
  const presets = {
    dark: {
      base: ["#2a2e3b", "#0b0b10"],
      glow: "rgba(89, 96, 120, 0.38)",
    },
    midnight: {
      base: ["#1c2235", "#090b13"],
      glow: "rgba(63, 115, 255, 0.32)",
    },
    studio: {
      base: ["#303030", "#090909"],
      glow: "rgba(145, 145, 145, 0.2)",
    },
    sunset: {
      base: ["#ff8a5b", "#1f1d2b"],
      glow: "rgba(255, 187, 107, 0.34)",
    },
    aurora: {
      base: ["#42e695", "#784ba0"],
      glow: "rgba(76, 238, 211, 0.28)",
    },
    rainbow: {
      base: ["#ff6b6b", "#341f97"],
      glow: "rgba(255, 255, 255, 0.22)",
    },
    ocean: {
      base: ["#7fdbff", "#1b3b6f"],
      glow: "rgba(136, 223, 255, 0.34)",
    },
    berry: {
      base: ["#ff9a9e", "#6a1b9a"],
      glow: "rgba(255, 164, 212, 0.3)",
    },
  };

  const selected = presets[stageKey] || presets.dark;

  const linear = context.createLinearGradient(0, 0, width, 0);
  linear.addColorStop(0, selected.base[0]);
  linear.addColorStop(1, selected.base[1]);
  context.fillStyle = linear;
  context.fillRect(0, 0, width, height);

  const radial = context.createRadialGradient(
    width * 0.08,
    height * 0.5,
    width * 0.02,
    width * 0.08,
    height * 0.5,
    width * 0.7
  );
  radial.addColorStop(0, selected.glow);
  radial.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = radial;
  context.fillRect(0, 0, width, height);
};

const drawStageBackgroundFrame = (context, width, height) => {
  const stageKey = state.stageBackground || "dark";
  const stageImageSrc = STAGE_IMAGE_PRESETS[stageKey];

  if (!stageImageSrc) {
    drawStageGradientBackground(context, width, height, stageKey);
    return;
  }

  // Image-backed mockup presets.
  drawStageGradientBackground(context, width, height, "dark");
  const image = getCachedStageImage(stageImageSrc);
  const didDrawImage = drawImageCover(context, image, width, height);

  if (!didDrawImage) {
    return;
  }

  const overlay = context.createLinearGradient(0, 0, 0, height);
  if (stageKey === "mockup-soft-gray") {
    overlay.addColorStop(0, "rgba(245,245,247,0.2)");
    overlay.addColorStop(1, "rgba(212,214,219,0.22)");
  } else if (stageKey === "mockup-brick-wall") {
    overlay.addColorStop(0, "rgba(42,24,14,0.16)");
    overlay.addColorStop(1, "rgba(16,10,6,0.2)");
  } else {
    overlay.addColorStop(0, "rgba(236,229,205,0.12)");
    overlay.addColorStop(1, "rgba(8,58,84,0.16)");
  }
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);
};

const createCompositedRecordingStream = (sourceCanvas, fps = 30) => {
  if (!sourceCanvas) {
    return null;
  }

  const width = sourceCanvas.width || sourceCanvas.clientWidth;
  const height = sourceCanvas.height || sourceCanvas.clientHeight;

  if (!width || !height) {
    return null;
  }

  const recordingCanvas = document.createElement("canvas");
  recordingCanvas.width = width;
  recordingCanvas.height = height;
  const recordingContext = recordingCanvas.getContext("2d");

  if (!recordingContext || !recordingCanvas.captureStream) {
    return null;
  }

  let rafId = 0;
  const renderFrame = () => {
    drawStageBackgroundFrame(recordingContext, width, height);
    recordingContext.drawImage(sourceCanvas, 0, 0, width, height);
    rafId = window.requestAnimationFrame(renderFrame);
  };

  renderFrame();
  const stream = recordingCanvas.captureStream(fps);

  return {
    stream,
    stopCompositing: () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    },
  };
};

export const startCanvasRecording = () => {
  const canvas = document.querySelector("canvas");

  if (!canvas || typeof MediaRecorder === "undefined") {
    return null;
  }

  const compositeSession = createCompositedRecordingStream(canvas, 30);
  const stream = compositeSession?.stream || (canvas.captureStream ? canvas.captureStream(30) : null);

  if (!stream) {
    return null;
  }
  const chunks = [];

  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch (error) {
    recorder = new MediaRecorder(stream);
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();

  return { recorder, stream, chunks, stopCompositing: compositeSession?.stopCompositing };
};

export const stopCanvasRecording = (session, fileName = "tshirt-cursor-motion.webm") =>
  new Promise((resolve) => {
    if (!session?.recorder || !session?.stream) {
      resolve(false);
      return;
    }

    const { recorder, stream, chunks, stopCompositing } = session;

    if (recorder.state === "inactive") {
      stopCompositing?.();
      stream.getTracks().forEach((track) => track.stop());
      resolve(false);
      return;
    }

    recorder.onstop = () => {
      stopCompositing?.();
      stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(chunks, {
        type: recorder.mimeType || "video/webm",
      });

      downloadBlob(blob, fileName);
      resolve(true);
    };

    recorder.stop();
  });

export const downloadCanvasMotion = async (
  durationMs = 15000,
  fileName = "tshirt-mockup-auto.webm"
) => {
  const session = startCanvasRecording();

  if (!session) {
    return false;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  return stopCanvasRecording(session, fileName);
};

export const reader = (file) =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = reject;
    fileReader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });

export const removeDarkBackgroundFromImage = async (
  imageSrc,
  threshold = 42,
  feather = 24
) => {
  if (!imageSrc) {
    return imageSrc;
  }

  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return imageSrc;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    return imageSrc;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const size = width * height;
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let queueStart = 0;
  let queueEnd = 0;

  const isDarkAtIndex = (index) => {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 8) {
      return false;
    }

    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    return maxChannel <= threshold && maxChannel - minChannel <= 35;
  };

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const index = y * width + x;
    if (visited[index] || !isDarkAtIndex(index)) {
      return;
    }

    visited[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;

    const offset = index * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 0;

    const x = index % width;
    const y = (index / width) | 0;

    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  const edge = Math.max(1, feather);
  for (let index = 0; index < size; index += 1) {
    if (visited[index]) {
      continue;
    }

    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 8) {
      continue;
    }

    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const maxChannel = Math.max(r, g, b);

    if (maxChannel <= threshold + edge) {
      const ratio = (maxChannel - threshold) / edge;
      const safeRatio = Math.max(0, Math.min(1, ratio));
      const nextAlpha = Math.round(alpha * safeRatio);
      data[offset + 3] = nextAlpha;

      if (nextAlpha <= 64) {
        data[offset] = Math.max(data[offset], 245);
        data[offset + 1] = Math.max(data[offset + 1], 245);
        data[offset + 2] = Math.max(data[offset + 2], 245);
      }
    }
  }

  // Remove black matte/halo from transparent and semi-transparent edge pixels.
  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];

    if (alpha <= 6) {
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      continue;
    }

    if (alpha < 180) {
      const matteLift = Math.round(((180 - alpha) / 180) * 255 * 0.8);
      data[offset] = Math.max(data[offset], matteLift);
      data[offset + 1] = Math.max(data[offset + 1], matteLift);
      data[offset + 2] = Math.max(data[offset + 2], matteLift);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export const getCroppedImage = async (imageSrc, cropPixels) => {
  if (!imageSrc || !cropPixels?.width || !cropPixels?.height) {
    return null;
  }

  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;

  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );

  return canvas.toDataURL("image/png");
};

export const getContrastingColor = (color) => {
  // Remove the '#' character if it exists
  const hex = color.replace("#", "");

  // Convert the hex string to RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate the brightness of the color
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return black or white depending on the brightness
  return brightness > 128 ? "black" : "white";
};
