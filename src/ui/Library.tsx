import { useEffect, useRef, useState } from "react";
import { Leaf, Mountain, Bird, Plus, ListFilter } from "lucide-react";
import {
  catalog,
  categoryOf,
  groupCategories,
  livesIn,
  type Category,
  type Group,
} from "../assets";
import type { Editor } from "../editor/useEditor";
import { loadThumbnails, type Thumbnails } from "../scene/thumbnails";
import { hasDryGround } from "../model/terrain";
import { LibraryFilter, type Place } from "./LibraryFilter";
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
  const dryGround = hasDryGround(editor.world.environment);
  const available = catalog.filter(
    (asset) => dryGround || (asset.habitat !== "land" && !asset.soil),
  );
  const activeCategory = available.some(
    (asset) => categoryOf(asset) === category,
  )
    ? category
    : available[0] && categoryOf(available[0]);
  const [filtering, setFiltering] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  // Chosen groups from other tabs are kept for when the person comes back.
  const [chosenGroups, setChosenGroups] = useState<Group[]>([]);
  const groups = [...new Set(available.map((asset) => asset.group))].filter(
    (group) => groupCategories[group] === activeCategory,
  );
  const activeGroups = chosenGroups.filter((group) => groups.includes(group));
  const shown = available.filter(
    (asset) =>
      categoryOf(asset) === activeCategory &&
      (places.length === 0 || places.some((place) => livesIn(asset, place))) &&
      (activeGroups.length === 0 || activeGroups.includes(asset.group)),
  );
  const filterCount = places.length + activeGroups.length;
  const clearFilters = () => {
    setPlaces([]);
    setChosenGroups([]);
  };
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
  }, [activeCategory, dryGround, visible, places, chosenGroups]);
  return (
    <>
      <div className="category-tabs" aria-label="Object categories">
        {categories
          .filter(({ name }) =>
            available.some((asset) => categoryOf(asset) === name),
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
        <button
          className={filterCount ? "filtered" : ""}
          onClick={() => setFiltering(true)}
          aria-label="Filter objects"
        >
          <ListFilter size={17} />
          <span>{filterCount ? `Filter · ${filterCount}` : "Filter"}</span>
        </button>
      </div>
      {filtering && (
        <LibraryFilter
          groups={groups}
          chosenPlaces={places}
          chosenGroups={activeGroups}
          onTogglePlace={(place) => setPlaces(toggle(places, place))}
          onToggleGroup={(group) =>
            setChosenGroups(toggle(chosenGroups, group))
          }
          onClear={clearFilters}
          onClose={() => setFiltering(false)}
        />
      )}
      {shown.length === 0 && (
        <p className="library-empty">
          Nothing here matches.{" "}
          <button onClick={clearFilters}>Clear filters</button>
        </p>
      )}
      <div className="asset-grid" ref={grid}>
        {shown.map((asset) => (
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

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((other) => other !== item)
    : [...items, item];
}
