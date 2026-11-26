# Vitula 3D — padroniza e exporta modelos gerados no Hunyuan3D-2 (rodar dentro do Blender 4.x)
# Uso (sem abrir a janela):
#   blender -b -P vitula_export.py -- <pasta_entrada> <pasta_saida> [alvo_triangulos]
# Para cada .glb da entrada: importa, junta as malhas, reduz polígonos, centraliza a base no chão,
# ajusta a escala (altura em casas pelo nome: barril_0.9.glb = 0.9 m; sem número = 1 m),
# prende as cores na paleta de Karhyn (opcional) e exporta .glb leve na saída.
import bpy, sys, os, re, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
IN, OUT = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 3000
os.makedirs(OUT, exist_ok=True)

def clear():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
    for b in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for x in list(b):
            if x.users == 0: b.remove(x)

def process(path):
    clear()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes: print("sem malha:", path); return
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # reduz para o alvo de triângulos
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > TRIS:
        m = ob.modifiers.new("dec", "DECIMATE"); m.ratio = TRIS / tris
        bpy.ops.object.modifier_apply(modifier=m.name)
    # escala pela altura pedida no nome do arquivo
    name = os.path.splitext(os.path.basename(path))[0]
    mt = re.search(r"_(\d+(?:\.\d+)?)$", name); h = float(mt.group(1)) if mt else 1.0
    base = re.sub(r"_(\d+(?:\.\d+)?)$", "", name)
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    zmin = min(v.z for v in bb); zmax = max(v.z for v in bb)
    cx = sum(v.x for v in bb) / 8; cy = sum(v.y for v in bb) / 8
    s = h / max(zmax - zmin, 1e-6)
    ob.location = (-cx * s, -cy * s, -zmin * s); ob.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    # sombreamento chapado (fica melhor com o filtro pixelado do jogo)
    for p in ob.data.polygons: p.use_smooth = False
    ob.name = base
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, base + ".glb"), use_selection=True, export_format="GLB",
                              export_draco_mesh_compression_enable=False, export_apply=True)
    print("ok:", base, f"{h} m")

for f in sorted(os.listdir(IN)):
    if f.lower().endswith(".glb"): process(os.path.join(IN, f))
