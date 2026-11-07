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
  scene: [BootScene, TitleScene, OptionsScene, SelectScene, MapScene, ShopScene, DungeonScene, TownScene],
});

// Recalcula o tamanho do canvas ao girar o celular ou mudar a janela (o Phaser nem sempre acompanha sozinho).
const refreshScale = () => { try { game.scale.refresh(); } catch (e) {} };
window.addEventListener("resize", refreshScale);
window.addEventListener("orientationchange", () => setTimeout(refreshScale, 300));
if (window.visualViewport) window.visualViewport.addEventListener("resize", refreshScale);
