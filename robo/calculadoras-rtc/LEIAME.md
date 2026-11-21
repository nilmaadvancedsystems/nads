# As calculadoras da Reforma Tributária (Receita Federal) no PC do servidor

As calculadoras oficiais da CBS, do IBS e do Imposto Seletivo, publicadas pela Receita com licença MIT:

| Calculadora | Repositório | Versão | Onde fica |
|---|---|---|---|
| Regime regular | [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | 1.7.2 | `http://127.0.0.1:8080/api` |
| Simples Nacional | [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | 1.0.2 | `http://127.0.0.1:8082/api` |

São servidores Java 25 (Spring Boot e SQLite). Não rodam no navegador e ficam só para o próprio PC: ninguém de fora
alcança as portas.

## Por que no PC do servidor e não na nuvem

- A máquina da nuvem (`robo-nilma`) é uma e2-micro, com 1 GB de memória, que já roda o Node e o Chromium do FGTS. Cada
  calculadora ocupa algo como 300 a 400 MB. As duas juntas não cabem.
- O robô do SIEG roda no PC do servidor, e os XMLs das notas ficam lá.

## Instalar ou atualizar

No PC do servidor, na pasta do repositório:

```bat
powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\instalar.ps1
```

Ele baixa o Java 25 e as duas calculadoras para `D:\nads-rtc` (ou `C:\nads-rtc` no PC sem o disco D:), gera o banco e os `.jar`, liga as duas e mostra a
memória de cada uma. Na primeira vez leva uns 10 minutos, por causa do Maven baixando as dependências. Com `-Registrar`,
cria também a tarefa agendada `nads-calculadoras-rtc`, que liga as duas quando o Windows liga.

Para mudar de versão, troque a `Versao` no topo do `instalar.ps1` e rode de novo.

## Quem usa

- `robo/sieg-ibscbs.js`: depois de cada "Baixar XMLs" do SIEG, confere o IBS/CBS das NF-e e NFC-e do mês e grava o
  resultado em `siegNotas/{codigo}_{AAAA-MM}`, no campo `ibsCbs`. O Fiscal mostra essa conferência nas Saídas e nas
  Entradas. Sem a calculadora no ar, o robô só escreve uma linha no registro e segue.
- A regra fica em `packages/core/src/tarefas/sieg/ibsCbs.ts` e chega ao robô pelo `robo/gerado/ibscbs.js`
  (`node scripts/robo-ibscbs.mjs`).
- Para usar outro endereço, defina a variável `RTC_URL`, por exemplo `http://127.0.0.1:8080/api`.
