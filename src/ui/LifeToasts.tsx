import { useEffect, useRef, useState } from "react";
import { Eye, Feather, Hourglass, Leaf, Sprout } from "lucide-react";
import type { LogEntry, World } from "../model/schema";
import { describe } from "./lifeEvents";

const icons = {
  born: Sprout,
  "grew-up": Leaf,
  "grew-old": Hourglass,
  died: Feather,
};

/** How long each toast stays up. */
const SHOWN_FOR = 6000;

interface Toast {
  entry: LogEntry;
  text: string;
}

/** Births, growing up, old age and deaths as they happen. Opening another
 * world brings its log with it, so only entries from the last few seconds
 * are news. */
export function LifeToasts({
  world,
  onWatch,
}: {
  world: World;
  onWatch: (id: string) => void;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const last = useRef(world);
  useEffect(() => {
    const previous = last.current;
    last.current = world;
    const seen = new Set(previous.log);
    // A dead animal's name is only in the world before it died.
    const nameOf = (id?: string) =>
      [...world.objects, ...previous.objects].find((o) => o.id === id)?.name;
    const fresh = (world.log ?? [])
      .filter(
        (entry) =>
          !seen.has(entry) &&
          entry.cause !== "killed" &&
          Date.now() - entry.at < SHOWN_FOR,
      )
      .map((entry) => ({ entry, text: describe(entry, nameOf(entry.id)) }));
    if (fresh.length) setToasts((toasts) => [...toasts, ...fresh]);
  }, [world]);

  if (!toasts.length) return null;
  return (
    <ol className="life-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <LifeToast
          key={`${toast.entry.at}:${toast.entry.id}:${toast.entry.event}`}
          toast={toast}
          canWatch={world.objects.some((o) => o.id === toast.entry.id)}
          onWatch={onWatch}
          onDone={() =>
            setToasts((toasts) => toasts.filter((t) => t !== toast))
          }
        />
      ))}
    </ol>
  );
}

function LifeToast({
  toast,
  canWatch,
  onWatch,
  onDone,
}: {
  toast: Toast;
  canWatch: boolean;
  onWatch: (id: string) => void;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_FOR);
    return () => clearTimeout(timer);
    // Each toast times out once, however often the list re-renders.
  }, []);
  const Icon = icons[toast.entry.event];
  return (
    <li>
      <Icon size={13} aria-hidden />
      {toast.text}
      {canWatch && (
        <button
          aria-label="Watch"
          title="Watch"
          onClick={() => onWatch(toast.entry.id!)}
        >
          <Eye size={13} />
        </button>
      )}
    </li>
  );
}
