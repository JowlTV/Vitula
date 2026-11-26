// Karhyn: tutorial de cada estabelecimento (na primeira entrada, um resumo do que dá para fazer ali)
// e a estátua da Oráculo: não se conversa mais com ela — ao passar na frente, ouve-se a harpa e a imagem dela aparece por 3 s.
const NPC_TUT = ["smith", "inn", "potions", "depot", "locker", "board", "lodging"];
{
  const use = TownScene.prototype.use;
  TownScene.prototype.use = function (z) {
    if (z.kind === "hall") return this.harpPass();
    const seen = (Save.data.npcTut ||= {});
    if (NPC_TUT.includes(z.kind) && !seen[z.kind]) {
      seen[z.kind] = true; Save.save();
      if (z.kind !== "board") this.showInterior(z.kind);
      this.say(t("npct_title_" + z.kind), t("npct_" + z.kind), [[t("npct_ok"), () => { this.closeDialog(); use.call(this, z); }]]);
      return;
    }
    return use.call(this, z);
  };
  const cr = TownScene.prototype.create;
  TownScene.prototype.create = function (...a) { this._harpT = null; return cr.apply(this, a); };
}
TownScene.prototype.harpPass = function () {
  
  const d = Save.voc(this.vocId);
  if (!d.firstBoss) return;                     // a estátua só desperta depois do primeiro chefe
  const first = !d.oracleSeen;
  if (first) { d.oracleSeen = true; Save.save(); sfx(this, "levelup", 0.25); return this.harpFirst(); }
  // depois da visão: a Oráculo oferece redistribuir os talentos
  this.say(t("zone_oracle"), t("oracle_after"), [[t("talent_respec_opt"), () => { this.closeDialog(); this.openTalentRespec(); }], [t("leave"), () => this.closeDialog()]]);
  // (nov/26) a visão curta das passagens seguintes foi removida: só a primeira, em tela cheia
};

// primeira passagem: o herói para, a Deusa cobre a tela inteira e ele diz a frase; depois segue
TownScene.prototype.harpFirst = function () {
  const key = this.textures.exists("vk_goddess_art") ? "vk_goddess_art" : "altar_oraculo";
  const c = this.add.container(0, 0).setAlpha(0).setDepth(60); this.uiLayer.add(c); this.dialog = c;   // dialog: trava o movimento
  c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x050406, 1).setOrigin(0).setInteractive());
  const img = this.add.image(VIEW_W / 2, VIEW_H / 2, key); img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const fit = Math.max(VIEW_W / img.width, VIEW_H / img.height); img.setScale(fit); c.add(img);
  const glow = this.add.image(VIEW_W / 2, VIEW_H * 0.35, "light").setScale(3, 3.4).setTint(0xffe2a0).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD); c.add(glow);
  const tx = this.add.text(VIEW_W / 2, VIEW_H - 70, t("harp_first"), { fontFamily: FONT_TITLE, fontSize: "18px", color: "#f0d888", align: "center", stroke: "#0c0608", strokeThickness: 6, resolution: 2 }).setOrigin(0.5).setAlpha(0);
  c.add(tx);
  this.tweens.add({ targets: c, alpha: 1, duration: 600 });
  this.tweens.add({ targets: img, scale: fit * 1.08, duration: 4500, ease: "Sine.inOut" });
  this.tweens.add({ targets: tx, alpha: 1, delay: 700, duration: 700 });
  this.tweens.add({ targets: c, alpha: 0, delay: 4000, duration: 600, onComplete: () => { c.destroy(); if (this.dialog === c) this.dialog = null; } });
};
