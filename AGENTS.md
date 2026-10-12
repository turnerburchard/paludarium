# Working on Paludarium

Instructions for coding agents (Claude, Codex) and humans alike. `CLAUDE.md` points here.

Paludarium is a browser terrarium sandbox: build a planted habitat, add frogs and fish, and watch them live. React + TypeScript + React Three Fiber, bundled with Vite, deployed as a static site to https://paludarium.turnerburchard.com/ on every push to `main`.

## Commands

```sh
npm ci
npm run dev            # http://localhost:5173
npm test               # Vitest unit tests
npm run build          # typecheck (tsc -b) + production build
npm run format         # Prettier
npm run test:e2e        # quick Playwright smoke against dist/ (build first)
npm run test:e2e:full   # deeper desktop, terrain, touch and sharing regression flows
npm run screenshot     # renders presets at desktop and phone sizes into screenshots/
```

Before every push run `npm run format:check && npm test && npm run build && npm run test:e2e`. CI runs the same checks and only deploys when they pass. It runs each `test:e2e` file as its own parallel job, so a new quick browser file also goes in the matrix in `.github/workflows/ci.yml`.

Run `npm run test:e2e:full` when changing editing gestures, camera behavior, terrain or sharing, or run the relevant individual flow during development. The longer suite is also available through CI's manual **full_browser_checks** option. Install Playwright Chromium once with `npx playwright install chromium`; `CHROMIUM_PATH` can select a system Chromium locally.

## Code quality

This matters more than speed. The owner reads the code and wants it to look like a careful human wrote it.

- Simple and readable over clever. Plain names, small functions, obvious data flow.
- No speculative abstraction, defensive boilerplate, or "just in case" options. Delete code rather than add layers.
- Comments explain *why*, not *what*. Most lines need none.
- Fix root causes. Don't silence warnings, widen types, or add `as` casts to make errors go away.
- Match the surrounding style. Prettier owns formatting.
- Leave things cleaner than you found them, but keep each commit focused on one change.

## Architecture

- `src/model/`: the save format (Zod schema), terrain math, presets. Pure data and functions, no React or rendering code.
- `src/assets/`: one definition per placeable thing (plant, rock, frog, fish): its catalog info, traits, and how to build its 3D model. Adding an asset means adding one file here and registering it.
- `src/editor/`: editing commands, undo/redo history, persistence.
- `src/simulation/`: animal needs and behavior. Owns state; the renderer only reads it.
- `src/scene/`: React Three Fiber components that render the world.
- `src/ui/`: panels, toolbars, dialogs.

Rules that keep this working:

- `groundHeight` is the single source of truth for terrain: rendering, placement, navigation all use it.
- World objects are plain serializable data with a seed. Never store Three.js objects in the model.
- Simulation randomness goes through an injected random source so behavior is testable.
- Saves, files and share links (kept for good on the share server) outlive the code that wrote them. A change old worlds can't pass needs a migration: bump `WORLD_VERSION` and add a step in `src/model/migrations.ts`, with a unit test that opens a world saved at the old version. Never edit or remove a shipped step.
- Never remove an asset kind from `assetKinds`. Old worlds that name it would stop loading. Hide it from the library, or add a migration step that swaps it for another kind.
- Dropping saves (bumping the storage key, now `little-worlds:v4`) is a last resort that needs the owner's OK.

## Testing

- Put logic in plain functions and cover it with Vitest unit tests in `tests/`. Filters, simulation rules, collision and placement math all belong there, with a fixed seed so results are the same on every run.
- The quick browser checks (`npm run test:e2e`) are there to prove the built app loads, renders and its main flows run without errors. Don't add steps to them for a new feature. If a rule can only be checked by clicking through the UI, pull the rule out into a function and unit test it instead.
- Browser checks shouldn't depend on timing, frame rate, or animals reaching a spot in a live scene. Software WebGL on CI is slow and uneven, so those checks turn flaky.
- Browser checks share their setup in `tests/browser.mjs`. Every step gets the short `STEP_TIMEOUT`; only building a tank waits longer, through `waitForTank`. Don't raise a timeout to get past a slow step. Wait for the tank, or move the check into a unit test.
- Don't write screenshots from tests unless the test compares them.

## Workflow

- Commit straight to `main` in small, focused commits with clear messages. `git pull --rebase` before pushing; another agent may be working at the same time.
- Commit as the owner, using the name and email on the owner's earlier commits, never as Claude, Codex or another tool. Don't add co-author, session or "generated with" lines to commits or PRs, or tool names to branch names.
- Never push with failing checks. If CI fails after your push, fixing it is your top priority.
- Work is tracked in GitHub issues. Take issues labeled for you (`agent:claude` or `agent:codex`); leave the others alone unless asked. Close issues with a short note when done.
- Art direction (how frogs, plants, and terrain *look*) is decided with the owner. Agents can make art easier to work on, but don't change the look of existing assets on your own. Issues labeled `art` need the owner.
- For visual or layout changes, run `npm run screenshot` and look at the images before committing.
- Keep `README.md` short. Track planned work in GitHub issues.
