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
# o clique do mouse como mensagem no próprio botão (os botões do Alterdata são DevExpress e não atendem o BM_CLICK); o
# BM_CLICK vai depois, para o botão comum do Windows
_, _, w, a = win32gui.GetClientRect(b)
pos = (a // 2) << 16 | (w // 2)
win32gui.PostMessage(b, win32con.WM_MOUSEMOVE, 0, pos)
win32gui.PostMessage(b, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, pos)
time.sleep(0.15)
win32gui.PostMessage(b, win32con.WM_LBUTTONUP, 0, pos)
limite = time.time() + 10
while time.time() < limite:
    time.sleep(0.5)
    if not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h):
        fim(True)
win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
time.sleep(2)
fim(not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h), 'cliquei em "Ver depois" e a tela de atualizações não fechou')
