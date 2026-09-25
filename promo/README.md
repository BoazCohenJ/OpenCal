# Promo video

Renders the ~43 s OpenCal promo: an animated intro (shady guy in an alley), then real app footage in a moving phone frame cut to the beat of the music (captions, punch-in zooms, tomato-pen callouts, a three-phone montage), a light/dark flip, a feature-chip burst and an end card. Everything is HTML rendered frame by frame in headless Edge, so re-renders are identical.

```bash
cd promo && npm install
# 1. App footage (needs the web build running: npx expo start --web --port 8082)
node record.js http://localhost:8082            # all clips + light/dark stills -> out/footage/
# 2. Scenes -> video + sound-effect cues
node render.js scenes/intro.html out/intro.mp4
node render.js scenes/main.html out/main.mp4
node sfx.js out/intro.cues.json out/intro.sfx.wav
node sfx.js out/main.cues.json out/main.sfx.wav
# 3. Music + mix -> out/opencal-promo.mp4 (high quality, for GitHub Pro's 100 MB limit),
#    out/opencal-promo-10mb.mp4 (free accounts' 10 MB limit) and out/opencal-promo.gif
node assemble.js
```

- `scenes/intro.html`, `scenes/main.html`: the scenes. Lines, captions and timings are constants at the top of each file. The main scene is laid out in beats of the main track (`B`, `D` = where its drop lands); `SEQ` lists each feature beat with its clip trim, side, caption and zooms. Preview a moment with `node render.js scenes/main.html out/stills --stills 5,12.5`.
- `record.js`: scripted interactions per clip (`CLIPS`), with seeded data from `demo-data.js`. `a.highlight(text)` logs a UI element's position so the scene circles it in pen. A few web-only touch quirks are worked around there (swipe-back navigation, the click that follows a long-press or a closing sheet).
- `sfx.js`: synthesizes all sound effects (voice blips, whooshes, taps, pen) from the cues; no samples.
- `assemble.js`: expects `music/intro.mp3` ("cool suspense pizzicato FULL" by MaherAlhilo) and `music/main.mp3` ("Light Tone" by SunSides), both from Pixabay under the Pixabay Content License. They're not committed; without them it mixes sound effects only.
- `shots.js`: the older README screenshot script.

Requires Microsoft Edge (for puppeteer-core) and ffmpeg (`D:\FFmpeg\bin` or on PATH).
