import * as THREE from "three";

interface OriginalMaterial {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

/** Fade intersecting foliage batches, keeping the supporting leaf and
 * everything behind the frog intact. Materials belong to each instance. */
export class WatchVisibility {
  private readonly ray = new THREE.Raycaster();
  private readonly target = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly hits: THREE.Intersection[] = [];
  private readonly materials = new Map<THREE.Material, OriginalMaterial>();
  private readonly shadows = new Map<THREE.Mesh, boolean>();
  private readonly blocked = new Set<THREE.Mesh>();
  private sampleIn = 0;

  update(
    eye: THREE.Vector3,
    focus: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    foliage: THREE.Mesh[],
    dt: number,
  ) {
    this.sampleIn -= dt;
    if (this.sampleIn <= 0) {
      this.sampleIn = 0.1;
      this.blocked.clear();
      // A small screen-facing cross covers the body rather than a single pixel.
      for (const [x, y] of [
        [0, 0],
        [-0.09, 0],
        [0.09, 0],
        [0, -0.07],
        [0, 0.07],
      ]) {
        this.target
          .copy(focus)
          .addScaledVector(right, x)
          .addScaledVector(up, y);
        this.direction.subVectors(this.target, eye);
        this.ray.far = Math.max(0, this.direction.length() - 0.16);
        this.ray.set(eye, this.direction.normalize());
        this.hits.length = 0;
        this.ray.intersectObjects(foliage, false, this.hits);
        for (const hit of this.hits) {
          if (hit.object instanceof THREE.Mesh) this.blocked.add(hit.object);
        }
      }
    }
    const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 15);
    for (const mesh of foliage) {
      const blocked = this.blocked.has(mesh);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        let original = this.materials.get(material);
        if (blocked && !original) {
          original = {
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
          };
          this.materials.set(material, original);
          material.transparent = true;
          material.depthWrite = false;
          material.needsUpdate = true;
        }
        if (!original) continue;
        const target = blocked ? original.opacity * 0.08 : original.opacity;
        material.opacity = THREE.MathUtils.lerp(material.opacity, target, ease);
        if (!blocked && Math.abs(material.opacity - original.opacity) < 0.005) {
          Object.assign(material, original);
          material.needsUpdate = true;
          this.materials.delete(material);
        }
      }
      if (blocked && !this.shadows.has(mesh))
        this.shadows.set(mesh, mesh.castShadow);
      if (this.shadows.has(mesh)) {
        mesh.castShadow = false;
        if (!materials.some((material) => this.materials.has(material))) {
          mesh.castShadow = this.shadows.get(mesh)!;
          this.shadows.delete(mesh);
        }
      }
    }
  }

  restore() {
    for (const [material, original] of this.materials) {
      Object.assign(material, original);
      material.needsUpdate = true;
    }
    for (const [mesh, castShadow] of this.shadows) mesh.castShadow = castShadow;
    this.materials.clear();
    this.shadows.clear();
    this.blocked.clear();
    this.sampleIn = 0;
  }
}
