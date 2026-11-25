// A masmorra: andares gerados, herói em grade em tempo real (estilo Tibia), monstros, loot, armadilhas.
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const key = (x, y) => y * 1000 + x;

class DungeonScene extends Phaser.Scene {
  constructor() { super("dungeon"); }


  create() {
    // a cena é reaproveitada (descer de novo, voltar da cidade): esquece objetos e estados da visita anterior
    for (const k of Object.keys(this)) {
      const v = this[k];
      if (v && typeof v === "object" && (v instanceof Phaser.GameObjects.GameObject || v instanceof Phaser.GameObjects.Layer || (v.constructor && /FX|Controller/.test(v.constructor.name)))) this[k] = null;
    }
    this.paused = false; this.bagOpen = false; this.pauseBox = null; this.bagBox = null; this.attrBox = null; this.rope = null; this.gradeFx = null;
    this._stamps = {};
    this.floorN = 1;
    const fq = new URLSearchParams(location.search).get("floor");
    if (fq) this.floorN = Math.max(1, +fq);
    this.bot = new URLSearchParams(location.search).has("bot");
    this.god = new URLSearchParams(location.search).has("god");
    this.regionId = this.registry.get("region") || "karhyn_sewers";
    this.region = REGIONS[this.regionId];
    this.floors = this.region.floors || FLOORS;   // a encosta tem 8 andares; o esgoto, 5
    { const sf = this.registry.get("startFloor"); if (sf) { this.floorN = Math.min(sf, this.floors); this.registry.set("startFloor", 0); } }   // portal de teste
    this.vocId = this.registry.get("vocation") || "knight";
    this.spells = vocSpells(this.vocId); this.ap = vocAnim(this.vocId); this.heroScale = vocScale(this.vocId);
    this.ranged = VOCATIONS[this.vocId].ranged || 0;
    { const d = Save.voc(this.vocId);   // equipamento inicial: uma vez por vocação
      if (!d.lightGear) { d.lightGear = true; d.equip.light = d.equip.light || gearNew("lantern"); Save.save(); }
      if (!d.starterGear) { d.starterGear = true; if (this.vocId === "knight") { d.equip.weapon = d.equip.weapon || gearNew("karhyn_sword"); d.equip.shield = d.equip.shield || gearNew("wooden_shield"); } d.equip.armor = d.equip.armor || gearNew("leather_armor"); Save.save(); }
        // Arqueiro: arco, aljava e 50 flechas (também para quem já tinha o personagem antes das flechas)
        giveArcherKit(this.vocId); }
    this.stats = this.computeStats();
    this.hero = { hp: this.stats.maxHp, maxHp: this.stats.maxHp, level: 1, xp: 0, dead: false, atkT: 0,
      cds: Object.fromEntries(Object.keys(vocSpells(this.vocId)).map(s => [s, 0])), facing: [1, 0], regen: 0, fury: VOCATIONS[this.vocId].mana ? this.furyMax : 0, furyIdle: 0, auraT: 0, auraTick: 0 };
    const lv = +new URLSearchParams(location.search).get("lvl");
    // nível vem da experiência salva (não zera ao entrar de novo)
    { const L = Save.levelInfo(Save.voc(this.vocId).xpTotal); this.hero.level = L.level; this.hero.xp = L.xp; this.hero.maxHp += 10 * (L.level - 1); this.hero.hp = this.hero.maxHp;
      this.hero.promoted = !!Save.voc(this.vocId).promoted; }
    this.seeds = {}; this.altar = null; this.altarImg = null; this.altarMemo = {};
    if (lv) { this.hero.level = lv; this.hero.fury = this.furyMax; this.hero.promoted = !!(PROMOTION[this.vocId] && lv >= PROMOTION[this.vocId].level); }
    this.diff = this.registry.get("difficulty") || 1;
    this.nextWave = 120 + Phaser.Math.Between(30, 120);
    this.goldRun = 0; this.keys = 0; this.kills = 0; this.killsByType = {};
    this.finished = false; this.time_ = 0; this.spikeT = 0;
    this.gen = new DungeonGen();
    this.cameras.main.setBackgroundColor("#08070a");
    this.cameras.main.roundPixels = true;
    // música por região
    const regionMusic = { karhyn_sewers: "music_sewers", goblin_slope: "music_slope", forest: "music_title" };
    this._music = regionMusic[this.regionId] || "music_sewers"; playMusic(this, this._music, 0.5);
    this.input.keyboard.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    // teclas vindas das Opções (remapeáveis)
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard;
    this.keysIn = {};
    for (const [id] of ACTIONS) this.keysIn[id] = Settings.data.keys[id].filter(n => K[n] !== undefined).map(n => kb.addKey(K[n]));
    // cada tecla lança a magia que tem aquele atalho (G = Exura; 1–4 = habilidades)
    const byKey = k => Object.keys(this.spells).find(s => this.spells[s].key === k);
    [["heal", "G"], ["skill1", "1"], ["skill2", "2"], ["skill3", "3"], ["skill4", "4"], ["skill5", "5"], ["skill6", "6"], ["skill7", "7"]].forEach(([id, k]) => (this.keysIn[id] || []).forEach(o => o.on("down", () => { const s = byKey(k); if (s) this.cast(s); })));
    this.input.keyboard.on("keydown-U", () => this.toggleAttrs());
    this.keysIn.pause.forEach(k => k.on("down", () => this.attrBox ? this.toggleAttrs() : this.bagOpen ? this.toggleBag() : this.togglePause()));
    (this.keysIn.potion1 || []).forEach(k => k.on("down", () => this.usePotion(0)));
    (this.keysIn.potion2 || []).forEach(k => k.on("down", () => this.usePotion(1)));
    (this.keysIn.interact || []).forEach(k => k.on("down", () => this.useRope()));
    (this.keysIn.arrows || []).forEach(k => k.on("down", () => this.cycleArrow()));
    (this.keysIn.attack || []).forEach(k => k.on("down", () => { this.hero.atkQueued = 0.35; }));
    (this.keysIn.autoAttack || []).forEach(k => k.on("down", () => {
      Settings.data.autoAttack = Settings.data.autoAttack !== true; Settings.save();
      this.msg(t(Settings.data.autoAttack ? "auto_attack_on" : "auto_attack_off"));
    }));
    (this.keysIn.bag || []).forEach(k => k.on("down", () => this.toggleBag()));
    this.input.keyboard.addCapture("TAB");
    (this.keysIn.map || []).forEach(k => k.on("down", () => this.toggleBigMap()));
    (this.keysIn.target || []).forEach(k => k.on("down", () => this.cycleTarget()));
    (this.keysIn.zoomIn || []).forEach(k => k.on("down", () => this.setCamZoom(this.camZoom() + 0.2)));
    (this.keysIn.zoomOut || []).forEach(k => k.on("down", () => this.setCamZoom(this.camZoom() - 0.2)));
    this.input.on("wheel", (_p, _o, _dx, dy) => this.setCamZoom(this.camZoom() + (dy > 0 ? -0.2 : 0.2)));
    // clique/toque num monstro: vira o alvo (o arqueiro atira por cima dos outros; o cavaleiro ataca esse se estiver colado)
    this.input.on("pointerdown", (p, over) => {
      if (this.blOwns(over)) return;   // clique na janela da battle list
      if (this.paused || this.bagOpen || this.finished || !this.hero || this.hero.dead) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y), tx = Math.floor(w.x / T), ty = Math.floor(w.y / T);
      // o desenho do monstro fica acima da casa dele: aceita a casa clicada e a de baixo
      const m = this.occ.get(key(tx, ty)) || this.occ.get(key(tx, ty + 1));
      // alvo fixo: clicar no chão não solta a mira; só troca quando você escolhe outro monstro
      if (m && !m.dead) { this.hero.target = m; sfx(this, "pickup", 0.15); }
    });
    // câmera da interface: fixa, enxerga só a camada de UI (escuridão, HUD, painéis)
    this.uiLayer = this.add.layer().setDepth(1000000);
    this.uiCam = zoom2(this.cameras.add(0, 0, VIEW_W * 2, VIEW_H * 2));
    this.cameras.main.ignore(this.uiLayer);
    this.buildFloor();
    this.buildHud();
    if (!this.region.testMap) this.msg(this.floorN < this.floors ? t("floor_enter", { name: this.region.name, n: this.floorN }) : t("floor_last"));
  }


  computeStats() {
    const s = { maxHp: 100, armor: 0, recovery: 0, moveSpeed: 1, might: 1, cooldown: 1, growth: 1, greed: 1 };
    Object.assign(s, VOCATIONS[this.vocId].stats);
    // compras da loja
    const tr = Save.voc(this.vocId).trainings;
    s.maxHp += 10 * (tr.hp || 0);
    s.armor += tr.armor || 0;
    s.atkSpeed = 1 + 0.05 * (tr.atkspd || 0);
    this.furyMax = FURY_MAX + 10 * (tr.fury || 0);
    // pontos de atributo (1 por nível)
    const at = Save.voc(this.vocId).attr || {};
    s.maxHp += 25 * (at.vit || 0);
    s.armor += 0.5 * (at.armor || 0);
    s.atkSpeed += 0.0025 * (at.aspd || 0);
    s.might *= 1 + 0.02 * (at.str || 0);
    s.recovery += 0.5 * (at.hpreg || 0);
    s.manaReg = 0.5 * (at.mpreg || 0);
    // equipamentos vestidos
    s.weaponAtk = FIST_ATTACK; s.gearDef = 0; s.gearBlock = 0; s.gearDodge = 0; s.gearCrit = 0; s.gearMl = 0; s.res = {}; s.weapon = null;
    const eq = Save.voc(this.vocId).equip || {};
    for (const slot in eq) {
      const g = eq[slot], E = g && EQUIP[g.id]; if (!E) continue;
      const m = gearMult(g);   // raridade e +N
      if (E.slot === "weapon") { s.weapon = Object.assign({}, E, { elDmg: (E.elDmg || 0) * m }); if (!this.ranged || E.bow) s.weaponAtk = E.atk * m; }
      s.gearDef += (E.def || 0) * m; s.gearBlock += E.block || 0; s.gearDodge += E.dodge || 0; s.gearCrit += E.crit || 0; s.gearMl += E.ml || 0;
      s.recovery += E.hpReg || 0; s.manaReg += E.manaReg || 0; s.moveSpeed *= 1 + (E.speed || 0);
      for (const k in E.res || {}) s.res[k] = (s.res[k] || 0) + E.res[k];
    }
    return s;
  }


  // ---------------------------------------------------------------- loop
  update(_, dtMs) {
    // ritmo do jogo (Opções): desacelera passos, ataques, monstros, animações e efeitos juntos
    const pace = Settings.data.speed || 0.75;
    this.time.timeScale = pace; this.tweens.timeScale = pace; this.anims.globalTimeScale = pace;
    if (this.finished || this.paused || this.bagOpen) return;
    const dt = Math.min(0.05, dtMs / 1000) * pace;
    this.time_ += dt;
    this.updateHero(dt);
    for (const m of this.monsters.slice()) this.updateMonster(m, dt);
    this.updateTraps(dt);
    if (this.time_ > this.nextWave) { this.spawnWave(); this.nextWave = this.time_ + Phaser.Math.Between(90, 180); }
    for (const pk of this.pickups.values()) pk.spr.y = pk.baseY;
    this.drawDarkness(dt);
    this.drawAim();
    this.refreshHud(dt);
    if (this.bot) this.botTick();
  }


  inputDir() {
    if (this.botDir) return this.botDir;
    const down = id => (this.keysIn[id] || []).some(k => k.isDown);
    // diagonal: basta apertar duas direções juntas (ex.: baixo + esquerda)
    const dx = (down("right") ? 1 : 0) - (down("left") ? 1 : 0);
    const dy = (down("down") ? 1 : 0) - (down("up") ? 1 : 0);
    if (!dx && !dy) { this._dirT0 = null; return null; }
    // ao começar a andar, espera um instante (70 ms) pela segunda tecla, para a diagonal não sair como um passo reto
    const now = this.time.now; if (this._dirT0 == null) this._dirT0 = now;
    if (!(dx && dy) && now - this._dirT0 < 70 && !(this.hero.moveT > 0)) return null;
    return [dx, dy];
  }


  // ---------------------------------------------------------------- bot de teste (?bot)
  botTick() {
    this.botDir = null;
    const h = this.hero;
    if (h.moveT > 0 || h.dead) return;
    let goal = this.stairs, best = 1e9;
    for (const m of this.monsters) {
      let d = Math.hypot(m.x - h.x, m.y - h.y);
      if (m.elite && !this.stairs) d = 0;
      if (d < best && d < 9) { best = d; goal = { x: m.x, y: m.y }; }
    }
    if (this.adjacentMonster(h.x, h.y, h.facing)) { for (const sp of ["aura", "quake", "front"]) if (SPELLS[sp] && h.level >= SPELLS[sp].level && h.fury >= SPELLS[sp].fury && h.cds[sp] <= 0) { this.cast(sp); break; } return; }
    if (h.hp < h.maxHp * 0.4 && h.cds.heal <= 0) this.cast("heal");
    if (!goal) return;
    const d = this.gen.distances(goal.x, goal.y, (x, y) => { const p = this.props.get(key(x, y)); return !p || p.kind in BREAKABLE; });
    const here = d[h.y * this.gen.w + h.x];
    const opts = DIRS4.filter(([dx, dy]) => { const v = d[(h.y + dy) * this.gen.w + h.x + dx]; return v >= 0 && v < here; });
    if (opts.length) this.botDir = opts[(Math.random() * opts.length) | 0];
  }
}
