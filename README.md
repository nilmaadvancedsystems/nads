# nads — app único da Nilma

> **Cópia sem banco.** O nads não conecta a nenhum Firebase nem a serviço de fora: roda com dados de
> exemplo em memória (e o que você fizer fica só no seu navegador). A trava `npm run sem-rede` barra
> qualquer dependência ou chamada de rede para fora.

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
npm run dev          # http://localhost:5178
npm run verificar    # tipos + lint das camadas + testes + sem-rede
npm run build        # gera apps/web/dist (site estático)
```

Empresas de exemplo: **901** (comércio), **902** (serviços médicos), **903** (nova, vazia). Na entrada,
"restaurar exemplos" volta tudo ao início. Os arquivos reais do escritório (balancete, entradas,
saídas, ISS, relatório da conta) podem ser importados: a leitura acontece no navegador.

## Como copiar o próximo sistema

Skill `arquitetura-nads` (`.claude/skills/arquitetura-nads/`): inventário do código antigo, mapa,
e as telas no **mesmo molde** da Conferência (`references/padrao-de-tela.md`).
