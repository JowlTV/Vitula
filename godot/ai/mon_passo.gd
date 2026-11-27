@tool
extends BTAction
## Dá um passo no campo de distância até o herói (abre caminho matando monstros mais fracos, ou contorna).
func _generate_name() -> String: return "Passo até o herói"
func _tick(_dt: float) -> Status:
	var m = agent
	if m.step_t <= 0 and m.move_t <= 0:
		m.step_t = m.data.step * randf_range(0.9, 1.15)
		m.world.monster_step(m)
	return SUCCESS
