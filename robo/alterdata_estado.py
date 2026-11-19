# Como está o Alterdata Contábil desta máquina, sem mexer em nada (04/11/2026): o robô do Alterdata só pega um pedido
# quando o Contábil está aberto e logado aqui. Escreve uma linha: ESTADO: ok | login | abrindo | fechado | erro (dois abertos = ok)
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


# o Fiscal aberto no mesmo servidor (16/11/2026) tem janelas com as mesmas classes (TfrmPrincipal, TfrmLogin): só as do
# Contábil (o wcont.exe) contam para o estado dele; as do Fiscal saem numa linha FISCAL: ok | login | fechado
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
    import alterdata_processo

    def _contabil(pid):
        exe = alterdata_processo.exe_do_pid(pid)
        return not exe or os.path.basename(exe) == os.path.basename(alterdata_processo.CONTABIL).lower()

    def _fiscal(pid):
        exe = alterdata_processo.exe_do_pid(pid)
        return '\\alterdata\\' in exe and 'fisc' in exe.split('\\alterdata\\', 1)[1] and not _contabil(pid)
except Exception:
    _contabil = lambda pid: True   # noqa: E731
    _fiscal = lambda pid: False    # noqa: E731
do_fiscal = [j for j in janelas if _fiscal(j[3])]
janelas = [j for j in janelas if _contabil(j[3])]
if any(c.startswith('TfrmLogin') and v for c, v, _, _ in do_fiscal):
    print('FISCAL: login', flush=True)
elif any(c == 'TfrmPrincipal' and v for c, v, _, _ in do_fiscal):
    print('FISCAL: ok', flush=True)
elif any(v for _, v, _, _ in do_fiscal):
    print('FISCAL: abrindo', flush=True)
else:
    print('FISCAL: fechado', flush=True)


def visiveis(cls):
    return [j for j in janelas if j[0] == cls and j[1]]


# TfrmLogin no PC (7.1106); TfrmLoginSimultaneo no servidor (7.1029, 04/11/2026: a principal fica oculta atrás dela)
if any(c.startswith('TfrmLogin') and v for c, v, _, _ in janelas):
    estado = 'login'
elif any(c == 'TfrmEntradaFlash' and v for c, v, _, _ in janelas):
    # a tela "entrando" depois do login (no servidor ela leva um tempo, e às vezes trava): nem fechado nem pronto
    estado = 'abrindo'
else:
    n = len(visiveis('TfrmPrincipal'))
    # mais de um aberto não trava mais (19/11/2026): o roteiro usa um deles
    estado = 'fechado' if n == 0 else 'ok'
    if n > 1:
        print('DOIS: ' + str(n) + ' Contábil abertos (o roteiro usa um deles)', flush=True)
print('ESTADO: ' + estado, flush=True)

# a tela de atualizações que o Alterdata mostra ao abrir (05/11/2026, Vitor: "tem uma tela de atualizacoes, ele tem que
# clicar em ver depois"): só avisa (AVISO: <janela> "<título>"), quem clica é o alterdata_avisos.py. Procura nas janelas
# visíveis dos processos do Alterdata (os que têm uma janela Tfrm) um botão "Ver depois".
VER_DEPOIS = ('ver depois', 'lembrar depois', 'lembre-me depois', 'mais tarde')
try:
    pids = {p for _, _, _, p in janelas}
    topos = []
    win32gui.EnumWindows(lambda h, _: topos.append(h) or True, None)
    for h in topos:
        if not win32gui.IsWindowVisible(h) or win32process.GetWindowThreadProcessId(h)[1] not in pids:
            continue
        achou = []

        def ver(c, _):
            if (win32gui.GetWindowText(c) or '').replace('&', '').strip().lower() in VER_DEPOIS and win32gui.IsWindowVisible(c):
                achou.append(c)
            return True

        win32gui.EnumChildWindows(h, ver, None)
        if achou:
            print('AVISO: ' + str(h) + ' ' + win32gui.GetClassName(h) + ' "' + (win32gui.GetWindowText(h) or '')[:40] + '"', flush=True)
            break
except Exception:
    pass
if estado == 'login':
    # os campos da tela de login (para o roteiro de login do robô): classe e posição; o texto só dos que não são caixa de
    # texto (nunca o que está digitado no usuário ou na senha)
    try:
        h = next(win32gui.FindWindow(c, None) for c, v, _, _ in janelas if c.startswith('TfrmLogin') and v)
        filhos = []

        def filho(c, _):
            cls = win32gui.GetClassName(c)
            r = win32gui.GetWindowRect(c)
            txt = '' if 'Edit' in cls or 'Mask' in cls or 'Combo' in cls else (win32gui.GetWindowText(c) or '')[:25]
            filhos.append(cls + ('"' + txt + '"' if txt else '') + '@' + str(r[0]) + ',' + str(r[1]) + ('' if win32gui.IsWindowVisible(c) else '(oculto)'))
            return True

        win32gui.EnumChildWindows(h, filho, None)
        print('CAMPOS: ' + ' | '.join(filhos[:40]), flush=True)
    except Exception as e:
        print('CAMPOS: ' + type(e).__name__, flush=True)
if estado != 'ok':
    lista = '; '.join(c + ('' if v else ' (oculta)') + (' "' + t + '"' if t else '') + ' pid ' + str(p) for c, v, t, p in janelas[:12])
    print('DIAG: sessão ' + os.environ.get('SESSIONNAME', '?') + ', ' + str(len(janelas)) + ' janelas Tfrm em ' + str(round(time.time() - t0, 1)) + ' s: ' + (lista or 'nenhuma'), flush=True)
