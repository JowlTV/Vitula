// Rook Forest (tutorial): mata escura, tochas espalhadas e, no fim da trilha, a frente do castelo de Karhyn.
Object.assign(DungeonScene.prototype, {
  // decoração plana: cogumelos e troncos caídos junto às árvores
  forestDecor() {
    const g = this.gen;
    for (let i = 0; i < g.rooms.length; i++) {
      const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !this.decorUsed.has(key(c.x, c.y))));
      const edge = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
      for (let k = 0; k < 2 && edge.length; k++) { const c = edge.pop(); this.decorUsed.add(key(c.x, c.y));
        this.floorRT.draw(this.stamp(g.rng() < 0.5 ? "forest_mushrooms" : "forest_log").setOrigin(0.5).setScale(0.6).setAlpha(0.95), c.x * T + T / 2, c.y * T + T / 2); }
    }
  },
  // clareiras: arbustos, tocos, troncos, árvores mortas e uma tocha acesa
  forestChamber(i, isFar, blocked) {
    const g = this.gen;
    const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !blocked(c.x, c.y)));
    const edge = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
    const kinds = ["forest_bush", "forest_bush", "forest_stump", "forest_log", "forest_deadtree"];
    for (let k = 0, n = g.rand(2, 4); k < n && edge.length; k++) { const c = edge.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, kinds[g.rand(0, kinds.length - 1)]); }
    if (edge.length && g.rng() < 0.75) { const c = edge.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, "torch_stand"); }
    if (isFar && edge.length) { const c = edge.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, "chest_closed"); }
  },
  // a saída: o portão do castelo de Karhyn (mesma arte da muralha da cidade), com tochas dos dois lados
  forestGate() {
    const s = this.stairs; if (!s) return;
    const W = 7, k = "tg_gate_" + W;
    if (!this.textures.exists(k)) TG.make(this, k, "gate", W);
    const img = this.add.image((s.x + 0.5) * T, (s.y + 1) * T + 6, k).setOrigin(0.5, 1);
    img.setScale(W * T / img.width).setDepth((s.y + 1) * T + 4).setTint(0xb0b4a8);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.world.add(img); this.gateImg = img;
    if (this.stairsGfx) this.stairsGfx.setVisible(false);
    // as tochas do portal (pintadas na arte) iluminam a entrada
    const p = this.cellPos(s.x, s.y);
    for (const dx of [-0.6, 0.6]) this.lights.push({ x: p.x + dx * T, y: p.y - 70, r: 4.5 * T, warm: true, ph: dx * 3 });
    this.lights.push({ x: p.x, y: p.y - 3 * T, r: 6 * T, warm: true, ph: 2 });
  },
});
{ // quem passa atrás do portão fica escondido: o portão é desenhado por cima de tudo o que está acima dele
  const ds = DungeonScene.prototype.drawStairs;
  DungeonScene.prototype.drawStairs = function (...a) { const r = ds.apply(this, a); if (this.forest) this.forestGate(); return r; };
}
