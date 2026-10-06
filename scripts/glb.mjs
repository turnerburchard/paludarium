/** Shared helpers for baking downloaded GLB models into the plain data that
 * asset factories build from synchronously. */
import { inflateSync } from "node:zlib";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Parses a GLB in Node. Textures are dropped before parsing, since Node has
 * no image decoder; `palette` reads them back where a model needs them. */
export async function loadGlb(source) {
  const length = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + length).toString());
  const binary = source.subarray(20 + length + 8);
  const images = (json.images ?? []).map((image) => {
    const view = json.bufferViews[image.bufferView];
    const offset = view.byteOffset ?? 0;
    return binary.subarray(offset, offset + view.byteLength);
  });
  for (const material of json.materials ?? [])
    delete material.pbrMetallicRoughness?.baseColorTexture;
  delete json.images;
  delete json.textures;
  delete json.samplers;
  const stripped = JSON.stringify(json);
  // GLB chunks are padded to four bytes with spaces.
  const text = Buffer.from(
    stripped.padEnd(Math.ceil(stripped.length / 4) * 4, " "),
  );
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + source.length - (20 + length), 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, text, source.subarray(20 + length)]);
  const gltf = await new GLTFLoader().parseAsync(
    glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  return { gltf, images };
}

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG into a color lookup by
 * texture coordinate, as palette textures are. */
export function palette(png) {
  let offset = 8;
  let width = 0,
    height = 0,
    channels = 0;
  const data = [];
  while (offset < png.length) {
    const size = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + size);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      channels = { 2: 3, 6: 4 }[chunk[9]];
      if (chunk[8] !== 8 || !channels || chunk[12] !== 0)
        throw new Error("Only 8-bit RGB(A) non-interlaced PNGs are supported.");
    } else if (type === "IDAT") data.push(chunk);
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const corner =
        x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      const predicted = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, corner),
      ][filter];
      pixels[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  return (u, v) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
    const i = y * stride + x * channels;
    return (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  };
}

function paeth(left, up, corner) {
  const p = left + up - corner;
  const toLeft = Math.abs(p - left),
    toUp = Math.abs(p - up),
    toCorner = Math.abs(p - corner);
  if (toLeft <= toUp && toLeft <= toCorner) return left;
  if (toUp <= toCorner) return up;
  return corner;
}
