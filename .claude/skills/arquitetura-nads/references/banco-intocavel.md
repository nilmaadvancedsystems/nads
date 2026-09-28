# Banco intocável: o nads é uma cópia que não fala com o banco

Regra do usuário, sem exceção: o nads é uma **cópia do código existente**, publicada num link
próprio. Ele **não lê, não grava e não ouve** nenhum banco da Nilma. Nada de mexer em regra, duplicar
dado, migrar dado ou fazer requisição. O motivo é faturamento: toda leitura e gravação no Firebase conta,
e um erro de cópia (um ouvinte em laço, uma migração pela metade) pode gerar cobrança ou estragar
dado real.

## O que é proibido

| Proibido | Inclui |
|---|---|
| Conectar o nads a um projeto Firebase | `conferencia-nilma`, `entregas-2e5e2` ou qualquer outro; `initializeApp` com config real |
| Instalar ou importar o SDK | `firebase`, `firebase-admin`, `@firebase/*` no `package.json` de qualquer pacote do nads |
| Mexer no banco pelo terminal | `firebase` CLI (`deploy`, `firestore:*`, `hosting:*`, `functions:*`, `emulators` apontando para projeto real), scripts dos robôs, `gcloud` |
| Mexer nas regras | editar ou publicar `firestore.rules` de qualquer projeto |
| Copiar ou migrar dado | exportar coleção, "só ler pra ter exemplo", backup, importar no nads |
| Abrir app antigo ligado ao banco | abrir `conferencia.html`, `entregas.html`, Pendências, Tarefas, LCDPR ou `cliente.html` no navegador (local ou publicado): só de carregar, eles abrem ouvintes (`onSnapshot`) e leem coleções |
| Chamar serviço externo | ReceitaWS/CNPJ, Google Maps, Apps Script de contas, Gmail, Drive, IA (Gemini/Claude), FCM/push |
| Rodar os robôs | nada em `Entregas/scripts/` |

Na dúvida se algo faz requisição, **não faça**: pergunte.

Ler o **código** dos apps antigos (arquivo no disco, `git pull` do GitHub) é permitido: isso não toca
no banco.

## Como a cópia funciona sem banco

- **Repositório em memória:** cada domínio tem a interface `repo.ts` e **só** a implementação
  `repo.memoria.ts`. Os dados vêm de `packages/core/<dominio>/__exemplos__/`, com exemplos
  **escritos à mão ou tirados de planilhas que o usuário entregar**, anonimizados (empresa "Cliente X",
  CNPJ de teste). O que a pessoa faz na cópia (importar, marcar, excluir) fica na memória, e opcionalmente
  no `localStorage`, para sobreviver ao recarregar.
- **Documente como o original grava.** No topo de cada `repo.memoria.ts`, escreva num comentário de
  onde o app antigo lia e como gravava (coleção, campos, função de origem com arquivo:linha). Isso guarda
  o conhecimento sem executar nada contra o banco.
- **Login de mentira:** a casca mostra um seletor de pessoa/papel (admin, contabil, fiscal, office_boy…)
  guardado no `localStorage`, para testar as telas por papel. Não há tela de senha nem Firebase Auth.
- **Serviços externos viram fixos:** consulta de CNPJ devolve um exemplo; mapa mostra a lista sem mapa;
  IA responde "indisponível na cópia"; e-mail/WhatsApp/push viram um aviso do que seria enviado. Sempre com
  a mesma interface, num `servicos.memoria.ts` do domínio.
- **Arquivos locais continuam valendo.** Ler planilha, PDF, Sintegra e gerar .xls/.csv/.txt acontece no
  navegador, sem requisição, igual aos HTML de hoje. Essas ferramentas (Conciliadorzinho, Cheque especial,
  Leitor de Sintegra, importações da Conferência) funcionam de verdade na cópia.

## Como provar que ficou igual sem abrir o app antigo

- **Ferramentas sem banco** (Cheque especial, Conciliadorzinho, Leitor de Sintegra): podem ser abertas
  localmente lado a lado com a cópia, com o mesmo arquivo. Antes de abrir, confira no código que o HTML
  não carrega Firebase (`grep -i firebase`).
- **Apps com banco:** a comparação é pelo código. Para uma regra importante, rode a função antiga e a nova
  com a mesma entrada num teste (copie a função legada para `__legado__/` do teste, sem as partes que
  tocam banco ou tela) e compare as saídas.
- **Tela:** compare com prints que o usuário mandar, e com a design-n1.

## Publicar

- Só no **link que o usuário indicar** para a cópia. Pergunte na primeira vez e anote a resposta no
  README do nads.
- Nunca em projeto Firebase da Nilma (nem Hosting) e nunca por cima dos endereços atuais
  (`conferencia-nilma.web.app`, `…github.io/Entregas`).
- Antes de publicar, confirme que o build não tem Firebase nem chamada de rede para fora:
  `npm run verificar` inclui a checagem (ver `estrutura-nads.md`).

## Se o usuário um dia quiser ligar ao banco

Isso seria outra fase, pedida explicitamente por ele. A interface `repo.ts` de cada domínio é o ponto
de encaixe. Até lá, não escreva `repo.firestore.ts`, não sugira migração de dado e não trate as
"melhorias de banco" como pendência.
