/*! Klokk embed loader. Usage:
 *  <div data-klokk-embed="emb.xxxxx"></div>
 *  <script async src="https://YOUR-KLOKK-DOMAIN/embed.js"></script>
 * Creates a sandboxed iframe that resizes itself to fit the widget.
 */
(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "";
  function mount(el) {
    var token = el.getAttribute("data-klokk-embed");
    if (!token || el.getAttribute("data-klokk-mounted")) return;
    el.setAttribute("data-klokk-mounted", "1");
    var f = document.createElement("iframe");
    f.src = origin + "/embed/" + encodeURIComponent(token);
    f.title = "Klokk scheduling";
    f.loading = "lazy";
    f.style.cssText = "width:100%;border:0;min-height:520px;display:block";
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    el.appendChild(f);
    window.addEventListener("message", function (e) {
      if (e.source !== f.contentWindow || e.origin !== origin) return;
      if (e.data && e.data.type === "klokk:height" && typeof e.data.height === "number") {
        f.style.height = Math.max(320, Math.ceil(e.data.height)) + "px";
      }
    });
  }
  function run() {
    var nodes = document.querySelectorAll("[data-klokk-embed]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
