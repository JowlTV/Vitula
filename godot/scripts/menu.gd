extends Control
## Telas de abertura (porte de TitleScene, OptionsScene, SelectScene e IntroScene do Phaser):
## título → escolha da vocação → introdução (Karhyn vista das costas do personagem) → portão de Karhyn.
var page: Control
var intro_done := false
var in_intro := false

func _ready() -> void:
	var bg := TextureRect.new(); bg.texture = UI.tex("res://assets/ui/map_karhyn_2x.jpg"); bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED; bg.size = Vector2(960, 540); bg.modulate = Color(0.45, 0.42, 0.42); bg.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; add_child(bg)
	var tw := create_tween().set_loops(); tw.tween_property(bg, "position", Vector2(-20, -10), 18).set_trans(Tween.TRANS_SINE); tw.tween_property(bg, "position", Vector2.ZERO, 18).set_trans(Tween.TRANS_SINE)
	bg.scale = Vector2(1.05, 1.05)
	Sfx.music("music_title", 0.5)
	_apply_audio()
	if "teste" in OS.get_cmdline_user_args(): _teste(); return
	title()

func _apply_audio() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(max(0.001, Save.data.settings.get("sfx", 0.8))))

func _page() -> Control:
	if page: page.queue_free()
	page = Control.new(); page.size = Vector2(960, 540); add_child(page); return page

func _l(c: Control, s: String, y: float, size := 13, col := UI.TEXT, title_font := false) -> Label:
	var l := UI.lbl(s, size, col, title_font); l.position = Vector2(0, y); l.size = Vector2(960, size + 10); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(l); return l

# ------------------------------------------------------------ título
func title() -> void:
	var c := _page()
	var logo := TextureRect.new(); logo.texture = UI.tex("res://assets/ui/logo_vitula.png"); logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED; logo.size = Vector2(560, 220); logo.position = Vector2(200, 60); logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; c.add_child(logo)
	var tw := logo.create_tween().set_loops(); tw.tween_property(logo, "position:y", 52, 2.6).set_trans(Tween.TRANS_SINE); tw.tween_property(logo, "position:y", 60, 2.6).set_trans(Tween.TRANS_SINE)
	c.add_child(UI.button(Rect2(350, 320, 260, 40), D.t("play"), select, 18))
	c.add_child(UI.button(Rect2(350, 372, 260, 36), D.t("options"), options, 16))
	c.add_child(UI.button(Rect2(350, 420, 260, 34), D.t("reset_chars"), _reset, 14))
	_l(c, D.t("credits_jowl"), 512, 12, UI.DIM)
	_l(c, "Versão Godot 4", 470, 10, Color("6a6058"))

func _reset() -> void:
	var c := _page()
	c.add_child(UI.panel(Rect2(220, 165, 520, 210)))
	_l(c, D.t("reset_chars"), 185, 24, UI.GOLD)
	var b := UI.wrap(UI.lbl(D.t("reset_confirm"), 14), 460); b.position = Vector2(250, 225); b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(b)
	c.add_child(UI.button(Rect2(260, 320, 200, 34), D.t("reset_yes"), func(): Save.data.vocs = {}; Save.data.bestiary = {}; Save.data.cleared = {}; Save.save(); Sfx.play("explode", 0.3); title(), 14))
	c.add_child(UI.button(Rect2(500, 320, 200, 34), D.t("reset_no"), title, 14))

# ------------------------------------------------------------ opções: idioma, ritmo, volume
func options() -> void:
	var c := _page(); var st: Dictionary = Save.data.settings
	c.add_child(UI.panel(Rect2(200, 50, 560, 440)))
	_l(c, D.t("options"), 66, 26, UI.GOLD, true)
	var y := 120.0
	var row := func(y: float, label: String, val: String, minus: Callable, plus: Callable):
		var l := UI.lbl(label, 15); l.position = Vector2(240, y + 6); c.add_child(l)
		c.add_child(UI.button(Rect2(520, y, 36, 32), "‹", minus, 16))
		var v := UI.lbl(val, 15, UI.GOLD); v.position = Vector2(560, y + 6); v.size.x = 120; v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(v)
		c.add_child(UI.button(Rect2(684, y, 36, 32), "›", plus, 16))
	var langs := ["pt", "en", "es", "de", "pl"]; var names := {"pt": "Português", "en": "English", "es": "Español", "de": "Deutsch", "pl": "Polski"}
	var li := langs.find(D.lang)
	var set_lang := func(d: int): D.lang = langs[posmod(li + d, langs.size())]; st.lang = D.lang; Save.save(); options()
	row.call(120.0, D.t("language") if D.t("language") != "language" else "Idioma", names[D.lang], func(): set_lang.call(-1), func(): set_lang.call(1))
	var sp: float = st.get("speed", 0.75)
	row.call(170.0, D.t("game_speed") if D.t("game_speed") != "game_speed" else "Ritmo do jogo", "%d%%" % roundi(sp * 100), func(): st.speed = max(0.5, snappedf(sp - 0.05, 0.05)); Save.save(); options(), func(): st.speed = min(1.25, snappedf(sp + 0.05, 0.05)); Save.save(); options())
	var mu: float = st.get("music", 0.6)
	row.call(220.0, D.t("music_vol"), "%d%%" % roundi(mu * 100), func(): st.music = max(0.0, snappedf(mu - 0.1, 0.1)); Save.save(); Sfx.music_volume(st.music); options(), func(): st.music = min(1.0, snappedf(mu + 0.1, 0.1)); Save.save(); Sfx.music_volume(st.music); options())
	var fx: float = st.get("sfx", 0.8)
	row.call(270.0, D.t("sfx_vol"), "%d%%" % roundi(fx * 100), func(): st.sfx = max(0.0, snappedf(fx - 0.1, 0.1)); Save.save(); _apply_audio(); Sfx.play("hit", 0.5); options(), func(): st.sfx = min(1.0, snappedf(fx + 0.1, 0.1)); Save.save(); _apply_audio(); Sfx.play("hit", 0.5); options())
	c.add_child(UI.button(Rect2(380, 340, 200, 36), D.t("keys_title") if D.t("keys_title") != "keys_title" else "Teclas", keys_page, 15))
	c.add_child(UI.button(Rect2(380, 430, 200, 36), D.t("back"), title, 15))

# ------------------------------------------------------------ escolha da vocação
func select() -> void:
	var c := _page()
	var dim := ColorRect.new(); dim.color = Color(0, 0, 0, 0.55); dim.size = Vector2(960, 540); c.add_child(dim)
	_l(c, D.t("select_vocation"), 36, 30, UI.TEXT, true)
	var x := 480 - 228.0
	for v in ["knight", "archer"]:
		var V: Dictionary = D.VOCATIONS[v]
		var card := NinePatchRect.new(); card.texture = UI.tex("res://assets/ui/card_selected.png"); card.patch_margin_left = 14; card.patch_margin_right = 14; card.patch_margin_top = 14; card.patch_margin_bottom = 14
		card.position = Vector2(x, 90); card.size = Vector2(214, 360); c.add_child(card)
		var por := TextureRect.new(); por.texture = UI.tex("res://assets/ui/%s.png" % V.portrait); por.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; por.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		por.size = Vector2(115, 115); por.position = Vector2(x + 50, 106); por.flip_h = v == "archer"; por.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; c.add_child(por)
		var n := UI.lbl(V.name, 24, UI.GOLD); n.position = Vector2(x, 228); n.size.x = 214; n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(n)
		var d1 := UI.wrap(UI.lbl(V.desc, 13), 182); d1.position = Vector2(x + 16, 264); c.add_child(d1)
		var pas = V.get("passive")
		var d2 := UI.wrap(UI.lbl(D.t("passive_prefix") + pas.name + ": " + pas.desc if pas else V.get("trait", ""), 11, UI.DIM), 182); d2.position = Vector2(x + 16, 340); c.add_child(d2)
		var ft := UI.lbl(D.t("level_n", {"n": Save.level(v)}), 14, UI.GOLD); ft.position = Vector2(x, 418); ft.size.x = 214; ft.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; c.add_child(ft)
		var b := Button.new(); b.flat = true; b.position = card.position; b.size = card.size; b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(func(): _start(v)); c.add_child(b)
		var tw := card.create_tween().set_loops(); tw.tween_property(card, "modulate:a", 0.85, 0.9); tw.tween_property(card, "modulate:a", 1.0, 0.9)
		x += 242
	c.add_child(UI.button(Rect2(380, 470, 200, 36), D.t("back"), title, 15))

func _start(v: String) -> void:
	Save.reg.vocation = v
	Save.reg.townSpawn = "gate"
	intro(v)

# ------------------------------------------------------------ introdução: Karhyn vista das costas do herói
func intro(v: String) -> void:
	var c := _page(); intro_done = false; in_intro = true
	var bk := ColorRect.new(); bk.color = Color("050406"); bk.size = Vector2(960, 540); c.add_child(bk)
	var img := TextureRect.new(); img.texture = UI.tex("res://assets/intro/%s_karhyn.jpg" % v); img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED; img.size = Vector2(960, 540); img.pivot_offset = Vector2(480, 270); img.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	img.modulate.a = 0; c.add_child(img)
	var tw := create_tween(); tw.tween_property(img, "modulate:a", 1.0, 1.2)
	create_tween().tween_property(img, "scale", Vector2(1.08, 1.08), 9.0).set_trans(Tween.TRANS_SINE)
	# a cor vai sumindo até ficar quase em preto e branco
	create_tween().tween_property(img, "self_modulate", Color(0.75, 0.75, 0.8), 7.0).set_delay(2.5)
	var bolt := ColorRect.new(); bolt.color = Color(0.9, 0.93, 1, 0); bolt.size = Vector2(960, 540); bolt.mouse_filter = Control.MOUSE_FILTER_IGNORE; c.add_child(bolt)
	var bt := create_tween(); bt.tween_interval(1.5)
	for i in 3: bt.tween_property(bolt, "color:a", 0.55, 0.03); bt.tween_property(bolt, "color:a", 0.0, 0.14)
	bt.tween_callback(func(): Sfx.play("explode", 0.35))
	var sk := UI.lbl(D.t("intro_skip"), 11, UI.DIM); sk.position = Vector2(700, 515); sk.size.x = 244; sk.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT; c.add_child(sk)
	get_tree().create_timer(8.0).timeout.connect(func(): if in_intro: _finish_intro())
	get_tree().create_timer(0.6).timeout.connect(func(): set_process_unhandled_input(true))
	set_process_unhandled_input(false)

func _unhandled_input(e: InputEvent) -> void:
	if in_intro and (e is InputEventKey or e is InputEventMouseButton or e is InputEventScreenTouch) and e.is_pressed():
		_finish_intro()

func _finish_intro() -> void:
	if intro_done: return
	intro_done = true
	var r := ColorRect.new(); r.color = Color(0, 0, 0, 0); r.size = Vector2(960, 540); add_child(r)
	var tw := create_tween(); tw.tween_property(r, "color:a", 1.0, 0.9)
	tw.tween_callback(func(): get_tree().change_scene_to_file("res://town.tscn"))

func _teste() -> void:
	var dir: String = OS.get_cmdline_user_args()[0]
	title(); await get_tree().create_timer(1.0).timeout; await _shot(dir + "/m1_titulo.png")
	options(); await get_tree().create_timer(0.4).timeout; await _shot(dir + "/m2_opcoes.png")
	keys_page(); await get_tree().create_timer(0.4).timeout; await _shot(dir + "/m2b_teclas.png")
	select(); await get_tree().create_timer(0.6).timeout; await _shot(dir + "/m3_classes.png")
	Save.reg.vocation = "archer"; intro("archer"); await get_tree().create_timer(3.0).timeout; await _shot(dir + "/m4_intro.png")
	print("TESTE MENU ok"); get_tree().quit()

func _shot(p: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(p)

# ------------------------------------------------------------ teclas: 2 por ação, clique e aperte a nova
var waiting = null
func keys_page() -> void:
	var c := _page(); waiting = null
	c.add_child(UI.panel(Rect2(60, 14, 840, 512)))
	_l(c, D.t("keys_hint"), 24, 13, UI.GOLD)
	var acts: Array = Keys.MAP.keys()
	for i in acts.size():
		var a: String = acts[i]; var col := i / 12; var row := i % 12
		var x := 84.0 + col * 410; var y := 52.0 + row * 36
		var l := UI.lbl(Keys.label(a), 13); l.position = Vector2(x, y + 6); l.size.x = 200; l.clip_text = true; c.add_child(l)
		var ks: Array = Keys.keys_of(a)
		for k in 2:
			var code: int = int(ks[k]) if k < ks.size() else 0
			var b := UI.button(Rect2(x + 206 + k * 90, y, 84, 30), Keys.key_name(code), func(): _wait_key(a, k), 12)
			if waiting and waiting[0] == a and waiting[1] == k: b.text = D.t("press_key")
			c.add_child(b)
	c.add_child(UI.button(Rect2(250, 482, 200, 32), D.t("reset_default"), func(): Keys.reset(); keys_page(), 13))
	c.add_child(UI.button(Rect2(510, 482, 200, 32), D.t("back"), options, 13))

func _wait_key(a: String, k: int) -> void:
	waiting = [a, k]; keys_page(); waiting = [a, k]

func _input(e: InputEvent) -> void:
	if waiting == null or not (e is InputEventKey and e.pressed and not e.echo): return
	get_viewport().set_input_as_handled()
	var w = waiting; waiting = null
	if e.physical_keycode != KEY_ESCAPE: Keys.set_key(w[0], w[1], e.physical_keycode)
	keys_page()
