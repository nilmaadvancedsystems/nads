# A tela do servidor como o robô do Alterdata a vê (09/11/2026). Desde 06/11 17:07 todo pedido falhava com "o Balancete
# Dinâmico não abriu" e "a janela do Razão não abriu", e o log não dizia o que estava na tela. Este módulo dá a prova:
#   - foto(pasta, nome): a tela inteira num .png (só o pywin32: BitBlt da área de trabalho; o servidor não tem o Pillow);
#   - medidas(): o tamanho da tela, o modo de vídeo atual e os modos que a placa aceita, se a área de trabalho recebe
#     clique (OpenInputDesktop) e as janelas Tfrm visíveis com o tamanho de cada uma;
#   - resumo_do_erro(motivo): o que os roteiros (alterdata_razao.py, alterdata_dinamico.py) acrescentam ao erro de janela
#     que não abriu: o tamanho da tela e da janela principal, as janelas à mostra e onde ficou a foto.
# Só olha (e, no modo "abas" do diagnóstico, clica nas ABAS da faixa de opções do Contábil, que só trocam a aba à mostra).
#
# Uso (diagnóstico pedido pelo arquivo D:\nads-dados\alterdata\tela.pedido, ver alterdata.js):
#   python alterdata_tela.py <pasta das fotos> [acender] [foto] [uia] [abas] [clique]
# (acender: acende a tela antes; clique: a sonda dos jeitos de clicar, ver _clique)
# Escreve TELA: {json} e FOTO: <caminho> por foto.
import json
import os
import struct
import sys
import time
import zlib

import win32api
import win32con
import win32gui
import win32process
import win32ui

# no máximo tantas fotos na pasta (cada uma tem ~100 KB); passou, não tira mais (nada é apagado sozinho)
MAX_FOTOS = 300


def tamanho_da_tela():
    return win32api.GetSystemMetrics(win32con.SM_CXSCREEN), win32api.GetSystemMetrics(win32con.SM_CYSCREEN)


def modos():
    """O modo atual e os modos que a placa de vídeo aceita (largura x altura, sem repetir)."""
    atual = ''
    try:
        m = win32api.EnumDisplaySettings(None, win32con.ENUM_CURRENT_SETTINGS)
        atual = '%dx%d@%dbits/%dHz' % (m.PelsWidth, m.PelsHeight, m.BitsPerPel, m.DisplayFrequency)
    except Exception as e:
        atual = 'erro: ' + str(e)[:80]
    vistos = []
    i = 0
    while i < 500:
        try:
            m = win32api.EnumDisplaySettings(None, i)
        except Exception:
            break
        t = '%dx%d' % (m.PelsWidth, m.PelsHeight)
        if t not in vistos:
            vistos.append(t)
        i += 1
    return atual, vistos


def area_de_trabalho_ativa():
    """Se esta sessão tem a área de trabalho que recebe o mouse e o teclado (sem ela, o SendInput não entra)."""
    try:
        import win32service
        h = win32service.OpenInputDesktop(0, False, win32con.MAXIMUM_ALLOWED)
        nome = win32service.GetUserObjectInformation(h, win32con.UOI_NAME)
        h.CloseDesktop()
        return str(nome)
    except Exception as e:
        return 'não (' + str(e)[:80] + ')'


def janelas_tfrm():
    r = []

    def junta(h, _):
        try:
            if win32gui.IsWindowVisible(h):
                cls = win32gui.GetClassName(h)
                if cls.startswith('Tfrm') or cls in ('TMessageForm', '#32770') or cls.startswith('TAlterdata'):
                    x0, y0, x1, y1 = win32gui.GetWindowRect(h)
                    r.append({'h': h, 'classe': cls, 'titulo': (win32gui.GetWindowText(h) or '')[:40], 'x': x0, 'y': y0, 'l': x1 - x0, 'a': y1 - y0,
                              'max': bool(win32gui.GetWindowPlacement(h)[1] == win32con.SW_SHOWMAXIMIZED), 'pid': win32process.GetWindowThreadProcessId(h)[1]})
        except Exception:
            pass
        return True

    win32gui.EnumWindows(junta, None)
    return r


def medidas():
    w, h = tamanho_da_tela()
    atual, aceitos = modos()
    return {'tela': '%dx%d' % (w, h), 'modo': atual, 'modos': aceitos, 'entrada': area_de_trabalho_ativa(),
            'sessao': os.environ.get('SESSIONNAME', '?'), 'janelas': janelas_tfrm()}


def _png(largura, altura, bgra):
    """BGRA (de baixo para cima não: GetBitmapBits devolve de cima para baixo) → PNG RGB."""
    rgb = bytearray(largura * altura * 3)
    rgb[0::3] = bgra[2::4]
    rgb[1::3] = bgra[1::4]
    rgb[2::3] = bgra[0::4]
    linha = largura * 3
    cru = b''.join(b'\x00' + bytes(rgb[y * linha:(y + 1) * linha]) for y in range(altura))

    def bloco(tipo, dados):
        return struct.pack('>I', len(dados)) + tipo + dados + struct.pack('>I', zlib.crc32(tipo + dados) & 0xffffffff)

    return (b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', struct.pack('>IIBBBBB', largura, altura, 8, 2, 0, 0, 0))
            + bloco(b'IDAT', zlib.compress(cru, 6)) + bloco(b'IEND', b''))


def foto(pasta, nome):
    """A tela inteira em <pasta>/<aaaammdd-hhmmss>-<nome>.png. Devolve o caminho, ou '' (e o porquê) se não deu."""
    try:
        os.makedirs(pasta, exist_ok=True)
        if len([f for f in os.listdir(pasta) if f.endswith('.png')]) >= MAX_FOTOS:
            return '', 'a pasta já tem ' + str(MAX_FOTOS) + ' fotos'
        x = win32api.GetSystemMetrics(win32con.SM_XVIRTUALSCREEN)
        y = win32api.GetSystemMetrics(win32con.SM_YVIRTUALSCREEN)
        w = win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN)
        h = win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN)
        hdesk = win32gui.GetDesktopWindow()
        hdc = win32gui.GetWindowDC(hdesk)
        dc = win32ui.CreateDCFromHandle(hdc)
        mem = dc.CreateCompatibleDC()
        bmp = win32ui.CreateBitmap()
        bmp.CreateCompatibleBitmap(dc, w, h)
        mem.SelectObject(bmp)
        mem.BitBlt((0, 0), (w, h), dc, (x, y), win32con.SRCCOPY)
        bits = bmp.GetBitmapBits(True)
        mem.DeleteDC()
        dc.DeleteDC()
        win32gui.ReleaseDC(hdesk, hdc)
        win32gui.DeleteObject(bmp.GetHandle())
        caminho = os.path.join(pasta, time.strftime('%Y%m%d-%H%M%S') + '-' + nome + '.png')
        with open(caminho, 'wb') as f:
            f.write(_png(w, h, bits))
        return caminho, ''
    except Exception as e:
        return '', type(e).__name__ + ': ' + str(e)[:120]


def resumo_do_erro(motivo, nome):
    """O que vai no fim do erro de uma janela que não abriu: a tela, a janela principal, as janelas à mostra e a foto."""
    try:
        pasta = os.environ.get('ALTERDATA_TELA', '')
        m = medidas()
        princ = [j for j in m['janelas'] if j['classe'] == 'TfrmPrincipal']
        outras = [j['classe'] for j in m['janelas'] if j['classe'] != 'TfrmPrincipal']
        partes = ['tela ' + m['tela']]
        if princ:
            partes.append('Contábil ' + str(princ[0]['l']) + 'x' + str(princ[0]['a']) + (' maximizado' if princ[0]['max'] else ''))
        if outras:
            partes.append('à mostra: ' + ', '.join(outras[:6]))
        if m['entrada'].startswith('não'):
            partes.append('sem área de trabalho ativa')
        if pasta:
            caminho, porque = foto(pasta, nome)
            partes.append('foto ' + (caminho or 'não tirada: ' + porque))
        return motivo + ' (' + '; '.join(partes) + ')'
    except Exception as e:
        return motivo + ' (sem a medida da tela: ' + str(e)[:80] + ')'


# A tela do servidor (09/11/2026): o console do NILMA-SERVER tem 1024x768 e o vídeo desliga depois de 15 min sem uso. A
# resolução NÃO é trocada (o teste com 1600x1200 mostrou que posição fixa não serve em largura nenhuma); os roteiros só
# mantêm a tela acesa enquanto rodam.
def preparar_tela():
    """Antes dos cliques de um roteiro: pede ao Windows a tela ligada enquanto o Python roda (o pedido some quando ele sai)
    e mexe o mouse 1 ponto e volta, para acender a tela que já apagou (a mesma técnica do FGTS, f7f359bc). Nada fica
    gravado. Devolve '' (nada a dizer) ou o porquê de não ter dado."""
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000003)   # ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
        win32api.mouse_event(win32con.MOUSEEVENTF_MOVE, 1, 0, 0, 0)
        win32api.mouse_event(win32con.MOUSEEVENTF_MOVE, -1, 0, 0, 0)
        time.sleep(.5)
        return ''
    except Exception as e:
        return 'não acendi a tela: ' + type(e).__name__ + ': ' + str(e)[:120]


def voltar_tela():
    """Compatível com o diagnóstico antigo: não há mais o que voltar."""
    return None


def _ultima_entrada():
    import ctypes

    class LII(ctypes.Structure):
        _fields_ = [('cbSize', ctypes.c_uint), ('dwTime', ctypes.c_uint)]

    x = LII()
    x.cbSize = ctypes.sizeof(LII)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(x))
    return ctypes.windll.kernel32.GetTickCount() - x.dwTime


def _send_clique(x, y):
    """Clique de verdade (SendInput) em (x, y), devolvendo quantos eventos o Windows aceitou e o erro."""
    import ctypes
    from ctypes import wintypes

    class MI(ctypes.Structure):
        _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
                    ('time', wintypes.DWORD), ('dwExtraInfo', ctypes.c_size_t)]

    class _U(ctypes.Union):
        _fields_ = [('mi', MI), ('pad', ctypes.c_byte * 32)]

    class INP(ctypes.Structure):
        _anonymous_ = ('u',)
        _fields_ = [('type', wintypes.DWORD), ('u', _U)]

    ctypes.windll.user32.SetCursorPos(x, y)
    time.sleep(.1)
    evs = (INP * 2)()
    for i, fl in enumerate((0x0002, 0x0004)):   # LEFTDOWN, LEFTUP
        evs[i].type = 0
        evs[i].mi = MI(0, 0, 0, fl, 0, 0)
    ctypes.windll.kernel32.SetLastError(0)
    n = ctypes.windll.user32.SendInput(2, evs, ctypes.sizeof(INP))
    return n, ctypes.windll.kernel32.GetLastError()


def _topo():
    """As janelas visíveis de cima para baixo (classe, pid, posição, ligada, sempre-no-topo), até 15."""
    r = []
    h = win32gui.GetTopWindow(0)
    while h and len(r) < 15:
        try:
            if win32gui.IsWindowVisible(h):
                x0, y0, x1, y1 = win32gui.GetWindowRect(h)
                if x1 - x0 > 0 and y1 - y0 > 0:
                    ex = win32gui.GetWindowLong(h, win32con.GWL_EXSTYLE)
                    r.append('%s pid %d %d,%d %dx%d%s%s%s' % (win32gui.GetClassName(h), win32process.GetWindowThreadProcessId(h)[1], x0, y0, x1 - x0, y1 - y0,
                             '' if win32gui.IsWindowEnabled(h) else ' DESLIGADA', ' topo' if ex & win32con.WS_EX_TOPMOST else '',
                             ' transparente' if ex & win32con.WS_EX_TRANSPARENT else ''))
        except Exception:
            pass
        h = win32gui.GetWindow(h, win32con.GW_HWNDNEXT)
    return r


def _clique(pasta):
    """Sonda (09/11/2026: o clique na aba "Livros e Relatórios" não trocava a aba): o estado da janela principal e três
    jeitos de trocar de aba, com uma foto depois de cada um: o SendInput (como os roteiros), a mensagem de clique na
    faixa e a tecla Alt (as letras das KeyTips). Só troca a aba à mostra e fecha as letras com Esc."""
    from pywinauto import Desktop, keyboard
    d = Desktop(backend='win32')
    princ = [w for w in d.windows() if w.is_visible() and w.class_name() == 'TfrmPrincipal']
    if len(princ) != 1:
        print('CLIQUE: ' + str(len(princ)) + ' janelas principais; não cliquei', flush=True)
        return
    p = princ[0]
    h = p.handle
    fg = win32gui.GetForegroundWindow()
    print('CLIQUE: principal ligada=%s, em primeiro plano=%s (%s), cursor %s, sem entrada há %d ms' % (
        bool(win32gui.IsWindowEnabled(h)), fg == h, win32gui.GetClassName(fg) if fg else '-', win32api.GetCursorPos(), _ultima_entrada()), flush=True)
    print('TOPO: ' + ' | '.join(_topo()), flush=True)
    print('ACENDER: ' + (preparar_tela() or 'ok'), flush=True)
    try:
        p.set_focus()
    except Exception as e:
        print('CLIQUE: set_focus falhou: ' + str(e)[:120], flush=True)
    time.sleep(.5)
    fg = win32gui.GetForegroundWindow()
    print('CLIQUE: depois do set_focus, em primeiro plano=%s (%s)' % (fg == h, win32gui.GetClassName(fg) if fg else '-'), flush=True)
    r = p.rectangle()
    ox, oy = r.left + 8, r.top + 8
    # a) SendInput na aba Livros e Relatórios (x 288 em 1024 e em 1600, pela foto)
    n, err = _send_clique(ox + 288, oy + 47)
    time.sleep(1.5)
    print('CLIQUE: a) SendInput em Livros: %d de 2 eventos, erro %d, cursor %s, sem entrada há %d ms; foto %s' % (
        n, err, win32api.GetCursorPos(), _ultima_entrada(), foto(pasta, 'clique-a-sendinput')[0]), flush=True)
    # b) a mensagem de clique na faixa (filho com Ribbon na classe) na aba Lançamentos
    faixa = [c for c in p.children() if 'Ribbon' in c.class_name()]
    if faixa:
        fh = faixa[0].handle
        cx, cy = win32gui.ScreenToClient(fh, (ox + 99, oy + 47))
        lp = win32api.MAKELONG(cx, cy)
        win32gui.PostMessage(fh, win32con.WM_MOUSEMOVE, 0, lp)
        win32gui.PostMessage(fh, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, lp)
        win32gui.PostMessage(fh, win32con.WM_LBUTTONUP, 0, lp)
        time.sleep(1.5)
        print('CLIQUE: b) mensagem em Lançamentos (%s): foto %s' % (faixa[0].class_name(), foto(pasta, 'clique-b-mensagem')[0]), flush=True)
    else:
        print('CLIQUE: b) sem a faixa de opções entre os filhos: ' + ', '.join(sorted({c.class_name() for c in p.children()}))[:300], flush=True)
    # c) Alt: as letras das KeyTips aparecem?
    keyboard.send_keys('{VK_MENU}')
    time.sleep(1.2)
    print('CLIQUE: c) Alt: foto %s' % foto(pasta, 'clique-c-alt')[0], flush=True)
    keyboard.send_keys('{ESC}{ESC}')
    time.sleep(.5)


def _abas(pasta):
    """Clica nas abas Consultas e Livros e Relatórios do Contábil (as mesmas posições dos roteiros) e fotografa cada uma."""
    from pywinauto import Desktop, mouse
    d = Desktop(backend='win32')
    princ = [w for w in d.windows() if w.is_visible() and w.class_name() == 'TfrmPrincipal']
    if len(princ) != 1:
        print('ABAS: ' + str(len(princ)) + ' janelas principais do Contábil; não cliquei', flush=True)
        return
    p = princ[0]
    p.set_focus()
    time.sleep(.5)
    r = p.rectangle()
    ox, oy = r.left + 8, r.top + 8
    for nome, x in (('consultas', 188), ('livros', 288)):
        mouse.click(coords=(ox + x, oy + 47))
        time.sleep(1.2)
        caminho, porque = foto(pasta, 'aba-' + nome)
        print('FOTO: ' + (caminho or 'não tirada: ' + porque), flush=True)


def _uia(saida):
    """Os nomes e posições dos itens da faixa de opções do Contábil pelo UI Automation (se o DevExpress os expõe)."""
    from pywinauto import Desktop
    princ = [w for w in Desktop(backend='uia').windows() if w.element_info.class_name == 'TfrmPrincipal']
    if not princ:
        print('UIA: sem a janela principal', flush=True)
        return
    linhas = []
    limite = time.time() + 60
    for c in princ[0].descendants():
        if time.time() > limite:
            linhas.append('… parei em 60 s')
            break
        try:
            e = c.element_info
            r = e.rectangle
            linhas.append('%s | %s | %s | %d,%d,%d,%d' % (e.control_type, e.class_name, (e.name or '')[:60], r.left, r.top, r.right, r.bottom))
        except Exception:
            pass
        if len(linhas) > 3000:
            break
    with open(saida, 'w', encoding='utf-8') as f:
        f.write('\n'.join(linhas))
    print('UIA: ' + str(len(linhas)) + ' itens em ' + saida, flush=True)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    pasta = sys.argv[1]
    pedidos = sys.argv[2:] or ['foto']
    print('TELA: ' + json.dumps(medidas(), ensure_ascii=False), flush=True)
    if 'acender' in pedidos:
        print('ACENDER: ' + (preparar_tela() or 'ok'), flush=True)
    if 'foto' in pedidos:
        caminho, porque = foto(pasta, 'diagnostico')
        print('FOTO: ' + (caminho or 'não tirada: ' + porque), flush=True)
    if 'uia' in pedidos:
        try:
            _uia(os.path.join(pasta, time.strftime('%Y%m%d-%H%M%S') + '-uia.txt'))
        except Exception as e:
            print('UIA: erro ' + type(e).__name__ + ': ' + str(e)[:200], flush=True)
    if 'abas' in pedidos:
        try:
            _abas(pasta)
        except Exception as e:
            print('ABAS: erro ' + type(e).__name__ + ': ' + str(e)[:200], flush=True)
    if 'clique' in pedidos:
        try:
            _clique(pasta)
        except Exception as e:
            print('CLIQUE: erro ' + type(e).__name__ + ': ' + str(e)[:200], flush=True)
