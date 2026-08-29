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

Serve this directory with any static HTTP server and open the root URL. Opening the HTML files directly is not recommended because browser download and print behavior varies for `file:` URLs.

## Regression test

Run `node tests/regression.test.js` and `node tests/site.test.js`. The tests verify fixed single- and double-exponential datasets, expected inversion outputs, peak classifications, invalid-series handling, bilingual interface coverage, and static asset integrity.

## GitHub Pages

Publish from the `main` branch and repository root. The intended public path is:

`https://jingluodongxi.github.io/ISPD-Analyzer/`
