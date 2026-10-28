// Apply a saved theme before first paint to avoid a flash. A file of its own rather than an inline
// script, so the Content-Security-Policy can forbid inline scripts altogether.
try {
  var t = localStorage.getItem('expenser-theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch (e) {}
