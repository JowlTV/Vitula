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

# música de fundo (uma por vez, em loop)
var _music: AudioStreamPlayer
var _music_name := ""
func music(name: String, vol := 0.5) -> void:
	if _music == null: _music = AudioStreamPlayer.new(); add_child(_music)
	if name == _music_name and _music.playing: return
	_music_name = name
	var path := "res://assets/music/%s.mp3" % name
	if not ResourceLoader.exists(path): _music.stop(); return
	var s: AudioStreamMP3 = load(path); s.loop = true
	_music_base = vol
	_music.stream = s; _music.volume_db = linear_to_db(max(0.001, vol * Save.data.settings.get("music", 0.6) / 0.6)); _music.play()
func stop_music() -> void:
	if _music: _music.stop(); _music_name = ""
var _music_base := 0.5
func music_volume(v: float) -> void:
	if _music: _music.volume_db = linear_to_db(max(0.001, _music_base * v / 0.6))
