const toast = document.getElementById("toast");
function showToast(msg, ok = false) {
  toast.textContent = msg;
  toast.classList.toggle("ok", ok);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

const startBtn = document.getElementById("start");
const continueBtn = document.getElementById("continue");
const historyBtn = document.getElementById("history");

// Show "Continue" only if there's a saved game.
if (localStorage.getItem("chess_game_id")) continueBtn.style.display = "flex";

continueBtn.addEventListener("click", () => (window.location.href = "game.html"));
historyBtn.addEventListener("click", () => (window.location.href = "history.html"));

startBtn.addEventListener("click", async () => {
  const white = document.getElementById("white").value.trim() || "White";
  const black = document.getElementById("black").value.trim() || "Black";

  startBtn.disabled = true;
  startBtn.textContent = "Setting up…";
  try {
    const res = await fetch(API_BASE + "/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ white_name: white, black_name: black }),
    });
    if (!res.ok) throw new Error("Server returned " + res.status);
    const game = await res.json();
    localStorage.setItem("chess_game_id", game.id);
    window.location.href = "game.html";
  } catch (err) {
    showToast("Couldn't reach the server. Is the backend running? (" + err.message + ")");
    startBtn.disabled = false;
    startBtn.textContent = "Start new game";
  }
});
