// Caminho para a Encosta dos Goblins: depois de derrotar o Rei Rato (último andar do esgoto),
// abre-se uma passagem na sala dele que sobe para a montanha a oeste.
Object.assign(DungeonScene.prototype, {
  // portal azul que gira no sentido horário, com aura pulsando (arte: assets/fx/portal.png, tingida aqui)
  makePortal(x, y, size, tint = 0x4a8cff) {
    // portal novo (pixelfx): fenda azul em pé que gira e puxa partículas; o antigo fica de reserva
    if (this.anims.exists("pfx_portal")) {
      const aura = this.add.image(x, y - size * 0.2, "light").setScale(size * 1.6 / 256).setTint(tint).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 3);
      const por = playPfx(this, "portal", x, y + size * 0.15, { scale: size / 150, depth: y - 1, ents: false });
      const parts = [aura, por];
      if (this.world) this.world.add(parts); else if (this.ents) this.ents.add(parts);
      this.tweens.add({ targets: aura, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return parts;
    }
    const aura = this.add.image(x, y, "light").setScale(size * 2.6 / 256).setTint(tint).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 3);
    const ring = this.add.image(x, y, "light").setScale(size * 1.5 / 256).setTint(0xbfe0ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 2);
    const por = this.add.image(x, y, "fx_portal").setDisplaySize(size, size * 0.62).setTint(tint).setDepth(y - 1);
    const core = this.add.image(x, y, "fx_portal").setDisplaySize(size * 0.6, size * 0.37).setTint(0xd8ecff).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 1);
    const parts = [aura, ring, por, core];
    if (this.world) this.world.add(parts); else if (this.ents) this.ents.add(parts);
    // giro horário (ângulo crescente); o achatado dá a perspectiva de chão
    this.tweens.add({ targets: por, angle: 360, duration: 4200, repeat: -1 });
    this.tweens.add({ targets: core, angle: 360, duration: 2600, repeat: -1 });
    this.tweens.add({ targets: aura, alpha: 0.25, scale: aura.scale * 1.12, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: ring, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    return parts;
  },
  // chefe nunca nasce preso: se não há caminho até ele, muda para a casa alcançável mais próxima
  unstickBosses() {
    const h = this.hero, g = this.gen; if (!h) return;
    const d = g.distances(h.x, h.y, (x, y) => { const p = this.props.get(key(x, y)); return !p || p.kind in BREAKABLE; });
    for (const m of this.monsters) {
      if (!m.elite || m.dead || d[m.y * g.w + m.x] >= 0) continue;
      let best = null, bd = 1e9;
      for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
        if (d[y * g.w + x] < 6 || !this.walkable(x, y) || this.props.has(key(x, y)) || this.occ.has(key(x, y))) continue;
        if (!this.roomyCell || this.roomyCell(x, y)) { const e = Math.abs(x - m.x) + Math.abs(y - m.y); if (e < bd) { bd = e; best = { x, y }; } }
      }
      if (!best) continue;
      this.occ.delete(key(m.x, m.y)); m.x = best.x; m.y = best.y; this.occ.set(key(m.x, m.y), m);
      const p = this.cellPos(m.x, m.y); m.px = m.fromX = p.x; m.py = m.fromY = p.y; m.moveT = 0;
    }
  },
  openSlopePass(bx, by) {
    const h = this.hero, cand = [];
    for (let r = 1; r <= 7; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = bx + dx, y = by + dy, k = key(x, y);
            if (this.walkable(x, y) && !this.occ.has(k) && !this.pickups.has(k) && !(this.stairs && this.stairs.x === x && this.stairs.y === y) && !(h.x === x && h.y === y)) cand.push({ x, y, d: Math.abs(dx) + Math.abs(dy) });
    }
    const c = cand.sort((a, b) => a.d - b.d)[0];   // a casa livre mais próxima do chefe
    if (!c) return;
    const p = this.cellPos(c.x, c.y);
    this.makePortal(p.x, p.y - T * 0.35, T * 1.25);
    this.lights.push({ x: p.x, y: p.y - T / 2, r: 3.5 * T, warm: false, ph: 0 });
    this.slopePass = { x: c.x, y: c.y };
    this.time.delayedCall(1800, () => this.msg(t("slope_pass_open")));
  },
});
{
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) {
    const r = md.apply(this, [m, ...a]);
    if (m.elite && !this.region.testMap) { const dv = Save.voc(this.vocId); if (!dv.firstBoss) { dv.firstBoss = true; Save.save(); this.time.delayedCall(1800, () => this.msg && this.msg(t("oracle_awake"))); } }
    // chefe morto: todos os monstros ao redor caem junto
    if (m.elite && !this._bossPurge && !this.region.testMap) {
      this._bossPurge = true;
      for (const o of this.monsters.slice()) if (o !== m && !o.dead && !o.elite && Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) <= 10) { o.hp = 0; this.monsterDied(o); }
      this._bossPurge = false;
    }
    if (m.elite && this.regionId === "karhyn_sewers" && this.floorN >= this.floors && !this.slopePass) {
      const d = Save.voc(this.vocId); d.slopeOpen = true; Save.save();
      this.openSlopePass(m.x, m.y);
    }
    return r;
  };
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) { this.slopePass = null; const r = bf.apply(this, a); try { this.unstickBosses(); } catch (e) {} return r; };
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
