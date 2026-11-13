// Mochila na cidade e Retorno (recall): todas as vocações podem voltar a Karhyn a qualquer momento.
// Carrega por 5 s (cancela se andar), tem recarga de 1 min (salva no jogo) e chega ao pé da estátua da deusa.
const RECALL_SPOT = [39, 8];          // na frente da estátua da deusa
const RECALL_CHANNEL = 5, RECALL_CD = 60;

function recallAnims(scene) {
  if (!scene.textures.exists("fx_recall")) return false;
  if (!scene.anims.exists("recall_go")) {
    scene.anims.create({ key: "recall_go", frames: scene.anims.generateFrameNumbers("fx_recall", { start: 0, end: 7 }), frameRate: 9, repeat: -1 });
    scene.anims.create({ key: "recall_arrive", frames: scene.anims.generateFrameNumbers("fx_recall", { start: 7, end: 0 }), frameRate: 10, repeat: 0 });
  }
  return true;
}
function recallLeft() { return Math.max(0, Math.ceil(((Save.data.recallAt || 0) - Date.now()) / 1000)); }

// ---------------------------------------------------------------- masmorra: carregar o retorno
Object.assign(DungeonScene.prototype, {
  startRecall() {
    const h = this.hero;
    if (!h || h.dead || this.finished || this.paused || this.bagOpen) return;
    if (this.recalling) { this.cancelRecall(t("recall_cancel")); return; }   // apertar de novo cancela
    const left = recallLeft();
    if (left > 0) { this.msg(t("recall_cd", { n: left })); return; }
    const r = this.recalling = { t: RECALL_CHANNEL, x: h.x, y: h.y };
    if (recallAnims(this)) {
      r.spr = this.add.sprite(h.px, h.py + 6, "fx_recall").setOrigin(0.5, 1).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).play("recall_go");
      this.ents.add(r.spr);
    }
    r.txt = txt(this, h.px, h.py - 96, String(RECALL_CHANNEL), 16, "#cfe6ff").setOrigin(0.5).setDepth(200001);
    this.ents.add(r.txt);
    this.msg(t("recall_start"));
    if (this.sound.get && this.cache.audio.exists("sfx_heal")) this.sound.play("sfx_heal", { volume: 0.4 * (Settings.data.sfx ?? 0.8) });
  },
  cancelRecall(why) {
    const r = this.recalling; if (!r) return;
    if (r.spr) r.spr.destroy(); if (r.txt) r.txt.destroy();
    this.recalling = null;
    if (why) this.msg(why);
  },
  recallTick(dt) {
    const r = this.recalling, h = this.hero; if (!r) return;
    if (h.dead || this.finished) { this.cancelRecall(); return; }
    if (h.x !== r.x || h.y !== r.y || h.moveT > 0) { this.cancelRecall(t("recall_moved")); return; }
    if (this.paused || this.bagOpen) return;
    r.t -= dt;
    if (r.spr) r.spr.setPosition(h.px, h.py + 6).setDepth(h.py + 2);
    r.txt.setPosition(h.px, h.py - 96).setText(String(Math.max(1, Math.ceil(r.t))));
    if (r.t > 0) return;
    // chegou a hora: some no pilar de luz e vai para a cidade (guarda ouro e abates como na corda)
    this.cancelRecall();
    this.finished = true;
    Save.data.recallAt = Date.now() + RECALL_CD * 1000;
    const earned = Math.round(this.goldRun * this.stats.greed);
    Save.addGold(this.vocId, earned); Save.addKills(this.killsByType); Save.data.runs++; Save.save();
    this.registry.set("townSpawn", "recall");
    if (h.spr) this.tweens.add({ targets: h.spr, alpha: 0, duration: 350 });
    this.cameras.main.flash(250, 200, 225, 255);
    this.time.delayedCall(260, () => {
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("town"));
    });
  },
});
{ // o loop da masmorra ganha o tique do retorno, e a tecla H passa a funcionar
  const upd = DungeonScene.prototype.update;
  DungeonScene.prototype.update = function (time, dtMs) {
    upd.call(this, time, dtMs);
    if (this.recalling) this.recallTick(Math.min(0.05, dtMs / 1000));
  };
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) {
    this.recalling = null;
    cr.apply(this, a);
    (this.keysIn.recall || []).forEach(k => k.on("down", () => this.startRecall()));
  };
}

// ---------------------------------------------------------------- cidade: mochila e chegada
for (const n of ["toggleBag", "buildBag", "refreshPotionIcons", "computeStats", "maxDamage", "baseDamage", "attr", "attrFree", "critChance", "critMult",
  "swordEff", "shieldLvl", "mlEff", "defenseValue", "blockChance", "attacksPerSec", "buffOn", "xpNext", "promo", "equipItem", "unequipSlot", "restat",
  "arrowType", "arrowLabel"])
  if (DungeonScene.prototype[n] && !Object.prototype.hasOwnProperty.call(TownScene.prototype, n)) TownScene.prototype[n] = DungeonScene.prototype[n];

Object.assign(TownScene.prototype, {
  // a mochila usa os mesmos números da masmorra: monta status e herói com o nível salvo
  townBagSetup() {
    this.ranged = VOCATIONS[this.vocId].ranged || 0;
    this.bagOpen = false; this.bagBox = null; this.slotIcons = null; this.finished = false; this.paused = false; this.attrBox = null; this.goldRun = 0; this.keys = 0;
    this.stats = this.computeStats();
    const h = this.hero, d = Save.voc(this.vocId), L = Save.levelInfo(d.xpTotal || 0);
    h.level = L.level; h.xp = L.xp; h.maxHp = this.stats.maxHp + 10 * (L.level - 1); h.hp = h.maxHp; h.buffs = {};
    h.promoted = !!d.promoted; h.fury = this.furyMax || 0;
    this.townMsg = txt(this, VIEW_W / 2, VIEW_H - 104, "", 15, COLORS.gold).setOrigin(0.5).setAlpha(0);
    this.uiLayer.add(this.townMsg);
  },
  msg(s) {
    if (!this.townMsg) return;
    this.tweens.killTweensOf(this.townMsg);
    this.townMsg.setText(s).setAlpha(1);
    this.tweens.add({ targets: this.townMsg, alpha: 0, delay: 2600, duration: 700 });
  },
  floatText(x, y, s, color) {
    const o = txt(this, x, y, s, 14, color).setOrigin(0.5).setDepth(200000); this.world.add(o);
    this.tweens.add({ targets: o, y: y - 22, alpha: 0, duration: 900, onComplete: () => o.destroy() });
  },
  townToggleBag() {
    if (this.leaving || this.arriving || (this.dialog && !this.bagOpen)) return;
    this.toggleBag();
  },
  // chegada pelo retorno: o pilar de luz desce e o herói aparece dentro dele
  recallArrive() {
    const h = this.hero; this.arriving = true;
    h.spr.setAlpha(0); h.shadow.setAlpha(0);
    const done = () => { this.arriving = false; h.spr.setAlpha(1); h.shadow.setAlpha(1); };
    if (!recallAnims(this)) { done(); return; }
    const fx = this.add.sprite(h.px, h.py + 6, "fx_recall").setOrigin(0.5, 1).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(h.py + 2);
    this.world.add(fx);
    fx.play("recall_arrive");
    this.time.delayedCall(330, () => this.tweens.add({ targets: [h.spr, h.shadow], alpha: 1, duration: 420 }));
    fx.once("animationcomplete", () => { fx.destroy(); done(); });
    this.time.delayedCall(1600, () => { if (fx.active) fx.destroy(); done(); });   // segurança
  },
});
{
  const cr = TownScene.prototype.create;
  TownScene.prototype.create = function (...a) {
    this.arriving = false;
    cr.apply(this, a);
    this.townBagSetup();
    (this.keysIn.bag || []).forEach(k => k.on("down", () => this.townToggleBag()));
    (this.keysIn.recall || []).forEach(k => k.on("down", () => this.msg(t("recall_in_town"))));
    if (this.registry.get("townSpawn") === "recall") { this.registry.set("townSpawn", "gate"); this.recallArrive(); }
  };
}
