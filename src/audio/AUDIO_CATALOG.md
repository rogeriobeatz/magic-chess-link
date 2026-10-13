# Chess League — auditoria de áudio

Fonte: commits `ebc6b1c` ("SFX Library") e `4b35251` ("novos sons"), pasta `src/audio/`.

**Status da auditoria:** inspeção de nomes, formatos e caminhos e cruzamento com os eventos do jogo. Os arquivos binários não foram reproduzidos aqui; toda atribuição abaixo é **candidata**, sujeita a validação auditiva, duração, volume, qualidade e licença. Não apagar nem renomear os originais antes dessa validação.

## Convenção proposta

- `src/audio/sfx/board/`: `piece-pickup`, `piece-place-01`, `piece-place-02`, `piece-place-soft`, `piece-slide`, `piece-roll`
- `src/audio/sfx/ui/`: `chat-received`, `chat-sent`, `confirm`, `reward`, `chest-open`
- `src/audio/sfx/powers/`: `laser`, `magic`, `sparkle`, `power-charge` (necessário selecionar sons próprios para escudo, bomba e congelamento)
- `src/audio/stingers/`: `victory-short`, `victory-epic`, `defeat`, `match-end`
- `src/audio/music/`: `arena-epic`
- `src/audio/_review/`: alternativos/duplicados até audição comparativa

## Inventário completo por arquivo (nomes preservados)

| Caminho relativo a src/audio | Categoria/uso candidato | Status |
|---|---|---|
| `03597 royal fanfare majestic.wav` | stinger / vitória épica | comparar |
| `13829 sparkling login ding.wav` | UI / confirmação de entrada de apelido (não login) | comparar |
| `Epic Orchestral Game Over 2.mp3` | stinger / fim de partida | comparar |
| `Epic.wav` | stinger ou música / clímax | revisar duração |
| `Epic soundtrack music.wav` | música de fundo opcional de lobby | revisar loop/duração |
| `Game Celebration 1.mp3` | stinger / vitória alternativa 1 | comparar |
| `Game Celebration 2.mp3` | stinger / vitória alternativa 2 | comparar (mesmo caminho nos dois commits) |
| `Game Celebration 3.mp3` | stinger / vitória alternativa 3 | comparar |
| `Game Celebration 4.mp3` | stinger / vitória alternativa 4 | comparar (mesmo caminho nos dois commits) |
| `Game Shoot.wav` | poder / projétil ou raio | comparar |
| `Gamers Fail Game.wav` | derrota / feedback de falha | comparar |
| `Medieval Town - A Chest Unlocks And Opens 03.wav` | UI / recompensa/baú | alternativo |
| `Royal Trumpet Fanfare.mp3` | stinger / vitória solene | comparar |
| `Sparkle Elixir Bonus.wav` | poder / bônus, energia | comparar |
| `Sparkling Magic Elixir.wav` | poder / magia/escudo | comparar |
| `diamond-sparkle.mp3` | UI / recompensa | comparar |
| `win game level 217 - epic.wav` | stinger / vitória épica | comparar |
| `win game level 245 - epic.wav` | stinger / vitória épica | comparar |
| `alerta ou chegada de mensagem/Accept Victory.wav` | UI / notificação ou confirmação | comparar |
| `bau sendo aberto.wav` | UI / baú/recompensa | comparar |
| `colocando peça 2/OBJECT_TABLE_GAME_Chess_Piece_Place_04.wav` | tabuleiro / colocação alternativa | comparar |
| `colocando peça 3/Game Chess Piece Soft Bottom Placement 14.wav` | tabuleiro / colocação suave | comparar |
| `colocando peça/OBJECT_TABLE_GAME_Chess_Piece_Place_01.wav` | tabuleiro / colocação principal | comparar |
| `dados lançados/Game Single Chess Piece Rolling 01.wav` | tabuleiro / peça rolando; não usar em movimento comum | alternativo |
| `ding feliz com sparkles.wav` | UI / bônus ou conquista | comparar |
| `fanfarra lenta de vitoria.wav` | stinger / vitória lenta | comparar |
| `level-victory-2026-09-08-21-00-47-utc/Level Victory 1.wav` | stinger / fim de partida 1 | comparar |
| `level-victory-2026-09-08-21-00-47-utc/Level Victory 2.wav` | stinger / fim de partida 2 | comparar |
| `level-victory-2026-09-08-21-00-47-utc/Level Victory 3.wav` | stinger / fim de partida 3 | comparar |
| `mensagem enviada/Message Alert/Message Alert.mp3` | UI / Quick Chat recebido | candidato principal |
| `mensagem enviada/Message Alert/Message Alert.wav` | UI / Quick Chat recebido | alternativa de formato |
| `mensagem enviada/__MACOSX/Message Alert/._Message Alert.wav` | metadados macOS, não áudio utilizável | excluir em limpeza posterior |
| `movendo peça/Chess Piece Sliding Movement 1/Chess Piece Sliding Movement 1.mp3` | tabuleiro / deslocamento | candidato principal |
| `movendo peça/Chess Piece Sliding Movement 1/Chess Piece Sliding Movement 1.wav` | tabuleiro / deslocamento | alternativa de formato |
| `movendo peça/__MACOSX/Chess Piece Sliding Movement 1/._Chess Piece Sliding Movement 1.mp3` | metadados macOS, não áudio utilizável | excluir em limpeza posterior |
| `movendo peça/__MACOSX/Chess Piece Sliding Movement 1/._Chess Piece Sliding Movement 1.wav` | metadados macOS, não áudio utilizável | excluir em limpeza posterior |
| `tiros de lazer.wav` | poder / raio, ataque de energia | comparar |
| `up diamond-sparkle.mp3` | UI / progressão, conquista | comparar |

## Gatilhos do jogo → áudio

| Evento real | Primeira escolha proposta | Observação |
|---|---|---|
| Movimento `fx.kind = move` | `Chess Piece Sliding Movement 1.mp3` | toque breve, evitar volume excessivo |
| Peça colocada após movimento | `OBJECT_TABLE_GAME_Chess_Piece_Place_01.wav` | possível som complementar, não sobrepor por padrão |
| Captura `fx.kind = capture` | `OBJECT_TABLE_GAME_Chess_Piece_Place_04.wav` | **não há amostra identificada claramente como captura**; testar impacto |
| Quick Chat | `Message Alert.mp3` | bip discreto e volume separado |
| Raio `fx.kind = bolt` | `tiros de lazer.wav` | comparar com `Game Shoot.wav` |
| Escudo `fx.kind = shield` | `Sparkling Magic Elixir.wav` | confirmar adequação |
| Congelar `fx.kind = freeze` | `Sparkle Elixir Bonus.wav` | temporário, pode necessitar som de gelo |
| Teleporte `fx.kind = teleport` | `up diamond-sparkle.mp3` | temporário, pode necessitar som de deslocamento |
| Bomba armada `fx.kind = bomb-arm` | sem candidato inequívoco | criar/selecionar contagem curta |
| Bomba detonada `fx.kind = bomb` | sem explosão inequívoca | **não substituir automaticamente por outro som** |
| Vitória `winner === viewer` | `Game Celebration 2.mp3` | comparar todas fanfarras/stingers |
| Derrota | `Gamers Fail Game.wav` | comparar com `Epic Orchestral Game Over 2.mp3` |
| Empate | sem candidato inequívoco | distinguir da vitória/derrota |
| Música de ambientação | `Epic soundtrack music.wav` | opcional, exigirá loop suave, controle e autorização do usuário |

## Diretrizes de integração

1. Nunca tocar um stinger longo a cada lance; limitar sons de tabuleiro a efeitos curtos.
2. Ajustar ganho e normalizar loudness depois de ouvir amostras, especialmente fanfarras.
3. Evitar áudio automático na LP; respeitar desbloqueio de áudio do navegador, mute e preferência de efeitos.
4. Importar assets do `src/audio/` explicitamente via Vite em um mapa tipado em vez de strings arbitrárias, depois de selecionar o conjunto final.
5. Verificar licenças antes da publicação pública; nomes de arquivos não comprovam permissão de redistribuição.
6. Remover duplicatas WAV/MP3 e `__MACOSX` somente depois de verificar o conteúdo.
7. Manter fallback sintetizado de `src/lib/arena-audio.ts` até os arquivos reais estarem confirmados e testados.
