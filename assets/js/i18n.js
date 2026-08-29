(function (global) {
  "use strict";

  var messages = {
    zh: {
      common: {
        skip: "跳至主要内容",
        desktopTitle: "建议使用电脑访问",
        desktopBody: "分析工作台针对 1024px 以上桌面屏幕设计。"
      },
      home: {
        navCapabilities: "功能", navMethod: "方法", openAnalyzer: "进入分析系统",
        eyebrow: "电介质极化特征评估", title: "从表面电位衰减<br>解析电荷陷阱特征",
        lede: "面向等温表面电位衰减数据的浏览器端研究工具，集成双指数拟合、解析求导与表面陷阱能谱反演。",
        start: "开始分析", viewMethod: "查看方法", privacy: "数据仅在当前浏览器中处理，不上传服务器",
        visualLabel: "分析预览", visualTitle: "表面电位衰减动力学", localCompute: "本地计算",
        statModel: "拟合模型", statOutput: "核心输出", statFormat: "数据格式",
        capEyebrow: "核心能力", capTitle: "围绕可复核分析构建", capBody: "从原始测量数据到可导出的科研图表，每一步都保持参数与边界透明。",
        cap1Title: "多曲线数据处理", cap1Body: "读取 CSV 或 Excel 时间—电位数据，支持单曲线分析与多组样品对比。",
        cap2Title: "解析物理反演", cap2Body: "通过双指数拟合与连续函数解析求导，计算浅、深陷阱能级及面密度。",
        cap3Title: "科研结果导出", cap3Body: "导出 PNG、SVG、PDF 图形及 CSV 参数表，保留实测区间与外推区间标识。",
        methodEyebrow: "分析方法", methodTitle: "从衰减曲线到表观陷阱谱", methodBody: "系统将测量时间范围与模型外推范围明确分离，并在拟合参数触及边界时给出解释提示。",
        formulaLabel: "衰减模型", step1Title: "导入测量数据", step1Body: "识别首测时间并验证时间序列。",
        step2Title: "拟合衰减分量", step2Body: "提取快、慢分量幅值与时间常数。",
        step3Title: "反演陷阱特征", step3Body: "计算能级、面密度及峰值性质。",
        step4Title: "检查并导出", step4Body: "复核边界提示并生成图表和参数表。",
        closeEyebrow: "开始分析", closeTitle: "在浏览器中完成整个反演流程", footer: "浏览器端等温表面电位衰减与陷阱能谱分析平台"
      },
      analyzer: {
        backHome: "返回项目首页", workspace: "表面电位分析工作台", localOnly: "仅本地处理", projectHome: "项目首页",
        configuration: "分析配置", setupTitle: "准备测量数据", setupBody: "导入时间—电位数据并确认物理参数。",
        dataSource: "数据源", single: "单曲线", multi: "多曲线对比", importData: "导入实验数据", formats: "CSV、XLSX 或 XLS", noFiles: "尚未加载数据文件",
        parameters: "物理参数", temperature: "测试温度", frequency: "逃逸频率 ν", permittivity: "相对介电常数 εr", thickness: "绝缘体厚度",
        modelDetails: "查看模型方程", modelNote: "快、慢衰减分量分别用于表征浅、深陷阱的表观贡献。", run: "运行物理反演",
        results: "分析结果", decayTitle: "表面电位衰减动力学", spectrumTitle: "表面陷阱能谱", summaryTitle: "核心反演参数汇总",
        ready: "就绪", running: "计算中", completed: "已完成", warning: "请检查", error: "异常",
        tabDecay: "衰减曲线", tabSpectrum: "陷阱能谱", tabSummary: "参数汇总", measured: "实测数据", fitted: "拟合曲线", clear: "清空",
        emptyTitle: "等待分析数据", spectrumEmptyTitle: "等待能谱反演", emptyBody: "导入文件并运行物理反演后，结果将在此显示。",
        measuredRange: "测量范围内", extrapolated: "模型外推", extrapolationNote: "虚线仅表示测量时间范围之外的模型外推，不代表直接测得的数据。",
        tableHint: "参数按当前勾选的数据文件汇总。", exportCsv: "导出 CSV", noResults: "尚无计算结果",
        statusReady: "系统就绪：支持不同起始时间，并区分实测范围与模型外推。",
        fileLoaded: "已加载 {name}（{count} 个数据点，首个测点 {first} s）",
        fileFailed: "{name} 解析失败：{message}", selectFile: "请至少勾选一个数据文件。",
        calculating: "正在运行双指数拟合与陷阱参数计算……", success: "分析完成：已处理 {count} 组曲线。虚线表示测量时间范围之外的模型外推。",
        runtimeError: "运行异常：{message}", cleared: "图表与特征数据已清空。", nothingToExport: "当前没有可导出的结果，请先完成分析。",
        removeFile: "移除文件", libraryUnavailable: "Excel 解析组件未能加载，请检查网络连接后刷新页面。", exported: "已导出：{name}", popupBlocked: "浏览器阻止了打印窗口，请允许本站弹出窗口后重试。", printOpened: "打印窗口已打开：请选择“另存为 PDF”。",
        invalidPositive: "时间必须全部大于 0 s，第 {index} 个有效时间为 {value} s",
        invalidOrder: "时间必须严格递增，不允许重复或倒序；请检查 {previous} s 与 {value} s", insufficient: "有效数据点不足（至少需要 3 个）",
        before: "首点前外推", measuredRegion: "测量范围内", after: "末点后外推", unknown: "状态未知", boundary: "参数边界，谨慎解释"
      },
      table: {
        file: "数据标识", firstTime: "首测时间 (s)", shallowE: "浅陷阱 Eₜ (eV)", shallowN: "浅陷阱 Nₜ (m⁻²)", shallowNature: "浅峰性质",
        deepE: "深陷阱 Eₜ (eV)", deepN: "深陷阱 Nₜ (m⁻²)", deepNature: "深峰性质"
      }
    },
    en: {
      common: { skip: "Skip to main content", desktopTitle: "Desktop access recommended", desktopBody: "The analysis workspace is designed for desktop screens wider than 1024px." },
      home: {
        navCapabilities: "Capabilities", navMethod: "Method", openAnalyzer: "Open analyzer",
        eyebrow: "Dielectric polarization assessment", title: "Resolve charge-trap features<br>from surface-potential decay",
        lede: "A browser-based research tool for isothermal surface-potential decay data, combining double-exponential fitting, analytical differentiation, and surface-trap spectrum inversion.",
        start: "Start analysis", viewMethod: "View method", privacy: "Data is processed only in this browser and is never uploaded",
        visualLabel: "Analysis preview", visualTitle: "Surface-potential decay kinetics", localCompute: "Local compute",
        statModel: "Fit model", statOutput: "Core outputs", statFormat: "Data formats",
        capEyebrow: "Core capabilities", capTitle: "Built for reproducible analysis", capBody: "From raw measurements to export-ready scientific figures, parameters and model boundaries remain transparent at every step.",
        cap1Title: "Multi-curve processing", cap1Body: "Read CSV or Excel time-potential data for single-curve analysis or comparison across multiple samples.",
        cap2Title: "Analytical inversion", cap2Body: "Apply double-exponential fitting and analytical differentiation to estimate shallow and deep trap levels and surface densities.",
        cap3Title: "Research-ready export", cap3Body: "Export PNG, SVG and PDF figures plus CSV parameter tables with measured and extrapolated regions clearly identified.",
        methodEyebrow: "Analysis method", methodTitle: "From decay curve to apparent trap spectrum", methodBody: "The system separates the measured time range from model extrapolation and flags fitted parameters that reach their bounds.",
        formulaLabel: "Decay model", step1Title: "Import measurements", step1Body: "Detect the first measurement time and validate the sequence.",
        step2Title: "Fit decay components", step2Body: "Extract amplitudes and time constants for fast and slow components.",
        step3Title: "Invert trap features", step3Body: "Calculate energy levels, surface densities and peak classifications.",
        step4Title: "Review and export", step4Body: "Check boundary warnings and generate figures and parameter tables.",
        closeEyebrow: "Begin analysis", closeTitle: "Complete the inversion workflow in your browser", footer: "Browser-based platform for ISPD and surface-trap spectrum analysis"
      },
      analyzer: {
        backHome: "Back to project home", workspace: "Surface-potential analysis workspace", localOnly: "Local processing only", projectHome: "Project home",
        configuration: "Analysis setup", setupTitle: "Prepare measurements", setupBody: "Import time-potential data and confirm the physical parameters.",
        dataSource: "Data source", single: "Single curve", multi: "Multi-curve", importData: "Import measurements", formats: "CSV, XLSX or XLS", noFiles: "No data files loaded",
        parameters: "Physical parameters", temperature: "Temperature", frequency: "Escape frequency ν", permittivity: "Relative permittivity εr", thickness: "Insulator thickness",
        modelDetails: "View model equation", modelNote: "The fast and slow decay components represent apparent contributions from shallow and deep traps.", run: "Run physical inversion",
        results: "Analysis results", decayTitle: "Surface-potential decay kinetics", spectrumTitle: "Surface-trap spectrum", summaryTitle: "Inversion parameter summary",
        ready: "Ready", running: "Running", completed: "Complete", warning: "Check input", error: "Error",
        tabDecay: "Decay curve", tabSpectrum: "Trap spectrum", tabSummary: "Parameter summary", measured: "Measurements", fitted: "Fitted curve", clear: "Clear",
        emptyTitle: "Waiting for analysis data", spectrumEmptyTitle: "Waiting for spectrum inversion", emptyBody: "Import a file and run the inversion to display results here.",
        measuredRange: "Measured range", extrapolated: "Model extrapolation", extrapolationNote: "Dashed lines indicate model extrapolation beyond the measurement range; they do not represent directly measured data.",
        tableHint: "Parameters are summarized for the currently selected files.", exportCsv: "Export CSV", noResults: "No results available",
        statusReady: "System ready: varying initial measurement times are supported and measured ranges are separated from model extrapolation.",
        fileLoaded: "Loaded {name} ({count} points; first point at {first} s)", fileFailed: "Could not parse {name}: {message}", selectFile: "Select at least one data file.",
        calculating: "Running double-exponential fitting and trap-parameter calculations…", success: "Analysis complete: processed {count} curve(s). Dashed lines indicate extrapolation beyond the measurement range.",
        runtimeError: "Analysis error: {message}", cleared: "Charts and feature data cleared.", nothingToExport: "There is nothing to export. Complete an analysis first.",
        removeFile: "Remove file", libraryUnavailable: "The Excel parser could not load. Check the network connection and refresh the page.", exported: "Exported: {name}", popupBlocked: "The browser blocked the print window. Allow pop-ups for this site and try again.", printOpened: "The print window is open. Choose Save as PDF.",
        invalidPositive: "All times must be greater than 0 s; valid point {index} is {value} s",
        invalidOrder: "Times must increase strictly without duplicates or reversal; check {previous} s and {value} s", insufficient: "At least three valid data points are required",
        before: "Pre-first-point extrapolation", measuredRegion: "Within measured range", after: "Post-last-point extrapolation", unknown: "Unknown state", boundary: "Parameter at boundary; interpret with caution"
      },
      table: {
        file: "Dataset", firstTime: "First time (s)", shallowE: "Shallow Eₜ (eV)", shallowN: "Shallow Nₜ (m⁻²)", shallowNature: "Shallow peak class",
        deepE: "Deep Eₜ (eV)", deepN: "Deep Nₜ (m⁻²)", deepNature: "Deep peak class"
      }
    }
  };

  var listeners = [];
  var language = localStorage.getItem("ispd-language") === "en" ? "en" : "zh";

  function resolve(path, lang) {
    return path.split(".").reduce(function (value, key) { return value && value[key]; }, messages[lang || language]);
  }

  function format(value, values) {
    return String(value).replace(/\{(\w+)\}/g, function (_, key) { return values && values[key] != null ? values[key] : ""; });
  }

  function apply() {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var value = resolve(node.getAttribute("data-i18n"));
      if (value != null) node.textContent = value;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (node) {
      var value = resolve(node.getAttribute("data-i18n-html"));
      if (value != null) node.innerHTML = value;
    });
    listeners.forEach(function (listener) { listener(language); });
  }

  function setLanguage(next) {
    language = next === "en" ? "en" : "zh";
    localStorage.setItem("ispd-language", language);
    apply();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-language-toggle]").forEach(function (button) {
      button.addEventListener("click", function () { setLanguage(language === "zh" ? "en" : "zh"); });
    });
    apply();
  });

  global.ISPD_I18N = {
    t: function (path, values) { return format(resolve(path), values); },
    setLanguage: setLanguage,
    getLanguage: function () { return language; },
    subscribe: function (listener) { listeners.push(listener); }
  };
})(window);
