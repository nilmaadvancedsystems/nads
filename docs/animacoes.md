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

## Fase 2 — listas vivas e momentos de sucesso

- **Avisos empilhados no estilo Sonner:** até 3 visíveis, os de trás menores, abrem em leque ao passar o mouse,
  pausam com o mouse em cima e com a aba oculta.
- **Listas que se rearranjam** (FLIP): ordenar e filtrar; um item que sai fecha o espaço.
  - Tabelas: FLIP manual com `translate`. O AutoLayout põe `position:absolute` e quebra `<table>`.
  - Listas de cartões: `createLayout`.
- **Árvore do Drive:** os filhos entram em cascata ao abrir a pasta.
- **Executor:**
  - "Tudo pronto" com celebração: check desenhado e brilho prateado;
  - troca de etapa com direção (a próxima vem da direita);
  - o "vidro" sai do foco.
- **Momentos de sucesso:** banco Ok (Extratudo), conferido (Concilia aí), paridade (Conciliadorzinho).
- **Linha que mudou em tempo real** (Firestore): o fundo pisca e desbota, sem reanimar a lista.

## Fase 3 — morph e detalhes

- **Elemento compartilhado:** a linha da empresa vira a janela do cadastro; a linha do e-mail vira o painel.
- **Botões que trocam de texto** (Salvar → Salvando… → Salvo ✓): cruzamento com `blur(2px)`.
- **Quique de recusa:** clicar fora de uma janela que não fecha.
- **Esqueletos de carregamento** no lugar de "Lendo…".
- **A abertura em 1,2 s:** o contorno do N desenhado, "Nilma" letra a letra; só no primeiro acesso do dia.
