shader_type canvas_item;
// Caverna natural (porte de cave.js/drawCave): o mapa continua em grade, mas o desenho usa campos suaves + ruído.
// data: 1 pixel por casa (R = rocha, G = água, B = distância da rocha ao espaço aberto / 8), filtro linear = campo bilinear.
uniform sampler2D data : filter_linear, repeat_disable;
uniform vec2 cells;                 // largura e altura do mapa em casas
uniform float T = 64.0;
uniform sampler2D face : filter_nearest, repeat_enable;   // frente da rocha (64×64)
uniform sampler2D top : filter_nearest, repeat_enable;    // topo da rocha
uniform sampler2D moss : filter_nearest, repeat_enable;   // chão de musgo
uniform sampler2D red : filter_nearest, repeat_enable;    // chão de terra vermelha
uniform vec3 water_d = vec3(0.04, 0.12, 0.16);
uniform vec3 water_l = vec3(0.10, 0.28, 0.34);
uniform vec3 foam = vec3(0.24, 0.55, 0.63);
uniform vec3 mud_d = vec3(0.24, 0.17, 0.12);
uniform vec3 mud_l = vec3(0.36, 0.27, 0.17);
uniform float front_h = 84.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p, float sp, float seed) {
	p = p / sp + seed * 17.0;
	vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec4 F(vec2 px) {   // campo bilinear lido na textura de dados (centro da casa = valor da casa)
	vec2 uv = px / T / cells;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(1.0, 0.0, 0.4, 1.0);
	return texture(data, uv);
}
float solidV(vec2 p) { return F(p).r + (vnoise(p, 44.0, 1.0) - 0.5) * 0.36 + (vnoise(p, 13.0, 2.0) - 0.5) * 0.14; }

void fragment() {
	vec2 p = UV * cells * T;
	vec2 tile = floor(p / T);
	float hs = hash(tile * 1.37);
	vec2 off = vec2(floor(hs * 64.0), floor(fract(hs * 91.0) * 64.0));
	vec2 warp = vec2(vnoise(p, 52.0, 3.0) - 0.5, vnoise(p, 52.0, 4.0) - 0.5) * 14.0;
	float sv = solidV(p);
	vec3 col;
	if (sv > 0.5) {
		// distância até o chão aberto logo abaixo: se houver, é a frente da rocha
		float d_open = 999.0;
		for (int k = 1; k <= 28; k++) {
			float dy = float(k) * 3.0;
			if (solidV(p + vec2(0.0, dy)) <= 0.5) { d_open = dy; break; }
		}
		if (d_open <= front_h) {
			float v = clamp(63.0 - (d_open - 1.0) * 63.0 / front_h, 0.0, 63.0);
			float k = d_open > front_h - 4.0 ? 1.25 : (d_open < 5.0 ? 0.7 : 1.0);
			col = texture(face, vec2(mod(p.x, 64.0), v) / 64.0).rgb * k;
		} else {
			float dd = F(p).b * 8.0;
			float k = clamp(1.25 - dd * 0.42, 0.0, 1.0) * (0.85 + vnoise(p, 13.0, 2.0) * 0.3);
			if (sv - 0.5 < 0.03) k *= 0.25;
			col = texture(top, (p + off + warp) / 64.0).rgb * k;
		}
	} else {
		vec4 f = F(p);
		float wa_here = texture(data, (tile + 0.5) / cells).g;
		float wv = 0.0;
		if (f.g > 0.001 || wa_here > 0.5) {
			wv = F(p + vec2(vnoise(p, 52.0, 3.0) - 0.5, vnoise(p, 52.0, 4.0) - 0.5) * 44.0).g + (vnoise(p, 13.0, 2.0) - 0.5) * 0.3 + (vnoise(p, 44.0, 1.0) - 0.5) * 0.22;
			wv -= 0.27;
			wv = wa_here > 0.5 ? max(wv, 0.3) : min(wv, 0.48);
		}
		if (wv > 0.5) {
			float depth = min(1.0, (wv - 0.5) * 2.6);
			float qv = vnoise(p * vec2(0.7, 1.3), 30.0, 6.0) * 0.7 + vnoise(p * vec2(1.0, 2.0), 7.0, 8.0) * 0.3;
			col = mix(water_d, water_l, clamp(qv * 0.55 + (1.0 - depth) * 0.45, 0.0, 1.0));
			if (abs(vnoise(p * vec2(1.0, 2.4), 16.0, 7.0) - 0.5) < 0.016) col = water_l;
			if (wv - 0.5 < 0.028) col = foam;
		} else {
			bool is_red = vnoise(p, 230.0, 5.0) + (vnoise(p, 13.0, 2.0) - 0.5) * 0.22 > 0.66;
			vec2 uv = (p + off + warp) / 64.0;
			col = is_red ? texture(red, uv).rgb : texture(moss, uv).rgb;
			float k = 0.8 + vnoise(p, 7.0, 8.0) * 0.35;
			float occ = clamp((sv - 0.12) / 0.38, 0.0, 1.0); k *= 1.0 - 0.6 * occ;
			col *= k;
			if (wa_here > 0.5) col *= vec3(0.62, 0.64, 0.7);
			if (wv > 0.43) col = wv > 0.47 ? mud_d : mud_l;
		}
	}
	COLOR = vec4(col, 1.0);
}
