# Usuários da Nilma: modelo

Base: o documento "Sistema de Rotina Operacional" (equipe levantada em 22/09/2026) e o cadastro que o
Entregas já usa. Código em `packages/core/src/usuarios` (lógica pura, com testes; sem banco).

## A ideia

Uma pessoa tem **departamento** (Fiscal, Departamento Pessoal, Contábil) e **nível** (Diretor, Sênior,
Pleno, Júnior). Os dois **geram os papéis** que os sistemas do Entregas já conferem (`roles`). Por isso,
nada do que já existe precisa mudar: Entregas, Pendências, Tarefas, LCDPR, Conciliador e Cheque
continuam lendo `roles` como hoje.

| Cargo | Papéis gerados |
|---|---|
| qualquer conta | `staff` (o piso, "Equipe") |
| departamento Contábil | `contabil` |
| departamento Fiscal | `fiscal` |
| departamento Pessoal | `dp` |
| nível Diretor | `admin` |

Papéis que não vêm do cargo (**Office boy**, **Equipe geral**, ou um **Admin** dado a alguém que não é
diretor) são marcados à mão e **ficam** quando o cargo muda. Quando o cargo muda, saem só os papéis que
vinham do cargo antigo.

## O documento `usuarios/{uid}` (o mesmo do Entregas)

| Campo | Já existia | Observação |
|---|---|---|
| `nome`, `email`, `roles`, `criadoEm`, `fotoPerfil`, `tema`… | sim | iguais |
| `departamento` | **novo** | `fiscal` / `dp` / `contabil` |
| `nivel` | **novo** | `diretor` / `senior` / `pleno` / `junior` |
| `ativo` | lido, nunca gravado | `false` = desativado; a Tarefas e os robôs já respeitam |

Conta antiga, sem departamento/nível: continua funcionando pelos `roles`. O painel da equipe mostra
"sem cargo" e o admin completa quando quiser.

## Quem pode o quê (`regras/acesso.ts`, uma tabela só)

| Recurso | Libera |
|---|---|
| Conferência, Cheque especial, Conciliadorzinho | Contábil (e Admin) |
| Gerenciar a equipe, auditoria da equipe | Admin |
| Telas de admin do Entregas (clientes, ajustes) | Admin |
| Honorários | Office boy (e Admin) |
| Módulo Contábil do Entregas, arquivo da Pendências | Contábil (e Admin) |
| Fiscal / LCDPR | Fiscal (e Admin) |

Admin pode tudo; conta desativada não pode nada.

## Na equipe de hoje

| Pessoa | Cargo | Papéis | Entra em |
|---|---|---|---|
| Nilma | Fiscal · Diretor | admin, fiscal | tudo |
| Sávio | Departamento Pessoal · Diretor | admin, dp | tudo |
| Vitor, Fernando | Contábil · Sênior | contabil | Conferência e ferramentas |
| Felipe | Contábil · Pleno | contabil | Conferência e ferramentas |
| Clara | Contábil · Júnior | contabil | Conferência e ferramentas |
| Heverton, Adivania | Fiscal · Pleno | fiscal | Fiscal / LCDPR |

## Para ligar de verdade (próximo passo, depende do Vitor)

1. **Login no nads** com o Firebase Auth do `entregas-2e5e2` (mesmas contas e senhas do Entregas).
2. **Painel da equipe** no nads gravando `departamento`, `nivel` e `roles` em `usuarios/{uid}`.
3. **Segurança (regras do Entregas):** hoje a pessoa pode editar o próprio documento, exceto `roles`,
   `email` e `criadoEm`. Com os campos novos, alguém poderia trocar o **próprio** `departamento`/`nivel`.
   Isso não dá acesso a nada, porque o acesso vem de `roles`, que continua travado. Mas o certo é
   acrescentar `departamento`, `nivel` e `ativo` na lista travada do `firestore.rules` do Entregas. Isso
   **muda regra do banco** e só se faz com o ok do Vitor.

## Decisões em aberto (do Vitor)

- **Vitor (Sênior) precisa ser Admin** para gerenciar a equipe? Pelo modelo, só os diretores são. A
  saída é marcar Admin à mão no Vitor, que continua ao mudar de nível.
- O que **Sênior** e **Pleno** podem a mais que o **Júnior** (por exemplo, revisar ou dar por pronto um
  trabalho) fica para o módulo de rotina. O modelo já tem `nivelPeloMenos(pessoa, 'senior')`.
- **Departamento Pessoal:** hoje nenhum sistema libera nada por `dp`. Entra quando a rotina do DP for
  mapeada.
