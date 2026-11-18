// Caminho para a Encosta dos Goblins: depois de derrotar o Rei Rato (último andar do esgoto),
// abre-se uma passagem na sala dele que sobe para a montanha a oeste.
Object.assign(DungeonScene.prototype, {
  openSlopePass(bx, by) {
    const h = this.hero, cand = [];
    for (let r = 2; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = bx + dx, y = by + dy, k = key(x, y);
      if (this.walkable(x, y) && !this.occ.has(k) && !this.pickups.has(k) && !(this.stairs && this.stairs.x === x && this.stairs.y === y) && !(h.x === x && h.y === y)) cand.push({ x, y, d: Math.abs(dx) + Math.abs(dy) });
    }
    const c = cand.sort((a, b) => b.d - a.d)[0] || cand[0]; if (!c) return;
    const p = this.cellPos(c.x, c.y);
    const img = this.add.image(p.x, p.y + 4, this.textures.exists("slope_burrow") ? "slope_burrow" : "light").setOrigin(0.5, 1);
    img.setScale(T * 1.1 / img.width).setDepth(p.y - 2); this.world.add(img);
    const glow = this.add.image(p.x, p.y - T / 2, "light").setScale(0.5).setTint(0x8ad06a).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y - 3);
    this.world.add(glow); this.tweens.add({ targets: glow, alpha: 0.12, duration: 900, yoyo: true, repeat: -1 });
    this.lights.push({ x: p.x, y: p.y - T / 2, r: 3 * T, warm: true, ph: 0 });
    this.slopePass = { x: c.x, y: c.y };
    this.time.delayedCall(1800, () => this.msg(t("slope_pass_open")));
  },
});
{
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) {
    const r = md.apply(this, [m, ...a]);
    if (m.elite && this.regionId === "karhyn_sewers" && this.floorN >= this.floors && !this.slopePass) {
      const d = Save.voc(this.vocId); d.slopeOpen = true; Save.save();
      this.openSlopePass(m.x, m.y);
    }
    return r;
  };
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) { this.slopePass = null; return bf.apply(this, a); };
  const ha = DungeonScene.prototype.heroArrived;
  DungeonScene.prototype.heroArrived = function () {
    const r = ha.call(this), h = this.hero, s = this.slopePass;
    if (s && !this.finished && h.x === s.x && h.y === s.y) {
      this.finished = true;
      Save.addGold(this.vocId, Math.round(this.goldRun * this.stats.greed)); Save.addKills(this.killsByType); Save.save();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => { this.registry.set("region", "goblin_slope"); this.registry.set("startFloor", 1); this.scene.start("dungeon"); });
    }
    return r;
  };
}
