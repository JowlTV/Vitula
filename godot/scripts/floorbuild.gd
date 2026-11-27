extends RefCounted
## Montagem de um andar (porte de floor.js e cave.js): desenho do chão, salas mobiliadas, armadilhas, tochas,
## escada, corda, waypoint, tocas da caverna e monstros iniciais. Trabalha sobre o mundo (world.gd).
const T := 64
var w            # world.gd
var g: Gen

func _init(world) -> void: w = world

func hashi(x: int, y: int) -> int:
	var n := (x * 374761393 + y * 668265263) & 0xFFFFFFFF
	n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
	return n

func art(k: String) -> Texture2D:
	for p in ["res://assets/art/%s.png", "res://assets/decor/%s.png"]:
		var t := UI.tex(p % k)
		if t: return t
	return null

# ============================================================== andar
func build(arrive := "start") -> void:
	g = w.gen
	var last: bool = w.floor_n == w.floors
	w.seeds[w.floor_n] = w.seeds.get(w.floor_n, randi() % 1000000000 if not w.bot else 1234 + w.floor_n)
	g.generate(w.seeds[w.floor_n], w.floor_n, false)
	w.pockets = g.carve_pockets(2) if g.cave else []
	w.explored = PackedByteArray(); w.explored.resize(g.w * g.h)
	var c0: Vector2i = g.center(0)
	var start := c0
	for o in [Vector2i(-2, -2), Vector2i(2, -2), Vector2i(-2, 2), Vector2i(2, 2)]:
		var p: Vector2i = c0 + o
		if g.is_walk(p.x, p.y) and not g.is_bridge(p.x, p.y): start = p; break
	if not g.is_walk(start.x, start.y):
		for i in g.rooms.size():
			var cs: Array = g.room_cells(i)
			if cs.size(): start = cs[0]; break
	var dist: PackedInt32Array = g.distances(start.x, start.y)
	var far := -1; var far_d := -1
	for want in ["room", "chamber", "cistern"]:
		for i in range(1, g.rooms.size()):
			if g.rooms[i].kind != want: continue
			var c := _cell_of(i); var v := dist[c.y * g.w + c.x]
			if v > far_d: far_d = v; far = i
		if far >= 0: break
	if far < 0: far = mini(1, g.rooms.size() - 1)
	w.far_room = far
	w.decor_used = {}
	draw_static()
	w.camp_room = -2
	for i in g.rooms.size(): furnish(i, i == 0, i == far, last)
	if g.cave: cave_monsters(start); fix_blocking(start)
	link_pockets(start)
	if g.cave: fix_blocking(start)
	if not g.cave: sconces(); wall_drains()
	water_lights()
	tunnel_monsters()
	ground_fog()
	w.stairs = null
	if not last:
		var r: Dictionary = g.rooms[far]; var c: Vector2i = g.center(far)
		var cand := [Vector2i(c.x, r.y + 1), Vector2i(c.x + 1, r.y + 1), Vector2i(c.x - 1, r.y + 1), c, c + Vector2i(-2, -2), c + Vector2i(2, -2)]
		var s := _cell_of(far)
		for p in cand:
			if g.is_walk(p.x, p.y) and not g.is_bridge(p.x, p.y) and not w.spikes.has(p): s = p; break
		w.stairs = s; w.clear_cell(s); _draw_stairs()
	# corda de volta para cima
	var rp: Vector2 = w.cell_pos(start.x, start.y)
	var ri := Sprite2D.new(); ri.texture = art("rope_v2"); ri.centered = false
	var k := T * 1.5 / ri.texture.get_height(); ri.scale = Vector2(k, k)
	ri.position = Vector2(rp.x - ri.texture.get_width() * k / 2, rp.y + T / 2.0 - 4 - T * 1.5); w.ground.add_child(ri); ri.z_index = 2
	w.rope = start
	# herói
	var arr := start
	if arrive == "stairs" and w.stairs != null:
		var ns = _near_stairs()
		if ns != null: arr = ns
	w.place_hero_at(arr)
	if w.floor_n == 3: hungry_spider()
	place_waypoint()
	unstick_bosses()

func _cell_of(i: int) -> Vector2i:
	var cs: Array = g.room_cells(i); var c: Vector2i = g.center(i)
	for p in cs:
		if p == c: return p
	return cs[0] if cs.size() else c

func _near_stairs():
	var s: Vector2i = w.stairs
	for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1)]:
		var p: Vector2i = s + d
		if w.walkable(p.x, p.y) and not w.occ.has(p) and not w.spikes.has(p): return p
	return null

func _draw_stairs() -> void:
	var s := Sprite2D.new(); s.texture = art("stairs"); s.centered = false; s.position = Vector2(w.stairs.x * T, w.stairs.y * T)
	s.scale = Vector2.ONE * (T / float(s.texture.get_width())); s.z_index = 1; w.ground.add_child(s)
	w.stairs_spr = s

# ============================================================== desenho
func draw_static() -> void:
	if g.cave: _draw_cave(); decor_cave(); return
	var CH := 12
	var floor_t := art("floor"); var front := art("wall_front_v3"); var top := art("wall_top_v3"); var water_t := art("water_channel")
	for cy in range(0, g.h, CH):
		for cx in range(0, g.w, CH):
			var ops := []
			for y in range(cy, mini(cy + CH, g.h)):
				for x in range(cx, mini(cx + CH, g.w)): _tile_ops(ops, x, y, floor_t, front, top, water_t)
			if ops.is_empty(): continue
			var node := FloorChunk.new(); node.ops = ops; node.z_index = -10; w.ground.add_child(node)
	decor_sewer()

func _tile_ops(ops: Array, x: int, y: int, floor_t, front, top, water_t) -> void:
	var px := x * T; var py := y * T; var h := hashi(x, y)
	var R := func(rx, ry, rw, rh, col: Color): ops.append([1, Rect2(rx, ry, rw, rh), col])
	if g.is_floor(x, y):
		var tone := 0.8 + (h % 100) / 100.0 * 0.2
		ops.append([0, floor_t, Rect2(px, py, T, T), Color(tone, tone, min(1.0, tone + 0.016)), 0.0])
		if g.is_water(x, y): _water_ops(ops, x, y, water_t)
		elif g.is_bridge(x, y): _water_ops(ops, x, y, water_t); _bridge_ops(ops, x, y)
		else: _breaker(ops, x, y, h)
		# oclusão ao pé das paredes e musgo na base da parede de cima
		if not g.is_floor(x, y - 1):
			R.call(px, py, T, 9, Color(0, 0, 0, 0.4))
			var hm := hashi(x * 7, y * 13)
			for k in 7:
				var hx := (hm >> (k * 3)) % (T - 6); var hh := 2 + ((hm >> (k * 2)) % 5)
				R.call(px + 3 + hx, py + 9, 3 + k % 3, hh, Color("3d5a2c") if k % 3 else Color("55763a"))
		if not g.is_floor(x - 1, y): R.call(px, py, 6, T, Color(0, 0, 0, 0.22))
		if not g.is_floor(x + 1, y): R.call(px + T - 4, py, 4, T, Color(0, 0, 0, 0.18))
		return
	var near := false
	for d in D.DIRS8:
		if g.is_floor(x + d.x, y + d.y): near = true
	if not near: return
	if g.is_floor(x, y + 1):
		ops.append([0, front, Rect2(px, py, T, T), Color.WHITE, 0.0])
		var ns := [(h ^ 0x9e3779b9) & 0xFFFFFFFF]
		var r := func() -> float:
			ns[0] = ((ns[0] ^ (ns[0] >> 15)) * 2246822519) & 0xFFFFFFFF
			return (ns[0] % 1000) / 1000.0
		if r.call() < 0.35: R.call(px + 6 + r.call() * (T - 12), py + 8, 3, 24 + r.call() * 26, Color(0.05, 0.07, 0.06, 0.35))
		if r.call() < 0.3:
			for k in 10: R.call(px + r.call() * (T - 3), py + T - 10 - r.call() * 18, 3, 2, Color(0.2, 0.32, 0.16, 0.7))
	else:
		ops.append([0, top, Rect2(px, py, T, T), Color("a09ca8"), 0.0])
		if g.is_floor(x, y - 1): R.call(px, py, T, 3, Color("6a6670"))
		if g.is_floor(x - 1, y): R.call(px, py, 3, T, Color("56535c"))
		if g.is_floor(x + 1, y): R.call(px + T - 3, py, 3, T, Color("56535c"))

func _water_ops(ops: Array, x: int, y: int, water_t) -> void:
	var px := x * T; var py := y * T; var dir := g.wdir(x, y)
	if dir == 3:
		ops.append([0, water_t, Rect2(px, py, T, T), Color.WHITE, 0.0])
		var edge := Color("4a4850")
		if not g.is_water(x, y - 1): ops.append([1, Rect2(px, py, T, 6), edge])
		if not g.is_water(x, y + 1): ops.append([1, Rect2(px, py + T - 6, T, 6), edge])
		if not g.is_water(x - 1, y): ops.append([1, Rect2(px, py, 6, T), edge])
		if not g.is_water(x + 1, y): ops.append([1, Rect2(px + T - 6, py, 6, T), edge])
		return
	ops.append([0, water_t, Rect2(px, py, T, T), Color.WHITE, PI / 2 if dir == 2 else 0.0])
	var ns := [(x * 2654435761 + y * 40503) & 0xFFFFFFFF]
	var r := func() -> float:
		ns[0] = ((ns[0] ^ (ns[0] >> 15)) * 2246822519) & 0xFFFFFFFF
		return (ns[0] % 1000) / 1000.0
	if r.call() < 0.45:
		for k in 2 + int(r.call() * 4):
			var ax: float = px + 8 + r.call() * (T - 16); var ay: float = py + 18 + r.call() * (T - 36); var ww := 2 + int(r.call() * 5)
			var col := Color(0.61, 0.69, 0.44, 0.55) if r.call() < 0.5 else Color(0.1, 0.14, 0.08, 0.55)
			if dir == 2: ops.append([1, Rect2(ay - py + px, ax - px + py, 2, ww), col])
			else: ops.append([1, Rect2(ax, ay, ww, 2), col])

func _bridge_ops(ops: Array, x: int, y: int) -> void:
	var px := x * T; var py := y * T; var across := g.wdir(x, y) == 2
	var hs := [hashi(x, y)]
	var rnd := func() -> float:
		hs[0] = ((hs[0] ^ (hs[0] >> 13)) * 1274126177) & 0xFFFFFFFF
		return (hs[0] % 1000) / 1000.0
	var R := func(a: float, b: float, ww: float, hh: float, col: Color):
		if across: ops.append([1, Rect2(px + a, py + b, ww, hh), col])
		else: ops.append([1, Rect2(px + b, py + a, hh, ww), col])
	var beam := Color("2a1d12")
	if across: ops.append([1, Rect2(px, py + 10, T, 5), beam]); ops.append([1, Rect2(px, py + T - 15, T, 5), beam])
	else: ops.append([1, Rect2(px + 10, py, 5, T), beam]); ops.append([1, Rect2(px + T - 15, py, 5, T), beam])
	var N := 6; var sz := T / float(N); var tones := [Color("5e4329"), Color("6b4c2f"), Color("553b24"), Color("4a3420")]
	for k in N:
		var r1: float = rnd.call()
		if r1 < 0.1 and k > 0 and k < N - 1: continue
		var inset := 2 + int(rnd.call() * 4); var cut := int(rnd.call() * 14) + 6 if r1 < 0.25 else 0
		var c: Color = tones[int(rnd.call() * tones.size())]
		var o := k * sz + 1; var ln := T - inset * 2 - cut; var s0 := inset + (cut if rnd.call() < 0.5 else 0)
		R.call(o, s0, sz - 2, ln, c); R.call(o, s0, 2, ln, Color("7d5c3a")); R.call(o + sz - 4, s0, 2, ln, Color("2f2014"))
		R.call(o + 4, s0 + 8, 1, ln - 16, Color("3b2918"))
		if rnd.call() < 0.5:
			var m := int(rnd.call() * (ln - 14)); R.call(o + 1, s0 + m, sz - 4, 10, Color(0.25, 0.35, 0.16, 0.75))

func _breaker(ops: Array, x: int, y: int, seed: int) -> void:
	var px := x * T; var py := y * T
	var ns := [seed]
	var r := func() -> float:
		ns[0] = ((ns[0] ^ (ns[0] >> 15)) * 2246822519) & 0xFFFFFFFF
		return (ns[0] % 1000) / 1000.0
	var v: float = r.call()
	if v < 0.14:
		var cx: float = px + 10 + r.call() * (T - 20); var cy: float = py + 10 + r.call() * (T - 20)
		for k in 6: ops.append([1, Rect2(cx, cy, 3, 2), Color(0.08, 0.08, 0.1, 0.85)]); cx += 2 + int(r.call() * 3); cy += int(r.call() * 5) - 2
	elif v < 0.26:
		ops.append([2, Vector2(px + T / 2.0 + (r.call() - 0.5) * 24, py + T / 2.0 + (r.call() - 0.5) * 24), Vector2(15 + r.call() * 9, 7 + r.call() * 4), Color(0.11, 0.14, 0.08, 0.4)])
	elif v < 0.36:
		for k in 7: ops.append([1, Rect2(px + r.call() * (T - 4), py + r.call() * (T - 4), 2 + int(r.call() * 3), 2), Color(0.16, 0.13, 0.09, 0.6) if r.call() < 0.5 else Color(0.1, 0.09, 0.07, 0.6)])
	var wn := not g.is_floor(x, y - 1); var ww := not g.is_floor(x - 1, y); var we := not g.is_floor(x + 1, y)
	if (wn or ww or we) and r.call() < 0.55:
		var cols := [Color("2f4a22"), Color("3d5e2a"), Color("24381a")]
		for k in 9:
			var mx: float = px + r.call() * 10 if ww else (px + T - 12 + r.call() * 10 if we else px + r.call() * (T - 4))
			var my: float = py + 6 + r.call() * 10 if wn else py + r.call() * (T - 4)
			var c: Color = cols[int(r.call() * 3)]; c.a = 0.75
			ops.append([1, Rect2(mx, my, 2 + int(r.call() * 3), 2), c])

func _draw_cave() -> void:
	var img := Image.create(g.w, g.h, false, Image.FORMAT_RGBA8)
	var Dd := PackedInt32Array(); Dd.resize(g.w * g.h); Dd.fill(-1)
	var q := []
	for i in g.w * g.h:
		if g.cells[i] >= 1: Dd[i] = 0; q.append(i)
	var hd := 0
	while hd < q.size():
		var v: int = q[hd]; hd += 1
		var x := v % g.w; var y := v / g.w
		for d in D.DIRS8:
			var nx: int = x + d.x; var ny: int = y + d.y
			if nx < 0 or ny < 0 or nx >= g.w or ny >= g.h: continue
			var j := ny * g.w + nx
			if Dd[j] < 0: Dd[j] = Dd[v] + 1; q.append(j)
	for y in g.h:
		for x in g.w:
			var i := y * g.w + x
			img.set_pixel(x, y, Color(0.0 if g.cells[i] >= 1 else 1.0, 1.0 if g.cells[i] == 2 else 0.0, min(1.0, Dd[i] / 8.0), 1))
	var sp := Sprite2D.new(); sp.centered = false; sp.z_index = -10
	var blank := Image.create(1, 1, false, Image.FORMAT_RGBA8); blank.fill(Color.WHITE)
	sp.texture = ImageTexture.create_from_image(blank); sp.scale = Vector2(g.w * T, g.h * T)
	var mat := ShaderMaterial.new(); mat.shader = load("res://assets/shaders/cave.gdshader")
	mat.set_shader_parameter("data", ImageTexture.create_from_image(img))
	mat.set_shader_parameter("cells", Vector2(g.w, g.h))
	mat.set_shader_parameter("face", _clean("cave_wall_front", false)); mat.set_shader_parameter("top", _clean("cave_rock_top", true))
	mat.set_shader_parameter("moss", _clean("cave_floor_moss", true)); mat.set_shader_parameter("red", _clean("cave_floor_red", true))
	sp.material = mat
	w.ground.add_child(sp)

## tira as linhas escuras de rejunte e a moldura da arte (como caveTex do Phaser), para o chão não ficar em grade
static var _clean_cache := {}
func _clean(k: String, remove_gaps: bool) -> Texture2D:
	if _clean_cache.has(k): return _clean_cache[k]
	var img: Image = art(k).get_image(); img.decompress(); img.convert(Image.FORMAT_RGBA8)
	if img.get_width() != 64: img.resize(64, 64, Image.INTERPOLATE_NEAREST)
	var W := img.get_width(); var H := img.get_height()
	var lum := func(c: Color) -> float: return c.r * 0.3 + c.g * 0.6 + c.b * 0.1
	if remove_gaps:
		var col_m := []; var row_m := []
		for x in W:
			var s := 0.0
			for y in H:
				var c := img.get_pixel(x, y)
				if c.a > 0.5: s += lum.call(c)
			col_m.append(s / H)
		for y in H:
			var s := 0.0
			for x in W:
				var c := img.get_pixel(x, y)
				if c.a > 0.5: s += lum.call(c)
			row_m.append(s / W)
		var med := func(a: Array) -> float:
			var b := a.duplicate(); b.sort(); return b[b.size() >> 1]
		var mc: float = med.call(col_m); var mr: float = med.call(row_m)
		var gc := []; var gr := []
		for x in W: gc.append(col_m[x] < mc * 0.8 or x < 2 or x > W - 3)
		for y in H: gr.append(row_m[y] < mr * 0.8 or y < 2 or y > H - 3)
		var near := func(gaps: Array, i: int, n: int) -> int:
			for o in range(1, n):
				for j in [i + o, i - o]:
					if j >= 0 and j < n and not gaps[j]: return j
			return i
		for x in W:
			if gc[x]:
				var sx: int = near.call(gc, x, W)
				for y in H: img.set_pixel(x, y, img.get_pixel(sx, y))
		for y in H:
			if gr[y]:
				var sy: int = near.call(gr, y, H)
				for x in W: img.set_pixel(x, y, img.get_pixel(x, sy))
	for y in H:
		for x in W:
			var c := img.get_pixel(x, y)
			if c.a > 0.5: continue
			var done := false
			for r in range(1, 8):
				for dy in range(-r, r + 1):
					for dx in range(-r, r + 1):
						var nx := x + dx; var ny := y + dy
						if done or nx < 0 or ny < 0 or nx >= W or ny >= H: continue
						var n := img.get_pixel(nx, ny)
						if n.a > 0.5: img.set_pixel(x, y, Color(n.r, n.g, n.b, 1)); done = true
				if done: break
			if not done: img.set_pixel(x, y, Color(c.r, c.g, c.b, 1))
	var t := ImageTexture.create_from_image(img)
	_clean_cache[k] = t
	return t

# ============================================================== decoração
func _flat(kind: String, x: int, y: int, alpha := 1.0, sc := 1.0, jitter := false) -> void:
	w.decor_used[Vector2i(x, y)] = true
	var t := art(kind if kind.begins_with("cave_") or kind.begins_with("glow") else "decor_" + kind)
	if t == null: return
	var s := Sprite2D.new(); s.texture = t; s.position = Vector2(x * T + T / 2.0, y * T + T / 2.0); s.modulate.a = alpha; s.scale = Vector2(sc, sc); s.z_index = -5
	if jitter: s.position += Vector2(randf_range(-8, 8), randf_range(-6, 6))
	w.ground.add_child(s)

func decor_sewer() -> void:
	for i in range(1, g.rooms.size()):
		var r: Dictionary = g.rooms[i]
		if r.kind != "room": continue
		var ok := func(x: int, y: int) -> bool:
			if not g.is_walk(x, y) or w.decor_used.has(Vector2i(x, y)): return false
			for gp in r.gap:
				if abs(gp.x - x) + abs(gp.y - y) <= 1: return false
			return true
		if g.rng() < 0.6:
			var cx: int = r.x if g.rng() < 0.5 else r.x + r.w - 1; var cy: int = r.y + r.h - 1
			if ok.call(cx, cy): _flat("bones", cx, cy)
		for k in 2:
			var x := g.rand(r.x + 1, r.x + r.w - 2); var y: int = r.y + r.h - 1
			if ok.call(x, y): _flat("bones" if k else "sludge", x, y, 0.9)
		if g.rng() < 0.35:
			var x := g.rand(r.x + 1, r.x + r.w - 2); var y := g.rand(r.y + 1, r.y + r.h - 2)
			if ok.call(x, y): _flat("pool", x, y, 0.85)
		if g.rng() < 0.22:
			var x := g.rand(r.x + 1, r.x + r.w - 2)
			if ok.call(x, r.y): _flat("skeleton", x, r.y)
		if g.rng() < 0.3:
			var cx: int = r.x if g.rng() < 0.5 else r.x + r.w - 1
			if ok.call(cx, r.y): _flat("crate_pile", cx, r.y)
	for t in g.tunnels:
		var ln: int = t.x1 - t.x0 if t.h else t.y1 - t.y0
		if ln < 8: continue
		var m: int = (t.x0 + t.x1) >> 1 if t.h else (t.y0 + t.y1) >> 1
		var x: int = m if t.h else t.c + 2; var y: int = t.c + 2 if t.h else m
		var bad := g.is_bridge(x, y)
		for d in D.DIRS8:
			var ri: int = g.room_of(x + d.x, y + d.y)
			if g.is_bridge(x + d.x, y + d.y) or (g.is_walk(x + d.x, y + d.y) and ri >= 0 and g.rooms[ri].kind == "room"): bad = true
		if not bad and g.is_walk(x, y): _flat("manhole" if g.rng() < 0.5 else "grate", x, y)

func walls_around(x: int, y: int) -> int:
	var n := 0
	for d in D.DIRS4:
		if not g.is_floor(x + d.x, y + d.y): n += 1
	return n

func decor_cave() -> void:
	for i in g.rooms.size():
		var cells: Array = g.room_cells(i).filter(func(c): return not w.decor_used.has(c))
		cells.shuffle()
		var wall_cells: Array = cells.filter(func(c): return walls_around(c.x, c.y) >= 1)
		for k in 2:
			if wall_cells.is_empty(): break
			var c: Vector2i = wall_cells.pop_back(); _flat("cave_rocks", c.x, c.y, 0.9, 0.55, true)
		if g.rng() < 0.45 and wall_cells.size():
			var c: Vector2i = wall_cells.pop_back(); _flat("bones", c.x, c.y, 0.85, 0.85, true)
		if g.rng() < 0.7 and wall_cells.size():
			var c: Vector2i = wall_cells.pop_back()
			_flat("glow_mushrooms", c.x, c.y, 1.0, randf_range(0.8, 1.05), true)
			w.add_light(Vector2(c.x * T + T / 2.0, c.y * T + T / 2.0 - 6), 1.6 * T, Color("3ab8c8"), true)

# ============================================================== mobília
func furnish(i: int, is_start: bool, is_far: bool, last: bool) -> void:
	var r: Dictionary = g.rooms[i]
	var near_gap := func(x: int, y: int) -> bool:
		for gp in r.get("gap", []):
			if abs(gp.x - x) <= 1 and abs(gp.y - y) <= 1: return true
		return false
	var blocked := func(x: int, y: int) -> bool:
		var c := Vector2i(x, y)
		return w.props.has(c) or w.decor_used.has(c) or not g.is_walk(x, y) or g.is_bridge(x, y) or near_gap.call(x, y)
	if is_start: return
	if r.kind == "chamber": _furnish_chamber(i, is_far, blocked)
	if r.kind == "room":
		var tx: int = r.x + (r.w >> 1)
		if not g.is_floor(tx, r.y - 1) and not blocked.call(tx, r.y): w.add_prop(Vector2i(tx, r.y), "torch_stand")
		var kinds := ["barrel", "crate_intact", "barrel", "crate_intact", "pot", "urn"]
		var left := g.rng() < 0.5; var x: int = r.x if left else r.x + r.w - 1
		var y0: int = r.y + 1 + (g.rand(0, 1) if r.h > 4 else 0)
		var n := g.rand(2, 3)
		for y in range(y0, mini(y0 + n, r.y + r.h)):
			if not blocked.call(x, y): w.add_prop(Vector2i(x, y), kinds[g.rand(0, kinds.size() - 1)])
		if not is_far and g.rng() < 0.4 and r.w >= 6:
			var cy: int = r.y + (r.h >> 1); var cx: int = r.x + (r.w >> 1)
			for x2 in [cx - 1, cx]:
				if not blocked.call(x2, cy): w.add_spike(Vector2i(x2, cy))
		elif not is_far and g.rng() < 0.3 and not g.is_floor(tx + 1, r.y - 1):
			var vx := tx + 1
			if not blocked.call(vx, r.y):
				var s := Sprite2D.new(); s.texture = art("gas_vent"); s.position = Vector2(vx * T + T / 2.0, r.y * T + T / 2.0); s.z_index = -5; w.ground.add_child(s)
				w.decor_used[Vector2i(vx, r.y)] = true
				var py: int = mini(r.y + r.h - 1, r.y + 2)
				if not blocked.call(vx, py): w.add_plate(Vector2i(vx, py), Vector2i(vx, r.y))
	# monstros
	var free: Array = g.room_cells(i).filter(func(c): return not blocked.call(c.x, c.y) and not w.occ.has(c) and not w.spikes.has(c) and not w.plates.has(c))
	free.shuffle()
	if last and is_far:
		var c: Vector2i = g.center(i)
		free.sort_custom(func(a, b): return abs(a.x - c.x) + abs(a.y - c.y) < abs(b.x - c.x) + abs(b.y - c.y))
		if free.size():
			var spot: Vector2i = free.pop_front(); w.spawn_monster("giant_rat", spot.x, spot.y)
		for k in 2:
			if free.is_empty(): break
			var f: Vector2i = free.pop_back(); w.spawn_monster("cave_rat", f.x, f.y)
		return
	var count: int
	if r.kind == "room": count = 1 + ceili(w.floor_n / 2.0) + g.rand(0, 1)
	elif r.kind == "chamber": count = 1 + ceili(w.floor_n / 3.0) + g.rand(0, 1)
	else: count = g.rand(1, 2)
	for k in count:
		if free.is_empty(): break
		var f: Vector2i = free.pop_back(); w.spawn_monster(D.weighted(w.floor_monsters()), f.x, f.y)

func _furnish_chamber(i: int, is_far: bool, blocked: Callable) -> void:
	var cells: Array = g.room_cells(i).filter(func(c): return not blocked.call(c.x, c.y))
	cells.shuffle()
	var wall_cells: Array = cells.filter(func(c): return walls_around(c.x, c.y) >= 1)
	if w.camp_room == -2: w.camp_room = -1 if i == 0 else i
	if w.camp_room == i and wall_cells.size() >= 4:
		var base: Vector2i = wall_cells[0]
		w.add_prop(base, "torch_stand")
		var near: Array = wall_cells.filter(func(c): return abs(c.x - base.x) + abs(c.y - base.y) <= 3 and c != base)
		var ks := ["barrel", "crate_intact", "barrel"]
		for n in ks.size():
			if n < near.size() and not blocked.call(near[n].x, near[n].y): w.add_prop(near[n], ks[n])
		return
	for k in g.rand(0, 2):
		if wall_cells.is_empty(): break
		var c: Vector2i = wall_cells.pop_back()
		if not blocked.call(c.x, c.y): w.add_prop(c, "cave_rocks")

func sconces() -> void:
	for sc in g.sconces:
		if g.is_floor(sc.x, sc.y) or not g.is_floor(sc.x, sc.y + 1): continue
		var s := Sprite2D.new(); s.texture = art("torch_stand"); s.centered = false
		var k: float = D.db.PROP_H.torch_stand / 60.0 * 0.85
		s.scale = Vector2(k, k); s.position = Vector2(sc.x * T + T / 2.0 - s.texture.get_width() * k / 2, sc.y * T + T - 4 - s.texture.get_height() * k); s.z_index = 2
		w.ground.add_child(s)
		w.add_light(Vector2(sc.x * T + T / 2.0, sc.y * T + T - 44), 3.6 * T, Color("ffa255"), false, true)

func wall_drains() -> void:
	for d in g.drains:
		if g.is_floor(d.x, d.y) or not g.is_floor(d.x, d.y + 1): continue
		var s := Sprite2D.new(); s.texture = art("wall_drain"); s.centered = false; s.position = Vector2(d.x * T, d.y * T)
		s.scale = Vector2.ONE * (T / float(s.texture.get_width())); s.z_index = -6; w.ground.add_child(s)

func water_lights() -> void:
	for y in g.h:
		for x in g.w:
			if not g.is_water(x, y) or (x * 7 + y * 13) % (11 if g.cave else 9) != 0: continue
			w.add_light(Vector2(x * T + T / 2.0, y * T + T / 2.0), 1.5 * T, Color("2f7fa8") if g.cave else Color("5fa040"), true)

func ground_fog() -> void:
	var mat := CanvasItemMaterial.new(); mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	for r in g.rooms:
		for k in 2:
			var f := Sprite2D.new(); f.texture = A.light_tex; f.material = mat
			f.position = Vector2((r.x + g.rng() * r.w) * T, (r.y + r.h * (0.4 + g.rng() * 0.5)) * T)
			f.scale = Vector2(randf_range(2.4, 3.6), randf_range(0.5, 0.8)) * 2.0
			f.modulate = Color("4a7a9a") if g.cave else Color("6fae4a"); f.modulate.a = 0.07; f.z_index = 50
			w.ground.add_child(f)
			var tw: Tween = f.create_tween().set_loops()
			tw.tween_property(f, "position:x", f.position.x + randf_range(-90, 90), randf_range(5, 9)).set_trans(Tween.TRANS_SINE)
			tw.parallel().tween_property(f, "modulate:a", 0.12, randf_range(5, 9))
			tw.tween_property(f, "position:x", f.position.x, randf_range(5, 9)).set_trans(Tween.TRANS_SINE)
			tw.parallel().tween_property(f, "modulate:a", 0.07, randf_range(5, 9))

# ============================================================== monstros soltos
func tunnel_monsters() -> void:
	for t in g.tunnels:
		var n := g.rand(0, 1 + (1 if w.floor_n > 1 else 0))
		for k in n:
			var side := -1 if g.rng() < 0.5 else 1; var off := side * g.rand(1, 2)
			var x: int = g.rand(t.x0 + 1, t.x1 - 1) if t.h else t.c + off
			var y: int = t.c + off if t.h else g.rand(t.y0 + 1, t.y1 - 1)
			var c := Vector2i(x, y)
			if not w.walkable(x, y) or w.occ.has(c) or w.spikes.has(c) or g.is_bridge(x, y): continue
			w.spawn_monster(D.weighted(w.floor_monsters()), x, y)

func cave_monsters(start: Vector2i) -> void:
	var d := g.distances(start.x, start.y); var cand := []
	for y in g.h:
		for x in g.w:
			if not w.walkable(x, y) or w.occ.has(Vector2i(x, y)) or g.room_of(x, y) >= 0: continue
			if d[y * g.w + x] >= 12: cand.append(Vector2i(x, y))
	cand.shuffle()
	for k in cand.size() / 120 + 2:
		if cand.is_empty(): break
		var c: Vector2i = cand.pop_back(); w.spawn_monster(D.weighted(w.floor_monsters()), c.x, c.y)

func fix_blocking(start: Vector2i) -> void:
	for pass_n in 6:
		var d := g.distances(start.x, start.y, func(x, y):
			var p = w.props.get(Vector2i(x, y))
			return p == null or D.db.BREAKABLE.has(p.kind))
		var bad := []
		for c in w.props:
			var p: Dictionary = w.props[c]
			if D.db.BREAKABLE.has(p.kind) or w.holes.has(c): continue
			for dd in D.DIRS4:
				var n: Vector2i = c + dd
				if g.is_walk(n.x, n.y) and not w.props.has(n) and d[n.y * g.w + n.x] < 0: bad.append(c); break
		if bad.is_empty(): return
		for c in bad: w.remove_prop(c)

func hungry_spider() -> void:
	w.get_tree().create_timer(0.9, false).timeout.connect(func(): if not w.finished: w.emit_signal("msg", D.t("hungry_spider")))
	for m in w.monsters:
		if m.kind == "giant_spider": return
	var best = null; var bd := 0.0
	for i in 400:
		var x := randi_range(1, g.w - 2); var y := randi_range(1, g.h - 2)
		if not g.is_walk(x, y) or w.occ.has(Vector2i(x, y)): continue
		var dd := Vector2(x - w.hero.x, y - w.hero.y).length()
		if dd > bd: bd = dd; best = Vector2i(x, y)
	if best != null: w.spawn_monster("giant_spider", best.x, best.y)

func unstick_bosses() -> void:
	var h = w.hero
	var d := g.distances(h.x, h.y, func(x, y):
		var p = w.props.get(Vector2i(x, y))
		return p == null or D.db.BREAKABLE.has(p.kind))
	for m in w.monsters:
		if not m.elite or m.dead or d[m.y * g.w + m.x] >= 0: continue
		var best = null; var bd := 1 << 30
		for y in range(1, g.h - 1):
			for x in range(1, g.w - 1):
				if d[y * g.w + x] < 6 or not w.walkable(x, y) or w.occ.has(Vector2i(x, y)) or not w.roomy_cell(x, y): continue
				var e: int = abs(x - m.x) + abs(y - m.y)
				if e < bd: bd = e; best = Vector2i(x, y)
		if best == null: continue
		w.occ.erase(Vector2i(m.x, m.y)); m.x = best.x; m.y = best.y; w.occ[best] = m
		var p: Vector2 = w.cell_pos(m.x, m.y); m.px = p.x; m.from_x = p.x; m.py = p.y; m.from_y = p.y; m.move_t = 0
		m.position = Vector2(m.px, m.py + 4)

# ============================================================== tocas da caverna
func link_pockets(start: Vector2i) -> void:
	w.holes = {}
	if w.pockets.is_empty(): return
	var in_pocket := {}
	for pk in w.pockets:
		for c in pk.cells: in_pocket[c] = true
	var d := g.distances(start.x, start.y)
	var spots := []
	for y in g.h:
		for x in g.w:
			var c := Vector2i(x, y)
			if g.is_walk(x, y) and not in_pocket.has(c) and not w.props.has(c) and not w.occ.has(c) and walls_around(x, y) >= 3 and d[y * g.w + x] > 10: spots.append(c)
	spots.shuffle()
	for pk in w.pockets:
		var ent = null
		while ent == null and spots.size():
			var c: Vector2i = spots.pop_back()
			if w.props.has(c): continue
			w.add_prop(c, "decor_rat_nest"); ent = c
		if ent == null: continue
		var ex: Vector2i = pk.cells[0]
		for c in pk.cells:
			if c.y == pk.y: ex = c; break
		w.add_prop(ex, "decor_rat_nest")
		var arrive_in = null
		for c in pk.cells:
			if c.y == pk.y + 1 and abs(c.x - ex.x) <= 1 and c.x != ex.x: arrive_in = c; break
		if arrive_in == null:
			for c in pk.cells:
				if c.y == pk.y + 1: arrive_in = c; break
		var arrive_out = null
		for dd in D.DIRS8:
			var c: Vector2i = ent + dd
			if g.is_walk(c.x, c.y) and not w.props.has(c) and d[c.y * g.w + c.x] >= 0: arrive_out = c; break
		if arrive_in == null or arrive_out == null: continue
		w.holes[ent] = {"to": arrive_in, "inside": true}
		w.holes[ex] = {"to": arrive_out, "inside": false}
		var free: Array = pk.cells.filter(func(c): return not w.props.has(c) and abs(c.x - arrive_in.x) + abs(c.y - arrive_in.y) > 2)
		free.shuffle()
		for k in g.rand(4, 6):
			if free.is_empty(): break
			var c: Vector2i = free.pop_back(); w.spawn_monster(D.weighted([["rat", 50], ["cave_rat", 50]]), c.x, c.y)
	for c in w.props.keys():
		if w.props[c].kind == "decor_rat_nest" and not w.holes.has(c): w.remove_prop(c)

# ============================================================== waypoint
func place_waypoint() -> void:
	var h = w.hero; var cells := []
	var r := 1
	while r <= 3 and cells.is_empty():
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var c := Vector2i(h.x + dx, h.y + dy)
				if w.rope != null and abs(c.x - w.rope.x) <= 1 and c.y >= w.rope.y - 2 and c.y <= w.rope.y + 1: continue
				if (dx != 0 or dy != 0) and w.walkable(c.x, c.y) and not w.occ.has(c) and not w.pickups.has(c) and not w.plates.has(c) and c != w.stairs: cells.append(c)
		r += 1
	if cells.is_empty(): return
	var open := func(c: Vector2i) -> int:
		var n := 0
		for dd in D.DIRS4:
			if g.is_floor(c.x + dd.x, c.y + dd.y): n += 1
		return n
	cells.sort_custom(func(a, b): return open.call(a) > open.call(b) or (open.call(a) == open.call(b) and abs(a.y - h.y) < abs(b.y - h.y)))
	var c: Vector2i = cells[0]
	var p: Vector2 = w.cell_pos(c.x, c.y)
	var s := Sprite2D.new(); s.texture = load("res://assets/waypoint.png"); s.position = p - Vector2(0, T / 2.0 - 4)
	s.scale = Vector2.ONE * (T * 0.82 / s.texture.get_width()); s.z_index = -4; w.ground.add_child(s)
	w.wp = c
	w.add_light(p - Vector2(0, T / 2.0), 2.5 * T, Color("8ac8ff"), true)

# ============================================================== chão em pedaços (desenho em lote)
class FloorChunk extends Node2D:
	var ops: Array
	func _draw() -> void:
		for o in ops:
			match o[0]:
				0:
					if o[1] == null: continue
					if o[4] != 0.0:
						var r: Rect2 = o[2]
						draw_set_transform(r.get_center(), o[4], Vector2.ONE)
						draw_texture_rect(o[1], Rect2(-r.size / 2, r.size), false, o[3])
						draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
					else: draw_texture_rect(o[1], o[2], false, o[3])
				1: draw_rect(o[1], o[2])
				2:
					draw_set_transform(o[1], 0, Vector2(1, o[2].y / o[2].x))
					draw_circle(Vector2.ZERO, o[2].x, o[3])
					draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
