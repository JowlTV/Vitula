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
    // portão lateral de Karhyn, na vertical: a passagem fica alinhada à saída, na borda direita da floresta
    const img = this.add.image(s.x * T - T * 0.2, (s.y + 0.5) * T, "vk_portao_lateral").setOrigin(0, 0.55);
    img.setScale(3.34 * T / img.width).setDepth((s.y + 1.6) * T).setTint(0xb0b4a8);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.world.add(img); this.gateImg = img;
    if (this.stairsGfx) this.stairsGfx.setVisible(false);
    const p = this.cellPos(s.x, s.y);
    for (const dy of [-1.6, 1.6]) this.lights.push({ x: p.x + T, y: p.y + dy * T, r: 4.5 * T, warm: true, ph: dy * 3 });
    this.lights.push({ x: p.x - T, y: p.y, r: 6 * T, warm: true, ph: 2 });
  },
  // leva a saída para a célula mais à direita do mapa (encostada na parede), onde fica o portão
  forestMoveExit() {
    const g = this.gen; let best = null;
    for (let y = 2; y < g.h - 2; y++) for (let x = 1; x < g.w - 1; x++)
      if (g.isWalk(x, y) && g.isWalk(x - 1, y) && !g.isFloor(x + 1, y) && !g.isBridge(x, y) && (!best || x > best.x)) best = { x, y };
    if (best) { this.stairs = best; this.clearCell(best.x, best.y); }
  },
});
{ // quem passa atrás do portão fica escondido: o portão é desenhado por cima de tudo o que está acima dele
  const ds = DungeonScene.prototype.drawStairs;
  DungeonScene.prototype.drawStairs = function (...a) {
    if (!this.forest) return ds.apply(this, a);
    // floresta: sem o piso de saída (a seta); a saída é o próprio portão de Karhyn
    if (this.gateImg && this.gateImg.scene) return;
    this.forestMoveExit(); this.stairsGfx = null; this.forestGate(); this.drawMinimap();
  };
}
