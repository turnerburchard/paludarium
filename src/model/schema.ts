import { z } from "zod";
import {
  groundMaterials,
  terrainPointCount,
  DEFAULT_TANK_HEIGHT,
  MIN_TANK_HEIGHT,
  MAX_TANK_HEIGHT,
  waterCeiling,
} from "./terrainData";
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
  "quaternius-boulder",
  "quaternius-outcrop",
  "quaternius-crag",
  "quaternius-wedge",
  "quaternius-dome",
  "quaternius-block",
  "quaternius-ledge",
  "wood",
  "branch",
  "log",
  "root-arch",
  "forked-branch",
  "spiderwood",
  "standing-stone",
  "capstone",
  "leaf-litter",
  "tree-frog",
  "dart-frog",
  "blue-dart-frog",
  "golden-mantella",
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
  "western-toad",
  "horned-frog",
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
  "peace-lily",
  "tree-philodendron",
  "hairgrass",
  "orchid",
  "water-lily",
  "hedgehog-cactus",
  "saguaro",
  "organ-pipe",
  "beavertail",
  "cholla",
  "pupfish",
  "sandstone",
  "sandstone-ledge",
  "granite",
  "slate",
  "limestone",
  "pebbles",
  "flagstone",
  "scree",
  "cobble",
  "stone-block",
  "stone-slab",
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
  "chicken-of-the-woods",
  "vampire-crab",
  "stripe-tailed-scorpion",
  "desert-tarantula",
  "micro-crab",
  "dwarf-crayfish",
  "cherry-shrimp",
  "european-tree-frog",
] as const;
export type AssetKind = (typeof assetKinds)[number];
export const MAX_OBJECTS = 250;
export const MAX_TANK_WIDTH = 24;
export const MAX_TANK_DEPTH = 14;
export const TANK_HEIGHT = DEFAULT_TANK_HEIGHT;
export const AQUARIUM_WATER = waterCeiling({ height: TANK_HEIGHT });
const finite = z.number().finite();
export const MAX_SCALE = 2;
export const objectSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(assetKinds),
  x: finite.min(-MAX_TANK_WIDTH / 2).max(MAX_TANK_WIDTH / 2),
  z: finite.min(-MAX_TANK_DEPTH / 2).max(MAX_TANK_DEPTH / 2),
  rotation: finite.min(-100).max(100),
  scale: finite.min(0.4).max(MAX_SCALE),
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
export const environmentSchema = z
  .object({
    width: finite.min(5).max(MAX_TANK_WIDTH),
    depth: finite.min(3).max(MAX_TANK_DEPTH),
    height: finite
      .min(MIN_TANK_HEIGHT)
      .max(MAX_TANK_HEIGHT)
      .default(DEFAULT_TANK_HEIGHT),
    substrate: finite.min(0.12).max(0.55),
    water: finite.min(0).max(waterCeiling({ height: MAX_TANK_HEIGHT })),
    light: z.enum(["day", "golden", "moon"]),
    warmth: finite.min(0).max(1).default(0.45),
    brightness: finite.min(0.4).max(1.6).default(1),
    // Additive version-1 data: older saves keep their original bank and palette.
    terrain: z
      .object({
        columns: z.number().int().min(1).max(200),
        rows: z.number().int().min(1).max(200),
        heights: z.array(finite.min(-0.9).max(MAX_TANK_HEIGHT)),
        paint: z.array(z.enum(groundMaterials)),
      })
      .refine(
        (terrain) =>
          terrain.heights.length === terrainPointCount(terrain) &&
          terrain.paint.length === terrainPointCount(terrain),
        { message: "Terrain must have a point for every grid crossing." },
      )
      .optional(),
  })
  .refine((env) => env.water <= waterCeiling(env), {
    message: "Water must stay below the tank rim.",
    path: ["water"],
  });
export type Environment = z.infer<typeof environmentSchema>;
/** Births and deaths, oldest first. Only the most recent are kept. */
export const LOG_LENGTH = 100;
const logEntrySchema = z.object({
  /** Epoch milliseconds. */
  at: finite.min(0),
  event: z.enum(["born", "died"]),
  kind: z.enum(assetKinds),
  cause: z
    .enum(["age", "starved", "crowded", "drowned", "stranded", "killed"])
    .optional(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
export const worldSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    environment: environmentSchema,
    objects: z.array(objectSchema).max(MAX_OBJECTS),
    // Additive version-1 data.
    log: z.array(logEntrySchema).max(LOG_LENGTH).optional(),
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
  height: DEFAULT_TANK_HEIGHT,
  substrate: 0.25,
  water: 0.44,
  light: "day",
  warmth: 0.45,
  brightness: 1,
};
export function emptyWorld(): World {
  return {
    version: 1,
    name: "Untitled",
    environment: { ...defaultEnvironment },
    objects: [],
  };
}
