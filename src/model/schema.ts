import { z } from "zod";
import { TERRAIN_POINTS, groundMaterials } from "./terrainData";
import { mossSpecies } from "./moss";

export const assetKinds = [
  "monstera",
  "swiss-cheese-plant",
  "fern",
  "strawberry",
  "bromeliad",
  "anthurium",
  "philodendron",
  "nest-fern",
  "calathea",
  "fittonia",
  "cattail",
  "grass",
  "amazon-sword",
  "vallisneria",
  "rotala",
  "anubias",
  "java-fern",
  "moss",
  "sheet-moss",
  "fern-moss",
  "java-moss",
  "rock",
  "wood",
  "branch",
  "log",
  "rock-shelter",
  "leaf-litter",
  "tree-frog",
  "dart-frog",
  "blue-dart-frog",
  "mossy-frog",
  "gecko",
  "snail",
  "turtle",
  "fish",
  "cardinal-tetra",
  "ember-tetra",
  "tiger-barb",
  "angelfish",
  "pearl-gourami",
  "rainbow-shark",
  "corydoras",
  "leopard-lizard",
  "desert-spiny-lizard",
  "fence-lizard",
  "canyon-tree-frog",
  "chorus-frog",
  "tiger-salamander",
  "chuckwalla",
  "desert-tortoise",
  "cutthroat-trout",
  "sculpin",
  "convict-cichlid",
  "harlequin-rasbora",
  "columbine",
  "spruce",
  "kinnikinnick",
  "prickly-pear",
  "barrel-cactus",
  "agave",
  "bunchgrass",
  "cryptocoryne",
  "begonia",
  "alocasia",
  "tree-philodendron",
  "hairgrass",
  "orchid",
  "water-lily",
  "hedgehog-cactus",
  "pupfish",
  "sandstone",
  "sandstone-ledge",
  "granite",
  "slate",
  "limestone",
  "pebbles",
  "flagstone",
  "scree",
  "sandstone-pillar",
  "limestone-pinnacle",
  "fungus-log",
  "snag",
  "tree-roots",
  "stump",
  "dead-tree",
  "ludwigia",
  "dwarf-sagittaria",
  "bolete",
  "fly-agaric",
  "bonnet-mushrooms",
  "vampire-crab",
  "stripe-tailed-scorpion",
  "desert-tarantula",
] as const;
export type AssetKind = (typeof assetKinds)[number];
export const MAX_OBJECTS = 120;
export const TANK_HEIGHT = 2.9;
export const AQUARIUM_WATER = TANK_HEIGHT - 0.25;
const finite = z.number().finite();
export const objectSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(assetKinds),
  x: finite.min(-10).max(10),
  z: finite.min(-10).max(10),
  rotation: finite.min(-100).max(100),
  scale: finite.min(0.4).max(2),
  seed: z.number().int().min(0).max(2147483647),
  life: z
    .object({
      age: finite.min(0),
      lifespan: finite.positive(),
      condition: finite.min(0).max(1),
      breeding: finite.min(0),
    })
    .optional(),
  // Additive version-1 data: moss grown over stone or wood, and the stone or
  // wood an object rests on, with its base this far above the ground.
  moss: z.enum(mossSpecies).optional(),
  support: z.string().min(1).max(100).optional(),
  lift: finite.min(0).max(4).optional(),
});
export type HabitatObject = z.infer<typeof objectSchema>;
export const environmentSchema = z.object({
  width: finite.min(5).max(9),
  depth: finite.min(3).max(6),
  substrate: finite.min(0.12).max(0.55),
  water: finite.min(0).max(AQUARIUM_WATER),
  light: z.enum(["day", "golden", "moon"]),
  warmth: finite.min(0).max(1).default(0.45),
  brightness: finite.min(0.4).max(1.6).default(1),
  // Additive version-1 data: older saves keep their original bank and palette.
  terrain: z
    .object({
      heights: z.array(finite.min(-0.9).max(0.9)).length(TERRAIN_POINTS),
      paint: z.array(z.enum(groundMaterials)).length(TERRAIN_POINTS),
    })
    .optional(),
});
export type Environment = z.infer<typeof environmentSchema>;
export const worldSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    environment: environmentSchema,
    objects: z.array(objectSchema).max(MAX_OBJECTS),
  })
  .superRefine((world, ctx) => {
    if (new Set(world.objects.map((o) => o.id)).size !== world.objects.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Every object must have a unique ID.",
      });
  });
export type World = z.infer<typeof worldSchema>;
export const defaultEnvironment: Environment = {
  width: 7,
  depth: 4.5,
  substrate: 0.25,
  water: 0.44,
  light: "day",
  warmth: 0.45,
  brightness: 1,
};
export function emptyWorld(): World {
  return {
    version: 1,
    name: "My little world",
    environment: { ...defaultEnvironment },
    objects: [],
  };
}
