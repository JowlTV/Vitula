extends CanvasLayer
## Mochila (tecla I/B): equipamentos vestidos, ficha de status, itens guardados e poções (porte de bag.js).
## Na masmorra o jogo pausa enquanto está aberta. Autoload "Bag".
var box: Control
var host
var voc := "knight"
var tab := "items"
var tip: Label
var calc          # mundo (masmorra) ou um mundo temporário só para as contas, na cidade

func _init() -> void: layer = 25; process_mode = Node.PROCESS_MODE_ALWAYS

func is_open() -> bool: return box != null

func open(h, v: String, _in_town := false) -> void:
	opened_frame = Engine.get_process_frames()
	host = h; voc = v
	if h.get("world") and h.world and h.world.get("hero"): calc = h.world
	else:
		calc = load("res://scripts/world.gd").new(); calc.voc = v; calc.ranged = int(D.VOCATIONS[v].get("ranged", 0)); calc.spells = D.spells(v)
		calc.hero = load("res://scripts/hero.gd").new(); calc.hero.level = Save.level(v)
		calc.stats = calc.compute_stats(); calc.hero.max_hp = calc.stats.maxHp + 10 * (calc.hero.level - 1); calc.hero.hp = calc.hero.max_hp
		calc.hero.fury = calc.fury_max if D.is_mana(v) else 0.0
	if h.has_method("set_paused"): h.set_paused(true)
	_build()

func close() -> void:
	Card.hide_card()
	if box: box.queue_free(); box = null
	if calc and calc != (host.world if host and host.get("world") else null):
		calc.hero.free(); calc.free()
	calc = null
	if host and host.has_method("set_paused"): host.set_paused(false)

var opened_frame := -1
func _unhandled_input(e: InputEvent) -> void:
	if Engine.get_process_frames() - opened_frame < 2: return
	if box and e is InputEventKey and e.pressed and not e.echo and (e.keycode == KEY_ESCAPE or e.is_action("mochila")):
		close(); get_viewport().set_input_as_handled()

func _l(c: Control, s: String, p: Vector2, size := 13, col := UI.TEXT) -> Label:
	var l := UI.lbl(s, size, col); l.position = p; c.add_child(l); return l

func _restat() -> void:
	if calc and calc.has_method("restat") and calc.get_parent(): calc.restat()
	elif calc: calc.stats = calc.compute_stats()

func _build() -> void:
	Card.hide_card()
	if box: box.queue_free()
	box = Control.new(); box.size = Vector2(960, 540); add_child(box)
	var c := box; var d := Save.voc(voc); var h = calc.hero
	var bg := ColorRect.new(); bg.color = Color(0, 0, 0, 0.6); bg.size = Vector2(960, 540); c.add_child(bg)
	var W := 860.0; var H := 500.0; var X := 480 - W / 2; var Y := 270 - H / 2 - 8
	c.add_child(UI.panel(Rect2(X, Y, W, H)))
	var tl := _l(c, D.t("bag_title"), Vector2(X, Y + 8), 24, UI.GOLD); tl.size = Vector2(W, 30); tl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_l(c, "I / ESC", Vector2(X + W - 70, Y + 14), 11, UI.DIM)
	c.add_child(UI.button(Rect2(X + W - 46, Y + 34, 28, 24), "✕", close, 12))
	tip = _l(c, D.t("bag_tip_touch") if Touch.enabled else D.t("bag_tip"), Vector2(X + 30, Y + H - 40), 12, UI.DIM)
	UI.wrap(tip, W - 60)
	# ---- equipamentos
	var ex := X + 30; var ey := Y + 64
	_l(c, D.t("equipment"), Vector2(ex, ey - 26), 15, UI.GOLD)
	var slots := [["helmet", 72, 0, 56, 50], ["amulet", 146, 8, 36, 36], ["weapon", 0, 60, 56, 108], ["armor", 68, 60, 64, 84], ["shield", 144, 60, 56, 108],
		["ring", 12, 182, 34, 34], ["legs", 72, 156, 56, 48], ["light", 154, 182, 34, 34], ["backpack", 0, 230, 56, 46], ["boots", 144, 230, 56, 46]]
	for s in slots:
		var sl: String = s[0]; var r := Rect2(ex + s[1], ey + s[2], s[3], s[4])
		c.add_child(UI.slot(r))
		var nl := _l(c, D.t("slot_" + sl), r.position + Vector2(0, r.size.y), 9, UI.DIM); nl.size.x = r.size.x; nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var g = d.equip.get(sl)
		if g and not Equip.E(g.id).is_empty():
			if int(g.r) > 0: c.add_child(UI.box(Rect2(r.position + Vector2(3, 3), r.size - Vector2(6, 6)), Color(0, 0, 0, 0), Equip.rarity_color(int(g.r)), 2))
			var b := Button.new(); b.flat = true; b.position = r.position; b.size = r.size; b.focus_mode = Control.FOCUS_NONE
			b.icon = Equip.icon(g.id); b.expand_icon = true; b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
			b.mouse_entered.connect(func(): _tip(g, D.t("tip_worn")); Card.show_card(g, voc, {"worn": true, "hint": D.t("card_hint_unequip"), "level": calc.hero.level}))
			b.mouse_exited.connect(Card.hide_card)
			b.pressed.connect(func(): Equip.unequip(voc, sl); _restat(); _build())
			c.add_child(b)
			if int(g.p) > 0: _l(c, "+%d" % int(g.p), r.end - Vector2(22, 16), 10, Equip.rarity_color(int(g.r)))
	# ---- ficha
	var sx := X + 240; var sy := Y + 64
	var R := func(x: float, y: float, label: String, val, col := UI.TEXT, lw := 96.0, bw := 66.0):
		var lb := _l(c, label, Vector2(x, y + 3), 11, UI.DIM); lb.size.x = lw - 6; lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		c.add_child(UI.box(Rect2(x + lw, y, bw, 22), Color(0.05, 0.04, 0.03, 0.9), Color("8a7048")))
		var v := _l(c, str(val), Vector2(x + lw, y + 3), 11, col); v.size.x = bw; v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; v.clip_text = true
	var pm = calc.promo()
	c.add_child(UI.box(Rect2(sx, sy - 22, 150, 24), Color(0.05, 0.04, 0.03, 0.9), Color("8a7048")))
	var vn := _l(c, D.VOCATIONS[voc].name.to_upper(), Vector2(sx, sy - 19), 11, UI.GOLD); vn.size.x = 150; vn.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var li := Save.level_info(d.xpTotal)
	R.call(sx, sy + 10, D.t("level_label"), h.level, UI.TEXT, 48.0, 40.0)
	R.call(sx + 100, sy + 10, D.t("short_xp"), int(d.xpTotal), UI.TEXT, 110.0, 104.0)
	R.call(sx + 100, sy + 36, D.t("short_next"), ceili(8 * pow(li.level, 1.35) - li.xp), UI.TEXT, 110.0, 104.0)
	_l(c, D.t("skills_label"), Vector2(sx + 40, sy + 64), 12, UI.GOLD)
	var sk := func(id: String) -> String:
		var s := Save.skill(voc, id)
		return "%d  (%d%%)" % [int(s.lvl), floori(100.0 * s.tries / D.skill_tries_needed(id, int(s.lvl)))]
	var ly := sy + 84
	var rows := [["Distance", sk.call("distance")], ["Dodge", sk.call("dodge")]] if calc.ranged else [["Sword", sk.call("sword")], ["Shield", sk.call("shield")]]
	rows.append(["Magic level", "%d  (%d%%)" % [int(d.ml.lvl), floori(100.0 * d.ml.spent / D.ml_needed(voc, int(d.ml.lvl)))]])
	for r in rows: R.call(sx, ly, r[0], r[1], Color("a8c8ff"), 76.0, 60.0); ly += 27
	var pts: int = Talents.points(voc)
	R.call(sx, ly, D.t("pm_attrs"), pts, Color("d8ffc8") if pts > 0 else UI.DIM, 76.0, 60.0); ly += 34
	R.call(sx, ly, D.t("total_hp"), "%d / %d" % [ceili(h.hp), roundi(h.max_hp)], Color("ff8080"), 76.0, 60.0); ly += 27
	R.call(sx, ly, D.t("word_mana") if D.is_mana(voc) else D.t("word_fury"), "%d / %d" % [ceili(h.fury), roundi(calc.fury_max)], Color("80a8ff") if D.is_mana(voc) else Color("ffa860"), 76.0, 60.0)
	var mx: float = calc.max_damage()
	var ay := sy + 84; var ax := sx + 150
	var right := [[D.t("short_dmg"), "%d–%d" % [roundi(mx * 0.6), roundi(mx)]], [D.t("short_crit"), "%s%%" % str(snappedf(calc.crit_chance() * 100, 0.1)).replace(".", ",")],
		[D.t("short_speed"), "%s/s" % str(snappedf(calc.attacks_per_sec(), 0.01))], [D.t("short_def"), str(snappedf(calc.defense_value(), 0.1))],
		[D.t("short_dodge") if calc.ranged else D.t("short_block"), "%d%%" % roundi(calc.block_chance() * 100)]]
	if calc.ranged: right.append([D.t("short_arrows"), "%d / %d" % [Equip.arrow_count(d), Equip.arrow_cap(d)]])
	for r in right: R.call(ax, ay, r[0], r[1], UI.TEXT, 80.0, 82.0); ay += 27
	_l(c, D.t("resistances"), Vector2(ax + 70, ay + 4), 11, UI.GOLD)
	var res := []
	for k in calc.stats.get("res", {}):
		if calc.stats.res[k]: res.append("%s %+d%%" % [D.db.ELEMENTS[k].name, roundi(calc.stats.res[k] * 100)])
	UI.wrap(_l(c, " · ".join(res) if res.size() else D.t("no_resist"), Vector2(ax + 40, ay + 20), 11), 150)
	# ---- abas
	var ix := X + 580; var iy := Y + 54; var iw := W - 600
	for k in 2:
		var id: String = ["items", "potions"][k]
		var b := UI.button(Rect2(ix + k * iw / 2, iy, iw / 2 - 4, 24), D.t("tab_backpack") if k == 0 else D.t("tab_potions"), func(): tab = id; _build(), 13)
		if tab == id: b.add_theme_color_override("font_color", UI.GOLD)
		c.add_child(b)
	var ry := iy + 36
	c.add_child(UI.icon(Equip.item_icon("i_gold_coin"), Vector2(ix + 8, ry + 8), 16))
	var run_gold: int = host.world.gold_run if host and host.get("world") and host.world and host.world.get("gold_run") != null else 0
	_l(c, D.t("bag_gold_line", {"run": run_gold, "saved": Save.gold(voc)}), Vector2(ix + 20, ry), 11, UI.GOLD)
	var cap := Equip.cap_of(voc, h.level); var ld := Equip.load_of(voc)
	var st := 2 if ld >= cap else 1 if ld >= cap * 0.9 else 0
	_l(c, D.t("cap_line", {"w": Equip.fmt_oz(ld), "c": int(cap)}) + ((" · " + D.t("cap_slow20" if st == 2 else "cap_slow5")) if st else ""), Vector2(ix, ry + 20), 11, Color("e07060") if st == 2 else Color("e0b060") if st == 1 else UI.TEXT)
	c.add_child(UI.box(Rect2(ix, ry + 40, iw, 5), Color("2a2420"), Color("2a2420"), 0))
	c.add_child(UI.box(Rect2(ix, ry + 40, iw * min(1.0, ld / cap), 5), Color("6a8a3a") if st == 0 else Color("c09030"), Color(0, 0, 0, 0), 0))
	var top := ry + 62
	if tab == "items":
		var cols := 6; var rws := 5; var GS := 40.0
		var gx0 := ix + (iw - cols * GS) / 2; var gy0 := top + 34
		c.add_child(UI.box(Rect2(gx0 - 12, gy0 - 22, cols * GS + 24, rws * GS + 34), Color("3a2616"), Color("1e140c"), 2))
		var hdr := D.t("stored_gear", {"n": d.gear.size()}) + ((" · " + D.t("essences_label", {"n": int(d.essence)})) if int(d.essence) else "")
		var hl := _l(c, hdr, Vector2(ix, top - 4), 12, UI.GOLD); hl.size.x = iw; hl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		for r in rws:
			for k in cols: c.add_child(UI.box(Rect2(gx0 + k * GS + 2, gy0 + r * GS + 2, GS - 4, GS - 4), Color("1a120c"), Color("5a4026")))
		for i in mini(d.gear.size(), cols * rws):
			var g: Dictionary = d.gear[i]
			if Equip.E(g.id).is_empty(): continue
			var p := Vector2(gx0 + (i % cols) * GS + 2, gy0 + (i / cols) * GS + 2)
			var ok: bool = Equip.equip_ok(g.id, voc) and h.level >= int(Equip.E(g.id).lvl)
			if int(g.r) > 0 or not ok: c.add_child(UI.box(Rect2(p, Vector2(GS - 4, GS - 4)), Color(0, 0, 0, 0), Equip.rarity_color(int(g.r)) if ok else Color("8a2a2a"), 2))
			var b := Button.new(); b.flat = true; b.position = p; b.size = Vector2(GS - 4, GS - 4); b.focus_mode = Control.FOCUS_NONE
			b.icon = Equip.icon(g.id); b.expand_icon = true; b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
			if not ok: b.modulate.a = 0.45
			b.button_mask = MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT
			b.mouse_entered.connect(func(): _tip(g, ""); Card.show_card(g, voc, {"hint": D.t("card_hint_equip"), "sell": true, "level": calc.hero.level}))
			b.mouse_exited.connect(Card.hide_card)
			b.gui_input.connect(func(ev):
				if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_RIGHT:
					_say(Equip.sell(voc, i)); _build())
			b.pressed.connect(func():
				var note := Equip.equip_item(voc, i, h.level)
				if note != "" and not Save.voc(voc).equip.values().has(g): tip.text = note; return
				if note != "": _say(note)
				_restat(); _build())
			c.add_child(b)
			if int(g.p) > 0: _l(c, "+%d" % int(g.p), p + Vector2(GS - 22, GS - 20), 9, Equip.rarity_color(int(g.r)))
		if d.gear.size() > cols * rws: _l(c, D.t("more_in_bag", {"n": d.gear.size() - cols * rws}), Vector2(ix, gy0 + rws * GS + 16), 11, UI.DIM)
	else:
		UI.wrap(_l(c, D.t("potion_hint"), Vector2(ix, top), 11, UI.DIM), iw)
		var py := top + 40
		for id in D.db.POTIONS:
			var P: Dictionary = D.db.POTIONS[id]
			if not P.has("dur") or (P.has("voc") and not voc in P.voc): continue
			var n := int(d.potions.get(id, 0))
			c.add_child(UI.box(Rect2(ix, py - 4, iw, 30), Color("1a1612"), Color("3a3024")))
			var ic := UI.icon(UI.tex("res://assets/items/%s.png" % P.icon), Vector2(ix + 16, py + 11), 22)
			if P.has("tint"): ic.modulate = UI.color_int(int(P.tint))
			if n == 0: ic.modulate.a = 0.35
			c.add_child(ic)
			_l(c, "%s  ×%d" % [P.name, n], Vector2(ix + 34, py + 2), 12, UI.TEXT if n else UI.DIM)
			if n and host and host.get("world") and host.world and host.world.has_method("drink_buff"):
				c.add_child(UI.button(Rect2(ix + iw - 72, py + 1, 66, 22), D.t("drink"), func(): host.world.drink_buff(id); _build(), 11))
			py += 36

func _tip(g: Dictionary, extra: String) -> void:
	var e := Equip.E(g.id); var bad := not Equip.equip_ok(g.id, voc); var low: bool = calc.hero.level < int(e.lvl)
	tip.text = "%s · %s%s%s%s\n%s%s" % [Equip.gear_name(g), Equip.rarity_name(int(g.r)), D.t("tip_level", {"n": int(e.lvl)}), D.t("tip_wrong_voc") if bad else "", extra, Equip.stats_text(g), (" — " + e.desc) if e.has("desc") else ""]
	tip.add_theme_color_override("font_color", Color("e08070") if low or bad else Equip.rarity_color(int(g.r)))

func _say(s: String) -> void:
	if s == "": return
	if host and host.get("world") and host.world: host.world.emit_signal("msg", s)
	elif tip: tip.text = s
