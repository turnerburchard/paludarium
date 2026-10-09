import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Environment as EnvironmentLight } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { makePreset, type Preset } from "./src/model/presets";
import { Tank, Terrain, Water } from "./src/scene/Terrain";
import { SpringMarker } from "./src/scene/SpringMarker";
import { parseWorld } from "./src/editor/persistence";
import link from "./.linkworld.json";
const q = new URLSearchParams(location.search);
const env = q.get("preset") === "link" ? parseWorld(JSON.stringify(link)).environment : makePreset((q.get("preset") ?? "grotto") as Preset).environment;
const [cx, cy, cz, tx, ty, tz] = q.get("cam")!.split(",").map(Number);
function Scene() {
  const ground = useRef<THREE.Mesh>(null);
  return (<>
    <ambientLight intensity={0.25} /><hemisphereLight args={["#dae4ef", "#141a17", 0.35]} />
    <directionalLight position={[-2, 9, 1]} intensity={4.2} castShadow />
    <directionalLight position={[5, 4, -5]} color="#9fcfc2" intensity={0.65} />
    <EnvironmentLight resolution={64} frames={1}><mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[12, 12]} /><meshBasicMaterial color="#c8dbcd" side={THREE.DoubleSide} /></mesh></EnvironmentLight>
    <Terrain environment={env} groundRef={ground} />
    {env.springs.map((s, i) => <SpringMarker key={i} spring={s} environment={env} selected={false} onSelect={() => {}} />)}
    <Water environment={env} paused={false} /><Tank environment={env} />
  </>);
}
createRoot(document.getElementById("root")!).render(
  <Canvas shadows camera={{ position: [cx, cy, cz], fov: 40 }} onCreated={({ camera }) => camera.lookAt(tx, ty, tz)}>
    <color attach="background" args={["#080b0d"]} /><Scene /></Canvas>);
