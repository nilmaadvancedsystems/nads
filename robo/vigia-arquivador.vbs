' O vigia do robô (Vitor, 15/10/2026: "o robô não tá iniciando"; "pode deixar ligando sozinho"): o Agendador de Tarefas
' roda isto a cada 5 minutos; se não houver um node rodando o arquivador.js, liga o robô (sem janela). Cobre o caso em que
' o robô e o laço caem juntos (duas sessões reiniciando ao mesmo tempo: o laço vê "já existe outro" e sai).
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set nodes = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name = 'node.exe'")
rodando = False
For Each p In nodes
  If Not IsNull(p.CommandLine) Then
    If InStr(1, p.CommandLine, "arquivador.js", vbTextCompare) > 0 Then rodando = True
  End If
Next
If Not rodando Then
  Set fso = CreateObject("Scripting.FileSystemObject")
  pasta = fso.GetParentFolderName(WScript.ScriptFullName)
  Set shell = CreateObject("WScript.Shell")
  shell.CurrentDirectory = pasta
  shell.Run "wscript """ & pasta & "\iniciar-arquivador-oculto.vbs""", 0, False
End If
