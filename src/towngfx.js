// Arquitetura de Karhyn desenhada em código (pixel art).
// Tudo é pintado numa resolução de projeto de 32 px por casa e ampliado 2× (casa = 64 px), então cada "pixel" do
// desenho vira um bloco de 2×2 na tela — o mesmo tamanho de pixel dos personagens. Visão 3/4 de cima, como no Tibia:
// telhado visto de cima, fachada virada para baixo, sem paredes laterais.
// Só os NPCs e os lampiões continuam como imagem.
const TG = (() => {
  const D = 32;   // pixels de projeto por casa
  const C = {
    out: "#141218",
    stone: ["#38383e", "#43434a", "#4e4e56", "#595962"], mortar: "#25252a", stoneHi: "#6a6a73",
    moss: ["#33402a", "#3d4c30", "#485a36"],
    wood: ["#33241a", "#3f2d20", "#4c3727", "#5a4230", "#6a4e38"],
    plaster: ["#7e776a", "#8b8476", "#978f80"], timber: "#1e1712",
    roofRed: ["#4a1814", "#5a1e19", "#6b241e", "#7c2c24"], slate: ["#262a33", "#2f343f", "#383f4b", "#424a58"],
    thatch: ["#46391f", "#55462a", "#635233", "#72603c"],
    glass: ["#141a24", "#1d2633", "#2a3646"], lit: ["#a86a2a", "#d8a24a", "#f0c870"],
    leaf: ["#1c2616", "#24311b", "#2d3c21", "#374828", "#43552f"], trunk: ["#2a1f16", "#36281c", "#433224"],
    iron: ["#1e1e24", "#2e2e36", "#44444e"], cloth: { red: ["#5a1416", "#7a1e20", "#962a28"], green: ["#1e3a26", "#2a4c32", "#386040"], cream: ["#b8ac8c", "#cfc3a2", "#ddd2b2"], dark: ["#1a1c26", "#232634", "#2e3242"] },
    water: ["#1d3640", "#25444f", "#305662", "#4a7a86"],
  };
  // gerador determinístico por textura
  const rngOf = seed => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

  class Pix {
    constructor(w, h, seed) { this.w = w; this.h = h; this.cv = document.createElement("canvas"); this.cv.width = w; this.cv.height = h;
      this.c = this.cv.getContext("2d"); this.r = rngOf(seed); }
    rect(x, y, w, h, col) { if (w <= 0 || h <= 0) return; this.c.fillStyle = col; this.c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    px(x, y, col) { this.rect(x, y, 1, 1, col); }
    pick(a) { return a[Math.floor(this.r() * a.length)]; }
    int(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
    speckle(x, y, w, h, cols, dens) { for (let i = 0; i < w * h * dens; i++) this.px(x + this.int(0, w - 1), y + this.int(0, h - 1), this.pick(cols)); }
    ellipse(cx, cy, rx, ry, col) { for (let y = -ry; y <= ry; y++) { const k = Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))); this.rect(cx - rx * k, cy + y, rx * 2 * k + 1, 1, col); } }
    // blocos de pedra: fileiras de 4 px, juntas desencontradas, cada bloco com tom próprio e luz em cima
    stones(x, y, w, h, pal = C.stone, bw = 9, bh = 5, mossy = 0) {
      this.rect(x, y, w, h, C.mortar);
      for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
        let xx = x - (row % 2 ? Math.floor(bw / 2) : 0);
        for (; xx < x + w; xx += bw) {
          const x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + bw - 1), y1 = Math.min(y + h, yy + bh - 1);
          if (x1 <= x0) continue;
          const col = this.pick(pal);
          this.rect(x0, yy, x1 - x0, y1 - yy, col);
          this.rect(x0, yy, x1 - x0, 1, C.stoneHi + "66");
          if (this.r() < 0.25) this.px(this.int(x0, x1 - 1), this.int(yy, y1 - 1), C.mortar);
          if (mossy && this.r() < mossy) this.rect(x0, y1 - 1, this.int(2, x1 - x0), 1, this.pick(C.moss));
        }
      }
    }
    planks(x, y, w, h, vertical = true, pal = C.wood) {
      if (vertical) for (let xx = x; xx < x + w; xx += 4) { this.rect(xx, y, Math.min(4, x + w - xx), h, this.pick(pal)); this.rect(xx, y, 1, h, pal[0]); }
      else for (let yy = y; yy < y + h; yy += 3) { this.rect(x, yy, w, Math.min(3, y + h - yy), this.pick(pal)); this.rect(x, yy, w, 1, pal[0]); }
    }
    // telhado visto de cima: fileiras de telhas, cumeeira clara em cima e beiral escuro embaixo
    roof(x, y, w, h, kind = "red") {
      const pal = kind === "slate" ? C.slate : kind === "thatch" ? C.thatch : C.roofRed;
      this.rect(x, y, w, h, pal[1]);
      if (kind === "thatch") {
        for (let i = 0; i < w * h * 0.5; i++) { const xx = x + this.int(0, w - 1), yy = y + this.int(0, h - 3); this.rect(xx, yy, 1, this.int(2, 4), this.pick(pal)); }
        for (let yy = y + 5; yy < y + h; yy += 6) this.rect(x, yy, w, 1, pal[0]);
      } else {
        for (let row = 0, yy = y + 2; yy < y + h; row++, yy += 4) {
          this.rect(x, yy, w, 1, pal[0]);
          for (let xx = x + (row % 2) * 3; xx < x + w; xx += 6) { this.rect(xx, yy + 1, 1, 3, pal[0]); this.rect(xx + 1, yy + 1, 4, 1, pal[3]); }
        }
      }
      this.rect(x, y, w, 2, pal[3]); this.rect(x, y + 2, w, 1, pal[2]);
      this.rect(x, y + h - 2, w, 2, pal[0]);
    }
    window(x, y, w, h, lit = false, shutters = true) {
      if (shutters) { this.planks(x - 4, y, 3, h, true, C.wood.slice(1)); this.planks(x + w + 1, y, 3, h, true, C.wood.slice(1)); }
      this.rect(x - 1, y - 1, w + 2, h + 2, C.timber);
      const g = lit ? C.lit : C.glass;
      this.rect(x, y, w, h, g[1]); this.rect(x, y, w, Math.ceil(h / 2), g[lit ? 2 : 2]);
      this.rect(x + Math.floor(w / 2), y, 1, h, C.timber); this.rect(x, y + Math.floor(h / 2), w, 1, C.timber);
      this.rect(x - 1, y + h + 1, w + 2, 1, C.stoneHi);
    }
    door(x, y, w, h, arched = false) {
      this.rect(x - 1, y - 1, w + 2, h + 1, C.timber);
      this.planks(x, y, w, h, true);
      if (arched) { for (let i = 0; i < Math.ceil(w / 2); i++) { const d = Math.round(Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - i - 0.5) ** 2)) * 0.6); this.rect(x + i, y - 1, 1, Math.round(w * 0.3) - d, C.out); this.rect(x + w - 1 - i, y - 1, 1, Math.round(w * 0.3) - d, C.out); } }
      this.rect(x, y + Math.floor(h * 0.35), w, 1, C.iron[1]); this.rect(x, y + Math.floor(h * 0.75), w, 1, C.iron[1]);
      this.px(x + w - 3, y + Math.floor(h * 0.55), C.iron[2]);
    }
    crenels(x, y, w, ch = 5, step = 6) {   // ameias vistas de frente/cima
      for (let xx = x; xx < x + w; xx += step) { this.rect(xx, y, Math.min(step - 2, x + w - xx), ch, C.stone[3]); this.rect(xx, y, Math.min(step - 2, x + w - xx), 1, C.stoneHi); }
    }
    banner(x, y, w, h, pal) {
      this.rect(x - 1, y - 2, w + 2, 2, C.iron[2]);
      this.rect(x, y, w, h, pal[1]); this.rect(x, y, 1, h, pal[0]); this.rect(x + w - 1, y, 1, h, pal[2]);
      for (let i = 0; i < Math.ceil(w / 2); i++) { this.rect(x + i, y + h - Math.ceil(w / 2) + i, 1, Math.ceil(w / 2) - i, "rgba(0,0,0,0)"); }
      this.c.clearRect(x + Math.floor(w / 2) - 1, y + h - 3, 3, 3);
      this.rect(x + Math.floor(w / 2) - 1, y + 4, 3, 3, "#b08a3a");
    }
    // contorno escuro de 1 px em volta de tudo que foi desenhado (o acabamento de sprite)
    outline(col = C.out) {
      const d = this.c.getImageData(0, 0, this.w, this.h), a = d.data, W = this.w, H = this.h, add = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (a[(y * W + x) * 4 + 3] > 0) continue;
        const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && a[(yy * W + xx) * 4 + 3] > 200;
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) add.push([x, y]);
      }
      for (const [x, y] of add) this.px(x, y, col);
    }
  }

  // ----------------------------------------------------------------- prédios
  function building(w, seed, o) {
    const W = Math.round(w * D), roofH = o.roofH || 30, storyH = o.storyH || 36, stories = o.stories || 2, top = o.chimney ? 9 : 2;
    const facH = stories * storyH + 4, H = top + roofH + facH;
    const p = new Pix(W, H, seed), fy = top + roofH;
    // fachada
    if (o.wall === "stone") p.stones(0, fy, W, facH, C.stone, 9, 5, 0.12);
    else if (o.wall === "rough") { p.stones(0, fy, W, facH, ["#4a4236", "#564c3e", "#3e372d", "#5e5444"], 7, 4, 0.18); }
    else {
      p.rect(0, fy, W, facH, C.plaster[1]); p.speckle(0, fy, W, facH, C.plaster, 0.25);
      p.rect(0, fy, 2, facH, C.timber); p.rect(W - 2, fy, 2, facH, C.timber);
      for (let s = 0; s < stories; s++) p.rect(0, fy + s * storyH, W, 2, C.timber);
      if (stories > 1) for (let xx = Math.round(W / 3); xx < W - 4; xx += Math.round(W / 3)) p.rect(xx, fy, 2, storyH, C.timber);
      // mãos-francesas em X no andar de cima
      if (stories > 1) for (const bx of [4, W - 14]) for (let i = 0; i < 10; i++) { p.px(bx + i, fy + 4 + Math.round(i * (storyH - 8) / 10), C.timber); p.px(bx + 9 - i, fy + 4 + Math.round(i * (storyH - 8) / 10), C.timber); }
    }
    p.stones(0, fy + facH - 4, W, 4, ["#3a3a40", "#46464c"], 6, 4);          // soco de pedra
    // sombra do beiral
    p.rect(0, fy, W, 2, "rgba(0,0,0,0.35)");
    // telhado + chaminé
    p.roof(0, top, W, roofH, o.roof || "red");
    if (o.chimney) for (const cx of [].concat(o.chimney)) { const x = Math.round(cx * W); p.stones(x, 0, 7, top + 8, C.stone, 4, 3); p.rect(x - 1, 0, 9, 2, C.stone[3]); }
    // porta
    const dw = o.doorW || 16, dh = o.doorH || 30, dx = Math.round((o.doorX != null ? o.doorX : 0.5) * W - dw / 2), dy = fy + facH - 4 - dh;
    p.door(dx, dy, dw, dh, o.arched);
    p.rect(dx - 2, fy + facH - 4, dw + 4, 1, C.stoneHi);
    // janelas: por andar, evitando a porta
    for (let s = 0; s < stories; s++) {
      const wy = fy + s * storyH + (s === stories - 1 ? 7 : 8), ww = 8, wh = s === stories - 1 ? 10 : 11;
      const n = o.windows != null ? o.windows : Math.max(1, Math.floor(W / 34));
      for (let i = 0; i < n; i++) {
        const wx = Math.round((i + 0.5) * W / n - ww / 2);
        if (s === stories - 1 && wx + ww + 4 > dx && wx - 4 < dx + dw) continue;
        p.window(wx, wy, ww, wh, o.lit && p.r() < 0.6, o.wall !== "stone");
        if (o.flowers && s === stories - 1 && p.r() < 0.7) { p.rect(wx - 2, wy + wh + 2, ww + 4, 3, C.wood[2]); p.speckle(wx - 2, wy + wh + 1, ww + 4, 2, ["#9a2a3a", "#c84a4a", "#d8b040", "#3a5a2a"], 0.8); }
      }
    }
    if (o.extra) o.extra(p, { W, H, fy, facH, dx, dy, dw, dh, top, roofH });
    p.outline();
    return p.cv;
  }

  const sign = (p, x, y, icon) => {
    p.rect(x, y - 2, 1, 3, C.iron[2]); p.rect(x, y - 2, 8, 1, C.iron[2]);
    p.rect(x + 1, y + 1, 9, 7, C.wood[3]); p.rect(x + 1, y + 1, 9, 1, C.wood[4]);
    icon(x + 2, y + 2);
  };

  const MAKERS = {
    house_red: w => building(w, "house" + w, { stories: 2, roof: "red", chimney: [0.75], flowers: true, lit: true }),
    cottage: w => building(w, "cottage" + w, { stories: 1, storyH: 40, roof: "thatch", roofH: 34, wall: "rough", windows: 2,
      extra: (p, g) => { for (let i = 0; i < 5; i++) p.rect(g.W - 14 + (i % 3) * 4, g.H - 9 - Math.floor(i / 3) * 3, 4, 3, i % 2 ? C.wood[3] : C.wood[2]); } }),
    potion_shop: w => building(w, "potion", { stories: 2, roof: "red", chimney: [0.2], lit: true, windows: 2,
      extra: (p, g) => {
        // vitrine de poções e toldo verde listrado
        const vx = 6, vy = g.fy + g.facH - 4 - 18; p.rect(vx - 1, vy - 1, 22, 15, C.timber); p.rect(vx, vy, 20, 13, C.glass[1]);
        for (let i = 0; i < 6; i++) { const c = ["#c83a3a", "#3a7ad8", "#5ac85a", "#d8a83a", "#a84ad8", "#e8e8e8"][i]; p.rect(vx + 2 + i * 3, vy + 6, 2, 5, c); p.px(vx + 2 + i * 3, vy + 5, "#ddd"); }
        for (let i = 0; i < 24; i++) p.rect(vx - 3 + i, vy - 6, 1, 4, Math.floor(i / 3) % 2 ? C.cloth.green[2] : C.cloth.cream[1]);
        sign(p, g.dx + g.dw + 3, g.dy - 4, (x, y) => { p.rect(x + 2, y + 1, 3, 4, "#5ac8a0"); p.px(x + 3, y, "#ddd"); });
      } }),
    depot: w => building(w, "depot", { stories: 2, roof: "slate", wall: "stone", chimney: [0.15], doorW: 18, windows: 4,
      extra: (p, g) => { sign(p, g.dx + g.dw + 3, g.dy - 3, (x, y) => { p.rect(x, y + 1, 7, 4, C.wood[4]); p.rect(x, y + 2, 7, 1, C.iron[2]); });
        for (let i = 0; i < 3; i++) p.rect(4 + i * 7, g.H - 10, 6, 6, i % 2 ? C.wood[3] : C.wood[2]); } }),
    tavern: w => building(w, "tavern", { stories: 2, roof: "red", chimney: [0.15, 0.85], lit: true, windows: 4, flowers: true, doorW: 16,
      extra: (p, g) => { sign(p, g.dx + g.dw + 3, g.dy - 4, (x, y) => { p.rect(x + 1, y + 1, 4, 4, "#c8a050"); p.rect(x + 5, y + 2, 1, 2, "#c8a050"); p.rect(x + 1, y, 4, 1, "#eee"); });
        for (const bx of [g.dx - 12, g.dx + g.dw + 14]) { p.rect(bx, g.H - 12, 8, 9, C.wood[3]); p.rect(bx, g.H - 10, 8, 1, C.iron[1]); p.rect(bx, g.H - 6, 8, 1, C.iron[1]); } } }),
    smithy: w => building(w, "smithy", { stories: 1, storyH: 48, roof: "slate", roofH: 30, wall: "stone", chimney: [0.12], windows: 0, doorW: 1,
      extra: (p, g) => {
        // frente aberta sob o alpendre: forja acesa no fundo, bigorna, ferramentas
        const ox = 18, ow = g.W - 26, oy = g.fy + 4, oh = g.facH - 8;
        p.rect(ox, oy, ow, oh, "#17130f"); p.rect(ox, oy, ow, 3, "#000");
        p.stones(ox + 4, oy + 6, 18, oh - 6, ["#3a3634", "#45403c"], 5, 4);
        p.rect(ox + 8, oy + oh - 13, 10, 7, "#ff7a1a"); p.rect(ox + 9, oy + oh - 12, 8, 4, "#ffd060"); p.speckle(ox + 6, oy + oh - 17, 14, 5, ["#ff9a2a", "#c84a1a"], 0.2);
        p.rect(ox + ow - 22, oy + oh - 8, 12, 3, C.iron[2]); p.rect(ox + ow - 19, oy + oh - 5, 6, 5, C.iron[1]);        // bigorna
        for (let i = 0; i < 4; i++) p.rect(ox + 28 + i * 5, oy + 8, 1, 9, C.iron[2]);                                  // ferramentas
        for (let i = 0; i < 3; i++) p.rect(ox + ow - 10 + i * 3, oy + 6, 1, 14, "#8a8a96");                            // espadas na parede
        p.rect(ox - 2, oy - 2, 3, oh + 2, C.wood[2]); p.rect(ox + ow - 1, oy - 2, 3, oh + 2, C.wood[2]);               // pilares do alpendre
      } }),
    tower: w => {
      const W = Math.round(w * D), H = 130, p = new Pix(W, H, "tower");
      p.stones(2, 14, W - 4, H - 14, C.stone, 7, 4, 0.1);
      p.rect(0, 8, W, 8, C.stone[2]); p.crenels(0, 2, W, 6, 7); p.rect(0, 14, W, 2, C.mortar);
      p.rect(Math.round(W / 2), -2, 1, 12, C.iron[2]); p.banner(Math.round(W / 2) + 1, 0, 7, 9, C.cloth.dark);
      for (const yy of [32, 62]) for (const xx of [Math.round(W * 0.28), Math.round(W * 0.62)]) { p.rect(xx - 1, yy - 1, 6, 12, C.mortar); p.rect(xx, yy + 1, 4, 9, C.glass[0]); p.rect(xx + 1, yy, 2, 1, C.glass[0]); }
      p.door(Math.round(W / 2) - 7, H - 26, 14, 24, true);
      p.outline(); return p.cv;
    },
    temple: w => {
      const W = Math.round(w * D), H = 200, p = new Pix(W, H, "temple"), cx = W / 2;
      // torre do sino no meio, atrás do telhado
      p.stones(cx - 14, 0, 28, 70, C.stone, 6, 4, 0.05); p.rect(cx - 16, 0, 32, 4, C.stone[3]);
      p.rect(cx - 6, 10, 12, 16, "#0e0c10"); p.ellipse(cx, 18, 4, 4, "#8a6a2a"); p.rect(cx - 1, 6, 2, 4, C.iron[2]);
      p.roof(0, 40, W, 40, "slate");
      // fachada gótica de pedra clara
      const fy = 80; p.stones(0, fy, W, H - fy, ["#55555c", "#606068", "#6a6a72", "#4c4c54"], 8, 5, 0.06);
      for (const bx of [0, W - 10, Math.round(W * 0.3) - 5, Math.round(W * 0.7) - 5]) { p.rect(bx, fy, 10, H - fy, C.stone[1]); p.rect(bx, fy, 1, H - fy, C.stoneHi); }
      // rosácea
      p.ellipse(cx, fy + 22, 14, 14, C.stone[0]); p.ellipse(cx, fy + 22, 12, 12, "#2a1830");
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; p.rect(cx + Math.cos(ang) * 7 - 1, fy + 22 + Math.sin(ang) * 7 - 1, 3, 3, ["#c8402a", "#3a6ac8", "#d8b040", "#5a2a8a"][a % 4]); }
      p.rect(cx - 1, fy + 10, 2, 24, C.stone[3]); p.rect(cx - 12, fy + 21, 24, 2, C.stone[3]); p.ellipse(cx, fy + 22, 3, 3, "#f0c870");
      // vitrais em arco ogival
      for (const wx of [Math.round(W * 0.15), Math.round(W * 0.85)]) {
        p.rect(wx - 6, fy + 18, 12, 42, C.stone[0]); p.rect(wx - 4, fy + 20, 8, 38, "#3a1e3e");
        for (let i = 0; i < 6; i++) p.rect(wx - 4 + (i % 2) * 4, fy + 22 + i * 6, 4, 5, ["#c84a2a", "#3a6ad8", "#d8a83a", "#6a2a9a"][i % 4]);
        for (let i = 0; i < 6; i++) { p.c.clearRect(wx - 6 + i, fy + 18, 1, 6 - i); p.c.clearRect(wx + 5 - i, fy + 18, 1, 6 - i); }
      }
      // portal ogival com degraus e nicho do anjo
      p.rect(cx - 15, fy + 46, 30, H - fy - 50, C.stone[0]);
      p.door(cx - 12, fy + 56, 24, H - fy - 62, true);
      p.rect(cx, fy + 56, 1, H - fy - 62, C.timber);
      p.rect(cx - 5, fy + 40, 10, 12, "#1c1a20"); p.rect(cx - 2, fy + 42, 4, 8, "#c8c0b0"); p.rect(cx - 5, fy + 43, 3, 4, "#a8a090"); p.rect(cx + 2, fy + 43, 3, 4, "#a8a090");
      for (let i = 0; i < 3; i++) p.rect(cx - 18 - i * 3, H - 6 + i * 2, 36 + i * 6, 2, C.stone[2 + (i % 2)]);
      p.outline(); return p.cv;
    },
    gate: w => {
      const W = Math.round(w * D), H = 6 * D, p = new Pix(W, H, "gate"), tw = 2 * D;
      // muro do meio
      p.stones(tw, 36, W - 2 * tw, H - 36, C.stone, 8, 5, 0.08); p.rect(tw, 30, W - 2 * tw, 8, C.stone[2]); p.crenels(tw, 24, W - 2 * tw, 6, 7);
      // arco aberto com portas abertas e grade levantada
      const ax = W / 2 - 22, aw = 44, ay = 86;
      p.rect(ax - 4, ay - 6, aw + 8, H - ay + 6, C.stone[3]);
      p.rect(ax, ay, aw, H - ay, "#1a1816"); p.speckle(ax, ay + 20, aw, H - ay - 20, ["#2a2826", "#302e2b"], 0.3);
      for (let i = 0; i < aw / 2; i++) { const d = Math.round(22 - Math.sqrt(Math.max(0, 22 * 22 - (22 - i) ** 2))); p.rect(ax + i, ay, 1, d, C.stone[3]); p.rect(ax + aw - 1 - i, ay, 1, d, C.stone[3]); }
      for (let xx = ax + 2; xx < ax + aw - 2; xx += 5) p.rect(xx, ay + 2, 1, 14, C.iron[1]);
      p.rect(ax + 2, ay + 8, aw - 4, 1, C.iron[1]); p.rect(ax + 2, ay + 15, aw - 4, 1, C.iron[1]);
      p.planks(ax + 1, ay + 18, 7, H - ay - 20, true); p.planks(ax + aw - 8, ay + 18, 7, H - ay - 20, true);
      // tochas do portal
      for (const tx of [ax - 8, ax + aw + 6]) { p.rect(tx, ay + 30, 2, 8, C.iron[2]); p.rect(tx - 1, ay + 27, 4, 4, "#ff9a2a"); p.px(tx, ay + 26, "#ffe080"); }
      // torres
      for (const tx of [0, W - tw]) {
        p.stones(tx, 14, tw, H - 14, C.stone, 9, 5, 0.1);
        p.rect(tx, 8, tw, 10, C.stone[2]); p.crenels(tx, 0, tw, 8, 8); p.rect(tx, 18, tw, 2, C.mortar);
        p.banner(tx + tw / 2 - 7, 46, 14, 42, C.cloth.dark);
        p.rect(tx + tw / 2 - 1, 104, 3, 16, "#0c0b0e");   // seteira
      }
      p.outline(); return p.cv;
    },
    wall: w => {
      const W = Math.round(w * D), H = 66, p = new Pix(W, H, "wall" + w);
      p.rect(0, 6, W, 12, C.stone[2]); p.speckle(0, 6, W, 12, C.stone, 0.2);            // passadiço visto de cima
      p.crenels(0, 0, W, 7, 8); p.rect(0, 18, W, 2, C.mortar);
      p.stones(0, 20, W, H - 20, C.stone, 9, 5, 0.22);
      for (let i = 0; i < 3; i++) { const vx = p.int(2, W - 4); p.rect(vx, 22, 1, p.int(6, 20), p.pick(C.moss)); }
      return p.cv;   // sem contorno nas laterais: trechos emendam
    },
    wall_tower: w => {
      const W = Math.round(w * D), H = 72, p = new Pix(W, H, "wtower");
      p.ellipse(W / 2, 12, W / 2 - 1, 10, C.stone[2]); p.ellipse(W / 2, 12, W / 2 - 7, 6, "#1a1a1e");
      for (let i = 0; i < 6; i++) { const a = Math.PI * (i / 5); p.rect(W / 2 + Math.cos(a) * (W / 2 - 4) - 3, 12 - Math.sin(a) * 8 - 3, 6, 5, C.stone[3]); }
      p.stones(2, 18, W - 4, H - 18, C.stone, 7, 4, 0.15);
      p.rect(W / 2 - 1, 34, 3, 14, "#0c0b0e");
      p.outline(); return p.cv;
    },
    // ----------------------------------------------------------------- natureza e objetos
    tree: w => {
      const W = Math.round(w * D), H = 104, p = new Pix(W, H, "tree" + w), cx = W / 2;
      p.rect(cx - 5, 60, 10, 36, C.trunk[1]); p.rect(cx - 5, 60, 3, 36, C.trunk[2]); p.rect(cx + 3, 60, 2, 36, C.trunk[0]);
      for (const [dx, len] of [[-12, 8], [-7, 5], [8, 6], [12, 9]]) p.rect(cx + dx * 0.6, 92, Math.abs(dx) * 0.6, 3, C.trunk[0]), p.rect(cx + dx - (dx < 0 ? 0 : 2), 93, 3, 2, C.trunk[1]);
      const blobs = [[0, 32, 30, 24], [-20, 40, 18, 16], [20, 40, 18, 16], [-12, 20, 18, 15], [12, 18, 18, 15], [0, 10, 16, 10], [-24, 52, 12, 9], [24, 52, 12, 9]];
      for (const [bx, by, rx, ry] of blobs) p.ellipse(cx + bx, by, rx, ry, C.leaf[1]);
      for (const [bx, by, rx, ry] of blobs) for (let i = 0; i < rx * ry * 0.9; i++) {
        const a = p.r() * Math.PI * 2, rr = Math.sqrt(p.r()), x = cx + bx + Math.cos(a) * rx * rr, y = by + Math.sin(a) * ry * rr;
        const light = (-(x - cx) * 0.3 - (y - 30)) / 40 + p.r() * 0.6;
        p.rect(x, y, 2, 2, C.leaf[Math.max(0, Math.min(4, Math.round(1.5 + light * 2)))]);
      }
      p.outline(); return p.cv;
    },
    bush: w => { const W = Math.round(w * D), p = new Pix(W, 24, "bush" + w);
      p.ellipse(W / 2, 13, W / 2 - 2, 10, C.leaf[1]);
      for (let i = 0; i < 120; i++) { const x = p.int(3, W - 4), y = p.int(4, 22); if ((x - W / 2) ** 2 / ((W / 2 - 2) ** 2) + (y - 13) ** 2 / 100 > 1) continue; p.rect(x, y, 2, 2, C.leaf[Math.min(4, Math.max(0, Math.round(3 - (y - 4) / 6 + p.r())))]); }
      p.outline(); return p.cv; },
    barrels: w => { const W = Math.round(w * D), p = new Pix(W, 30, "barrels");
      const barrel = (x, y) => { p.rect(x, y, 11, 15, C.wood[3]); p.rect(x, y, 2, 15, C.wood[4]); p.rect(x + 9, y, 2, 15, C.wood[1]);
        p.rect(x, y + 3, 11, 1, C.iron[1]); p.rect(x, y + 11, 11, 1, C.iron[1]); p.ellipse(x + 5, y, 5, 2, C.wood[2]); p.ellipse(x + 5, y, 4, 1, C.wood[1]); };
      barrel(1, 13); barrel(13, 13); barrel(7, 3); p.outline(); return p.cv; },
    crates: w => { const W = Math.round(w * D), p = new Pix(W, 30, "crates");
      const crate = (x, y, s) => { p.rect(x, y, s, s, C.wood[3]); p.rect(x, y, s, 1, C.wood[4]); p.rect(x, y, 1, s, C.wood[4]); p.rect(x + s - 1, y, 1, s, C.wood[1]); p.rect(x, y + s - 1, s, 1, C.wood[1]);
        for (let i = 1; i < s - 1; i++) p.px(x + i, y + i, C.wood[1]); };
      crate(1, 13, 14); crate(14, 15, 11); crate(5, 1, 12); p.rect(15, 6, 9, 9, "#7a6a48"); p.rect(17, 5, 5, 2, "#5a4a30"); p.outline(); return p.cv; },
    bench: w => { const W = Math.round(w * D), p = new Pix(W, 18, "bench");
      p.rect(2, 2, W - 4, 3, C.wood[3]); p.rect(2, 5, W - 4, 1, C.wood[1]); p.rect(1, 8, W - 2, 4, C.wood[4]); p.rect(1, 11, W - 2, 1, C.wood[1]);
      for (const x of [2, W - 4]) { p.rect(x, 1, 2, 16, C.iron[1]); } p.outline(); return p.cv; },
    tavern_table: w => { const W = Math.round(w * D), p = new Pix(W, 28, "table");
      p.rect(2, 6, W - 4, 9, C.wood[3]); p.planks(2, 6, W - 4, 9, false); p.rect(2, 15, W - 4, 3, C.wood[1]);
      for (const x of [4, W - 7]) p.rect(x, 18, 3, 7, C.wood[1]);
      p.rect(8, 3, 4, 5, "#8a8a92"); p.rect(W - 14, 4, 4, 5, "#8a8a92"); p.rect(W / 2, 3, 2, 4, "#e8dcc0"); p.px(W / 2, 2, "#ffd060");
      for (const x of [-1, W - 7]) { p.ellipse(x + 4, 22, 3, 2, C.wood[2]); p.rect(x + 3, 23, 2, 4, C.wood[1]); }
      p.outline(); return p.cv; },
    stall_red: w => stall(w, "red"), stall_green: w => stall(w, "green"),
    well: w => { const W = Math.round(w * D), p = new Pix(W, 46, "well"), cx = W / 2;
      p.rect(cx - 13, 24, 26, 18, C.stone[1]); p.stones(cx - 13, 26, 26, 16, C.stone, 6, 4, 0.2);
      p.ellipse(cx, 24, 13, 5, C.stone[3]); p.ellipse(cx, 24, 10, 3, "#0e1418");
      p.rect(cx - 13, 6, 2, 20, C.wood[2]); p.rect(cx + 11, 6, 2, 20, C.wood[2]); p.rect(cx - 16, 2, 32, 6, C.roofRed[2]); p.rect(cx - 16, 6, 32, 2, C.roofRed[0]);
      p.rect(cx - 11, 11, 22, 2, C.wood[3]); p.rect(cx, 13, 1, 7, "#8a7a5a"); p.rect(cx - 2, 19, 5, 4, C.wood[2]);
      p.outline(); return p.cv; },
    cart: w => { const W = Math.round(w * D), p = new Pix(W, 30, "cart");
      p.rect(2, 10, W - 14, 10, C.wood[3]); p.planks(2, 10, W - 14, 10, true); p.rect(W - 12, 15, 12, 2, C.wood[2]);
      p.speckle(3, 4, W - 16, 7, C.thatch, 0.9); p.ellipse(14, 6, 6, 4, "#8a7a5a"); p.ellipse(24, 7, 6, 4, "#7a6a4a");
      p.ellipse(12, 21, 7, 7, C.wood[1]); p.ellipse(12, 21, 5, 5, "rgba(0,0,0,0)"); p.c.clearRect(8, 18, 9, 7); p.ellipse(12, 21, 1, 1, C.iron[2]);
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4; p.rect(12 + Math.cos(an) * 4, 21 + Math.sin(an) * 4, 1, 1, C.wood[3]); p.rect(12 - Math.cos(an) * 4, 21 - Math.sin(an) * 4, 1, 1, C.wood[3]); }
      p.outline(); return p.cv; },
    signpost: w => { const W = Math.round(w * D), p = new Pix(W, 44, "sign"), cx = W / 2;
      p.rect(cx - 1, 4, 3, 40, C.wood[2]); p.rect(cx - 12, 8, 20, 6, C.wood[3]); p.rect(cx + 8, 9, 3, 4, C.wood[3]); p.rect(cx - 8, 17, 20, 6, C.wood[3]); p.rect(cx - 11, 18, 3, 4, C.wood[3]);
      p.rect(cx - 10, 10, 14, 1, C.wood[1]); p.rect(cx - 6, 19, 14, 1, C.wood[1]); p.outline(); return p.cv; },
    banner: w => { const W = Math.max(10, Math.round(w * D)), p = new Pix(W, 62, "banner");
      p.rect(W / 2 - 1, 0, 2, 62, C.iron[1]); p.banner(1, 4, W - 2, 34, C.cloth.red); p.stones(W / 2 - 4, 56, 8, 6, C.stone, 4, 3); p.outline(); return p.cv; },
    town_fountain: w => { const W = Math.round(w * D), H = 64, p = new Pix(W, H, "fountain"), cx = W / 2;
      p.ellipse(cx, 42, W / 2 - 2, 16, C.stone[1]); p.stones(4, 42, W - 8, 14, ["#5a5a62", "#66666e", "#50505a"], 6, 4);
      p.ellipse(cx, 56, W / 2 - 4, 6, C.stone[1]); p.c.clearRect(0, 58, W, 6);
      p.ellipse(cx, 40, W / 2 - 2, 15, C.stone[3]); p.ellipse(cx, 40, W / 2 - 6, 12, C.water[1]);
      for (let i = 0; i < 40; i++) p.rect(p.int(cx - 30, cx + 28), p.int(32, 48), p.int(2, 5), 1, p.pick([C.water[2], C.water[3]]));
      p.rect(cx - 4, 14, 8, 26, C.stone[2]); p.rect(cx - 4, 14, 2, 26, C.stoneHi); p.ellipse(cx, 16, 10, 4, C.stone[3]); p.ellipse(cx, 16, 8, 2, C.water[2]);
      p.rect(cx - 2, 4, 4, 10, C.stone[3]); p.ellipse(cx, 4, 3, 2, "#bfe0f0");
      p.outline(); return p.cv; },
  };

  // ---- vila de Karhyn (rua única leste–oeste)
  Object.assign(MAKERS, {
    v_smith: w => building(w, "v_smith", { stories: 2, roof: "slate", chimney: [0.2], windows: 2, lit: true,
      extra: (p, g) => { sign(p, g.dx + g.dw + 3, g.dy - 3, (x, y) => { p.rect(x, y + 3, 7, 2, C.iron[2]); p.rect(x + 2, y + 1, 1, 4, C.wood[4]); p.rect(x + 5, y + 1, 1, 4, C.wood[4]); });
        p.rect(g.dx - 12, g.H - 14, 9, 7, "#ff7a1a"); p.rect(g.dx - 11, g.H - 13, 7, 3, "#ffd060"); for (let i = 0; i < 6; i++) p.rect(Math.round(0.2 * g.W) + 2 + (i % 2), 0 - i, 2, 1, "rgba(140,140,150,0.5)"); } }),
    v_inn: w => building(w, "v_inn", { stories: 2, roof: "slate", chimney: [0.15, 0.8], windows: 4, lit: true, doorW: 18,
      extra: (p, g) => { p.rect(g.dx, g.dy + 2, g.dw, g.dh - 2, "#d8a24a"); p.rect(g.dx + 2, g.dy + 4, g.dw - 4, g.dh - 6, "#f0c870");   // porta aberta e acesa
        sign(p, g.dx + g.dw + 3, g.dy - 5, (x, y) => { p.rect(x + 1, y, 1, 5, "#c8a050"); p.rect(x + 1, y, 5, 1, "#c8a050"); for (let i = 0; i < 4; i++) p.rect(x + 2 + i, y + 1 + i, 1, 4 - i, "#c8a050"); }); } }),
    v_potion: w => MAKERS.potion_shop(w),
    v_depot: w => building(w, "v_depot", { stories: 2, roof: "slate", wall: "stone", windows: 2, doorW: 16,
      extra: (p, g) => { p.rect(g.dx + g.dw / 2 - 2, g.dy + g.dh / 2, 4, 4, "#8a7a3a"); sign(p, g.dx + g.dw + 3, g.dy - 3, (x, y) => { p.rect(x, y + 1, 7, 4, C.iron[2]); p.rect(x + 3, y + 2, 1, 2, "#c8a050"); }); } }),
    v_lodging: w => building(w, "v_lodging", { stories: 2, roof: "slate", chimney: [0.7], windows: 3, lit: false,
      extra: (p, g) => { p.window(Math.round(g.W * 0.2), g.fy + 8, 8, 11, true, true);   // poucas janelas acesas
        for (let x = 0; x < g.W; x++) p.rect(x, g.top + g.roofH - 3 + Math.round(Math.sin(x / g.W * Math.PI) * 3), 1, 2, C.slate[0]);   // telhado cedendo
        sign(p, g.dx + g.dw + 3, g.dy - 3, (x, y) => { p.rect(x, y + 3, 6, 2, "#c8b890"); p.rect(x, y + 1, 2, 2, "#c8b890"); p.rect(x, y + 5, 1, 1, C.wood[1]); p.rect(x + 5, y + 5, 1, 1, C.wood[1]); }); } }),
    v_ruin: w => building(w, "v_ruin" + w, { stories: 1, storyH: 40, roof: "thatch", roofH: 30, wall: "rough", windows: 2,
      extra: (p, g) => { p.c.clearRect(Math.round(g.W * 0.6), g.top, Math.round(g.W * 0.25), 8); p.rect(Math.round(g.W * 0.6), g.top + 8, Math.round(g.W * 0.25), 2, C.wood[0]);   // buraco no telhado
        p.planks(Math.round(g.W * 0.15), g.fy + 10, 9, 9, false); } }),
    // portão de pedra a oeste: arco de frente, grade meio levantada
    v_gate: w => { const W = Math.round(w * D), H = 3 * D + 20, p = new Pix(W, H, "v_gate"), cx = W / 2;
      p.stones(0, 14, W, H - 14, C.stone, 8, 5, 0.25); p.rect(0, 8, W, 8, C.stone[2]); p.crenels(0, 2, W, 6, 7); p.rect(0, 16, W, 2, C.mortar);
      const ax = cx - 16, aw = 32, ay = 38; p.rect(ax - 3, ay - 4, aw + 6, H - ay + 4, C.stone[3]); p.rect(ax, ay, aw, H - ay, "#0e0d10");
      for (let i = 0; i < aw / 2; i++) { const d = Math.round(16 - Math.sqrt(Math.max(0, 256 - (16 - i) ** 2))); p.rect(ax + i, ay, 1, d, C.stone[3]); p.rect(ax + aw - 1 - i, ay, 1, d, C.stone[3]); }
      for (let xx = ax + 2; xx < ax + aw - 1; xx += 4) p.rect(xx, ay + 4, 1, 22, C.iron[1]); p.rect(ax + 1, ay + 12, aw - 2, 1, C.iron[1]); p.rect(ax + 1, ay + 25, aw - 2, 2, C.iron[2]);
      for (let i = 0; i < 6; i++) p.rect(p.int(4, W - 5), p.int(20, H - 6), 1, p.int(4, 10), "rgba(140,170,200,0.35)");   // chuva escorrendo
      p.outline(); return p.cv; },
    // portão do muro OESTE visto de cima: duas torres (norte e sul da rua) e o passadiço de pedra cruzando por cima da rua.
    // A passagem corre de oeste para leste, então quem entra pela lateral passa por baixo do passadiço.
    v_gate_side: w => { const W = Math.round(w * D), H = 7 * D, p = new Pix(W, H, "v_gate_side"), TWR = 64, TOP = 52;
      const tower = y0 => {
        p.stones(0, y0, TWR, TOP, C.stone, 8, 5, 0.2);
        p.rect(7, y0 + 7, TWR - 14, TOP - 14, "#2c2c32"); p.speckle(7, y0 + 7, TWR - 14, TOP - 14, ["#34343a", "#26262b"], 0.25);
        for (let x = 0; x < TWR; x += 10) { p.rect(x, y0, 7, 6, C.stone[3]); p.rect(x, y0, 7, 1, C.stoneHi); p.rect(x, y0 + TOP - 6, 7, 6, C.stone[3]); p.rect(x, y0 + TOP - 6, 7, 1, C.stoneHi); }
        for (let y = y0 + 10; y < y0 + TOP - 8; y += 10) { p.rect(0, y, 6, 7, C.stone[3]); p.rect(TWR - 6, y, 6, 7, C.stone[3]); }
        p.stones(0, y0 + TOP, TWR, 64 - TOP, ["#2a2a30", "#33333a", "#3b3b42"], 8, 4, 0.3); p.rect(0, y0 + TOP, TWR, 1, C.mortar);   // face sul da torre
        p.rect(TWR / 2 - 1, y0 + TOP + 3, 2, 6, "#0c0b0e");
      };
      // passadiço sobre a rua (entre as torres), com ameias nas bordas oeste e leste
      const bx = 8, bw = 48, by = 64, bh = 3 * D;
      p.rect(bx + bw, by, 10, bh, "rgba(0,0,0,0.45)");                                   // sombra da passagem no chão, do lado de dentro
      p.stones(bx, by, bw, bh, ["#3c3c42", "#46464c", "#4f4f56"], 9, 6, 0.12);
      p.rect(bx + 7, by, bw - 14, bh, "#303036"); p.speckle(bx + 7, by, bw - 14, bh, ["#38383e", "#2a2a2f"], 0.25);
      for (let y = by + 2; y < by + bh - 4; y += 10) { p.rect(bx, y, 6, 7, C.stone[3]); p.rect(bx, y, 6, 1, C.stoneHi); p.rect(bx + bw - 6, y, 6, 7, C.stone[3]); p.rect(bx + bw - 6, y, 6, 1, C.stoneHi); }
      // pontas da grade de ferro levantada aparecendo na boca da passagem
      for (let y = by + 6; y < by + bh - 4; y += 6) p.rect(bx + bw, y, 3, 2, C.iron[2]);
      p.rect(bx + bw, by + 2, 1, bh - 4, C.iron[1]);
      tower(0); tower(160);
      // tochas nas quinas de dentro
      for (const ty of [56, 164]) { p.rect(TWR, ty, 3, 2, C.iron[2]); p.rect(TWR + 2, ty - 4, 3, 4, "#ff9a2a"); p.px(TWR + 3, ty - 5, "#ffe080"); }
      p.outline(); return p.cv; },
    // entrada do esgoto: arco baixo de pedra com grade enferrujada e água escura escorrendo
    v_sewer: w => { const W = Math.round(w * D), H = 2 * D + 6, p = new Pix(W, H, "v_sewer"), cx = W / 2;
      p.stones(0, 6, W, H - 6, ["#3a3c40", "#44464a", "#4e5054"], 7, 4, 0.35);
      p.rect(cx - 18, 18, 36, H - 18, "#09090b");
      for (let i = 0; i < 18; i++) { const d = Math.round(18 - Math.sqrt(Math.max(0, 324 - (18 - i) ** 2))); p.rect(cx - 18 + i, 18, 1, d, "#4e5054"); p.rect(cx + 17 - i, 18, 1, d, "#4e5054"); }
      for (let xx = cx - 15; xx < cx + 16; xx += 5) p.rect(xx, 22, 2, H - 26, "#5a3a24");
      p.rect(cx - 16, 34, 32, 2, "#6a4428"); p.rect(cx - 16, 48, 32, 2, "#6a4428");
      p.rect(cx - 10, H - 6, 20, 6, "#1c2a24"); p.speckle(cx - 10, H - 6, 20, 6, ["#2a3e34", "#16201c"], 0.5);
      p.outline(); return p.cv; },
    garbage: w => { const W = Math.round(w * D), p = new Pix(W, 18, "garbage" + w);
      p.ellipse(W / 2, 12, W / 2 - 3, 5, "#2e2a22"); for (let i = 0; i < 40; i++) p.rect(p.int(4, W - 6), p.int(6, 15), p.int(1, 3), p.int(1, 2), p.pick(["#4a4232", "#5a4a30", "#3a3a2a", "#6a5a3a", "#7a6a4a", "#2a2a30", "#8a3a2a"]));
      p.rect(W / 2 - 3, 4, 6, 6, C.wood[2]); p.outline(); return p.cv; },
    laundry: w => { const W = Math.round(w * D), p = new Pix(W, 40, "laundry");
      p.rect(1, 2, 2, 38, C.wood[1]); p.rect(W - 3, 2, 2, 38, C.wood[1]);
      for (let x = 3; x < W - 3; x++) p.px(x, 6 + Math.round(Math.sin((x - 3) / (W - 6) * Math.PI) * 3), "#6a6050");
      const cl = [["#6a5a4a", 9, 12], ["#4a5262", 7, 15], ["#7a7060", 10, 10], ["#5a3a3a", 8, 13]];
      let x = 6; for (const [c, cw, chh] of cl) { if (x + cw > W - 4) break; const y = 7 + Math.round(Math.sin((x - 3) / (W - 6) * Math.PI) * 3); p.rect(x, y, cw, chh, c); p.rect(x, y, cw, 1, "#00000055"); x += cw + 3; }
      p.outline(); return p.cv; },
  });

  function stall(w, color) {
    const W = Math.round(w * D), p = new Pix(W, 54, "stall" + color), cl = C.cloth[color];
    p.rect(3, 14, 2, 38, C.wood[1]); p.rect(W - 5, 14, 2, 38, C.wood[1]);
    p.rect(2, 30, W - 4, 18, C.wood[3]); p.planks(2, 36, W - 4, 12, true); p.rect(2, 30, W - 4, 6, C.wood[2]);
    const goods = color === "red" ? ["#a8642a", "#c8823a", "#b83a2a", "#d8c070", "#e0d8b0"] : ["#5a3a6a", "#3a5a8a", "#c8b070", "#8a4a2a", "#e0e0d8"];
    for (let i = 0; i < 9; i++) p.ellipse(6 + i * ((W - 12) / 8), 30 + (i % 2), 3, 2, p.pick(goods));
    for (let x = 0; x < W; x++) { const stripe = Math.floor(x / 5) % 2 ? cl[1] : C.cloth.cream[1]; p.rect(x, 2, 1, 13, stripe); p.rect(x, 2, 1, 1, Math.floor(x / 5) % 2 ? cl[2] : C.cloth.cream[2]); }
    for (let x = 0; x < W; x += 5) p.ellipse(x + 2, 15, 2, 2, Math.floor(x / 5) % 2 ? cl[0] : C.cloth.cream[0]);
    p.outline(); return p.cv;
  }

  // ----------------------------------------------------------------- chão (grama, terra, ruas, calçadas, praça)
  // desenha na resolução de projeto e devolve um canvas do tamanho final (casa = 64 px)
  // grade dupla (SpriteCook, 15 peças): cada canto entre 4 casas escolhe a peça pela máscara TL=1 TR=2 BL=4 BR=8
  const FRAME = [-1, 15, 8, 9, 0, 11, 14, 7, 13, 4, 1, 10, 3, 2, 5, 6];
  function dualGrid(p, img, TW, TH, inside, skipFill = false) {
    if (!img) return;
    const at = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH && inside(x, y);
    for (let y = 0; y <= TH; y++) for (let x = 0; x <= TW; x++) {
      const m = (at(x - 1, y - 1) ? 1 : 0) | (at(x, y - 1) ? 2 : 0) | (at(x - 1, y) ? 4 : 0) | (at(x, y) ? 8 : 0), f = FRAME[m];
      if (f < 0 || (skipFill && m === 15)) continue;
      if (m === 15) {   // miolo: espelha/gira ao acaso para a peça cheia não formar padrão repetido
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, fx = h & 1 ? -1 : 1, fy = h & 2 ? -1 : 1, rot = (h >> 2) & 1;
        p.c.save(); p.c.translate(x * D, y * D); if (rot) p.c.rotate(Math.PI / 2); p.c.scale(fx, fy);
        p.c.drawImage(img, (f % 4) * D, Math.floor(f / 4) * D, D, D, -D / 2, -D / 2, D, D); p.c.restore();
      } else p.c.drawImage(img, (f % 4) * D, Math.floor(f / 4) * D, D, D, x * D - D / 2, y * D - D / 2, D, D);
    }
  }

  function ground(G, TW, TH, T, atlas = {}) {
    const W = TW * D, H = TH * D, p = new Pix(W, H, "chao-karhyn");
    const at = (x, y) => (x < 0 || y < 0 || x >= TW || y >= TH) ? "w" : G[y][x];
    // grama: base + manchas + tufos
    p.rect(0, 0, W, H, "#2a3420");
    for (let i = 0; i < W * H * 0.18; i++) p.rect(p.int(0, W - 1), p.int(0, H - 1), p.int(1, 2), 1, p.pick(["#24301c", "#2f3a24", "#34402a", "#283020", "#39462c"]));
    for (let i = 0; i < W * H * 0.004; i++) { const x = p.int(0, W - 1), y = p.int(0, H - 1); p.rect(x, y, 1, 2, "#43522f"); p.px(x + 1, y + 1, "#3a4a2a"); }
    for (let i = 0; i < W * H * 0.0008; i++) p.px(p.int(0, W - 1), p.int(0, H - 1), p.pick(["#8a7a5a", "#9a3a3a", "#c8b85a"]));   // pedrinhas e flores
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = G[ty][tx], x0 = tx * D, y0 = ty * D;
      if (t === "d") {   // terra batida
        p.rect(x0, y0, D, D, "#3e3022");
        for (let i = 0; i < 90; i++) p.rect(x0 + p.int(0, D - 1), y0 + p.int(0, D - 1), p.int(1, 3), 1, p.pick(["#352a1e", "#4a3a28", "#55432e", "#3a2c20"]));
        for (let i = 0; i < 3; i++) p.rect(x0 + p.int(1, D - 3), y0 + p.int(1, D - 3), 2, 1, "#6a5a44");
        if (p.r() < 0.24) {   // poça de chuva: escura, com o céu frio refletido e um brilho
          const cx = x0 + p.int(9, D - 9), cy = y0 + p.int(8, D - 8), rx = p.int(4, 8), ry = p.int(2, 4);
          p.ellipse(cx, cy, rx + 1, ry + 1, "#2a2218"); p.ellipse(cx, cy, rx, ry, "#1c2430"); p.rect(cx - rx + 2, cy - 1, Math.max(2, rx - 1), 1, "#3e4c60"); p.px(cx + 1, cy, "#8a9ab0");
        }
      } else if (t === "c") {   // paralelepípedos irregulares: fileiras de pedras de tamanhos variados, juntas desencontradas
        p.rect(x0, y0, D, D, "#29292d");
        for (let by = y0, row = 0; by < y0 + D; row++) {
          const rh = p.int(5, 7); let bx = x0 - p.int(0, 5);
          while (bx < x0 + D) {
            const bw = p.int(5, 9), col = p.pick(["#47474c", "#4f4f55", "#56565c", "#424247", "#4c4b47", "#52504b"]);
            const xa = Math.max(x0, bx + 1), xb = Math.min(x0 + D, bx + bw - 1), yb = Math.min(y0 + D, by + rh - 1);
            if (xb - xa >= 2 && yb - by >= 2) {
              p.rect(xa, by + 1, xb - xa, yb - by - 1, col); p.rect(xa + 1, by, xb - xa - 2, 1, col);
              p.rect(xa + 1, by + 1, xb - xa - 2, 1, "#64646a"); p.rect(xa, yb - 1, xb - xa, 1, "#38383d");
            }
            bx += bw;
          }
          by += rh;
        }
      } else if (t === "s") {   // calçada: lajes retangulares
        p.rect(x0, y0, D, D, "#3a3836");
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const bx = x0 + sx * 16 + (sy ? 8 : 0) % 16, by = y0 + sy * 16; const col = p.pick(["#5e5a54", "#68645c", "#56524c"]);
          p.rect(bx + 1, by + 1, 14, 14, col); p.rect(bx + 1, by + 1, 14, 1, "#7a766c"); p.speckle(bx + 2, by + 2, 12, 12, ["#4e4a44", "#6e6a62"], 0.08);
        }
      } else if (t === "p") {   // praça: lajes grandes claras
        p.rect(x0, y0, D, D, "#6e675c");
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const bx = x0 + sx * 16, by = y0 + sy * 16, col = p.pick(["#9c9486", "#a29a8c", "#a69e90", "#989082"]);
          p.rect(bx + 1, by + 1, 15, 15, col); p.rect(bx + 1, by + 1, 15, 1, "#c4bcaa"); p.speckle(bx + 2, by + 2, 13, 13, ["#8a8274", "#bcb4a2"], 0.07);
          if (p.r() < 0.12) p.rect(bx + p.int(3, 10), by + p.int(3, 12), p.int(3, 6), 1, "#6e675c");   // rachadura
        }
      }
    }
    // tilesets do SpriteCook por cima do desenho em código: rua (terra + paralelepípedo) e muro
    if (atlas.street) dualGrid(p, atlas.street, TW, TH, (x, y) => G[y][x] === "d" || G[y][x] === "c", true);   // a peça cheia não é uniforme: miolo fica com a terra em código
    // bordas: meio-fio claro onde pedra encontra grama/terra, tufos de grama avançando, sombra fina
    const paved = t => t === "c" || t === "p" || t === "s";
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = G[ty][tx]; if (!paved(t) && t !== "d") continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at(tx + dx, ty + dy); if (n !== "g") continue;
        const x0 = tx * D, y0 = ty * D;
        const edge = (o, len, col) => dx ? p.rect(x0 + (dx > 0 ? D - 1 - o : o), y0, 1, len, col) : p.rect(x0, y0 + (dy > 0 ? D - 1 - o : o), len, 1, col);
        if (paved(t)) { edge(0, D, "#232326"); edge(1, D, t === "p" ? "#cfc6b2" : "#77746c"); }
        for (let i = 0; i < 9; i++) {   // tufos
          const a = p.int(0, D - 2), len = p.int(1, 3), col = p.pick(["#2f3a24", "#34402a", "#3a4530", "#283020"]);
          if (dx) p.rect(x0 + (dx > 0 ? D - len : 0), y0 + a, len, 2, col); else p.rect(x0 + a, y0 + (dy > 0 ? D - len : 0), 2, len, col);
        }
      }
    }
    // muralhas laterais vistas de cima: passadiço de pedra com ameias dos dois lados
    // (só quando não há tileset de muro: com ele, as faixas cinza destoam)
    if (!atlas.wall) for (let ty = 0; ty < TH; ty++) for (const tx0 of [0, TW - 2]) {
      const x0 = tx0 * D, y0 = ty * D;
      p.stones(x0, y0, 2 * D, D, C.stone, 8, 5, 0.05);
      p.stones(x0 + 6, y0, 2 * D - 12, D, ["#3c3c42", "#46464c", "#4f4f56"], 10, 6, 0.08);
      for (let yy = y0; yy < y0 + D; yy += 8) { p.rect(x0, yy, 6, 5, C.stone[3]); p.rect(x0 + 2 * D - 6, yy, 6, 5, C.stone[3]); }
      p.rect(tx0 === 0 ? x0 + 2 * D : x0 - 3, y0, 3, D, "rgba(0,0,0,0.35)");
    }
    p.rect(0, 0, W, 2 * D, "#1c1c20");
    if (atlas.wall) { for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) if (G[ty][tx] === "w") p.rect(tx * D, ty * D, D, D, "#16201f");
      dualGrid(p, atlas.wall, TW, TH, (x, y) => G[y][x] === "w"); }
    // calçada e largo: tileset de lajes molhadas do SpriteCook por cima do desenho em código
    if (atlas.pave) dualGrid(p, atlas.pave, TW, TH, (x, y) => G[y][x] === "s" || G[y][x] === "c");
    // amplia 2× para a casa de 64 px
    const out = document.createElement("canvas"); out.width = TW * T; out.height = TH * T;
    const oc = out.getContext("2d"); oc.imageSmoothingEnabled = false; oc.drawImage(p.cv, 0, 0, out.width, out.height);
    p.cv.width = p.cv.height = 0;   // libera a memória do rascunho já (celulares têm limite baixo de memória de canvas)
    return out;
  }

  // registra (ou substitui) a textura de uma peça com a largura em casas usada no mapa
  function make(scene, key, kind, wTiles) {
    const k = key || "k2_" + kind;
    if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.addCanvas(k, MAKERS[kind](wTiles));
    return k;
  }
  return { D, MAKERS, make, ground };
})();
