shader_type canvas_item;
// Envelhecimento do esgoto (porte de sewerGrime em cave.js): sujeira em camadas, sombra suave e irregular junto às
// paredes, musgo na base dos tijolos, poças de borda orgânica e umidade na beira do canal. Fica por cima do chão.
// data (1 px por casa, filtro linear): R = parede, G = poça, B = beira molhada, A = distância da parede ao chão / 8
uniform sampler2D data : filter_linear, repeat_disable;
uniform sampler2D cellmap : filter_nearest, repeat_disable;   // mesmo dado sem filtro (tipo exato da casa)
uniform vec2 cells;
uniform float T = 64.0;
uniform sampler2D moss : filter_nearest, repeat_enable;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p, float sp, float seed) {
	p = p / sp + seed * 17.0;
	vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec4 F(vec2 px) { return texture(data, px / T / cells); }
vec4 C(vec2 tile) { return texture(cellmap, (tile + 0.5) / cells); }

void fragment() {
	vec2 p = UV * cells * T;
	vec2 tile = floor(p / T);
	vec4 here = C(tile);
	float nA = vnoise(p, 40.0, 11.0), nB = vnoise(p, 12.0, 12.0), nG = vnoise(p, 6.0, 13.0), nM = vnoise(p, 18.0, 14.0);
	float k = (0.8 + nG * 0.28) * (0.86 + nA * 0.24);
	vec4 col = vec4(0.0);
	if (here.r < 0.5 && here.a < 0.5) {   // chão andável (a água tem A = 1 no mapa de casas)
		float sv = F(p).r + (nB - 0.5) * 0.18;
		k *= 1.0 - 0.55 * clamp((sv - 0.1) / 0.4, 0.0, 1.0);
		if (here.b > 0.5) k *= 0.82 + nB * 0.12;
		float pv = F(p).g + (nB - 0.5) * 0.35 + (nA - 0.5) * 0.2;
		col = vec4(0.0, 0.0, 0.0, clamp(1.0 - k, 0.0, 0.8));
		// musgo na base da parede de cima, com franja irregular
		if (C(tile + vec2(0.0, -1.0)).r > 0.5) {
			float into = p.y - tile.y * T, reach = 8.0 + nM * 22.0;
			if (into < reach) { vec3 m = texture(moss, p / 64.0).rgb; col = vec4(mix(col.rgb, m, 0.9), into < reach - 4.0 ? 0.75 : 0.4); }
		}
		if (pv > 0.5) {
			bool rim = pv - 0.5 < 0.04;
			col = rim ? vec4(0.35, 0.45, 0.42, 0.35) : vec4(0.06, 0.09, 0.09, 0.62);
		}
	} else if (here.r > 0.5) {
		k *= 0.92;
		if (C(tile + vec2(0.0, 1.0)).r > 0.5) k *= clamp(1.15 - F(p).a * 8.0 * 0.5, 0.0, 1.0);   // topo de parede some no breu
		col = vec4(0.0, 0.0, 0.0, clamp(1.0 - k, 0.0, 1.0));
	}
	COLOR = col;
}
