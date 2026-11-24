# VoiceoverDrop — brand & interface system (v2)

Owner brief (2026-11-24): production-ready, smooth motion, hover/scroll effects, skeletons,
transitions, refined buttons; the v1 palette felt generic; wants an international-level brand
vibe. Reference for *craft* (not colours): courtoflove.art — cinematic restraint, huge
tightly-tracked type, a single thin line drawing, one player, lots of air, expo-out easing.

## Audit of v1 (why it felt generic)
- Cool grey paper + navy + highlighter yellow: safe, "SaaS template" temperature.
- Same 20px rounded box for every container; no hierarchy of surfaces.
- Buttons: flat pills with only an opacity hover — feel hard/sticky, no press feedback.
- No motion system: no load moment, no scroll feedback, no loading skeletons (blank waits).
- The demo was a document, not a stage; nothing on the page *sounds*.

## Concept — "Studio after dark"
A recording booth at night: deep spruce acoustic felt, one tungsten lamp, the glow of a VU meter.
The hero is a stage where a single thin line of light becomes a living waveform when a voice speaks.
Everything else stays quiet so that one moment carries the brand.

## Colour (tokens)
| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--bg` | `#0B1714` spruce night | `#EEF1EC` sage mist (default) | page |
| `--surface` | `#11211D` felt | `#FFFFFF` | panels |
| `--ink` | `#EDE9DF` warm paper white | `#0E1D19` spruce | text |
| `--mute` | `#9AA79F` | `#4F5D57` | secondary text (AA on bg) |
| `--line` | `#EDE9DF1A` | `#0E1D1914` | hairlines |
| `--lamp` | `#FFB547` tungsten | `#FFB547` | the one accent: CTAs, voice line, spoken words |
| `--lamp-ink` | `#1A1205` | `#1A1205` | text on lamp |
| `--ok` / `--danger` | `#7FD6B0` / `#FF8A7A` | `#1F7A55` / `#B3261E` | states |

The stage (hero + studio result) is always dark, in both themes.

## Type
- **Instrument Sans** (variable wght/wdth): display at 700, tracking −0.045em, sizes `clamp(48px, 9vw, 132px)`;
  body 400/500 at 17px/1.55. One family; the width axis gives display its stance.
- **Courier Prime** only for script text (screenplay vernacular) — editor and demo.
- No all-caps labels, no eyebrows, no accent-word headlines.

## Motion
- Easing: out `cubic-bezier(.16,1,.3,1)`, in-out `cubic-bezier(.76,0,.24,1)`. Durations 180 / 420 / 900 ms.
- One orchestrated load moment: headline lines rise from a clip mask (staggered 90 ms), the voice line draws in.
- Scroll: smooth scrolling (Lenis), header turns to frosted glass after 24px, sections reveal once
  (clip + 24px rise), "How it works" progress line is drawn by scroll, use-case marquee drifts.
- Interaction: buttons lift 1px + glow on hover, press to 0.97, magnetic hero CTA (fine pointers only);
  voice rows show live EQ bars on hover/play; FAQ height animates; route changes cross-fade (ViewTransition).
- Loading: shimmer skeletons for balance, studio, history, billing, admin.
- `prefers-reduced-motion`: all of the above collapse to instant state changes; smooth scroll off.

## Shape & depth
Radius hierarchy: 999px (buttons, chips) · 28px (stage) · 18px (panels) · 12px (inputs).
Depth from light, not shadows: hairline borders + a soft lamp glow behind the stage; fine film grain overlay.

## Review against the brief
- Not cream/terracotta, not near-black/acid-green: spruce + tungsten is specific to a studio at night.
- The bold move is spent once (the living voice line); cards, lists and pricing stay hairline-quiet.
- Changed from first idea: dropped an all-site gradient (SaaS tell) and a custom cursor (gimmick).

## Update 2026-11-24 (owner feedback)
- Owner: "light version looks fine, get rid of the gradient one". Light is now the default theme (dark is opt-in via the toggle),
  and every decorative gradient/glow was removed (hero/stage/CTA/login radial glows, gradient hairlines, button sheen, glow shadows).
  Only functional gradients remain (link underline animation, loading shimmer).
