import type { EcosystemController } from "../simulation/useEcosystem";
import { EcosystemLife } from "./EcosystemLife";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Environment as EnvironmentLight,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { Editor } from "../editor/useEditor";
import { assets } from "../assets";
import { useWatchVisibility } from "./useWatchVisibility";
import {
  boundedPosition,
  groundHeight,
  placementProblem,
} from "../model/terrain";
import { useCameraNavigation } from "./useCameraNavigation";
import { useFollowCamera } from "./useFollowCamera";
import { Inhabitant } from "./Inhabitant";
import { Tank, Terrain, Water } from "./Terrain";
import { TerrainBrushCursor } from "./TerrainBrushCursor";

const lighting = {
  day: { background: "#080b0d", intensity: 4.2, ambient: 0.25 },
  golden: {
    background: "#080b0d",
    intensity: 3.2,
    ambient: 0.25,
  },
  moon: {
    background: "#06090e",
    intensity: 1.6,
    ambient: 0.2,
  },
};
interface SceneProps {
  editor: Editor;
  resetCamera: number;
  view: boolean;
  ecosystem: EcosystemController;
  /** An animal the camera follows. It keeps living while watched. */
  watchingId: string | null;
  onActivateObject: (id: string) => void;
}
function Scene({
  editor,
  resetCamera,
  view,
  ecosystem,
  watchingId,
  onActivateObject,
}: SceneProps) {
  const { world, tool } = editor,
    env = world.environment,
    light = lighting[env.light];
  const keyColor = new THREE.Color("#c6ddff").lerp(
    new THREE.Color("#ffcc8b"),
    env.warmth,
  );
  const controls = useRef<OrbitControlsImpl>(null);
  const { size, raycaster } = useThree();
  const terrain = useRef<THREE.Group>(null);
  const inhabitants = useRef<THREE.Group>(null);
  useWatchVisibility(inhabitants, ecosystem, watchingId);
  useCameraNavigation(controls, true);
  useFollowCamera(controls, ecosystem, watchingId, resetCamera);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const moving =
    tool.type === "move" || tool.type === "copy"
      ? world.objects.find((o) => o.id === tool.id)
      : null;
  const kind = tool.type === "place" ? tool.kind : moving?.kind;
  // Frame the tank on Reset and when the view's shape really changes (like
  // rotating a phone), but not for small resizes such as a phone's URL bar.
  const framed = useRef({ reset: -1, aspect: 0 });
  useEffect(() => {
    const aspect = size.width / size.height;
    if (!controls.current || !aspect) return;
    const last = framed.current;
    const sameShape = Math.abs(aspect / last.aspect - 1) < 0.15;
    if (last.reset === resetCamera && sameShape) return;
    framed.current = { reset: resetCamera, aspect };
    const fit = Math.max(1, 1.12 / aspect);
    controls.current.object.position.set(9 * fit, 7.5 * fit, 11 * fit);
    controls.current.target.set(0, 0.8, 0);
    controls.current.update();
  }, [resetCamera, size.width, size.height]);
  useEffect(() => setCursor(null), [tool]);
  const point =
    cursor && (kind || tool.type === "terrain")
      ? boundedPosition(
          cursor.x,
          cursor.z,
          env,
          kind ? assets[kind].radius * (moving?.scale ?? 1) : 0,
        )
      : null;
  const problem =
    point && kind ? placementProblem(kind, point.x, point.z, env) : null;
  function track(e: ThreeEvent<PointerEvent>) {
    if (!kind && tool.type !== "terrain") return;
    e.stopPropagation();
    const point =
      tool.type === "terrain" && terrain.current
        ? raycaster.intersectObject(terrain.current, true)[0]?.point
        : e.point;
    if (!point) return;
    setCursor({ x: point.x, z: point.z });
    if (tool.type === "terrain") editor.continueTerrainStroke(point.x, point.z);
  }
  function place(e: ThreeEvent<MouseEvent>) {
    if (e.delta > 6) return;
    e.stopPropagation();
    if (tool.type === "terrain") return;
    if (kind) editor.placeAt(e.point.x, e.point.z);
    else editor.select(null);
  }
  return (
    <>
      <color attach="background" args={[light.background]} />
      <fog attach="fog" args={[light.background, 23, 55]} />
      <ambientLight intensity={light.ambient * env.brightness} />
      <hemisphereLight args={["#dae4ef", "#141a17", 0.35]} />
      <directionalLight
        position={[-2, 9, 1]}
        color={keyColor}
        intensity={light.intensity * env.brightness}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-normalBias={0.035}
      />
      <directionalLight
        position={[5, 4, -5]}
        color="#9fcfc2"
        intensity={0.65 * env.brightness}
      />
      {/* Local light panels provide reflections without downloading an HDR environment. */}
      <EnvironmentLight resolution={64} frames={1}>
        <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshBasicMaterial color="#c8dbcd" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-8, 3, 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[7, 7]} />
          <meshBasicMaterial color="#dce3ef" side={THREE.DoubleSide} />
        </mesh>
      </EnvironmentLight>
      <group
        ref={inhabitants}
        onPointerMove={track}
        onClick={place}
        onPointerDown={(e) => {
          if (tool.type !== "terrain" || e.button !== 0) return;
          const point =
            terrain.current &&
            raycaster.intersectObject(terrain.current, true)[0]?.point;
          if (!point) return;
          e.stopPropagation();
          // R3F supplies a capture target, but its published event type omits it.
          if (
            e.target &&
            "setPointerCapture" in e.target &&
            typeof e.target.setPointerCapture === "function"
          )
            e.target.setPointerCapture(e.pointerId);
          setCursor({ x: point.x, z: point.z });
          editor.beginTerrainStroke(point.x, point.z);
        }}
        onPointerUp={(e) => {
          if (tool.type !== "terrain") return;
          e.stopPropagation();
          editor.endTerrainStroke();
          if (
            e.target &&
            "releasePointerCapture" in e.target &&
            typeof e.target.releasePointerCapture === "function"
          )
            e.target.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={editor.cancelTerrainStroke}
        onLostPointerCapture={editor.cancelTerrainStroke}
      >
        <group ref={terrain}>
          <Terrain environment={env} />
        </group>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          visible={false}
        >
          <planeGeometry args={[env.width, env.depth]} />
          <meshBasicMaterial />
        </mesh>
        {world.objects
          .filter((o) => tool.type !== "move" || o.id !== tool.id)
          .map((object) => (
            <Inhabitant
              key={object.id}
              object={object}
              ecosystem={ecosystem}
              environment={env}
              paused={editor.paused}
              selected={!view && editor.selectedId === object.id}
              onSelect={(e) => {
                if (e.delta > 6 || kind || tool.type === "terrain") return;
                e.stopPropagation();
                onActivateObject(object.id);
              }}
            />
          ))}
      </group>
      <EcosystemLife
        ecosystem={ecosystem}
        paused={editor.paused || tool.type !== "select"}
        heldId={view || watchingId ? null : editor.selectedId}
      />
      <Water
        environment={env}
        paused={editor.paused || tool.type === "terrain"}
      />
      <Tank environment={env} />
      {point && kind && (
        <Inhabitant
          object={
            moving
              ? { ...moving, ...point, rotation: editor.placementRotation }
              : {
                  id: "ghost",
                  kind,
                  ...point,
                  rotation: editor.placementRotation,
                  scale: 1,
                  seed: 42,
                }
          }
          environment={env}
          paused
          ghost
          invalid={!!problem}
        />
      )}
      {point && tool.type === "terrain" && (
        <TerrainBrushCursor {...point} radius={tool.radius} environment={env} />
      )}
      {point && kind && (
        <mesh
          position={[
            point.x,
            Math.max(groundHeight(point.x, point.z, env), env.water) + 0.018,
            point.z,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.04, 0.055, 24]} />
          <meshBasicMaterial
            color={problem ? "#f49c85" : "#e8edc3"}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh
        position={[0, -0.26, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial color={light.background} />
      </mesh>

      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0.8, 0]}
        minDistance={4}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={0.16}
        enablePan={false}
        enableRotate={tool.type !== "terrain"}
        enableDamping
        dampingFactor={0.09}
        autoRotate={view && !editor.paused}
        autoRotateSpeed={0.35}
      />
    </>
  );
}
export function WorldScene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [9, 7.5, 11], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => {
        if (props.editor.tool.type === "select") props.editor.select(null);
      }}
      fallback={
        <div className="webgl-fallback">
          This terrarium needs WebGL. Try a current browser with hardware
          acceleration enabled. Your saved world is still available to export.
        </div>
      }
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
