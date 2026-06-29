const listEl = document.getElementById("list");
document.getElementById("back").addEventListener("click", () => (window.location.href = "index.html"));

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
         " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function resultLabel(g) {
  if (g.status === "ongoing") return { text: "In progress", cls: "ongoing" };
  if (g.status === "checkmate") {
    const w = g.result === "white" ? g.white_name : g.black_name;
    return { text: w + " won", cls: "win" };
  }
  return { text: "Draw", cls: "draw" };
}

(async function load() {
  try {
    const res = await fetch(API_BASE + "/games");
    if (!res.ok) throw new Error("Server returned " + res.status);
    const games = await res.json();

    if (!games.length) {
      listEl.innerHTML = '<div class="empty-state">No games yet. Play one and it will appear here.</div>';
      return;
    }

    listEl.innerHTML = "";
    for (const g of games) {
      const r = resultLabel(g);
      const fullMoves = Math.ceil(g.move_count / 2);
      const a = document.createElement("a");
      a.className = "history-item";
      a.href = "analysis.html?id=" + g.id;
      a.innerHTML =
        `<span class="hi-players">${g.white_name} vs ${g.black_name}</span>` +
        `<span class="hi-result ${r.cls}">${r.text}</span>` +
        `<span class="hi-meta">${fullMoves} moves · ${fmtDate(g.created_at)}</span>`;
      listEl.appendChild(a);
    }
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Couldn't load games: ${err.message}<br>Is the backend running?</div>`;
  }
})();
