extends Control
## Menu provisório da etapa 1: escolhe a vocação e o nível de teste (as habilidades liberam por nível).
const FONT := preload("res://assets/ui/alegreya.ttf")
const FONT_T := preload("res://assets/ui/cinzel.ttf")
var level := 1

func _ready() -> void:
	var bg := ColorRect.new(); bg.color = Color("0e0a0c"); bg.size = Vector2(960, 540); add_child(bg)
	var logo := TextureRect.new(); logo.texture = load("res://assets/ui/logo_vitula.png")
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.position = Vector2(280, 16); logo.size = Vector2(400, 130); logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; add_child(logo)
	var sub := _l("Versão Godot · etapa 1: herói, combate e HUD", 12, Color("9a8f80")); sub.position = Vector2(0, 150); sub.size = Vector2(960, 20); add_child(sub)
	var x := 250
	for v in ["knight", "archer"]:
		var b := Button.new(); b.position = Vector2(x, 190); b.size = Vector2(200, 230); b.focus_mode = Control.FOCUS_NONE
		var st := StyleBoxFlat.new(); st.bg_color = Color("1a1214"); st.border_color = Color("8a6a3a"); st.set_border_width_all(2)
		b.add_theme_stylebox_override("normal", st)
		var sh := st.duplicate(); sh.border_color = Color("e0bc60"); b.add_theme_stylebox_override("hover", sh); b.add_theme_stylebox_override("pressed", sh)
		var p := TextureRect.new(); p.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; p.texture = load("res://assets/ui/%s.png" % D.VOCATIONS[v].portrait); p.position = Vector2(36, 12); p.size = Vector2(128, 128)
		p.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED; p.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; p.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(p)
		var n := _l(D.VOCATIONS[v].name, 16, Color("e0bc60"), FONT_T); n.position = Vector2(0, 146); n.size = Vector2(200, 24); n.mouse_filter = Control.MOUSE_FILTER_IGNORE; b.add_child(n)
		var d := _l(D.VOCATIONS[v].desc, 10); d.position = Vector2(10, 174); d.size = Vector2(180, 50); d.custom_minimum_size = Vector2(180, 50); d.autowrap_mode = TextServer.AUTOWRAP_WORD; d.mouse_filter = Control.MOUSE_FILTER_IGNORE; b.add_child(d)
		b.pressed.connect(func(): _start(v))
		add_child(b); x += 260
	var lv := _l("", 12); lv.position = Vector2(0, 440); lv.size = Vector2(960, 20); add_child(lv)
	var row := HBoxContainer.new(); row.position = Vector2(330, 466); row.add_theme_constant_override("separation", 8); add_child(row)
	for n in [1, 10, 20, 30]:
		var b := Button.new(); b.text = "Nível %d" % n; b.focus_mode = Control.FOCUS_NONE; b.add_theme_font_override("font", FONT)
		b.pressed.connect(func(): level = n; lv.text = "Nível de teste: %d (libera as habilidades até esse nível)" % n)
		row.add_child(b)
	lv.text = "Nível de teste: 1 (libera as habilidades até esse nível)"
	var hint := _l("Setas/WASD: andar · Espaço: atacar · Q: ataque automático · G: cura · 1–7: habilidades · Z/C: poções · TAB: alvo · Esc: menu", 10, Color("9a8f80"))
	hint.position = Vector2(0, 508); hint.size = Vector2(960, 20); add_child(hint)

func _l(t: String, s: int, c := Color("e8dcc0"), f: Font = FONT) -> Label:
	var l := Label.new(); l.text = t; l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", f); l.add_theme_font_size_override("font_size", s); l.add_theme_color_override("font_color", c)
	return l

func _start(v: String) -> void:
	Save.data.run = {"voc": v, "level": level}
	get_tree().change_scene_to_file("res://game.tscn")
