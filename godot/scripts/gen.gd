class_name Gen
extends RefCounted
## Gerador do esgoto (porte de gen.js): túneis com canal e passarelas, cisternas nos cruzamentos, salas laterais,
## pontes de grade. Andares 3–5 viram caverna natural (autômato celular, lagos, câmaras). Células: 0 parede, 1 chão, 2 água.
var w := 64
var h := 48
var cells := PackedByteArray()
var water_dir := PackedByteArray()     # 1 horizontal, 2 vertical, 3 poço
var rooms: Array = []
var bridges: Array = []
var bridge_set := {}
var sconces: Array = []
var drains: Array = []
var tunnels: Array = []
var junctions: Array = []
var cave := false
var _s := 1

func rng() -> float:
	_s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF
	return _s / 4294967296.0
func rand(a: int, b: int) -> int: return a + int(floor(rng() * (b - a + 1)))

func generate(seed: int, floor_n := 1, force_cave := false) -> void:
	_s = seed & 0xFFFFFFFF
	if _s == 0: _s = 1
	cave = force_cave or floor_n >= 3
	if cave: generate_cave(3 + mini(2, (floor_n - 1) / 3) if force_cave else floor_n); return
	var P: Array = [[3, 2, 22], [3, 3, 22], [4, 3, 22], [4, 3, 26], [5, 3, 22]][clampi(floor_n - 1, 0, 4)]
	var COLS: int = P[0]; var ROWS: int = P[1]; var SX: int = P[2]
	var SY := 15; var OX := 10; var OY := 8
	w = OX + (COLS - 1) * SX + 14; h = OY + (ROWS - 1) * SY + 12
	cells = PackedByteArray(); cells.resize(w * h)
	water_dir = PackedByteArray(); water_dir.resize(w * h)
	rooms = []; bridges = []; sconces = []; drains = []; tunnels = []; bridge_set = {}; junctions = []
	var nodes := []
	for r in ROWS:
		for c in COLS: nodes.append({"c": c, "r": r, "x": OX + c * SX, "y": OY + r * SY})
	var seen := {0: true}; var edges := []; var stack := [0]
	while stack.size():
		var cur: int = stack[-1]; var c := cur % COLS; var r := cur / COLS
		var nb := []
		for d in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var x: int = c + d[0]; var y: int = r + d[1]
			if x >= 0 and y >= 0 and x < COLS and y < ROWS and not seen.has(y * COLS + x): nb.append([x, y])
		if nb.is_empty(): stack.pop_back(); continue
		var pick: Array = nb[rand(0, nb.size() - 1)]
		var nid: int = pick[1] * COLS + pick[0]
		seen[nid] = true; edges.append([cur, nid]); stack.append(nid)
	var k := 0; var tries := 0
	while k < 2 and tries < 30:
		tries += 1
		var a := rand(0, nodes.size() - 1); var dir := 1 if rng() < 0.5 else COLS
		var b := a + dir
		if b >= nodes.size() or (dir == 1 and a % COLS == COLS - 1): continue
		var dup := false
		for e in edges:
			if (e[0] == a and e[1] == b) or (e[0] == b and e[1] == a): dup = true
		if dup: continue
		edges.append([a, b]); k += 1
	var used := {}
	for e in edges: used[e[0]] = true; used[e[1]] = true
	for i in used:
		var n: Dictionary = nodes[i]
		var dirs := {"n": false, "s": false, "e": false, "w": false}
		for e in edges:
			var o: int = e[1] if e[0] == i else (e[0] if e[1] == i else -1)
			if o < 0: continue
			if o == i + 1: dirs.e = true
			elif o == i - 1: dirs.w = true
			elif o > i: dirs.s = true
			else: dirs.n = true
		carve_junction(n.x, n.y, dirs)
		junctions.append({"x": n.x, "y": n.y, "dirs": dirs})
	for e in edges: carve_tunnel(nodes[e[0]], nodes[e[1]])
	for t in tunnels.duplicate():
		for q in 4: try_room(t)

func set_c(x: int, y: int, v: int) -> void:
	if x >= 0 and y >= 0 and x < w and y < h: cells[y * w + x] = v
func get_c(x: int, y: int) -> int: return cells[y * w + x] if x >= 0 and y >= 0 and x < w and y < h else 0
func water(x: int, y: int, dir: int) -> void: set_c(x, y, 2); water_dir[y * w + x] = dir
func bridge(x: int, y: int, dir: int) -> void:
	set_c(x, y, 1); water_dir[y * w + x] = dir
	if not bridge_set.has(Vector2i(x, y)): bridge_set[Vector2i(x, y)] = true; bridges.append({"x": x, "y": y, "dir": dir})
func is_bridge(x: int, y: int) -> bool: return bridge_set.has(Vector2i(x, y))
func is_floor(x: int, y: int) -> bool: return get_c(x, y) >= 1
func is_walk(x: int, y: int) -> bool: return get_c(x, y) == 1
func is_water(x: int, y: int) -> bool: return get_c(x, y) == 2
func wdir(x: int, y: int) -> int: return water_dir[y * w + x] if x >= 0 and y >= 0 and x < w and y < h else 0

func carve_junction(cx: int, cy: int, dirs: Dictionary) -> void:
	for y in range(cy - 3, cy + 4):
		for x in range(cx - 3, cx + 4):
			if abs(x - cx) == 3 and abs(y - cy) == 3: continue
			set_c(x, y, 1)
	for y in range(cy - 1, cy + 2):
		for x in range(cx - 1, cx + 2): water(x, y, 3)
	if dirs.n:
		for y in [cy - 3, cy - 2]: bridge(cx, y, 2)
	if dirs.s:
		for y in [cy + 2, cy + 3]: bridge(cx, y, 2)
	if dirs.w:
		for x in [cx - 3, cx - 2]: bridge(x, cy, 1)
	if dirs.e:
		for x in [cx + 2, cx + 3]: bridge(x, cy, 1)
	rooms.append({"x": cx - 3, "y": cy - 3, "w": 7, "h": 7, "kind": "cistern"})

func carve_tunnel(a: Dictionary, b: Dictionary) -> void:
	if a.y == b.y:
		var x0: int = min(a.x, b.x) + 4; var x1: int = max(a.x, b.x) - 4; var cy: int = a.y
		for x in range(x0, x1 + 1):
			for dy in [-2, -1, 1, 2]: set_c(x, cy + dy, 1)
			water(x, cy, 1)
		for x in range(x0 + 3, x1 - 1, 6): bridge(x, cy, 1)
		tunnels.append({"h": true, "x0": x0, "x1": x1, "c": cy})
		for x in range(x0 + 1, x1 + 1, 5): sconces.append(Vector2i(x, cy - 3))
		for x in range(x0 + 3, x1 + 1, 10): drains.append(Vector2i(x, cy - 3))
	else:
		var y0: int = min(a.y, b.y) + 4; var y1: int = max(a.y, b.y) - 4; var cx: int = a.x
		for y in range(y0, y1 + 1):
			for dx in [-2, -1, 1, 2]: set_c(cx + dx, y, 1)
			water(cx, y, 2)
		for y in range(y0 + 2, y1, 5): bridge(cx, y, 2)
		tunnels.append({"h": false, "y0": y0, "y1": y1, "c": cx})

func try_room(t: Dictionary) -> void:
	var rw := rand(5, 8); var rh := rand(4, 6)
	var r: Dictionary; var gap: Array
	if t.h:
		if t.x1 - t.x0 < rw + 2: return
		var x := rand(t.x0 + 1, t.x1 - rw - 1); var up := rng() < 0.5
		r = {"x": x, "y": t.c - 3 - rh, "w": rw, "h": rh} if up else {"x": x, "y": t.c + 4, "w": rw, "h": rh}
		gap = [Vector2i(x + rand(1, rw - 2), t.c - 3 if up else t.c + 3)]
	else:
		if t.y1 - t.y0 < rh + 2: return
		var y := rand(t.y0 + 1, t.y1 - rh - 1); var left := rng() < 0.5
		r = {"x": t.c - 3 - rw, "y": y, "w": rw, "h": rh} if left else {"x": t.c + 4, "y": y, "w": rw, "h": rh}
		gap = [Vector2i(t.c - 3 if left else t.c + 3, y + rand(1, rh - 2))]
	if r.x < 2 or r.y < 2 or r.x + r.w > w - 2 or r.y + r.h > h - 2: return
	for y in range(r.y - 1, r.y + r.h + 1):
		for x in range(r.x - 1, r.x + r.w + 1):
			if get_c(x, y): return
	for y in range(r.y, r.y + r.h):
		for x in range(r.x, r.x + r.w): set_c(x, y, 1)
	for g in gap: set_c(g.x, g.y, 1)
	r.kind = "room"; r.gap = gap
	rooms.append(r)

# ------------------------------------------------------------ caverna natural
func generate_cave(floor_n: int) -> void:
	var WH: Array = [[90, 50], [102, 50], [112, 50]][mini(2, floor_n - 3)]
	var W: int = WH[0]; var H: int = WH[1]
	w = W; h = H
	water_dir = PackedByteArray(); water_dir.resize(W * H)
	rooms = []; bridges = []; sconces = []; drains = []; tunnels = []; junctions = []; bridge_set = {}
	var c := PackedByteArray(); c.resize(W * H)
	for y in H:
		for x in W: c[y * W + x] = 0 if (x < 2 or y < 2 or x >= W - 2 or y >= H - 2 or rng() < 0.46) else 1
	for it in 5:
		var n := PackedByteArray(); n.resize(W * H)
		for y in range(2, H - 2):
			for x in range(2, W - 2):
				var w1 := 0; var w2 := 0
				for dy in range(-2, 3):
					for dx in range(-2, 3):
						var xx := x + dx; var yy := y + dy
						var wall := xx < 0 or yy < 0 or xx >= W or yy >= H or c[yy * W + xx] == 0
						if wall:
							w2 += 1
							if abs(dx) <= 1 and abs(dy) <= 1: w1 += 1
				n[y * W + x] = 0 if (w1 >= 5 or (it < 3 and w2 <= 2)) else 1
		c = n
	# regiões: mantém a maior e liga as outras
	var lab := PackedInt32Array(); lab.resize(W * H); lab.fill(-1)
	var sizes := []
	for i in W * H:
		if c[i] == 0 or lab[i] >= 0: continue
		var id := sizes.size(); var q := [i]; lab[i] = id; var hd := 0
		while hd < q.size():
			var v: int = q[hd]; hd += 1
			var x := v % W; var y := v / W
			for d in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
				var xx: int = x + d[0]; var yy: int = y + d[1]
				if xx < 0 or yy < 0 or xx >= W or yy >= H: continue
				var j := yy * W + xx
				if c[j] and lab[j] < 0: lab[j] = id; q.append(j)
		sizes.append(q.size())
	var main := 0
	for i in sizes.size():
		if sizes[i] > sizes[main]: main = i
	var main_cells := []
	for i in W * H:
		if lab[i] == main: main_cells.append(i)
	for i in W * H:
		if lab[i] >= 0 and lab[i] != main and sizes[lab[i]] < 14: c[i] = 0
	for id in sizes.size():
		if id == main or sizes[id] < 14: continue
		var cl := []
		for i in W * H:
			if lab[i] == id: cl.append(i)
		var p: int = cl[rand(0, cl.size() - 1)]
		var best: int = main_cells[0]; var bd := 1 << 30
		for m in main_cells:
			var d: int = abs(m % W - p % W) + abs(m / W - p / W)
			if d < bd: bd = d; best = m
		var x := p % W; var y := p / W; var tx := best % W; var ty := best / W
		while x != tx or y != ty:
			if x != tx and (y == ty or rng() < 0.5): x += signi(tx - x)
			else: y += signi(ty - y)
			for d in [[0, 0], [1, 0], [0, 1]]:
				var xx: int = x + d[0]; var yy: int = y + d[1]
				if xx > 1 and yy > 1 and xx < W - 2 and yy < H - 2: c[yy * W + xx] = 1
	cells = c
	# lagos que não cortam a caverna
	var lakes := 1 + (1 if floor_n >= 4 else 0) + (1 if rng() < 0.5 else 0)
	var k := 0; var tries := 0
	while k < lakes and tries < 40:
		tries += 1
		var d := _dt()
		var cand := []
		for i in W * H:
			if d[i] >= 4: cand.append(i)
		if cand.is_empty(): break
		var sd: int = cand[rand(0, cand.size() - 1)]; var target := rand(20, 44)
		var blob := [sd]; var bset := {sd: true}; var hd := 0
		while hd < blob.size() and blob.size() < target:
			var v: int = blob[hd]; hd += 1
			var x := v % W; var y := v / W
			for dd in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
				var j: int = (y + dd[1]) * W + x + dd[0]
				if not bset.has(j) and d[j] >= 2 and rng() < 0.72: bset[j] = true; blob.append(j)
		for i in blob: cells[i] = 2
		if not (_reach(false) and _reach(true)):
			for i in blob: cells[i] = 1
			continue
		for i in blob: water_dir[i] = 3
		k += 1
	# câmaras nos pontos mais abertos
	var d := _dt(); var order := []
	for i in W * H:
		if cells[i] == 1 and d[i] >= 2: order.append(i)
	order.sort_custom(func(a, b): return d[a] > d[b] or (d[a] == d[b] and ((a * 2654435761) % 97) < ((b * 2654435761) % 97)))
	var centers := []
	for min_gap in [13, 9]:
		for i in order:
			var x: int = i % W; var y: int = i / W
			var close := false
			for cc in centers:
				if max(abs(cc[0] - x), abs(cc[1] - y)) < min_gap: close = true; break
			if not close: centers.append([x, y, d[i]])
		if centers.size() >= 5: break
	centers = centers.slice(0, 14)
	centers.sort_custom(func(a, b): return a[0] + a[1] * 1.5 < b[0] + b[1] * 1.5)
	for cc in centers:
		var r: int = mini(4, cc[2] + 1)
		var x0: int = max(1, cc[0] - r); var y0: int = max(1, cc[1] - r)
		rooms.append({"x": x0, "y": y0, "w": mini(W - 2, cc[0] + r) - x0 + 1, "h": mini(H - 2, cc[1] + r) - y0 + 1, "kind": "chamber", "cx": cc[0], "cy": cc[1]})

func _dt() -> PackedInt32Array:
	var d := PackedInt32Array(); d.resize(w * h); d.fill(-1)
	var q := []
	for i in w * h:
		if cells[i] != 1: d[i] = 0; q.append(i)
	var hd := 0
	while hd < q.size():
		var v: int = q[hd]; hd += 1
		var x := v % w; var y := v / w
		for dd in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var xx: int = x + dd[0]; var yy: int = y + dd[1]
			if xx < 0 or yy < 0 or xx >= w or yy >= h: continue
			var j := yy * w + xx
			if d[j] < 0: d[j] = d[v] + 1; q.append(j)
	return d

func _reach(no_shore: bool) -> bool:
	var shore := PackedByteArray(); shore.resize(w * h)
	if no_shore:
		for i in w * h:
			if cells[i] == 2:
				var x := i % w; var y := i / w
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						if x + dx >= 0 and y + dy >= 0 and x + dx < w and y + dy < h: shore[(y + dy) * w + x + dx] = 1
	var start := -1; var total := 0
	for i in w * h:
		if cells[i] == 1 and shore[i] == 0:
			total += 1
			if start < 0: start = i
	if start < 0: return false
	var seen := PackedByteArray(); seen.resize(w * h); seen[start] = 1
	var q := [start]; var hd := 0
	while hd < q.size():
		var v: int = q[hd]; hd += 1
		var x := v % w; var y := v / w
		for dd in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var j: int = (y + dd[1]) * w + x + dd[0]
			if cells[j] == 1 and shore[j] == 0 and seen[j] == 0: seen[j] = 1; q.append(j)
	return q.size() == total

func center(i: int) -> Vector2i:
	var r: Dictionary = rooms[i]
	return Vector2i(r.cx, r.cy) if r.has("cx") else Vector2i(r.x + (r.w >> 1), r.y + (r.h >> 1))

func room_of(x: int, y: int) -> int:
	for i in rooms.size():
		var r: Dictionary = rooms[i]
		if x >= r.x and x < r.x + r.w and y >= r.y and y < r.y + r.h: return i
	return -1

func carve_pockets(n: int) -> Array:
	var out := []; var k := 0; var tries := 0
	while k < n and tries < 4000:
		tries += 1
		var big := tries < 2000
		var pw := rand(6, 7) if big else 5; var ph := rand(4, 5) if big else 4
		var x0 := rand(2, w - pw - 2); var y0 := rand(2, h - ph - 3)
		var ok := true
		for y in range(y0 - 1, y0 + ph + 2):
			for x in range(x0 - 1, x0 + pw + 1):
				if get_c(x, y) != 0: ok = false
		for p in out:
			if x0 < p.x + p.w + 3 and p.x < x0 + pw + 3 and y0 < p.y + p.h + 3 and p.y < y0 + ph + 3: ok = false
		if not ok: continue
		var cl := []
		for y in range(y0, y0 + ph):
			for x in range(x0, x0 + pw):
				if (x == x0 or x == x0 + pw - 1) and (y == y0 or y == y0 + ph - 1): continue
				cells[y * w + x] = 1; cl.append(Vector2i(x, y))
		out.append({"x": x0, "y": y0, "w": pw, "h": ph, "cells": cl}); k += 1
	return out

## BFS de distâncias; passable(x, y) opcional
func distances(fx: int, fy: int, passable := Callable(), limit := 9999) -> PackedInt32Array:
	var d := PackedInt32Array(); d.resize(w * h); d.fill(-1)
	d[fy * w + fx] = 0; var q := [fx, fy]; var hd := 0
	while hd < q.size():
		var x: int = q[hd]; var y: int = q[hd + 1]; hd += 2
		var v := d[y * w + x]
		if v >= limit: continue
		for dd in [[1, 0], [-1, 0], [0, 1], [0, -1]]:
			var nx: int = x + dd[0]; var ny: int = y + dd[1]
			if not is_walk(nx, ny) or d[ny * w + nx] != -1: continue
			if passable.is_valid() and not passable.call(nx, ny): continue
			d[ny * w + nx] = v + 1; q.append(nx); q.append(ny)
	return d

func room_cells(i: int, along_wall := false) -> Array:
	var r: Dictionary = rooms[i]; var out := []
	for y in range(r.y, r.y + r.h):
		for x in range(r.x, r.x + r.w):
			if not is_walk(x, y) or is_bridge(x, y): continue
			var edge: bool = x == r.x or y == r.y or x == r.x + r.w - 1 or y == r.y + r.h - 1
			if along_wall:
				if not edge: continue
				var blocked := false
				for d in D.DIRS8:
					if is_walk(x + d.x, y + d.y) and room_of(x + d.x, y + d.y) == -1: blocked = true
				if blocked: continue
			out.append(Vector2i(x, y))
	return out
