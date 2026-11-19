// Caderno do aventureiro (tecla N): resumo de bolso do Bestiário. A versão completa fica na Biblioteca de Karhyn.
// Mostra só as espécies já avistadas: etapa, abates até a próxima etapa, vida/dano (a partir de "Conhecido") e onde vive.
function closeNotebook(scene) { if (scene.noteBox) { scene.noteBox.destroy(); scene.noteBox = null; } }
function openNotebook(scene, page = 0) {
  closeNotebook(scene);
  const c = scene.add.container(0, 0).setDepth(45); scene.uiLayer.add(c); scene.noteBox = c;
  const W = 620, H = 440, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2;
  c.add(scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.55).setOrigin(0).setInteractive().on("pointerdown", () => closeNotebook(scene)));
  // páginas de pergaminho com lombada no meio
  c.add(scene.add.rectangle(X, Y, W, H, 0xd8c49a).setOrigin(0).setStrokeStyle(3, 0x5a3e22).setInteractive());
  c.add(scene.add.rectangle(X + 6, Y + 6, W - 12, H - 12, 0xe6d6b0).setOrigin(0));
  c.add(scene.add.rectangle(X + W / 2, Y + 6, 4, H - 12, 0x8a6a44, 0.6).setOrigin(0.5, 0));
  const ink = "#3a2814", T_ = (x, y, s, size = 12, col = ink, o) => { const o2 = txt(scene, x, y, s, size, col, o); o2.setShadow(0, 0, "#000", 0); c.add(o2); return o2; };
  T_(X + W / 2, Y + 14, t("note_title"), 17, "#5a2a10", { title: true }).setOrigin(0.5, 0);
  const seen = BEST_ORDER.filter(id => MONSTERS[id] && bestTier(id, scene) >= 1);
  if (!seen.length) { T_(X + W / 2, Y + H / 2, t("note_empty"), 13).setOrigin(0.5).setWordWrapWidth(W - 80).setAlign("center"); }
  const per = 6, pages = Math.max(1, Math.ceil(seen.length / per)); page = Phaser.Math.Clamp(page, 0, pages - 1);
  seen.slice(page * per, page * per + per).forEach((id, i) => {
    const M = MONSTERS[id], tier = bestTier(id, scene), n = bestKills(id, scene), T = bestTiers(id);
    const col = i < 3 ? 0 : 1, row = i % 3, x = X + 26 + col * (W / 2), y = Y + 52 + row * 122;
    T_(x, y, M.name + (tier >= 4 ? "  ★" : ""), 14, tier >= 4 ? "#8a4a00" : "#4a1a0a", { title: true });
    T_(x, y + 20, t("best_tier_" + tier) + (tier < 4 ? "  ·  " + t("note_next", { n, need: T[tier] }) : "  ·  " + t("note_bonus")), 11, "#5a4020");
    const lines = [];
    if (tier >= 2) lines.push(t("note_stats", { hp: Math.round(M.hp), dmg: Math.round(M.dmg), arm: M.arm }));
    else lines.push(t("note_unknown"));
    const hab = bestHabitat(id); if (hab.length) lines.push(hab[0]);
    T_(x, y + 40, lines.join("\n"), 11, ink).setWordWrapWidth(W / 2 - 50).setLineSpacing(3);
    c.add(scene.add.rectangle(x, y + 108, W / 2 - 52, 1, 0x8a6a44, 0.5).setOrigin(0));
  });
  T_(X + W / 2, Y + H - 26, t("note_foot", { p: page + 1, n: pages }), 10, "#6a5030").setOrigin(0.5, 0);
  const arrow = (dx, s, to) => { if (to < 0 || to >= pages) return; const b = T_(dx, Y + H - 30, s, 18, "#5a2a10").setOrigin(0.5, 0).setInteractive({ useHandCursor: true }); b.on("pointerdown", () => openNotebook(scene, to)); };
  arrow(X + 30, "◂", page - 1); arrow(X + W - 30, "▸", page + 1);
  scene.notePage = page;
  sfx(scene, "pickup", 0.25);
}
for (const S of [DungeonScene, TownScene]) {
  const cr = S.prototype.create;
  S.prototype.create = function (...a) {
    const r = cr.apply(this, a); this.noteBox = null;
    const K = Phaser.Input.Keyboard.KeyCodes;
    for (const n of (Settings.data.keys.notebook || ["N"])) if (K[n] !== undefined) this.input.keyboard.addKey(K[n]).on("down", () => this.noteBox ? closeNotebook(this) : openNotebook(this));
    this.input.keyboard.on("keydown-ESC", () => closeNotebook(this));
    return r;
  };
}
