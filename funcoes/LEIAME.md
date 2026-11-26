# Funções do Firebase do nads

Hoje há só uma: `guiasDoSciReport`. Ela mostra na Área do Cliente as guias publicadas no SCI Report 24h.

- **Decisão:** em 24/11/2026 o dono escolheu a busca na hora e liberou a exceção na trava (`scripts/conexoes.mjs`).
- **Projeto:** entregas-2e5e2 (plano Blaze).
- **Região:** southamerica-east1.
- **Codebase:** `nads-sci-report`. Publicar este codebase não mexe nas outras funções do projeto.

## Onde está cada coisa

- **`index.js`:** só a parte do Firebase (o Admin SDK, os segredos e o HTTP).
- **`gerado/sciReport.js`:** a regra. É gerado do core (`packages/core/src/areaCliente/sciReport*.ts`) por `node scripts/funcoes-sci.mjs`. Não edite à mão: mudou o core, gere de novo e commite. O `npm run verificar` confere.
- **Tokens da SCI:** ficam no Secret Manager do projeto, nunca no repositório, no banco ou no chat.
  - `SCI_TOKEN_PARCEIRO`: o Token de Parceiro, que a SCI emite depois do cadastro de integrador.
  - `SCI_TOKEN_CLIENTE`: o Token de Cliente, gerado no SCI WEB com um usuário **da contabilidade** (Módulo Administrador), menu do nome › "Gerar token API". Ele aparece uma vez só.

## Pôr os segredos (uma vez, e quando um token for trocado)

Precisa da conta Nilma, a mesma do console. Cada comando pede o valor no terminal:

```bash
cd funcoes
npx firebase-tools functions:secrets:set SCI_TOKEN_PARCEIRO --project entregas-2e5e2
npx firebase-tools functions:secrets:set SCI_TOKEN_CLIENTE --project entregas-2e5e2
```

## Publicar (só com autorização do dono)

```bash
node scripts/funcoes-sci.mjs --conferir
cd funcoes && npm ci
npx firebase-tools deploy --only functions:nads-sci-report --project entregas-2e5e2
```

O endereço fica `https://southamerica-east1-entregas-2e5e2.cloudfunctions.net/guiasDoSciReport`. Esse é o `ENDERECO_DA_FUNCAO` do site do cliente (`apps/web/src/aplicativos/cliente/dados/sciReport.ts`).

## Testar primeiro numa empresa de teste

Publicar no SCI Report avisa o cliente. Para o teste, use um link da Área de uma empresa cujos avisos cheguem só ao escritório.

- `POST { "token": "<link>" }` devolve as guias.
- `POST { "token": "<link>", "guia": "<id>" }` devolve a URL do PDF.
