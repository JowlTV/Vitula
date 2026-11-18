// Transição "Wipe": uma cortina escura inclinada, com borda dourada, varre a tela da esquerda para a direita.
// Substitui o escurecer (fadeOut/fadeIn) nas trocas curtas da cidade e da masmorra: descer/subir andares,
// entrar/sair do esgoto, waypoint (harpa), Recall, passagem da Encosta — e ao entrar nas lojas.
const WIPE_MS = 340, WIPE_SCENES = ["dungeon", "town"];
let _wipeCarry = false;   // a cortina fechou numa cena e deve abrir na próxima

function wipeCover(scene) {
  if (scene._wipe && scene._wipe.scene) return scene._wipe;
  const W = VIEW_W, H = VIEW_H, S = 90, g = scene.add.graphics().setDepth(1e9);
  g.fillStyle(0x07060a, 1).fillPoints([{ x: 0, y: 0 }, { x: W + S, y: 0 }, { x: W, y: H }, { x: -S, y: H }], true);
  g.lineStyle(3, 0xc8a050, 0.9).lineBetween(W + S, 0, W, H);
  g.lineStyle(1, 0x6a4a20, 0.8).lineBetween(-S, H, 0, 0);
  if (scene.uiLayer) scene.uiLayer.add(g); else g.setScrollFactor(0);
  scene._wipe = g; return g;
}
// fecha a cortina (entra pela esquerda) e chama cb quando a tela está coberta
function wipeIn(scene, cb, ms = WIPE_MS) {
  const g = wipeCover(scene); g.x = -(VIEW_W + 100);
  scene.tweens.add({ targets: g, x: 0, duration: ms, ease: "Cubic.in", onComplete: () => cb && cb() });
}
// abre a cortina (sai pela direita)
function wipeOut(scene, ms = WIPE_MS + 60) {
  const g = wipeCover(scene); g.x = 0;
  scene.tweens.add({ targets: g, x: VIEW_W + 100, duration: ms, ease: "Cubic.out", onComplete: () => { g.destroy(); scene._wipe = null; } });
}

{
  const C = Phaser.Cameras.Scene2D.Camera.prototype, fo = C.fadeOut, fi = C.fadeIn;
  const usesWipe = (cam, d) => cam.scene && WIPE_SCENES.includes(cam.scene.sys.settings.key) && cam === cam.scene.cameras.main && (d || 1000) <= 600;
  C.fadeOut = function (d, r, g, b, cb, ctx) {
    if (!usesWipe(this, d)) return fo.call(this, d, r, g, b, cb, ctx);
    const sc = this.scene, cam = this;
    wipeIn(sc, () => { _wipeCarry = true; cam.emit("camerafadeoutcomplete", cam, null); if (cb) cb.call(ctx, cam, 1); });
    return this;
  };
  C.fadeIn = function (d, r, g, b, cb, ctx) {
    if (!usesWipe(this, d)) return fi.call(this, d, r, g, b, cb, ctx);
    _wipeCarry = false;
    if (this.scene._wipe) wipeOut(this.scene);
    this.emit("camerafadeincomplete", this, null);
    return this;
  };
  // nova cena chegou com a cortina fechada: abre
  for (const S of [DungeonScene, TownScene]) {
    const cr = S.prototype.create;
    S.prototype.create = function (...a) {
      const carry = _wipeCarry; this._wipe = null;
      const r = cr.apply(this, a);
      if (carry) { _wipeCarry = false; wipeCover(this).x = 0; this.time.delayedCall(60, () => wipeOut(this)); }
      return r;
    };
  }
  // lojas e prédios: a cortina passa e revela a sala por dentro
  const si = TownScene.prototype.showInterior;
  TownScene.prototype.showInterior = function (kind) {
    const had = this.interior; const r = si.call(this, kind);
    if (!had && this.interior && !this._wipe) { wipeCover(this).x = 0; wipeOut(this, 420); }
    return r;
  };
}
