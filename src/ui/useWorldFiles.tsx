import { useRef } from "react";
import type { Editor } from "../editor/useEditor";
import {
  downloadWorld,
  MAX_WORLD_SIZE,
  parseWorld,
} from "../editor/persistence";

/** Export and import of world files, shared by every place that offers them.
 * Render `fileInput` once; `importWorld` opens its file picker. */
export function useWorldFiles(editor: Editor) {
  const input = useRef<HTMLInputElement>(null);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_WORLD_SIZE)
        throw new Error("This file is too large for a terrarium.");
      editor.replaceWorld(parseWorld(await file.text()));
      editor.notify("World imported.");
    } catch (error) {
      editor.notify(
        error instanceof Error ? error.message : "Could not import this file.",
      );
    }
    if (input.current) input.current.value = "";
  }

  return {
    exportWorld: () => downloadWorld(editor.world),
    importWorld: () => input.current?.click(),
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
