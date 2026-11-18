# Regra do banco: quais guias o cliente abriu (ficha 26)

Escrito em 17/11/2026 para o Vitor publicar. O arquivo de regras não está no repositório, então isto é a **proposta**.

## O que muda

Quando o cliente baixa uma guia na Área do Cliente, o site manda um pedido marcado pela caixa que já existe
(`areaClienteChamados`, título `LEITURA`, texto `guia:<id>`). **Essa parte não precisa de regra nova:** é a mesma caixa e
o mesmo formato do pedido de DANFE.

O robô do PC reconhece a marca e anota numa coleção **nova e interna**:

- `areaClienteLeituras/{token}_{guia}`: `{ token, guiaId, codigos, tipo, competencia, primeiraEm, ultimaEm, vezes }`.

Só o robô grava (Admin SDK). A regra nova é só para a **equipe ler** no Tarefas: o bloco "Link do cliente" da empresa
passa a mostrar "Guias que o cliente abriu · DAS 10/2026 · aberta em 18/11 às 09:12". Sem a regra, o bloco mostra "o
banco ainda não deixa ver quais guias o cliente abriu", e o resto funciona.

## Texto proposto

```
// 17/11/2026 (ficha comprovante-de-leitura): quando o cliente abriu cada guia na Área do Cliente (só o robô grava)
match /areaClienteLeituras/{id} {
  allow read: if membroNoNads();
  allow write: if false;
}
```

## Ordem de publicação

O robô do PC precisa estar atualizado **antes** do site. Um robô antigo não conhece a marca e transformaria cada
download de guia numa solicitação "LEITURA" para a equipe.
