# Revisão da interface da arena

A captura anterior mostrou uma hierarquia invertida: os textos de roleta e modo solo ocupavam o alto da lateral, enquanto os cinco poderes exigiam rolagem. Cabeçalho e barras dos jogadores consumiam muita altura. A câmera encaixava os limites em torno da origem, deixando espaço vazio acima do tabuleiro e reduzindo sua escala.

## Composição implementada

- Tela principal dimensionada por `100dvh`, com cabeçalho de 40–62 px e região da arena flexível. O gameplay não depende de rolagem da página ou do painel lateral.
- Tabuleiro como foco central. A câmera centraliza os limites projetados antes de ajustar a distância, aproveitando a altura livre sem cortar peças ou moldura. Em telas verticais, o ângulo fica mais alto para melhorar a leitura das casas e preencher melhor a largura.
- Relógios, cor, energia e material em barras de 30–42 px. A marca permanece no cabeçalho, em escala menor.
- Cinco poderes sempre visíveis: lista lateral no desktop e cinco botões lado a lado na base do celular. Cada um mostra arte, nome e custo/recarga. As descrições na lateral são curtas; regras completas ficam disponíveis em um diálogo.
- Roleta resumida ao evento atual, desconto e rodadas até o próximo giro. Chances e explicações ficam no diálogo de regras.
- Histórico, seleção de dificuldade, reinício, efeitos e convite continuam acessíveis por controles no cabeçalho. Resultado, XP e revanche abrem em um diálogo ao terminar.
- Bomba mantém marcação no tabuleiro, aviso e confirmação junto à arena. O próprio tabuleiro continua interativo em Three.js, com canvas transparente sobre a arte existente.

As regras, custos, recargas e fluxo de sincronização do jogo não mudam nesta revisão. O progresso continua sendo registrado apenas para resultados confirmados, inclusive se o resumo for fechado.

## Verificação

Conferência visual e medições no navegador em desktop, notebook, tablet e celular: cinco poderes, ambos os relógios e evento dentro do viewport, sem rolagem da tela principal. Cliques reais no tabuleiro 3D, resposta do worker solo e acesso a histórico, regras e dificuldade também são conferidos. Os diálogos podem rolar quando o conteúdo de apoio for longo; a arena principal permanece fixa.

Os estilos da nova composição estão em `src/styles/arena.css` e são restritos à arena e seus diálogos.

Prévia: [desktop](ui/arena-desktop.png) e [celular](ui/arena-mobile.png).
