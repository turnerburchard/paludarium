import type { AssetKind } from "./schema";
export type Category = "All" | "Plants" | "Landscape" | "Animals";
export interface AssetDefinition {
  kind: AssetKind;
  name: string;
  scientificName?: string;
  category: Exclude<Category, "All">;
  description: string;
  radius: number;
  habitat: "land" | "water" | "either";
}
export const catalog: readonly AssetDefinition[] = [
  {
    kind: "tree-frog",
    name: "Red-eyed tree frog",
    scientificName: "Agalychnis callidryas",
    category: "Animals",
    description:
      "A green canopy frog with scarlet eyes, striped flanks, and orange toe pads.",
    radius: 0.24,
    habitat: "land",
  },
  {
    kind: "dart-frog",
    name: "Strawberry poison frog",
    scientificName: "Oophaga pumilio",
    category: "Animals",
    description:
      "A small Central American frog, shown in a red and blue-legged color form.",
    radius: 0.2,
    habitat: "land",
  },
  {
    kind: "blue-dart-frog",
    name: "Blue poison dart frog",
    scientificName: "Dendrobates tinctorius · azureus morph",
    category: "Animals",
    description:
      "Cobalt skin with individual dark spots. A striking forest-floor frog.",
    radius: 0.26,
    habitat: "land",
  },
  {
    kind: "mossy-frog",
    name: "Vietnamese mossy frog",
    scientificName: "Theloderma corticale",
    category: "Animals",
    description:
      "A squat, rough-skinned frog with moss-like green and brown camouflage.",
    radius: 0.28,
    habitat: "land",
  },
  {
    kind: "monstera",
    name: "Monstera",
    scientificName: "Monstera deliciosa",
    category: "Plants",
    description: "Big split leaves for a lush tropical canopy.",
    radius: 0.48,
    habitat: "land",
  },
  {
    kind: "fern",
    name: "Forest fern",
    category: "Plants",
    description: "Arching fronds, at home beside a shady pond.",
    radius: 0.36,
    habitat: "land",
  },
  {
    kind: "strawberry",
    name: "Wild strawberry",
    scientificName: "Fragaria vesca",
    category: "Plants",
    description: "A mountain garden with white flowers and red berries.",
    radius: 0.34,
    habitat: "land",
  },
  {
    kind: "bromeliad",
    name: "Scarlet star",
    scientificName: "Guzmania lingulata",
    category: "Plants",
    description: "A splash of coral among deep green leaves.",
    radius: 0.32,
    habitat: "land",
  },
  {
    kind: "grass",
    name: "Sedge",
    category: "Plants",
    description: "Soft grassy tufts for the edge of the water.",
    radius: 0.24,
    habitat: "land",
  },
  {
    kind: "moss",
    name: "Moss cushion",
    category: "Landscape",
    description: "A soft patch of green to tuck between stones.",
    radius: 0.4,
    habitat: "land",
  },
  {
    kind: "rock",
    name: "River stone",
    category: "Landscape",
    description:
      "Weathered stone. Vary its size and turn for a natural arrangement.",
    radius: 0.42,
    habitat: "either",
  },
  {
    kind: "wood",
    name: "Driftwood",
    category: "Landscape",
    description: "A branching piece of wood for the forest floor.",
    radius: 0.52,
    habitat: "either",
  },
  {
    kind: "fish",
    name: "Pond fish",
    category: "Animals",
    description: "A small golden fish. Place it in the open water.",
    radius: 0.18,
    habitat: "water",
  },
];
export const assets = Object.fromEntries(
  catalog.map((item) => [item.kind, item]),
) as Record<AssetKind, AssetDefinition>;
