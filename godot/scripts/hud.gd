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
	if touch: _touch_controls()

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
			s.cost.text = ("Nv%d" % int(sp.level)) if not world.spell_unlocked(id) else (str(int(sp.fury)) if sp.fury > 0 else "")
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
