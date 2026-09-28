# nads — app único da Nilma

> **Banco:** o site publicado (**https://nads-nilma.web.app**) usa o **mesmo Firestore da
> conferencia-nilma.web.app** — mesma coleção `empresas`, mesmo formato, mesmo jeito de salvar. Os dois
> apps podem ser usados ao mesmo tempo sobre os mesmos dados. Rodando local (`npm run dev`), usa dados de
> exemplo e não toca no banco. A trava `npm run conexoes` garante que o Firebase só aparece em
> `apps/web/src/dados/*.firestore.ts` e que o `firebase.json` só publica hospedagem.

Cópia dos sistemas do escritório, reescrita em **React + Vite + TypeScript** e organizada em **MVVM**:

| Camada | Onde | O que é |
|---|---|---|
| Model | `packages/core` | regras contábeis, leitura de planilhas, repositório em memória. TypeScript puro, com testes |
| ViewModel | `apps/web/src/modulos/<modulo>/<tela>/use<Tela>.ts` | um hook por tela: estado e ações |
| View | `<Tela>.tsx` + `packages/ui` | só desenha, com o design da Conferência (CSS original, sem mudança) |

Sistemas copiados até agora:
- **Conferência Contábil** (`contabil-htmls/conferencia.html`, beta 0.1.63) — mapa em `docs/migracao/contabil-htmls/mapa.md`.

## Rodar

```bash
npm install
npm run dev          # http://localhost:5178 — dados de exemplo
npm run dev:banco    # mesmo endereço, com o banco real da Conferência (cuidado: grava de verdade)
npm run verificar    # tipos + lint das camadas + testes + conexões
npm run build        # gera apps/web/dist ligado ao banco
firebase deploy --only hosting   # publica em https://nads-nilma.web.app
```

Empresas de exemplo: **901** (comércio), **902** (serviços médicos), **903** (nova, vazia). Na entrada,
"restaurar exemplos" volta tudo ao início. Os arquivos reais do escritório (balancete, entradas,
saídas, ISS, relatório da conta) podem ser importados: a leitura acontece no navegador.

## Rotas

`/` entrada · `/<empresa>/<seção>/<página>` — ex.: `/fito-industria-e-comercio-de-alimentos-ltda/movimento/relatorio`.
