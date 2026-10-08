# Regras e calibração da arena

O motor puro permanece em `src/lib/chess.ts`. Partidas PvP continuam como JSON na tabela `games`, com realtime e identidade anônima por token em `localStorage`. Não há alteração de schema.

## Economia e poderes

Cada jogador começa com 1 energia. Após as duas ações da rodada, ambos recebem +1, até 10. Capturas não geram energia: somam material capturado (peão 1, cavalo/bispo 3, torre 5, dama 9). Material é informativo; não decide o vencedor nem concede atributos.

Uma ação é um movimento **ou** um poder. Todos os poderes passam a vez e recarregam após 3 rodadas: usados no lance `m`, ficam disponíveis em `m + 6`.

| Poder     | Custo base | Regra e resposta possível                                                                                                                                                                              |
| --------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Escudo    |          2 | Uma peça aliada, exceto rei, protegida durante a resposta inimiga. A mesma peça só pode receber novamente em `m + 6`.                                                                                  |
| Congelar  |          3 | Uma peça inimiga, exceto rei, perde movimento e ataques durante sua resposta. Volta depois dela e só pode ser congelada novamente em `m + 6`.                                                          |
| Teleporte |          4 | Uma peça aliada, exceto rei, para casa vazia a distância máxima de 3 em qualquer eixo. Sem captura ou promoção de peão.                                                                                |
| Raio      |          6 | Inimigo sem escudo a até 3 casas de uma peça aliada não congelada. Rei e dama imunes. Não exige caminho livre.                                                                                         |
| Bomba     |          9 | Área 3×3, limitada às bordas. O jogador escolhe 1 ou 2 inimigos sem escudo, exceto rei. Explode **depois de uma resposta adversária**; só os alvos marcados ainda na área e sem escudo são capturados. |

A bomba segue a identidade da peça, não apenas sua casa original. Sair da área por movimento ou teleporte, ou receber escudo, salva o alvo. Alvos não marcados, aliados e reis não sofrem dano. A legalidade da resposta também considera a explosão: não é permitido terminar a resposta deixando o próprio rei exposto por perder uma peça que bloqueava um ataque. A animação e o aviso separam armar de explodir.

## Roleta pública e simétrica

Uma opção antes da partida ativa ou desativa a roleta para PvP e solo. Sem roleta, poderes permanecem ativos, com custos fixos. Treino usa custos fixos e não tem relógio.

A roleta sorteia no início e a cada 3 rodadas completas (6 ações). Cada evento tem 25% de probabilidade: Arena estável (nenhum desconto), Proteção (escudo −1), Inverno (congelar −1) ou Distorção (teleporte −1). O custo mínimo é 1. O evento e sua duração são comuns aos dois jogadores.

Entropia vem de `crypto.getRandomValues` na fronteira da aplicação, em `src/lib/new-game.ts`. O resultado é salvo no estado da ação. O motor recebe o índice como argumento e não lê tempo ou aleatoriedade globais. A busca do computador conhece o evento atual; não recebe o próximo sorteio. Na simulação sem sorteio explícito, a próxima arena usa custos estáveis.

## Resultado, relógio e revanche

PvP e solo: 5 minutos para cada cor, sem incremento. PvP só inicia o relógio quando o adversário entra; solo inicia ao abrir a arena. Movimento e poder descontam o tempo de quem agiu. Tempo esgotado encerra antes de aceitar outra ação. O relógio usa timestamps compartilhados no estado; não depende da frequência da renderização da aba.

Xeque-mate exige ausência de **movimentos e poderes** que salvem o rei. Sem ameaça e sem ações, há afogamento. Somente reis empata. Outras peças menores não são consideradas automaticamente insuficientes, pois os poderes alteram as possibilidades.

A terceira posição completa igual empata: tabuleiro, cor a jogar, energia, duração relativa de escudo/congelamento e imunidades, recargas, evento/fase da roleta e bombas pendentes. Relógio, IDs de peças fora das marcações, placar acumulado e número absoluto do lance não alteram a equivalência.

Revanche troca as cores. Solo inicia imediatamente e permite computador de brancas. PvP cria nova partida com tokens novos; precisa de aceite do outro jogador antes de abrir para ambos. A opção de roleta é preservada. O relógio da revanche começa no aceite.

Updates PvP comparam `state->>revision` antes de gravar. Clientes antigos sem revisão são comparados por ausência da revisão e lance atual. Se o estado mudou, a ação é recusada e a arena recarrega o estado atual. Isso evita sobrescrever movimentos/aceites concorrentes sem enviar o JSON inteiro no filtro da URL. Partidas antigas continuam legíveis, com recursos novos ausentes recebendo defaults seguros; relógios antigos ausentes não são inventados retroativamente.

## Progresso e observação do equilíbrio

Vitória: 100 XP; empate: 50; derrota: 25. Conquistas: primeiro duelo concluído, primeira vitória, 10 duelos e vitória solo difícil. São cosméticas, locais neste dispositivo, sem bônus competitivos. Treino e espectadores não recebem XP. Cada `gameId:matchId` concede uma vez; ecos realtime não duplicam a recompensa, e resultados otimistas ainda não confirmados não concedem XP.

O resumo mostra motivo, última ação (incluindo explosão), material capturado, ações e tempo jogado. O histórico local guarda até 200 resumos, com modo, dificuldade, roleta e uso de poderes. A vantagem de material **antes** e depois do uso é registrada; métricas mostram frequência, cor vencedora e posição prévia vantajosa/desvantajosa. São associações descritivas, não prova causal de vantagem de um poder. O painel informa que mistura PvP e dificuldades solo. Para calibrar, comparar amostras por modo/dificuldade/evento e controlar a posição antes do uso.

Os preços e limites são uma primeira configuração de balanceamento, não uma comprovação de equilíbrio por dados. A arquitetura existente valida regras no cliente; revisão protege concorrência, não substitui autoridade de servidor ou auditoria para apostas financeiras.

## Validação

- `npm test`: regras e limites, economia, resposta à bomba, eventos, relógios, repetição, decisões do computador, anúncios, progresso e integração de revanche/seleção/salvamento concorrente.
- `npx tsc --noEmit` e ESLint dos arquivos alterados.
- `npm run build`.
- Conferência da arena Three.js e controles no Chrome em desktop e celular: cliques reais, worker solo, relógio, resultado/XP, troca de cor e bomba marcada. A integração PvP usa Supabase simulado, sem criar partidas no backend real.
