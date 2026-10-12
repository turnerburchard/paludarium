import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { TerrainMode } from "../model/terrainBrush";
import { paintColors } from "../scene/groundSurface";
import { CARPET_GREENS } from "../scene/groundMoss";

export interface TerrainTool {
  mode: TerrainMode;
  /** Short enough for a tile; `label` is the full name. */
  name: string;
  label: string;
  description: string;
}

export const shapeTools: (TerrainTool & { Icon: LucideIcon })[] = [
  {
    mode: "raise",
    name: "Raise",
    label: "Raise ground",
    description:
      "Build up hills gradually. Repeated passes raise the ground further.",
    Icon: ArrowUpFromLine,
  },
  {
    mode: "lower",
    name: "Lower",
    label: "Lower ground",
    description:
      "Dig down gradually. Ground below the water level becomes flooded.",
    Icon: ArrowDownToLine,
  },
  {
    mode: "smooth",
    name: "Smooth",
    label: "Smooth ground",
    description:
      "Soften steep hills and holes by blending neighboring heights.",
    Icon: Waves,
  },
];

export const paintTools: (TerrainTool & { color: string })[] = [
  {
    mode: "soil",
    name: "Soil",
    label: "Paint soil",
    description:
      "Cover the ground with soil color without changing its height.",
    color: paintColors.soil,
  },
  {
    mode: "sand",
    name: "Sand",
    label: "Paint sand",
    description:
      "Cover the ground with sand color without changing its height.",
    color: paintColors.sand,
  },
  {
    mode: "stone",
    name: "Stone",
    label: "Paint stone",
    description:
      "Cover the ground with stone color without adding rocks or changing its height.",
    color: paintColors.stone,
  },
  {
    mode: "moss",
    name: "Moss",
    label: "Paint moss",
    description: "Grow a low moss carpet that follows dry ground.",
    color: CARPET_GREENS[0],
  },
];

export const terrainTools: TerrainTool[] = [...shapeTools, ...paintTools];
