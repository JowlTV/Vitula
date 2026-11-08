// Interface: HUD, minimapa, mapa grande (TAB), zoom, mensagens, pausa e fim de partida.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // ---------------------------------------------------------------- minimapa
  // revela o que o herói enxerga: a sala inteira em que está + um raio de 4 tiles (corredores)
  reveal() {
    const g = this.gen, h = this.hero;
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) this.explored[y * g.w + x] = 1; };
    // só o que o raio de luz alcança (e as paredes coladas nele)
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 12) mark(h.x + dx, h.y + dy);
    // tochas iluminam o entorno delas quando o herói chega perto
    for (const l of this.lights) {
      if (l.water) continue;
      const lx = Math.floor(l.x / T), ly = Math.floor(l.y / T);
      if (Math.abs(lx - h.x) + Math.abs(ly - h.y) > 5) continue;
      for (let dy = -2; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) mark(lx + dx, ly + dy);
    }
    this.drawMinimap();
    this.drawFog();
  },


  // ---------------------------------------------------------------- câmera
  // zoom da câmera do jogo (a interface fica sempre igual). 2 = visão antiga; padrão 2,8 (mais perto)
  camZoom() { return Phaser.Math.Clamp(Settings.data.zoom || 2.8, 2, 3.6); },

  setCamZoom(z) {
    Settings.data.zoom = Math.round(Phaser.Math.Clamp(z, 2, 3.6) * 10) / 10; Settings.save();
    this.cameras.main.setZoom(this.camZoom());
    this.msg(`Zoom ${this.camZoom().toFixed(1)}×`);
  },


  // mapa grande sobre a tela (TAB), como no Diablo: transparente, só o que já foi explorado
  toggleBigMap() {
    if (this.finished) return;
    this.bigOpen = !this.bigOpen;
    if (!this.bigMap) { this.bigMap = this.add.graphics().setDepth(5); this.uiLayer.add(this.bigMap); }
    this.bigMap.setVisible(this.bigOpen);
    if (this.bigOpen) this.drawBigMap();
  },

  drawBigMap() {
    if (!this.bigOpen || !this.bigMap) return;
    const g = this.gen, gfx = this.bigMap.clear();
    const s = Math.min((VIEW_W - 120) / g.w, (VIEW_H - 140) / g.h);
    const ox = Math.round(VIEW_W / 2 - g.w * s / 2), oy = Math.round(VIEW_H / 2 - g.h * s / 2) + 6;
    gfx.fillStyle(0x000000, 0.35).fillRect(0, 0, VIEW_W, VIEW_H);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!this.explored[y * g.w + x]) continue;
      if (g.isFloor(x, y)) gfx.fillStyle(this.doors.has(key(x, y)) ? 0xc09a5a : g.isWater(x, y) ? 0x4a8a4a : 0x8a8478, 0.55).fillRect(ox + x * s, oy + y * s, s, s);
      else {
        // contorno das paredes, como no automapa do Diablo
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.isFloor(x + dx, y + dy) && this.explored[(y + dy) * g.w + x + dx]) edge = true;
        if (edge) gfx.fillStyle(0xd8c8a0, 0.75).fillRect(ox + x * s, oy + y * s, s, s);
      }
    }
    const dot = (x, y, c) => gfx.fillStyle(0x000000, 0.8).fillRect(ox + x * s - 2, oy + y * s - 2, s + 4, s + 4).fillStyle(c, 1).fillRect(ox + x * s - 1, oy + y * s - 1, s + 2, s + 2);
    const st = this.stairs;
    if (st && this.explored[st.y * g.w + st.x]) dot(st.x, st.y, 0x7fd0ff);
    for (const m of this.monsters) if (this.explored[m.y * g.w + m.x] && (m.elite || Math.abs(m.x - this.hero.x) + Math.abs(m.y - this.hero.y) < 6)) dot(m.x, m.y, m.elite ? 0xff3a2a : 0xb04030);
    dot(this.hero.x, this.hero.y, 0xfff2d0);
  },


  drawMinimap() {
    this.drawBigMap();
    if (!this.mini) return;
    const g = this.gen, s = Math.min(2, 150 / g.w, 110 / g.h), gfx = this.mini;
    const ox = VIEW_W - Math.ceil(g.w * s) - 12, oy = VIEW_H - Math.ceil(g.h * s) - 12;
    gfx.clear();
    // pergaminho escuro: o que não foi explorado fica nele, sem revelar nada
    const W2 = g.w * s + 8, H2 = g.h * s + 8;
    gfx.fillStyle(0x050406, 1).fillRect(ox - 7, oy - 7, W2 + 6, H2 + 6);
    gfx.fillStyle(0x2c2a30, 1).fillRect(ox - 6, oy - 6, W2 + 4, H2 + 4);
    gfx.fillStyle(0x1e1810, 1).fillRect(ox - 4, oy - 4, W2, H2);
    for (let k = 0; k < 40; k++) gfx.fillStyle(k % 2 ? 0x261e14 : 0x17120c, 0.8).fillRect(ox - 4 + ((k * 37) % W2), oy - 4 + ((k * 23) % H2), 3, 2);
    for (const [cx, cy] of [[ox - 6, oy - 6], [ox + W2 - 7, oy - 6], [ox - 6, oy + H2 - 7], [ox + W2 - 7, oy + H2 - 7]]) gfx.fillStyle(0x6a6470, 1).fillRect(cx, cy, 3, 3);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!this.explored[y * g.w + x]) continue;
      if (g.isFloor(x, y)) gfx.fillStyle(this.doors.has(key(x, y)) ? 0x9a7a4a : g.isWater(x, y) ? 0x3a5a3a : 0x5a5862, 1).fillRect(ox + x * s, oy + y * s, s, s);
      else gfx.fillStyle(0x24222a, 1).fillRect(ox + x * s, oy + y * s, s, s);
    }
    const st = this.stairs;
    if (st && this.explored[st.y * g.w + st.x]) gfx.fillStyle(0x7fd0ff, 1).fillRect(ox + st.x * s - 1, oy + st.y * s - 1, s + 2, s + 2);
    for (const m of this.monsters) if (m.elite && this.explored[m.y * g.w + m.x]) gfx.fillStyle(0xd0402a, 1).fillRect(ox + m.x * s - 1, oy + m.y * s - 1, s + 2, s + 2);
    gfx.fillStyle(0xf2e6d8, 1).fillRect(ox + this.hero.x * s - 1, oy + this.hero.y * s - 1, s + 2, s + 2);
  },


  // ---------------------------------------------------------------- interface
  buildHud() {
    const ui = this.add.container(0, 0).setDepth(10);
    this.uiLayer.add(ui);
    this.ui = ui;
    // barras em moldura de ferro forjado com rebites; preenchimento chapado (sem gradiente)
    const fr = this.add.graphics(); ui.add(fr);
    const iron = (x, y, w, h) => {
      fr.fillStyle(0x050406, 1).fillRect(x - 3, y - 3, w + 6, h + 6);
      fr.fillStyle(0x2c2a30, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
      fr.fillStyle(0x4a464e, 1).fillRect(x - 2, y - 2, w + 4, 1);
      fr.fillStyle(0x121014, 1).fillRect(x - 2, y + h + 1, w + 4, 1);
      fr.fillStyle(0x0b0a0c, 1).fillRect(x, y, w, h);
      for (const rx of [x - 1, x + w - 2]) { fr.fillStyle(0x6a6470, 1).fillRect(rx, y + Math.floor(h / 2) - 1, 3, 3); fr.fillStyle(0x1a181c, 1).fillRect(rx + 2, y + Math.floor(h / 2) + 1, 1, 1); }
      // pontas góticas
      fr.fillStyle(0x2c2a30, 1).fillTriangle(x - 3, y - 3, x - 9, y + h / 2, x - 3, y + h + 3);
      fr.fillTriangle(x + w + 3, y - 3, x + w + 9, y + h / 2, x + w + 3, y + h + 3);
    };
    ui.add(this.add.image(14, 16, "heart").setScale(1.4));
    iron(34, 9, 196, 12);
    this.hpFill = this.add.rectangle(34, 9, 196, 12, 0x7a1010).setOrigin(0); ui.add(this.hpFill);
    this.hpShine = this.add.rectangle(34, 9, 196, 2, 0xa83030).setOrigin(0); ui.add(this.hpShine);
    this.hpText = txt(this, 132, 15, "", 11, COLORS.white).setOrigin(0.5); ui.add(this.hpText);
    iron(34, 28, 196, 4);
    this.xpFill = this.add.rectangle(34, 28, 196, 4, 0x8a7430).setOrigin(0); ui.add(this.xpFill);
    this.lvlText = txt(this, 244, 14, "", 18, COLORS.gold); ui.add(this.lvlText);
    this.promoText = txt(this, 244, 32, "", 14, "#e8c878"); ui.add(this.promoText);
    iron(34, 40, 136, 6);
    this.furyFill = this.add.rectangle(34, 40, 136, 6, 0xa8401a).setOrigin(0); ui.add(this.furyFill);
    this.furyText = txt(this, 176, 34, VOCATIONS[this.vocId].resource || "Fúria", 14, "#d0703a"); ui.add(this.furyText);
    this.skillText = txt(this, 12, 54, "", 11, "#a8a090"); ui.add(this.skillText);
    this.hudFloor = txt(this, VIEW_W / 2 + 90, 18, `${this.region.name} · Andar ${this.floorN}/${FLOORS}`, 18, "#c8b890", { title: true }).setOrigin(0.5);
    ui.add(this.hudFloor);
    ui.add(this.add.image(VIEW_W - 92, 16, "i_gold_coin").setScale(1.4));
    this.goldText = txt(this, VIEW_W - 78, 6, "0", 15, COLORS.gold); ui.add(this.goldText);
    ui.add(this.add.image(VIEW_W - 92, 40, "i_bronze_key").setScale(0.9));
    this.keyText = txt(this, VIEW_W - 78, 30, "0", 15, COLORS.text); ui.add(this.keyText);
    // barra de magias
    const pslots = Save.voc(this.vocId).potionSlots;
    const list = [["basic", "icon_basic", ""], ...Object.entries(this.spells).map(([k, s]) => [k, s.icon, s.key]),
      ["p0", POTIONS[pslots[0]].icon, "5"], ["p1", POTIONS[pslots[1]].icon, "6"]];
    this.potCount = {};
    this.slotIcons = {}; this.slotLocks = {};
    const size = 40, gap = 8, x0 = VIEW_W / 2 - (list.length * (size + gap) - gap + 14) / 2;
    this.slotCovers = {}; this.slotTimers = {}; this.slotBars = {}; this.slotReady = {};
    list.forEach(([id, icon, k], i) => {
      const x = x0 + i * (size + gap) + ((id === "p0" || id === "p1") ? 14 : 0), y = VIEW_H - size - 10; // poções separadas das magias
      ui.add(this.add.nineslice(x, y, "slot", null, size, size, 4, 4, 4, 4).setOrigin(0));
      const ic = this.add.image(x + size / 2, y + size / 2, icon); ui.add(ic); this.slotIcons[id] = ic;
      if ((id === "p0" || id === "p1")) { const P = POTIONS[pslots[+id[1]]]; ic.setScale(26 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint); }
      else ic.setDisplaySize(30, 30);
      // recarga: sombra que desce, segundos restantes e barrinha embaixo do slot
      const cover = this.add.rectangle(x + 3, y + size - 3, size - 6, size - 6, 0x000000, 0.7).setOrigin(0, 1).setVisible(false);
      ui.add(cover); this.slotCovers[id] = cover;
      const timer = txt(this, x + size / 2, y + size / 2, "", 15, COLORS.white).setOrigin(0.5); ui.add(timer); this.slotTimers[id] = timer;
      ui.add(this.add.rectangle(x + 2, y + size + 3, size - 4, 4, 0x1a1820).setOrigin(0));
      const bar = this.add.rectangle(x + 2, y + size + 3, size - 4, 4, 0x9fd0ff).setOrigin(0); ui.add(bar); this.slotBars[id] = bar;
      const ready = this.add.rectangle(x, y, size, size).setOrigin(0).setStrokeStyle(2, 0xe0bc60, 1).setAlpha(0); ui.add(ready); this.slotReady[id] = ready;
      if (k) ui.add(txt(this, x + size - 9, y + size - 16, k, 12, COLORS.gold));
      if ((id === "p0" || id === "p1")) { const n = txt(this, x + 4, y + 1, "", 11, COLORS.white); ui.add(n); this.potCount[id] = n; }
      else if (id !== "basic") { const lk = txt(this, x + size / 2, y + size / 2, "Nv " + this.spells[id].level, 12, COLORS.dim).setOrigin(0.5); ui.add(lk); this.slotLocks[id] = lk; }
    });
    // battle list: até 8 monstros mais próximos, no canto direito
    this.blX = VIEW_W - 176; this.blY = 62; this.blRows = [];
    const blBg = this.add.rectangle(this.blX - 6, this.blY - 4, 170, 22, 0x0c0a08, 0.72).setOrigin(0).setStrokeStyle(1, 0x5a4a30); ui.add(blBg); this.blBg = blBg;
    this.blTitle = txt(this, this.blX, this.blY - 1, "Battle List", 13, COLORS.gold); ui.add(this.blTitle);
    for (let i = 0; i < 8; i++) {
      const y = this.blY + 22 + i * 26;
      const sel = this.add.rectangle(this.blX - 3, y - 2, 164, 24).setOrigin(0).setStrokeStyle(1, 0xc8402a).setVisible(false);
      const hit = this.add.rectangle(this.blX - 3, y - 2, 164, 24, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      const name = txt(this, this.blX, y, "", 12, COLORS.text);
      const back = this.add.rectangle(this.blX, y + 15, 150, 4, 0x000000, 0.85).setOrigin(0);
      const fill = this.add.rectangle(this.blX, y + 15, 150, 4, 0x3fae3a).setOrigin(0);
      const row = { sel, hit, name, back, fill, m: null };
      hit.on("pointerdown", (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); if (row.m && !row.m.dead) this.hero.target = row.m; });
      ui.add([sel, hit, name, back, fill]); this.blRows.push(row);
    }
    this.blT = 0; this.refreshBattleList();
    // minimapa no canto inferior direito
    this.miniX = VIEW_W - this.gen.w * 2 - 12; this.miniY = VIEW_H - this.gen.h * 2 - 12;
    this.mini = this.add.graphics(); ui.add(this.mini);
    this.drawMinimap();
    this.msgText = txt(this, VIEW_W / 2, VIEW_H - 74, "", 15, COLORS.text).setOrigin(0.5);
    ui.add(this.msgText);
    // sombra projetada em todos os textos do HUD (leitura no escuro)
    for (const o of ui.list) if (o.type === "Text") o.setShadow(2, 2, "#000000", 0, true, true);
    this.msgT = 0;
  },


  refreshBattleList() {
    const h = this.hero, R = 8;
    const list = (this.monsters || []).filter(m => !m.dead && Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) <= R)
      .map(m => ({ m, d: Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) + Math.hypot(m.x - h.x, m.y - h.y) * 0.01 }))
      .sort((a, b) => a.d - b.d).slice(0, 8);
    this.blBg.setSize(170, 22 + Math.max(1, list.length) * 26 + 2);
    this.blRows.forEach((r, i) => {
      const e = list[i], on = !!e; r.m = on ? e.m : null;
      r.name.setVisible(on); r.back.setVisible(on); r.fill.setVisible(on); r.hit.setVisible(on); r.sel.setVisible(on && h.target === e.m);
      if (!on) return;
      const m = e.m, f = Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1);
      r.name.setText((m.champion ? "★ " : m.elite ? "◆ " : "") + (m.data.name || m.kind)).setColor(m.champion ? "#e8c060" : m.elite ? "#d89a60" : COLORS.text);
      r.fill.setSize(Math.max(1, 150 * f), 4).setFillStyle(f > 0.6 ? 0x3fae3a : f > 0.3 ? 0xd6b23a : f > 0.1 ? 0xc2452f : 0x6e1414);
    });
  },

  refreshHud(dt) {
    const h = this.hero;
    this.blT -= dt || 0; if (this.blT <= 0) { this.blT = 0.15; this.refreshBattleList(); }
    const hw = Math.max(1, 196 * Phaser.Math.Clamp(h.hp / h.maxHp, 0, 1));
    this.hpFill.setSize(hw, 12); this.hpShine.setSize(hw, 2);
    this.hpText.setText(`${Math.ceil(Math.max(0, h.hp))} / ${Math.round(h.maxHp)}`);
    this.xpFill.setSize(Math.max(1, 196 * Phaser.Math.Clamp(h.xp / this.xpNext(), 0, 1)), 4);
    this.lvlText.setText(`Nv ${h.level}`);
    this.promoText.setText(this.promo() ? this.promo().name : "");
    this.goldText.setText(String(this.goldRun));
    this.keyText.setText(String(this.keys));
    const cover = (id, f, secs, locked = false) => {
      f = Phaser.Math.Clamp(f, 0, 1);
      const c = this.slotCovers[id];
      c.setVisible(f > 0 || locked);
      if (f > 0 || locked) c.setSize(34, Math.max(1, 34 * (locked ? 1 : f)));
      this.slotBars[id].setSize(Math.max(0, 36 * (1 - f)), 4).setFillStyle(f > 0 ? 0x6a8ab0 : 0x9fd0ff);
      this.slotTimers[id].setText(!locked && secs > 0.05 && id !== "basic" ? (secs >= 1 ? Math.ceil(secs) : secs.toFixed(1)) : "");
      // brilho dourado rápido quando a habilidade volta a ficar pronta
      const was = this.slotWas?.[id] || 0;
      if (was > 0 && f === 0 && !locked) { this.slotReady[id].setAlpha(1); this.tweens.add({ targets: this.slotReady[id], alpha: 0, duration: 450 }); }
      (this.slotWas ||= {})[id] = f;
    };
    cover("basic", h.atkT / this.stats.cooldown, h.atkT);
    for (const s in this.spells) {
      const sp = this.spells[s], locked = h.level < sp.level;
      cover(s, locked ? 1 : h.cds[s] / (sp.cd * this.stats.cooldown), h.cds[s], locked);
      this.slotLocks[s].setVisible(locked);
      this.slotIcons[s].setAlpha(locked ? 0.25 : (h.fury >= sp.fury ? 1 : 0.45));
    }
    const d = Save.voc(this.vocId);
    for (const pid of ["p0", "p1"]) {
      const id = d.potionSlots[+pid[1]], P = POTIONS[id], cd = (h.potCd && h.potCd[id]) || 0, n = d.potions[id] || 0;
      cover(pid, cd / P.cd, cd);
      this.potCount[pid].setText(String(n));
      this.slotIcons[pid].setAlpha(n > 0 ? 1 : 0.3);
    }
    this.furyFill.setSize(Math.max(1, 136 * Math.min(1, h.fury / this.furyMax)), 6);
    const sk = id => { const s = Save.skill(this.vocId, id); return `${SKILLS[id].name} ${s.lvl} (${Math.floor(100 * s.tries / skillTriesNeeded(id, s.lvl))}%)`; };
    const ml = Save.voc(this.vocId).ml;
    this.skillText.setText(`${sk(this.ranged ? "distance" : "sword")}   ${sk("shield")}   ML ${this.mlEff()}`);
    if (this.msgT > 0) { this.msgT -= dt; this.msgText.setAlpha(Phaser.Math.Clamp(this.msgT, 0, 1)); }
  },


  msg(s) { if (!this.msgText) return; this.msgText.setText(s).setAlpha(1); this.msgT = 3.5; },


  panel(title, body, buttons) {
    const c = this.add.container(0, 0).setDepth(20);
    this.uiLayer.add(c);
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.72).setOrigin(0).setInteractive());
    // a altura do painel acompanha o texto: os botões ficam sempre abaixo dele (antes o texto passava por baixo)
    const w = 560, x = VIEW_W / 2 - w / 2;
    const bodyT = txt(this, 0, 0, body, 14, COLORS.text, { wordWrap: { width: w - 60 }, lineSpacing: 4 });
    const hgt = 82 + bodyT.height + 20 + buttons.length * 50, y = Math.max(8, VIEW_H / 2 - hgt / 2);
    c.add(this.add.nineslice(x, y, "panel", null, w, hgt, 16, 16, 16, 16).setOrigin(0));
    c.add(txt(this, VIEW_W / 2, y + 30, title, 30, COLORS.gold).setOrigin(0.5));
    bodyT.setPosition(x + 30, y + 58); c.add(bodyT);
    buttons.forEach(([label, fn], i) => {
      const by = y + hgt - 40 - (buttons.length - 1 - i) * 50;
      const b = this.add.nineslice(VIEW_W / 2, by, "button_normal", null, 300, 40, 18, 18, 6, 6).setInteractive({ useHandCursor: true });
      const t = txt(this, VIEW_W / 2, by, label, 16, COLORS.text).setOrigin(0.5);
      b.on("pointerover", () => b.setTexture("button_hover"));
      b.on("pointerout", () => b.setTexture("button_normal"));
      b.on("pointerup", fn);
      c.add([b, t]);
    });
    return c;
  },


  togglePause() {
    if (this.finished) return;
    if (this.pauseBox) { this.pauseBox.destroy(); this.pauseBox = null; this.paused = false; this.tweens.resumeAll(); return; }
    this.paused = true; this.tweens.pauseAll();
    this.pauseBox = this.panel("Pausa",
      "Mover: WASD ou setas (diagonal vale)\nAtaque básico: Espaço · R liga/desliga o automático · E na corda: subir\nFúria enche ao golpear e apanhar e paga as habilidades.\n" +
      Object.values(this.spells).map(sp => `${sp.key} · ${sp.name} (nv ${sp.level})`).join("   ") +
      "\n5 e 6: poções · I: mochila · TAB: mapa · roda do mouse: zoom\nBaús pedem chave de bronze.",
      [["Continuar", () => this.togglePause()], ["Abandonar (conta como morte)", () => { this.togglePause(); this.finish(false); }]]);
  },


  // tela de morte: o cavaleiro cai, o mundo perde a cor e aparece "Você morreu"
  deathScreen() {
    const h = this.hero;
    h.spr.clearTint();
    if (this.anims.exists(this.ap + "death")) h.spr.setFlipX(false).play(this.ap + "death");
    else this.tweens.add({ targets: h.spr, angle: 90, alpha: 0.7, duration: 400 });
    const fxs = [];
    try { for (const c of [this.cameras.main]) if (c && c.postFX) fxs.push(c.postFX.addColorMatrix()); } catch (e) {}
    const t = { k: 0 };
    this.tweens.add({ targets: t, k: 1, duration: 1600, ease: "Sine.easeIn", onUpdate: () => fxs.forEach(cm => { cm.reset(); cm.grayscale(t.k); }) });
    this.time.delayedCall(1300, () => {
      if (this.finished) return;
      const veil = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0).setAlpha(0).setDepth(40);
      const msg = txt(this, VIEW_W / 2, VIEW_H / 2 - 20, "Você morreu", 46, "#e8e8e8").setOrigin(0.5).setAlpha(0).setDepth(41);
      this.uiLayer.add([veil, msg]);
      this.tweens.add({ targets: veil, alpha: 0.55, duration: 900 });
      this.tweens.add({ targets: msg, alpha: 1, scale: { from: 1.15, to: 1 }, duration: 1100, ease: "Sine.easeOut" });
      this.time.delayedCall(2600, () => { veil.destroy(); msg.destroy(); this.finish(false); });
    });
  },


  // morte: perde experiência, equipamentos e ouro coletado, conforme as bênçãos de Magdha
  deathPenalty() {
    const d = Save.voc(this.vocId), b = DEATH_LOSS[Math.min(3, d.bless || 0)];
    const xpBefore = d.xpTotal || 0;
    d.xpTotal = Math.floor(xpBefore * (1 - b.xp));
    const eqLost = [];
    for (const slot of Object.keys(d.equip || {})) if (b.equip >= 1 || Math.random() < b.equip) { eqLost.push(slot); delete d.equip[slot]; }
    const goldRaw = Math.round(this.goldRun * this.stats.greed);
    const goldLost = Math.round(goldRaw * b.gold);
    return { b, xpLost: Math.floor(xpBefore - d.xpTotal), eqLost: eqLost.length, goldLost, earned: goldRaw - goldLost, bless: d.bless || 0 };
  },

  finish(victory) {
    if (this.finished) return;
    this.finished = true;
    const pen = victory ? null : this.deathPenalty();
    const earned = pen ? pen.earned : Math.round(this.goldRun * this.stats.greed);
    Save.addGold(this.vocId, earned); Save.addKills(this.killsByType); Save.data.runs++;
    if (victory) {
      Save.data.cleared["karhyn_sewers:" + this.vocId] = true;
      const dm = Save.data.diffMax || (Save.data.diffMax = {}), k = "karhyn_sewers:" + this.vocId;
      if (this.diff >= (dm[k] || 1) && (dm[k] || 1) < 4) dm[k] = Math.min(4, (dm[k] || 1) + 0.25);
    }
    Save.save();
    const v = VOCATIONS[this.vocId];
    const penText = pen ? `\n\nMorte — bênçãos de Magdha: ${pen.bless}/3\nExperiência perdida: ${Math.round(pen.b.xp * 100)}%\nEquipamentos perdidos: ${pen.b.equip >= 1 ? "todos" : Math.round(pen.b.equip * 100) + "%"}\nOuro perdido: ${Math.round(pen.b.gold * 100)}% (${pen.goldLost})` : "";
    this.panel(victory ? "Masmorra Vencida" : "Você Caiu",
      `Dificuldade: ${Math.round(this.diff * 100)}%\nAndar alcançado: ${this.floorN}/${FLOORS}\nNível: ${this.hero.level}\nAbates: ${this.kills}\nOuro obtido: ${earned}   (bolsa do ${v.name}: ${Save.gold(this.vocId)})` + penText,
      [["Descer de novo", () => this.scene.restart()]]
        .concat(cityUnlocked() ? [["Voltar à cidade", () => { this.registry.set("townSpawn", "sewer"); this.scene.start("town"); }]] : [])
        .concat([["Voltar ao mapa", () => this.scene.start("map")]]));
    window.__vitulaEnd = { victory, floor: this.floorN, level: this.hero.level, kills: this.kills, earned };
  },
});
