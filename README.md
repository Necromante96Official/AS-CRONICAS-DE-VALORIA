# 💎 CRÔNICAS DE VALORIA

Um **JRPG topdown estilo Final Fantasy** rodando no navegador — HTML + CSS +
JavaScript modular (com checagem TypeScript via JSDoc) + ferramentas Python.
Sem dependências de runtime, sem assets externos: tudo é procedural.

## ▶️ Como jogar

**Controles:** Setas/WASD movem · **E**/Enter confirma e fala · **Q**/Esc abre o
menu · mouse também funciona (clique nas opções) · no celular aparecem botões touch.

**Roteiro:** fale com o Ancião na Vila Lumen → treine na grama alta →
compre poções com a Mira → descanse na estalagem → atravesse a ponte a leste →
vença o **Dragão do Caos** nas Ruínas ao nordeste.

## ✨ Sistemas implementados

- Exploração topdown com câmera, colisão, **corrida (Shift)**, sons de passo e NPCs com patrulha/diálogo typewriter com retratos
- **Minimapa** ao vivo + **banners de região** ao entrar em locais novos
- Mundo com transições de terreno (espuma, trilhas, fumaça nas chaminés, braseiros, lagoa, portal da vila) e oclusão das copas
- Tiles 16-bit (casas Tudor, cercas, poço, postes, fazenda, montanhas, **palmeiras, neve**) inspirados em `assets/tile-reference.png`
- **Biomas**: Praia do Sol (pesca, sem monstros) e Pico Nevado (encontros mais duros), com **clima dinâmico** (chuva, neve, brasas, folhas, gaivotas)
- **Baús do tesouro**, **pesca** (E encarando a água) e **quest de caça** do Guarda Cato
- Encontros aleatórios por região (planície, bosque, ruínas, neve), **Slime Rei raro** na planície + boss final com IA própria, **enrage** e **barra de chefe**
- Batalha por turnos: **Atacar / Magia / Item / Analisar / Fugir**, com **cenários por região**,
  críticos, animações, partículas, números de dano flutuantes, cursor de alvo
- Party de 3 heróis (Guerreiro, Maga, Clérigo) com XP, níveis e magias por nível
- Loja, estalagem (cura), **cristal restaurador nas ruínas**, itens consumíveis (Bomba só em batalha), ouro
- **Quest secundária**: o boneco perdido do Pip (com marcador "!")
- Save/load em 3 slots com **confirmação de overwrite** e tempo de jogo, Game Over com dicas, tela de ending
- Música chiptune procedural por área (vila, campo, dungeon, batalha, boss) + SFX