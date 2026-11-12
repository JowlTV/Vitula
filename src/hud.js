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
    if (!this.bigTitle) { this.bigTitle = txt(this, VIEW_W / 2, 64, "", 30, "#e0c890").setOrigin(0.5).setDepth(6).setShadow(2, 2, "#000", 0, true, true); this.uiLayer.add(this.bigTitle); }
    this.bigTitle.setText(`${this.region.name}\nAndar ${this.floorN} de ${FLOORS}`).setAlign("center").setVisible(this.bigOpen);
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
    const ox = VIEW_W - Math.ceil(g.w * s) - 12, oy = 14;
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
    // vida, experiência e fúria: centralizadas no topo
    const cx = VIEW_W / 2, bx = cx - 98;
    iron(bx, 9, 196, 12);
    this.hpFill = this.add.rectangle(bx, 9, 196, 12, 0x7a1010).setOrigin(0); ui.add(this.hpFill);
    this.hpShine = this.add.rectangle(bx, 9, 196, 2, 0xa83030).setOrigin(0); ui.add(this.hpShine);
    this.hpText = txt(this, cx, 15, "", 11, COLORS.white).setOrigin(0.5); ui.add(this.hpText);
    iron(bx, 28, 196, 4);
    this.xpFill = this.add.rectangle(bx, 28, 196, 4, 0x8a7430).setOrigin(0); ui.add(this.xpFill);
    iron(cx - 68, 40, 136, 6);
    this.furyFill = this.add.rectangle(cx - 68, 40, 136, 6, VOCATIONS[this.vocId].mana ? 0x2f5fb8 : 0xa8401a).setOrigin(0); ui.add(this.furyFill);
    this.furyText = txt(this, cx + 78, 36, VOCATIONS[this.vocId].resource || "Fúria", 12, VOCATIONS[this.vocId].mana ? "#7ab0ff" : "#d0703a"); ui.add(this.furyText);
    this.lvlText = txt(this, bx - 14, 6, "", 18, COLORS.gold).setOrigin(1, 0).setVisible(false);   // o nível fica na janela de Habilidades
    this.promoText = txt(this, bx - 14, 12, "", 12, "#e8c878").setOrigin(1, 0).setVisible(false);
    // embaixo do minimapa (canto superior direito): nome do andar pequeno, ouro e chaves
    // posição fixa, abaixo do maior minimapa possível (150×110): cada andar tem um tamanho e o mapa maior cobria o ouro
    const mR = VIEW_W - 12, mB = 14 + 110 + 10;
    this.hudFloor = txt(this, mR, mB + 2, `${this.region.name} · Andar ${this.floorN}/${FLOORS}`, 11, "#c8b890", { title: true }).setOrigin(1, 0);
    ui.add(this.hudFloor);
    ui.add(this.add.image(mR - 92, mB + 26, "i_gold_coin").setScale(0.9));
    this.goldText = txt(this, mR - 84, mB + 19, "0", 11, COLORS.gold); ui.add(this.goldText);
    ui.add(this.add.image(mR - 40, mB + 26, "i_bronze_key").setScale(0.6));
    this.keyText = txt(this, mR - 32, mB + 19, "0", 11, COLORS.text); ui.add(this.keyText);
    this.hudBelowMini = mB + 40;
    // barra de magias
    const pslots = Save.voc(this.vocId).potionSlots;
    const list = [["basic", "icon_basic", ""], ...Object.entries(this.spells).map(([k, s]) => [k, s.icon, s.key]),
      ["p0", POTIONS[pslots[0]].icon, "5"], ["p1", POTIONS[pslots[1]].icon, "6"]];
    this.potCount = {};
    this.slotIcons = {}; this.slotLocks = {};
    const size = 38, gap = 6, x0 = VIEW_W / 2 - (list.length * (size + gap) - gap + 14) / 2;
    { // moldura da barra de habilidades (estilo Tibia)
      const bw = list.length * (size + gap) - gap + 14, y = VIEW_H - size - 10;
      fr.fillStyle(0x050406, 0.92).fillRect(x0 - 8, y - 7, bw + 16, size + 20);
      fr.fillStyle(0x2c2a30, 1).fillRect(x0 - 7, y - 6, bw + 14, 1).fillRect(x0 - 7, y + size + 12, bw + 14, 1);
      fr.fillStyle(0x4a464e, 1).fillRect(x0 - 7, y - 6, 1, size + 19).fillRect(x0 + bw + 6, y - 6, 1, size + 19);
    }
    this.slotCovers = {}; this.slotTimers = {}; this.slotBars = {}; this.slotReady = {};
    list.forEach(([id, icon, k], i) => {
      const x = x0 + i * (size + gap) + ((id === "p0" || id === "p1") ? 14 : 0), y = VIEW_H - size - 10; // poções separadas das magias
      ui.add(this.add.nineslice(x, y, "slot", null, size, size, 4, 4, 4, 4).setOrigin(0));
      const ic = this.add.image(x + size / 2, y + size / 2, icon); ui.add(ic); this.slotIcons[id] = ic;
      if ((id === "p0" || id === "p1")) { const P = POTIONS[pslots[+id[1]]]; ic.setScale(24.7 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint); }
      else ic.setDisplaySize(28.5, 28.5);
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
    { // ataque básico em destaque: moldura dourada; no automático ela pulsa e aparece o selo "AUTO". Clicar no ícone liga/desliga.
      const bx0 = x0, by0 = VIEW_H - size - 10;
      this.basicRing = this.add.rectangle(bx0 - 2, by0 - 2, size + 4, size + 4).setOrigin(0).setStrokeStyle(2, 0xe0bc60, 1); ui.add(this.basicRing);
      this.basicAutoBg = this.add.rectangle(bx0 + size / 2, by0 - 9, 34, 11, 0x3a7a2e, 1).setStrokeStyle(1, 0x9fe08a); ui.add(this.basicAutoBg);
      this.basicAuto = txt(this, bx0 + size / 2, by0 - 9, "AUTO", 9, "#eaffd8").setOrigin(0.5); ui.add(this.basicAuto);
      const hit = this.add.rectangle(bx0, by0, size, size, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); ui.add(hit); this.basicHit = hit;
      hit.on("pointerdown", () => { Settings.data.autoAttack = Settings.data.autoAttack === false; Settings.save(); this.msg(`Ataque automático ${Settings.data.autoAttack ? "ligado" : "desligado"}`); });
    }
    this.buildBattleList(ui);
    this.buildSkillWin(ui);
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


  // ---------------------------------------------------------------- battle list (janela)
  // até 8 monstros mais próximos. Janela arrastável pela barra, minimizável (–), fechável (×; L reabre)
  // e redimensionável pelo canto de baixo à direita. Posição e tamanho ficam salvos.
  buildBattleList(ui) {
    let st = {}; try { st = JSON.parse(localStorage.getItem("vitula_bl2") || "{}"); } catch (e) {}
    this.bl = Object.assign({ x: VIEW_W - 140, y: this.hudBelowMini || 180, w: 128, rows: 6, min: false, open: true }, st);
    const win = this.add.container(0, 0); ui.add(win); this.blWin = win;
    this.blBg = this.add.rectangle(0, 0, 10, 10, 0x0c0a08, 0.8).setOrigin(0).setStrokeStyle(1, 0x5a4a30).setInteractive();
    this.blBar = this.add.rectangle(0, 0, 10, 14, 0x2a2018, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    this.blTitle = txt(this, 4, 1, "Battle List", 10, COLORS.gold);
    this.blMinB = txt(this, 0, 0, "–", 11, COLORS.text).setInteractive({ useHandCursor: true });
    this.blClsB = txt(this, 0, 0, "×", 11, COLORS.text).setInteractive({ useHandCursor: true });
    this.blGrip = this.add.triangle(0, 0, 8, 0, 8, 8, 0, 8, 0x7a6440).setOrigin(0).setInteractive({ useHandCursor: true });
    win.add([this.blBg, this.blBar, this.blTitle, this.blMinB, this.blClsB, this.blGrip]);
    this.blRows = [];
    for (let i = 0; i < 8; i++) {
      const sel = this.add.rectangle(0, 0, 10, 16).setOrigin(0).setStrokeStyle(1, 0xc8402a);
      const hit = this.add.rectangle(0, 0, 10, 16, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      const name = txt(this, 0, 0, "", 9, COLORS.text);
      const back = this.add.rectangle(0, 0, 10, 2, 0x000000, 0.85).setOrigin(0);
      const fill = this.add.rectangle(0, 0, 10, 2, 0x3fae3a).setOrigin(0);
      const row = { sel, hit, name, back, fill, m: null };
      hit.on("pointerdown", () => { if (row.m && !row.m.dead) this.hero.target = row.m; });
      win.add([sel, hit, name, back, fill]); this.blRows.push(row);
    }
    const pt = p => this.uiCam.getWorldPoint(p.x, p.y);
    let drag = null;
    this.blBar.on("pointerdown", p => { const q = pt(p); drag = { k: "move", ox: q.x - this.bl.x, oy: q.y - this.bl.y }; });
    this.blGrip.on("pointerdown", p => { drag = { k: "size" }; });
    this.input.on("pointermove", p => {
      if (!drag || !p.isDown) return; const q = pt(p);
      if (drag.k === "move") { this.bl.x = Phaser.Math.Clamp(q.x - drag.ox, 0, VIEW_W - this.bl.w); this.bl.y = Phaser.Math.Clamp(q.y - drag.oy, 0, VIEW_H - 14); }
      else { this.bl.w = Phaser.Math.Clamp(Math.round(q.x - this.bl.x), 90, 220); this.bl.rows = Phaser.Math.Clamp(Math.round((q.y - this.bl.y - 16) / 18), 1, 8); }
      this.layoutBattleList();
    });
    this.input.on("pointerup", () => { if (drag) { drag = null; this.saveBattleList(); } });
    this.blMinB.on("pointerdown", () => { this.bl.min = !this.bl.min; this.layoutBattleList(); this.saveBattleList(); });
    this.blClsB.on("pointerdown", () => { this.bl.open = false; this.layoutBattleList(); this.saveBattleList(); this.msg("Battle List fechada — L para abrir"); });
    this.input.keyboard.on("keydown-L", () => { this.bl.open = !this.bl.open; this.layoutBattleList(); this.saveBattleList(); });
    this.blT = 0; this.layoutBattleList(); this.refreshBattleList();
  },
  // janela de habilidades: nível, experiência, magic level, sword/distance e shield (arrastar, minimizar, fechar; K reabre)
  buildSkillWin(ui) {
    let st = {}; try { st = JSON.parse(localStorage.getItem("vitula_sk") || "{}"); } catch (e) {}
    const S = this.skS = Object.assign({ x: 8, y: 60, min: false, open: true }, st), w = 160;
    const win = this.add.container(S.x, S.y); ui.add(win);
    const bg = this.add.rectangle(0, 0, w, 10, 0x0c0a08, 0.8).setOrigin(0).setStrokeStyle(1, 0x5a4a30).setInteractive();
    const bar = this.add.rectangle(0, 0, w, 14, 0x2a2018, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    const title = txt(this, 4, 1, "Habilidades", 10, COLORS.gold);
    const minB = txt(this, w - 24, 0, "–", 11, COLORS.text).setInteractive({ useHandCursor: true });
    const clsB = txt(this, w - 11, 0, "×", 11, COLORS.text).setInteractive({ useHandCursor: true });
    win.add([bg, bar, title, minB, clsB]);
    // linhas: nível, classe, experiência (barra), magic level (barra), sword/distance (barra), shield (barra)
    const RH = 17, NR = 7, l = [], v = [], bk = [], fl = [];
    for (let i = 0; i < NR; i++) {
      const y = 17 + i * RH;
      l.push(txt(this, 5, y, "", 9, COLORS.dim)); v.push(txt(this, w - 5, y, "", 9, COLORS.text).setOrigin(1, 0));
      bk.push(this.add.rectangle(5, y + 12, w - 10, 2, 0x000000, 0.9).setOrigin(0));
      fl.push(this.add.rectangle(5, y + 12, w - 10, 2, 0x8a7430).setOrigin(0));
    }
    win.add([...bk, ...fl, ...l, ...v]);
    // última linha: pontos de atributo — clicar abre a janela de Atributos
    v[NR - 1].setInteractive({ useHandCursor: true }).on("pointerdown", () => this.toggleAttrs());
    l[NR - 1].setInteractive({ useHandCursor: true }).on("pointerdown", () => this.toggleAttrs());
    this.skW = { win, bg, l, v, bk, fl, vis: true };
    const save = () => { try { localStorage.setItem("vitula_sk", JSON.stringify(S)); } catch (e) {} };
    const layout = () => {
      win.setPosition(S.x, S.y).setVisible(S.open); const h = S.min ? 14 : 17 + 7 * 17 + 2;
      bg.setSize(w, h); bg.input.hitArea.setSize(w, h); minB.setText(S.min ? "□" : "–");
      [...l, ...v, ...this.skW.bk, ...this.skW.fl].forEach(t => t.setVisible(!S.min)); this.skW.vis = S.open && !S.min;
    };
    const pt = p => this.uiCam.getWorldPoint(p.x, p.y); let drag = null;
    bar.on("pointerdown", p => { const q = pt(p); drag = { ox: q.x - S.x, oy: q.y - S.y }; });
    this.input.on("pointermove", p => { if (!drag || !p.isDown) return; const q = pt(p); S.x = Phaser.Math.Clamp(q.x - drag.ox, 0, VIEW_W - w); S.y = Phaser.Math.Clamp(q.y - drag.oy, 0, VIEW_H - 14); layout(); });
    this.input.on("pointerup", () => { if (drag) { drag = null; save(); } });
    minB.on("pointerdown", () => { S.min = !S.min; layout(); save(); });
    clsB.on("pointerdown", () => { S.open = false; layout(); save(); this.msg("Habilidades fechada — K para abrir"); });
    this.input.keyboard.on("keydown-K", () => { S.open = !S.open; layout(); save(); });
    layout();
  },

  saveBattleList() { try { localStorage.setItem("vitula_bl2", JSON.stringify(this.bl)); } catch (e) {} },
  blOwns(objs) { return !!(objs && objs.some(o => o.parentContainer && (o.parentContainer === this.blWin || (this.skW && o.parentContainer === this.skW.win)))); },
  layoutBattleList() {
    const b = this.bl, w = b.w, h = b.min ? 14 : 16 + b.rows * 18 + 2;
    this.blWin.setPosition(b.x, b.y).setVisible(b.open);
    this.blBg.setSize(w, h); this.blBar.setSize(w, 14);
    this.blBg.input && this.blBg.input.hitArea.setSize(w, h); this.blBar.input.hitArea.setSize(w, 14);
    this.blMinB.setPosition(w - 24, 0).setText(b.min ? "□" : "–"); this.blClsB.setPosition(w - 11, 0);
    this.blGrip.setPosition(w - 9, h - 9).setVisible(!b.min);
    this.blRows.forEach((r, i) => {
      const y = 16 + i * 18;
      r.sel.setPosition(1, y - 1).setSize(w - 2, 17); r.hit.setPosition(1, y - 1).setSize(w - 2, 17); r.hit.input.hitArea.setSize(w - 2, 17);
      r.name.setPosition(4, y - 1); r.back.setPosition(4, y + 12).setSize(w - 8, 2); r.fill.setPosition(4, y + 12);
      r.show = !b.min && i < b.rows;
    });
    this.refreshBattleList();
  },
  refreshBattleList() {
    if (!this.bl) return;
    const h = this.hero, R = 8, w = this.bl.w;
    const list = (this.monsters || []).filter(m => !m.dead && Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) <= R)
      .map(m => ({ m, d: Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) + Math.hypot(m.x - h.x, m.y - h.y) * 0.01 }))
      .sort((a, b) => a.d - b.d).slice(0, 8);
    this.blRows.forEach((r, i) => {
      const e = r.show ? list[i] : null, on = !!e; r.m = on ? e.m : null;
      r.name.setVisible(on); r.back.setVisible(on); r.fill.setVisible(on); r.hit.setVisible(on); r.sel.setVisible(on && h.target === e.m);
      if (!on) return;
      const m = e.m, f = Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1);
      r.name.setText((m.champion ? "★ " : m.elite ? "◆ " : "") + (m.data.name || m.kind)).setColor(m.champion ? "#e8c060" : m.elite ? "#d89a60" : COLORS.text);
      r.fill.setSize(Math.max(1, (w - 8) * f), 2).setFillStyle(f > 0.6 ? 0x3fae3a : f > 0.3 ? 0xd6b23a : f > 0.1 ? 0xc2452f : 0x6e1414);
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
    { const auto = Settings.data.autoAttack !== false, pulse = 0.55 + 0.45 * Math.sin(this.time_ * 6);
      this.basicRing.setStrokeStyle(2, auto ? 0x9fe08a : 0xe0bc60, auto ? pulse : 0.9);
      this.basicAuto.setText(auto ? "AUTO" : "MANUAL").setColor(auto ? "#eaffd8" : "#d8c8a8");
      this.basicAutoBg.setFillStyle(auto ? 0x3a7a2e : 0x3a3028, 1).setStrokeStyle(1, auto ? 0x9fe08a : 0x7a6440).setSize(auto ? 34 : 44, 11).setOrigin(0.5); }
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
    if (this.skW && this.skW.vis) {
      const one = id => { const q = Save.skill(this.vocId, id), f = q.tries / skillTriesNeeded(id, q.lvl); return [`${SKILLS[id].name}`, `${q.lvl}  ${Math.floor(100 * f)}%`, f, 0x5a9a4a]; };
      const ml = Save.voc(this.vocId).ml, mlf = ml.spent / mlNeeded(this.vocId, ml.lvl);
      const rows = [["Nível", String(h.level), null],
        ["Classe", this.promo() ? this.promo().name : VOCATIONS[this.vocId].name, null],
        ["Experiência", `${Math.floor(h.xp).toLocaleString("pt-BR")} / ${Math.round(this.xpNext()).toLocaleString("pt-BR")}`, h.xp / this.xpNext(), 0x8a7430],
        ["Magic level", `${this.mlEff()}  ${Math.floor(100 * mlf)}%`, mlf, 0x4a6ab8],
        one(this.ranged ? "distance" : "sword"), one("shield"),
        ["Atributos", this.attrFree() > 0 ? `+${this.attrFree()} ponto(s) · U` : "abrir · U", null]];
      this.skW.v[6].setColor(this.attrFree() > 0 ? "#9fe08a" : COLORS.dim);
      rows.forEach((r, i) => {
        const W = this.skW, on = r[2] != null;
        W.l[i].setText(r[0]); W.v[i].setText(r[1]); W.bk[i].setVisible(on); W.fl[i].setVisible(on);
        if (on) W.fl[i].setSize(Math.max(1, W.bk[i].width * Phaser.Math.Clamp(r[2], 0, 1)), 2).setFillStyle(r[3]);
      });
    }
    if (this.msgT > 0) { this.msgT -= dt; this.msgText.setAlpha(Phaser.Math.Clamp(this.msgT, 0, 1)); }
  },


  // ---------------------------------------------------------------- atributos (tecla U)
  // 1 ponto por nível ganho. O jogo pausa com a janela aberta.
  toggleAttrs() {
    if (this.finished || this.paused || this.bagOpen && !this.attrBox) return;
    if (this.attrBox) { this.attrBox.destroy(); this.attrBox = null; this.bagOpen = false; return; }
    this.bagOpen = true; this.buildAttrs();
  },
  buildAttrs() {
    if (this.attrBox) this.attrBox.destroy();
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.attrBox = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0).setInteractive());
    const ids = Object.keys(ATTRS), W = 520, RH = 34, H = 110 + ids.length * RH + 16, X = VIEW_W / 2 - W / 2, Y = Math.max(6, VIEW_H / 2 - H / 2);
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text) => { const t = txt(this, x, y, s, size, col); c.add(t); return t; };
    T_(VIEW_W / 2, Y + 24, "Atributos", 24, COLORS.gold).setOrigin(0.5);
    T_(X + W - 20, Y + 14, "U / ESC fecha", 11, COLORS.dim).setOrigin(1, 0);
    const free = this.attrFree();
    T_(VIEW_W / 2, Y + 52, free > 0 ? `Pontos para distribuir: ${free}` : "Sem pontos. Cada nível ganho dá 1 ponto.", 14, free > 0 ? "#9fe08a" : COLORS.dim).setOrigin(0.5);
    T_(VIEW_W / 2, Y + 72, `Nível ${this.hero.level} · ${this.hero.level - 1 - free} ponto(s) já distribuído(s)`, 11, COLORS.dim).setOrigin(0.5);
    ids.forEach((id, i) => {
      const A = ATTRS[id], y = Y + 96 + i * RH, n = this.attr(id);
      const name = id === "weapon" ? (this.ranged ? "Distance" : "Sword") : A.name;
      c.add(this.add.rectangle(X + 16, y, W - 32, RH - 4, 0x1a1612, 0.9).setOrigin(0).setStrokeStyle(1, 0x4a3e2c));
      T_(X + 26, y + 3, name, 14, COLORS.text);
      T_(X + 26, y + 17, id === "weapon" ? `+1 de ${name}` : A.desc, 11, COLORS.dim);
      T_(X + W - 150, y + 8, `${n}`, 14, COLORS.gold).setOrigin(1, 0);
      T_(X + W - 140, y + 10, n ? A.show(n) : "", 11, "#9fd0ff");
      const on = free > 0;
      const b = this.add.rectangle(X + W - 46, y + 3, 26, 24, on ? 0x3a7a2e : 0x2a2622, 1).setOrigin(0).setStrokeStyle(1, on ? 0x9fe08a : 0x4a443c); c.add(b);
      T_(X + W - 33, y + 15, "+", 16, on ? "#eaffd8" : COLORS.dim).setOrigin(0.5);
      if (on) b.setInteractive({ useHandCursor: true }).on("pointerdown", () => { if (this.spendAttr(id)) this.buildAttrs(); });
    });
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
      "\n5 e 6: poções · I: mochila · U: atributos · TAB: mapa · roda do mouse: zoom\nBaús pedem chave de bronze.",
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


  // morte: perde experiência, equipamentos e ouro coletado, conforme as bênçãos da Oráculo
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
    const penText = pen ? `\n\nMorte — bênçãos da Oráculo: ${pen.bless}/3\nExperiência perdida: ${Math.round(pen.b.xp * 100)}%\nEquipamentos perdidos: ${pen.b.equip >= 1 ? "todos" : Math.round(pen.b.equip * 100) + "%"}\nOuro perdido: ${Math.round(pen.b.gold * 100)}% (${pen.goldLost})` : "";
    this.panel(victory ? "Masmorra Vencida" : "Você Caiu",
      `Dificuldade: ${Math.round(this.diff * 100)}%\nAndar alcançado: ${this.floorN}/${FLOORS}\nNível: ${this.hero.level}\nAbates: ${this.kills}\nOuro obtido: ${earned}   (bolsa do ${v.name}: ${Save.gold(this.vocId)})` + penText,
      [["Descer de novo", () => this.scene.restart()]]
        .concat(cityUnlocked() ? [["Voltar à cidade", () => { this.registry.set("townSpawn", "sewer"); this.scene.start("town"); }]] : [])
        .concat([["Voltar ao mapa", () => this.scene.start("map")]]));
    window.__vitulaEnd = { victory, floor: this.floorN, level: this.hero.level, kills: this.kills, earned };
  },
});
