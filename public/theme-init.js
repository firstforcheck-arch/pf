(function () {
  try {
    var saved = localStorage.getItem("theme");
    var theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    // The page can safely use its default theme when storage is unavailable.
  }
})();
