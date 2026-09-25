// Synthesizes a scene's sound effects from the cues render.js wrote (out/<scene>.cues.json).
// No samples: everything is generated, so there's nothing to license.
//   node sfx.js out/intro.cues.json out/intro.sfx.wav
const fs = require('fs');

const RATE = 48000;
const [cuesPath, outPath] = process.argv.slice(2);
const { duration, cues } = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
const buf = new Float32Array(Math.ceil((duration + 2) * RATE));

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noiseRand = rng(7);
const noise = () => noiseRand() * 2 - 1;

/** Adds fn(time-in-sound, i) for dur seconds starting at t. */
function add(t, dur, fn) {
  const s0 = Math.round(t * RATE);
  const n = Math.round(dur * RATE);
  for (let i = 0; i < n && s0 + i < buf.length; i++) buf[s0 + i] += fn(i / RATE, i);
}
const env = (x, a, d) => (x < a ? x / a : Math.exp(-(x - a) / d));

const synth = {
  // Gravelly "mumble" syllable: a low band-limited square with a pitch dip and a bit of grit.
  blip({ t, seed }) {
    const r = rng(seed * 97 + 3);
    const f0 = 118 * (0.85 + 0.35 * r());
    const vowel = 1.5 + r(); // formant-ish brightness
    let ph = 0;
    add(t, 0.075, (x) => {
      const f = f0 * (1.08 - 0.9 * x);
      ph += (2 * Math.PI * f) / RATE;
      let sq = 0;
      for (let h = 1; h <= 9; h += 2) sq += (Math.sin(ph * h) / h) * Math.exp(-h / (4 * vowel));
      const e = x < 0.004 ? x / 0.004 : x > 0.055 ? Math.max(0, 1 - (x - 0.055) / 0.02) : 1;
      return 0.42 * e * (sq + 0.06 * noise());
    });
  },
  pop({ t, gain = 1 }) {
    let ph = 0;
    add(t, 0.09, (x) => {
      ph += (2 * Math.PI * (380 + 5200 * x)) / RATE;
      return 0.22 * gain * Math.sin(ph) * env(x, 0.004, 0.025);
    });
  },
  // Impact when the phone lands: a pitched-down sine thump with a little click.
  thump({ t }) {
    let ph = 0;
    add(t, 0.35, (x) => {
      ph += (2 * Math.PI * (110 * Math.exp(-x * 9) + 38)) / RATE;
      return 0.7 * Math.sin(ph) * env(x, 0.002, 0.11) + 0.15 * noise() * env(x, 0.0005, 0.004);
    });
  },
  // Soft screen tap: a short, muted tick.
  tap({ t }) {
    let lp = 0;
    add(t, 0.05, (x) => {
      lp += 0.3 * (noise() - lp);
      return 0.35 * lp * env(x, 0.001, 0.008) + 0.12 * Math.sin(2 * Math.PI * 1800 * x) * env(x, 0.001, 0.01);
    });
  },
  // Keyboard key: a tiny click with a little random pitch.
  key({ t }) {
    const f = 2400 + 900 * noiseRand();
    add(t, 0.03, (x) => 0.08 * Math.sin(2 * Math.PI * f * x) * env(x, 0.0005, 0.006) + 0.1 * noise() * env(x, 0.0005, 0.003));
  },
  // Fluorescent-lamp flicker: a click plus a short mains buzz.
  flicker({ t }) {
    add(t, 0.16, (x) => {
      const buzz = ((x * 100) % 1) * 2 - 1;
      return 0.12 * buzz * env(x, 0.002, 0.05) + 0.25 * noise() * env(x, 0.0005, 0.006);
    });
  },
  // Filtered-noise whoosh with a swept cutoff.
  whoosh({ t, dur, big, soft }) {
    let lp = 0, lp2 = 0;
    add(t, dur, (x) => {
      const p = x / dur;
      const shape = Math.sin(Math.PI * Math.pow(p, big ? 0.8 : 0.6));
      const cut = 0.02 + 0.25 * shape;
      lp += cut * (noise() - lp);
      lp2 += cut * (lp - lp2);
      return (big ? 0.9 : soft ? 0.3 : 0.6) * shape * shape * lp2 * 3;
    });
  },
  // "Holy glow" shimmer when the coat opens.
  shine({ t, dur }) {
    const notes = [1046.5, 1318.5, 1568, 2093, 2637];
    notes.forEach((f, i) => {
      add(t + i * 0.06, dur, (x) => 0.05 * Math.sin(2 * Math.PI * f * x + 3 * Math.sin(2 * Math.PI * 5 * x) * 0.02) * env(x, 0.02, dur / 3));
    });
    // Soft choir-ish pad underneath.
    [523.25, 659.25, 783.99].forEach((f) => add(t, dur, (x) => 0.035 * Math.sin(2 * Math.PI * f * x) * Math.sin(Math.PI * Math.min(1, x / dur))));
  },
  // "Shhhh": high-passed noise.
  hiss({ t, dur }) {
    let lp = 0;
    add(t, dur, (x) => {
      const n = noise();
      lp += 0.12 * (n - lp);
      const e = Math.min(1, x / 0.08) * Math.min(1, (dur - x) / 0.3);
      return 0.22 * e * (n - lp);
    });
  },
  // Felt-tip pen circling: band-limited noise in scratchy grains.
  pen({ t, dur }) {
    let lp = 0, lp2 = 0;
    add(t, dur + 0.05, (x) => {
      const n = noise();
      lp += 0.35 * (n - lp);
      lp2 += 0.08 * (lp - lp2);
      const grain = 0.6 + 0.4 * Math.sin(2 * Math.PI * 14 * x) ** 2;
      const e = Math.min(1, x / 0.03) * Math.min(1, Math.max(0, dur + 0.05 - x) / 0.08);
      return 0.35 * e * grain * (lp - lp2);
    });
  },
};

for (const c of cues) synth[c.type]?.(c);

// Normalize peaks to -3 dBFS and write 16-bit PCM WAV.
let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const gain = peak > 0 ? 0.707 / peak : 1;
const data = Buffer.alloc(buf.length * 2);
for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * gain)) * 32767), i * 2);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
fs.writeFileSync(outPath, Buffer.concat([header, data]));
console.log(`wrote ${outPath} (${cues.length} cues)`);
