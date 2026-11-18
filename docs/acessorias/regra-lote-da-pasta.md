# Regra do banco: guias do Fiscal já na pasta (ficha E15)

Escrito em 17/11/2026 para o Vitor publicar. O arquivo de regras não está no repositório, então isto é a **proposta**: confira
contra a regra atual de `dpArquivos` e de `lotesFiscal/{lote}/arquivos/{k}` antes de publicar.

## O que muda

1. **Coleção nova `fiscalArquivos/{AAAA-MM}`**: a lista das guias do Fiscal já arquivadas no Drive, por cliente. É o mesmo
   formato do `dpArquivos`. Só o robô grava (Admin SDK); a equipe do Fiscal lê.
2. **O arquivo do lote do Fiscal pode vir da pasta**: em vez dos pedaços (`partes`), a tela grava
   `{ nome, tamanho, driveId, origem: { codigo, competencia, pasta }, status: 'pendente' }`. O robô só baixa o PDF se o
   `driveId` estiver na lista `fiscalArquivos` daquele cliente e mês.

Sem a regra, a aba "Já na pasta" mostra "O banco ainda não deixa ler as guias da pasta". O resto do Enviar guias continua
igual.

## Texto proposto

```
// as guias do Fiscal já arquivadas no Drive, por mês (plano do Acessórias, ficha E15): só o robô grava
match /fiscalArquivos/{mes} {
  allow read: if membroNoNads();      // ou a mesma condição de leitura do dpArquivos
  allow write: if false;
}
```

No `match /lotesFiscal/{lote}/arquivos/{k}`, no `create`, aceitar também o arquivo que vem da pasta, ao lado do que tem
`partes`:

```
// o arquivo que veio da pasta do Drive (ficha E15): sem pedaços; o robô confere o id na lista fiscalArquivos
(request.resource.data.keys().hasOnly(['nome', 'tamanho', 'driveId', 'origem', 'status'])
 && request.resource.data.driveId is string && request.resource.data.driveId.size() <= 100
 && request.resource.data.origem is map
 && request.resource.data.origem.keys().hasOnly(['codigo', 'competencia', 'pasta'])
 && request.resource.data.status == 'pendente')
```

Quem pode criar é o mesmo que hoje sobe lote de guias: o Fiscal e o admin.

## O robô

Já está pronto no código (sem publicar):
- `robo/guias-do-fiscal.js` monta a lista a cada releitura da pasta do cliente (`drive-indice.js`).
- `robo/lote-dp.js` (`bufferDoArquivo`) baixa pelo Drive só o id que está na lista.
- `robo/lote-fiscal.js` não grava de novo no Drive a guia que veio de lá.

Precisa do push e da troca do `robo-versao` da VM, com o OK do dono.
