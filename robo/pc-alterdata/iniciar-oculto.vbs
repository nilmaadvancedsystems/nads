' Liga o robo do Alterdata deste PC sem abrir janela (o atalho fica na pasta Inicializar do Windows; instalar.ps1 cria).
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = pasta
shell.Run "cmd /c """ & pasta & "\iniciar.cmd""", 0, False
