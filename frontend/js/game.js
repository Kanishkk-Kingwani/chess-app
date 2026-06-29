/* ============================================================
   Live game page.
   - chess.js     : the rules engine (legal moves, check, mate)
   - chessboard.js: the visuals (drag & drop)
   - the backend  : validates + saves every move (survives refresh)
   ============================================================ */

let gameId = localStorage.getItem("chess_game_id");
if (!gameId) window.location.href = "index.html";

let game = new Chess();
let board = null;
let currentState = null;

const movesEl = document.getElementById("moves");
const turnEl  = document.getElementById("turn");
const whiteEl = document.getElementById("whiteName");
const blackEl = document.getElementById("blackName");
const toast   = document.getElementById("toast");
const overlay = document.getElementById("overlay");

/* ---------- toast ---------- */
function showToast(msg, ok = false) {
  toast.textContent = msg;
  toast.classList.toggle("ok", ok);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3800);
}

/* ---------- sounds (Web Audio, no files) ---------- */
let audioCtx = null;
function beep(freq, ms, type = "sine", gain = 0.05) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), v = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; v.gain.value = gain;
    o.connect(v).connect(audioCtx.destination); o.start();
    v.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch (e) {}
}
const soundMove    = () => beep(320, 80, "triangle");
const soundCapture = () => beep(180, 130, "sawtooth", 0.07);
const soundCheck   = () => { beep(660, 90); setTimeout(() => beep(880, 90), 90); };
const soundEnd     = () => { beep(520, 150); setTimeout(() => beep(390, 220), 150); };

/* ---------- backend ---------- */
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    let detail = "Request failed (" + res.status + ")";
    try { detail = (await res.json()).detail || detail; } catch (e) {}
    throw new Error(detail);
  }
  return res.json();
}

/* ---------- captured pieces + material ---------- */
const GLYPH = {
  black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" },
  white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" },
};
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START = { p: 8, n: 2, b: 2, r: 2, q: 1 };

function renderCaptures() {
  const cur = { w: { p:0,n:0,b:0,r:0,q:0 }, b: { p:0,n:0,b:0,r:0,q:0 } };
  for (const row of game.board()) {
    for (const sq of row) {
      if (sq && sq.type !== "k") cur[sq.color][sq.type]++;
    }
  }
  let advantage = 0;          // positive = White ahead
  const order = ["q", "r", "b", "n", "p"];
  const whiteTray = [], blackTray = [];
  for (const t of order) {
    const blackMissing = START[t] - cur.b[t];   // captured by White
    const whiteMissing = START[t] - cur.w[t];   // captured by Black
    for (let i = 0; i < blackMissing; i++) whiteTray.push(GLYPH.black[t]);
    for (let i = 0; i < whiteMissing; i++) blackTray.push(GLYPH.white[t]);
    advantage += (blackMissing - whiteMissing) * VALUE[t];
  }
  document.getElementById("capWhite").textContent = whiteTray.join(" ");
  document.getElementById("capBlack").textContent = blackTray.join(" ");
  document.getElementById("advWhite").textContent = advantage > 0 ? "+" + advantage : "";
  document.getElementById("advBlack").textContent = advantage < 0 ? "+" + (-advantage) : "";
}

/* ---------- highlights ---------- */
function clearDots() { $("#board .square-55d63").removeClass("hl-dot"); }
function clearAllHighlights() { $("#board .square-55d63").removeClass("hl-last hl-check hl-dot"); }

function showDots(square) {
  const legal = game.moves({ square: square, verbose: true });
  for (const m of legal) $("#board .square-" + m.to).addClass("hl-dot");
}

function lastMoveSquares(sans) {
  if (!sans || !sans.length) return null;
  const tmp = new Chess();
  for (const s of sans) if (!tmp.move(s)) return null;
  const h = tmp.history({ verbose: true });
  const m = h[h.length - 1];
  return m ? { from: m.from, to: m.to } : null;
}

function kingSquare(color) {
  const board2d = game.board(), files = "abcdefgh";
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = board2d[r][f];
    if (sq && sq.type === "k" && sq.color === color) return files[f] + (8 - r);
  }
  return null;
}

function paintHighlights(state) {
  clearAllHighlights();
  const last = lastMoveSquares(state.moves);
  if (last) { $("#board .square-" + last.from).addClass("hl-last"); $("#board .square-" + last.to).addClass("hl-last"); }
  if (game.in_check()) {
    const ks = kingSquare(game.turn());
    if (ks) $("#board .square-" + ks).addClass("hl-check");
  }
}

/* ---------- rendering ---------- */
function renderMoves(moves) {
  if (!moves || !moves.length) { movesEl.innerHTML = '<div class="empty">No moves yet.</div>'; return; }
  let html = "";
  for (let i = 0; i < moves.length; i += 2) {
    html += `<div class="move-row"><span class="num">${i/2+1}.</span>` +
            `<span class="ply">${moves[i] || ""}</span><span class="ply">${moves[i+1] || ""}</span></div>`;
  }
  movesEl.innerHTML = html;
  movesEl.scrollTop = movesEl.scrollHeight;
}

function renderStatus(state) {
  if (state.status === "ongoing") {
    turnEl.classList.remove("over");
    const name = state.turn === "white" ? state.white_name : state.black_name;
    turnEl.textContent = name + " to move (" + state.turn + ")";
    return;
  }
  turnEl.classList.add("over");
  if (state.status === "checkmate") {
    const w = state.result === "white" ? state.white_name : state.black_name;
    turnEl.textContent = "Checkmate - " + w + " wins";
  } else if (state.status === "stalemate") {
    turnEl.textContent = "Stalemate - draw";
  } else { turnEl.textContent = "Draw"; }
}

function showOverlay(state) {
  let title = "Draw", sub = "The game ended in a draw.";
  if (state.status === "checkmate") {
    const w = state.result === "white" ? state.white_name : state.black_name;
    title = "Checkmate"; sub = w + " wins.";
  } else if (state.status === "stalemate") { title = "Stalemate"; sub = "Draw - no legal moves left."; }
  document.getElementById("ovTitle").textContent = title;
  document.getElementById("ovSub").textContent = sub;
  overlay.classList.add("show");
}
function hideOverlay() { overlay.classList.remove("show"); }

function applyState(state) {
  currentState = state;
  game.load(state.fen);
  board.position(state.fen, false);
  if (state.status === "ongoing") board.orientation(state.turn);  // stop flipping once the game is over
  whiteEl.textContent = state.white_name;
  blackEl.textContent = state.black_name;
  renderMoves(state.moves);
  renderCaptures();
  renderStatus(state);
  setTimeout(() => paintHighlights(state), 0);  // wait for the board to redraw, then mark squares
  if (state.status !== "ongoing") showOverlay(state); else hideOverlay();
}

/* ---------- board interaction ---------- */
function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if ((game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (game.turn() === "b" && piece.search(/^w/) !== -1)) return false;
  showDots(source);
}

function onDrop(source, target) {
  clearDots();
  const move = game.move({ from: source, to: target, promotion: "q" });
  if (move === null) return "snapback";
  if (move.flags.includes("c") || move.flags.includes("e")) soundCapture(); else soundMove();
  persist(source, target, move);
}

function onSnapEnd() { board.position(game.fen()); }

async function persist(source, target, localMove) {
  try {
    const state = await api(`/games/${gameId}/move`, {
      method: "POST",
      body: JSON.stringify({ from_square: source, to_square: target, promotion: "q" }),
    });
    applyState(state);
    if (state.status !== "ongoing") soundEnd();
    else if (game.in_check()) soundCheck();
  } catch (err) {
    game.undo();
    board.position(game.fen());
    showToast("Move not saved: " + err.message + ". It has been undone.");
  }
}

/* ---------- build board ---------- */
board = Chessboard("board", {
  draggable: true,
  position: "start",
  showNotation: true,
  pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
});
$(window).resize(() => { board.resize(); if (currentState) paintHighlights(currentState); });

/* ---------- buttons ---------- */
async function newGame() {
  try {
    const s = await api("/games", {
      method: "POST",
      body: JSON.stringify({ white_name: currentState.white_name, black_name: currentState.black_name }),
    });
    localStorage.setItem("chess_game_id", s.id);
    gameId = s.id;
    game = new Chess();
    applyState(s);
    showToast("New game started.", true);
  } catch (err) { showToast("Could not start a new game: " + err.message); }
}

document.getElementById("flip").addEventListener("click", () => board.flip());
document.getElementById("restart").addEventListener("click", () => {
  if (confirm("Start a new game? The current one is saved in Past games.")) newGame();
});
document.getElementById("quit").addEventListener("click", () => (window.location.href = "index.html"));
document.getElementById("ovAnalyse").addEventListener("click", () => (window.location.href = "analysis.html?id=" + gameId));
document.getElementById("ovNew").addEventListener("click", newGame);
document.getElementById("ovMenu").addEventListener("click", () => (window.location.href = "index.html"));

/* ---------- load saved game (survives refresh) ---------- */
(async function init() {
  try {
    const state = await api(`/games/${gameId}`);
    applyState(state);
  } catch (err) {
    showToast("Couldn't load your game: " + err.message);
    if (String(err.message).toLowerCase().includes("not found")) {
      localStorage.removeItem("chess_game_id");
      setTimeout(() => (window.location.href = "index.html"), 2500);
    }
  }
})();
