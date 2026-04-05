import React from "react";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useSnapshot } from "valtio";

import state from "../store";

/**
 * The CameraRig component is a React component that handles the positioning and rotation of a 3D model
 * based on the state and user input.
 * @returns The CameraRig component is returning a group element with a ref attribute set to the group
 * useRef() reference. The children of the CameraRig component are rendered inside this group element.
 */
const CameraRig = ({ children }) => {
  const snap = useSnapshot(state);

  /* Using the `useFrame` hook from the `@react-three/fiber` library to update the
position and rotation of a 3D model in a React component. */
  useFrame((canvasState, delta) => {
    // console.log(state.camera.position);
    const isBreakpoint = window.innerWidth <= 1260;
    const isMobile = window.innerWidth <= 600;

    // set the initial position of the model
    let targetPosition = [-0.4, 0, 2];
    if (snap.intro) {
      if (isBreakpoint) targetPosition = [0, 0, 2];
      if (isMobile) targetPosition = [0, 0.2, 2.5];
    } else {
      if (isMobile) {
        targetPosition = [0, 0, 2.5];
      } else {
        targetPosition = [0, 0, 2];
      }
    }

    if (snap.designTarget === "back") {
      targetPosition = [0, 0, -2];
    } else if (snap.designTarget === "leftShoulder") {
      targetPosition = [-2, 0, 0];
    } else if (snap.designTarget === "rightShoulder") {
      targetPosition = [2, 0, 0];
    }

    // set model camera position
    easing.damp3(canvasState.camera.position, targetPosition, 0.25, delta);
    canvasState.camera.lookAt(0, 0, 0);
  });

  return <group>{children}</group>;
};

export default CameraRig;
