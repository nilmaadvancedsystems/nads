# Acessórias x NADS: leia isto primeiro

Escrito em 17/11/2026. Esta pasta (`docs/acessorias/`) é um relatório em cinco partes, mais este LEIAME. Ele compara o
Acessórias, um sistema comercial de gestão de obrigações para escritórios de contabilidade, com o NADS, o sistema próprio
do escritório Nilma Contabilidade. Depois transforma a comparação em **fichas de trabalho** para o modelo que vai
escrever o código.

Nada do que está nos planos foi feito ainda. O que não está nas fontes nem no código está marcado **"a confirmar"**: não
invente; pergunte ao dono.

---

## 1. Para que serve

- Dizer **o que o NADS deve buscar** (onde o Acessórias é melhor), **o que deve manter** (onde o NADS já é melhor) e
  **o que não deve copiar**.
- Dar ao modelo executor, ficha por ficha, os arquivos reais, as funções e coleções reais, o caminho no banco, a regra
  do banco proposta, o robô envolvido, os testes, como conferir na tela, os critérios de aceite, os riscos e o tamanho.
- Dar **uma ordem só** para executar os dois planos (cliente e escritório) sem fazer a mesma coisa duas vezes (seção 5
  deste arquivo).

## 2. Os arquivos e a ordem de leitura

| Ordem | Arquivo | O que tem | Quando ler |
|---|---|---|---|
| 1 | `00-LEIAME.md` (este) | Regras, resumo, ordem geral de execução | Sempre, primeiro |
| 2 | `03-comparacao.md` | A comparação nos dois sentidos (A: Acessórias melhor; B: NADS melhor; C: empates; D: não copiar), com os ids | Antes de qualquer ficha |
| 3 | `04-plano-lado-do-cliente.md` | 23 fichas da Área do Cliente, do Mandei e dos avisos ao cliente (ids com nome, ex.: `todas-as-guias`) | Quando a ficha da vez for do lado do cliente |
| 4 | `05-plano-lado-do-escritorio.md` | 28 fichas do app Tarefas, das Configurações e dos robôs (ids `E01` a `E24`, `M01` a `M04`) | Quando a ficha da vez for do escritório |
| 5 | `02-como-o-nads-funciona.md` | O retrato do NADS hoje: telas, arquivos, robôs nas três máquinas, coleções | Para consultar quando a ficha citar algo que você não conhece |
| 6 | `01-como-o-acessorias-funciona.md` | O retrato do Acessórias, com a URL de cada função | Só para consultar a ideia de funcionamento; **nunca** para copiar texto ou tela (regra 12) |

Como os ids se ligam:
- O 04 usa os mesmos ids do 03 (o quadro 0.4 do 04 mostra os pares que viraram uma ficha só).
- O 05 usa ids próprios; a tabela "Lacuna do 03 → ficha do 05", na seção 3 do 05, liga cada lacuna do escritório à ficha.

## 3. Como o modelo executor deve trabalhar

1. **Antes de tudo, saiba onde está.** Os planos foram conferidos no checkout `C:\Users\Pao90\nads-mandei`, ramo
   `mandei-area-cliente` (commit `2f571f8c`). Esse ramo está atrás de `origin/desenvolvimento` (o 02 contou 79 commits
   em 17/11/2026; lá já estão `robo/whatsapp.js` e `robo/whatsapp-regras.js`). Antes de codar, rode só `git status` e
   `git log -1` (comandos que não mudam nada) e diga ao dono em que ramo está. Trazer o desenvolvimento para o ramo
   (merge ou rebase) só com o OK dele (regra 11). Se o ramo for outro, confira de novo os caminhos e as linhas citados
   na ficha antes de editar.
2. **Uma ficha por vez**, na ordem da seção 5. Cada linha da tabela é uma entrega separada. Não junte duas fichas numa
   entrega, a não ser que a ficha mande.
3. **Leia a ficha inteira** antes de editar. Abra cada arquivo citado e confira se a linha e o nome ainda batem. Se
   não baterem, siga o código e anote no relatório final.
4. **Siga as camadas da regra 1**: regra pura no core (ou em `dados/*.ts`) com teste vitest; depois o repositório
   (`dados/*.ts` + `dados/*.firestore.ts`); depois a VM (`use*.ts`); por último a tela (`.tsx`), que só desenha.
5. **Tela nova entra como novidade em teste**: em `apps/web/src/comum/novidades.ts`, com `aprovada: false`. Só o Vitor
   aprova.
6. **Rode `npm run verificar`** (testes, lint e conexões) antes de dizer "pronto". Se a pasta `capturas/`, `perfil-*` ou
   `.claude/worktrees` quebrar o lint, não apague nada do dono: rode num checkout limpo ou avise.
7. **Não faça commit, push, merge nem publicação** (`npm run sites`) sem o dono pedir com todas as letras. Ao terminar a
   ficha, entregue um relatório: o que mudou, os testes que rodaram, o que ficou "a confirmar" e o que precisa do dono,
   do Vitor ou do robô.
8. **Regra do banco: peça ao Vitor.** Você não publica regra nenhuma. Se a ficha precisa de regra nova, escreva o texto
   proposto num `.md` em `docs/` (por exemplo `docs/aplicativos/tarefas/regra-<ficha>.md`), marque a ficha como
   "depende do Vitor" e deixe a tela avisando "o banco ainda não aceita" até a regra sair.
9. **Robô**: se a ficha muda um módulo da nuvem, o relatório tem de lembrar que falta o push **e** a troca do metadado
   `robo-versao` da VM `robo-nilma` pelo gcloud, com o OK do dono. Se a ficha depende do robô do PC, confira antes o
   campo `versao` do documento `robo/painelPC` no banco (o robô parou de se atualizar em 12/11/2026). Robô parado:
   escreva o código e os testes, mas não conte com ele em produção, e avise o dono.
10. **Comentário de cada arquivo novo ou mudado**: em português, com a data e a frase do dono que motivou a mudança. Se a
    frase não estiver na ficha, escreva `(plano do Acessórias, 17/11/2026, ficha <id>; frase do dono: a confirmar)`.

## 4. As 12 regras do projeto, por extenso

Os planos as citam como R1 a R12 (o 03 as chama de "regra 1" a "regra 12").

1. **Camadas.** Telas só desenham; a lógica fica nas VMs (hooks `use*.ts`); regras puras ficam em `dados/*.ts` ou em
   `packages/core`, com testes vitest. Comentários em português, com a data e a frase do dono que motivou a mudança.
2. **Firebase só em `dados/*.firestore.ts`.** Nenhum `firebase/*`, `getFirestore` ou `fetch` fora desses arquivos. O
   `npm run conexoes` (`scripts/conexoes.mjs`) confere.
3. **Regras do banco (Firestore rules) quem publica é o Vitor**, não o modelo. A ficha que precisa de regra nova traz o
   texto proposto e marca a dependência. O arquivo de regras não fica no repositório.
4. **Área do Cliente sem chat.** A conversa com o cliente é pelo WhatsApp. Os pedidos são solicitações com situação, não
   conversa.
5. **Privacidade no espelho do cliente** (`areasCliente/{token}`): nunca CPF/CNPJ de compradores; nunca CPF completo de
   funcionário; nunca o motivo de afastamento.
6. **Financeiro: não cortar leituras do banco.** Nenhuma ficha reduz leituras nas telas do Financeiro.
7. **Robô da nuvem: o push não basta.** Depois de mudar o robô, é preciso trocar o metadado `robo-versao` da VM
   `robo-nilma` pelo gcloud, com o OK do dono. O robô do PC parou de se atualizar em 12/11/2026: conferir o campo
   `versao` do documento `robo/painelPC` no Firestore (é documento do banco, não arquivo do repositório; é lido em
   `apps/web/src/aplicativos/robos/dados/central.firestore.ts`).
8. **Mandei com trava de teste** no banco desde 11/11/2026: `LIBERADO_PARA_CLIENTES = false` em `robo/mandei.js`;
   e-mail só para o escritório até liberar ali. O WhatsApp pelo QR code (Baileys, chip novo) roda só no robô da nuvem.
9. **"Voltar" sempre no canto superior esquerdo**, na aplicação toda (regra do Vitor).
10. **Sem encher a tela.** O dono ouviu de um cliente que a Área "tinha muita informação": cada função nova resolve uma
    tarefa concreta, sem encher a tela. Item novo só aparece quando há o que fazer.
11. **Antes de qualquer commit: `npm run verificar`** (testes, lint, conexões). Pastas soltas como `capturas/` e
    `perfil-*` quebram o lint. Commit, push, merge e publicação (`npm run sites`) só com autorização explícita do dono.
12. **Não copiar o Acessórias**: nem textos, nem marca, nem telas. Usar as ideias de funcionamento com nomes e textos
    próprios do NADS (nada de "Lista de Entregas", "Prazo Técnico", "e-Contínuo", "Multipages", "APLA", "AC Notifica",
    nem os ícones de envelope e joinha).

## 5. Resumo executivo (uma página)

**As 10 coisas mais importantes**

1. **O maior ganho do escritório é ter prazo em toda obrigação.** Hoje só o DP tem prazo; o Acessórias tem prazo legal e
   interno em tudo e uma lista única do mês. No NADS isso é a sequência E01 (calendário único de dias úteis) → E02
   (tabela de prazos) → E04 (Prazos do mês). Sem isso, nenhum "atrasado" e nenhum indicador sai certo.
2. **O maior ganho do cliente é ver todas as guias do mês na Área** (`todas-as-guias`), não só DAS, DAE e FGTS. Ela
   destrava o lembrete de vencimento, o relatório de impostos e o PDF dos parcelamentos.
3. **O robô do PC está parado desde 12/11/2026.** Quinze fichas do cliente (fase 2A do 04) dependem dele. Até ele voltar
   a se atualizar, essas fichas só podem ter código e testes, sem produção.
4. **Robô da nuvem só muda com `robo-versao` e o OK do dono.** Vale para `todas-as-guias`, lembrete, aviso de resposta,
   E07, M01, E15, E17, E18, E21, E22 e o WhatsApp.
5. **Várias fichas param no Vitor** (regra do banco): E15, E18, E19, E20, E21, E22, comunicados, aceite-lgpd e
   contatos-e-permissoes com certeza; E05, E06, E08, E09, E10, E17, processos-visiveis e a tela da equipe do
   comprovante-de-leitura talvez (a confirmar, porque o `firestore.rules` não está no repositório).
6. **Sem chat, nem disfarçado.** O WhatsApp do NADS é só de ida (guias e avisos). O atendimento multiatendente do
   Acessórias (Komunic) não deve ser copiado; a E24 é só a decisão, com recomendação de não fazer.
7. **Envio agrupado entre setores contraria o dono.** Em 11/11/2026 ele decidiu que Fiscal e DP mandam e-mails separados
   (`robo/envios-do-dp.js`). Por isso a E17 só agenda dentro de cada setor.
8. **O Mandei continua travado.** Tudo que manda e-mail ou WhatsApp ao cliente vai só ao escritório enquanto
   `LIBERADO_PARA_CLIENTES = false`. Liberar é decisão do escritório.
9. **Três itens saíram do plano**: `xmls-do-mes` (fere a privacidade, regra 5), `tipos-de-pedido-configuraveis` (regra 5,
   regra 10, regra do banco e ganho baixo) e `previa-do-das` (custo-benefício ruim).
10. **O ramo de trabalho está atrasado.** O `mandei-area-cliente` está atrás do `origin/desenvolvimento`, onde já está o
    WhatsApp por QR code. As fichas de WhatsApp (`guias-pelo-whatsapp` e as partes de WhatsApp do lembrete e do aviso de
    resposta) só andam depois de trazer o desenvolvimento, com o OK do dono.

**Onde o Acessórias ganha** (detalhes na seção A do 03): prazos de todas as obrigações, numa lista única com situação;
cadastro de obrigações por empresa; motivo de atraso e dispensa em lote; indicadores de pontualidade; lembretes que se
repetem todo ano; processos com passos; baixa e envio a partir da pasta e separação de PDF com vários clientes; envio
agendado; registro de abertura da guia pelo cliente; lembrete de vencimento ao cliente; todas as guias, comunicados,
acervo de documentos, certificado e "o que o escritório pede" na área do cliente; aviso de acesso novo e registro de
alterações.

**Onde o NADS ganha** (seção B do 03): rotina guiada, com a ferramenta dentro da etapa; Extrator de extratos com
conferência pelo saldo; Fiscal apoiado nos XMLs do SIEG; robôs que buscam e emitem (FGTS Digital, Alterdata, NFS-e,
SEFAZ), não só leem; arquivador próprio; entrega física completa; cofre de senhas e certificados cifrado; delegação fina
com expediente; Área do Cliente com faturamento, RH e certidões; envio do cliente sem login; aviso de mudança na
Receita; boletos e NFS-e dos honorários; sem custo por CNPJ. Esses pontos **se mantêm**: nenhuma ficha os troca pelo
jeito do Acessórias.

## 6. Ordem geral de execução (os planos 04 e 05 numa sequência só)

**Como ler a tabela.**
- **Lado:** C = cliente (plano 04, a coluna "id" traz o número da ficha lá); E = escritório (plano 05).
- **Precisa Vitor?** sim = regra nova certa; a confirmar = depende do `firestore.rules` atual, que não está no
  repositório; não = nenhuma regra.
- **Precisa robô?** não; PC = `robo/area-cliente.js` no robô do PC (conferir `robo/painelPC.versao`); nuvem = push +
  `robo-versao` com OK do dono; vigia = módulo de `robo/vigia-robo.js`, que roda na máquina com a vez em `robo/lider`
  (normalmente a nuvem), logo também push + `robo-versao`.
- **Depende de:** fichas que precisam estar prontas antes. "Decisão" = o dono decide antes.
- Os blocos podem andar em paralelo quando não há dependência entre eles (o bloco 4, de segurança, pode começar logo
  depois do bloco 1). Dentro de um bloco, siga a ordem.

### Bloco 1: só core e site, sem robô (pode começar já)

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 1 | `E01-calendario-de-dias-uteis` | Calendário único de dias úteis e feriados | E | pequeno | não | não | — |
| 2 | `aviso-de-resposta` (1.1, parte A) | O "lido" da solicitação que não volta a cada visita | C | pequeno | não | não | — |
| 3 | `comprovante-da-guia` (1.2, parte A) | "Já paguei" na guia, só no site | C | pequeno | não | não | — |
| 4 | `E03-permissoes-de-prazos` | Permissões novas na tabela de acesso (`podeNosPrazos`) | E | pequeno | não | não | — |
| 5 | `E02-tabela-de-prazos-das-etapas` | Prazo legal, prazo interno e multa por etapa | E | médio | não | não | E01 |
| 6 | `E04-prazos-do-mes` | Prazos do mês: a lista única | E | grande | não | não | E01, E02 |
| 7 | `M04-atrasada-pelo-prazo` | Selo "Atrasada" em Minhas empresas pelo prazo real | E | pequeno | não | não | E02, E04 |
| 8 | `E12-faixa-de-numeros-no-inicio` | Cinco números no Início (Diretor e Dono) | E | pequeno | não | não | E03, E04 |
| 9 | `E14-envios-com-problema` | Envios com problema num lugar só | E | pequeno | não | não | E04 |
| 10 | `E05-motivo-do-atraso` | Motivo do atraso guardado depois da entrega | E | médio | a confirmar (`rotinas`) | não | E04 |
| 11 | `E06-dispensa-em-lote` | Dispensa em lote com desfazer | E | médio | a confirmar | não | E03, E04 |
| 12 | `E09-responsavel-do-dp` | Responsável do DP no Cadastro | E | médio | a confirmar | não | — |
| 13 | `E11-indicadores-de-pontualidade` | Pontualidade por pessoa e setor | E | médio | não | não | E03, E04, E05, E09 |
| 14 | `E13-semana-de-cada-um` | Prazos na agenda do Início | E | médio | não | opcional | E04, E09 |
| 15 | `E16-pdf-com-varios-clientes` | Separar um PDF com guias de vários clientes | E | médio | não | não | — |
| 16 | `E08-obrigacoes-por-empresa` | Ligar, desligar e ajustar etapa por empresa | E | grande | a confirmar (`cadastro`) | não | E02, E03 |
| 17 | `E10-regime-com-vigencia` | Regime com data de início | E | pequeno | a confirmar | não | E08 |

### Bloco 2: robô da nuvem (cada ficha com push + `robo-versao` e o OK do dono)

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 18 | `todas-as-guias` (2B.1) | Todas as guias do mês na Área | C | médio | não | nuvem | — |
| 19 | `E07-aviso-de-prazo-ao-responsavel` | Aviso diário de prazo ao responsável | E | médio | não | vigia | E02, E04, E09 |
| 20 | `M01-resumo-semanal-com-prazos` | Resumo de sexta com a pontualidade | E | pequeno | não | vigia | E04, E07 |
| 21 | `E17-envio-agendado-por-setor` | Envio agendado dentro de cada setor | E | médio | a confirmar | nuvem | — |
| 22 | `E15-lote-a-partir-da-pasta` | Guias já arquivadas viram envio do Fiscal | E | grande | sim (`fiscalArquivos`) | nuvem | — |

### Bloco 3: robô do PC (travado até `robo/painelPC.versao` mostrar que ele voltou a se atualizar)

Antes da ordem 23, confira o robô do PC. Se ainda estiver parado, avise o dono e faça só o código e os testes destas
fichas, sem contar com produção.

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 23 | `certificado-digital` (2A.1) | Validade do certificado digital na Área | C | pequeno | não | PC | robô do PC atualizado |
| 24 | `o-que-falta-mandar` (2A.2) | O que falta mandar (a correção primeiro) | C | grande (passo 1 pequeno) | não | PC | 23; decisão com 25 |
| 25 | `pedidos-do-mandei` (2A.3) | Pedidos do Mandei na Área | C | pequeno | não | PC | 23; decisão com 24 |
| 26 | `comprovante-de-leitura` (2A.6) | Registro de abertura da guia | C | médio | só para a tela da equipe | PC | 23 |
| 27 | `lembrete-de-vencimento` (2B.3) | Lembrete de vencimento ao cliente | C | médio | não | nuvem | 18, 26 (E01 recomendado) |
| 28 | `aviso-de-resposta` (2B.2, parte B) | E-mail quando o escritório responde | C | médio | não | nuvem | 2 |
| 29 | `documentos-do-escritorio` (2A.4) | Acervo de documentos do escritório | C | grande (médio só com o que se marca à mão) | não (com a pasta fixa) | PC | 23; decisão "pasta fixa x botão" |
| 30 | `dados-cadastrais` (2A.5) | Ficha cadastral e contatos dos setores | C | médio | não | PC | 23; números dos setores (dono) |
| 31 | `certidoes` (2A.7) | Certidões na Área | C | médio | não | PC | 29 (aproveita o download) |
| 32 | `confirmar-entrega` (2A.8) | O cliente confirma a entrega física | C | médio | não | PC | 23 |
| 33 | `comprovante-da-guia` (2A.9, parte B) | O robô liga o comprovante à guia | C | médio | não | PC | 3 |
| 34 | `avaliacao-do-atendimento` (2A.10) | Avaliação do atendimento | C | pequeno | não | PC | 23 |
| 35 | `guia-paga-confirmada` (2A.11) | Guia paga confirmada | C | grande | não | PC | 18, 33 |
| 36 | `parcelamentos` (2A.12) | Parcelamentos na Área | C | médio (grande com o PDF) | não | PC (nuvem no PDF) | 23; 18 para o PDF |
| 37 | `informe-e-folha-antiga` (2A.13) | Informe de rendimentos e folhas antigas | C | grande | não | PC | OK do dono (regra 5) |
| 38 | `processos-visiveis` (2A.14) | Passo atual do pedido visível ao cliente | C | médio | talvez (`chamados.passos`) | PC | OK do dono (regra 10); vizinha da E19 (ordem 45) |
| 39 | `relatorio-de-impostos` (2A.15) | Impostos do ano | C | médio | não | não (barato) / PC | 18; baixa prioridade até 2027 |

### Bloco 4: segurança e registro (independente; pode andar em paralelo depois do bloco 1)

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 40 | `E20-registro-de-alteracoes` | Registro de alterações sensíveis | E | médio | sim (`nadsRegistro`) | não | — |
| 41 | `M02-troca-leva-pendencias` | A troca de responsável leva as pendências | E | pequeno | a da E20 | não | E04, E20 |
| 42 | `E21-aviso-de-acesso-novo` | Aviso de acesso novo com "Não fui eu" | E | médio | sim (`nadsSessoes`, `nadsAlertas`) | vigia | — |
| 43 | `E22-liberacao-tambem-para-admin` | Liberação por computador também para Diretor e Dono | E | médio | sim (`config/nads`) | vigia | E21; decisão |

### Bloco 5: coleções novas (só depois de o Vitor publicar a regra)

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 44 | `E18-tarefas-recorrentes` | Tarefas que se repetem por empresa | E | médio | sim (`nadsRecorrentes`) | vigia | — |
| 45 | `M03-papeis-viram-tarefa` | Papel vencendo vira tarefa | E | pequeno | talvez (`config`) | vigia | E18 |
| 46 | `E19-processos-com-passos` | Entrada de clientes no banco (E19a) e processos com passos (E19b) | E | grande (E19a pequeno) | sim (`nadsEntradas`, `nadsProcessos`, `nadsModelosDeProcesso`) | não | E01; OK do dono; decidir com 38 |
| 47 | `comunicados` (3.1) | Comunicados do escritório aos clientes | C | médio | sim | PC | robô do PC atualizado |
| 48 | `aceite-lgpd` (3.2) | Aceite da política de privacidade | C | pequeno | sim (ou o caminho pelo robô do PC) | PC no caminho sem regra | texto do escritório |

### Bloco 6: decidir antes de fazer

| Ordem | Id | Nome | Lado | Tamanho | Precisa Vitor? | Precisa robô? | Depende de |
|---|---|---|---|---|---|---|---|
| 49 | `guias-pelo-whatsapp` (4.1) | Guias pelo WhatsApp (só de ida) | C | médio | não | nuvem | 18; Baileys trazido do `origin/desenvolvimento` (OK do dono) |
| 50 | `honorarios` (4.2) | Boleto e NFS-e dos honorários na Área | C | grande (médio só com o boleto) | não | PC | 35; decisão do Vitor e do Diretor |
| 51 | `E23-lucratividade-minima` | Lucratividade por cliente (mínima; não cortar leituras do Financeiro, regra 6) | E | médio | talvez (`config`) | não | pedido do dono |
| 52 | `E24-whatsapp-do-escritorio` | WhatsApp do escritório integrado (só a decisão; recomendação: não fazer) | E | grande | sim | nuvem | decisão; WhatsApp por QR em produção |
| 53 | `contatos-e-permissoes` (3.3) | Acesso por pessoa da empresa cliente | C | grande | sim (muda o modelo de segurança) | a confirmar (os robôs de envio passam a usar os e-mails das pessoas) | decisão do dono e do Vitor; por último |

**Fora de toda a ordem** (não fazer sem o dono mudar a decisão): `xmls-do-mes`, `tipos-de-pedido-configuraveis`,
`previa-do-das` (seção "Descartados" do 04); juntar e-mails de setores diferentes, remetente editável, catálogo inteiro
de obrigações no banco, painéis montáveis e OCR de escaneado na nuvem (seção 13 do 05).

**Fichas vizinhas** (não são duplicadas, mas mexem no mesmo assunto; leia as duas antes de fazer a segunda):
- `processos-visiveis` (C, 38) e `E19-processos-com-passos` (E, 46): um mostra ao cliente o passo do chamado, o outro
  cria processos internos. Se as duas forem feitas, decidir com o dono qual o cliente vê.
- `lembrete-de-vencimento` (C, 27) e `E01-calendario-de-dias-uteis` (E, 1): o lembrete usa `diasUteis` da E01 se ela
  já estiver feita.
- `lembrete-de-vencimento` (C, 27) e `E07-aviso-de-prazo-ao-responsavel` (E, 19): o primeiro avisa o cliente; o segundo,
  a equipe. Não misture os dois no mesmo módulo do robô.
- `guias-pelo-whatsapp` (C, 49) e `E24-whatsapp-do-escritorio` (E, 52): usam o mesmo WhatsApp por QR code do robô da
  nuvem; a E24 é só decisão.
- `o-que-falta-mandar` (C, 24) e `pedidos-do-mandei` (C, 25): dividem o mesmo cartão "Precisa de você"; decidir com o
  dono qual fonte vale antes de fazer as duas.

**Checklist de cada entrega**: está no fim do 04 ("Checklist de cada entrega") e na seção 14 do 05 ("Para cada ficha,
antes de dizer pronto"). Os dois valem para qualquer ficha.
