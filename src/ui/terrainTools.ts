import type { TerrainMode } from "../model/terrainBrush";

export const terrainTools: {
  mode: TerrainMode;
  label: string;
  description: string;
}[] = [
  {
    mode: "raise",
    label: "Raise ground",
    description:
      "Build up hills gradually. Repeated passes raise the ground further.",
  },
  {
    mode: "lower",
    label: "Lower ground",
    description:
      "Dig down gradually. Ground below the water level becomes flooded.",
  },
  {
    mode: "smooth",
    label: "Smooth ground",
    description:
      "Soften steep hills and holes by blending neighboring heights.",
  },
  {
    mode: "soil",
    label: "Paint soil",
    description:
      "Cover the ground with soil color without changing its height.",
  },
  {
    mode: "sand",
    label: "Paint sand",
    description:
      "Cover the ground with sand color without changing its height.",
  },
  {
    mode: "stone",
    label: "Paint stone",
    description:
      "Cover the ground with stone color without adding rocks or changing its height.",
  },
  {
    mode: "moss",
    label: "Paint moss",
    description: "Grow a low moss carpet that follows dry ground.",
  },
];
