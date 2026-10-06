import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { assets, isFrog } from "../assets";
import { STORAGE_KEY } from "../editor/persistence";
import type { AssetKind, World } from "../model/schema";
import { IconButton } from "./IconButton";

const DONE_KEY = "paludarium:first-steps-done";

/** Only first-time visitors get the guide: no saved world and never finished it. */
export function isFirstVisit(): boolean {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) === null &&
      localStorage.getItem(DONE_KEY) === null
    );
  } catch {
    return false;
  }
}

function rememberDone() {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* Without storage the guide simply shows again next visit. */
  }
}

/** A short checklist that walks a new visitor through a first living habitat. */
export function FirstSteps({
  world,
  watched,
  onFinish,
}: {
  world: World;
  watched: boolean;
  onFinish: (completed: boolean) => void;
}) {
  const has = (test: (kind: AssetKind) => boolean) =>
    world.objects.some((o) => test(o.kind));
  const steps = [
    {
      label: "Plant something green",
      done: has((kind) => assets[kind].category === "Plants"),
    },
    {
      label: "Add moss, a stone or driftwood for cover",
      done: has((kind) => assets[kind].category === "Landscape"),
    },
    { label: "Add a frog", done: has(isFrog) },
    { label: "Select your frog and watch it up close", done: watched },
  ];
  const complete = steps.every((step) => step.done);

  useEffect(() => {
    if (!complete) return;
    rememberDone();
    onFinish(true);
  }, [complete]);

  return (
    <aside className="first-steps" aria-label="First habitat">
      <div className="first-steps-heading">
        <span className="eyebrow">YOUR FIRST HABITAT</span>
        <IconButton
          label="Hide these tips"
          onClick={() => {
            rememberDone();
            onFinish(false);
          }}
        >
          <X size={15} />
        </IconButton>
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step.label} className={step.done ? "done" : ""}>
            <span className="first-steps-mark">
              {step.done && <Check size={11} />}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    </aside>
  );
}
