# Área do Cliente — o contrato dos dados (16/10/2026)

Decisões do Vitor: link secreto por empresa (token NOVO, separado do portal do Entregas), sem senha; guias aparecem
sozinhas, menos as com aviso (esperam "Liberar"); link gerado/trocado/revogado por admin e diretores; endereço
cliente.nilmacontabilidade.com; o cliente NUNCA lê coleções internas — só o espelho por token, que o robô grava com lista
branca de campos (packages/core/src/areaCliente). Banco: Firestore do projeto entregas-2e5e2.

## O link (o escritório grava — admin e diretores)
- `areasCliente/{token}` — token = 40 hex aleatórios. `{ codigos: number[], nome: string, criadoEm, criadoPor, atualizadoEm }`.
  Revogar = apagar este doc (a leitura do espelho exige que ele exista). Trocar = criar outro e apagar o antigo.
- `areasClientePorEmpresa/{codigo}` — `{ token, atualizadoEm }` (para o nads achar o link da empresa). Só a equipe lê.

## O espelho (só o robô grava; o cliente lê com get/list se `areasCliente/{token}` existir)
- `areasCliente/{token}/resumo/atual` — ResumoDoCliente (empresas, contato do escritório, atualizadoEm)
- `areasCliente/{token}/guias/{id}` — GuiaDoCliente (+ `guias/{id}/pdf/{n}` = `{ base64, n, total }`, pedaços de até 700 KB)
- `areasCliente/{token}/agenda/{AAAA-MM}` — `{ itens: ItemDaAgenda[], atualizadoEm }` (mês do VENCIMENTO)
- `areasCliente/{token}/envios/{id}` — ReciboDeEnvio
- `areasCliente/{token}/chamados/{id}` — ChamadoDoCliente (autor do escritório = "Escritório")
- `areasCliente/{token}/documentos/{id}` — documentos do escritório para o cliente (futuro)

## As caixas de entrada (o cliente só CRIA; o robô valida, processa e apaga)
- `areaClienteChamados/{auto}` — `{ token, chamadoId?: string, tipo: 'admissao'|'ferias'|'demissao'|'duvida'|'documento'|'outro', titulo?: string (≤120), texto: string (≤4000), criadoEm }`
- `areaClienteEnvios/{auto}` — `{ token, nome (≤200), tipo: 'extrato'|'nota'|'comprovante'|'outro', mime, tamanho, base64 (≤700 KB), criadoEm }`

## O interno (a equipe do nads)
- `chamados/{id}` — `{ token, codigos, empresa, tipo, titulo, situacao: 'aberto'|'em andamento'|'respondido'|'concluido', mensagens: [{ de: 'cliente'|'escritorio', autor, texto, em }], criadoEm, atualizadoEm }` — a equipe lê e grava (responder, mudar a situação); o robô cria a partir da caixa de entrada e copia para o espelho.
- `areaClienteRecebidos/{id}` — `{ token, codigo, empresa, nome, tipo, tamanho, pastaDrive, recebidoEm }` — a equipe lê; só o robô grava (o arquivo vai para o Drive do cliente).
- Guias com aviso: `pedidosFgts/{id}.liberadoCliente = true` (o escritório libera) — para DAS/DAE ver `enviosSecretario` com `guia`, `vencimento`, `valor`.

## A logo da empresa (12/11/2026)

O gestor (admin ou diretor) manda a logo no bloco "Link do cliente" da janela da empresa, no Cadastro. O nads diminui a
imagem (até 256 px no lado maior, WebP ou PNG, até 150 mil caracteres em data URL: `areaCliente.erroDaLogo` no core) e grava:

    logosDasEmpresas/{codigo}   { logo: 'data:image/webp;base64,…', atualizadoEm, por }

O robô da Área do Cliente ouve essa coleção, confere de novo (`erroDaLogo`: só PNG, JPG ou WebP; SVG nunca) e grava no
espelho de cada link da empresa `areasCliente/{token}/resumo/marca { logo, atualizadoEm }` (o cliente já lê `resumo/*`).
Sem logo, a marca sai e o topo volta ao ícone do prédio.

**Regra nova que falta publicar no banco do Entregas (o Vitor publica):**

    match /logosDasEmpresas/{codigo} {
      allow read: if membroNoNads();
      allow create, update: if ehDiretorNads()
        && codigo.matches('^[0-9]{1,10}$')
        && request.resource.data.keys().hasOnly(['logo', 'atualizadoEm', 'por'])
        && request.resource.data.logo is string
        && request.resource.data.logo.size() <= 150000
        && request.resource.data.logo.matches('^data:image/(png|jpeg|webp);base64,.*')
        && request.resource.data.atualizadoEm is string
        && request.resource.data.por is string && request.resource.data.por.size() <= 120;
      allow delete: if ehDiretorNads();
    }

Até a regra sair, o "Enviar logo" avisa que o banco ainda não aceita.

## O painel do mês do Faturamento e o relatório do dia (12/11/2026)

O robô ouve `siegNotas` (o "Baixar XMLs do SIEG") só das empresas com link e grava, sem o CPF/CNPJ de quem comprou:

- dentro de cada mês de `resumo/faturamento`, o `notasDoMes` (a venda por dia, os 5 maiores clientes, as operações por
  CFOP, o serviço NFS-e e a maior venda: `areaCliente.notasDoMes`);
- `resumo/notas-{codigo}-{AAAA-MM}` com a lista das notas emitidas do mês (dia, modelo, número, série, nome do cliente,
  CFOP, valor, cancelada, chave; até 4.000: `areaCliente.listaDeNotasDoMes`), que o relatório do dia lê ao clicar no dia.

**A DANFE pelo relatório do dia (sem regra nova).** O cliente pede pela caixa que já usa, `areaClienteChamados`, com um
pedido de documento marcado: `{ token, tipo: 'documento', titulo: 'DANFE', texto: 'danfe:<chave>', criadoEm }`
(`areaCliente.pedidoDeDanfe`). O robô reconhece a marca (`chaveDoPedidoDeDanfe`) e, em vez de abrir um chamado, confere
que o CNPJ do emitente na chave é de uma empresa do link, pega o XML do mês no Drive (`xmlsJaNoDrive` do robô do SIEG: a
pasta arquivada do cliente e a do Claudio Secretario), desenha a DANFE (`desenharDanfe`, o mesmo desenho do nads) e grava
`documentos/danfe-<chave> { tipo: 'danfe', id, nome, chave, partes, atualizadoEm }` com os pedaços em
`danfe-<chave>~<n>` (como os do DP). Sem o XML no Drive, o documento sai com `erro` e a tela mostra o motivo. Até 200
DANFEs por link por dia. Um robô antigo, que não conhece a marca, transforma o pedido num chamado "DANFE" para a equipe.
