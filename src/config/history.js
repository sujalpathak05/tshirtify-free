import { snapshot, subscribe } from "valtio";

import state from "../store";

const HISTORY_KEYS = [
  "color",
  "isLogoTexture",
  "isFullTexture",
  "frontDecal",
  "backDecal",
  "leftShoulderDecal",
  "rightShoulderDecal",
  "fullDecal",
  "frontDecalPosition",
  "backDecalPosition",
  "leftShoulderDecalPosition",
  "rightShoulderDecalPosition",
  "frontDecalScale",
  "backDecalScale",
  "leftShoulderDecalScale",
  "rightShoulderDecalScale",
  "designTarget",
  "stageBackground",
  "acidWashIntensity",
  "puffPrintIntensity",
  "logoDragMode",
  "animationPreset",
  "animationIntensity",
  "autoRotate",
  "autoRotateSpeed",
  "cameraAutoRotate",
  "cameraAutoRotateSpeed",
  "exportSize",
  "exportQuality",
  "exportModelFormat",
  "autoCleanDarkBg",
];

const MAX_HISTORY_ITEMS = 120;
const historyStack = [];
const listeners = new Set();

let historyIndex = -1;
let isApplyingHistory = false;
let isInitialized = false;
let unsubscribeState = null;

const cloneValue = (value) => {
  if (Array.isArray(value)) {
    return [...value];
  }
  return value;
};

const captureEditableState = () => {
  const snap = snapshot(state);
  const next = {};

  HISTORY_KEYS.forEach((key) => {
    next[key] = cloneValue(snap[key]);
  });

  return next;
};

const areSnapshotsEqual = (a, b) => {
  if (!a || !b) {
    return false;
  }

  for (const key of HISTORY_KEYS) {
    const left = a[key];
    const right = b[key];

    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }

      for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
          return false;
        }
      }
      continue;
    }

    if (left !== right) {
      return false;
    }
  }

  return true;
};

const getHistoryMeta = () => ({
  canUndo: historyIndex > 0,
  canRedo: historyIndex >= 0 && historyIndex < historyStack.length - 1,
  size: historyStack.length,
  index: historyIndex,
});

const emitHistory = () => {
  const payload = getHistoryMeta();
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      // Keep history flow robust even if a listener throws.
    }
  });
};

const pushSnapshot = (nextSnapshot) => {
  if (historyIndex >= 0 && areSnapshotsEqual(historyStack[historyIndex], nextSnapshot)) {
    return false;
  }

  if (historyIndex < historyStack.length - 1) {
    historyStack.splice(historyIndex + 1);
  }

  historyStack.push(nextSnapshot);

  if (historyStack.length > MAX_HISTORY_ITEMS) {
    const overflow = historyStack.length - MAX_HISTORY_ITEMS;
    historyStack.splice(0, overflow);
  }

  historyIndex = historyStack.length - 1;
  emitHistory();
  return true;
};

const applySnapshot = (nextSnapshot) => {
  if (!nextSnapshot) {
    return false;
  }

  isApplyingHistory = true;

  HISTORY_KEYS.forEach((key) => {
    state[key] = cloneValue(nextSnapshot[key]);
  });

  isApplyingHistory = false;
  emitHistory();
  return true;
};

export const initStateHistory = () => {
  if (isInitialized) {
    emitHistory();
    return () => {};
  }

  isInitialized = true;
  historyStack.length = 0;
  historyIndex = -1;
  pushSnapshot(captureEditableState());

  unsubscribeState = subscribe(state, () => {
    if (isApplyingHistory) {
      return;
    }

    pushSnapshot(captureEditableState());
  });

  return () => {
    if (unsubscribeState) {
      unsubscribeState();
      unsubscribeState = null;
    }

    listeners.clear();
    historyStack.length = 0;
    historyIndex = -1;
    isInitialized = false;
  };
};

export const subscribeStateHistory = (listener) => {
  listeners.add(listener);
  listener(getHistoryMeta());

  return () => {
    listeners.delete(listener);
  };
};

export const undoStateHistory = () => {
  if (historyIndex <= 0) {
    emitHistory();
    return false;
  }

  historyIndex -= 1;
  return applySnapshot(historyStack[historyIndex]);
};

export const redoStateHistory = () => {
  if (historyIndex < 0 || historyIndex >= historyStack.length - 1) {
    emitHistory();
    return false;
  }

  historyIndex += 1;
  return applySnapshot(historyStack[historyIndex]);
};
