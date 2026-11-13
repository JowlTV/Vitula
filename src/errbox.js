  // se algo der errado, mostra o erro na tela (em vez de o jogo simplesmente parar) para podermos corrigir
  window.addEventListener("error", e => {
    let b = document.getElementById("errbox");
    if (!b) { b = document.createElement("div"); b.id = "errbox"; b.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#2a0c0c;color:#f4d0c0;border:1px solid #a33;padding:10px;font:12px monospace;white-space:pre-wrap;max-height:40vh;overflow:auto"; document.body.appendChild(b); }
    b.textContent = (typeof t === "function" ? t("err_title") : "Erro no jogo (tire um print e mande):") + "\n" + (e.message || e) + "\n" + ((e.error && e.error.stack) || (e.filename + ":" + e.lineno));
  });
