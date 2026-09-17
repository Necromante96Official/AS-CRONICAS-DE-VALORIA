# assets/

Todos os visuais e sons de **Crônicas de Valoria** são **procedurais**
(gerados em código, sem arquivos binários):

- **Sprites** — `js/core/SpriteFactory.js` desenha heróis (4 direções),
  slime, morcego, golem, dragão e cristal em `<canvas>` offscreen.
- **Tiles** — `js/world/Tiles.js` pinta cada tipo de terreno por código
  (grama, água animada, árvores, casas, ruínas...).
- **Música/SFX** — `js/core/Audio.js` sintetiza chiptune via WebAudio.

Se quiser trocar por pixel-art própria no futuro, coloque os PNGs aqui e
aponte o `SpriteFactory` / `Tiles` para eles — o resto do jogo não muda.
