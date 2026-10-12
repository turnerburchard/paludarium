import { useBuildCamera } from "./useBuildCamera";
import type { EcosystemController } from "../simulation/useEcosystem";
import { EcosystemLife } from "./EcosystemLife";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  OrbitControls,
  Environment as EnvironmentLight,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { Editor } from "../editor/useEditor";
import { assetRadius, assets, isAnimal } from "../assets";
import { useWatchVisibility } from "./useWatchVisibility";
import { placementProblem, waterLevel } from "../model/water";
import { boundedPosition, groundHeight } from "../model/terrain";
import { prebuiltObjects, prebuiltProblem } from "../model/prebuilts";
import { restingOn, type Surface } from "../model/stacking";
import { keepTankInReach, useCameraNavigation } from "./useCameraNavigation";
import { useWheelZoom } from "./useWheelZoom";
import { useFollowCamera } from "./useFollowCamera";
import { tankReach, useCameraLayout } from "./useCameraLayout";
import { Inhabitant } from "./Inhabitant";
import type { FoliageVisitor } from "./foliageMotion";
import { Remains } from "./Remains";
import { Tank, Terrain, Water } from "./Terrain";
import { SpringMarker } from "./SpringMarker";
import { TerrainBrushCursor } from "./TerrainBrushCursor";
import { useSceneTouch } from "./useSceneTouch";
import { hideSplash } from "../ui/splash";
import { randomFromSeed } from "../model/random";

const BACKGROUND = "#080b0d";
interface SceneProps {
  editor: Editor;
  resetCamera: number;
  view: boolean;
  ecosystem: EcosystemController;
  /** An animal the camera follows. It keeps living while watched. */
  watchingId: string | null;
  onActivateObject: (id: string) => void;
  /** Called whenever someone starts moving the camera themselves. */
  onCameraStart: () => void;
}
function Scene({
  editor,
  resetCamera,
  view,
  ecosystem,
  watchingId,
  onActivateObject,
  onCameraStart,
}: SceneProps) {
  const { world, tool } = editor,
    env = world.environment;
  const keyColor = new THREE.Color("#c6ddff").lerp(
    new THREE.Color("#ffcc8b"),
    env.warmth,
  );
  const controls = useRef<OrbitControlsImpl>(null);
  const { raycaster, camera, gl, invalidate } = useThree();
  // Paused, the canvas draws only on request, so every scene change asks for a frame.
  useEffect(() => invalidate());
  const terrain = useRef<THREE.Mesh>(null);
  const inhabitants = useRef<THREE.Group>(null);
  const foliageVisitors = useRef<FoliageVisitor[]>([]);
  const foliagePlants = useRef(new Map<string, THREE.Group>());
  useWatchVisibility(inhabitants, ecosystem, watchingId);
  const followCamera = useFollowCamera(
    controls,
    ecosystem,
    watchingId,
    resetCamera,
  );
  function startCamera() {
    followCamera.interrupt();
    onCameraStart();
  }
  useCameraNavigation(controls, env, true, startCamera);
  useWheelZoom(controls, startCamera);
  useBuildCamera(controls);
  const [cursor, setCursor] = useState<{
    x: number;
    z: number;
    surface?: Surface;
  } | null>(null);
  const moving =
    tool.type === "move" || tool.type === "copy"
      ? world.objects.find((o) => o.id === tool.id)
      : null;
  const kind = tool.type === "place" ? tool.kind : moving?.kind;
  const scale = tool.type === "place" ? tool.scale : (moving?.scale ?? 1);
  const prebuilt = tool.type === "prebuilt" ? tool.prebuilt : null;
  const seed =
    tool.type === "place" || tool.type === "prebuilt" ? tool.seed : 0;
  const placing = !!kind || !!prebuilt;
  const reach = tankReach(env);
  useCameraLayout(controls, resetCamera, view, env.height, reach);
  useEffect(() => setCursor(null), [tool]);
  useSceneTouch(controls, placing, (event) => {
    if (!inhabitants.current) return;
    const box = gl.domElement.getBoundingClientRect();
    // Native client coordinates stay correct when Safari resizes its browser bars.
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        1 - ((event.clientY - box.top) / box.height) * 2,
      ),
      camera,
    );
    const intersections = raycaster.intersectObject(inhabitants.current, true);
    if (!intersections.length) {
      editor.setPlacementError("Tap the ground or a stone inside the tank.");
      return;
    }
    const { point, surface } = spotUnder({
      point: intersections[0].point,
      intersections,
    });
    editor.placeAt(point.x, point.z, surface);
    setCursor(null);
  });
  const point =
    cursor && (placing || tool.type === "terrain" || tool.type === "spring")
      ? boundedPosition(
          cursor.x,
          cursor.z,
          env,
          prebuilt ? prebuilt.radius : kind ? assetRadius(kind) * scale : 0,
        )
      : null;
  const lift = point
    ? restingOn(cursor?.surface, point.x, point.z, env).lift
    : undefined;
  const ghostPieces =
    point && prebuilt
      ? prebuiltObjects(
          prebuilt,
          point.x,
          point.z,
          editor.placementRotation,
          env,
          randomFromSeed(seed),
        )
      : null;
  let problem: string | null = null;
  if (ghostPieces) problem = prebuiltProblem(ghostPieces, env);
  else if (point && kind)
    problem = placementProblem(kind, point.x, point.z, env, lift);
  else if (point && tool.type === "spring")
    problem =
      groundHeight(point.x, point.z, env) < env.water ? "Under water" : null;
  /** The ground, or the stone or wood, under the pointer. Plants and animals
   * in the way are looked past, and animals always go on the ground. */
  function spotUnder(e: {
    point: THREE.Vector3;
    intersections: THREE.Intersection[];
  }) {
    if (!kind || isAnimal(kind)) return { point: e.point };
    for (const hit of e.intersections) {
      const object = world.objects.find((o) => o.id === objectIdOf(hit.object));
      if (!object) return { point: hit.point };
      if (assets[object.kind].hardscape)
        return {
          point: hit.point,
          surface: { support: object.id, y: hit.point.y },
        };
    }
    return { point: e.point };
  }
  /** Where the pointer meets the ground, looking through anything in front.
   * The event already carries every hit, so this needs no second raycast. */
  function groundUnder(e: ThreeEvent<MouseEvent>) {
    return e.intersections.find((hit) => hit.object === terrain.current)?.point;
  }
  // Every pointer move raycasts the whole tank while this is attached, so it
  // is only attached for the tools that follow the pointer.
  const tracking = placing || tool.type === "terrain" || tool.type === "spring";
  function track(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (placing && e.nativeEvent.pointerType === "touch") return;
    if (tool.type === "terrain" || tool.type === "spring") {
      const point = groundUnder(e);
      if (!point) return;
      setCursor({ x: point.x, z: point.z });
      if (tool.type === "terrain")
        editor.continueTerrainStroke(point.x, point.z);
      return;
    }
    const { point, surface } = spotUnder(e);
    setCursor({ x: point.x, z: point.z, surface });
  }
  function place(e: ThreeEvent<MouseEvent>) {
    if (e.delta > 6) return;
    e.stopPropagation();
    if (tool.type === "terrain") return;
    if (tool.type === "spring") {
      const point = groundUnder(e);
      if (point) editor.placeSpring(point.x, point.z);
      return;
    }
    if (!placing) {
      editor.select(null);
      return;
    }
    const { point, surface } = spotUnder(e);
    editor.placeAt(point.x, point.z, surface);
  }
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 23 * reach, 55 * reach]} />
      <ambientLight intensity={0.25 * env.brightness} />
      <hemisphereLight args={["#dae4ef", "#141a17", 0.35]} />
      <directionalLight
        position={[-2, 9, 1]}
        color={keyColor}
        intensity={4.2 * env.brightness}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7 * reach}
        shadow-camera-right={7 * reach}
        shadow-camera-top={7 * reach}
        shadow-camera-bottom={-7 * reach}
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
        onPointerMove={tracking ? track : undefined}
        onClick={place}
        onPointerDown={(e) => {
          if (tool.type !== "terrain" || e.button !== 0) return;
          const point = groundUnder(e);
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
        <Terrain environment={env} groundRef={terrain} />
        {env.springs.map((spring, i) => (
          <SpringMarker
            key={i}
            spring={spring}
            environment={env}
            paused={editor.paused}
            selected={!view && tool.type === "spring" && tool.index === i}
            onSelect={(e) => {
              if (e.delta > 6 || view || placing || tool.type === "terrain")
                return;
              e.stopPropagation();
              editor.select(null);
              editor.setTool({ type: "spring", index: i });
            }}
          />
        ))}
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
              foliageVisitors={foliageVisitors}
              foliagePlants={foliagePlants}
              environment={env}
              paused={editor.paused}
              selected={!view && editor.selectedId === object.id}
              onSelect={(e) => {
                if (e.delta > 6 || placing || tool.type === "terrain") return;
                e.stopPropagation();
                onActivateObject(object.id);
              }}
            />
          ))}
        {ecosystem.remains.map((body) => (
          <Remains
            key={body.object.id}
            body={body}
            paused={editor.paused}
            onGone={ecosystem.forgetRemains}
          />
        ))}
      </group>
      <EcosystemLife
        ecosystem={ecosystem}
        foliageVisitors={foliageVisitors}
        paused={
          editor.paused ||
          tool.type !== "select" ||
          editor.world !== editor.savedWorld
        }
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
              ? {
                  ...moving,
                  ...point,
                  lift,
                  rotation: editor.placementRotation,
                }
              : {
                  id: "ghost",
                  kind,
                  ...point,
                  lift,
                  rotation: editor.placementRotation,
                  scale,
                  seed,
                }
          }
          environment={env}
          paused
          ghost
          invalid={!!problem}
        />
      )}
      {ghostPieces?.map((piece, i) => (
        <Inhabitant
          key={i}
          object={piece}
          environment={env}
          paused
          ghost
          invalid={!!problem}
        />
      ))}
      {point && tool.type === "terrain" && (
        <TerrainBrushCursor {...point} radius={tool.radius} environment={env} />
      )}
      {point && (placing || tool.type === "spring") && (
        <mesh
          position={[
            point.x,
            Math.max(
              groundHeight(point.x, point.z, env) + (lift ?? 0),
              waterLevel(point.x, point.z, env),
            ) + 0.018,
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
        <meshBasicMaterial color={BACKGROUND} />
      </mesh>

      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0.8, 0]}
        minDistance={4}
        maxDistance={30 * reach}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={0.16}
        enablePan
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
        }}
        screenSpacePanning={false}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        enableRotate={tool.type !== "terrain"}
        enableDamping
        dampingFactor={0.09}
        autoRotate={view && !editor.paused && !followCamera.active}
        autoRotateSpeed={0.35}
        onStart={startCamera}
        onChange={() => {
          if (controls.current) keepTankInReach(controls.current, env);
        }}
      />
    </>
  );
}
/** Lifts the loading screen once the tank is drawn. Its shaders compile
 * over the first few frames that draw it, and the page stalls while they
 * do, so it waits for a frame that draws without compiling anything new. */
function HideSplashWhenDrawn() {
  const programs = useRef(-1);
  const drawn = useRef(false);
  useFrame(({ gl, invalidate }) => {
    if (drawn.current) return;
    // The renderer's counts are still the last frame's at this point.
    const compiled = gl.info.programs?.length ?? 0;
    drawn.current = gl.info.render.calls > 0 && compiled === programs.current;
    programs.current = compiled;
    if (drawn.current) hideSplash();
    // A paused scene only draws on demand.
    else invalidate();
  });
  return null;
}

export function WorldScene(props: SceneProps) {
  // Canvas's own fallback sits inside the canvas element, which a browser
  // without WebGL still shows, so it never appears.
  const [noWebgl, setNoWebgl] = useState(false);
  if (noWebgl)
    return (
      <div className="webgl-fallback">
        This terrarium needs WebGL. Try a current browser with hardware
        acceleration enabled. Your saved world is still available to export.
      </div>
    );
  return (
    <Canvas
      frameloop={props.editor.paused ? "demand" : "always"}
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [8, 6.6, 9.8], fov: 36, near: 0.1, far: 100 }}
      gl={(defaults) => {
        try {
          return new THREE.WebGLRenderer({
            ...defaults,
            antialias: true,
            alpha: false,
          });
        } catch (error) {
          setNoWebgl(true);
          // Nothing will ever draw, so the loading screen must not wait.
          hideSplash();
          throw error;
        }
      }}
      onPointerMissed={() => {
        if (props.editor.tool.type === "select") props.editor.select(null);
      }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
        {/* Opening another world shows the loading screen again and resets
            the camera, so a fresh watcher waits for that world to draw. */}
        <HideSplashWhenDrawn key={props.resetCamera} />
      </Suspense>
    </Canvas>
  );
}

/** The world object a rendered part belongs to, if any. */
function objectIdOf(part: THREE.Object3D | null): string | undefined {
  for (; part; part = part.parent)
    if (typeof part.userData.objectId === "string")
      return part.userData.objectId;
  return undefined;
}
