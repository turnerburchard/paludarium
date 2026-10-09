import * as THREE from "three";
import { CURL } from "../simulation/fish";

/** Curls a fish into a C for a tight turn: the middle of its body stays put
 * and head and tail swing toward the turn, as the simulation assumes. The
 * parts that keep their shape, like the tail and eyes, ride along the arc. */
export class FishCurl {
  private readonly bent: Array<{
    position: THREE.BufferAttribute;
    /** Each vertex as it sits on the straight fish. */
    rest: THREE.Vector3[];
    /** From the fish back into the mesh's own space. */
    inverse: THREE.Matrix4;
  }> = [];
  private readonly joints: Array<{
    joint: THREE.Group;
    rest: THREE.Vector3;
  }> = [];
  private readonly middle: number;
  private readonly length: number;
  private bend = 0;
  private shown = 0;

  constructor(model: THREE.Group) {
    const bounds = new THREE.Box3().setFromObject(model);
    bounds.applyMatrix4(model.matrixWorld.clone().invert());
    this.middle = (bounds.min.z + bounds.max.z) / 2;
    this.length = bounds.max.z - bounds.min.z;
    for (const part of [...model.children]) {
      // A skinned fish bends its bind pose; its bones follow the swim clip.
      if (part instanceof THREE.Bone) continue;
      if (part instanceof THREE.Mesh) {
        // A long triangle would stay straight across the bend, so split it.
        // A skinned body is already fine enough.
        if (!(part instanceof THREE.SkinnedMesh)) {
          const fine = subdivide(part.geometry, this.length / 10);
          part.geometry.dispose();
          part.geometry = fine;
        }
        const position = part.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const rest = Array.from({ length: position.count }, (_, i) =>
          new THREE.Vector3()
            .fromBufferAttribute(position, i)
            .applyMatrix4(part.matrix),
        );
        const inverse = part.matrix.clone().invert();
        this.bent.push({ position, rest, inverse });
        continue;
      }
      // A joint between the fish and the part carries it along the arc,
      // leaving the part's own pose, like the tail's sway, alone.
      const joint = new THREE.Group();
      model.add(joint);
      joint.add(part);
      this.joints.push({ joint, rest: part.position.clone() });
    }
  }

  /** Ease toward `bend`: 1 curled to the fish's left, -1 to its right. */
  update(bend: number, dt: number) {
    this.bend += (bend - this.bend) * (1 - Math.exp(-10 * dt));
    if (Math.abs(this.bend - this.shown) < 0.001) return;
    this.shown = this.bend;
    for (const { position, rest, inverse } of this.bent) {
      rest.forEach((point, i) => {
        const [x, z] = this.place(point.x, point.z);
        bent.set(x, point.y, z).applyMatrix4(inverse);
        position.setXYZ(i, bent.x, bent.y, bent.z);
      });
      position.needsUpdate = true;
    }
    for (const { joint, rest } of this.joints) {
      const [x, z, turn] = this.place(rest.x, rest.z);
      joint.rotation.y = turn;
      joint.position
        .set(rest.x, rest.y, rest.z)
        .applyAxisAngle(UP, turn)
        .negate()
        .add(new THREE.Vector3(x, rest.y, z));
    }
  }

  /** Where a point of the straight fish lies on the arc, and how far the
   * body there has turned. */
  private place(x: number, z: number): [number, number, number] {
    const angle = CURL * Math.abs(this.shown);
    if (angle < 1e-4) return [x, z, 0];
    // Head and tail swing toward the side it turns to; the fish faces -z,
    // so its left is -x.
    const side = -Math.sign(this.shown);
    const radius = this.length / angle;
    const along = (z - this.middle) / radius;
    const inward = radius - x * side;
    const across = radius - inward * Math.cos(along);
    return [
      across * side,
      this.middle + inward * Math.sin(along),
      side * along,
    ];
  }
}

/** Split each triangle in half across its longest edge until no edge is
 * longer than `limit`, interpolating every attribute. Flat faces stay flat. */
function subdivide(geometry: THREE.BufferGeometry, limit: number) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const names = Object.keys(source.attributes);
  const corner = (i: number) =>
    names.map((name) => {
      const attribute = source.getAttribute(name);
      return Array.from({ length: attribute.itemSize }, (_, k) =>
        attribute.getComponent(i, k),
      );
    });
  type Corner = ReturnType<typeof corner>;
  const point = (c: Corner) =>
    new THREE.Vector3(...c[names.indexOf("position")]);
  const middle = (a: Corner, b: Corner): Corner =>
    a.map((values, n) => values.map((value, k) => (value + b[n][k]) / 2));
  const out: Corner[] = [];
  const split = (a: Corner, b: Corner, c: Corner) => {
    const edges = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ].map(([p, q, r]) => ({ p, q, r, length: point(p).distanceTo(point(q)) }));
    const longest = edges.reduce((x, y) => (y.length > x.length ? y : x));
    if (longest.length <= limit) {
      out.push(a, b, c);
      return;
    }
    const { p, q, r } = longest;
    const m = middle(p, q);
    split(p, m, r);
    split(m, q, r);
  };
  for (let i = 0; i < source.getAttribute("position").count; i += 3)
    split(corner(i), corner(i + 1), corner(i + 2));
  const fine = new THREE.BufferGeometry();
  names.forEach((name, n) => {
    const { itemSize, normalized } = source.getAttribute(name);
    fine.setAttribute(
      name,
      new THREE.Float32BufferAttribute(
        out.flatMap((c) => c[n]),
        itemSize,
        normalized,
      ),
    );
  });
  if (source !== geometry) source.dispose();
  return fine;
}

const bent = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
