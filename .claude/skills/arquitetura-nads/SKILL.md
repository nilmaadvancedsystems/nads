---
name: arquitetura-nads
description: Copia um sistema da Nilma para o app único `nads` (React + Vite + TypeScript, monorepo), separando o código em camadas MVVM, e publica a cópia num link próprio SEM tocar no banco. Model = regras contábeis, dados em memória e leitura de arquivos em `packages/core`; ViewModel = um hook por tela; View = componentes que só desenham, com o design-n1 de `packages/ui`. Use SEMPRE que o usuário mandar o link (ou o caminho) de um repositório ou HTML da Nilma — Entregas, contabil-htmls, Conferência, Conciliadorzinho, Cheque especial, Leitor de Sintegra, LCDPR, Pendências, Tarefas, portal do cliente — pedindo para copiar, migrar, separar as camadas, "trazer pro nads", unificar, reescrever em React ou planejar a migração; também quando for criar tela, regra, hook ou componente novo dentro do `nads`, ou revisar se um código do `nads` respeita as camadas, mesmo que não diga "MVVM".
---

# Arquitetura nads — cópia em camadas MVVM, com o banco intocado

O `nads` (github.com/nilmaadvancedsystems/nads) é uma **cópia** dos sistemas do escritório
(Conferência, Entregas, ferramentas contábeis…), reescrita em camadas e publicada num **link próprio**.
Esta skill pega um sistema existente, descobre o que cada pedaço de código faz e o reescreve na camada
certa, **sem mudar o comportamento** que a equipe conhece.

## Regra de ouro: o banco não se toca

O usuário foi explícito: **nada de ação no banco, nada de mexer em regra, nada de duplicar dado, nenhuma
requisição.** A cópia roda com dados em memória. Motivo: faturamento e segurança do dado real.

- O nads **não tem Firebase**: nem SDK instalado, nem config, nem `firebase` CLI.
- **Não abra os apps antigos que usam banco** (Conferência, Entregas, Pendências, Tarefas, LCDPR,
  portal), nem localmente: só de carregar, eles leem coleções. Leia o **código** deles no disco.
- Nada de serviço externo (CNPJ, Maps, Gmail, Drive, IA, push) e nada dos robôs.
- Na dúvida se algo faz requisição, **não faça**: pergunte.

Como a cópia funciona assim, e como provar que ficou igual: `references/banco-intocavel.md`. Leia
antes de qualquer outra coisa.

## As camadas

```
React + Vite ....... o framework: desenha a tela
MVVM ............... a arquitetura: como o código se separa
  Model ............ packages/core   regras contábeis, repositório EM MEMÓRIA, ler/gerar arquivos (TS puro)
  ViewModel ........ use<Tela>.ts    um hook por tela: estado + ações, sem JSX e sem DOM
  View ............. <Tela>.tsx      só desenha, com os componentes do design-n1 (packages/ui)
```

**A dependência só aponta para dentro.** A View conhece o ViewModel e o `packages/ui`; o ViewModel
conhece o Model; o Model não conhece ninguém (nem React, nem a tela). É isso que deixa a regra contábil
testável sem abrir a tela e deixa trocar o visual sem medo de quebrar conta.

## Referências

- `references/banco-intocavel.md`: o que é proibido, repositório em memória, login de mentira, serviços
  falsos, paridade sem abrir o app antigo, onde publicar.
- `references/sistemas-nilma.md`: o que existe hoje (repositórios, arquivos, coleções, estilo do código).
  É descrição do original, para entender o código. Não é convite para acessar nada.
- `references/estrutura-nads.md`: pastas, pacotes, nomes, ferramentas e a checagem de "sem rede".
- `references/camadas.md`: o contrato de cada camada, com modelos de código.
- `references/receitas-de-divisao.md`: como cortar as funções legadas que misturam camadas. Os casos
  são reais.
- Para qualquer coisa visual, carregue também a skill **design-n1**. Ela é a fonte do visual e do
  comportamento das telas.

## O fluxo

### 1. Pegar o código

Entrada: o link do repositório (ou o caminho de um HTML). Os repositórios moram em
`C:\Users\Vitor\Downloads\CLAUDE_DRIVE\<repo>`.

- Pasta existe: `git pull --ff-only` (é o GitHub, não o banco). Esses repositórios recebem muitos
  commits de outras sessões.
- Não existe: `git clone` para lá.
- O `nads` fica em `CLAUDE_DRIVE\nads`. Sem esqueleto ainda? Monte primeiro
  (`estrutura-nads.md` → "Montar do zero").

### 2. Inventário: o que cada função faz

```bash
cd <esta skill>/scripts && npm i        # só na primeira vez
node inventario.mjs <arquivo.html|.js> > <nads>/docs/migracao/<repo>/<arquivo>.inventario.md
```

O script só lê o arquivo, sem rede. Ele lista cada função, com linha, tamanho, sinais (banco, arquivo,
tela, eventos…) e o estado global que lê ou muda, e sugere a camada: **Model**, **ViewModel**, **View**
ou **MISTA** (tem que ser cortada antes de copiar). Também separa o estado global, as constantes e a
infraestrutura. É um ponto de partida: leia o código das MISTAs e das regras importantes antes de decidir.

Na cópia, toda função marcada com o sinal **banco** vira método do repositório **em memória**. O
comentário no topo dele registra de onde o original lia e como gravava (coleção, campos, arquivo:linha).

### 3. Mapa: o plano, antes de escrever código

Escreva `<nads>/docs/migracao/<repo>/mapa.md`:

```markdown
# <Sistema> → nads (cópia)

## Telas
| Tela antiga (seção › página › aba) | Rota no nads | ViewModel | View |

## Model (packages/core/<dominio>)
| Função antiga (arquivo:linha) | Vira | Tipo (regra/repo em memória/arquivo/util/tabela) | Teste |

## Cortes (MISTAs)
### <nome antigo> (arquivo:linha)
- O que faz hoje, em uma frase
- Model: …  ·  ViewModel: …  ·  View: …

## Estado global → onde vai
| Variável | Vira (estado do hook / parâmetro / preferência no navegador) |

## O que na cópia fica simulado
| Original (banco ou serviço) | Na cópia (dado de exemplo / resposta fixa / aviso) |

## Comportamentos a manter (paridade)
- o que a pessoa vê e faz na tela antiga, tirado do código e da design-n1

## Perguntas ao usuário
- …
```

Mostre ao usuário um resumo (telas, regras, cortes grandes, o que fica simulado, perguntas) e
**espere o ok antes de implementar**.

### 4. Implementar em fatias verticais

Uma tela de cada vez, de dentro para fora. Uma fatia fina dá para conferir; copiar "todo o Model
primeiro" deixa semanas sem nada utilizável.

1. **Model:** tipos, regras puras, leitura de arquivo e o `repo.memoria.ts` com os exemplos. Toda regra
   ganha teste no Vitest. Regra que hoje lê estado global (`emp()`, `ccState`, `clientesCache`) passa a
   receber tudo **por parâmetro**.
2. **ViewModel:** `use<Tela>.ts` com o estado e as ações. Os dados vêm do repositório (via contexto) e
   passam pelo TanStack Query; decisões com o usuário (confirmar, avisar) via `useRetorno()` do
   `packages/ui`.
3. **View:** `<Tela>.tsx` usando só o hook e os componentes do `packages/ui`. Se um `if` decide algo
   contábil, ele volta para o Model.
4. **Rota** em `apps/web/src/rotas.tsx`, no mesmo lugar da navegação do app antigo.

### 5. Conferir

- `npm run verificar` na raiz: tipos, lint de camadas, testes **e a checagem de "sem Firebase / sem rede
  para fora"**.
- Suba o `apps/web` localmente (`npm run dev`) e confira contra a design-n1, os prints do usuário e o
  código antigo. Paridade de regra importante: teste com a função antiga e a nova lado a lado
  (`banco-intocavel.md`). Abrir o app antigo no navegador, só se ele não usar banco.
- Marque a tela como copiada no `mapa.md`.

### 6. Entregar

Commit numa branch (`copia/<repo>-<tela>`), mensagem em português dizendo o que foi copiado. Push na
`main` e publicação só com o ok do usuário, **no link que ele indicou para a cópia**. Nunca num projeto
Firebase da Nilma e nunca por cima dos endereços atuais.

## Perguntas que são do usuário

- O link onde a cópia vai ser publicada (na primeira vez; anote no README do nads).
- Dados de exemplo: se ele quer mandar planilhas/arquivos reais para servir de exemplo (anonimize antes
  de pôr no repositório).
- Tirar, juntar ou renomear telas e funções, ou corrigir algo que parece defeito mas pode ser costume da
  equipe. Na cópia, paridade primeiro.

## Erros comuns (e por que evitar)

- **"Só uma leitura pra pegar exemplo."** Não. Nenhuma. Exemplos vêm à mão ou de arquivo que o usuário
  mandar.
- **Instalar `firebase` "para deixar pronto".** Não. O repositório em memória é a implementação.
- **Abrir o app antigo para comparar.** Os que usam banco leem coleções ao carregar. Compare pelo código.
- **Traduzir linha a linha para React.** Um `render*` que calcula, desenha e grava vira um componente que
  faz as três coisas. Corte primeiro, traduza depois.
- **Regra no componente.** "Diferença menor que 0,01 é Ok" é regra do Model (`situacaoDaConta`).
- **Hook que desenha ou mexe no DOM.** O ViewModel devolve dados e ações.
- **Inventar componente ou cor.** Se o design-n1 já tem, use o dele.
- **"Melhorar" o comportamento durante a cópia.** Paridade primeiro; melhoria é outro commit, com o
  usuário sabendo.
