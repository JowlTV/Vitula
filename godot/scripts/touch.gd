extends Node
## Controles de toque da cidade (celular): direcional à esquerda e botões à direita. Autoload "Touch".
## Na masmorra o HUD tem os próprios controles (hud.gd).
var enabled := false
var dir := Vector2i.ZERO
var _center := Vector2.ZERO
var _id := -1
var _knob: Panel

func _ready() -> void:
	enabled = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")

func attach(layer: CanvasLayer, host) -> void:
	dir = Vector2i.ZERO; _id = -1
	if not enabled: return
	var pad := Control.new(); pad.position = Vector2(20, 330); pad.size = Vector2(190, 190); layer.add_child(pad)
	var base := UI.box(Rect2(0, 0, 190, 190), Color(0, 0, 0, 0.25), Color(1, 1, 1, 0.25)); base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var st: StyleBoxFlat = base.get_theme_stylebox("panel"); st.set_corner_radius_all(95); pad.add_child(base)
	_knob = UI.box(Rect2(70, 70, 50, 50), Color(1, 1, 1, 0.3), Color(1, 1, 1, 0.5)); _knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	(_knob.get_theme_stylebox("panel") as StyleBoxFlat).set_corner_radius_all(25); pad.add_child(_knob)
	pad.gui_input.connect(func(e):
		if e is InputEventScreenTouch:
			if e.pressed: _id = e.index; _move(e.position)
			elif e.index == _id: _id = -1; dir = Vector2i.ZERO; _knob.position = Vector2(70, 70)
		elif e is InputEventScreenDrag and e.index == _id: _move(e.position))
	var y := 360.0
	for a in [["interact", "E"], ["bag", "Mochila"], ["map", "Mapa"]]:
		var b := UI.button(Rect2(830, y, 110, 46), a[1], func(): host.touch_action(a[0]), 16); layer.add_child(b); y += 56

func _move(p: Vector2) -> void:
	var v := p - Vector2(95, 95)
	_knob.position = Vector2(70, 70) + v.limit_length(60)
	if v.length() < 22: dir = Vector2i.ZERO; return
	var a := v.angle()
	var oct := posmod(roundi(a / (PI / 4)), 8)
	dir = [Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1), Vector2i(-1, 1), Vector2i(-1, 0), Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1)][oct]
