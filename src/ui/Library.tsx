import { useState } from "react";
import { Plus, ListFilter } from "lucide-react";
import {
  catalog,
  categoryOf,
  groupCategories,
  livesIn,
  prebuiltLivesIn,
  type Category,
  type Group,
} from "../assets";
import type { Editor } from "../editor/useEditor";
import { thumbnails } from "../scene/thumbnails";
import { hasDryGround } from "../model/water";
import { prebuilts } from "../model/prebuilts";
import { LibraryFilter, type Place } from "./LibraryFilter";
const categories: Category[] = ["Plants", "Animals", "Hardscape"];
export function Library({ editor }: { editor: Editor }) {
  const [category, setCategory] = useState<Category>("Plants");
  const dryGround = hasDryGround(editor.world.environment);
  const available = catalog.filter(
    (asset) => dryGround || (asset.habitat !== "land" && !asset.soil),
  );
  const availablePrebuilts = prebuilts.filter((prebuilt) =>
    prebuilt.pieces.every((piece) =>
      available.some((asset) => asset.kind === piece.kind),
    ),
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
  if (activeCategory === "Hardscape" && availablePrebuilts.length)
    groups.push("Prebuilt");
  const activeGroups = chosenGroups.filter((group) => groups.includes(group));
  const shown = available.filter(
    (asset) =>
      categoryOf(asset) === activeCategory &&
      (places.length === 0 || places.some((place) => livesIn(asset, place))) &&
      (activeGroups.length === 0 || activeGroups.includes(asset.group)),
  );
  const shownPrebuilts = availablePrebuilts.filter(
    (prebuilt) =>
      activeCategory === "Hardscape" &&
      (places.length === 0 ||
        places.some((place) => prebuiltLivesIn(prebuilt, place))) &&
      (activeGroups.length === 0 || activeGroups.includes("Prebuilt")),
  );
  const filterCount = places.length + activeGroups.length;
  const clearFilters = () => {
    setPlaces([]);
    setChosenGroups([]);
  };
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
      {shown.length === 0 && shownPrebuilts.length === 0 && (
        <p className="library-empty">
          Nothing here matches.{" "}
          <button onClick={clearFilters}>Clear filters</button>
        </p>
      )}
      <div className="asset-grid">
        {shownPrebuilts.length > 0 && (
          <>
            <h3 className="asset-heading">Prebuilt</h3>
            {shownPrebuilts.map((prebuilt) => (
              <Card
                key={prebuilt.id}
                id={`prebuilt:${prebuilt.id}`}
                name={prebuilt.name}
                description={prebuilt.description}
                chosen={
                  editor.tool.type === "prebuilt" &&
                  editor.tool.prebuilt.id === prebuilt.id
                }
                onChoose={() => editor.choosePrebuilt(prebuilt)}
              />
            ))}
            {shown.length > 0 && <h3 className="asset-heading">Pieces</h3>}
          </>
        )}
        {shown.map((asset) => (
          <Card
            key={asset.kind}
            id={asset.kind}
            name={asset.name}
            description={asset.description}
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
  chosen,
  onChoose,
}: {
  id: string;
  name: string;
  description: string;
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
          <img
            src={thumbnails[id]}
            alt=""
            draggable={false}
            loading="lazy"
            width={160}
            height={130}
          />
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
