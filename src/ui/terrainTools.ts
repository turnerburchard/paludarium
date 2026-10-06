import type { TerrainMode } from "../model/terrainBrush";

export const terrainTools: { mode: TerrainMode; label: string }[] = [
  { mode: "raise", label: "Raise ground" },
  { mode: "lower", label: "Lower ground" },
  { mode: "smooth", label: "Smooth ground" },
  { mode: "soil", label: "Paint soil" },
  { mode: "sand", label: "Paint sand" },
  { mode: "stone", label: "Paint stone" },
  { mode: "moss", label: "Paint moss" },
  { mode: "pool", label: "Carve pool" },
  { mode: "stream", label: "Carve stream" },
];
