/* Light/dark theme. Default is "auto" = follow the operating system setting.
   The toggle button cycles Auto -> Light -> Dark and remembers the choice.
   This runs immediately (in <head>) so the page doesn't flash the wrong colours. */
(function () {
  const KEY = "chess_theme";
  let current = localStorage.getItem(KEY) || "auto";

  function apply(mode) {
    const html = document.documentElement;
    if (mode === "light" || mode === "dark") {
      html.setAttribute("data-theme", mode);   // explicit override
    } else {
      html.removeAttribute("data-theme");       // "auto" -> let the OS decide via CSS
    }
  }
  apply(current);

  function label() {
    if (current === "auto") return "◐ Auto";
    if (current === "light") return "☀ Light";
    return "☾ Dark";
  }
  function updateButton() {
    const btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = label();
  }

  window.cycleTheme = function () {
    current = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
    localStorage.setItem(KEY, current);
    apply(current);
    updateButton();
  };

  document.addEventListener("DOMContentLoaded", updateButton);
})();
