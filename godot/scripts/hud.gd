extends CanvasLayer
## HUD de combate (porte de hud.js): retrato com vida/recurso/experiência, barra de habilidades com recarga,
## Battle List, mensagens, clarão de tela e controles de toque.
const FONT := preload("res://assets/ui/alegreya.ttf")
const FONT_T := preload("res://assets/ui/cinzel.ttf")
var world
var hp_bar: ProgressBar
var res_bar: ProgressBar
var xp_bar: ProgressBar
var hp_lbl: Label
var res_lbl: Label
var lvl_lbl: Label
var slots := {}          # id -> {btn, shade, key, cost}
var bl_box: VBoxContainer
var bl_rows: Array = []
var msg_lbl: Label
var msg_t := 0.0
var flash_rect: ColorRect
var touch := false
var stick_center := Vector2.ZERO
var stick_touch := -1
var stick_dir := Vector2i.ZERO
var stick_knob: Panel
var floor_lbl: Label
var mini: TextureRect
var mini_dot: ColorRect
var mini_img: Image
var mini_tex: ImageTexture
var mini_t := 0.0
var big_map: Control
const MS := 2.0

func _lbl(text: String, size := 11, col := Color("e8dcc0"), font: Font = FONT) -> Label:
	var l := Label.new(); l.text = text
	l.add_theme_font_override("font", font); l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color("0c0608")); l.add_theme_constant_override("outline_size", 4)
	return l

func _bar(fill: Color, w: float, h: float) -> ProgressBar:
	var b := ProgressBar.new(); b.show_percentage = false; b.custom_minimum_size = Vector2(w, h); b.size = Vector2(w, h)
	var f := StyleBoxFlat.new(); f.bg_color = fill; b.add_theme_stylebox_override("fill", f)
	var bg := StyleBoxFlat.new(); bg.bg_color = Color("140e10"); bg.border_color = Color("5a4630"); bg.set_border_width_all(1)
	b.add_theme_stylebox_override("background", bg)
	return b

func setup(w) -> void:
	world = w
	touch = DisplayServer.is_touchscreen_available()
	# ---- retrato + barras (canto superior esquerdo)
	var top := Control.new(); top.position = Vector2(8, 8); add_child(top)
	var frame := Panel.new(); frame.size = Vector2(54, 54)
	var fs := StyleBoxFlat.new(); fs.bg_color = Color("1a1214"); fs.border_color = Color("8a6a3a"); fs.set_border_width_all(2); frame.add_theme_stylebox_override("panel", fs)
	top.add_child(frame)
	var por := TextureRect.new(); por.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; por.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	por.texture = load("res://assets/ui/%s.png" % D.VOCATIONS[w.voc].portrait)
	por.position = Vector2(3, 3); por.size = Vector2(48, 48); por.clip_contents = true
	por.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	top.add_child(por)
	lvl_lbl = _lbl("", 10, Color("e0bc60"), FONT_T); lvl_lbl.position = Vector2(60, -2); top.add_child(lvl_lbl)
	hp_bar = _bar(Color("a8202c"), 170, 13); hp_bar.position = Vector2(60, 16); top.add_child(hp_bar)
	hp_lbl = _lbl("", 9); hp_lbl.position = Vector2(64, 14); top.add_child(hp_lbl)
	res_bar = _bar(Color("2a70d0") if D.is_mana(w.voc) else Color("d0702a"), 170, 10); res_bar.position = Vector2(60, 32); top.add_child(res_bar)
	res_lbl = _lbl("", 8); res_lbl.position = Vector2(64, 29); top.add_child(res_lbl)
	xp_bar = _bar(Color("c8a040"), 170, 4); xp_bar.position = Vector2(60, 45); top.add_child(xp_bar)
	# ---- barra de habilidades (embaixo, centro)
	var bar := HBoxContainer.new(); bar.add_theme_constant_override("separation", 3)
	var order := ["heal"]
	for id in w.spells: if id != "heal": order.append(id)
	var keys := {"heal": "G"}
	for id in w.spells: keys[id] = w.spells[id].key
	for id in order: bar.add_child(_slot(id, w.spells[id].icon, keys[id]))
	bar.add_child(_slot("pot0", "i_health_potion", "Z"))
	bar.add_child(_slot("pot1", "i_mana_potion" if D.is_mana(w.voc) else "i_health_potion", "C"))
	add_child(bar)
	bar.reset_size()
	bar.position = Vector2(480 - bar.size.x / 2.0, 540 - 46)
	# ---- Battle List (direita)
	var bl := PanelContainer.new(); bl.position = Vector2(960 - 168, 8)
	var bs := StyleBoxFlat.new(); bs.bg_color = Color(0.06, 0.05, 0.05, 0.82); bs.border_color = Color("5a4630"); bs.set_border_width_all(1); bs.set_content_margin_all(5)
	bl.add_theme_stylebox_override("panel", bs); bl.custom_minimum_size = Vector2(160, 0)
	bl_box = VBoxContainer.new(); bl_box.add_theme_constant_override("separation", 2); bl.add_child(bl_box)
	bl_box.add_child(_lbl("Battle List", 10, Color("e0bc60"), FONT_T))
	for i in 7:
		var row := Button.new(); row.flat = true; row.custom_minimum_size = Vector2(150, 18); row.focus_mode = Control.FOCUS_NONE
		var nm := _lbl("", 9); nm.position = Vector2(2, 0); row.add_child(nm)
		var hb := _bar(Color("3fae3a"), 50, 4); hb.position = Vector2(96, 7); row.add_child(hb)
		row.pressed.connect(func(): if i < _bl_list.size(): world.hero.target = _bl_list[i])
		bl_box.add_child(row); bl_rows.append({"row": row, "name": nm, "hp": hb})
	add_child(bl)
	# ---- mensagens
	msg_lbl = _lbl("", 10); msg_lbl.position = Vector2(12, 540 - 70); msg_lbl.size = Vector2(600, 20); add_child(msg_lbl)
	w.msg.connect(show_msg)
	w.screen_flash.connect(flash)
	flash_rect = ColorRect.new(); flash_rect.size = Vector2(960, 540); flash_rect.color = Color(1, 1, 1, 0); flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash_rect)
	floor_lbl = _lbl("", 10, Color("c8b890"), FONT_T); floor_lbl.position = Vector2(8, 64); add_child(floor_lbl)
	mini = TextureRect.new(); mini.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST; mini.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mini.modulate.a = 0.85; mini.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(mini)
	mini_dot = ColorRect.new(); mini_dot.size = Vector2(4, 4); mini_dot.color = Color("7fe08a"); mini_dot.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(mini_dot)
	if touch: _touch_controls()
	on_floor()
	w.tut.connect(tut_event)
	w.loot.connect(loot_log)
	if not Save.voc(w.voc).get("tutSewer", false) and not "teste" in OS.get_cmdline_user_args(): tut_start()

func _slot(id: String, icon: String, key: String) -> Control:
	var b := TextureButton.new(); b.custom_minimum_size = Vector2(38, 38); b.focus_mode = Control.FOCUS_NONE
	b.ignore_texture_size = true; b.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	var path := ""
	for p in ["res://assets/icons/%s.png" % icon, "res://assets/icons/%s.png" % icon.replace("icon_", ""), "res://assets/art/%s.png" % icon]:
		if ResourceLoader.exists(p): path = p; break
	var bg := Panel.new(); bg.size = Vector2(38, 38); bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var st := StyleBoxFlat.new(); st.bg_color = Color("1a1214"); st.border_color = Color("6a5230"); st.set_border_width_all(1); bg.add_theme_stylebox_override("panel", st)
	b.add_child(bg)
	var ic := TextureRect.new(); ic.position = Vector2(3, 3); ic.size = Vector2(32, 32); ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if path != "": ic.texture = load(path)
	if icon == "i_health_potion" and id == "pot1": ic.modulate = Color("ff8a30")
	b.add_child(ic)
	var shade := ColorRect.new(); shade.color = Color(0, 0, 0, 0.65); shade.size = Vector2(38, 0); shade.position = Vector2(0, 38); shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(shade)
	var k := _lbl(key, 8, Color("f0e0b0")); k.position = Vector2(2, -1); b.add_child(k)
	var cost := _lbl("", 8, Color("9fc0ff")); cost.position = Vector2(20, 24); b.add_child(cost)
	b.pressed.connect(func():
		if id == "pot0": world.use_potion(0)
		elif id == "pot1": world.use_potion(1)
		else: world.cast(id))
	slots[id] = {"btn": b, "shade": shade, "icon": ic, "cost": cost}
	return b

var _bl_list: Array = []
func _process(dt: float) -> void:
	if world == null or world.hero == null: return
	var h = world.hero
	hp_bar.max_value = h.max_hp; hp_bar.value = h.hp
	hp_lbl.text = "%d / %d" % [ceili(h.hp), roundi(h.max_hp)]
	res_bar.max_value = world.fury_max; res_bar.value = h.fury
	res_lbl.text = "%s %d" % ["Mana" if D.is_mana(world.voc) else "Fúria", floori(h.fury)]
	xp_bar.max_value = world.xp_next(); xp_bar.value = h.xp
	lvl_lbl.text = "%s · %s %d" % [D.VOCATIONS[world.voc].name, D.t("level_short") if D.i18n.pt.has("level_short") else "Nível", h.level]
	for id in slots:
		var s: Dictionary = slots[id]
		var frac := 0.0; var dim := false
		if id.begins_with("pot"):
			var slot := int(id.substr(3)); var ch: float = Save.voc(world.voc).charges[slot]
			frac = 1.0 - ch; s.cost.text = "" if ch >= 1 else "%d%%" % floori(ch * 100)
		else:
			var sp: Dictionary = world.spells[id]
			var cd: float = h.cds.get(id, 0.0)
			frac = clampf(cd / max(0.01, sp.cd * world.stats.cooldown), 0, 1)
			dim = not world.spell_unlocked(id) or h.fury < sp.fury
			s.cost.text = (("Nv%d" % int(sp.level)) if h.level < int(sp.level) else "Teia") if not world.spell_unlocked(id) else (str(int(sp.fury)) if sp.fury > 0 else "")
		s.shade.size.y = 38 * frac; s.shade.position.y = 38 * (1 - frac)
		s.icon.modulate.a = 0.35 if dim else 1.0
	# Battle List: monstros acordados mais perto
	_bl_list = world.monsters.filter(func(m): return not m.dead and max(abs(m.x - h.x), abs(m.y - h.y)) <= 9)
	_bl_list.sort_custom(func(a, b): return Vector2(a.x - h.x, a.y - h.y).length() < Vector2(b.x - h.x, b.y - h.y).length())
	for i in bl_rows.size():
		var r: Dictionary = bl_rows[i]
		if i < _bl_list.size():
			var m = _bl_list[i]
			r.row.visible = true; r.name.text = m.data.name; r.hp.max_value = m.max_hp; r.hp.value = m.hp
			r.name.add_theme_color_override("font_color", Color("ff6a5a") if m == h.target else Color("e8dcc0"))
		else: r.row.visible = false
	var info := []
	if world.ranged:
		var k: String = world.arrow_type()
		info.append(D.t("arrow_" + k) + (" (%d)" % int(Save.voc(world.voc).arrows.get(k, 0)) if k != "normal" else "") + " · X")
	for b in h.buffs: info.append("%s %ds" % [D.db.POTIONS[b].name if D.db.POTIONS.has(b) else b, ceili(h.buffs[b])])
	if world.recall_t > 0: info.append("Voltando à cidade… %ds" % ceili(world.recall_t))
	floor_lbl.text = D.t("floor_display", {"name": world.region.name, "n": world.floor_n, "total": world.floors}) + ("\n" + "  ·  ".join(info) if info.size() else "")
	mini_t -= dt
	if mini_t <= 0: mini_t = 0.25; _mini_update()
	if msg_t > 0:
		msg_t -= dt
		if msg_t < 1: msg_lbl.modulate.a = max(0.0, msg_t)

func show_msg(s: String) -> void:
	if s == "": return
	msg_lbl.text = s; msg_lbl.modulate.a = 1; msg_t = 4.0

func flash(c: Color, dur: float) -> void:
	flash_rect.color = c
	var tw := create_tween(); tw.tween_property(flash_rect, "color:a", 0.0, dur)

# ---------------------------------------------------------------- toque: analógico à esquerda, ataque à direita
func _touch_controls() -> void:
	var base := Panel.new(); base.size = Vector2(110, 110); base.position = Vector2(24, 540 - 150); base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var st := StyleBoxFlat.new(); st.bg_color = Color(1, 1, 1, 0.08); st.border_color = Color(1, 1, 1, 0.25); st.set_border_width_all(2); st.set_corner_radius_all(55)
	base.add_theme_stylebox_override("panel", st); add_child(base)
	stick_center = base.position + base.size / 2
	stick_knob = Panel.new(); stick_knob.size = Vector2(44, 44); stick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ks := StyleBoxFlat.new(); ks.bg_color = Color(0.9, 0.8, 0.6, 0.35); ks.set_corner_radius_all(22); stick_knob.add_theme_stylebox_override("panel", ks)
	stick_knob.position = stick_center - Vector2(22, 22); add_child(stick_knob)
	var atk := Button.new(); atk.text = "⚔"; atk.size = Vector2(72, 72); atk.position = Vector2(960 - 96, 540 - 150); atk.focus_mode = Control.FOCUS_NONE
	atk.add_theme_font_size_override("font_size", 28)
	atk.pressed.connect(func(): world.hero.atk_queued = 0.35)
	add_child(atk)
	var tgt := Button.new(); tgt.text = "◎"; tgt.size = Vector2(48, 48); tgt.position = Vector2(960 - 160, 540 - 120); tgt.focus_mode = Control.FOCUS_NONE
	tgt.pressed.connect(func(): world.cycle_target()); add_child(tgt)
	var y := 8.0
	for a in [["interact", "E"], ["bag", "Mochila"], ["talents", "Teia"], ["pause", "II"]]:
		var b := Button.new(); b.text = a[1]; b.size = Vector2(70, 34); b.position = Vector2(960 - 250, y); b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(func(): get_parent().touch_action(a[0])); add_child(b); y += 40

func _input(e: InputEvent) -> void:
	if not touch: return
	if e is InputEventScreenTouch:
		if e.pressed and e.position.x < 480 and e.position.y > 270 and stick_touch < 0:
			stick_touch = e.index; _stick(e.position)
		elif not e.pressed and e.index == stick_touch:
			stick_touch = -1; stick_dir = Vector2i.ZERO; stick_knob.position = stick_center - Vector2(22, 22); _apply_stick()
	elif e is InputEventScreenDrag and e.index == stick_touch: _stick(e.position)

func _stick(p: Vector2) -> void:
	var v := (p - stick_center).limit_length(44)
	stick_knob.position = stick_center + v - Vector2(22, 22)
	if v.length() < 14: stick_dir = Vector2i.ZERO
	else:
		var a := snappedf(v.angle(), PI / 4)
		stick_dir = Vector2i(roundi(cos(a)), roundi(sin(a)))
	_apply_stick()

func _apply_stick() -> void:
	for pair in [["andar_dir", stick_dir.x > 0], ["andar_esq", stick_dir.x < 0], ["andar_baixo", stick_dir.y > 0], ["andar_cima", stick_dir.y < 0]]:
		if pair[1]: Input.action_press(pair[0])
		else: Input.action_release(pair[0])

# ---------------------------------------------------------------- andar, minimapa e mapa grande
func on_floor() -> void:
	if floor_lbl == null: return
	floor_lbl.text = D.t("floor_display", {"name": world.region.name, "n": world.floor_n, "total": world.floors})
	var g = world.gen
	mini_img = Image.create(g.w, g.h, false, Image.FORMAT_RGBA8)
	mini_tex = ImageTexture.create_from_image(mini_img); mini.texture = mini_tex
	var sc: float = min(160.0 / g.w, 90.0 / g.h)
	mini.size = Vector2(g.w, g.h) * sc; mini.position = Vector2(960 - 8 - mini.size.x, 540 - 54 - mini.size.y)
	_mini_update()

func _mini_color(x: int, y: int) -> Color:
	var g = world.gen; var c := Vector2i(x, y)
	if not world.explored[y * g.w + x]: return Color(0, 0, 0, 0)
	if world.stairs != null and c == world.stairs: return Color("e0bc60")
	if world.rope != null and c == world.rope: return Color("c8a070")
	if world.wp != null and c == world.wp: return Color("8ac8ff")
	if g.is_water(x, y): return Color("2a4a3a")
	if g.is_walk(x, y): return Color("6a6458")
	return Color(0, 0, 0, 0)

func _mini_update() -> void:
	if mini_img == null or world.explored.size() != world.gen.w * world.gen.h: return
	var g = world.gen
	for y in g.h:
		for x in g.w:
			if world.explored[y * g.w + x]: mini_img.set_pixel(x, y, _mini_color(x, y))
	mini_tex.update(mini_img)
	var sc: float = mini.size.x / g.w
	mini_dot.position = mini.position + Vector2(world.hero.x, world.hero.y) * sc - Vector2(1, 1)

func toggle_map() -> void:
	tut_event("map")
	if big_map: big_map.queue_free(); big_map = null; world.paused = false; return
	world.paused = true
	big_map = Control.new(); big_map.size = Vector2(960, 540); add_child(big_map)
	var bg := ColorRect.new(); bg.color = Color(0, 0, 0, 0.8); bg.size = Vector2(960, 540); big_map.add_child(bg)
	bg.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: toggle_map())
	var g = world.gen; var sc: float = min(900.0 / g.w, 440.0 / g.h)
	var tr := TextureRect.new(); tr.texture = mini_tex; tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST; tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.size = Vector2(g.w, g.h) * sc; tr.position = Vector2(480, 290) - tr.size / 2; big_map.add_child(tr)
	var dot := ColorRect.new(); dot.size = Vector2(8, 8); dot.color = Color("7fe08a"); dot.position = tr.position + Vector2(world.hero.x + 0.5, world.hero.y + 0.5) * sc - Vector2(4, 4); big_map.add_child(dot)
	var t := _lbl(D.t("floor_display", {"name": world.region.name, "n": world.floor_n, "total": world.floors}), 16, Color("e0bc60"), FONT_T); t.position = Vector2(0, 30); t.size = Vector2(960, 24); t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; big_map.add_child(t)
	var c := _lbl("M / clique fecha", 10, Color("9a8f80")); c.position = Vector2(0, 515); c.size = Vector2(960, 14); c.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; big_map.add_child(c)

func _unhandled_key_input(e: InputEvent) -> void:
	if big_map and e.pressed and not e.echo and e.keycode in [KEY_M, KEY_ESCAPE]: toggle_map(); get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- tutorial (primeira descida ao esgoto)
const TUT := [["move", "tut_move"], ["attack", "tut_attack"], ["loot", "tut_loot"], ["heal", "tut_heal"], ["bag", "tut_bag"], ["map", "tut_map"], ["exit", "tut_exit"]]
var tut_step := -1
var tut_moves := 0
var tut_box: Control
var tut_lbl: Label
func tut_start() -> void:
	tut_step = 0
	tut_box = Control.new(); tut_box.position = Vector2(200, 82); add_child(tut_box)
	tut_box.add_child(UI.panel(Rect2(0, 0, 560, 70)))
	var hd := UI.lbl("Tutorial", 12, UI.GOLD); hd.position = Vector2(18, 8); tut_box.add_child(hd)
	var sk := UI.button(Rect2(470, 8, 74, 20), D.t("tut_skip").substr(0, 14), func(): tut_end(), 10); tut_box.add_child(sk)
	tut_lbl = UI.wrap(UI.lbl("", 12), 520); tut_lbl.position = Vector2(18, 28); tut_box.add_child(tut_lbl)
	_tut_show()
func _tut_show() -> void:
	if tut_step >= TUT.size(): tut_end(); return
	var k: String = TUT[tut_step][1]
	var p := {"k": "Espaço" if TUT[tut_step][0] == "attack" else "I" if TUT[tut_step][0] == "bag" else "M" if TUT[tut_step][0] == "map" else "G", "a": "Q", "p": "Z", "e": "E", "h": "H"}
	if TUT[tut_step][0] == "move": p.k = "W A S D"
	var txt := D.t(k, p)
	tut_lbl.text = txt.replace("«", "").replace("»", "")
func tut_event(ev: String) -> void:
	if tut_step < 0 or tut_step >= TUT.size(): return
	if ev == "move": tut_moves += 1
	var want: String = TUT[tut_step][0]
	if (want == "move" and tut_moves >= 6) or (want != "move" and want == ev):
		tut_step += 1; Sfx.play("pickup", 0.3); _tut_show()
func tut_end() -> void:
	tut_step = TUT.size()
	if tut_box: tut_box.queue_free(); tut_box = null
	var d := Save.voc(world.voc); d.tutSewer = true; Save.save()

# ---------------------------------------------------------------- relatório de saque (lado esquerdo)
var loot_rows: Array = []
func loot_log(icon: Texture2D, text: String, col: Color, sum: int) -> void:
	loot_rows = loot_rows.filter(func(r): return is_instance_valid(r.c))
	if sum > 0 and loot_rows.size() and loot_rows[-1].sum > 0 and loot_rows[-1].age < 3.0:
		var r = loot_rows[-1]; r.n += sum; r.l.text = D.t("loot_gold", {"n": r.n}); r.age = 0.0; r.c.modulate.a = 1; return
	var c := Control.new(); add_child(c)
	var bg := UI.box(Rect2(0, -12, 180, 24), Color(0.05, 0.035, 0.03, 0.72), Color("4a3a2a")); c.add_child(bg)
	c.add_child(UI.icon(icon, Vector2(13, 0), 18))
	var l := UI.lbl(D.t("loot_gold", {"n": sum}) if sum > 0 else text, 11, col); l.position = Vector2(28, -9); l.size.x = 150; l.clip_text = true; c.add_child(l)
	c.position = Vector2(-260, 0)
	var row := {"c": c, "l": l, "age": 0.0, "sum": sum, "n": sum}
	loot_rows.append(row)
	if loot_rows.size() > 6: loot_rows[0].c.queue_free(); loot_rows.pop_front()
	for i in loot_rows.size():
		var target := Vector2(12, 330 - (loot_rows.size() - 1 - i) * 28)
		if loot_rows[i].c == c: c.position.y = target.y; create_tween().tween_property(c, "position:x", 12.0, 0.18).set_trans(Tween.TRANS_BACK)
		else: loot_rows[i].c.position.y = target.y
	var tw := c.create_tween(); tw.tween_interval(4.0); tw.tween_property(c, "modulate:a", 0.0, 0.8); tw.tween_callback(c.queue_free)
