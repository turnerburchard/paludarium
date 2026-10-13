import * as THREE from "three";
import { assetRadius, assets, isAnimal } from "../assets";
import { collisionShape } from "../assets/collisionShape";
import { plantCondition } from "../model/plants";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { terrainGrid, terrainPoint } from "../model/terrainData";
import { cellCenter, waterMap } from "../model/water";

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
interface Point {
  x: number;
  z: number;
}

export function objectBounds(object: HabitatObject): Bounds {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(object.x, 0, object.z),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      object.rotation,
    ),
    new THREE.Vector3().setScalar(object.scale),
  );
  const box = collisionShape(object).bounds.clone().applyMatrix4(matrix);
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}

/** Areas whose terrain, water or placed geometry changed. Bounds include the
 * inputs to queries, so a connection can change even when its endpoints don't. */
export class HabitatChanges {
  private readonly areas: Bounds[] = [];
  static between(before: World, after: World): HabitatChanges | undefined {
    const a = before.environment,
      b = after.environment;
    const {
      terrain: oldTerrain,
      warmth: _aw,
      brightness: _ab,
      ...oldSettings
    } = a;
    const {
      terrain: newTerrain,
      warmth: _bw,
      brightness: _bb,
      ...newSettings
    } = b;
    const oldGrid = terrainGrid(a),
      newGrid = terrainGrid(b);
    if (
      JSON.stringify(oldSettings) !== JSON.stringify(newSettings) ||
      oldGrid.columns !== newGrid.columns ||
      oldGrid.rows !== newGrid.rows
    )
      return undefined;
    const changes = new HabitatChanges();
    const dx = a.width / oldGrid.columns,
      dz = a.depth / oldGrid.rows;
    // Bilinear terrain samples influence every adjacent cell.
    const terrain: Bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    };
    for (let i = 0; i < (oldGrid.columns + 1) * (oldGrid.rows + 1); i++) {
      if ((oldTerrain?.heights[i] ?? 0) === (newTerrain?.heights[i] ?? 0))
        continue;
      const point = terrainPoint(i, a);
      terrain.minX = Math.min(terrain.minX, point.x - dx);
      terrain.maxX = Math.max(terrain.maxX, point.x + dx);
      terrain.minZ = Math.min(terrain.minZ, point.z - dz);
      terrain.maxZ = Math.max(terrain.maxZ, point.z + dz);
    }
    if (terrain.minX !== Infinity) changes.areas.push(terrain);
    if (a.springs.length && oldTerrain?.heights !== newTerrain?.heights) {
      const oldWater = waterMap(a),
        newWater = waterMap(b);
      const shore: Bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      };
      for (let i = 0; i < oldWater.shore.length; i++) {
        if (oldWater.shore[i] === newWater.shore[i]) continue;
        const point = cellCenter(i, oldWater, a);
        shore.minX = Math.min(shore.minX, point.x - a.width / oldWater.columns);
        shore.maxX = Math.max(shore.maxX, point.x + a.width / oldWater.columns);
        shore.minZ = Math.min(shore.minZ, point.z - a.depth / oldWater.rows);
        shore.maxZ = Math.max(shore.maxZ, point.z + a.depth / oldWater.rows);
      }
      if (shore.minX !== Infinity) changes.areas.push(shore);
      // A redirected stream can wet ground far from the brush. Its whole
      // old and new course is conservative, without incremental hydrology.
      for (
        let i = 0;
        i < Math.max(oldWater.streams.length, newWater.streams.length);
        i++
      ) {
        if (
          JSON.stringify(oldWater.streams[i]) ===
          JSON.stringify(newWater.streams[i])
        )
          continue;
        for (const course of [oldWater.streams[i], newWater.streams[i]]) {
          if (!course?.length) continue;
          changes.areas.push({
            minX: Math.min(...course.map((p) => p.x - p.width / 2)),
            maxX: Math.max(...course.map((p) => p.x + p.width / 2)),
            minZ: Math.min(...course.map((p) => p.z - p.width / 2)),
            maxZ: Math.max(...course.map((p) => p.z + p.width / 2)),
          });
        }
      }
    }
    const oldObjects = new Map(
      before.objects.filter((o) => !isAnimal(o.kind)).map((o) => [o.id, o]),
    );
    const newObjects = new Map(
      after.objects.filter((o) => !isAnimal(o.kind)).map((o) => [o.id, o]),
    );
    for (const id of new Set([...oldObjects.keys(), ...newObjects.keys()])) {
      const old = oldObjects.get(id),
        next = newObjects.get(id);
      if (
        !old ||
        !next ||
        JSON.stringify(old) !== JSON.stringify(next) ||
        objectBase(old, a) !== objectBase(next, b)
      ) {
        if (old) changes.areas.push(objectBounds(old));
        if (next) changes.areas.push(objectBounds(next));
      }
      if (
        old &&
        next &&
        assets[next.kind].shelter &&
        plantCondition(old, a)?.thriving !== plantCondition(next, b)?.thriving
      ) {
        const radius = assetRadius(next.kind) * next.scale + 0.4;
        changes.areas.push({
          minX: next.x - radius,
          maxX: next.x + radius,
          minZ: next.z - radius,
          maxZ: next.z + radius,
        });
      }
    }
    return changes;
  }
  touches(point: Point, padding = 0) {
    return this.crosses(point, point, padding);
  }
  crosses(a: Point, b: Point, padding = 0) {
    return this.intersects(
      {
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minZ: Math.min(a.z, b.z),
        maxZ: Math.max(a.z, b.z),
      },
      padding,
    );
  }
  intersects(bounds: Bounds, padding = 0) {
    return this.areas.some(
      (area) =>
        bounds.maxX + padding >= area.minX &&
        bounds.minX - padding <= area.maxX &&
        bounds.maxZ + padding >= area.minZ &&
        bounds.minZ - padding <= area.maxZ,
    );
  }
}
