import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

let exportGroup = null;
let exportFileName = "tshirt-design.glb";

const hasExportableMesh = (group) => {
  if (!group || typeof group.traverse !== "function") {
    return false;
  }

  let meshFound = false;

  try {
    group.traverse((node) => {
      if (node?.isMesh && node?.geometry) {
        meshFound = true;
      }
    });
  } catch (error) {
    return false;
  }

  return meshFound;
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1200);
};

const writeBlobToFileHandle = async (fileHandle, blob) => {
  if (!fileHandle || !blob) {
    return false;
  }

  try {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    return false;
  }
};

export const requestModelSaveHandle = async (fileName = "tshirt-design.glb") => {
  if (!window.showSaveFilePicker) {
    return null;
  }

  try {
    return await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "3D Model",
          accept: {
            "model/gltf-binary": [".glb", ".gbl"],
            "application/octet-stream": [".glb", ".gbl"],
          },
        },
      ],
    });
  } catch (error) {
    return null;
  }
};

const downloadUrl = (url, fileName) => {
  if (!url) {
    return false;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
};

const downloadModelFallback = async (fallbackModelUrl, fileName, fileHandle = null) => {
  if (!fallbackModelUrl) {
    return false;
  }

  try {
    const resolvedUrl = new URL(fallbackModelUrl, window.location.href).href;
    const response = await fetch(resolvedUrl);

    if (response.ok) {
      const blob = await response.blob();

      if (blob.size) {
        if (fileHandle) {
          const savedToHandle = await writeBlobToFileHandle(fileHandle, blob);
          if (savedToHandle) {
            return true;
          }
        }

        downloadBlob(blob, fileName);
        return true;
      }
    }
  } catch (error) {
    // Fallback to direct URL download.
  }

  return downloadUrl(fallbackModelUrl, fileName);
};

export const registerShirtForExport = (group, fileName) => {
  exportGroup = group || null;

  if (fileName) {
    exportFileName = fileName;
  }
};

export const isShirtExportReady = () => hasExportableMesh(exportGroup);

const createSingleExportMaterial = (material) => {
  const cloneTextureSafe = (texture) => {
    if (!texture) {
      return null;
    }

    try {
      const cloned = texture.clone();
      cloned.needsUpdate = true;
      return cloned;
    } catch (error) {
      return texture;
    }
  };

  const colorHex = material?.color?.isColor ? material.color.getHex() : 0xffffff;
  const roughness = typeof material?.roughness === "number" ? material.roughness : 0.9;
  const metalness = typeof material?.metalness === "number" ? material.metalness : 0.05;
  const opacity = typeof material?.opacity === "number" ? material.opacity : 1;
  const map = cloneTextureSafe(material?.map || null);
  const alphaMap = cloneTextureSafe(material?.alphaMap || null);
  const normalMap = cloneTextureSafe(material?.normalMap || null);
  const roughnessMap = cloneTextureSafe(material?.roughnessMap || null);
  const metalnessMap = cloneTextureSafe(material?.metalnessMap || null);
  const emissiveMap = cloneTextureSafe(material?.emissiveMap || null);
  const transparent = Boolean(material?.transparent || opacity < 1 || map || alphaMap);
  const alphaTest = typeof material?.alphaTest === "number" ? material.alphaTest : 0.02;

  const safeMaterial = new THREE.MeshStandardMaterial({
    color: colorHex,
    map,
    alphaMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    emissiveMap,
    transparent,
    opacity,
    alphaTest,
    side: THREE.DoubleSide,
    roughness,
    metalness,
  });

  if (material?.emissive?.isColor) {
    safeMaterial.emissive.copy(material.emissive);
  }

  if (material?.normalScale?.isVector2) {
    safeMaterial.normalScale.copy(material.normalScale);
  }

  safeMaterial.needsUpdate = true;

  return safeMaterial;
};

const isLikelyDecalMesh = (node) => {
  const geometryType = String(node?.geometry?.type || "").toLowerCase();
  const meshName = String(node?.name || "").toLowerCase();
  return geometryType.includes("decal") || meshName.includes("decal");
};

const pushGeometryAlongNormals = (geometry, offset = 0.0008) => {
  if (!geometry) {
    return;
  }

  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");

  if (!position || !normal || position.count !== normal.count) {
    return;
  }

  for (let index = 0; index < position.count; index += 1) {
    const px = position.getX(index);
    const py = position.getY(index);
    const pz = position.getZ(index);
    const nx = normal.getX(index);
    const ny = normal.getY(index);
    const nz = normal.getZ(index);

    position.setXYZ(index, px + nx * offset, py + ny * offset, pz + nz * offset);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
};

const cloneMaterialSafe = (material) => {
  if (Array.isArray(material)) {
    return material.map((item) => createSingleExportMaterial(item));
  }
  return createSingleExportMaterial(material);
};

const cloneTextureForRawExport = (texture) => {
  if (!texture) {
    return null;
  }

  try {
    const cloned = texture.clone();
    cloned.needsUpdate = true;
    return cloned;
  } catch (error) {
    texture.needsUpdate = true;
    return texture;
  }
};

const prepareSingleMaterialForRawExport = (material) => {
  if (!material) {
    return createSingleExportMaterial(null);
  }

  let nextMaterial = material;
  try {
    nextMaterial = material.clone();
  } catch (error) {
    nextMaterial = createSingleExportMaterial(material);
  }

  nextMaterial.map = cloneTextureForRawExport(nextMaterial.map || null);
  nextMaterial.alphaMap = cloneTextureForRawExport(nextMaterial.alphaMap || null);
  nextMaterial.normalMap = cloneTextureForRawExport(nextMaterial.normalMap || null);
  nextMaterial.roughnessMap = cloneTextureForRawExport(nextMaterial.roughnessMap || null);
  nextMaterial.metalnessMap = cloneTextureForRawExport(nextMaterial.metalnessMap || null);
  nextMaterial.emissiveMap = cloneTextureForRawExport(nextMaterial.emissiveMap || null);

  if (typeof nextMaterial.side === "number") {
    nextMaterial.side = THREE.DoubleSide;
  }
  nextMaterial.needsUpdate = true;

  return nextMaterial;
};

const prepareMaterialForRawExport = (material) => {
  if (Array.isArray(material)) {
    return material.map((item) => prepareSingleMaterialForRawExport(item));
  }
  return prepareSingleMaterialForRawExport(material);
};

const buildRawExportClone = (sourceGroup) => {
  if (!sourceGroup || typeof sourceGroup.clone !== "function") {
    return new THREE.Group();
  }

  const rawClone = sourceGroup.clone(true);
  rawClone.updateMatrixWorld?.(true);

  rawClone.traverse((node) => {
    if (!node?.isMesh || !node?.geometry) {
      return;
    }

    try {
      node.geometry = node.geometry.clone();
    } catch (error) {
      // Ignore and keep original clone geometry.
    }

    if (isLikelyDecalMesh(node)) {
      pushGeometryAlongNormals(node.geometry, 0.0012);
    }

    node.material = prepareMaterialForRawExport(node.material);
    node.visible = true;
  });

  return rawClone;
};

const buildExportClone = (sourceGroup) => {
  const exportRoot = new THREE.Group();

  if (!sourceGroup || typeof sourceGroup.traverse !== "function") {
    return exportRoot;
  }

  try {
    sourceGroup.updateMatrixWorld?.(true);

    sourceGroup.traverse((node) => {
      if (!node?.isMesh || !node?.geometry) {
        return;
      }

      let geometryClone = null;
      try {
        geometryClone = node.geometry.clone();
      } catch (error) {
        return;
      }

      if (isLikelyDecalMesh(node)) {
        pushGeometryAlongNormals(geometryClone, 0.0009);
      }

      const materialClone = cloneMaterialSafe(node.material);
      const safeMesh = new THREE.Mesh(geometryClone, materialClone);
      safeMesh.name = node.name || "export-mesh";
      safeMesh.visible = true;
      safeMesh.renderOrder = node.renderOrder || 0;

      if (node.matrixWorld?.elements?.length === 16) {
        safeMesh.matrix.copy(node.matrixWorld);
        safeMesh.matrix.decompose(safeMesh.position, safeMesh.quaternion, safeMesh.scale);
      } else {
        safeMesh.position.set(
          Number(node.position?.x ?? 0),
          Number(node.position?.y ?? 0),
          Number(node.position?.z ?? 0)
        );
        safeMesh.rotation.set(
          Number(node.rotation?.x ?? 0),
          Number(node.rotation?.y ?? 0),
          Number(node.rotation?.z ?? 0)
        );
        safeMesh.scale.set(
          Number(node.scale?.x ?? 1),
          Number(node.scale?.y ?? 1),
          Number(node.scale?.z ?? 1)
        );
      }

      exportRoot.add(safeMesh);
    });
  } catch (error) {
    return new THREE.Group();
  }

  return exportRoot;
};

const disposeExportRoot = (root) => {
  if (!root || typeof root.traverse !== "function") {
    return;
  }

  try {
    root.traverse((node) => {
      if (!node?.isMesh) {
        return;
      }

      try {
        node.geometry?.dispose?.();
      } catch (error) {
        // Ignore cleanup errors.
      }

      if (Array.isArray(node.material)) {
        node.material.forEach((material) => {
          try {
            material?.dispose?.();
          } catch (error) {
            // Ignore cleanup errors.
          }
        });
      } else {
        try {
          node.material?.dispose?.();
        } catch (error) {
          // Ignore cleanup errors.
        }
      }
    });
  } catch (error) {
    // Ignore cleanup errors.
  }
};

const parseGLB = async (root) => {
  const exporter = new GLTFExporter();
  const exportOptions = {
    binary: true,
    embedImages: true,
    onlyVisible: false,
    truncateDrawRange: false,
  };

  if (typeof exporter.parseAsync === "function") {
    return exporter.parseAsync(root, exportOptions);
  }

  return new Promise((resolve, reject) => {
    exporter.parse(
      root,
      (result) => resolve(result),
      (error) => reject(error),
      exportOptions
    );
  });
};

const parseToBlob = async (root) => {
  let glbBinary = null;

  try {
    glbBinary = await parseGLB(root);
  } catch (error) {
    return null;
  }

  if (glbBinary instanceof Blob) {
    return glbBinary;
  }

  let binaryBuffer = null;
  if (glbBinary instanceof ArrayBuffer) {
    binaryBuffer = glbBinary;
  } else if (ArrayBuffer.isView(glbBinary)) {
    binaryBuffer = glbBinary.buffer.slice(
      glbBinary.byteOffset,
      glbBinary.byteOffset + glbBinary.byteLength
    );
  }

  if (!(binaryBuffer instanceof ArrayBuffer)) {
    return null;
  }

  return new Blob([binaryBuffer], { type: "model/gltf-binary" });
};

const exportBlobFromGroup = async (sourceGroup) => {
  const exportClone = buildExportClone(sourceGroup);

  if (!hasExportableMesh(exportClone)) {
    disposeExportRoot(exportClone);
    return null;
  }

  try {
    return await parseToBlob(exportClone);
  } finally {
    disposeExportRoot(exportClone);
  }
};

const exportBlobFromRawGroup = async (sourceGroup) => {
  const rawClone = buildRawExportClone(sourceGroup);

  if (!hasExportableMesh(rawClone)) {
    disposeExportRoot(rawClone);
    return null;
  }

  try {
    return await parseToBlob(rawClone);
  } finally {
    disposeExportRoot(rawClone);
  }
};

export const downloadShirtAsGLB = async (fileName = "tshirt-design.glb", fileHandle = null) => {
  const resolvedFileName = fileName || exportFileName || "tshirt-design.glb";

  if (!hasExportableMesh(exportGroup)) {
    return false;
  }

  try {
    let blob = await exportBlobFromRawGroup(exportGroup);
    if (!blob) {
      blob = await exportBlobFromGroup(exportGroup);
    }

    if (!blob) {
      return false;
    }

    if (fileHandle) {
      const savedToHandle = await writeBlobToFileHandle(fileHandle, blob);
      if (savedToHandle) {
        return true;
      }
    }

    downloadBlob(blob, resolvedFileName);
    return true;
  } catch (error) {
    return false;
  }
};

export const downloadShirtGLBWithFallback = async (
  fileName = "tshirt-design.glb",
  fallbackModelUrl = "",
  fileHandle = null
) => {
  const resolvedFileName = fileName || exportFileName || "tshirt-design.glb";

  let exported = false;
  try {
    exported = await downloadShirtAsGLB(resolvedFileName, fileHandle);
  } catch (error) {
    exported = false;
  }

  if (exported) {
    return true;
  }

  try {
    return await downloadModelFallback(fallbackModelUrl, resolvedFileName, fileHandle);
  } catch (error) {
    return false;
  }
};
