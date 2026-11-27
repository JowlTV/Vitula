@tool
extends BTCondition
## Acorda quando o herói chega perto (até 7 casas e com caminho de até 12) — chefes acordam sempre.
func _generate_name() -> String: return "Acordado?"
func _tick(_dt: float) -> Status:
	var m = agent
	if m.dead: return FAILURE
	if not m.awake:
		var h = m.world.hero
		var dist: int = max(abs(h.x - m.x), abs(h.y - m.y))
		var f: int = m.world.flow_at(m.x, m.y)
		if (dist <= 7 and f >= 0 and f <= 12) or (m.elite and f >= 0): m.awake = true
	return SUCCESS if m.awake else FAILURE
