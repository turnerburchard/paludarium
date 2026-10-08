import * as THREE from "three";
import { assets } from "../assets";
import {
  collisionShape,
  collisionTree,
  collisionFaces,
  type CollisionFace,
  type CollisionTree,
} from "../assets/collisionShape";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight, groundNormal } from "../model/terrain";
import type { BodyBounds, HabitatNode, Vec3 } from "./types";

interface Solid {
  object: HabitatObject;
  bounds: THREE.Box3;
  faces: CollisionFace[];
  tree: CollisionTree;
}

/** Exposed stone and wood surfaces, sampled from the same geometry used for
 * placement and fish clearance. Overlapping stacks expose only their outer skin. */
export class LandSurfaces {
  readonly solids: Solid[] = [];
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly down = new THREE.Vector3(0, -1, 0);

  constructor(private readonly world: World) {
    for (const object of world.objects) {
      if (!assets[object.kind].hardscape) continue;
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(
          object.x,
          objectBase(object, world.environment),
          object.z,
        ),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          object.rotation,
        ),
        new THREE.Vector3().setScalar(object.scale),
      );
      const shape = collisionShape(object);
      const faces = shape.faces.map(({ triangle }) => {
        const moved = triangle.clone();
        for (const point of [moved.a, moved.b, moved.c])
          point.applyMatrix4(matrix);
        return {
          triangle: moved,
          bounds: new THREE.Box3().setFromPoints([moved.a, moved.b, moved.c]),
        };
      });
      this.solids.push({
        object,
        bounds: shape.bounds.clone().applyMatrix4(matrix),
        faces,
        tree: collisionTree([...faces]),
      });
    }
  }

  private readonly bodyBox = new THREE.Box3();
  private readonly bodyMatrix = new THREE.Matrix4();
  private readonly inverseBody = new THREE.Matrix4();
  private readonly bodyQuery = new THREE.Box3();
  private readonly bodyTriangle = new THREE.Triangle();
  private readonly triangleBounds = new THREE.Box3();

  private orient(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
    tilt = 0,
  ) {
    const up = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const back = new THREE.Vector3(direction.x, direction.y, direction.z)
      .normalize()
      .projectOnPlane(up);
    if (back.lengthSq() < 0.001) back.set(0, 0, -1).projectOnPlane(up);
    if (back.lengthSq() < 0.001) back.set(0, 1, 0).projectOnPlane(up);
    back.normalize().negate();
    const right = new THREE.Vector3().crossVectors(up, back).normalize();
    const rotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, back),
    );
    rotation.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt),
    );
    this.bodyMatrix.compose(
      new THREE.Vector3(position.x, position.y, position.z),
      rotation,
      new THREE.Vector3(1, 1, 1),
    );
    this.inverseBody.copy(this.bodyMatrix).invert();
    this.bodyBox.min.set(body.min.x - 0.005, body.min.y, body.min.z - 0.005);
    this.bodyBox.max.set(
      body.max.x + 0.005,
      body.max.y + 0.005,
      body.max.z + 0.005,
    );
    this.bodyQuery.copy(this.bodyBox).applyMatrix4(this.bodyMatrix);
  }

  /** Contact is checked across the lower face, not just at the root point. */
  private floorPenetration() {
    let penetration = -Infinity;
    const point = new THREE.Vector3();
    const part = this.bodyBox;
    for (const [ix, iz] of [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
      [1, 1],
    ]) {
      point
        .set(
          part.min.x + ((part.max.x - part.min.x) * ix) / 2,
          part.min.y,
          part.min.z + ((part.max.z - part.min.z) * iz) / 2,
        )
        .applyMatrix4(this.bodyMatrix);
      penetration = Math.max(
        penetration,
        groundHeight(point.x, point.z, this.world.environment) - point.y,
      );
    }
    return penetration;
  }

  groundPose(position: Vec3, direction: Vec3, body: BodyBounds) {
    const normal = groundNormal(position.x, position.z, this.world.environment);
    const contact = {
      ...position,
      y: groundHeight(position.x, position.z, this.world.environment),
    };
    return this.aboveGround(contact, normal, direction, body);
  }

  aboveGround(position: Vec3, normal: Vec3, direction: Vec3, body: BodyBounds) {
    this.orient(position, normal, direction, body);
    const env = this.world.environment;
    const contact = { ...position };
    // Round the ground-to-glass corner with room for the rotating body.
    contact.x +=
      Math.max(0, -env.width / 2 - this.bodyQuery.min.x) -
      Math.max(0, this.bodyQuery.max.x - env.width / 2);
    contact.z +=
      Math.max(0, -env.depth / 2 - this.bodyQuery.min.z) -
      Math.max(0, this.bodyQuery.max.z - env.depth / 2);
    this.orient(contact, normal, direction, body);
    contact.y += Math.max(0, this.floorPenetration() + 0.006);
    return { position: contact, normal: { ...normal } };
  }

  onSurface(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
    supportIds: readonly string[],
  ) {
    const contact = { ...position };
    const faceNormal = new THREE.Vector3();
    for (const support of this.solids.filter((solid) =>
      supportIds.includes(solid.object.id),
    )) {
      for (let pass = 0; pass < 3; pass++) {
        this.orient(contact, normal, direction, body);
        let lift = 0;
        for (const face of collisionFaces(support.tree, this.bodyQuery)) {
          this.bodyTriangle.copy(face.triangle);
          for (const point of [
            this.bodyTriangle.a,
            this.bodyTriangle.b,
            this.bodyTriangle.c,
          ])
            point.applyMatrix4(this.inverseBody);
          this.triangleBounds.setFromPoints([
            this.bodyTriangle.a,
            this.bodyTriangle.b,
            this.bodyTriangle.c,
          ]);
          if (!this.bodyBox.intersectsBox(this.triangleBounds)) continue;
          this.bodyTriangle.getNormal(faceNormal);
          // Only its supporting skin may move the contact point. Other walls,
          // including the roof inside hollow wood, must still block movement.
          if (faceNormal.y < 0.15) continue;
          if (!this.bodyBox.intersectsTriangle(this.bodyTriangle)) continue;
          const corner = new THREE.Vector3(
            faceNormal.x >= 0 ? body.min.x : body.max.x,
            body.min.y,
            faceNormal.z >= 0 ? body.min.z : body.max.z,
          );
          lift = Math.max(
            lift,
            (faceNormal.dot(this.bodyTriangle.a) -
              faceNormal.dot(corner) +
              0.003) /
              faceNormal.y,
          );
        }
        if (lift <= 0) break;
        const reach =
          Math.hypot(body.max.x - body.min.x, body.max.z - body.min.z) / 2;
        if (lift > reach) break;
        contact.x += normal.x * lift;
        contact.y += normal.y * lift;
        contact.z += normal.z * lift;
      }
    }
    return { position: contact, normal: { ...normal } };
  }

  /** Foliage remains soft cover. Only terrain and hardscape exclude a body. */
  fits(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
    tilt = 0,
  ) {
    this.orient(position, normal, direction, body, tilt);
    const env = this.world.environment;
    if (
      this.bodyQuery.min.x < -env.width / 2 - 1e-6 ||
      this.bodyQuery.max.x > env.width / 2 + 1e-6 ||
      this.bodyQuery.min.z < -env.depth / 2 - 1e-6 ||
      this.bodyQuery.max.z > env.depth / 2 + 1e-6 ||
      this.floorPenetration() > 0.01
    )
      return false;
    for (const solid of this.solids) {
      if (!solid.bounds.intersectsBox(this.bodyQuery)) continue;
      for (const face of collisionFaces(solid.tree, this.bodyQuery)) {
        this.bodyTriangle.copy(face.triangle);
        for (const point of [
          this.bodyTriangle.a,
          this.bodyTriangle.b,
          this.bodyTriangle.c,
        ])
          point.applyMatrix4(this.inverseBody);
        this.triangleBounds.setFromPoints([
          this.bodyTriangle.a,
          this.bodyTriangle.b,
          this.bodyTriangle.c,
        ]);
        if (this.bodyBox.intersectsTriangle(this.bodyTriangle)) return false;
      }
    }
    const center = this.bodyBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(this.bodyMatrix);
    return !this.inside(center);
  }

  at(x: number, z: number) {
    let highest:
      | { position: Vec3; normal: Vec3; object: HabitatObject }
      | undefined;
    for (const solid of this.solids) {
      if (
        x < solid.bounds.min.x ||
        x > solid.bounds.max.x ||
        z < solid.bounds.min.z ||
        z > solid.bounds.max.z
      )
        continue;
      this.ray.set(new THREE.Vector3(x, solid.bounds.max.y + 1, z), this.down);
      for (const { triangle, bounds } of solid.faces) {
        if (
          x < bounds.min.x ||
          x > bounds.max.x ||
          z < bounds.min.z ||
          z > bounds.max.z
        )
          continue;
        if (
          !this.ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            true,
            this.hit,
          )
        )
          continue;
        if (highest && highest.position.y - 0.015 >= this.hit.y) continue;
        const normal = triangle.getNormal(new THREE.Vector3());
        if (normal.y < 0.05) continue;
        highest = {
          position: { x, y: this.hit.y + 0.015, z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          object: solid.object,
        };
      }
    }
    return highest;
  }

  blocksGround(x: number, z: number, clearance: number) {
    const floor = groundHeight(x, z, this.world.environment);
    // Probe the animal's footprint, rather than excluding a whole bounding
    // circle around thin branches and irregular stones.
    return [
      [0, 0],
      [clearance, 0],
      [-clearance, 0],
      [0, clearance],
      [0, -clearance],
    ].some(([dx, dz]) => {
      const surface = this.at(x + dx, z + dz);
      return surface && surface.position.y > floor + 0.04;
    });
  }

  /** Mesh vertices, edge samples and face centers share connections along
   * the actual skin, including steep sides that a top-down height map misses. */
  routes(margin: number): HabitatNode[] {
    const nodes: HabitatNode[] = [];
    const env = this.world.environment;
    for (const solid of this.solids) {
      const samples = new Map<
        string,
        { point: THREE.Vector3; normal: THREE.Vector3; node: HabitatNode }
      >();
      const stone = assets[solid.object.kind].hardscape === "stone";
      const sample = (point: THREE.Vector3, normal: THREE.Vector3) => {
        const key = [point.x, point.y, point.z]
          .map((value) => Math.round(value * 100000))
          .join(":");
        const existing = samples.get(key);
        if (existing) {
          existing.normal.add(normal);
          return existing.node;
        }
        const node: HabitatNode = {
          id: `hardscape:${solid.object.id}:${key}`,
          position: { x: point.x, y: point.y, z: point.z },
          normal: { x: 0, y: 1, z: 0 },
          surface: stone ? "stone" : "bark",
          wet: env.water > 0 && point.y <= env.water + 0.065,
          submerged: env.water - point.y > 0.025,
          shelter: solid.object.moss ? 0.5 : 0.2,
          perchHeight: point.y - groundHeight(point.x, point.z, env),
          supportId: solid.object.id,
          neighbors: [],
        };
        samples.set(key, {
          point: point.clone(),
          normal: normal.clone(),
          node,
        });
        return node;
      };
      const connect = (a: HabitatNode, b: HabitatNode) => {
        if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
        if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
      };
      for (const { triangle } of solid.faces) {
        const normal = triangle.getNormal(new THREE.Vector3());
        // Do not offer the flat underside as a walking surface. Sloping
        // sides below a stone's equator are useful approaches for climbers.
        if (normal.y < -0.95) continue;
        const center = sample(
          triangle.getMidpoint(new THREE.Vector3()),
          normal,
        );
        const corners = [triangle.a, triangle.b, triangle.c];
        for (let edge = 0; edge < 3; edge++) {
          const from = corners[edge],
            to = corners[(edge + 1) % 3];
          const steps = Math.max(1, Math.ceil(from.distanceTo(to) / 0.16));
          let previous = sample(from, normal);
          connect(center, previous);
          for (let i = 1; i <= steps; i++) {
            const next = sample(from.clone().lerp(to, i / steps), normal);
            connect(previous, next);
            connect(center, next);
            previous = next;
          }
        }
      }
      for (const { point, normal, node } of samples.values()) {
        normal.normalize();
        const lifted = point.clone().addScaledVector(normal, 0.018);
        node.position = { x: lifted.x, y: lifted.y, z: lifted.z };
        node.normal = { x: normal.x, y: normal.y, z: normal.z };
        if (
          Math.abs(lifted.x) > env.width / 2 - margin ||
          Math.abs(lifted.z) > env.depth / 2 - margin ||
          lifted.y < groundHeight(lifted.x, lifted.z, env) - 0.015 ||
          this.inside(node.position)
        )
          continue;
        nodes.push(node);
      }
    }
    const exposed = new Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes)
      node.neighbors = node.neighbors.filter((id) => exposed.has(id));
    // Exposed endpoints alone are insufficient: another stacked piece can
    // still intersect the face between them. Check each edge once.
    for (const node of nodes)
      node.neighbors = node.neighbors.filter((id) => {
        if (node.id > id) return true;
        const neighbor = exposed.get(id)!;
        if (this.clearRoute(node.position, neighbor.position)) return true;
        neighbor.neighbors = neighbor.neighbors.filter(
          (next) => next !== node.id,
        );
        return false;
      });
    return nodes;
  }

  /** Signed crossings handle both overlapping stones and hollow wood. A
   * point within the skin tolerance can lie on a shared triangle edge. */
  inside(point: Vec3) {
    const origin = new THREE.Vector3(point.x, point.y, point.z);
    const direction = new THREE.Vector3(0.937, 0.213, 0.277).normalize();
    this.ray.set(origin, direction);
    for (const solid of this.solids) {
      if (!solid.bounds.containsPoint(origin)) continue;
      const hits: { distance: number; side: number }[] = [];
      for (const { triangle } of collisionFaces(solid.tree, this.ray)) {
        if (
          this.ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            false,
            this.hit,
          )
        )
          hits.push({
            distance: this.hit.distanceTo(origin),
            side: Math.sign(
              triangle.getNormal(new THREE.Vector3()).dot(direction),
            ),
          });
      }
      hits.sort((a, b) => a.distance - b.distance);
      const crossings = hits.filter(
        (hit, i) => i === 0 || hit.distance - hits[i - 1].distance > 1e-6,
      );
      if (
        crossings.length &&
        crossings[0].distance > 0.025 &&
        crossings.reduce((sum, hit) => sum + hit.side, 0) !== 0
      )
        return true;
    }
    return false;
  }

  /** A route between two dry points can't dip underwater, so land animals
   * never wade across a pond. Underwater routes only have to stay above the
   * ground. */
  clearRoute(from: Vec3, to: Vec3) {
    const env = this.world.environment;
    const floor =
      Math.min(from.y, to.y) < env.water - 0.025 ? 0 : env.water - 0.025;
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const steps = Math.max(2, Math.ceil(length / 0.04));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t,
      };
      if (
        point.y < Math.max(floor, groundHeight(point.x, point.z, env) - 0.04) ||
        this.inside(point)
      )
        return false;
    }
    return true;
  }
}
