extends Node
## Equipamentos, raridade, aprimoramento, flechas e contratos (porte de equip.js). Autoload "Equip".
## Um item é {id, r: raridade 0–4, p: +N}.

func E(id: String) -> Dictionary: return D.db.EQUIP.get(id, {})
func gear_new(id: String, r := 0) -> Dictionary: return {"id": id, "r": r, "p": 0}
func gear_mult(g: Dictionary) -> float: return D.db.RARITY[int(g.get("r", 0))].mult * (1 + D.db.PLUS_BONUS * int(g.get("p", 0)))
func gear_name(g: Dictionary) -> String: return E(g.id).get("name", g.id) + (" +%d" % int(g.p) if int(g.get("p", 0)) > 0 else "")
func rarity_color(r: int) -> Color: return Color(D.db.RARITY[r].color)
func rarity_name(r: int) -> String: return D.db.RARITY[r].name
func equip_ok(id: String, voc: String) -> bool:
	var e := E(id)
	return not e.has("voc") or voc in e.voc
func icon(id: String) -> Texture2D: return UI.tex("res://assets/items/eq_%s.png" % id)
func item_icon(name: String) -> Texture2D: return UI.tex("res://assets/items/%s.png" % name)

## o que o ferreiro pede para o próximo +1 (null = no máximo)
func forge_next(g: Dictionary) -> Variant:
	var r := int(g.r); var p := int(g.p)
	if r == 4: return null if p >= D.db.LEGEND_MAX else {"essence": D.db.ESSENCE_PER_PLUS, "to": {"r": 4, "p": p + 1}}
	if r == 3 and p >= 5: return null
	p += 1
	return {"items": 2, "to": {"r": r + 1, "p": 0} if p >= 5 and r < 3 else {"r": r, "p": p}}

## kit inicial: lampião, espada e escudo (Cavaleiro), arco e aljava (Arqueiro), armadura
func starter_gear(voc: String) -> void:
	var d := Save.voc(voc)
	if not d.get("lightGear", false):
		d.lightGear = true
		if not d.equip.has("light"): d.equip.light = gear_new("lantern")
	if not d.get("starterGear", false):
		d.starterGear = true
		if voc == "knight":
			if not d.equip.has("weapon"): d.equip.weapon = gear_new("karhyn_sword")
			if not d.equip.has("shield"): d.equip.shield = gear_new("wooden_shield")
		if not d.equip.has("armor"): d.equip.armor = gear_new("leather_armor")
	if voc == "archer" and not d.get("archerKit", false):
		d.archerKit = true
		if not d.equip.has("weapon"): d.equip.weapon = gear_new("bow")
		if not d.equip.has("shield"): d.equip.shield = gear_new("quiver")
		d.arrows.erase("normal")
		if not d.has("arrowSel"): d.arrowSel = "normal"
	Save.save()

func arrow_cap(d: Dictionary) -> int:
	var q = d.equip.get("shield")
	if q and E(q.id).has("quiver"): return int(E(q.id).quiver)
	return 25
func arrow_count(d: Dictionary) -> int:
	var n := 0
	for k in d.arrows:
		if k != "normal": n += int(d.arrows[k])
	return n

## texto curto de atributos do item
func stats_text(g: Dictionary) -> String:
	var e := E(g.id); var m := gear_mult(g); var p: Array = []
	var n := func(v: float) -> String: return str(snappedf(v, 0.1)).replace(".", ",")
	if e.has("atk"): p.append(D.t("eq_atk", {"v": roundi(e.atk * m)}))
	if e.get("def", 0): p.append(D.t("eq_def", {"v": n.call(e.def * m)}))
	if e.get("twoH", false): p.append(D.t("eq_twoh"))
	if e.has("quiver"): p.append(D.t("eq_quiver_cap", {"n": int(e.quiver)}))
	if e.has("el") and e.get("elDmg", 0): p.append(D.t("eq_el_dmg", {"v": roundi(e.elDmg * m), "el": D.db.ELEMENTS[e.el].name.to_lower()}))
	if e.get("crit", 0): p.append(D.t("eq_crit", {"v": "%d%%" % roundi(e.crit * 100)}))
	if e.get("block", 0): p.append(D.t("eq_block", {"v": "%d%%" % roundi(e.block * 100)}))
	if e.get("dodge", 0): p.append(D.t("eq_dodge", {"v": e.dodge}))
	if e.get("ml", 0): p.append("magic level +%d" % int(e.ml))
	if e.get("hpReg", 0): p.append(D.t("eq_hpreg", {"v": n.call(e.hpReg)}))
	if e.get("manaReg", 0): p.append(D.t("eq_manareg", {"v": n.call(e.manaReg)}))
	if e.get("speed", 0): p.append(D.t("eq_speed", {"v": "%d%%" % roundi(e.speed * 100)}))
	for k in e.get("res", {}): p.append("%s %s%d%%" % [D.db.ELEMENTS[k].name, "+" if e.res[k] > 0 else "", roundi(e.res[k] * 100)])
	return " · ".join(p)

## contratos do mural (3 dificuldades)
func roll_contracts(level: int, voc: String) -> Array:
	var out := []
	for tier in D.db.CONTRACT_TIERS.size():
		var T_: Dictionary = D.db.CONTRACT_TIERS[tier]
		var pool: Array = D.db.CONTRACT_POOL[tier]
		var pick: Array = pool[randi() % pool.size()]
		var kind: String = pick[0]; var n := int(pick[1]); var M: Dictionary = D.MONSTERS[kind]
		var xp := roundi(n * M.xp * 3 * T_.mult + level * 20 * (tier + 1))
		var gold := roundi(T_.gold * (1 + level * 0.05))
		var ids := []
		for id in D.db.EQUIP:
			var e := E(id)
			if equip_ok(id, voc) and int(e.get("lvl", 1)) <= level + 3 and e.slot != "light": ids.append(id)
		var id: String = ids[randi() % ids.size()] if ids.size() else "leather_boots"
		var y := randf() * 100; var r := 0
		while r < 4:
			y -= T_.rar[r]
			if y <= 0: break
			r += 1
		out.append({"kind": kind, "n": n, "tier": tier, "xp": xp, "gold": gold, "item": gear_new(id, r)})
	return out

func mon_name(kind: String, n: int) -> String:
	var M: Dictionary = D.MONSTERS[kind]
	return M.get("plural", M.name + "s") if n > 1 else M.name

# ------------------------------------------------------------ peso (weight.js)
const CAP_BASE := 200
const CAP_PER_LVL := {"knight": 25, "archer": 18}
const POTION_OZ := 1.5
const SLOT_OZ := {"weapon": 32, "shield": 34, "helmet": 20, "armor": 60, "legs": 36, "boots": 14, "light": 10, "amulet": 4, "ring": 1}
func oz(id: String) -> float:
	var e := E(id)
	if e.has("oz"): return e.oz
	var base: float = 26.0 if e.get("bow", false) else 14.0 if e.has("quiver") else float(SLOT_OZ.get(e.get("slot", ""), 15))
	if e.get("twoH", false) and not e.get("bow", false): base *= 1.4
	e.oz = roundf(base * (0.8 + 0.5 * e.get("rank", 0)) * 2) / 2
	return e.oz
func cap_of(voc: String, level: int) -> float: return CAP_BASE + CAP_PER_LVL.get(voc, 10) * max(0, level - 1)
func load_of(voc: String) -> float:
	var d := Save.voc(voc); var w := 0.0
	for s in d.equip: w += oz(d.equip[s].id)
	for g in d.gear: w += oz(g.id)
	for p in d.potions: w += int(d.potions[p]) * POTION_OZ
	return w
func cap_speed(voc: String, level: int) -> float:
	var f := load_of(voc) / cap_of(voc, level)
	return 0.8 if f >= 1 else 0.95 if f >= 0.9 else 1.0
func fmt_oz(v: float) -> String: return str(snappedf(v, 0.1)).replace(".", ",")

## vestir / tirar / vender
func equip_item(voc: String, i: int, level: int) -> String:
	var d := Save.voc(voc)
	if i >= d.gear.size(): return "?"
	var g: Dictionary = d.gear[i]; var e := E(g.id)
	if e.is_empty(): return "?"
	if not equip_ok(g.id, voc): return D.t("wrong_voc")
	if level < int(e.lvl): return D.t("need_level", {"n": int(e.lvl)})
	d.gear.remove_at(i)
	if d.equip.has(e.slot): d.gear.append(d.equip[e.slot])
	d.equip[e.slot] = g
	var note := ""
	if e.get("twoH", false) and not e.get("bow", false) and d.equip.has("shield") and not E(d.equip.shield.id).has("quiver"):
		d.gear.append(d.equip.shield); d.equip.erase("shield"); note = D.t("two_hand_shield")
	if e.slot == "shield" and not e.has("quiver") and d.equip.has("weapon") and E(d.equip.weapon.id).get("twoH", false) and not E(d.equip.weapon.id).get("bow", false):
		d.gear.append(d.equip.weapon); d.equip.erase("weapon"); note = D.t("shield_two_hand")
	Save.save(); Sfx.play("pickup", 0.3)
	return note
func unequip(voc: String, slot: String) -> void:
	var d := Save.voc(voc)
	if not d.equip.has(slot): return
	d.gear.append(d.equip[slot]); d.equip.erase(slot); Save.save()
func sell(voc: String, i: int) -> String:
	var d := Save.voc(voc)
	if i >= d.gear.size(): return ""
	var g: Dictionary = d.gear[i]
	var v := maxi(5, roundi(E(g.id).get("price", 20) * 0.25 * gear_mult(g)))
	d.gear.remove_at(i); d.gold += v; Save.save(); Sfx.play("pickup", 0.4)
	return D.t("sold_item", {"name": gear_name(g), "n": v})
