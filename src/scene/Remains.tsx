import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { assets, buildAsset, disposeAsset } from "../assets";
import { juvenileScale } from "../simulation/lifeCycle";
import type { Remains as Body } from "../simulation/useEcosystem";

// Seconds from death: the body rolls over and settles, lies still, then fades.
const ROLL = 1.5;
const SINK = 6;
const FALL = 0.6;
const FADE_FROM = 14;
const FADE = 6;

const ease = (t: number) => {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** A fish rolls onto its side and sinks slowly to the bottom. Animals that
 * walk flip onto their backs, legs up, dropping to the ground if they died
 * on a leaf or the glass. */
export function Remains({
  body,
  paused,
  onGone,
}: {
  body: Body;
  paused: boolean;
  onGone: (id: string) => void;
}) {
  const { object, position, heading, restY } = body;
  const root = useRef<THREE.Group>(null),
    clock = useRef(0),
    gone = useRef(false);
  const model = useMemo(
    () => buildAsset(object.kind, object.seed, object.moss),
    [object.kind, object.seed, object.moss],
  );
  useEffect(() => () => disposeAsset(model), [model]);
  const swims = !!assets[object.kind].swims;
  const scale = object.scale * juvenileScale(object);
  // How far the model's origin sits above the ground once it has rolled:
  // half its width on its side, or its full height on its back.
  const lift = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    return (swims ? box.max.x : box.max.y) * scale;
  }, [model, swims, scale]);
  const materials = useMemo(() => {
    const found = new Set<THREE.Material>();
    model.traverse((o) => {
      if (o instanceof THREE.Mesh)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          found.add(m),
        );
    });
    return [...found].map((material) => ({
      material,
      opacity: material.opacity,
    }));
  }, [model]);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group || gone.current) return;
    if (!paused) clock.current += Math.min(delta, 0.05);
    const t = clock.current;
    const roll = ease(t / ROLL);
    const settle = swims ? ease(t / SINK) : Math.min(1, (t / FALL) ** 2);
    group.position.set(
      position.x,
      THREE.MathUtils.lerp(position.y, restY, settle) + lift * roll,
      position.z,
    );
    group.rotation.set(0, heading, roll * (swims ? Math.PI / 2 : Math.PI));
    const fade = (t - FADE_FROM) / FADE;
    if (fade <= 0) return;
    for (const { material, opacity } of materials) {
      material.transparent = true;
      material.opacity = opacity * Math.max(0, 1 - fade);
    }
    if (fade >= 1) {
      gone.current = true;
      group.visible = false;
      onGone(object.id);
    }
  });

  return (
    <group
      ref={root}
      position={[position.x, position.y, position.z]}
      rotation={[0, heading, 0]}
      scale={scale}
    >
      <primitive object={model} />
    </group>
  );
}
