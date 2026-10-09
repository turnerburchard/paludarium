import { useEffect, useRef, useState } from "react";
import { Plus, ListFilter } from "lucide-react";
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
import { prebuilts } from "../model/prebuilts";
import { LibraryFilter, type Place } from "./LibraryFilter";
const categories: Category[] = ["Plants", "Landscape", "Animals"];
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
        const keys = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => {
            observer.unobserve(entry.target);
            return entry.target.getAttribute("data-kind")!;
          });
        if (keys.length)
          void loadThumbnails(keys, controller.signal).then((loaded) => {
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
          .filter((name) =>
            available.some((asset) => categoryOf(asset) === name),
          )
          .map((name) => (
            <button
              key={name}
              className={activeCategory === name ? "active" : ""}
              onClick={() => setCategory(name)}
              aria-pressed={activeCategory === name}
            >
              {name}
            </button>
          ))}
        <button
          className={`category-filter ${filterCount ? "filtered" : ""}`}
          onClick={() => setFiltering(true)}
          aria-label="Filter objects"
        >
          <ListFilter size={16} />
          {filterCount > 0 && filterCount}
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
        {/* Prebuilts lead the landscape, unless filters narrow it down. */}
        {activeCategory === "Landscape" && filterCount === 0 && (
          <>
            <h3 className="asset-heading">Prebuilt</h3>
            {prebuilts.map((prebuilt) => (
              <Card
                key={prebuilt.id}
                id={`prebuilt:${prebuilt.id}`}
                name={prebuilt.name}
                description={prebuilt.description}
                thumbnails={thumbnails}
                chosen={
                  editor.tool.type === "prebuilt" &&
                  editor.tool.prebuilt.id === prebuilt.id
                }
                onChoose={() => editor.choosePrebuilt(prebuilt)}
              />
            ))}
            <h3 className="asset-heading">Pieces</h3>
          </>
        )}
        {shown.map((asset) => (
          <Card
            key={asset.kind}
            id={asset.kind}
            name={asset.name}
            description={asset.description}
            thumbnails={thumbnails}
            chosen={
              editor.tool.type === "place" && editor.tool.kind === asset.kind
            }
            onChoose={() => editor.choose(asset.kind)}
          />
        ))}
      </div>
    </>
  );
}

/** A library entry; `id` also names its thumbnail. */
function Card({
  id,
  name,
  description,
  thumbnails,
  chosen,
  onChoose,
}: {
  id: string;
  name: string;
  description: string;
  thumbnails: Thumbnails;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      data-kind={id}
      className={`asset-card ${chosen ? "chosen" : ""}`}
      onClick={onChoose}
      title={description}
      aria-pressed={chosen}
    >
      <span className="asset-picture">
        {thumbnails[id] && (
          <img src={thumbnails[id]} alt="" draggable={false} />
        )}
        <span className="asset-add">
          <Plus size={13} />
        </span>
      </span>
      <span className="asset-name">{name}</span>
    </button>
  );
}

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((other) => other !== item)
    : [...items, item];
}
