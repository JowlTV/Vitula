// Monstros: criação, caminho até o herói (BFS), passos, ataques, dano e morte.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // alguns ratos patrulhando as passarelas dos túneis
  tunnelMonsters() {
    const g = this.gen;
    for (const t of g.tunnels) {
      const n = g.rand(0, 1 + (this.floorN > 1 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const side = g.rng() < 0.5 ? -1 : 1, off = side * g.rand(1, 2);
        const x = t.h ? g.rand(t.x0 + 1, t.x1 - 1) : t.c + off, y = t.h ? t.c + off : g.rand(t.y0 + 1, t.y1 - 1);
        if (!this.walkable(x, y) || this.occ.has(key(x, y)) || this.spikes.has(key(x, y)) || g.isBridge(x, y)) continue;
        this.spawnMonster(weighted(FLOOR_MONSTERS[this.floorN]), x, y);
      }
    }
  },


  spawnMonster(kind, x, y) {
    const data = MONSTERS[kind], mult = 1 + 0.15 * (this.floorN - 1);
    const p = this.cellPos(x, y);
    const m = { kind, data, x, y, hp: data.hp * mult, maxHp: data.hp * mult, dmg: data.dmg * (1 + 0.1 * (this.floorN - 1)),
      awake: false, dead: false, stepT: Math.random() * data.step, atkT: 0, flash: 0, bob: Math.random() * 10,
      fly: !!data.fly, elite: !!data.elite, px: p.x, py: p.y, fromX: p.x, fromY: p.y, moveT: 0, moveLen: 1, lunge: { x: 0, y: 0 } };
    const ma = MON_ANIM[kind], walkKey = ma && this.anims.exists(ma[1]) ? ma[1] : data.anim;
    m.walkKey = walkKey; m.atkKey = ma && this.anims.exists(ma[2]) ? ma[2] : null; m.dieKey = ma && this.anims.exists(ma[3]) ? ma[3] : null;
    const anim = walkKey && this.anims.exists(walkKey);
    m.spr = anim ? this.add.sprite(p.x, p.y + 4, walkKey).setOrigin(0.5, 1).play({ key: walkKey, startFrame: Phaser.Math.Between(0, 5) })
                 : this.add.image(p.x, p.y + 4, data.tex).setOrigin(0.5, 1);
    if (ma) m.spr.setScale(ma[4]); else if (data.scale) m.spr.setScale(data.scale);
    m.w = m.spr.displayWidth; m.h = m.spr.displayHeight;
    m.shadow = this.add.image(p.x, p.y + (m.fly ? 8 : -2), "shadow").setScale(m.w * 0.9 / 64, m.w * 0.3 / 64);
    m.bar = this.add.graphics();
    this.ents.add([m.shadow, m.spr, m.bar]);
    // dificuldade escolhida (100% a 400%): vida e dano
    m.hp *= this.diff || 1; m.maxHp = m.hp; m.dmg *= this.diff || 1;
    this.monsters.push(m);
    this.occ.set(key(x, y), m);
    return m;
  },

  // invasão: uma horda com um campeão surge perto do herói (nunca nos 2 primeiros minutos)
  spawnWave() {
    const h = this.hero, kinds = FLOOR_MONSTERS[this.floorN], spots = [];
    for (let y = h.y - 9; y <= h.y + 9; y++) for (let x = h.x - 9; x <= h.x + 9; x++) {
      const d = Math.max(Math.abs(x - h.x), Math.abs(y - h.y));
      if (d < 5 || !this.walkable(x, y) || this.occ.has(key(x, y)) || this.spikes.has(key(x, y)) || this.flowAt(x, y) < 0) continue;
      spots.push({ x, y });
    }
    if (spots.length < 4) return false;
    Phaser.Utils.Array.Shuffle(spots);
    const n = Math.min(spots.length, 7 + this.floorN * 2);
    for (let i = 0; i < n; i++) {
      const s = spots[i], m = this.spawnMonster(weighted(kinds), s.x, s.y);
      m.awake = true;
      if (i === 0) {
        // campeão da horda: maior, avermelhado, bem mais forte, vale muito mais xp
        m.champion = true; m.hp *= 4; m.maxHp = m.hp; m.dmg *= 1.6;
        m.spr.setScale((m.data.scale || 1) * 2.7).setTint(0xff9a8a);
        m.w = m.spr.displayWidth; m.h = m.spr.displayHeight;
      }
    }
    this.cameras.main.shake(300, 0.004); sfx(this, "boss", 0.5);
    this.msg("Uma horda invade o esgoto! Um campeão a lidera.");
    return true;
  },


  // ---------------------------------------------------------------- campo de distância até o herói
  updateFlow() {
    const h = this.hero;
    this.flow = this.gen.distances(h.x, h.y, (x, y) => !this.props.has(key(x, y)), 30);
  },

  flowAt(x, y) { if (x < 0 || y < 0 || x >= this.gen.w || y >= this.gen.h) return -1; return this.flow[y * this.gen.w + x]; },


  canEnter(x, y, m) {
    if (!this.walkable(x, y) || this.occ.has(key(x, y)) || (x === this.hero.x && y === this.hero.y)) return false;
    const s = this.spikes.get(key(x, y));
    if (s && s.up && !m.fly) return false;
    return true;
  },


  adjacentMonster(x, y, pref) {
    const pk = key(x + pref[0], y + pref[1]);
    if (this.occ.has(pk)) return this.occ.get(pk);
    let best = null;
    for (const [dx, dy] of DIRS8) { const m = this.occ.get(key(x + dx, y + dy)); if (m && !m.dead && (!best || m.hp < best.hp)) best = m; }
    return best;
  },


  // ---------------------------------------------------------------- monstros
  updateMonster(m, dt) {
    if (m.dead) return;
    const h = this.hero;
    m.bob += dt; m.flash = Math.max(0, m.flash - dt * 6);
    if (m.moveT > 0) {
      m.moveT = Math.max(0, m.moveT - dt);
      const to = this.cellPos(m.x, m.y), k = 1 - m.moveT / m.moveLen;
      m.px = Phaser.Math.Linear(m.fromX, to.x, k); m.py = Phaser.Math.Linear(m.fromY, to.y, k);
    }
    m.lunge.x *= 0.82; m.lunge.y *= 0.82;
    const bob = Math.sin(m.bob * (m.fly ? 9 : 12)) * (m.fly ? 2.5 : (m.moveT > 0 ? 1.2 : 0.4));
    const lift = m.fly ? 16 : 0;
    m.spr.setPosition(Math.round(m.px + m.lunge.x), Math.round(m.py + 4 - lift + bob + m.lunge.y)).setDepth(m.py);
    m.shadow.setPosition(m.px, m.py + (m.fly ? 6 : -2)).setDepth(m.py - 1);
    if (m.flash > 0) m.spr.setTintFill(0xffffff); else if (m.champion) m.spr.setTint(0xff9a8a); else m.spr.clearTint();
    this.drawMonsterBar(m);

    const dist = Math.max(Math.abs(h.x - m.x), Math.abs(h.y - m.y));
    if (!m.awake) {
      const f = this.flowAt(m.x, m.y);
      if (dist <= 7 && f >= 0 && f <= 12) m.awake = true; else return;
    }
    m.atkT -= dt; m.stepT -= dt;
    if (m.bleedT > 0) {
      m.bleedT -= dt; m.bleedTick -= dt;
      if (Math.random() < dt * 6) this.splat(m.px + Phaser.Math.Between(-6, 6), m.py - 2, 1);
      if (m.bleedTick <= 0) {
        m.bleedTick += 1;
        const d = m.maxHp * 0.05;
        this.floatText(m.px, m.py - 40, String(Math.round(d)), "#c02020");
        m.hp -= d; m.flash = 0.6;
        if (m.hp <= 0) { this.monsterDied(m); return; }
      }
    }
    if (dist <= 1 && !h.dead) {
      if (m.atkT <= 0) {
        m.atkT = m.data.atk;
        const len = Math.hypot(h.x - m.x, h.y - m.y) || 1;
        m.lunge = { x: (h.x - m.x) / len * 7, y: (h.y - m.y) / len * 7 };
        if (h.x !== m.x) m.spr.setFlipX(h.x < m.x);
        this.monsterSwing(m);
        this.hurtHero(m.dmg * Phaser.Math.FloatBetween(0.85, 1.15));
      }
      return;
    }
    if (m.stepT <= 0 && m.moveT <= 0) { m.stepT = m.data.step * Phaser.Math.FloatBetween(0.9, 1.15); this.monsterStep(m); }
  },


  // animação de ataque do monstro (volta a andar no fim)
  monsterSwing(m) {
    if (!m.atkKey || m.dead || !m.spr.anims) return;
    m.spr.play(m.atkKey, true);
    m.spr.once("animationcomplete", () => { if (!m.dead && m.spr.active) m.spr.play(m.walkKey, true); });
  },

  // força de um monstro (para decidir quem abre caminho): vida × dano
  power(m) { return m.maxHp * m.dmg; },

  // passo do monstro: SEMPRE tenta chegar ao herói.
  //  • caminho livre → segue o campo de distância;
  //  • outro monstro no caminho: se for mais FRACO que ele, ataca e mata o da frente para passar;
  //    se for mais forte (ou igual), desvia por uma casa ao lado que não o afaste do herói.
  monsterStep(m) {
    const here = this.flowAt(m.x, m.y), cur = here < 0 ? 99999 : here;
    const dirs = Phaser.Utils.Array.Shuffle(DIRS8.slice());
    if (m.fly && Math.random() < 0.35) {
      for (const [dx, dy] of dirs) if (this.canEnter(m.x + dx, m.y + dy, m)) return this.moveMonster(m, m.x + dx, m.y + dy);
      return;
    }
    let best = null, bestCost = 1e9, blocker = null, blockCost = 1e9, side = null, sideCost = 1e9;
    for (const [dx, dy] of dirs) {
      const nx = m.x + dx, ny = m.y + dy;
      if (dx && dy && (!this.walkable(m.x + dx, m.y) || !this.walkable(m.x, m.y + dy))) continue;
      const v = this.flowAt(nx, ny);
      if (v < 0) continue;
      const cost = v * 10 + (dx && dy ? 4 : 0);
      const o = this.occ.get(key(nx, ny));
      if (o && o !== m && !o.dead) { if (v < cur && cost < blockCost) { blockCost = cost; blocker = o; } continue; }
      if (!this.canEnter(nx, ny, m)) continue;
      if (v < cur && cost < bestCost) { bestCost = cost; best = [nx, ny]; }
      else if (v <= cur && cost < sideCost) { sideCost = cost; side = [nx, ny]; }  // de lado, sem se afastar
    }
    if (best) return this.moveMonster(m, best[0], best[1]);
    if (blocker) {
      if (this.power(m) > this.power(blocker)) return this.monsterAttacksMonster(m, blocker);
      if (side) return this.moveMonster(m, side[0], side[1]);
      // preso há muito tempo: aceita até uma casa pior para contornar o bloqueio
      m.stuck = (m.stuck || 0) + 1;
      if (m.stuck > 3) for (const [dx, dy] of dirs) {
        const nx = m.x + dx, ny = m.y + dy, v = this.flowAt(nx, ny);
        if (v >= 0 && v <= cur + 1 && this.canEnter(nx, ny, m)) { m.stuck = 0; return this.moveMonster(m, nx, ny); }
      }
    }
  },

  moveMonster(m, x, y) {
    m.stuck = 0;
    this.openDoor(x, y);
    this.occ.delete(key(m.x, m.y)); this.occ.set(key(x, y), m);
    if (x !== m.x) m.spr.setFlipX(x < m.x);
    m.fromX = m.px; m.fromY = m.py; m.x = x; m.y = y;
    m.moveLen = m.data.step * 0.9; m.moveT = m.moveLen;
  },

  // monstro mais forte golpeia o mais fraco que está no caminho até o herói
  monsterAttacksMonster(m, o) {
    if (m.atkT > 0) return;
    m.atkT = m.data.atk;
    const len = Math.hypot(o.x - m.x, o.y - m.y) || 1;
    m.lunge = { x: (o.x - m.x) / len * 7, y: (o.y - m.y) / len * 7 };
    this.monsterSwing(m);
    if (o.x !== m.x) m.spr.setFlipX(o.x < m.x);
    const dmg = m.dmg * Phaser.Math.FloatBetween(0.85, 1.15);
    o.hp -= dmg; o.flash = 1; o.awake = true;
    this.floatText(o.px, o.py - 50, String(Math.round(dmg)), "#c08080");
    if (o.hp <= 0) this.monsterDied(o, true);
  },


  // corpo no chão. Enquanto não há arte de corpo (corpse_<monstro>), usa o próprio sprite deitado e escurecido
  makeCorpse(m, loot) {
    const ttl = loot ? 40 : 5, k = key(m.x, m.y), cx = m.x, cy = m.y;
    if (m.spr.anims) m.spr.anims.stop();
    m.shadow.destroy(); m.bar.destroy();
    if (m.dieKey && m.spr.anims) {
      // morte animada: o último quadro fica como corpo
      m.spr.setAngle(0).clearTint().setAlpha(1).setDepth(m.py - 30);
      m.spr.play(m.dieKey, true);
      if (m.champion) m.spr.setTint(0xc89088);
    } else if (this.textures.exists("corpse_" + m.kind)) {
      // arte própria do corpo: sem tinta, deitado no centro da casa
      m.spr.setTexture("corpse_" + m.kind).setAngle(0).setOrigin(0.5, 0.5).setScale(1).clearTint().setAlpha(1);
      m.spr.setFlipX(Math.random() < 0.5).setDepth(m.py - 30).setPosition(m.px, m.py + 4);
    } else {
      m.spr.setAngle(m.spr.flipX ? -80 : 80).setOrigin(0.5, 0.8).setScale(0.9);
      m.spr.setTint(m.kind === "skeleton" ? 0x8a8478 : 0x6a3a34).setDepth(m.py - 30).setPosition(m.px, m.py - 6);
    }
    this.tweens.add({ targets: m.spr, alpha: 0, delay: (ttl - 1.2) * 1000, duration: 1200, onComplete: () => {
      m.spr.destroy();
      // o loot some junto com o corpo
      const pk = this.pickups.get(k);
      if (pk && pk.fromCorpse) { pk.spr.destroy(); this.pickups.delete(k); }
    } });
    const pk = this.pickups.get(k); if (pk) pk.fromCorpse = true;
  },


  drawMonsterBar(m) {
    const g = m.bar; g.clear();
    if (m.hp >= m.maxHp || m.dead) return;
    const w = m.elite ? 48 : 26, f = Phaser.Math.Clamp(m.hp / m.maxHp, 0, 1);
    const x = Math.round(m.px - w / 2), y = Math.round(m.py - m.h - (m.fly ? 22 : 6));
    const col = f > 0.6 ? 0x3fae3a : f > 0.3 ? 0xd6b23a : f > 0.1 ? 0xc2452f : 0x6e1414;
    g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, w + 2, 5);
    g.fillStyle(col, 1).fillRect(x, y, Math.max(1, w * f), 3);
    g.setDepth(100000);
  },


  damageMonster(m, amount) {
    if (m.dead) return;
    this.floatText(m.px + Phaser.Math.Between(-6, 6), m.py - 50, String(Math.round(Math.max(1, amount - (m.data.arm || 0)))), COLORS.white);
    amount = Math.max(1, amount - (m.data.arm || 0));
    m.awake = true; m.hp -= amount; m.flash = 1;
    if (m.hp <= 0) this.monsterDied(m);
  },


  // morte: o corpo fica no chão. Com loot em cima dura 40 s; sem loot, 5 s (depois some com o que sobrou)
  monsterDied(m, byMonster = false) {
    m.dead = true; m.bar.clear();
    this.splat(m.px, m.py - 4, m.elite ? 26 : 12, m.kind === "slime" ? 0x2f5a1c : 0x5a0a0a);
    this.occ.delete(key(m.x, m.y));
    this.monsters = this.monsters.filter(o => o !== m);
    let loot = false;
    if (!byMonster) {
      this.kills++; this.killsByType[m.kind] = (this.killsByType[m.kind] || 0) + 1;
      this.addXp(m.data.xp * (this.diff || 1) * (m.champion ? 5 : 1));
      // drop: ouro, às vezes comida ou chave (itens de equipamento entram depois)
      const before = this.pickups.size;
      if (Math.random() < 0.6 || m.elite || m.champion) this.drop(m.x, m.y, "gold");
      if (Math.random() < 0.12) this.drop(m.x, m.y, ["apple", "bread", "meat"][Phaser.Math.Between(0, 2)]);
      if (Math.random() < 0.06) this.drop(m.x, m.y, "bronze_key");
      loot = this.pickups.size > before;
    }
    this.makeCorpse(m, loot);
    if (m.elite) {
      sfx(this, "boss", 0.6);
      this.msg(`O ${m.data.name} caiu! Uma passagem se abre.`);
      this.goldRun += m.data.gold;
      this.stairs = { x: m.x, y: m.y };
      if (this.pickups.has(key(m.x, m.y))) { const pk = this.pickups.get(key(m.x, m.y)); this.pickups.delete(key(m.x, m.y)); const alt = this.freeNeighbors(m.x, m.y)[0]; pk.spr.destroy(); if (alt) this.drop(alt.x, alt.y, pk.item); }
      this.drawStairs();
    }
  },
});
