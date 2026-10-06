/** Moss species that can carpet the ground or grow over stone and wood. The
 * placeable mosses are separate assets; these name their looks. */
export const mossSpecies = ["sheet", "cushion", "fern", "java"] as const;
export type MossSpecies = (typeof mossSpecies)[number];
