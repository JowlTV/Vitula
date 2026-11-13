// Herói: movimento em grade, golpe automático, skills, itens, vida, experiência, promoção e mira.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // orientação de ataque (como o quadrado vermelho do Tibia):
  //  • quadrado vermelho pulsante no monstro que o golpe automático vai acertar;
  //  • seta clara no chão indicando para onde o herói está virado (direção do Golpe Frontal).
  drawAim() {
    const h = this.hero;
    if (!this.aimG || !this.aimG.scene) { this.aimG = this.add.graphics(); this.ents.add(this.aimG); }
    const g = this.aimG.clear().setDepth(99995);
    if (h.dead) return;
    const t = h.target && !h.target.dead ? h.target : this.ranged ? this.rangedTarget() : this.adjacentMonster(h.x, h.y, h.facing);
    if (t && !t.dead) {
      const p = 0.65 + 0.35 * Math.sin(this.time_ * 10);
      const x = Math.round((t.px != null ? t.px : t.x * T + T / 2) - T / 2) + 2, y = Math.round((t.py != null ? t.py - T * 0.82 : t.y * T)) + 2, w = T - 4;
      g.lineStyle(3, 0x000000, 0.6).strokeRect(x + 1, y + 1, w, w);
      g.lineStyle(2, 0xe02424, p).strokeRect(x, y, w, w);
      // cantos reforçados
      g.fillStyle(0xff4a3a, p);
      for (const [cx, cy] of [[x, y], [x + w - 8, y], [x, y + w - 2], [x + w - 8, y + w - 2]]) g.fillRect(cx, cy, 8, 2);
      for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + w - 8], [x + w - 2, y + w - 8]]) g.fillRect(cx, cy, 2, 8);
    }
    // seta de direção
    let [dx, dy] = h.facing; if (!dx && !dy) dx = 1;
    const fx = (h.x + dx) * T + T / 2, fy = (h.y + dy) * T + T / 2;
    if (this.gen.isFloor(h.x + dx, h.y + dy) && !(t && t.x === h.x + dx && t.y === h.y + dy)) {
      const ang = Math.atan2(dy, dx), c = Math.cos(ang), sn = Math.sin(ang);
      const P = (a, b) => [fx + a * c - b * sn, fy + a * sn + b * c];
      const [ax, ay] = P(10, 0), [bx, by] = P(-6, -9), [cx2, cy2] = P(-6, 9), [mx, my] = P(-1, 0);
      g.fillStyle(0xe8dcc0, 0.28).fillTriangle(ax, ay, bx, by, mx, my).fillTriangle(ax, ay, cx2, cy2, mx, my);
    }
  },


  updateHero(dt) {
    const h = this.hero;
    if (h.dead) return;
    // alvo fixo: só se solta sozinho se o monstro morreu, sumiu (outro andar) ou ficou longe demais
    if (h.target && (h.target.dead || !this.monsters.includes(h.target) || Math.max(Math.abs(h.target.x - h.x), Math.abs(h.target.y - h.y)) > 9)) h.target = null;
    for (const s in h.cds) h.cds[s] = Math.max(0, h.cds[s] - dt);
    if (h.potCd) for (const s in h.potCd) h.potCd[s] = Math.max(0, h.potCd[s] - dt);
    if (h.buffs) for (const s in h.buffs) h.buffs[s] = Math.max(0, h.buffs[s] - dt);
    h.atkT = Math.max(0, h.atkT - dt);
    h.regen += dt; if (h.regen >= 1) { h.regen -= 1; if (this.stats.recovery > 0) this.heal(this.stats.recovery, false); }
    // regeneração de mana (Arqueiro) ou de Fúria só em combate (Cavaleiro)
    if (this.stats.manaReg && (VOCATIONS[this.vocId].mana || h.furyIdle < 4)) h.fury = Math.min(this.furyMax, h.fury + this.stats.manaReg * dt);
    this.tickMonsterPoison(dt);
    this.tickPoison(dt);
    // passiva da vocação (Cavaleiro: 2% da vida máxima a cada 5 s)
    const pv = VOCATIONS[this.vocId].passive;
    if (pv) { h.pReg = (h.pReg || 0) + dt; if (h.pReg >= pv.every) { h.pReg -= pv.every; this.heal(h.maxHp * pv.regenPct * (this.promo() ? this.promo().regenMult : 1)); } }
    // a fúria esfria fora de combate
    // (Arqueiro: mana, que se regenera sempre e não esfria)
    if (VOCATIONS[this.vocId].mana) h.fury = Math.min(this.furyMax, h.fury + (3 + 0.15 * (this.magicLevel ? this.magicLevel() : 0)) * dt);
    else { h.furyIdle += dt; if (h.furyIdle > 4) h.fury = Math.max(0, h.fury - 4 * dt); }
    this.updateAura(dt);
    if (h.moveT > 0) {
      // sobra do quadro vai para o próximo passo (sem micro-parada entre uma casa e outra)
      const used = Math.min(dt, h.moveT); h.moveT -= used; h.carry = dt - used;
      const k = 1 - h.moveT / h.moveLen;
      const to = this.cellPos(h.x, h.y);
      h.px = Phaser.Math.Linear(h.fromX, to.x, k); h.py = Phaser.Math.Linear(h.fromY, to.y, k);
      if (h.moveT === 0) this.heroArrived();
    }
    h.spr.setPosition(Math.round(h.px), Math.round(h.py + 4)).setDepth(h.py);
    h.shadow.setPosition(h.px, h.py - 3).setDepth(h.py - 1);
    // a aura acompanha o herói DEPOIS do passo, sempre logo atrás dele (antes, ao subir, ficava na frente)
    if (h.auraSpr && h.auraSpr.scene && h.auraT > 0) h.auraSpr.setPosition(h.px, h.py - 2).setDepth(h.py - 1);
    h.flash = Math.max(0, (h.flash || 0) - dt * 5);
    // pisca em vermelho escuro (#660000) ao apanhar
    if (h.flash > 0.55) h.spr.setTintFill(0x660000); else if (h.flash > 0) h.spr.setTint(0xb04040); else h.spr.setTint(this.ambientTint || 0xffffff);
    let anim = h.moveT > 0 ? "hero_walk" : "hero_idle";
    if (this.anims.exists(this.ap + "idle_down")) {
      const [fx, fy] = h.facing;
      // "walkHold": continua andando entre um tile e outro (sem voltar ao parado por 1 quadro = mancar)
      if (h.moveT > 0) h.walkHold = 0.12; else h.walkHold = Math.max(0, (h.walkHold || 0) - dt);
      const walking = h.walkHold > 0, atk = h.attackT > 0 && !(this.ranged && h.moveT > 0);
      // 4 direções: baixo, cima e lado (a esquerda é o lado espelhado)
      const dir = atk ? (h.atkDir || "down") : (fx ? "side" : (fy < 0 ? "up" : "down"));
      anim = this.ap + (atk ? "attack" : walking ? "walk" : "idle") + "_" + dir;
      // levar dano forte ou lançar magia: animação de frente por um instante
      h.poseT = Math.max(0, (h.poseT || 0) - dt);
      if (h.poseT > 0 && h.pose && this.anims.exists(h.pose) && !atk) anim = h.pose;
      if (!atk && fx) h.lookLeft = fx < 0;
      h.spr.setFlipX(dir === "side" && !!(atk ? h.atkLeft : h.lookLeft));
    }
    h.attackT = Math.max(0, (h.attackT || 0) - dt);
    if (h.spr.anims.currentAnim.key !== anim) { h.spr.play(anim, true); if (anim.startsWith(this.ap)) h.spr.setScale(this.ap === "kn_" ? (anim === "kn_hurt" || anim === "kn_cast" ? 0.38 * WORLD_SCALE : this.heroScale) : this.heroScale); }
    // ataque básico automático em quem estiver colado
    h.atkQueued = Math.max(0, (h.atkQueued || 0) - dt);
    const autoAtk = Settings.data.autoAttack !== false;
    if (this.ranged) { this.archerAttack(autoAtk); }
    else {
    if (h.atkT <= 0 && !autoAtk && h.atkQueued > 0 && !(h.target && !h.target.dead) && !this.adjacentMonster(h.x, h.y, h.facing)) {
      // golpe no vazio: só a animação, para frente
      h.atkQueued = 0; h.atkT = 0.5 * this.stats.cooldown / (this.stats.atkSpeed || 1); this.heroSwing(...h.facing);
    }
    if (h.atkT <= 0 && (autoAtk || h.atkQueued > 0)) {
      h.atkQueued = 0;
      // mira travada: com um alvo clicado, só ele apanha (até morrer ou trocar de alvo)
      const locked = h.target && !h.target.dead ? h.target : null;
      const t = locked ? (Math.max(Math.abs(locked.x - h.x), Math.abs(locked.y - h.y)) === 1 ? locked : null) : this.adjacentMonster(h.x, h.y, h.facing);
      if (t) {
        h.target = t;   // alvo fixo: fica nele até morrer ou você escolher outro
        h.atkT = 1.0 * this.stats.cooldown / (this.stats.atkSpeed || 1);
        this.heroSwing(Math.sign(t.x - h.x), Math.sign(t.y - h.y));
        // o golpe acerta no quadro de impacto da animação (~0,2 s), não antes
        this.time.delayedCall(200, () => {
          if (t.dead || this.finished) return;
          const sx = Math.sign(t.x - h.x), sy = Math.sign(t.y - h.y), ang = sx && sy ? 45 * sy * sx : 0;   // golpe na diagonal sai inclinado
          this.fx(this.anims.exists("fx_basic_slash") ? "basic_slash" : "slash", t.px, t.py - 22, this.anims.exists("fx_basic_slash") ? 0.9 : 0.7, t.x < h.x, ang);
          const crit = Math.random() < this.critChance();
          this.damageMonster(t, this.baseDamage() * Phaser.Math.FloatBetween(0.85, 1.15) * (crit ? 1.8 : 1));
          this.weaponElement(t);
          if (crit) { this.splat(t.px, t.py - 4, 5); }
          this.addFury(9);
          this.trainSkill("sword");
          sfx(this, "hit", 0.3);
        });
      }
    }
    }
    if (h.moveT > 0) return;
    const dir = this.inputDir();
    if (dir) this.tryMove(dir[0], dir[1]);
    if (h.moveT > 0 && h.carry) h.moveT = Math.max(0.001, h.moveT - h.carry);
    h.carry = 0;
  },


  // ---------------------------------------------------------------- status (estilo Tibia)
  // dano corpo a corpo: máx = 0,085 × ataque × Sword + nível/5; o golpe médio fica em ~80% do máximo
  maxDamage() {
    return (0.085 * (this.stats.weaponAtk || FIST_ATTACK) * this.swordEff() + this.hero.level / 5) * this.stats.might * (this.promo() ? this.promo().dmgMult : 1);
  },
  baseDamage() { return this.maxDamage() * 0.8; },
  // pontos de atributo: quantos foram postos em cada um, quantos sobram (1 por nível acima do 1)
  attr(id) { return (Save.voc(this.vocId).attr || {})[id] || 0; },
  attrFree() { const a = Save.voc(this.vocId).attr || {}; let spent = 0; for (const k in a) spent += a[k]; return Math.max(0, this.hero.level - 1 - spent); },
  spendAttr(id) {
    if (!ATTRS[id] || this.attrFree() <= 0) return false;
    const d = Save.voc(this.vocId), h = this.hero; d.attr[id] = (d.attr[id] || 0) + 1; Save.save();
    this.stats = this.computeStats();
    if (id === "vit") { h.maxHp += 25; h.hp += 25; }
    sfx(this, "gem", 0.3);
    return true;
  },
  critChance() { return 0.1 + 0.005 * this.attr("crit") + (this.stats.gearCrit || 0) + ((this.hero.frenzyT || 0) > 0 ? 0.25 : 0); },
  swordEff() { return this.attr("weapon") + (this.ranged ? Save.skill(this.vocId, "distance").lvl + (this.buffOn("hunter") ? 10 : 0) : Save.skill(this.vocId, "sword").lvl + (this.buffOn("berserker") ? 10 : 0)); },
  shieldLvl() { return Save.skill(this.vocId, "shield").lvl + this.attr("shield"); },
  mlEff() { return Save.voc(this.vocId).ml.lvl + this.attr("ml") + (this.stats.gearMl || 0) + (this.buffOn("mage") ? 10 : 0); },
  // defesa: armadura + metade do Shield acima do inicial (itens de defesa vão somar aqui)
  defenseValue() { return this.stats.armor + (this.stats.gearDef || 0) + 0.25 * (this.shieldLvl() - SKILLS.shield.start); },
  blockChance() { return Math.min(0.6, Math.min(0.35, 0.05 + 0.006 * (this.shieldLvl() - SKILLS.shield.start)) + 0.005 * this.attr("block") + (this.stats.gearBlock || 0)); },
  attacksPerSec() { return (this.stats.atkSpeed || 1) / this.stats.cooldown; },
  buffOn(id) { const b = this.hero.buffs; return !!(b && b[id] > 0); },

  // magic level: cada ponto de Fúria gasto em habilidade conta (como mana gasta no Tibia)
  trainMagic(spent) {
    const ml = Save.voc(this.vocId).ml;
    ml.spent += spent;
    let need = mlNeeded(this.vocId, ml.lvl);
    while (ml.spent >= need) {
      ml.spent -= need; ml.lvl++;
      this.msg(t("ml_up", { n: ml.lvl }));
      this.floatText(this.hero.px, this.hero.py - 96, t("ml_float", { n: ml.lvl }), "#c0a0ff");
      sfx(this, "levelup", 0.25);
      need = mlNeeded(this.vocId, ml.lvl);
    }
    Save.save();
  },

  // poções dos atalhos 1 e 2 (teclas 5 e 6)
  usePotion(slot) {
    const h = this.hero, d = Save.voc(this.vocId), id = d.potionSlots[slot], P = POTIONS[id];
    if (!P || this.finished || this.paused || h.dead) return;
    if (!potionOk(id, this.vocId)) { this.msg(t("potion_wrong_voc", { name: P.name, voc: VOCATIONS[this.vocId].name })); return; }
    h.potCd = h.potCd || {};
    if ((h.potCd[id] || 0) > 0) return;
    if (!(d.potions[id] > 0)) { this.msg(t("no_potion", { name: P.name.toLowerCase() })); return; }
    d.potions[id]--; h.potCd[id] = P.cd; Save.save();
    h.buffs = h.buffs || {};
    if (id === "health") this.heal(h.maxHp * 0.4);
    else if (id === "fury") { h.fury = this.furyMax; this.floatText(h.px, h.py - 70, VOCATIONS[this.vocId].mana ? t("mana_full") : t("fury_full"), VOCATIONS[this.vocId].mana ? "#7ab0ff" : "#e08a4a"); }
    else if (P.dur) { h.buffs[id] = P.dur; this.msg(`${P.name}: ${P.desc}`); }
    sfx(this, "gem", 0.4);
  },


  // treino de skill: cada uso conta uma tentativa; ao completar, sobe um ponto (devagar, como no Tibia)
  trainSkill(id, n = 1) {
    const sk = Save.skill(this.vocId, id);
    // skills de luta: ritmo base 32% acima do original; a cada 10 pontos de skill, 5% mais lento
    sk.tries += n * 1.32 * Math.pow(0.95, Math.max(0, Math.floor((sk.lvl - SKILLS[id].start) / 10)));
    const need = skillTriesNeeded(id, sk.lvl);
    if (sk.tries >= need) {
      sk.tries -= need; sk.lvl++;
      this.msg(t("skill_up", { name: SKILLS[id].name, n: sk.lvl }));
      this.floatText(this.hero.px, this.hero.py - 96, `${SKILLS[id].name} ${sk.lvl}`, "#9fd0ff");
      sfx(this, "levelup", 0.25);
      Save.save();
    }
  },


  tryMove(dx, dy) {
    const h = this.hero;
    let diag = dx !== 0 && dy !== 0;
    // diagonal estilo Tibia: passa entre monstros e quinas; só não atravessa quando as DUAS laterais são parede/porta fechada,
    // ou quando a casa de destino está ocupada/bloqueada
    const sideOk = (x, y) => this.walkable(x, y) && !this.isClosedDoor(x, y);
    if (diag && (!this.gen.isWalk(h.x + dx, h.y + dy) || (!sideOk(h.x + dx, h.y) && !sideOk(h.x, h.y + dy)))) {
      // desliza pela parede em vez de travar
      if (this.walkable(h.x + dx, h.y) && !this.occ.has(key(h.x + dx, h.y))) dy = 0;
      else if (this.walkable(h.x, h.y + dy) && !this.occ.has(key(h.x, h.y + dy))) dx = 0;
      else return;
      diag = false;
    }
    const nx = h.x + dx, ny = h.y + dy;
    h.facing = [dx, dy];
    if (dx) { h.spr.setFlipX(dx < 0); h.lookLeft = dx < 0; }
    if (this.isClosedDoor(nx, ny)) { this.openDoor(nx, ny); this.updateFlow(); h.moveT = 0.12; h.moveLen = 0.12; h.fromX = h.px; h.fromY = h.py; return; }
    if (this.props.has(key(nx, ny))) {
      // quebrar barril/caixa/pote também é um golpe: animação de ataque virada para o objeto
      if (this.props.get(key(nx, ny)).kind in BREAKABLE) {
        this.heroSwing(dx, dy);
        const c = this.cellPos(nx, ny);
        this.time.delayedCall(200, () => { if (!this.finished) this.fx(this.anims.exists("fx_basic_slash") ? "basic_slash" : "slash", c.x, c.y - 22, this.anims.exists("fx_basic_slash") ? 0.9 : 0.7, dx < 0, dx && dy ? 45 * dx * dy : 0); });
      }
      this.bumpProp(nx, ny); h.moveT = 0.18; h.moveLen = 0.18; h.fromX = h.px; h.fromY = h.py; return; }
    // Fuga: atravessa os monstros (só não para em cima deles)
    if ((this.occ.has(key(nx, ny)) && !((h.fleeT || 0) > 0)) || !this.gen.isWalk(nx, ny)) return;
    h.fromX = h.px; h.fromY = h.py;
    h.x = nx; h.y = ny;
    this.reveal();
    this.holeNearHint();
    h.moveLen = 0.22 / this.stats.moveSpeed * (diag ? 1.35 : 1) / ((h.fleeT || 0) > 0 ? 1.75 : 1);
    h.moveT = h.moveLen;
    this.updateFlow();
  },


  heroArrived() {
    const h = this.hero, k = key(h.x, h.y);
    if (this.pickups.has(k)) this.collect(k);
    if (this.plates.has(k)) this.triggerVent(this.plates.get(k));
    if (this.stairs && h.x === this.stairs.x && h.y === this.stairs.y) {
      if (this.floorN < this.floors) {
        this.floorN++;
        sfx(this, "levelup", 0.3);
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.time.delayedCall(260, () => {
          this.buildFloor();
          this.cameras.main.fadeIn(300);
          this.msg(this.floorN === 3 && !this.slope ? t("cave_collapse")
            : this.floorN < this.floors ? t("floor_info", { region: this.region.name, n: this.floorN }) : t("last_floor"));
        });
      } else this.finish(true);
    }
  },


  bumpProp(x, y) {
    const k = key(x, y), pr = this.props.get(k);
    if (pr.kind === "chest_closed") {
      if (this.keys <= 0) { this.msg(t("chest_locked")); return; }
      this.keys--; pr.spr.setTexture("chest_open"); pr.kind = "chest_open";
      sfx(this, "chest", 0.6); this.msg(t("chest_open"));
      this.goldRun += Phaser.Math.Between(30, 60);
      const spots = this.freeNeighbors(x, y);
      // baús não dão mais poções (agora se compram): comida, pergaminho/gema e ouro
      const drops = [["apple", "bread", "meat"][Phaser.Math.Between(0, 2)], Math.random() < 0.5 ? "scroll" : "blue_gem", "gold"];
      drops.forEach((d, i) => { if (spots[i]) this.drop(spots[i].x, spots[i].y, d); });
      return;
    }
    if (!(pr.kind in BREAKABLE)) return;
    pr.hits++;
    this.tweens.add({ targets: pr.spr, x: pr.spr.x + 3, duration: 40, yoyo: true, repeat: 1 });
    sfx(this, "hit", 0.25);
    if (pr.kind === "crate_intact" && pr.hits === 1) pr.spr.setTexture("crate_damaged");
    if (pr.hits >= BREAKABLE[pr.kind]) {
      pr.spr.destroy(); this.props.delete(k);
      sfx(this, "break", 0.5);
      this.drop(x, y, weighted(LOOT));
      this.updateFlow();
    }
  },


  freeNeighbors(x, y) {
    const out = [];
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (this.walkable(nx, ny) && !this.pickups.has(key(nx, ny)) && !this.isClosedDoor(nx, ny) && !(this.stairs && nx === this.stairs.x && ny === this.stairs.y)) out.push({ x: nx, y: ny });
    }
    return out;
  },


  drop(x, y, item, meta) {
    if (item === "none" || !ITEMS[item]) return;
    if (this.pickups.has(key(x, y))) { const alt = this.freeNeighbors(x, y); if (!alt.length) return; ({ x, y } = alt[0]); }
    const p = this.cellPos(x, y);
    const spr = this.add.image(p.x, p.y + 6, ITEMS[item].icon).setOrigin(0.5, 1).setDepth(p.y - 2);
    if (ITEMS[item].tint) spr.setTint(ITEMS[item].tint);
    // brilho da raridade sob o equipamento caído (Normal não brilha)
    if (meta && meta.r > 0) { const gl = this.add.image(p.x, p.y + 2, "light").setScale(0.22, 0.1).setTint(RARITY[meta.r].hex).setAlpha(0.8).setDepth(p.y - 3).setBlendMode(Phaser.BlendModes.ADD); this.ents.add(gl);
      this.tweens.add({ targets: gl, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 }); spr.once("destroy", () => gl.destroy()); }
    this.ents.add(spr); groundShadow(this, spr, this.ents, 1.3);
    let amount = 0;
    if (item === "gold") amount = Phaser.Math.Between(5, 12);
    if (item === "silver") amount = Phaser.Math.Between(2, 5);
    const k = key(x, y);
    this.pickups.set(k, { item, amount, spr, x, baseY: p.y + 6, meta });
    if (x === this.hero.x && y === this.hero.y) this.collect(k);
  },


  collect(k) {
    const pk = this.pickups.get(k); this.pickups.delete(k); pk.spr.destroy();
    const info = ITEMS[pk.item], h = this.hero, px = h.px, py = h.py - 60;
    switch (pk.item) {
      case "gold": case "silver": if (this.buffOn("luck")) pk.amount = Math.round(pk.amount * 1.5); this.goldRun += pk.amount; this.floatText(px, py, t("gold_float", { n: pk.amount }), COLORS.gold); sfx(this, "pickup", 0.35); break;
      case "red_gem": this.goldRun += info.gold; this.floatText(px, py, t("gold_float", { n: info.gold }), COLORS.gold); sfx(this, "gem"); break;
      case "blue_gem": this.addXp(info.xp); this.floatText(px, py, `+${info.xp} exp`, COLORS.soul); sfx(this, "gem"); break;
      case "bronze_key": this.keys++; this.msg(t("got_key")); sfx(this, "pickup"); break;
      case "scroll": for (const s in h.cds) h.cds[s] = 0; this.addXp(40); this.msg("O pergaminho renova suas magias."); sfx(this, "levelup", 0.3); break;
      default:
        if (info.gear) { const g = pk.meta || gearNew(info.gear), R = RARITY[g.r]; Save.voc(this.vocId).gear.push(g); Save.save();
          this.msg(t("got_item", { name: info.name, rarity: R.name })); this.floatText(px, py, info.name, R.color); sfx(this, "levelup", 0.25); break; }
        if (pk.item === "boss_essence") { const d = Save.voc(this.vocId); d.essence++; Save.save(); this.msg(t("got_essence", { n: d.essence })); this.floatText(px, py, t("got_essence", { n: "" }), "#ffa030"); sfx(this, "gem"); break; }
        this.heal(info.healPct ? h.maxHp * info.healPct : info.heal); sfx(this, "pickup", 0.35);
    }
  },


  // dano extra do elemento da arma (fogo, gelo, terra, raio) e veneno da Espada da Serpente
  weaponElement(t) {
    const W = this.stats.weapon; if (!W || this.ranged || t.dead) return;
    if (W.el && W.elDmg) this.damageMonster(t, W.elDmg * Phaser.Math.FloatBetween(0.8, 1.2), W.el);
    if (W.magic && !t.dead) this.damageMonster(t, (5 + 1.5 * this.mlEff()) * Phaser.Math.FloatBetween(0.8, 1.2), "energy");
    if (W.poison && !t.dead) { t.poisonT = W.poison.dur; t.poisonDps = Math.max(1, this.baseDamage() * W.poison.pct); }
  },
  tickMonsterPoison(dt) {
    for (const m of this.monsters) {
      if (!(m.poisonT > 0) || m.dead) continue;
      m.poisonT -= dt; m.poisonTick = (m.poisonTick || 0) + dt;
      if (m.poisonTick >= 1) { m.poisonTick -= 1; this.damageMonster(m, m.poisonDps, "earth", true); }
    }
  },

  // equipamentos: vestir, tirar (o item volta para a mochila)
  // i = posição na lista da mochila (d.gear)
  equipItem(i) {
    const d = Save.voc(this.vocId), g = d.gear[i], E = g && EQUIP[g.id], h = this.hero;
    if (!E) return false;
    if (!equipOk(g.id, this.vocId)) { this.msg(t("wrong_voc")); return false; }
    if (h.level < E.lvl) { this.msg(t("need_level", { n: E.lvl })); return false; }
    d.gear.splice(i, 1);
    if (d.equip[E.slot]) d.gear.push(d.equip[E.slot]);
    d.equip[E.slot] = g;
    // duas mãos não combinam com escudo
    if (E.twoH && d.equip.shield) { d.gear.push(d.equip.shield); delete d.equip.shield; this.msg(t("two_hand_shield")); }
    if (E.slot === "shield" && d.equip.weapon && EQUIP[d.equip.weapon.id].twoH) { d.gear.push(d.equip.weapon); delete d.equip.weapon; this.msg(t("shield_two_hand")); }
    Save.save(); this.restat(); sfx(this, "pickup", 0.3); return true;
  },
  unequipSlot(slot) {
    const d = Save.voc(this.vocId); if (!d.equip[slot]) return;
    d.gear.push(d.equip[slot]); delete d.equip[slot]; Save.save(); this.restat();
  },
  restat() {
    const h = this.hero, old = h.maxHp - this.stats.maxHp;   // bônus de nível já somados ao máximo
    this.stats = this.computeStats();
    h.maxHp = this.stats.maxHp + old; h.hp = Math.min(h.hp, h.maxHp);
  },

  // ---------------------------------------------------------------- herói: dano, cura, experiência
  // veneno (aranha venenosa): dano por segundo que não é bloqueado; renova a duração a cada mordida
  poisonHero(p) {
    const h = this.hero; if (h.dead || this.god) return;
    if (!(h.poisonT > 0)) this.floatText(h.px, h.py - 80, t("poisoned"), "#8fe060");
    h.poisonT = p.dur; h.poisonDps = h.maxHp * p.pct; h.poisonTick = h.poisonTick || 0;
  },
  tickPoison(dt) {
    const h = this.hero; if (!(h.poisonT > 0) || h.dead) return;
    h.poisonT -= dt; h.poisonTick += dt;
    if (h.spr) h.spr.setTint(0xa8f08a);
    if (h.poisonTick >= 1) { h.poisonTick -= 1; this.hurtHero(0, Math.max(1, Math.round(h.poisonDps)), "earth"); }
    if (h.poisonT <= 0 && h.spr) h.spr.clearTint();
  },

  hurtHero(amount, pure = 0, el = "physical") {
    const h = this.hero;
    if (h.dead || this.god) return;
    // resistências dos equipamentos ao elemento do golpe
    const res = Math.min(0.8, (this.stats.res || {})[el] || 0);
    if (res) { amount *= 1 - res; pure = pure ? Math.max(1, Math.round(pure * (1 - res))) : 0; }
    if (pure) { h.hp -= pure; this.floatText(h.px + 8, h.py - 60, String(pure), "#7fd04a"); if (h.hp <= 0) h.hp = 0.0001, amount = 1, pure = 0; else return; }
    this.trainSkill("shield");
    // bloqueio com o escudo (chance cresce com o Shield): nenhum dano
    if (Math.random() < this.blockChance()) { this.floatText(h.px, h.py - 66, t("blocked"), "#9fd0ff"); sfx(this, "hit", 0.2); return; }
    const real = Math.max(1, amount - this.defenseValue());
    h.hp -= real; h.flash = 1;
    this.addFury(4);
    this.floatText(h.px + Phaser.Math.Between(-6, 6), h.py - 66, String(Math.round(real)), COLORS.hurt);
    sfx(this, "hurt", 0.35);
    // golpe pesado (≥10% da vida): tremor e sangue no chão
    if (real >= h.maxHp * 0.1 && !(h.attackT > 0)) { h.pose = this.ap + "hurt"; h.poseT = 0.42; }
    if (real >= h.maxHp * 0.1) { this.cameras.main.shake(130, 0.004); this.splat(h.px, h.py - 2, 6); }
    // golpes comuns não tremem mais a tela
    if (h.hp <= 0) {
      h.dead = true;
      this.deathScreen();
    }
  },


  // corda: E perto dela sobe um andar; do 1º andar volta à cidade levando o ouro
  useRope() {
    const h = this.hero;
    if (this.tryAltar()) return;
    if (this.tryHole()) return;
    if (!this.rope || h.dead || this.finished || this.paused || this.bagOpen) return;
    if (Math.abs(h.x - this.rope.x) > 1 || Math.abs(h.y - this.rope.y) > 1) return;
    if (this.floorN > 1) {
      if (this.roping) return; this.roping = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.time.delayedCall(260, () => { this.floorN--; this.buildFloor("stairs"); this.cameras.main.fadeIn(300); this.roping = false; this.msg(t("rope_up", { n: this.floorN })); });
      return;
    }
    this.finished = true;
    const earned = Math.round(this.goldRun * this.stats.greed);
    Save.addGold(this.vocId, earned); Save.addKills(this.killsByType); Save.data.runs++; Save.save();
    this.registry.set("townSpawn", this.slope ? "gate" : "sewer");   // da encosta volta pelo portão
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("town"));
  },

  // estátua da Oráculo: a bênção é concedida uma vez por estátua
  tryAltar() {
    const a = this.altar, h = this.hero;
    if (!a || a.used || this.paused || this.bagOpen || this.finished || h.dead) return false;
    if (Math.abs(h.x - a.x) > 1 || Math.abs(h.y - a.y) > 1) return false;
    const d = Save.voc(this.vocId), n = d.bless || 0;
    if (n >= 3) { this.msg(t("blessing_max")); return true; }
    d.bless = n + 1; a.used = true; Save.save();
    if (this.altarImg) this.altarImg.setAlpha(0.55);
    sfx(this, "levelup", 0.3);
    this.floatText(h.px, h.py - 90, t("bless_float", { n: d.bless }), "#f2e2a0");
    this.paused = true;
    const box = this.panel(t("bless_title"), BLESS_TEXT[n], [[t("continue_label"), () => { box.destroy(); this.paused = false; }]]);
    return true;
  },

  // golpe de espada virado para (dx, dy): escolhe a animação de ataque da direção certa
  heroSwing(dx, dy) {
    const h = this.hero;
    if (!dx && !dy) { [dx, dy] = h.facing; if (!dx && !dy) dy = 1; }
    h.attackT = 0.42;
    h.atkDir = dx ? "side" : (dy < 0 ? "up" : "down");
    h.atkLeft = dx ? dx < 0 : !!h.lookLeft; if (dx) h.lookLeft = dx < 0;
    const key = this.anims.exists(this.ap + "attack_" + h.atkDir) ? this.ap + "attack_" + h.atkDir : this.ap + "attack_down";
    h.spr.setFlipX(h.atkDir === "side" && h.atkLeft); h.spr.play(key, false);
  },


  heal(amount, show = true) {
    const h = this.hero;
    if (h.dead || amount <= 0) return;
    const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + amount);
    if (show && h.hp - before >= 1) this.floatText(h.px, h.py - 66, `+${Math.round(h.hp - before)}`, COLORS.heal);
  },


  xpNext() { return 8 * Math.pow(this.hero.level, 1.35); },

  // ---------------------------------------------------------------- arqueiro
  rangeNow() { return this.ranged + ((this.hero.eagleT || 0) > 0 ? 2 : 0); },
  // linha livre entre duas casas (sem parede, porta fechada ou objeto no caminho)
  clearShot(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 1; i < n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if (!this.gen.isFloor(x, y) || this.isClosedDoor(x, y) || this.props.has(key(x, y))) return false;
    }
    return true;
  },
  // monstro mais próximo ao alcance, com linha livre (prefere o da frente)
  rangedTarget(lock = false) {
    const h = this.hero, R = this.rangeNow(); let best = null, bd = 1e9;
    const sel = h.target;
    if (sel && !sel.dead && this.monsters.includes(sel) && Math.max(Math.abs(sel.x - h.x), Math.abs(sel.y - h.y)) <= R && this.clearShot(h.x, h.y, sel.x, sel.y)) return sel;
    if (sel && !sel.dead && this.monsters.includes(sel)) return null;   // mira travada: não troca de alvo sozinho
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y));
      if (d > R || !this.clearShot(h.x, h.y, m.x, m.y)) continue;
      const score = d - (Math.sign(m.x - h.x) === h.facing[0] && Math.sign(m.y - h.y) === h.facing[1] ? 0.5 : 0);
      if (score < bd) { bd = score; best = m; }
    }
    if (best && lock) h.target = best;   // alvo fixo: o primeiro em quem atira vira o alvo
    return best;
  },
  // flecha voando de (h) até o alvo; ao chegar chama onHit
  shootArrow(fromX, fromY, toX, toY, onHit, speed = 900) {
    const a = this.add.image(fromX, fromY, "arrow").setRotation(Math.atan2(toY - fromY, toX - fromX)).setDepth(100000).setScale(1.2);
    this.ents.add(a);
    const dur = Math.max(80, Math.hypot(toX - fromX, toY - fromY) / speed * 1000);
    this.tweens.add({ targets: a, x: toX, y: toY, duration: dur, onComplete: () => { a.destroy(); onHit && onHit(); } });
  },
  // ---------------------------------------------------------------- flechas
  // tipo em uso (se acabou, volta para a normal); null = aljava vazia
  arrowType() {
    const d = Save.voc(this.vocId), a = d.arrows || {};
    if (d.arrowSel !== "normal" && (a[d.arrowSel] || 0) > 0) return d.arrowSel;
    return "normal";   // a normal é infinita
  },
  spendArrow() {
    const d = Save.voc(this.vocId), k = this.arrowType();
    if (!k) { if (!this._noArrowMsg || this.time_ - this._noArrowMsg > 4) { this.msg(t("no_arrows")); this._noArrowMsg = this.time_; } return null; }
    if (k === "normal") return k;
    d.arrows[k]--; if (!d.arrows[k] && d.arrowSel === k) this.msg(t("arrows_out_type", { name: t("arrow_" + k) }));
    return k;
  },
  cycleArrow() {
    if (!this.ranged) return;
    const d = Save.voc(this.vocId), a = d.arrows || {}, have = ARROW_IDS.filter(k => k === "normal" || (a[k] || 0) > 0);
    if (!have.length) { this.msg(t("no_arrows")); return; }
    d.arrowSel = have[(have.indexOf(d.arrowSel) + 1) % have.length]; Save.save();
    this.msg(t("arrow_selected", { name: t("arrow_" + d.arrowSel), n: arrowN(d, d.arrowSel) }));
  },
  // dano de uma flecha que acertou: elemento do tipo; explosiva e sagrada acertam também as 8 casas em volta
  arrowHit(t, kind, mult) {
    const A = ARROWS[kind] || ARROWS.normal, crit = Math.random() < this.critChance();
    const dmg = this.baseDamage() * mult * A.mult * Phaser.Math.FloatBetween(0.85, 1.15) * (crit ? this.critMult() : 1);
    this.damageMonster(t, dmg, A.el); this.lifeSteal(dmg);
    if (crit) this.splat(t.px, t.py - 4, 5);
    if (A.area) {
      for (const [dx, dy] of DIRS8) { const m = this.occ.get(key(t.x + dx, t.y + dy)); if (m && !m.dead) { this.damageMonster(m, dmg * 0.7, A.el); this.lifeSteal(dmg * 0.7); } }
      this.fx(kind === "holy" ? "heal" : "explosion", t.px, t.py - 20, kind === "holy" ? 0.9 : 0.75);
      sfx(this, "explode", 0.25);
    }
  },
  critMult() { return 1.8 + ((this.hero.frenzyT || 0) > 0 ? 0.25 : 0); },
  lifeSteal(dmg) {
    const h = this.hero; if (!((h.frenzyT || 0) > 0)) return;
    h.hp = Math.min(h.maxHp, h.hp + dmg * 0.15);
    if (VOCATIONS[this.vocId].mana) h.fury = Math.min(this.furyMax, h.fury + dmg * 0.15);
  },

  archerAttack(autoAtk) {
    const h = this.hero, dts = this.game.loop.delta / 1000;
    h.eagleT = Math.max(0, (h.eagleT || 0) - dts); h.fleeT = Math.max(0, (h.fleeT || 0) - dts); h.frenzyT = Math.max(0, (h.frenzyT || 0) - dts);
    if (h.atkT > 0 || !(autoAtk || h.atkQueued > 0)) return;
    h.atkQueued = 0;
    const t = this.rangedTarget(true);
    if (!t) return;
    const kind = this.spendArrow(); if (!kind) { h.atkT = 0.6; return; }
    h.atkT = 1.1 / 1.25 * this.stats.cooldown / (this.stats.atkSpeed || 1) * (h.eagleT > 0 ? 0.5 : 1) / (h.frenzyT > 0 ? 1.45 : 1);
    const dx = Math.sign(t.x - h.x), dy = Math.sign(t.y - h.y);
    h.facing = [dx, dy];
    this.heroSwing(Math.abs(t.x - h.x) >= Math.abs(t.y - h.y) ? dx : 0, Math.abs(t.x - h.x) >= Math.abs(t.y - h.y) ? 0 : dy);
    // a flecha sai no quadro em que ele solta a corda (~0,3 s)
    this.time.delayedCall(300, () => {
      if (h.dead || this.finished) return;
      this.shootArrow(h.px, h.py - 40, t.px, t.py - 24, () => {
        if (t.dead || this.finished) return;
        this.arrowHit(t, kind, 1);
        this.addFury(8);
        this.trainSkill("distance");
        sfx(this, "hit", 0.25);
      });
      sfx(this, "pickup", 0.15);
    });
  },

  addFury(v) { const h = this.hero; if (VOCATIONS[this.vocId].mana) return;   // mana não vem de golpes
    h.fury = Math.min(this.furyMax, h.fury + v); h.furyIdle = 0; },

  addXp(v) {
    const h = this.hero;
    h.xp += v * this.stats.growth;
    const d = Save.voc(this.vocId); d.xpTotal = (d.xpTotal || 0) + v * this.stats.growth; h.xpTotal = (h.xpTotal || 0) + v * this.stats.growth; Save.save();
    while (h.xp >= this.xpNext()) {
      h.xp -= this.xpNext(); h.level++; h.maxHp += 10; h.hp = h.maxHp; // subir de nível enche a vida
      this.floatText(h.px, h.py - 84, t("level_up_float", { n: h.level }), COLORS.gold);
      const nova = Object.values(this.spells).find(sp => sp.level === h.level);
      this.msg(nova ? t("level_up_skill", { n: h.level, name: nova.name, key: nova.key }) : t("level_up_plain", { n: h.level }));
      sfx(this, "levelup", 0.4);
      this.checkPromotion();
    }
  },


  promo() { const p = PROMOTION[this.vocId]; return p && (this.hero.promoted || Save.voc(this.vocId).promoted) ? p : null; },

  checkPromotion() {
    const p = PROMOTION[this.vocId], h = this.hero, d = Save.voc(this.vocId);
    if (!p || d.promoted || h.level < p.level) return;
    d.promoted = true; h.promoted = true; Save.save();
    this.msg(t("promoted", { name: p.name, regen: p.regenMult, dmg: Math.round((p.dmgMult - 1) * 100) }));
    this.floatText(h.px, h.py - 100, p.name, COLORS.gold);
    this.fx("heal", h.px, h.py - 28, 1.2);
    this.cameras.main.flash(300, 224, 188, 96);
  },
});
