# Paludarium — project brief and ideas backlog

Last updated: October 5, 2026 (America/Denver).

This document preserves the user's ideas, preferences, and project decisions from the supplied conversation and available prior context. It is a living brief, not a promise that every feature exists. Earlier assistant suggestions and reported implementation status are labeled below.

## Project identity and location

- Current preferred title: **Paludarium**. Earlier working title: **Little Worlds**.
- The user disliked “Little Worlds” because it felt too childish and wanted a cleverer title. They specifically clarified that the desired title was simply “Paludarium,” not “Paludarium game.” They observed that “paludarium game” had promising SEO.
- Existing playable site: https://little-worlds-terrarium.turner479826.chatgpt.site
- Verified on October 5: the existing site is active, titled Paludarium, and has saved version 3. Access to this project was confirmed in this conversation.
- Keep this a personal project, separate from em1 accounts.
- Preferred eventual personal destination: turnerburchard.com, with a separate repository on the user's personal GitHub account, turnerburchard.
- Earlier hosting proposal: turnerburchard.com/terrarium/ via GitHub Pages, with terrarium.turnerburchard.com as a possible later alternative.
- Earlier conversation reported GitHub write permissions blocked publication there. The user said to stop and fix any such blocker together, then authorized continuing on the ChatGPT site for now. Current GitHub permissions have not been rechecked here.

## Core vision

Build a beautiful, enjoyable terrarium builder that the user can arrange and watch during breaks. They would love a real terrarium; this should capture some of that appeal digitally.

Start with an empty tank, then add convincing plants, animals, rocks, substrate, and water features. Eventually support everything from a fishbowl to complex zoo exhibits. A website is appealing; macOS and mobile were also considered.

The user enjoys terrarium YouTube videos such as “Tanks for Nothin,” especially living habitats with varied species and ecological relationships.

## Nonnegotiable priorities

1. **Fun and beauty.** Making building enjoyable and avoiding frustration requires creative design, not just adding features.
2. **High code quality and human maintainability.** Prefer quality over feature count and efficiency. A human should be able to understand and continue the code easily.
3. **Frogs are a high priority.** They are the user's favorite animals.
4. **Plant preferences:** monsteras, strawberries, and tropical plants.
5. **Environmental inspiration:** both Costa Rica and the US Mountain West.
6. Avoid a heavily pixelated aesthetic. Terraria feels too low fidelity to the user. A simplified, atmospheric look reminiscent of Firewatch is appealing.
   Clarified October 5: **low-poly realism is the art direction for the entire game**, including plants, animals, hardscape, terrain and water. Avoid bulbous/inflated shapes; flat-shading rounded volumes is not sufficient. Use intentional silhouettes, tapering limbs, anatomical planes and coherent polygon scale.
7. Keep the object and asset system simple and extensible, with an object-oriented conceptual model.

## Durable frog art references

The user supplied three images as inspiration on October 5, 2026. All are saved as persistent attachments. Use these as visual references for 3D frog work, not as proof of asset licensing or as production textures.

| Saved image | Persistent reference | Visual direction |
| --- | --- | --- |
| image(5).png | libfile_d11a2ddb4aa08191a22ed33594aadf99 | Green faceted 3D frog: recognizable crouched anatomy, rounded body, folded hind legs, splayed toes, prominent dark eyes. |
| image(6).png | libfile_ce269fe7313081918c5632e53bfbef96 | Angular green frog illustration with front and side views; useful for silhouette, face, color planes, and crouch. Watermarked stock reference. |
| image(7).png | libfile_7225d42b0198819181c572bb4354acc4 | Orange-and-blue faceted dart frog: orange back, dark irregular patches, blue legs, natural low stance. |

Interpretation for the project: preserve a clear frog silhouette and believable proportions, with intentional low-poly facets, convincing folded limbs and feet, and species-specific colors. The images are inspiration rather than a requested exact copy.

Additional whole-game references: image(8).png (libfile_9b90d9b53ab08191adbebe434c01a0fc) shows a mountain/river camping diorama; image(9).png (libfile_abd8e54dd9a08191b642dbcd4d1b3253) shows a faceted river landscape with mountains and trees. The user described this vibe as close. Use the angular silhouettes, broad color planes, coherent polygon scale, simplified water and soft shadows as style guidance, not as requests to add houses, campsites or mountain exhibits.

Preferred downloadable starting point: https://poly.pizza/m/9Z2V8fpazF (Quaternius Frog, CC0, FBX/GLTF, tagged animated). The user prefers this model to the previously suggested https://poly.pizza/m/37wofOCOzG, which they rejected visually. Even the preferred model needs refinement toward low-poly realism; no bulbous anatomy. The model and its preview were downloaded for inspection.

Current collaboration boundary: this thread owns frog models and deployment; the other thread owns ecosystem behavior. Preserve concurrent/unrelated source changes and synchronize before publishing.

Further frog feedback: imported frogs initially looked too large, mean-looking and skinny. Reduce overall scale, soften the eye expression, add natural limb substance while keeping lean anatomy, and use fewer polygons. The user considers the current rocks the strongest visual asset; use their polygon scale and restrained surfaces as the benchmark.

## Building and habitat ideas

### Initial experience accepted in the earlier plan

- A rotatable and zoomable glass tank.
- Adjustable tank dimensions, substrate depth, water level, and lighting.
- Placeable rocks, wood, moss, ferns, and leafy plants.
- Move, rotate, resize, duplicate, and delete placed objects.
- Undo mistakes.
- Gentle plant movement, water ripples, and animals that wander or swim within suitable habitat areas.
- Pause and resume the simulation.
- Save locally, autosave, and export/import a terrarium file.
- Desktop editing and usable touch controls.
- First target experience: a planted tank with a shallow pond, rocks, a log, and moving inhabitants.

### Explicit future ideas

- Rotate/turn plants.
- Change the landscape and terrain.
- Change tank size.
- More enclosure types, including bowls, aquariums, paludariums, and larger exhibits.
- More presets, spanning basic dirt/rock/sand/water landscaping through complex waterfall features.
- Cool animals living in balance with plants.
- Waterfalls and more elaborate water features.
- Potential later gamification; no specific progression, rewards, or scoring system has been chosen.

## Ecosystem ambition

Long term, the user wants ecological relationships deeper than a simplistic “strawberry frog eats strawberries” rule. That phrase illustrates the desired contrast; it is not a factual feeding requirement.

Their examples include algae, little insects that eat it, little shrimp that eat those organisms, cleaning species, and interactions that help the habitat reach equilibrium. The goal is a convincing little living system with plants and animals, not merely decorative motion.

Earlier assistant suggestions for later simulation work included growth, moisture, temperature, feeding, breeding, and ecosystem balance. These are possible expansions, not independently confirmed user requirements in every detail.

## Long-term AI creation ideas

- Build or modify a tank by typing or talking: describe the desired habitat and have AI arrange it using the available tanks, plants, and assets.
- Much later, generate new assets on request, such as “I want a crocodile.”
- Provide a constrained engine and reusable components so the AI can produce a simple compatible model rather than inventing an unrelated asset pipeline.
- Let generated species include structured traits: what it eats, where it lives, what eats it, size, speed, and other relevant habitat and behavior properties.
- Generated assets should fit the tank, plants, other inhabitants, and ecosystem rules so the result makes sense.
- These are long-term ambitions, not requirements for the first version.

## Earlier technical direction (implementation proposals)

The earlier assistant proposed TypeScript, React, and Three.js through React Three Fiber. Each placed object would have an asset type, position, rotation, scale, and optional behavior. Rendering, editing, and simulation should stay separate so new assets do not require rewriting the tank.

A small, coherent set of suitably licensed models was proposed. Realistic proportions, natural plant shapes, textured rocks, transparent glass, soft shadows, and warm lighting should carry the visual quality while keeping the scene smooth.

These are architectural and art-direction proposals from the accepted plan; this document does not verify the current repository's implementation.

## Previously reported playable behavior

The earlier assistant reported a private playable preview with a “Try a cloud forest” preset, frogs, and tropical plants; orbit and zoom controls; object editing; R to rotate; Command-Z to undo; Space to pause; a tool-hiding eye button; and browser autosave. It also reported desktop/mobile checks and save/undo tests passing.

These are preserved historical reports, not fresh test results. Breeding, growth, and ecosystem balance were described as future work. The current site metadata was verified here, but gameplay and source code were not inspected in this saving task.

## Deferred ski app ideas

The user explicitly asked to save these for another day while focusing on the terrarium project.

### Ski day and skill tracker

The earlier assistant suggested a simple personal app to track ski days, with tap counters for runs, cliffs, and jumps, local storage, and a little history. The user said this sounded good. The exact tracking model and UI remain undecided.

### Automatic music switching

The user's idea: automatically switch from loud music while skiing downhill to quieter audio or podcasts while riding uphill. They wondered whether Spotify could support it or whether local MP3s would be needed. Detection signals, audio integrations, and background behavior have not been researched or selected.

### Personal iOS development context

The user asked whether personal iPhone apps could be made easily and free, just for their phone. The earlier assistant discussed Xcode and a free Apple account, the recurring free provisioning limitation, and SwiftUI versus React Native/Expo. Those platform-policy claims are historical conversation context and should be checked against current Apple documentation before implementation.

## Open decisions

- Which visual and interaction refinements most improve fun and beauty in the current build?
- Which frog species and plant assets should be prioritized?
- What level of terrain sculpting should the editor support?
- How should the ecosystem remain satisfying without becoming tedious habitat maintenance?
- What, if any, gamification fits the relaxing terrarium experience?
- When should the project move to the personal GitHub/domain hosting destination?
- Which ski app should be built first when that work resumes?

## Maintenance convention

Update this document as ideas are added or decisions change. Keep user requests, assistant proposals, verified current behavior, and historical reports distinguishable. Preserve deferred ideas instead of deleting them when priorities change.
