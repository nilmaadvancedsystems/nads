# A tela de atualizações que o Alterdata mostra ao abrir (05/11/2026, Vitor: "quando o alterdata abre tem uma tela de
# atualizacoes, ele tem que clicar em ver depois, eu cliquei dessa vez"). O alterdata_estado.py acha a janela (AVISO:) e
# este roteiro clica no "Ver depois" dela: nada além disso (nunca em "Atualizar", "Instalar" ou "Sim").
#
# Uso: python alterdata_avisos.py <janela>   → RESULTADO: {"ok": true} ou {"ok": false, "erro": "..."}
import json
import sys
import time

import win32con
import win32gui

sys.stdout.reconfigure(encoding='utf-8')
VER_DEPOIS = ('ver depois', 'lembrar depois', 'lembre-me depois', 'mais tarde')


def fim(ok, erro=''):
    print('RESULTADO: ' + json.dumps({'ok': True} if ok else {'ok': False, 'erro': erro}, ensure_ascii=False), flush=True)
    sys.exit(0)


try:
    h = int(sys.argv[1])
except Exception:
    fim(False, 'sem a janela')
if not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h):
    fim(True)   # já fechou

botoes = []


def junta(c, _):
    if win32gui.IsWindowVisible(c) and (win32gui.GetWindowText(c) or '').replace('&', '').strip().lower() in VER_DEPOIS:
        botoes.append(c)
    return True


win32gui.EnumChildWindows(h, junta, None)
if len(botoes) != 1:
    fim(False, 'achei ' + str(len(botoes)) + ' botões "Ver depois" na tela de atualizações')
b = botoes[0]
classe = win32gui.GetClassName(b)
# 1º o clique do mouse como mensagem no próprio botão (vale com o RDP desconectado); 05/11/2026: no Guia
# (TfrmAlterdataTourView) ele não fechou, então 2º o clique de verdade (o mouse do Windows, como os roteiros dos relatórios)
_, _, w, a = win32gui.GetClientRect(b)
pos = (a // 2) << 16 | (w // 2)
win32gui.PostMessage(b, win32con.WM_MOUSEMOVE, 0, pos)
win32gui.PostMessage(b, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, pos)
time.sleep(0.15)
win32gui.PostMessage(b, win32con.WM_LBUTTONUP, 0, pos)


def fechou(segundos):
    limite = time.time() + segundos
    while time.time() < limite:
        time.sleep(0.3)
        if not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h):
            return True
    return False


if fechou(3):
    fim(True)
try:
    from pywinauto import Desktop
    janela = Desktop(backend='win32').window(handle=h)
    janela.set_focus()
    time.sleep(0.3)
    Desktop(backend='win32').window(handle=b).click_input()
except Exception as e:
    fim(False, 'o clique de verdade no "Ver depois" (' + classe + ') não deu: ' + str(e)[:150])
if fechou(8):
    fim(True)
fim(False, 'cliquei em Ver depois (' + classe + ') e a tela de atualizações não fechou')
