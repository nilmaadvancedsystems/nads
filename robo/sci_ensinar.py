# O modo de ensinar o robô do SCI (27/11/2026, Vitor: "me manda um robo pra ensinar no sci, nesse mesmo modelo"). O mesmo jeito
# do alterdata_ensinar.py: a pessoa faz o caminho uma vez, à mão, no SCI (o Novo Visual) e o script grava o que ela fez: para
# cada clique, o item que estava debaixo do mouse como o UI Automation o vê (nome, tipo, classe, a janela e a posição dentro
# dela) e, entre um clique e outro, as teclas digitadas. No começo pergunta o nome da rotina (o Vitor ensina e nomeia cada uma),
# que vai no nome do arquivo: ensino-sci-<nome>-<data>.txt.
#
# O que NÃO grava: nada fora do SCI (o clique e a tecla em outro programa são ignorados), nada numa tela de login e nada
# digitado num campo de senha (o campo com os asteriscos): a senha nunca passa por aqui.
#
# Só lê o mouse e o teclado: não abre, não fecha e não mexe no robô que está rodando.
#
# Uso (no PC com o SCI aberto e logado):  python sci_ensinar.py
#   diga o nome da rotina, faça o caminho no SCI e aperte F12 quando terminar. O arquivo fica em C:\nads\robo\ensino\ (ou em
#   ensino\ ao lado do script, se o robô não estiver instalado neste PC) e o caminho aparece no fim.
import ctypes
import ctypes.wintypes as wt
import json
import os
import queue
import re
import sys
import threading
import time
import unicodedata

import win32gui

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
import alterdata_processo as proc  # noqa: E402
# as peças do ensinar do Alterdata que não dependem do programa: os ganchos do mouse e do teclado, as teclas e o UI Automation
from alterdata_ensinar import KBDLL, MSLL, PROC, VK_F12, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, \
    WM_RBUTTONDOWN, WM_SYSKEYDOWN, janela_de_cima, kernel32, ler_uia, texto_da_tecla, user32  # noqa: E402

ROBO_INSTALADO = r'C:\nads\robo'
PASTA = os.path.join(ROBO_INSTALADO if os.path.isdir(ROBO_INSTALADO) else os.path.dirname(os.path.abspath(__file__)), 'ensino')

ES_PASSWORD = 0x20
GWL_STYLE = -16


class GUITHREADINFO(ctypes.Structure):
    _fields_ = [('cbSize', wt.DWORD), ('flags', wt.DWORD), ('hwndActive', wt.HWND), ('hwndFocus', wt.HWND), ('hwndCapture', wt.HWND),
                ('hwndMenuOwner', wt.HWND), ('hwndMoveSize', wt.HWND), ('hwndCaret', wt.HWND), ('rcCaret', wt.RECT)]


user32.GetGUIThreadInfo.argtypes = [wt.DWORD, ctypes.POINTER(GUITHREADINFO)]
user32.GetWindowThreadProcessId.argtypes = [wt.HWND, ctypes.POINTER(wt.DWORD)]
user32.GetWindowThreadProcessId.restype = wt.DWORD
user32.GetWindowLongW.argtypes = [wt.HWND, ctypes.c_int]
user32.GetWindowLongW.restype = ctypes.c_long

eventos = queue.Queue()
fim = threading.Event()


def do_sci(h):
    """A janela é do SCI: o novovisual.exe (ou outro módulo da pasta modulos do servidor, de onde o SCI roda)."""
    exe = proc.exe_da_janela(h)
    if os.path.basename(exe) == 'novovisual.exe' or '\\modulos\\' in exe:
        return True
    # sem conseguir ler o programa (outro usuário, outro nível de acesso): a janela do Delphi com o nome do SCI
    if not exe:
        try:
            titulo = (win32gui.GetWindowText(janela_de_cima(h)) or '').lower()
            return 'novo visual' in titulo or titulo.startswith('sci')
        except Exception:
            return False
    return False


def de_login(h):
    try:
        topo = janela_de_cima(h)
        texto = (win32gui.GetClassName(topo) + ' ' + (win32gui.GetWindowText(topo) or '')).lower()
        return any(p in texto for p in ('login', 'logon', 'senha', 'acesso ao sistema', 'autentica'))
    except Exception:
        return False


def no_campo_de_senha(janela):
    """O campo com o foco é de senha (o TEdit do Delphi com PasswordChar liga o ES_PASSWORD): nenhuma tecla dele é gravada."""
    try:
        info = GUITHREADINFO(cbSize=ctypes.sizeof(GUITHREADINFO))
        if not user32.GetGUIThreadInfo(user32.GetWindowThreadProcessId(janela, None), ctypes.byref(info)) or not info.hwndFocus:
            return False
        return bool(user32.GetWindowLongW(info.hwndFocus, GWL_STYLE) & ES_PASSWORD) and 'edit' in win32gui.GetClassName(info.hwndFocus).lower()
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
            fg = user32.GetForegroundWindow()
            # a senha nem entra na fila
            if not no_campo_de_senha(fg):
                eventos.put(('tecla', int(k.vk), fg, time.time()))
    return user32.CallNextHookEx(None, n, w, l)


def descrever_item(x, y):
    h = user32.WindowFromPoint(wt.POINT(x, y))
    if not h:
        return None
    if not do_sci(h):
        exe = os.path.basename(proc.exe_da_janela(h)) or '?'
        try:
            cls = win32gui.GetClassName(janela_de_cima(h))
        except Exception:
            cls = '?'
        print('   (clique ignorado: fora do SCI — ' + exe + ', ' + cls + ')', flush=True)
        return None
    if de_login(h):
        print('   (clique na tela de login: não gravo)', flush=True)
        return None
    topo = janela_de_cima(h)
    d = {'janela': win32gui.GetClassName(topo), 'titulo': (win32gui.GetWindowText(topo) or '')[:60], 'classe_win32': win32gui.GetClassName(h)}
    try:
        x0, y0, _, _ = win32gui.GetWindowRect(topo)
        d['na_janela'] = [x - x0, y - y0]
    except Exception:
        pass
    # o texto do campo de senha não vai para o arquivo
    if not (user32.GetWindowLongW(h, GWL_STYLE) & ES_PASSWORD):
        try:
            d['texto_win32'] = (win32gui.GetWindowText(h) or '')[:60]
        except Exception:
            pass
    d.update(ler_uia(x, y))
    if d.get('erro_uia'):
        d['erro_uia'] = d['erro_uia'].replace('o Alterdata', 'o SCI')
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
                     + (' · dentro de ' + ' < '.join(d.get('dentro_de', [])) if d.get('dentro_de') else '')
                     + (' · texto "' + d['texto_win32'] + '"' if d.get('texto_win32') else '')
                     + (' · ' + d['erro_uia'] if d.get('erro_uia') else ''))
            linhas.append(linha)
            saida.append({'evento': 'clique', 'botao': ev[3] or 'esquerdo', **d})
            print(linha, flush=True)
        else:
            fg = ev[2]
            if not fg or not do_sci(fg) or de_login(fg):
                continue
            t = texto_da_tecla(ev[1])
            if t:
                digitando.append(t)
    soltar_teclas()


def nome_para_arquivo(nome):
    """O nome da rotina no nome do arquivo: sem acento, minúsculo, com hífens ("Baixa de clientes" → baixa-de-clientes)."""
    s = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:50] or 'rotina'


def main():
    os.makedirs(PASTA, exist_ok=True)
    nome = ''
    while not nome.strip():
        nome = input('Qual o nome da rotina que você vai ensinar no SCI? ')
    print('\nGravando "' + nome.strip() + '" no SCI. Faça o caminho com calma (um clique de cada vez).', flush=True)
    print('Aperte F12 quando terminar. Fora do SCI, na tela de login e em campo de senha, nada é gravado.\n', flush=True)
    saida, linhas = [], []
    t = threading.Thread(target=trabalhador, args=(saida, linhas), daemon=True)
    t.start()
    pm, pk = PROC(ao_mouse), PROC(ao_teclado)
    mod = kernel32.GetModuleHandleW(None)
    hm = user32.SetWindowsHookExW(WH_MOUSE_LL, pm, mod, 0) or user32.SetWindowsHookExW(WH_MOUSE_LL, pm, None, 0)
    hk = user32.SetWindowsHookExW(WH_KEYBOARD_LL, pk, mod, 0) or user32.SetWindowsHookExW(WH_KEYBOARD_LL, pk, None, 0)
    if not hm or not hk:
        print('não consegui ouvir o mouse e o teclado (erro ' + str(ctypes.get_last_error()) + ')')
        return
    msg = wt.MSG()
    user32.PeekMessageW.argtypes = [ctypes.POINTER(wt.MSG), wt.HWND, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint]
    while not fim.is_set():
        while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        time.sleep(.02)
    user32.UnhookWindowsHookEx(hm)
    user32.UnhookWindowsHookEx(hk)
    t.join(timeout=10)
    txt = os.path.join(PASTA, 'ensino-sci-' + nome_para_arquivo(nome) + '-' + time.strftime('%Y%m%d-%H%M%S') + '.txt')
    with open(txt, 'w', encoding='utf-8') as f:
        f.write('A rotina "' + nome.strip() + '" ensinada no SCI em ' + time.strftime('%d/%m/%Y %H:%M') + ' no ' + os.environ.get('COMPUTERNAME', '?') + '\n\n')
        f.write('\n'.join(linhas) + '\n\n')
        f.write(json.dumps(saida, ensure_ascii=False, indent=1))
    print('\nPronto: ' + str(len([s for s in saida if s['evento'] == 'clique'])) + ' cliques gravados em ' + txt, flush=True)


if __name__ == '__main__':
    main()
