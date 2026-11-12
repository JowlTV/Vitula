// Cenas de apoio: carregamento e tela de título.
const ART = ["barrel", "chest_closed", "chest_open", "crate_damaged", "crate_intact", "floor", "gas_vent", "i_apple", "i_blue_gem", "i_bread", "i_bronze_key", "i_gold_coin",
  "i_golden_key", "i_health_potion", "i_mana_potion", "i_meat", "i_red_gem", "i_scroll", "i_shield", "i_silver_coin",
  "i_spell_book", "i_sword", "i_torch", "pillar",
  "pot", "pressure_plate", "stairs", "spikes_extended", "spikes_retracted", "torch_stand", "urn", "wall_face"];
const DECOR = ["bones", "manhole", "rat_nest", "sludge", "grate", "pool", "skeleton", "crate_pile"];
const SFX = ["boss", "break", "chest", "explode", "gem", "hit", "hurt", "levelup", "pickup"];

// Grenze Gotisch: títulos, cidades, nomes e destaques (size >= 20 ou opts.title); Bulletin: o resto.
const FONT_TITLE = "\"Grenze Gotisch\", Bulletin, Pixelify", FONT_TEXT = "Bulletin, Pixelify";
function txt(scene, x, y, s, size = 16, color = COLORS.text, opts = {}) {
  const title = opts.title !== undefined ? opts.title : size >= 20; opts = Object.assign({}, opts); delete opts.title;
  return scene.add.text(x, y, s, Object.assign({
    fontFamily: title ? FONT_TITLE : FONT_TEXT, fontSize: size + "px", color, stroke: "#0c0608", strokeThickness: Math.max(3, size / 4),
    resolution: 2,
  }, opts));
}

function sfx(scene, name, volume = 0.5) {
  try { if (scene.cache.audio.exists(name)) scene.sound.play(name, { volume: volume * Settings.data.sfx, detune: Phaser.Math.Between(-150, 150) }); } catch (e) {}
}

class BootScene extends Phaser.Scene {
  constructor() { super("boot"); }
  preload() {
    zoom2(this.cameras.main);
    const bar = this.add.rectangle(VIEW_W / 2 - 150, VIEW_H / 2, 0, 6, 0xe0bc60).setOrigin(0, 0.5);
    this.load.on("progress", p => bar.width = 300 * p);
    for (const a of ART) this.load.image(a, `assets/art/${a}.png`);
    for (const d of DECOR) this.load.image("decor_" + d, `assets/decor/decor_${d}.png`);
    // cavaleiro novo: quadros de 192 px, desenhado em 1/3 (mesmo tamanho do antigo de 64 px)
    for (const a of ["idle", "walk", "attack"]) for (const d of ["down", "up", "side"]) this.load.spritesheet(`kn_${a}_${d}`, `assets/art/kn_${a}_${d}.png`, { frameWidth: 192, frameHeight: 192 });
    for (const f of TOWN_FILES.concat(TOWN_ART)) this.load.image(f, `assets/town/${f}.png`);
    this.load.image("rope_v2", "assets/art/rope_v2.png");
    this.load.image("altar_oraculo", "assets/art/altar_oraculo.png");
    const loadedMon = new Set(); for (const k in MON_ANIM) { const [fw, w, a, d] = MON_ANIM[k]; for (const n of [w, a, d]) if (!["am_cave_rat", "am_giant_rat"].includes(n) && !loadedMon.has(n) && loadedMon.add(n)) this.load.spritesheet(n, `assets/art/${n}.png`, { frameWidth: fw, frameHeight: fw }); }
    for (const n of ["kn_hurt", "kn_cast"]) this.load.spritesheet(n, `assets/art/${n}.png`, { frameWidth: 200, frameHeight: 200 });
    for (const n of ["npc_smith_idle", "npc_potion_seller_idle", "npc_depot_guard_idle"]) this.load.spritesheet(n, `assets/town/${n}.png`, { frameWidth: 200, frameHeight: 200 });
    this.load.spritesheet("fx_basic_slash", "assets/art/fx_basic_slash.png", { frameWidth: 72, frameHeight: 72 });
    for (const id of EQUIP_ART) this.load.image("eq_" + id, `assets/equip/${id}.png`);
    this.load.spritesheet("fx_ring_wave", "assets/art/fx_ring_wave.png", { frameWidth: 214, frameHeight: 214 });
    this.load.spritesheet("fx_front_cut", "assets/art/fx_front_cut.png", { frameWidth: 230, frameHeight: 230 });
    // Karhyn nova (guia de estilo aprovado): prédios, objetos e autotiles de chão
    // a arquitetura de Karhyn é desenhada em código (towngfx.js); da arte gerada só fica o lampião
    this.load.image("k2_lamp", "assets/town2/k2_lamp.png");
    for (const n of ["vk_ts_piso", "vk_ts_muro", "vk_ts_calcada", "vk_ts_grama", "vk_mural", "vk_goddess_art", "vk_ferreiro", "vk_harpa_dancante", "vk_pocoes", "vk_depot", "vk_acomodacao", "vk_portao_lateral", "vk_casebre_1", "vk_casebre_2", "vk_casebre_3", "vk_bueiro", "vk_int_ferreiro", "vk_int_harpa", "vk_int_pocoes", "vk_int_depot", "vk_int_acomodacao",
      ...["barrel", "crate", "garbage", "cart", "laundry", "bench", "firewood", "wheel"].map(n => "vkp_" + n)]) this.load.image(n, `assets/town2/${n}.png`);   // tilesets da vila (SpriteCook, 32 px)
    this.load.image("tower_view", "assets/town/tower_view.png"); this.load.image("depot_counter", "assets/town/depot_counter.png");
    this.load.image("glow_mushrooms", "assets/art/glow_mushrooms.png");
    this.load.spritesheet("kn_death", "assets/art/kn_death.png", { frameWidth: 192, frameHeight: 192 });
    // Arqueiro: quadros de 200 px (os de costas, 198)
    for (const a of ["idle", "walk", "attack"]) for (const d of ["down", "up", "side"]) { const f = d === "up" ? 198 : 200; this.load.spritesheet(`ar_${a}_${d}`, `assets/art/ar_${a}_${d}.png`, { frameWidth: f, frameHeight: f }); }
    for (const n of ["ar_hurt", "ar_cast", "ar_death"]) this.load.spritesheet(n, `assets/art/${n}.png`, { frameWidth: 200, frameHeight: 200 });
    for (const [m, fw, fh] of [["rat", 40, 19], ["bat", 48, 24], ["slime", 34, 38], ["skeleton", 48, 60]]) this.load.spritesheet("am_" + m, `assets/art/am_${m}.png`, { frameWidth: fw, frameHeight: fh });
    this.load.spritesheet("am_cave_rat", "assets/art/am_cave_rat.png", { frameWidth: 72, frameHeight: 72 });
    this.load.spritesheet("am_giant_rat", "assets/art/am_giant_rat.png", { frameWidth: 108, frameHeight: 108 });
    // paredes (nome com versão para o navegador não usar cópia antiga em cache)
    this.load.image("wall_front", "assets/art/wall_front_v3.png");
    for (const k of ["cave_wall_front", "cave_rock_top", "cave_floor_moss", "cave_floor_red", "cave_water", "cave_shore", "cave_rocks"]) this.load.image(k, `assets/art/${k}.png`);
    this.load.image("wall_top", "assets/art/wall_top_v3.png");
    this.load.image("water_channel", "assets/art/water_channel.png");
    this.load.image("wall_drain", "assets/art/wall_drain.png");
    this.load.spritesheet("brazier", "assets/decor/brazier.png", { frameWidth: 56, frameHeight: 56 });
    for (const f of ["slash", "heal", "explosion"]) this.load.spritesheet("fx_" + f, `assets/fx/${f}.png`, { frameWidth: 96, frameHeight: 96 });
    this.load.image("fx_crescent", "assets/fx/crescent.png");
    this.load.spritesheet("fx_aura", "assets/fx/aura.png", { frameWidth: 144, frameHeight: 144 });
    for (const i of ["slash", "slash_evo", "berserk", "spear", "heal", "aura"]) this.load.image("icon_" + i, `assets/icons/${i}.png`);
    for (const i of ["basic", "front_v2", "exura", "area", "aura_v2"]) this.load.image("icon_" + i, `assets/icons/icon_${i}.png`);
    for (const c of ["rat", "cave_rat", "bat", "slime", "skeleton", "giant_rat"]) this.load.image("corpse_" + c, `assets/art/corpse_${c}.png`);
    for (const u of ["logo_vitula", "bar_track", "bar_fill_boss", "bar_fill_xp", "heart", "slot", "panel", "button_normal", "button_hover", "title_banner", "portrait_knight", "portrait_archer", "portrait_sorcerer", "portrait_druid", "map_karhyn_2x", "card_normal", "card_selected", "name_plate", "marker_open", "marker_locked", "marker_cleared"])
      this.load.image(u, `assets/ui/${u}.png`);
    for (const s of SFX) this.load.audio(s, `assets/audio/${s}.wav`);
    this.load.audio("music_goddess", "assets/audio/before_the_shadow_falls.mp3");
  }
  create() {
    makeEquipTextures(this);   // ícones dos equipamentos, desenhados em código
    this.makeRadial("light", 256, [[0, 1], [0.35, 0.6], [1, 0]]);
    this.makeRadial("shadow", 64, [[0, 0.82], [0.5, 0.68], [0.78, 0.32], [1, 0]], 0x000000);
    for (const d of ["down", "up", "side"]) {
      this.anims.create({ key: "kn_idle_" + d, frames: this.anims.generateFrameNumbers("kn_idle_" + d, { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
      // de lado: os quadros 2 e 3 vieram com a capa e o escudo cortados na geração; ficam de fora
      this.anims.create({ key: "kn_walk_" + d, frames: this.anims.generateFrameNumbers("kn_walk_" + d, d === "side" ? { frames: [0, 1, 4, 5, 6, 7] } : { start: 0, end: 7 }), frameRate: d === "side" ? 9 : 12, repeat: -1 });
      this.anims.create({ key: "kn_attack_" + d, frames: this.anims.generateFrameNumbers("kn_attack_" + d, { start: 0, end: 7 }), frameRate: 19, repeat: 0 });
    }
    this.anims.create({ key: "kn_death", frames: this.anims.generateFrameNumbers("kn_death", { start: 0, end: 11 }), frameRate: 9, repeat: 0 });
    for (const d of ["down", "up", "side"]) {
      this.anims.create({ key: "ar_idle_" + d, frames: this.anims.generateFrameNumbers("ar_idle_" + d, { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: "ar_walk_" + d, frames: this.anims.generateFrameNumbers("ar_walk_" + d, { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
      this.anims.create({ key: "ar_attack_" + d, frames: this.anims.generateFrameNumbers("ar_attack_" + d, { start: 0, end: 7 }), frameRate: 16, repeat: 0 });
    }
    this.anims.create({ key: "ar_death", frames: this.anims.generateFrameNumbers("ar_death", { start: 0, end: 11 }), frameRate: 9, repeat: 0 });
    for (const n of ["ar_hurt", "ar_cast"]) this.anims.create({ key: n, frames: this.anims.generateFrameNumbers(n, { start: 0, end: 7 }), frameRate: 18, repeat: 0 });
    // flecha (desenhada em código): haste de madeira, ponta de ferro, penas claras
    if (!this.textures.exists("arrow")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x6a4a2a).fillRect(4, 2, 22, 2);
      g.fillStyle(0xc8c8d0).fillTriangle(26, 0, 32, 3, 26, 6);
      g.fillStyle(0xe8dcc0).fillTriangle(0, 0, 7, 3, 0, 6);
      g.generateTexture("arrow", 32, 6); g.destroy();
    }
    for (const m of ["rat", "bat", "slime", "skeleton"])
      this.anims.create({ key: "am_" + m, frames: this.anims.generateFrameNumbers("am_" + m, { start: 0, end: 5 }), frameRate: m === "bat" ? 12 : 9, repeat: -1 });
    for (const k in MON_ANIM) {
      const [, w, a, d] = MON_ANIM[k];
      if (this.textures.exists(w) && !this.anims.exists(w)) this.anims.create({ key: w, frames: this.anims.generateFrameNumbers(w, { start: 0, end: 7 }), frameRate: k === "bat" ? 12 : 10, repeat: -1 });
      if (!this.textures.exists(w) || this.anims.exists(a)) continue;   // arte ausente ou já criada (aranhas dividem a arte)
      this.anims.create({ key: a, frames: this.anims.generateFrameNumbers(a, { start: 0, end: 7 }), frameRate: 16, repeat: 0 });
      this.anims.create({ key: d, frames: this.anims.generateFrameNumbers(d, { start: 0, end: 7 }), frameRate: 11, repeat: 0 });
    }
    for (const n of ["kn_hurt", "kn_cast"]) this.anims.create({ key: n, frames: this.anims.generateFrameNumbers(n, { start: 0, end: 7 }), frameRate: 18, repeat: 0 });
    for (const n of ["npc_smith_idle", "npc_potion_seller_idle", "npc_depot_guard_idle"]) this.anims.create({ key: n, frames: this.anims.generateFrameNumbers(n, { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: "fx_basic_slash", frames: this.anims.generateFrameNumbers("fx_basic_slash", { start: 0, end: 3 }), frameRate: 18, repeat: 0 });
    this.anims.create({ key: "fx_ring_wave", frames: this.anims.generateFrameNumbers("fx_ring_wave", { start: 0, end: 5 }), frameRate: 11, repeat: 0 });
    this.anims.create({ key: "fx_front_cut", frames: this.anims.generateFrameNumbers("fx_front_cut", { start: 0, end: 6 }), frameRate: 20, repeat: 0 });
    for (const m of ["cave_rat", "giant_rat"]) if (!this.anims.exists("am_" + m))
      this.anims.create({ key: "am_" + m, frames: this.anims.generateFrameNumbers("am_" + m, { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "brazier_burn", frames: this.anims.generateFrameNumbers("brazier", { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "fx_aura_loop", frames: this.anims.generateFrameNumbers("fx_aura", { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
    for (const f of ["slash", "heal", "explosion"]) {
      const n = this.textures.get("fx_" + f).frameTotal - 1;
      this.anims.create({ key: "fx_" + f, frames: this.anims.generateFrameNumbers("fx_" + f, { start: 0, end: n - 1 }), frameRate: 18 });
    }
    Promise.all(["20px \"Grenze Gotisch\"", "16px Bulletin", "16px Pixelify"].map(f => document.fonts.load(f).catch(() => 0))).then(() => document.fonts.ready).then(() => { const q = new URLSearchParams(location.search); if (q.get("voc") && VOCATIONS[q.get("voc")]) this.registry.set("vocation", q.get("voc")); this.scene.start(q.has("intro") ? "intro" : q.has("town") ? "town" : q.has("play") ? "dungeon" : "title"); });
  }
  makeRadial(key, size, stops, color = 0xffffff) {
    const c = this.textures.createCanvas(key, size, size);
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const rgb = `${(color >> 16) & 255},${(color >> 8) & 255},${color & 255}`;
    for (const [o, a] of stops) g.addColorStop(o, `rgba(${rgb},${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); c.refresh();
  }
}

function button(scene, x, y, w, label, fn, size = 16) {
  const b = scene.add.nineslice(x, y, "button_normal", null, w, 40, 18, 18, 6, 6).setInteractive({ useHandCursor: true });
  const t = txt(scene, x, y, label, size, COLORS.text).setOrigin(0.5);
  b.on("pointerover", () => b.setTexture("button_hover"));
  b.on("pointerout", () => b.setTexture("button_normal"));
  b.on("pointerup", fn);
  return [b, t];
}

function menuMusic(scene) { goddessMusic(scene, false); }

// "Before the Shadow Falls": limpa na intro e nos menus; na cidade, distante e com eco,
// como se a Oráculo tocasse ao longe. Uma única faixa que não recomeça ao trocar de cena.
function goddessMusic(scene, echo) {
  if (scene.sound.locked) { scene.sound.once("unlocked", () => goddessMusic(scene, echo)); return; }
  if (!scene.cache.audio.exists("music_goddess")) return;
  const m = scene.sound.get("music_goddess") || scene.sound.add("music_goddess", { loop: true, volume: 0.6 * Settings.data.music });
  const ctx = scene.sound.context;
  // monta a cadeia de eco uma vez (só no Web Audio): saída do volume → seco + (passa-baixa → atraso com repetição)
  if (ctx && !m.echoFx && m.volumeNode) {
    try {
      const out = m.pannerNode || m.volumeNode, dest = scene.sound.destination;
      out.disconnect();
      const dry = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter(), delay = ctx.createDelay(2), fb = ctx.createGain();
      lp.type = "lowpass"; delay.delayTime.value = 0.42; fb.gain.value = 0.45;
      out.connect(dry); dry.connect(dest);
      out.connect(lp); lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(dest);
      m.echoFx = { dry, wet, lp };
    } catch (e) { m.echoFx = null; }
  }
  const fx = m.echoFx, t = ctx ? ctx.currentTime : 0;
  if (fx) {
    fx.dry.gain.setTargetAtTime(echo ? 0.3 : 1, t, 0.4);
    fx.wet.gain.setTargetAtTime(echo ? 0.75 : 0, t, 0.4);
    fx.lp.frequency.setTargetAtTime(echo ? 1100 : 18000, t, 0.4);
  }
  m.setVolume((echo ? 0.5 : 0.6) * Settings.data.music);
  if (!m.isPlaying) m.play();
}

// para todos os sons menos a música da deusa (ela continua de onde estava)
function stopAllButMusic(scene) {
  for (const s of scene.sound.getAllPlaying ? scene.sound.getAllPlaying() : []) if (s.key !== "music_goddess") s.stop();
}

function menuBackground(scene) {
  scene.anims.globalTimeScale = 1;
  zoom2(scene.cameras.main);
  scene.cameras.main.setBackgroundColor("#0b0a0e");
  for (let y = 0; y < VIEW_H; y += T) for (let x = 0; x < VIEW_W; x += T)
    scene.add.image(x, y, "floor").setOrigin(0).setTint(0x3a3842).setAlpha(0.45);
}

class TitleScene extends Phaser.Scene {
  constructor() { super("title"); }
  create() {
    menuBackground(this);
    const logo = this.add.image(VIEW_W / 2, 175, "logo_vitula");
    logo.setScale(Math.min(1.5, 560 / logo.width));
    this.tweens.add({ targets: logo, y: 168, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    button(this, VIEW_W / 2, 340, 260, "Iniciar", () => this.scene.start("select"), 18);
    button(this, VIEW_W / 2, 392, 260, "Opções", () => this.scene.start("options"), 16);
    txt(this, VIEW_W / 2, 515, "Créditos a JowlTV", 12, COLORS.dim).setOrigin(0.5);
    this.input.once("pointerdown", () => menuMusic(this));
    this.input.keyboard.once("keydown", () => menuMusic(this));
    this.input.keyboard.on("keydown-ENTER", () => this.scene.start("select"));
    menuMusic(this);
  }
}

class OptionsScene extends Phaser.Scene {
  constructor() { super("options"); }
  create() {
    menuBackground(this);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0);
    this.add.nineslice(VIEW_W / 2, 40, "title_banner", null, 300, 44, 40, 40, 8, 8);
    txt(this, VIEW_W / 2, 40, "Opções", 30, COLORS.text).setOrigin(0.5);
    this.add.nineslice(VIEW_W / 2, 282, "panel", null, 880, 420, 16, 16, 16, 16);
    // volumes
    this.volRow(98, "Música", "music");
    this.volRow(126, "Efeitos sonoros", "sfx");
    this.speedRow(152);
    txt(this, 60, 172, "Teclas  (clique para trocar · Esc cancela)", 13, COLORS.gold);
    this.keyTexts = {};
    // duas colunas de teclas (cabem todas as ações sem passar dos botões)
    const half = Math.ceil(ACTIONS.length / 2);
    ACTIONS.forEach(([id, label], i) => {
      const col = i < half ? 0 : 1, y = 194 + (i % half) * 21, lx = col ? 490 : 60;
      txt(this, lx, y, label, 12, COLORS.text).setOrigin(0, 0.5);
      for (let slot = 0; slot < 2; slot++) {
        const x = lx + 268 + slot * 76;
        const box = this.add.rectangle(x, y, 70, 19, 0x1a1820).setStrokeStyle(1, 0x6a5a40).setInteractive({ useHandCursor: true });
        const t = txt(this, x, y, "", 10, COLORS.text, { fontFamily: "Pixelify" }).setOrigin(0.5);
        this.keyTexts[id + slot] = t;
        box.on("pointerup", () => this.listen(id, slot, t));
      }
    });
    this.refreshKeys();
    button(this, VIEW_W / 2 - 110, 456, 200, "Restaurar padrão", () => { Settings.reset(); this.scene.restart(); }, 14);
    button(this, VIEW_W / 2 + 110, 456, 200, "Voltar", () => this.back(), 14);
    this.input.keyboard.on("keydown-ESC", () => { if (!this.waiting) this.back(); });
    menuMusic(this);
  }
  back() { Settings.save(); this.scene.start("title"); }
  volRow(y, label, id) {
    txt(this, 200, y, label, 14, COLORS.text).setOrigin(0, 0.5);
    const track = this.add.rectangle(560, y, 200, 8, 0x1a1820).setStrokeStyle(1, 0x6a5a40);
    const fill = this.add.rectangle(460, y, 200 * Settings.data[id], 8, 0xd8642a).setOrigin(0, 0.5);
    const pct = txt(this, 700, y, "", 13, COLORS.gold).setOrigin(0.5);
    const set = v => {
      Settings.data[id] = Phaser.Math.Clamp(Math.round(v * 10) / 10, 0, 1);
      fill.width = 200 * Settings.data[id]; pct.setText(Math.round(Settings.data[id] * 100) + "%");
      if (id === "music") menuMusic(this); else sfx(this, "pickup", 0.6);
      Settings.save();
    };
    set(Settings.data[id]);
    const minus = txt(this, 440, y, "−", 18, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const plus = txt(this, 680, y, "+", 18, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true });
    minus.on("pointerup", () => set(Settings.data[id] - 0.1));
    plus.on("pointerup", () => set(Settings.data[id] + 0.1));
    track.setInteractive({ useHandCursor: true }).on("pointerdown", (p, lx) => set(lx / 200));
  }
  // ritmo do jogo: 50% a 100% (padrão 75%)
  speedRow(y) {
    txt(this, 200, y, "Velocidade do jogo", 14, COLORS.text).setOrigin(0, 0.5);
    const opts = [[0.5, "Muito lenta"], [0.65, "Lenta"], [0.75, "Normal"], [0.9, "Rápida"], [1.0, "Original"]];
    const t = txt(this, 560, y, "", 14, COLORS.gold).setOrigin(0.5);
    const idx = () => { let b = 0; opts.forEach((o, i) => { if (Math.abs(o[0] - Settings.data.speed) < Math.abs(opts[b][0] - Settings.data.speed)) b = i; }); return b; };
    const show = () => t.setText(`${opts[idx()][1]} (${Math.round(Settings.data.speed * 100)}%)`);
    const step = d => { const i = Phaser.Math.Clamp(idx() + d, 0, opts.length - 1); Settings.data.speed = opts[i][0]; Settings.save(); show(); };
    txt(this, 440, y, "<", 16, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerup", () => step(-1));
    txt(this, 680, y, ">", 16, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerup", () => step(1));
    show();
  }

  refreshKeys() {
    for (const [id] of ACTIONS) for (let s = 0; s < 2; s++) this.keyTexts[id + s].setText(Settings.data.keys[id][s] ? Settings.keyLabel(Settings.data.keys[id][s]) : "—").setColor(COLORS.text);
  }
  listen(id, slot, t) {
    if (this.waiting) return;
    this.waiting = true;
    t.setText("pressione…").setColor(COLORS.gold);
    this.input.keyboard.once("keydown", ev => {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const name = Object.keys(K).find(n => K[n] === ev.keyCode);
      if (ev.keyCode !== K.ESC && name) {
        // tira a tecla de qualquer outra ação para não ter conflito
        for (const [other] of ACTIONS) Settings.data.keys[other] = Settings.data.keys[other].map(n => n === name ? null : n);
        Settings.data.keys[id][slot] = name;
        Settings.save();
      }
      this.time.delayedCall(50, () => { this.waiting = false; this.refreshKeys(); });
    });
  }
}

class SelectScene extends Phaser.Scene {
  constructor() { super("select"); }
  create() {
    menuBackground(this);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.55).setOrigin(0);
    this.add.nineslice(VIEW_W / 2, 52, "title_banner", null, 380, 46, 40, 40, 8, 8);
    txt(this, VIEW_W / 2, 52, "Escolha sua vocação", 30, COLORS.text).setOrigin(0.5);
    const ids = Object.keys(VOCATIONS), cw = 214, gap = 14, x0 = VIEW_W / 2 - (ids.length * (cw + gap) - gap) / 2;
    ids.forEach((id, i) => {
      const v = VOCATIONS[id], x = x0 + i * (cw + gap), y = 96;
      const open = !v.soon && (v.unlockCost <= 0 || (Save.data.unlocked || []).includes(id));
      const card = this.add.nineslice(x, y, open ? "card_selected" : "card_normal", null, cw, 340, 14, 14, 14, 14).setOrigin(0);
      const port = this.add.image(x + cw / 2, y + 74, v.portrait); port.setScale(115 / Math.max(port.width, port.height));   // retratos de tamanhos diferentes saem com 115 px
      if (!open) port.setTint(0x555060);
      this.add.nineslice(x + cw / 2, y + 152, "name_plate", null, 170, 30, 14, 14, 4, 4);
      txt(this, x + cw / 2, y + 152, v.name, 24, COLORS.gold).setOrigin(0.5);
      // descrição e, logo abaixo dela (posição medida, sem sobrepor), a passiva/traço; as skills ficam na janela de Habilidades
      const d1 = txt(this, x + 16, y + 176, v.desc, 13, COLORS.text, { wordWrap: { width: cw - 32 }, lineSpacing: 2 });
      const d2 = txt(this, x + 16, d1.y + d1.height + 10, v.passive ? `Passiva — ${v.passive.name}: ${v.passive.desc}` : v.trait, 12, COLORS.dim, { wordWrap: { width: cw - 32 }, lineSpacing: 1 });
      if (d2.y + d2.height > y + 296) d2.setFontSize(11);
      if (v.soon) d2.setVisible(false);   // o rodapé já diz "Em breve"
      const foot = open ? `◉ ${Save.gold(id)} de ouro` : (v.soon ? "Em breve" : `Bloqueada · ${v.unlockCost} de ouro`);
      txt(this, x + cw / 2, y + 312, foot, 14, open ? COLORS.gold : COLORS.dim).setOrigin(0.5);
      if (open) {
        this.add.zone(x, y, cw, 340).setOrigin(0).setInteractive({ useHandCursor: true }).on("pointerup", () => { this.registry.set("vocation", id); this.scene.start("intro"); });
        this.tweens.add({ targets: card, alpha: 0.85, duration: 900, yoyo: true, repeat: -1 });
      }
    });
    button(this, VIEW_W / 2, 492, 200, "Voltar", () => this.scene.start("title"));
    this.input.keyboard.on("keydown-ESC", () => this.scene.start("title"));
    this.input.keyboard.on("keydown-ENTER", () => { this.registry.set("vocation", "knight"); this.scene.start("intro"); });
    menuMusic(this);
  }
}

// Introdução: a vista da torre sobre os arredores de Karhyn, o título e o texto subindo devagar.
// Qualquer tecla, clique ou toque pula. Ao fim, o jogo começa no portão de Karhyn, de dia.
const INTRO_TITLE = "A Queda de Karhyn";
const INTRO_TEXT = [
  "No continente de Godoyr existe uma pequena cidade chamada Karhyn.",
  "Uma cidade virtuosa, de gente carinhosa, calorosa e festeira, conhecida por sua forja, de onde saem as melhores espadas e os melhores escudos de todo o continente.",
  "Dizem que o metal usado na forja nasce do ferro minerado nas montanhas próximas à Torre das Amazonas — ferro que, à noite, é banhado pela luz da deusa.",
  "Mas Karhyn está em caos.",
  "O mal assola os seus moradores. Cresce o ódio dos monstros da escuridão, e animais que antes eram inofensivos agora atacam com uma fúria pungente.",
  "Na taverna A Harpa Dançante, os boatos correm de mesa em mesa: nos esgotos de Karhyn habita um mal tão perigoso que, se conseguir subir todos os andares e chegar à superfície...",
  "...poderá ser o nosso fim.",
].join("\n\n");
class IntroScene extends Phaser.Scene {
  constructor() { super("intro"); }
  create() {
    this.anims.globalTimeScale = 1; this.done = false;
    zoom2(this.cameras.main); this.cameras.main.setBackgroundColor("#050406");
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, "tower_view").setScale(VIEW_W / 512 * 1.06);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.tweens.add({ targets: img, x: VIEW_W / 2 - 26, y: VIEW_H / 2 - 10, scale: VIEW_W / 512 * 1.16, duration: 60000, ease: "Sine.inOut" });
    // névoa passando sobre os campos
    for (let i = 0; i < 6; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, VIEW_W), Phaser.Math.Between(120, VIEW_H - 120), "light").setScale(3.2, 0.9).setTint(0xc8d0d8).setAlpha(0.06);
      this.tweens.add({ targets: f, x: f.x + VIEW_W + 400, duration: Phaser.Math.Between(26000, 42000), repeat: -1, onRepeat: () => { f.x = -400; } });
    }
    // véu escuro para o texto ler bem (mais fechado embaixo, onde ele nasce)
    const veil = this.add.graphics();
    veil.fillStyle(0x050406, 0.42).fillRect(0, 0, VIEW_W, VIEW_H);
    veil.fillGradientStyle(0x050406, 0x050406, 0x050406, 0x050406, 0, 0, 0.9, 0.9).fillRect(0, VIEW_H - 150, VIEW_W, 150);
    // título dramático
    const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 20, INTRO_TITLE, { fontFamily: FONT_TITLE, fontSize: "64px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 8, resolution: 2 })
      .setOrigin(0.5).setAlpha(0).setShadow(0, 4, "#000000", 8, true, true);
    const rule = this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 26, 360, 2, 0x8e2a2c).setAlpha(0).setScale(0, 1);
    this.tweens.add({ targets: title, alpha: 1, y: VIEW_H / 2 - 30, duration: 2200, ease: "Sine.out" });
    this.tweens.add({ targets: rule, alpha: 1, scaleX: 1, duration: 2200, delay: 600, ease: "Sine.out" });
    this.tweens.add({ targets: [title, rule], alpha: 0, delay: 5200, duration: 1600 });
    // texto em perspectiva, como a abertura de Star Wars: nasce grande embaixo, sobe devagar e some pequeno no horizonte.
    // O texto é desenhado uma vez (invisível) e redesenhado a cada quadro em faixas, cada uma mais estreita que a de baixo.
    const src = this.add.text(0, 0, INTRO_TEXT, { fontFamily: FONT_TITLE, fontSize: "30px", color: "#f0d878", stroke: "#0c0608", strokeThickness: 5, resolution: 2,
      align: "center", wordWrap: { width: 600 }, lineSpacing: 12, padding: { x: 8, y: 8 } }).setVisible(false);
    if (this.textures.exists("intro_crawl")) this.textures.remove("intro_crawl");
    const CW = VIEW_W * 2, CH = VIEW_H * 2, tex = this.textures.createCanvas("intro_crawl", CW, CH);
    this.add.image(0, 0, "intro_crawl").setOrigin(0).setScale(0.5);
    this.crawl = { src: src.canvas, tex, ctx: tex.getContext(), scroll: -9999, CW, CH, started: false,
      horizon: CH * 0.16, top: CH * 0.30, depth: 520, speed: 46 };   // medidas em pixels do canvas (2× a tela)
    this.time.delayedCall(5600, () => { this.crawl.scroll = 0; this.crawl.started = true; });
    const skip = txt(this, VIEW_W - 16, VIEW_H - 14, "Enter, clique ou toque: pular", 11, COLORS.dim).setOrigin(1, 1).setAlpha(0);
    this.tweens.add({ targets: skip, alpha: 0.9, delay: 1500, duration: 800 });
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    // só aceita pular depois de um instante (o clique que escolheu a vocação não conta)
    this.time.delayedCall(600, () => { this.input.keyboard.on("keydown", () => this.finish()); this.input.on("pointerup", () => this.finish()); });
    menuMusic(this);
  }
  update(_, dtMs) {
    const c = this.crawl; if (!c || !c.started) return;
    if (!this.done) c.scroll += c.speed * Math.min(0.05, dtMs / 1000);
    const g = c.ctx, sw = c.src.width, sh = c.src.height, span = c.CH - c.horizon;
    g.clearRect(0, 0, c.CW, c.CH);
    // cada faixa da tela mostra uma linha do texto: s = 1 na base (perto), menor quanto mais alto (longe)
    for (let y = c.top; y < c.CH; y += 2) {
      const sc = (y - c.horizon) / span, sy = c.scroll - c.depth * (1 / sc - 1);
      if (sy < 0 || sy >= sh) continue;
      const w = sw * sc * 1.25, hsrc = Math.max(1, 2 / sc);
      g.globalAlpha = Math.min(1, (y - c.top) / (c.CH * 0.16)) * Math.min(1, (c.CH - y) / 60);
      g.drawImage(c.src, 0, sy, sw, Math.min(hsrc, sh - sy), (c.CW - w) / 2, y, w, 2);
    }
    g.globalAlpha = 1; c.tex.refresh();
    // quando a última linha some no horizonte, o jogo começa
    if (c.scroll - c.depth * (span / (c.top - c.horizon) - 1) > sh) this.finish();
  }
  finish() {
    if (this.done) return; this.done = true;
    this.registry.set("townSpawn", "gate"); this.registry.set("townPos", null);
    this.registry.set("townClock", 0.32);   // o jogo começa de dia
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("town"));
  }
}

class MapScene extends Phaser.Scene {
  constructor() { super("map"); }
  create() {
    this.anims.globalTimeScale = 1;
    zoom2(this.cameras.main);
    this.cameras.main.setBackgroundColor("#0b0a0e");
    this.mapImg = this.add.image(VIEW_W / 2, VIEW_H / 2, "map_karhyn_2x").setScale(0.5);
    this.animateMap();
    txt(this, 14, 10, "Karhyn", 30, COLORS.gold);
    const voc = VOCATIONS[this.registry.get("vocation") || "knight"];
    txt(this, VIEW_W - 14, 14, `${voc.name} · ◉ ${Save.gold(this.registry.get("vocation") || "knight")}`, 15, COLORS.gold).setOrigin(1, 0);
    button(this, VIEW_W - 70, 62, 116, "Loja", () => this.scene.start("shop"), 15);
    const cleared = id => Object.keys(Save.data.cleared).some(k => k.startsWith(id + ":"));
    const unlocked = id => { const r = REGIONS[id]; return !r.after || cleared(r.after); };
    // painel de informação
    const px = 12, py = 330;
    this.add.nineslice(px, py, "panel", null, 380, 198, 16, 16, 16, 16).setOrigin(0);
    this.infoTitle = txt(this, px + 18, py + 14, "", 20, COLORS.gold);
    this.infoTier = txt(this, px + 18, py + 42, "", 13, "#c0504a");
    this.infoDesc = txt(this, px + 18, py + 64, "", 13, COLORS.text, { wordWrap: { width: 344 } });
    const [sb, st] = button(this, px + 120, py + 166, 200, "Descer", () => {
      if (!this.sel || !REGIONS[this.sel].playable || !unlocked(this.sel)) return;
      if (REGIONS[this.sel].town) { this.registry.set("townSpawn", "gate"); this.scene.start("town"); return; }
      this.registry.set("region", this.sel);
      this.sound.stopAll();
      this.scene.start("dungeon");
    });
    this.startBtn = [sb, st]; this.unlocked = unlocked;
    button(this, px + 300, py + 166, 120, "Voltar", () => this.scene.start("select"), 14);
    for (const id in REGIONS) {
      const r = REGIONS[id], open = unlocked(id) && r.playable;
      const mk = cleared(id) ? "marker_cleared" : (open ? "marker_open" : "marker_locked");
      const m = this.add.image(r.pos[0], r.pos[1], mk).setScale(1.6).setInteractive({ useHandCursor: true });
      const label = txt(this, r.pos[0], r.pos[1] + 26, r.name, 13, open ? COLORS.text : COLORS.dim, { title: true }).setOrigin(0.5);
      m.on("pointerup", () => this.select(id));
      label.setInteractive({ useHandCursor: true }).on("pointerup", () => this.select(id));
      if (open) this.tweens.add({ targets: m, y: r.pos[1] - 4, duration: 700, yoyo: true, repeat: -1 });
    }
    this.select("karhyn_sewers");
    this.input.keyboard.on("keydown-ESC", () => this.scene.start("select"));
    this.input.keyboard.on("keydown-ENTER", () => { this.registry.set("townSpawn", "gate"); this.scene.start("town"); });
    menuMusic(this);
  }
  // ambiente vivo: respiração lenta da câmera, neblina, fogueiras, brasas, névoa espectral e aves
  animateMap() {
    // neblina atravessando o mapa
    for (let i = 0; i < 7; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, VIEW_W), Phaser.Math.Between(40, VIEW_H - 60), "light")
        .setScale(Phaser.Math.FloatBetween(2.2, 3.6), Phaser.Math.FloatBetween(0.7, 1.1)).setTint(0xb8c0d0).setAlpha(Phaser.Math.FloatBetween(0.05, 0.11));
      const sp = Phaser.Math.Between(26000, 46000);
      this.tweens.add({ targets: f, x: f.x + VIEW_W + 500, duration: sp, repeat: -1, onRepeat: () => { f.x = -400; f.y = Phaser.Math.Between(40, VIEW_H - 60); } });
    }
    // fogueiras e brasas (cidade/esgoto e acampamento orc)
    for (const [x, y, s] of [[505, 288, 1.4], [478, 272, 0.8], [532, 300, 0.8], [348, 132, 1.2], [320, 120, 0.7], [376, 140, 0.7]]) {
      const g = this.add.image(x, y, "light").setTint(0xff8a30).setBlendMode(Phaser.BlendModes.ADD).setScale(0.25 * s).setAlpha(0.45);
      this.tweens.add({ targets: g, alpha: 0.2, scale: 0.21 * s, duration: Phaser.Math.Between(180, 320), yoyo: true, repeat: -1 });
      this.add.particles(x, y, "light", { lifespan: 1800, speedY: { min: -26, max: -12 }, speedX: { min: -6, max: 6 }, scale: { start: 0.025, end: 0 },
        alpha: { start: 0.9, end: 0 }, tint: [0xffb050, 0xff7030], blendMode: "ADD", frequency: 260 / s, quantity: 1 });
    }
    // névoa esverdeada pulsando nas Terras Espectrais e no Fosso
    for (const [x, y] of [[810, 183], [822, 381], [760, 240]]) {
      const m = this.add.image(x, y, "light").setTint(0x7fd0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.5).setAlpha(0.06);
      this.tweens.add({ targets: m, alpha: 0.16, scaleX: 1.05, duration: Phaser.Math.Between(2500, 4000), yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    // brilho no mar (canto inferior)
    this.add.particles(0, 0, "light", { x: { min: 300, max: 960 }, y: { min: 455, max: 535 }, lifespan: 1400, scale: { start: 0, end: 0.03, ease: "Sine.out" },
      alpha: { start: 0.7, end: 0 }, tint: 0xcfe4ff, blendMode: "ADD", frequency: 140 });
    // revoada ocasional de corvos
    const crow = () => {
      const y0 = Phaser.Math.Between(40, 260), dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < Phaser.Math.Between(3, 6); i++) {
        const b = this.add.text(dir > 0 ? -20 - i * 14 : VIEW_W + 20 + i * 14, y0 + Phaser.Math.Between(-10, 10), "︶", { fontSize: "10px", color: "#0d0b0e" });
        this.tweens.add({ targets: b, x: b.x + dir * (VIEW_W + 120), duration: Phaser.Math.Between(9000, 12000), onComplete: () => b.destroy() });
        this.tweens.add({ targets: b, scaleY: 0.4, duration: 220, yoyo: true, repeat: -1 });
      }
    };
    crow(); this.time.addEvent({ delay: 9000, loop: true, callback: crow });
  }

  select(id) {
    const r = REGIONS[id];
    this.sel = id;
    this.infoTitle.setText(r.name);
    const open = r.playable && this.unlocked(id);
    this.infoTier.setText(r.town ? "Cidade + " + "☠".repeat(r.tier) + " esgoto de 5 andares" : "Dificuldade " + "☠".repeat(r.tier) + "   ·   5 andares");
    this.infoDesc.setText(r.desc + (!r.playable ? "\n\nEm breve." : !open ? "\n\nAbre depois de vencer os Esgotos de Karhyn." : ""));
    this.startBtn.forEach(o => o.setAlpha(open ? 1 : 0.4));
    this.startBtn[1].setText(r.town ? "Entrar" : "Descer");
  }
}

// ---------------------------------------------------------------- loja de atributos (ouro da vocação)
class ShopScene extends Phaser.Scene {
  constructor() { super("shop"); }
  create() {
    menuBackground(this);
    menuMusic(this);
    this.voc = this.registry.get("vocation") || "knight";
    const V = VOCATIONS[this.voc];
    this.add.nineslice(VIEW_W / 2, 282, "panel", null, 640, 440, 16, 16, 16, 16);
    txt(this, VIEW_W / 2, 86, "Loja de Karhyn", 32, COLORS.gold).setOrigin(0.5);
    this.goldT = txt(this, VIEW_W / 2, 118, "", 16, COLORS.gold).setOrigin(0.5);
    if (V.passive) txt(this, VIEW_W / 2, 142, `Passiva — ${V.passive.name}: ${V.passive.desc}`, 12, COLORS.dim).setOrigin(0.5);
    this.rows = [];
    Object.keys(SHOP).forEach((id, i) => {
      const y = 186 + i * 66, it = SHOP[id];
      this.add.nineslice(VIEW_W / 2, y, "slot", null, 580, 58, 4, 4, 4, 4);
      const ic = this.add.image(VIEW_W / 2 - 262, y, it.icon); ic.setScale(30 / Math.max(ic.width, ic.height));
      txt(this, VIEW_W / 2 - 238, y - 20, it.name, 17, COLORS.text);
      const desc = txt(this, VIEW_W / 2 - 238, y + 2, "", 12, COLORS.dim);
      const pips = this.add.graphics();
      const [b, bt] = button(this, VIEW_W / 2 + 210, y, 130, "", () => this.buy(id), 14);
      this.rows.push({ id, desc, pips, b, bt, y });
    });
    // vindo da cidade (vendedora ou Salão do Conselho), volta para ela
    const back = this.registry.get("shopFrom") === "town" ? "town" : "map", tab = this.registry.get("shopTab");
    this.registry.set("shopFrom", null); this.registry.set("shopTab", null);
    const goBack = () => { if (back === "town") this.registry.set("townSpawn", "here"); this.scene.start(back); };
    button(this, VIEW_W / 2 - 90, 470, 160, "Voltar", goBack, 15);
    const [, tb] = button(this, VIEW_W / 2 + 90, 470, 160, "Poções", () => { this.showPots(!this.potBox); tb.setText(this.potBox ? "Atributos" : "Poções"); }, 15);
    this.input.keyboard.on("keydown-ESC", goBack);
    this.refresh();
    if (tab === "potions") { this.showPots(true); tb.setText("Atributos"); }
  }
  // aba de poções: compradas aqui, vão para a mochila (atalhos 5 e 6 no jogo)
  showPots(on) {
    if (this.potBox) { this.potBox.destroy(); this.potBox = null; }
    if (!on) return;
    const c = this.add.container(0, 0); this.potBox = c;
    c.add(this.add.rectangle(VIEW_W / 2, 284, 600, 290, 0x16141a, 1));
    const d = Save.voc(this.voc), ids = Object.keys(POTIONS).filter(id => potionOk(id, this.voc));
    ids.forEach((id, i) => {
      const P = POTIONS[id], y = 162 + i * 46;
      const ic = this.add.image(VIEW_W / 2 - 270, y, P.icon); ic.setScale(26 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint);
      c.add(ic);
      c.add(txt(this, VIEW_W / 2 - 248, y - 17, `${P.name}  ×${d.potions[id] || 0}`, 15, COLORS.text));
      c.add(txt(this, VIEW_W / 2 - 248, y + 2, `${P.desc}  Recarga ${P.cd >= 60 ? P.cd / 60 + " min" : P.cd + " s"}.`, 11, COLORS.dim));
      for (const [n, bx] of [[1, 170], [5, 250]]) {
        const cost = P.price * n;
        const [b, bt] = button(this, VIEW_W / 2 + bx, y, 74, `◉${cost}`, () => {
          if (Save.gold(this.voc) < cost) { this.cameras.main.shake(80, 0.002); return; }
          d.gold -= cost; d.potions[id] = (d.potions[id] || 0) + n; Save.save(); sfx(this, "pickup", 0.5); this.refresh(); this.showPots(true);
        }, 12);
        c.add([b, bt]); c.add(txt(this, VIEW_W / 2 + bx, y + 14, `×${n}`, 10, COLORS.dim).setOrigin(0.5, 0));
      }
    });
  }
  lvl(id) { return Save.voc(this.voc).trainings[id] || 0; }
  buy(id) {
    const l = this.lvl(id), it = SHOP[id];
    if (l >= it.max) return;
    const c = shopCost(id, l), d = Save.voc(this.voc);
    if (d.gold < c) { this.cameras.main.shake(80, 0.002); return; }
    d.gold -= c; d.trainings[id] = l + 1; Save.save();
    sfx(this, "pickup", 0.5);
    this.refresh();
  }
  refresh() {
    this.goldT.setText(`◉ ${Save.gold(this.voc)} de ouro`);
    for (const r of this.rows) {
      const l = this.lvl(r.id), it = SHOP[r.id], max = l >= it.max;
      r.desc.setText(l ? `Atual: ${it.desc(l)}` + (max ? "" : `  →  próximo: ${it.desc(l + 1)}`) : `Próximo: ${it.desc(1)}`);
      r.pips.clear();
      for (let k = 0; k < it.max; k++) r.pips.fillStyle(k < l ? 0xe0bc60 : 0x2c2a30, 1).fillRect(VIEW_W / 2 - 238 + k * 12, r.y + 18, 9, 5);
      const c = shopCost(r.id, l);
      r.bt.setText(max ? "Máximo" : `◉ ${c}`).setColor(max ? COLORS.dim : Save.gold(this.voc) >= c ? COLORS.gold : COLORS.hurt);
    }
  }
}
