# Volta o Alterdata ao ponto de antes do robô (17/11/2026, Vitor: "coloca a opção de cancelar, o robô para tudo e volta pro ponto
# inicial, onde estava"). Depois que o pedido é cancelado e o roteiro é parado no meio: fecha o que ficou aberto por cima da
# janela principal do Contábil e do Fiscal — o "Salvar" do Windows (Cancelar), a pergunta (Não/Cancelar), o menu aberto (Esc) e a
# tela da consulta (fechar, é só consulta: nada a gravar). Nunca fecha a janela principal nem a de login; nunca clica em Sim.
# Uso: python alterdata_limpar.py   → RESULTADO: {"ok": true, "fechadas": [...]}
import json
import os
import sys
import time

import win32con
import win32gui

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
import alterdata_processo as proc  # noqa: E402

NAO = ('não', 'nao', '&não', '&nao', 'cancelar', '&cancelar', 'fechar', '&fechar', 'ok')


def do_alterdata(h):
    return '\\alterdata\\' in proc.exe_da_janela(h)


def janelas():
    r = []

    def junta(h, _):
        try:
            if win32gui.IsWindowVisible(h) and do_alterdata(h):
                r.append(h)
        except Exception:
            pass
        return True
    win32gui.EnumWindows(junta, None)
    return r


def botao(h):
    achou = []

    def ver(c, _):
        try:
            if win32gui.IsWindowVisible(c) and (win32gui.GetWindowText(c) or '').strip().lower() in NAO:
                achou.append(c)
        except Exception:
            pass
        return True
    try:
        win32gui.EnumChildWindows(h, ver, None)
    except Exception:
        pass
    # Não antes de Cancelar, antes de Fechar, antes de OK
    ordem = {t: i for i, t in enumerate(NAO)}
    achou.sort(key=lambda c: ordem.get((win32gui.GetWindowText(c) or '').strip().lower(), 99))
    return achou[0] if achou else None


fechadas = []
for _ in range(4):
    mexeu = False
    for h in janelas():
        cls = win32gui.GetClassName(h)
        if cls in ('TfrmPrincipal', 'TApplication') or cls.startswith('TfrmLogin'):
            continue
        b = botao(h) if cls in ('#32770', 'TMessageForm') else None
        if b:
            win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
        elif 'menu' in cls.lower() or 'popup' in cls.lower():
            win32gui.PostMessage(h, win32con.WM_KEYDOWN, win32con.VK_ESCAPE, 0)
        else:
            win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
        fechadas.append(cls + ' "' + (win32gui.GetWindowText(h) or '')[:30] + '"')
        mexeu = True
    if not mexeu:
        break
    time.sleep(1)
print('RESULTADO: ' + json.dumps({'ok': True, 'fechadas': fechadas}, ensure_ascii=False), flush=True)
