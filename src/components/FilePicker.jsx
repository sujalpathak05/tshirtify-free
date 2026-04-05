import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import Cropper from "react-easy-crop";

import CustomButton from "./CustomButton";
import { getCroppedImage, reader } from "../config/helpers";

const SIDE_LABELS = {
  front: "Front",
  back: "Back",
  leftShoulder: "Left Shoulder",
  rightShoulder: "Right Shoulder",
};

/**
 * The `FilePicker` component is a React component that allows users to upload a file and provides
 * buttons to read different parts of the file.
 * @returns The FilePicker component is returning JSX elements.
 */
const FilePicker = ({
  file,
  setFile,
  readFile,
  designTarget,
  uploadMockupFile,
  modelFileName,
}) => {
  const [cropSource, setCropSource] = useState("");
  const [cropTarget, setCropTarget] = useState("front");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const activeSideLabel = SIDE_LABELS[designTarget] || "Front";

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCropPixels(croppedAreaPixels);
  }, []);

  const openCropper = async (targetType) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await reader(file);
      setCropSource(imageData);
      setCropTarget(targetType);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropPixels(null);
      setIsCropping(true);
    } catch (error) {
      setIsCropping(false);
    }
  };

  const applyCrop = async () => {
    const croppedData = await getCroppedImage(cropSource, cropPixels);

    if (!croppedData) {
      return;
    }

    readFile(cropTarget, croppedData);
    setIsCropping(false);
  };

  return (
    <div className="filepicker-wrapper">
      <div className="filepicker-container">
        <div className="flex-1 flex flex-col">
          <p className="text-[11px] font-semibold text-gray-700">
            Active Side: {activeSideLabel}
          </p>

          <input
            id="file-upload"
            type="file"
            accept="image/*"
            /* The `onChange` event handler in the `input` element is responsible for updating the `file` state
              when a file is selected by the user. */
            onChange={(e) => setFile(e.target.files[0])}
          />
          <label htmlFor="file-upload" className="filepicker-label">
            Upload File
          </label>

          <p className="mt-2 text-gray-500 text-xs truncate">
            {file === "" ? "No file selected" : file.name}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <CustomButton
            type="outline"
            title={`Apply ${activeSideLabel}`}
            handleClick={() => readFile(designTarget)}
            customStyles="text-xs"
          />
          <CustomButton
            type="filled"
            title="Full"
            handleClick={() => readFile("full")}
            customStyles="text-xs"
          />
          <CustomButton
            type="outline"
            title={`Crop ${activeSideLabel}`}
            handleClick={() => openCropper(designTarget)}
            customStyles="text-xs"
          />
          <CustomButton
            type="filled"
            title="Crop Full"
            handleClick={() => openCropper("full")}
            customStyles="text-xs"
          />
        </div>

        <div className="mt-3 border-t border-white/40 pt-3">
          <input
            id="mockup-upload"
            type="file"
            accept=".glb,.gltf,.gbl,model/gltf-binary,model/gltf+json"
            onChange={(event) => uploadMockupFile(event.target.files?.[0] || null)}
          />
          <label htmlFor="mockup-upload" className="filepicker-label">
            Upload 3D Mockup
          </label>

          <p className="mt-2 text-gray-500 text-xs truncate">
            Model: {modelFileName || "shirt_baked.glb"}
          </p>
        </div>
      </div>

      {isCropping && (
        <div className="cropper-panel">
          <div className="cropper-area">
            <Cropper
              image={cropSource}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              objectFit="contain"
            />
          </div>

          <div className="cropper-controls">
            <label htmlFor="crop-zoom" className="text-xs text-gray-700">
              Zoom
            </label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />

            <div className="mt-3 flex gap-2">
              <CustomButton
                type="filled"
                title="Apply Crop"
                handleClick={applyCrop}
                customStyles="text-xs"
              />
              <CustomButton
                type="outline"
                title="Cancel"
                handleClick={() => setIsCropping(false)}
                customStyles="text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

FilePicker.propTypes = {
  file: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  setFile: PropTypes.func.isRequired,
  readFile: PropTypes.func.isRequired,
  designTarget: PropTypes.string.isRequired,
  uploadMockupFile: PropTypes.func.isRequired,
  modelFileName: PropTypes.string,
};

export default FilePicker;
