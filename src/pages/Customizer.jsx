import React, { useEffect, useRef, useState } from "react";
import { useSnapshot } from "valtio";

import state from "../store";
import {
  downloadCanvasMotion,
  downloadCanvasToImage,
  removeDarkBackgroundFromImage,
  reader,
  startCanvasRecording,
  stopCanvasRecording,
  upscaleImageTo4K,
} from "../config/helpers";
import {
  downloadShirtAsGLB,
} from "../config/glbExport";
import { DecalTypes, DesignSides } from "../config/constants";
import {
  initStateHistory,
  redoStateHistory,
  subscribeStateHistory,
  undoStateHistory,
} from "../config/history";
import { FilePicker } from "../components";

const GARMENT_COLORS = [
  "#FFFFFF",
  "#F8FAFC",
  "#F1F5F9",
  "#CBD5E1",
  "#9CA3AF",
  "#4B5563",
  "#353934",
  "#1F2937",
  "#111827",
  "#020617",
  "#000000",
  "#FEE2E2",
  "#EF4444",
  "#B91C1C",
  "#FEF3C7",
  "#F59E0B",
  "#A16207",
  "#ECFCCB",
  "#84CC16",
  "#3F6212",
  "#DCFCE7",
  "#0F172A",
  "#22C55E",
  "#166534",
  "#CCFBF1",
  "#14B8A6",
  "#115E59",
  "#E0F2FE",
  "#0EA5E9",
  "#0369A1",
  "#DBEAFE",
  "#3B82F6",
  "#1E3A8A",
  "#EDE9FE",
  "#8B5CF6",
  "#5B21B6",
  "#FCE7F3",
  "#EC4899",
  "#9D174D",
  "#FFE4E6",
  "#F97316",
  "#7C2D12",
];

const BACKGROUND_PRESETS = [
  { key: "dark", label: "Dark" },
  { key: "midnight", label: "Midnight" },
  { key: "studio", label: "Studio" },
  { key: "sunset", label: "Sunset" },
  { key: "aurora", label: "Aurora" },
  { key: "rainbow", label: "Rainbow" },
  { key: "ocean", label: "Ocean" },
  { key: "berry", label: "Berry" },
];

const MOCKUP_PRESETS = [
  { key: "mockup-soft-gray", label: "Soft Gray", thumb: "/mockups/soft-gray-minimal.png" },
  { key: "mockup-brick-wall", label: "Brick Wall", thumb: "/mockups/brick-wall-closeup.png" },
  { key: "mockup-graphic-split", label: "Graphic Split", thumb: "/mockups/graphic-split.jpg" },
];

const ANIMATION_PRESETS = [
  { key: "static", label: "Static", autoRotate: false },
  { key: "walk", label: "Walk", autoRotate: false },
  { key: "waves", label: "Waves", autoRotate: true },
  { key: "knit", label: "Knit", autoRotate: true },
  { key: "dance", label: "Dance", autoRotate: false },
  { key: "jump", label: "Jump", autoRotate: false },
  { key: "bounce", label: "Bounce", autoRotate: false },
  { key: "float", label: "Float", autoRotate: false },
  { key: "spin", label: "Spin", autoRotate: false },
  { key: "swagger", label: "Swagger", autoRotate: false },
];

const CAMERA_PRESETS = [
  { key: "off", label: "Off" },
  { key: "slow", label: "Orbit" },
  { key: "fast", label: "Orbit+" },
];

const DECAL_TRANSFORM_SETTINGS = {
  front: {
    positionKey: "frontDecalPosition",
    scaleKey: "frontDecalScale",
    minX: -0.28,
    maxX: 0.28,
    minY: -0.33,
    maxY: 0.33,
    minScale: 0.05,
    maxScale: 0.35,
    defaultScale: 0.15,
  },
  back: {
    positionKey: "backDecalPosition",
    scaleKey: "backDecalScale",
    minX: -0.28,
    maxX: 0.28,
    minY: -0.33,
    maxY: 0.33,
    minScale: 0.05,
    maxScale: 0.35,
    defaultScale: 0.15,
  },
  leftShoulder: {
    positionKey: "leftShoulderDecalPosition",
    scaleKey: "leftShoulderDecalScale",
    minX: -0.34,
    maxX: -0.06,
    minY: 0.12,
    maxY: 0.42,
    minScale: 0.03,
    maxScale: 0.2,
    defaultScale: 0.08,
  },
  rightShoulder: {
    positionKey: "rightShoulderDecalPosition",
    scaleKey: "rightShoulderDecalScale",
    minX: 0.06,
    maxX: 0.34,
    minY: 0.12,
    maxY: 0.42,
    minScale: 0.03,
    maxScale: 0.2,
    defaultScale: 0.08,
  },
};

const normalizeGlbFileName = (rawName = "tshirt-design.glb", extension = "glb") => {
  const safeExtension = extension === "gbl" ? "gbl" : "glb";
  const safeRawName = typeof rawName === "string" ? rawName : String(rawName || "tshirt-design");
  const trimmedName = safeRawName.trim();
  const baseName = trimmedName.replace(/\.(glb|gltf|gbl)$/i, "");
  return `${baseName || "tshirt-design"}.${safeExtension}`;
};

const AccordionSection = ({ title, open, onToggle, children, badge = "" }) => (
  <div className="vt-section">
    <button type="button" className="vt-section-trigger" onClick={onToggle}>
      <span>{title}</span>
      <span className="vt-section-meta">
        {badge && <span className="vt-pro-badge">{badge}</span>}
        <span>{open ? "v" : ">"}</span>
      </span>
    </button>

    {open && <div className="vt-section-content">{children}</div>}
  </div>
);

const Customizer = () => {
  const snap = useSnapshot(state);

  const [file, setFile] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [showUploadStudio, setShowUploadStudio] = useState(false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    mockups: true,
    garmentColor: false,
    background: false,
    animation: true,
    cameraAnimation: true,
  });
  const [isRecordingMotion, setIsRecordingMotion] = useState(false);
  const [isCursorRecording, setIsCursorRecording] = useState(false);
  const [isExportingGLB, setIsExportingGLB] = useState(false);
  const [historyMeta, setHistoryMeta] = useState({
    canUndo: false,
    canRedo: false,
  });

  const designUploadRef = useRef(null);
  const frontDesignUploadRef = useRef(null);
  const backDesignUploadRef = useRef(null);
  const leftShoulderUploadRef = useRef(null);
  const rightShoulderUploadRef = useRef(null);
  const modelUploadRef = useRef(null);
  const cursorRecordingRef = useRef(null);
  const previousAutoRotateRef = useRef(false);
  const uploadedModelUrlRef = useRef("");
  const didAutoCleanDefaultsRef = useRef(false);

  useEffect(() => {
    const cleanupHistory = initStateHistory();
    const unsubscribeHistory = subscribeStateHistory((meta) => {
      setHistoryMeta({
        canUndo: meta.canUndo,
        canRedo: meta.canRedo,
      });
    });

    return () => {
      unsubscribeHistory();
      cleanupHistory();
    };
  }, []);

  useEffect(
    () => () => {
      if (uploadedModelUrlRef.current) {
        URL.revokeObjectURL(uploadedModelUrlRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (didAutoCleanDefaultsRef.current) {
      return;
    }

    didAutoCleanDefaultsRef.current = true;

    let active = true;
    const run = async () => {
      if (!state.autoCleanDarkBg) {
        return;
      }

      const sideKeys = ["front", "back", "leftShoulder", "rightShoulder"];

      for (const side of sideKeys) {
        const stateKey = getDesignStateKeyBySide(side);
        const currentValue = state[stateKey];
        if (!active || !currentValue) {
          continue;
        }

        try {
          const cleaned = await removeDarkBackgroundFromImage(currentValue);
          if (active && cleaned) {
            state[stateKey] = cleaned;
          }
        } catch (error) {
          // Keep original image if cleanup fails.
        }
      }
    };

    run();

    // Prevent stale HMR/session back decal artifacts from appearing as default black patch.
    if (state.modelUrl === "/shirt_baked.glb" && state.backDecal) {
      state.backDecal = "";
      state.backDecalPosition = [0, 0.04, -0.15];
      state.backDecalScale = 0.15;
    }

    return () => {
      active = false;
    };
  }, []);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleMockupPreset = (presetKey) => {
    state.stageBackground = presetKey;
    state.color = "#ffffff";
    state.designTarget = "front";
    state.animationPreset = "static";
    state.autoRotate = false;
    state.cameraAutoRotate = false;
  };

  const getTransformSettings = () => {
    return DECAL_TRANSFORM_SETTINGS[snap.designTarget] || DECAL_TRANSFORM_SETTINGS.front;
  };

  const getCurrentScale = () => {
    const settings = getTransformSettings();
    return Number(snap[settings.scaleKey] ?? settings.defaultScale);
  };

  const getCurrentPosition = () => {
    const settings = getTransformSettings();
    const value = snap[settings.positionKey];
    if (Array.isArray(value) && value.length === 3) {
      return value;
    }
    return [0, 0, 0];
  };

  const setCurrentScale = (nextScale) => {
    const settings = getTransformSettings();
    const clampedScale = Math.min(settings.maxScale, Math.max(settings.minScale, nextScale));
    state[settings.scaleKey] = clampedScale;
  };

  const setCurrentPosition = (nextX, nextY) => {
    const settings = getTransformSettings();
    const current = getCurrentPosition();
    const clampedX = Math.min(settings.maxX, Math.max(settings.minX, nextX));
    const clampedY = Math.min(settings.maxY, Math.max(settings.minY, nextY));
    state[settings.positionKey] = [clampedX, clampedY, current[2]];
  };

  const nudgeCurrentPosition = (axis, delta) => {
    const current = getCurrentPosition();
    if (axis === "x") {
      setCurrentPosition(current[0] + delta, current[1]);
      return;
    }
    setCurrentPosition(current[0], current[1] + delta);
  };

  const applyScalePreset = (preset) => {
    const settings = getTransformSettings();
    if (preset === "small") {
      setCurrentScale(settings.minScale + 0.02);
      return;
    }
    if (preset === "big") {
      setCurrentScale(settings.maxScale - 0.02);
      return;
    }
    setCurrentScale(settings.defaultScale);
  };

  const getDesignStateKeyBySide = (side) => DecalTypes[side]?.stateProperty || "frontDecal";

  const removeDesignBySide = (side) => {
    const sideKey = getDesignStateKeyBySide(side);
    state[sideKey] = "";
  };

  const removeCurrentDesign = () => {
    removeDesignBySide(snap.designTarget || "front");
  };

  const removeAllDesigns = () => {
    state.frontDecal = "";
    state.backDecal = "";
    state.leftShoulderDecal = "";
    state.rightShoulderDecal = "";
    state.fullDecal = "";
    state.isFullTexture = false;
    state.isLogoTexture = true;
  };

  const handleUndo = () => {
    undoStateHistory();
  };

  const handleRedo = () => {
    redoStateHistory();
  };

  const maybeCleanDarkBackground = async (type, source) => {
    if (!source) {
      return source;
    }

    let processed = source;

    try {
      processed = await upscaleImageTo4K(source, 4096);
    } catch (error) {
      processed = source;
    }

    if (type === "full" || !state.autoCleanDarkBg) {
      return processed;
    }

    try {
      return await removeDarkBackgroundFromImage(processed);
    } catch (error) {
      return processed;
    }
  };

  const handleDecals = (type, result) => {
    const decalType = DecalTypes[type];
    if (!decalType) return;

    state.areDecalTexturesReady = false;
    state[decalType.stateProperty] = result;

    if (type === "full") {
      state.isFullTexture = true;
    } else {
      state.isLogoTexture = true;
    }
  };

  const readFile = (type, sourceOverride) => {
    if (sourceOverride) {
      maybeCleanDarkBackground(type, sourceOverride)
        .then((result) => {
          handleDecals(type, result);
        })
        .catch(() => {
          handleDecals(type, sourceOverride);
        });
      return;
    }

    if (!file) return;

    reader(file)
      .then((result) => maybeCleanDarkBackground(type, result))
      .then((cleaned) => handleDecals(type, cleaned))
      .catch(() => {});
  };

  const applyDesignFileToSide = (targetSide, designFile) => {
    if (!designFile) return;

    state.designTarget = targetSide;

    reader(designFile)
      .then((result) => maybeCleanDarkBackground(targetSide, result))
      .then((cleaned) => {
        handleDecals(targetSide, cleaned);
      })
      .catch(() => {});
  };

  const handleDesignUpload = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);

    reader(selectedFile)
      .then((result) => maybeCleanDarkBackground(state.designTarget, result))
      .then((cleaned) => {
        handleDecals(state.designTarget, cleaned);
      })
      .catch(() => {});

    event.target.value = "";
  };

  const handleSideDesignUpload = (targetSide, event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    applyDesignFileToSide(targetSide, selectedFile);
    event.target.value = "";
  };

  const uploadMockupFile = (modelFile) => {
    if (!modelFile) return;

    const fileName = modelFile.name || "";
    const lower = fileName.toLowerCase();

    if (!lower.endsWith(".glb") && !lower.endsWith(".gltf") && !lower.endsWith(".gbl")) {
      return;
    }

    const modelUrl = URL.createObjectURL(modelFile);

    if (uploadedModelUrlRef.current) {
      URL.revokeObjectURL(uploadedModelUrlRef.current);
    }

    uploadedModelUrlRef.current = modelUrl;
    state.isModelReady = false;
    state.modelUrl = modelUrl;
    state.modelFileName = fileName;
  };

  const handleModelUpload = (event) => {
    uploadMockupFile(event.target.files?.[0] || null);
  };

  const resetDefaultMockup = () => {
    if (uploadedModelUrlRef.current) {
      URL.revokeObjectURL(uploadedModelUrlRef.current);
      uploadedModelUrlRef.current = "";
    }

    state.isModelReady = false;
    state.modelUrl = "/shirt_baked.glb";
    state.modelFileName = "shirt_baked.glb";
  };

  const handleAnimationPreset = (preset) => {
    const presetConfig = ANIMATION_PRESETS.find((item) => item.key === preset);

    state.animationPreset = preset;
    state.autoRotate = Boolean(presetConfig?.autoRotate);

    if (preset === "static") {
      state.autoRotate = false;
      return;
    }

    if (preset === "walk") {
      // Walk preset keeps camera stable so shirt appears to move forward.
      state.autoRotate = false;
      state.cameraAutoRotate = false;
      return;
    }
  };

  const setDesignTarget = (target) => {
    state.designTarget = target;
    state.autoRotate = false;
    state.cameraAutoRotate = false;
  };

  const stopAllMotion = () => {
    state.animationPreset = "static";
    state.autoRotate = false;
    state.cameraAutoRotate = false;
  };

  const handleCameraPreset = (preset) => {
    if (preset === "off") {
      state.cameraAutoRotate = false;
      state.cameraAutoRotateSpeed = 1;
      return;
    }

    state.cameraAutoRotate = true;
    state.cameraAutoRotateSpeed = preset === "fast" ? 1.8 : 0.8;
  };

  const handleCursorRecording = async () => {
    if (isRecordingMotion) return;

    if (!isCursorRecording) {
      const session = startCanvasRecording();
      if (!session) return;

      previousAutoRotateRef.current = state.autoRotate;
      state.autoRotate = false;
      state.logoDragMode = false;
      state.isDecalDragging = false;
      cursorRecordingRef.current = session;
      setIsCursorRecording(true);
      return;
    }

    const session = cursorRecordingRef.current;
    cursorRecordingRef.current = null;
    setIsCursorRecording(false);
    await stopCanvasRecording(session, "tshirt-cursor-motion.webm");
    state.autoRotate = previousAutoRotateRef.current;
  };

  const handleMotionDownload = async () => {
    if (isRecordingMotion || isCursorRecording) return;

    setIsRecordingMotion(true);
    const previousAutoRotate = state.autoRotate;
    state.autoRotate = true;

    try {
      await downloadCanvasMotion(15000, "tshirt-mockup-auto.webm");
    } finally {
      state.autoRotate = previousAutoRotate;
      setIsRecordingMotion(false);
    }
  };

  const handleGLBDownload = async () => {
    if (isExportingGLB) return;
    if (isRecordingMotion) {
      window.alert("Video recording chal rahi hai. Pehle recording stop karo, phir 3D export karo.");
      return;
    }
    if (isCursorRecording) {
      window.alert("Cursor recording ON hai. Pehle Stop Video karo, phir 3D export karo.");
      return;
    }

    setIsExportingGLB(true);
    try {
      const waitForTextures = async () => {
        const started = Date.now();
        while (Date.now() - started < 2000) {
          if (state.areDecalTexturesReady) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      };

      await waitForTextures();

      // Let React Three Fiber flush decal/material changes before export clone is built.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));

      const outputName = normalizeGlbFileName(
        snap.modelFileName || "tshirt-design.glb",
        snap.exportModelFormat
      );
      const didDownload = await downloadShirtAsGLB(outputName);

      if (!didDownload) {
        window.alert("3D export failed. Design texture load hone ke baad dobara export karo.");
      } else if (!state.areDecalTexturesReady) {
        window.alert("Export ho gaya, lekin textures abhi load ho rahi thi. Accurate result ke liye ek baar aur export karo.");
      }
    } catch (error) {
      window.alert(`3D export error: ${error?.message || "Unknown error"}`);
    } finally {
      setIsExportingGLB(false);
    }
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      // Ignore unsupported fullscreen errors.
    }
  };

  const handleApplyCurrentFileToSide = (side) => {
    state.designTarget = side;

    if (!file) {
      designUploadRef.current?.click();
      return;
    }

    applyDesignFileToSide(side, file);
  };

  const activeTransform = getTransformSettings();
  const currentPosition = getCurrentPosition();
  const currentScale = getCurrentScale();

  return (
    <>
      <aside className="vt-sidebar">
        <input
          ref={designUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleDesignUpload}
        />
        <input
          ref={frontDesignUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleSideDesignUpload("front", event)}
        />
        <input
          ref={backDesignUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleSideDesignUpload("back", event)}
        />
        <input
          ref={leftShoulderUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleSideDesignUpload("leftShoulder", event)}
        />
        <input
          ref={rightShoulderUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleSideDesignUpload("rightShoulder", event)}
        />
        <input
          ref={modelUploadRef}
          type="file"
          accept=".glb,.gltf,.gbl,model/gltf-binary,model/gltf+json"
          className="hidden"
          onChange={handleModelUpload}
        />

        <button
          type="button"
          className="vt-pill vt-pill-dark"
          onClick={() => designUploadRef.current?.click()}
        >
          <span>Upload Your Design</span>
          <span className="vt-pill-icon">UP</span>
        </button>

        <div className="vt-front-back-row">
          <button
            type="button"
            className={`vt-front-back-btn ${snap.designTarget === "front" ? "vt-front-back-active" : ""}`}
            onClick={() => setDesignTarget("front")}
          >
            Edit Front
          </button>
          <button
            type="button"
            className={`vt-front-back-btn ${snap.designTarget === "back" ? "vt-front-back-active" : ""}`}
            onClick={() => setDesignTarget("back")}
          >
            Edit Back
          </button>
        </div>
        <div className="vt-front-back-row">
          <button
            type="button"
            className="vt-front-back-btn"
            onClick={() => frontDesignUploadRef.current?.click()}
          >
            Upload Front
          </button>
          <button
            type="button"
            className="vt-front-back-btn"
            onClick={() => backDesignUploadRef.current?.click()}
          >
            Upload Back
          </button>
        </div>
        <div className="vt-front-back-row">
          <button
            type="button"
            className="vt-front-back-btn"
            onClick={handleUndo}
            disabled={!historyMeta.canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="vt-front-back-btn"
            onClick={handleRedo}
            disabled={!historyMeta.canRedo}
          >
            Redo
          </button>
        </div>
        <div className="vt-front-back-row">
          <button type="button" className="vt-front-back-btn" onClick={removeCurrentDesign}>
            Remove Current
          </button>
          <button type="button" className="vt-front-back-btn" onClick={removeAllDesigns}>
            Remove All
          </button>
        </div>

        <button
          type="button"
          className="vt-pill vt-pill-muted"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
        >
          <span>Advanced Controls</span>
          <span className="vt-pill-icon">CFG</span>
        </button>

        <AccordionSection
          title="3D Mockups"
          open={openSections.mockups}
          onToggle={() => toggleSection("mockups")}
        >
          <div className="vt-mockup-grid">
            {MOCKUP_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`vt-mockup-card ${
                  snap.stageBackground === preset.key ? "vt-mockup-card-active" : ""
                }`}
                onClick={() => handleMockupPreset(preset.key)}
              >
                <img src={preset.thumb} alt={preset.label} className="vt-mockup-thumb" loading="lazy" />
                <span className="vt-mockup-label">{preset.label}</span>
              </button>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Garment Color"
          open={openSections.garmentColor}
          onToggle={() => toggleSection("garmentColor")}
        >
          <div className="vt-color-grid">
            {GARMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`vt-color-swatch ${snap.color === color ? "vt-color-swatch-active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  state.color = color;
                }}
              />
            ))}
          </div>
          <div className="vt-range-label">
            Custom Palette
            <span>{snap.color.toUpperCase()}</span>
          </div>
          <input
            type="color"
            value={snap.color}
            className="vt-color-input"
            onChange={(event) => {
              state.color = event.target.value;
            }}
          />
        </AccordionSection>

        <AccordionSection
          title="Background"
          open={openSections.background}
          onToggle={() => toggleSection("background")}
        >
          <div className="vt-chip-row">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`vt-chip ${snap.stageBackground === preset.key ? "vt-chip-active" : ""}`}
                onClick={() => {
                  state.stageBackground = preset.key;
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title="Animation"
          badge="Free"
          open={openSections.animation}
          onToggle={() => toggleSection("animation")}
        >
          <div className="vt-chip-row vt-chip-grid">
            {ANIMATION_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`vt-chip ${snap.animationPreset === preset.key ? "vt-chip-active" : ""}`}
                onClick={() => handleAnimationPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button type="button" className="vt-stop-motion-btn" onClick={stopAllMotion}>
            Stop Motion
          </button>

          <label className="vt-range-label" htmlFor="animation-speed">
            Animation Speed
            <span>{snap.animationIntensity.toFixed(1)}</span>
          </label>
          <input
            id="animation-speed"
            className="vt-range"
            type="range"
            min={0.1}
            max={1.5}
            step={0.1}
            value={snap.animationIntensity}
            onChange={(event) => {
              const next = Number(event.target.value);
              state.animationIntensity = next;
              state.autoRotateSpeed = 0.25 + next * 0.5;
            }}
          />
        </AccordionSection>

        <AccordionSection
          title="Camera Animation"
          badge="Free"
          open={openSections.cameraAnimation}
          onToggle={() => toggleSection("cameraAnimation")}
        >
          <div className="vt-chip-row">
            {CAMERA_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`vt-chip ${
                  (preset.key === "off" && !snap.cameraAutoRotate) ||
                  (preset.key === "slow" &&
                    snap.cameraAutoRotate &&
                    snap.cameraAutoRotateSpeed <= 1) ||
                  (preset.key === "fast" && snap.cameraAutoRotate && snap.cameraAutoRotateSpeed > 1)
                    ? "vt-chip-active"
                    : ""
                }`}
                onClick={() => handleCameraPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </AccordionSection>

        {isAdvancedOpen && (
          <div className="vt-advanced-wrap">
            <div className="vt-advanced-title">Design Side</div>
            <div className="vt-chip-row vt-chip-grid">
              {DesignSides.map((side) => (
                <button
                  key={side.value}
                  type="button"
                  className={`vt-chip ${snap.designTarget === side.value ? "vt-chip-active" : ""}`}
                  onClick={() => setDesignTarget(side.value)}
                >
                  {side.label}
                </button>
              ))}
            </div>

            <div className="vt-advanced-actions">
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => handleApplyCurrentFileToSide("front")}
              >
                Set Front from Upload
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => handleApplyCurrentFileToSide("back")}
              >
                Set Back from Upload
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => leftShoulderUploadRef.current?.click()}
              >
                Upload Left Shoulder
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => rightShoulderUploadRef.current?.click()}
              >
                Upload Right Shoulder
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={async () => {
                  const stateKey = getDesignStateKeyBySide(snap.designTarget);
                  const currentValue = snap[stateKey];
                  if (!currentValue) return;

                  try {
                    const cleaned = await removeDarkBackgroundFromImage(currentValue);
                    if (cleaned) {
                      state[stateKey] = cleaned;
                    }
                  } catch (error) {
                    // Ignore cleanup errors and keep current texture.
                  }
                }}
              >
                Clean Black BG (Current Side)
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={removeCurrentDesign}
              >
                Clear Current Side Design
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => {
                  state.autoCleanDarkBg = !snap.autoCleanDarkBg;
                }}
              >
                {snap.autoCleanDarkBg ? "Auto Clean Black BG: ON" : "Auto Clean Black BG: OFF"}
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => {
                  state.logoDragMode = !snap.logoDragMode;
                  state.isDecalDragging = false;
                }}
              >
                {snap.logoDragMode ? "Drag ON" : "Drag OFF"}
              </button>
              <button
                type="button"
                className="vt-mini-btn"
                onClick={() => modelUploadRef.current?.click()}
              >
                Upload 3D Mockup
              </button>
              <button type="button" className="vt-mini-btn" onClick={resetDefaultMockup}>
                Default Mockup
              </button>
            </div>

            <div className="vt-advanced-transform">
              <div className="vt-advanced-title">Design Transform ({snap.designTarget})</div>

              <div className="vt-chip-row">
                <button type="button" className="vt-chip" onClick={() => applyScalePreset("small")}>
                  Small
                </button>
                <button type="button" className="vt-chip" onClick={() => applyScalePreset("normal")}>
                  Normal
                </button>
                <button type="button" className="vt-chip" onClick={() => applyScalePreset("big")}>
                  Big
                </button>
              </div>

              <label className="vt-range-label" htmlFor="design-scale">
                Design Size
                <span>{currentScale.toFixed(2)}</span>
              </label>
              <input
                id="design-scale"
                className="vt-range"
                type="range"
                min={activeTransform.minScale}
                max={activeTransform.maxScale}
                step={0.01}
                value={currentScale}
                onChange={(event) => {
                  setCurrentScale(Number(event.target.value));
                }}
              />

              <label className="vt-range-label" htmlFor="design-x">
                Left / Right
                <span>{currentPosition[0].toFixed(2)}</span>
              </label>
              <input
                id="design-x"
                className="vt-range"
                type="range"
                min={activeTransform.minX}
                max={activeTransform.maxX}
                step={0.01}
                value={currentPosition[0]}
                onChange={(event) => {
                  setCurrentPosition(Number(event.target.value), currentPosition[1]);
                }}
              />

              <label className="vt-range-label" htmlFor="design-y">
                Up / Down
                <span>{currentPosition[1].toFixed(2)}</span>
              </label>
              <input
                id="design-y"
                className="vt-range"
                type="range"
                min={activeTransform.minY}
                max={activeTransform.maxY}
                step={0.01}
                value={currentPosition[1]}
                onChange={(event) => {
                  setCurrentPosition(currentPosition[0], Number(event.target.value));
                }}
              />

              <div className="vt-nudge-grid">
                <button type="button" className="vt-mini-btn" onClick={() => nudgeCurrentPosition("x", -0.01)}>
                  Left
                </button>
                <button type="button" className="vt-mini-btn" onClick={() => nudgeCurrentPosition("x", 0.01)}>
                  Right
                </button>
                <button type="button" className="vt-mini-btn" onClick={() => nudgeCurrentPosition("y", 0.01)}>
                  Up
                </button>
                <button type="button" className="vt-mini-btn" onClick={() => nudgeCurrentPosition("y", -0.01)}>
                  Down
                </button>
              </div>
            </div>

            <div className="vt-advanced-sliders">
              <label className="vt-range-label" htmlFor="acid-wash">
                Acid Wash
                <span>{snap.acidWashIntensity.toFixed(1)}</span>
              </label>
              <input
                id="acid-wash"
                className="vt-range"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={snap.acidWashIntensity}
                onChange={(event) => {
                  state.acidWashIntensity = Number(event.target.value);
                }}
              />

              <label className="vt-range-label" htmlFor="puff-print">
                Puff Print
                <span>{snap.puffPrintIntensity.toFixed(1)}</span>
              </label>
              <input
                id="puff-print"
                className="vt-range"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={snap.puffPrintIntensity}
                onChange={(event) => {
                  state.puffPrintIntensity = Number(event.target.value);
                }}
              />
            </div>

            <button
              type="button"
              className="vt-pill vt-pill-muted"
              onClick={() => setShowUploadStudio((prev) => !prev)}
            >
              <span>{showUploadStudio ? "Close Upload Studio" : "Open Upload Studio"}</span>
              <span className="vt-pill-icon">*</span>
            </button>

            {showUploadStudio && (
              <div className="vt-upload-studio">
                <FilePicker
                  file={file}
                  setFile={setFile}
                  readFile={readFile}
                  designTarget={snap.designTarget}
                  uploadMockupFile={uploadMockupFile}
                  modelFileName={snap.modelFileName}
                />
              </div>
            )}
          </div>
        )}

        <div className="vt-export-stack">
          <button
            type="button"
            className="vt-export-btn"
            onClick={() => setIsExportPanelOpen(true)}
          >
            <span>Export</span>
            <span className="vt-pill-icon">GO</span>
          </button>

          <div className="vt-export-options">
            <button type="button" className="vt-mini-btn" onClick={downloadCanvasToImage}>
              PNG
            </button>
            <button type="button" className="vt-mini-btn" onClick={handleCursorRecording}>
              {isCursorRecording ? "Stop Video" : "Cursor Video"}
            </button>
            <button type="button" className="vt-mini-btn" onClick={handleMotionDownload}>
              {isRecordingMotion ? "Recording..." : "Mockup Video"}
            </button>
          </div>
        </div>
      </aside>

      {isExportPanelOpen && (
        <div className="vt-export-panel">
          <div className="vt-export-header">
            <h3>Export Options</h3>
            <button type="button" onClick={() => setIsExportPanelOpen(false)}>
              X
            </button>
          </div>

          <div className="vt-export-group">
            <div className="vt-export-title">Size</div>
            <div className="vt-size-grid">
              <button
                type="button"
                className={`vt-size-btn ${snap.exportSize === "auto" ? "vt-size-btn-active" : ""}`}
                onClick={() => {
                  state.exportSize = "auto";
                }}
              >
                <span className="vt-size-icon vt-size-auto" />
                <span>Auto</span>
              </button>
              <button
                type="button"
                className={`vt-size-btn ${snap.exportSize === "portrait" ? "vt-size-btn-active" : ""}`}
                onClick={() => {
                  state.exportSize = "portrait";
                }}
              >
                <span className="vt-size-icon vt-size-portrait" />
                <span>Portrait</span>
              </button>
            </div>
          </div>

          <div className="vt-export-group">
            <div className="vt-export-title">Quality</div>
            <div className="vt-quality-row">
              <button
                type="button"
                className={`vt-toggle ${snap.exportQuality === "fast" ? "vt-toggle-on" : ""}`}
                onClick={() => {
                  state.exportQuality = "fast";
                }}
              />
              <span>Fast</span>
            </div>
            <div className="vt-quality-row">
              <button
                type="button"
                className={`vt-toggle ${snap.exportQuality === "high" ? "vt-toggle-on" : ""}`}
                onClick={() => {
                  state.exportQuality = "high";
                }}
              />
              <span>High (Powerful devices)</span>
            </div>
          </div>

          <div className="vt-export-group">
            <div className="vt-export-title">3D Model Format</div>
            <div className="vt-format-row">
              <button
                type="button"
                className={`vt-chip ${snap.exportModelFormat === "glb" ? "vt-chip-active" : ""}`}
                onClick={() => {
                  state.exportModelFormat = "glb";
                }}
              >
                .glb
              </button>
              <button
                type="button"
                className={`vt-chip ${snap.exportModelFormat === "gbl" ? "vt-chip-active" : ""}`}
                onClick={() => {
                  state.exportModelFormat = "gbl";
                }}
              >
                .gbl
              </button>
            </div>
          </div>

          <div className="vt-export-actions">
            <button type="button" className="vt-export-option-btn vt-export-image" onClick={downloadCanvasToImage}>
              Export Image
            </button>
            <button type="button" className="vt-export-option-btn vt-export-video" onClick={handleMotionDownload}>
              {isRecordingMotion ? "Recording 15s..." : "Export Video (15s)"}
              <span className="vt-pro-badge">Free</span>
            </button>
            <button type="button" className="vt-export-option-btn vt-export-model" onClick={handleGLBDownload}>
              {isExportingGLB ? "Exporting 3D Model..." : "Export 3D Model"}
              <span className="vt-pro-badge">Free</span>
            </button>
          </div>
        </div>
      )}

      <button type="button" className="vt-fullscreen-btn" onClick={handleFullscreen}>
        [ ]
      </button>

      <div className="vt-model-hint">
        {snap.isModelReady ? "Model Ready" : "Loading 3D Mockup..."}
      </div>
    </>
  );
};

export default Customizer;
