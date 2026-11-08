// Mochila (tecla I): equipamentos, status agrupados e inventário. O jogo pausa enquanto está aberta.
Object.assign(DungeonScene.prototype, {

  toggleBag() {
    if (this.finished || this.paused) return;
    this.bagOpen = !this.bagOpen;
    if (this.bagBox) { this.bagBox.destroy(); this.bagBox = null; }
    if (this.bagOpen) this.buildBag();
  },

  buildBag() {
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.bagBox = c;
    const h = this.hero, d = Save.voc(this.vocId);
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0).setInteractive());
    const W = 860, H = 440, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2 - 8;
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text, o) => { const t = txt(this, x, y, s, size, col, o); c.add(t); return t; };
    T_(VIEW_W / 2, Y + 22, "Mochila", 24, COLORS.gold).setOrigin(0.5);
    T_(X + W - 22, Y + 16, "I / ESC fecha", 11, COLORS.dim).setOrigin(1, 0);

    // ---- equipamentos (layout do Tibia)
    const ex = X + 30, ey = Y + 64, S = 50, G = 10;
    T_(ex, ey - 22, "Equipamentos", 15, COLORS.gold);
    const slots = [["Amuleto", 0, 0], ["Capacete", 1, 0], ["Mochila", 2, 0], ["Arma", 0, 1], ["Armadura", 1, 1], ["Escudo", 2, 1],
      ["Anel", 0, 2], ["Calça", 1, 2], ["Luminária", 2, 2], ["Botas", 1, 3]];
    for (const [name, cx, cy] of slots) {
      const sx = ex + cx * (S + G), sy = ey + cy * (S + 22);
      c.add(this.add.nineslice(sx, sy, "slot", null, S, S, 4, 4, 4, 4).setOrigin(0));
      T_(sx + S / 2, sy + S + 2, name, 10, COLORS.dim).setOrigin(0.5, 0);
    }
    T_(ex, ey + 4 * (S + 22) + 2, "Equipamentos chegam em breve.", 11, COLORS.dim, { wordWrap: { width: 170 } });

    // ---- status
    const sx = X + 240, sy = Y + 64;
    const sk = id => { const s = Save.skill(this.vocId, id); return `${s.lvl}  (${Math.floor(100 * s.tries / skillTriesNeeded(id, s.lvl))}%)`; };
    const ml = d.ml, mlPct = Math.floor(100 * ml.spent / mlNeeded(this.vocId, ml.lvl));
    const mx = this.maxDamage();
    const groups = [
      ["Ataque", [["Dano base", `${Math.round(mx * 0.6)}–${Math.round(mx)}`], ["Velocidade de ataque", `${this.attacksPerSec().toFixed(2)} golpes/s`], ["Crítico", "10% (×1,8)"]]],
      ["Defesa", [["Vida total", `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`], ["Defesa", this.defenseValue().toFixed(1)], ["Chance de bloqueio", `${Math.round(this.blockChance() * 100)}%`]]],
      ["Skills", [this.ranged ? ["Distance", sk("distance") + (this.buffOn("hunter") ? "  +10" : "")] : ["Sword", sk("sword") + (this.buffOn("berserker") ? "  +10" : "")], ["Club", "—"], ["Axe", "—"], ["Shield", sk("shield")],
        ["Magic level", `${ml.lvl}  (${mlPct}%)` + (this.buffOn("mage") ? "  +10" : "")]]],
      ["Progresso", [["Nível", String(h.level) + (this.promo() ? ` · ${this.promo().name}` : "")], ["Experiência total", String(Math.floor(d.xpTotal || 0))],
        ["Para o próximo nível", String(Math.ceil(this.xpNext() - h.xp))]]],
    ];
    let yy = sy - 22;
    for (const [title, rows] of groups) {
      T_(sx, yy, title, 15, COLORS.gold); yy += 20;
      for (const [k, v] of rows) { T_(sx + 8, yy, k, 12, COLORS.dim); T_(sx + 300, yy, v, 12, COLORS.text).setOrigin(1, 0); yy += 17; }
      yy += 6;
    }

    // ---- inventário
    const ix = X + 580, iy = Y + 64;
    T_(ix, iy - 22, "Inventário", 15, COLORS.gold);
    c.add(this.add.image(ix + 8, iy + 8, "i_gold_coin").setScale(1.2));
    T_(ix + 22, iy, `${this.goldRun} nesta descida · ${Save.gold(this.vocId)} guardado`, 12, COLORS.gold);
    c.add(this.add.image(ix + 8, iy + 30, "i_bronze_key").setScale(0.8));
    T_(ix + 22, iy + 22, `${this.keys} chave(s)`, 12);
    T_(ix, iy + 52, "Poções — clique em 5 ou 6 para pôr no atalho", 11, COLORS.dim);
    let py = iy + 72;
    for (const id of Object.keys(POTIONS)) {
      if (!potionOk(id, this.vocId)) continue;
      const P = POTIONS[id], n = d.potions[id] || 0;
      const ic = this.add.image(ix + 10, py + 9, P.icon); ic.setScale(18 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint); if (!n) ic.setAlpha(0.35);
      c.add(ic);
      T_(ix + 26, py, `${P.name} ×${n}`, 12, n ? COLORS.text : COLORS.dim);
      [0, 1].forEach(sl => {
        const on = d.potionSlots[sl] === id, bx = ix + 220 + sl * 26;
        const b = this.add.rectangle(bx, py + 8, 20, 18, on ? 0x6a5030 : 0x2a262e).setStrokeStyle(1, 0x6a5030).setInteractive({ useHandCursor: true });
        b.on("pointerup", () => { d.potionSlots[sl] = id; Save.save(); this.refreshPotionIcons(); this.toggleBag(); this.toggleBag(); });
        c.add(b); T_(bx, py + 8, String(5 + sl), 11, COLORS.gold).setOrigin(0.5);
      });
      py += 22;
    }
    T_(ix, py + 10, "Itens para venda", 13, COLORS.gold);
    T_(ix, py + 30, "Nenhum item ainda.", 11, COLORS.dim);
    for (const o of c.list) if (o.type === "Text") o.setShadow(1, 1, "#000000", 0, true, true);
  },

  refreshPotionIcons() {
    const d = Save.voc(this.vocId);
    for (const pid of ["p0", "p1"]) {
      const P = POTIONS[d.potionSlots[+pid[1]]], ic = this.slotIcons[pid];
      ic.setTexture(P.icon).setScale(1); ic.setScale(26 / Math.max(ic.width, ic.height));
      if (P.tint) ic.setTint(P.tint); else ic.clearTint();
    }
  },
});
