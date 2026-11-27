extends CanvasLayer
## Janela de detalhes do item (porte de itemui.js showItemCard): arte grande com o brilho da raridade, requisitos,
## atributos, comparação com o que está vestido, descrição e dica. Fica ao lado do ponteiro. Autoload "Card".
const SLOT_KEY := {"weapon": "slot_weapon", "shield": "slot_shield", "helmet": "slot_helmet", "armor": "slot_armor", "legs": "slot_legs", "boots": "slot_boots", "light": "slot_light"}
var box: Control

func _init() -> void: layer = 40; process_mode = Node.PROCESS_MODE_ALWAYS

func hide_card() -> void:
	if box: box.queue_free(); box = null

## opts: worn, hint, sell, level
func show_card(g: Dictionary, voc: String, opts := {}) -> void:
	hide_card()
	var E := Equip.E(g.id)
	if E.is_empty(): return
	var r := int(g.get("r", 0)); var rc := Equip.rarity_color(r); var d := Save.voc(voc)
	var lvl: int = opts.get("level", Save.level(voc))
	var W := 280.0; var pad := 14.0
	box = Control.new(); box.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(box)
	var items := Control.new(); items.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var y := pad
	var L := func(s: String, yy: float, size: int, col: Color, center := false) -> Label:
		var l := UI.wrap(UI.lbl(s, size, col), W - 2 * pad); l.position = Vector2(pad, yy)
		if center: l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		items.add_child(l); return l
	var lines := func(s: String, size: int) -> int: return maxi(1, ceili(s.length() * size * 0.5 / (W - 2 * pad)))
	var glow := Sprite2D.new(); glow.texture = A.light_tex; glow.position = Vector2(W / 2, y + 52); glow.scale = Vector2(1.1, 1.1); glow.modulate = Color(rc, 0.7 if r else 0.25)
	var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; glow.material = cm
	items.add_child(UI.box(Rect2(W / 2 - 56, y - 4, 112, 112), Color("120e0c"), rc, 2)); items.add_child(glow)
	var ic := UI.icon(Equip.icon(g.id), Vector2(W / 2, y + 52), 96); ic.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST; items.add_child(ic)
	y += 116
	L.call(Equip.gear_name(g), y, 17, rc, true); y += 24
	L.call("%s · %s · %s oz" % [Equip.rarity_name(r), D.t(SLOT_KEY.get(E.slot, "slot_weapon")), Equip.fmt_oz(Equip.oz(g.id))], y, 12, UI.DIM, true); y += 22
	var line := func(yy: float): items.add_child(UI.box(Rect2(pad, yy, W - 2 * pad, 1), Color(0.42, 0.31, 0.19, 0.8), Color(0, 0, 0, 0), 0))
	line.call(y); y += 8
	if E.has("lvl"): L.call(D.t("card_req_level", {"n": int(E.lvl)}), y, 12, UI.TEXT if lvl >= int(E.lvl) else Color("e07060")); y += 17
	if E.has("voc"):
		var vs := []
		for v in E.voc: vs.append(D.VOCATIONS[v].name if D.VOCATIONS.has(v) else v)
		L.call(D.t("card_req_voc", {"v": ", ".join(vs)}), y, 12, UI.TEXT if Equip.equip_ok(g.id, voc) else Color("e07060")); y += 17
	var st: Array = Array(Equip.stats_text(g).split(" · ")).filter(func(x): return x != "")
	if st.size():
		y += 2; line.call(y); y += 8
		for s in st: L.call("• " + s, y, 13, UI.TEXT); y += 18 * lines.call(s, 13)
	var cur = d.equip.get(E.slot)
	if cur and not opts.get("worn", false) and cur != g and not Equip.E(cur.id).is_empty():
		var C := Equip.E(cur.id); var diffs := []
		if E.has("atk") or C.has("atk"): diffs.append([D.t("card_atk"), roundi(E.get("atk", 0) * Equip.gear_mult(g)) - roundi(C.get("atk", 0) * Equip.gear_mult(cur))])
		if E.get("def", 0) or C.get("def", 0): diffs.append([D.t("card_def"), snappedf(E.get("def", 0) * Equip.gear_mult(g) - C.get("def", 0) * Equip.gear_mult(cur), 0.1)])
		if diffs.size():
			y += 2; line.call(y); y += 8
			var vs_t := D.t("card_vs", {"name": Equip.gear_name(cur)}); L.call(vs_t, y, 11, UI.DIM); y += 16 * lines.call(vs_t, 11) + 2
			for df in diffs:
				var v = df[1]
				L.call("%s%s %s" % ["▲ +" if v > 0 else ("▼ " if v < 0 else "= "), str(v).replace(".", ","), df[0]], y, 13, Color("7ee07e") if v > 0 else (Color("e07060") if v < 0 else UI.DIM)); y += 18
	if E.has("desc"):
		y += 2; line.call(y); y += 8
		L.call(E.desc, y, 12, Color("c8b890")); y += 17 * lines.call(E.desc, 12) + 4
	if opts.get("sell", false):
		L.call(D.t("card_hint_sell", {"n": maxi(5, roundi(E.get("price", 20) * 0.25 * Equip.gear_mult(g)))}), y + 4, 11, UI.DIM, true); y += 20
	if opts.has("hint"):
		y += 4; L.call(opts.hint, y, 11, UI.GOLD, true); y += 18
	var H := y + pad - 4
	var bg := UI.panel(Rect2(0, 0, W, H)); bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(bg); box.add_child(items)
	var p := get_viewport().get_mouse_position()
	var x := p.x + 24
	if x + W > 954: x = p.x - W - 24
	box.position = Vector2(clamp(x, 6, 954 - W), clamp(p.y - H / 2, 6, max(6.0, 534 - H)))
	box.modulate.a = 0; box.create_tween().tween_property(box, "modulate:a", 1.0, 0.09)
