# 💎 CRÔNICAS DE VALORIA

Um **JRPG topdown estilo Final Fantasy** rodando no navegador — HTML + CSS +
JavaScript modular (com checagem TypeScript via JSDoc) + ferramentas Python.
Sem dependências de runtime, sem assets externos: tudo é procedural.

## ▶️ Como jogar

**Duplo clique em `index.html` e pronto.** Ele já é a versão de arquivo único
(tudo embutido: CSS + JS), então funciona sem servidor.

**Jeito dev:** edite `js/` + `dev.html`, suba o servidor e abra `dev.html`:
```bash
python tools/server.py
# abre http://localhost:8080/dev.html
```
Depois regenere o bundle: `python tools/build_single.py`.

**Controles:** Setas/WASD movem · **E**/Enter confirma e fala · **Q**/Esc abre o
menu · mouse também funciona (clique nas opções) · no celular aparecem botões touch.

**Roteiro:** fale com o Ancião na Vila Lumen → treine na grama alta →
compre poções com a Mira → descanse na estalagem → atravesse a ponte a leste →
vença o **Dragão do Caos** nas Ruínas ao nordeste.

## 🗂️ Estrutura

```
index.html            JOGO PRONTO (bundle gerado — duplo clique aqui!)
dev.html              template modular p/ desenvolvimento via servidor
css/                  base.css · ui.css · battle.css
js/
  main.js             entrada (boot)
  core/               Config · Engine · Input · Audio · Camera · SpriteFactory
  world/              Tiles · MapData · TileMap · NPCs
  entities/           Player · Party · Enemies
  battle/             BattleSystem (turnos estilo FF)
  ui/                 Dialog (retrato + typewriter) · Menu (abas) · HUD · TitleScreen · Transition
  systems/            SaveSystem (3 slots) · Inventory (itens + loja) · Settings (som + texto)
  test/               AutoTest (bateria funcional p/ Chrome headless)
src-types/types.d.ts  tipos centrais p/ o tsc
tools/                server.py (dev server) · build.py (integridade)
assets/               README (visuais são 100% procedurais)
```

## ✨ Sistemas implementados

- Exploração topdown com câmera, colisão, **corrida (Shift)**, sons de passo e NPCs com patrulha/diálogo typewriter com retratos
- **Minimapa** ao vivo + **banners de região** ao entrar em locais novos
- Mundo com transições de terreno (espuma, trilhas, fumaça nas chaminés, braseiros, lagoa, portal da vila) e oclusão das copas
- Tiles 16-bit (casas Tudor, cercas, poço, postes, fazenda, montanhas) inspirados em `assets/tile-reference.png`
- Encontros aleatórios por região (planície, bosque, ruínas), **Slime Rei raro** na planície + boss final com IA própria, **enrage** e **barra de chefe**
- Batalha por turnos: **Atacar / Magia / Item / Analisar / Fugir**, com **cenários por região**,
  críticos, animações, partículas, números de dano flutuantes, cursor de alvo
- Party de 3 heróis (Guerreiro, Maga, Clérigo) com XP, níveis e magias por nível
- Loja, estalagem (cura), **cristal restaurador nas ruínas**, itens consumíveis (Bomba só em batalha), ouro
- **Quest secundária**: o boneco perdido do Pip (com marcador "!")
- Save/load em 3 slots com **confirmação de overwrite** e tempo de jogo, Game Over com dicas, tela de ending
- Música chiptune procedural por área (vila, campo, dungeon, batalha, boss) + SFX

## 🛠️ Scripts

| Comando                 | O que faz                                  |
| ----------------------- | ------------------------------------------ |
| `python tools/server.py`| servidor local (abre `dev.html`)                 |
| `python tools/build.py` | valida imports/referências + bundle (sem Node) |
| `python tools/build_single.py` | regenera o `index.html` jogável a partir de `dev.html` + `js/` |
| `python tools/check_dist.py` | valida o bundle via `file://` (boot, clique, movimento) |
| `python tools/run_autotest.py` | bateria funcional de 37 testes no Chrome headless |
| `python tools/screenshot.py`   | screenshots reais (title/field/battle) em `shots/` |
| `npm run check`         | `tsc --noEmit` — tipos via JSDoc (precisa Node) |
| `npm run serve`         | atalho para o servidor Python              |

## 🔮 Expandindo

- Novos monstros: adicione em `js/entities/Enemies.js` + sprite no `SpriteFactory`
- Novos mapas: estenda `buildMap()` / `regionAt()` em `js/world/MapData.js`
- Novas magias: registre em `SPELLS` (`js/entities/Party.js`) — a batalha já as lista
