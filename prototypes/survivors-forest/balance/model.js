// Modelo numérico do protótipo (balance-check): lê config.js e calcula DPS, golpes para matar, curva de nível e chefe.
const fs = require("fs"), vm = require("vm");
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + "/../config.js", "utf8").replace("const CFG", "var CFG"), ctx);
const C = ctx.CFG, L = C.weaponLevel;
const sim = {}; for (const v of ["knight", "archer"]) try { sim[v] = JSON.parse(fs.readFileSync(`/tmp/gt/sim_${v}.json`)); } catch (e) {}
const out = { weapons: {}, ttk: {}, xp: [], boss: {}, contact: {}, sim: {} };
// alvos atingidos por uso, numa horda média (densidade estimada: 1 monstro a cada 90×90 px perto do herói)
const dens = 1 / (90 * 90), hits = (id, area) => { const B = C.weapons[id];
  if (B.arc) return Math.max(1, dens * B.arc / 2 * (B.range * area) ** 2);
  if (B.width) return Math.max(1, dens * 2 * B.width * area * B.range * area * 0.6);
  if (B.radius && id === "aura") return Math.max(1, dens * Math.PI * (B.radius * area) ** 2 * 0.7);
  if (B.radius) return Math.max(1, dens * Math.PI * (B.radius * area) ** 2) * (B.hits || 1);
  if (B.pierce) return Math.min(B.pierce, 2.5) * (id === "arrow" ? 1 : 1);
  if (B.count) return B.count; return 1; };
for (const id in C.weapons) {
  const B = C.weapons[id], row = [];
  for (let lv = 1; lv <= L.max; lv++) {
    const n = lv - 1, dmg = B.dmg * (1 + L.dmg * n), cd = B.cd * Math.pow(1 - L.cd, n), area = 1 + L.area * n;
    const extra = id === "arrow" ? 1 + Math.floor(n / 2) : id === "missile" ? 1 + Math.floor(n / 2) / B.count : 1;
    const single = dmg / cd * extra * (1 + C.baseCrit * (C.critMult - 1));
    row.push({ lv, dmg: +dmg.toFixed(1), cd: +cd.toFixed(2), singleDps: +single.toFixed(1), crowdDps: +(single * hits(id, area)).toFixed(1) });
  }
  out.weapons[id] = { voc: B.voc, rows: row };
}
// golpes da arma inicial para matar cada monstro, por minuto (nível da arma esperado: 1 + min/2)
for (const m of ["rat", "bat", "cave_rat"]) {
  out.ttk[m] = [];
  for (let min = 0; min <= 10; min++) {
    const hp = C.monsters[m].hp * C.hpMult * (1 + C.hpGrowth * min * 60), lv = Math.min(L.max, 1 + Math.floor(min / 2));
    const k = C.weapons.slash, a = C.weapons.arrow, dk = k.dmg * (1 + L.dmg * (lv - 1)), da = a.dmg * (1 + L.dmg * (lv - 1));
    out.ttk[m].push({ min, hp: Math.round(hp), slashHits: +(hp / dk).toFixed(2), arrowHits: +(hp / da).toFixed(2) });
  }
}
// curva de experiência: gemas por nível e total acumulado
let tot = 0; for (let n = 1; n <= 40; n++) { const need = Math.round(C.xp.first + C.xp.step * Math.pow(n - 1, C.xp.power)); tot += need; out.xp.push({ lvl: n, need, total: tot }); }
// chefe aos 8 min
{ const t = C.run.bossAt, hp = C.monsters.giant_rat.hp * C.bossHpMult * (1 + C.hpGrowth * t) / 4;
  for (const v of ["knight", "archer"]) { let dps = 0; for (const id in out.weapons) if (out.weapons[id].voc === v) dps += out.weapons[id].rows[Math.min(L.max, 4) - 1].singleDps;
    out.boss[v] = { hp: Math.round(hp), buildDps: +dps.toFixed(1), seconds: +(hp / dps).toFixed(1) }; } }
// mordida em % da vida
for (const v of ["knight", "archer"]) { const H = C.hero[v]; out.contact[v] = {};
  for (const m of ["rat", "bat", "cave_rat", "giant_rat"]) for (const min of [0, 5, 9]) out.contact[v][`${m}@${min}`] = +(100 * Math.max(1, C.monsters[m].dmg * C.dmgMult * (1 + C.dmgGrowth * min * 60) - H.armor) / H.hp).toFixed(1); }
// simulação (bot): nível e abates por tempo
for (const v in sim) out.sim[v] = sim[v].filter((_, i) => i % 3 === 0).map(r => ({ t: r.t, lvl: r.lvl, kills: r.kills, mons: r.mons, hp: r.hp }));
fs.writeFileSync(__dirname + "/model.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ weaponsLv1: Object.fromEntries(Object.entries(out.weapons).map(([k, v]) => [k, [v.rows[0].singleDps, v.rows[0].crowdDps, v.rows[5].crowdDps]])),
  ttkRat: out.ttk.rat.filter(r => r.min % 2 === 0), boss: out.boss, contact: out.contact, xp: out.xp.filter(r => [5, 10, 15, 20, 25].includes(r.lvl)), sim: Object.fromEntries(Object.entries(out.sim).map(([k, v]) => [k, v.slice(-3)])) }, null, 0));
