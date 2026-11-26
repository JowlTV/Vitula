// Efeitos do pixelfx (github.com/patch-gg/pixelfx, MIT), exportados como folhas em assets/fx/pfx_*.png.
// Cada folha: quadros numa grade, 30 fps, com um pivô (ponto de origem do efeito).
const PFX = {
  xcut:   { w: 164, h: 108, n: 25, piv: [44, 92] },    // Corte em X (corte duplo vermelho)
  hit:    { w: 136, h: 80,  n: 16, piv: [44, 64] },    // acerto normal
  crit:   { w: 216, h: 136, n: 28, piv: [84, 106] },   // acerto crítico
  portal: { w: 152, h: 116, n: 72, piv: [76, 106], loop: true },
  arrow:  { w: 112, h: 32,  n: 18, piv: [92, 16], loop: true },   // flecha do ataque básico do arqueiro
};
const PFX_SC = 2;   // o boneco de referência do pixelfx tem 38 px; o herói tem ~74 px na tela
function loadPfx(scene) {
  for (const [k, d] of Object.entries(PFX)) scene.load.spritesheet("pfx_" + k, `assets/fx/pfx_${k}.png`, { frameWidth: d.w, frameHeight: d.h });
}
function makePfxAnims(scene) {
  for (const [k, d] of Object.entries(PFX)) {
    const key = "pfx_" + k; if (!scene.textures.exists(key) || scene.anims.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: d.n - 1 }), frameRate: 30, repeat: d.loop ? -1 : 0 });
  }
}
// toca um efeito no mundo; devolve o sprite (null se a folha não carregou)
function playPfx(scene, k, x, y, o = {}) {
  const d = PFX[k], key = "pfx_" + k; if (!d || !scene.anims.exists(key)) return null;
  const s = scene.add.sprite(x, y, key, 0).setOrigin(d.piv[0] / d.w, d.piv[1] / d.h).setScale(PFX_SC * (o.scale || 1))
    .setDepth(o.depth != null ? o.depth : 100000).setFlipX(!!o.flip);
  if (o.rot) s.setRotation(o.rot);
  if (o.alpha != null) s.setAlpha(o.alpha);
  if (scene.ents && o.ents !== false) scene.ents.add(s);
  s.play(key); if (!d.loop) s.once("animationcomplete", () => s.destroy());
  return s;
}
