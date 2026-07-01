# Self-hosted fonts

## Anantason (Thai)

Anantason is a free Thai font and is **not** available on Google Fonts, so it must be
self-hosted here. The `@font-face` rules in `frontend/src/index.css` expect these files
in this folder:

| File | Weight |
|---|---|
| `Anantason-Regular.woff2` | 400 (also used as `.ttf` fallback) |
| `Anantason-Regular.ttf`   | 400 |
| `Anantason-Bold.woff2`    | 600–800 |
| `Anantason-Bold.ttf`      | 600–800 |

### How the EN/TH split works
The app uses the font stack `'Poppins', 'Anantason', sans-serif` everywhere. Poppins
contains no Thai glyphs, so Latin characters render in Poppins and Thai characters
automatically fall through to Anantason within the same string — no language-switch
logic is required.

### Getting the files
1. Download Anantason (e.g. from f0nt.com — the common free Thai font source).
2. If you only have a `.ttf`, convert it to `.woff2` for smaller payloads
   (e.g. https://cloudconvert.com/ttf-to-woff2 or `woff2_compress`). The `.ttf` is kept
   as a fallback so the font still works even without the `.woff2`.
3. Drop the files in this folder using the exact names above.

Until these files are added, Thai text gracefully falls back to the system sans-serif;
English (Poppins) is unaffected.

> Poppins itself is loaded from Google Fonts in `index.css` and `public/index.html` — no
> local files needed for it.
