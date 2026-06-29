/* Replay a finished (or in-progress) game move by move.
   We rebuild every board position on the frontend from the saved move list,
   so stepping forward/back is just moving an index through that list. */

const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");
const movesEl = document.getElementById("moves");
const metaEl = document.getElementById("meta");

let board = null;
let fens = [];        // fens[i] = position after i half-moves (fens[0] = start)
let verbose = [];     // verbose move objects, for from/to highlighting
let ptr = 0;          // how many moves are currently shown

document.getElementById("history").addEventListener("click", () => (window.location.href = "history.html"));
document.getElementById("menu").addEventListener("click", () => (window.location.href = "index.html"));

function clearHighlights() { $("#board .square-55d63").removeClass("hl-last"); }
function highlightLast() {
  clearHighlights();
  if (ptr > 0) {
    const m = verbose[ptr - 1];
    $("#board .square-" + m.from).addClass("hl-last");
    $("#board .square-" + m.to).addClass("hl-last");
  }
}

function render() {
  board.position(fens[ptr], false);
  setTimeout(highlightLast, 0);
  // mark the active move in the list
  const plies = document.querySelectorAll("#moves .ply");
  plies.forEach((el, i) => el.classList.toggle("active", i === ptr - 1));
  metaEl.textContent = "Move " + ptr + " of " + (fens.length - 1);
}

function goto(n) { ptr = Math.max(0, Math.min(fens.length - 1, n)); render(); }

function buildMoveList(sans) {
  if (!sans.length) { movesEl.innerHTML = '<div class="empty">No moves.</div>'; return; }
  let html = "";
  for (let i = 0; i < sans.length; i += 2) {
    html += `<div class="move-row"><span class="num">${i/2+1}.</span>` +
            `<span class="ply" data-ply="${i+1}">${sans[i] || ""}</span>` +
            `<span class="ply" data-ply="${i+2}">${sans[i+1] || ""}</span></div>`;
  }
  movesEl.innerHTML = html;
  movesEl.querySelectorAll(".ply").forEach((el) => {
    if (!el.textContent) return;
    el.addEventListener("click", () => goto(parseInt(el.dataset.ply, 10)));
  });
}

function resultText(g) {
  if (g.status === "checkmate") {
    const w = g.result === "white" ? g.white_name : g.black_name;
    return "Checkmate - " + w + " won";
  }
  if (g.status === "stalemate") return "Stalemate - draw";
  if (g.status === "draw") return "Draw";
  return "In progress";
}

(async function init() {
  board = Chessboard("board", {
    draggable: false,
    position: "start",
    showNotation: true,
    pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
  });
  $(window).resize(() => { board.resize(); highlightLast(); });

  if (!gameId) { metaEl.textContent = "No game selected."; return; }

  try {
    const res = await fetch(API_BASE + "/games/" + gameId);
    if (!res.ok) throw new Error("Server returned " + res.status);
    const g = await res.json();

    document.getElementById("whiteName").textContent = g.white_name;
    document.getElementById("blackName").textContent = g.black_name;

    // rebuild every position from the move list
    const engine = new Chess();
    fens = [engine.fen()];
    verbose = [];
    for (const san of g.moves) {
      const m = engine.move(san);
      verbose.push(m);
      fens.push(engine.fen());
    }

    buildMoveList(g.moves);
    ptr = fens.length - 1;          // start at the final position
    render();
    document.querySelector(".board-foot").textContent = resultText(g);
  } catch (err) {
    metaEl.textContent = "Couldn't load game: " + err.message;
  }
})();

document.getElementById("first").addEventListener("click", () => goto(0));
document.getElementById("prev").addEventListener("click", () => goto(ptr - 1));
document.getElementById("next").addEventListener("click", () => goto(ptr + 1));
document.getElementById("last").addEventListener("click", () => goto(fens.length - 1));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") goto(ptr - 1);
  else if (e.key === "ArrowRight") goto(ptr + 1);
  else if (e.key === "Home") goto(0);
  else if (e.key === "End") goto(fens.length - 1);
});
