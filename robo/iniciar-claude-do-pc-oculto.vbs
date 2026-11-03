' Liga o claude-do-pc sem abrir janela (vai na pasta Inicializar do Windows deste PC, no lugar do iniciar-arquivador).
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = pasta
shell.Run "cmd /c """ & pasta & "\claude-do-pc-laco.cmd""", 0, False
