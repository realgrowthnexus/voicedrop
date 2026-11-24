/* eslint-disable @typescript-eslint/no-require-imports */
// Renders the share card and app icons with Playwright (dev tool; outputs are committed).
// Usage: node scripts/brand-assets.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "assets/fonts", f)).toString("base64");
const icon = fs.readFileSync(path.join(root, "public/icon.svg"), "utf8");

const css = `
@font-face{font-family:IS;src:url(${font("instrument-sans-latin.woff2")}) format("woff2");font-weight:400 700;font-stretch:75% 100%}
@font-face{font-family:CP;src:url(${font("courier-prime-latin.woff2")}) format("woff2")}
*{margin:0;box-sizing:border-box}
body{background:#08120f;color:#ede9df;font-family:IS}
`;

function wave(w, h, amp, seed) {
  let d = "";
  for (let x = 0; x <= w; x += 4) {
    const t = x / w;
    const env = Math.sin(Math.PI * t) ** 1.4;
    const y = h / 2 + Math.sin(x / 11 + seed) * Math.sin(x / 37) * amp * env + Math.sin(x / 5.3) * amp * 0.25 * env;
    d += `${x ? "L" : "M"}${x},${y.toFixed(1)}`;
  }
  return d;
}

const card = `<!doctype html><html><head><style>${css}
.c{width:1200px;height:630px;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:600;letter-spacing:-.02em}
.top svg{width:56px;height:56px}
h1{font-size:118px;line-height:.92;font-weight:700;letter-spacing:-.05em;font-stretch:88%}
.script{font-family:CP;font-size:26px;color:#8f9c95;margin-top:22px}
.script b{color:#ede9df;font-weight:400;box-shadow:inset 0 -3px 0 #ffb547}
.bot{display:flex;justify-content:space-between;align-items:flex-end;font-size:26px;color:#8f9c95}
.pill{background:#ffb547;color:#1a1205;font-weight:600;padding:12px 26px;border-radius:999px;font-size:26px}
</style></head><body><div class="c">
<div class="top">${icon}VoiceDrop</div>
<div><svg width="1056" height="70" viewBox="0 0 1056 70"><path d="${wave(1056, 70, 26, 1)}" fill="none" stroke="#ffb547" stroke-width="3" stroke-linecap="round"/></svg>
<h1>Give your script<br/>a voice.</h1>
<p class="script"><b>Paste a script.</b> <b>Drop a natural</b> voice-over.</p></div>
<div class="bot"><span>Natural English voice-overs for YouTube &amp; TikTok · MP3 · WAV · SRT</span><span class="pill">voicedrop.rest</span></div>
</div></body></html>`;

const iconPage = (size) => `<!doctype html><html><head><style>${css}body{background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${icon}</body></html>`;
const apple = (size) => `<!doctype html><html><head><style>${css}body{background:#08120f}svg{display:block;width:${size}px;height:${size}px}svg rect{rx:0}</style></head><body>${icon.replace('rx="15"', 'rx="0"')}</body></html>`;

(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, out, transparent = false) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(root, out), omitBackground: transparent });
    await p.close();
    console.log("wrote", out);
  };
  await shot(card, 1200, 630, "src/app/opengraph-image.png");
  fs.copyFileSync(path.join(root, "src/app/opengraph-image.png"), path.join(root, "src/app/twitter-image.png"));
  await shot(apple(180), 180, 180, "src/app/apple-icon.png");
  await shot(iconPage(192), 192, 192, "public/icon-192.png", true);
  await shot(iconPage(512), 512, 512, "public/icon-512.png", true);
  await b.close();
})();
