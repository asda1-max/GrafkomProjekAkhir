const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const strokeColor = document.getElementById("stroke-color");
const glowToggle = document.getElementById("glow-toggle");

const toolLine = document.getElementById("tool-line");
const toolCircle = document.getElementById("tool-circle");
const toolEllipse = document.getElementById("tool-ellipse");

const selectPrev = document.getElementById("select-prev");
const selectNext = document.getElementById("select-next");

const tx = document.getElementById("tx");
const ty = document.getElementById("ty");
const rot = document.getElementById("rot");
const scale = document.getElementById("scale");
const txVal = document.getElementById("tx-val");
const tyVal = document.getElementById("ty-val");
const rotVal = document.getElementById("rot-val");
const scaleVal = document.getElementById("scale-val");

const toggleAnim = document.getElementById("toggle-anim");
const resetBtn = document.getElementById("reset");
const speed = document.getElementById("speed");
const speedVal = document.getElementById("speed-val");

const confettiBtn = document.getElementById("confetti");
const clearBtn = document.getElementById("clear");

const tools = {
  line: "line",
  circle: "circle",
  ellipse: "ellipse",
};

let activeTool = tools.line;
let isDrawing = false;
let startPoint = null;
let currentPoint = null;
let shapes = [];
let selectedIndex = -1;
let isAnimating = false;

const confetti = [];

const toRadians = (deg) => (deg * Math.PI) / 180;

const setStatus = (text) => {
  statusEl.textContent = text;
};

const setActiveTool = (tool) => {
  activeTool = tool;
  toolLine.classList.toggle("primary", tool === tools.line);
  toolCircle.classList.toggle("primary", tool === tools.circle);
  toolEllipse.classList.toggle("primary", tool === tools.ellipse);
  setStatus(`Mode: ${tool.toUpperCase()}`);
};

const createShapeBase = (type, center) => ({
  id: crypto.randomUUID(),
  type,
  center: { ...center },
  transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
  color: strokeColor.value,
  spawn: 0,
  velocity: {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
  },
});

const applyTransform = (point, transform, center) => {
  const scaled = {
    x: point.x * transform.scale,
    y: point.y * transform.scale,
  };
  const angle = toRadians(transform.rot);
  const rotated = {
    x: scaled.x * Math.cos(angle) - scaled.y * Math.sin(angle),
    y: scaled.x * Math.sin(angle) + scaled.y * Math.cos(angle),
  };
  return {
    x: rotated.x + center.x + transform.tx,
    y: rotated.y + center.y + transform.ty,
  };
};

const ddaLine = (x1, y1, x2, y2) => {
  const points = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const xInc = dx / steps;
  const yInc = dy / steps;
  let x = x1;
  let y = y1;
  for (let i = 0; i <= steps; i += 1) {
    points.push({ x: Math.round(x), y: Math.round(y) });
    x += xInc;
    y += yInc;
  }
  return points;
};

const midpointCircle = (r) => {
  const points = [];
  let x = 0;
  let y = r;
  let p = 1 - r;

  const addSymmetry = (px, py) => {
    points.push({ x: px, y: py });
    points.push({ x: -px, y: py });
    points.push({ x: px, y: -py });
    points.push({ x: -px, y: -py });
    points.push({ x: py, y: px });
    points.push({ x: -py, y: px });
    points.push({ x: py, y: -px });
    points.push({ x: -py, y: -px });
  };

  while (x <= y) {
    addSymmetry(x, y);
    if (p < 0) {
      p += 2 * x + 3;
    } else {
      p += 2 * (x - y) + 5;
      y -= 1;
    }
    x += 1;
  }
  return points;
};

const midpointEllipse = (rx, ry) => {
  const points = [];
  let x = 0;
  let y = ry;
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  let dx = 2 * ry2 * x;
  let dy = 2 * rx2 * y;

  const addSymmetry = (px, py) => {
    points.push({ x: px, y: py });
    points.push({ x: -px, y: py });
    points.push({ x: px, y: -py });
    points.push({ x: -px, y: -py });
  };

  while (dx < dy) {
    addSymmetry(x, y);
    if (p1 < 0) {
      x += 1;
      dx = 2 * ry2 * x;
      p1 += dx + ry2;
    } else {
      x += 1;
      y -= 1;
      dx = 2 * ry2 * x;
      dy = 2 * rx2 * y;
      p1 += dx - dy + ry2;
    }
  }

  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;

  while (y >= 0) {
    addSymmetry(x, y);
    if (p2 > 0) {
      y -= 1;
      dy = 2 * rx2 * y;
      p2 += rx2 - dy;
    } else {
      y -= 1;
      x += 1;
      dx = 2 * ry2 * x;
      dy = 2 * rx2 * y;
      p2 += dx - dy + rx2;
    }
  }

  return points;
};

const drawPoints = (points, color) => {
  ctx.fillStyle = color;
  points.forEach((p) => {
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1.5, 1.5);
  });
};

const drawShape = (shape) => {
  ctx.save();
  if (shape.spawn < 1) {
    shape.spawn = Math.min(1, shape.spawn + 0.04);
  }
  const spawnScale = 0.6 + 0.4 * shape.spawn;
  const spawnAlpha = 0.4 + 0.6 * shape.spawn;
  ctx.globalAlpha = spawnAlpha;
  if (glowToggle.checked) {
    ctx.shadowColor = shape.color;
    ctx.shadowBlur = 12;
  } else {
    ctx.shadowBlur = 0;
  }

  let points = [];
  if (shape.type === tools.line) {
    points = ddaLine(shape.local.p1.x, shape.local.p1.y, shape.local.p2.x, shape.local.p2.y);
  }
  if (shape.type === tools.circle) {
    points = midpointCircle(shape.local.r);
  }
  if (shape.type === tools.ellipse) {
    points = midpointEllipse(shape.local.rx, shape.local.ry);
  }

  const boostedTransform = {
    ...shape.transform,
    scale: shape.transform.scale * spawnScale,
  };
  const transformed = points.map((p) => applyTransform(p, boostedTransform, shape.center));
  drawPoints(transformed, shape.color);

  if (selectedIndex >= 0 && shapes[selectedIndex]?.id === shape.id) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(shape.center.x + shape.transform.tx, shape.center.y + shape.transform.ty, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  shapes.forEach(drawShape);
  if (isDrawing && startPoint && currentPoint) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([4, 4]);
    const previewColor = strokeColor.value;
    if (activeTool === tools.line) {
      const center = { x: (startPoint.x + currentPoint.x) / 2, y: (startPoint.y + currentPoint.y) / 2 };
      const local = {
        p1: { x: startPoint.x - center.x, y: startPoint.y - center.y },
        p2: { x: currentPoint.x - center.x, y: currentPoint.y - center.y },
      };
      const pts = ddaLine(local.p1.x, local.p1.y, local.p2.x, local.p2.y);
      const transformed = pts.map((p) => applyTransform(p, { tx: 0, ty: 0, rot: 0, scale: 1 }, center));
      drawPoints(transformed, previewColor);
    }
    if (activeTool === tools.circle) {
      const r = Math.max(6, Math.round(Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y)));
      const pts = midpointCircle(r);
      const transformed = pts.map((p) => applyTransform(p, { tx: 0, ty: 0, rot: 0, scale: 1 }, startPoint));
      drawPoints(transformed, previewColor);
    }
    if (activeTool === tools.ellipse) {
      const center = { x: (startPoint.x + currentPoint.x) / 2, y: (startPoint.y + currentPoint.y) / 2 };
      const rx = Math.max(6, Math.abs(currentPoint.x - startPoint.x) / 2);
      const ry = Math.max(6, Math.abs(currentPoint.y - startPoint.y) / 2);
      const pts = midpointEllipse(Math.round(rx), Math.round(ry));
      const transformed = pts.map((p) => applyTransform(p, { tx: 0, ty: 0, rot: 0, scale: 1 }, center));
      drawPoints(transformed, previewColor);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
  renderConfetti();
  requestAnimationFrame(render);
};

const updateTransformUI = (shape) => {
  if (!shape) {
    tx.value = 0;
    ty.value = 0;
    rot.value = 0;
    scale.value = 100;
    txVal.textContent = "0";
    tyVal.textContent = "0";
    rotVal.textContent = "0°";
    scaleVal.textContent = "1.00";
    return;
  }
  tx.value = shape.transform.tx;
  ty.value = shape.transform.ty;
  rot.value = shape.transform.rot;
  scale.value = Math.round(shape.transform.scale * 100);
  txVal.textContent = shape.transform.tx;
  tyVal.textContent = shape.transform.ty;
  rotVal.textContent = `${shape.transform.rot}°`;
  scaleVal.textContent = shape.transform.scale.toFixed(2);
};

const selectShapeByIndex = (index) => {
  if (shapes.length === 0) {
    selectedIndex = -1;
    updateTransformUI(null);
    setStatus("Tidak ada objek");
    return;
  }
  selectedIndex = (index + shapes.length) % shapes.length;
  updateTransformUI(shapes[selectedIndex]);
  setStatus(`Terpilih: ${shapes[selectedIndex].type}`);
};

const getMousePos = (evt) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((evt.clientX - rect.left) * (canvas.width / rect.width)),
    y: Math.round((evt.clientY - rect.top) * (canvas.height / rect.height)),
  };
};

const pointLineDistance = (p, a, b) => {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const len = atob.x * atob.x + atob.y * atob.y;
  let t = (atop.x * atob.x + atop.y * atob.y) / len;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + atob.x * t, y: a.y + atob.y * t };
  const dx = p.x - proj.x;
  const dy = p.y - proj.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const hitTest = (point) => {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const shape = shapes[i];
    const center = {
      x: shape.center.x + shape.transform.tx,
      y: shape.center.y + shape.transform.ty,
    };

    if (shape.type === tools.circle) {
      const r = shape.local.r * shape.transform.scale + 8;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      if (dx * dx + dy * dy <= r * r) return i;
    }

    if (shape.type === tools.ellipse) {
      const rx = shape.local.rx * shape.transform.scale + 8;
      const ry = shape.local.ry * shape.transform.scale + 8;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.2) return i;
    }

    if (shape.type === tools.line) {
      const p1 = applyTransform(shape.local.p1, shape.transform, shape.center);
      const p2 = applyTransform(shape.local.p2, shape.transform, shape.center);
      if (pointLineDistance(point, p1, p2) < 10) return i;
    }
  }
  return -1;
};

const addLine = (start, end) => {
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const shape = createShapeBase(tools.line, center);
  shape.local = {
    p1: { x: start.x - center.x, y: start.y - center.y },
    p2: { x: end.x - center.x, y: end.y - center.y },
  };
  shapes.push(shape);
};

const addCircle = (start, end) => {
  const center = { x: start.x, y: start.y };
  const radius = Math.max(6, Math.round(Math.hypot(end.x - start.x, end.y - start.y)));
  const shape = createShapeBase(tools.circle, center);
  shape.local = { r: radius };
  shapes.push(shape);
};

const addEllipse = (start, end) => {
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const rx = Math.max(6, Math.abs(end.x - start.x) / 2);
  const ry = Math.max(6, Math.abs(end.y - start.y) / 2);
  const shape = createShapeBase(tools.ellipse, center);
  shape.local = { rx: Math.round(rx), ry: Math.round(ry) };
  shapes.push(shape);
};

const updateSelectedTransform = () => {
  if (selectedIndex < 0) return;
  const shape = shapes[selectedIndex];
  shape.transform.tx = Number(tx.value);
  shape.transform.ty = Number(ty.value);
  shape.transform.rot = Number(rot.value);
  shape.transform.scale = Number(scale.value) / 100;
  txVal.textContent = shape.transform.tx;
  tyVal.textContent = shape.transform.ty;
  rotVal.textContent = `${shape.transform.rot}°`;
  scaleVal.textContent = shape.transform.scale.toFixed(2);
};

const resetTransforms = () => {
  shapes.forEach((shape) => {
    shape.transform = { tx: 0, ty: 0, rot: 0, scale: 1 };
  });
  updateTransformUI(shapes[selectedIndex]);
};

const animateShapes = () => {
  if (!isAnimating) return;
  const spd = Number(speed.value) * 0.6;
  shapes.forEach((shape) => {
    shape.center.x += shape.velocity.x * spd;
    shape.center.y += shape.velocity.y * spd;
    const maxX = canvas.width - 20;
    const maxY = canvas.height - 20;
    if (shape.center.x < 20 || shape.center.x > maxX) shape.velocity.x *= -1;
    if (shape.center.y < 20 || shape.center.y > maxY) shape.velocity.y *= -1;
  });
  requestAnimationFrame(animateShapes);
};

const spawnConfetti = () => {
  for (let i = 0; i < 100; i += 1) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: -10,
      r: 3 + Math.random() * 4,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      life: 120 + Math.random() * 60,
    });
  }
};

const renderConfetti = () => {
  for (let i = confetti.length - 1; i >= 0; i -= 1) {
    const p = confetti[i];
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.r, p.r);
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    if (p.life <= 0 || p.y > canvas.height + 20) confetti.splice(i, 1);
  }
};

canvas.addEventListener("mousedown", (evt) => {
  const pos = getMousePos(evt);
  const hit = hitTest(pos);
  if (hit >= 0) {
    selectShapeByIndex(hit);
    setStatus("Objek terpilih. Gunakan slider transformasi.");
    return;
  }
  if (!isDrawing) {
    isDrawing = true;
    startPoint = pos;
    currentPoint = pos;
    setStatus("Titik awal dipilih. Tap titik akhir.");
  } else {
    const endPoint = pos;
    if (activeTool === tools.line) addLine(startPoint, endPoint);
    if (activeTool === tools.circle) addCircle(startPoint, endPoint);
    if (activeTool === tools.ellipse) addEllipse(startPoint, endPoint);
    isDrawing = false;
    startPoint = null;
    currentPoint = null;
    selectShapeByIndex(shapes.length - 1);
    setStatus("Objek dibuat.");
  }
});

canvas.addEventListener("mousemove", (evt) => {
  if (!isDrawing) return;
  const pos = getMousePos(evt);
  currentPoint = pos;
  setStatus(`Titik akhir: (${pos.x}, ${pos.y})`);
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
  startPoint = null;
  currentPoint = null;
});

strokeColor.addEventListener("input", () => {
  if (selectedIndex >= 0) {
    shapes[selectedIndex].color = strokeColor.value;
  }
});

[tx, ty, rot, scale].forEach((slider) => {
  slider.addEventListener("input", updateSelectedTransform);
});

selectPrev.addEventListener("click", () => selectShapeByIndex(selectedIndex - 1));
selectNext.addEventListener("click", () => selectShapeByIndex(selectedIndex + 1));

speed.addEventListener("input", () => {
  speedVal.textContent = speed.value;
});

resetBtn.addEventListener("click", () => {
  resetTransforms();
  setStatus("Transformasi direset.");
});

clearBtn.addEventListener("click", () => {
  shapes = [];
  selectedIndex = -1;
  updateTransformUI(null);
  setStatus("Canvas dibersihkan.");
});

confettiBtn.addEventListener("click", () => {
  spawnConfetti();
  setStatus("Confetti! 🎉");
});

setActiveTool(tools.line);

[toolLine, toolCircle, toolEllipse].forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn === toolLine) setActiveTool(tools.line);
    if (btn === toolCircle) setActiveTool(tools.circle);
    if (btn === toolEllipse) setActiveTool(tools.ellipse);
  });
});

toggleAnim.addEventListener("click", () => {
  isAnimating = !isAnimating;
  toggleAnim.textContent = isAnimating ? "Stop" : "Start";
  if (isAnimating) animateShapes();
});

render();
