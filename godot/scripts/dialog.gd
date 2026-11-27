extends CanvasLayer
## Conversa em formato de chat (porte de TownScene.say): balões do NPC à esquerda, suas respostas à direita,
## opções numeradas embaixo (clique, 1–9, setas + Enter/E). Também abre janelas próprias (loja, depot...).
signal closed
var root: Control
var room: TextureRect
var chat_with := ""
var chat_log: Array = []
var btns: Array = []          # [{b, fn}]
var sel := 0
var opened_at := 0
var sending := false
var window: Control = null    # janela própria aberta (loja, baú...)
var room_tw: Tween

func _init() -> void: layer = 20

func _ready() -> void:
	room = TextureRect.new(); room.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; room.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	room.size = Vector2(960, 540); room.visible = false; room.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(room)

func is_open() -> bool: return root != null or window != null

## sala de atendimento atrás da conversa (arte do lugar, tela cheia)
func show_room(path: String) -> void:
	var t := UI.tex(path)
	if t == null: return
	if room_tw: room_tw.kill()
	var was := room.visible and room.texture == t
	room.texture = t; room.visible = true
	if was: room.modulate.a = 1.0; return
	room.modulate.a = 0
	room_tw = create_tween(); room_tw.tween_property(room, "modulate:a", 1.0, 0.22)

func say(title: String, body: String, buttons: Array, face: Texture2D = null) -> void:
	if window: window.queue_free(); window = null
	if not (root and chat_with == title): _clear(); chat_log = []
	elif root: root.queue_free(); root = null
	chat_with = title
	chat_log.append({"me": false, "text": body})
	root = Control.new(); root.size = Vector2(960, 540); root.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(root)
	var in_room := room.visible
	var w := 430.0 if in_room else 640.0
	var x := 12.0 if in_room else 480.0 - w / 2
	var pad := 18.0
	var max_w := w - 2 * pad - 120
	# balões (os mais recentes que cabem em 230 px)
	var bubbles := []
	for m in chat_log:
		var l := UI.wrap(UI.lbl(m.text, 13, Color("fff0cc") if m.me else UI.TEXT), max_w - 20)
		l.add_theme_constant_override("line_spacing", 2)
		var lines := maxi(1, l.get_line_count()) if l.is_inside_tree() else _est_lines(m.text, max_w - 20)
		bubbles.append({"m": m, "l": l, "h": lines * 19 + 16})
	var used := 0.0; var first := bubbles.size()
	while first > 0 and used + bubbles[first - 1].h + 8 <= 230:
		first -= 1; used += bubbles[first].h + 8
	var opt_h := 34.0; var header := 70.0
	var hgt := header + used + 14 + buttons.size() * (opt_h + 6) + 10
	var y := 540.0 - hgt - 12
	root.add_child(UI.panel(Rect2(x, y, w, hgt), 0.85 if in_room else 1.0))
	var tx := x + pad
	if face:
		root.add_child(UI.box(Rect2(x + pad, y + pad - 4, 56, 56), Color("0c0a08"), Color("c8a050"), 2))
		var fr := UI.icon(face, Vector2(x + pad + 28, y + pad + 24), 52); fr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		fr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR; root.add_child(fr); tx += 70
	var tl := UI.lbl(title, 20, UI.GOLD); tl.position = Vector2(tx, y + pad - 2); root.add_child(tl)
	var cy := y + header
	for i in range(first, bubbles.size()):
		var bb = bubbles[i]
		var bw: float = min(max_w, _est_w(bb.m.text) + 20)
		var bx: float = x + w - pad - bw if bb.m.me else x + pad
		root.add_child(UI.box(Rect2(bx, cy, bw, bb.h), Color("5a3e18") if bb.m.me else Color("2a241c"), Color("e8cc80") if bb.m.me else Color("5a4c38")))
		bb.l.position = Vector2(bx + 10, cy + 6); bb.l.size.x = bw - 20; bb.l.custom_minimum_size.x = bw - 20; root.add_child(bb.l)
		cy += bb.h + 8
	btns = []
	var oy := y + header + used + 14
	for i in buttons.size():
		var label: String = buttons[i][0]; var fn: Callable = buttons[i][1]
		var b := UI.button(Rect2(x + pad, oy, w - 2 * pad, opt_h), "%d  ›  %s" % [i + 1, label], func(): _send(i), 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.mouse_entered.connect(func(): _select(i))
		root.add_child(b); btns.append({"b": b, "fn": fn, "label": label})
		oy += opt_h + 6
	opened_at = Time.get_ticks_msec()
	_select(0)

func _est_lines(s: String, w: float) -> int:
	var n := 0
	for part in s.split("\n"): n += maxi(1, ceili(part.length() * 6.6 / w))
	return n
func _est_w(s: String) -> float:
	var m := 0.0
	for part in s.split("\n"): m = max(m, part.length() * 6.6)
	return m

func _select(i: int) -> void:
	if btns.is_empty(): return
	sel = posmod(i, btns.size())
	for k in btns.size():
		var st: StyleBoxFlat = btns[k].b.get_theme_stylebox("normal").duplicate()
		st.border_color = Color("e8cc80") if k == sel else Color("7a6440"); st.set_border_width_all(2 if k == sel else 1)
		btns[k].b.add_theme_stylebox_override("normal", st)

func _send(i: int) -> void:
	if root == null or sending or i >= btns.size(): return
	sending = true
	var keep := chat_with; var n := chat_log.size()
	chat_log.append({"me": true, "text": btns[i].label})
	var fn: Callable = btns[i].fn
	Sfx.play("pickup", 0.15)
	await get_tree().create_timer(0.22).timeout
	sending = false
	fn.call()
	if root and chat_with == keep and chat_log.size() == n + 1: close()

## janela própria (loja, baú, forja...). Fecha a conversa e fica por cima da sala.
func open_window(c: Control) -> void:
	_clear_chat()
	if window: window.queue_free()
	window = c; add_child(c)

func _clear_chat() -> void:
	if root: root.queue_free(); root = null
	btns = []; chat_with = ""; sending = false

func _clear() -> void:
	_clear_chat()
	if window: window.queue_free(); window = null

func close() -> void:
	var was := is_open()
	_clear()
	if room.visible:
		if room_tw: room_tw.kill()
		room_tw = create_tween(); room_tw.tween_interval(0.05); room_tw.tween_property(room, "modulate:a", 0.0, 0.2); room_tw.tween_callback(func(): if not is_open(): room.visible = false)
	if was: closed.emit()

func _unhandled_input(e: InputEvent) -> void:
	if not is_open() or not (e is InputEventKey and e.pressed and not e.echo): return
	if e.keycode == KEY_ESCAPE: close(); get_viewport().set_input_as_handled(); return
	if root == null or btns.is_empty() or sending or Time.get_ticks_msec() - opened_at < 180: return
	var k: int = e.keycode
	if k >= KEY_1 and k <= KEY_9 and k - KEY_1 < btns.size(): _send(k - KEY_1)
	elif k == KEY_UP or k == KEY_LEFT or k == KEY_W: _select(sel - 1)
	elif k == KEY_DOWN or k == KEY_RIGHT or k == KEY_S: _select(sel + 1)
	elif k == KEY_ENTER or k == KEY_SPACE or k == KEY_E or k == KEY_KP_ENTER: _send(sel)
	else: return
	get_viewport().set_input_as_handled()
