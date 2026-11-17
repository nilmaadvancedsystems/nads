# O robô do Alterdata num PC Windows

O mesmo robô dos relatórios do Alterdata do NILMA-SERVER (balancete, razão, importação de lançamentos e as notas do Fiscal), rodando num PC onde alguém deixa o **Alterdata Contábil e o Fiscal abertos e logados**. A fila é a mesma do servidor: quem estiver com o Contábil pronto pega o pedido, e os dois juntos nunca fazem o mesmo pedido.

**Atenção:** enquanto atende um pedido (1 a 2 minutos), o robô usa o mouse e o teclado deste PC. A tela precisa ficar destravada.

## Instalar (uma vez)

No PowerShell do PC, com o usuário que fica logado no Alterdata:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
irm https://raw.githubusercontent.com/nilmaadvancedsystems/nads/desenvolvimento/robo/pc-alterdata/instalar.ps1 -OutFile $env:TEMP\instalar-alterdata.ps1
& $env:TEMP\instalar-alterdata.ps1
```

O instalador instala o Git, o Node e o Python se faltarem, baixa o código em `C:\nads`, instala o pywinauto, pede o `firebase login` (a conta do escritório), cria o atalho na pasta Inicializar e liga o robô.

## Depois

- Atualiza sozinho: a cada 5 min olha o GitHub; com código novo do robô, termina o pedido do meio e reinicia com o código novo.
- Registro: `C:\nads\robo\alterdata-no-pc.log`. Na Central dos robôs e no banco, o PC aparece como `pc-<nome do computador>` (`robo/alterdata.maquinas`).
- Parar: feche o `node.exe` do `alterdata-no-pc.js` (Gerenciador de Tarefas) e tire o atalho `nads-alterdata` da pasta Inicializar.
