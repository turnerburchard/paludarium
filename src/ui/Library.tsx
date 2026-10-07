import { useEffect, useRef, useState } from "react";
import { Leaf, Mountain, Bird, Plus } from "lucide-react";
import { catalog, type Category } from "../assets";
import type { Editor } from "../editor/useEditor";
import { loadThumbnails, type Thumbnails } from "../scene/thumbnails";
import { MAX_GROUND_HEIGHT } from "../model/terrain";
const categories: { name: Category; icon: typeof Leaf }[] = [
  { name: "Plants", icon: Leaf },
  { name: "Landscape", icon: Mountain },
  { name: "Animals", icon: Bird },
];
export function Library({
  editor,
  hidden,
  sheetOpen,
}: {
  editor: Editor;
  hidden: boolean;
  sheetOpen: boolean;
}) {
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const visible = !hidden && (!mobile || sheetOpen);
  const [category, setCategory] = useState<Category>("Plants");
  const [thumbnails, setThumbnails] = useState<Thumbnails>({});
  const available = catalog.filter(
    (asset) =>
      editor.world.environment.water <= MAX_GROUND_HEIGHT ||
      (asset.habitat !== "land" && !asset.soil),
  );
  const activeCategory = available.some((asset) => asset.category === category)
    ? category
    : available[0]?.category;
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        const kinds = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => {
            observer.unobserve(entry.target);
            return catalog.find(
              (asset) => asset.kind === entry.target.getAttribute("data-kind"),
            )!.kind;
          });
        if (kinds.length)
          void loadThumbnails(kinds, controller.signal).then((loaded) => {
            if (!controller.signal.aborted)
              setThumbnails((current) => ({ ...current, ...loaded }));
          });
      },
      { rootMargin: "80px" },
    );
    grid.current
      ?.querySelectorAll("[data-kind]")
      .forEach((card) => observer.observe(card));
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [activeCategory, editor.world.environment.water, visible]);
  return (
    <>
      <div className="category-tabs" aria-label="Object categories">
        {categories
          .filter(({ name }) =>
            available.some((asset) => asset.category === name),
          )
          .map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={activeCategory === name ? "active" : ""}
              onClick={() => setCategory(name)}
              aria-pressed={activeCategory === name}
            >
              <Icon size={17} />
              <span>{name}</span>
            </button>
          ))}
      </div>
      <div className="asset-grid" ref={grid}>
        {available
          .filter((a) => a.category === activeCategory)
          .map((asset) => (
            <button
              key={asset.kind}
              data-kind={asset.kind}
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
    </>
  );
}
