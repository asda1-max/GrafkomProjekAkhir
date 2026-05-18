/**
 * ============================================================
 *  GRAFIKA KOMPUTER 2D — INTERACTIVE EDITOR
 *  Tugas Kelompok: Implementasi Algoritma Primitif & Transformasi
 * ============================================================
 *
 *  Fitur yang diimplementasikan:
 *  1. Primitif: Titik, Garis (DDA), Lingkaran (Midpoint),
 *               Elips (Midpoint), Persegi, Poligon
 *  2. Fill Area: Flood Fill (scan-based, efisien)
 *  3. Transformasi 2D: Translasi, Rotasi, Skala (matriks homogen)
 *  4. Seleksi, drag, hapus objek
 *  5. Animasi bounce + pengaturan kecepatan
 *  6. Grid koordinat, indicator posisi mouse
 *  7. Simpan PNG, Undo/Redo
 * ============================================================
 */

"use strict";

// ============================================================
//  SETUP CANVAS & KONTEKS
// ============================================================

const canvas  = document.getElementById("canvas");
const ctx     = canvas.getContext("2d");

// Resolusi internal canvas (pixel space)
const W = canvas.width;   // 1200
const H = canvas.height;  // 740

// ============================================================
//  ELEMEN DOM
// ============================================================

const statusMsg      = document.getElementById("status-msg");
const coordDisplay   = document.getElementById("coord-display");
const objCount       = document.getElementById("obj-count");
const toolModeEl     = document.getElementById("tool-mode");
const algoLabel      = document.getElementById("algo-label");
const selectedLabel  = document.getElementById("selected-label");
const matrixTable    = document.getElementById("matrix-table");

// Warna
const strokeColorEl  = document.getElementById("stroke-color");
const fillColorEl    = document.getElementById("fill-color");
const pixelSizeEl    = document.getElementById("pixel-size");
const pixelSizeVal   = document.getElementById("pixel-size-val");

// Tampilan
const showGridEl     = document.getElementById("show-grid");
const showCoordEl    = document.getElementById("show-coord");
const zoomSlider     = document.getElementById("zoom");
const zoomValEl      = document.getElementById("zoom-val");

// Transformasi
const txSlider  = document.getElementById("tx");
const tySlider  = document.getElementById("ty");
const rotSlider = document.getElementById("rot");
const scaleSlider = document.getElementById("scale");
const txValEl   = document.getElementById("tx-val");
const tyValEl   = document.getElementById("ty-val");
const rotValEl  = document.getElementById("rot-val");
const scaleValEl = document.getElementById("scale-val");
const txNum     = document.getElementById("tx-num");
const tyNum     = document.getElementById("ty-num");
const rotNum    = document.getElementById("rot-num");

// Tombol
const selectPrevBtn   = document.getElementById("select-prev");
const selectNextBtn   = document.getElementById("select-next");
const resetTransBtn   = document.getElementById("reset-transform");
const deleteSelBtn    = document.getElementById("delete-selected");
const toggleAnimBtn   = document.getElementById("toggle-anim");
const resetAnimBtn    = document.getElementById("reset-anim");
const speedSlider     = document.getElementById("speed");
const speedValEl      = document.getElementById("speed-val");
const savePngBtn      = document.getElementById("save-png");
const clearCanvasBtn  = document.getElementById("clear-canvas");
const undoBtn         = document.getElementById("undo-btn");
const redoBtn         = document.getElementById("redo-btn");
const finishPolyBtn   = document.getElementById("finish-polygon");
const cancelPolyBtn   = document.getElementById("cancel-polygon");
const polygonCtrl     = document.getElementById("polygon-ctrl");

// Tool buttons
const toolButtons = document.querySelectorAll(".tool-btn");

// ============================================================
//  STATE APLIKASI
// ============================================================

let activeTool    = "point";
let shapes        = [];       // Array semua objek di canvas
let selectedIndex = -1;       // Indeks objek terpilih
let isAnimating   = false;    // Status animasi
let animFrameId   = null;

// State menggambar
let isDrawing    = false;
let startPt      = null;
let currentPt    = null;
let isDragging   = false;
let dragOffsetX  = 0;
let dragOffsetY  = 0;

// State polygon
let polygonPts   = [];        // Titik-titik sementara polygon

// Undo/Redo stacks (simpan salinan shapes)
let undoStack    = [];
let redoStack    = [];
let zoom         = 1;
let fillCanvas   = null;
let fillCtx      = null;

// Koordinat mouse (logical pixel canvas)
let mouseX = 0, mouseY = 0;

// ============================================================
//  DEFINISI TOOL & ALGORITMANYA
// ============================================================

const TOOL_INFO = {
  point:   { label: "Titik",           algo: "Algoritma: setPixel(x, y)" },
  line:    { label: "Garis (DDA)",     algo: "Algoritma: Digital Differential Analyzer (DDA)" },
  circle:  { label: "Lingkaran",       algo: "Algoritma: Midpoint Circle" },
  ellipse: { label: "Elips",           algo: "Algoritma: Midpoint Ellipse" },
  rect:    { label: "Persegi",         algo: "Algoritma: DDA ×4 sisi" },
  polygon: { label: "Poligon",         algo: "Algoritma: DDA per segmen" },
  fill:    { label: "Flood Fill",      algo: "Algoritma: Scanline Flood Fill" },
  select:  { label: "Seleksi",         algo: "Algoritma: Hit-test geometri" },
};

// ============================================================
//  UTILITAS DASAR
// ============================================================

const toRad = (deg) => (deg * Math.PI) / 180;

function setStatus(msg) {
  statusMsg.textContent = msg;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top)  * scaleY;
  return {
    x: Math.round(canvasX / zoom),
    y: Math.round(canvasY / zoom),
  };
}

function updateObjCount() {
  objCount.textContent = `Objek: ${shapes.length}`;
}

// ============================================================
//  MANAJEMEN TOOL AKTIF
// ============================================================

function setTool(tool) {
  activeTool = tool;
  // Update UI tombol
  toolButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  const info = TOOL_INFO[tool] || {};
  toolModeEl.textContent = `Mode: ${info.label || tool}`;
  algoLabel.textContent  = info.algo  || "";
  // Tampilkan kontrol polygon jika mode polygon
  polygonCtrl.style.display = (tool === "polygon") ? "flex" : "none";
  // Reset state gambar
  isDrawing  = false;
  startPt    = null;
  currentPt  = null;
  polygonPts = [];
  setStatus(`Mode ${info.label}. ${getToolHint(tool)}`);
}

function getToolHint(tool) {
  const hints = {
    point:   "Klik untuk meletakkan titik.",
    line:    "Klik titik awal, lalu klik titik akhir.",
    circle:  "Klik pusat, drag untuk menentukan jari-jari.",
    ellipse: "Klik titik awal, drag untuk menentukan ukuran.",
    rect:    "Klik titik awal, drag untuk menentukan ukuran.",
    polygon: "Klik untuk menambah titik. Tombol 'Selesai' untuk menutup.",
    fill:    "Klik area dalam objek tertutup untuk flood fill.",
    select:  "Klik objek untuk memilih. Drag untuk memindahkan.",
  };
  return hints[tool] || "";
}

// ============================================================
//  ALGORITMA PRIMITIF
// ============================================================

/**
 * DDA LINE — Digital Differential Analyzer
 *
 * Prinsip: menghitung increment dx dan dy setiap langkah.
 *   steps = max(|dx|, |dy|)
 *   xInc  = dx / steps
 *   yInc  = dy / steps
 * Setiap iterasi: x += xInc, y += yInc → plot round(x, y)
 *
 * Keunggulan: sederhana, akurat.
 * Kelemahan : menggunakan floating-point.
 */
function ddaLine(x1, y1, x2, y2) {
  const pts = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    pts.push({ x: x1, y: y1 });
    return pts;
  }
  const xInc = dx / steps;
  const yInc = dy / steps;
  let x = x1, y = y1;
  for (let i = 0; i <= steps; i++) {
    pts.push({ x: Math.round(x), y: Math.round(y) });
    x += xInc;
    y += yInc;
  }
  return pts;
}

/**
 * MIDPOINT CIRCLE ALGORITHM
 *
 * Prinsip: menggunakan parameter p (decision variable) untuk
 * menentukan apakah piksel berikutnya bergerak ke timur (E)
 * atau tenggara (SE) dari titik awal (0, r).
 *
 *   p_init = 1 - r
 *   Jika p < 0 : gerak ke E → p += 2x + 3
 *   Jika p ≥ 0 : gerak ke SE → p += 2x - 2y + 5, y--
 *   x++
 *
 * 8-fold symmetry digunakan untuk efisiensi: satu titik (x,y)
 * menghasilkan 8 titik simetri.
 */
function midpointCircle(r) {
  const pts = [];
  let x = 0, y = Math.round(r);
  let p = 1 - Math.round(r);

  function plot8(cx, cy) {
    // 8-fold symmetry
    pts.push({ x: cx,  y: cy  });
    pts.push({ x: -cx, y: cy  });
    pts.push({ x: cx,  y: -cy });
    pts.push({ x: -cx, y: -cy });
    pts.push({ x: cy,  y: cx  });
    pts.push({ x: -cy, y: cx  });
    pts.push({ x: cy,  y: -cx });
    pts.push({ x: -cy, y: -cx });
  }

  while (x <= y) {
    plot8(x, y);
    if (p < 0) {
      p += 2 * x + 3;
    } else {
      p += 2 * (x - y) + 5;
      y--;
    }
    x++;
  }
  return pts;
}

/**
 * MIDPOINT ELLIPSE ALGORITHM
 *
 * Elips: (x²/rx²) + (y²/ry²) = 1
 * Dibagi dua region:
 *
 * Region 1: slope < -1 (ry²·dx < rx²·dy)
 *   p1_init = ry² - rx²·ry + 0.25·rx²
 *   Jika p1 < 0 : gerak E → p1 += 2·ry²·x + ry²
 *   Jika p1 ≥ 0 : gerak SE → y--, p1 += 2·ry²·x - 2·rx²·y + ry²
 *   x++
 *
 * Region 2: slope > -1 (ry²·dx ≥ rx²·dy)
 *   p2 = ry²·(x+0.5)² + rx²·(y-1)² - rx²·ry²
 *   Jika p2 > 0 : gerak S → y--, p2 += rx² - 2·rx²·y
 *   Jika p2 ≤ 0 : gerak SE → x++, y--, update p2
 *
 * 4-fold symmetry: satu titik (x,y) → 4 titik simetri.
 */
function midpointEllipse(rx, ry) {
  const pts = [];
  rx = Math.round(rx);
  ry = Math.round(ry);
  if (rx <= 0 || ry <= 0) return pts;

  const rx2 = rx * rx;
  const ry2 = ry * ry;

  function plot4(cx, cy) {
    pts.push({ x: cx,  y: cy  });
    pts.push({ x: -cx, y: cy  });
    pts.push({ x: cx,  y: -cy });
    pts.push({ x: -cx, y: -cy });
  }

  let x = 0, y = ry;
  // Region 1
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  let dx = 2 * ry2 * x;
  let dy = 2 * rx2 * y;

  while (dx < dy) {
    plot4(x, y);
    x++;
    dx += 2 * ry2;
    if (p1 < 0) {
      p1 += dx + ry2;
    } else {
      y--;
      dy -= 2 * rx2;
      p1 += dx - dy + ry2;
    }
  }

  // Region 2
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    plot4(x, y);
    y--;
    dy -= 2 * rx2;
    if (p2 > 0) {
      p2 += rx2 - dy;
    } else {
      x++;
      dx += 2 * ry2;
      p2 += dx - dy + rx2;
    }
  }

  return pts;
}

// ============================================================
//  TRANSFORMASI 2D — MATRIKS HOMOGEN
//
//  Transformasi affine menggunakan koordinat homogen [x, y, 1].
//
//  Matriks Translasi T(tx, ty):
//   [ 1   0   tx ]
//   [ 0   1   ty ]
//   [ 0   0   1  ]
//
//  Matriks Rotasi R(θ):
//   [ cosθ  -sinθ  0 ]
//   [ sinθ   cosθ  0 ]
//   [ 0      0     1 ]
//
//  Matriks Skala S(sx, sy):
//   [ sx  0   0 ]
//   [ 0   sy  0 ]
//   [ 0   0   1 ]
//
//  Transformasi gabungan: M = T · R · S
//  Titik ditransformasi: P' = M · P
//
//  Rotasi dilakukan terhadap pusat objek (origin lokal),
//  sehingga objek tidak bergerak saat diputar.
// ============================================================

/**
 * Menerapkan transformasi matriks homogen ke satu titik lokal.
 * Titik lokal (px, py) relatif terhadap center objek.
 *
 * Urutan: Scale → Rotate → Translate
 * P' = T * R * S * P
 */
function applyMatrix(px, py, transform, centerX, centerY) {
  const { tx, ty, rot, scale } = transform;
  const angle = toRad(rot);
  const cosA  = Math.cos(angle);
  const sinA  = Math.sin(angle);

  // 1. Skala
  const sx = px * scale;
  const sy = py * scale;

  // 2. Rotasi
  const rx = sx * cosA - sy * sinA;
  const ry = sx * sinA + sy * cosA;

  // 3. Translasi (ke posisi dunia)
  return {
    x: Math.round(centerX + rx + tx),
    y: Math.round(centerY + ry + ty),
  };
}

/**
 * Menghitung matriks gabungan T·R·S untuk ditampilkan di UI.
 * Mengembalikan array 3×3 (nested array).
 */
function computeMatrix(transform) {
  const { tx, ty, rot, scale: s } = transform;
  const a = toRad(rot);
  const c = Math.cos(a), si = Math.sin(a);
  // T * R * S:
  // [ s·c    -s·si   tx ]
  // [ s·si    s·c    ty ]
  // [ 0       0      1  ]
  return [
    [+(s*c).toFixed(3),  +(-s*si).toFixed(3), +tx.toFixed(1)],
    [+(s*si).toFixed(3), +(s*c).toFixed(3),   +ty.toFixed(1)],
    [0,                  0,                    1             ],
  ];
}

function updateMatrixDisplay(transform) {
  const m = computeMatrix(transform);
  const rows = matrixTable.querySelectorAll("tr");
  for (let r = 0; r < 3; r++) {
    const cells = rows[r].querySelectorAll("td");
    for (let c = 0; c < 3; c++) {
      cells[c].textContent = m[r][c];
    }
  }
}

// ============================================================
//  MANAJEMEN SHAPES (OBJEK)
// ============================================================

/**
 * Membuat objek shape baru dengan properti dasar.
 */
function createShape(type, extra) {
  return {
    id:        Math.random().toString(36).slice(2),
    type,
    color:     strokeColorEl.value,
    fillColor: fillColorEl.value,
    filled:    false,             // apakah area sudah di-fill
    pixelSize: Number(pixelSizeEl.value),
    transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
    velocity:  {
      x: (Math.random() - 0.5) * 3,
      y: (Math.random() - 0.5) * 3,
    },
    ...extra,
  };
}

/**
 * Menyimpan state shapes ke undo stack.
 * Deep copy sederhana menggunakan JSON.
 */
function pushUndo() {
  undoStack.push(JSON.stringify(shapes));
  redoStack = [];
  if (undoStack.length > 50) undoStack.shift(); // batasi 50 langkah
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(shapes));
  shapes = JSON.parse(undoStack.pop());
  selectedIndex = -1;
  updateTransformUI(null);
  updateObjCount();
  setStatus("Undo.");
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(shapes));
  shapes = JSON.parse(redoStack.pop());
  selectedIndex = -1;
  updateTransformUI(null);
  updateObjCount();
  setStatus("Redo.");
}

// ============================================================
//  RENDERING PIXEL (PLOTTING)
// ============================================================

/**
 * Plot satu piksel ke canvas.
 * Mendukung pixelSize > 1 untuk tebal garis.
 */
function plotPixel(x, y, color, size) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

/**
 * Render kumpulan titik lokal setelah ditransformasi ke dunia.
 */
function renderPoints(localPts, transform, cx, cy, color, size) {
  ctx.fillStyle = color;
  for (const p of localPts) {
    const w = applyMatrix(p.x, p.y, transform, cx, cy);
    ctx.fillRect(w.x, w.y, size, size);
  }
}

// ============================================================
//  GAMBAR GRID KOORDINAT
// ============================================================

function drawGrid() {
  const step = 40;
  ctx.save();
  ctx.strokeStyle = "#252a35";
  ctx.lineWidth = 0.5;

  // Garis vertikal
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // Garis horizontal
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Garis tengah (axis)
  ctx.strokeStyle = "#2d3444";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  ctx.restore();
}

// ============================================================
//  GAMBAR SHAPE TUNGGAL
// ============================================================

/**
 * Titik: satu pixel besar
 */
function renderPoint(shape) {
  const { cx, cy, transform, color, pixelSize } = shape;
  const p = applyMatrix(0, 0, transform, cx, cy);
  ctx.fillStyle = color;
  const r = pixelSize + 2;
  ctx.fillRect(p.x - r/2, p.y - r/2, r, r);
}

/**
 * Garis: DDA, titik lokal relatif pusat garis
 */
function renderLine(shape) {
  const { p1, p2, cx, cy, transform, color, pixelSize } = shape;
  const pts = ddaLine(p1.x, p1.y, p2.x, p2.y);
  renderPoints(pts, transform, cx, cy, color, pixelSize);
}

/**
 * Lingkaran: Midpoint Circle, titik lokal relatif pusat
 */
function renderCircle(shape) {
  const { r, cx, cy, transform, color, pixelSize } = shape;
  const pts = midpointCircle(r);
  renderPoints(pts, transform, cx, cy, color, pixelSize);
}

/**
 * Elips: Midpoint Ellipse
 */
function renderEllipse(shape) {
  const { rx, ry, cx, cy, transform, color, pixelSize } = shape;
  const pts = midpointEllipse(rx, ry);
  renderPoints(pts, transform, cx, cy, color, pixelSize);
}

/**
 * Persegi: 4 garis DDA (sisi)
 * Titik lokal: corner1 = (-hw,-hh), corner2 = (hw, hh)
 */
function renderRect(shape) {
  const { hw, hh, cx, cy, transform, color, pixelSize } = shape;
  // 4 segmen sisi persegi
  const edges = [
    ddaLine(-hw, -hh,  hw, -hh), // atas
    ddaLine( hw, -hh,  hw,  hh), // kanan
    ddaLine( hw,  hh, -hw,  hh), // bawah
    ddaLine(-hw,  hh, -hw, -hh), // kiri
  ];
  for (const seg of edges) {
    renderPoints(seg, transform, cx, cy, color, pixelSize);
  }
}

/**
 * Poligon: serangkaian segmen DDA antar titik
 * pts[]: array titik lokal
 */
function renderPolygon(shape) {
  const { pts, cx, cy, transform, color, pixelSize } = shape;
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const seg = ddaLine(a.x, a.y, b.x, b.y);
    renderPoints(seg, transform, cx, cy, color, pixelSize);
  }
}

/**
 * Gambar satu shape (dispatch berdasarkan tipe)
 */
function drawShape(shape) {
  ctx.save();

  // Highlight jika terpilih
  if (shapes[selectedIndex] && shapes[selectedIndex].id === shape.id) {
    // Gambar bounding box / circle tipis
    drawSelectionIndicator(shape);
  }

  switch (shape.type) {
    case "point":   renderPoint(shape);   break;
    case "line":    renderLine(shape);    break;
    case "circle":  renderCircle(shape);  break;
    case "ellipse": renderEllipse(shape); break;
    case "rect":    renderRect(shape);    break;
    case "polygon": renderPolygon(shape); break;
  }

  ctx.restore();
}

/**
 * Indikator seleksi: dash circle di sekitar pusat objek
 */
function drawSelectionIndicator(shape) {
  const cx = shape.cx + shape.transform.tx;
  const cy = shape.cy + shape.transform.ty;
  ctx.save();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth   = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  const r = getApproxRadius(shape) + 8;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function getApproxRadius(shape) {
  const s = shape.transform.scale;
  switch (shape.type) {
    case "point":   return 6;
    case "line":    return Math.hypot(shape.p2.x - shape.p1.x, shape.p2.y - shape.p1.y) / 2 * s;
    case "circle":  return shape.r * s;
    case "ellipse": return Math.max(shape.rx, shape.ry) * s;
    case "rect":    return Math.hypot(shape.hw, shape.hh) * s;
    case "polygon": {
      let maxDist = 0;
      for (const p of shape.pts) maxDist = Math.max(maxDist, Math.hypot(p.x, p.y));
      return maxDist * s;
    }
    default: return 20;
  }
}

// ============================================================
//  PREVIEW SAAT MENGGAMBAR
// ============================================================

function drawPreview() {
  if (activeTool === "polygon") {
    if (polygonPts.length === 0) return;
    drawPolygonPreview();
    return;
  }

  if (!isDrawing || !startPt || !currentPt) return;

  ctx.save();
  ctx.globalAlpha = 0.55;

  const color = strokeColorEl.value;
  const sz    = Number(pixelSizeEl.value);
  const identity = { tx: 0, ty: 0, rot: 0, scale: 1 };
  const s = startPt, e = currentPt;

  switch (activeTool) {
    case "line": {
      const pts = ddaLine(s.x, s.y, e.x, e.y);
      ctx.fillStyle = color;
      for (const p of pts) ctx.fillRect(p.x, p.y, sz, sz);
      break;
    }
    case "circle": {
      const r = Math.max(4, Math.round(Math.hypot(e.x - s.x, e.y - s.y)));
      const pts = midpointCircle(r);
      renderPoints(pts, identity, s.x, s.y, color, sz);
      break;
    }
    case "ellipse": {
      const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
      const rx = Math.max(4, Math.abs(e.x - s.x) / 2);
      const ry = Math.max(4, Math.abs(e.y - s.y) / 2);
      const pts = midpointEllipse(rx, ry);
      renderPoints(pts, identity, cx, cy, color, sz);
      break;
    }
    case "rect": {
      const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
      const hw = Math.abs(e.x - s.x) / 2;
      const hh = Math.abs(e.y - s.y) / 2;
      const edges = [
        ddaLine(-hw, -hh,  hw, -hh),
        ddaLine( hw, -hh,  hw,  hh),
        ddaLine( hw,  hh, -hw,  hh),
        ddaLine(-hw,  hh, -hw, -hh),
      ];
      ctx.fillStyle = color;
      for (const seg of edges) renderPoints(seg, identity, cx, cy, color, sz);
      break;
    }
  }

  ctx.restore();
}

function drawPolygonPreview() {
  if (polygonPts.length === 0) return;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle   = strokeColorEl.value;
  const sz = Number(pixelSizeEl.value);
  const identity = { tx: 0, ty: 0, rot: 0, scale: 1 };

  // Gambar segmen yang sudah ada
  for (let i = 0; i < polygonPts.length - 1; i++) {
    const seg = ddaLine(polygonPts[i].x, polygonPts[i].y, polygonPts[i+1].x, polygonPts[i+1].y);
    for (const p of seg) ctx.fillRect(p.x, p.y, sz, sz);
  }

  // Segmen dari titik terakhir ke posisi mouse sekarang
  if (currentPt) {
    const last = polygonPts[polygonPts.length - 1];
    const seg = ddaLine(last.x, last.y, currentPt.x, currentPt.y);
    ctx.globalAlpha = 0.35;
    for (const p of seg) ctx.fillRect(p.x, p.y, sz, sz);
  }

  // Tandai titik-titik polygon
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f59e0b";
  for (const pt of polygonPts) {
    ctx.fillRect(pt.x - 2, pt.y - 2, 5, 5);
  }

  ctx.restore();
}

// ============================================================
//  RENDER LOOP UTAMA
// ============================================================

function render() {
  // Clear device pixels first
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Apply zoom transform for drawing
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);

  // Grid
  if (showGridEl.checked) drawGrid();

  // Flood fill layer
  if (fillCanvas) ctx.drawImage(fillCanvas, 0, 0);

  // Semua shape
  for (const shape of shapes) drawShape(shape);

  // Preview menggambar
  drawPreview();

  // Crosshair koordinat mouse
  if (showCoordEl.checked) drawCrosshair();

  requestAnimationFrame(render);
}

function drawCrosshair() {
  ctx.save();
  ctx.strokeStyle = "rgba(100, 120, 160, 0.3)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, mouseY); ctx.lineTo(W, mouseY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ============================================================
//  HIT TEST — DETEKSI KLIK PADA OBJEK
// ============================================================

/**
 * Mengembalikan indeks shape terakhir yang diklik (dari atas/belakang).
 * Menggunakan pendekatan geometri, bukan pixel picking.
 */
function hitTest(pt) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (isPointOnShape(pt, shape)) return i;
  }
  return -1;
}

function isPointOnShape(pt, shape) {
  // Transformasi balik: pindahkan pt ke ruang lokal shape
  const { cx, cy, transform } = shape;
  const wx = pt.x - cx - transform.tx;
  const wy = pt.y - cy - transform.ty;

  // Balik rotasi
  const angle = -toRad(transform.rot);
  const cosA  = Math.cos(angle), sinA = Math.sin(angle);
  const lx = (wx * cosA - wy * sinA) / transform.scale;
  const ly = (wx * sinA + wy * cosA) / transform.scale;

  const tol = 8; // toleransi pixel

  switch (shape.type) {
    case "point":
      return Math.hypot(lx, ly) < 8;
    case "line": {
      const { p1, p2 } = shape;
      return distPointSegment({ x: lx, y: ly }, p1, p2) < tol;
    }
    case "circle":
      return Math.abs(Math.hypot(lx, ly) - shape.r) < tol;
    case "ellipse": {
      const { rx, ry } = shape;
      const v = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
      return Math.abs(v - 1) < (tol / Math.min(rx, ry));
    }
    case "rect": {
      const { hw, hh } = shape;
      const onH = Math.abs(Math.abs(ly) - hh) < tol && Math.abs(lx) <= hw + tol;
      const onV = Math.abs(Math.abs(lx) - hw) < tol && Math.abs(ly) <= hh + tol;
      return onH || onV;
    }
    case "polygon": {
      for (let i = 0; i < shape.pts.length; i++) {
        const a = shape.pts[i];
        const b = shape.pts[(i+1) % shape.pts.length];
        if (distPointSegment({ x: lx, y: ly }, a, b) < tol) return true;
      }
      return false;
    }
    default: return false;
  }
}

function distPointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx*dx + dy*dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x)*dx + (p.y - a.y)*dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

// ============================================================
//  FLOOD FILL — SCANLINE ALGORITHM
//
//  Scanline Flood Fill lebih efisien dari rekursif karena
//  menghindari stack overflow pada area besar.
//
//  Prinsip:
//  1. Mulai dari titik seed (sx, sy)
//  2. Baca warna target di titik seed (warna yang akan diganti)
//  3. Simpan baris ke antrian: untuk setiap baris, cari span
//     horizontal ke kiri dan kanan selama warna = target
//  4. Plot seluruh span dengan fill color
//  5. Periksa baris atas dan bawah: jika ada area target, tambah antrian
// ============================================================

function floodFill(sx, sy, fillColor) {
  // Ambil pixel data dari canvas
  const imageData = ctx.getImageData(0, 0, W, H);
  const data      = imageData.data;

  // Warna target di titik seed
  const idx = (sy * W + sx) * 4;
  const tr = data[idx], tg = data[idx+1], tb = data[idx+2], ta = data[idx+3];

  // Parse fill color dari hex ke RGBA
  const fill = hexToRGBA(fillColor);

  // Jika warna target sama dengan fill color, tidak perlu fill
  if (tr === fill.r && tg === fill.g && tb === fill.b && ta === fill.a) return;

  function colorMatch(i) {
    return data[i] === tr && data[i+1] === tg && data[i+2] === tb && data[i+3] === ta;
  }

  function setColor(i) {
    data[i]   = fill.r;
    data[i+1] = fill.g;
    data[i+2] = fill.b;
    data[i+3] = fill.a;
  }

  // Queue: array [x, y]
  const queue = [[sx, sy]];
  const visited = new Uint8Array(W * H); // flag sudah dikunjungi

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    if (visited[y * W + x]) continue;

    // Cari batas kiri
    let left = x;
    while (left > 0 && colorMatch((y * W + left - 1) * 4)) left--;

    // Cari batas kanan
    let right = x;
    while (right < W - 1 && colorMatch((y * W + right + 1) * 4)) right++;

    // Isi span horizontal
    for (let i = left; i <= right; i++) {
      if (visited[y * W + i]) continue;
      const pi = (y * W + i) * 4;
      if (colorMatch(pi)) {
        setColor(pi);
        visited[y * W + i] = 1;
        // Tambah baris atas dan bawah
        if (y > 0)     queue.push([i, y - 1]);
        if (y < H - 1) queue.push([i, y + 1]);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  if (fillCtx) {
    fillCtx.putImageData(imageData, 0, 0);
  }
}

function hexToRGBA(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b, a: 255 };
}

// ============================================================
//  ANIMASI BOUNCE
// ============================================================

function stepAnimation() {
  const spd = Number(speedSlider.value) * 0.5;
  for (const shape of shapes) {
    shape.cx += shape.velocity.x * spd;
    shape.cy += shape.velocity.y * spd;

    // Bounce dari tepi canvas dengan margin
    const margin = 30;
    if (shape.cx < margin || shape.cx > W - margin) {
      shape.velocity.x *= -1;
      shape.cx = Math.max(margin, Math.min(W - margin, shape.cx));
    }
    if (shape.cy < margin || shape.cy > H - margin) {
      shape.velocity.y *= -1;
      shape.cy = Math.max(margin, Math.min(H - margin, shape.cy));
    }
  }
  if (isAnimating) {
    animFrameId = requestAnimationFrame(stepAnimation);
  }
}

function startAnimation() {
  if (isAnimating) return;
  isAnimating = true;
  toggleAnimBtn.textContent = "⏹ Stop";
  stepAnimation();
}

function stopAnimation() {
  isAnimating = false;
  toggleAnimBtn.textContent = "▶ Start";
  if (animFrameId) cancelAnimationFrame(animFrameId);
}

// ============================================================
//  UI TRANSFORMASI
// ============================================================

function updateTransformUI(shape) {
  if (!shape) {
    txSlider.value = tySlider.value = rotSlider.value = 0;
    scaleSlider.value = 100;
    txValEl.textContent  = "0";
    tyValEl.textContent  = "0";
    rotValEl.textContent = "0°";
    scaleValEl.textContent = "1.00×";
    txNum.value = tyNum.value = rotNum.value = 0;
    selectedLabel.textContent = "Tidak ada objek";
    updateMatrixDisplay({ tx: 0, ty: 0, rot: 0, scale: 1 });
    return;
  }
  const t = shape.transform;
  txSlider.value   = t.tx;
  tySlider.value   = t.ty;
  rotSlider.value  = t.rot;
  scaleSlider.value = Math.round(t.scale * 100);
  txValEl.textContent   = t.tx;
  tyValEl.textContent   = t.ty;
  rotValEl.textContent  = `${t.rot}°`;
  scaleValEl.textContent = `${t.scale.toFixed(2)}×`;
  txNum.value = t.tx;
  tyNum.value = t.ty;
  rotNum.value = t.rot;
  selectedLabel.textContent = `#${shapes.indexOf(shape)+1} ${shape.type}`;
  updateMatrixDisplay(t);
}

function syncTransformFromSliders() {
  if (selectedIndex < 0) return;
  const shape = shapes[selectedIndex];
  shape.transform.tx    = Number(txSlider.value);
  shape.transform.ty    = Number(tySlider.value);
  shape.transform.rot   = Number(rotSlider.value);
  shape.transform.scale = Number(scaleSlider.value) / 100;
  txValEl.textContent   = shape.transform.tx;
  tyValEl.textContent   = shape.transform.ty;
  rotValEl.textContent  = `${shape.transform.rot}°`;
  scaleValEl.textContent = `${shape.transform.scale.toFixed(2)}×`;
  txNum.value  = shape.transform.tx;
  tyNum.value  = shape.transform.ty;
  rotNum.value = shape.transform.rot;
  updateMatrixDisplay(shape.transform);
}

function syncTransformFromNumbers() {
  if (selectedIndex < 0) return;
  const shape = shapes[selectedIndex];
  shape.transform.tx  = Number(txNum.value)  || 0;
  shape.transform.ty  = Number(tyNum.value)  || 0;
  shape.transform.rot = Number(rotNum.value) || 0;
  txSlider.value  = shape.transform.tx;
  tySlider.value  = shape.transform.ty;
  rotSlider.value = shape.transform.rot;
  txValEl.textContent   = shape.transform.tx;
  tyValEl.textContent   = shape.transform.ty;
  rotValEl.textContent  = `${shape.transform.rot}°`;
  updateMatrixDisplay(shape.transform);
}

function selectShape(index) {
  if (shapes.length === 0) {
    selectedIndex = -1;
    updateTransformUI(null);
    return;
  }
  selectedIndex = ((index % shapes.length) + shapes.length) % shapes.length;
  updateTransformUI(shapes[selectedIndex]);
  setStatus(`Terpilih: ${shapes[selectedIndex].type} #${selectedIndex + 1}`);
}

function deleteSelected() {
  if (selectedIndex < 0 || selectedIndex >= shapes.length) return;
  pushUndo();
  shapes.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, shapes.length - 1);
  if (shapes.length === 0) selectedIndex = -1;
  updateTransformUI(shapes[selectedIndex] || null);
  updateObjCount();
  setStatus("Objek dihapus.");
}

// ============================================================
//  PENANGANAN MOUSE
// ============================================================

canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  mouseX = pos.x;
  mouseY = pos.y;
  coordDisplay.textContent = `(${pos.x}, ${pos.y})`;

  // Drag objek terpilih
  if (isDragging && selectedIndex >= 0) {
    const shape = shapes[selectedIndex];
    shape.cx = pos.x - dragOffsetX;
    shape.cy = pos.y - dragOffsetY;
    // Reset transform.tx/ty saat drag langsung geser cx/cy
    return;
  }

  // Update preview
  if (isDrawing && activeTool !== "polygon") {
    currentPt = pos;
  }
  if (activeTool === "polygon" && polygonPts.length > 0) {
    currentPt = pos;
  }
});

canvas.addEventListener("mousedown", (e) => {
  const pos = getMousePos(e);

  // === MODE SELEKSI ===
  if (activeTool === "select") {
    const hit = hitTest(pos);
    if (hit >= 0) {
      selectShape(hit);
      isDragging   = true;
      const shape  = shapes[hit];
      dragOffsetX  = pos.x - shape.cx;
      dragOffsetY  = pos.y - shape.cy;
    } else {
      selectedIndex = -1;
      updateTransformUI(null);
    }
    return;
  }

  // === MODE FLOOD FILL ===
  if (activeTool === "fill") {
    // Render dulu ke canvas, lalu flood fill pada pixel data
    // (canvas sudah ter-render oleh render loop)
    const fillColor = fillColorEl.value;
    floodFill(pos.x, pos.y, fillColor);
    setStatus(`Flood Fill @ (${pos.x}, ${pos.y})`);
    return;
  }

  // === MODE POLYGON ===
  if (activeTool === "polygon") {
    polygonPts.push({ x: pos.x, y: pos.y });
    setStatus(`Titik ${polygonPts.length} ditambahkan. Klik 'Selesai' untuk menutup.`);
    return;
  }

  // === MODE GAMBAR DRAG (BUKAN POLYGON) ===
  // Cek apakah klik pada objek → select
  const hit = hitTest(pos);
  if (hit >= 0 && !isDrawing) {
    selectShape(hit);
    return;
  }

  // Titik: langsung buat
  if (activeTool === "point") {
    pushUndo();
    const shape = createShape("point", { cx: pos.x, cy: pos.y });
    shapes.push(shape);
    selectedIndex = shapes.length - 1;
    updateTransformUI(shapes[selectedIndex]);
    updateObjCount();
    setStatus(`Titik @ (${pos.x}, ${pos.y})`);
    return;
  }

  // Mulai drag untuk objek lain
  if (!isDrawing) {
    isDrawing  = true;
    startPt    = pos;
    currentPt  = pos;
    setStatus("Drag untuk menentukan ukuran…");
  }
});

canvas.addEventListener("mouseup", (e) => {
  const pos = getMousePos(e);

  if (isDragging) {
    isDragging = false;
    pushUndo();
    setStatus("Objek dipindahkan.");
    return;
  }

  if (!isDrawing) return;
  if (activeTool === "point" || activeTool === "polygon" || activeTool === "fill" || activeTool === "select") return;

  isDrawing  = false;
  currentPt  = pos;

  const s = startPt, en = pos;

  pushUndo();

  switch (activeTool) {
    case "line": {
      const cx = (s.x + en.x) / 2, cy = (s.y + en.y) / 2;
      const shape = createShape("line", {
        cx, cy,
        p1: { x: s.x - cx,  y: s.y - cy  },
        p2: { x: en.x - cx, y: en.y - cy },
      });
      shapes.push(shape);
      break;
    }
    case "circle": {
      const r = Math.max(4, Math.round(Math.hypot(en.x - s.x, en.y - s.y)));
      const shape = createShape("circle", { cx: s.x, cy: s.y, r });
      shapes.push(shape);
      break;
    }
    case "ellipse": {
      const cx = (s.x + en.x) / 2, cy = (s.y + en.y) / 2;
      const rx = Math.max(4, Math.abs(en.x - s.x) / 2);
      const ry = Math.max(4, Math.abs(en.y - s.y) / 2);
      const shape = createShape("ellipse", { cx, cy, rx: Math.round(rx), ry: Math.round(ry) });
      shapes.push(shape);
      break;
    }
    case "rect": {
      const cx = (s.x + en.x) / 2, cy = (s.y + en.y) / 2;
      const hw = Math.abs(en.x - s.x) / 2;
      const hh = Math.abs(en.y - s.y) / 2;
      const shape = createShape("rect", { cx, cy, hw, hh });
      shapes.push(shape);
      break;
    }
  }

  startPt    = null;
  currentPt  = null;
  selectedIndex = shapes.length - 1;
  updateTransformUI(shapes[selectedIndex]);
  updateObjCount();
  setStatus("Objek dibuat.");
});

canvas.addEventListener("mouseleave", () => {
  if (activeTool !== "polygon") {
    // Jangan batalkan drawing saat polygon
  }
  isDragging = false;
});

// ============================================================
//  KONTROL TOMBOL & EVENT LISTENER
// ============================================================

// Tool buttons
toolButtons.forEach(btn => {
  btn.addEventListener("click", () => setTool(btn.dataset.tool));
});

// Slider transformasi
txSlider.addEventListener("input", syncTransformFromSliders);
tySlider.addEventListener("input", syncTransformFromSliders);
rotSlider.addEventListener("input", syncTransformFromSliders);
scaleSlider.addEventListener("input", syncTransformFromSliders);

// Input number manual transformasi
txNum.addEventListener("change",  syncTransformFromNumbers);
tyNum.addEventListener("change",  syncTransformFromNumbers);
rotNum.addEventListener("change", syncTransformFromNumbers);

// Pixel size display
pixelSizeEl.addEventListener("input", () => {
  pixelSizeVal.textContent = pixelSizeEl.value;
});

zoomSlider.addEventListener("input", () => {
  zoom = Number(zoomSlider.value) / 100;
  zoomValEl.textContent = `${zoomSlider.value}%`;
});

// Warna stroke: update objek terpilih
strokeColorEl.addEventListener("input", () => {
  if (selectedIndex >= 0) {
    shapes[selectedIndex].color = strokeColorEl.value;
  }
});

// Seleksi prev/next
selectPrevBtn.addEventListener("click", () => selectShape(selectedIndex - 1));
selectNextBtn.addEventListener("click", () => selectShape(selectedIndex + 1));

// Reset transform
resetTransBtn.addEventListener("click", () => {
  if (selectedIndex < 0) return;
  shapes[selectedIndex].transform = { tx: 0, ty: 0, rot: 0, scale: 1 };
  updateTransformUI(shapes[selectedIndex]);
  setStatus("Transformasi di-reset.");
});

// Hapus objek terpilih
deleteSelBtn.addEventListener("click", deleteSelected);

// Animasi
toggleAnimBtn.addEventListener("click", () => {
  if (isAnimating) stopAnimation(); else startAnimation();
});

resetAnimBtn.addEventListener("click", () => {
  // Kembalikan semua objek ke posisi awal (acak di tengah canvas)
  for (const shape of shapes) {
    shape.cx = W * 0.2 + Math.random() * W * 0.6;
    shape.cy = H * 0.2 + Math.random() * H * 0.6;
    shape.velocity.x = (Math.random() - 0.5) * 3;
    shape.velocity.y = (Math.random() - 0.5) * 3;
  }
  setStatus("Posisi objek direset.");
});

speedSlider.addEventListener("input", () => {
  speedValEl.textContent = speedSlider.value;
});

// Simpan PNG
savePngBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "grafkom2d_canvas.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("Canvas disimpan sebagai PNG.");
});

// Clear canvas
clearCanvasBtn.addEventListener("click", () => {
  if (!confirm("Yakin ingin menghapus semua objek?")) return;
  pushUndo();
  shapes = [];
  selectedIndex = -1;
  polygonPts = [];
  if (fillCtx) fillCtx.clearRect(0, 0, W, H);
  updateTransformUI(null);
  updateObjCount();
  setStatus("Canvas dibersihkan.");
});

// Undo / Redo
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
  if (e.key === "Delete" || e.key === "Backspace") {
    if (document.activeElement === document.body || document.activeElement === canvas) {
      deleteSelected();
    }
  }
});

// Selesaikan polygon
finishPolyBtn.addEventListener("click", () => {
  if (polygonPts.length < 3) {
    setStatus("Polygon butuh minimal 3 titik.");
    return;
  }
  pushUndo();
  // Hitung centroid sebagai cx, cy
  let sumX = 0, sumY = 0;
  for (const p of polygonPts) { sumX += p.x; sumY += p.y; }
  const cx = sumX / polygonPts.length;
  const cy = sumY / polygonPts.length;
  // Konversi ke lokal
  const localPts = polygonPts.map(p => ({ x: p.x - cx, y: p.y - cy }));
  const shape = createShape("polygon", { cx, cy, pts: localPts });
  shapes.push(shape);
  polygonPts = [];
  currentPt  = null;
  selectedIndex = shapes.length - 1;
  updateTransformUI(shapes[selectedIndex]);
  updateObjCount();
  setStatus("Poligon selesai dibuat.");
});

cancelPolyBtn.addEventListener("click", () => {
  polygonPts = [];
  currentPt  = null;
  setStatus("Pembuatan poligon dibatalkan.");
});

// ============================================================
//  INISIALISASI
// ============================================================

function init() {
  fillCanvas = document.createElement("canvas");
  fillCanvas.width = W;
  fillCanvas.height = H;
  fillCtx = fillCanvas.getContext("2d");

  setTool("point");
  updateTransformUI(null);
  updateObjCount();
  speedValEl.textContent = speedSlider.value;
  pixelSizeVal.textContent = pixelSizeEl.value;
  zoomSlider.value = 100;
  zoomValEl.textContent = "100%";
  setStatus("Siap — pilih primitif dan klik canvas untuk menggambar.");

  // Mulai render loop
  render();
}

init();