/**
 * LiveBoard — app.js
 * Real-time collaborative whiteboard client.
 *
 * Architecture:
 *  - Canvas API for drawing (hardware-accelerated 2D)
 *  - SockJS + STOMP for WebSocket communication
 *  - requestAnimationFrame batching to throttle sends (~30 msg/sec)
 *  - Ramer-Douglas-Peucker simplification to reduce point count
 *  - Exponential backoff reconnection on disconnect
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
    tool: 'pen',
    color: '#1e1e2e',
    lineWidth: 4,
    isDrawing: false,
    currentPoints: [],
    stompClient: null,
    connected: false,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    pendingFrame: null,
    undoStack: [],       // local undo: array of ImageData snapshots
    hasDrawn: false,
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const cursorPos = document.getElementById('cursorPos');
const canvasHint = document.getElementById('canvasHint');
const sizeLabel = document.getElementById('sizeLabel');
const brushSlider = document.getElementById('brushSize');
const customColor = document.getElementById('customColor');
const toast = document.getElementById('toast');

// ── Canvas Resize ──────────────────────────────────────────────────────────
function resizeCanvas() {
    const wrapper = document.getElementById('canvasWrapper');
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    ctx.putImageData(snapshot, 0, 0);
    setupCtx();
}

function setupCtx() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── WebSocket / STOMP ──────────────────────────────────────────────────────
function connect() {
    setStatus('connecting');
    const socket = new SockJS('/ws');
    state.stompClient = Stomp.over(socket);
    state.stompClient.debug = null; // silence STOMP debug logs

    state.stompClient.connect({}, onConnected, onDisconnected);
}

function onConnected() {
    state.connected = true;
    state.reconnectDelay = 1000;
    setStatus('connected');
    showToast('✓ Connected to LiveBoard');

    // Subscribe to live stroke updates
    state.stompClient.subscribe('/topic/board', (msg) => {
        const stroke = JSON.parse(msg.body);
        renderStroke(stroke);
    });

    // Subscribe to board clear events
    state.stompClient.subscribe('/topic/board-clear', () => {
        clearCanvas(false);
        showToast('Board cleared by another user');
    });

    // Replay history for new joiners
    fetchHistory();
}

function onDisconnected() {
    state.connected = false;
    setStatus('disconnected');
    showToast(`⚠ Disconnected. Retrying in ${state.reconnectDelay / 1000}s…`);

    setTimeout(() => {
        state.reconnectDelay = Math.min(state.reconnectDelay * 2, state.maxReconnectDelay);
        connect();
    }, state.reconnectDelay);
}

function fetchHistory() {
    fetch('/api/board/history')
        .then(r => r.json())
        .then(strokes => {
            strokes.forEach(renderStroke);
            if (strokes.length > 0) {
                canvasHint.classList.add('hidden');
                state.hasDrawn = true;
            }
        })
        .catch(err => console.error('History fetch failed:', err));
}

// ── Drawing ────────────────────────────────────────────────────────────────
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
        x: (src.clientX - rect.left) * (canvas.width / rect.width),
        y: (src.clientY - rect.top) * (canvas.height / rect.height),
    };
}

function startDraw(e) {
    e.preventDefault();
    if (!state.connected) return;

    // Save snapshot for undo BEFORE drawing
    state.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (state.undoStack.length > 20) state.undoStack.shift(); // cap at 20

    state.isDrawing = true;
    state.currentPoints = [];
    const pos = getPos(e);
    state.currentPoints.push([pos.x, pos.y]);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    applyToolStyle();

    if (!state.hasDrawn) {
        state.hasDrawn = true;
        canvasHint.classList.add('hidden');
    }
}

function draw(e) {
    e.preventDefault();
    if (!state.isDrawing) return;

    const pos = e.touches ? getPos(e) : getPos(e);
    state.currentPoints.push([pos.x, pos.y]);

    // Live preview on local canvas
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Throttle sends using rAF
    if (!state.pendingFrame) {
        state.pendingFrame = requestAnimationFrame(sendCurrentPoints);
    }
}

function endDraw(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    cancelAnimationFrame(state.pendingFrame);
    state.pendingFrame = null;

    if (state.currentPoints.length < 2) return;

    // Simplify points before sending (reduces payload by ~60% on smooth strokes)
    const simplified = rdpSimplify(state.currentPoints, 1.5);
    sendStroke(simplified);
    state.currentPoints = [];
}

function applyToolStyle() {
    if (state.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = state.lineWidth * 3;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.lineWidth;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function sendCurrentPoints() {
    state.pendingFrame = null;
    // No-op: we send on endDraw for complete strokes
}

function sendStroke(points) {
    if (!state.connected || points.length < 2) return;
    const payload = {
        color: state.tool === 'eraser' ? '#000000' : state.color,
        lineWidth: state.tool === 'eraser' ? state.lineWidth * 3 : state.lineWidth,
        points: points,
        tool: state.tool,
    };
    state.stompClient.send('/app/draw', {}, JSON.stringify(payload));
}

// ── Render incoming stroke ─────────────────────────────────────────────────
function renderStroke(stroke) {
    if (!stroke.points || stroke.points.length < 2) return;

    ctx.save();
    if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
    }
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
}

// ── Ramer-Douglas-Peucker Point Simplification ─────────────────────────────
function rdpSimplify(points, epsilon) {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let maxIdx = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDistance(points[i], start, end);
        if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > epsilon) {
        const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
        const right = rdpSimplify(points.slice(maxIdx), epsilon);
        return [...left.slice(0, -1), ...right];
    }
    return [start, end];
}

function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1]);
    return Math.abs(dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]) / len;
}

// ── Canvas Events ──────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', (e) => {
    draw(e);
    const pos = getPos(e);
    cursorPos.textContent = `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}`;
});
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

// Touch support
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', endDraw, { passive: false });

// ── Toolbar: Tools ─────────────────────────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tool = btn.dataset.tool;
        canvas.style.cursor = state.tool === 'eraser' ? 'cell' : 'crosshair';
    });
});

// ── Toolbar: Colors ────────────────────────────────────────────────────────
document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        state.color = swatch.dataset.color;
        customColor.value = state.color;
        // Switch back to pen if on eraser
        if (state.tool === 'eraser') activateTool('pen');
    });
});

customColor.addEventListener('input', (e) => {
    state.color = e.target.value;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    if (state.tool === 'eraser') activateTool('pen');
});

function activateTool(toolName) {
    state.tool = toolName;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === toolName);
    });
    canvas.style.cursor = toolName === 'eraser' ? 'cell' : 'crosshair';
}

// ── Toolbar: Brush Size ────────────────────────────────────────────────────
brushSlider.addEventListener('input', (e) => {
    state.lineWidth = parseInt(e.target.value);
    sizeLabel.textContent = `${state.lineWidth}px`;
});

document.querySelectorAll('.size-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const size = parseInt(dot.dataset.size);
        state.lineWidth = size;
        brushSlider.value = size;
        sizeLabel.textContent = `${size}px`;
    });
});

// ── Toolbar: Actions ───────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear the board for ALL participants?')) return;
    clearCanvas(true);
    if (state.connected) {
        state.stompClient.send('/app/clear', {}, '');
    }
});

document.getElementById('btn-undo').addEventListener('click', undo);

function undo() {
    if (state.undoStack.length === 0) {
        showToast('Nothing to undo');
        return;
    }
    const snapshot = state.undoStack.pop();
    ctx.putImageData(snapshot, 0, 0);
    // Note: undo is local-only; a full collaborative undo requires server-side stroke deletion
}

function clearCanvas(broadcast) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.undoStack = [];
    state.hasDrawn = false;
    canvasHint.classList.remove('hidden');
}

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'p' || e.key === 'P') activateTool('pen');
    if (e.key === 'e' || e.key === 'E') activateTool('eraser');
});

// ── Status Helpers ─────────────────────────────────────────────────────────
function setStatus(state) {
    statusDot.className = 'status-dot ' + state;
    const labels = {
        connecting: 'Connecting…',
        connected: 'Connected',
        disconnected: 'Disconnected — retrying…',
    };
    statusText.textContent = labels[state] || state;
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Boot ───────────────────────────────────────────────────────────────────
connect();
