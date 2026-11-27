extends Node
## Sons do Vitula (assets/audio). Sfx.play("hit", 0.3)
var _streams := {}
var _pool: Array[AudioStreamPlayer] = []
func _ready() -> void:
	for i in 12:
		var p := AudioStreamPlayer.new(); add_child(p); _pool.append(p)
func play(name: String, vol := 0.5) -> void:
	if not _streams.has(name):
		var path := "res://assets/audio/%s.wav" % name
		_streams[name] = load(path) if ResourceLoader.exists(path) else null
	if _streams[name] == null: return
	for p in _pool:
		if not p.playing:
			p.stream = _streams[name]; p.volume_db = linear_to_db(max(0.001, vol)); p.play(); return
