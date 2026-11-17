# O modo de ensinar o robô do Alterdata (17/11/2026, Vitor: "pra eu ensinar ele"). A pessoa faz o caminho uma vez, à mão,
# no Alterdata (Fiscal ou Contábil) e o robô grava o que ela fez: para cada clique, o item que estava debaixo do mouse como o
# UI Automation o vê (nome, tipo, classe, a janela e a posição dentro dela) e, entre um clique e outro, as teclas digitadas.
# É com isso que os roteiros (alterdata_fiscal.py…) acham cada botão e cada campo pelo nome, sem posição medida.
#
# O que NÃO grava: nada fora do Alterdata (o clique e a tecla em outro programa são ignorados) e nada numa tela de login
# (nem as teclas, nem os cliques): a senha nunca passa por aqui.
#
# Uso (no PC com o Alterdata aberto e logado):  python alterdata_ensinar.py
#   faça o caminho no Alterdata; aperte F12 quando terminar (ou Esc no console). O arquivo fica em robo\ensino\ e o caminho
#   aparece no fim; mande o .txt para quem está ensinando o robô.
import ctypes
import ctypes.wintypes as wt
import json
import os
import queue
import sys
import threading
import time

import win32gui
from pywinauto import Desktop

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
import alterdata_processo as proc  # noqa: E402

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ensino')
user32 = ctypes.WinDLL('user32', use_last_error=True)
kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
WH_MOUSE_LL, WH_KEYBOARD_LL = 14, 13
WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_LBUTTONDBLCLK = 0x0201, 0x0204, 0x0203
WM_KEYDOWN, WM_SYSKEYDOWN = 0x0100, 0x0104
VK_F12 = 0x7B


class MSLL(ctypes.Structure):
    _fields_ = [('pt', wt.POINT), ('mouseData', wt.DWORD), ('flags', wt.DWORD), ('time', wt.DWORD), ('extra', ctypes.c_void_p)]


class KBDLL(ctypes.Structure):
    _fields_ = [('vk', wt.DWORD), ('scan', wt.DWORD), ('flags', wt.DWORD), ('time', wt.DWORD), ('extra', ctypes.c_void_p)]


PROC = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wt.WPARAM, wt.LPARAM)
user32.CallNextHookEx.argtypes = [ctypes.c_void_p, ctypes.c_int, wt.WPARAM, wt.LPARAM]
user32.CallNextHookEx.restype = ctypes.c_ssize_t
user32.SetWindowsHookExW.argtypes = [ctypes.c_int, PROC, ctypes.c_void_p, wt.DWORD]
user32.SetWindowsHookExW.restype = ctypes.c_void_p
user32.WindowFromPoint.argtypes = [wt.POINT]
user32.WindowFromPoint.restype = wt.HWND
user32.GetAncestor.argtypes = [wt.HWND, ctypes.c_uint]
user32.GetAncestor.restype = wt.HWND

TECLAS = {0x08: '{BACKSPACE}', 0x09: '{TAB}', 0x0D: '{ENTER}', 0x1B: '{ESC}', 0x20: ' ', 0x25: '{ESQUERDA}', 0x26: '{CIMA}',
          0x27: '{DIREITA}', 0x28: '{BAIXO}', 0x2E: '{DEL}', 0x24: '{HOME}', 0x23: '{END}', 0x6F: '/', 0xBF: '/', 0xC1: '/',
          0x6D: '-', 0xBD: '-', 0x6E: ',', 0xBC: ',', 0xBE: '.', 0xC2: '.'}
for i in range(1, 12):
    TECLAS[0x6F + i] = '{F' + str(i) + '}'

eventos = queue.Queue()
fim = threading.Event()


def janela_de_cima(h):
    try:
        return user32.GetAncestor(h, 2) or h   # GA_ROOT
    except Exception:
        return h


def do_alterdata(h):
    exe = proc.exe_da_janela(h)
    return '\\alterdata\\' in exe


def de_login(h):
    try:
        return 'login' in win32gui.GetClassName(janela_de_cima(h)).lower()
    except Exception:
        return False


def ao_mouse(n, w, l):
    if n == 0 and w in (WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_LBUTTONDBLCLK):
        m = ctypes.cast(l, ctypes.POINTER(MSLL)).contents
        eventos.put(('clique', m.pt.x, m.pt.y, 'direito' if w == WM_RBUTTONDOWN else 'duplo' if w == WM_LBUTTONDBLCLK else '', time.time()))
    return user32.CallNextHookEx(None, n, w, l)


def ao_teclado(n, w, l):
    if n == 0 and w in (WM_KEYDOWN, WM_SYSKEYDOWN):
        k = ctypes.cast(l, ctypes.POINTER(KBDLL)).contents
        if k.vk == VK_F12:
            fim.set()
        else:
            eventos.put(('tecla', int(k.vk), user32.GetForegroundWindow(), time.time()))
    return user32.CallNextHookEx(None, n, w, l)


def texto_da_tecla(vk):
    if 0x30 <= vk <= 0x39 or 0x41 <= vk <= 0x5A:
        return chr(vk)
    if 0x60 <= vk <= 0x69:
        return chr(vk - 0x30)
    if vk in (0x10, 0x11, 0x12, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x14):
        return ''   # Shift, Ctrl, Alt, Caps: sozinhas não dizem nada
    return TECLAS.get(vk, '{tecla ' + hex(vk) + '}')


uia = Desktop(backend='uia')


def descrever_item(x, y):
    h = user32.WindowFromPoint(wt.POINT(x, y))
    if not h or not do_alterdata(h) or de_login(h):
        return None
    topo = janela_de_cima(h)
    d = {'janela': win32gui.GetClassName(topo), 'titulo': (win32gui.GetWindowText(topo) or '')[:60], 'classe_win32': win32gui.GetClassName(h)}
    try:
        x0, y0, _, _ = win32gui.GetWindowRect(topo)
        d['na_janela'] = [x - x0, y - y0]
    except Exception:
        pass
    try:
        e = uia.from_point(x, y)
        i = e.element_info
        d.update({'nome': (i.name or '').strip()[:80], 'tipo': str(i.control_type or ''), 'classe': i.class_name or '', 'id': i.automation_id or ''})
        r = e.rectangle()
        d['tamanho'] = [r.right - r.left, r.bottom - r.top]
        # o rótulo e o grupo de quem está em volta: o pai e o avô
        pais = []
        p = e.parent()
        for _ in range(2):
            if not p:
                break
            pi = p.element_info
            pais.append((str(pi.control_type or '') + '/' + (pi.class_name or '') + ('"' + (pi.name or '')[:40] + '"' if pi.name else '')))
            p = p.parent()
        d['dentro_de'] = pais
    except Exception as ex:
        d['erro_uia'] = type(ex).__name__
    return d


def trabalhador(saida, linhas):
    digitando = []
    ultimo = None

    def soltar_teclas():
        nonlocal digitando
        if digitando:
            t = ''.join(digitando)
            linhas.append('   digitou: ' + t)
            saida.append({'evento': 'digitou', 'texto': t, 'no': ultimo})
            print('   digitou: ' + t, flush=True)
            digitando = []
    while not fim.is_set() or not eventos.empty():
        try:
            ev = eventos.get(timeout=.2)
        except queue.Empty:
            continue
        if ev[0] == 'clique':
            soltar_teclas()
            d = descrever_item(ev[1], ev[2])
            if not d:
                continue
            ultimo = d.get('nome') or d.get('classe')
            n = len([s for s in saida if s['evento'] == 'clique']) + 1
            linha = (str(n) + '. clique' + (' ' + ev[3] if ev[3] else '') + ' em ' + (d.get('tipo') or '?') + ' "' + (d.get('nome') or '') + '"'
                     + ' (' + (d.get('classe') or d.get('classe_win32', '')) + ')' + ' na janela ' + d['janela'] + (' "' + d['titulo'] + '"' if d['titulo'] else '')
                     + (' @' + str(d['na_janela'][0]) + ',' + str(d['na_janela'][1]) if 'na_janela' in d else '')
                     + (' · dentro de ' + ' < '.join(d.get('dentro_de', [])) if d.get('dentro_de') else ''))
            linhas.append(linha)
            saida.append({'evento': 'clique', 'botao': ev[3] or 'esquerdo', **d})
            print(linha, flush=True)
        else:
            fg = ev[2]
            if not fg or not do_alterdata(fg) or de_login(fg):
                continue
            t = texto_da_tecla(ev[1])
            if t:
                digitando.append(t)
    soltar_teclas()


def main():
    os.makedirs(PASTA, exist_ok=True)
    print('Gravando o que você faz no Alterdata. Faça o caminho com calma (um clique de cada vez).', flush=True)
    print('Aperte F12 quando terminar. Fora do Alterdata e na tela de login, nada é gravado.\n', flush=True)
    saida, linhas = [], []
    t = threading.Thread(target=trabalhador, args=(saida, linhas), daemon=True)
    t.start()
    pm, pk = PROC(ao_mouse), PROC(ao_teclado)
    hm = user32.SetWindowsHookExW(WH_MOUSE_LL, pm, kernel32.GetModuleHandleW(None), 0)
    hk = user32.SetWindowsHookExW(WH_KEYBOARD_LL, pk, kernel32.GetModuleHandleW(None), 0)
    if not hm or not hk:
        print('não consegui ouvir o mouse e o teclado (erro ' + str(ctypes.get_last_error()) + ')')
        return
    msg = wt.MSG()
    while not fim.is_set():
        while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        time.sleep(.02)
    user32.UnhookWindowsHookEx(ctypes.c_void_p(hm))
    user32.UnhookWindowsHookEx(ctypes.c_void_p(hk))
    t.join(timeout=10)
    carimbo = time.strftime('%Y%m%d-%H%M%S')
    txt = os.path.join(PASTA, 'ensino-' + carimbo + '.txt')
    with open(txt, 'w', encoding='utf-8') as f:
        f.write('O caminho ensinado em ' + time.strftime('%d/%m/%Y %H:%M') + ' no ' + os.environ.get('COMPUTERNAME', '?') + '\n\n')
        f.write('\n'.join(linhas) + '\n\n')
        f.write(json.dumps(saida, ensure_ascii=False, indent=1))
    print('\nPronto: ' + str(len([s for s in saida if s['evento'] == 'clique'])) + ' cliques gravados em ' + txt, flush=True)


if __name__ == '__main__':
    main()
