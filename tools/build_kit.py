"""Monta o kit de mapas do Tiled para o Vitula.

Uso: python3 build_kit.py <pasta do jogo>   (gera <pasta do jogo>/mapas)
Tiles de chão em 64 px; prédios e objetos já no tamanho em que aparecem no jogo.
"""
import json, os, shutil, sys
from PIL import Image

GAME = sys.argv[1]
OUT = os.path.join(GAME, "mapas")
T = 64
TV = "1.11.0"

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, "tilesets", "objetos"))
os.makedirs(os.path.join(OUT, "tilesets", "personagens"))

A = lambda *p: os.path.join(GAME, "assets", *p)

# ---------------------------------------------------------------- chão (atlas 64 px)
# (nome, arquivo, sólido). Texturas de 128 viram 4 tiles (pintar em bloco 2x2).
GROUND = [
    ("grama", A("town", "town_grass.png"), False, 128),
    ("paralelepipedo", A("town", "town_cobble.png"), False, 128),
    ("assoalho", A("town", "town_floor_wood.png"), False, 128),
    ("rua", A("town", "town_street.png"), False, 64),
    ("muro_cidade", A("town", "town_wall.png"), True, 64),
    ("telhado", A("town", "town_roof.png"), True, 64),
    ("parede_deposito", A("town", "town_depot_wall.png"), True, 64),
    ("esgoto_chao", A("art", "floor.png"), False, 64),
    ("esgoto_topo_parede", A("art", "wall_top_v3.png"), True, 64),
    ("esgoto_frente_parede", A("art", "wall_front_v3.png"), True, 64),
    ("esgoto_frente_parede_b", A("art", "wall_front_v2.png"), True, 64),
    ("esgoto_ralo_parede", A("art", "wall_drain.png"), True, 64),
    ("esgoto_canal", A("art", "water_channel.png"), True, 64),
    ("esgoto_grade", A("decor", "decor_grate.png"), False, 64),
    ("caverna_musgo", A("art", "cave_floor_moss.png"), False, 64),
    ("caverna_vermelha", A("art", "cave_floor_red.png"), False, 64),
    ("caverna_topo_rocha", A("art", "cave_rock_top.png"), True, 64),
    ("caverna_frente_parede", A("art", "cave_wall_front.png"), True, 64),
    ("caverna_agua", A("art", "cave_water.png"), True, 64),
    ("caverna_margem", A("art", "cave_shore.png"), False, 64),
    ("escada_descer", A("art", "stairs.png"), False, 64),
]
tiles, meta = [], []
for name, path, solid, size in GROUND:
    im = Image.open(path).convert("RGBA")
    if im.size != (size, size):
        im = im.resize((size, size), Image.NEAREST)
    n = size // T
    for j in range(n):
        for i in range(n):
            tiles.append(im.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)))
            meta.append((name + (f"_{j * n + i + 1}" if n > 1 else ""), solid))
COLS = 8
rows = (len(tiles) + COLS - 1) // COLS
atlas = Image.new("RGBA", (COLS * T, rows * T), (0, 0, 0, 0))
for k, t in enumerate(tiles):
    atlas.paste(t, ((k % COLS) * T, (k // COLS) * T))
atlas.save(os.path.join(OUT, "tilesets", "chao.png"))
GID = {}  # nome -> id local no atlas
json.dump({
    "type": "tileset", "version": "1.10", "tiledversion": TV, "name": "chao",
    "image": "chao.png", "imagewidth": atlas.width, "imageheight": atlas.height,
    "tilewidth": T, "tileheight": T, "tilecount": len(tiles), "columns": COLS, "margin": 0, "spacing": 0,
    "tiles": [{"id": k, "properties": [{"name": "nome", "type": "string", "value": nm},
                                        {"name": "solido", "type": "bool", "value": so}]}
              for k, (nm, so) in enumerate(meta)],
}, open(os.path.join(OUT, "tilesets", "chao.tsj"), "w"), ensure_ascii=False, indent=1)
for k, (nm, _) in enumerate(meta):
    GID[nm] = k

# ---------------------------------------------------------------- colisão
col = Image.new("RGBA", (T * 2, T), (0, 0, 0, 0))
col.paste(Image.new("RGBA", (T, T), (220, 40, 40, 150)), (0, 0))
col.paste(Image.new("RGBA", (T, T), (40, 120, 220, 150)), (T, 0))
col.save(os.path.join(OUT, "tilesets", "colisao.png"))
json.dump({
    "type": "tileset", "version": "1.10", "tiledversion": TV, "name": "colisao",
    "image": "colisao.png", "imagewidth": T * 2, "imageheight": T, "tilewidth": T, "tileheight": T,
    "tilecount": 2, "columns": 2, "margin": 0, "spacing": 0,
    "tiles": [{"id": 0, "properties": [{"name": "nome", "type": "string", "value": "bloqueia"}]},
              {"id": 1, "properties": [{"name": "nome", "type": "string", "value": "agua_rasa"}]}],
}, open(os.path.join(OUT, "tilesets", "colisao.tsj"), "w"), ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- coleções de imagens
def collection(name, items, sub):
    """items: (nome, arquivo, escala, classe). Copia a imagem já no tamanho do jogo."""
    out, mw, mh = [], 0, 0
    for k, (nm, path, scale, cls) in enumerate(items):
        im = Image.open(path).convert("RGBA")
        frame = items_frames.get(nm)
        if frame:
            im = im.crop((0, 0, frame, im.height))
            bb = im.getbbox()
            if bb:
                im = im.crop(bb)
        if scale != 1:
            im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
        rel = f"{sub}/{nm}.png"
        im.save(os.path.join(OUT, "tilesets", rel))
        mw, mh = max(mw, im.width), max(mh, im.height)
        tile = {"id": k, "image": rel, "imagewidth": im.width, "imageheight": im.height,
                "properties": [{"name": "nome", "type": "string", "value": nm}]}
        if cls:
            tile["type"] = cls
        out.append(tile)
    json.dump({
        "type": "tileset", "version": "1.10", "tiledversion": TV, "name": name,
        "tilewidth": mw, "tileheight": mh, "tilecount": len(out), "columns": 0, "margin": 0, "spacing": 0,
        "grid": {"orientation": "orthogonal", "width": 1, "height": 1}, "tiles": out,
    }, open(os.path.join(OUT, "tilesets", name + ".tsj"), "w"), ensure_ascii=False, indent=1)
    return {nm: k for k, (nm, *_rest) in enumerate(items)}, {t["id"]: (t["imagewidth"], t["imageheight"]) for t in out}


items_frames = {  # spritesheets: usa só o 1º quadro como prévia
    "guarda_deposito": 200, "vendedora_pocoes": 200, "ferreiro": 200, "cavaleiro": 192,
    "rato": 70, "rato_caverna": 72, "rato_gigante": 108, "morcego": 92, "slime": 100, "esqueleto": 200,
}
CITY = [
    ("portao", A("town", "town_gate.png"), 2, None),
    ("templo", A("town", "town_hall.png"), 1.4, None),
    ("torre", A("town", "town_tower.png"), 2, None),
    ("fonte", A("town", "town_fountain.png"), 1, None),
    ("casa_vermelha", A("town", "town_house_red.png"), 2, None),
    ("casa_palha", A("town", "town_house_thatch.png"), 2, None),
    ("ferraria", A("town", "town_smithy.png"), 2, None),
    ("muralha", A("town", "town_rampart.png"), 1, None),
    ("cipreste", A("town", "town_cypress.png"), 1, None),
    ("lampiao", A("town", "town_lamp.png"), 0.72, None),
    ("bau_deposito", A("town", "depot_chest.png"), 0.85, None),
    ("balcao_deposito", A("town", "depot_counter.png"), 1, None),
    ("balcao_pocoes", A("town", "potion_counter.png"), 1.07, None),
    ("bancada_ferreiro", A("town", "smith_bench.png"), 1, None),
    ("forja", A("town", "smith_forge.png"), 1, None),
    ("porta", A("town", "town_door.png"), 1, None),
    ("janela", A("town", "town_window.png"), 1, None),
    ("estatua_magdha", A("art", "altar_magdha.png"), 128 / 162, "altar"),
]
SEWER = [
    ("barril", A("art", "barrel.png"), 1, None), ("caixa", A("art", "crate_intact.png"), 1, None),
    ("caixa_quebrada", A("art", "crate_damaged.png"), 1, None), ("pilha_caixas", A("decor", "decor_crate_pile.png"), 1, None),
    ("pote", A("art", "pot.png"), 1, None), ("urna", A("art", "urn.png"), 1, None),
    ("pilar", A("art", "pillar.png"), 1, None), ("tocha", A("art", "torch_stand.png"), 1, None),
    ("bau", A("art", "chest_closed.png"), 1, None), ("porta_madeira", A("art", "door_wood_closed.png"), 1, None),
    ("porta_pedra", A("art", "door_stone_closed.png"), 1, None), ("corda", A("art", "rope_v2.png"), 96 / 222, None),
    ("bueiro", A("decor", "decor_manhole.png"), 1, "passagem"), ("ossos", A("decor", "decor_bones.png"), 1, None),
    ("esqueleto_chao", A("decor", "decor_skeleton.png"), 1, None), ("ninho_ratos", A("decor", "decor_rat_nest.png"), 1, None),
    ("lodo", A("decor", "decor_sludge.png"), 1, None), ("poca", A("decor", "decor_pool.png"), 1, None),
    ("espinhos", A("art", "spikes_extended.png"), 1, None), ("respiro_gas", A("art", "gas_vent.png"), 1, None),
    ("cogumelos", A("art", "glow_mushrooms.png"), 1, None), ("pedras", A("art", "cave_rocks.png"), 1, None),
]
CHARS = [
    ("inicio_heroi", A("art", "kn_idle_down.png"), 0.42, "inicio_heroi"),
    ("guarda_deposito", A("town", "npc_depot_guard_idle.png"), 0.42, "npc"),
    ("vendedora_pocoes", A("town", "npc_potion_seller_idle.png"), 0.42, "npc"),
    ("ferreiro", A("town", "npc_smith_idle.png"), 0.42, "npc"),
    ("rato", A("art", "am_rat_walk_v2.png"), 0.6, "area_monstros"),
    ("rato_caverna", A("art", "am_cave_rat.png"), 0.7, "area_monstros"),
    ("rato_gigante", A("art", "am_giant_rat.png"), 0.85, "area_monstros"),
    ("morcego", A("art", "am_bat_fly_v2.png"), 0.6, "area_monstros"),
    ("slime", A("art", "am_slime_walk_v2.png"), 0.5, "area_monstros"),
    ("esqueleto", A("art", "am_skeleton_walk_v2.png"), 0.42, "area_monstros"),
]
items_frames["inicio_heroi"] = 192
cityIdx, citySz = collection("objetos_cidade", CITY, "objetos")
sewIdx, sewSz = collection("objetos_esgoto", SEWER, "objetos")
chIdx, chSz = collection("personagens", CHARS, "personagens")

# ---------------------------------------------------------------- classes (projeto)
def cls(i, name, color, members, use=("object", "tile")):
    return {"id": i, "name": name, "type": "class", "useAs": list(use), "color": color, "drawFill": True,
            "members": [{"name": n, "type": t, "value": v} for n, t, v in members]}

json.dump({
    "automappingRulesFile": "", "commands": [], "compatibilityVersion": 1100,
    "extensionsPath": "extensions", "folders": ["."],
    "propertyTypes": [
        cls(1, "npc", "#ffd27a3c", [("nome", "string", ""), ("funcao", "string", "morador"), ("dialogo", "string", "")]),
        cls(2, "passagem", "#ff3cc8ff", [("destino_mapa", "string", "esgoto.tmj"), ("destino_x", "int", 0),
                                          ("destino_y", "int", 0), ("tipo", "string", "bueiro")]),
        cls(3, "area_monstros", "#ffff4040", [("monstros", "string", "rat"), ("quantidade", "int", 4),
                                               ("renascer_s", "int", 60)]),
        cls(4, "inicio_heroi", "#ff40ff80", []),
        cls(5, "altar", "#fff2e2a0", []),
        cls(6, "luz", "#ffffb040", [("raio", "int", 3), ("cor", "color", "#ffffb060")]),
        cls(7, "zona", "#ff9a9aff", [("nome", "string", ""), ("musica", "string", "")]),
    ],
}, open(os.path.join(OUT, "vitula.tiled-project"), "w"), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- mapas de exemplo
def tsrefs():
    """firstgid de cada tileset externo, na ordem."""
    refs, g = [], 1
    for name, count in [("chao", len(tiles)), ("colisao", 2), ("objetos_cidade", len(CITY)),
                        ("objetos_esgoto", len(SEWER)), ("personagens", len(CHARS))]:
        refs.append({"firstgid": g, "source": f"tilesets/{name}.tsj"})
        g += count
    return refs

REFS = tsrefs()
FG = {r["source"].split("/")[1][:-4]: r["firstgid"] for r in REFS}


class MapBuilder:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.layers = {n: [0] * (w * h) for n in ("chao", "detalhes", "colisao")}
        self.groups = {n: [] for n in ("objetos", "teto", "eventos")}
        self.oid = 1

    def tile(self, layer, x, y, name):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.layers[layer][y * self.w + x] = FG["chao"] + GID[name]

    def fill(self, layer, x0, y0, x1, y1, name):
        """Preenche um retângulo; texturas 2x2 alternam as 4 partes."""
        for y in range(y0, y1):
            for x in range(x0, x1):
                if name + "_1" in GID:
                    self.tile(layer, x, y, f"{name}_{(y % 2) * 2 + x % 2 + 1}")
                else:
                    self.tile(layer, x, y, name)

    def block(self, x0, y0, x1, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.layers["colisao"][y * self.w + x] = FG["colisao"]

    def obj(self, group, ts, idx, sizes, name, tx, ty, props=None, label=""):
        """Objeto-imagem com o canto inferior esquerdo no tile (tx, ty+1)."""
        lid = idx[name]
        w, h = sizes[lid]
        o = {"id": self.oid, "gid": FG[ts] + lid, "x": tx * T, "y": (ty + 1) * T, "width": w, "height": h,
             "name": label, "rotation": 0, "visible": True}
        if props:
            o["properties"] = props
        self.groups[group].append(o)
        self.oid += 1
        return o

    def rect(self, cls_name, tx, ty, tw, th, label="", props=None):
        o = {"id": self.oid, "x": tx * T, "y": ty * T, "width": tw * T, "height": th * T, "name": label,
             "type": cls_name, "rotation": 0, "visible": True}
        if props:
            o["properties"] = props
        self.groups["eventos"].append(o)
        self.oid += 1
        return o

    def save(self, path, props):
        L, lid = [], 1
        for n in ("chao", "detalhes", "colisao"):
            L.append({"id": lid, "name": n, "type": "tilelayer", "width": self.w, "height": self.h, "x": 0, "y": 0,
                      "opacity": 0.45 if n == "colisao" else 1, "visible": True, "data": self.layers[n]})
            lid += 1
        for n in ("objetos", "teto", "eventos"):
            L.append({"id": lid, "name": n, "type": "objectgroup", "draworder": "topdown", "x": 0, "y": 0,
                      "opacity": 1, "visible": True, "objects": self.groups[n]})
            lid += 1
        json.dump({"type": "map", "version": "1.10", "tiledversion": TV, "orientation": "orthogonal",
                   "renderorder": "right-down", "width": self.w, "height": self.h, "tilewidth": T, "tileheight": T,
                   "infinite": False, "nextlayerid": lid, "nextobjectid": self.oid, "properties": props,
                   "layers": L, "tilesets": REFS},
                  open(path, "w"), ensure_ascii=False, indent=1)


P = lambda n, t, v: {"name": n, "type": t, "value": v}

# Karhyn (superfície): exemplo pequeno no centro de um mapa grande
k = MapBuilder(160, 120)
k.fill("chao", 0, 0, 160, 120, "grama")
cx, cy = 80, 60
k.fill("chao", cx - 2, 20, cx + 2, 110, "paralelepipedo")      # avenida norte-sul
k.fill("chao", 30, cy - 2, 130, cy + 2, "paralelepipedo")       # avenida leste-oeste
k.fill("chao", cx - 8, cy - 8, cx + 8, cy + 8, "paralelepipedo")  # praça
k.obj("objetos", "objetos_cidade", cityIdx, citySz, "fonte", cx - 2, cy + 1, label="Fonte da praça")
k.block(cx - 2, cy - 1, cx + 1, cy + 2)
k.obj("objetos", "objetos_cidade", cityIdx, citySz, "templo", cx - 6, cy - 10, label="Templo de Magdha")
k.block(cx - 6, cy - 13, cx + 6, cy - 9)
k.obj("objetos", "objetos_cidade", cityIdx, citySz, "casa_vermelha", cx - 14, cy - 4)
k.block(cx - 14, cy - 6, cx - 10, cy - 3)
k.obj("objetos", "objetos_cidade", cityIdx, citySz, "casa_palha", cx + 10, cy - 4)
k.block(cx + 10, cy - 6, cx + 14, cy - 3)
for x, y in [(cx - 4, cy - 4), (cx + 3, cy - 4), (cx - 4, cy + 4), (cx + 3, cy + 4)]:
    k.obj("objetos", "objetos_cidade", cityIdx, citySz, "lampiao", x, y)
    o = k.rect("luz", x, y - 1, 0, 0, "Lampião", [P("raio", "int", 3)]); o["point"] = True; o["x"] += T // 2; o["y"] = (y - 1) * T + 16
k.obj("objetos", "objetos_cidade", cityIdx, citySz, "portao", cx - 3, 108, label="Portão sul")
k.obj("eventos", "objetos_esgoto", sewIdx, sewSz, "bueiro", cx + 5, cy + 6, label="Bueiro para o esgoto",
      props=[P("destino_mapa", "string", "esgoto.tmj"), P("destino_x", "int", 10), P("destino_y", "int", 10),
             P("tipo", "string", "bueiro")])
k.obj("eventos", "personagens", chIdx, chSz, "inicio_heroi", cx, cy + 6, label="Início do herói")
k.obj("eventos", "personagens", chIdx, chSz, "ferreiro", cx + 12, cy - 2, label="Ferreiro",
      props=[P("nome", "string", "Ferreiro"), P("funcao", "string", "ferreiro")])
k.rect("zona", 30, 15, 100, 95, "Karhyn", [P("nome", "string", "Cidadela de Karhyn")])
k.save(os.path.join(OUT, "karhyn.tmj"), [P("andar", "int", 7), P("nome", "string", "Karhyn")])

# Esgoto (subsolo 1): uma sala e um corredor com canal
e = MapBuilder(80, 60)
e.fill("chao", 0, 0, 80, 60, "esgoto_topo_parede")
def room(x0, y0, x1, y1):
    e.fill("chao", x0, y0, x1, y1, "esgoto_chao")
    e.fill("chao", x0, y0 - 1, x1, y0, "esgoto_frente_parede")
room(6, 6, 20, 16)
room(20, 10, 44, 13)
room(44, 6, 60, 20)
e.fill("chao", 20, 11, 44, 12, "esgoto_canal")
e.fill("chao", 30, 11, 32, 12, "esgoto_grade")
e.tile("chao", 52, 18, "escada_descer")
e.obj("eventos", "objetos_esgoto", sewIdx, sewSz, "corda", 10, 10, label="Corda para Karhyn",
      props=[P("destino_mapa", "string", "karhyn.tmj"), P("destino_x", "int", cx + 5), P("destino_y", "int", cy + 7),
             P("tipo", "string", "corda")])
e.groups["eventos"][-1]["type"] = "passagem"
for n, x, y in [("barril", 7, 7), ("caixa", 8, 7), ("pote", 18, 14), ("ninho_ratos", 55, 8), ("ossos", 47, 17)]:
    e.obj("objetos", "objetos_esgoto", sewIdx, sewSz, n, x, y)
e.rect("area_monstros", 44, 6, 16, 14, "Ratos da sala leste",
       [P("monstros", "string", "rat,cave_rat"), P("quantidade", "int", 5), P("renascer_s", "int", 60)])
e.save(os.path.join(OUT, "esgoto.tmj"), [P("andar", "int", 8), P("nome", "string", "Esgotos de Karhyn")])

shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "LEIA-ME.md"), os.path.join(OUT, "LEIA-ME.md"))
print("tiles de chão:", len(tiles), "| cidade:", len(CITY), "| esgoto:", len(SEWER), "| personagens:", len(CHARS))
