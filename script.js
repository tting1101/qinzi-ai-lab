"use strict";
(() => {
  const home = document.getElementById("home");
  const details = [...document.querySelectorAll(".detail")];
  function route() {
    const id = location.hash.slice(1);
    const active = details.find(page => page.id === id);
    home.hidden = Boolean(active);
    details.forEach(page => { page.hidden = page !== active; });
    document.title = active ? active.querySelector("h1").textContent + " · 亲子AI创造资料库" : "亲子AI创造资料库";
    if (active) { window.scrollTo(0, 0); active.querySelector("h1").focus({preventScroll:true}); }
    else if (id === "themes") { document.getElementById("themes").scrollIntoView(); }
    else window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const source = document.getElementById(button.dataset.copy);
      const status = button.closest(".block").querySelector(".copy-status");
      let copied = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(source.textContent); copied = true; } } catch {}
      if (!copied) {
        const field = document.createElement("textarea");
        field.value = source.textContent;
        field.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.append(field); field.select();
        try { copied = document.execCommand("copy"); } catch {}
        field.remove(); button.focus();
      }
      if (copied) { status.textContent = "已复制，可以粘贴到你选择的 AI 工具。"; }
      else { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(source); selection.removeAllRanges(); selection.addRange(range); status.textContent = "浏览器未允许自动复制，已选中文本。请按 Ctrl+C，或长按选择复制。"; }
    });
  });
})();