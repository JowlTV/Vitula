// Ponto de entrada: 960×540 em pixel art, ampliado para caber na tela.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW_W * 2,
  height: VIEW_H * 2,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#08070a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { disableWebAudio: false },
  scene: [BootScene, TitleScene, OptionsScene, SelectScene, IntroScene, MapScene, ShopScene, DungeonScene, TownScene],
});

// Recalcula o tamanho do canvas ao girar o celular ou mudar a janela (o Phaser nem sempre acompanha sozinho).
// No iPhone a altura da janela inclui barras que cobrem o jogo; o visualViewport dá a área que aparece de verdade.
const fitBox = () => {
  const el = document.getElementById("game"), vv = window.visualViewport;
  if (!el || !vv) return;
  const cs = getComputedStyle(el), top = parseFloat(cs.top) || 0;
  let probe = document.getElementById("sab-probe");
  if (!probe) { probe = document.createElement("div"); probe.id = "sab-probe"; probe.style.cssText = "position:fixed;visibility:hidden;height:env(safe-area-inset-bottom);width:1px"; document.body.appendChild(probe); }
  const safeB = probe.offsetHeight || 0;
  el.style.height = Math.max(200, vv.height - top - safeB) + "px";
};
const refreshScale = () => { fitBox(); try { game.scale.refresh(); } catch (e) {} };
fitBox();
window.addEventListener("resize", refreshScale);
window.addEventListener("orientationchange", () => setTimeout(refreshScale, 300));
if (window.visualViewport) window.visualViewport.addEventListener("resize", refreshScale);
