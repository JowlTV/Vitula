# Kit de mapas do Vitula (Tiled)

Este kit serve para desenhar os mapas do Vitula à mão no Tiled. O jogo vai ler os arquivos `.tmj` desta pasta.

## 1. Instalar e abrir

1. Baixe o Tiled em https://www.mapeditor.org (gratuito; na página, "Download"). Use a versão 1.10 ou mais nova.
2. Descompacte esta pasta `mapas` onde quiser.
3. No Tiled: **File → Open File or Project** e abra `vitula.tiled-project`. Isso carrega as classes do jogo (NPC, passagem, área de monstros).
4. No painel **Project** à esquerda, abra `karhyn.tmj` ou `esgoto.tmj`.

Dica: **View → Snapping → Snap to Grid** deixa tudo alinhado aos tiles. Para o editor em português: **Edit → Preferences → Interface → Language**.

## 2. O que tem no kit

| Arquivo | O que é |
| --- | --- |
| `karhyn.tmj` | Superfície (andar 7). Mapa de 160 × 120 tiles com uma praça de exemplo no centro |
| `esgoto.tmj` | Esgoto (andar 8). Mapa de 80 × 60 com três salas, canal e corda de volta |
| `tilesets/chao.tsj` | Tiles de chão de 64 px: grama, paralelepípedo, assoalho, muros, esgoto e caverna |
| `tilesets/colisao.tsj` | Vermelho = não dá para andar. Azul = água rasa |
| `tilesets/objetos_cidade.tsj` | Prédios e objetos da cidade, já no tamanho do jogo |
| `tilesets/objetos_esgoto.tsj` | Barris, caixas, portas, tochas, ossos, bueiro, corda |
| `tilesets/personagens.tsj` | Herói, NPCs e monstros, para marcar onde ficam |

A arte atual é provisória. Quando a arte nova de Karhyn ficar pronta, eu atualizo os tilesets e os mapas continuam funcionando.

## 3. Camadas (de baixo para cima)

| Camada | Tipo | Para que serve |
| --- | --- | --- |
| `chao` | Tiles | O piso. Pinte com o pincel (**B**) ou o balde (**F**) |
| `detalhes` | Tiles | Por cima do chão: grades, rachaduras, poças |
| `colisao` | Tiles | Marque em vermelho onde não se pode andar. Fica invisível no jogo |
| `objetos` | Objetos | Prédios, barris, lampiões. O jogo coloca o herói na frente ou atrás conforme a altura |
| `teto` | Objetos | Copas de árvore e telhados que ficam transparentes quando o herói passa por baixo |
| `eventos` | Objetos | Início do herói, NPCs, passagens, áreas de monstros, luzes, zonas |

Paredes, muros, telhados e água do chão já bloqueiam sozinhos: eles têm a propriedade `solido = true`. A camada `colisao` é para o resto, como a base de um prédio ou uma fonte.

## 4. Como fazer cada coisa

**Pintar chão:** selecione a camada `chao`, clique num tile do tileset `chao` e pinte. Grama, paralelepípedo e assoalho são texturas de 2 × 2 tiles. Selecione os 4 tiles juntos (arrastando no tileset) e pinte com o bloco inteiro para não aparecer emenda.

**Colocar um prédio ou objeto:** selecione a camada `objetos`, clique na imagem no tileset `objetos_cidade` ou `objetos_esgoto` e clique no mapa (ferramenta **Insert Tile**, tecla **T**). Depois, pinte a base do prédio de vermelho na camada `colisao`.

**Colocar um NPC:** na camada `eventos`, insira o personagem do tileset `personagens`. Ele já vem com a classe `npc`. No painel **Properties**, preencha:
- `nome`: o nome que aparece no jogo;
- `funcao`: `deposito`, `pocoes`, `ferreiro`, `guarda` ou `morador`;
- `dialogo`: a fala.

**Criar uma passagem** (bueiro, escada, corda, porta): insira o `bueiro` (ou outro objeto) na camada `eventos` com a classe `passagem` e preencha:
- `destino_mapa`: o arquivo de destino, por exemplo `esgoto.tmj`;
- `destino_x` e `destino_y`: o tile onde o herói aparece. O número do tile aparece no canto inferior do Tiled quando você passa o mouse.
- `tipo`: `bueiro`, `escada`, `corda` ou `portao`.

Faça sempre o caminho de volta: o bueiro em Karhyn leva ao esgoto, e a corda no esgoto leva de volta a Karhyn.

**Área de monstros:** na camada `eventos`, desenhe um retângulo (**R**), escolha a classe `area_monstros` e preencha:
- `monstros`: separados por vírgula: `rat`, `cave_rat`, `bat`, `slime`, `skeleton`, `giant_rat`;
- `quantidade`: quantos ao mesmo tempo;
- `renascer_s`: segundos para renascer depois de morto.

**Luz:** um ponto (**I**) com a classe `luz` e o `raio` em tiles.

**Estátua de Magdha:** insira `estatua_magdha` (já vem com a classe `altar`).

**Início do herói:** existe um só por mundo. Está em `karhyn.tmj`, embaixo da fonte.

**Nome da região:** um retângulo da classe `zona`, com `nome` (aparece na tela ao entrar) e `musica` (opcional).

## 5. Salvar e mandar para o jogo

Salve com **Ctrl+S**. Os arquivos ficam em `.tmj` (JSON), que é o formato que o jogo lê. Mande os arquivos `.tmj` alterados para mim, ou faça o envio na pasta `mapas/` do repositório no GitHub.

Não renomeie nem mova os arquivos de `tilesets/`, porque os mapas apontam para eles pelo caminho.

## 6. Cuidados

- Um tile = 64 px. Um prédio de 3 tiles de largura tem 192 px.
- Mapas novos: copie `karhyn.tmj` e renomeie, para manter as camadas e os tilesets.
- O tamanho do mapa muda em **Map → Resize Map**.
