# Animações do nads — o plano (01/10/2026)

O pedido (Vitor): "achei as animações muito rápidas e genéricas" → "faça um mapa de agentes sobre tudo que tem
animação no app, verifique o animejs para montar um plano de alteração, e verifique sites que são reconhecidos por
animações incríveis e refaça as animações".

Três agentes levantaram:
- **o mapa do app**: tudo que anima hoje e cada troca de estado que "pula";
- **o animejs 4.5**: o que a biblioteca oferece e onde cada recurso cabe;
- **os sites de referência**: Linear, Stripe, Vercel, Raycast, Apple, Family, Emil Kowalski (Sonner/Vaul), Rauno Freiberg, Awwwards.

## A linguagem de movimento

- **O que dá identidade não é a velocidade, é a curva.** Usamos a de saída forte com cauda longa,
  `cubic-bezier(.23,1,.32,1)`, que é a do Linear, a do Raycast e a do Emil. Ela parte rápido e assenta devagar.
- **Três jeitos**, escolhidos em `/tarefas/previa/animacoes`. A escolha fica guardada no navegador:
  - **marca** (padrão): as peças se revelam saindo do desfoque, como o "Nilma" da abertura;
  - **viva**: com mola;
  - **suave**: lenta e elegante.
- **O que se repete o dia todo** (passar o mouse, trocar de aba) **mexe pouco e responde na hora.** O que é raro
  (sucesso, etapa feita, abertura) ganha festa.
- **O teclado não anima:** digitar na busca e o Esc ficam de fora.
- **Menos movimento:** só esmaece; os carregamentos que giram continuam girando, devagar.
- **Só animamos transform e opacity.** O desfoque fica só em peças pequenas, nunca na página inteira.

## Fase 1 — peças compartilhadas (valem para todos os apps) ✅

| O quê | Onde | Referência |
|---|---|---|
| Hover que acende na hora e apaga em 220 ms | nads.css (fim) | Linear |
| Indicador que desliza: sublinhado das abas, fundo + barrinha da lateral, fundo do Segmentado | `useIndicador` (animacao.ts), casca.tsx, componentes.tsx | Family, Vercel |
| Título da página revelado palavra por palavra, de trás de uma máscara | `revelarTitulo` (splitText) | animejs, Linear |
| Números que contam quando aparecem e quando mudam (todos os `Stat`) | `useNumeroAnimado`, `NumeroQueConta` | Stripe, NumberFlow |
| Check desenhado: janela de sucesso e etapa feita na lateral do executor | `desenharCheck` (createDrawable) | Linear (traço) |
| Saída animada de **todas** as janelas, janelas do cadastro, menus e menu do botão direito, e a abertura saindo do foco | o "fantasma" no animador.ts | Emil, Vercel |
| Entrada da página sem desfoque, e encerrada na hora quando abre uma janela (antes, a janela abria fora do lugar) | animacao.ts `encerrarPaginas` | mapa do app (bug) |
| Toque nos botões pelo WAAPI (fora da thread principal) | `afundar`/`voltar` | estudo do animejs |
| Cascata das listas: a lista inteira cabe em ~600 ms (lista grande encurta o intervalo) | `entrar` | Emil |
| A tabela do Drive não remonta mais a cada atualização | ExploradorDoDrive.tsx | mapa do app (bug) |
| Menos movimento: os carregamentos que giram continuam girando, devagar | nads.css | mapa do app (bug) |
| Interruptor, setas e lateral na curva forte | nads.css | Emil |

## Fase 2 — listas vivas e momentos de sucesso ✅

| O quê | Onde |
|---|---|
| Avisos empilhados (Sonner): o mais novo na frente, os de trás 12 px acima e 5% menores (até 3 à vista); com o mouse em cima abrem em leque e o tempo para; com a aba escondida também para; ficam 4 s | retorno.tsx, `paramsDoAvisoQueChega`/`paramsDaPilha` |
| Linhas que deslizam até o lugar novo (FLIP pelo WAAPI) ao ordenar, filtrar, chegar ou sair uma — Minhas empresas, Cadastro, Gmail, Drive; a busca (teclado) não anima | `useLinhasQueSeMovem` |
| Árvore do Drive: as subpastas descem em cascata ao abrir a pasta | ExploradorDoDrive.tsx (Arvore) |
| Tudo pronto (executor): o selo encaixa, o check se desenha, faíscas vermelhas e prateadas, título revelado | `celebrar`, animador.ts |
| Troca de etapa (e de seção pela lateral) com direção: a seguinte chega da direita, a anterior da esquerda | casca.tsx |
| Alerta verde (deu certo, em qualquer app): o check do círculo se desenha; o Ok do banco (Extratudo) encaixa com mola | animador.ts |

Fica para depois: a linha que mudou em tempo real (Firestore) piscar o fundo; a paridade do Conciliadorzinho com festa.

## Fase 3 — morph e detalhes

- **Elemento compartilhado:** a linha da empresa vira a janela do cadastro; a linha do e-mail vira o painel.
- **Botões que trocam de texto** (Salvar → Salvando… → Salvo ✓): cruzamento com `blur(2px)`.
- **Quique de recusa:** clicar fora de uma janela que não fecha.
- **Esqueletos de carregamento** no lugar de "Lendo…".
- **A abertura em 1,2 s:** o contorno do N desenhado, "Nilma" letra a letra; só no primeiro acesso do dia.
