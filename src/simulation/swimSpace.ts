import * as THREE from "three";
import { assets, buildAsset, disposeAsset } from "../assets";
import type { Environment, HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight, swimmingHeight } from "../model/terrain";
import type { Fish } from "./fish";

const CLEARANCE = 0.015;
export const SWIM_BOB = 0.025;

interface Face {
  triangle: THREE.Triangle;
  bounds: THREE.Box3;
}
interface Tree {
  bounds: THREE.Box3;
  faces?: Face[];
  children?: [Tree, Tree];
}
interface Crossing {
  distance: number;
  side: number;
}

/** Only baked geometry survives; these models never enter the scene. */
const shapes = new WeakMap<
  HabitatObject,
  { faces: Face[]; bounds: THREE.Box3 }
>();
function shape(object: HabitatObject) {
  const cached = shapes.get(object);
  if (cached) return cached;
  // Decorative moss painted onto hardscape is soft cover, not another wall.
  const model = buildAsset(object.kind, object.seed);
  model.updateMatrixWorld(true);
  const faces: Face[] = [];
  const bounds = new THREE.Box3();
  model.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const positions = part.geometry.getAttribute("position");
    const index = part.geometry.index;
    const count = index?.count ?? positions.count;
    for (let i = 0; i < count; i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new THREE.Vector3()
          .fromBufferAttribute(
            positions,
            index ? index.getX(i + offset) : i + offset,
          )
          .applyMatrix4(part.matrixWorld),
      );
      const triangle = new THREE.Triangle(points[0], points[1], points[2]);
      const box = new THREE.Box3().setFromPoints(points);
      faces.push({ triangle, bounds: box });
      bounds.union(box);
    }
  });
  const tail = model.getObjectByName("tail");
  if (tail) {
    for (const angle of [-0.35, 0.35]) {
      tail.rotation.y = angle;
      bounds.union(new THREE.Box3().setFromObject(model));
    }
  }
  disposeAsset(model);
  const result = { faces, bounds };
  shapes.set(object, result);
  return result;
}

function tree(faces: Face[]): Tree {
  const bounds = new THREE.Box3();
  for (const face of faces) bounds.union(face.bounds);
  if (faces.length <= 12) return { bounds, faces };
  const size = bounds.getSize(new THREE.Vector3());
  const axis =
    size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
  faces.sort(
    (a, b) =>
      a.bounds.min[axis] +
      a.bounds.max[axis] -
      b.bounds.min[axis] -
      b.bounds.max[axis],
  );
  const middle = Math.floor(faces.length / 2);
  return {
    bounds,
    children: [tree(faces.slice(0, middle)), tree(faces.slice(middle))],
  };
}

/** Fish-sized, oriented clearance against the actual leaves, branches and
 * hardscape. A hierarchy keeps queries local even in a heavily planted tank. */
export class SwimSpace {
  private readonly obstacles: Tree;
  private readonly solids: Tree[] = [];
  private readonly bodies = new Map<
    string,
    { bounds: THREE.Box3; depth: number }
  >();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();
  private readonly inverse = new THREE.Matrix4();
  private readonly query = new THREE.Box3();
  private readonly bodyBox = new THREE.Box3();
  private readonly triangle = new THREE.Triangle();
  private readonly unitScale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();

  constructor(private readonly world: World) {
    const faces: Face[] = [];
    for (const object of world.objects) {
      const asset = assets[object.kind];
      if (asset.category === "Animals") {
        if (!asset.swims) continue;
        const bounds = shape(object).bounds.clone();
        bounds.min.multiplyScalar(object.scale);
        bounds.max.multiplyScalar(object.scale);
        // Include the tail's sway and the renderer's vertical bob.
        const sway = object.kind === "tiger-barb" ? 0.025 * object.scale : 0;
        bounds.min.x -= sway + CLEARANCE;
        bounds.max.x += sway + CLEARANCE;
        bounds.min.y -= CLEARANCE;
        bounds.max.y += CLEARANCE;
        bounds.min.z -= CLEARANCE;
        bounds.max.z += CLEARANCE;
        this.bodies.set(object.id, { bounds, depth: asset.swims.depth });
        continue;
      }
      this.matrix.compose(
        this.position.set(
          object.x,
          objectBase(object, world.environment),
          object.z,
        ),
        this.rotation.setFromAxisAngle(this.up, object.rotation),
        this.unitScale.clone().multiplyScalar(object.scale),
      );
      const geometry = shape(object);
      const submergedBounds = geometry.bounds.clone().applyMatrix4(this.matrix);
      if (submergedBounds.min.y >= world.environment.water) continue;
      const transformed = geometry.faces.map(({ triangle }) => {
        const moved = triangle.clone();
        for (const point of [moved.a, moved.b, moved.c])
          point.applyMatrix4(this.matrix);
        return {
          triangle: moved,
          bounds: new THREE.Box3().setFromPoints([moved.a, moved.b, moved.c]),
        };
      });
      faces.push(
        ...transformed.filter(
          (face) => face.bounds.min.y < world.environment.water,
        ),
      );
      if (asset.hardscape) this.solids.push(tree([...transformed]));
    }
    this.obstacles = tree(faces);
  }

  private vertical(
    fish: Fish,
    x: number,
    z: number,
    env = this.world.environment,
  ) {
    const body = this.bodies.get(fish.id)!;
    const floor = groundHeight(x, z, env) - body.bounds.min.y + 0.005;
    const ceiling = env.water - body.bounds.max.y - 0.005;
    const bob = Math.max(0, Math.min(SWIM_BOB, (ceiling - floor) / 2));
    const preferred = swimmingHeight(
      x,
      z,
      env,
      body.depth,
      0,
      Math.max(0.05, -body.bounds.min.y + 0.005),
    );
    return {
      y: Math.max(floor + bob, Math.min(ceiling - bob, preferred)),
      bob,
    };
  }

  height = (fish: Fish, x: number, z: number, preview?: Environment) =>
    this.vertical(fish, x, z, preview).y;
  bob = (fish: Fish, x: number, z: number, preview?: Environment) =>
    this.vertical(fish, x, z, preview).bob;

  canSwim = (
    fish: Fish,
    x: number,
    z: number,
    heading: number,
    padding = 0,
  ): boolean => {
    const body = this.bodies.get(fish.id)!;
    const pose = this.vertical(fish, x, z);
    this.bodyBox.copy(body.bounds);
    this.bodyBox.min.y -= pose.bob;
    this.bodyBox.max.y += pose.bob;
    // Extra horizontal breathing room for steering, without changing depth.
    this.bodyBox.min.x -= padding;
    this.bodyBox.max.x += padding;
    this.bodyBox.min.z -= padding;
    this.bodyBox.max.z += padding;
    this.matrix.compose(
      this.position.set(x, pose.y, z),
      this.rotation.setFromAxisAngle(this.up, heading),
      this.unitScale,
    );
    this.inverse.copy(this.matrix).invert();
    this.query.copy(this.bodyBox).applyMatrix4(this.matrix);
    const env = this.world.environment;
    if (
      this.query.min.x <= -env.width / 2 ||
      this.query.max.x >= env.width / 2 ||
      this.query.min.z <= -env.depth / 2 ||
      this.query.max.z >= env.depth / 2 ||
      this.query.max.y >= env.water
    )
      return false;
    return !this.intersects(this.obstacles, this.bodyBox);
  };

  /** A new or edited object can surround a fish without crossing its skin.
   * Check solid interiors when finding a starting position, too. Hollow log
   * walls and shelter openings retain their real gaps. */
  canStart(fish: Fish, x: number, z: number, heading: number) {
    if (!this.canSwim(fish, x, z, heading)) return false;
    this.ray.set(
      this.position,
      new THREE.Vector3(0.937, 0.213, 0.277).normalize(),
    );
    for (const solid of this.solids) {
      if (!solid.bounds.containsPoint(this.position)) continue;
      const hits: Crossing[] = [];
      this.crossings(solid, hits);
      hits.sort((a, b) => a.distance - b.distance);
      // Shared triangle edges count as one crossing.
      const crossings = hits.filter(
        (hit, i) => i === 0 || hit.distance - hits[i - 1].distance > 1e-6,
      );
      // Signed crossings also detect overlapping stones in one shelter.
      if (crossings.reduce((sum, hit) => sum + hit.side, 0) !== 0) return false;
    }
    return true;
  }

  private intersects(node: Tree, body: THREE.Box3): boolean {
    if (!node.bounds.intersectsBox(this.query)) return false;
    if (node.children)
      return node.children.some((child) => this.intersects(child, body));
    return node.faces!.some((face) => {
      if (!face.bounds.intersectsBox(this.query)) return false;
      this.triangle.copy(face.triangle);
      for (const point of [this.triangle.a, this.triangle.b, this.triangle.c])
        point.applyMatrix4(this.inverse);
      return body.intersectsTriangle(this.triangle);
    });
  }

  private crossings(node: Tree, hits: Crossing[]) {
    if (!this.ray.intersectsBox(node.bounds)) return;
    if (node.children) {
      for (const child of node.children) this.crossings(child, hits);
      return;
    }
    for (const { triangle } of node.faces!) {
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
          distance: this.hit.distanceTo(this.ray.origin),
          side: Math.sign(
            triangle.getNormal(this.normal).dot(this.ray.direction),
          ),
        });
    }
  }
}
