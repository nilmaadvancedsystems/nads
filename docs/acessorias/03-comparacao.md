# Acessórias x NADS: a comparação nos dois sentidos

Este documento compara, ponto a ponto, o sistema Acessórias (gestão de obrigações, robô e-Contínuo, App/Área VIP do cliente, AC Docs, AC Notifica, AC Certifica, Komunic) com o NADS, o sistema próprio da Nilma Contabilidade. Serve para decidir **o que o NADS deve buscar, o que deve manter e o que não deve copiar**. Ele é a base dos planos `04-plano-lado-do-cliente.md` e `05-plano-lado-do-escritorio.md`. O plano 04 usa **os mesmos ids** citados aqui (as lacunas do lado do cliente e as candidatas para a Área do Cliente; os pares que se sobrepõem viraram uma ficha só, ver o quadro 0.4 do 04). O plano 05 dá às fichas do escritório ids próprios (`E01` a `E24`, `M01` a `M04`); a tabela "Lacuna do 03 → ficha do 05", na seção 3 do 05, liga cada lacuna do escritório citada aqui à ficha que a resolve (conferido em 17/11/2026). Quem vai escrever o código é outro modelo: por isso cada ponto traz o caminho real do arquivo, o nome real da função ou da coleção e o que ainda está "a confirmar".

**Como foi feito (17/11/2026).** As afirmações sobre o Acessórias vêm da central de ajuda pública (acessorias.movidesk.com/kb), do site, da documentação da API, de vídeos oficiais e de avaliações de usuários, levantadas antes desta comparação. As afirmações sobre o NADS foram conferidas no código do checkout `C:\Users\Pao90\nads-mandei` (ramo `mandei-area-cliente`, commit `2f571f8c`), por leitura, sem rodar o app nem consultar o banco. Quando algo não pôde ser confirmado, está escrito **"a confirmar"**.

**Regras do projeto que valem para todo item citado aqui** (cada item repete a que o toca):

1. Telas só desenham; a lógica fica nas VMs (`use*.ts`); regras puras em `dados/*.ts` ou `packages/core`, com testes vitest. Comentários em português, com a data e a frase do dono que motivou a mudança.
2. Firebase só em `dados/*.firestore.ts` (o `npm run conexoes` confere).
3. Regras do banco (Firestore rules) quem publica é o Vitor: item que precisa de regra nova traz o texto proposto e marca a dependência.
4. Área do Cliente **sem chat**: conversa é pelo WhatsApp; pedidos são solicitações com situação.
5. Privacidade: nunca CPF/CNPJ de compradores no espelho do cliente; nunca CPF completo de funcionário nem motivo de afastamento no espelho.
6. Financeiro: não cortar leituras do banco no Financeiro.
7. Robô da nuvem: depois de mudar o robô, o push não basta; é preciso trocar o metadado `robo-versao` da VM `robo-nilma` pelo gcloud, com o OK do dono. O robô do PC parou de se atualizar em 12/11/2026 (conferir o campo `versao` do documento `robo/painelPC` no Firestore; não é arquivo do repositório: é lido em `apps/web/src/aplicativos/robos/dados/central.firestore.ts`).
8. Mandei: trava de teste no banco desde 11/11/2026 (`LIBERADO_PARA_CLIENTES = false` em `robo/mandei.js`, linha 12); e-mail só para o escritório até liberar. WhatsApp pelo QR code (Baileys, chip novo) só no robô da nuvem.
9. "Voltar" sempre no canto superior esquerdo.
10. A Área "tinha muita informação" (cliente, ouvido pelo dono): cada função nova resolve uma tarefa concreta, sem encher a tela.
11. Antes de qualquer commit: `npm run verificar`; pastas soltas (`capturas/`, `perfil-*`) quebram o lint. Commit, push, merge e `npm run sites` só com autorização explícita do dono.
12. Não copiar textos, marca nem telas do Acessórias: usar as ideias de funcionamento com nomes e textos próprios do NADS.

**Como ler os ids.** Há duas listas de ids, e alguns pares tratam do mesmo assunto por ângulos diferentes:

- **Lacunas** (24, visão Acessórias x NADS): `guias-completas-na-area`, `comprovante-de-leitura`, `lembrete-de-vencimento`, `guias-pelo-whatsapp`, `documentos-do-escritorio-no-acervo`, `pedidos-do-escritorio-na-area`, `aviso-de-resposta`, `comunicados`, `certificado-do-cliente`, `contatos-e-permissoes`, `processos-visiveis`, `aceite-lgpd`, `ficha-e-contatos-por-setor`, `avaliacao-do-atendimento`, `tipos-de-pedido-configuraveis`, `lista-de-entregas-com-prazos`, `cadastro-de-obrigacoes`, `gestao-de-processos`, `tarefas-recorrentes-anuais`, `baixa-automatica-pela-pasta`, `indicadores-de-pontualidade`, `emails-agrupados-e-modelos`, `lucratividade-por-cliente`, `whatsapp-integrado`.
- **Candidatas** (17, funções para a Área do Cliente vistas em vários portais): `todas-as-guias`, `guia-paga-confirmada`, `comprovante-da-guia`, `previa-do-das`, `parcelamentos`, `o-que-falta-mandar`, `pedidos-do-mandei`, `certidoes`, `certificado-digital`, `documentos-do-escritorio`, `dados-cadastrais`, `xmls-do-mes`, `relatorio-de-impostos`, `honorarios`, `informe-e-folha-antiga`, `aviso-antes-de-vencer`, `confirmar-entrega`.
- **Pares que se sobrepõem** (os planos 04 e 05 devem tratar cada par como um trabalho só, para não fazer duas vezes):
  - `guias-completas-na-area` = `todas-as-guias` + `guia-paga-confirmada` + `comprovante-da-guia`
  - `lembrete-de-vencimento` = `aviso-antes-de-vencer`
  - `documentos-do-escritorio-no-acervo` = `documentos-do-escritorio`
  - `pedidos-do-escritorio-na-area` = `o-que-falta-mandar` + `pedidos-do-mandei`
  - `certificado-do-cliente` = `certificado-digital`
  - `ficha-e-contatos-por-setor` contém `dados-cadastrais`
  - `comprovante-de-leitura` é vizinho de `confirmar-entrega` (um registra a abertura digital da guia, o outro a entrega física confirmada pelo cliente)

---

## (A) Onde o Acessórias é melhor que o NADS

Ordem aproximada por importância (alta, média, baixa), com os itens do mesmo lado juntos. Exceções: A12 (`lista-de-entregas-com-prazos`) é de importância **alta** e está depois dos itens de importância média da Área (A7 a A11); A19 a A22 (baixa, lado do cliente) vêm depois de A18 (baixa, escritório). A importância de cada id é a do levantamento das lacunas.

### A1. Todas as guias do mês na Área do Cliente, com a marca de "paga"

- **Acessórias:** calendário e GED do cliente com tudo o que o escritório entregou (DARF, DAS, FGTS, DARE, ISS, recibos, declarações). O cliente anexa o comprovante de pagamento direto na guia.
- **NADS (conferido):** a Área só recebe **FGTS** (pedidos de `pedidosFgts`, gravados por `robo/area-cliente.js`) e **DAS/DAE** (`robo/envios-do-nads.js`, linha 82: `envio.guia === 'DAS' || envio.guia === 'DAE'`). `ROTULO_DA_GUIA` em `packages/core/src/areaCliente/guias.ts` (linha 10) só conhece `FGTS`, `DAS`, `DAE` e `outra`. Os lotes `robo/lote-fiscal.js` e `robo/lote-dp.js` **não escrevem** em `areasCliente` (conferido por busca). A aba "Pagas" existe na tela, mas `SECOES_DO_BANCO = { documentos: false, dp: true, pagas: false }` (`apps/web/src/aplicativos/cliente/dados/areaCliente.ts`, linha 88) a esconde no banco: só aparece com os dados de exemplo.
- **Por que o Acessórias é melhor:** o cliente encontra **toda** guia num só lugar e sabe o que já pagou. No NADS, DARF do INSS, DCTFWeb, PIS/COFINS, IRPJ/CSLL e DAM do ISS continuam só no e-mail ou no papel.
- **Impacto no escritório:** menos "me manda a guia de novo" pelo WhatsApp; o pagamento reconhecido evita cobrar guia já paga. **No cliente:** um lugar só para pagar; fim da dúvida "paguei ou não?".
- **Resolve:** `guias-completas-na-area` (lacuna), detalhada em `todas-as-guias`, `guia-paga-confirmada` e `comprovante-da-guia` (candidatas). Robô: sim (lotes gravam `areasCliente/{token}/guias/{id}` como o `envios-do-nads.js`; regra 7). Regra do banco: `todas-as-guias` não precisa (usa `guias/*`); `guia-paga-confirmada` não precisa se for um campo `pagoEm` dentro de `guias/*`, mas uma subcoleção nova `pagas` precisa (regra 3); ligar o comprovante à guia por um campo `guiaId` na caixa `areaClienteEnvios` também precisa (regra 3).

### A2. Registro de que o cliente abriu a guia (protocolo de leitura)

- **Acessórias:** "Protocolo Digital": registro de acessos e confirmações de leitura; a página do produto fala em data, hora e IP no contexto da entrega com assinatura digital (se o IP é gravado em toda abertura de guia: **(a confirmar)**); na lista do escritório, o ícone de carta fica vermelho (enviado, não visto) ou azul (cliente abriu), e a equipe pode marcar à mão como visto (artigo 600437). Que no app o cliente confirme o recebimento: **(a confirmar)**.
- **NADS (conferido):** na Área nova, `baixarGuia` (`apps/web/src/aplicativos/cliente/dados/areaCliente.firestore.ts`, linha 209) só lê os pedaços do PDF e **não grava nada**. O único registro parecido é o do portal antigo do Entregas (`portais/{token}.visto`, lido em `apps/web/src/aplicativos/tarefas/dados/entregasDeDocumentos.firestore.ts`), uma vez por link, sem separar guia. O "Recebido" do mural (`nadsAvisos`) é só da equipe.
- **Por que o Acessórias é melhor:** dá prova de entrega digital e diz quem precisa de lembrete.
- **Impacto no escritório:** prova em caso de multa ("o senhor abriu a guia no dia 15"); base para lembrar só quem não abriu. **No cliente:** nenhum trabalho a mais.
- **Resolve:** `comprovante-de-leitura` (lacuna). Vizinho de `confirmar-entrega` (candidata; entrega física). Robô: sim. Regra do banco: a lacuna diz que não precisa; **a confirmar** com o Vitor como o registro sai do navegador do cliente sem caixa nova (se for gravado pelo cliente numa coleção nova, precisa de regra, regra 3). Não registrar IP do cliente sem necessidade (privacidade; o Acessórias registra, o NADS não precisa).

### A3. Lembrete automático de vencimento ao cliente

- **Acessórias:** régua de e-mails N dias antes do vencimento (por exemplo 2, 1 e 0), **só para quem não abriu a guia**; também pelo WhatsApp (AC Notifica).
- **NADS (conferido):** na Área nova o aviso é só visual (sino e "Precisa de você"), e só com a página aberta. O único aviso automático é o push do portal antigo, `robo/avisos-vencimento.js`, para quem tocou "Me avise", um dia antes e no dia. Não há e-mail nem WhatsApp de vencimento.
- **Por que o Acessórias é melhor:** o cliente é lembrado sem abrir nada.
- **Impacto no escritório:** menos guia paga com atraso, menos multa e juros a explicar. **No cliente:** evita multa.
- **Resolve:** `lembrete-de-vencimento` (lacuna) = `aviso-antes-de-vencer` (candidata). Depende de `comprovante-de-leitura` para "só quem não abriu". Robô: sim (regra 7). Regra do banco: **sim** para guardar o canal escolhido pelo cliente (inscrição do celular ou e-mail): texto da regra a propor no plano, dependência do Vitor (regra 3). Lição das avaliações do Acessórias: deixar o cliente escolher o canal e não repetir o aviso.

### A4. Guias enviadas sozinhas pelo WhatsApp

- **Acessórias:** AC Notifica manda a guia pelo WhatsApp com link e protocolo de leitura, também nos disparos agendados.
- **NADS (conferido):** o robô Baileys (`robo/whatsapp.js`, `robo/whatsapp-regras.js`) **não está** no `nads-mandei` (os arquivos não existem lá); está só nos ramos `claude/whatsapp-qr` e `claude/whatsapp-qr-retomada`, sem merge, com `LIBERADO_PARA_CLIENTES = false`. Hoje a via "zap" do Enviar guias do Fiscal (`useEnvioDeGuias.ts`, `apps/web/src/aplicativos/tarefas/dados/loteFiscal.ts`) só abre o `wa.me` com o texto do modelo para mandar à mão (via `'zap'` em `ViaDaGuia`, `apps/web/src/aplicativos/tarefas/dados/loteFiscal.ts`, linha 31; link montado em `apps/web/src/aplicativos/tarefas/telas/fiscal/relatorio/useEnvioDeGuias.ts`, linha 167).
- **Por que o Acessórias é melhor:** a guia chega no canal que o cliente lê, sem a equipe digitar.
- **Impacto no escritório:** tira o envio manual do WhatsApp do Fiscal e do DP. **No cliente:** recebe onde já conversa com o escritório.
- **Resolve:** `guias-pelo-whatsapp` (lacuna). Robô: sim, **só no robô da nuvem** (regra 8), com OK do dono para trocar `robo-versao` (regra 7). Regra do banco: não. **Cuidado:** as avaliações do Acessórias mostram números banidos por envio em lote pelo WhatsApp não oficial; o NADS deve manter o limite que o ramo já tem (um por vez, 20 a 60 s entre envios, 30 por hora, 150 por dia, só telefone do cadastro). Só envio, nunca conversa (regra 4).

### A5. Acervo de documentos do escritório para o cliente

- **Acessórias:** GED do cliente com cópia de tudo o que foi entregue e o acervo permanente (contrato social), com busca por nome.
- **NADS (conferido):** a Central de documentos tem pastas, busca e download em `.zip`, mas a pasta "do escritório" não tem fonte no banco: `SECOES_DO_BANCO.documentos = false` e `baixarDocumento` devolve `null` (`areaCliente.firestore.ts`, linha 223). O caminho de bytes já existe para o DP (`documentos/{id}` com pedaços `{id}~{n}`, em `robo/area-cliente.js`), com janela de `MESES_DO_DP = 3` (linha 46).
- **Por que o Acessórias é melhor:** o cliente pega contrato social, alvará, balancete e recibos sozinho, a qualquer hora.
- **Impacto no escritório:** menos pedido de "2ª via do contrato". **No cliente:** resolve pedido de banco e fornecedor na hora.
- **Resolve:** `documentos-do-escritorio-no-acervo` (lacuna) = `documentos-do-escritorio` (candidata); a parte do DP antigo é `informe-e-folha-antiga` (ver B). Robô: sim. Regra do banco: não. O balancete em PDF pede um roteiro novo no robô do Alterdata (**a confirmar** se o robô do PC está atualizado: regra 7).

### A6. O cliente vê o que o escritório está pedindo, com prazo e cobrança

- **Acessórias:** AC Docs: matriz mensal de documentos (extratos, notas) com dia-limite, régua de e-mails antes e depois do prazo, envio pelo app (com login do cliente) e situação da cobrança e de cada documento. A central de ajuda (artigo 598607) cita para a cobrança "Pendente" e "Vencido" e, para cada documento, pendente, aprovado, recusado e dispensado; a lista completa das situações da cobrança (por exemplo "Parcial") e o funcionamento da régua de e-mails estão **(a confirmar)**.
- **NADS (conferido):** o lado do escritório existe mais do que parece: a coleção `documentosMensal` (Pendências) e a régua `robo/regua-cobranca.js` (1ª, 2ª e 3ª cobrança), que se liga pela tela Robôs › Ajustes (`packages/core/src/robos/ajustes.ts`, grupo `cobranca`; vem desligada). Os tickets do Mandei (`robo/mandei.js`, `tickets/`, `ticketsLinks/`) estão com a trava de teste (regra 8). O que falta: a Área **não mostra nada disso**; `EstadoDaArea.tickets` existe em `cliente/dados/areaCliente.ts`, mas `espelho.ts` não lê tickets (só o exemplo tem).
- **Por que o Acessórias é melhor:** o pedido do escritório fica visível ao cliente, num lugar só, com prazo.
- **Impacto no escritório:** menos cobrança por e-mail e WhatsApp; o mês fecha mais cedo. **No cliente:** uma lista curta "o que falta mandar", com o botão que abre o envio certo.
- **Resolve:** `pedidos-do-escritorio-na-area` (lacuna) = `o-que-falta-mandar` + `pedidos-do-mandei` (candidatas). Robô: sim (gravar `resumo/pendencias` e `resumo/tickets`; regra 7). Regra do banco: ler `resumo/*` não precisa; prender o envio ao item por campo novo na caixa precisa (regra 3). `pedidos-do-mandei` só depois de soltar a trava do Mandei (regra 8). No cartão "Precisa de você", não numa tela nova (regra 10).

### A7. Aviso ao cliente quando o escritório responde

- **Acessórias:** contador de novidades nos botões Solicitações e Comunicados, solicitação marcada na lista e e-mails do robô sobre o que o cliente ainda não viu.
- **NADS (conferido):** `apps/web/src/aplicativos/cliente/dados/regras.ts` (linha 78) monta "O escritório respondeu" na hora, a partir de chamados com situação `respondido`; não há marca de lido gravada. `robo/area-cliente.js` copia a resposta ao espelho, mas não manda e-mail, push nem WhatsApp.
- **Por que o Acessórias é melhor:** o cliente fica sabendo sem precisar entrar.
- **Impacto no escritório:** pedido respondido não fica parado esperando o cliente olhar. **No cliente:** sabe que tem resposta.
- **Resolve:** `aviso-de-resposta` (lacuna). Robô: sim. Regra do banco: não. Aviso é **de ida** (e-mail ou WhatsApp só de envio), sem virar conversa (regra 4).

### A8. Comunicados do escritório para os clientes

- **Acessórias:** mural com envio por empresa, regime, grupo ou tag, agendamento, push na data e relatório de leitura.
- **NADS (conferido):** o mural `nadsAvisos` (`apps/web/src/aplicativos/tarefas/dados/avisos.ts`, `avisos.firestore.ts`) é **só da equipe**, com fixar, PDF e "Recebido". Na Área, `EstadoDaArea.avisos` e o sino existem, mas `espelho.ts` não preenche avisos (conferido: nenhuma ocorrência de `avisos` em `espelho.ts`); só os exemplos têm avisos fixos.
- **Por que o Acessórias é melhor:** um aviso (recesso, mudança de lei, prazo) chega a todos de uma vez.
- **Impacto no escritório:** menos mensagem repetida um a um. **No cliente:** informação certa no lugar certo.
- **Resolve:** `comunicados` (lacuna). Robô: sim. Regra do banco: **sim** (regra 3). Atenção à regra 10: o mural não pode virar feed de notícias; o Acessórias permite publicar "oportunidades" e notícias, o NADS deve limitar a avisos que exigem ação ou mudam prazo.

### A9. Aviso do certificado digital ao cliente

- **Acessórias:** AC Certifica: e-mails N dias antes do vencimento, com link de renovação de certificadora parceira.
- **NADS (conferido):** a Área tem o cartão e o item no sino (`situacaoDoCertificado`), mas `espelho.ts` nunca preenche `certificado` (fica o `null` do `AREA_VAZIA`; nenhuma ocorrência de `certificado` em `espelho.ts`). O aviso existe só para a equipe: `robo/certificados-do-cofre.js` (30/15/7/3/0 dias) e `robo/papeis-vencendo.js`.
- **Por que o Acessórias é melhor:** o cliente fica sabendo e pede a renovação antes de travar a emissão de nota.
- **Impacto no escritório:** menos urgência de última hora. **No cliente:** não fica sem emitir nota.
- **Resolve:** `certificado-do-cliente` (lacuna) = `certificado-digital` (candidata). Robô: sim (gravar `resumo/certificado { validoAte, tipo: 'A1' }`; o titular está cifrado no cofre, usar a razão social). Regra do banco: não. Tamanho pequeno. O A3 não aparece (o cofre não tem a validade dele: **a confirmar**). Sem link de certificadora parceira (não há parceria; regra 12).

### A10. Acesso por pessoa da empresa cliente

- **Acessórias:** login por e-mail e senha por contato, permissões por departamento e por obrigação, contato que só consulta, "Meus dados".
- **NADS (conferido):** um link secreto por empresa, sem login nem pessoas (`apps/web/src/aplicativos/cliente/dados/perfis.ts` guarda os links no navegador); quem tem o link vê tudo; os e-mails vão para o e-mail do Cadastro.
- **Por que o Acessórias é melhor:** o RH do cliente não vê o faturamento, o sócio vê tudo, e cada um recebe só o seu.
- **Impacto no escritório:** e-mail certo para a pessoa certa. **No cliente:** privacidade dentro da própria empresa.
- **Resolve:** `contatos-e-permissoes` (lacuna). Tamanho **grande**, robô e regra do banco (regra 3). Pesa contra: o link sem senha é o que deixa a Área simples (regra 10). Recomendação a decidir pelo dono: **a confirmar** se vale o custo.

### A11. Acompanhar processos de várias etapas pela Área

- **Acessórias:** processos (abertura, alteração, baixa, admissão) em checklist visível no app, com aviso a cada etapa e e-mails de acompanhamento.
- **NADS (conferido):** as solicitações têm só as situações aberto, em andamento, respondido e concluído (`packages/core/src/areaCliente/chamados.ts`). O único processo de várias etapas é interno: Entrada de clientes (`packages/core/src/administrativo/entradaDeClientes.ts`, `ETAPAS`), protótipo que só aparece para Diretor com a novidade `administrativo` ligada (`apps/web/src/comum/novidades.ts`, `aprovada: false`; filtro em `apps/web/src/aplicativos/tarefas/casca/navegacao.ts`).
- **Por que o Acessórias é melhor:** o cliente sabe onde está a abertura da empresa ou a rescisão sem ligar.
- **Impacto no escritório:** menos "como está meu processo?". **No cliente:** previsibilidade.
- **Resolve:** `processos-visiveis` (lacuna), vizinho de `gestao-de-processos` (A15). Robô: sim. Regra do banco: talvez (o campo `passos` em `chamados`; ver a ficha 2A.14 do 04). O plano 04 faz a versão mínima pelos passos do próprio chamado, sem esperar a E19 do 05; quando a E19 existir, decidir com o dono qual das duas o cliente vê (a confirmar), para não manter duas.

### A12. Controle de prazos de todas as obrigações, de todos os departamentos

- **Acessórias:** Lista de Entregas com 10 situações (pendente, prazo técnico, atrasada, justificada, entregue antecipada/no prazo/atrasada, dispensada etc.), responsável pelo prazo e pela entrega, edição de prazos em massa, dias úteis, feriados por cidade, cores (azul, amarelo, vermelho) e a marca "passível de multa".
- **NADS (conferido):** só o DP calcula prazo legal e "Atrasado" (`packages/core/src/tarefas/regras/prazosDoDp.ts`, usado em `dp/usePainelDoDp.ts`). A interface `Etapa` (`packages/core/src/tarefas/tipos.ts`, linha 42) **não tem campo de prazo**; no Fiscal o vencimento é só texto na descrição ("vence dia 20"). Minhas empresas mostra situação, sem atraso nem dias para vencer. `packages/core/src/areaCliente/vencimentos.ts` tem uma tabela de vencimentos para a agenda do cliente, com linhas "PRECISA CONFERIR".
- **Por que o Acessórias é melhor:** o gestor vê numa lista só o que vence e o que atrasou em todos os setores.
- **Impacto no escritório:** evita multa por esquecimento no Fiscal e no Contábil. **No cliente:** guias no prazo.
- **Resolve:** `lista-de-entregas-com-prazos` (lacuna). Tamanho grande, sem robô e sem regra nova segundo o levantamento. Regras puras no core (regra 1). Usar nomes próprios para as situações, não os do Acessórias (regra 12).

### A13. Cadastro de obrigações pela tela

- **Acessórias:** catálogo de obrigações com prazo por mês, "sábado é útil?", "exigir robô?", "passível de multa?", tempo previsto; regimes e grupos aplicados à empresa; geração automática das competências; obrigação avulsa.
- **NADS (conferido):** as rotinas são fixas em código (`packages/core/src/tarefas/rotinas/*.ts`; `fiscal.ts` diz ser o único lugar a mexer, com `Etapa.regimes` e `Etapa.meses`). O DP já tem parâmetros por cliente mudáveis no NADS (`packages/core/src/tarefas/regras/configuracoesDoDp.ts`). Fiscal e Contábil não ligam/desligam obrigação por empresa pela tela.
- **Por que o Acessórias é melhor:** obrigação nova (por exemplo da reforma tributária) entra sem programador.
- **Impacto no escritório:** autonomia do Fiscal; menos dependência de mudança de código. **No cliente:** nenhum direto.
- **Resolve:** `cadastro-de-obrigacoes` (lacuna). Tamanho grande; regra do banco **sim** (regra 3).

### A14. Lembretes recorrentes por empresa (alvará, bombeiros, apólice)

- **Acessórias:** tarefas agendadas com dia, mês e ano; ano "0" repete todo ano; entram na lista do responsável.
- **NADS (conferido):** o Delegador (`nadsTarefasDelegadas`, `packages/core/src/tarefas/regras/delegadas.ts`) não repete. `robo/papeis-vencendo.js` avisa admin e contábil do vencimento de `clientes.papeis` (tem tipo "outro"), mas não repete nem vira tarefa. `robo/lembretes.js` é por dia do mês e cargo, sem empresa.
- **Impacto no escritório:** nada anual esquecido. **No cliente:** evita alvará vencido.
- **Resolve:** `tarefas-recorrentes-anuais` (lacuna). Robô: sim. Regra do banco: o levantamento dizia "não", mas a ficha E18 do plano 05 cria a coleção `nadsRecorrentes`, que **precisa** de regra nova (regra 3).

### A15. Processos com etapas (abertura, alteração, baixa, admissão, rescisão)

- **Acessórias:** matrizes com passos bloqueantes, sub-matrizes por pergunta, follow-ups automáticos, autorização, suspensão, recorrência e relatórios.
- **NADS (conferido):** Entrada de clientes (etapas Ficha, Orçamento, Aguardando o cliente, Documentos, Cadastro, e o fim Cliente cadastrado ou Não fechou, em `ETAPAS` de `packages/core/src/administrativo/entradaDeClientes.ts`; tela `apps/web/src/aplicativos/tarefas/telas/administrativo/EntradaDeClientes.tsx`; protótipo da novidade `administrativo`, ainda não aprovada); admissão só como modelo do Mandei (`packages/core/src/mandei/modelos.ts`); "demissao" é só um tipo de chamado; não há processo de rescisão, alteração ou baixa.
- **Impacto no escritório:** padroniza trabalho societário e de DP. **No cliente:** ver A11.
- **Resolve:** `gestao-de-processos` (lacuna). Tamanho grande; regra do banco **sim** (regra 3).

### A16. Baixa e envio automáticos ao salvar a guia numa pasta

- **Acessórias:** e-Contínuo: salvou o PDF na pasta monitorada, o robô identifica empresa, competência e vencimento, dá baixa, envia por e-mail/app/WhatsApp e guarda cópia; divide um PDF com guias de vários clientes (multipages).
- **NADS (conferido):** a pasta monitorada existe (`robo/arquivador-continuo.js`, pasta "Claudio Secretario", regras em `robo/arquivador-regras.js`), mas **só arquiva**. Os lotes (`robo/lote-fiscal.js`, `robo/lote-dp.js`, `apps/web/src/aplicativos/tarefas/dados/loteFiscal.ts`, `loteDp.ts`) leem, mandam e-mail, gravam no Drive e preenchem o Relatório (`controleTributos`), mas pedem revisão e disparo manual. Separar PDF por páginas só à mão (`packages/core/src/ferramentas/pdf.ts`, `separarPdf`).
- **Por que o Acessórias é melhor:** menos cliques por guia.
- **Por que o NADS não está tão atrás:** a revisão humana evita a queixa mais grave dos usuários do Acessórias (robô que erra a competência e envia errado). Ver B5.
- **Resolve:** `baixa-automatica-pela-pasta` (lacuna). Tamanho grande; robô sim (regra 7); regra do banco sim (a ficha E15 do plano 05 grava em `fiscalArquivos`, regra 3). Sugestão: manter revisão para guia com aviso e liberar só a que o leitor entendeu por inteiro (**a confirmar** com o dono).

### A17. Indicadores de pontualidade por pessoa e departamento

- **Acessórias:** painel clássico (prazo técnico vencido, atraso legal, atraso com multa), performance por analista e departamento, planejamento semanal em PDF.
- **NADS (conferido):** há partes: prazos do DP com Atrasado (`usePainelDoDp.ts`), Visão do Contábil (tempo por etapa e objeções, `packages/core/src/tarefas/regras/visao.ts`), resumo semanal (`robo/resumo-semanal.js`), avisos de atrasadas (`robo/avisos-atrasados.js`, que lê o sistema antigo `tarefas.html`). Falta "no prazo x depois do prazo" por pessoa, porque as etapas não têm prazo (A12).
- **Resolve:** `indicadores-de-pontualidade` (lacuna); depende de `lista-de-entregas-com-prazos`.

### A18. E-mails ao cliente agrupados entre departamentos e remetente editável

- **Acessórias:** o envio agendado junta num e-mail só os documentos **de um mesmo departamento**; o "Grupo de Envio de Obrigações" junta arquivos de departamentos diferentes, e só dispara depois de todos os documentos do grupo processados (artigo 595955); modelos com variáveis; remetente personalizável.
- **NADS (conferido):** o editor de modelos **já existe** (`config/envioDp` com `MODELO_PADRAO_DO_ENVIO` em `apps/web/src/aplicativos/tarefas/dados/enviosDp.ts` e a janela em `apps/web/src/aplicativos/tarefas/telas/dp/useEnviosDoDp.ts`; `config/envioFiscal` com `MODELO_PADRAO_DAS_GUIAS`, definido em `apps/web/src/aplicativos/tarefas/dados/loteFiscal.ts` (linha 73) e usado em `apps/web/src/aplicativos/tarefas/telas/fiscal/relatorio/useEnvioDeGuias.ts`). Faltam o agrupamento entre DP e Fiscal num e-mail só e o remetente editável.
- **Resolve:** `emails-agrupados-e-modelos` (lacuna), importância baixa.

### A19. Política de privacidade com aceite

- **Acessórias:** aceite obrigatório no primeiro acesso e a cada nova versão, com registro.
- **NADS (conferido):** não há nada de privacidade, consentimento ou aceite em `apps/web/src/aplicativos/cliente`, `apps/web/src/aplicativos/mandei` nem `packages/core/src/areaCliente` (busca sem resultado).
- **Resolve:** `aceite-lgpd` (lacuna). Pequeno, regra do banco **sim** (regra 3). Texto da política: **a confirmar** com o dono (não copiar o do Acessórias, regra 12).

### A20. Ficha cadastral e contatos de cada setor na Área

- **Acessórias:** Home com links do escritório (WhatsApp, redes), por empresa ou para todas.
- **NADS (conferido):** as telas existem (`apps/web/src/aplicativos/cliente/telas/Administrativo.tsx` e `useAdministrativo.ts`, na mesma pasta; não confundir com `tarefas/telas/administrativo/`), os tipos `FichaDaEmpresa` e `setores` estão em `apps/web/src/aplicativos/cliente/dados/areaCliente.ts`, mas `espelho.ts` não preenche `ficha` nem `atendimento.setores`; só sai o contato geral pela constante `ESCRITORIO` do robô.
- **Resolve:** `ficha-e-contatos-por-setor` (lacuna), que contém `dados-cadastrais` (candidata; ver B13 para a vantagem do aviso da Receita).

### A21. Avaliação do atendimento (nota e NPS)

- **Acessórias:** nota por solicitação finalizada e "avalie nossa empresa".
- **NADS (conferido):** não existe (nenhuma ocorrência de NPS ou avaliação no core nem nos apps).
- **Resolve:** `avaliacao-do-atendimento` (lacuna), baixa. Uma pergunta só, ao concluir, sem painel de métricas na Área (regra 10; ver D).

### A22. Tipos de solicitação criados pela tela

- **Acessórias:** formulários por departamento com campos próprios, obrigatórios, dica e anexo obrigatório; exporta em CSV.
- **NADS (conferido):** fixos em código: `TipoDeChamado` e `TIPOS_DE_CHAMADO` em `packages/core/src/areaCliente/chamados.ts` (`admissao`, `ferias`, `demissao`, `duvida`, `documento`, `outro`); `MODELOS_DE_TICKET` fixo em `packages/core/src/mandei/modelos.ts`.
- **Resolve:** `tipos-de-pedido-configuraveis` (lacuna), baixa, grande, regra do banco **sim** (regra 3).

### A23. Lucratividade por cliente

- **Acessórias:** método APLA (custo por minuto, tempo previsto por obrigação, honorário, ocupação e lucro por cliente).
- **NADS (conferido):** honorários por cliente existem (`apps/web/src/aplicativos/tarefas/dados/honorarios.ts`, `packages/core/src/tarefas/regras/honorarios.ts`) e o Delegador tem cronômetro pelo expediente (`delegadas.ts`, `minutosTrabalhados`), mas rotinas e obrigações não têm tempo previsto nem gasto.
- **Resolve:** `lucratividade-por-cliente` (lacuna), baixa, grande. Toca o Financeiro: **não cortar leituras do banco** (regra 6). O NADS já guarda eventos com pessoa e hora em cada etapa (B1), o que dá base melhor que a estimativa do APLA.

---

## (B) Onde o NADS é melhor que o Acessórias

O Acessórias **não apura, não escritura e não lê extrato**: depende de outro sistema para gerar a guia, e o robô dele só lê PDFs de modelos homologados pela equipe deles. O NADS faz o trabalho contábil e fiscal dentro do sistema. Nesses pontos não há item de plano para "alcançar" o Acessórias; o que existe são itens que **levam essa vantagem ao cliente** (citados em cada ponto).

### B1. Rotina guiada com a ferramenta dentro da etapa

- **NADS:** cada departamento tem uma rotina de etapas (`packages/core/src/tarefas/rotinas/contabil.ts`, `fiscal.ts`, `dp.ts`, `lcdpr.ts`) executada em tela cheia (`apps/web/src/aplicativos/tarefas/telas/executor/Executor.tsx`, `useExecutor.ts`). A etapa tem a própria ferramenta (importação, conferências, painéis), objeções com solução sugerida, "Não se aplica", check laranja com o que faltava, trabalho em lote de até 24 meses e reabertura registrada. Tudo vira evento com pessoa e hora (`packages/core/src/tarefas/regras/execucao.ts`). Etapas entram e saem sozinhas pelo regime, mês, obrigação do DP, Cadastro e balancete.
- **Acessórias:** a demanda é "pendente" até a baixa (pelo robô ou pela "entrega rápida"); não sabe se o trabalho foi bem feito.
- **Por que é melhor:** controla a **qualidade** do trabalho, não só a data.
- **Impacto no escritório:** erro objetivo trava o avanço (saldo do lado errado, mês que não zerou). **No cliente:** balanço e guia mais confiáveis.
- **Item do plano:** nenhum para alcançar. O que falta à rotina é prazo (`lista-de-entregas-com-prazos`, A12). Limite conhecido: o check automático está desligado (`CONFERIR_NO_PROXIMO = false`, `useExecutor.ts`, linha 31).

### B2. Leitura de extratos com conferência pelo saldo e releitura geral

- **NADS:** o Extrator lê PDF (com OCR de reserva), OFX, Excel e CSV no navegador (`packages/core/src/extratudo/extrator/`), confere saldo anterior + lançamentos = saldo impresso em qualquer banco (`ConferenciaPeloSaldo`, `extrator/tipos.ts`, linha 68), concilia extrato x razão em várias passadas e sugere os lançamentos de importação do Alterdata. A Releitura dos extratos (`telas/configuracoes/releitura/`) relê tudo com o leitor atual.
- **Acessórias:** não lê extrato.
- **Impacto no escritório:** conciliação bancária quase automática. **No cliente:** nenhum direto.
- **Item do plano:** nenhum.

### B3. Fiscal apoiado nos XMLs do SIEG

- **NADS:** contagem e download de XMLs pelo robô (`robo/sieg.js`), DANFE desenhada igual à original, leitor do SINTEGRA com conferência cruzada, rateio de frete pelo CT-e, calculadora do Simples com Fator R (`packages/core/src/tarefas/sieg/calculadora.ts`, `simples.ts`), antecipação de ICMS-ES, auditoria tributária de itens, faturamento por cliente, Relatório Simples/Presumido (`controleTributos`) e situação das notas na SEFAZ (`robo/situacao-notas.js`).
- **Acessórias:** nenhuma dessas funções; integra com parceiros (Jettax) para gerar a guia.
- **Impacto no escritório:** apuração e conferência no mesmo sistema. **No cliente:** apuração revisada.
- **Itens que levam a vantagem ao cliente:** `previa-do-das` (o DAS estimado antes de a guia sair, usando `previaDoDas` e `aliquotaEfetiva` que já existem; dizer sempre que é estimativa e que vale o PGDAS-D), `xmls-do-mes` (o `.zip` dos XMLs pedido pela Área; marcado como `ferePrivacidadeOuRestricao: true` no levantamento: os XMLs contêm CPF/CNPJ dos compradores, e o espelho não pode tê-los (regra 5); o `.zip` só pode ser entregue como arquivo sob pedido, **a confirmar** com o dono), `relatorio-de-impostos` (planilha anual a partir de `controleTributos`, sem conferências nem observações). O Acessórias não tem nenhum dos três.

### B4. Robôs que buscam e emitem, não só leem

- **NADS:** FGTS Digital emitido como procurador (`robo/fgts-digital.js` na nuvem, e o lote no servidor), NFS-e própria dos honorários com DANFSe por e-mail (`robo/nfse.js`), Alterdata Contábil e Fiscal operados pela tela (balancete, razão, relatórios, importação de lançamentos), cartas do Fiscal assinadas com o certificado (`robo/cartas-fiscal.js`, travado com `LIBERADO_PARA_CLIENTES = false`), leitura do Gmail que marca extrato e comprovante recebidos em `documentosMensal` e marca parcela paga (`robo/parcela-paga.js`), vigia de CNPJ semanal (`robo/vigia-cnpj.js`).
- **Acessórias:** "não gera nem busca guia" (sem e-CAC, Receita, SEFAZ ou prefeitura); a baixa depende do PDF que outro sistema gerou.
- **Impacto no escritório:** menos digitação e menos portal. **No cliente:** guia e nota mais rápidas.
- **Itens que levam a vantagem ao cliente:** `parcelamentos` (a coleção `parcelamentos` já tem as pagas marcadas pelo robô), `certidoes` (as validades em `clientes.papeis`; o NADS não emite certidão: emitir seria robô novo, e alguns portais têm captcha, que o robô nunca resolve).
- **Limite:** dependência de máquinas (VM `robo-nilma`, servidor, PC); o robô do PC parou de se atualizar em 12/11/2026 (regra 7).

### B5. Arquivador próprio, sem homologação de modelo por terceiro

- **NADS:** `robo/arquivador-continuo.js` lê PDF, XML, OFX, SPED, planilha e compactados (OCR local), decide cliente, tipo, competência, pasta e nome por regras determinísticas e move sem sobrescrever (quarentena e desfazer). Os leitores de guia (`packages/core/src/areaCliente/leitorDeGuia.ts`, `packages/core/src/entregas/guiasDoPdf.ts`) são do próprio escritório.
- **Acessórias:** o e-Contínuo lê por posição no layout; modelo novo exige ticket de homologação com a equipe deles; só PDF texto (OCR é outro app, o "eContínuo OCR"; de XML só os padrões Nota_Transporte e e-Social, artigo 594593), limite de 10 MB **(a confirmar: o artigo dos tipos de arquivo não cita limite)**, app Windows por máquina, problemas com antivírus; "entrega processada" não garante que o e-mail saiu.
- **Por que é melhor:** o escritório corrige o leitor no mesmo dia; a revisão no lote evita envio com competência errada (queixa principal dos usuários do Acessórias).
- **Item do plano:** o que falta (baixa e envio sem clique) é `baixa-automatica-pela-pasta` (A16).

### B6. Entrega física completa (office boy)

- **NADS:** rota ordenada com previsão, leitura da guia pela câmera, assinatura na tela ou no celular do cliente por QR de uso único, foto, localização comparada com o endereço, PIX do honorário, cliente ausente com motivo e foto, protocolos para imprimir, painel do mês com ranking e mapa (`apps/web/src/aplicativos/tarefas/telas/entregas/`, `packages/core/src/entregas/rotaDeEntregas.ts`, `confirmacaoDaEntrega.ts`), 13º do DP direto para a rota.
- **Acessórias:** só entrega digital (protocolo de leitura).
- **Impacto no escritório:** prova de entrega física com assinatura e foto. **No cliente:** recebe em mãos quem prefere papel.
- **Item que leva a vantagem ao cliente:** `confirmar-entrega` (o portal antigo já tinha "Confirmar que recebi", tratado por `robo/entrega-pelo-link.js`; falta espelhar `entregas/` na Área nova).

### B7. Cofre de senhas e certificados com criptografia ponta a ponta

- **NADS:** segredos cifrados no navegador (AES-GCM, `packages/core/src/cofre/cripto.ts`), par RSA por pessoa, liberação de navegador por Diretor, código de recuperação; importação em massa de `.pfx` associados pelo CNPJ do certificado; painel de vencimentos.
- **Acessórias:** o AC Certifica é só agenda de vencimento com link de renovação; não guarda nem usa o certificado.
- **Item do plano:** nenhum para alcançar; o aviso ao cliente é `certificado-do-cliente` / `certificado-digital` (A9), lendo só a validade às claras de `cofre/{empresa}`.

### B8. Delegação fina e tarefas com expediente

- **NADS:** delegar contas específicas de uma etapa, tarefa em conjunto, bloqueio do resto da empresa para quem recebeu; Delegador com cronômetro que respeita o expediente e os feriados de Taiobeiras, cobrança de atualização, pedido e envio de documentos com "visualizado" e confirmação de recebimento (`packages/core/src/tarefas/regras/delegadas.ts`).
- **Acessórias:** troca de responsável em massa, tarefas agendadas, chat interno; não tem delegação de parte de uma demanda.
- **Item do plano:** nenhum. O que falta ao Delegador é repetir (`tarefas-recorrentes-anuais`, A14).

### B9. Área do Cliente com dados que o Acessórias não mostra

- **NADS (conferido no espelho):** faturamento dos últimos 12 meses e painel de notas do mês pelo SIEG, DANFE sob pedido (`pedirDanfe`, `areaCliente.firestore.ts`, linha 228), RH com funcionários pelas guias do FGTS (CPF mascarado), holerites e previsão de férias, calendário do DP. Espelho por lista branca de campos, gravado só pelo robô (`robo/area-cliente.js`).
- **Acessórias:** calendário e GED de documentos; não mostra faturamento nem notas, porque não lê XML.
- **Impacto no cliente:** responde "quanto faturei?" e "quando são as férias de fulano?" sem ligar.
- **Itens que ampliam a vantagem:** `informe-e-folha-antiga` (abrir a janela de `MESES_DO_DP = 3` e incluir o informe de rendimentos; manter CPF mascarado e sem motivo de afastamento, regra 5), `relatorio-de-impostos`, `xmls-do-mes` (B3).

### B10. Envio do cliente sem login e caixa validada

- **NADS:** o cliente manda arquivos pela Área sem senha (caixa `areaClienteEnvios`, até 50 por dia, validados pelos primeiros bytes e guardados na pasta "ÁREA DO CLIENTE" do Drive, com recibo); o Mandei pede documentos por link, sem login, com 1º e 2º link e revisão.
- **Acessórias:** o AC Docs exige login do cliente (usuário e senha) para enviar documentos (artigo 598607); a cobrança chega por e-mail e no app; se a régua de lembretes do AC Docs usa outros canais **(a confirmar)**.
- **Limite:** o Mandei está com a trava de teste (regra 8).
- **Item do plano:** o que falta é mostrar o pedido ao cliente (`pedidos-do-escritorio-na-area`, A6).

### B11. Sem custo por CNPJ e sem reajuste de terceiro

- **NADS:** roda em faixas gratuitas (VM e2-micro, Firestore, Hosting) mais serviços contratados à parte (SIEG, Alterdata, assinatura do Claude); preços exatos **a confirmar** (não estão no repositório).
- **Acessórias:** cobrança por pacote de CNPJs, armazenamento excedente cobrado; a queixa número 1 no Reclame Aqui em 2026 é o reajuste unilateral de 20% a 33%; bloqueio por atraso derruba inclusive os links já enviados aos clientes do escritório.
- **Impacto no escritório:** o sistema é do escritório; o cliente não perde o acesso por causa de contrato com fornecedor.
- **Item do plano:** nenhum. Limite: cota grátis do Firestore já estourou mais de uma vez (há o freio `robo/consumo.js`); não cortar leituras no Financeiro (regra 6).

### B12. Observabilidade e segurança da operação

- **NADS:** Central dos robôs (máquinas, filas, log ao vivo, ações, horários, alertas), painel do robô, freio de consumo do banco, liderança entre máquinas, backup diário (`robo/backup-diario.js`), proteção do login por computador com código, mapa de uso de telas e botões, feedback com captura e conversa, trava de conexões (`npm run conexoes`).
- **Acessórias:** logs de auditoria e permissões granulares (ver C9); 2FA só por e-mail (queixa nas avaliações).
- **Item do plano:** nenhum.

### B13. Aviso de mudança na Receita

- **NADS:** `robo/vigia-cnpj.js` consulta toda semana os dados abertos da Receita e grava `clientes.receita` (situação, Simples, MEI, atividade, sócios, endereço); mudança grave avisa o admin.
- **Acessórias:** não encontrado nas fontes.
- **Item que leva a vantagem ao cliente:** `dados-cadastrais` (a aba Dados cadastrais com "Copiar todos os dados" e o aviso de saída do Simples ou inaptidão; dizer que os dados abertos atrasam semanas ou deixar o escritório liberar antes de mostrar).

### B14. Boletos e NFS-e dos honorários

- **NADS:** boletos de honorários lidos e enviados em lote pelo robô (`robo/boletos-financeiro.js`, liberado para clientes desde 10/11/2026), NFS-e emitida pelo próprio robô.
- **Acessórias:** não emite NFS-e dos honorários.
- **Item que leva a vantagem ao cliente:** `honorarios` (o boleto como mais uma guia e a NFS-e na Central). É dado do Financeiro: **decidir antes com o Vitor/Diretor** e não cortar leituras (regra 6).

---

## (C) Onde empatam ou fazem diferente sem um ser melhor

| # | Ponto | Acessórias | NADS (conferido) | Leitura | Item |
|---|---|---|---|---|---|
| C1 | Calendário de vencimentos do cliente | Calendário por dia/mês com as demandas | Agenda na Área (`packages/core/src/areaCliente/vencimentos.ts`) com ~15 etapas do Fiscal e do DP; várias linhas marcadas "PRECISA CONFERIR" | Equivalentes; no NADS as datas precisam ser conferidas pelo Fiscal e pelo DP antes de ir ao ar | Nenhum id; conferência das linhas "PRECISA CONFERIR" é pré-requisito de `lembrete-de-vencimento` |
| C2 | Solicitações do cliente | Conversa por comentários e anexos, busca, `.zip` dos anexos | Chamados com situação (aberto, em andamento, respondido, concluído), pedido/resposta sem chat (`chamados.ts`, `Chamados.tsx`) | Diferente por decisão do dono (regra 4) | `aviso-de-resposta` (A7), `tipos-de-pedido-configuraveis` (A22) |
| C3 | Envio de documentos pelo cliente | Pelo app ou Área VIP, com login | Pela Área sem login (`areaClienteEnvios`) e pelo Mandei | Empate funcional; ver B10 | — |
| C4 | Várias empresas para a mesma pessoa | Um login com várias empresas e a empresa ativa em todas as telas | Vários links guardados no navegador (`cliente/dados/perfis.ts`) | Diferente: o NADS não precisa de senha, o Acessórias funciona em qualquer aparelho | `contatos-e-permissoes` (A10) |
| C5 | Modelos de e-mail | Modelos com variáveis por departamento | Modelos editáveis no DP (`config/envioDp`) e no Fiscal (`config/envioFiscal`) | Empate; falta só o agrupamento | `emails-agrupados-e-modelos` (A18) |
| C6 | Responsável por empresa | Por departamento, troca em massa com log | Fiscal e Contábil no cadastro; troca de dois lados com aceite (`telas/cadastro/responsaveis/`) | Diferente: o NADS exige aceite, o Acessórias faz em massa; o DP do NADS não tem responsável por empresa | — |
| C7 | Justificar e dispensar | Justificativa em texto livre (200 caracteres) e dispensa com permissão própria | Interromper com objeções, "Não se aplica" com motivo, check laranja | Equivalentes; o NADS tem motivos pré-definidos com solução sugerida | — |
| C8 | WhatsApp por QR code | AC Notifica (não oficial, um número, celular ligado, sem resposta) | Baileys num chip novo, só envio, só no ramo `claude/whatsapp-qr*` | Mesmo modelo e mesmo risco de bloqueio | `guias-pelo-whatsapp` (A4) |
| C9 | Permissões | Granulares por nível, filtros forçados, janela de horário | Papéis por departamento e nível numa tabela única (`packages/core/src/usuarios/regras/acesso.ts`) e liberação por computador | Diferentes; os dois atendem | — |
| C10 | Integração externa | API REST pública e servidor MCP | Sem API pública; atendente de IA interno (Claude no PC ou Gemini na nuvem) que consulta o banco só para leitura | Diferente: o NADS é sistema próprio e não precisa de API para terceiros | — |
| C11 | Mural interno da equipe | Chat interno (Komunic) | Mural `nadsAvisos` com "Recebido", reuniões com aprovação | Diferente; o NADS registra quem leu | — |
| C12 | Envio agendado | Imediato, agendado por departamento, pré-agendado | Disparo manual no lote; checklist mensal automático no último dia útil (`robo/cartas-fiscal.js`, travado) | Diferente; o agendamento faz sentido só depois de `baixa-automatica-pela-pasta` | `baixa-automatica-pela-pasta` (A16) |

---

## (D) O que o Acessórias tem e o NADS não deve copiar

### D1. Chat na Área do Cliente (comentários em conversa nas solicitações)

- **Acessórias:** solicitações com conversa por comentários, contador de interações não lidas e e-mails periódicos "você tem interações não vistas".
- **Por que não copiar:** regra do dono (regra 4): a conversa é pelo WhatsApp; na Área, pedido é solicitação com situação. Chat obrigaria a equipe a vigiar mais um canal.
- **O que fazer no lugar:** aviso de ida quando a situação muda (`aviso-de-resposta`, A7).

### D2. Atendimento de WhatsApp multiatendente dentro do sistema (Komunic)

- **Acessórias:** número único atendido pela equipe, chatbot de triagem, respostas rápidas, grupos com o cliente, abrir solicitação de dentro da conversa.
- **Por que não copiar:** é chat, só que noutro lugar (regra 4); o robô do NADS por QR code é só de envio e não lê mensagens recebidas, e ler exigiria guardar conversa de cliente no banco. As avaliações do Komunic citam instabilidade, número banido e documento enviado ao contato errado.
- **Item:** `whatsapp-integrado` (lacuna, importância baixa). **Recomendação: não fazer** a parte de atendimento; o máximo aceitável é o envio só de ida (`guias-pelo-whatsapp`, A4). Se o dono quiser algo, **a confirmar** com ele.

### D3. App próprio nas lojas (Android e iOS) com a marca do escritório

- **Acessórias:** app white-label publicado nas lojas.
- **Por que não copiar:** exige contas de desenvolvedor do escritório (US$ 25 no Google, D-U-N-S, site verificado e e-mail no domínio próprio, artigo 598902; US$ 99 por ano na Apple **(a confirmar: o artigo do Acessórias não cita o valor)**) e até 30 dias úteis de homologação; nas lojas, a maioria desses apps tem poucos downloads e notas entre 3,4 e 3,9. O link da Área já abre no celular sem instalar nada.
- **Item:** nenhum.

### D4. Envio em massa de links pelo WhatsApp não oficial

- **Acessórias:** AC Notifica dispara em lote.
- **Por que não copiar:** é o que gerou banimentos de número nas avaliações. O NADS deve manter os limites do ramo `claude/whatsapp-qr` (um por vez, 20 a 60 s, 30 por hora, 150 por dia) e só o telefone do cadastro.
- **Item:** é um cuidado dentro de `guias-pelo-whatsapp` (A4).

### D5. Painéis cheios na Área do Cliente (métricas de atendimento, calendário com tudo, notícias)

- **Acessórias:** a Área VIP mostra métricas dos atendimentos, comunicados de notícias e "oportunidades", e o calendário pode listar todas as demandas do mês.
- **Por que não copiar:** o dono ouviu de um cliente que a Área "tinha muita informação" (regra 10). Cada coisa nova entra só se resolve uma tarefa concreta, de preferência no cartão "Precisa de você" que já existe.
- **Item:** é um limite para `comunicados` (A8) e `avaliacao-do-atendimento` (A21).

### D6. Cortar o acesso do cliente por inadimplência do escritório com o fornecedor

- **Acessórias:** o bloqueio por atraso de pagamento do escritório derruba os links já enviados aos clientes dele (queixa nas avaliações).
- **Por que não copiar:** não se aplica a sistema próprio; registrado para nunca amarrar a Área a uma cobrança.
- **Item:** nenhum.

### D7. Dar baixa e enviar sem nenhuma conferência

- **Acessórias:** o robô dá baixa e envia sozinho; "entrega processada" não garante que o e-mail saiu; erros de competência são a queixa mais grave do robô.
- **Por que não copiar por inteiro:** o NADS deve automatizar (`baixa-automatica-pela-pasta`, A16), mas manter a revisão humana para o que o leitor não entendeu por inteiro e registrar se o e-mail saiu de fato.

### D8. Registro de IP do cliente e textos, marca e telas do Acessórias

- **Acessórias:** o protocolo grava data, hora e **IP**; as telas têm nomes próprios (Lista de Entregas, Área VIP, AC Docs, Protocolo Digital, envelope azul/vermelho).
- **Por que não copiar:** o IP não é necessário para provar a abertura (data e hora bastam) e é dado pessoal a mais. Nomes, textos e telas não podem ser copiados (regra 12).
- **Item:** cuidado dentro de `comprovante-de-leitura` (A2) e de todos os itens.

### D9. Senha padrão por contato com troca no primeiro acesso

- **Acessórias:** login por e-mail e senha padrão para cada contato.
- **Por que não copiar sem decidir antes:** o link sem senha é o que mantém a Área simples; senha por contato só se `contatos-e-permissoes` (A10) for aprovado pelo dono, e o modelo nunca deve criar senha ou conta pelo cliente.

---

## Tabela-resumo por módulo

Legenda: **AC** = Acessórias melhor; **NADS** = NADS melhor; **=** = empate ou diferente; **Não** = não copiar. Os ids do lado do cliente são os do plano 04; nas linhas do escritório, a ficha do plano 05 vem entre parênteses. As colunas "Regra do banco" e "Robô" seguem o que os planos conferiram no código (17/11/2026), não só o levantamento.

| Módulo | Ponto | Quem é melhor | Ids do plano | Regra do banco | Robô |
|---|---|---|---|---|---|
| Área do Cliente › Guias | Todas as guias e a marca de paga | AC | `guias-completas-na-area`, `todas-as-guias`, `guia-paga-confirmada`, `comprovante-da-guia` | Depende (ver A1) | Sim |
| Área do Cliente › Guias | Registro de abertura da guia | AC | `comprovante-de-leitura` | Só para a equipe ler no Tarefas (04, 2A.6) | Sim |
| Área do Cliente › Guias | Lembrete de vencimento | AC | `lembrete-de-vencimento`, `aviso-antes-de-vencer` | Não (usa o `comprovante-de-leitura`; 04, 2B.3) | Sim (nuvem) |
| Área do Cliente › Guias | Guias pelo WhatsApp (só envio) | AC | `guias-pelo-whatsapp` | Não | Sim (nuvem) |
| Área do Cliente › Guias | Prévia do DAS | NADS | `previa-do-das` | Não | Sim |
| Área do Cliente › Guias | Parcelamentos | NADS | `parcelamentos` | Não | Sim |
| Área do Cliente › Guias | Boleto e NFS-e dos honorários | NADS | `honorarios` | Não | Sim |
| Área do Cliente › Documentos | Acervo do escritório | AC | `documentos-do-escritorio-no-acervo`, `documentos-do-escritorio` | Não | Sim |
| Área do Cliente › Documentos | Certidões | NADS (validades já existem) | `certidoes` | Não | Sim |
| Área do Cliente › Visão geral | O que o escritório pede | AC | `pedidos-do-escritorio-na-area`, `o-que-falta-mandar`, `pedidos-do-mandei` | Depende (ver A6) | Sim |
| Área do Cliente › Visão geral | Certificado digital | AC | `certificado-do-cliente`, `certificado-digital` | Não | Sim |
| Área do Cliente › Visão geral | Entrega física confirmada | NADS | `confirmar-entrega` | Não | Sim |
| Área do Cliente › Solicitações | Aviso de resposta | AC | `aviso-de-resposta` | Não | Sim |
| Área do Cliente › Solicitações | Tipos configuráveis | AC | `tipos-de-pedido-configuraveis` | Sim | Sim |
| Área do Cliente › Solicitações | Avaliação do atendimento | AC | `avaliacao-do-atendimento` | Não | Sim |
| Área do Cliente › Solicitações | Chat | Não | — (regra 4) | — | — |
| Área do Cliente › Comunicados | Mural para clientes | AC | `comunicados` | Sim | Sim |
| Área do Cliente › Processos | Processos visíveis | AC | `processos-visiveis` | Talvez (`chamados.passos`; 04, 2A.14) | Sim |
| Área do Cliente › Dados | Ficha, contatos e aviso da Receita | AC (ficha) / NADS (Receita) | `ficha-e-contatos-por-setor`, `dados-cadastrais` | Não | Sim |
| Área do Cliente › Faturamento | XMLs do mês e impostos do ano | NADS | `xmls-do-mes`, `relatorio-de-impostos` | Não | Sim |
| Área do Cliente › RH | Informe e folhas antigas | NADS | `informe-e-folha-antiga` | Não | Sim |
| Área do Cliente › Acesso | Login por pessoa | AC (custo alto) | `contatos-e-permissoes` | Sim | Sim |
| Área do Cliente › Acesso | Aceite da política de privacidade | AC | `aceite-lgpd` | Sim (ou o caminho pelo robô; 04, 3.2) | Só no caminho sem regra (robô do PC) |
| Área do Cliente › Acesso | App nas lojas | Não | — | — | — |
| Tarefas › Obrigações | Prazos de todos os departamentos | AC | `lista-de-entregas-com-prazos` (E04, com E01, E02, E05, E06, E07) | Não | Não (E07 usa o vigia) |
| Tarefas › Obrigações | Cadastro de obrigações pela tela | AC | `cadastro-de-obrigacoes` (E08, E10) | Sim (a confirmar em `cadastro`) | Não |
| Tarefas › Obrigações | Rotina guiada com ferramenta e eventos | NADS | — | — | — |
| Tarefas › Processos | Processos com etapas | AC | `gestao-de-processos` (E19) | Sim | Não |
| Tarefas › Delegador | Lembretes recorrentes por empresa | AC | `tarefas-recorrentes-anuais` (E18, M03) | Sim (`nadsRecorrentes`) | Sim |
| Tarefas › Delegador | Delegação fina e expediente | NADS | — | — | — |
| Tarefas › Gestão | Pontualidade por pessoa | AC | `indicadores-de-pontualidade` (E11, E12, E13, M01) | Não | Não (M01 usa o vigia) |
| Tarefas › Gestão | Lucratividade por cliente | AC | `lucratividade-por-cliente` (E23) | Talvez (`config`) | Não |
| Fiscal / DP › Envio | Baixa automática pela pasta | AC (com cuidado, D7) | `baixa-automatica-pela-pasta` (E15, E16, E14) | Sim (`fiscalArquivos`) | Sim |
| Fiscal / DP › Envio | E-mails agrupados e remetente | AC | `emails-agrupados-e-modelos` (E17, só dentro do setor) | A confirmar | Sim |
| Fiscal | SIEG, DANFE, SINTEGRA, Simples, antecipação, auditoria | NADS | — | — | — |
| Contábil | Extrator, conferência pelo saldo, conciliações, LCDPR | NADS | — | — | — |
| Robôs | FGTS Digital, Alterdata, NFS-e, SEFAZ, arquivador | NADS | — | — | — |
| Entregas | Rota, assinatura, foto, geolocalização | NADS | — | — | — |
| Senhas | Cofre cifrado de senhas e certificados | NADS | — | — | — |
| WhatsApp | Atendimento multiatendente (Komunic) | Não | `whatsapp-integrado` (E24, só a decisão; não fazer a parte de atendimento) | — | — |
| Custo e controle | Sistema próprio x pacote por CNPJ | NADS | — | — | — |
