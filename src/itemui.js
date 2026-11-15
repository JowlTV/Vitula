// Janela de detalhes do item (ao passar o mouse) e relatório de saque (itens coletados com ícone).
const SLOT_KEY = { weapon: "slot_weapon", shield: "slot_shield", helmet: "slot_helmet", armor: "slot_armor", legs: "slot_legs", boots: "slot_boots", light: "slot_light", amulet: "slot_amulet", ring: "slot_ring" };

// ---------------------------------------------------------------- janela do item
// g = { id, r, p }; mostra a sprite grande, raridade, requisitos, atributos e a comparação com o que está vestido
function showItemCard(scene, g, opts = {}) {
  hideItemCard(scene);
  const E = EQUIP[g.id]; if (!E) return;
  const R = RARITY[g.r || 0], voc = scene.vocId, d = Save.voc(voc), lvl = scene.hero && scene.hero.level || 1;
  const c = scene.add.container(0, 0).setDepth(60); if (scene.uiLayer) scene.uiLayer.add(c); scene.itemCardBox = c;
  const W = 280, pad = 14, items = [];
  const T_ = (x, y, s, size, col, o) => { const o2 = txt(scene, x, y, s, size, col, o); items.push(o2); return o2; };
  let y = pad;
  // sprite grande (pixels inteiros: 32 → 96) com o brilho da raridade
  const glow = scene.add.image(W / 2, y + 52, "light").setScale(0.55).setTint(R.hex).setAlpha(g.r ? 0.7 : 0.25).setBlendMode(Phaser.BlendModes.ADD);
  const frame = scene.add.rectangle(W / 2, y + 52, 112, 112, 0x120e0c, 1).setStrokeStyle(2, R.hex, 1);
  const ic = scene.add.image(W / 2, y + 52, "eq_" + g.id).setScale(3);
  ic.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  items.push(frame, glow, ic); y += 116;
  T_(W / 2, y, gearName(g), 17, R.color, { align: "center", wordWrap: { width: W - 2 * pad } }).setOrigin(0.5, 0); y += 24;
  T_(W / 2, y, `${R.name} · ${t(SLOT_KEY[E.slot] || "slot_weapon")} · ${fmtOz(E.oz || 0)} oz`, 12, COLORS.dim).setOrigin(0.5, 0); y += 22;
  const line = () => { items.push(scene.add.rectangle(pad, y, W - 2 * pad, 1, 0x6a5030, 0.8).setOrigin(0)); y += 8; };
  line();
  // requisitos
  const okLvl = lvl >= (E.lvl || 0), okVoc = equipOk(g.id, voc);
  if (E.lvl) { T_(pad, y, t("card_req_level", { n: E.lvl }), 12, okLvl ? COLORS.text : "#e07060"); y += 17; }
  if (E.voc) { T_(pad, y, t("card_req_voc", { v: E.voc.map(v => VOCATIONS[v].name).join(", ") }), 12, okVoc ? COLORS.text : "#e07060"); y += 17; }
  // atributos, um por linha
  const stats = equipStats(g).split(" · ").filter(Boolean);
  if (stats.length) { if (E.lvl || E.voc) { y += 2; line(); } for (const s of stats) { T_(pad, y, "• " + s, 13, "#e8dcc0", { wordWrap: { width: W - 2 * pad } }); y += 18; } }
  // comparação com o item vestido no mesmo lugar
  const cur = d.equip && d.equip[E.slot];
  if (cur && !opts.worn && cur !== g && EQUIP[cur.id]) {
    const C = EQUIP[cur.id], diffs = [];
    if (E.atk || C.atk) diffs.push([t("card_atk"), Math.round((E.atk || 0) * gearMult(g)) - Math.round((C.atk || 0) * gearMult(cur))]);
    if (E.def || C.def) diffs.push([t("card_def"), Math.round(((E.def || 0) * gearMult(g) - (C.def || 0) * gearMult(cur)) * 10) / 10]);
    if (diffs.length) {
      y += 2; line();
      const vs = T_(pad, y, t("card_vs", { name: gearName(cur) }), 11, COLORS.dim, { wordWrap: { width: W - 2 * pad } }); y += vs.height + 2;
      for (const [k, v] of diffs) { T_(pad, y, `${v > 0 ? "▲ +" : v < 0 ? "▼ " : "= "}${String(v).replace(".", ",")} ${k}`, 13, v > 0 ? "#7ee07e" : v < 0 ? "#e07060" : COLORS.dim); y += 18; }
    }
  }
  if (E.desc) { y += 2; line(); const dt = T_(pad, y, E.desc, 12, "#c8b890", { wordWrap: { width: W - 2 * pad }, fontStyle: "italic" }); y += dt.height + 4; }
  if (opts.sell) { T_(W / 2, y + 4, t("card_hint_sell", { n: Math.max(5, Math.round((E.price || 20) * 0.25 * gearMult(g))) }), 11, COLORS.dim, { align: "center" }).setOrigin(0.5, 0); y += 18; }
  if (opts.hint) { y += 4; T_(W / 2, y, opts.hint, 11, COLORS.gold, { align: "center", wordWrap: { width: W - 2 * pad } }).setOrigin(0.5, 0); y += 18; }
  const H = y + pad - 4;
  const bg = scene.add.nineslice(0, 0, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0);
  c.add(bg); c.add(items);
  for (const o of items) if (o.type === "Text") o.setShadow(1, 1, "#000000", 0, true, true);
  // ao lado do ponteiro, sem sair da tela
  const p = scene.input.activePointer, px = p.x / (scene.cameras.main.zoom || 1), py = p.y / (scene.cameras.main.zoom || 1);
  let x = px + 24; if (x + W > VIEW_W - 6) x = px - W - 24;
  c.setPosition(Phaser.Math.Clamp(x, 6, VIEW_W - W - 6), Phaser.Math.Clamp(py - H / 2, 6, VIEW_H - H - 6));
  c.setAlpha(0); scene.tweens.add({ targets: c, alpha: 1, duration: 90 });
  return c;
}
function hideItemCard(scene) { if (scene.itemCardBox) { scene.itemCardBox.destroy(); scene.itemCardBox = null; } }

// ---------------------------------------------------------------- relatório de saque
// cada item coletado entra numa lista no canto esquerdo, com ícone e texto; some depois de alguns segundos
Object.assign(DungeonScene.prototype, {
  lootLog(icon, text, color = COLORS.text, opts = {}) {
    if (!this.uiLayer) return;
    this.lootList = (this.lootList || []).filter(e => e.c.active);
    // moedas seguidas somam na mesma linha
    const last = this.lootList[this.lootList.length - 1];
    if (opts.sum && last && last.sum === opts.sum && last.age < 3) {
      last.n += opts.n; last.t.setText(t(opts.sumKey, { n: last.n })); last.age = 0; last.c.setAlpha(1);
      this.tweens.add({ targets: last.ic, scale: last.ic.scale * 1.25, duration: 90, yoyo: true });
      return;
    }
    const c = this.add.container(0, 0).setDepth(14); this.uiLayer.add(c);
    const bg = this.add.rectangle(0, 0, 150, 24, 0x0c0908, 0.72).setOrigin(0, 0.5).setStrokeStyle(1, opts.hex || 0x4a3a2a, 0.9);
    const ic = this.add.image(13, 0, icon); ic.setScale(Math.min(1.5, 18 / Math.max(ic.width, ic.height)));
    if (opts.tint) ic.setTint(opts.tint);
    ic.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const tx = txt(this, 28, 0, text, 11, color).setOrigin(0, 0.5).setShadow(1, 1, "#000", 0, true, true);
    bg.setSize(Math.min(200, tx.width + 38), 24); if (tx.width > 162) tx.setText(text.slice(0, Math.floor(text.length * 162 / tx.width) - 1) + "…");
    c.add([bg, ic, tx]);
    const e = { c, t: tx, ic, age: 0, sum: opts.sum, n: opts.n || 0 };
    this.lootList.push(e);
    c.x = -260; this.tweens.add({ targets: c, x: 12, duration: 180, ease: "Back.out" });
    while (this.lootList.length > 5) { const o = this.lootList.shift(); o.c.destroy(); }
    this.layoutLoot();
    // resumo da descida (aparece no painel do fim)
    if (opts.track) { this.lootRun = this.lootRun || {}; this.lootRun[opts.track] = (this.lootRun[opts.track] || 0) + (opts.n || 1); }
  },
  layoutLoot() {
    const base = VIEW_H - 150;
    this.lootList.forEach((e, i) => { const y = base - (this.lootList.length - 1 - i) * 27; this.tweens.add({ targets: e.c, y, duration: 120 }); if (!e.c.y) e.c.y = y; });
  },
  tickLoot(dt) {
    if (!this.lootList || !this.lootList.length) return;
    for (const e of this.lootList) {
      e.age += dt;
      if (e.age > 5 && !e.fading) { e.fading = true; this.tweens.add({ targets: e.c, alpha: 0, duration: 600, onComplete: () => { e.c.destroy(); this.lootList = this.lootList.filter(x => x !== e); this.layoutLoot(); } }); }
    }
  },
});
{
  const col = DungeonScene.prototype.collect;
  DungeonScene.prototype.collect = function (k) {
    const pk = this.pickups.get(k); if (!pk) return;
    const info = ITEMS[pk.item], gb = this.goldRun;
    // o relatório substitui o texto flutuante e a mensagem de coleta
    const ft = this.floatText, ms = this.msg; this.floatText = () => {}; this.msg = () => {};
    try { col.call(this, k); } finally { this.floatText = ft; this.msg = ms; }
    if (!info) return;
    const nm = info.name;
    switch (pk.item) {
      case "gold": case "silver": case "red_gem": {
        const n = this.goldRun - gb; if (n > 0) this.lootLog(pk.item === "red_gem" ? info.icon : "i_gold_coin", t("loot_gold", { n }), COLORS.gold, pk.item === "red_gem" ? { track: "gold", n } : { sum: "gold", sumKey: "loot_gold", n, track: "gold" });
        break; }
      case "blue_gem": this.lootLog(info.icon, capFirst(nm), COLORS.soul, { track: pk.item }); break;
      case "bronze_key": this.lootLog(info.icon, capFirst(nm), COLORS.text, { track: pk.item }); break;
      case "scroll": this.lootLog(info.icon, capFirst(nm), "#d8c8a0", { track: pk.item }); break;
      default:
        if (info.gear) { const d = Save.voc(this.vocId), g = d.gear[d.gear.length - 1], R = RARITY[(g && g.r) || 0];
          this.lootLog("eq_" + info.gear, g ? gearName(g) : nm, R.color, { hex: R.hex, track: "gear" }); break; }
        if (pk.item === "boss_essence") { this.lootLog(info.icon || "i_red_gem", capFirst(nm), "#ffa030", { tint: info.tint, track: pk.item }); break; }
        this.lootLog(info.icon, capFirst(nm), "#c8e0a0", { tint: info.tint, track: pk.item });
    }
  };
  const upd = DungeonScene.prototype.update;
  DungeonScene.prototype.update = function (time, dtMs) { upd.call(this, time, dtMs); this.tickLoot(Math.min(0.1, dtMs / 1000)); };
}
function capFirst(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
