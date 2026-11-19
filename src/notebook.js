// Tecla N: abre o Bestiário (o mesmo que ficava na Biblioteca de Karhyn), na cidade e nas masmorras.
for (const S of [DungeonScene, TownScene]) {
  const cr = S.prototype.create;
  S.prototype.create = function (...a) {
    const r = cr.apply(this, a);
    const K = Phaser.Input.Keyboard.KeyCodes;
    for (const n of (Settings.data.keys.notebook || ["N"])) if (K[n] !== undefined) this.input.keyboard.addKey(K[n]).on("down", () => this.bestBox ? closeBestiary(this) : openBestiary(this));
    this.input.keyboard.on("keydown-ESC", () => closeBestiary(this));
    return r;
  };
}
