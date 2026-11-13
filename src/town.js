// Cidadela de Karhyn: cidade murada para caminhar, com depot, ferreiro, vendedora de poções e a entrada dos esgotos.
// Abre depois que os Esgotos são vencidos. Layout inspirado numa cidadela fortificada: portão ao sul com torres,
// avenida até o salão de colunas ao norte, praça com fonte no centro, torre de vigia, casas de enxaimel e ciprestes.

const TOWN_TINT = 0xc2c6d0; // luz fria e nublada da cidade, aplicada no herói e nos NPCs
const TOWN_W = 46, TOWN_H = 17;   // vila de Karhyn: uma rua reta de oeste (portão) a leste (esgoto)
// artes grandes da cidade que já chegaram do SpriteCook (as que faltam são desenhadas por código até chegarem)
const TOWN_ART = [];   // a cidade é desenhada em código (towngfx.js)
const TOWN_FILES = ["depot_chest"];

function cityUnlocked() { return true; }

// História e boatos de Karhyn (ligados à introdução "A Queda de Karhyn"): cada morador conta a sua parte, uma fala por vez.
const townLore = () => ({
  smith: [t("lore_smith_1"), t("lore_smith_2"), t("lore_smith_3"), t("lore_smith_4")],
  potions: [t("lore_potions_1"), t("lore_potions_2"), t("lore_potions_3"), t("lore_potions_4")],
  depot: [t("lore_depot_1"), t("lore_depot_2"), t("lore_depot_3"), t("lore_depot_4")],
  inn: [t("lore_inn_1"), t("lore_inn_2"), t("lore_inn_3"), t("lore_inn_4")],
  lodging: [t("lore_lodging_1"), t("lore_lodging_2"), t("lore_lodging_3")],
});

class TownScene extends Phaser.Scene {
  constructor() { super("town"); }

  create() {
    giveArcherKit(this.registry.get("vocation"));
    this.anims.globalTimeScale = 1;
    this.vocId = this.registry.get("vocation") || "knight";
    this.cameras.main.setBackgroundColor("#1a1c18");
    this.cameras.main.roundPixels = true;
    this.world = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(1000000);
    this.uiCam = zoom2(this.cameras.add(0, 0, VIEW_W * 2, VIEW_H * 2));
    this.cameras.main.ignore(this.uiLayer);
    this.uiCam.ignore(this.world);
    this.solid = new Set(); this.zones = [];
    // a cena é reaproveitada ao voltar da loja/esgoto: zera o estado da visita anterior
    this.leaving = false; this.dialog = null; this.interior = null; this.grassPat = null; this.woodPat = null; this.rampPat = null;
    if (this.textures.exists("town_ground")) this.textures.remove("town_ground");
    this.makePlaceholders();
    this.layout();
    this.drawGround();
    this.placeThings();
    this.spawnHero();
    this.buildUi();
    this.ambience();
    // teclas
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard;
    this.keysIn = {};
    for (const [id] of ACTIONS) this.keysIn[id] = Settings.data.keys[id].filter(n => K[n] !== undefined).map(n => kb.addKey(K[n]));
    kb.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    (this.keysIn.interact || []).forEach(k => k.on("down", () => this.interact()));
    this.input.keyboard.on("keydown", ev => this.dialogKey(ev));
    (this.keysIn.pause || []).forEach(k => k.on("down", () => this.bagOpen ? this.toggleBag() : this.dialog ? this.closeDialog() : this.openMenu()));
    (this.keysIn.map || []).forEach(k => k.on("down", () => this.toggleMap()));
    this.bigMap = null;
    (this.keysIn.zoomIn || []).forEach(k => k.on("down", () => this.zoomBy(0.2)));
    (this.keysIn.zoomOut || []).forEach(k => k.on("down", () => this.zoomBy(-0.2)));
    { const d = Save.voc(this.vocId);   // breve tutorial na primeira chegada a Karhyn
      if (!d.tutTown) this.time.delayedCall(3200, () => { if (this.dialog || this.leaving) return; d.tutTown = true; Save.save();
        this.say("Karhyn", t("town_welcome"), [[t("understood"), () => this.closeDialog()]]); }); }
    this.input.on("wheel", (_p, _o, _dx, dy) => this.zoomBy(dy > 0 ? -0.2 : 0.2));
    this.cameras.main.fadeIn(500, 0, 0, 0);
    stopAllButMusic(this);
    playMusic(this, "music_town", 0.5);
  }

  // ------------------------------------------------------------ mapa
  key(x, y) { return y * 1000 + x; }
  block(x0, y0, w, h) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.solid.add(this.key(x, y)); }
  isSolid(x, y) { return x < 0 || y < 0 || x >= TOWN_W || y >= TOWN_H || this.solid.has(this.key(x, y)); }

  // Vila de Karhyn (46×18), casas de 32 px de projeto ampliadas 2×. Rua única oeste→leste:
  //   y 0–1  breu atrás das casas do norte · y 2–6 casas do norte (base na linha 6) · y 7 calçada
  //   y 8–10 rua de terra com poças · y 11 calçada · y 12–14 casas do sul (base na 14), 15 quintal · y 16 muro
  //   x 0–2 portão de pedra (oeste, partida) · x 38–40 estátua da deusa · x 43–44 entrada do esgoto (leste)
  // Códigos: g grama · c pedra · s calçada · d terra · w muro/escuro
  layout() {
    const g = this.ground = [];
    for (let y = 0; y < TOWN_H; y++) { g.push([]); for (let x = 0; x < TOWN_W; x++) g[y].push("g"); }
    const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H) g[y][x] = t; };
    rect(0, 0, TOWN_W - 1, 1, "w"); rect(0, TOWN_H - 1, TOWN_W - 1, TOWN_H - 1, "w");
    rect(0, 0, 1, TOWN_H - 1, "w"); rect(TOWN_W - 1, 0, TOWN_W - 1, TOWN_H - 1, "w");
    rect(2, 7, TOWN_W - 2, 7, "s"); rect(2, 11, TOWN_W - 2, 11, "s");       // calçadas
    rect(0, 8, TOWN_W - 2, 10, "d");                                         // rua de terra
    rect(36, 7, 41, 11, "c"); rect(42, 8, 44, 10, "c");   // calçamento em volta do bueiro                                                // largo de pedra da estátua
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) if (g[y][x] === "w") this.solid.add(this.key(x, y));
    this.block(2, 2, TOWN_W - 3, 5); this.block(2, 12, TOWN_W - 3, 4);   // casas do sul (base na 14) e o quintal atrás delas     // quarteirões (as casas cobrem tudo)
  }

  // chão: grama de base + autotiles de 15 peças do SpriteCook (grade dupla), cada um sobre o anterior
  drawGround() {
    const W = TOWN_W * T, H = TOWN_H * T;
    const src = k => this.textures.exists(k) ? this.textures.get(k).getSourceImage() : null;
    this.textures.addCanvas("town_ground", TG.ground(this.ground, TOWN_W, TOWN_H, T, { street: src("vk_ts_piso"), wall: src("vk_ts_muro"), pave: src("vk_ts_calcada"), grass: src("vk_ts_grama") }));
    this.textures.get("town_ground").setFilter(Phaser.Textures.FilterMode.NEAREST);   // pixels nítidos no zoom (sem borrão)   // sem cópia extra do canvas
    this.world.add(this.add.image(0, 0, "town_ground").setOrigin(0).setDepth(-10));
  }

  // coloca uma arte k2_ com a base na linha `by` (casa), a partir da coluna `bx`, com `w` casas de largura;
  // bloqueia as `fd` linhas de baixo (a pegada); `depth` opcional para ficar atrás de quem passa
  art(tex, bx, by, w, fd = 2, solid = true) {
    // peças da cidade desenhadas em código (towngfx.js); só o lampião continua imagem
    const kind = tex.startsWith("k2_") ? tex.slice(3) : null;
    if (kind && TG.MAKERS[kind]) { const k = `tg_${kind}_${w}`; tex = this.textures.exists(k) ? k : TG.make(this, k, kind, w); }
    const img = this.add.image((bx + w / 2) * T, (by + 1) * T, tex).setOrigin(0.5, 1);
    img.setScale(w * T / img.width).setDepth((by + 1) * T - 2).setTint(TOWN_TINT);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.world.add(img); groundShadow(this, img, this.world, w > 2 ? 0.95 : 0.85, w > 2 ? 0.55 : 0.9);
    if (solid && fd > 0) this.block(Math.floor(bx), by - fd + 1, Math.ceil(w), fd);
    return img;
  }

  // ------------------------------------------------------------ peças
  // coloca uma arte com a base no pé de um retângulo de casas (fx, fy, fw, fd) e largura alvo em casas
  put(tex, fx, fy, fw, fd, widthTiles, solid = true, dy = 0) {
    const img = this.add.image((fx + fw / 2) * T, (fy + fd) * T + dy, tex).setOrigin(0.5, 1);
    const s = widthTiles * T / img.width; img.setScale(s);
    img.setDepth((fy + fd) * T);
    this.world.add(img);
    if (solid) this.block(fx, fy, fw, fd);
    return img;
  }

  placeThings() {
    const A = (t, x, y, w, fd, solid) => this.art("k2_" + t, x, y, w, fd, solid);
    // peças do SpriteCook (vk_*); se a imagem faltar, usa a versão desenhada em código
    const F = (key, kind, x, y, w, wCode) => this.textures.exists(key) ? this.art(key, x, y, w, 0) : A(kind, x, y, wCode, 0);
    // portão de pedra a oeste (3×3), por onde o herói chega sem lembrar de nada
    // portão lateral visto de cima (SpriteCook): torres ao norte e ao sul da rua, passagem no meio; em código se a arte faltar
    this.gateImg = this.textures.exists("vk_portao_lateral") ? this.art("vk_portao_lateral", -0.67, 11.5, 3.34, 0).setDepth(7 * T) : A("v_gate_side", 0, 12, 2.2, 0);
    this.block(0, 6, 2, 7);
    // casebres pobres (3 variações do SpriteCook, alternadas); em código se faltarem
    let hv = 0; const H = (x, y, w) => { const k = "vk_casebre_" + (1 + hv++ % 3); return this.textures.exists(k) ? this.art(k, x + (w - 3) / 2, y, 3, 0) : A("v_ruin", x, y, w, 0); };
    // norte, da esquerda para a direita: Ferreiro, A Harpa Dançante, Loja de Poções (+ casas pobres)
    F("vk_ferreiro", "v_smith", 5, 6, 3.66, 4); H(10, 6, 3); F("vk_harpa_dancante", "v_inn", 14, 6, 4.82, 6); F("vk_pocoes", "v_potion", 21, 6, 3.52, 3);
    // Depot no lado norte (antes ficava embaixo, quase escondido na tela)
    F("vk_depot", "v_depot", 25, 6, 5.4, 5); H(31, 6, 3);
    // sul: Acomodação (+ casas pobres)
    H(3, 14, 3); H(7, 14, 3); H(10, 14, 3); H(13, 14, 3); F("vk_acomodacao", "v_lodging", 17, 14, 4.13, 5);
    H(23, 14, 4); H(28, 14, 3); H(32, 14, 4);
    // estátua da deusa no largo, com o feixe de luz; entrada do esgoto no fim da rua
    const st = this.add.image(39 * T, 7 * T + T - 2, "altar_oraculo").setOrigin(0.5, 1);   // 2× maior e uma casa acima, no alto do largo
    st.setScale(T * 2.2 / st.width).setDepth(8 * T - 2).setTint(TOWN_TINT); this.world.add(st);
    { // sombra da estátua: rente ao chão, na largura do pedestal (antes ficava no meio do pedestal, larga demais)
      const sh = this.add.image(st.x, st.y - 3, "shadow").setScale(st.displayWidth * 0.5 / 64, 13 / 64).setAlpha(0.75).setDepth(st.depth - 1);
      this.world.addAt(sh, Math.max(0, this.world.getIndex(st))); }
    this.block(38, 7, 2, 1); this.statue = st;
    { // mural de contratos (SpriteCook "vk_mural" se existir; senão desenhado em código)
      const key = this.textures.exists("vk_mural") ? "vk_mural" : this.makeBoardTex();
      const b = this.add.image(36 * T + T, 8 * T - 2, key).setOrigin(0.5, 1);   // ao lado da estátua, à esquerda b.setScale(T * 1.25 / b.width).setDepth(8 * T - 3).setTint(TOWN_TINT);
      b.texture.setFilter(Phaser.Textures.FilterMode.NEAREST); this.world.add(b); this.block(36, 7, 2, 1); this.board = b; }
    this.manhole = { x: 43, y: 9 };
    { const bk = this.textures.exists("vk_bueiro"), mh = this.add.image(43 * T + T / 2, 9 * T + T / 2, bk ? "vk_bueiro" : "decor_manhole").setDepth(-5); mh.setScale(T * (bk ? 1.25 : 0.8) / mh.width); mh.texture.setFilter(Phaser.Textures.FilterMode.NEAREST); this.world.add(mh); }   // descida do bueiro vista de cima (arte própria na fila de geração)
    // decadência: barris, caixas, lixo, varal, carroça, bancos
    // props do SpriteCook (vkp_*), com a versão em código de reserva
    const P = (n, code, x, y, w, wCode, fd = 1) => this.textures.exists("vkp_" + n) ? this.art("vkp_" + n, x + (1 - w) / 2, y, w, fd) : A(code, x, y, wCode, fd);
    P("barrel", "barrels", 9, 6, 0.6, 0.8, 0); P("crate", "crates", 24, 6, 0.75, 0.8, 0); P("garbage", "garbage", 33, 7, 0.9, 0.9); P("garbage", "garbage", 12, 11, 0.9, 0.9);
    P("laundry", "laundry", 27, 11, 1.1, 1.4, 0); P("cart", "cart", 25, 11, 0.95, 1.5); P("barrel", "barrels", 16, 11, 0.6, 0.8); P("crate", "crates", 31, 11, 0.75, 0.8);
    P("garbage", "garbage", 41, 11, 0.9, 0.9); P("bench", "bench", 34, 7, 0.95, 0.85); P("barrel", "barrels", 42, 7, 0.6, 0.8);
    P("firewood", "crates", 13, 7, 0.8, 0.8); P("wheel", "garbage", 32, 7, 0.75, 0.9); P("firewood", "crates", 22, 11, 0.8, 0.8); P("barrel", "barrels", 35, 11, 0.6, 0.8);
    // lampiões: as únicas luzes quentes da rua
    this.lamps = [];
    for (const [x, y] of [[4, 7], [10, 11], [13, 7], [20, 11], [24, 7], [29, 11], [33, 11], [37, 11], [41, 7]]) this.lamps.push(A("lamp", x, y, 0.55, 1));
    // NPCs e lugares (na calçada, em frente de cada casa)
    this.zones.push({ name: t("zone_smith_enter"), kind: "smith", x: 5, y: 7, w: 4, h: 1 });
    this.zones.push({ name: t("tavern_title"), kind: "inn", x: 16, y: 7, w: 3, h: 1 });
    this.zones.push({ name: t("zone_potions_enter"), kind: "potions", x: 21, y: 7, w: 3, h: 1 });
    this.zones.push({ name: t("zone_depot_enter"), kind: "depot", x: 26, y: 7, w: 2, h: 1 });
    this.zones.push({ name: t("zone_locker"), kind: "locker", x: 28, y: 7, w: 2, h: 1 });
    this.zones.push({ name: t("zone_board"), kind: "board", x: 36, y: 8, w: 2, h: 1 });
    this.zones.push({ name: t("lodging_title"), kind: "lodging", x: 18, y: 11, w: 3, h: 1 });
    this.zones.push({ name: t("zone_oracle"), kind: "hall", x: 37, y: 8, w: 4, h: 1 });
    this.zones.push({ name: t("zone_sewer_enter"), kind: "sewer", x: 43, y: 9, w: 1, h: 1 });
    this.zones.push({ name: t("zone_gate"), kind: "gate", x: 2, y: 8, w: 1, h: 3, step: true });
    this.testPortals();
  }

  // flechas do Arqueiro no ferreiro: cada clique compra um lote (limitado pela aljava e pelo ouro)
  arrowShop(z, note) {
    const d = Save.voc(this.vocId); d.arrows = d.arrows || {};
    const LOT = { normal: 50, fire: 10, ice: 10, earth: 10, energy: 10, explosive: 1, holy: 1 };
    const cap = arrowCap(d), have = arrowCount(d);
    const buy = k => {
      const room = cap - arrowCount(d), price = ARROWS[k].price, n = Math.min(LOT[k], room, Math.floor(d.gold / price));
      if (room <= 0) return this.arrowShop(z, t("arrows_full"));
      if (n <= 0) return this.arrowShop(z, t("oil_no_gold"));
      d.gold -= n * price; d.arrows[k] = (d.arrows[k] || 0) + n; if (!d.arrowSel) d.arrowSel = k; Save.save(); sfx(this, "pickup", 0.4);
      this.arrowShop(z, t("arrows_bought", { n, name: t("arrow_" + k) }));
    };
    const opts = ARROW_IDS.map(k => [t("arrow_buy_line", { name: t("arrow_" + k), n: LOT[k], price: ARROWS[k].price * LOT[k], have: d.arrows[k] || 0 }), () => buy(k)]);
    opts.push([t("bye2"), () => this.closeDialog()]);
    this.say(t("smith_title"), (note ? note + "\n\n" : "") + t("arrow_shop_text", { n: have, cap, gold: d.gold }), opts);
  }

  // PORTAIS DE TESTE (temporários): levam direto à Encosta dos Goblins e ao chefe dos ratos (5º andar do esgoto).
  // Para remover: apagar esta função, a chamada acima e o trecho "portal" em use().
  testPortals() {
    const P = [
      { x: 38, y: 10, region: "goblin_slope", floor: 1, color: 0x6fd06a, label: "Encosta" },
      { x: 40, y: 10, region: "karhyn_sewers", floor: FLOORS, color: 0xd05a5a, label: "Chefe ratos" },
    ];
    for (const p of P) {
      const cx = p.x * T + T / 2, cy = p.y * T + T / 2;
      const glow = this.add.image(cx, cy, "light").setScale(0.55).setTint(p.color).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(cy - 2);
      const g = this.add.graphics().setDepth(cy - 1);
      g.fillStyle(0x08060c, 0.85).fillEllipse(cx, cy + 4, 46, 22);
      g.lineStyle(3, p.color, 1).strokeEllipse(cx, cy + 4, 46, 22).lineStyle(1, 0xffffff, 0.6).strokeEllipse(cx, cy + 4, 34, 15);
      const lbl = this.add.text(cx, cy - 30, p.label, { fontFamily: "Bulletin, monospace", fontSize: "11px", color: "#ffffff", stroke: "#000", strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(cy + 400);
      this.world.add([glow, g, lbl]);
      this.tweens.add({ targets: glow, alpha: 0.15, scale: 0.7, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: g, scaleY: 1.06, duration: 700, yoyo: true, repeat: -1 });
      this.zones.push({ name: "Portal de teste: " + p.label, kind: "portal", x: p.x, y: p.y, w: 1, h: 1, portal: p });
    }
  }

  // ------------------------------------------------------------ herói
  spawnHero() {
    const from = this.registry.get("townSpawn") || "gate", pos = this.registry.get("townPos");
    const [x, y] = from === "here" && pos ? pos : from === "recall" ? RECALL_SPOT : from === "sewer" ? [41, 9] : [4, 9];
    const h = this.hero = { x, y, px: x * T + T / 2, py: y * T + T - 4, moveT: 0, facing: from === "sewer" ? [-1, 0] : [1, 0], lookLeft: false };
    h.shadow = this.add.image(h.px, h.py - 3, "shadow").setScale(0.9, 0.3);
    const ap = vocAnim(this.vocId);
    h.spr = this.add.sprite(h.px, h.py + 4, ap + "idle_up").setOrigin(0.5, 1).setScale(vocScale(this.vocId)).play(ap + "idle_side");
    this.world.add([h.shadow, h.spr]);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, TOWN_W * T, TOWN_H * T);
    cam.setZoom(this.zoom());
    cam.startFollow(h.spr, true, 0.35, 0.35, 0, 24);
  }
  zoom() { return Phaser.Math.Clamp(Settings.data.zoom || 2.8, 2, 5); }
  zoomBy(d) { Settings.data.zoom = Math.round(Phaser.Math.Clamp(this.zoom() + d, 2, 5) * 10) / 10; Settings.save(); this.cameras.main.setZoom(this.zoom()); }

  update(_, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000), h = this.hero;
    if (this.interior) { this.interiorT = this.dialog ? 0 : this.interiorT + dt; if (this.interiorT > 0.35) { this.interior.destroy(); this.interior = null; } }
    if (this.dayTint) { this.skyUpdate(dt); this.miniUpdate(); }
    if (h.moveT > 0) {
      h.moveT = Math.max(0, h.moveT - dt);
      const k = 1 - h.moveT / h.moveLen;
      h.px = Phaser.Math.Linear(h.fromX, h.toX, k); h.py = Phaser.Math.Linear(h.fromY, h.toY, k);
      if (h.moveT === 0) this.arrived();
    }
    if (h.moveT === 0 && !this.dialog && !this.leaving && !this.bagOpen && !this.arriving) {
      const d = a => (this.keysIn[a] || []).some(k => k.isDown);
      let dx = (d("right") ? 1 : 0) - (d("left") ? 1 : 0), dy = (d("down") ? 1 : 0) - (d("up") ? 1 : 0);
      if (dx || dy) this.tryMove(dx, dy);
    }
    if (h.moveT > 0) h.walkHold = 0.12; else h.walkHold = Math.max(0, (h.walkHold || 0) - dt);
    const [fx, fy] = h.facing, dir = fx ? "side" : (fy < 0 ? "up" : "down");
    if (fx) h.lookLeft = fx < 0;
    const anim = vocAnim(this.vocId) + (h.walkHold > 0 ? "walk" : "idle") + "_" + dir;
    if (h.spr.anims.currentAnim.key !== anim) h.spr.play(anim, true);
    h.spr.setFlipX(dir === "side" && h.lookLeft).setTint(TOWN_TINT);
    h.spr.setPosition(Math.round(h.px), Math.round(h.py + 4)).setDepth(h.py);
    h.shadow.setPosition(h.px, h.py - 3).setDepth(h.py - 1);
    // dica de interação
    const z = this.zoneHere();
    this.hint.setText(z && !z.step && !this.dialog ? `E · ${z.name}` : "");
  }

  tryMove(dx, dy) {
    const h = this.hero;
    h.facing = [dx, dy];
    if (dx && dy && (this.isSolid(h.x + dx, h.y) || this.isSolid(h.x, h.y + dy))) {
      // diagonal travada: tenta só um dos eixos
      if (!this.isSolid(h.x + dx, h.y)) dy = 0; else if (!this.isSolid(h.x, h.y + dy)) dx = 0; else return;
      h.facing = [dx, dy];
    }
    const nx = h.x + dx, ny = h.y + dy;
    if (this.isSolid(nx, ny)) return;
    h.fromX = h.px; h.fromY = h.py; h.x = nx; h.y = ny;
    h.toX = nx * T + T / 2; h.toY = ny * T + T - 4;
    h.moveLen = h.moveT = (dx && dy ? 0.36 : 0.264) / (Settings.data.speed ? Settings.data.speed / 0.75 : 1);
  }

  arrived() {
    const z = this.zoneHere();
    if (z && z.step) this.use(z);
  }

  zoneHere() {
    const h = this.hero;
    return this.zones.find(z => h.x >= z.x && h.x < z.x + z.w && h.y >= z.y && h.y < z.y + z.h);
  }

  interact() {
    if (this.dialog) return;
    const z = this.zoneHere();
    if (z) this.use(z);
  }

  // interior do prédio como cenário da conversa: a sala (arte do SpriteCook) aparece com o NPC dentro e a conversa abre por cima.
  // Some sozinho quando a conversa fecha (ver update).
  showInterior(kind) {
    const I = { smith: ["vk_int_ferreiro", "npc_smith", 0.42, 0.64], inn: ["vk_int_harpa"], potions: ["vk_int_pocoes", "npc_potion_seller", 0.5, 0.415],
      depot: ["vk_int_depot", "npc_depot_guard", 0.36, 0.7], locker: ["vk_int_depot", "npc_depot_guard", 0.36, 0.7], lodging: ["vk_int_acomodacao"] }[kind];
    if (!I || !this.textures.exists(I[0])) return;
    if (this.interior) { if (this.interior.key === I[0]) return; this.interior.destroy(); this.interior = null; }
    this.textures.get(I[0]).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.interior = c; c.key = I[0]; this.interiorT = 0;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x050406, 1).setOrigin(0).setInteractive());
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, I[0]).setOrigin(0.5), s = Math.max(VIEW_H / img.height, VIEW_W / img.width);   // tela cheia (cover)
    img.setScale(s); c.add(img);
    if (I[1]) {
      const idle = I[1] + "_idle", x = img.x + (I[2] - 0.5) * img.displayWidth, y = img.y + (I[3] - 0.5) * img.displayHeight;
      const n = this.anims.exists(idle) ? this.add.sprite(x, y, idle).play(idle) : this.add.image(x, y, I[1]);
      n.setOrigin(0.5, 1).setScale(0.36 * s * 32 / 64 * 1.15);
      c.add([this.add.image(x, y - 2, "shadow").setScale(0.5 * s * 0.5, 0.16 * s * 0.5), n]);
    }
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 220 });
  }

  use(z) {
    const V = VOCATIONS[this.vocId], d = Save.voc(this.vocId);
    if (z.kind === "portal") {   // portal de teste
      this.registry.set("region", z.portal.region); this.registry.set("startFloor", z.portal.floor);
      this.leave("dungeon"); return;
    }
    // história e boatos: cada morador conta um pedaço do que está acontecendo em Karhyn
    const lore = (title, key, back) => {
      const L = townLore()[key], n = (this.loreN = this.loreN || {})[key] = ((this.loreN || {})[key] || 0);
      return [t("ask_lore"), () => { const i = this.loreN[key] % L.length; this.loreN[key]++;
        this.say(title, L[i], [[this.loreN[key] % L.length ? t("lore_more") : t("lore_restart"), () => lore(title, key, back)[1]()], [t("lore_back"), back]]); }];
    };
    this.showInterior(z.kind);
    if (z.kind === "gate") {
      this.say(t("zone_gate"), t("gate_ask"), [[t("gate_leave"), () => this.leave("map")], [t("gate_stay"), () => this.closeDialog()]]);
    } else if (z.kind === "sewer") {
      // a dificuldade continua valendo por baixo (a maior já liberada), mas não aparece mais para o jogador
      const max = (Save.data.diffMax || {})["karhyn_sewers:" + this.vocId] || 1;
      this.say(t("sewer_title"), t("sewer_desc"),
        [[t("sewer_go"), () => { this.registry.set("region", "karhyn_sewers"); this.registry.set("difficulty", max); this.leave("dungeon"); }], [t("sewer_wait"), () => this.closeDialog()]]);
    } else if (z.kind === "potions") {
      const n = Object.values(d.potions).reduce((a, b) => a + b, 0);
      this.say(t("potion_seller"), t("potion_greet", { voc: V.name.toLowerCase(), n, gold: d.gold }),
        [[t("see_potions"), () => { this.registry.set("shopFrom", "town"); this.registry.set("shopTab", "potions"); this.leave("shop"); }], lore(t("potion_seller"), "potions", () => this.use(z)), [t("bye"), () => this.closeDialog()]]);
    } else if (z.kind === "board") {
      this.openBoard();
    } else if (z.kind === "depot") {
      this.say(t("depot_guard"), t("depot_greet", { gold: d.gold }),
        [[t("open_locker"), () => this.openLocker()], lore(t("depot_guard"), "depot", () => this.use(z)), [t("thanks"), () => this.closeDialog()]]);
    } else if (z.kind === "locker") {
      this.openLocker();
    } else if (z.kind === "smith") {
      this.say(t("smith_title"), t("smith_greet"),
        [[t("upgrade_gear"), () => this.openForge()], ...(this.vocId === "archer" ? [[t("buy_arrows"), () => this.arrowShop(z)]] : []), [t("buy_oil", { price: OIL_PRICE }), () => this.buyOil(z)], lore(t("smith_title"), "smith", () => this.use(z)), [t("bye2"), () => this.closeDialog()]]);
    } else if (z.kind === "tower") {
      this.say(t("tower_title"), t("tower_desc"), [[t("tower_go"), () => this.towerView()], [t("tower_stay"), () => this.closeDialog()]]);
    } else if (z.kind === "inn") {
      this.say(t("tavern_title"), t("tavern_desc"), [lore(t("tavern_title"), "inn", () => this.use(z)), [t("leave"), () => this.closeDialog()]]);
    } else if (z.kind === "lodging") {
      this.say(t("lodging_title"), t("lodging_desc"), [[t("lodging_rest"), () => { this.closeDialog(); this.cameras.main.fadeOut(300, 0, 0, 0); this.cameras.main.once("camerafadeoutcomplete", () => this.cameras.main.fadeIn(600, 0, 0, 0)); }], lore(t("lodging_title"), "lodging", () => this.use(z)), [t("leave"), () => this.closeDialog()]]);
    } else if (z.kind === "hall" && !(d.bless > 0)) {
      d.bless = 1; Save.save();
      this.blessingVision(() => this.say(t("zone_oracle"), t("bless_first"), [[t("kneel_thank"), () => this.closeDialog()]]));
    } else if (z.kind === "hall") {
      this.say(t("zone_oracle"), t("bless_train_desc"),
        [[t("pray"), () => this.blessingVision(() => this.say(t("zone_oracle"), t("bless_second"), [[t("stand_up"), () => this.closeDialog()]]))],
         [t("train_attrs"), () => { this.registry.set("shopFrom", "town"); this.registry.set("shopTab", "train"); this.leave("shop"); }], [t("leave"), () => this.closeDialog()]]);
    }
  }

  leave(scene) {
    if (this.leaving) return;
    this.leaving = true; this.closeDialog();
    this.registry.set("townSpawn", scene === "dungeon" ? "sewer" : "gate");
    this.registry.set("townPos", [this.hero.x, this.hero.y]);
    if (scene === "dungeon") this.sound.stopAll();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(scene));
  }

  // ------------------------------------------------------------ interface
  buildUi() {
    const ui = this.uiLayer;
    // título da cidade: aparece grande na chegada e some devagar; volta quando se abre o mapa (Tab/M)
    this.townTitle = this.add.text(VIEW_W / 2, VIEW_H * 0.24, t("town_name"), { fontFamily: FONT_TITLE, fontSize: "54px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 7, resolution: 2 })
      .setOrigin(0.5).setAlpha(0).setShadow(0, 3, "#000", 6, true, true);
    ui.add(this.townTitle); this.showTitle(4200);
    this.goldT = txt(this, VIEW_W - 14, 14, `${VOCATIONS[this.vocId].name} · ◉ ${Save.gold(this.vocId)}`, 14, COLORS.gold).setOrigin(1, 0);
    ui.add(this.goldT);
    ui.add(txt(this, 14, VIEW_H - 22, t("town_controls"), 11, COLORS.dim));
    this.hint = txt(this, VIEW_W / 2, VIEW_H - 70, "", 16, COLORS.text).setOrigin(0.5);
    ui.add(this.hint);
    if (this.textures.exists("vignette")) ui.addAt(this.add.image(0, 0, "vignette").setOrigin(0).setAlpha(0.55), 0);
    // relógio: ícone de sol/lua e a hora
    this.skyIcon = this.add.graphics(); ui.add(this.skyIcon);
    this.skyText = txt(this, VIEW_W - 44, 40, "", 12, COLORS.text).setOrigin(1, 0.5); ui.add(this.skyText);
    // minimapa: chão, construções, NPCs e o bueiro piscando
    const S = 4, mx = VIEW_W - TOWN_W * S - 10, my = VIEW_H - TOWN_H * S - 10;
    this.mini = { S, x: mx, y: my };
    const base = this.add.graphics(); ui.add(base);
    base.fillStyle(0x000000, 0.6).fillRect(mx - 3, my - 3, TOWN_W * S + 6, TOWN_H * S + 6);
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
      const t = this.ground[y][x];
      let c = t === "w" ? 0x55524c : t === "c" || t === "s" ? 0x7a746a : t === "p" ? 0x9a948a : t === "d" ? 0x6a5236 : 0x2e3a26;
      if (t !== "w" && this.solid.has(this.key(x, y))) c = 0x8a3a2a;
      base.fillStyle(c, 1).fillRect(mx + x * S, my + y * S, S, S);
    }
    base.lineStyle(1, 0xc8a050, 0.8).strokeRect(mx - 3, my - 3, TOWN_W * S + 6, TOWN_H * S + 6);
    this.miniDyn = this.add.graphics(); ui.add(this.miniDyn);
    ui.add(txt(this, mx, my - 16, t("sewer_manhole"), 10, "#7fe08a"));
  }

  // ------------------------------------------------------------ hora do dia, chuva e minimapa
  // ciclo completo de 6 minutos; a hora continua de uma visita para a outra
  skyUpdate(dt) {
    let tc = ((this.registry.get("townClock") ?? 0.32) + dt / 360) % 1;
    this.registry.set("townClock", tc);
    // escuridão 0 (dia) .. 1 (noite): dia 0,30–0,62, entardecer até 0,75, noite até 0,18, amanhecer até 0,30
    const d = tc < 0.18 ? 1 : tc < 0.30 ? 1 - (tc - 0.18) / 0.12 : tc < 0.62 ? 0 : tc < 0.75 ? (tc - 0.62) / 0.13 : 1;
    const dusk = (tc > 0.6 && tc < 0.78) ? 1 - Math.abs(tc - 0.69) / 0.09 : (tc > 0.16 && tc < 0.32) ? 1 - Math.abs(tc - 0.24) / 0.08 : 0;
    const lerp = (a, b, k) => Math.round(a + (b - a) * k), rain = this.raining ? 0.85 : 1;
    let r = lerp(118, 44, d), g = lerp(126, 52, d), b = lerp(142, 92, d);   // dia cinzento e fechado; noite quase preta
    r = lerp(r, 150, dusk * 0.3); g = lerp(g, 110, dusk * 0.3); b = lerp(b, 100, dusk * 0.3);
    // estiagem depois da bênção: clareia e esquenta a luz aos poucos, e volta a fechar no fim
    this.sunT = Math.max(0, (this.sunT || 0) - dt);
    this.sunK = Phaser.Math.Linear(this.sunK || 0, this.sunT > 0 ? 1 : 0, Math.min(1, dt * 0.8));
    if (this.sunK > 0.01) { const k = this.sunK * (1 - d * 0.6); r = lerp(r, 236, k); g = lerp(g, 222, k); b = lerp(b, 188, k); }
    if (this.sunRays) this.sunRays.setAlpha(this.sunK * (1 - d * 0.7));
    this.dayTint.setFillStyle(Phaser.Display.Color.GetColor(r * rain | 0, g * rain | 0, b * rain | 0), 1);
    // postes acendem ao anoitecer, com a chama tremendo
    const now = this.time.now / 1000;
    for (const gl of this.lampGlows) gl.setAlpha((0.12 + 0.55 * d) * (0.85 + 0.15 * Math.sin(now * 9 + gl.ph))).setScale(0.45 + 0.25 * d);
    // luminária do herói: lampião (gasta óleo quando escurece) ou Pingente da Deusa
    const dv = Save.voc(this.vocId), lg = dv.equip && dv.equip.light && EQUIP[dv.equip.light.id], h = this.hero;
    if (!this.textures.exists("lamp_soft")) {   // halo suave: some de verdade na borda e não estoura no centro
      const c = this.textures.createCanvas("lamp_soft", 256, 256), x = c.getContext(), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.25, "rgba(255,255,255,0.42)"); gr.addColorStop(0.6, "rgba(255,255,255,0.14)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gr; x.fillRect(0, 0, 256, 256); c.refresh();
    }
    if (!this.heroGlow) { this.heroGlow = this.add.image(0, 0, "lamp_soft").setBlendMode(Phaser.BlendModes.ADD).setDepth(800002).setAlpha(0); this.world.add(this.heroGlow); }
    let on = lg && lg.light && (!lg.light.fuel || dv.oil > 0);
    if (on && lg.light.fuel && d > 0.3) {
      const was = dv.oil; dv.oil = Math.max(0, dv.oil - dt);
      if (Math.floor(was / 10) !== Math.floor(dv.oil / 10) || dv.oil <= 0) Save.save();
      if (dv.oil <= 0) on = false;
    }
    if (on && h) {
      const L = lg.light, m = Math.min(1.3, gearMult(dv.equip.light)), fl = L.fuel ? 0.9 + 0.1 * Math.sin(now * 11) * Math.sin(now * 3.7) : 0.97 + 0.03 * Math.sin(now * 2);
      this.heroGlow.setPosition(h.px, h.py - 14).setTint(L.fuel ? 0xe8c890 : 0xc8d4f0).setScale(L.r * T * m * fl / 128).setAlpha((0.05 + 0.5 * d) * fl);
    } else this.heroGlow.setAlpha(0);
    // ícone
    const ic = this.skyIcon, cx = VIEW_W - 26, cy = 40, night = d > 0.5;
    ic.clear();
    if (night) { ic.fillStyle(0xdfe6f2, 1).fillCircle(cx, cy, 9); ic.fillStyle(0x10141e, 1).fillCircle(cx + 5, cy - 3, 8); }
    else { ic.fillStyle(0xf2c050, 1).fillCircle(cx, cy, 7); ic.lineStyle(2, 0xf2c050, 1); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ic.lineBetween(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13); } }
    if (this.raining) { ic.fillStyle(0x8a94a4, 1).fillEllipse(cx - 4, cy + 6, 18, 9); }
    const hour = Math.floor(((tc * 24) + 0) % 24), min = Math.floor((tc * 24 * 60) % 60);
    this.skyText.setText(`${night ? t("sky_night") : dusk > 0.4 ? (tc < 0.5 ? t("sky_dawn") : t("sky_dusk")) : t("sky_day")}${this.raining ? " · " + t("sky_rain") : ""}  ${String(hour).padStart(2, "0")}:${String(min - min % 10).padStart(2, "0")}`);
    // chuva de vez em quando: 1 a 2 minutos, com intervalos de 1,5 a 4 minutos
    // em Karhyn chove sempre; à noite, relâmpagos clareiam o céu
    // depois de derrotar o último chefe do esgoto, Karhyn sai das sombras: para de chover e o sol volta de vez
    if (this.freed) this.sunT = 999;
    this.raining = !(this.sunT > 0); this.rainFx.emitting = this.raining;
    if (d > 0.5 && this.raining) {
      this.boltT = (this.boltT ?? Phaser.Math.Between(6, 14)) - dt;
      if (this.boltT <= 0) {
        this.boltT = Phaser.Math.Between(9, 26);
        const f = this.boltFx || (this.boltFx = this.uiLayer.addAt(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xdfe8ff, 0).setOrigin(0), 1) && this.uiLayer.getAt(1));
        this.tweens.add({ targets: f, alpha: { from: 0.55, to: 0 }, duration: 120, repeat: Phaser.Math.Between(1, 2), repeatDelay: Phaser.Math.Between(40, 110), onComplete: () => f.setAlpha(0) });
      }
    }
    this.rainVeil.setAlpha(Phaser.Math.Linear(this.rainVeil.alpha, this.raining ? 0.18 : 0, 0.02));
  }

  miniUpdate() {
    const m = this.mini, g = this.miniDyn, S = m.S, h = this.hero;
    g.clear();
    const blink = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    g.fillStyle(0x7fe08a, 0.4 + 0.6 * blink).fillCircle(m.x + (this.manhole.x + 0.5) * S, m.y + (this.manhole.y + 0.5) * S, 4);
    for (const z of this.zones) if (["depot", "potions", "smith", "hall", "inn", "lodging"].includes(z.kind)) g.fillStyle(0xe0bc60, 1).fillRect(m.x + (z.x + z.w / 2) * S - 1, m.y + (z.y + z.h / 2) * S - 1, 3, 3);
    g.fillStyle(0xffffff, 1).fillRect(m.x + h.x * S, m.y + h.y * S, S, S);
  }

  // retrato do NPC: rosto recortado do 1º quadro da animação parada
  portrait(title) {
    const SRC = { [t("depot_guard")]: ["npc_depot_guard_idle", 54], [t("potion_seller")]: ["npc_potion_seller_idle", 64], [t("smith_title")]: ["npc_smith_idle", 64] };
    const e = SRC[title]; if (!e || !this.textures.exists(e[0])) return null;
    const key = "portrait_" + e[0];
    if (!this.textures.exists(key)) {
      const ct = this.textures.createCanvas(key, 73, 73), cc = ct.getContext(); cc.imageSmoothingEnabled = false;
      cc.drawImage(this.textures.get(e[0]).getSourceImage(), e[1], 20, 73, 73, 0, 0, 73, 73); ct.refresh();
    }
    return key;
  }

  // conversa em formato de chat: balões do NPC à esquerda, suas respostas à direita, opções clicáveis embaixo.
  // Responder mostra a sua fala no chat e depois a reação; seguir conversando com o mesmo NPC mantém o histórico.
  say(title, body, buttons) {
    if (!(this.dialog && this.chatWith === title)) { this.closeDialog(); this.chatLog = []; }
    else { this.dialog.destroy(); this.dialog = null; }
    this.chatWith = title;
    this.chatLog.push({ me: false, text: body });
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.dialog = c;
    const inRoom = !!this.interior, w = inRoom ? 430 : 640, x = inRoom ? VIEW_W - w - 10 : VIEW_W / 2 - w / 2, pad = 18,   // dentro de casa: conversa no canto direito, para a sala aparecer
    maxW = w - 2 * pad - 120;
    const port = this.portrait(title);
    const bubbles = this.chatLog.map(m => {
      const t = txt(this, 0, 0, m.text, 13, m.me ? "#1a140c" : COLORS.text, { wordWrap: { width: maxW - 20 }, lineSpacing: 3 });
      return { m, t, h: t.height + 16 };
    });
    let used = 0, first = bubbles.length;
    while (first > 0 && used + bubbles[first - 1].h + 8 <= 230) { first--; used += bubbles[first].h + 8; }
    bubbles.slice(0, first).forEach(bb => bb.t.destroy());
    const optH = 34, header = 70, hgt = header + used + 14 + buttons.length * (optH + 6) + 10, y = VIEW_H - hgt - 12;
    c.add(this.add.nineslice(x, y, "panel", null, w, hgt, 16, 16, 16, 16).setOrigin(0).setInteractive());
    if (port) {
      c.add(this.add.rectangle(x + pad, y + pad - 4, 56, 56, 0x0c0a08).setOrigin(0).setStrokeStyle(2, 0xc8a050));
      c.add(this.add.image(x + pad + 28, y + pad + 24, port).setDisplaySize(52, 52));
    }
    c.add(txt(this, x + pad + (port ? 70 : 0), y + pad + 10, title, 20, COLORS.gold));
    let cy = y + header;
    for (const bb of bubbles.slice(first)) {
      const bw = Math.min(maxW, bb.t.width + 20), bx = bb.m.me ? x + w - pad - bw : x + pad;
      c.add(this.add.rectangle(bx, cy, bw, bb.h, bb.m.me ? 0xc8a050 : 0x2a241c, bb.m.me ? 0.92 : 0.95).setOrigin(0).setStrokeStyle(1, bb.m.me ? 0xe8cc80 : 0x5a4c38));
      bb.t.setPosition(bx + 10, cy + 8); c.add(bb.t);
      cy += bb.h + 8;
    }
    this.dialogBtns = [];
    let oy = y + header + used + 14;
    buttons.forEach(([label, fn], i) => {
      const bw = w - 2 * pad, bx = x + pad;
      const r = this.add.rectangle(bx, oy, bw, optH, 0x1a1612, 0.95).setOrigin(0).setStrokeStyle(1, 0x7a6440).setInteractive({ useHandCursor: true });
      const t = txt(this, bx + 14, oy + optH / 2, `${i + 1}  ›  ${label}`, 14, COLORS.text).setOrigin(0, 0.5);
      const send = () => {
        if (!this.dialog || this.sending) return;
        this.sending = true;
        const keep = this.chatWith, n = this.chatLog.length;
        this.chatLog.push({ me: true, text: label });
        r.setFillStyle(0xc8a050, 0.9); t.setColor("#1a140c");
        // a sua fala aparece por um instante; depois a reação (nova fala, loja, fechar...)
        this.time.delayedCall(220, () => {
          this.sending = false; fn();
          if (this.dialog && this.chatWith === keep && this.chatLog.length === n + 1) this.closeDialog();
        });
      };
      r.on("pointerover", () => this.dialogSelect(i));
      r.on("pointerup", send);
      c.add([r, t]); this.dialogBtns.push({ b: r, t, fn: send });
      oy += optH + 6;
    });
    this.dialogAt = this.time.now;
    this.dialogSelect(0);
  }
  // baú do depot: passa poções entre a mochila e o depot (clique = 1, Shift+clique = todas)
  openLocker() {
    this.closeDialog();
    const d = Save.voc(this.vocId); d.depot = d.depot || { potions: {} };
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.55).setOrigin(0).setInteractive());
    const w = 700, h = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - h / 2;
    c.add(this.add.nineslice(x, y, "panel", null, w, h, 16, 16, 16, 16).setOrigin(0));
    c.add(txt(this, VIEW_W / 2, y + 26, t("depot_title"), 24, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, VIEW_W / 2, y + 52, t("depot_hint"), 11, COLORS.dim).setOrigin(0.5));
    const grid = (title, store, other, gx) => {
      c.add(txt(this, gx + 150, y + 78, title, 16, COLORS.text).setOrigin(0.5));
      for (let i = 0; i < 12; i++) {
        const sx = gx + 12 + (i % 4) * 72, sy = y + 100 + Math.floor(i / 4) * 72;
        c.add(this.add.nineslice(sx, sy, "slot", null, 64, 64, 4, 4, 4, 4).setOrigin(0));
      }
      Object.keys(store).filter(id => store[id] > 0 && POTIONS[id]).forEach((id, i) => {
        const P = POTIONS[id], sx = gx + 12 + (i % 4) * 72 + 32, sy = y + 100 + Math.floor(i / 4) * 72 + 30;
        const ic = this.add.image(sx, sy, P.icon).setInteractive({ useHandCursor: true }); ic.setScale(36 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint);
        ic.on("pointerup", p => {
          const n = p.event.shiftKey ? store[id] : 1;
          store[id] -= n; other[id] = (other[id] || 0) + n; Save.save(); sfx(this, "pickup", 0.4); this.openLocker();
        });
        c.add([ic, txt(this, sx + 26, sy + 24, "×" + store[id], 12, COLORS.text).setOrigin(1)]);
      });
    };
    grid(t("bag_label"), d.potions, d.depot.potions, x + 30);
    grid(t("depot_chest"), d.depot.potions, d.potions, x + w - 330);
    c.add(txt(this, VIEW_W / 2, y + 140, "⇄", 30, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, x + 30, y + h - 44, t("depot_footer", { gold: d.gold }), 12, COLORS.dim));
    const [b, bt] = button(this, x + w - 100, y + h - 38, 140, t("close"), () => this.closeDialog(), 14); c.add([b, bt]);
  }
  // forja do ferreiro: escolhe um item (vestido ou na mochila) e aprimora em +1
  // custo: 2 itens da mesma raridade (o ferreiro pega os mais fracos da mochila) ou Essências de chefe (Lendário)
  buyOil(z) {
    const d = Save.voc(this.vocId);
    if (Save.gold(this.vocId) < OIL_PRICE) return this.say(t("smith_title"), t("oil_no_gold"), [[t("bye2"), () => this.closeDialog()]]);
    Save.addGold(this.vocId, -OIL_PRICE); d.oil = (d.oil || 0) + OIL_FLASK; Save.save();
    this.goldT && this.goldT.setText(`${VOCATIONS[this.vocId].name} · ◉ ${Save.gold(this.vocId)}`);
    this.say(t("smith_title"), t("oil_bought", { min: Math.ceil(d.oil / 60) }), [[t("buy_more"), () => this.buyOil(z)], [t("bye2"), () => this.closeDialog()]]);
  }

  openForge(sel) {
    this.closeDialog();
    const d = Save.voc(this.vocId);
    const all = [...Object.values(d.equip).map(g => ({ g, worn: true })), ...d.gear.map(g => ({ g, worn: false }))].filter(o => EQUIP[o.g.id]);
    if (sel && !all.some(o => o.g === sel)) sel = null;
    sel = sel || (all[0] && all[0].g);
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0).setInteractive());
    const w = Math.min(VIEW_W - 20, 820), h = Math.min(VIEW_H - 20, 440), x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - h / 2;
    c.add(this.add.nineslice(x, y, "panel", null, w, h, 16, 16, 16, 16).setOrigin(0));
    const T_ = (tx, ty, s, size = 13, col = COLORS.text, o) => { const t = txt(this, tx, ty, s, size, col, o); c.add(t); return t; };
    T_(VIEW_W / 2, y + 24, t("forge_title"), 24, COLORS.gold).setOrigin(0.5);
    T_(x + 24, y + 50, t("forge_essences", { n: d.essence || 0 }), 12, "#ffa030");
    // lista de itens
    const GS = 44, cols = 8, gx0 = x + 24, gy0 = y + 74;
    if (!all.length) T_(gx0, gy0, t("no_equip"), 13, COLORS.dim);
    all.slice(0, cols * 7).forEach((o, i) => {
      const g = o.g, gx = gx0 + (i % cols) * GS, gy = gy0 + Math.floor(i / cols) * GS, on = g === sel;
      c.add(this.add.rectangle(gx, gy, GS - 4, GS - 4, on ? 0x3a2e1c : 0x1a1612, 1).setOrigin(0).setStrokeStyle(on ? 3 : 2, on ? 0xe0bc60 : RARITY[g.r].hex));
      c.add(this.add.image(gx + (GS - 4) / 2, gy + (GS - 4) / 2, "eq_" + g.id));
      if (g.p) T_(gx + GS - 7, gy + GS - 18, `+${g.p}`, 10, RARITY[g.r].color).setOrigin(1, 0);
      if (o.worn) T_(gx + 3, gy + 1, t("worn_label"), 9, "#9fe08a");
      c.add(this.add.rectangle(gx, gy, GS - 4, GS - 4, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }).on("pointerup", () => this.openForge(g)));
    });
    T_(gx0, y + h - 40, t("worn_hint"), 11, COLORS.dim);
    // detalhes do item escolhido
    const rx = x + 24 + cols * GS + 18, rw = x + w - 24 - rx;
    if (sel) {
      const E = EQUIP[sel.id], R = RARITY[sel.r], nx = forgeNext(sel);
      c.add(this.add.image(rx + 28, y + 96, "eq_" + sel.id).setScale(1.6));
      T_(rx + 62, y + 76, gearName(sel), 16, R.color);
      T_(rx + 62, y + 98, t("forge_item_line", { rarity: R.name, n: E.lvl }), 12, COLORS.dim);
      T_(rx, y + 130, t("now_label"), 12, COLORS.dim); T_(rx, y + 146, equipStats(sel), 12, COLORS.text, { wordWrap: { width: rw } });
      let yy = y + 196;
      if (!nx) { T_(rx, yy, sel.r === 3 ? t("forge_max_ultra") : t("forge_max_legend"), 13, "#e0bc60", { wordWrap: { width: rw } }); }
      else {
        const after = { id: sel.id, r: nx.to.r, p: nx.to.p };
        T_(rx, yy, t("forge_after", { name: gearName(after), rarity: RARITY[after.r].name }), 12, RARITY[after.r].color); yy += 16;
        T_(rx, yy, equipStats(after), 12, COLORS.text, { wordWrap: { width: rw } }); yy += 40;
        let ok = false, mats = [];
        if (nx.essence) { ok = (d.essence || 0) >= nx.essence; T_(rx, yy, t("forge_cost_ess", { n: nx.essence, have: d.essence || 0 }), 12, ok ? COLORS.text : "#e08070"); }
        else {
          // materiais: os 2 itens mais fracos da mochila com a mesma raridade (nunca os vestidos nem o escolhido)
          mats = d.gear.filter(g => g !== sel && g.r === sel.r).sort((a, b) => EQUIP[a.id].rank - EQUIP[b.id].rank || a.p - b.p).slice(0, nx.items);
          ok = mats.length >= nx.items;
          T_(rx, yy, t("forge_cost_items", { n: nx.items, rarity: RARITY[sel.r].name }) + (ok ? t("forge_melted") : t("forge_have", { n: mats.length })), 12, ok ? COLORS.text : "#e08070");
          mats.forEach((g, i) => { const mx = rx + i * 46, my = yy + 22; c.add(this.add.rectangle(mx, my, 40, 40, 0x1a1612).setOrigin(0).setStrokeStyle(2, RARITY[g.r].hex)); c.add(this.add.image(mx + 20, my + 20, "eq_" + g.id)); });
          if (mats.length) T_(rx + mats.length * 46 + 6, yy + 34, mats.map(gearName).join(", "), 11, COLORS.dim, { wordWrap: { width: rw - mats.length * 46 - 6 } });
        }
        const [b, bt] = button(this, rx + rw / 2, y + h - 80, 220, ok ? t("upgrade_btn") : t("need_materials"), () => {
          if (!ok) return;
          if (nx.essence) d.essence -= nx.essence; else d.gear = d.gear.filter(g => !mats.includes(g));
          const up = after.r > sel.r; sel.r = after.r; sel.p = after.p; Save.save();
          sfx(this, up ? "levelup" : "hit", 0.5); this.cameras.main.flash(200, 255, 190, 90);
          this.openForge(sel);
        }, 15);
        if (!ok) { b.setAlpha(0.5); bt.setAlpha(0.6); }
        c.add([b, bt]);
      }
    } else T_(rx, y + 80, t("choose_left"), 13, COLORS.dim);
    const [b2, t2] = button(this, x + w - 100, y + h - 34, 140, t("close"), () => this.closeDialog(), 14); c.add([b2, t2]);
  }
  // visão da deusa ao receber a bênção: a arte dela em tela cheia, com um zoom lento, raios de luz e um clarão,
  // como se a luz descesse sobre o herói. Usa a arte "vk_goddess_art" (SpriteCook) ou, se faltar, a própria estátua.
  blessingVision(done) {
    this.closeDialog();
    const key = this.textures.exists("vk_goddess_art") ? "vk_goddess_art" : "altar_oraculo";
    const c = this.add.container(0, 0).setAlpha(0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x050406, 1).setOrigin(0).setInteractive());
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, key);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const fit = key === "altar_oraculo" ? (VIEW_H * 0.92) / img.height : Math.max(VIEW_W / img.width, VIEW_H / img.height);
    img.setScale(fit); c.add(img);
    // raios dourados vindos do alto e partículas de luz subindo
    const rays = [];
    for (let i = 0; i < 5; i++) {
      const r = this.add.image(VIEW_W / 2 + (i - 2) * 70, -40, "light").setOrigin(0.5, 0).setScale(0.45, 4.2).setTint(0xffe7a0).setAlpha(0).setAngle((i - 2) * 6).setBlendMode(Phaser.BlendModes.ADD);
      c.add(r); rays.push(r);
      this.tweens.add({ targets: r, alpha: 0.16 + 0.05 * (i % 2), duration: 1800, delay: 400 + i * 160, yoyo: true, hold: 1600, ease: "Sine.inOut" });
    }
    for (let i = 0; i < 26; i++) {
      const m = this.add.image(Phaser.Math.Between(0, VIEW_W), VIEW_H + Phaser.Math.Between(0, 200), "light").setScale(0.03).setTint(0xfff0c0).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
      c.add(m); this.tweens.add({ targets: m, y: m.y - VIEW_H - 220, alpha: 0, duration: Phaser.Math.Between(3500, 6000), delay: Phaser.Math.Between(0, 1800) });
    }
    if (this.textures.exists("vignette")) c.add(this.add.image(0, 0, "vignette").setOrigin(0));
    const vt = this.add.text(VIEW_W / 2, VIEW_H - 54, t("bless_vision_text"),
      { fontFamily: FONT_TITLE, fontSize: "21px", color: "#f0d888", align: "center", stroke: "#0c0608", strokeThickness: 5, lineSpacing: 4, resolution: 2 }).setOrigin(0.5).setAlpha(0).setShadow(0, 2, "#000", 4, true, true); c.add(vt);
    if (key === "vk_goddess_art") {
      // leve animação da arte: a imagem "respira" (sobe e desce devagar), o halo pulsa, a harpa cintila e cai uma chuva fina
      this.tweens.add({ targets: img, y: VIEW_H / 2 - 6, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const halo = this.add.image(VIEW_W / 2, VIEW_H * 0.3, "light").setScale(2.6, 3.2).setTint(0xffe2a0).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD); c.addAt(halo, 2);
      this.tweens.add({ targets: halo, alpha: 0.34, scaleX: 2.9, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const hx = () => img.x + (0.575 - 0.5) * img.displayWidth, hy = () => img.y + (0.26 - 0.5) * img.displayHeight;   // posição da harpa na arte
      const harp = this.add.image(hx(), hy(), "light").setScale(0.35).setTint(0xffd060).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD); c.add(harp);
      this.tweens.add({ targets: harp, alpha: { from: 0.05, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut", onUpdate: () => harp.setPosition(hx(), hy()) });
      for (let i = 0; i < 6; i++) this.time.delayedCall(300 + i * 650, () => {   // notas de luz saindo da harpa
        if (!c.active) return;
        const n = this.add.image(hx(), hy(), "light").setScale(0.05).setTint(0xfff0b0).setBlendMode(Phaser.BlendModes.ADD); c.add(n);
        this.tweens.add({ targets: n, x: n.x + Phaser.Math.Between(-60, 60), y: n.y - Phaser.Math.Between(60, 120), alpha: 0, scale: 0.02, duration: 1600, onComplete: () => n.destroy() });
      });
      if (this.textures.exists("rain_drop")) { const rf = this.add.particles(0, 0, "rain_drop", { x: { min: -40, max: VIEW_W + 60 }, y: -20, lifespan: 900, speedY: { min: 520, max: 640 }, speedX: { min: -70, max: -50 }, alpha: { start: 0.25, end: 0.05 }, frequency: 25, quantity: 2 }); c.add(rf); }
    }
    // aparece, aproxima devagar (como se ela se inclinasse sobre você), clareia e some
    this.tweens.add({ targets: c, alpha: 1, duration: 900 });
    this.tweens.add({ targets: img, scale: fit * 1.14, duration: 6000, ease: "Sine.inOut" });
    this.tweens.add({ targets: t, alpha: 1, delay: 1400, duration: 1200 });
    this.time.delayedCall(3800, () => this.cameras.main.flash(900, 255, 236, 180));
    this.time.delayedCall(5600, () => this.tweens.add({ targets: c, alpha: 0, duration: 700, onComplete: () => { c.destroy(); if (this.dialog === c) this.dialog = null; this.sunBreak(); done && done(); } }));
    // som removido a pedido
  }
  // depois de falar com a Oráculo a chuva para e o sol abre por um breve momento (cerca de 30 s), depois o céu fecha de novo
  sunBreak(sec = 30) {
    this.sunT = sec;
    if (!this.sunRays) {
      this.sunRays = this.add.container(0, 0).setAlpha(0); this.uiLayer.addAt(this.sunRays, 1);
      for (let i = 0; i < 6; i++) {
        const r = this.add.image(VIEW_W * (0.1 + i * 0.17), -60, "light").setOrigin(0.5, 0).setScale(0.6, 6).setAngle(-18).setTint(0xffe6a8).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
        this.sunRays.add(r); this.tweens.add({ targets: r, alpha: 0.08, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
    if (sec < 900) this.msg && this.msg(t("clouds_open"));
  }
  // textura do mural em código (reserva até a arte do SpriteCook): tábua com telhadinho, papéis pregados e dois postes
  makeBoardTex() {
    const k = "board_code"; if (this.textures.exists(k)) return k;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x2a1c10).fillRect(4, 10, 3, 30).fillRect(25, 10, 3, 30);            // postes
    g.fillStyle(0x3a2616).fillRect(0, 8, 32, 3); g.fillStyle(0x1e140a).fillRect(1, 6, 30, 2);   // telhadinho
    g.fillStyle(0x5a3c22).fillRect(2, 11, 28, 18); g.fillStyle(0x4a301a).fillRect(2, 15, 28, 1).fillRect(2, 21, 28, 1);
    const P = [[4, 12, 7, 8, 0xd8c8a0], [12, 13, 8, 7, 0xc8b890], [21, 12, 7, 9, 0xe0d0a8], [6, 21, 8, 6, 0xc0b088], [17, 22, 9, 6, 0xd8c8a0]];
    for (const [x, y, w, h, c] of P) { g.fillStyle(c).fillRect(x, y, w, h); g.fillStyle(0x6a5a40).fillRect(x + 1, y + 2, w - 2, 1).fillRect(x + 1, y + 4, w - 3, 1); g.fillStyle(0x8a1a1a).fillRect(x + w / 2 - 0.5 | 0, y, 1, 1); }
    g.generateTexture(k, 32, 40); g.destroy(); return k;
  }

  // ------------------------------------------------------------ contratos de caça (mural do largo)
  // 3 ofertas (fácil, médio, difícil); um contrato ativo por vez; o progresso conta no esgoto e a recompensa sai no mural.
  openBoard() {
    const d = Save.voc(this.vocId), L = Save.levelInfo(d.xpTotal).level;
    if (!d.contractOffers || !d.contractOffers.length) d.contractOffers = rollContracts(L);
    const c = d.contract, close = [t("leave"), () => this.closeDialog()];
    if (c) {
      const M = MONSTERS[c.kind], done = c.got >= c.n, T_ = CONTRACT_TIERS[c.tier];
      const txt_ = t("contract_desc", { tier: T_.name.toLowerCase(), n: c.n, name: c.n > 1 ? M.plural || M.name + "s" : M.name, got: Math.min(c.got, c.n), xp: c.xp, gold: c.gold, rarity: RARITY[c.item.r].name.toLowerCase(), item: EQUIP[c.item.id].name });
      this.say(t("zone_board"), txt_, done ? [[t("deliver_contract"), () => {
        d.xpTotal += c.xp; Save.addGold(this.vocId, c.gold); d.gear.push(c.item); d.contract = null; d.contractOffers = rollContracts(L); Save.save();
        this.goldT && this.goldT.setText(`${VOCATIONS[this.vocId].name} · ◉ ${Save.gold(this.vocId)}`);
        sfx(this, "levelup", 0.5); this.cameras.main.flash(250, 255, 220, 140);
        this.say(t("zone_board"), t("contract_done", { xp: c.xp, gold: c.gold, gear: gearName(c.item), rarity: RARITY[c.item.r].name }), [[t("see_new_contracts"), () => this.openBoard()], close]);
      }], close] : [[t("abandon_contract"), () => { d.contract = null; Save.save(); this.openBoard(); }], close]);
      return;
    }
    const opts = d.contractOffers.map(o => {
      const M = MONSTERS[o.kind], T_ = CONTRACT_TIERS[o.tier];
      return [t("contract_offer", { tier: T_.name, n: o.n, name: o.n > 1 ? M.plural || M.name + "s" : M.name, xp: o.xp, gold: o.gold, rarity: RARITY[o.item.r].name.toLowerCase() }),
        () => { d.contract = Object.assign({}, o, { got: 0 }); Save.save(); sfx(this, "pickup", 0.4);
          this.say(t("zone_board"), t("contract_taken", { n: o.n, name: o.n > 1 ? M.plural || M.name + "s" : M.name }), [close]); }];
    });
    this.say(t("zone_board"), t("board_desc"), [...opts, close]);
  }
  // vista do alto da torre: o horizonte de Karhyn (provisório: o mapa da região até chegar a arte própria)
  towerView() {
    this.closeDialog();
    const c = this.add.container(0, 0).setAlpha(0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0).setInteractive());
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, "tower_view").setScale(VIEW_W / 512 * 1.08);
    c.add(img);
    this.tweens.add({ targets: img, x: VIEW_W / 2 - 30, scale: VIEW_W / 512 * 1.14, duration: 20000, ease: "Sine.inOut", yoyo: true, repeat: -1 });
    for (let i = 0; i < 6; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, VIEW_W), Phaser.Math.Between(40, VIEW_H - 80), "light").setScale(3, 0.9).setTint(0xc8d0d8).setAlpha(0.07);
      c.add(f); this.tweens.add({ targets: f, x: f.x + VIEW_W + 400, duration: Phaser.Math.Between(25000, 40000), repeat: -1, onRepeat: () => { f.x = -400; } });
    }
    if (this.textures.exists("vignette")) c.add(this.add.image(0, 0, "vignette").setOrigin(0));
    c.add(txt(this, VIEW_W / 2, 30, t("tower_view_title"), 24, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, VIEW_W / 2, 58, t("tower_view_desc"), 12, COLORS.text).setOrigin(0.5));
    const [b, bt] = button(this, VIEW_W / 2, VIEW_H - 40, 200, t("sewer_go"), () => this.tweens.add({ targets: c, alpha: 0, duration: 500, onComplete: () => this.closeDialog() }), 15);
    c.add([b, bt]);
    this.tweens.add({ targets: c, alpha: 1, duration: 700 });
  }
  dialogSelect(i) {
    if (!this.dialogBtns || !this.dialogBtns.length) return;
    this.dialogSel = (i + this.dialogBtns.length) % this.dialogBtns.length;
    this.dialogBtns.forEach((o, k) => { if (o.b && o.b.setStrokeStyle) o.b.setStrokeStyle(k === this.dialogSel ? 2 : 1, k === this.dialogSel ? 0xe8cc80 : 0x7a6440); });
  }
  dialogKey(ev) {
    if (!this.dialog || !this.dialogBtns || !this.dialogBtns.length || this.sending || this.time.now - (this.dialogAt || 0) < 180) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= this.dialogBtns.length) return this.dialogBtns[n - 1].fn();
    if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") return this.dialogSelect(this.dialogSel - 1);
    if (ev.key === "ArrowDown" || ev.key === "ArrowRight") return this.dialogSelect(this.dialogSel + 1);
    if (ev.key === "Enter" || ev.key === " " || ev.key === "e" || ev.key === "E") this.dialogBtns[this.dialogSel || 0].fn();
  }
  closeDialog() { if (this.dialog) { this.dialog.destroy(); this.dialog = null; } this.dialogBtns = null; this.chatWith = null; this.sending = false; }

  showTitle(hold = 2500) {
    const tt = this.townTitle; if (!tt) return;
    this.tweens.killTweensOf(tt); tt.setAlpha(0).setY(VIEW_H * 0.24 + 8);
    this.tweens.add({ targets: tt, alpha: 1, y: VIEW_H * 0.24, duration: 1100, ease: "Sine.out" });
    this.tweens.add({ targets: tt, alpha: 0, delay: 1100 + hold, duration: 2200, ease: "Sine.in" });
  }
  // mapa da cidade em tela (Tab/M): planta grande com os lugares marcados e o título
  toggleMap() {
    if (this.bigMap) { this.bigMap.destroy(); this.bigMap = null; this.tweens.add({ targets: this.townTitle, alpha: 0, duration: 600 }); return; }
    if (this.dialog) return;
    const S = Math.floor(Math.min((VIEW_W - 80) / TOWN_W, (VIEW_H - 170) / TOWN_H)), mx = (VIEW_W - TOWN_W * S) / 2, my = VIEW_H * 0.24 + 52;
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.bigMap = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.72).setOrigin(0).setInteractive().on("pointerup", () => this.toggleMap()));
    const g = this.add.graphics(); c.add(g);
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
      const t = this.ground[y][x];
      let col = t === "w" ? 0x55524c : t === "c" || t === "s" ? 0x7a746a : t === "d" ? 0x6a5236 : 0x2e3a26;
      if (t !== "w" && this.solid.has(this.key(x, y))) col = 0x6a3a2a;
      g.fillStyle(col, 1).fillRect(mx + x * S, my + y * S, S, S);
    }
    g.lineStyle(2, 0xc8a050, 0.9).strokeRect(mx - 3, my - 3, TOWN_W * S + 6, TOWN_H * S + 6);
    const NAMES = { smith: t("smith_title"), inn: t("inn_name"), potions: t("potions_name"), depot: t("depot_name"), lodging: t("lodging_title"), hall: t("oracle_name"), board: t("contracts_name"), sewer: t("sewer_name"), gate: t("gate_name") };
    for (const z of this.zones) if (NAMES[z.kind]) {
      const zx = mx + (z.x + z.w / 2) * S, zy = my + (z.y + z.h / 2) * S;
      g.fillStyle(0xe0bc60, 1).fillCircle(zx, zy, 4);
      c.add(txt(this, zx, zy + (z.y < 9 ? -10 : 10), NAMES[z.kind], 11, COLORS.text).setOrigin(0.5, z.y < 9 ? 1 : 0));
    }
    const h = this.hero; g.fillStyle(0x7fe08a, 1).fillCircle(mx + (h.x + 0.5) * S, my + (h.y + 0.5) * S, 5);
    c.add(txt(this, VIEW_W / 2, my + TOWN_H * S + 16, t("tab_close"), 11, COLORS.dim).setOrigin(0.5, 0));
    this.tweens.killTweensOf(this.townTitle); this.townTitle.setAlpha(0).setY(VIEW_H * 0.24 + 8);
    this.tweens.add({ targets: this.townTitle, alpha: 1, y: VIEW_H * 0.24, duration: 700 });
    this.uiLayer.bringToTop(this.townTitle);
  }
  openMenu() {
    this.say("Karhyn", t("what_to_do"), [[t("back_to_map"), () => this.leave("map")], [t("continue_label"), () => this.closeDialog()]]);
  }

  // ------------------------------------------------------------ atmosfera
  ambience() {
    // tom frio de fim de tarde nublado; luz quente nos postes; névoa baixa passando
    const W = TOWN_W * T, H = TOWN_H * T;
    // luz do dia: um véu em MULTIPLY cuja cor muda com a hora (dia, entardecer, noite, amanhecer)
    this.dayTint = this.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0).setDepth(800000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.world.add(this.dayTint);
    this.lampGlows = [];
    for (const l of this.lamps) {
      const g = this.add.image(l.x, l.y - l.displayHeight * 0.86, "light").setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.35).setDepth(800001);
      this.world.add(g); this.lampGlows.push(g); g.ph = Math.random() * 10;
    }
    // chuva: gotas na tela inteira (camada da interface) e respingos no chão
    if (!this.textures.exists("rain_drop")) { const gr = this.make.graphics({ add: false }); gr.fillStyle(0xffffff).fillRect(0, 0, 1, 12); gr.generateTexture("rain_drop", 1, 12); gr.destroy(); }
    this.rainFx = this.add.particles(0, 0, "rain_drop", { x: { min: -40, max: VIEW_W + 80 }, y: -20, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: { min: -90, max: -60 },
      rotate: 8, alpha: { start: 0.45, end: 0.25 }, tint: 0xb4c4dc, quantity: 3, frequency: 12, emitting: false });
    this.uiLayer.addAt(this.rainFx, 1);
    this.rainVeil = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x10141e, 0).setOrigin(0); this.uiLayer.addAt(this.rainVeil, 1);
    this.raining = true; this.rainT = Phaser.Math.Between(240, 480); this.rainFx.emitting = true;
    this.freed = Object.keys(Save.data.cleared).some(k => k.startsWith("karhyn_sewers:"));
    if (this.freed) { this.sunT = 999; this.sunK = 1; this.sunBreak(999); }
    for (let i = 0; i < 8; i++) {
      const f = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), "light").setScale(Phaser.Math.FloatBetween(3, 5), Phaser.Math.FloatBetween(0.8, 1.2))
        .setTint(0xc8d0d8).setAlpha(Phaser.Math.FloatBetween(0.04, 0.08)).setDepth(800002);
      this.world.add(f);
      this.tweens.add({ targets: f, x: f.x + W, duration: Phaser.Math.Between(40000, 70000), repeat: -1, onRepeat: () => { f.x = -600; } });
    }
    // chama dos postes tremendo
    for (const l of this.lamps) {
      const fl = this.add.image(l.x, l.y - l.displayHeight * 0.88, "light").setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.07, 0.09).setDepth(l.depth + 1);
      this.world.add(fl);
      this.tweens.add({ targets: fl, scaleX: 0.05, scaleY: 0.1, alpha: 0.7, duration: Phaser.Math.Between(90, 160), yoyo: true, repeat: -1 });
    }
    // feixe de luz sobre a estátua da deusa: coluna pálida que desce do céu, com poeira brilhando dentro
    const st = this.statue, bx = st.x, by = st.y - st.displayHeight * 0.5;
    const beam = this.add.image(bx, by - 120, "light").setTint(0xfff0c8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55, 3.2).setAlpha(0.32).setDepth(800003);
    const pool = this.add.image(bx, st.y - 6, "light").setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.35).setAlpha(0.4).setDepth(800003);
    this.world.add([beam, pool]);
    this.tweens.add({ targets: [beam, pool], alpha: "*=0.75", duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const motes = this.add.particles(bx, by - 40, "light", { x: { min: -14, max: 14 }, y: { min: -90, max: 30 }, lifespan: 2400, speedY: { min: 6, max: 14 },
      scale: { start: 0.012, end: 0.004 }, alpha: { start: 0.8, end: 0 }, tint: 0xfff0c0, frequency: 160, blendMode: "ADD" });
    motes.setDepth(800004); this.world.add(motes);
  }

  // ------------------------------------------------------------ artes provisórias (até chegarem as do SpriteCook)
  makePlaceholders() {
    const mk = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false }); draw(g, w, h); g.generateTexture(key, w, h); g.destroy();
    };
    const stone = 0x6e6a64, stoneD = 0x4a4744, stoneL = 0x8e8a82, roof = 0x7a2e24, roofD = 0x5a2018, roofL = 0x94402e,
      plaster = 0xcfc4ae, beam = 0x3a2a1e, green = 0x2e5a34, greenD = 0x1e3e24, thatch = 0x9a7a3a, thatchD = 0x6e5422;
    const banner = (g, x, y, h) => { g.fillStyle(0x2a2420).fillRect(x + 4, y - 14, 2, h + 14); g.fillStyle(green).fillRect(x, y, 10, h); g.fillStyle(greenD).fillRect(x + 7, y, 3, h); g.fillTriangle(x, y + h, x + 10, y + h, x + 5, y + h + 6); g.fillStyle(0xc8a050).fillRect(x + 3, y + 6, 4, 4); };
    // casa de enxaimel com telhado de telha
    const house = (g, w, h, thatched) => {
      const wallTop = Math.round(h * 0.52);
      g.fillStyle(plaster).fillRect(6, wallTop, w - 12, h - wallTop);
      g.fillStyle(beam); for (let x = 6; x < w - 6; x += 30) g.fillRect(x, wallTop, 5, h - wallTop);
      g.fillRect(6, wallTop, w - 12, 5); g.fillRect(6, h - 6, w - 12, 6);
      g.fillStyle(0x2a1c12).fillRect(w / 2 - 12, h - 44, 24, 38); g.fillStyle(0x4a3220).fillRect(w / 2 - 9, h - 41, 18, 35);
      for (const x of [26, w - 46]) { g.fillStyle(beam).fillRect(x - 2, wallTop + 16, 24, 22); g.fillStyle(0xe0a040).fillRect(x + 2, wallTop + 20, 16, 14); g.fillStyle(beam).fillRect(x + 9, wallTop + 20, 2, 14); }
      const c = thatched ? thatch : roof, cd = thatched ? thatchD : roofD, cl = thatched ? 0xb8964a : roofL;
      g.fillStyle(c).fillTriangle(0, wallTop + 4, w, wallTop + 4, w / 2, 4); g.fillRect(0, wallTop - 10, w, 14);
      g.fillStyle(cd); for (let y = 14; y < wallTop; y += 9) g.fillRect(Math.max(2, w / 2 - (y - 4) * w / 2 / wallTop), y, Math.min(w - 4, (y - 4) * w / wallTop), 2);
      g.fillStyle(cl).fillRect(w / 2 - 2, 6, 4, wallTop - 6);
      if (!thatched) { g.fillStyle(stoneD).fillRect(w * 0.7, 10, 14, 26); g.fillStyle(stone).fillRect(w * 0.7 + 2, 10, 10, 4); }
    };
    mk("town_house_red", 160, 150, (g, w, h) => house(g, w, h, false));
    mk("town_house_thatch", 170, 150, (g, w, h) => house(g, w, h, true));
    // salão de colunas: telhado, frontão, colunas brancas com estandartes verdes, degraus
    mk("town_hall", 420, 260, (g, w, h) => {
      g.fillStyle(roofD).fillRect(10, 20, w - 20, 80); g.fillStyle(roof); for (let y = 24; y < 96; y += 10) g.fillRect(12, y, w - 24, 6);
      g.fillStyle(stoneL).fillTriangle(w / 2 - 70, 100, w / 2 + 70, 100, w / 2, 50); g.fillStyle(stone).fillRect(w / 2 - 70, 96, 140, 6);
      g.fillStyle(0xd8d0c0).fillRect(16, 100, w - 32, 16);
      g.fillStyle(stoneD).fillRect(24, 116, w - 48, 104);
      for (let x = 30, i = 0; x < w - 40; x += 46, i++) {
        g.fillStyle(0xe8e0d0).fillRect(x, 116, 18, 104); g.fillStyle(0xb8b0a0).fillRect(x + 13, 116, 5, 104);
        if (i % 2 === 1 && Math.abs(x - w / 2) > 30) banner(g, x + 24, 124, 50);
      }
      g.fillStyle(0x1a1410).fillRect(w / 2 - 22, 150, 44, 70);
      g.fillStyle(stone).fillRect(14, 220, w - 28, 12); g.fillStyle(stoneL).fillRect(30, 232, w - 60, 12); g.fillStyle(stone).fillRect(50, 244, w - 100, 14);
    });
    // torre de vigia: pedra, janelas estreitas, terraço com árvore e estandartes
    mk("town_tower", 130, 320, (g, w, h) => {
      g.fillStyle(stone).fillRect(18, 70, w - 36, h - 70); g.fillStyle(stoneD).fillRect(w - 36, 70, 18, h - 70);
      g.fillStyle(stoneD); for (let y = 90; y < h; y += 22) for (let x = 22 + ((y / 22) % 2) * 10; x < w - 40; x += 22) g.fillRect(x, y, 14, 2);
      for (const y of [120, 190, 250]) { g.fillStyle(0x14100c).fillRect(w / 2 - 6, y, 12, 26); g.fillStyle(stoneL).fillRect(w / 2 - 8, y - 4, 16, 4); }
      g.fillStyle(stoneL).fillRect(8, 56, w - 16, 18); g.fillStyle(roof).fillRect(8, 70, w - 16, 6);
      g.fillStyle(stoneL); for (let x = 8; x < w - 12; x += 20) g.fillRect(x, 44, 12, 14);
      g.fillStyle(0x3a2a1a).fillRect(w / 2 - 3, 26, 6, 26);
      g.fillStyle(0x2e4a26).fillCircle(w / 2, 22, 22); g.fillStyle(0x3e6030).fillCircle(w / 2 - 8, 16, 12); g.fillCircle(w / 2 + 10, 20, 10);
      banner(g, 6, 70, 70); banner(g, w - 16, 70, 70);
    });
    // portão: arco central entre duas torres com ameias, portas abertas e estandartes
    mk("town_gate", 400, 300, (g, w, h) => {
      const tw = 110;
      g.fillStyle(stone).fillRect(0, 60, tw, h - 60).fillRect(w - tw, 60, tw, h - 60);
      g.fillStyle(stoneD).fillRect(tw - 18, 60, 18, h - 60).fillRect(w - 18, 60, 18, h - 60);
      g.fillStyle(stoneL); for (let x = 0; x < tw; x += 24) { g.fillRect(x, 40, 14, 20); g.fillRect(w - tw + x, 40, 14, 20); }
      g.fillStyle(stone).fillRect(tw, 100, w - 2 * tw, 70); g.fillStyle(stoneL); for (let x = tw; x < w - tw; x += 24) g.fillRect(x, 84, 14, 16);
      g.fillStyle(0x0e0c0a).fillRect(tw + 20, 140, w - 2 * tw - 40, h - 140); g.fillCircle(w / 2, 140, (w - 2 * tw - 40) / 2);
      g.fillStyle(0x4a3220).fillRect(tw + 20, 150, 24, h - 150).fillRect(w - tw - 44, 150, 24, h - 150);
      g.fillStyle(stoneD); for (let y = 80; y < h; y += 24) for (let x = 6; x < tw - 20; x += 26) { g.fillRect(x, y, 18, 2); g.fillRect(w - tw + x, y, 18, 2); }
      banner(g, 40, 60, 90); banner(g, w - 50, 60, 90);
      g.fillStyle(0x5a5650).fillRect(tw - 2, h - 46, 20, 46).fillRect(w - tw - 18, h - 46, 20, 46); g.fillCircle(tw + 8, h - 52, 9).fillCircle(w - tw - 8, h - 52, 9);
    });
    mk("town_fountain", 150, 110, (g, w, h) => {
      g.fillStyle(stoneD).fillEllipse(w / 2, h - 34, w - 4, 64); g.fillStyle(stone).fillEllipse(w / 2, h - 40, w - 4, 60);
      g.fillStyle(0x2a4a5a).fillEllipse(w / 2, h - 42, w - 26, 42); g.fillStyle(0x3e6a7a).fillEllipse(w / 2 - 10, h - 46, w - 70, 18);
      g.fillStyle(stoneL).fillRect(w / 2 - 7, 22, 14, h - 64); g.fillStyle(stone).fillRect(w / 2 - 14, 18, 28, 8);
      g.fillStyle(0xa8d0e0).fillRect(w / 2 - 2, 4, 4, 16);
    });
    mk("town_cypress", 50, 150, (g, w, h) => {
      g.fillStyle(0x3a2a1a).fillRect(w / 2 - 3, h - 14, 6, 14);
      g.fillStyle(0x1e3020).fillEllipse(w / 2, h / 2 - 6, w - 6, h - 20); g.fillStyle(0x2a4428).fillEllipse(w / 2 - 5, h / 2 - 12, w - 22, h - 46);
      g.fillStyle(0x36522e); for (let y = 20; y < h - 30; y += 12) g.fillRect(w / 2 - 8, y, 6, 4);
    });
    mk("town_lamp", 28, 120, (g, w, h) => {
      g.fillStyle(stoneD).fillRect(4, h - 10, w - 8, 10); g.fillStyle(0x1e1c1c).fillRect(w / 2 - 2, 26, 4, h - 34);
      g.fillStyle(0x1e1c1c).fillRect(4, 8, w - 8, 22); g.fillStyle(0xffb050).fillRect(8, 12, w - 16, 14); g.fillStyle(0x1e1c1c).fillTriangle(2, 9, w - 2, 9, w / 2, 0);
    });
  }
}
