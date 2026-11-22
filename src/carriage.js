// Abertura de cada personagem novo: três quadros na carruagem (arte própria por classe) antes da Rook Forest.
// 1) lendo os contratos  2) o raio quebra a roda  3) ninguém lá fora, o cavalo foge.
// Depois o jogo começa ao lado da carruagem caída (ver forestWreck, mais abaixo).
class CarriageScene extends Phaser.Scene {
  constructor() { super("carriage"); }
  preload() {
    const v = this.registry.get("vocation") === "archer" ? "archer" : "knight";
    for (let i = 1; i <= 3; i++) if (!this.textures.exists(`intro_${v}_${i}`)) this.load.image(`intro_${v}_${i}`, `assets/intro/${v}_${i}.jpg`);
  }
  create() {
    this.v = this.registry.get("vocation") === "archer" ? "archer" : "knight";
    zoom2(this.cameras.main); this.cameras.main.setBackgroundColor("#050406");
    this.step = -1; this.busy = false; this.layer = this.add.container(0, 0);
    const skip = txt(this, VIEW_W - 14, 12, t("carriage_skip"), 12, COLORS.dim).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    skip.on("pointerup", e => { e.event && e.event.stopPropagation && e.event.stopPropagation(); this.finish(); });
    this.input.on("pointerup", () => this.next());
    this.input.keyboard.on("keydown", ev => { if (ev.key === "Escape") this.finish(); else this.next(); });
    playMusic(this, "music_title", 0.45);
    this.next();
  }
  next() {
    if (this.busy || this.ended) return;
    this.step++;
    if (this.step > 2) return this.finish();
    this.busy = true; this.time.delayedCall(700, () => { this.busy = false; });
    const old = this.layer; this.layer = this.add.container(0, 0).setAlpha(0);
    this.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.destroy() });
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, `intro_${this.v}_${this.step + 1}`);
    img.setScale(VIEW_W / img.width * 1.04); this.layer.add(img);
    // movimento lento de câmera em cada quadro
    this.tweens.add({ targets: img, scale: img.scale * 1.08, x: VIEW_W / 2 + (this.step === 1 ? 10 : -12), duration: 9000, ease: "Sine.out" });
    const box = this.add.rectangle(VIEW_W / 2, VIEW_H - 46, VIEW_W - 80, 62, 0x07060a, 0.78).setStrokeStyle(1, 0x5a4a30); this.layer.add(box);
    const line = txt(this, VIEW_W / 2, VIEW_H - 46, t("carriage_" + (this.step + 1)), this.step === 1 ? 34 : 15, this.step === 1 ? "#f0e0b0" : COLORS.text,
      { align: "center", wordWrap: { width: VIEW_W - 130 }, title: this.step === 1 }).setOrigin(0.5); this.layer.add(line);
    const hint = txt(this, VIEW_W - 50, VIEW_H - 24, "▸", 14, COLORS.gold).setOrigin(0.5); this.layer.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 600 });
    if (this.step === 1) {   // o raio: clarão, tremor e o estalo
      const f = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xe8f0ff, 0).setOrigin(0).setDepth(5);
      this.tweens.add({ targets: f, alpha: { from: 0.95, to: 0 }, duration: 160, repeat: 2, repeatDelay: 70, onComplete: () => f.destroy() });
      this.cameras.main.shake(380, 0.012); sfx(this, "explode", 0.7); this.time.delayedCall(120, () => sfx(this, "break", 0.6));
    }
  }
  finish() {
    if (this.ended) return; this.ended = true;
    const d = Save.voc(this.v); d.carriageSeen = true; Save.save();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      const tx = this.textures, v = this.v;   // libera a memória (importante no celular) depois que a cena fechou
      setTimeout(() => { for (let i = 1; i <= 3; i++) if (tx.exists(`intro_${v}_${i}`)) tx.remove(`intro_${v}_${i}`); }, 1500);
      this.registry.set("region", "forest"); this.registry.set("startFloor", 1);
      stopAllButMusic(this); this.scene.start("dungeon");
    });
  }
}

// ── Rook Forest: a carruagem caída ao lado de onde o jogador começa, sangue no chão, o fim da trilha,
// chuva o tempo todo e um raio de vez em quando ──
Object.assign(DungeonScene.prototype, {
  forestWreck(start) {
    const p = this.cellPos(start.x, start.y), g = this.gen;
    // trilha de terra por onde a carruagem veio: do herói até a borda esquerda do mapa, enquanto houver chão
    const road = this.add.graphics().setDepth(-5); this.world.add(road);
    for (let x = start.x; x >= 0 && g.isWalk(x, start.y); x--) {
      const c = this.cellPos(x, start.y), a = x === start.x ? 0.12 : 0.28;
      road.fillStyle(0x3a2a1a, a).fillRect(c.x - T / 2, c.y - T * 0.42, T, T * 0.84);
      road.fillStyle(0x24180e, a + 0.1).fillRect(c.x - T / 2, c.y - T * 0.3, T, 4).fillRect(c.x - T / 2, c.y + T * 0.26, T, 4);   // sulcos das rodas
    }
    // a carruagem: na casa de cima (ou de baixo) do herói, sem bloquear o caminho
    const dy = g.isWalk(start.x, start.y - 1) || !g.isWalk(start.x, start.y + 1) ? -1 : 1;
    if (this.textures.exists("carriage_wreck")) {
      const w = this.add.image(p.x + T * 0.4, p.y + dy * T * 0.9, "carriage_wreck").setOrigin(0.5, 0.7);
      w.setScale(4.4 * T / w.width).setDepth(w.y + T * 0.2); this.ents.add(w); this.wreckImg = w;
    }
    // sangue e pegadas indo para dentro da mata
    const b = this.add.graphics().setDepth(-4); this.world.add(b);
    const rnd = (a, z) => a + Math.random() * (z - a);
    for (let i = 0; i < 9; i++) b.fillStyle(0x5a0a0a, rnd(0.45, 0.75)).fillEllipse(p.x + rnd(-T, T * 2.2), p.y + dy * T * 0.3 + rnd(-T * 0.5, T * 0.6), rnd(6, 22), rnd(4, 12));
    for (let i = 0; i < 7; i++) { const fx = p.x + T * 2 + i * T * 0.45, fy = p.y - dy * T * (0.2 + i * 0.22);
      b.fillStyle(0x1a0c08, 0.7).fillEllipse(fx, fy + (i % 2 ? 5 : -5), 7, 11); if (i < 3) b.fillStyle(0x4a0808, 0.5).fillCircle(fx + 4, fy, 2.5); }
    this.lights.push({ x: p.x - T * 0.6, y: p.y + dy * T * 0.4, r: 3 * T, warm: true, ph: 1 });   // lampião caído
  },
  forestRain() {
    if (!this.textures.exists("rain_drop")) { const gr = this.make.graphics({ add: false }); gr.fillStyle(0xffffff).fillRect(0, 0, 1, 12); gr.generateTexture("rain_drop", 1, 12); gr.destroy(); }
    const rf = this.add.particles(0, 0, "rain_drop", { x: { min: -40, max: VIEW_W + 80 }, y: -20, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: { min: -90, max: -60 },
      rotate: 8, alpha: { start: 0.4, end: 0.2 }, tint: 0xb4c4dc, quantity: LOW_MEM ? 1 : 2, frequency: 14 });
    this.uiLayer.addAt(rf, 0); this.forestRainFx = rf; this.boltT = Phaser.Math.Between(5, 12);
  },
  forestBolt(dt) {
    if (!this.forestRainFx) return;
    this.boltT -= dt; if (this.boltT > 0) return;
    this.boltT = Phaser.Math.Between(12, 30);
    const f = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xdfe8ff, 0).setOrigin(0); this.uiLayer.addAt(f, 0);
    this.tweens.add({ targets: f, alpha: { from: 0.5, to: 0 }, duration: 120, repeat: Phaser.Math.Between(1, 2), repeatDelay: Phaser.Math.Between(40, 110), onComplete: () => f.destroy() });
    this.time.delayedCall(Phaser.Math.Between(300, 900), () => sfx(this, "explode", 0.25));   // trovão
  },
});
{
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) {
    const r = bf.apply(this, a);
    if (this.forest) {
      if (!this.forestRainFx) this.forestRain();
      if (this.floorN === 1 && this.rope) this.forestWreck(this.rope);
    }
    return r;
  };
  const up = DungeonScene.prototype.update;
  DungeonScene.prototype.update = function (time, delta) {
    const r = up.call(this, time, delta);
    if (this.forest && !this.paused) this.forestBolt(delta / 1000);
    return r;
  };
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) { this.forestRainFx = null; return cr.apply(this, a); };
}
