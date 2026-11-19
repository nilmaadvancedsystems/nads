# A sessão do Windows do robô do Alterdata antes de clicar e depois de um erro (19/11/2026). O dono entrou no servidor por
# área de trabalho remota de um notebook (outra resolução, 200%) enquanto o robô rodava, e os pedidos falharam no meio:
#   - ao conectar, a sessão do robô passa a ser a do acesso remoto: a tela vira a do notebook (2880x1800, 200%), o Contábil
#     se redesenha (as janelas trocam de handle: "Handle … is not a vaild window handle", "Window … is not responding!") e o
#     mouse de quem está conectado disputa com o do robô;
#   - ao desconectar, a sessão fica sem área de trabalho ativa ("There is no active desktop required for moving mouse
#     cursor!") até o robô passar a sessão para o console (tscon) e o Contábil se redesenhar de novo.
# Este módulo só olha a sessão (e, desconectada, a passa para o console, como o sessao-no-console.js):
#   - situacao(): a sessão, se está ativa, desconectada ou remota, se é a do console, a tela, a escala e a área de trabalho;
#   - garantir(servidor): antes dos cliques; desconectada → tscon para o console e espera a tela parar; com alguém
#     conectado por acesso remoto (no servidor) → Ocupada, com a frase clara (nunca clica junto com uma pessoa);
#   - python alterdata_sessao.py [--garantir] [--servidor] → SESSAO: {json} (e, com --garantir, RESULTADO: {ok, erro}).
# Só ctypes (sem o pywin32): roda e se testa em qualquer Windows.
import ctypes
import json
import os
import subprocess
import sys
import time
from ctypes import wintypes

REMOTO = 'alguém está usando o servidor por acesso remoto'
SEM_TELA = 'o servidor está sem sessão de tela ativa'
ESTADOS = {0: 'ativa', 1: 'conectada', 2: 'conectando', 3: 'espelhada', 4: 'desconectada', 5: 'ociosa', 6: 'escutando',
           7: 'reiniciando', 8: 'caída', 9: 'iniciando'}
_WTS_CONNECT_STATE = 8
_WTS_CLIENT_PROTOCOL = 16
_SM_REMOTESESSION = 0x1000


class Ocupada(Exception):
    """Alguém está conectado à sessão do robô por acesso remoto."""


class SemTela(Exception):
    """A sessão não tem área de trabalho ativa (nem depois de ir para o console)."""


def _dpi_real():
    """Mede em pixels de verdade (como o pywinauto, que liga o DPI por monitor): sem isso, a 200% a tela de 2880x1800 seria
    lida como 1440x900. Já ligado (o pywinauto veio antes), o Windows recusa e fica como está."""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def _wts_int(sessao, classe, curto=False):
    wts = ctypes.windll.wtsapi32
    buf = ctypes.c_void_p()
    n = wintypes.DWORD()
    if not wts.WTSQuerySessionInformationW(None, wintypes.DWORD(sessao), classe, ctypes.byref(buf), ctypes.byref(n)) or not buf.value:
        return None
    try:
        tipo = ctypes.c_ushort if curto else ctypes.c_int
        return ctypes.cast(buf, ctypes.POINTER(tipo)).contents.value
    finally:
        wts.WTSFreeMemory(buf)


def _entrada():
    """Se a sessão tem a área de trabalho que recebe o mouse e o teclado (desconectada ou bloqueada: não)."""
    u = ctypes.windll.user32
    u.OpenInputDesktop.restype = ctypes.c_void_p
    h = u.OpenInputDesktop(0, False, 0x0100)   # DESKTOP_SWITCHDESKTOP
    if not h:
        return False
    try:
        return bool(u.SwitchDesktop(ctypes.c_void_p(h)))
    finally:
        u.CloseDesktop(ctypes.c_void_p(h))


def situacao():
    """{sessao, estado, ativa, desconectada, remota, console, tela, escala, entrada} desta sessão, agora."""
    _dpi_real()
    k = ctypes.windll.kernel32
    u = ctypes.windll.user32
    sid = wintypes.DWORD(0)
    k.ProcessIdToSessionId(k.GetCurrentProcessId(), ctypes.byref(sid))
    sid = sid.value
    estado = _wts_int(sid, _WTS_CONNECT_STATE)
    protocolo = _wts_int(sid, _WTS_CLIENT_PROTOCOL, curto=True)
    try:
        dpi = int(u.GetDpiForSystem())
    except Exception:
        dpi = 96
    return {
        'sessao': sid,
        'estado': ESTADOS.get(estado, str(estado)),
        'ativa': estado == 0,
        'desconectada': estado == 4,
        # protocolo 2 = RDP; o SM_REMOTESESSION confirma (no console os dois são 0)
        'remota': protocolo == 2 or bool(u.GetSystemMetrics(_SM_REMOTESESSION)),
        'console': int(k.WTSGetActiveConsoleSessionId()) == sid,
        'tela': '%dx%d' % (u.GetSystemMetrics(0), u.GetSystemMetrics(1)),
        'escala': round(dpi * 100 / 96),
        'entrada': _entrada(),
    }


def com_alguem(s):
    """A sessão está sendo usada por acesso remoto agora (conectada e remota)."""
    return bool(s.get('remota')) and bool(s.get('ativa'))


def frase_remoto(s):
    return (REMOTO + ' (a sessão do robô está conectada pela área de trabalho remota, tela ' + str(s.get('tela')) + ' a '
            + str(s.get('escala')) + '%); o robô não clica no Contábil enquanto alguém usa a tela. Para liberar, feche a '
            'janela da conexão remota (desconectar, sem sair do Windows)')


def _tscon(sid):
    """Passa a sessão para o console (o mesmo que o sessao-no-console.js). Devolve '' ou o porquê de não ter dado."""
    sysnativo = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Sysnative', 'tscon.exe')   # Python de 32 bits
    for exe in ('tscon', sysnativo):
        try:
            r = subprocess.run([exe, str(sid), '/dest:console'], capture_output=True, timeout=30, creationflags=0x08000000)
            return '' if r.returncode == 0 else (r.stderr or r.stdout or b'').decode('cp850', 'replace').strip()[:200] or 'saiu com ' + str(r.returncode)
        except FileNotFoundError:
            continue
        except Exception as e:
            return type(e).__name__ + ': ' + str(e)[:120]
    return 'não achei o tscon'


def garantir(servidor=None, segundos=45, parada=2.0, avisar=None):
    """Antes dos cliques: a sessão com área de trabalho ativa e a tela parada. Devolve a situação.
    - alguém conectado por acesso remoto (só no servidor): Ocupada;
    - desconectada: passa para o console e espera a área de trabalho voltar e a tela ficar `parada` segundos sem mudar de
      tamanho (o Contábil se redesenha na resolução do console);
    - sem área de trabalho depois de `segundos`: SemTela."""
    if servidor is None:
        servidor = os.environ.get('ALTERDATA_SERVIDOR') == '1'
    avisar = avisar or (lambda t: None)
    s = situacao()
    if servidor and com_alguem(s):
        raise Ocupada(frase_remoto(s))
    if s['entrada'] and not s['desconectada']:
        return s
    if s['desconectada']:
        porque = _tscon(s['sessao'])
        avisar('a sessão ' + str(s['sessao']) + ' estava desconectada: ' + ('passei para o console' if not porque else 'o tscon não deu (' + porque + ')'))
    limite = time.time() + segundos
    anterior, desde = None, 0.0
    while time.time() < limite:
        time.sleep(.5)
        s = situacao()
        if servidor and com_alguem(s):
            raise Ocupada(frase_remoto(s))
        if not s['entrada'] or s['desconectada']:
            anterior = None
            continue
        if s['tela'] != anterior:
            anterior, desde = s['tela'], time.time()
        elif time.time() - desde >= parada:
            avisar('a tela voltou (' + s['tela'] + ', ' + str(s['escala']) + '%)')
            return s
    raise SemTela(SEM_TELA + ' (sessão ' + str(s['sessao']) + ' ' + s['estado'] + ', esperei ' + str(segundos) + ' s pela área de trabalho)')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--garantir' in sys.argv:
        try:
            s = garantir('--servidor' in sys.argv, avisar=lambda t: print('TELA: ' + t, flush=True))
            print('SESSAO: ' + json.dumps(s, ensure_ascii=False), flush=True)
            print('RESULTADO: ' + json.dumps({'ok': True}), flush=True)
        except (Ocupada, SemTela) as e:
            print('SESSAO: ' + json.dumps(situacao(), ensure_ascii=False), flush=True)
            print('RESULTADO: ' + json.dumps({'ok': False, 'erro': str(e), 'remoto': isinstance(e, Ocupada)}, ensure_ascii=False), flush=True)
    else:
        print('SESSAO: ' + json.dumps(situacao(), ensure_ascii=False), flush=True)
