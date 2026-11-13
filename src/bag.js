// Mochila (tecla I): equipamentos, status agrupados e inventário. O jogo pausa enquanto está aberta.
Object.assign(DungeonScene.prototype, {

  toggleBag() {
    if (this.finished || this.paused || this.attrBox) return;
    this.bagOpen = !this.bagOpen;
    if (this.bagBox) { this.bagBox.destroy(); this.bagBox = null; }
    if (this.bagOpen) this.buildBag();
  },

  buildBag() {
    if (this.bagBox) this.bagBox.destroy();
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.bagBox = c;
    const h = this.hero, d = Save.voc(this.vocId);
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0).setInteractive());
    const W = 860, H = 500, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2 - 8;
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text, o) => { const t = txt(this, x, y, s, size, col, o); c.add(t); return t; };
    T_(VIEW_W / 2, Y + 22, t("bag_title"), 24, COLORS.gold).setOrigin(0.5);
    T_(X + W - 22, Y + 16, "I / ESC fecha", 11, COLORS.dim).setOrigin(1, 0);

    // ---- equipamentos (layout do Tibia)
    const ex = X + 30, ey = Y + 64, S = 50, G = 10;
    T_(ex, ey - 22, t("equipment"), 15, COLORS.gold);
    const slots = [[t("slot_amulet"), 0, 0], [t("slot_helmet"), 1, 0], [t("slot_backpack"), 2, 0], [t("slot_weapon"), 0, 1], [t("slot_armor"), 1, 1], [t("slot_shield"), 2, 1],
      [t("slot_ring"), 0, 2], [t("slot_legs"), 1, 2], [t("slot_light"), 2, 2], [t("slot_boots"), 1, 3]];
    // detalhes do item sob o mouse (linha no rodapé da mochila)
    const tip = T_(X + 30, Y + H - 34, t("bag_tip"), 12, COLORS.dim, { wordWrap: { width: W - 60 } });
    const showTip = (g, extra = "") => { const E = EQUIP[g.id], R = RARITY[g.r], low = this.hero.level < E.lvl, bad = !equipOk(g.id, this.vocId);
      tip.setText(`${gearName(g)} · ${R.name}${t("tip_level", { n: E.lvl })}${bad ? t("tip_wrong_voc") : ""}${extra}\n${equipStats(g)}${E.desc ? " — " + E.desc : ""}`).setColor(low || bad ? "#e08070" : R.color); };
    const _sn = n => { const m = { helmet: t("slot_helmet"), weapon: t("slot_weapon"), armor: t("slot_armor"), shield: t("slot_shield"), legs: t("slot_legs"), boots: t("slot_boots"), light: t("slot_light") }; return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])); }; const slotOf = _sn();
    for (const [name, cx, cy] of slots) {
      const sx = ex + cx * (S + G), sy = ey + cy * (S + 22), sl = slotOf[name], g = sl && d.equip[sl], id = g && g.id;
      c.add(this.add.nineslice(sx, sy, "slot", null, S, S, 4, 4, 4, 4).setOrigin(0));
      T_(sx + S / 2, sy + S + 2, name, 10, COLORS.dim).setOrigin(0.5, 0);
      if (id && EQUIP[id]) {
        c.add(this.add.rectangle(sx + 3, sy + 3, S - 6, S - 6).setOrigin(0).setStrokeStyle(2, RARITY[g.r].hex, g.r ? 1 : 0));
        c.add(this.add.image(sx + S / 2, sy + S / 2, "eq_" + id).setScale(1.25));
        if (g.p) T_(sx + S - 4, sy + S - 14, `+${g.p}`, 10, RARITY[g.r].color).setOrigin(1, 0);
        const hit = this.add.rectangle(sx, sy, S, S, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); c.add(hit);
        hit.on("pointerover", () => showTip(g, t("tip_worn")));
        hit.on("pointerup", () => { this.unequipSlot(sl); this.buildBag(); });
      }
    }

    // ---- status
    const sx = X + 240, sy = Y + 64;
    const sk = id => { const s = Save.skill(this.vocId, id); return `${s.lvl}  (${Math.floor(100 * s.tries / skillTriesNeeded(id, s.lvl))}%)`; };
    const ml = d.ml, mlPct = Math.floor(100 * ml.spent / mlNeeded(this.vocId, ml.lvl));
    const mx = this.maxDamage();
    const groups = [
      [t("attack_label"), [[t("base_dmg"), `${Math.round(mx * 0.6)}–${Math.round(mx)}` + (this.stats.weapon && !this.ranged && this.stats.weapon.elDmg ? ` +${this.stats.weapon.elDmg} ${ELEMENTS[this.stats.weapon.el].name.toLowerCase()}` : "")], [t("atk_speed"), `${this.attacksPerSec().toFixed(2)} ${t("hits_per_sec")}`], [t("critical"), `${(this.critChance() * 100).toFixed(1).replace(".", ",")}% (×1,8)`]]],
      [t("defense_label"), [[t("total_hp"), `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`], [t("defense_value"), this.defenseValue().toFixed(1)], [t("block_chance"), `${Math.round(this.blockChance() * 100)}%`],
        [t("regen_label"), t("regen_line", { hp: (this.stats.recovery || 0).toFixed(1).replace(".", ","), res: (this.stats.manaReg || 0).toFixed(1).replace(".", ","), kind: VOCATIONS[this.vocId].mana ? t("word_mana") : t("word_fury") })],
        [t("resistances"), Object.keys(this.stats.res || {}).filter(k => this.stats.res[k]).map(k => `${ELEMENTS[k].name} ${this.stats.res[k] > 0 ? "+" : ""}${Math.round(this.stats.res[k] * 100)}%`).join(" · ") || t("no_resist")]]],
      [t("skills_label"), [this.ranged ? ["Distance", sk("distance") + (this.buffOn("hunter") ? "  +10" : "")] : ["Sword", sk("sword") + (this.buffOn("berserker") ? "  +10" : "")], ["Shield", sk("shield")],
        ["Magic level", `${ml.lvl}  (${mlPct}%)` + (this.buffOn("mage") ? "  +10" : "")]]],
      [t("progress_label"), [[t("level_label"), String(h.level) + (this.promo() ? ` · ${this.promo().name}` : "")], [t("total_xp"), String(Math.floor(d.xpTotal || 0))],
        [t("xp_next"), String(Math.ceil(this.xpNext() - h.xp))]]],
    ];
    let yy = sy - 22;
    for (const [title, rows] of groups) {
      T_(sx, yy, title, 15, COLORS.gold); yy += 20;
      for (const [k, v] of rows) { T_(sx + 8, yy, k, 12, COLORS.dim); T_(sx + 300, yy, v, 12, COLORS.text).setOrigin(1, 0); yy += 17; }
      yy += 6;
    }

    // ---- inventário
    const ix = X + 580, iy = Y + 64;
    T_(ix, iy - 22, t("inventory"), 15, COLORS.gold);
    c.add(this.add.image(ix + 8, iy + 8, "i_gold_coin").setScale(1.2));
    T_(ix + 22, iy, `${this.goldRun} nesta descida · ${Save.gold(this.vocId)} guardado`, 12, COLORS.gold);
    c.add(this.add.image(ix + 8, iy + 30, "i_bronze_key").setScale(0.8));
    T_(ix + 22, iy + 22, `${this.keys} chave(s)`, 12);
    { const L = d.equip.light && EQUIP[d.equip.light.id], oil = Math.ceil((d.oil || 0) / 60);
      T_(ix + 120, iy + 22, L ? (L.light.fuel ? t("oil_label", { n: oil }) + (d.oil > 0 ? "" : " · " + t("oil_empty")) : t("goddess_light")) : t("no_light"), 12, L && (!L.light.fuel || d.oil > 0) ? "#ffd27a" : COLORS.dim); }
    T_(ix, iy + 52, t("potion_hint"), 11, COLORS.dim);
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
        b.on("pointerup", () => { d.potionSlots[sl] = id; Save.save(); this.refreshPotionIcons(); this.buildBag(); });
        c.add(b); T_(bx, py + 8, String(5 + sl), 11, COLORS.gold).setOrigin(0.5);
      });
      py += 22;
    }
    // equipamentos guardados: clique para vestir
    T_(ix, py + 8, t("stored_gear", { n: d.gear.length }) + (d.essence ? ` · ${t("essences_label", { n: d.essence })}` : ""), 13, COLORS.gold);
    if (!d.gear.length) T_(ix, py + 28, t("no_gear"), 11, COLORS.dim);
    const GS = 36, cols = 7, maxRows = Math.max(1, Math.floor((Y + H - 44 - (py + 28)) / GS));
    d.gear.slice(0, cols * maxRows).forEach((g, i) => {
      const id = g.id; if (!EQUIP[id]) return;
      const gx = ix + (i % cols) * GS, gy = py + 28 + Math.floor(i / cols) * GS, ok = equipOk(id, this.vocId) && h.level >= EQUIP[id].lvl;
      c.add(this.add.rectangle(gx, gy, GS - 4, GS - 4, 0x1a1612, 1).setOrigin(0).setStrokeStyle(g.r ? 2 : 1, ok ? RARITY[g.r].hex : 0x5a2020));
      const im = this.add.image(gx + (GS - 4) / 2, gy + (GS - 4) / 2, "eq_" + id); if (!ok) im.setAlpha(0.45); c.add(im);
      if (g.p) T_(gx + GS - 6, gy + GS - 16, `+${g.p}`, 9, RARITY[g.r].color).setOrigin(1, 0);
      const hit = this.add.rectangle(gx, gy, GS - 4, GS - 4, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); c.add(hit);
      hit.on("pointerover", () => showTip(g));
      hit.on("pointerup", () => { if (this.equipItem(i)) this.buildBag(); else showTip(g); });
    });
    if (d.gear.length > cols * maxRows) T_(ix, Y + H - 52, t("more_in_bag", { n: d.gear.length - cols * maxRows }), 11, COLORS.dim);
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
