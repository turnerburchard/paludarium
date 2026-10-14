import { useEffect, useRef, useState } from "react";
import { disposeAsset } from "../assets";
import type { World } from "../model/schema";
import { runInBatches } from "../work";
import { showSplash } from "../ui/splash";
import { prepareWorld, type PreparedWorld } from "./prepareWorld";

/** Opening a library entry prepares a fresh scene. Edits keep the live engine. */
export function useWorldPreparation(id: string, world: World) {
  const opening = useRef({ id, world });
  if (opening.current.id !== id) opening.current = { id, world };
  const request = opening.current;
  const [ready, setReady] = useState<{
    id: string;
    prepared: PreparedWorld;
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (error) throw error;

  useEffect(() => {
    showSplash();
    let prepared: PreparedWorld | undefined;
    const cancel = runInBatches(
      prepareWorld(request.world),
      (result) => {
        prepared = result;
        setReady({ id: request.id, prepared });
      },
      setError,
    );
    return () => {
      cancel();
      prepared?.models.forEach(disposeAsset);
    };
  }, [request]);

  return ready;
}
