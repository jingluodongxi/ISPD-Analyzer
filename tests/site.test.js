const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const htmlFiles = ["index.html", path.join("analyzer", "index.html"), "404.html"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

htmlFiles.forEach((relative) => {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, "utf8");
  const base = path.dirname(file);
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  refs.forEach((ref) => {
    if (/^(?:https?:|#|mailto:|\/)/.test(ref)) return;
    const clean = ref.split(/[?#]/)[0];
    if (!clean || clean === "./" || clean === "../") return;
    let target = path.resolve(base, clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    assert(fs.existsSync(target), `${relative} references missing asset: ${ref}`);
  });
});

const context = {
  window: {},
  localStorage: { value: null, getItem() { return this.value; }, setItem(_, value) { this.value = value; } },
  document: { documentElement: {}, addEventListener() {}, querySelectorAll() { return []; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "assets", "js", "i18n.js"), "utf8"), context);

const pageHtml = htmlFiles.slice(0, 2).map((relative) => fs.readFileSync(path.join(root, relative), "utf8")).join("\n");
const analyzerJs = fs.readFileSync(path.join(root, "assets", "js", "analyzer.js"), "utf8");
const keys = [...pageHtml.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((match) => match[1])
  .concat([...analyzerJs.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]))
  .concat(['vtTitle','spectrumTitle','timeAxis','potentialAxis','energyAxis','densityAxis','spectrumNote','dataset'].map(key=>'chart.'+key));
["zh", "en"].forEach((language) => {
  context.window.ISPD_I18N.setLanguage(language);
  keys.forEach((key) => assert(context.window.ISPD_I18N.t(key) !== "undefined", `Missing ${language} translation: ${key}`));
});

assert(!pageHtml.includes("jingluodongxi.github.io/ISPD-web"), "The new site must not link to the legacy deployment");
const analyzerHtml = fs.readFileSync(path.join(root, "analyzer", "index.html"), "utf8");
assert(!analyzerHtml.includes('name="mode"'), "Legacy single/multi data-mode controls must be removed");
assert(analyzerHtml.includes('name="fit-model"') && analyzerHtml.includes('value="single"') && analyzerHtml.includes('value="double"'), "Both fit models must be selectable");
assert(analyzerHtml.includes('id="btn-clear-files"') && analyzerHtml.includes('class="remove-file"') === false, "Dataset clear control is missing");
assert(analyzerHtml.includes('data-export-format="csv"') && analyzerHtml.includes('data-export-format="xlsx"'), "CSV/XLSX export choices are missing");
assert(analyzerHtml.includes('id="result-head"'), "Dynamic result header is missing");
console.log(`Static site integrity: PASS (${new Set(keys).size} translated interface strings)`);
