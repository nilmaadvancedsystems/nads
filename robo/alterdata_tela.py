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
#   python alterdata_tela.py <pasta das fotos> [largura] [foto] [abas] [uia]
# (largura: passa a tela para 1366x768 como os roteiros fazem, só enquanto o diagnóstico roda)
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


# Os cliques dos roteiros são posições na faixa de opções do Contábil medidas no PC do escritório, que tem 1366x768. No
# servidor, a sessão do robô vai para o console (tscon, sessao-no-console.js) e o console tem 1024x768 (o registro do vídeo
# do servidor só guarda esse modo): o Contábil aberto ali monta a faixa de opções para 1024 de largura, os botões mudam de
# lugar e nenhum relatório abre (06/11/2026 17:07 em diante). Até 05/11 dava certo porque o Contábil tinha sido aberto na
# Área de Trabalho Remota (1366 de largura) e continuava montado assim depois do tscon.
LARGURA_DOS_CLIQUES, ALTURA_DOS_CLIQUES = 1366, 768
_mudou_a_tela = False


def _voltar_tela():
    global _mudou_a_tela
    if _mudou_a_tela:
        _mudou_a_tela = False
        try:
            win32api.ChangeDisplaySettings(None, 0)   # volta ao modo gravado no Windows (o de sempre)
        except Exception:
            pass


def _modo_para_os_cliques():
    """O modo de vídeo que a placa aceita com pelo menos 1366x768: o 1366x768 se houver, senão o menor que caiba."""
    melhor = None
    i = 0
    while i < 500:
        try:
            m = win32api.EnumDisplaySettings(None, i)
        except Exception:
            break
        i += 1
        if m.PelsWidth < LARGURA_DOS_CLIQUES or m.PelsHeight < ALTURA_DOS_CLIQUES:
            continue
        chave = (m.PelsWidth != LARGURA_DOS_CLIQUES or m.PelsHeight != ALTURA_DOS_CLIQUES, m.PelsWidth * m.PelsHeight, -m.BitsPerPel)
        if melhor is None or chave < melhor[0]:
            melhor = (chave, m)
    return melhor[1] if melhor else None


def preparar_tela():
    """Antes dos cliques de um roteiro: a tela fica acesa enquanto ele roda (o pedido some quando o Python sai) e, se a
    tela tem menos de 1366x768, passa para 1366x768 SÓ ENQUANTO O ROTEIRO RODA (CDS_FULLSCREEN: não grava nada no Windows
    e o Windows volta sozinho ao modo de sempre quando o processo sai, mesmo morto pelo prazo; o roteiro também volta no
    fim). Depois da troca, o Contábil maximizado é montado de novo na largura nova. Devolve o que fez (para o log) ou ''."""
    global _mudou_a_tela
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000003)   # ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
    except Exception:
        pass
    w, h = tamanho_da_tela()
    if w >= LARGURA_DOS_CLIQUES and h >= ALTURA_DOS_CLIQUES:
        return ''
    m = _modo_para_os_cliques()
    if m is None:
        return 'tela %dx%d e a placa de vídeo não aceita %dx%d (modos: %s): os cliques podem errar' % (w, h, LARGURA_DOS_CLIQUES, ALTURA_DOS_CLIQUES, ' '.join(modos()[1]))
    m.Fields = win32con.DM_PELSWIDTH | win32con.DM_PELSHEIGHT | win32con.DM_BITSPERPEL
    import atexit
    atexit.register(_voltar_tela)
    r = win32api.ChangeDisplaySettings(m, win32con.CDS_FULLSCREEN)
    if r != win32con.DISP_CHANGE_SUCCESSFUL:
        return 'tela %dx%d: a troca para %dx%d não deu (código %s): os cliques podem errar' % (w, h, m.PelsWidth, m.PelsHeight, r)
    _mudou_a_tela = True
    time.sleep(2)
    # o Contábil maximizado acompanha a tela nova; se ficou menor, restaura e maximiza de novo (a faixa de opções se remonta)
    for j in janelas_tfrm():
        if j['classe'] == 'TfrmPrincipal' and j['l'] < m.PelsWidth:
            try:
                hw = j['h']
                win32gui.ShowWindow(hw, win32con.SW_RESTORE)
                time.sleep(.5)
                win32gui.ShowWindow(hw, win32con.SW_MAXIMIZE)
                time.sleep(1.5)
            except Exception:
                pass
    return 'tela %dx%d → %dx%d enquanto o roteiro roda (os cliques são medidos em %dx%d)' % (w, h, m.PelsWidth, m.PelsHeight, LARGURA_DOS_CLIQUES, ALTURA_DOS_CLIQUES)


def voltar_tela():
    _voltar_tela()


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
    if 'largura' in pedidos:
        print('LARGURA: ' + (preparar_tela() or 'a tela já tem a largura dos cliques'), flush=True)
        print('TELA: ' + json.dumps(medidas(), ensure_ascii=False), flush=True)
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
    voltar_tela()
