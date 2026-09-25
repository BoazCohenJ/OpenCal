// Joins the rendered scenes, mixes sound effects and music, and writes the final MP4 + GIF.
//   node assemble.js
// Inputs (from render.js / sfx.js): out/intro.mp4, out/main.mp4, out/intro.sfx.wav, out/main.sfx.wav
// Music (optional, not in the repo; Pixabay Content License):
//   music/intro.mp3  "cool suspense pizzicato FULL" by MaherAlhilo
//   music/main.mp3   "Light Tone" by SunSides
// Outputs: out/opencal-promo.mp4 (1080p high quality), out/opencal-promo-10mb.mp4, out/opencal-promo.gif (silent fallback)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FFMPEG = fs.existsSync('D:\\FFmpeg\\bin\\ffmpeg.exe') ? 'D:\\FFmpeg\\bin\\ffmpeg.exe' : 'ffmpeg';
const OUT = path.join(__dirname, 'out');
const MUSIC = path.join(__dirname, 'music');
const p = (...a) => path.join(...a);

// The music crossfades at the intro's camera dive, and the main track is offset so its drop
// (MAIN_DROP seconds into "Light Tone") lands on the main scene's drop marker (the phone slam).
const intro = JSON.parse(fs.readFileSync(p(OUT, 'intro.cues.json'), 'utf8'));
const main = JSON.parse(fs.readFileSync(p(OUT, 'main.cues.json'), 'utf8'));
const INTRO_LEN = intro.duration;
const TOTAL = INTRO_LEN + main.duration;
const XFADE_AT = intro.markers.dive;
const XFADE_LEN = 0.9;
const MAIN_DROP = 9.07;
const MAIN_OFFSET = MAIN_DROP - (INTRO_LEN + main.markers.drop - XFADE_AT); // where in the track to start
const MUSIC_VOL = { intro: 0.6, main: 0.55 };
const FADE_OUT = 2.2;

function ff(args) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

// 1) Video: concatenate the two renders.
const list = p(OUT, 'concat.txt');
fs.writeFileSync(list, ['intro.mp4', 'main.mp4'].map((f) => `file '${p(OUT, f).replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', p(OUT, 'video.mp4')]);

// 2) Audio: sfx for both parts, plus music if present.
const inputs = ['-i', p(OUT, 'intro.sfx.wav'), '-i', p(OUT, 'main.sfx.wav')];
const filters = [
  '[0:a]volume=1.0[sfx1]',
  `[1:a]adelay=${Math.round(INTRO_LEN * 1000)}:all=1,volume=1.0[sfx2]`,
];
const mix = ['[sfx1]', '[sfx2]'];
const hasMusic = fs.existsSync(p(MUSIC, 'intro.mp3')) && fs.existsSync(p(MUSIC, 'main.mp3'));
if (hasMusic) {
  inputs.push('-i', p(MUSIC, 'intro.mp3'), '-i', p(MUSIC, 'main.mp3'));
  const mainStart = XFADE_AT;
  const mainLen = TOTAL - mainStart;
  filters.push(
    `[2:a]atrim=0:${XFADE_AT + XFADE_LEN},asetpts=N/SR/TB,volume=${MUSIC_VOL.intro},afade=t=out:st=${XFADE_AT}:d=${XFADE_LEN}[m1]`,
    `[3:a]atrim=${MAIN_OFFSET}:${MAIN_OFFSET + mainLen},asetpts=N/SR/TB,volume=${MUSIC_VOL.main},afade=t=in:st=0:d=${XFADE_LEN},afade=t=out:st=${mainLen - FADE_OUT}:d=${FADE_OUT},adelay=${Math.round(mainStart * 1000)}:all=1[m2]`,
  );
  console.log(`music: intro 0-${XFADE_AT + XFADE_LEN}s, main track from ${MAIN_OFFSET.toFixed(2)}s at ${mainStart}s (drop at ${(INTRO_LEN + main.markers.drop).toFixed(2)}s)`);
  mix.push('[m1]', '[m2]');
} else {
  console.log('No music in promo/music/ yet: mixing sound effects only.');
}
filters.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,atrim=0:${TOTAL},alimiter=limit=0.9[a]`);
ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[a]', '-ar', '48000', p(OUT, 'audio.wav')]);

// 3) Mux. GitHub caps video attachments at 100 MB on Pro (10 MB on free plans), so there are two:
//    opencal-promo.mp4       high quality (CRF 16), for Pro accounts
//    opencal-promo-10mb.mp4  two-pass to ~9 MB, for free accounts
const final = p(OUT, 'opencal-promo.mp4');
ff(['-i', p(OUT, 'video.mp4'), '-i', p(OUT, 'audio.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', final]);
if (fs.statSync(final).size > 95e6) console.warn('warning: HQ video is over 95 MB; raise the CRF');

const small = p(OUT, 'opencal-promo-10mb.mp4');
const AUDIO_KBPS = 128;
const videoKbps = Math.floor((9.0 * 8 * 1000) / TOTAL - AUDIO_KBPS);
const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', `${videoKbps}k`, '-pix_fmt', 'yuv420p'];
const passlog = p(OUT, 'x264pass');
ff(['-i', p(OUT, 'video.mp4'), ...x264, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', process.platform === 'win32' ? 'NUL' : '/dev/null']);
ff(['-i', p(OUT, 'video.mp4'), '-i', p(OUT, 'audio.wav'), '-map', '0:v', '-map', '1:a', ...x264, '-pass', '2', '-passlogfile', passlog,
  '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-movflags', '+faststart', '-shortest', small]);
for (const f of fs.readdirSync(OUT).filter((f) => f.startsWith('x264pass'))) fs.rmSync(p(OUT, f));

// 4) Silent GIF fallback: GitHub won't show images over 10 MB, so step down until it fits.
const pal = p(OUT, 'palette.png');
const gif = p(OUT, 'opencal-promo.gif');
for (const [w, fps, colors] of [[640, 10, 256], [560, 10, 128], [480, 10, 128], [480, 8, 96], [400, 8, 96]]) {
  const vf = `fps=${fps},scale=${w}:-1:flags=lanczos`;
  ff(['-i', p(OUT, 'video.mp4'), '-vf', `${vf},palettegen=max_colors=${colors}:stats_mode=diff`, pal]);
  ff(['-i', p(OUT, 'video.mp4'), '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, gif]);
  const mb = fs.statSync(gif).size / 1e6;
  console.log(`gif ${w}px ${fps}fps ${colors} colors: ${mb.toFixed(1)} MB`);
  if (mb < 9.5) break;
}

for (const f of ['concat.txt', 'video.mp4', 'audio.wav', 'palette.png']) fs.rmSync(p(OUT, f), { force: true });
for (const f of ['opencal-promo.mp4', 'opencal-promo-10mb.mp4', 'opencal-promo.gif']) console.log(`wrote out/${f} (${(fs.statSync(p(OUT, f)).size / 1e6).toFixed(1)} MB)`);
console.log(`total ${TOTAL.toFixed(2)}s${hasMusic ? ' with music' : ''}`);
