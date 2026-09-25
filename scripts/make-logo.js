/* global __dirname, Buffer */
// Renders the OpenCal logo into every asset the app needs from one geometry.
// Usage (sharp isn't a project dependency):  npm i --no-save sharp && node scripts/make-logo.js [outDir] [--preview]
// Writes to assets/ by default. Icons and the splash are native: bump app.json "version" and rebuild after changing them.
// The in-app mark (src/components/Logo.tsx) mirrors this geometry.
// Concept: a cream calendar page with an ink binding strip and two rings; the date circled in
// tomato pen is both "today" and the O of OpenCal.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);
const OUT = args.find((a) => !a.startsWith('--')) ?? path.join(__dirname, '..', 'assets');
const PREVIEW = args.includes('--preview');
const TOMATO = '#E2553A';
const TOMATO_DEEP = '#C9432B';
const CREAM = '#FFFCF7';
const INK = '#221D17';

/**
 * A pen-circled date: one stroke that loops ~1.1 turns while drifting outward, so its ends
 * overlap like a hand-drawn circle instead of meeting (which would read as a loading spinner).
 */
function openRing(cx, cy, r) {
  const start = -70, sweep = 385, steps = 160, r0 = r * 0.96, r1 = r * 1.1;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((start + sweep * t) * Math.PI) / 180;
    const rr = r0 + (r1 - r0) * t;
    // Slightly squashed like a quick hand motion.
    pts.push(`${(cx + rr * 1.06 * Math.cos(a)).toFixed(1)} ${(cy + rr * 0.94 * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
}

/** The mark (page + rings + circled date) in a 1000×1000 box, centered, ~720 wide. */
function mark({ page = CREAM, ink = INK, dot = TOMATO, mono = false } = {}) {
  const x = 140, y = 190, w = 720, h = 690, r = 120, band = 180;
  const ringW = 64, ringH = 150, ringY = y - 70;
  const cx = 500, cy = y + band + (h - band) / 2, cr = 138, stroke = 56;
  const ring = openRing(cx, cy, cr);
  if (mono) {
    // Single-colour silhouette for Android themed icons: page with the circle cut out.
    return `
      <defs><mask id="m"><rect width="1000" height="1000" fill="#fff"/>
        <path d="${ring}" fill="none" stroke="#000" stroke-width="${stroke}" stroke-linecap="round"/>
        <rect x="${x}" y="${y + band}" width="${w}" height="16" fill="#000"/></mask></defs>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#fff" mask="url(#m)"/>
      <rect x="${330 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="#fff"/>
      <rect x="${670 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="#fff"/>`;
  }
  return `
    <defs>
      <clipPath id="page"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
      <filter id="lift" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#3A1A10" flood-opacity="0.28"/>
      </filter>
    </defs>
    <g filter="url(#lift)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${page}"/>
    </g>
    <g clip-path="url(#page)">
      <rect x="${x}" y="${y}" width="${w}" height="${band}" fill="${ink}"/>
    </g>
    <rect x="${330 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="${page}" stroke="${ink}" stroke-width="22"/>
    <rect x="${670 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="${page}" stroke="${ink}" stroke-width="22"/>
    <path d="${ring}" fill="none" stroke="${dot}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const bg = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${TOMATO}"/><stop offset="1" stop-color="${TOMATO_DEEP}"/></linearGradient></defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>`;

/** Wraps content; `scale` shrinks the mark around the centre (adaptive icon safe zone). */
const svg = (inner, { scale = 1, background = '' } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${background}
  <g transform="translate(${500 * (1 - scale)} ${500 * (1 - scale)}) scale(${scale})">${inner}</g>
</svg>`;

const assets = {
  // iOS / legacy icon: full-bleed tomato square (the OS rounds it).
  'icon.png': [svg(mark(), { scale: 0.86, background: bg }), 1024],
  // Android adaptive icon: the launcher masks to ~66% of the canvas, so keep the mark inside it.
  'android-icon-foreground.png': [svg(mark(), { scale: 0.62 }), 1024],
  'android-icon-background.png': [svg('', { background: bg }), 1024],
  'android-icon-monochrome.png': [svg(mark({ mono: true }), { scale: 0.62 }), 1024],
  // Splash: the mark alone on a transparent canvas; app.json supplies the paper background.
  'splash-icon.png': [svg(mark(), { scale: 0.92 }), 1024],
  'favicon.png': [svg(mark(), { scale: 0.86, background: bg }), 48],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, [source, size]] of Object.entries(assets)) {
    await sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toFile(path.join(OUT, name));
    console.log('wrote', name, size);
  }
  // Source SVG of the plain mark, for the repo and for reuse.
  fs.writeFileSync(path.join(OUT, 'logo.svg'), svg(mark(), { scale: 1 }));
  if (!PREVIEW) return;
  // Preview sheet to eyeball everything together.
  const tiles = ['icon.png', 'android-icon-foreground.png', 'android-icon-monochrome.png', 'splash-icon.png'];
  const sheet = sharp({ create: { width: 4 * 260 + 40, height: 300, channels: 4, background: '#888888' } });
  await sheet
    .composite(
      await Promise.all(
        tiles.map(async (t, i) => ({
          input: await sharp(path.join(OUT, t)).resize(240, 240).toBuffer(),
          left: 20 + i * 260,
          top: 30,
        })),
      ),
    )
    .png()
    .toFile(path.join(OUT, '_preview.png'));
})();
