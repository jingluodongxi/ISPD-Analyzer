# ISPD-Analyzer

ISPD-Analyzer is a bilingual, browser-based platform for isothermal surface-potential decay fitting and apparent surface-trap spectrum inversion.

## Design principles

- All measurement data stays in the browser; there is no upload or backend.
- The original double-exponential numerical interface remains compatible and is isolated under `assets/js/core/`; a parallel single-exponential path is available for one-process fitting.
- The landing page and analysis workspace use relative paths so the site works under the GitHub Pages project path.
- The analysis workspace targets desktop screens of at least 1024 px.

## Data contract

Import `.csv`, `.xlsx`, or `.xls` files with time in the first column and potential in the second. A single header row is allowed. At least three valid points are required; time values must be positive and strictly increasing.

## Local preview

### Editable chart legends

Each imported CSV, XLSX, or XLS file has a **Legend name** text field. Enter any name (including Chinese, English, units, and symbols) before or after analysis. Both charts and their PNG/SVG/PDF exports use exactly that name, without adding a filename extension or R² suffix. R² remains available in the parameter table.

The original filename remains visible and is retained in table exports for traceability. A blank/whitespace-only name falls back to the original filename; the reset button restores it explicitly. Editing a name only redraws labels: measurements, curve geometry, fitted parameters, and colors are retained. Names persist while switching fit models and interface languages in the current page, but are cleared with their datasets.

Both charts reserve a right-hand legend column outside the axes. Names wrap using measured text widths; long legends extend the canvas and vector export height rather than being clipped. The workspace scrolls when needed, including on zoomed desktop screens. Changing the interface language immediately redraws chart titles, axes, and annotations while preserving custom names and all numerical results. SVG exports and the PDF print page use the same layout, with the print page sized to the complete SVG aspect ratio.

Drawing methods accept an optional fourth argument `{language: "zh" | "en"}`; SVG export options accept the same `language` property alongside `width` and `height`. Omission uses the active interface language. The renderer uses the shared `ISPD_I18N` dictionary, which must be loaded before rendering. Requested height is a minimum and may expand for long legends.

### Serving the site

Serve this directory with any static HTTP server and open the root URL. Opening the HTML files directly is not recommended because browser download and print behavior varies for `file:` URLs.

## Regression test

Run `node tests/regression.test.js` and `node tests/site.test.js`. The tests verify fixed single- and double-exponential datasets, expected inversion outputs, peak classifications, invalid-series handling, bilingual interface coverage, and static asset integrity.

Optional UI regression: with Playwright available, run `node tests/legend.browser.test.js`. It uses installed Chrome by default; set `ISPD_BROWSER_PATH` to another Chromium executable if needed. It checks CSV/XLSX/XLS naming, unchanged fit results and vector geometry, PNG/SVG/PDF exports, reset/fallback, and language/model switches. Set `ISPD_QA_DIR` to save a screenshot. All test datasets are synthetic.

For local seven-workbook layout QA, set `ISPD_TEST_DATA_DIR` and run `node tests/chart-layout.browser.test.js`. This checks both languages, SVG text bounds, outside-axes legends, all export formats, long-name overflow, and CSS viewport/DPR equivalents of 100%, 125%, and 150% browser zoom at 1024/1440/1920 px. Optional QA outputs go only to `ISPD_QA_DIR`; measurement files are not committed or uploaded.

## GitHub Pages

Publish from the `main` branch and repository root. The intended public path is:

`https://jingluodongxi.github.io/ISPD-Analyzer/`
