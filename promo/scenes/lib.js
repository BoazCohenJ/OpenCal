// Shared helpers for promo scenes. Every scene is a pure function of time: it sets
// window.DURATION (seconds), window.seek(t) (draws the frame at t) and window.CUES
// (sound effects the audio script synthesizes: [{ t, type, ...params }]).
/* eslint-disable no-unused-vars */
const TOMATO = '#E2553A';
const TOMATO_NIGHT = '#F06A4D';
const CREAM = '#FFFCF7';
const PAPER = '#F5EFE6';
const INK = '#221D17';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
/** Progress 0..1 of t through [a, b]. */
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/** Deterministic PRNG so every render is identical. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const $ = (id) => document.getElementById(id);
const attr = (el, a) => {
  for (const k in a) el.setAttribute(k, a[k]);
};

/** Same pen-circle geometry as scripts/make-logo.js. */
function openRing(cx, cy, r) {
  const start = -70, sweep = 385, steps = 160, r0 = r * 0.96, r1 = r * 1.1;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((start + sweep * t) * Math.PI) / 180;
    const rr = r0 + (r1 - r0) * t;
    pts.push(`${(cx + rr * 1.06 * Math.cos(a)).toFixed(1)} ${(cy + rr * 0.94 * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
}

/**
 * The OpenCal mark in a 1000×1000 box (mirrors make-logo.js). The pen circle gets
 * id `${id}-ring` with pathLength=1 so scenes can draw it on with stroke-dashoffset.
 */
function logoMark(id, { page = CREAM, ink = INK, dot = TOMATO, shadow = true } = {}) {
  const x = 140, y = 190, w = 720, h = 690, r = 120, band = 180;
  const ringW = 64, ringH = 150, ringY = y - 70;
  const cx = 500, cy = y + band + (h - band) / 2, cr = 138, stroke = 56;
  return `
    <defs>
      <clipPath id="${id}-page"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
      <filter id="${id}-lift" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#3A1A10" flood-opacity="${shadow ? 0.28 : 0}"/>
      </filter>
    </defs>
    <g filter="url(#${id}-lift)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${page}"/></g>
    <g clip-path="url(#${id}-page)"><rect x="${x}" y="${y}" width="${w}" height="${band}" fill="${ink}"/></g>
    <rect x="${330 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="${page}" stroke="${ink}" stroke-width="22"/>
    <rect x="${670 - ringW / 2}" y="${ringY}" width="${ringW}" height="${ringH}" rx="${ringW / 2}" fill="${page}" stroke="${ink}" stroke-width="22"/>
    <path id="${id}-ring" d="${openRing(cx, cy, cr)}" pathLength="1" fill="none" stroke="${dot}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Sets a pathLength=1 path to be drawn on to fraction p. */
function drawOn(el, p) {
  attr(el, { 'stroke-dasharray': '1 1', 'stroke-dashoffset': String(1 - clamp(p)) });
  el.style.opacity = p <= 0 ? 0 : 1;
}
