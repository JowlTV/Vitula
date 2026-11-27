extends CanvasLayer
## Teia de talentos estilo Path of Exile (porte de talents.js): 151 nós por classe, 1 ponto por nível,
## só se aloca nó ligado a outro já alocado. Tecla U abre; a Oráculo de Karhyn abre no modo respec. Autoload "Talents".
var webs := {}          # voc -> {nodes: Array, by: {id: node}}
var box: Control
var host
var voc := "knight"
var respec := false
var undo: Array = []
var hover := ""
var view: Control
var tip: Label
var pts_l: Label
var sum_l: Label
var all_b: Button
var undo_b: Button
var drag_from = null
var drag_moved := false
const PANEL := 230.0

func _init() -> void: layer = 26; process_mode = Node.PROCESS_MODE_ALWAYS

func _ready() -> void:
	var raw = JSON.parse_string(FileAccess.get_file_as_string("res://data/webs.json"))
	for v in raw:
		var by := {}
		for n in raw[v].nodes: by[n.id] = n
		webs[v] = {"nodes": raw[v].nodes, "by": by, "branches": raw[v].branches}

func web(v: String) -> Dictionary: return webs.get(v, webs.knight)

func ranks(v: String) -> Dictionary:
	var d := Save.voc(v)
	if int(d.get("talentsV", 0)) != 3: d.talents = {}; d.talentsV = 3
	return d.talents
func spent(v: String) -> int: return ranks(v).size()
func points(v: String, level := -1) -> int:
	if level < 0: level = Save.level(v)
	return maxi(0, level - 1 - spent(v))

## soma dos efeitos dos nós alocados; ks = keystones
func fx(v: String) -> Dictionary:
	var r := ranks(v); var w := web(v); var out := {"ks": {}}
	for id in r:
		var n = w.by.get(id)
		if n == null: continue
		for e in n.fx: out[e] = out.get(e, 0.0) + float(n.fx[e])
		if n.type == "keystone": out.ks[n.get("flag", n.id) if n.get("flag") else n.id] = true
	return out

## habilidade liberada? (Exura e a 1ª da classe sempre; as outras pelo nó + nível mínimo)
func spell_unlocked(v: String, id: String, level: int) -> bool:
	var sp = D.spells(v).get(id)
	if sp == null or level < int(sp.get("level", 1)): return false
	for n in web(v).nodes:
		if n.get("unlock", "") == id: return ranks(v).has(n.id) or id in Save.voc(v).get("legacySpells", [])
	return true

func frontier(v: String) -> Dictionary:
	var r := ranks(v); var f := {}
	for n in web(v).nodes:
		if n.id == "o" or r.has(n.id):
			for nb in n.adj:
				if nb != "o" and not r.has(nb): f[nb] = true
	return f

func removable(v: String, id: String) -> bool:
	var r := ranks(v); var w := web(v)
	if not r.has(id): return false
	var seen := {"o": true}; var q := ["o"]
	while q.size():
		var c: String = q.pop_front()
		for nb in w.by[c].adj:
			if nb != id and r.has(nb) and not seen.has(nb): seen[nb] = true; q.append(nb)
	for k in r:
		if k != id and not seen.has(k): return false
	return true

func path(v: String, target: String) -> Variant:
	var r := ranks(v); var w := web(v); var prev := {}; var q := []
	for n in w.nodes:
		if n.id == "o" or r.has(n.id): prev[n.id] = ""; q.append(n.id)
	if prev.has(target): return []
	while q.size():
		var c: String = q.pop_front()
		for nb in w.by[c].adj:
			if not prev.has(nb):
				prev[nb] = c
				if nb == target:
					var p := []; var x: String = nb
					while x != "" and not (x == "o" or r.has(x)): p.append(x); x = prev[x]
					return p
				q.append(nb)
	return null

func respec_price(level: int) -> int: return 0 if level <= 10 else 2 * level

func fx_text(f: Dictionary) -> String:
	var parts := []
	for k in f:
		var lab: Array = D.db.FX_LABEL.get(k, [k, ""]); var v: float = f[k]
		if lab[1] == "%-": parts.append("−%s%% de %s" % [str(snappedf(v * 100, 0.1)), lab[0]]); continue
		var val := (str(snappedf(v * 100, 0.1)) + "%") if lab[1] == "%" else str(snappedf(v, 0.1))
		parts.append("%s%s %s%s" % ["" if v < 0 else "+", val, "de " if lab[1] == "%" else "", lab[0]])
	return ", ".join(parts)

# ------------------------------------------------------------ tela (constelação)
func is_open() -> bool: return box != null

func open(h, v: String, as_respec: bool) -> void:
	if box: return
	host = h; voc = v; respec = as_respec; undo = []; hover = ""
	if h and h.has_method("set_paused"): h.set_paused(true)
	box = Control.new(); box.size = Vector2(960, 540); add_child(box)
	var bg := ColorRect.new(); bg.color = Color("05060a"); bg.size = Vector2(960, 540); box.add_child(bg)
	var sky := Control.new(); sky.size = Vector2(960 - PANEL, 540); sky.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sky.draw.connect(func():
		for i in 220:
			var hh := (i * 2654435761 * 40503) & 0xffffffff
			sky.draw_rect(Rect2(hh % int(960 - PANEL), (hh >> 10) % 540, 1 + int(hh % 7 == 0), 1), Color(0.78, 0.82, 1, 0.15 + (hh % 50) / 160.0)))
	box.add_child(sky)
	var clip := Control.new(); clip.size = Vector2(960 - PANEL, 540); clip.clip_contents = true; box.add_child(clip)
	view = Control.new(); view.position = Vector2((960 - PANEL) / 2, 280); view.scale = Vector2.ONE * (0.55 if Touch.enabled else 0.5)
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE; clip.add_child(view)
	view.draw.connect(_draw_web)
	clip.gui_input.connect(_web_input)
	# ícones das habilidades sobre os losangos
	for n in web(v).nodes:
		if n.type == "skill":
			var sp = D.spells(v).get(n.unlock)
			if sp: var ic := UI.icon(UI.tex("res://assets/icons/%s.png" % sp.icon), Vector2(n.x, n.y), 18); view.add_child(ic)
	# painel lateral
	var P := Control.new(); P.position = Vector2(960 - PANEL, 0); box.add_child(P)
	P.add_child(UI.box(Rect2(0, 0, PANEL, 540), Color("0c0a08"), Color("5a4a2a")))
	var t := UI.lbl(D.t("talent_web_title") if D.t("talent_web_title") != "talent_web_title" else "Teia de Talentos", 20, UI.GOLD, true); t.position = Vector2(0, 12); t.size.x = PANEL; t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; P.add_child(t)
	pts_l = UI.lbl("", 13, Color("d8ffc8")); pts_l.position = Vector2(0, 44); pts_l.size.x = PANEL; pts_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; P.add_child(pts_l)
	var sb := UI.lbl("Seus bônus", 13, UI.GOLD); sb.position = Vector2(12, 70); P.add_child(sb)
	sum_l = UI.wrap(UI.lbl("", 11), PANEL - 24); sum_l.position = Vector2(12, 90); P.add_child(sum_l)
	tip = UI.wrap(UI.lbl("", 11), PANEL - 24); tip.position = Vector2(12, 540 - 200); P.add_child(tip)
	undo_b = UI.button(Rect2(20, 540 - 92, PANEL - 40, 24), "Desfazer último", func():
		if undo.is_empty(): return
		var id: String = undo.pop_back()
		if removable(voc, id): ranks(voc).erase(id); Save.save(); _changed(), 12)
	P.add_child(undo_b)
	if respec:
		all_b = UI.button(Rect2(20, 540 - 64, PANEL - 40, 24), "", func():
			var d := Save.voc(voc); var n := spent(voc); var cost := n * respec_price(Save.level(voc))
			if n == 0 or int(d.gold) < cost: return
			d.gold -= cost; d.talents = {}; Save.save(); undo = []; _changed(); Sfx.play("gem", 0.3), 12)
		P.add_child(all_b)
	P.add_child(UI.button(Rect2(20, 540 - 36, PANEL - 40, 26), "Fechar (U / Esc)", close, 13))
	_show_tip(null); _redraw()

func close() -> void:
	if box: box.queue_free(); box = null
	if host and host.has_method("set_paused"): host.set_paused(false)
	if host and host.has_method("on_talents_closed"): host.on_talents_closed()

func _unhandled_input(e: InputEvent) -> void:
	if box == null: return
	if e is InputEventKey and e.pressed and not e.echo:
		match e.keycode:
			KEY_ESCAPE, KEY_U: close()
			KEY_LEFT: view.position.x += 40
			KEY_RIGHT: view.position.x -= 40
			KEY_UP: view.position.y += 40
			KEY_DOWN: view.position.y -= 40
			KEY_EQUAL, KEY_KP_ADD: _zoom(1.15, view.get_parent().size / 2)
			KEY_MINUS, KEY_KP_SUBTRACT: _zoom(0.87, view.get_parent().size / 2)
			_: return
		get_viewport().set_input_as_handled()

func _zoom(f: float, at: Vector2) -> void:
	var s0 := view.scale.x; var s1: float = clamp(s0 * f, 0.25, 1.6)
	view.position = at - (at - view.position) * s1 / s0; view.scale = Vector2(s1, s1)

func _node_at(p: Vector2):
	var local := (p - view.position) / view.scale.x
	var best = null; var bd := 1e9
	for n in web(voc).nodes:
		var R := 24.0 if n.type == "keystone" else 19.0 if n.type == "notable" else 16.0
		if Touch.enabled: R += 8
		var dd := local.distance_to(Vector2(n.x, n.y))
		if dd < R and dd < bd: bd = dd; best = n
	return best

var _touches := {}
func _web_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP and e.pressed: _zoom(1.14, e.position); return
		if e.button_index == MOUSE_BUTTON_WHEEL_DOWN and e.pressed: _zoom(0.88, e.position); return
		if e.button_index == MOUSE_BUTTON_LEFT:
			if e.pressed: drag_from = [e.position, view.position]; drag_moved = false
			else:
				if not drag_moved:
					var n = _node_at(e.position)
					if n: _click(n)
				drag_from = null
	elif e is InputEventMouseMotion:
		if drag_from and (e.button_mask & MOUSE_BUTTON_MASK_LEFT):
			var dd: Vector2 = e.position - drag_from[0]
			if abs(dd.x) + abs(dd.y) > 6: drag_moved = true
			view.position = drag_from[1] + dd
		var n = _node_at(e.position)
		var id: String = n.id if n else ""
		if id != hover: hover = id; _show_tip(n); _redraw()
	elif e is InputEventMagnifyGesture: _zoom(e.factor, e.position)

func _click(n) -> void:
	var r := ranks(voc); var d := Save.voc(voc)
	if respec and r.has(n.id):
		var cost := respec_price(Save.level(voc))
		if not removable(voc, n.id) or int(d.gold) < cost: Sfx.play("hit", 0.2); return
		d.gold -= cost; r.erase(n.id); Save.save(); _changed(); Sfx.play("gem", 0.25); return
	if r.has(n.id) or n.id == "o": return
	if not frontier(voc).has(n.id) or points(voc, _level()) <= 0: hover = n.id; _show_tip(n); _redraw(); Sfx.play("hit", 0.15); return
	r[n.id] = 1; undo.append(n.id); Save.save(); _changed()
	if n.get("unlock"):
		var sp = D.spells(voc).get(n.unlock)
		if sp and host and host.get("world") and host.world: host.world.emit_signal("msg", D.t("talent_unlock", {"name": sp.name, "key": sp.key, "n": int(sp.level)}))
		Sfx.play("levelup", 0.35)
	else: Sfx.play("gem", 0.3)

func _level() -> int:
	if host and host.get("world") and host.world and host.world.get("hero"): return host.world.hero.level
	return Save.level(voc)

func _changed() -> void:
	if host and host.get("world") and host.world and host.world.has_method("restat"): host.world.restat()
	_redraw()

func _redraw() -> void:
	view.queue_redraw()
	var pts := points(voc, _level())
	pts_l.text = ("%d ponto(s) para gastar" % pts) if pts > 0 else "Sem pontos livres"
	pts_l.add_theme_color_override("font_color", Color("d8ffc8") if pts > 0 else UI.DIM)
	var f := fx(voc); var lines := []
	for k in f:
		if k != "ks" and f[k]: lines.append("• " + fx_text({k: f[k]}))
	for id in ranks(voc):
		var n = web(voc).by.get(id)
		if n and n.type in ["keystone", "notable"]: lines.append("★ " + n.name)
	sum_l.text = "\n".join(lines.slice(0, 16)) + (("\n… +%d" % (lines.size() - 16)) if lines.size() > 16 else "") if lines.size() else "Nada ainda. Comece pelos nós ligados à Origem (contorno verde)."
	undo_b.modulate.a = 1.0 if undo.size() else 0.4
	if all_b:
		var n := spent(voc); var cost := n * respec_price(Save.level(voc))
		all_b.text = "Devolver tudo (%d de ouro)" % cost; all_b.modulate.a = 1.0 if n and int(Save.voc(voc).gold) >= cost else 0.4

func _show_tip(n) -> void:
	if n == null:
		tip.text = "Respec: clique num nó com contorno vermelho para devolvê-lo." if respec else "Arraste para mover · roda ou pinça para zoom · clique num nó ligado para alocar."
		return
	var r := ranks(voc)
	var s: String = n.name + {"notable": " (notável)", "keystone": " (keystone)", "skill": " (habilidade)"}.get(n.type, "") + "\n"
	if n.get("desc"): s += n.desc + "\n"
	elif n.fx.size(): s += fx_text(n.fx) + "\n"
	if n.get("unlock"):
		var sp = D.spells(voc).get(n.unlock)
		s += "Libera %s%s\n" % [sp.name if sp else n.unlock, (" (nível %d)" % int(sp.level)) if sp and int(sp.level) > 1 else ""]
	if r.has(n.id) or n.id == "o":
		s += ("Devolver: %d de ouro" % respec_price(Save.level(voc)) if removable(voc, n.id) else "Devolva antes os nós além dele") if respec and n.id != "o" else "Alocado"
	else:
		var p = path(voc, n.id)
		if p != null: s += "Custa %d ponto(s)%s" % [p.size(), " — faltam pontos" if p.size() > points(voc, _level()) else ""]
	tip.text = s

func _draw_web() -> void:
	var w := web(voc); var r := ranks(voc); var fr := frontier(voc); var pts := points(voc, _level())
	for n in w.nodes:
		for nb in n.adj:
			if n.id < nb:
				var m = w.by[nb]
				var own: bool = (n.id == "o" or r.has(n.id)) and (m.id == "o" or r.has(m.id))
				view.draw_line(Vector2(n.x, n.y), Vector2(m.x, m.y), Color("c8a050") if own else Color("2e3240"), 4.0 if own else 2.0)
	if hover != "" and not r.has(hover):
		var p = path(voc, hover)
		if p:
			var prev := ""
			for i in range(p.size() - 1, -1, -1):
				var n = w.by[p[i]]
				var from = w.by[prev] if prev != "" else null
				if from == null:
					for a in n.adj:
						if a == "o" or r.has(a): from = w.by[a]; break
				if from: view.draw_line(Vector2(from.x, from.y), Vector2(n.x, n.y), Color("9fe08a") if p.size() <= pts else Color("d05a4a"), 4.0)
				prev = p[i]
	for n in w.nodes:
		var own: bool = n.id == "o" or r.has(n.id); var av := fr.has(n.id)
		var col := Color("e0b050") if own else Color("8a8e9c") if av else Color("4a4e5c")
		var R := 20.0 if n.type == "keystone" else 15.0 if n.type == "notable" else 13.0 if n.type == "skill" else 16.0 if n.type == "origin" else 9.0
		var c := Vector2(n.x, n.y)
		if own: view.draw_circle(c, R + 8, Color(1, 0.94, 0.69, 0.18))
		var fill := col if own else Color("14161e")
		if n.type == "keystone":
			var pp := PackedVector2Array()
			for i in 6: pp.append(c + Vector2.from_angle(i * PI / 3) * R)
			view.draw_colored_polygon(pp, fill); pp.append(pp[0]); view.draw_polyline(pp, Color("fff0b0") if own else Color("d06a4a"), 3)
		elif n.type == "skill":
			var pp := PackedVector2Array([c + Vector2(0, -R), c + Vector2(R, 0), c + Vector2(0, R), c + Vector2(-R, 0)])
			view.draw_colored_polygon(pp, fill); pp.append(pp[0]); view.draw_polyline(pp, Color("fff0b0") if own else Color("7ab0ff"), 3)
		else:
			view.draw_circle(c, R, fill)
			view.draw_arc(c, R, 0, TAU, 24, Color("fff0b0") if own else Color("c8a050") if n.type == "notable" else col, 3.0 if n.type == "notable" else 2.0)
		if av and pts > 0: view.draw_arc(c, R + 5, 0, TAU, 24, Color("9fe08a"), 2)
		if respec and own and n.id != "o" and removable(voc, n.id): view.draw_arc(c, R + 5, 0, TAU, 24, Color("d05a4a"), 2)
