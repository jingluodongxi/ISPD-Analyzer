(function () {
  "use strict";

  var COLORS = ["#168f88", "#d07a3b", "#b99a32", "#77589a", "#6f9b4d", "#388cab", "#a64f62", "#334155"];
  var datasets = {}, colorIndex = 0, allResults = [], vtSets = [], trapSets = [], chartColors = [];
  var activeTab = 0, currentModel = "double";
  var currentStatus = { key: "analyzer.statusReady", values: {}, type: "ready" };

  function t(key, values) { return window.ISPD_I18N.t(key, values); }
  function modelLabel(model) { return t(model === "single" ? "analyzer.singleExponential" : "analyzer.doubleExponential"); }
  function statusValues(values) {
    var localized = Object.assign({}, values || {});
    if (localized.modelKey) localized.model = modelLabel(localized.modelKey);
    return localized;
  }
  function setChip(type) {
    var chip = document.getElementById("status-chip");
    var key = type === "running" ? "analyzer.running" : type === "warning" ? "analyzer.warning" : type === "error" ? "analyzer.error" : type === "completed" ? "analyzer.completed" : "analyzer.ready";
    chip.className = "status-chip " + (type || "ready");
    chip.querySelector("span").textContent = t(key);
  }
  function showStatus(key, values, type) {
    currentStatus = { key: key, values: values || {}, type: type || "ready" };
    var status = document.getElementById("status-bar");
    status.textContent = t(key, statusValues(values));
    status.style.color = type === "error" ? "#b14e49" : type === "warning" ? "#a46d25" : "";
    setChip(type || "ready");
  }
  function setResultHeading() {
    document.getElementById("result-heading").textContent = t(["analyzer.decayTitle", "analyzer.spectrumTitle", "analyzer.summaryTitle"][activeTab]);
  }
  function peakNature(region, warning) {
    var labels = { before: t("analyzer.before"), measured: t("analyzer.measuredRegion"), after: t("analyzer.after") };
    var label = labels[region] || t("analyzer.unknown");
    return warning ? label + "; " + t("analyzer.boundary") : label;
  }

  function addFileItem(filename, dataset) {
    var item = document.createElement("li");
    item.dataset.filename = filename;
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.checked = true; checkbox.dataset.filename = filename; checkbox.setAttribute("aria-label", filename);
    var dot = document.createElement("span"); dot.className = "dot"; dot.style.background = dataset.color;
    var content = document.createElement("span"); content.className = "file-content";
    var name = document.createElement("span"); name.className = "file-name"; name.textContent = filename; name.title = filename;
    var meta = document.createElement("small"); meta.className = "file-meta"; meta.dataset.count = dataset.t.length; meta.dataset.first = dataset.t[0];
    var remove = document.createElement("button"); remove.className = "remove-file"; remove.type = "button"; remove.dataset.filename = filename;
    remove.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 3h4l1 3H7l1-3Zm-2 3 1 11h6l1-11M9 9v5m2-5v5"/></svg>';
    content.appendChild(name); content.appendChild(meta);
    item.appendChild(checkbox); item.appendChild(dot); item.appendChild(content); item.appendChild(remove);
    document.getElementById("file-list").appendChild(item);
    updateFileLabels(); updateFileEmpty();
  }
  function updateFileLabels() {
    document.querySelectorAll(".file-meta").forEach(function (meta) { meta.textContent = t("analyzer.fileMeta", { count: meta.dataset.count, first: meta.dataset.first }); });
    document.querySelectorAll(".remove-file").forEach(function (button) {
      button.setAttribute("aria-label", t("analyzer.removeFile") + ": " + button.dataset.filename);
      button.title = t("analyzer.removeFile");
    });
  }
  function updateFileEmpty() {
    var hasFiles = Object.keys(datasets).length > 0;
    document.getElementById("file-empty").style.display = hasFiles ? "none" : "block";
    document.getElementById("btn-clear-files").style.display = hasFiles ? "inline-flex" : "none";
  }
  function clearFiles(announce) {
    datasets = {}; colorIndex = 0; document.getElementById("file-list").innerHTML = "";
    updateFileEmpty(); clearResults(false);
    if (announce) showStatus("analyzer.filesCleared", {}, "ready");
  }

  function numberColumn(header, getter, digits, scientific) {
    return {
      header: header,
      raw: function (result) { var value = getter(result); return value == null || !isFinite(value) ? null : Number(value.toPrecision(15)); },
      display: function (result) { var value = getter(result); return value == null || !isFinite(value) ? "-" : scientific ? value.toExponential(digits) : value.toFixed(digits); },
      excelFormat: scientific ? "0.00E+00" : digits === 4 ? "0.0000" : "0.00"
    };
  }
  function textColumn(header, getter, warning) { return { header: header, raw: getter, display: getter, warning: warning || null }; }
  function tableSchema(model) {
    var columns = [
      textColumn(t("table.file"), function (r) { return r.filename; }),
      textColumn(t("table.model"), function (r) { return modelLabel(r.model); }),
      numberColumn(t("table.firstTime"), function (r) { return r.tFirst; }, 2),
      numberColumn("R²", function (r) { return r.r2; }, 4),
      numberColumn("V₀ (V)", function (r) { return r.v0; }, 2),
      numberColumn("y₀ (V)", function (r) { return r.y0; }, 2)
    ];
    if (model === "single") return columns.concat([
      numberColumn(t("table.characteristicE"), function (r) { return r.characteristic_E; }, 4),
      numberColumn(t("table.characteristicN"), function (r) { return r.characteristic_N; }, 2, true),
      textColumn(t("table.characteristicNature"), function (r) { return peakNature(r.characteristic_peak_region, r.characteristic_boundary_warning); }, function (r) { return r.characteristic_boundary_warning; }),
      numberColumn("A (V)", function (r) { return r.A; }, 2),
      numberColumn("τ (s)", function (r) { return r.tau; }, 2)
    ]);
    return columns.concat([
      numberColumn(t("table.shallowE"), function (r) { return r.shallow_E; }, 4),
      numberColumn(t("table.shallowN"), function (r) { return r.shallow_N; }, 2, true),
      textColumn(t("table.shallowNature"), function (r) { return peakNature(r.shallow_peak_region, r.shallow_boundary_warning); }, function (r) { return r.shallow_boundary_warning; }),
      numberColumn(t("table.deepE"), function (r) { return r.deep_E; }, 4),
      numberColumn(t("table.deepN"), function (r) { return r.deep_N; }, 2, true),
      textColumn(t("table.deepNature"), function (r) { return peakNature(r.deep_peak_region, r.deep_boundary_warning); }, function (r) { return r.deep_boundary_warning; }),
      numberColumn("A₁ (V)", function (r) { return r.A1; }, 2),
      numberColumn("τ₁ (s)", function (r) { return r.tau1; }, 2),
      numberColumn("A₂ (V)", function (r) { return r.A2; }, 2),
      numberColumn("τ₂ (s)", function (r) { return r.tau2; }, 2)
    ]);
  }
  function renderTable() {
    var schema = tableSchema(currentModel), head = document.getElementById("result-head"), body = document.getElementById("result-tbody");
    head.innerHTML = ""; body.innerHTML = "";
    schema.forEach(function (column) { var th = document.createElement("th"); th.textContent = column.header; head.appendChild(th); });
    allResults.forEach(function (result) {
      var row = document.createElement("tr");
      schema.forEach(function (column) { var td = document.createElement("td"); td.textContent = column.display(result); if (column.warning && column.warning(result)) td.className = "warning-cell"; row.appendChild(td); });
      body.appendChild(row);
    });
    document.getElementById("table-empty").style.display = allResults.length ? "none" : "grid";
  }

  function switchTab(index) {
    activeTab = index;
    document.querySelectorAll(".tab-btn").forEach(function (button, i) { var active = i === index; button.classList.toggle("active", active); button.setAttribute("aria-selected", active ? "true" : "false"); });
    document.getElementById("tab-content-0").classList.toggle("active", index === 0);
    document.getElementById("tab-content-1").classList.toggle("active", index === 1);
    document.getElementById("tab3-content").classList.toggle("active", index === 2);
    setResultHeading(); if (allResults.length && index < 2) window.setTimeout(drawCharts, 0);
  }
  function setEmptyState(hasResults) {
    [1, 2].forEach(function (n) { document.getElementById("empty-state-" + n).style.display = hasResults ? "none" : "flex"; document.getElementById("chart" + n + "-canvas").style.display = hasResults ? "block" : "none"; });
  }
  function drawCharts() {
    if (!allResults.length) return;
    ChartRenderer.drawVtChart(document.getElementById("chart1-canvas"), vtSets, chartColors);
    ChartRenderer.drawEtNtChart(document.getElementById("chart2-canvas"), trapSets, chartColors);
  }
  function clearResults(announce) {
    [1, 2].forEach(function (n) { var canvas = document.getElementById("chart" + n + "-canvas"); if (canvas.width) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); });
    allResults = []; vtSets = []; trapSets = []; chartColors = []; setEmptyState(false); renderTable();
    if (announce !== false) showStatus("analyzer.cleared", {}, "ready");
  }
  function updateModelUi() {
    document.getElementById("run-label").textContent = t(currentModel === "single" ? "analyzer.runSingle" : "analyzer.runDouble");
    document.getElementById("result-model-badge").textContent = modelLabel(currentModel); renderTable();
  }

  function validateTimes(times) {
    times.forEach(function (time, i) {
      if (time <= 0) throw new Error(t("analyzer.invalidPositive", { index: i + 1, value: time }));
      if (i && time <= times[i - 1]) throw new Error(t("analyzer.invalidOrder", { previous: times[i - 1], value: time }));
    });
  }
  function parseWorkbook(buffer) {
    if (!window.XLSX) throw new Error(t("analyzer.libraryUnavailable"));
    var book = XLSX.read(new Uint8Array(buffer), { type: "array" }), sheet = book.Sheets[book.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }).filter(function (row) { return row && row.length >= 2; });
    var start = rows.length && typeof rows[0][0] === "string" && isNaN(parseFloat(rows[0][0])) ? 1 : 0, times = [], volts = [];
    for (var i = start; i < rows.length; i++) { var time = parseFloat(rows[i][0]), voltage = parseFloat(rows[i][1]); if (isFinite(time) && isFinite(voltage)) { times.push(time); volts.push(voltage); } }
    if (times.length < 3) throw new Error(t("analyzer.insufficient"));
    validateTimes(times); return { t: times, v: volts };
  }
  function importFiles(fileList) {
    Array.from(fileList || []).forEach(function (file) {
      if (datasets[file.name]) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var parsed = parseWorkbook(event.target.result), color = COLORS[colorIndex++ % COLORS.length];
          datasets[file.name] = { t: parsed.t, v: parsed.v, color: color }; addFileItem(file.name, datasets[file.name]); clearResults(false);
          showStatus("analyzer.fileLoaded", { name: file.name, count: parsed.t.length, first: parsed.t[0] }, "ready");
        } catch (error) { showStatus("analyzer.fileFailed", { name: file.name, message: error.message }, "error"); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  function runAnalysis() {
    var selected = [];
    document.querySelectorAll("#file-list input[type='checkbox']").forEach(function (checkbox) { if (checkbox.checked) selected.push(checkbox.dataset.filename); });
    if (!selected.length) { showStatus("analyzer.selectFile", {}, "warning"); return; }
    var button = document.getElementById("btn-compute"); button.disabled = true; showStatus("analyzer.calculating", { modelKey: currentModel }, "running");
    window.setTimeout(function () {
      try {
        var T = parseFloat(document.getElementById("input-T").value) || 300, nu = parseFloat(document.getElementById("combo-nu").value) || 1e12;
        var eps = parseFloat(document.getElementById("input-epsr").value) || 3, d = parseFloat(document.getElementById("input-d").value) || 50;
        var nextVt = [], nextTrap = [], nextColors = []; allResults = [];
        selected.forEach(function (filename) {
          var source = datasets[filename]; if (!source) return;
          var result = currentModel === "single" ? ISPD.computeSingle(source.t, source.v, T, nu, eps, d) : ISPD.compute(source.t, source.v, T, nu, eps, d);
          result.filename = filename; result.color = source.color; result.model = currentModel; allResults.push(result); nextColors.push(source.color);
          nextVt.push({ tLog: result.tLog, vRaw: result.vRaw, tLogDense: result.tLogDense, vDense: result.vDense, label: filename + " (R²=" + result.r2.toFixed(4) + ")" });
          nextTrap.push({ EMeasured: result.EMeasured, NMeasured: result.NMeasured, EPreExtrapolated: result.EPreExtrapolated, NPreExtrapolated: result.NPreExtrapolated, EPostExtrapolated: result.EPostExtrapolated, NPostExtrapolated: result.NPostExtrapolated, peaks: result.peaks, label: filename });
        });
        vtSets = nextVt; trapSets = nextTrap; chartColors = nextColors; setEmptyState(true); renderTable(); switchTab(1); window.setTimeout(drawCharts, 0);
        showStatus("analyzer.success", { count: selected.length, modelKey: currentModel }, "completed");
      } catch (error) { clearResults(false); showStatus("analyzer.runtimeError", { message: error.message }, "error"); console.error(error); }
      finally { button.disabled = false; }
    }, 30);
  }

  function exportFilename(ext) { return "ISPD_" + (currentModel === "single" ? "Single" : "Double") + "_Exponential_Results." + ext; }
  function exportRows(raw) {
    var schema = tableSchema(currentModel);
    return [schema.map(function (column) { return column.header; })].concat(allResults.map(function (result) { return schema.map(function (column) { return raw ? column.raw(result) : column.display(result); }); }));
  }
  function csvCell(value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }
  function downloadBlob(content, type, filename) {
    var url = URL.createObjectURL(new Blob([content], { type: type })), link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportCsv() {
    if (!allResults.length) { showStatus("analyzer.nothingToExport", {}, "warning"); return; }
    var filename = exportFilename("csv"); downloadBlob("\ufeff" + exportRows(false).map(function (row) { return row.map(csvCell).join(","); }).join("\r\n"), "text/csv;charset=utf-8", filename); showStatus("analyzer.exported", { name: filename }, "completed");
  }
  function exportXlsx() {
    if (!allResults.length) { showStatus("analyzer.nothingToExport", {}, "warning"); return; }
    if (!window.XLSX) { showStatus("analyzer.libraryUnavailable", {}, "error"); return; }
    var schema = tableSchema(currentModel), displayRows = exportRows(false), sheet = XLSX.utils.aoa_to_sheet(exportRows(true));
    function displayWidth(value) { return Array.from(String(value == null ? "" : value)).reduce(function (total, character) { return total + (character.charCodeAt(0) > 255 ? 2 : 1); }, 0); }
    sheet["!cols"] = schema.map(function (_, columnIndex) {
      var widest = displayRows.reduce(function (max, row) { return Math.max(max, displayWidth(row[columnIndex])); }, 0);
      return { wch: Math.max(12, Math.min(36, widest + 2)) };
    });
    sheet["!autofilter"] = { ref: sheet["!ref"] };
    for (var row = 1; row <= allResults.length; row++) schema.forEach(function (column, col) { var address = XLSX.utils.encode_cell({ r: row, c: col }); if (column.excelFormat && sheet[address] && sheet[address].t === "n") sheet[address].z = column.excelFormat; });
    var book = XLSX.utils.book_new(), filename = exportFilename("xlsx"); XLSX.utils.book_append_sheet(book, sheet, ISPD_I18N.getLanguage() === "en" ? "Results" : "分析结果"); XLSX.writeFile(book, filename, { compression: true }); showStatus("analyzer.exported", { name: filename }, "completed");
  }
  function closeExportMenu() { var root = document.getElementById("export-menu"); root.querySelector(".export-options").hidden = true; root.querySelector("#btn-export").setAttribute("aria-expanded", "false"); }
  function toggleExportMenu() { var root = document.getElementById("export-menu"), options = root.querySelector(".export-options"); options.hidden = !options.hidden; root.querySelector("#btn-export").setAttribute("aria-expanded", options.hidden ? "false" : "true"); if (!options.hidden) options.querySelector("button").focus(); }

  function chartReady() { if (!allResults.length) { showStatus("analyzer.nothingToExport", {}, "warning"); return false; } return true; }
  function downloadPng(id, filename) { if (!chartReady()) return; var link = document.createElement("a"); link.href = document.getElementById(id).toDataURL("image/png"); link.download = filename; document.body.appendChild(link); link.click(); link.remove(); showStatus("analyzer.exported", { name: filename }, "completed"); }
  function downloadSvg(kind) { if (!chartReady()) return; var vt = kind === "vt", filename = vt ? "ISPD_Vt_Chart.svg" : "ISPD_EtNt_Chart.svg"; downloadBlob(vt ? ChartRenderer.exportVtSvg(vtSets, chartColors) : ChartRenderer.exportEtNtSvg(trapSets, chartColors), "image/svg+xml;charset=utf-8", filename); showStatus("analyzer.exported", { name: filename }, "completed"); }
  function openPdf(kind) {
    if (!chartReady()) return; var vt = kind === "vt", title = vt ? "ISPD_Vt_Chart" : "ISPD_EtNt_Chart", svg = vt ? ChartRenderer.exportVtSvg(vtSets, chartColors) : ChartRenderer.exportEtNtSvg(trapSets, chartColors), popup = window.open("", "_blank");
    if (!popup) { showStatus("analyzer.popupBlocked", {}, "warning"); return; }
    svg = svg.replace(/^<\?xml[^>]*>\s*/, ""); popup.document.open(); popup.document.write('<!doctype html><html><head><meta charset="UTF-8"><title>' + title + '</title><style>@page{size:180mm 120mm;margin:0}html,body{width:180mm;height:120mm;margin:0;background:#fff;overflow:hidden}body{display:flex;align-items:center;justify-content:center}svg{display:block;width:180mm;height:120mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' + svg + '</body></html>'); popup.document.close(); popup.focus(); window.setTimeout(function () { popup.print(); }, 350); showStatus("analyzer.printOpened", {}, "completed");
  }

  function bindEvents() {
    document.getElementById("file-input").addEventListener("change", function (event) { importFiles(event.target.files); event.target.value = ""; });
    var upload = document.getElementById("btn-import");
    ["dragenter", "dragover"].forEach(function (name) { upload.addEventListener(name, function (event) { event.preventDefault(); upload.classList.add("dragover"); }); });
    ["dragleave", "drop"].forEach(function (name) { upload.addEventListener(name, function (event) { event.preventDefault(); upload.classList.remove("dragover"); }); });
    upload.addEventListener("drop", function (event) { importFiles(event.dataTransfer.files); });
    document.getElementById("btn-clear-files").addEventListener("click", function () { clearFiles(true); });
    document.getElementById("file-list").addEventListener("click", function (event) { var button = event.target.closest(".remove-file"); if (!button) return; var name = button.dataset.filename; delete datasets[name]; button.closest("li").remove(); updateFileEmpty(); clearResults(false); showStatus("analyzer.fileRemoved", { name: name }, "ready"); });
    document.getElementById("file-list").addEventListener("change", function (event) { if (event.target.matches("input[type='checkbox']") && allResults.length) { clearResults(false); showStatus("analyzer.selectionChanged", {}, "ready"); } });
    document.querySelectorAll('input[name="fit-model"]').forEach(function (radio) { radio.addEventListener("change", function () { if (!this.checked) return; currentModel = this.value; clearResults(false); updateModelUi(); showStatus("analyzer.modelChanged", { modelKey: currentModel }, "ready"); }); });
    document.getElementById("btn-compute").addEventListener("click", runAnalysis);
    document.querySelectorAll(".tab-btn").forEach(function (button) { button.addEventListener("click", function () { switchTab(parseInt(this.dataset.tab, 10)); }); });
    document.getElementById("btn-export").addEventListener("click", function (event) { event.stopPropagation(); toggleExportMenu(); });
    document.querySelectorAll("[data-export-format]").forEach(function (button) { button.addEventListener("click", function () { closeExportMenu(); if (this.dataset.exportFormat === "xlsx") exportXlsx(); else exportCsv(); }); });
    document.addEventListener("click", function (event) { if (!event.target.closest("#export-menu")) closeExportMenu(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { closeExportMenu(); document.getElementById("btn-export").focus(); } });
    document.getElementById("tbtn-png1").addEventListener("click", function () { downloadPng("chart1-canvas", "ISPD_Vt_Chart.png"); });
    document.getElementById("tbtn-svg1").addEventListener("click", function () { downloadSvg("vt"); }); document.getElementById("tbtn-pdf1").addEventListener("click", function () { openPdf("vt"); });
    document.getElementById("tbtn-png2").addEventListener("click", function () { downloadPng("chart2-canvas", "ISPD_EtNt_Chart.png"); });
    document.getElementById("tbtn-svg2").addEventListener("click", function () { downloadSvg("etnt"); }); document.getElementById("tbtn-pdf2").addEventListener("click", function () { openPdf("etnt"); });
    document.getElementById("tbtn-clear1").addEventListener("click", function () { clearResults(true); }); document.getElementById("tbtn-clear2").addEventListener("click", function () { clearResults(true); });
    var resizeTimer; window.addEventListener("resize", function () { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(drawCharts, 120); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents(); updateFileEmpty(); updateModelUi(); setEmptyState(false); switchTab(0); showStatus("analyzer.statusReady", {}, "ready");
    ISPD_I18N.subscribe(function () { updateModelUi(); updateFileLabels(); setResultHeading(); showStatus(currentStatus.key, currentStatus.values, currentStatus.type); });
  });
})();
