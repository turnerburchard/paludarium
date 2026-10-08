import { useRef, useState } from "react";
import type { Editor } from "../editor/useEditor";
import { MAX_WORLD_SIZE, parseWorld } from "../editor/persistence";

/** Render the input once so importing creates a saved world from any menu. */
export function useWorldFiles(editor: Editor, onCreated: () => void) {
  const [importError, setImportError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_WORLD_SIZE)
        throw new Error("This file is too large for a terrarium.");
      if (editor.createWorld(parseWorld(await file.text()))) {
        onCreated();
      }
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not import this file.",
      );
    }
    if (input.current) input.current.value = "";
  }

  return {
    importError,
    importWorld: () => {
      setImportError("");
      input.current?.click();
    },
    fileInput: (
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
    ),
  };
}
