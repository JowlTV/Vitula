@tool
extends BTAction
## Ataca quando o tempo de ataque zera (data.atk segundos entre golpes).
func _generate_name() -> String: return "Morder"
func _tick(_dt: float) -> Status:
	if agent.atk_t <= 0: agent.world.monster_bite(agent)
	return SUCCESS
