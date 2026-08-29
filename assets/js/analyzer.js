(function () {
  "use strict";

  var COLOR_PALETTE = ["#168f88", "#d07a3b", "#b99a32", "#77589a", "#6f9b4d", "#388cab", "#a64f62", "#334155"];
  var datasets = {};
  var colorIndex = 0;
  var allResults = [];
  var currentVtDatasets = [];
  var currentTrapDatasets = [];
  var currentChartColors = [];
  var activeTab = 0;
  var currentStatus = { key: "analyzer.statusReady", values: {}, type: "ready" };

  function t(key, values) { return window.ISPD_I18N.t(key, values); }

  function setChip(type) {
    var chip = document.getElementById("status-chip");
    var key = type === "running" ? "analyzer.running" : type === "warning" ? "analyzer.warning" : type === "error" ? "analyzer.error" : type === "completed" ? "analyzer.completed" : "analyzer.ready";
    chip.className = "status-chip " + (type || "ready");
    chip.querySelector("span").textContent = t(key);
  }

  function showStatus(key, values, type) {
    currentStatus = { key: key, values: values || {}, type: type || "ready" };
    var status = document.getElementById("status-bar");
    status.textContent = t(key, values);
    status.style.color = type === "error" ? "#b14e49" : type === "warning" ? "#a46d25" : "";
    setChip(type || "ready");
  }

  function setResultHeading() {
    var keys = ["analyzer.decayTitle", "analyzer.spectrumTitle", "analyzer.summaryTitle"];
    document.getElementById("result-heading").textContent = t(keys[activeTab]);
  }

  function peakNature(region, boundaryWarning) {
    var labels = { before: t("analyzer.before"), measured: t("analyzer.measuredRegion"), after: t("analyzer.after") };
    var label = labels[region] || t("analyzer.unknown");
    return boundaryWarning ? label + "; " + t("analyzer.boundary") : label;
  }

  function addFileItem(filename, color) {
    var item = document.createElement("li");
    var checkbox = document.createElement("input");
    var dot = document.createElement("span");
    var name = document.createElement("span");
    var remove = document.createElement("button");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.filename = filename;
    dot.className = "dot";
    dot.style.background = color;
    name.className = "file-name";
    name.textContent = filename;
    name.title = filename;
    remove.className = "remove-file";
    remove.type = "button";
    remove.dataset.filename = filename;
    remove.setAttribute("aria-label", t("analyzer.removeFile") + ": " + filename);
    remove.textContent = "×";
    item.appendChild(checkbox);
    item.appendChild(dot);
    item.appendChild(name);
    item.appendChild(remove);
    document.getElementById("file-list").appendChild(item);
    updateFileEmpty();
  }

  function updateFileEmpty() {
    document.getElementById("file-empty").style.display = Object.keys(datasets).length ? "none" : "block";
  }

  function clearFiles() {
    datasets = {};
    colorIndex = 0;
    document.getElementById("file-list").innerHTML = "";
    updateFileEmpty();
    clearResults(false);
  }

  function renderTable() {
    var tbody = document.getElementById("result-tbody");
    tbody.innerHTML = "";
    allResults.forEach(function (result) {
      var values = [
        result.filename, result.tFirst.toFixed(2), result.r2.toFixed(4), result.v0.toFixed(2),
        result.shallow_E != null ? result.shallow_E.toFixed(4) : "-",
        result.shallow_N != null ? result.shallow_N.toExponential(2) : "-",
        peakNature(result.shallow_peak_region, result.shallow_boundary_warning),
        result.deep_E != null ? result.deep_E.toFixed(4) : "-",
        result.deep_N != null ? result.deep_N.toExponential(2) : "-",
        peakNature(result.deep_peak_region, result.deep_boundary_warning),
        result.A1.toFixed(2), result.tau1.toFixed(2), result.A2.toFixed(2), result.tau2.toFixed(2), result.y0.toFixed(2)
      ];
      var row = document.createElement("tr");
      values.forEach(function (value, index) {
        var cell = document.createElement("td");
        cell.textContent = value;
        if ((index === 6 && result.shallow_boundary_warning) || (index === 9 && result.deep_boundary_warning)) cell.className = "warning-cell";
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    document.getElementById("table-empty").style.display = allResults.length ? "none" : "grid";
  }

  function switchTab(index) {
    activeTab = index;
    document.querySelectorAll(".tab-btn").forEach(function (button, buttonIndex) {
      var active = buttonIndex === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("tab-content-0").classList.toggle("active", index === 0);
    document.getElementById("tab-content-1").classList.toggle("active", index === 1);
    document.getElementById("tab3-content").classList.toggle("active", index === 2);
    setResultHeading();
    if (allResults.length && index < 2) window.setTimeout(drawCharts, 0);
  }

  function setEmptyState(hasResults) {
    [1, 2].forEach(function (number) {
      document.getElementById("empty-state-" + number).style.display = hasResults ? "none" : "flex";
      document.getElementById("chart" + number + "-canvas").style.display = hasResults ? "block" : "none";
    });
  }

  function drawCharts() {
    if (!allResults.length) return;
    var chart1 = document.getElementById("chart1-canvas");
    var chart2 = document.getElementById("chart2-canvas");
    ChartRenderer.drawVtChart(chart1, currentVtDatasets, currentChartColors);
    ChartRenderer.drawEtNtChart(chart2, currentTrapDatasets, currentChartColors);
  }

  function clearResults(updateStatus) {
    var chart1 = document.getElementById("chart1-canvas");
    var chart2 = document.getElementById("chart2-canvas");
    if (chart1.width) chart1.getContext("2d").clearRect(0, 0, chart1.width, chart1.height);
    if (chart2.width) chart2.getContext("2d").clearRect(0, 0, chart2.width, chart2.height);
    allResults = [];
    currentVtDatasets = [];
    currentTrapDatasets = [];
    currentChartColors = [];
    setEmptyState(false);
    renderTable();
    if (updateStatus !== false) showStatus("analyzer.cleared", {}, "ready");
  }

  function validateParsedTimes(times) {
    for (var i = 0; i < times.length; i++) {
      if (times[i] <= 0) throw new Error(t("analyzer.invalidPositive", { index: i + 1, value: times[i] }));
      if (i > 0 && times[i] <= times[i - 1]) throw new Error(t("analyzer.invalidOrder", { previous: times[i - 1], value: times[i] }));
    }
  }

  function parseWorkbook(arrayBuffer) {
    if (!window.XLSX) throw new Error(t("analyzer.libraryUnavailable"));
    var workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null }).filter(function (row) { return row && row.length >= 2; });
    var startRow = rows.length > 0 && typeof rows[0][0] === "string" && isNaN(parseFloat(rows[0][0])) ? 1 : 0;
    var times = [];
    var voltages = [];
    for (var i = startRow; i < rows.length; i++) {
      var time = parseFloat(rows[i][0]);
      var voltage = parseFloat(rows[i][1]);
      if (isFinite(time) && isFinite(voltage)) { times.push(time); voltages.push(voltage); }
    }
    if (times.length < 3) throw new Error(t("analyzer.insufficient"));
    validateParsedTimes(times);
    return { t: times, v: voltages };
  }

  function importFiles(fileList) {
    var files = Array.from(fileList || []);
    if (!files.length) return;
    if (document.getElementById("radio-single").checked) clearFiles();
    files.forEach(function (file) {
      if (datasets[file.name]) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var parsed = parseWorkbook(event.target.result);
          var color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
          colorIndex++;
          datasets[file.name] = { t: parsed.t, v: parsed.v, color: color };
          addFileItem(file.name, color);
          showStatus("analyzer.fileLoaded", { name: file.name, count: parsed.t.length, first: parsed.t[0] }, "ready");
        } catch (error) {
          showStatus("analyzer.fileFailed", { name: file.name, message: error.message }, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function runAnalysis() {
    var selectedFiles = [];
    document.querySelectorAll("#file-list input[type='checkbox']").forEach(function (checkbox) {
      if (checkbox.checked) selectedFiles.push(checkbox.dataset.filename);
    });
    if (!selectedFiles.length) { showStatus("analyzer.selectFile", {}, "warning"); return; }

    var button = document.getElementById("btn-compute");
    button.disabled = true;
    showStatus("analyzer.calculating", {}, "running");
    window.setTimeout(function () {
      try {
        var temperature = parseFloat(document.getElementById("input-T").value) || 300;
        var frequency = parseFloat(document.getElementById("combo-nu").value) || 1e12;
        var epsilonR = parseFloat(document.getElementById("input-epsr").value) || 3;
        var thickness = parseFloat(document.getElementById("input-d").value) || 50;
        var vtDatasets = [];
        var trapDatasets = [];
        var colors = [];
        allResults = [];

        selectedFiles.forEach(function (filename) {
          var source = datasets[filename];
          if (!source) return;
          var result = ISPD.compute(source.t, source.v, temperature, frequency, epsilonR, thickness);
          result.filename = filename;
          result.color = source.color;
          allResults.push(result);
          colors.push(source.color);
          vtDatasets.push({ tLog: result.tLog, vRaw: result.vRaw, tLogDense: result.tLogDense, vDense: result.vDense, label: filename + " (R²=" + result.r2.toFixed(4) + ")" });
          trapDatasets.push({
            EMeasured: result.EMeasured, NMeasured: result.NMeasured,
            EPreExtrapolated: result.EPreExtrapolated, NPreExtrapolated: result.NPreExtrapolated,
            EPostExtrapolated: result.EPostExtrapolated, NPostExtrapolated: result.NPostExtrapolated,
            shallow_E: result.shallow_E, shallow_N: result.shallow_N, deep_E: result.deep_E, deep_N: result.deep_N, label: filename
          });
        });

        currentVtDatasets = vtDatasets;
        currentTrapDatasets = trapDatasets;
        currentChartColors = colors;
        setEmptyState(true);
        renderTable();
        switchTab(1);
        window.setTimeout(drawCharts, 0);
        showStatus("analyzer.success", { count: selectedFiles.length }, "completed");
      } catch (error) {
        showStatus("analyzer.runtimeError", { message: error.message }, "error");
        console.error(error);
      } finally {
        button.disabled = false;
      }
    }, 30);
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return "\"" + text.replace(/\"/g, "\"\"") + "\"";
  }

  function exportCsv() {
    if (!allResults.length) { showStatus("analyzer.nothingToExport", {}, "warning"); return; }
    var english = ISPD_I18N.getLanguage() === "en";
    var headers = english ?
      ["Dataset", "First measurement time (s)", "R²", "V0 (V)", "Shallow trap depth (eV)", "Shallow surface density (m⁻²)", "Shallow peak class", "Deep trap depth (eV)", "Deep surface density (m⁻²)", "Deep peak class", "A1 (V)", "τ1 (s)", "A2 (V)", "τ2 (s)", "y0 (V)"] :
      ["数据标识", "首个测量时间 (s)", "拟合优度 R²", "V0 (V)", "浅陷阱峰深度 (eV)", "浅陷阱面密度 (m⁻²)", "浅峰性质", "深陷阱峰深度 (eV)", "深陷阱面密度 (m⁻²)", "深峰性质", "幅值 A1 (V)", "弛豫时间 τ1 (s)", "幅值 A2 (V)", "弛豫时间 τ2 (s)", "残余电位 y0 (V)"];
    var rows = [headers];
    allResults.forEach(function (result) {
      rows.push([result.filename, result.tFirst.toFixed(2), result.r2.toFixed(4), result.v0.toFixed(2),
        result.shallow_E != null ? result.shallow_E.toFixed(4) : "-", result.shallow_N != null ? result.shallow_N.toExponential(2) : "-", peakNature(result.shallow_peak_region, result.shallow_boundary_warning),
        result.deep_E != null ? result.deep_E.toFixed(4) : "-", result.deep_N != null ? result.deep_N.toExponential(2) : "-", peakNature(result.deep_peak_region, result.deep_boundary_warning),
        result.A1.toFixed(2), result.tau1.toFixed(2), result.A2.toFixed(2), result.tau2.toFixed(2), result.y0.toFixed(2)]);
    });
    downloadBlob("\ufeff" + rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n"), "text/csv;charset=utf-8", "ISPD_Physics_Parameters.csv");
    showStatus("analyzer.exported", { name: "ISPD_Physics_Parameters.csv" }, "completed");
  }

  function chartReady() {
    if (!allResults.length) { showStatus("analyzer.nothingToExport", {}, "warning"); return false; }
    return true;
  }

  function downloadBlob(content, mimeType, filename) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadCanvasPng(canvasId, filename) {
    if (!chartReady()) return;
    var link = document.createElement("a");
    link.href = document.getElementById(canvasId).toDataURL("image/png");
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showStatus("analyzer.exported", { name: filename }, "completed");
  }

  function downloadChartSvg(kind) {
    if (!chartReady()) return;
    var isVt = kind === "vt";
    var svg = isVt ? ChartRenderer.exportVtSvg(currentVtDatasets, currentChartColors) : ChartRenderer.exportEtNtSvg(currentTrapDatasets, currentChartColors);
    var filename = isVt ? "ISPD_Vt_Chart.svg" : "ISPD_EtNt_Chart.svg";
    downloadBlob(svg, "image/svg+xml;charset=utf-8", filename);
    showStatus("analyzer.exported", { name: filename }, "completed");
  }

  function openVectorPdf(kind) {
    if (!chartReady()) return;
    var isVt = kind === "vt";
    var title = isVt ? "ISPD_Vt_Chart" : "ISPD_EtNt_Chart";
    var svg = isVt ? ChartRenderer.exportVtSvg(currentVtDatasets, currentChartColors) : ChartRenderer.exportEtNtSvg(currentTrapDatasets, currentChartColors);
    var printWindow = window.open("", "_blank");
    if (!printWindow) { showStatus("analyzer.popupBlocked", {}, "warning"); return; }
    svg = svg.replace(/^<\?xml[^>]*>\s*/, "");
    printWindow.document.open();
    printWindow.document.write("<!doctype html><html><head><meta charset=\"UTF-8\"><title>" + title + "</title><style>@page{size:180mm 120mm;margin:0}html,body{width:180mm;height:120mm;margin:0;background:#fff;overflow:hidden}body{display:flex;align-items:center;justify-content:center}svg{display:block;width:180mm;height:120mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>" + svg + "</body></html>");
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(function () { printWindow.print(); }, 350);
    showStatus("analyzer.printOpened", {}, "completed");
  }

  function bindEvents() {
    document.getElementById("file-input").addEventListener("change", function (event) { importFiles(event.target.files); event.target.value = ""; });
    var upload = document.getElementById("btn-import");
    ["dragenter", "dragover"].forEach(function (eventName) { upload.addEventListener(eventName, function (event) { event.preventDefault(); upload.classList.add("dragover"); }); });
    ["dragleave", "drop"].forEach(function (eventName) { upload.addEventListener(eventName, function (event) { event.preventDefault(); upload.classList.remove("dragover"); }); });
    upload.addEventListener("drop", function (event) { importFiles(event.dataTransfer.files); });
    document.getElementById("file-list").addEventListener("click", function (event) {
      var button = event.target.closest(".remove-file");
      if (!button) return;
      delete datasets[button.dataset.filename];
      button.closest("li").remove();
      updateFileEmpty();
      clearResults(false);
    });
    document.querySelectorAll('input[name="mode"]').forEach(function (radio) { radio.addEventListener("change", function () { if (document.getElementById("radio-single").checked) clearFiles(); }); });
    document.getElementById("btn-compute").addEventListener("click", runAnalysis);
    document.querySelectorAll(".tab-btn").forEach(function (button) { button.addEventListener("click", function () { switchTab(parseInt(this.dataset.tab, 10)); }); });
    document.getElementById("btn-export").addEventListener("click", exportCsv);
    document.getElementById("tbtn-png1").addEventListener("click", function () { downloadCanvasPng("chart1-canvas", "ISPD_Vt_Chart.png"); });
    document.getElementById("tbtn-svg1").addEventListener("click", function () { downloadChartSvg("vt"); });
    document.getElementById("tbtn-pdf1").addEventListener("click", function () { openVectorPdf("vt"); });
    document.getElementById("tbtn-png2").addEventListener("click", function () { downloadCanvasPng("chart2-canvas", "ISPD_EtNt_Chart.png"); });
    document.getElementById("tbtn-svg2").addEventListener("click", function () { downloadChartSvg("etnt"); });
    document.getElementById("tbtn-pdf2").addEventListener("click", function () { openVectorPdf("etnt"); });
    document.getElementById("tbtn-clear1").addEventListener("click", function () { clearResults(true); });
    document.getElementById("tbtn-clear2").addEventListener("click", function () { clearResults(true); });
    var resizeTimer;
    window.addEventListener("resize", function () { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(drawCharts, 120); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    updateFileEmpty();
    renderTable();
    setEmptyState(false);
    switchTab(0);
    showStatus("analyzer.statusReady", {}, "ready");
    ISPD_I18N.subscribe(function () {
      renderTable();
      setResultHeading();
      showStatus(currentStatus.key, currentStatus.values, currentStatus.type);
      document.querySelectorAll(".remove-file").forEach(function (button) { button.setAttribute("aria-label", t("analyzer.removeFile") + ": " + button.dataset.filename); });
    });
  });
})();
