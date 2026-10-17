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
