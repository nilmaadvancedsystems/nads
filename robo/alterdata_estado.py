# Como está o Alterdata Contábil desta máquina, sem mexer em nada (04/11/2026): o robô do Alterdata só pega um pedido
# quando o Contábil está aberto e logado aqui. Escreve uma linha: ESTADO: ok | login | fechado | dois
import sys

from pywinauto import Desktop

sys.stdout.reconfigure(encoding='utf-8')
d = Desktop(backend='win32')


def visiveis(cls):
    r = []
    for w in d.windows():
        try:
            if w.is_visible() and w.class_name() == cls:
                r.append(w)
        except Exception:
            pass
    return r


if visiveis('TfrmLogin'):
    print('ESTADO: login', flush=True)
else:
    n = len(visiveis('TfrmPrincipal'))
    print('ESTADO: ' + ('fechado' if n == 0 else 'ok' if n == 1 else 'dois'), flush=True)
