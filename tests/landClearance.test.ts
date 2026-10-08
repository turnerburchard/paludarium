import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { assets } from "../src/assets";
import { emptyWorld, type HabitatObject } from "../src/model/schema";
import { groundHeight } from "../src/model/terrain";
import {
  createWorldEcosystem,
  buildHabitat,
} from "../src/simulation/worldHabitat";
import { collisionShape, collisionTree } from "../src/assets/collisionShape";
import { LandSurfaces } from "../src/simulation/landSurfaces";
import type { SpeciesProfile } from "../src/simulation/types";

const object = (
  kind: HabitatObject["kind"],
  id: string,
  x = -1.2,
  scale = 1,
): HabitatObject => ({ kind, id, x, z: 0, scale, rotation: 0, seed: 173 });
function profile(animal: HabitatObject): SpeciesProfile {
  const bounds = collisionShape(animal).bounds.clone();
  bounds.min.multiplyScalar(animal.scale);
  bounds.max.multiplyScalar(animal.scale);
  return {
    id: animal.kind,
    ...assets[animal.kind].behavior!,
    body: {
      min: { ...bounds.min },
      max: { ...bounds.max },
    },
  };
}

describe("land animal clearance", () => {
  it("checks a conservative body envelope and normalizes short headings", () => {
    const world = emptyWorld();
    world.environment.water = 0;
    const surfaces = new LandSurfaces(world);
    const position = {
      x: -2,
      y: groundHeight(-2, 0, world.environment) + 0.1,
      z: 0,
    };
    const stone = object("rock", "obstacle", position.x + 0.25);
    const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06).toNonIndexed();
    const points = geometry.getAttribute("position");
    const faces = [];
    for (let i = 0; i < points.count; i += 3) {
      const triangle = new THREE.Triangle(
        ...([0, 1, 2].map((corner) =>
          new THREE.Vector3()
            .fromBufferAttribute(points, i + corner)
            .add(new THREE.Vector3(stone.x, position.y + 0.15, 0)),
        ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
      );
      faces.push({
        triangle,
        bounds: new THREE.Box3().setFromPoints([
          triangle.a,
          triangle.b,
          triangle.c,
        ]),
      });
    }
    surfaces.solids.push({
      object: stone,
      faces,
      tree: collisionTree([...faces]),
      bounds: new THREE.Box3().setFromPoints(
        faces.flatMap((face) => [
          face.triangle.a,
          face.triangle.b,
          face.triangle.c,
        ]),
      ),
    });
    geometry.dispose();
    const body = {
      min: { x: -0.4, y: 0, z: -0.1 },
      max: { x: 0.4, y: 0.3, z: 0.1 },
    };
    const normal = { x: 0, y: 1, z: 0 },
      direction = { x: 0, y: 0, z: -1 };
    expect(surfaces.fits(position, normal, direction, body)).toBe(false);
    expect(surfaces.fits(position, normal, { x: 1, y: 0, z: 0 }, body)).toBe(
      true,
    );
    expect(
      surfaces.fits(position, normal, { x: 0.001, y: 0, z: 0 }, body),
    ).toBe(true);
  });
  it("preserves vertical glass climbs with a clear transition from the floor", () => {
    const world = emptyWorld();
    world.environment.water = 0;
    const frog = object("tree-frog", "frog", -2.3);
    world.objects = [frog];
    const species = profile(frog);
    const graph = buildHabitat(world);
    const start = graph.nearest(
      { x: frog.x, y: groundHeight(frog.x, 0, world.environment), z: 0 },
      species,
    )!;
    const paths = graph.paths(start.id, species);
    const walls = [...graph.nodes.values()].filter(
      (node) => node.surface === "glass" && paths.has(node.id),
    );
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.some((node) => node.position.y > start.position.y + 0.8)).toBe(
      true,
    );
    const route = paths.get(walls[0].id)!;
    let previous = start;
    for (const id of route) {
      const next = graph.node(id);
      expect(graph.canTravel(previous, next, species)).toBe(true);
      previous = next;
    }
  });

  it("keeps a large frog out of a small log while retaining routes into a roomy log", () => {
    for (const scale of [0.65, 3]) {
      const world = emptyWorld();
      world.environment.water = 0;
      world.environment.width = 12;
      const frog = object("mossy-frog", "frog", -0.3);
      world.objects = [object("log", "log", -3, scale), frog];
      const species = profile(frog);
      const graph = buildHabitat(world);
      const start = graph.nearest(
        { x: frog.x, y: groundHeight(frog.x, 0, world.environment), z: 0 },
        species,
      )!;
      expect(graph.paths(start.id, species).has("den:log:0:inside")).toBe(
        scale === 3,
      );
    }
  });

  it("does not offer side poses that bury a frog's body in terrain", () => {
    const world = emptyWorld();
    world.environment.water = 0;
    const frog = object("mossy-frog", "frog", -2.3);
    world.objects = [object("rock", "rock"), frog];
    const surfaces = new LandSurfaces(world);
    const species = profile(frog);
    const graph = buildHabitat(world);
    const start = graph.nearest(
      { x: frog.x, y: groundHeight(frog.x, 0, world.environment), z: 0 },
      species,
    )!;
    for (const [id, path] of graph.paths(start.id, species)) {
      const node = graph.node(id);
      if (!node.supportId || !path.length) continue;
      const previous = graph.node(
        path.length > 1 ? path[path.length - 2] : start.id,
      );
      const sign = graph.canTravel(previous, node, species) ? 1 : -1;
      const direction = {
        x: (node.position.x - previous.position.x) * sign,
        y: (node.position.y - previous.position.y) * sign,
        z: (node.position.z - previous.position.z) * sign,
      };
      const pose = graph.pose(previous, node, 1, species, sign === -1);
      expect(
        surfaces.fits(pose.position, pose.normal, direction, species.body!),
      ).toBe(true);
    }
  });

  it("follows the terrain between grid points, with room for the whole body", () => {
    const world = emptyWorld();
    world.environment.water = 0;
    world.objects = [object("mossy-frog", "frog", -2.3)];
    const engine = createWorldEcosystem(world);
    for (let step = 0; step < 500; step++) {
      engine.advance(1 / 60);
      const state = engine.observeRenderedAnimal("frog")!;
      const body = profile(world.objects[0]).body!;
      const surfaces = new LandSurfaces(world);
      expect(
        surfaces.fits(state.position, state.normal, state.direction, body),
      ).toBe(true);
    }
  });
});
