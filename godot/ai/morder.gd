@tool
extends BTAction
## Ataque do rato: toca a animação de mordida e tira vida do herói.
func _generate_name() -> String: return "Morder"
func _tick(_dt: float) -> Status:
	return SUCCESS if agent.morder() else RUNNING
