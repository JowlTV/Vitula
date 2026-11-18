// Waypoints (estilo Diablo / Path of Exile): um piso com a harpa da Deusa na chegada de cada andar.
// Pisar nele ativa o ponto; dele (ou do waypoint da praça de Karhyn) dá para viajar a qualquer ponto ativado.
const WP_REGIONS = ["karhyn_sewers", "goblin_slope"];
const wpList = voc => { const d = Save.voc(voc); if (!d.wps) d.wps = {}; return d.wps; };
const wpHas = (voc, r, f) => (wpList(voc)[r] || []).includes(f);
const wpAdd = (voc, r, f) => { const w = wpList(voc); (w[r] = w[r] || []).push(f); w[r].sort((a, b) => a - b); Save.save(); };

// lista de destinos: [rótulo, região ou "town", andar]
function wpDestinations(voc, here) {
  const out = [[t("wp_town"), "town", 0]];
  for (const r of WP_REGIONS) for (const f of wpList(voc)[r] || [])
    if (!(here && here.r === r && here.f === f)) out.push([t("wp_floor", { region: REGIONS[r].name, n: f }), r, f]);
  if (here && here.r === "town") out.shift();
  return out;
}

// desenho do piso (arte do SpriteCook; sem ela, um círculo com a harpa em código)
function wpSprite(scene, cx, cy) {
  const parts = [];
  if (scene.textures.exists("waypoint")) parts.push(scene.add.image(cx, cy, "waypoint").setDisplaySize(T * 0.82, T * 0.82));
  else { const g = scene.add.graphics(); g.fillStyle(0x3a3a44, 1).fillCircle(cx, cy, T * 0.48).lineStyle(3, 0x9ad0ff, 0.9).strokeCircle(cx, cy, T * 0.4); parts.push(g); }
  const glow = scene.add.image(cx, cy, "light").setScale(0.5).setTint(0x8ac8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: glow, alpha: 0.12, scale: 0.62, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  parts.push(glow);
  return parts;
}

Object.assign(DungeonScene.prototype, {
  // coloca o waypoint numa casa livre colada à chegada do andar
  placeWaypoint() {
    this.wp = null;
    if (this.region.tutorial || !WP_REGIONS.includes(this.regionId)) return;
    const h = this.hero, cells = [];
    for (let r = 1; r <= 2 && !cells.length; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = h.x + dx, y = h.y + dy, k = key(x, y);
      if ((dx || dy) && this.walkable(x, y) && !this.occ.has(k) && !this.pickups.has(k) && !this.plates.has(k) && !(this.stairs && this.stairs.x === x && this.stairs.y === y)) cells.push({ x, y });
    }
    // prefere casas sem parede encostada (o piso não "corta" o muro)
    const open = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.gen.isFloor(c.x + dx, c.y + dy)).length;
    const c = cells.sort((a, b) => (open(b) - open(a)) || (Math.abs(a.y - h.y) - Math.abs(b.y - h.y)))[0]; if (!c) return;
    const p = this.cellPos(c.x, c.y), parts = wpSprite(this, p.x, p.y - T / 2 + 4);
    parts.forEach(o => { o.setDepth(p.y - T + 2); this.world.add(o); });
    this.wp = { x: c.x, y: c.y, parts };
    this.lights.push({ x: p.x, y: p.y - T / 2, r: 2.5 * T, warm: false, ph: 1 });
  },
  wpStep() {
    const f = this.floorN;
    if (!wpHas(this.vocId, this.regionId, f)) {
      wpAdd(this.vocId, this.regionId, f);
      this.msg(t("wp_on", { region: this.region.name, n: f })); sfx(this, "levelup", 0.3);
      this.cameras.main.flash(200, 140, 190, 255);
    }
    this.wpMenu();
  },
  wpMenu() {
    if (this.wpBox || this.finished) return;
    const dests = wpDestinations(this.vocId, { r: this.regionId, f: this.floorN });
    this.paused = true;
    const close = () => { if (this.wpBox) this.wpBox.destroy(); this.wpBox = null; this.paused = false; };
    this.wpBox = this.panel(t("wp_title"), t("wp_body"), dests.slice(0, 8).map(([label, r, f]) => [label, () => { close(); this.wpTravel(r, f); }]).concat([[t("wp_stay"), close]]));
  },
  wpTravel(r, f) {
    // guarda ouro e abates como no Recall, e parte
    this.finished = true;
    Save.addGold(this.vocId, Math.round(this.goldRun * this.stats.greed)); Save.addKills(this.killsByType); Save.save();
    this.cameras.main.flash(250, 160, 200, 255);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      if (r === "town") { this.registry.set("townSpawn", "waypoint"); this.scene.start("town"); return; }
      this.registry.set("region", r); this.registry.set("startFloor", f); this.registry.set("wpArrive", true);
      this.scene.start("dungeon");
    });
  },
});

{
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) { const r = bf.apply(this, a); this.wpBox = null; this.placeWaypoint(); return r; };
  const ha = DungeonScene.prototype.heroArrived;
  DungeonScene.prototype.heroArrived = function () {
    const r = ha.call(this), h = this.hero;
    if (this.wp && !this.finished && h.x === this.wp.x && h.y === this.wp.y) this.wpStep();
    return r;
  };
  const pz = DungeonScene.prototype.togglePause;
  DungeonScene.prototype.togglePause = function (...a) { if (this.wpBox) { this.wpBox.destroy(); this.wpBox = null; this.paused = false; return; } return pz.apply(this, a); };
}

// Karhyn: o waypoint da praça, ao lado do ponto de chegada do Recall
const WP_TOWN = [38, 10];
TownScene.prototype.townWaypoint = function () {
  const [x, y] = WP_TOWN, cx = x * T + T / 2, cy = y * T + T / 2;
  wpSprite(this, cx, cy).forEach(o => { o.setDepth(cy - T / 2); this.world.add(o); });
  this.zones.push({ name: t("wp_title"), kind: "waypoint", x, y, w: 1, h: 1, step: true });
};
TownScene.prototype.townWpMenu = function () {
  const dests = wpDestinations(this.vocId, { r: "town" });
  if (!dests.length) { this.say(t("wp_title"), t("wp_none"), [[t("leave"), () => this.closeDialog()]]); return; }
  this.say(t("wp_title"), t("wp_body"), dests.slice(0, 7).map(([label, r, f]) => [label, () => {
    this.closeDialog(); this.registry.set("region", r); this.registry.set("startFloor", f); this.registry.set("wpArrive", true); this.portalTrip = true; this.leave("dungeon");
  }]).concat([[t("wp_stay"), () => this.closeDialog()]]));
};
{
  const use = TownScene.prototype.use;
  TownScene.prototype.use = function (z) { if (z.kind === "waypoint") return this.townWpMenu(); return use.call(this, z); };
}
