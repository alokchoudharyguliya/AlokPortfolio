# Credits

Third-party assets used by the site. Every asset here is **CC0 (public domain)** or **CC-BY**; the licence, author and source are recorded for each, so the list can be audited. The same list is shown in-app on the Drive mode's credits screen.

## Drive mode: 3D models

| Asset | Files | Author | Licence | Source |
|---|---|---|---|---|
| **Car Kit 3.1** (traffic cars, cone) | `sedan`, `sedan-sports`, `hatchback-sports`, `suv`, `taxi`, `van`, `truck`, `cone` `.glb` and `Textures/colormap.png` | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/car-kit |
| **Racing Kit 2.0** (roadside scenery) | `treeLarge`, `treeSmall`, `lightPostModern`, `rail`, `pylon`, `flagCheckers` `.glb` | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/racing-kit |

Both kits are distributed under [Creative Commons Zero](http://creativecommons.org/publicdomain/zero/1.0/): free for personal, educational and commercial use, no attribution required. Kenney asks for a credit as a courtesy, which this page and the in-app credits screen provide. The original licence files are kept in `frontend/public/drive/licenses/`.

Files live in `frontend/public/drive/models/`. They are unmodified copies; scaling and tinting happen at load time in `modes/drive/render/assets.ts`.

## Made for this project (no third-party licence)

- The cockpit (dashboard, steering wheel, gauges), road, sky, gates and boost pads are drawn in code (SVG / CSS / three.js geometry and shaders).

## Rules for adding assets

1. Only CC0 or CC-BY. No ripped game assets, no real car brands or logos, no "free for non-commercial" assets.
2. Add a row to the table above (author, licence, source URL) **before** committing the files, and copy the licence text into `public/drive/licenses/`.
3. Keep the Drive download budget: about 3 MB in total, loaded only when Drive mode is opened.
