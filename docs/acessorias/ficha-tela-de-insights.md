# Ficha nova: Tela de Insights (painel de números e modo TV)

18/11/2026. Pedido do dono: "a Tela de Insights eu quero". Não estava no plano: dependia da Pontualidade (E11, E12,
E13, M01), que foi pulada junto com "Prazos do mês" (E04), apagado porque o DP não usa rotina, usa só a tabela. Por isso
esta ficha **não** usa o "Prazos do mês": monta os números com o que o NADS já tem.

## O que é no Acessórias

Dashboard Flexível: primeiro se cadastra cada **indicador** (totais, por colaborador ou por departamento; período;
filtros), depois se monta um **painel** com vários indicadores, que **giram como slides** num tempo configurável,
pensado para uma TV na parede ("gestão à vista"). Os cartões numéricos são Entregas, Pendentes, Docs (lidos e não lidos)
e Processos. Fonte: relatório `01-como-o-acessorias-funciona.md`, linha do "Dashboard Flexível (Insights)".
Sem copiar textos, marca nem telas (regra 2).

## Como fica no NADS

- **Tarefas › Gestão › Insights**, **só para Diretor e admin** (o dono, 18/11/2026: "esses paineis so vao ser vistos por
  diretor e admin"; no código: `nivelDeDiretor` ou o papel `admin`), com dois jeitos de ver:
  - **Painel**: os cartões do escritório numa tela; o clique abre a lista de onde o número saiu.
  - **Modo TV**: tela cheia, letras grandes, um painel por vez girando a cada 20 s (ajustável), sem menu. A TV fica
    logada com a conta de um Diretor ou admin (não há usuário só de TV: só eles veem).
- Por pessoa e por setor quando o dado tem dono (a rotina do Fiscal e do Contábil, as tarefas delegadas).

## Os números (proposta; o dono escolhe)

| Painel | Números | De onde vem (já existe) |
|---|---|---|
| Rotinas do mês | feitas x faltando, por pessoa, no Fiscal e no Contábil | `rotinas` (as execuções do mês) |
| DP | o que está atrasado na tabela do DP | o mesmo do Painel do DP (`usePainelDoDp`) |
| Guias | enviadas no mês; abertas pelo cliente x não abertas; pagas pelo extrato | lotes do Fiscal e do DP, `areaClienteLeituras`, o `pagoEm` (ficha 35) |
| Clientes | solicitações abertas e respondidas; nota do atendimento do mês; documentos que faltam; pedidos do Mandei abertos | `chamados`, `chamados.avaliacao` (ficha 34), as pendências, `tickets` |
| Entregas físicas | a entregar, entregues, confirmadas pelo cliente | `entregas` |
| Equipe | tarefas delegadas atrasadas por pessoa | as tarefas do Delegador |

## Leituras do banco (o cuidado principal)

Uma TV ligada o dia todo ouvindo seis coleções grandes seria cara. Por isso **um robô monta o resumo** a cada 15 min e
grava um documento só (`nadsInsights/atual`, só números, sem nome de cliente); o painel e a TV ouvem só esse documento
(cerca de 100 leituras por dia por tela aberta). O robô que monta precisa ler as coleções; o custo dele tem de ser
medido antes de ligar (memória "Leituras do banco 17/11": ~290 mil/dia). Melhor no robô do PC, que já ouve `chamados`,
`entregas`, as guias e as rotinas.

## Regra do banco

`nadsInsights/{id}`: ler só Diretor e admin; gravar só o robô (Admin SDK). Texto para o Vitor:

```
match /nadsInsights/{id} {
  allow read: if ehDaEquipe() && (ehDiretorOuDono() || ehAdmin());
  allow write: if false;   // só o robô (Admin SDK)
}
```

## Passo a passo

1. Core `packages/core/src/tarefas/regras/insights.ts`: as contas de cada painel (puras, com testes).
2. Robô: monta `nadsInsights/atual` a cada 15 min (só com o OK do dono depois de medir as leituras).
3. Tela `tarefas/telas/insights/` (VM + tela): o Painel e o Modo TV; entra como novidade em teste (`aprovada: false`).
4. Vitor publica a regra.

## Decisões do dono

- ~~Quais painéis~~: decidido em 18/11/2026, "Todos os seis", na ordem da tabela.
- ~~Quem vê~~: decidido em 18/11/2026, só Diretor e admin (a TV entra com a conta de um deles).

## Feito em 18/11/2026 (sem commit)

- Core `packages/core/src/tarefas/regras/insights.ts` (+teste): as contas dos seis painéis (rotinas por responsável do
  Cadastro; a tabela do DP com a mesma conta do Painel do DP, sem as categorias criadas no nads; chamados e nota do mês;
  entregas; tarefas delegadas atrasadas por pessoa), os painéis da TV e a leitura do documento.
- Robô `robo/insights.js` (+`robo/teste-insights.js`), ligado pelo `robo/area-cliente.js` (robô do PC): **desligado**
  até Robôs › Ajustes › Tela de Insights (`config/insights.ligado`). Leituras quando ligado: dois ouvintes (tarefas
  delegadas em aberto; documentosMensal do mês anterior) e 7 contagens `count()` por volta (~700 por dia); grava só
  quando muda (até 96 por dia).
- Tela Tarefas › Insights (novidade `insights`, `aprovada: false`, só no modo desenvolvedor): o Painel e o Modo TV (tela
  cheia, gira a cada 10/20/30/60 s, setas trocam, espaço pausa, Esc sai). Só Diretor e admin.

## Para o Vitor

1. A regra de `nadsInsights/{id}` (acima).
2. Conferir se o `config/insights` pode ser gravado pela tela de Ajustes (a mesma regra dos outros `config/*`).
3. Os índices: as contagens usam só igualdades (`solicitacoesEmail` tipo+competencia+status; `entregas` status e
   status+competencia; `areaClienteLeituras` competencia); o Firestore costuma servir sem índice composto, mas se o
   robô logar "uma contagem falhou" com link de índice, é criar o índice que o link pede.

## Mudanças do dono (18/11/2026, depois de publicada a 0.0.793)

- "faz algo bonito assim como no acessorias": destaques com anéis, a equipe em cartões com anel, barras, funil e estrelas.
- "pode dividir em menu lateral": Visão geral, Equipe, Departamento Pessoal, Guias, Clientes, Entregas físicas, Tarefas.
- "quer que quando eu clique abra uma visao do que a pessoa ta fazendo": o clique na pessoa abre a janela dela (as
  empresas faltando com a etapa e o progresso, as concluídas, as tarefas atrasadas pelo título). O robô passou a mandar
  no resumo, por pessoa, até 80 empresas (nome, situação, etapa) e até 10 tarefas atrasadas (título, prazo). Só Diretor
  e admin leem o documento.
- "remove o modo tv": o Modo TV saiu.

## Regra publicada (18/11/2026, 19:23, a pedido do dono: "publica a regra")

Publicada pelo serviço de regras do Firebase (entregas-2e5e2), sobre a versão que estava no ar (a de 18/11 18:37), só
acrescentando: `match /nadsInsights/{id}` (ler: `ehDiretorNads()`; gravar: ninguém, só o robô) e
`match /config/insights` (`administraRobos() && soMudou(['ligado'])`). Ruleset novo `a028d8dc-0b6d-41be-a462-53aebf0c0e04`;
o anterior, para voltar se precisar: `2c8bf02c-69a5-4703-a841-c902b78c8f99`. Vitor: o firestore.rules que você mantém
precisa ganhar estas 9 linhas, senão a próxima publicação sua tira.
