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

/** Running water: the pool's color, with ripples carried downstream and
 * white water down falls and below them. Reads the stream ribbon's `flow`,
 * `foam` and `fade` attributes. */
export function makeStreamMaterial(time: THREE.IUniform<number>) {
  const material = new THREE.MeshStandardMaterial({
    color: "#60adab",
    transparent: true,
    opacity: 0.55,
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
        attribute vec2 flow;
        attribute float foam;
        attribute float fade;
        varying vec2 vFlow;
        varying float vFoam;
        varying float vFade;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFlow = flow;
        vFoam = foam;
        vFade = fade;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float waterTime;
        varying vec2 vFlow;
        varying float vFoam;
        varying float vFade;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float along = vFlow.y * 9.0 - waterTime * 2.2;
        float wobble = sin(vFlow.x * 7.0 + vFlow.y * 2.3) * 1.4;
        float streak = (sin(along + wobble) * 0.5 + 0.5)
          * (sin(vFlow.x * 19.0 + vFlow.y * 4.0) * 0.5 + 0.5);
        float white = clamp(
          vFoam * 0.75 + smoothstep(0.55, 0.95, streak) * (0.18 + 0.6 * vFoam),
          0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.97, 0.95), white);
        diffuseColor.a = mix(diffuseColor.a, 0.92, white) * vFade;`,
      );
  };
  material.customProgramCacheKey = () => "stream-flow-v1";
  return material;
}
