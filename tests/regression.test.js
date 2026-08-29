const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
["lmfit.js", "peaks.js", "compute.js", "chart.js"].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, "assets", "js", "core", file), "utf8"), { filename: file });
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance, label) {
  const scale = Math.max(1, Math.abs(expected));
  assert(Math.abs(actual - expected) <= tolerance * scale, `${label}: expected ${expected}, received ${actual}`);
}

const times = [1, 2, 5, 10, 20, 40, 60, 90, 150, 300, 600, 1200, 2400, 4800];
const voltages = times.map((time) => 620 * Math.exp(-time / 42) + 240 * Math.exp(-time / 760) + 35);
const result = ISPD.compute(times, voltages, 300, 1e12, 3, 50);

close(result.r2, 1, 1e-12, "R²");
close(result.A1, 620, 1e-9, "A1");
close(result.tau1, 42, 1e-9, "tau1");
close(result.A2, 240, 1e-9, "A2");
close(result.tau2, 760, 1e-9, "tau2");
close(result.y0, 35, 1e-9, "y0");
close(result.shallow_E, 0.8109120241701122, 1e-10, "shallow_E");
close(result.shallow_N, 797971997409953.4, 1e-10, "shallow_N");
close(result.deep_E, 0.8857674416865999, 1e-10, "deep_E");
close(result.deep_N, 292782948586410.25, 1e-10, "deep_N");
assert(result.shallow_peak_region === "measured", "shallow peak must remain in the measured region");
assert(result.deep_peak_region === "measured", "deep peak must remain in the measured region");
assert(result.shallow_boundary_warning === false && result.deep_boundary_warning === false, "unexpected boundary warning");
assert(result.model === "double" && result.peaks.length === 2, "double model metadata is invalid");

const singleTimes = [1, 2, 5, 10, 20, 40, 60, 90, 150, 300, 600, 1200, 2400];
const singleVoltages = singleTimes.map((time) => 700 * Math.exp(-time / 180) + 28);
const singleResult = ISPD.computeSingle(singleTimes, singleVoltages, 300, 1e12, 3, 50);
close(singleResult.r2, 1, 1e-12, "single R²");
close(singleResult.A, 700, 1e-9, "single A");
close(singleResult.tau, 180, 1e-9, "single tau");
close(singleResult.y0, 28, 1e-9, "single y0");
close(singleResult.characteristic_E, 0.8485326544202317, 1e-10, "characteristic_E");
close(singleResult.characteristic_N, 853948764229350.1, 1e-10, "characteristic_N");
assert(singleResult.model === "single" && singleResult.peaks.length === 1, "single model metadata is invalid");
assert(singleResult.characteristic_peak_region === "measured", "characteristic peak must remain in the measured region");
assert(singleResult.characteristic_boundary_warning === false, "unexpected single-model boundary warning");

const vtSvg = ChartRenderer.exportVtSvg([{
  tLog: result.tLog, vRaw: result.vRaw, tLogDense: result.tLogDense, vDense: result.vDense, label: "regression"
}], ["#168f88"], { width: 1200, height: 800 });
const spectrumSvg = ChartRenderer.exportEtNtSvg([{
  EMeasured: result.EMeasured, NMeasured: result.NMeasured,
  EPreExtrapolated: result.EPreExtrapolated, NPreExtrapolated: result.NPreExtrapolated,
  EPostExtrapolated: result.EPostExtrapolated, NPostExtrapolated: result.NPostExtrapolated,
  shallow_E: result.shallow_E, shallow_N: result.shallow_N,
  deep_E: result.deep_E, deep_N: result.deep_N, label: "regression"
}], ["#168f88"], { width: 1200, height: 800 });
assert(vtSvg.startsWith("<?xml") && vtSvg.includes("表面电位等温衰减动力学分析"), "V-t SVG export is invalid");
assert(spectrumSvg.startsWith("<?xml") && spectrumSvg.includes("Surface Trap Density"), "trap-spectrum SVG export is invalid");
const singleSpectrumSvg = ChartRenderer.exportEtNtSvg([{
  EMeasured: singleResult.EMeasured, NMeasured: singleResult.NMeasured,
  EPreExtrapolated: singleResult.EPreExtrapolated, NPreExtrapolated: singleResult.NPreExtrapolated,
  EPostExtrapolated: singleResult.EPostExtrapolated, NPostExtrapolated: singleResult.NPostExtrapolated,
  peaks: singleResult.peaks, label: "single regression"
}], ["#168f88"], { width: 1200, height: 800 });
assert(singleSpectrumSvg.startsWith("<?xml") && singleSpectrumSvg.includes("Surface Trap Density"), "single trap-spectrum SVG export is invalid");

[
  { t: [0, 1, 2], v: [3, 2, 1], name: "non-positive time" },
  { t: [1, 1, 2], v: [3, 2, 1], name: "duplicate time" },
  { t: [1, 3, 2], v: [3, 2, 1], name: "reversed time" },
  { t: [1, 2], v: [3, 2], name: "insufficient points" }
].forEach((fixture) => {
  let failed = false;
  try { ISPD.compute(fixture.t, fixture.v, 300, 1e12, 3, 50); } catch (_) { failed = true; }
  assert(failed, `${fixture.name} should be rejected`);
  failed = false;
  try { ISPD.computeSingle(fixture.t, fixture.v, 300, 1e12, 3, 50); } catch (_) { failed = true; }
  assert(failed, `${fixture.name} should be rejected by the single model`);
});

console.log("ISPD numerical regression: PASS");
