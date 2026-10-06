import * as THREE from "three";

/** Keep the existing ripple shape, but calculate it on the GPU instead of
 * rebuilding and uploading the water mesh and its normals every frame. */
export function makeWaterMaterial(time: THREE.IUniform<number>) {
  const material = new THREE.MeshStandardMaterial({
    color: "#60adab",
    transparent: true,
    opacity: 0.47,
    roughness: 0.18,
    metalness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float waterTime;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        float rippleX = position.x * 5.0 + waterTime * 1.1;
        float rippleY = position.y * 4.0 + waterTime * 0.7;
        float slopeX = cos(rippleX) * cos(rippleY) * 0.04;
        float slopeY = -sin(rippleX) * sin(rippleY) * 0.032;
        objectNormal = normalize(vec3(-slopeX, -slopeY, 1.0));`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        transformed.z += sin(rippleX) * cos(rippleY) * 0.008;`,
      );
  };
  material.customProgramCacheKey = () => "water-ripples-v1";
  return material;
}
