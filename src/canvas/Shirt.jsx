import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { easing } from "maath";
import { useSnapshot } from "valtio";
import { useFrame } from "@react-three/fiber";
import { Decal, useGLTF, useTexture } from "@react-three/drei";

import state from "../store";
import { registerShirtForExport } from "../config/glbExport";

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR4nGNgYGD4z8DAwMDAAAQABJACR6N0ewAAAABJRU5ErkJggg==";

const DECAL_SETTINGS = {
  front: {
    stateKey: "frontDecalPosition",
    z: 0.15,
    minX: -0.28,
    maxX: 0.28,
    minY: -0.33,
    maxY: 0.33,
    rotation: [0, 0, 0],
  },
  back: {
    stateKey: "backDecalPosition",
    z: -0.15,
    minX: -0.28,
    maxX: 0.28,
    minY: -0.33,
    maxY: 0.33,
    rotation: [0, Math.PI, 0],
  },
  leftShoulder: {
    stateKey: "leftShoulderDecalPosition",
    z: 0.03,
    minX: -0.34,
    maxX: -0.06,
    minY: 0.12,
    maxY: 0.42,
    rotation: [0, -1.15, 0],
  },
  rightShoulder: {
    stateKey: "rightShoulderDecalPosition",
    z: 0.03,
    minX: 0.06,
    maxX: 0.34,
    minY: 0.12,
    maxY: 0.42,
    rotation: [0, 1.15, 0],
  },
};

const DECAL_MATERIAL_PROPS = {
  transparent: true,
  alphaTest: 0.18,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  toneMapped: false,
};

const findPrimaryMesh = (nodes, scene) => {
  const nodeValues = Object.values(nodes || {});
  let targetMesh = null;

  nodeValues.forEach((node) => {
    if (!node?.isMesh) {
      return;
    }

    const currentCount = node.geometry?.attributes?.position?.count || 0;
    const existingCount = targetMesh?.geometry?.attributes?.position?.count || 0;

    if (!targetMesh || currentCount > existingCount) {
      targetMesh = node;
    }
  });

  if (targetMesh || !scene) {
    return targetMesh;
  }

  scene.traverse((child) => {
    if (!child?.isMesh) {
      return;
    }

    const currentCount = child.geometry?.attributes?.position?.count || 0;
    const existingCount = targetMesh?.geometry?.attributes?.position?.count || 0;

    if (!targetMesh || currentCount > existingCount) {
      targetMesh = child;
    }
  });

  return targetMesh;
};

const clampForTarget = (point, target) => {
  const settings = DECAL_SETTINGS[target] || DECAL_SETTINGS.front;

  const x = THREE.MathUtils.clamp(point.x, settings.minX, settings.maxX);
  const y = THREE.MathUtils.clamp(point.y, settings.minY, settings.maxY);

  return [x, y, settings.z];
};

const Shirt = () => {
  const snap = useSnapshot(state);
  const { nodes, scene } = useGLTF(snap.modelUrl || "/shirt_baked.glb");

  const [frontTexture, backTexture, leftShoulderTexture, rightShoulderTexture, fullTexture] =
    useTexture([
      snap.frontDecal || TRANSPARENT_PIXEL,
      snap.backDecal || TRANSPARENT_PIXEL,
      snap.leftShoulderDecal || TRANSPARENT_PIXEL,
      snap.rightShoulderDecal || TRANSPARENT_PIXEL,
      snap.fullDecal || TRANSPARENT_PIXEL,
    ]);

  useEffect(() => {
    [frontTexture, backTexture, leftShoulderTexture, rightShoulderTexture, fullTexture].forEach(
      (texture) => {
        if (!texture) {
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.premultiplyAlpha = false;
        texture.needsUpdate = true;
      }
    );
  }, [frontTexture, backTexture, leftShoulderTexture, rightShoulderTexture, fullTexture]);

  useEffect(() => {
    const activeMaps = [
      { src: snap.frontDecal, texture: frontTexture },
      { src: snap.backDecal, texture: backTexture },
      { src: snap.leftShoulderDecal, texture: leftShoulderTexture },
      { src: snap.rightShoulderDecal, texture: rightShoulderTexture },
      { src: snap.fullDecal, texture: fullTexture, full: true },
    ];

    const ready = activeMaps.every((entry) => {
      if (!entry.src) {
        return true;
      }
      return Boolean(entry.texture && entry.texture.image);
    });

    state.areDecalTexturesReady = ready;
  }, [
    snap.frontDecal,
    snap.backDecal,
    snap.leftShoulderDecal,
    snap.rightShoulderDecal,
    snap.fullDecal,
    frontTexture,
    backTexture,
    leftShoulderTexture,
    rightShoulderTexture,
    fullTexture,
  ]);

  const primaryMesh = useMemo(() => findPrimaryMesh(nodes, scene), [nodes, scene]);
  const isDefaultMockup = (snap.modelUrl || "").includes("shirt_baked.glb");

  const exportName = useMemo(() => {
    const rawName = snap.modelFileName || "shirt_baked.glb";
    const normalized = rawName.toLowerCase();

    if (normalized.endsWith(".gbl")) {
      return rawName;
    }

    if (normalized.endsWith(".gltf")) {
      return rawName.replace(/\.gltf$/i, ".glb");
    }

    if (!normalized.endsWith(".glb")) {
      return `${rawName}.glb`;
    }

    return rawName;
  }, [snap.modelFileName]);

  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (groupRef.current) {
      registerShirtForExport(groupRef.current, exportName);
    }

    return () => {
      registerShirtForExport(null);
    };
  }, [exportName]);

  useEffect(() => {
    state.isModelReady = Boolean(primaryMesh?.geometry && primaryMesh?.material);

    return () => {
      state.isModelReady = false;
    };
  }, [primaryMesh]);

  const updateLogoPosition = (event) => {
    if (!meshRef.current || !snap.isLogoTexture || !snap.logoDragMode) {
      return;
    }

    const localPoint = meshRef.current.worldToLocal(event.point.clone());
    const activeTarget = snap.designTarget || "front";
    const settings = DECAL_SETTINGS[activeTarget] || DECAL_SETTINGS.front;
    state[settings.stateKey] = clampForTarget(localPoint, activeTarget);
  };

  useFrame((frameState, delta) => {
    const meshMaterial = meshRef.current?.material;

    if (Array.isArray(meshMaterial)) {
      meshMaterial.forEach((material) => {
        if (material?.color) {
          easing.dampC(material.color, snap.color, 0.25, delta);
        }

        if (material?.aoMap) {
          const targetAO = isDefaultMockup ? 0.08 : 1;
          material.aoMapIntensity = THREE.MathUtils.lerp(
            typeof material.aoMapIntensity === "number" ? material.aoMapIntensity : 1,
            targetAO,
            Math.min(1, delta * 4)
          );
        }

        if (typeof material?.roughness === "number") {
          material.roughness = THREE.MathUtils.lerp(
            material.roughness,
            0.85 - snap.acidWashIntensity * 0.35,
            Math.min(1, delta * 4)
          );
        }

        if (typeof material?.metalness === "number") {
          material.metalness = THREE.MathUtils.lerp(
            material.metalness,
            0.08 + snap.puffPrintIntensity * 0.25,
            Math.min(1, delta * 4)
          );
        }
      });
    } else if (meshMaterial?.color) {
      easing.dampC(meshMaterial.color, snap.color, 0.25, delta);

      if (meshMaterial.aoMap) {
        const targetAO = isDefaultMockup ? 0.08 : 1;
        meshMaterial.aoMapIntensity = THREE.MathUtils.lerp(
          typeof meshMaterial.aoMapIntensity === "number" ? meshMaterial.aoMapIntensity : 1,
          targetAO,
          Math.min(1, delta * 4)
        );
      }

      if (typeof meshMaterial.roughness === "number") {
        meshMaterial.roughness = THREE.MathUtils.lerp(
          meshMaterial.roughness,
          0.85 - snap.acidWashIntensity * 0.35,
          Math.min(1, delta * 4)
        );
      }

      if (typeof meshMaterial.metalness === "number") {
        meshMaterial.metalness = THREE.MathUtils.lerp(
          meshMaterial.metalness,
          0.08 + snap.puffPrintIntensity * 0.25,
          Math.min(1, delta * 4)
        );
      }
    }

    if (!groupRef.current) {
      return;
    }

    const t = frameState.clock.getElapsedTime();
    const intensity = Math.max(0.1, snap.animationIntensity || 0.5);

    let targetY = 0;
    let targetX = 0;
    let targetRoll = 0;
    let targetScale = 1;
    let targetZ = 0;
    let targetPitch = 0;
    let targetYaw = 0;
    let isContinuousYaw = false;
    let continuousYawSpeed = 0;

    switch (snap.animationPreset) {
      case "walk":
        {
          const walkSpeed = 1.25 + intensity * 1.1;
          const phase = t * walkSpeed;
          const forwardWave = 0.5 + 0.5 * Math.sin(phase - Math.PI / 2);
          const stepWave = Math.sin(phase * 2.1);

          // Walk-in feel: starts farther and comes towards camera with body sway.
          targetZ = -0.45 + forwardWave * 0.9;
          targetY = Math.abs(stepWave) * (0.02 + intensity * 0.02);
          targetX = Math.sin(phase) * (0.02 + intensity * 0.012);
          targetPitch = -0.07 + forwardWave * 0.055;
          targetYaw = Math.sin(phase * 0.55) * 0.045;
          targetRoll = Math.sin(phase * 1.8) * (0.012 + intensity * 0.012);
          targetScale = 0.95 + forwardWave * 0.1;
        }
        break;
      case "waves":
        targetY = Math.sin(t * (1.5 + intensity)) * 0.015;
        targetRoll = Math.sin(t * (1.2 + intensity)) * (0.035 + intensity * 0.02);
        break;
      case "knit":
        targetScale = 1 + Math.sin(t * (1 + intensity)) * (0.01 + intensity * 0.01);
        targetY = Math.sin(t * (1.2 + intensity)) * 0.01;
        break;
      case "dance":
        {
          const danceSpeed = 2 + intensity * 1.8;
          const phase = t * danceSpeed;
          targetX = Math.sin(phase * 1.1) * (0.04 + intensity * 0.03);
          targetY = Math.abs(Math.sin(phase * 2.4)) * (0.02 + intensity * 0.03);
          targetZ = Math.sin(phase * 0.75) * (0.04 + intensity * 0.03);
          targetPitch = Math.sin(phase * 1.5) * (0.06 + intensity * 0.04);
          targetYaw = Math.sin(phase * 1.15) * (0.2 + intensity * 0.12);
          targetRoll = Math.sin(phase * 2.6) * (0.11 + intensity * 0.07);
          targetScale = 1 + Math.sin(phase * 3.2) * (0.012 + intensity * 0.02);
        }
        break;
      case "jump":
        {
          const jumpSpeed = 1.6 + intensity * 1.4;
          const phase = t * jumpSpeed;
          const hop = Math.max(0, Math.sin(phase));
          targetY = hop * (0.12 + intensity * 0.12);
          targetX = Math.sin(phase * 0.6) * (0.02 + intensity * 0.015);
          targetPitch = -0.05 + hop * (0.08 + intensity * 0.06);
          targetRoll = Math.sin(phase * 0.9) * (0.03 + intensity * 0.03);
          targetScale = 0.98 + hop * (0.08 + intensity * 0.04);
        }
        break;
      case "bounce":
        {
          const bounceSpeed = 2.2 + intensity * 1.6;
          const phase = t * bounceSpeed;
          const pulse = Math.abs(Math.sin(phase));
          targetY = pulse * (0.05 + intensity * 0.06);
          targetPitch = Math.sin(phase * 1.6) * (0.03 + intensity * 0.03);
          targetScale = 0.97 + pulse * (0.06 + intensity * 0.03);
        }
        break;
      case "float":
        {
          const floatSpeed = 0.85 + intensity * 0.75;
          const phase = t * floatSpeed;
          targetX = Math.sin(phase * 0.6) * (0.025 + intensity * 0.02);
          targetY = Math.sin(phase) * (0.03 + intensity * 0.03);
          targetZ = Math.sin(phase * 0.45) * (0.03 + intensity * 0.02);
          targetPitch = Math.sin(phase * 0.8) * (0.04 + intensity * 0.03);
          targetYaw = Math.sin(phase * 0.55) * (0.13 + intensity * 0.08);
          targetRoll = Math.sin(phase * 0.95) * (0.05 + intensity * 0.03);
        }
        break;
      case "spin":
        isContinuousYaw = true;
        continuousYawSpeed = 2.2 + intensity * 2.8;
        targetY = Math.sin(t * (2 + intensity)) * 0.01;
        targetRoll = Math.sin(t * (2.5 + intensity)) * (0.04 + intensity * 0.03);
        targetScale = 1 + Math.sin(t * (1.4 + intensity)) * (0.015 + intensity * 0.01);
        break;
      case "swagger":
        {
          const swaggerSpeed = 1.5 + intensity * 1.3;
          const phase = t * swaggerSpeed;
          targetX = Math.sin(phase) * (0.05 + intensity * 0.04);
          targetY = Math.abs(Math.sin(phase * 2)) * (0.01 + intensity * 0.015);
          targetZ = Math.cos(phase * 0.55) * (0.025 + intensity * 0.025);
          targetPitch = Math.sin(phase * 0.8) * (0.04 + intensity * 0.03);
          targetYaw = Math.sin(phase) * (0.18 + intensity * 0.11);
          targetRoll = -Math.sin(phase) * (0.09 + intensity * 0.05);
        }
        break;
      default:
        break;
    }

    if (snap.autoRotate && !snap.isDecalDragging && snap.animationPreset !== "walk") {
      groupRef.current.rotation.y += delta * (snap.autoRotateSpeed || 0.45);
    }

    const lerpFactor = Math.min(1, delta * 6);
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      lerpFactor
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      lerpFactor
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      targetZ,
      lerpFactor
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetPitch,
      lerpFactor
    );
    if (isContinuousYaw) {
      groupRef.current.rotation.y += delta * continuousYawSpeed;
    } else {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetYaw,
        lerpFactor
      );
    }
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      targetRoll,
      lerpFactor
    );
    const nextScale = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, lerpFactor);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
  });

  const handlePointerDown = (event) => {
    if (!snap.isLogoTexture || !snap.logoDragMode) {
      return;
    }

    event.stopPropagation();
    isDraggingRef.current = true;
    state.isDecalDragging = true;

    if (event.target.setPointerCapture && event.pointerId !== undefined) {
      event.target.setPointerCapture(event.pointerId);
    }

    updateLogoPosition(event);
  };

  const handlePointerMove = (event) => {
    if (!isDraggingRef.current || !snap.logoDragMode) {
      return;
    }

    event.stopPropagation();
    updateLogoPosition(event);
  };

  const handlePointerUp = (event) => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    state.isDecalDragging = false;

    if (event.target.releasePointerCapture && event.pointerId !== undefined) {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore if pointer capture was already released.
      }
    }
  };

  return (
    <group ref={groupRef}>
      {primaryMesh?.geometry && primaryMesh?.material && (
        <mesh
          ref={meshRef}
          castShadow
          geometry={primaryMesh.geometry}
          material={primaryMesh.material}
          position={[primaryMesh.position.x, primaryMesh.position.y, primaryMesh.position.z]}
          rotation={[primaryMesh.rotation.x, primaryMesh.rotation.y, primaryMesh.rotation.z]}
          scale={[primaryMesh.scale.x, primaryMesh.scale.y, primaryMesh.scale.z]}
          material-roughness={1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          dispose={null}
        >
          {/* T-shirt full texture */}
          {snap.isFullTexture && (
            <Decal
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
              scale={1}
              map={fullTexture}
            />
          )}

          {/* T-shirt logo */}
          {snap.isLogoTexture && (
            <>
              {snap.frontDecal && (
                <Decal
                  position={snap.frontDecalPosition}
                  rotation={DECAL_SETTINGS.front.rotation}
                  scale={snap.frontDecalScale}
                  map={frontTexture}
                  {...DECAL_MATERIAL_PROPS}
                />
              )}

              {snap.backDecal && (
                <Decal
                  position={snap.backDecalPosition}
                  rotation={DECAL_SETTINGS.back.rotation}
                  scale={snap.backDecalScale}
                  map={backTexture}
                  {...DECAL_MATERIAL_PROPS}
                />
              )}

              {snap.leftShoulderDecal && (
                <Decal
                  position={snap.leftShoulderDecalPosition}
                  rotation={DECAL_SETTINGS.leftShoulder.rotation}
                  scale={snap.leftShoulderDecalScale}
                  map={leftShoulderTexture}
                  {...DECAL_MATERIAL_PROPS}
                />
              )}

              {snap.rightShoulderDecal && (
                <Decal
                  position={snap.rightShoulderDecalPosition}
                  rotation={DECAL_SETTINGS.rightShoulder.rotation}
                  scale={snap.rightShoulderDecalScale}
                  map={rightShoulderTexture}
                  {...DECAL_MATERIAL_PROPS}
                />
              )}
            </>
          )}
        </mesh>
      )}
    </group>
  );
};

export default Shirt;

useGLTF.preload("/shirt_baked.glb");

/* The properties mapAnisotropy, depthTest, and depthWrite were not recognized in the first version of the code because they were not defined as valid props for the Decal component.

In React, components can only receive and recognize props that are explicitly defined and expected by the component. When you pass a prop to a component that is not recognized or expected, React will ignore that prop and it will not have any effect on the component. 

By using the spread syntax in the second version, these properties are properly spread onto the Decal component, allowing it to receive and utilize the additional properties correctly.
*/
