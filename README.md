# Paludarium

A little habitat to build and watch, with plants, frogs and fish.

[Try it](https://paludarium.turnerburchard.com/).

Worlds opens fresh presets and your saved habitats. The open world autosaves
in this browser, including animal life. Build edits keep a preset in Your worlds,
with recently opened saves first. Switching away discards an unedited preset.

Some models and the fonts are by other people, credited in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

To run locally with Node.js 22 or newer:

```sh
npm ci
npm run dev
```

After changing asset models or prebuilts, run `npm run thumbnails` to regenerate
the library pictures. Install Chromium with `npx playwright install chromium`
once, or set `CHROMIUM_PATH` to a local Chromium browser.
