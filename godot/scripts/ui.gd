extends Node
## Ajudantes de interface (porte de txt/button/nineslice do Phaser). Autoload "UI".
const FONT := preload("res://assets/ui/alegreya.ttf")
const FONT_T := preload("res://assets/ui/cinzel.ttf")
const GOLD := Color("e0bc60")
const TEXT := Color("e8dcc0")
const DIM := Color("9a8f80")
const HURT := Color("e05050")
var panel_tex: Texture2D
var slot_tex: Texture2D

func _ready() -> void:
	panel_tex = load("res://assets/ui/panel.png")
	slot_tex = load("res://assets/ui/slot.png")

func lbl(text: String, size := 13, col := TEXT, title := false) -> Label:
	var l := Label.new(); l.text = text
	l.add_theme_font_override("font", FONT_T if title else FONT); l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color("0c0608")); l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func wrap(l: Label, w: float) -> Label:
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; l.custom_minimum_size.x = w; l.size.x = w
	return l

## painel com a moldura do jogo (9-slice de 16 px)
func panel(rect: Rect2, alpha := 1.0) -> NinePatchRect:
	var p := NinePatchRect.new(); p.texture = panel_tex
	p.patch_margin_left = 16; p.patch_margin_right = 16; p.patch_margin_top = 16; p.patch_margin_bottom = 16
	p.position = rect.position; p.size = rect.size; p.modulate.a = alpha
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	return p

func slot(rect: Rect2) -> NinePatchRect:
	var p := NinePatchRect.new(); p.texture = slot_tex
	p.patch_margin_left = 4; p.patch_margin_right = 4; p.patch_margin_top = 4; p.patch_margin_bottom = 4
	p.position = rect.position; p.size = rect.size
	return p

func box(rect: Rect2, fill: Color, border := Color("7a6440"), bw := 1) -> Panel:
	var p := Panel.new(); p.position = rect.position; p.size = rect.size
	var s := StyleBoxFlat.new(); s.bg_color = fill; s.border_color = border; s.set_border_width_all(bw)
	p.add_theme_stylebox_override("panel", s)
	return p

## botão no estilo do jogo
func button(rect: Rect2, text: String, fn: Callable, size := 14) -> Button:
	var b := Button.new(); b.text = text; b.position = rect.position; b.size = rect.size; b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_override("font", FONT); b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", TEXT); b.add_theme_color_override("font_hover_color", Color("ffe8b0"))
	var n := StyleBoxFlat.new(); n.bg_color = Color("1a1612"); n.border_color = Color("7a6440"); n.set_border_width_all(1)
	var h := n.duplicate(); h.border_color = Color("e8cc80"); h.set_border_width_all(2)
	var p := n.duplicate(); p.bg_color = Color("5a3e18"); p.border_color = Color("e8cc80")
	var d := n.duplicate(); d.bg_color = Color("141210"); d.border_color = Color("3a3228")
	b.add_theme_stylebox_override("normal", n); b.add_theme_stylebox_override("hover", h)
	b.add_theme_stylebox_override("pressed", p); b.add_theme_stylebox_override("disabled", d)
	b.pressed.connect(fn)
	return b

func icon(tex: Texture2D, center: Vector2, max_side: float) -> TextureRect:
	var r := TextureRect.new(); r.texture = tex; r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED; r.size = Vector2(max_side, max_side)
	r.position = center - r.size / 2; r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

func color_int(v: int) -> Color: return Color8((v >> 16) & 255, (v >> 8) & 255, v & 255)

## textura por caminho, com cache (aceita png/jpg dentro do projeto)
var _tex := {}
func tex(path: String) -> Texture2D:
	if not _tex.has(path): _tex[path] = load(path) if ResourceLoader.exists(path) else null
	return _tex[path]
