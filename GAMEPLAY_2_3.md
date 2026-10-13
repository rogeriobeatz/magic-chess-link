# CHESS LEAGUE · Gameplay 2.3

Implementação nas versões 2.1–2.3 da arena. Motor determinístico: `src/lib/chess.ts`; distribuição de sorteios: `src/lib/new-game.ts`; visual: `src/components/Board3D.tsx`, `src/components/ArenaBalance.tsx` e `src/routes/jogo.$id.tsx`.

## Economia e ritmo (2.1)

- Energia inicial: **2** para ambos.
- Renda: **+1** para cada jogador ao fim de cada rodada completa (duas jogadas).
- Captura normal, raio ou bomba: **+1** para o autor da captura, limitado a 10.
- Um poder rápido por turno; Escudo pode ser ativado antes de mover uma peça. Teleporte, Raio e Bomba continuam consumindo o turno.

## Combos e recuperação (2.2)

- **Congelar também é rápido.** Use Escudo **ou** Congelar (um único poder rápido por turno), depois mova uma peça. A ação rápida precisa deixar ao menos um movimento legal. O Rei não pode ficar exposto.
- **Sobrecarga do Rei:** quando um jogador está com 5 ou mais pontos de desvantagem no material presente em tabuleiro, recebe **+1 energia adicional** por rodada. Se uma peça inimiga **capturar dentro de um raio de 2 casas** do seu Rei, o invasor fica congelado na próxima vez dele. O Rei recebe um anel dourado na arena.
- **Casas de energia:** `d4`, `e4`, `d5`, `e5`. Um jogador que ocupa pelo menos uma dessas casas ao término da rodada ganha **+1 energia**. Múltiplas casas não acumulam bônus; respeita o limite total de 10. Elas são sinalizadas em dourado no 3D.
- **Telegrafia:** passar o mouse ou focar Raio/Teleporte na lista de poderes destaca os alvos/alcances legais; clicar/tocar seleciona o poder.

## Eventos globais (2.3)

- A partida começa com Arena Estável; sorteios ocorrem **a cada 3 rodadas completas**, não no início. Resultado escolhido no limite da aplicação e registrado no estado sincronizado.
- Sete eventos com probabilidade uniforme aproximada de **14,3%**:
  1. Arena estável: custos normais.
  2. Proteção: Escudo -1 energia.
  3. Inverno: Congelar -1 energia.
  4. Distorção: Teleporte -1 energia.
  5. **Supercarga:** **+3 energia imediata** para cada jogador, limitada a 10.
  6. **Zona Instável:** a **fileira 5** fica bloqueada por **1 rodada** (dois turnos). Movimento normal e teleporte não podem entrar ou sair da fileira. A zona fica magenta no tabuleiro e a interface avisa quando estabiliza.
  7. **Fúria dos Peões:** peões podem avançar duas casas, mesmo fora da casa inicial, desde que ambas estejam livres. Restrições de xeque continuam valendo.
- Os eventos de custo e Fúria dos Peões permanecem em efeito até o próximo sorteio, três rodadas depois; Zona Instável dura só uma rodada e Supercarga dá o bônus apenas no momento do sorteio.
- Não houve adição de física ou resultados aleatórios dentro de `applyMove` / `applyPower`.

## Validação recomendada antes de liberar como estável

- Executar `npm install`, `npm run build`, `npm test` e `npm run lint`. **A execução desses comandos não foi possível no ambiente de edição conectado.**
- Validar Escudo/Congelar rápido nas partidas local e PvP, incluindo 2 clientes em tempo real e jogadas simultâneas.
- Conferir choque do Rei com vantagem de material -4/-5, captura por Raio e captura convencional perto/longe do Rei.
- Conferir distribuição dos sete eventos, área central, avanço duplo, bloqueio de teleporte e retomada da fileira após dois turnos.
- Verificar hover/foco/touch e os destaques 3D em mobile e desktop.
- Não presumir que partidas pré-existentes com regras antigas terão o mesmo ritmo das novas.
