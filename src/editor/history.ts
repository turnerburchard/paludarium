import type { World } from "../model/schema";
export interface History {
  past: World[];
  present: World;
  future: World[];
}
export type HistoryAction =
  | { type: "commit"; world: World }
  | { type: "simulate"; base: World; world: World }
  | { type: "undo" }
  | { type: "redo" };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "simulate") {
    return state.present === action.base
      ? { ...state, present: action.world }
      : state;
  }
  if (action.type === "commit") {
    if (JSON.stringify(action.world) === JSON.stringify(state.present))
      return state;
    return {
      past: [...state.past, state.present].slice(-60),
      present: action.world,
      future: [],
    };
  }
  if (action.type === "undo" && state.past.length)
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  if (action.type === "redo" && state.future.length)
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  return state;
}
