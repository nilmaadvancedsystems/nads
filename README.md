# nads — app único da Nilma

> **Banco:** o site publicado (**https://nads-nilma.web.app**) usa o **mesmo Firestore da
> conferencia-nilma.web.app** — mesma coleção `empresas`, mesmo formato, mesmo jeito de salvar. Os dois
> apps podem ser usados ao mesmo tempo sobre os mesmos dados. Rodando local (`npm run dev`), usa dados de
> exemplo e não toca no banco. A trava `npm run conexoes` garante que o Firebase só aparece em
> `apps/web/src/aplicativos/<app>/dados/*.firestore.ts` e que o `firebase.json` só publica hospedagem.

O nads é **um app só**, com vários **aplicativos** dentro (hoje: a Conferência Contábil). Tudo em
**React + Vite + TypeScript**, organizado em **MVVM**:

| Camada | Onde | O que é |
|---|---|---|
| Model | `packages/core/src/<app>/` | regras, leitura de planilhas, repositório em memória. TypeScript puro, com testes |
| ViewModel | `apps/web/src/aplicativos/<app>/telas/<tela>/use<Tela>.ts` | um hook por tela: estado e ações |
| View | `<Tela>.tsx` + `partes/`, com `packages/ui` | só desenha, com o design do nads |

## Pastas

```
apps/web/src/
  main.tsx, rotas.tsx      o nads: visual, toast/modal e a soma das rotas dos aplicativos
  aplicativos/
    conferencia/           um aplicativo
      rotas.tsx            as rotas dele
      AppConferencia.tsx   liga os dados dele (banco ou exemplos)
      dados/               repositório: fonte.ts, repo.tsx e o único arquivo com Firebase
      casca/               barra lateral, abas, sessão e a rota da empresa aberta
      telas/<tela>/        use<Tela>.ts + <Tela>.tsx + partes/
packages/
  core/src/<app>/          Model de cada aplicativo;  core/src/formatos/  o que é de todos
  ui/                      componentes e estilo (src/estilo/nads.css), de todos os aplicativos
docs/aplicativos/<app>/    mapa da migração e inventário do código antigo
```

Aplicativo novo = uma pasta nova em `aplicativos/`, uma em `packages/core/src/` e uma em
`docs/aplicativos/`, mais uma linha em `apps/web/src/rotas.tsx`. Um aplicativo não importa nada de
outro: o que for comum vai para `packages/ui` ou `packages/core/src/formatos`.

Aplicativos até agora:
- **Conferência Contábil** (veio de `contabil-htmls/conferencia.html`, beta 0.1.63) — mapa em
  `docs/aplicativos/conferencia/mapa.md`.

## Rodar

```bash
npm install
npm run dev          # http://localhost:5178 — dados de exemplo
npm run dev:banco    # mesmo endereço, com o banco real da Conferência (cuidado: grava de verdade)
npm run verificar    # tipos + lint das camadas + testes + conexões
npm run build        # gera apps/web/dist ligado ao banco
firebase deploy --only hosting --project conferencia-nilma   # publica em https://nads-nilma.web.app
```

Empresas de exemplo: **901** (comércio), **902** (serviços médicos), **903** (nova, vazia). Na entrada,
"restaurar exemplos" volta tudo ao início. Os arquivos reais do escritório (balancete, entradas,
saídas, ISS, relatório da conta) podem ser importados: a leitura acontece no navegador.

## Rotas

Conferência: `/` entrada · `/<código da empresa>/<seção>/<página>` — ex.: `/292/movimento/relatorio`.
Empresa sem código na lista usa o nome; link antigo pelo nome redireciona para o código.
