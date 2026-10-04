var ChartRenderer = (function() {
  "use strict";

  var FONT_FAMILY = '"Microsoft YaHei", "SimHei", "Helvetica Neue", Arial, sans-serif';
  var EXPORT_WIDTH = 1200;
  var EXPORT_HEIGHT = 800;

  function finiteValues(values) {
    return (values || []).filter(function(value) { return isFinite(value); });
  }

  function scaleFor(width, height) {
    return Math.min(width / 900, height / 600);
  }

  function line(x1, y1, x2, y2, style) {
    return Object.assign({ type: "line", x1: x1, y1: y1, x2: x2, y2: y2 }, style || {});
  }

  function rect(x, y, width, height, style) {
    return Object.assign({ type: "rect", x: x, y: y, width: width, height: height }, style || {});
  }

  function circle(cx, cy, radius, style) {
    return Object.assign({ type: "circle", cx: cx, cy: cy, radius: radius }, style || {});
  }

  function polyline(points, style) {
    return Object.assign({ type: "polyline", points: points }, style || {});
  }

  function polygon(points, style) {
    return Object.assign({ type: "polygon", points: points }, style || {});
  }

  function textItem(text, x, y, style) {
    return Object.assign({ type: "text", text: text, x: x, y: y }, style || {});
  }

  var measureContext;
  function wrapText(text, available, fontSize, bold) {
    if (!measureContext && typeof document !== "undefined" && document.createElement) {
      measureContext = document.createElement("canvas").getContext("2d");
    }
    if (measureContext) measureContext.font = (bold ? "bold " : "") + fontSize + "px " + FONT_FAMILY;
    var lines = [], current = "";
    Array.from(String(text)).forEach(function (character) {
      var next = current + character;
      var width = measureContext ? measureContext.measureText(next).width : Array.from(next).length * fontSize;
      if (character === "\n") { lines.push(current); current = ""; }
      else if (current && width > available) { lines.push(current); current = character; }
      else current = next;
    });
    lines.push(current);
    return lines;
  }

  function chartText(key, options, values) {
    return ISPD_I18N.t("chart." + key, values, options && options.language);
  }

  function layoutScene(datasets, width, height, spectrum, options) {
    // Scale is fixed from the requested size, not the expanded legend height.
    var scale = scaleFor(width, height), right = width * 0.25;
    var margin = { left: (spectrum ? 100 : 90) * scale, right: right, top: 55 * scale, bottom: 80 * scale };
    var plotWidth = width - margin.left - right;
    var title = chartText(spectrum ? "spectrumTitle" : "vtTitle", options);
    var titles = wrapText(title, plotWidth, 18 * scale, true);
    margin.top += (titles.length - 1) * 23 * scale;
    var notes = spectrum ? wrapText(chartText("spectrumNote", options), plotWidth, 12 * scale) : [];
    if (notes.length) margin.bottom = (90 + notes.length * 17) * scale;
    var entries = (datasets || []).map(function (dataset, index) {
      return wrapText(dataset.label || chartText("dataset", options, {index:index + 1}), right - 54 * scale, 13 * scale);
    });
    var legendHeight = entries.reduce(function (total, lines) { return total + (24 + (lines.length - 1) * 18) * scale; }, 10 * scale);
    var actualHeight = Math.max(height, margin.top + margin.bottom + legendHeight);
    var scene = baseScene(width, actualHeight, margin, title);
    scene.scale = scale; scene.legendLines = entries; scene.titleLines = titles; scene.noteLines = notes;
    return scene;
  }

  function addLegend(scene, datasets, colors, scale) {
    var x = scene.margin.left + scene.plotWidth + 20 * scale, y = scene.margin.top + 5 * scale;
    scene.legendLines.forEach(function (lines, index) {
      scene.items.push(rect(x, y, 16 * scale, 16 * scale, { fill: colors[index % colors.length] }));
      lines.forEach(function (text, lineIndex) {
        scene.items.push(textItem(text, x + 22 * scale, y + 13 * scale + lineIndex * 18 * scale,
          { fill: "#333333", anchor: "start", fontSize: 13 * scale }));
      });
      y += (24 + (lines.length - 1) * 18) * scale;
    });
  }

  function addTitle(scene) {
    scene.titleLines.forEach(function (text, index) {
      scene.items.push(textItem(text, scene.margin.left + scene.plotWidth / 2, (33 + index * 23) * scene.scale,
        { fill: "#1a1a2e", anchor: "middle", fontSize: 18 * scene.scale, fontWeight: "bold" }));
    });
  }

  function validPoints(xs, ys, toX, toY) {
    var points = [];
    var length = Math.min((xs || []).length, (ys || []).length);
    for (var i = 0; i < length; i++) {
      if (isFinite(xs[i]) && isFinite(ys[i])) {
        points.push([toX(xs[i]), toY(ys[i])]);
      }
    }
    return points;
  }

  function starPoints(x, y, outerRadius, innerRadius) {
    var points = [];
    for (var i = 0; i < 10; i++) {
      var radius = i % 2 === 0 ? outerRadius : innerRadius;
      var angle = -Math.PI / 2 + (2 * Math.PI * i) / 10;
      points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
    return points;
  }

  function datasetPeaks(dataset) {
    if (Array.isArray(dataset.peaks)) return dataset.peaks;
    return [
      { E: dataset.shallow_E, N: dataset.shallow_N },
      { E: dataset.deep_E, N: dataset.deep_N }
    ];
  }

  function baseScene(width, height, margin, title) {
    return {
      width: width,
      height: height,
      margin: margin,
      plotWidth: width - margin.left - margin.right,
      plotHeight: height - margin.top - margin.bottom,
      title: title,
      items: []
    };
  }

  function addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale) {
    var margin = scene.margin;
    var plotWidth = scene.plotWidth;
    var plotHeight = scene.plotHeight;
    for (var i = 0; i <= 5; i++) {
      var gx = xMin + (xMax - xMin) * i / 5;
      scene.items.push(line(
        toX(gx), margin.top, toX(gx), margin.top + plotHeight,
        { stroke: "#E5E7EB", strokeWidth: 0.5 * scale }
      ));
    }
    for (var j = 0; j <= 5; j++) {
      var gy = yMin + (yMax - yMin) * j / 5;
      scene.items.push(line(
        margin.left, toY(gy), margin.left + plotWidth, toY(gy),
        { stroke: "#E5E7EB", strokeWidth: 0.5 * scale }
      ));
    }
    scene.items.push(polyline([
      [margin.left, margin.top],
      [margin.left, margin.top + plotHeight],
      [margin.left + plotWidth, margin.top + plotHeight],
      [margin.left + plotWidth, margin.top],
      [margin.left, margin.top]
    ], { fill: "none", stroke: "#333333", strokeWidth: 1.5 * scale }));
  }

  function createVtScene(datasets, colors, width, height, options) {
    var scene = layoutScene(datasets, width, height, false, options), scale = scene.scale, margin = scene.margin;
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    (datasets || []).forEach(function(dataset) {
      finiteValues(dataset.tLog).concat(finiteValues(dataset.tLogDense)).forEach(function(value) {
        xMin = Math.min(xMin, value);
        xMax = Math.max(xMax, value);
      });
      finiteValues(dataset.vRaw).concat(finiteValues(dataset.vDense)).forEach(function(value) {
        yMin = Math.min(yMin, value);
        yMax = Math.max(yMax, value);
      });
    });
    if (!isFinite(xMin)) { xMin = 0; xMax = 5; }
    if (!isFinite(yMin)) { yMin = 0; yMax = 100; }

    var xPad = 0.05 * (xMax - xMin) || 0.5;
    var yPad = 0.08 * (yMax - yMin) || 1;
    xMin -= xPad;
    xMax += xPad;
    yMin -= yPad;
    yMax += yPad;

    function toX(value) {
      return margin.left + (value - xMin) / (xMax - xMin) * scene.plotWidth;
    }
    function toY(value) {
      return margin.top + scene.plotHeight - (value - yMin) / (yMax - yMin) * scene.plotHeight;
    }

    scene.items.push(rect(0, 0, width, scene.height, { fill: "#FFFFFF" }));
    addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale);

    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      var pointCount = Math.min((dataset.tLog || []).length, (dataset.vRaw || []).length);
      for (var i = 0; i < pointCount; i++) {
        if (isFinite(dataset.tLog[i]) && isFinite(dataset.vRaw[i])) {
          scene.items.push(circle(toX(dataset.tLog[i]), toY(dataset.vRaw[i]), 4 * scale, {
            fill: color,
            opacity: 0.5,
            clip: true
          }));
        }
      }
      var curvePoints = validPoints(dataset.tLogDense, dataset.vDense, toX, toY);
      if (curvePoints.length > 0) {
        scene.items.push(polyline(curvePoints, {
          fill: "none",
          stroke: color,
          strokeWidth: 2.5 * scale,
          clip: true
        }));
      }
    });

    var textColor = "#333333";
    for (var xi = 0; xi <= 5; xi++) {
      var vx = xMin + (xMax - xMin) * xi / 5;
      scene.items.push(textItem(vx.toFixed(1), toX(vx), margin.top + scene.plotHeight + 25 * scale, {
        fill: textColor, anchor: "middle", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem(chartText("timeAxis", options), margin.left + scene.plotWidth / 2,
      margin.top + scene.plotHeight + 60 * scale, {
        fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold"
      }));
    for (var yi = 0; yi <= 5; yi++) {
      var vy = yMin + (yMax - yMin) * yi / 5;
      scene.items.push(textItem(vy.toFixed(0), margin.left - 12 * scale, toY(vy) + 5 * scale, {
        fill: textColor, anchor: "end", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem(chartText("potentialAxis", options), 20 * scale, margin.top + scene.plotHeight / 2, {
      fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold", rotate: -90
    }));
    addTitle(scene);

    addLegend(scene, datasets, colors, scale);
    return scene;
  }

  function createEtNtScene(datasets, colors, width, height, options) {
    var scene = layoutScene(datasets, width, height, true, options), scale = scene.scale, margin = scene.margin;
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    (datasets || []).forEach(function(dataset) {
      var allE = (dataset.EPreExtrapolated || dataset.EExtrapolated || [])
        .concat(dataset.EMeasured || dataset.E_t || [], dataset.EPostExtrapolated || []);
      var allN = (dataset.NPreExtrapolated || dataset.NExtrapolated || [])
        .concat(dataset.NMeasured || dataset.N_t || [], dataset.NPostExtrapolated || []);
      allE.concat(datasetPeaks(dataset).map(function(peak) { return peak.E; })).forEach(function(value) {
        if (isFinite(value) && value >= 0) {
          xMin = Math.min(xMin, value);
          xMax = Math.max(xMax, value);
        }
      });
      allN.concat(datasetPeaks(dataset).map(function(peak) { return peak.N; })).forEach(function(value) {
        if (isFinite(value) && value >= 0) {
          yMin = Math.min(yMin, value);
          yMax = Math.max(yMax, value);
        }
      });
    });
    if (!isFinite(xMin)) { xMin = 0; xMax = 2; }
    if (!isFinite(yMin)) { yMin = 0; yMax = 1e15; }

    var xPad = 0.05 * (xMax - xMin) || 0.1;
    var yPad = 0.10 * (yMax - yMin) || 1e13;
    xMin = Math.max(0, xMin - xPad);
    xMax += xPad;
    yMin = Math.max(0, yMin - yPad);
    yMax += yPad;

    function toX(value) {
      return margin.left + (value - xMin) / (xMax - xMin) * scene.plotWidth;
    }
    function toY(value) {
      return margin.top + scene.plotHeight - (value - yMin) / (yMax - yMin) * scene.plotHeight;
    }

    scene.items.push(rect(0, 0, width, scene.height, { fill: "#FFFFFF" }));
    addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale);

    function addCurve(energies, densities, color, dashed) {
      var points = validPoints(energies, densities, toX, toY);
      if (points.length > 0) {
        scene.items.push(polyline(points, {
          fill: "none",
          stroke: color,
          strokeWidth: 2.5 * scale,
          dash: dashed ? [9 * scale, 6 * scale] : null,
          clip: true
        }));
      }
    }

    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      addCurve(
        dataset.EPreExtrapolated || dataset.EExtrapolated || [],
        dataset.NPreExtrapolated || dataset.NExtrapolated || [],
        color,
        true
      );
      addCurve(dataset.EMeasured || dataset.E_t || [], dataset.NMeasured || dataset.N_t || [], color, false);
      addCurve(dataset.EPostExtrapolated || [], dataset.NPostExtrapolated || [], color, true);

      datasetPeaks(dataset).forEach(function(peak) {
        if (isFinite(peak.E) && isFinite(peak.N)) {
          scene.items.push(polygon(starPoints(
            toX(peak.E), toY(peak.N), 12 * scale, 5 * scale
          ), { fill: color, stroke: "#FFFFFF", strokeWidth: 1.5 * scale, clip: true }));
        }
      });
    });

    var textColor = "#333333";
    for (var xi = 0; xi <= 5; xi++) {
      var vx = xMin + (xMax - xMin) * xi / 5;
      scene.items.push(textItem(vx.toFixed(2), toX(vx), margin.top + scene.plotHeight + 25 * scale, {
        fill: textColor, anchor: "middle", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem(chartText("energyAxis", options), margin.left + scene.plotWidth / 2,
      margin.top + scene.plotHeight + 60 * scale, {
        fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold"
      }));
    scene.noteLines.forEach(function (text, index) {
      scene.items.push(textItem(text, margin.left + scene.plotWidth / 2,
        margin.top + scene.plotHeight + (84 + index * 17) * scale,
        { fill: "#475569", anchor: "middle", fontSize: 12 * scale }));
    });
    for (var yi = 0; yi <= 5; yi++) {
      var vy = yMin + (yMax - yMin) * yi / 5;
      scene.items.push(textItem(vy.toExponential(1), margin.left - 12 * scale, toY(vy) + 5 * scale, {
        fill: textColor, anchor: "end", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem(chartText("densityAxis", options), 18 * scale, margin.top + scene.plotHeight / 2, {
      fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold", rotate: -90
    }));
    addTitle(scene);

    addLegend(scene, datasets, colors, scale);
    return scene;
  }

  function applyCanvasStyle(ctx, item) {
    ctx.globalAlpha = item.opacity == null ? 1 : item.opacity;
    ctx.fillStyle = item.fill || "transparent";
    ctx.strokeStyle = item.stroke || "transparent";
    ctx.lineWidth = item.strokeWidth || 1;
    ctx.setLineDash(item.dash || []);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  function renderCanvasItem(ctx, item) {
    applyCanvasStyle(ctx, item);
    if (item.type === "rect") {
      if (item.fill && item.fill !== "none") ctx.fillRect(item.x, item.y, item.width, item.height);
      if (item.stroke && item.stroke !== "none") ctx.strokeRect(item.x, item.y, item.width, item.height);
    } else if (item.type === "line") {
      ctx.beginPath();
      ctx.moveTo(item.x1, item.y1);
      ctx.lineTo(item.x2, item.y2);
      ctx.stroke();
    } else if (item.type === "circle") {
      ctx.beginPath();
      ctx.arc(item.cx, item.cy, item.radius, 0, 2 * Math.PI);
      if (item.fill && item.fill !== "none") ctx.fill();
      if (item.stroke && item.stroke !== "none") ctx.stroke();
    } else if (item.type === "polyline" || item.type === "polygon") {
      if (!item.points || item.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(item.points[0][0], item.points[0][1]);
      for (var i = 1; i < item.points.length; i++) ctx.lineTo(item.points[i][0], item.points[i][1]);
      if (item.type === "polygon") ctx.closePath();
      if (item.fill && item.fill !== "none") ctx.fill();
      if (item.stroke && item.stroke !== "none") ctx.stroke();
    } else if (item.type === "text") {
      ctx.fillStyle = item.fill || "#333333";
      ctx.textAlign = item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = (item.fontWeight ? item.fontWeight + " " : "") + item.fontSize + "px " + FONT_FAMILY;
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.rotate) ctx.rotate(item.rotate * Math.PI / 180);
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }
  }

  function renderCanvas(canvas, scene) {
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = scene.width * dpr;
    canvas.height = scene.height * dpr;
    canvas.style.width = scene.width + "px";
    canvas.style.height = scene.height + "px";
    ctx.scale(dpr, dpr);
    scene.items.forEach(function(item) {
      if (item.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(scene.margin.left, scene.margin.top, scene.plotWidth, scene.plotHeight);
        ctx.clip();
        renderCanvasItem(ctx, item);
        ctx.restore();
      } else {
        renderCanvasItem(ctx, item);
      }
    });
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function number(value) {
    return Number(value.toFixed(3));
  }

  function svgStyle(item) {
    var attrs = [];
    if (item.fill != null) attrs.push('fill="' + escapeXml(item.fill) + '"');
    else if (item.type !== "text") attrs.push('fill="none"');
    if (item.stroke != null) attrs.push('stroke="' + escapeXml(item.stroke) + '"');
    if (item.strokeWidth != null) attrs.push('stroke-width="' + number(item.strokeWidth) + '"');
    if (item.opacity != null) attrs.push('opacity="' + item.opacity + '"');
    if (item.dash && item.dash.length) attrs.push('stroke-dasharray="' + item.dash.map(number).join(" ") + '"');
    if (item.clip) attrs.push('clip-path="url(#plot-clip)"');
    if (item.type === "polyline" || item.type === "polygon" || item.type === "line") {
      attrs.push('stroke-linejoin="round" stroke-linecap="round"');
    }
    return attrs.join(" ");
  }

  function svgItem(item) {
    var style = svgStyle(item);
    if (item.type === "rect") {
      return '<rect x="' + number(item.x) + '" y="' + number(item.y) + '" width="' +
        number(item.width) + '" height="' + number(item.height) + '" ' + style + '/>';
    }
    if (item.type === "line") {
      return '<line x1="' + number(item.x1) + '" y1="' + number(item.y1) + '" x2="' +
        number(item.x2) + '" y2="' + number(item.y2) + '" ' + style + '/>';
    }
    if (item.type === "circle") {
      return '<circle cx="' + number(item.cx) + '" cy="' + number(item.cy) + '" r="' +
        number(item.radius) + '" ' + style + '/>';
    }
    if (item.type === "polyline" || item.type === "polygon") {
      var points = item.points.map(function(point) {
        return number(point[0]) + "," + number(point[1]);
      }).join(" ");
      return '<' + item.type + ' points="' + points + '" ' + style + '/>';
    }
    if (item.type === "text") {
      var transform = item.rotate ? ' transform="rotate(' + item.rotate + " " + number(item.x) + " " + number(item.y) + ')"' : "";
      return '<text x="' + number(item.x) + '" y="' + number(item.y) + '" text-anchor="' +
        (item.anchor || "start") + '" font-family="' + escapeXml(FONT_FAMILY) + '" font-size="' +
        number(item.fontSize) + '"' + (item.fontWeight ? ' font-weight="' + item.fontWeight + '"' : "") +
        ' fill="' + escapeXml(item.fill || "#333333") + '"' + transform + '>' + escapeXml(item.text) + '</text>';
    }
    return "";
  }

  function sceneToSvg(scene) {
    var clip = '<defs><clipPath id="plot-clip"><rect x="' + number(scene.margin.left) +
      '" y="' + number(scene.margin.top) + '" width="' + number(scene.plotWidth) +
      '" height="' + number(scene.plotHeight) + '"/></clipPath></defs>';
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + scene.width + '" height="' + scene.height +
      '" viewBox="0 0 ' + scene.width + " " + scene.height +
      '" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">' +
      '<title>' + escapeXml(scene.title) + '</title>' + clip + scene.items.map(svgItem).join("") + '</svg>';
  }

  function canvasSize(canvas) {
    var parent = canvas.parentElement;
    return {
      width: parent.clientWidth > 100 ? parent.clientWidth : 900,
      height: Math.max(420, parent.clientHeight || 600)
    };
  }

  function exportSize(options) {
    options = options || {};
    return {
      width: options.width || EXPORT_WIDTH,
      height: options.height || EXPORT_HEIGHT
    };
  }

  return {
    drawVtChart: function(canvas, datasets, colors, options) {
      var size = canvasSize(canvas);
      renderCanvas(canvas, createVtScene(datasets, colors, size.width, size.height, options));
    },

    drawEtNtChart: function(canvas, datasets, colors, options) {
      var size = canvasSize(canvas);
      renderCanvas(canvas, createEtNtScene(datasets, colors, size.width, size.height, options));
    },

    exportVtSvg: function(datasets, colors, options) {
      var size = exportSize(options);
      return sceneToSvg(createVtScene(datasets, colors, size.width, size.height, options));
    },

    exportEtNtSvg: function(datasets, colors, options) {
      var size = exportSize(options);
      return sceneToSvg(createEtNtScene(datasets, colors, size.width, size.height, options));
    }
  };
})();
