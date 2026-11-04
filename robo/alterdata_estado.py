# Como está o Alterdata Contábil desta máquina, sem mexer em nada (04/11/2026): o robô do Alterdata só pega um pedido
# quando o Contábil está aberto e logado aqui. Escreve uma linha: ESTADO: ok | login | fechado | dois | erro
# e, quando não está ok, uma linha DIAG: com as janelas do Contábil que esta sessão enxerga (classe, visível, título),
# para o log do robô dizer o porquê (no servidor, a sessão do RDP desconectado pode esconder as janelas).
# Só win32gui (sem o pywinauto): EnumWindows, GetClassName, IsWindowVisible e GetWindowText não mandam mensagem para a
# janela de outro processo, então não travam se o Contábil estiver ocupado (no servidor, o pywinauto passava de 30 s).
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')
t0 = time.time()
try:
    import win32gui
    import win32process
    janelas = []

    def junta(h, _):
        try:
            cls = win32gui.GetClassName(h)
            if cls.startswith('Tfrm') or cls == 'TApplication':
                janelas.append((cls, bool(win32gui.IsWindowVisible(h)), (win32gui.GetWindowText(h) or '')[:40], win32process.GetWindowThreadProcessId(h)[1]))
        except Exception:
            pass
        return True

    win32gui.EnumWindows(junta, None)
except Exception as e:  # o pywin32 não carregou ou a área de trabalho não deixa listar
    print('ESTADO: erro', flush=True)
    print('DIAG: ' + type(e).__name__ + ': ' + str(e)[:200], flush=True)
    sys.exit(0)


def visiveis(cls):
    return [j for j in janelas if j[0] == cls and j[1]]


# TfrmLogin no PC (7.1106); TfrmLoginSimultaneo no servidor (7.1029, 04/11/2026: a principal fica oculta atrás dela)
if any(c.startswith('TfrmLogin') and v for c, v, _, _ in janelas):
    estado = 'login'
else:
    n = len(visiveis('TfrmPrincipal'))
    estado = 'fechado' if n == 0 else 'ok' if n == 1 else 'dois'
print('ESTADO: ' + estado, flush=True)
if estado != 'ok':
    lista = '; '.join(c + ('' if v else ' (oculta)') + (' "' + t + '"' if t else '') + ' pid ' + str(p) for c, v, t, p in janelas[:12])
    print('DIAG: sessão ' + os.environ.get('SESSIONNAME', '?') + ', ' + str(len(janelas)) + ' janelas Tfrm em ' + str(round(time.time() - t0, 1)) + ' s: ' + (lista or 'nenhuma'), flush=True)
