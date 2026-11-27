extends CanvasLayer
## Bestiário (porte de bestiary.js): cada espécie se revela conforme você a abate (todas as vocações somam).
## Etapas: Avistado · Conhecido · Dominado · ★ Completo (+5% de dano e −5% de dano recebido contra a espécie).
## Tecla N (masmorra e cidade) ou a Biblioteca de Karhyn. Autoload "Best".
const BONUS := 0.05
var box: Control
var host

func _init() -> void: layer = 26; process_mode = Node.PROCESS_MODE_ALWAYS

func order() -> Array: return D.db.BEST_ORDER.filter(func(id): return D.MONSTERS.has(id) and not id.begins_with("goblin"))
func tiers(id: String) -> Array:
	var M: Dictionary = D.MONSTERS[id]
	if M.get("elite", false): return [1, 3, 10, 25]
	if M.xp >= 60 or id == "poison_spider": return [1, 25, 100, 250]
	return [1, 50, 250, 500]
func kills(id: String, live := {}) -> int: return int(Save.data.bestiary.get(id, 0)) + int(live.get(id, 0))
func tier(id: String, live := {}) -> int:
	var n := kills(id, live); var T: Array = tiers(id); var k := 0
	while k < 4 and n >= T[k]: k += 1
	return k
func complete(id: String, live := {}) -> bool: return tier(id, live) >= 4

func habitat(id: String) -> Array:
	var out := []; var fl := []
	for f in D.db.FLOOR_MONSTERS:
		for e in D.db.FLOOR_MONSTERS[f]:
			if e[0] == id: fl.append(int(f))
	fl.sort()
	if fl.size(): out.append(D.t("best_where_floors", {"region": D.db.REGIONS.karhyn_sewers.name, "f": str(fl[0]) if fl.size() == 1 else "%d–%d" % [fl[0], fl[-1]]}))
	if id == "giant_rat": out.append(D.t("best_where_boss", {"region": D.db.REGIONS.karhyn_sewers.name, "f": 5}))
	if id == "giant_spider": out.append(D.t("best_where_floors", {"region": D.db.REGIONS.karhyn_sewers.name, "f": "3"}))
	return out

func is_open() -> bool: return box != null
func close() -> void:
	if box: box.queue_free(); box = null
	if host and host.has_method("set_paused"): host.set_paused(false)
var opened_frame := -1
func _unhandled_input(e: InputEvent) -> void:
	if Engine.get_process_frames() - opened_frame < 2: return
	if box and e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_ESCAPE, KEY_N]: close(); get_viewport().set_input_as_handled()

func _live() -> Dictionary:
	if host and host.get("world") and host.world: return host.world.kills_by_type
	return {}

func open(h, sel := "") -> void:
	opened_frame = Engine.get_process_frames()
	host = h
	if h and h.has_method("set_paused"): h.set_paused(true)
	if box: box.queue_free()
	var live := _live()
	box = Control.new(); box.size = Vector2(960, 540); add_child(box)
	var bg := ColorRect.new(); bg.color = Color(0, 0, 0, 0.65); bg.size = Vector2(960, 540); box.add_child(bg)
	var W := 880.0; var H := 500.0; var X := 480 - W / 2; var Y := 270 - H / 2
	box.add_child(UI.panel(Rect2(X, Y, W, H)))
	var L := func(s: String, p: Vector2, size := 13, col := UI.TEXT, wrap_w := 0.0) -> Label:
		var l := UI.lbl(s, size, col); l.position = p
		if wrap_w > 0: UI.wrap(l, wrap_w)
		box.add_child(l); return l
	var t: Label = L.call(D.t("best_title"), Vector2(X, Y + 8), 24, UI.GOLD); t.size.x = W; t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var ids := order()
	var seen := ids.filter(func(i): return tier(i, live) > 0).size(); var done := ids.filter(func(i): return complete(i, live)).size()
	var pl: Label = L.call(D.t("best_progress", {"s": seen, "d": done, "n": ids.size()}), Vector2(X, Y + 40), 12, UI.DIM); pl.size.x = W; pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(UI.button(Rect2(X + W - 50, Y + 14, 30, 24), "✕", close, 12))
	if sel == "":
		for i in ids:
			if tier(i, live) > 0: sel = i; break
		if sel == "": sel = ids[0]
	var lx := X + 22; var ly := Y + 66; var rh := 31.0
	for k in ids.size():
		var id: String = ids[k]; var tr := tier(id, live); var on := id == sel; var y := ly + k * rh
		var b := UI.button(Rect2(lx, y, 260, rh - 4), "", func(): open(host, id), 12)
		if on: b.add_theme_stylebox_override("normal", (func(): var st: StyleBoxFlat = b.get_theme_stylebox("normal").duplicate(); st.bg_color = Color("3a2e1c"); st.border_color = UI.GOLD; return st).call())
		box.add_child(b)
		var sf: SpriteFrames = A.monster(id)
		if sf and sf.has_animation("walk"):
			var ic := UI.icon(sf.get_frame_texture("walk", 0), Vector2(lx + 18, y + (rh - 4) / 2), 26)
			if not tr: ic.modulate = Color(0.02, 0.02, 0.02, 0.8)
			box.add_child(ic)
		L.call(D.MONSTERS[id].name if tr else "???", Vector2(lx + 38, y + 5), 13, Color("ffb050") if tr >= 4 else (UI.TEXT if tr else UI.DIM))
		L.call("★".repeat(max(0, tr - 1)) + "☆".repeat(3 - max(0, tr - 1)), Vector2(lx + 205, y + 6), 11, Color("ffb050") if tr >= 4 else UI.GOLD)
	# detalhe
	var px := X + 310; var py := Y + 66; var pw := W - 330; var M: Dictionary = D.MONSTERS[sel]; var tr := tier(sel, live); var n := kills(sel, live); var T: Array = tiers(sel)
	box.add_child(UI.box(Rect2(px, py, pw, H - 80), Color(0.07, 0.055, 0.047, 0.85), Color("5a4630")))
	var sf: SpriteFrames = A.monster(sel)
	if sf and sf.has_animation("walk"):
		var tex := sf.get_frame_texture("walk", 0)
		var im := TextureRect.new(); im.texture = tex; im.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; im.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		im.size = Vector2(170, 170); im.position = Vector2(px + 25, py + 35); im.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		if not tr: im.modulate = Color(0.02, 0.02, 0.02, 0.85)
		box.add_child(im)
	var tx := px + 230; var tw := pw - 250
	L.call(M.name if tr else "???", Vector2(tx, py + 10), 24, Color("ffb050") if tr >= 4 else UI.GOLD)
	L.call(D.t("best_tier_%d" % tr) if tr else D.t("best_unknown"), Vector2(tx, py + 44), 13, Color("ffb050") if tr >= 4 else Color("c8b890"))
	var nxt: int = T[mini(3, tr)]; var prv: int = T[tr - 1] if tr else 0
	var f := 1.0 if tr >= 4 else clampf(float(n - prv) / max(1, nxt - prv), 0, 1)
	box.add_child(UI.box(Rect2(tx, py + 70, tw, 10), Color("2a2420"), Color("2a2420"), 0))
	box.add_child(UI.box(Rect2(tx, py + 70, tw * f, 10), Color("d08020") if tr >= 4 else Color("8e6a30"), Color(0, 0, 0, 0), 0))
	L.call(D.t("best_kills_done", {"n": n}) if tr >= 4 else D.t("best_kills_next", {"n": n, "next": nxt, "tier": D.t("best_tier_%d" % (tr + 1))}), Vector2(tx, py + 84), 11, UI.DIM)
	var y := py + 108
	var lock := func(need: int, yy: float) -> float:
		L.call(D.t("best_locked", {"tier": D.t("best_tier_%d" % need), "n": T[need - 1]}), Vector2(tx + 6, yy), 12, Color("7a6a58")); return 22.0
	L.call(D.t("best_h_where"), Vector2(tx, y), 14, UI.GOLD); y += 20
	if tr >= 1:
		for wh in habitat(sel): L.call("• " + wh, Vector2(tx + 6, y), 12, UI.TEXT, tw - 6); y += 18
		y += 4
	else: y += lock.call(1, y)
	L.call(D.t("best_h_stats"), Vector2(tx, y), 14, UI.GOLD); y += 20
	if tr >= 2:
		L.call("%s %d   %s %d   %s %s   %s %d" % [D.t("best_hp"), int(M.hp), D.t("best_dmg"), roundi(M.dmg), D.t("best_arm"), str(M.get("arm", 0)), D.t("best_xp"), int(M.xp)], Vector2(tx + 6, y), 12); y += 20
		var b: Label = L.call(D.t("best_beh_" + sel), Vector2(tx + 6, y), 12, Color("d8c8a0"), tw - 6); y += 18 * max(1, ceili(b.text.length() * 6.5 / (tw - 6))) + 8
	else: y += lock.call(2, y)
	L.call(D.t("best_h_lore"), Vector2(tx, y), 14, UI.GOLD); y += 20
	if tr >= 3:
		var R: Dictionary = D.db.MONSTER_RES.get(sel, {})
		var fmt := func(pos: bool) -> String:
			var parts := []
			for k in R:
				if (R[k] > 0) == pos and R[k] != 0: parts.append("%s %+d%%" % [D.db.ELEMENTS[k].name, roundi(R[k] * 100)])
			return " · ".join(parts) if parts.size() else D.t("best_none")
		L.call(D.t("best_weak") + ": " + fmt.call(false), Vector2(tx + 6, y), 12, Color("7ee07e")); y += 18
		L.call(D.t("best_strong") + ": " + fmt.call(true), Vector2(tx + 6, y), 12, Color("e09070")); y += 20
		L.call("“" + D.t("best_lore_" + sel) + "”", Vector2(tx + 6, y), 12, Color("c8b890"), tw - 6)
	else: y += lock.call(3, y)
	L.call(D.t("best_bonus_active", {"p": 5}) if tr >= 4 else D.t("best_bonus_hint", {"n": T[3], "p": 5}), Vector2(px + 16, py + 250), 11, Color("ffb050") if tr >= 4 else UI.DIM, 196.0)
