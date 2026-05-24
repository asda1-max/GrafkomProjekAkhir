/* ================================================================
   GRAFIKA KOMPUTER 2D — INTERACTIVE EDITOR
   app.js  |  Kelompok 2
================================================================ */
"use strict";

// ── SETUP ──────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d", { willReadFrequently: true });
const W      = canvas.width;
const H      = canvas.height;
const canvasWrap = document.querySelector(".canvas-wrap");

// ── DOM REFS ───────────────────────────────────────────────────
const statusMsg     = document.getElementById("status-msg");
const statusDot     = document.getElementById("status-dot");
const coordDisplay  = document.getElementById("coord-display");
const objCount      = document.getElementById("obj-count");
const toolModeEl    = document.getElementById("tool-mode");
const algoLabel     = document.getElementById("algo-label");
const selectedLabel = document.getElementById("selected-label");
const matrixTable   = document.getElementById("matrix-table");

const strokeColorEl = document.getElementById("stroke-color");
const fillColorEl   = document.getElementById("fill-color");
const pixelSizeEl   = document.getElementById("pixel-size");
const pixelSizeVal  = document.getElementById("pixel-size-val");
const lineTypeEl    = document.getElementById("line-type");
const eraserSizeEl  = document.getElementById("eraser-size");
const eraserSizeVal = document.getElementById("eraser-size-val");

const showGridEl    = document.getElementById("show-grid");
const showCoordEl   = document.getElementById("show-coord");
const showAxesEl    = document.getElementById("show-axes");
const zoomSlider    = document.getElementById("zoom");
const zoomValEl     = document.getElementById("zoom-val");

const txSlider    = document.getElementById("tx");
const tySlider    = document.getElementById("ty");
const rotSlider   = document.getElementById("rot");
const scaleSlider = document.getElementById("scale");
const shxSlider   = document.getElementById("shx");
const shySlider   = document.getElementById("shy");
const txValEl     = document.getElementById("tx-val");
const tyValEl     = document.getElementById("ty-val");
const rotValEl    = document.getElementById("rot-val");
const scaleValEl  = document.getElementById("scale-val");
const shxValEl    = document.getElementById("shx-val");
const shyValEl    = document.getElementById("shy-val");
const txNum       = document.getElementById("tx-num");
const tyNum       = document.getElementById("ty-num");
const rotNum      = document.getElementById("rot-num");

const selectPrevBtn = document.getElementById("select-prev");
const selectNextBtn = document.getElementById("select-next");
const resetTransBtn = document.getElementById("reset-transform");
const deleteSelBtn  = document.getElementById("delete-selected");
const reflXBtn      = document.getElementById("reflect-x");
const reflYBtn      = document.getElementById("reflect-y");
const reflOriginBtn = document.getElementById("reflect-origin");
const reflYXBtn     = document.getElementById("reflect-yx");
const toggleAnimBtn = document.getElementById("toggle-anim");
const resetAnimBtn  = document.getElementById("reset-anim");
const speedSlider   = document.getElementById("speed");
const speedValEl    = document.getElementById("speed-val");
const savePngBtn    = document.getElementById("save-png");
const clearCanvasBtn= document.getElementById("clear-canvas");
const undoBtn       = document.getElementById("undo-btn");
const redoBtn       = document.getElementById("redo-btn");
const finishPolyBtn = document.getElementById("finish-polygon");
const cancelPolyBtn = document.getElementById("cancel-polygon");
const polygonCtrl   = document.getElementById("polygon-ctrl");
const toolButtons   = document.querySelectorAll(".tool-btn");
const eraserGroup   = document.getElementById("eraser-group");

// Theme toggle
const themeBtn = document.getElementById("theme-btn");
let isDark = true;
themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  themeBtn.textContent = isDark ? "🌙" : "☀️";
});

// Info panel
const infoTrigger = document.getElementById("info-trigger-btn");
const infoPanel   = document.getElementById("info-panel");
const infoOverlay = document.getElementById("info-overlay");
const closeInfoBtn= document.getElementById("close-info-btn");

function openInfoPanel()  { infoPanel.classList.add("open"); infoOverlay.classList.add("open"); }
function closeInfoPanel() { infoPanel.classList.remove("open"); infoOverlay.classList.remove("open"); }
infoTrigger.addEventListener("click", openInfoPanel);
closeInfoBtn.addEventListener("click", closeInfoPanel);
infoOverlay.addEventListener("click", closeInfoPanel);

// Panel tabs
document.querySelectorAll(".ptab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".ptab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// Zoom buttons
document.getElementById("zoom-out-btn").addEventListener("click", () => {
  zoomSlider.value = Math.max(20, Number(zoomSlider.value) - 10);
  zoomSlider.dispatchEvent(new Event("input"));
});
document.getElementById("zoom-in-btn").addEventListener("click", () => {
  zoomSlider.value = Math.min(300, Number(zoomSlider.value) + 10);
  zoomSlider.dispatchEvent(new Event("input"));
});

// ── STATE ──────────────────────────────────────────────────────
let activeTool    = "point";
let shapes        = [];
let selectedIndex = -1;
let isAnimating   = false;
let animFrameId   = null;
let isDrawing     = false;
let startPt       = null;
let currentPt     = null;
let isDragging    = false;
let dragOffsetX   = 0;
let dragOffsetY   = 0;
let polygonPts    = [];
let undoStack     = [];
let redoStack     = [];
let zoom          = 1;
let mouseX        = 0;
let mouseY        = 0;
let fillLayerData = null;
let eraseStrokes  = [];

// Freehand drawing state
let pencilPath    = [];   // accumulated points for current stroke
let isPainting    = false; // true while mouse held in pencil/eraser mode
let currentEraseStroke = null;

// ── TOOL INFO ──────────────────────────────────────────────────
const TOOL_INFO = {
  point:     { label: "Titik",        algo: "setPixel(x, y) — Raster Point" },
  line:      { label: "Garis (DDA)",  algo: "Digital Differential Analyzer" },
  bresenham: { label: "Bresenham",    algo: "Bresenham Line — Integer-only" },
  circle:    { label: "Lingkaran",    algo: "Midpoint Circle — 8-fold sym" },
  ellipse:   { label: "Elips",        algo: "Midpoint Ellipse — 4-fold sym" },
  rect:      { label: "Persegi",      algo: "DDA × 4 sisi" },
  polygon:   { label: "Poligon",      algo: "DDA per segmen" },
  fill:      { label: "Flood Fill",   algo: "Scanline Flood Fill (queue)" },
  scanline:  { label: "Scan-Line",    algo: "Scan-Line Polygon Fill (AEL)" },
  select:    { label: "Cursor",       algo: "Hit-test geometri" },
  pencil:    { label: "Pensil",       algo: "Freehand — continuous DDA stroke" },
  eraser:    { label: "Penghapus",    algo: "MS Paint-style erase overlay" },
};

// ── UTILS ──────────────────────────────────────────────────────
const toRad = d => (d * Math.PI) / 180;

function setStatus(msg, type = "ok") {
  statusMsg.textContent = msg;
  statusDot.style.background = type === "ok" ? "var(--green)"
    : type === "warn" ? "var(--amber)"
    : "var(--red)";
}

function getMousePos(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top)  * scaleY),
  };
}

function getFitCanvasWidth() {
  if (!canvasWrap) return W;
  const styles = getComputedStyle(canvasWrap);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availableW = Math.max(240, canvasWrap.clientWidth - padX);
  const availableH = Math.max(180, canvasWrap.clientHeight - padY);
  return Math.min(W, availableW, availableH * (W / H));
}

function updateCanvasZoom() {
  const fitWidth = getFitCanvasWidth();
  canvas.style.width = `${Math.max(160, Math.round(fitWidth * zoom))}px`;
  zoomValEl.textContent = `${Math.round(zoom * 100)}%`;
}

function updateObjCount() {
  objCount.textContent = `Objek: ${shapes.length}`;
}

// ── TOOL MANAGEMENT ────────────────────────────────────────────
function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
  const info = TOOL_INFO[tool] || {};
  toolModeEl.textContent  = info.label || tool;
  algoLabel.textContent   = info.algo  || "—";
  polygonCtrl.style.display = (tool === "polygon" || tool === "scanline") ? "flex" : "none";
  eraserGroup.style.display = (tool === "eraser") ? "flex" : "none";
  isDrawing = false; startPt = null; currentPt = null; isPainting = false; pencilPath = [];
  if (tool !== "polygon" && tool !== "scanline") polygonPts = [];
  setStatus(`Mode: ${info.label}. ${getHint(tool)}`);

  // Update cursor classes
  canvas.classList.remove("cursor-pencil", "cursor-eraser", "cursor-select");
  if (tool === "pencil") canvas.classList.add("cursor-pencil");
  if (tool === "eraser") canvas.classList.add("cursor-eraser");
  if (tool === "select") canvas.classList.add("cursor-select");
}

function getHint(t) {
  return {
    point:     "Klik untuk meletakkan titik.",
    line:      "Klik awal → klik akhir (drag).",
    bresenham: "Klik awal → klik akhir (drag).",
    circle:    "Klik pusat → drag radius.",
    ellipse:   "Klik pojok → drag ukuran.",
    rect:      "Klik pojok → drag.",
    polygon:   "Klik titik-titik, lalu klik Selesai.",
    scanline:  "Klik titik-titik, lalu klik Selesai Poligon.",
    fill:      "Klik area terbuka untuk flood fill.",
    select:    "Klik objek untuk memilih. Drag pindahkan. Tidak membuat objek baru.",
    pencil:    "Tahan dan gerak mouse untuk menggambar bebas.",
    eraser:    "Tahan dan gerak mouse untuk menghapus.",
  }[t] || "";
}

// ── ALGORITMA GARIS: DDA ────────────────────────────────────────
function ddaLine(x1, y1, x2, y2) {
  const pts = [];
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) { pts.push({ x: x1, y: y1 }); return pts; }
  const xi = dx / steps, yi = dy / steps;
  let x = x1, y = y1;
  for (let i = 0; i <= steps; i++) {
    pts.push({ x: Math.round(x), y: Math.round(y) });
    x += xi; y += yi;
  }
  return pts;
}

// ── ALGORITMA GARIS: BRESENHAM ─────────────────────────────────
function bresenhamLine(x1, y1, x2, y2) {
  const pts = [];
  let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let x = x1, y = y1, err = dx - dy;
  while (true) {
    pts.push({ x, y });
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
  return pts;
}

// ── MIDPOINT CIRCLE ────────────────────────────────────────────
function midpointCircle(r) {
  const pts = [];
  let x = 0, y = Math.round(r), p = 1 - Math.round(r);
  function sym(cx, cy) {
    for (const [a, b] of [[cx,cy],[-cx,cy],[cx,-cy],[-cx,-cy],[cy,cx],[-cy,cx],[cy,-cx],[-cy,-cx]])
      pts.push({ x: a, y: b });
  }
  while (x <= y) {
    sym(x, y);
    if (p < 0) p += 2 * x + 3;
    else { p += 2 * (x - y) + 5; y--; }
    x++;
  }
  return pts;
}

// ── MIDPOINT ELLIPSE ───────────────────────────────────────────
function midpointEllipse(rx, ry) {
  const pts = [];
  rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry));
  const rx2 = rx * rx, ry2 = ry * ry;
  function sym(cx, cy) {
    pts.push({x:cx,y:cy},{x:-cx,y:cy},{x:cx,y:-cy},{x:-cx,y:-cy});
  }
  let x = 0, y = ry, dx = 2 * ry2 * x, dy = 2 * rx2 * y;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  while (dx < dy) {
    sym(x, y); x++; dx += 2 * ry2;
    if (p1 < 0) p1 += dx + ry2;
    else { y--; dy -= 2 * rx2; p1 += dx - dy + ry2; }
  }
  let p2 = ry2 * (x + 0.5) ** 2 + rx2 * (y - 1) ** 2 - rx2 * ry2;
  while (y >= 0) {
    sym(x, y); y--; dy -= 2 * rx2;
    if (p2 > 0) p2 += rx2 - dy;
    else { x++; dx += 2 * ry2; p2 += dx - dy + rx2; }
  }
  return pts;
}

// ── ATRIBUT TIPE GARIS ─────────────────────────────────────────
function applyLineType(pts, type) {
  if (type === "solid" || !type) return pts;
  const result = [];
  const patterns = { dashed:[6,4], dotted:[1,3], dashdot:[6,3,1,3] };
  const pat = patterns[type] || [6, 4];
  let pi = 0, count = 0, draw = true;
  for (const p of pts) {
    if (draw) result.push(p);
    count++;
    if (count >= pat[pi]) { count = 0; pi = (pi+1)%pat.length; draw = !draw; }
  }
  return result;
}

// ── TRANSFORMASI 2D ────────────────────────────────────────────
function applyMatrix(px, py, t, cx, cy) {
  const { tx, ty, rot, scale: s, shx, shy } = t;
  const a = toRad(rot), cosA = Math.cos(a), sinA = Math.sin(a);
  const shxR = shx / 100, shyR = shy / 100;
  const spx = px + shxR * py, spy = shyR * px + py;
  const scx = spx * s, scy = spy * s;
  const rx = scx * cosA - scy * sinA, ry = scx * sinA + scy * cosA;
  return { x: Math.round(cx + rx + tx), y: Math.round(cy + ry + ty) };
}

function computeMatrix(t) {
  const { tx, ty, rot, scale: s, shx, shy } = t;
  const a = toRad(rot), c = Math.cos(a), si = Math.sin(a);
  const shxR = shx / 100, shyR = shy / 100;
  const m00 = s*(c+shxR*si), m01 = s*(-si+shxR*c);
  const m10 = s*(si+shyR*c), m11 = s*(c-shyR*si);
  return [
    [+m00.toFixed(2), +m01.toFixed(2), +tx.toFixed(1)],
    [+m10.toFixed(2), +m11.toFixed(2), +ty.toFixed(1)],
    [0, 0, 1],
  ];
}

function updateMatrixDisplay(t) {
  const m = computeMatrix(t);
  const rows = matrixTable.querySelectorAll("tr");
  for (let r = 0; r < 3; r++) {
    const cells = rows[r].querySelectorAll("td");
    for (let c = 0; c < 3; c++) cells[c].textContent = m[r][c];
  }
}

// ── REFLEKSI ───────────────────────────────────────────────────
function reflectShape(shape, axis) {
  function reflPt(px, py) {
    if (axis==="x")      return {x:px, y:-py};
    if (axis==="y")      return {x:-px, y:py};
    if (axis==="origin") return {x:-px, y:-py};
    if (axis==="yx")     return {x:py, y:px};
    return {x:px, y:py};
  }
  switch (shape.type) {
    case "point": { const r=reflPt(0,0); shape.cx+=r.x; shape.cy+=r.y; break; }
    case "line": case "bresenham": { shape.p1=reflPt(shape.p1.x,shape.p1.y); shape.p2=reflPt(shape.p2.x,shape.p2.y); break; }
    case "circle": case "ellipse": case "rect": {
      const r=reflPt(shape.transform.tx,shape.transform.ty);
      shape.transform.tx=r.x; shape.transform.ty=r.y;
      if (axis==="x"||axis==="y") shape.transform.rot*=-1; break;
    }
    case "polygon": { shape.pts=shape.pts.map(p=>reflPt(p.x,p.y)); break; }
  }
}

// ── SHAPES ─────────────────────────────────────────────────────
function defaultTransform() { return { tx:0, ty:0, rot:0, scale:1, shx:0, shy:0 }; }

function createShape(type, extra) {
  return {
    id: Math.random().toString(36).slice(2),
    type, color: strokeColorEl.value, fillColor: fillColorEl.value,
    filled: false, pixelSize: Number(pixelSizeEl.value),
    lineType: lineTypeEl.value, transform: defaultTransform(),
    velocity: { x:(Math.random()-0.5)*4, y:(Math.random()-0.5)*4 },
    ...extra,
  };
}

function pushUndo() {
  undoStack.push({
    shapes: JSON.stringify(shapes),
    fillLayer: fillLayerData ? Array.from(fillLayerData.data) : null,
    paintLayer: paintLayerData ? Array.from(paintLayerData.data) : null,
    eraseStrokes: JSON.stringify(eraseStrokes),
  });
  redoStack = [];
  if (undoStack.length > 60) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push({
    shapes: JSON.stringify(shapes),
    fillLayer: fillLayerData ? Array.from(fillLayerData.data) : null,
    paintLayer: paintLayerData ? Array.from(paintLayerData.data) : null,
    eraseStrokes: JSON.stringify(eraseStrokes),
  });
  const state = undoStack.pop();
  shapes = JSON.parse(state.shapes);
  eraseStrokes = state.eraseStrokes ? JSON.parse(state.eraseStrokes) : [];
  if (state.fillLayer && fillLayerData) fillLayerData.data.set(state.fillLayer);
  else if (fillLayerData) fillLayerData.data.fill(0);
  if (state.paintLayer && paintLayerData) paintLayerData.data.set(state.paintLayer);
  else if (paintLayerData) paintLayerData.data.fill(0);
  selectedIndex = -1; updateTransformUI(null); updateObjCount(); setStatus("Undo.");
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push({
    shapes: JSON.stringify(shapes),
    fillLayer: fillLayerData ? Array.from(fillLayerData.data) : null,
    paintLayer: paintLayerData ? Array.from(paintLayerData.data) : null,
    eraseStrokes: JSON.stringify(eraseStrokes),
  });
  const state = redoStack.pop();
  shapes = JSON.parse(state.shapes);
  eraseStrokes = state.eraseStrokes ? JSON.parse(state.eraseStrokes) : [];
  if (state.fillLayer && fillLayerData) fillLayerData.data.set(state.fillLayer);
  if (state.paintLayer && paintLayerData) paintLayerData.data.set(state.paintLayer);
  selectedIndex = -1; updateTransformUI(null); updateObjCount(); setStatus("Redo.");
}

// ── PAINT LAYER (pensil & penghapus) ──────────────────────────
// Separate ImageData for freehand strokes, drawn on top of shapes
let paintLayerData = null;

function ensurePaintLayer() {
  if (!paintLayerData) paintLayerData = ctx.createImageData(W, H);
}

function paintPixel(x, y, r, g, b, a) {
  ensurePaintLayer();
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  // Alpha blending onto paint layer
  const srcA = a / 255;
  const dstA = paintLayerData.data[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) { paintLayerData.data[i+3] = 0; return; }
  paintLayerData.data[i]   = Math.round((r * srcA + paintLayerData.data[i]   * dstA * (1-srcA)) / outA);
  paintLayerData.data[i+1] = Math.round((g * srcA + paintLayerData.data[i+1] * dstA * (1-srcA)) / outA);
  paintLayerData.data[i+2] = Math.round((b * srcA + paintLayerData.data[i+2] * dstA * (1-srcA)) / outA);
  paintLayerData.data[i+3] = Math.round(outA * 255);
}

function erasePixel(x, y, radius) {
  ensurePaintLayer();
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy <= radius*radius) {
        const px = x + dx, py = y + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const i = (py * W + px) * 4;
        paintLayerData.data[i]   = 0;
        paintLayerData.data[i+1] = 0;
        paintLayerData.data[i+2] = 0;
        paintLayerData.data[i+3] = 0;
      }
    }
  }
  // Also erase from fill layer if present
  if (fillLayerData) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
          const px = x + dx, py = y + dy;
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const i = (py * W + px) * 4;
          fillLayerData.data[i+3] = 0;
        }
      }
    }
  }
}

function getPaperColor() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "#ffffff" : "#090a0e";
}

function addErasePoint(pos) {
  if (!currentEraseStroke) return;
  const last = currentEraseStroke.points[currentEraseStroke.points.length - 1];
  if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= 1) {
    currentEraseStroke.points.push({ x: pos.x, y: pos.y });
  }
}

function drawBrushStamp(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEraseStroke(stroke) {
  if (!stroke || !stroke.points.length) return;
  ctx.save();
  ctx.fillStyle = getPaperColor();
  const radius = Math.max(1, stroke.radius);
  let prev = stroke.points[0];
  drawBrushStamp(prev.x, prev.y, radius);
  for (let i = 1; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    for (const p of ddaLine(prev.x, prev.y, pt.x, pt.y)) {
      drawBrushStamp(p.x, p.y, radius);
    }
    prev = pt;
  }
  ctx.restore();
}

function drawEraseStrokes() {
  for (const stroke of eraseStrokes) drawEraseStroke(stroke);
}

/**
 * Draw a thick round-tip stroke segment from (x1,y1) to (x2,y2).
 * Uses DDA to connect, then stamps a circle at each point.
 */
function paintStroke(x1, y1, x2, y2, color, radius) {
  const { r, g, b } = hexToRGBObj(color);
  const pts = ddaLine(x1, y1, x2, y2);
  const ri = Math.ceil(radius);
  for (const pt of pts) {
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx*dx + dy*dy <= radius*radius) {
          paintPixel(pt.x + dx, pt.y + dy, r, g, b, 255);
        }
      }
    }
  }
}

function hexToRGBObj(hex) {
  return {
    r: parseInt(hex.slice(1,3), 16),
    g: parseInt(hex.slice(3,5), 16),
    b: parseInt(hex.slice(5,7), 16),
  };
}

// ── PIXEL PLOTTING ─────────────────────────────────────────────
function renderPts(localPts, transform, cx, cy, color, size, lineType) {
  const filtered = applyLineType(localPts, lineType);
  ctx.fillStyle = color;
  for (const p of filtered) {
    const w = applyMatrix(p.x, p.y, transform, cx, cy);
    ctx.fillRect(w.x, w.y, size, size);
  }
}

// ── GRID ───────────────────────────────────────────────────────
function drawGrid() {
  const step = 40;
  ctx.save();
  ctx.strokeStyle = document.documentElement.getAttribute("data-theme") === "light" ? "#d8dae4" : "#13151d";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  ctx.restore();
}

function drawAxes() {
  ctx.save();
  ctx.strokeStyle = document.documentElement.getAttribute("data-theme") === "light" ? "#c8ccd8" : "#1e2235";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
  ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "light" ? "#b0b4c2" : "#2a2e42";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("(0,0)", W/2+4, H/2-4);
  ctx.restore();
}

// ── RENDER SHAPES ─────────────────────────────────────────────
function renderPoint(s) {
  const p = applyMatrix(0, 0, s.transform, s.cx, s.cy);
  const r = s.pixelSize + 2;
  ctx.fillStyle = s.color;
  ctx.fillRect(p.x - r/2, p.y - r/2, r, r);
  ctx.fillStyle = "#fff";
  ctx.fillRect(p.x, p.y, 1, 1);
}

function renderLine(s) {
  const lineFn = s.type === "bresenham" ? bresenhamLine : ddaLine;
  renderPts(lineFn(s.p1.x, s.p1.y, s.p2.x, s.p2.y), s.transform, s.cx, s.cy, s.color, s.pixelSize, s.lineType);
}

function renderCircle(s) {
  if (s.filled) fillCircle(s);
  renderPts(midpointCircle(s.r), s.transform, s.cx, s.cy, s.color, s.pixelSize, s.lineType);
}

function renderEllipse(s) {
  if (s.filled) fillEllipse(s);
  renderPts(midpointEllipse(s.rx, s.ry), s.transform, s.cx, s.cy, s.color, s.pixelSize, s.lineType);
}

function renderRect(s) {
  if (s.filled) fillRectShape(s);
  const { hw, hh } = s;
  const edges = [
    ddaLine(-hw,-hh,hw,-hh), ddaLine(hw,-hh,hw,hh),
    ddaLine(hw,hh,-hw,hh),   ddaLine(-hw,hh,-hw,-hh),
  ];
  for (const seg of edges) renderPts(seg, s.transform, s.cx, s.cy, s.color, s.pixelSize, s.lineType);
}

function renderPolygon(s) {
  if (s.pts.length < 2) return;
  if (s.filled) scanLineFillPolygon(s);
  for (let i = 0; i < s.pts.length; i++) {
    const a = s.pts[i], b = s.pts[(i+1)%s.pts.length];
    renderPts(ddaLine(a.x,a.y,b.x,b.y), s.transform, s.cx, s.cy, s.color, s.pixelSize, s.lineType);
  }
}

function fillCircle(s) {
  ctx.fillStyle = s.fillColor;
  for (let y = -s.r; y <= s.r; y++) {
    const xMax = Math.floor(Math.sqrt(s.r * s.r - y * y));
    const a = applyMatrix(-xMax, y, s.transform, s.cx, s.cy);
    const b = applyMatrix(xMax, y, s.transform, s.cx, s.cy);
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(1, Math.abs(b.x - a.x) + 1), Math.max(1, Math.abs(b.y - a.y) + 1));
  }
}

function fillEllipse(s) {
  ctx.fillStyle = s.fillColor;
  for (let y = -s.ry; y <= s.ry; y++) {
    const xMax = Math.floor(s.rx * Math.sqrt(Math.max(0, 1 - (y * y) / (s.ry * s.ry))));
    const a = applyMatrix(-xMax, y, s.transform, s.cx, s.cy);
    const b = applyMatrix(xMax, y, s.transform, s.cx, s.cy);
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(1, Math.abs(b.x - a.x) + 1), Math.max(1, Math.abs(b.y - a.y) + 1));
  }
}

function fillRectShape(s) {
  ctx.fillStyle = s.fillColor;
  if (s.transform.rot === 0 && s.transform.shx === 0 && s.transform.shy === 0) {
    const a = applyMatrix(-s.hw, -s.hh, s.transform, s.cx, s.cy);
    const b = applyMatrix(s.hw, s.hh, s.transform, s.cx, s.cy);
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    return;
  }
  const pts = [
    applyMatrix(-s.hw, -s.hh, s.transform, s.cx, s.cy),
    applyMatrix(s.hw, -s.hh, s.transform, s.cx, s.cy),
    applyMatrix(s.hw, s.hh, s.transform, s.cx, s.cy),
    applyMatrix(-s.hw, s.hh, s.transform, s.cx, s.cy),
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// ── SCAN-LINE FILL ─────────────────────────────────────────────
function scanLineFillPolygon(shape) {
  const { pts, transform, cx, cy, fillColor } = shape;
  if (pts.length < 3) return;
  const world = pts.map(p => applyMatrix(p.x, p.y, transform, cx, cy));
  let yMin = Infinity, yMax = -Infinity;
  for (const p of world) { if(p.y<yMin)yMin=p.y; if(p.y>yMax)yMax=p.y; }
  yMin = Math.ceil(yMin); yMax = Math.floor(yMax);
  ctx.fillStyle = fillColor;
  const n = world.length;
  for (let y = yMin; y <= yMax; y++) {
    const xI = [];
    for (let i = 0; i < n; i++) {
      const a = world[i], b = world[(i+1)%n];
      if (a.y === b.y) continue;
      if (y >= Math.min(a.y,b.y) && y < Math.max(a.y,b.y))
        xI.push(a.x + (y-a.y)*(b.x-a.x)/(b.y-a.y));
    }
    xI.sort((a,b)=>a-b);
    for (let k = 0; k+1 < xI.length; k+=2)
      ctx.fillRect(Math.round(xI[k]), y, Math.round(xI[k+1])-Math.round(xI[k]), 1);
  }
}

// ── FLOOD FILL ─────────────────────────────────────────────────
function floodFill(sx, sy, fillColorHex) {
  drawScene({ guides: false, preview: false, decorations: false });
  const canvasData = ctx.getImageData(0, 0, W, H);
  const data = canvasData.data;
  const rx = Math.max(0, Math.min(W - 1, Math.round(sx)));
  const ry = Math.max(0, Math.min(H - 1, Math.round(sy)));
  const idx = (ry*W+rx)*4;
  const target = { r:data[idx], g:data[idx+1], b:data[idx+2], a:data[idx+3] };
  const fill = hexToRGBA(fillColorHex);
  if (target.r===fill.r&&target.g===fill.g&&target.b===fill.b&&target.a===fill.a) return 0;
  if (!fillLayerData) fillLayerData = ctx.createImageData(W,H);
  const visited = new Uint8Array(W*H);
  function colorMatch(i) { return sameColorAt(data, i, target); }
  const queue = [[rx,ry]];
  let painted = 0;
  while (queue.length) {
    const [x,y] = queue.pop();
    if (x<0||x>=W||y<0||y>=H||visited[y*W+x]) continue;
    let left=x; while(left>0&&!visited[y*W+left-1]&&colorMatch((y*W+left-1)*4))left--;
    let right=x; while(right<W-1&&!visited[y*W+right+1]&&colorMatch((y*W+right+1)*4))right++;
    for (let i=left;i<=right;i++) {
      if(visited[y*W+i]) continue;
      const pi=(y*W+i)*4;
      if(!colorMatch(pi)) continue;
      const fpi=(y*W+i)*4;
      fillLayerData.data[fpi]=fill.r; fillLayerData.data[fpi+1]=fill.g;
      fillLayerData.data[fpi+2]=fill.b; fillLayerData.data[fpi+3]=255;
      data[pi]=fill.r; data[pi+1]=fill.g; data[pi+2]=fill.b; data[pi+3]=255;
      painted++;
      visited[y*W+i]=1;
      if(y>0) queue.push([i,y-1]);
      if(y<H-1) queue.push([i,y+1]);
    }
  }
  return painted;
}

function hexToRGBA(hex) {
  return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16), a:255 };
}

function sameColorAt(data, index, color) {
  return data[index] === color.r &&
    data[index + 1] === color.g &&
    data[index + 2] === color.b &&
    data[index + 3] === color.a;
}

// ── SELECTION INDICATOR ────────────────────────────────────────
function drawSelectionIndicator(shape) {
  const tx = shape.cx + shape.transform.tx;
  const ty = shape.cy + shape.transform.ty;
  ctx.save();
  ctx.strokeStyle = "var(--amber, #f5a623)";
  ctx.lineWidth = 0.8; ctx.setLineDash([4,3]);
  ctx.beginPath(); ctx.arc(tx, ty, getApproxRadius(shape)+10, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = "rgba(245,166,35,0.4)"; ctx.lineWidth=0.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(tx-5,ty); ctx.lineTo(tx+5,ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx,ty-5); ctx.lineTo(tx,ty+5); ctx.stroke();
  ctx.restore();
}

function getApproxRadius(s) {
  const sc = s.transform.scale;
  switch(s.type) {
    case "point":   return 8;
    case "line": case "bresenham": return Math.hypot(s.p2.x-s.p1.x,s.p2.y-s.p1.y)/2*sc;
    case "circle":  return s.r*sc;
    case "ellipse": return Math.max(s.rx,s.ry)*sc;
    case "rect":    return Math.hypot(s.hw,s.hh)*sc;
    case "polygon": { let mx=0; for(const p of s.pts) mx=Math.max(mx,Math.hypot(p.x,p.y)); return mx*sc; }
    default: return 20;
  }
}

function drawShape(shape) {
  ctx.save();
  if (shapes[selectedIndex]?.id===shape.id) drawSelectionIndicator(shape);
  switch(shape.type) {
    case "point":     renderPoint(shape);   break;
    case "line": case "bresenham": renderLine(shape); break;
    case "circle":    renderCircle(shape);  break;
    case "ellipse":   renderEllipse(shape); break;
    case "rect":      renderRect(shape);    break;
    case "polygon":   renderPolygon(shape); break;
  }
  ctx.restore();
}

function drawShapeOnly(shape) {
  ctx.save();
  switch(shape.type) {
    case "point":     renderPoint(shape);   break;
    case "line": case "bresenham": renderLine(shape); break;
    case "circle":    renderCircle(shape);  break;
    case "ellipse":   renderEllipse(shape); break;
    case "rect":      renderRect(shape);    break;
    case "polygon":   renderPolygon(shape); break;
  }
  ctx.restore();
}

// ── PREVIEW ───────────────────────────────────────────────────
function drawPreview() {
  if (activeTool==="polygon"||activeTool==="scanline") { drawPolygonPreview(); return; }
  if (!isDrawing||!startPt||!currentPt) return;
  ctx.save(); ctx.globalAlpha=0.5;
  const color=strokeColorEl.value, sz=Number(pixelSizeEl.value), lt=lineTypeEl.value, idn=defaultTransform();
  const s=startPt, e=currentPt;
  switch(activeTool) {
    case "line": renderPts(ddaLine(s.x,s.y,e.x,e.y),idn,0,0,color,sz,lt); break;
    case "bresenham": renderPts(bresenhamLine(s.x,s.y,e.x,e.y),idn,0,0,color,sz,lt); break;
    case "circle": { const r=Math.max(2,Math.round(Math.hypot(e.x-s.x,e.y-s.y))); renderPts(midpointCircle(r),idn,s.x,s.y,color,sz,lt); break; }
    case "ellipse": { const cx=(s.x+e.x)/2,cy=(s.y+e.y)/2,rx=Math.max(2,Math.abs(e.x-s.x)/2),ry=Math.max(2,Math.abs(e.y-s.y)/2); renderPts(midpointEllipse(rx,ry),idn,cx,cy,color,sz,lt); break; }
    case "rect": { const cx=(s.x+e.x)/2,cy=(s.y+e.y)/2,hw=Math.abs(e.x-s.x)/2,hh=Math.abs(e.y-s.y)/2; const edges=[ddaLine(-hw,-hh,hw,-hh),ddaLine(hw,-hh,hw,hh),ddaLine(hw,hh,-hw,hh),ddaLine(-hw,hh,-hw,-hh)]; for(const seg of edges) renderPts(seg,idn,cx,cy,color,sz,lt); break; }
  }
  ctx.restore();
}

function drawPolygonPreview() {
  if (!polygonPts.length) return;
  ctx.save(); ctx.globalAlpha=0.55; ctx.fillStyle=strokeColorEl.value;
  const sz=Number(pixelSizeEl.value);
  for (let i=0;i<polygonPts.length-1;i++) {
    const seg=ddaLine(polygonPts[i].x,polygonPts[i].y,polygonPts[i+1].x,polygonPts[i+1].y);
    for(const p of seg) ctx.fillRect(p.x,p.y,sz,sz);
  }
  if (currentPt&&polygonPts.length>0) {
    const last=polygonPts[polygonPts.length-1];
    ctx.globalAlpha=0.25;
    const seg=ddaLine(last.x,last.y,currentPt.x,currentPt.y);
    for(const p of seg) ctx.fillRect(p.x,p.y,sz,sz);
  }
  ctx.globalAlpha=1; ctx.fillStyle="#f5a624";
  for(const pt of polygonPts) ctx.fillRect(pt.x-2,pt.y-2,5,5);
  ctx.restore();
}

// ── ERASER PREVIEW OVERLAY ─────────────────────────────────────
function drawEraserPreview() {
  if (activeTool !== "eraser") return;
  const radius = Number(eraserSizeEl.value);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── CROSSHAIR ─────────────────────────────────────────────────
function drawCrosshair() {
  ctx.save();
  ctx.strokeStyle="rgba(91,155,255,0.10)"; ctx.lineWidth=0.5; ctx.setLineDash([2,4]);
  ctx.beginPath(); ctx.moveTo(mouseX,0); ctx.lineTo(mouseX,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,mouseY); ctx.lineTo(W,mouseY); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}

// ── RENDER LOOP ────────────────────────────────────────────────
function drawScene(options = {}) {
  const { guides = true, preview = true, decorations = true } = options;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = getPaperColor();
  ctx.fillRect(0,0,W,H);
  if (decorations && showGridEl.checked)  drawGrid();
  if (decorations && showAxesEl.checked)  drawAxes();
  if (fillLayerData)        ctx.putImageData(fillLayerData, 0, 0);
  if (paintLayerData)       ctx.putImageData(paintLayerData, 0, 0);
  for (const s of shapes) decorations ? drawShape(s) : drawShapeOnly(s);
  drawEraseStrokes();
  if (preview) drawPreview();
  if (preview && activeTool === "eraser") drawEraserPreview();
  if (guides && showCoordEl.checked) drawCrosshair();
}

function render() {
  drawScene();
  requestAnimationFrame(render);
}

// ── HIT TEST ──────────────────────────────────────────────────
function hitTest(pt) {
  for(let i=shapes.length-1;i>=0;i--) if(isPointOnShape(pt,shapes[i])) return i;
  return -1;
}

function toLocalPoint(pt, shape) {
  const t = shape.transform;
  const wx = pt.x - shape.cx - t.tx;
  const wy = pt.y - shape.cy - t.ty;
  const a = -toRad(t.rot);
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const rx = wx * cosA - wy * sinA;
  const ry = wx * sinA + wy * cosA;
  const sx = rx / t.scale;
  const sy = ry / t.scale;
  const shx = t.shx / 100;
  const shy = t.shy / 100;
  const det = 1 - shx * shy;
  if (Math.abs(det) < 1e-6) return { x: sx, y: sy };
  return {
    x: (sx - shx * sy) / det,
    y: (-shy * sx + sy) / det,
  };
}

function pointInPolygon(pt, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    const crosses = ((a.y > pt.y) !== (b.y > pt.y)) &&
      (pt.x < (b.x - a.x) * (pt.y - a.y) / ((b.y - a.y) || 1e-9) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function isPointOnShape(pt, shape) {
  const local = toLocalPoint(pt, shape);
  const lx = local.x, ly = local.y;
  const tol = Math.max(10, shape.pixelSize + 8);
  switch(shape.type) {
    case "point":   return Math.hypot(lx,ly)<10;
    case "line": case "bresenham": return distSeg({x:lx,y:ly},shape.p1,shape.p2)<tol;
    case "circle":  return Math.hypot(lx,ly) <= shape.r + tol;
    case "ellipse": return (lx*lx)/((shape.rx+tol)*(shape.rx+tol)) + (ly*ly)/((shape.ry+tol)*(shape.ry+tol)) <= 1;
    case "rect": return Math.abs(lx) <= shape.hw + tol && Math.abs(ly) <= shape.hh + tol;
    case "polygon": {
      const p = {x:lx,y:ly};
      if (pointInPolygon(p, shape.pts)) return true;
      for(let i=0;i<shape.pts.length;i++) if(distSeg(p,shape.pts[i],shape.pts[(i+1)%shape.pts.length])<tol) return true;
      return false;
    }
  }
  return false;
}

function distSeg(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(!l2) return Math.hypot(p.x-a.x,p.y-a.y);
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

// ── ANIMASI ───────────────────────────────────────────────────
function stepAnimation() {
  const spd = Number(speedSlider.value)*0.4;
  for(const s of shapes) {
    s.cx+=s.velocity.x*spd; s.cy+=s.velocity.y*spd;
    const mg=30;
    if(s.cx<mg||s.cx>W-mg){s.velocity.x*=-1;s.cx=Math.max(mg,Math.min(W-mg,s.cx));}
    if(s.cy<mg||s.cy>H-mg){s.velocity.y*=-1;s.cy=Math.max(mg,Math.min(H-mg,s.cy));}
  }
  if(isAnimating) animFrameId=requestAnimationFrame(stepAnimation);
}

function startAnimation() { if(isAnimating)return; isAnimating=true; toggleAnimBtn.textContent="⏹ Stop"; stepAnimation(); }
function stopAnimation()  { isAnimating=false; toggleAnimBtn.textContent="▶ Start"; if(animFrameId)cancelAnimationFrame(animFrameId); }

// ── UI TRANSFORM ──────────────────────────────────────────────
function updateTransformUI(shape) {
  if(!shape) {
    [txSlider,tySlider,rotSlider,shxSlider,shySlider].forEach(s=>s.value=0);
    scaleSlider.value=100;
    txValEl.textContent=tyValEl.textContent=shxValEl.textContent=shyValEl.textContent="0";
    rotValEl.textContent="0°"; scaleValEl.textContent="1.00×";
    txNum.value=tyNum.value=rotNum.value=0;
    selectedLabel.textContent="Tidak ada";
    updateMatrixDisplay(defaultTransform());
    return;
  }
  const t=shape.transform;
  txSlider.value=t.tx; tySlider.value=t.ty; rotSlider.value=t.rot;
  scaleSlider.value=Math.round(t.scale*100); shxSlider.value=t.shx; shySlider.value=t.shy;
  txValEl.textContent=t.tx; tyValEl.textContent=t.ty;
  rotValEl.textContent=`${t.rot}°`; scaleValEl.textContent=`${t.scale.toFixed(2)}×`;
  shxValEl.textContent=t.shx; shyValEl.textContent=t.shy;
  txNum.value=t.tx; tyNum.value=t.ty; rotNum.value=t.rot;
  selectedLabel.textContent=`#${shapes.indexOf(shape)+1} ${shape.type}`;
  updateMatrixDisplay(t);
}

function syncFromSliders() {
  if(selectedIndex<0) return;
  const s=shapes[selectedIndex];
  s.transform.tx=Number(txSlider.value); s.transform.ty=Number(tySlider.value);
  s.transform.rot=Number(rotSlider.value); s.transform.scale=Number(scaleSlider.value)/100;
  s.transform.shx=Number(shxSlider.value); s.transform.shy=Number(shySlider.value);
  txValEl.textContent=s.transform.tx; tyValEl.textContent=s.transform.ty;
  rotValEl.textContent=`${s.transform.rot}°`; scaleValEl.textContent=`${s.transform.scale.toFixed(2)}×`;
  shxValEl.textContent=s.transform.shx; shyValEl.textContent=s.transform.shy;
  txNum.value=s.transform.tx; tyNum.value=s.transform.ty; rotNum.value=s.transform.rot;
  updateMatrixDisplay(s.transform);
}

function syncFromNumbers() {
  if(selectedIndex<0) return;
  const s=shapes[selectedIndex];
  s.transform.tx=Number(txNum.value)||0; s.transform.ty=Number(tyNum.value)||0; s.transform.rot=Number(rotNum.value)||0;
  txSlider.value=s.transform.tx; tySlider.value=s.transform.ty; rotSlider.value=s.transform.rot;
  txValEl.textContent=s.transform.tx; tyValEl.textContent=s.transform.ty; rotValEl.textContent=`${s.transform.rot}°`;
  updateMatrixDisplay(s.transform);
}

function selectShape(index) {
  if(!shapes.length){selectedIndex=-1;updateTransformUI(null);return;}
  selectedIndex=((index%shapes.length)+shapes.length)%shapes.length;
  updateTransformUI(shapes[selectedIndex]);
  setStatus(`Terpilih: ${shapes[selectedIndex].type} #${selectedIndex+1}`);
  document.querySelector('.ptab[data-tab="transform"]').click();
}

function deleteSelected() {
  if(selectedIndex<0||selectedIndex>=shapes.length) return;
  pushUndo(); shapes.splice(selectedIndex,1);
  selectedIndex=Math.min(selectedIndex,shapes.length-1);
  if(!shapes.length) selectedIndex=-1;
  updateTransformUI(shapes[selectedIndex]||null); updateObjCount(); setStatus("Objek dihapus.");
}

function isFillableShape(shape) {
  return shape && ["circle", "ellipse", "rect", "polygon"].includes(shape.type);
}

// ── MOUSE EVENTS ──────────────────────────────────────────────
let lastPaintPos = null;

canvas.addEventListener("mousemove", e => {
  const pos = getMousePos(e);
  mouseX = pos.x; mouseY = pos.y;
  coordDisplay.textContent = `${pos.x}, ${pos.y}`;

  if (isDragging && selectedIndex >= 0) {
    const s = shapes[selectedIndex];
    s.cx = pos.x - dragOffsetX;
    s.cy = pos.y - dragOffsetY;
    return;
  }

  // Pencil / eraser continuous drawing
  if (isPainting) {
    if (activeTool === "pencil") {
      const sz = Number(pixelSizeEl.value);
      if (lastPaintPos) {
        paintStroke(lastPaintPos.x, lastPaintPos.y, pos.x, pos.y, strokeColorEl.value, sz);
      } else {
        paintStroke(pos.x, pos.y, pos.x, pos.y, strokeColorEl.value, sz);
      }
      lastPaintPos = pos;
    } else if (activeTool === "eraser") {
      const radius = Number(eraserSizeEl.value);
      addErasePoint(pos);
      erasePixel(pos.x, pos.y, radius);
      lastPaintPos = pos;
    }
    return;
  }

  if (isDrawing && activeTool !== "polygon" && activeTool !== "scanline") currentPt = pos;
  if ((activeTool === "polygon" || activeTool === "scanline") && polygonPts.length) currentPt = pos;
});

canvas.addEventListener("mousedown", e => {
  const pos = getMousePos(e);

  if (activeTool === "pencil") {
    pushUndo();
    isPainting = true;
    lastPaintPos = pos;
    paintStroke(pos.x, pos.y, pos.x, pos.y, strokeColorEl.value, Number(pixelSizeEl.value));
    return;
  }

  if (activeTool === "eraser") {
    pushUndo();
    isPainting = true;
    lastPaintPos = pos;
    currentEraseStroke = { radius: Number(eraserSizeEl.value), points: [] };
    eraseStrokes.push(currentEraseStroke);
    addErasePoint(pos);
    erasePixel(pos.x, pos.y, currentEraseStroke.radius);
    return;
  }

  if (activeTool === "select") {
    const hit = hitTest(pos);
    if (hit >= 0) { selectShape(hit); isDragging=true; dragOffsetX=pos.x-shapes[hit].cx; dragOffsetY=pos.y-shapes[hit].cy; }
    else { selectedIndex=-1; updateTransformUI(null); }
    return;
  }

  if (activeTool === "fill") {
    const hit = hitTest(pos);
    if (hit >= 0 && isFillableShape(shapes[hit])) {
      pushUndo();
      shapes[hit].filled = true;
      shapes[hit].fillColor = fillColorEl.value;
      selectedIndex = hit;
      updateTransformUI(shapes[selectedIndex]);
      setStatus(`Bucket Fill: ${shapes[hit].type} #${hit + 1} diisi.`);
      return;
    }
    pushUndo();
    if (!fillLayerData) fillLayerData = ctx.createImageData(W,H);
    const painted = floodFill(pos.x, pos.y, fillColorEl.value);
    setStatus(painted ? `Flood Fill: ${painted} piksel diisi @ (${pos.x}, ${pos.y})` : "Area sudah memiliki warna fill.", painted ? "ok" : "warn");
    return;
  }

  if (activeTool === "polygon" || activeTool === "scanline") {
    polygonPts.push({x:pos.x,y:pos.y});
    setStatus(`Titik ${polygonPts.length} ditambahkan.`);
    return;
  }

  const hit = hitTest(pos);
  if (hit >= 0 && !isDrawing) { selectShape(hit); return; }

  if (activeTool === "point") {
    pushUndo();
    const s = createShape("point", {cx:pos.x, cy:pos.y});
    shapes.push(s); selectedIndex=shapes.length-1;
    updateTransformUI(shapes[selectedIndex]); updateObjCount();
    setStatus(`Titik @ (${pos.x}, ${pos.y})`);
    return;
  }

  if (!isDrawing) { isDrawing=true; startPt=pos; currentPt=pos; }
});

canvas.addEventListener("mouseup", e => {
  const pos = getMousePos(e);

  if (isPainting) {
    isPainting = false;
    lastPaintPos = null;
    currentEraseStroke = null;
    setStatus(`Selesai ${activeTool === "eraser" ? "menghapus" : "menggambar"}.`);
    return;
  }

  if (isDragging) { isDragging=false; pushUndo(); setStatus("Objek dipindahkan."); return; }
  if (!isDrawing) return;
  if (["point","polygon","scanline","fill","select","pencil","eraser"].includes(activeTool)) return;

  isDrawing=false; currentPt=pos;
  const s=startPt, en=pos;
  pushUndo();

  switch(activeTool) {
    case "line": case "bresenham": {
      const cx=(s.x+en.x)/2, cy=(s.y+en.y)/2;
      shapes.push(createShape(activeTool,{cx,cy,p1:{x:s.x-cx,y:s.y-cy},p2:{x:en.x-cx,y:en.y-cy}}));
      break;
    }
    case "circle":
      shapes.push(createShape("circle",{cx:s.x,cy:s.y,r:Math.max(2,Math.round(Math.hypot(en.x-s.x,en.y-s.y)))}));
      break;
    case "ellipse": {
      const cx=(s.x+en.x)/2, cy=(s.y+en.y)/2;
      const rx=Math.max(2,Math.abs(en.x-s.x)/2), ry=Math.max(2,Math.abs(en.y-s.y)/2);
      shapes.push(createShape("ellipse",{cx,cy,rx:Math.round(rx),ry:Math.round(ry)}));
      break;
    }
    case "rect": {
      const cx=(s.x+en.x)/2, cy=(s.y+en.y)/2;
      shapes.push(createShape("rect",{cx,cy,hw:Math.abs(en.x-s.x)/2,hh:Math.abs(en.y-s.y)/2}));
      break;
    }
  }

  startPt=null; currentPt=null;
  selectedIndex=shapes.length-1;
  updateTransformUI(shapes[selectedIndex]); updateObjCount(); setStatus("Objek dibuat.");
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  if (isPainting) {
    isPainting = false;
    lastPaintPos = null;
    currentEraseStroke = null;
  }
});

// ── EVENT LISTENERS ───────────────────────────────────────────
toolButtons.forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));
[txSlider,tySlider,rotSlider,scaleSlider,shxSlider,shySlider].forEach(s=>s.addEventListener("input",syncFromSliders));
txNum.addEventListener("change", syncFromNumbers);
tyNum.addEventListener("change", syncFromNumbers);
rotNum.addEventListener("change", syncFromNumbers);
pixelSizeEl.addEventListener("input", () => { pixelSizeVal.textContent = pixelSizeEl.value; });
eraserSizeEl.addEventListener("input", () => { eraserSizeVal.textContent = eraserSizeEl.value; });
zoomSlider.addEventListener("input", () => { zoom=Number(zoomSlider.value)/100; updateCanvasZoom(); });
strokeColorEl.addEventListener("input", () => { if(selectedIndex>=0) shapes[selectedIndex].color=strokeColorEl.value; });
fillColorEl.addEventListener("input", () => { if(selectedIndex>=0) shapes[selectedIndex].fillColor=fillColorEl.value; });
selectPrevBtn.addEventListener("click", () => selectShape(selectedIndex-1));
selectNextBtn.addEventListener("click", () => selectShape(selectedIndex+1));
resetTransBtn.addEventListener("click", () => { if(selectedIndex<0)return; shapes[selectedIndex].transform=defaultTransform(); updateTransformUI(shapes[selectedIndex]); setStatus("Transformasi di-reset."); });
deleteSelBtn.addEventListener("click", deleteSelected);
reflXBtn.addEventListener("click", () => doReflect("x"));
reflYBtn.addEventListener("click", () => doReflect("y"));
reflOriginBtn.addEventListener("click", () => doReflect("origin"));
reflYXBtn.addEventListener("click", () => doReflect("yx"));

function doReflect(axis) {
  if(selectedIndex<0){setStatus("Pilih objek terlebih dahulu.","warn");return;}
  pushUndo(); reflectShape(shapes[selectedIndex],axis);
  updateTransformUI(shapes[selectedIndex]);
  setStatus(`Refleksi ${axis==="x"?"Sumbu X":axis==="y"?"Sumbu Y":axis==="origin"?"terhadap Origin":"terhadap y=x"}`);
}

toggleAnimBtn.addEventListener("click", () => isAnimating ? stopAnimation() : startAnimation());
resetAnimBtn.addEventListener("click", () => {
  for(const s of shapes){s.cx=W*0.2+Math.random()*W*0.6;s.cy=H*0.2+Math.random()*H*0.6;s.velocity.x=(Math.random()-0.5)*4;s.velocity.y=(Math.random()-0.5)*4;}
  setStatus("Posisi objek direset.");
});
speedSlider.addEventListener("input", () => { speedValEl.textContent = speedSlider.value; });

savePngBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "grafkom2d.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("Canvas disimpan sebagai PNG.");
});

clearCanvasBtn.addEventListener("click", () => {
  if (!confirm("Hapus semua objek dan coretan?")) return;
  pushUndo(); shapes=[]; selectedIndex=-1; polygonPts=[]; eraseStrokes=[];
  if (fillLayerData)  fillLayerData.data.fill(0);
  if (paintLayerData) paintLayerData.data.fill(0);
  updateTransformUI(null); updateObjCount(); setStatus("Canvas dibersihkan.");
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

document.addEventListener("keydown", e => {
  if ((e.ctrlKey||e.metaKey)&&e.key==="z") { e.preventDefault(); undo(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==="y") { e.preventDefault(); redo(); }
  if ((e.key==="Delete"||e.key==="Backspace")&&(document.activeElement===document.body||document.activeElement===canvas)) deleteSelected();
  // Quick-select tools
  if (document.activeElement === document.body || document.activeElement === canvas) {
    const keyMap = { v:"select", p:"pencil", e:"eraser", f:"fill", l:"line", c:"circle" };
    if (!e.ctrlKey && !e.metaKey && !e.altKey && keyMap[e.key]) setTool(keyMap[e.key]);
  }
});

finishPolyBtn.addEventListener("click", () => {
  if(polygonPts.length<3){setStatus("Poligon butuh minimal 3 titik.","warn");return;}
  pushUndo();
  let sumX=0,sumY=0;
  for(const p of polygonPts){sumX+=p.x;sumY+=p.y;}
  const cx=sumX/polygonPts.length, cy=sumY/polygonPts.length;
  const localPts=polygonPts.map(p=>({x:p.x-cx,y:p.y-cy}));
  const isScanline=activeTool==="scanline";
  shapes.push(createShape("polygon",{cx,cy,pts:localPts,filled:isScanline}));
  polygonPts=[]; currentPt=null;
  selectedIndex=shapes.length-1; updateTransformUI(shapes[selectedIndex]); updateObjCount();
  setStatus(isScanline?"Poligon dengan Scan-Line Fill selesai.":"Poligon selesai.");
  polygonCtrl.style.display="none";
});

cancelPolyBtn.addEventListener("click", () => {
  polygonPts=[]; currentPt=null;
  setStatus("Pembuatan poligon dibatalkan.");
  polygonCtrl.style.display="none";
});

// ── INIT ──────────────────────────────────────────────────────
function init() {
  fillLayerData  = ctx.createImageData(W, H);
  paintLayerData = ctx.createImageData(W, H);
  setTool("select"); updateTransformUI(null); updateObjCount();
  speedValEl.textContent = speedSlider.value;
  pixelSizeVal.textContent = pixelSizeEl.value;
  eraserSizeVal.textContent = eraserSizeEl.value;
  zoomSlider.value = 100; zoom = 1; updateCanvasZoom();
  window.addEventListener("resize", updateCanvasZoom);
  setStatus("Siap — gunakan Cursor untuk memilih, atau pilih alat gambar seperti Pensil/Garis/Lingkaran.");
  render();
}

init();
