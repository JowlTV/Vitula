extends Node
## Lojas e serviços de Karhyn (porte de town.js e ShopScene): poções, depot, forja, flechas e mural de contratos.
## Cada função recebe a cidade (town.gd) e abre na conversa (town.dlg). Autoload "Shops".

func _win(town, w: float, h: float, title: String) -> Array:
	var c := Control.new(); c.size = Vector2(960, 540)
	var bg := ColorRect.new(); bg.color = Color(0, 0, 0, 0.6); bg.size = Vector2(960, 540); c.add_child(bg)
	var x := 480 - w / 2; var y := 270 - h / 2
	c.add_child(UI.panel(Rect2(x, y, w, h)))
	var tl := UI.lbl(title, 24, UI.GOLD); tl.position = Vector2(x, y + 10); tl.size = Vector2(w, 30); tl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(tl)
	c.add_child(UI.button(Rect2(x + w - 170, y + h - 50, 140, 32), D.t("close"), func(): town.dlg.close()))
	town.dlg.open_window(c)
	return [c, x, y]

func _at(c: Control, l: Control, p: Vector2) -> Control:
	l.position = p; c.add_child(l); return l

# ------------------------------------------------------------ poções (vendedora)
func potion_shop(town) -> void:
	var voc: String = town.voc; var d := Save.voc(voc)
	var r := _win(town, 640, 420, D.t("shop_title")); var c: Control = r[0]; var x: float = r[1]; var y: float = r[2]
	var gl := UI.lbl(D.t("gold_display", {"n": int(d.gold)}), 16, UI.GOLD); gl.size = Vector2(640, 20); gl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; _at(c, gl, Vector2(x, y + 44))
	var i := 0
	for id in D.db.POTIONS:
		var P: Dictionary = D.db.POTIONS[id]
		if not P.has("dur") or (P.has("voc") and not voc in P.voc): continue
		var yy := y + 84 + i * 50
		var ic := UI.icon(UI.tex("res://assets/items/%s.png" % P.icon), Vector2(x + 50, yy + 14), 28)
		if P.has("tint"): ic.modulate = UI.color_int(int(P.tint))
		c.add_child(ic)
		_at(c, UI.lbl("%s  ×%d" % [P.name, int(d.potions.get(id, 0))], 15), Vector2(x + 72, yy - 4))
		var cd: float = P.cd
		_at(c, UI.wrap(UI.lbl("%s  Recarga %s." % [P.desc, ("%d min" % (cd / 60)) if cd >= 60 else ("%d s" % cd)], 11, UI.DIM), 360), Vector2(x + 72, yy + 16))
		for pair in [[1, 470], [5, 554]]:
			var n: int = pair[0]; var cost: int = int(P.price) * n
			c.add_child(UI.button(Rect2(x + pair[1], yy, 74, 28), "%d ×%d" % [cost, n], func():
				if Save.gold(voc) < cost: Sfx.play("hurt", 0.2); return
				d.gold -= cost; d.potions[id] = d.potions.get(id, 0) + n; Save.save(); Sfx.play("pickup", 0.5); potion_shop(town), 12))
		i += 1
	if i == 0: _at(c, UI.lbl(D.t("no_items"), 13, UI.DIM), Vector2(x + 40, y + 100))

# ------------------------------------------------------------ depot (baú): poções entre a mochila e o baú
func locker(town) -> void:
	var voc: String = town.voc; var d := Save.voc(voc)
	var r := _win(town, 700, 380, D.t("depot_title")); var c: Control = r[0]; var x: float = r[1]; var y: float = r[2]
	var hl := UI.lbl(D.t("depot_hint"), 11, UI.DIM); hl.size = Vector2(700, 14); hl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; _at(c, hl, Vector2(x, y + 42))
	var grid := func(title: String, store: Dictionary, other: Dictionary, gx: float):
		var tl := UI.lbl(title, 16); tl.size = Vector2(300, 20); tl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; _at(c, tl, Vector2(gx, y + 66))
		for k in 12: c.add_child(UI.slot(Rect2(gx + 12 + (k % 4) * 72, y + 96 + (k / 4) * 72, 64, 64)))
		var k := 0
		for id in store.keys():
			if int(store[id]) <= 0 or not D.db.POTIONS.has(id): continue
			var P: Dictionary = D.db.POTIONS[id]
			var b := Button.new(); b.flat = true; b.position = Vector2(gx + 12 + (k % 4) * 72, y + 96 + (k / 4) * 72); b.size = Vector2(64, 64); b.focus_mode = Control.FOCUS_NONE
			b.icon = UI.tex("res://assets/items/%s.png" % P.icon); b.expand_icon = true; b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
			if P.has("tint"): b.add_theme_color_override("icon_normal_color", UI.color_int(int(P.tint)))
			b.tooltip_text = P.name
			b.pressed.connect(func():
				var n: int = int(store[id]) if Input.is_key_pressed(KEY_SHIFT) else 1
				store[id] -= n; other[id] = other.get(id, 0) + n; Save.save(); Sfx.play("pickup", 0.4); locker(town))
			c.add_child(b)
			var nl := UI.lbl("×%d" % int(store[id]), 12); nl.position = b.position + Vector2(36, 44); c.add_child(nl)
			k += 1
	grid.call(D.t("bag_label"), d.potions, d.depot.potions, x + 30)
	grid.call(D.t("depot_chest"), d.depot.potions, d.potions, x + 370)
	var ar := UI.lbl("⇄", 30, UI.GOLD); _at(c, ar, Vector2(x + 336, y + 150))
	_at(c, UI.lbl(D.t("depot_footer", {"gold": int(d.gold)}), 12, UI.DIM), Vector2(x + 30, y + 336))

# ------------------------------------------------------------ flechas (ferreiro, só Arqueiro)
func arrow_shop(town, note := "") -> void:
	var voc: String = town.voc; var d := Save.voc(voc)
	var LOT := {"normal": 50, "fire": 10, "ice": 10, "earth": 10, "energy": 10, "explosive": 1, "holy": 1}
	var cap := Equip.arrow_cap(d); var have := Equip.arrow_count(d)
	var opts := []
	for k in D.db.ARROW_IDS:
		if k == "normal": continue
		var price := int(D.db.ARROWS[k].price)
		opts.append([D.t("arrow_buy_line", {"name": D.t("arrow_" + k), "n": LOT[k], "price": price * LOT[k], "have": int(d.arrows.get(k, 0))}), func():
			var room := cap - Equip.arrow_count(d)
			var n := mini(mini(LOT[k], room), int(d.gold) / price)
			if room <= 0: arrow_shop(town, D.t("arrows_full")); return
			if n <= 0: arrow_shop(town, D.t("oil_no_gold")); return
			d.gold -= n * price; d.arrows[k] = d.arrows.get(k, 0) + n; Save.save(); Sfx.play("pickup", 0.4)
			arrow_shop(town, D.t("arrows_bought", {"n": n, "name": D.t("arrow_" + k)}))])
	opts.append([D.t("bye2"), func(): town.dlg.close()])
	town.say("smith", D.t("smith_title"), (note + "\n\n" if note else "") + D.t("arrow_shop_text", {"n": have, "cap": cap, "gold": int(d.gold)}), opts)

# ------------------------------------------------------------ mural de contratos (na Harpa Mágica)
func board(town) -> void:
	var voc: String = town.voc; var d := Save.voc(voc); var L := Save.level(voc)
	if d.get("contractOffers", []).is_empty(): d.contractOffers = Equip.roll_contracts(L, voc)
	var close := [D.t("leave"), func(): town.dlg.close()]
	var c = d.get("contract")
	if c:
		var T_: Dictionary = D.db.CONTRACT_TIERS[int(c.tier)]
		var done: bool = int(c.got) >= int(c.n)
		var body := D.t("contract_desc", {"tier": T_.name.to_lower(), "n": int(c.n), "name": Equip.mon_name(c.kind, int(c.n)), "got": mini(int(c.got), int(c.n)), "xp": int(c.xp), "gold": int(c.gold), "rarity": Equip.rarity_name(int(c.item.r)).to_lower(), "item": Equip.E(c.item.id).name})
		if done:
			town.say("inn", D.t("zone_board"), body, [[D.t("deliver_contract"), func():
				d.xpTotal += float(c.xp); d.gold += int(c.gold); d.gear.append(c.item); d.contract = null; d.contractOffers = Equip.roll_contracts(L, voc); Save.save()
				Sfx.play("levelup", 0.5); town._refresh_gold()
				town.say("inn", D.t("zone_board"), D.t("contract_done", {"xp": int(c.xp), "gold": int(c.gold), "gear": Equip.gear_name(c.item), "rarity": Equip.rarity_name(int(c.item.r))}), [[D.t("see_new_contracts"), func(): board(town)], close])], close])
		else:
			town.say("inn", D.t("zone_board"), body, [[D.t("abandon_contract"), func(): d.contract = null; Save.save(); board(town)], close])
		return
	var opts := []
	for o in d.contractOffers:
		var T_: Dictionary = D.db.CONTRACT_TIERS[int(o.tier)]
		opts.append([D.t("contract_offer", {"tier": T_.name, "n": int(o.n), "name": Equip.mon_name(o.kind, int(o.n)), "xp": int(o.xp), "gold": int(o.gold), "rarity": Equip.rarity_name(int(o.item.r)).to_lower()}), func():
			var nc: Dictionary = o.duplicate(true); nc.got = 0; d.contract = nc; Save.save(); Sfx.play("pickup", 0.4)
			town.say("inn", D.t("zone_board"), D.t("contract_taken", {"n": int(o.n), "name": Equip.mon_name(o.kind, int(o.n))}), [close])])
	opts.append(close)
	town.say("inn", D.t("zone_board"), D.t("board_desc"), opts)

# ------------------------------------------------------------ forja do ferreiro
func forge(town, sel = null) -> void:
	var voc: String = town.voc; var d := Save.voc(voc)
	var all := []
	for k in d.equip:
		if Equip.E(d.equip[k].id): all.append({"g": d.equip[k], "worn": true})
	for g in d.gear:
		if Equip.E(g.id): all.append({"g": g, "worn": false})
	var found := false
	for o in all: if o.g == sel: found = true
	if not found: sel = all[0].g if all.size() else null
	var r := _win(town, 820, 440, D.t("forge_title")); var c: Control = r[0]; var x: float = r[1]; var y: float = r[2]
	_at(c, UI.lbl(D.t("forge_essences", {"n": int(d.essence)}), 12, Color("ffa030")), Vector2(x + 24, y + 44))
	var GS := 44; var cols := 8; var gx0 := x + 24; var gy0 := y + 70
	if all.is_empty(): _at(c, UI.lbl(D.t("no_equip"), 13, UI.DIM), Vector2(gx0, gy0))
	for i in mini(all.size(), cols * 7):
		var o = all[i]; var g: Dictionary = o.g; var on: bool = g == sel
		var p := Vector2(gx0 + (i % cols) * GS, gy0 + (i / cols) * GS)
		c.add_child(UI.box(Rect2(p, Vector2(GS - 4, GS - 4)), Color("3a2e1c") if on else Color("1a1612"), UI.GOLD if on else Equip.rarity_color(int(g.r)), 3 if on else 2))
		var b := Button.new(); b.flat = true; b.position = p; b.size = Vector2(GS - 4, GS - 4); b.focus_mode = Control.FOCUS_NONE
		b.icon = Equip.icon(g.id); b.expand_icon = true; b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.mouse_entered.connect(func(): Card.show_card(g, voc, {"worn": o.worn}))
		b.mouse_exited.connect(Card.hide_card)
		b.pressed.connect(func(): Card.hide_card(); forge(town, g)); c.add_child(b)
		if int(g.p) > 0: _at(c, UI.lbl("+%d" % int(g.p), 10, Equip.rarity_color(int(g.r))), p + Vector2(GS - 20, GS - 20))
		if o.worn: _at(c, UI.lbl(D.t("worn_label"), 9, Color("9fe08a")), p + Vector2(3, 0))
	_at(c, UI.lbl(D.t("worn_hint"), 11, UI.DIM), Vector2(gx0, y + 400))
	var rx := x + 24 + cols * GS + 18; var rw := x + 820 - 24 - rx
	if sel == null: _at(c, UI.lbl(D.t("choose_left"), 13, UI.DIM), Vector2(rx, y + 80)); return
	var e := Equip.E(sel.id); var nx = Equip.forge_next(sel)
	c.add_child(UI.icon(Equip.icon(sel.id), Vector2(rx + 28, y + 96), 52))
	_at(c, UI.lbl(Equip.gear_name(sel), 16, Equip.rarity_color(int(sel.r))), Vector2(rx + 62, y + 72))
	_at(c, UI.lbl(D.t("forge_item_line", {"rarity": Equip.rarity_name(int(sel.r)), "n": int(e.lvl)}), 12, UI.DIM), Vector2(rx + 62, y + 96))
	_at(c, UI.lbl(D.t("now_label"), 12, UI.DIM), Vector2(rx, y + 128))
	_at(c, UI.wrap(UI.lbl(Equip.stats_text(sel), 12), rw), Vector2(rx, y + 144))
	var yy := y + 196
	if nx == null:
		_at(c, UI.wrap(UI.lbl(D.t("forge_max_ultra") if int(sel.r) == 3 else D.t("forge_max_legend"), 13, UI.GOLD), rw), Vector2(rx, yy)); return
	var after := {"id": sel.id, "r": int(nx.to.r), "p": int(nx.to.p)}
	_at(c, UI.lbl(D.t("forge_after", {"name": Equip.gear_name(after), "rarity": Equip.rarity_name(after.r)}), 12, Equip.rarity_color(after.r)), Vector2(rx, yy)); yy += 18
	_at(c, UI.wrap(UI.lbl(Equip.stats_text(after), 12), rw), Vector2(rx, yy)); yy += 40
	var ok := false; var mats := []
	if nx.has("essence"):
		ok = int(d.essence) >= int(nx.essence)
		_at(c, UI.lbl(D.t("forge_cost_ess", {"n": int(nx.essence), "have": int(d.essence)}), 12, UI.TEXT if ok else Color("e08070")), Vector2(rx, yy))
	else:
		for g in d.gear:
			if g != sel and int(g.r) == int(sel.r): mats.append(g)
		mats.sort_custom(func(a, b): return Equip.E(a.id).rank < Equip.E(b.id).rank or (Equip.E(a.id).rank == Equip.E(b.id).rank and a.p < b.p))
		mats = mats.slice(0, int(nx.items)); ok = mats.size() >= int(nx.items)
		_at(c, UI.wrap(UI.lbl(D.t("forge_cost_items", {"n": int(nx.items), "rarity": Equip.rarity_name(int(sel.r))}) + (D.t("forge_melted") if ok else D.t("forge_have", {"n": mats.size()})), 12, UI.TEXT if ok else Color("e08070")), rw), Vector2(rx, yy))
		for i in mats.size():
			c.add_child(UI.box(Rect2(rx + i * 46, yy + 26, 40, 40), Color("1a1612"), Equip.rarity_color(int(mats[i].r)), 2))
			c.add_child(UI.icon(Equip.icon(mats[i].id), Vector2(rx + i * 46 + 20, yy + 46), 34))
	var b := UI.button(Rect2(rx + rw / 2 - 110, y + 340, 220, 34), D.t("upgrade_btn") if ok else D.t("need_materials"), func():
		if not ok: return
		if nx.has("essence"): d.essence -= int(nx.essence)
		else:
			for m in mats: d.gear.erase(m)
		var up: bool = after.r > int(sel.r); sel.r = after.r; sel.p = after.p; Save.save()
		Sfx.play("levelup" if up else "hit", 0.5); forge(town, sel), 15)
	b.disabled = not ok; c.add_child(b)
