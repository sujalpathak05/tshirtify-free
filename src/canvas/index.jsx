import { Canvas } from "@react-three/fiber";
import { Environment, Center, OrbitControls } from "@react-three/drei";
import { useSnapshot } from "valtio";

import Shirt from "./Shirt";
import Backdrop from "./Backdrop";
import CameraRig from "./CameraRig";
import state from "../store";

const CanvasModel = () => {
  const snap = useSnapshot(state);

  const handleOrbitStart = () => {
    state.cameraAutoRotate = false;
  };

  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 0], fov: 25 }} // fov = field of view
      gl={{ preserveDrawingBuffer: true }}
      className="stage-canvas"
    >
      <ambientLight intensity={0.8} />
      <hemisphereLight intensity={0.45} groundColor="#d7d9e0" />
      <Environment preset="city" />

      <CameraRig>
        <Backdrop />
        <Center>
          <Shirt />
        </Center>
      </CameraRig>

      <OrbitControls
        makeDefault
        enabled={!snap.isDecalDragging}
        autoRotate={snap.cameraAutoRotate && !snap.isDecalDragging}
        autoRotateSpeed={snap.cameraAutoRotateSpeed || 1}
        onStart={handleOrbitStart}
        enablePan={false}
        minDistance={1.4}
        maxDistance={3}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
};

export default CanvasModel;
