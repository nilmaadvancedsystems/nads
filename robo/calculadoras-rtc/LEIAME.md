# As calculadoras da Reforma Tributária (Receita Federal) no PC do servidor

As calculadoras oficiais da CBS, do IBS e do Imposto Seletivo, publicadas pela Receita com licença MIT:

| Calculadora | Repositório | Versão | Onde fica |
|---|---|---|---|
| Regime regular | [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | 1.7.2 | `http://127.0.0.1:18080/api` |
| Simples Nacional | [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | 1.0.2 | `http://127.0.0.1:18082/api` |

São servidores Java 25 (Spring Boot e SQLite). Não rodam no navegador e ficam só para o próprio PC: ninguém de fora
alcança as portas.

As portas são 18080 e 18082, e 19101 e 19103 para as métricas internas. A Receita usa 8080 e 8082, mas no servidor a
calculadora do regime regular não subiu na 8080 na primeira instalação, em 22/11/2026.

## Por que no PC do servidor e não na nuvem

- A máquina da nuvem (`robo-nilma`) é uma e2-micro, com 1 GB de memória, que já roda o Node e o Chromium do FGTS. Cada
  calculadora ocupa algo como 300 a 400 MB. As duas juntas não cabem.
- O robô do SIEG roda no PC do servidor, e os XMLs das notas ficam lá.

## O robô instala sozinho

Não precisa ir ao servidor: quando o SIEG liga (`sieg.js`, `iniciarSieg`), o `robo/rtc-servidor.js` confere se a
calculadora responde. Faz isso um minuto depois de ligar e, a partir daí, a cada 6 horas. Se a calculadora não
responde, ele roda este `instalar.ps1` por trás.

- O registro mostra o andamento, e o painel do robô mostra o resultado: a memória de cada calculadora e a livre no PC.
- A saída inteira fica em `D:\nads-rtc\instalar.log`.
- Uma tentativa que falhou só se repete depois de 6 horas.
- `RTC_DESLIGADA=sim` desliga essa verificação.

Rodando pelo robô, sem administrador, as calculadoras não são registradas no Windows: o próprio robô as liga de novo
depois de cada reinício do PC.

## Ligar e ver por que caiu

`ligar.ps1` liga cada calculadora que não responde. A que já responde fica como está. Cada uma grava a sua saída em
`D:\nads-rtc\regime-regular.log` e `D:\nads-rtc\simples-nacional.log`, e os erros em `*.erro.log`. Se uma cair, o motivo
fica nesses arquivos. O `instalar.ps1` chama o `ligar.ps1` no fim, e a tarefa agendada do `-Registrar` também.

## Instalar à mão

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
  resultado em `siegNotas/{codigo}_{AAAA-MM}`, no campo `ibsCbs`. O Fiscal mostra essa conferência na aba IBS/CBS da
  página Fiscal › SIEG. Sem a calculadora no ar, o robô só escreve uma linha no registro e segue.
- A regra fica em `packages/core/src/tarefas/sieg/ibsCbs.ts` e chega ao robô pelo `robo/gerado/ibscbs.js`
  (`node scripts/robo-ibscbs.mjs`).
- Para usar outro endereço, defina a variável `RTC_URL`, por exemplo `http://127.0.0.1:18080/api`.

## As tabelas oficiais no nads

O `scripts/tabelas-rtc.mjs` lê o banco da calculadora (`calculadora\db\calculadora-pro.db`, na pasta da instalação) e
grava `packages/core/src/reforma/tabelas.json`: os CST do IBS/CBS, o cClassTrib, as alíquotas de referência e as
atividades do Simples. O Fiscal mostra essas tabelas em **Tabelas da Reforma**, e o simulador do Simples usa as alíquotas.
Quando a Receita publicar uma versão nova, troque a versão no `instalar.ps1`, deixe o robô instalar, rode o script com o
banco novo e commite o JSON.
