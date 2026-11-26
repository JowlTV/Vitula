// Cenas de apoio: carregamento e tela de título.
const ART = ["barrel", "chest_closed", "chest_open", "crate_damaged", "crate_intact", "floor", "gas_vent", "i_apple", "i_blue_gem", "i_bread", "i_bronze_key", "i_gold_coin",
  "i_golden_key", "i_health_potion", "i_mana_potion", "i_meat", "i_red_gem", "i_scroll", "i_shield", "i_silver_coin",
  "i_spell_book", "i_sword", "i_torch", "pillar",
  "pot", "pressure_plate", "stairs", "spikes_extended", "spikes_retracted", "torch_stand", "urn", "wall_face"];
const DECOR = ["bones", "manhole", "rat_nest", "sludge", "grate", "pool", "skeleton", "crate_pile"];
const SFX = ["boss", "break", "chest", "explode", "gem", "hit", "hurt", "levelup", "pickup"];

// Cinzel: títulos, cidades, nomes e destaques (size >= 20 ou opts.title); Alegreya: o resto.
const FONT_TITLE = "Cinzel, Alegreya, serif", FONT_TEXT = "Alegreya, serif";
// texto corrido: no mínimo 11 px; em telas de toque (o jogo encolhe ~70% no celular) 25% maior, mínimo 13 px
const TOUCH_UI = typeof navigator !== "undefined" && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);
function txtBody(size) { const v = size * 0.95; return TOUCH_UI ? Math.max(13, v * 1.25) : Math.max(11, v); }
function txt(scene, x, y, s, size = 16, color = COLORS.text, opts = {}) {
  const title = opts.title !== undefined ? opts.title : size >= 20; opts = Object.assign({}, opts); delete opts.title;
  return scene.add.text(x, y, s, Object.assign({
    fontFamily: title ? FONT_TITLE : FONT_TEXT, fontSize: Math.round(title ? size * 0.65 : txtBody(size)) + "px", color, stroke: "#0c0608", strokeThickness: title ? Math.max(3, size / 4) : Math.max(2, size / 6),   // Alegreya é mais fina: um pouco maior e com contorno leve
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
    for (const n of ["floor", "floor_b", "rocks", "bush", "stump", "mushrooms", "log", "deadtree", "sign"]) this.load.image("forest_" + n, `assets/art/forest_${n}.png`);
    for (const n of ["floor", "floor_b", "rocks", "tent", "totem", "campfire", "barricade", "palisade", "weapon_rack", "stakes", "cairn", "burrow"]) this.load.image("slope_" + n, `assets/art/slope_${n}.png`);
    this.load.image("altar_oraculo", "assets/art/altar_oraculo.png");
    const loadedMon = new Set(); for (const k in MON_ANIM) { const [fw, w, a, d] = MON_ANIM[k]; for (const n of [w, a, d]) if (!["am_cave_rat", "am_giant_rat"].includes(n) && !loadedMon.has(n) && loadedMon.add(n)) this.load.spritesheet(n, `assets/art/${n}.png`, { frameWidth: fw, frameHeight: fw }); }
    for (const n of ["kn_hurt", "kn_cast"]) this.load.spritesheet(n, `assets/art/${n}.png`, { frameWidth: 200, frameHeight: 200 });
    for (const n of ["npc_smith_idle", "npc_potion_seller_idle", "npc_depot_guard_idle"]) this.load.spritesheet(n, `assets/town/${n}.png`, { frameWidth: 200, frameHeight: 200 });
    this.load.spritesheet("fx_recall", "assets/fx/recall.png", { frameWidth: 64, frameHeight: 72 });
    this.load.spritesheet("fx_basic_slash", "assets/art/fx_basic_slash.png", { frameWidth: 72, frameHeight: 72 });
    this.load.image("waypoint", "assets/waypoint.png");
    loadPfx(this); this.load.image("fx_holy_arrow", "assets/art/fx_holy_arrow.png"); this.load.image("fx_volley", "assets/art/fx_volley.png"); this.load.image("fx_xcut", "assets/art/fx_xcut.png"); this.load.image("carriage_wreck", "assets/art/carriage_wreck.png"); this.load.image("sewer_knight", "assets/intro/knight_sewers.jpg"); for (const k of ["smith", "inn", "potions", "depot"]) { this.load.image("npc_scene_" + k, `assets/interior/npc_${k}.jpg`); this.load.image("face_" + k, `assets/interior/face_${k}.png`); } this.load.image("sewer_archer", "assets/intro/archer_sewers.jpg"); this.load.image("fx_slasher", "assets/art/fx_slasher.png"); this.load.image("fx_missile", "assets/art/fx_missile.png");
    for (const id of EQUIP_ART) this.load.image("eq_" + id, `assets/equip/${id}.png`);
    this.load.spritesheet("fx_ring_wave", "assets/art/fx_ring_wave.png", { frameWidth: 214, frameHeight: 214 });
    this.load.spritesheet("fx_front_cut", "assets/art/fx_front_cut.png", { frameWidth: 230, frameHeight: 230 });
    // Karhyn nova (guia de estilo aprovado): prédios, objetos e autotiles de chão
    // a arquitetura de Karhyn é desenhada em código (towngfx.js); da arte gerada só fica o lampião
    this.load.image("k2_lamp", "assets/town2/k2_lamp.png");
    this.load.image("map_karhyn_2x", "assets/ui/map_karhyn_2x.jpg");   // opaca: jpg tem 1/4 do tamanho do png
    for (const n of ["vk_ts_piso", "vk_ts_muro", "vk_ts_calcada", "vk_ts_grama", "vk_mural", "vk_goddess_art", "vk_ferreiro", "vk_harpa_dancante", "vk_pocoes", "vk_depot", "vk_acomodacao", "vk_portao_lateral", "vk_biblioteca", "vk_casebre_1", "vk_casebre_2", "vk_casebre_3", "vk_bueiro", "vk_cobble", "k2_well", "vk_int_ferreiro", "vk_int_harpa", "vk_int_pocoes", "vk_int_depot", "vk_int_acomodacao",
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
    this.load.image("fx_portal", "assets/fx/portal.png");   // portal dos chefes (girado e tingido em código)
    this.load.spritesheet("fx_aura", "assets/fx/aura.png", { frameWidth: 144, frameHeight: 144 });
    for (const i of ["slash", "slash_evo", "berserk", "spear", "heal", "aura"]) this.load.image("icon_" + i, `assets/icons/${i}.png`);
    for (const i of ["basic", "front_v2", "exura", "area", "aura_v2"]) this.load.image("icon_" + i, `assets/icons/icon_${i}.png`);
    for (const c of ["rat", "cave_rat", "bat", "slime", "skeleton", "giant_rat"]) this.load.image("corpse_" + c, `assets/art/corpse_${c}.png`);
    for (const u of ["logo_vitula", "bar_track", "bar_fill_boss", "bar_fill_xp", "heart", "slot", "panel", "button_normal", "button_hover", "title_banner", "portrait_knight", "portrait_archer", "portrait_sorcerer", "portrait_druid", "card_normal", "card_selected", "name_plate", "marker_open", "marker_locked", "marker_cleared"])
      this.load.image(u, `assets/ui/${u}.png`);
    for (const s of SFX) this.load.audio(s, `assets/audio/${s}.wav`);
    if (!MOBILE_MUSIC) this.load.audio("music_goddess", "assets/audio/before_the_shadow_falls.mp3");
    if (!MOBILE_MUSIC) for (const m of ["title", "town", "sewers", "slope", "boss", "end"]) this.load.audio("music_" + m, `audio/music_${m}.mp3`);
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
    Promise.all(["20px Cinzel", "16px Alegreya"].map(f => document.fonts.load(f).catch(() => 0))).then(() => document.fonts.ready).then(() => { const q = new URLSearchParams(location.search); if (q.get("voc") && VOCATIONS[q.get("voc")]) this.registry.set("vocation", q.get("voc")); this.scene.start(q.has("intro") ? "intro" : q.has("town") ? "town" : q.has("play") ? "dungeon" : "title"); });
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
  // retorno visual: brilho ao passar o mouse, afunda ao apertar, pisca dourado ao soltar
  const sc = (k, d = 80) => scene.tweens.add({ targets: [b, t], scaleX: k, scaleY: k, duration: d, ease: "Quad.out" });
  b.on("pointerover", () => { b.setTexture("button_hover"); t.setColor("#ffe2a0"); sc(1.04); });
  b.on("pointerout", () => { b.setTexture("button_normal"); t.setColor(COLORS.text); b.clearTint(); sc(1); });
  b.on("pointerdown", () => { b.setTint(0xc8a050); sc(0.94, 50); });
  b.on("pointerup", () => { b.clearTint(); sc(1.04, 60); if (scene.sound) sfx(scene, "pickup", 0.15); fn(); });
  return [b, t];
}

// ── sistema de música ──────────────────────────────────────────
// Faixas: title (menus), town, sewers, slope, boss, end, music_goddess (fallback)
let _curMusic = null;   // key da faixa tocando agora

// No celular a música toca por um <audio> só, em streaming: pela Web Audio cada faixa de ~3 min vira ~60 MB
// descomprimida na memória, e as 7 juntas derrubavam o Safari do iPhone (o jogo voltava para a tela inicial).
const MOBILE_MUSIC = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const MUSIC_URL = { music_title: "audio/music_title.mp3", music_town: "audio/music_town.mp3", music_sewers: "audio/music_sewers.mp3", music_slope: "audio/music_slope.mp3",
  music_boss: "audio/music_boss.mp3", music_end: "audio/music_end.mp3", music_goddess: "assets/audio/before_the_shadow_falls.mp3" };
const musicExists = (scene, key) => MOBILE_MUSIC ? !!MUSIC_URL[key] : scene.cache.audio.exists(key);
let _mEl = null;
function playMusicMobile(key, vol) {
  if (!_mEl) {
    _mEl = new Audio(); _mEl.loop = true; _mEl.preload = "auto";
    const kick = () => { if (_mEl.src && _mEl.paused) _mEl.play().catch(() => {}); };   // iOS só toca depois de um toque
    ["touchend", "pointerup", "keydown"].forEach(ev => window.addEventListener(ev, kick, { passive: true }));
    document.addEventListener("visibilitychange", () => { if (document.hidden) _mEl.pause(); else kick(); });
  }
  _mEl.volume = Math.max(0, Math.min(1, vol * Settings.data.music));
  if (_curMusic !== key) { _curMusic = key; _mEl.src = MUSIC_URL[key]; }
  if (_mEl.paused) _mEl.play().catch(() => {});
}
// Esc → "Voltar ao menu": salva e volta para a tela inicial
function goToTitle(scene) {
  Save.save(); scene.tweens.resumeAll && scene.tweens.resumeAll(); scene.paused = false;
  scene.cameras.main.fadeOut(400, 0, 0, 0);
  scene.cameras.main.once("camerafadeoutcomplete", () => { stopAllButMusic(scene); scene.scene.start("title"); });
}
function playMusic(scene, key, vol = 0.55) {
  if (MOBILE_MUSIC) { if (MUSIC_URL[key]) playMusicMobile(key, vol); return; }
  if (scene.sound.locked) { scene.sound.once("unlocked", () => playMusic(scene, key, vol)); return; }
  if (!scene.cache.audio.exists(key)) { // fallback para a deusa se a faixa não existir
    if (key !== "music_goddess" && scene.cache.audio.exists("music_goddess")) return playMusic(scene, "music_goddess", vol);
    return;
  }
  const v = vol * Settings.data.music;
  if (_curMusic === key) {
    // mesma faixa: só ajusta volume
    const m = scene.sound.get(key);
    if (m && m.isPlaying) { m.setVolume(v); return; }
    // (foi parada por um stopAll: toca de novo — antes ficava em silêncio na floresta e na intro)
    if (m) { m.setVolume(0); m.play(); scene.tweens.add({ targets: m, volume: v, duration: 1200 }); return; }
    _curMusic = null;
  }
  // fade out a faixa anterior
  if (_curMusic) {
    const old = scene.sound.get(_curMusic);
    if (old && old.isPlaying) {
      scene.tweens.add({ targets: old, volume: 0, duration: 800, onComplete: () => old.stop() });
    }
  }
  // toca a nova
  const m = scene.sound.get(key) || scene.sound.add(key, { loop: true, volume: 0 });
  _curMusic = key;
  if (!m.isPlaying) m.play();
  scene.tweens.add({ targets: m, volume: v, duration: 1200 });
}

function menuMusic(scene) { playMusic(scene, "music_title", 0.55); }

// para todos os sons menos a música (ela continua de onde estava)
function stopAllButMusic(scene) {
  for (const s of scene.sound.getAllPlaying ? scene.sound.getAllPlaying() : []) if (s.key !== _curMusic) s.stop();
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
    button(this, VIEW_W / 2, 340, 260, t("play"), () => this.scene.start("select"), 18);
    button(this, VIEW_W / 2, 392, 260, t("options"), () => this.scene.start("options"), 16);
    // apagar os personagens (pede confirmação); configurações ficam
    button(this, VIEW_W / 2, 444, 260, t("reset_chars"), () => {
      const c = this.add.container(0, 0).setDepth(50);
      c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.75).setOrigin(0).setInteractive());
      c.add(this.add.nineslice(VIEW_W / 2, VIEW_H / 2, "panel", null, 520, 210, 16, 16, 16, 16));
      c.add(txt(this, VIEW_W / 2, VIEW_H / 2 - 62, t("reset_chars"), 24, COLORS.gold).setOrigin(0.5));
      c.add(txt(this, VIEW_W / 2, VIEW_H / 2 - 18, t("reset_confirm"), 14, COLORS.text, { wordWrap: { width: 460 }, align: "center" }).setOrigin(0.5));
      const [b1, t1] = button(this, VIEW_W / 2 - 120, VIEW_H / 2 + 56, 200, t("reset_yes"), () => {
        Save.data = { vocs: {}, runs: 0, cleared: {}, bestiary: {}, epoch: SAVE_EPOCH }; Save.save();
        c.destroy(); sfx(this, "explode", 0.3); this.cameras.main.flash(250, 120, 20, 20);
      }, 14);
      const [b2, t2] = button(this, VIEW_W / 2 + 120, VIEW_H / 2 + 56, 200, t("reset_no"), () => c.destroy(), 14);
      c.add([b1, t1, b2, t2]);
    }, 14);
    txt(this, VIEW_W / 2, 528, t("credits_jowl"), 12, COLORS.dim).setOrigin(0.5);
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
    txt(this, VIEW_W / 2, 40, t("options"), 30, COLORS.text).setOrigin(0.5);
    this.add.nineslice(VIEW_W / 2, 282, "panel", null, 880, 420, 16, 16, 16, 16);
    // volumes
    this.volRow(88, t("music_vol"), "music");
    this.volRow(112, t("sfx_vol"), "sfx");
    this.speedRow(136);
    this.langRow(160);
    txt(this, 60, 182, t("keys_hint"), 13, COLORS.gold);
    this.keyTexts = {};
    // duas colunas de teclas (cabem todas as ações sem passar dos botões)
    const half = Math.ceil(ACTIONS.length / 2);
    ACTIONS.forEach(([id, label], i) => {
      const col = i < half ? 0 : 1, y = 204 + (i % half) * 21, lx = col ? 490 : 60;
      txt(this, lx, y, t("bind_" + id) === "bind_" + id ? label : t("bind_" + id), 12, COLORS.text).setOrigin(0, 0.5);
      for (let slot = 0; slot < 2; slot++) {
        const x = lx + 268 + slot * 76;
        const box = this.add.rectangle(x, y, 70, 19, 0x1a1820).setStrokeStyle(1, 0x6a5a40).setInteractive({ useHandCursor: true });
        const t = txt(this, x, y, "", 10, COLORS.text, { fontFamily: FONT_TEXT }).setOrigin(0.5);
        this.keyTexts[id + slot] = t;
        box.on("pointerup", () => this.listen(id, slot, t));
      }
    });
    this.refreshKeys();
    button(this, VIEW_W / 2 - 110, 456, 200, t("reset_default"), () => { Settings.reset(); this.scene.restart(); }, 14);
    button(this, VIEW_W / 2 + 110, 456, 200, t("back"), () => this.back(), 14);
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
    txt(this, 200, y, t("game_speed"), 14, COLORS.text).setOrigin(0, 0.5);
    const opts = [[0.5, t("speed_very_slow")], [0.65, t("speed_slow")], [0.75, t("speed_normal")], [0.9, t("speed_fast")], [1.0, t("speed_original")]];
    const label = txt(this, 560, y, "", 14, COLORS.gold).setOrigin(0.5);
    const idx = () => { let b = 0; opts.forEach((o, i) => { if (Math.abs(o[0] - Settings.data.speed) < Math.abs(opts[b][0] - Settings.data.speed)) b = i; }); return b; };
    const show = () => label.setText(`${opts[idx()][1]} (${Math.round(Settings.data.speed * 100)}%)`);
    const step = d => { const i = Phaser.Math.Clamp(idx() + d, 0, opts.length - 1); Settings.data.speed = opts[i][0]; Settings.save(); show(); };
    txt(this, 440, y, "<", 16, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerup", () => step(-1));
    txt(this, 680, y, ">", 16, COLORS.text).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerup", () => step(1));
    show();
  }
  langRow(y) {
    txt(this, 200, y, t("language"), 14, COLORS.text).setOrigin(0, 0.5);
    const codes = Object.keys(Lang.list());
    const label = txt(this, 560, y, "", 14, COLORS.gold).setOrigin(0.5);
    const idx = () => codes.indexOf(Lang.current());
    const show = () => label.setText(Lang.list()[Lang.current()]);
    const step = d => {
      const i = Phaser.Math.Clamp(idx() + d, 0, codes.length - 1);
      Lang.set(codes[i]);
      this.scene.restart();
    };
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
    t.setText(window.t("press_key")).setColor(COLORS.gold);
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
    txt(this, VIEW_W / 2, 52, t("select_vocation"), 30, COLORS.text).setOrigin(0.5);
    const ids = Object.keys(VOCATIONS), cw = 214, gap = 14, x0 = VIEW_W / 2 - (ids.length * (cw + gap) - gap) / 2;
    ids.forEach((id, i) => {
      const v = VOCATIONS[id], x = x0 + i * (cw + gap), y = 96;
      const open = !v.soon && (v.unlockCost <= 0 || (Save.data.unlocked || []).includes(id));
      const card = this.add.nineslice(x, y, open ? "card_selected" : "card_normal", null, cw, 340, 14, 14, 14, 14).setOrigin(0);
      // vocações ainda sem arte: sem retrato, cartão em preto e branco (cinza)
      if (!v.soon) {
        const port = this.add.image(x + cw / 2, y + 74, v.portrait); port.setScale(115 / Math.max(port.width, port.height));   // retratos de tamanhos diferentes saem com 115 px
        if (id === "archer") port.setFlipX(true);   // todos olhando para o mesmo lado (direita)
        if (!open) port.setTint(0x555060);
      } else { card.setTint(0x6a6a6a).setAlpha(0.7); this.add.rectangle(x + cw / 2, y + 74, 120, 120, 0x111111, 0.6).setStrokeStyle(1, 0x3a3a3a); txt(this, x + cw / 2, y + 74, "?", 48, "#4a4a4a").setOrigin(0.5); }
      const plate = this.add.nineslice(x + cw / 2, y + 152, "name_plate", null, 170, 30, 14, 14, 4, 4); if (v.soon) plate.setTint(0x6a6a6a);
      txt(this, x + cw / 2, y + 152, v.name, 24, v.soon ? "#8a8a8a" : COLORS.gold).setOrigin(0.5);
      // descrição e, logo abaixo dela (posição medida, sem sobrepor), a passiva/traço; as skills ficam na janela de Habilidades
      const d1 = txt(this, x + 16, y + 176, v.desc, 13, v.soon ? "#7a7a7a" : COLORS.text, { wordWrap: { width: cw - 32 }, lineSpacing: 2 });
      const d2 = txt(this, x + 16, d1.y + d1.height + 10, v.passive ? `${t("passive_prefix")}${v.passive.name}: ${v.passive.desc}` : v.trait, 12, COLORS.dim, { wordWrap: { width: cw - 32 }, lineSpacing: 1 });
      if (d2.y + d2.height > y + 296) d2.setFontSize(11);
      if (v.soon) d2.setVisible(false);
      const foot = open ? t("level_n", { n: Save.levelInfo(Save.voc(id).xpTotal).level }) : (v.soon ? t("coming_soon") : t("locked_cost", { n: v.unlockCost }));
      txt(this, x + cw / 2, y + 312, foot, 14, open ? COLORS.gold : COLORS.dim).setOrigin(0.5);
      if (open) {
        this.add.zone(x, y, cw, 340).setOrigin(0).setInteractive({ useHandCursor: true }).on("pointerup", () => { this.registry.set("vocation", id); startAdventure(this); });
        this.tweens.add({ targets: card, alpha: 0.85, duration: 900, yoyo: true, repeat: -1 });
      }
    });
    button(this, VIEW_W / 2, 492, 200, t("back"), () => this.scene.start("title"));
    this.input.keyboard.on("keydown-ESC", () => this.scene.start("title"));
    this.input.keyboard.on("keydown-ENTER", () => { this.registry.set("vocation", "knight"); startAdventure(this); });
    menuMusic(this);
  }
}

// Introdução: a vista da torre sobre os arredores de Karhyn, o título e o texto subindo devagar.
// Qualquer tecla, clique ou toque pula. Ao fim, o jogo começa no portão de Karhyn, de dia.
const introTitle = () => t("intro_title");
const introText = () => [1, 2, 3, 4, 5, 6, 7].map(i => t("intro_" + i)).filter(x => x && !x.startsWith("intro_")).join(" ").replace(/\.\.\. \.\.\./g, "... ");
const INTRO_VIDEO = { knight: "assets/intro/knight_karhyn.mp4", archer: "assets/intro/archer_karhyn.mp4" };
class IntroScene extends Phaser.Scene {
  constructor() { super("intro"); }
  preload() {   // entrada de Karhyn vista das costas do personagem (uma arte por classe)
    const v = this.registry.get("vocation") === "archer" ? "archer" : "knight";
    this.kKey = `intro_${v}_karhyn`; if (!this.textures.exists(this.kKey)) this.load.image(this.kKey, `assets/intro/${v}_karhyn.jpg`);
    // cena em vídeo (10 s) quando existir para a classe: o texto passa enquanto o vídeo corre
    this.vKey = INTRO_VIDEO[v] ? `vid_${v}_karhyn` : null;
    if (this.vKey && !this.cache.video.exists(this.vKey)) this.load.video(this.vKey, INTRO_VIDEO[v], true);
  }
  create() {
    this.anims.globalTimeScale = 1; this.done = false;
    zoom2(this.cameras.main); this.cameras.main.setBackgroundColor("#050406");
    const k0 = this.textures.exists(this.kKey) ? this.kKey : "tower_view", W0 = this.textures.get(k0).getSourceImage().width;
    const P = animatedPanel(this, k0, k0 === "tower_view" ? "" : "karhyn", { rainA: 0.3 }), img = P.img;
    this.tweens.add({ targets: P.c, y: VIEW_H / 2 - 8, scale: 1.08, duration: 60000, ease: "Sine.inOut" });   // a câmera avança devagar pela rua
    // a cor vai sumindo devagar até ficar em preto e branco
    if (img.preFX) { const cm = img.preFX.addColorMatrix(), st = { g: 0 };
      this.tweens.add({ targets: st, g: 1, delay: 2500, duration: 7000, ease: "Sine.inOut", onUpdate: () => { cm.reset(); cm.saturate(-st.g); } }); }
    // vídeo por cima da imagem (a imagem fica de reserva se o vídeo não tocar)
    this.vid = null;
    if (this.vKey && this.cache.video.exists(this.vKey)) {
      const vd = this.add.video(VIEW_W / 2, VIEW_H / 2, this.vKey); vd.setMute(true);
      vd.play(false); vd.once("created", () => vd.setDisplaySize(VIEW_W, VIEW_H)); vd.setDisplaySize(VIEW_W, VIEW_H);
      vd.on("complete", () => this.time.delayedCall(400, () => this.finish()));
      this.vid = vd; P.c.setVisible(false);
    }
    // depois de 1,5 s, um raio clareia o céu
    const bolt = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xe4ecff, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.vid) this.time.delayedCall(1500, () => { this.tweens.add({ targets: bolt, alpha: { from: 0.7, to: 0 }, duration: 140, repeat: 2, repeatDelay: 60 }); this.cameras.main.shake(200, 0.003); sfx(this, "explode", 0.35); });
    // névoa passando sobre os campos
    for (let i = 0; i < 6; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, VIEW_W), Phaser.Math.Between(120, VIEW_H - 120), "light").setScale(3.2, 0.9).setTint(0xc8d0d8).setAlpha(0.06);
      this.tweens.add({ targets: f, x: f.x + VIEW_W + 400, duration: Phaser.Math.Between(26000, 42000), repeat: -1, onRepeat: () => { f.x = -400; } });
    }
    // véu escuro para o texto ler bem (mais fechado embaixo, onde ele nasce)
    const veil = this.add.graphics();
    veil.fillStyle(0x050406, 0.42).fillRect(0, 0, VIEW_W, VIEW_H);
    veil.fillGradientStyle(0x050406, 0x050406, 0x050406, 0x050406, 0.75, 0.75, 0, 0).fillRect(0, 0, VIEW_W, VIEW_H * 0.75);   // mais fechado em cima, atrás do texto
    // texto normal na tela (sem o efeito Star Wars): título amarelo, texto branco; aparece e some esmaecendo,
    // e dura o tempo do vídeo (10 s) — ou 16 s quando só há a imagem
    const dur = this.vid ? 10000 : 16000;
    const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 110, introTitle(), { fontFamily: FONT_TITLE, fontSize: "30px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 7, resolution: 2 })
      .setOrigin(0.5).setAlpha(0).setShadow(0, 3, "#000000", 6, true, true);
    const body = this.add.text(VIEW_W / 2, VIEW_H / 2 + 20, introText(), { fontFamily: FONT_TEXT, fontSize: "14px", color: "#ffffff", stroke: "#000000", strokeThickness: 4, resolution: 2,
      align: "center", wordWrap: { width: 680 }, lineSpacing: 8 }).setOrigin(0.5).setAlpha(0).setShadow(0, 2, "#000000", 6, true, true);
    title.setY(body.y - body.height / 2 - 40);   // título logo acima do bloco de texto
    this.tweens.add({ targets: title, alpha: 1, duration: 900, delay: 300 });
    this.tweens.add({ targets: body, alpha: 1, duration: 1200, delay: 800 });
    this.tweens.add({ targets: [title, body], alpha: 0, duration: 1000, delay: dur - 1300 });
    if (!this.vid) this.time.delayedCall(dur, () => this.finish());
    const skip = txt(this, VIEW_W - 16, VIEW_H - 14, t("intro_skip"), 11, COLORS.dim).setOrigin(1, 1).setAlpha(0);
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
      if (REGIONS[id].hidden) continue;
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
    this.infoTier.setText(r.town ? t("region_town_tier", { skulls: "☠".repeat(r.tier) }) : t("region_tier", { skulls: "☠".repeat(r.tier) }));
    this.infoDesc.setText(r.desc + (!r.playable ? t("region_coming_soon") : !open ? t("region_locked") : ""));
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
    txt(this, VIEW_W / 2, 86, t("shop_title"), 32, COLORS.gold).setOrigin(0.5);
    this.goldT = txt(this, VIEW_W / 2, 118, "", 16, COLORS.gold).setOrigin(0.5);

    this.rows = [];
    // (nov/26) a loja virou só de poções: os atributos/treinos saíram do jogo
    [].forEach((id, i) => {
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
    button(this, VIEW_W / 2, 470, 160, t("back"), goBack, 15);

    this.input.keyboard.on("keydown-ESC", goBack);
    this.refresh();
    this.showPots(true);
  }
  // aba de poções: só as de efeito (vida/mana/fúria enchem matando monstros); bebidas pela mochila
  showPots(on) {
    if (this.potBox) { this.potBox.destroy(); this.potBox = null; }
    if (!on) return;
    const c = this.add.container(0, 0); this.potBox = c;
    c.add(this.add.rectangle(VIEW_W / 2, 284, 600, 290, 0x16141a, 1));
    const d = Save.voc(this.voc), ids = Object.keys(POTIONS).filter(id => POTIONS[id].dur && potionOk(id, this.voc));   // poção de vida não se compra: enche matando monstros
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
    this.goldT.setText(t("gold_display", { n: Save.gold(this.voc) }));
    for (const r of this.rows) {
      const l = this.lvl(r.id), it = SHOP[r.id], max = l >= it.max;
      r.desc.setText(l ? t("shop_current", { desc: it.desc(l) }) + (max ? "" : t("shop_next", { desc: it.desc(l + 1) })) : t("shop_first_next", { desc: it.desc(1) }));
      r.pips.clear();
      for (let k = 0; k < it.max; k++) r.pips.fillStyle(k < l ? 0xe0bc60 : 0x2c2a30, 1).fillRect(VIEW_W / 2 - 238 + k * 12, r.y + 18, 9, 5);
      const c = shopCost(r.id, l);
      r.bt.setText(max ? t("shop_max") : `◉ ${c}`).setColor(max ? COLORS.dim : Save.gold(this.voc) >= c ? COLORS.gold : COLORS.hurt);
    }
  }
}
