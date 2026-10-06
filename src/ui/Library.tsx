import { useEffect, useState } from "react";
import { Leaf, Mountain, Bird, Grid2X2, Plus } from "lucide-react";
import { catalog, type Category } from "../model/catalog";
import type { AssetKind } from "../model/schema";
import type { Editor } from "../editor/useEditor";
import { makeThumbnails } from "../scene/thumbnails";
const categories: { name: Category; icon: typeof Leaf }[] = [
  { name: "All", icon: Grid2X2 },
  { name: "Plants", icon: Leaf },
  { name: "Landscape", icon: Mountain },
  { name: "Animals", icon: Bird },
];
export function Library({ editor }: { editor: Editor }) {
  const [category, setCategory] = useState<Category>("All");
  const [thumbnails, setThumbnails] = useState<
    Partial<Record<AssetKind, string>>
  >({});
  useEffect(() => {
    const id = setTimeout(() => setThumbnails(makeThumbnails()), 80);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <div className="category-tabs" aria-label="Object categories">
        {categories.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={category === name ? "active" : ""}
            onClick={() => setCategory(name)}
            aria-pressed={category === name}
          >
            <Icon size={17} />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <div className="asset-grid">
        {catalog
          .filter((a) => category === "All" || a.category === category)
          .map((asset) => (
            <button
              key={asset.kind}
              className={`asset-card ${editor.tool.type === "place" && editor.tool.kind === asset.kind ? "chosen" : ""}`}
              onClick={() => editor.choose(asset.kind)}
              title={asset.description}
              aria-pressed={
                editor.tool.type === "place" && editor.tool.kind === asset.kind
              }
            >
              <span className="asset-picture">
                {thumbnails[asset.kind] && (
                  <img src={thumbnails[asset.kind]} alt="" draggable={false} />
                )}
                <span className="asset-add">
                  <Plus size={13} />
                </span>
              </span>
              <span className="asset-name">{asset.name}</span>
            </button>
          ))}
      </div>
      <p className="library-note">Choose something. Find its little place.</p>
    </>
  );
}
