# Início do nads: escolher o aplicativo, depois a empresa

Pedido do Vitor (2026-09-28): com mais de um aplicativo, o nads abre numa **tela para escolher o
aplicativo**. Depois de escolher, a pessoa **escolhe a empresa**.

## Fluxo e rotas

| Tela | Rota | O que tem |
|---|---|---|
| Aplicativos | `/` | logo, título, um cartão por aplicativo (ícone, nome, uma linha do que faz) |
| Empresa | `/<app>` | a mesma busca "nome ou código do ERP" da entrada da Conferência, com o nome do aplicativo no título |
| Aplicativo aberto | `/<app>/<código>/<seção>/<página>` | casca do nads (barra lateral + abas) com a empresa no cabeçalho |

Os `<app>` são `conferencia`, `cheque-especial` e `conciliadorzinho`. Com a tela de aplicativos na
raiz, a Conferência sai da raiz: `/292/movimento/relatorio` passa a ser
`/conferencia/292/movimento/relatorio`. **Os links antigos continuam funcionando**: `/<código>/…`
redireciona para `/conferencia/<código>/…`.

## Onde fica no código

```
apps/web/src/
  inicio/                       a tela de aplicativos (do nads, não de um aplicativo)
    aplicativos.ts              a lista: id, nome, ícone, descrição, rota
    useInicio.ts · Inicio.tsx
packages/ui/                    <EscolherEmpresa> sai da Entrada da Conferência e vira componente de todos
packages/core/src/empresas/     a lista de empresas do escritório (CLIENTES: código, nome, regime),
                                que hoje está dentro da Conferência e passa a ser de todos
```

Cada aplicativo continua dono da própria tela de empresa (`telas/entrada/`), mas todas usam o mesmo
`<EscolherEmpresa>`. A Conferência junta a essa lista as empresas que existem no banco dela (como
hoje); os outros dois usam só a lista do escritório.

## Decisões pendentes (do Vitor)

1. **Rotas com o nome do aplicativo na frente** (`/conferencia/292/…`), com os links antigos
   redirecionando. Recomendo.
2. **O que a empresa faz no Cheque especial e no Conciliadorzinho.** Os originais não têm empresa nem
   guardam nada: as contas são digitadas toda vez. Opções:
   - a) só mostrar e nomear: a empresa aparece no cabeçalho e no nome dos arquivos baixados, e nada é
     guardado (igual ao original; recomendo para a primeira versão);
   - b) lembrar as contas de cada empresa (conta banco/cheque especial/histórico; contas de vendas,
     taxas, caixa e das bandeiras). Isso é regra da empresa, então fica no banco, e só ligo quando você
     pedir.
