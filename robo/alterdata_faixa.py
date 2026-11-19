# A faixa de opções do Alterdata Contábil pelo NOME dos botões, não pela posição (09/11/2026).
#
# O que aconteceu (06/11 17:07 a 09/11): os roteiros clicavam em posições medidas no PC (1366x768). No servidor, o Contábil
# foi aberto no console (1024x768) e a faixa se montou de outro jeito: o clique do Balancete Dinâmico (x 330, y 110) caiu
# em "Conferências de Saldos (ECD)", que abriu a TConferenciaSaldosECDView atrás da janela principal e deixou a principal
# DESLIGADA (modal). Daí em diante nenhum clique pegava (a sonda de 09/11: "TfrmPrincipal DESLIGADA | TConferenciaSaldosECDView")
# e todo pedido dava "não abriu", o Razão inclusive.
#
# Agora:
#   - liberar(): se a principal está desligada, fecha (o X, WM_CLOSE) as janelas do Contábil que estão na frente dela e
#     responde "Não"/"Cancelar" a pergunta que aparecer; só janelas do processo do Contábil, nunca Sim/Gravar;
#   - aba(nome) e botao(nome): acham a aba e o botão pelo nome que o Contábil expõe ao UI Automation (o DevExpress publica:
#     TabItem "Livros e Relatórios", Button "Balancete Dinâmico"…) e clicam no meio deles, seja qual for a largura da tela;
#   - item_do_menu(nome): o item do menu que um botão de lista (Razão ▾) abre, também pelo nome.
#
# 19/11/2026 (o dono entrou no servidor por acesso remoto com o robô rodando): o Balancete Dinâmico parou no meio ("There is
# no active desktop") e deixou a consulta (TfrmBalanceteDinamicoConsulta) e a novidade do Alterdata (TfrmAvaNotificacaoEstendida)
# abertas por cima da faixa; o clique do Razão em "Livros e Relatórios" caiu nelas e a aba à mostra continuou "Consultas".
# Agora, antes de clicar na faixa:
#   - abrir_caminho(): fecha (WM_CLOSE, sem mouse) as consultas, visualizações e avisos do Alterdata que ficaram abertos,
#     do robô ou de quem usou o servidor (são só consulta: nada a salvar);
#   - o ponto do clique é conferido (WindowFromPoint): se outra janela está por cima da faixa, fecha a que pode fechar,
#     minimiza a de outro programa e, se não sair, para com o nome dela em vez de clicar no lugar errado;
#   - a aba que não trocou com o clique troca pelo UI Automation (selecionar), que não depende da posição nem da escala.
import ctypes
import time
from ctypes import wintypes

import win32con
import win32gui
import win32process
from pywinauto import Desktop, mouse

NAO = ('Não', 'Nao', '&Não', '&Nao', 'Cancelar', '&Cancelar')
# as janelas do Alterdata que são só consulta, visualização ou aviso: fechar não perde nada
FECHAVEIS = ('TfrmBalanceteDinamicoConsulta', 'TAlterdataTppPrintPreview', 'TfrmAvaNotificacaoEstendida')


def _fechavel(cls):
    return cls in FECHAVEIS or cls.startswith('TfrmAvaNotificacao')


class Falha(Exception):
    pass


def _pid(h):
    return win32process.GetWindowThreadProcessId(h)[1]


def _do_contabil(pid, fora=()):
    """As janelas de cima, visíveis e com tamanho, do processo do Contábil (menos as de `fora`)."""
    r = []

    def junta(h, _):
        try:
            if h not in fora and win32gui.IsWindowVisible(h) and _pid(h) == pid and win32gui.GetClassName(h) != 'TApplication':
                x0, y0, x1, y1 = win32gui.GetWindowRect(h)
                if x1 > x0 and y1 > y0:
                    r.append(h)
        except Exception:
            pass
        return True

    win32gui.EnumWindows(junta, None)
    return r


def _botao_nao(h):
    achou = []

    def ver(c, _):
        if (win32gui.GetWindowText(c) or '').strip() in NAO and win32gui.IsWindowVisible(c):
            achou.append(c)
        return True

    try:
        win32gui.EnumChildWindows(h, ver, None)
    except Exception:
        pass
    return achou[0] if achou else None


def liberar(principal):
    """A principal desligada (uma janela modal do Contábil na frente, às vezes escondida atrás dela): fecha essas janelas.
    Devolve a lista das classes fechadas (vazia se a principal já estava ligada). Falha se não ligar."""
    h = principal.handle
    if win32gui.IsWindowEnabled(h):
        return []
    pid = _pid(h)
    fechadas = []
    for _ in range(4):
        outras = _do_contabil(pid, fora=(h,))
        for o in outras:
            cls = win32gui.GetClassName(o)
            nao = _botao_nao(o) if cls in ('TMessageForm', '#32770') else None
            if nao:
                win32gui.PostMessage(nao, win32con.BM_CLICK, 0, 0)
                fechadas.append(cls + ' (Não)')
            else:
                win32gui.PostMessage(o, win32con.WM_CLOSE, 0, 0)
                fechadas.append(cls)
        time.sleep(1.5)
        if win32gui.IsWindowEnabled(h):
            return fechadas
    if not win32gui.IsWindowEnabled(h):
        raise Falha('o Contábil está travado por uma janela que não fechou (' + ', '.join(win32gui.GetClassName(o) for o in _do_contabil(pid, fora=(h,))) + ')')
    return fechadas


def abrir_caminho(principal):
    """Fecha as consultas, visualizações e avisos do Alterdata abertos por cima da principal (de um pedido que parou no meio
    ou de quem usou o servidor). Sem mouse (WM_CLOSE): dá certo até sem área de trabalho. Devolve as classes fechadas."""
    pid = _pid(principal.handle)
    alvos = []

    def junta(h, _):
        try:
            if h != principal.handle and win32gui.IsWindowVisible(h):
                cls = win32gui.GetClassName(h)
                # a novidade do Alterdata pode vir de outro programa do Alterdata; as consultas, só do Contábil
                if (cls.startswith('TfrmAvaNotificacao') or (_pid(h) == pid and _fechavel(cls))):
                    alvos.append(h)
        except Exception:
            pass
        return True

    win32gui.EnumWindows(junta, None)
    fechadas = []
    for h in alvos:
        try:
            fechadas.append(win32gui.GetClassName(h))
            win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
        except Exception:
            pass
    limite = time.time() + 4
    while alvos and time.time() < limite:
        time.sleep(.25)
        alvos = [h for h in alvos if win32gui.IsWindow(h) and win32gui.IsWindowVisible(h)]
    return fechadas


def _raiz_no_ponto(x, y):
    u = ctypes.windll.user32
    u.WindowFromPoint.restype = ctypes.c_void_p
    u.WindowFromPoint.argtypes = [wintypes.POINT]
    u.GetAncestor.restype = ctypes.c_void_p
    u.GetAncestor.argtypes = [ctypes.c_void_p, ctypes.c_uint]
    h = u.WindowFromPoint(wintypes.POINT(int(x), int(y)))
    return int(u.GetAncestor(ctypes.c_void_p(h), 2) or 0) if h else 0   # GA_ROOT


def _livre(principal, x, y, oque):
    """O ponto (x, y) mostra a principal do Contábil? Se outra janela está por cima: a que pode fechar fecha, a de outro
    programa minimiza; se continuar, Falha com o nome dela (antes o clique caía nela e o roteiro seguia às cegas)."""
    h = principal.handle
    for _ in range(3):
        r = _raiz_no_ponto(x, y)
        if not r or r == h:
            return
        try:
            cls = win32gui.GetClassName(r)
        except Exception:
            return   # a janela sumiu entre uma leitura e outra
        if _fechavel(cls):
            win32gui.PostMessage(r, win32con.WM_CLOSE, 0, 0)
        elif _pid(r) == _pid(h):
            # outra janela do próprio Contábil (uma dica, um menu): o clique segue como antes, só fica no log
            print('TELA: no ponto do ' + oque + ' está a janela ' + cls + ' do Contábil; cliquei assim mesmo', flush=True)
            return
        elif win32gui.GetWindowLong(r, win32con.GWL_STYLE) & win32con.WS_MINIMIZEBOX:
            win32gui.ShowWindow(r, win32con.SW_MINIMIZE)
        else:
            # sem minimizar (um aviso de outro programa): a principal para a frente e confere de novo
            try:
                principal.set_focus()
            except Exception:
                pass
        time.sleep(.8)
    r = _raiz_no_ponto(x, y)
    if r and r != h and _pid(r) != _pid(h):
        raise Falha('a janela ' + win32gui.GetClassName(r) + ' (' + (win32gui.GetWindowText(r) or '')[:40] + ') está na frente do '
                    + oque + ' e não saiu; não cliquei')


def _clicar_livre(principal, e, oque, embaixo=False):
    x, y = _meio(e, embaixo)
    _livre(principal, x, y, oque)
    mouse.click(coords=(x, y))


def _selecionar(aba_uia, trocou):
    """Troca a aba sem o mouse: o Select do UI Automation ou a ação padrão (o mesmo que o clique) do MSAA; cada jeito é
    conferido por trocou() antes do próximo. Devolve se trocou."""
    for jeito in (lambda: aba_uia.iface_selection_item.Select(), lambda: aba_uia.iface_legacy_iaccessible.DoDefaultAction()):
        try:
            jeito()
        except Exception:
            continue
        if trocou(3):
            return True
    return False


def _uia(h):
    return Desktop(backend='uia').window(handle=h)


def _faixa(principal):
    w = _uia(principal.handle)
    for c in w.children():
        if c.element_info.class_name == 'TdxRibbon':
            return c
    raise Falha('não achei a faixa de opções do Contábil (TdxRibbon) pelo UI Automation')


def _nome(e):
    try:
        return (e.element_info.name or '').replace('&', '').strip()
    except Exception:
        return ''


def _meio(e, embaixo=False):
    r = e.rectangle()
    x = (r.left + r.right) // 2
    y = r.bottom - 6 if embaixo else (r.top + r.bottom) // 2
    return x, y


def _aba_ativa(faixa):
    """O nome da aba à mostra: o grupo de botões (TdxRibbonGroupsDockControl) leva o nome dela."""
    for c in faixa.descendants():
        if c.element_info.class_name == 'TdxRibbonGroupsDockControl':
            return _nome(c)
    return ''


def aba(principal, nome):
    fechadas = abrir_caminho(principal)
    if fechadas:
        print('TELA: fechei o que estava aberto por cima do Contábil: ' + ', '.join(fechadas), flush=True)
    faixa = _faixa(principal)
    if _aba_ativa(faixa) == nome:
        return
    abas = [t for t in faixa.descendants(control_type='TabItem')]
    alvo = [t for t in abas if _nome(t) == nome]
    if not alvo:
        raise Falha('não achei a aba "' + nome + '" (abas: ' + ', '.join(_nome(t) for t in abas) + ')')

    def trocou(segundos):
        limite = time.time() + segundos
        while time.time() < limite:
            if _aba_ativa(_faixa(principal)) == nome:
                time.sleep(.3)
                return True
            time.sleep(.25)
        return False

    _clicar_livre(principal, alvo[0], 'aba "' + nome + '"')
    if trocou(5):
        return
    # o clique não trocou a aba (a escala da tela mudou, uma janela passou na frente): pelo UI Automation, sem posição
    antes = _aba_ativa(_faixa(principal))
    if _selecionar(alvo[0], trocou):
        print('TELA: a aba "' + nome + '" não trocou com o clique (à mostra: "' + antes + '"); troquei pelo UI Automation', flush=True)
        return
    raise Falha('cliquei na aba "' + nome + '" e ela não ficou à mostra (à mostra: "' + _aba_ativa(_faixa(principal)) + '")')


def botao(principal, nome, embaixo=False, pedacos=None):
    """Clica no botão da aba à mostra pelo nome (embaixo=True: na parte de baixo, a seta de um botão de lista). Com
    pedacos (ex.: ('importa', 'financ')), sem o nome exato vale o único item cujo nome tem todos os pedaços."""
    faixa = _faixa(principal)
    # os botões de lista (Razão ▾, Balancete ▾, Diário ▾…) não vêm como Button no UI Automation (09/11/2026: a lista de
    # Button da aba Livros e Relatórios não tinha o Razão): vale qualquer item com o nome, menos aba, grupo e texto
    fora = ('TabItem', 'Tab', 'ToolBar', 'Pane', 'Text', 'TitleBar', 'Custom')
    bs = [b for b in faixa.descendants() if b.element_info.control_type not in fora and b.is_visible()]
    alvo = [b for b in bs if _nome(b) == nome]
    if not alvo and pedacos:
        parecidos = [b for b in bs if all(p in _nome(b).lower() for p in pedacos)]
        if len({_nome(b) for b in parecidos}) == 1:
            alvo = parecidos
    if not alvo:
        raise Falha('não achei o botão "' + nome + '" na aba "' + _aba_ativa(faixa) + '" (itens: ' + ', '.join(_nome(b) + '/' + str(b.element_info.control_type) for b in bs if _nome(b))[:400] + ')')
    _clicar_livre(principal, alvo[0], 'botão "' + nome + '"', embaixo)
    return alvo[0]


def item_do_menu(principal, nome, segundos=6, primeiro_se_mudo=False):
    """O item do menu que acabou de abrir (uma janela do Contábil fora da principal) pelo nome; clica nele."""
    pid = _pid(principal.handle)
    limite = time.time() + segundos
    vistos = []
    while time.time() < limite:
        for h in _do_contabil(pid, fora=(principal.handle,)):
            try:
                itens = _uia(h).descendants()
            except Exception:
                continue
            vistos = [_nome(i) + '/' + str(i.element_info.control_type) for i in itens if _nome(i)]
            alvo = [i for i in itens if _nome(i) == nome and i.element_info.control_type not in ('Pane', 'ToolBar', 'Menu', 'Window', 'Text')]
            if alvo:
                mouse.click(coords=_meio(alvo[0]))
                return True
        time.sleep(.3)
    # o menu abriu mas não diz os nomes ao UI Automation: o primeiro item (como o caminho que o Vitor ensinou, medido no
    # PC: o item fica logo abaixo do botão); quem chamou confere a janela que abriu
    menus = _do_contabil(pid, fora=(principal.handle,))
    if primeiro_se_mudo and len(menus) == 1 and not vistos:
        x0, y0, x1, y1 = win32gui.GetWindowRect(menus[0])
        mouse.click(coords=(x0 + min(40, (x1 - x0) // 2), y0 + 12))
        return 'primeiro'
    raise Falha('o menu não mostrou "' + nome + '"' + (' (itens: ' + ', '.join(vistos)[:300] + ')' if vistos else ' (nenhum menu abriu)' if not menus else ' (o menu abriu sem nomes: ' + ', '.join(win32gui.GetClassName(m) for m in menus) + ')'))


def botao_da_janela(janela_win32, nome):
    """Um botão de barra (DevExpress) dentro de uma janela do Contábil pelo nome (Exportar, Configuração…), ou None."""
    try:
        for b in _uia(janela_win32.handle).descendants(control_type='Button'):
            if _nome(b) == nome and b.is_visible():
                return b
    except Exception:
        pass
    return None


def clicar(e, embaixo=False):
    mouse.click(coords=_meio(e, embaixo))
