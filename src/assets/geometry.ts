import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
export function material(color: THREE.ColorRepresentation, roughness = 0.7) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    side: THREE.DoubleSide,
    flatShading: true,
  });
}
export function mesh(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  parent: THREE.Object3D,
  position: THREE.Vector3 | [number, number, number] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.copy(
    position instanceof THREE.Vector3
      ? position
      : new THREE.Vector3(...position),
  );
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
export function ellipsoid(
  parent: THREE.Object3D,
  mat: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
  detail = 16,
) {
  const object = mesh(
    new THREE.IcosahedronGeometry(1, detail > 8 ? 1 : 0),
    mat,
    parent,
    position,
  );
  object.scale.set(...scale);
  return object;
}
export function branch(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  topRadius = radius * 0.65,
) {
  const delta = end.clone().sub(start);
  const object = mesh(
    new THREE.CylinderGeometry(topRadius, radius, delta.length(), 5),
    mat,
    parent,
    start.clone().add(end).multiplyScalar(0.5),
  );
  object.quaternion.setFromUnitVectors(UP, delta.normalize());
  return object;
}
export function curvedStem(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
) {
  return mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      Math.max(3, points.length - 1),
      radius,
      4,
      false,
    ),
    mat,
    parent,
  );
}
/** Leaf blades have actual curvature rather than lying flat. */
function leafGeometry(length: number, width: number, serrated = false) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  if (serrated) {
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      shape.lineTo(
        Math.sin(t * Math.PI) * width * (i % 2 ? 0.42 : 0.54),
        t * length,
      );
    }
    for (let i = 11; i >= 0; i--) {
      const t = i / 12;
      shape.lineTo(
        -Math.sin(t * Math.PI) * width * (i % 2 ? 0.42 : 0.54),
        t * length,
      );
    }
  } else {
    shape.bezierCurveTo(
      width * 0.54,
      length * 0.04,
      width * 0.66,
      length * 0.56,
      0,
      length,
    );
    shape.bezierCurveTo(
      -width * 0.66,
      length * 0.56,
      -width * 0.54,
      length * 0.04,
      0,
      0,
    );
  }
  const geo = new THREE.ShapeGeometry(shape, 3);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i);
    p.setZ(
      i,
      0.16 * Math.sin((y / length) * Math.PI) * length - Math.abs(x) * 0.18,
    );
  }
  geo.computeVertexNormals();
  return geo;
}
export function blade(
  parent: THREE.Object3D,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  width: number,
  mat: THREE.Material,
  serrated = false,
) {
  const object = mesh(
    leafGeometry(length, width, serrated),
    mat,
    parent,
    origin,
  );
  object.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  return object;
}
