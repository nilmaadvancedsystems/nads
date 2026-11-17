# O lançamento fora do padrão corrigido no Alterdata Fiscal pelo robô (17/11/2026, o caminho que o Vitor gravou: "quero fazer um
# robo que corrige isso... basicamente mudar os lancamentos automaticos para o padrao"). No Fiscal JÁ ABERTO E LOGADO:
#   Lançamentos → Notas Fiscais e Produtos → a empresa (Enter), o tipo, canceladas: Não, o período → Filtrar (aviso: OK) → na
#   grade, o filtro da coluna do CFOP (só os CFOPs da natureza; o período só com as competências das notas fora do padrão) →
#   seleciona tudo e troca TODAS (17/11/2026, regravado com uma nota só) → Editar → "Alterar Notas": o campo "Lanc. Cont. Vl. Contábil", o lançamento padrão
#   (ex.: 215), Adicionar, Aplicar.
#
# Este roteiro MUDA dado no Alterdata. Travas:
# - só troca o "Lanc. Cont. Vl. Contábil" para PADRAO, nas notas que a grade mostra com o filtro do CFOP (ATUAL vai só para o log);
# - antes do Editar, as notas filtradas têm de ser exatamente as que o nads espera (ESPERADO); senão para sem mudar nada;
# - --ensaio: faz tudo até antes do Editar (filtra, conta, descreve a tela) e fecha sem mudar nada;
# - qualquer janela inesperada: para, conta o que viu e fecha a consulta.
#
# Uso: python alterdata_lancamento_padrao.py <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <cfops,separados> <atual> <padrão> <esperado> [--ensaio]
# Escreve PASSO:/CLIQUE:/DIAG: e, no fim, RESULTADO: {"ok":true,"alteradas":n} (ou {"ok":true,"ensaio":true,"achadas":n}) ou {"ok":false,"erro":"…"}.
import glob
import json
import os
import subprocess
import sys
import time
import unicodedata

import win32api
import win32con
import win32gui
from pywinauto import Desktop, keyboard, mouse

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
import alterdata_processo as proc  # noqa: E402

SO_VER = False
ENSAIO = '--ensaio' in sys.argv
ARGS = [a for a in sys.argv[1:] if a != '--ensaio']
CODIGO = ARGS[0] if ARGS else ''
INICIO = ARGS[1] if len(ARGS) > 1 else ''
FIM = ARGS[2] if len(ARGS) > 2 else ''
CFOPS = [c.strip() for c in (ARGS[3] if len(ARGS) > 3 else '').split(',') if c.strip()]
ATUAL = (ARGS[4] if len(ARGS) > 4 else '').strip()
PADRAO = (ARGS[5] if len(ARGS) > 5 else '').strip()
ESPERADO = int(ARGS[6]) if len(ARGS) > 6 and ARGS[6].isdigit() else 0
# entradas (CFOP 1, 2, 3) ou saídas (5, 6, 7): a mesma tela, o tipo da consulta (17/11/2026, Vitor: "educa ele pra ter essa alternancia
# entre entradas e saidas, mas a tela e a mesma")
RELATORIO = 'saidas' if CFOPS and CFOPS[0][:1] in '567' else 'entradas'
DESTINO = ''
NOTAS = True
TELA = 'Notas Fiscais e Produtos'
PEDACOS_DA_TELA = ('notas', 'produtos')
PACK = os.path.dirname(os.path.dirname(proc.CONTABIL))
PROIBIDOS = ('gravar', 'incluir', 'excluir', 'alterar', 'confirmar', 'sim', 'apagar', 'cancelar nota', 'transmitir')

uia = Desktop(backend='uia')


def passo(t):
    print('PASSO: ' + t, flush=True)


def clique(t):
    print('CLIQUE: ' + t, flush=True)


def diag(t):
    # o log do robô corta a linha em 300 caracteres: vai em pedaços
    t = ' '.join(str(t).split())
    while t:
        print('DIAG: ' + t[:260], flush=True)
        t = t[260:]


def fim(**r):
    print('RESULTADO: ' + json.dumps(r, ensure_ascii=False), flush=True)
    sys.exit(0 if r.get('ok') else 1)


def norm(t):
    t = unicodedata.normalize('NFD', str(t or '')).encode('ascii', 'ignore').decode().lower()
    return ' '.join(t.replace('&', '').replace('…', '').replace('...', '').replace(':', ' ').replace('?', ' ').split())


def esperar(teste, segundos, intervalo=0.4):
    limite = time.time() + segundos
    while time.time() < limite:
        x = teste()
        if x:
            return x
        time.sleep(intervalo)
    return None


# ---------- as janelas do Fiscal ----------
def topo_do_fiscal():
    r = []

    def junta(h, _):
        try:
            if win32gui.IsWindowVisible(h) and proc.do_fiscal(h):
                x0, y0, x1, y1 = win32gui.GetWindowRect(h)
                if x1 > x0 and y1 > y0 and win32gui.GetClassName(h) != 'TApplication':
                    r.append(h)
        except Exception:
            pass
        return True

    win32gui.EnumWindows(junta, None)
    return r


def descrever(h):
    try:
        x0, y0, x1, y1 = win32gui.GetWindowRect(h)
        return win32gui.GetClassName(h) + ' "' + (win32gui.GetWindowText(h) or '')[:40] + '" ' + str(x1 - x0) + 'x' + str(y1 - y0)
    except Exception:
        return '?'


def login_do_fiscal():
    return next((h for h in topo_do_fiscal() if win32gui.GetClassName(h).startswith('TfrmLogin')), None)


def principal_do_fiscal():
    hs = [h for h in topo_do_fiscal() if win32gui.GetClassName(h).startswith('Tfrm') and not win32gui.GetClassName(h).startswith('TfrmLogin')]
    if not hs:
        return None
    pref = [h for h in hs if win32gui.GetClassName(h) == 'TfrmPrincipal']

    def area(h):
        x0, y0, x1, y1 = win32gui.GetWindowRect(h)
        return (x1 - x0) * (y1 - y0)
    return max(pref or hs, key=area)


def exe_do_fiscal():
    if os.environ.get('ALTERDATA_WFISCAL'):
        return os.environ['ALTERDATA_WFISCAL']
    achados = []
    for pasta in glob.glob(os.path.join(PACK, '*')):
        if 'fisc' not in os.path.basename(pasta).lower() or not os.path.isdir(pasta):
            continue
        for exe in glob.glob(os.path.join(pasta, '*.exe')):
            n = os.path.basename(exe).lower()
            if any(x in n for x in ('unins', 'atualiz', 'update', 'setup', 'instal', 'config', 'suporte', 'registr')):
                continue
            achados.append(exe)
    diag('o Fiscal em ' + PACK + ': ' + (', '.join(achados) or 'nenhum .exe numa pasta com "fisc" no nome; pastas: ' + ', '.join(os.path.basename(p) for p in glob.glob(os.path.join(PACK, '*')))))
    # o programa do Fiscal é o wfiscal.exe (16/11/2026, no PC do Vitor: na pasta também há o wfiscal1, o importanfe, o DIEF…)
    certo = [e for e in achados if os.path.basename(e).lower() == 'wfiscal.exe']
    w = [e for e in achados if os.path.basename(e).lower().startswith('w')]
    return (certo or w or achados or [''])[0]


def tem_credencial():
    r = subprocess.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'alterdata_login.py'), '--tem'],
                       capture_output=True, text=True, encoding='utf-8', timeout=60)
    return 'TEM: sim' in (r.stdout or '')


def entrar_no_fiscal():
    """O Fiscal aberto e logado: devolve a janela principal (abre e entra com o usuário do robô se precisar)."""
    p = principal_do_fiscal()
    if p:
        # o Fiscal aberto e logado (uma tela de login de outro Fiscal ao lado não importa)
        return p
    # sem a credencial do robô neste PC, abrir o Fiscal não adianta: ele pararia na tela de login (16/11/2026)
    if not tem_credencial():
        fim(ok=False, erro='o Alterdata Fiscal não está aberto e logado neste ' + ('servidor' if os.environ.get('ARQ_SO_SERVIDOR') == '1' else 'PC')
            + ' (e o robô não tem a credencial para entrar): abra o Fiscal, entre e peça de novo')
    if not login_do_fiscal():
        exe = exe_do_fiscal()
        if not exe or not os.path.exists(exe):
            fim(ok=False, erro='o Alterdata Fiscal não está aberto e não achei o programa dele (' + (exe or PACK) + ')')
        passo('abrindo o Alterdata Fiscal')
        clique('abrindo ' + os.path.basename(exe))
        subprocess.Popen([exe], cwd=os.path.dirname(exe), creationflags=0x00000008)   # DETACHED_PROCESS
        h = esperar(lambda: login_do_fiscal() or principal_do_fiscal(), 180, 1)
        if not h:
            fim(ok=False, erro='abri o Alterdata Fiscal e nem a tela de login nem a principal apareceram em 3 min (janelas: ' + '; '.join(descrever(x) for x in topo_do_fiscal()) + ')')
        time.sleep(2)
    lg = login_do_fiscal()
    if lg:
        passo('entrando no Fiscal com o usuário do robô')
        clique('login do Fiscal')
        env = dict(os.environ, ALTERDATA_PID=str(proc.pid_da_janela(lg)))
        r = subprocess.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'alterdata_login.py')],
                           capture_output=True, text=True, encoding='utf-8', env=env, timeout=150)
        linha = next((l for l in r.stdout.splitlines() if l.startswith('RESULTADO:')), '')
        try:
            res = json.loads(linha[len('RESULTADO:'):].strip())
        except Exception:
            res = {'ok': False, 'erro': 'o login parou sem resultado'}
        if not res.get('ok'):
            # login=True só quando a senha foi tentada e recusada: a fila para os próximos (a conta pode ser bloqueada)
            tentou = not str(res.get('erro', '')).startswith('sem a credencial') and not res.get('semTela')
            fim(ok=False, login=tentou, erro='o login do robô no Fiscal não deu: ' + str(res.get('erro', ''))[:200])
    p = esperar(lambda: not login_do_fiscal() and principal_do_fiscal(), 120, 1)
    if not p:
        fim(ok=False, erro='o Fiscal não abriu a janela principal depois do login (janelas: ' + '; '.join(descrever(x) for x in topo_do_fiscal()) + ')')
    time.sleep(3)   # acabou de abrir: deixa carregar
    return p


# ---------- os itens de uma janela pelo UI Automation ----------
def nome(e):
    try:
        return (e.element_info.name or '').strip()
    except Exception:
        return ''


def tipo(e):
    try:
        return str(e.element_info.control_type or '')
    except Exception:
        return ''


def classe(e):
    try:
        return e.element_info.class_name or ''
    except Exception:
        return ''


def caixa(e):
    try:
        r = e.rectangle()
        return r.left, r.top, r.right, r.bottom
    except Exception:
        return 0, 0, 0, 0


def meio(e):
    l, t, r, b = caixa(e)
    return (l + r) // 2, (t + b) // 2


def itens(h):
    try:
        todos = uia.window(handle=h).descendants()
    except Exception:
        return []
    r = []
    for e in todos:
        try:
            if e.is_visible():
                l, t, rr, b = caixa(e)
                if rr > l and b > t:
                    r.append(e)
        except Exception:
            pass
    return r


def contar_tela(h, rotulo):
    """O que tem na janela (para o log): tipo, classe, nome, valor e posição de cada item, os de nome ou de entrada primeiro."""
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    linhas = []
    for e in itens(h):
        n, t = nome(e), tipo(e)
        if not n and t not in ('Edit', 'ComboBox', 'CheckBox', 'RadioButton', 'Button', 'DataItem', 'MenuItem'):
            continue
        l, tp, r, b = caixa(e)
        linhas.append(t + '/' + classe(e) + ('"' + n[:30] + '"' if n else '') + ('=' + valor(e)[:20] if t in ('Edit', 'ComboBox') else '') + '@' + str(l - x0) + ',' + str(tp - y0) + ' ' + str(r - l) + 'x' + str(b - tp))
    diag(rotulo + ' (' + descrever(h) + '), ' + str(len(linhas)) + ' itens: ' + ' | '.join(linhas[:90]))


def valor(e):
    try:
        v = e.get_value() if hasattr(e, 'get_value') else ''
        if v:
            return str(v)
    except Exception:
        pass
    try:
        return (e.window_text() or '').strip()
    except Exception:
        return ''


def entrada(e):
    t, c = tipo(e), classe(e).lower()
    return t in ('Edit', 'ComboBox') or 'edit' in c or 'combo' in c or 'date' in c or 'mask' in c


def rotulo_achado(its, *comecos):
    """O rótulo (Text/Static, ou qualquer item não clicável) cujo nome começa com um dos começos."""
    cs = [norm(x) for x in comecos]
    for e in its:
        if tipo(e) in ('Text', 'Pane', 'Group', 'Custom', '') and any(norm(nome(e)).startswith(c) for c in cs):
            return e
    for e in its:
        if not entrada(e) and tipo(e) not in ('Button', 'MenuItem') and any(norm(nome(e)).startswith(c) for c in cs):
            return e
    return None


def entradas_ao_lado(its, rot, n=1):
    """As caixas à direita do rótulo, na mesma linha (as de dentro de outra caixa não contam), da esquerda para a direita."""
    l, t, r, b = caixa(rot)
    cy = (t + b) // 2
    cands = []
    for e in its:
        if not entrada(e):
            continue
        el, et, er, eb = caixa(e)
        if el >= r - 4 and abs((et + eb) // 2 - cy) <= 12 and el - r < 500:
            cands.append(e)
    # a caixa de fora e a de dentro (TcxTextEdit e o TcxCustomInnerTextEdit): fica a de fora, sem repetir a posição
    vistos, r2 = [], []
    for e in sorted(cands, key=lambda e: caixa(e)[0]):
        el = caixa(e)[0]
        if any(abs(el - v) < 8 for v in vistos):
            continue
        vistos.append(el)
        r2.append(e)
    return r2[:n]


def clicar(e, oque):
    clique(oque)
    if norm(nome(e)) in PROIBIDOS:
        falhar('ia clicar em "' + nome(e) + '", que não é permitido ao robô')
    mouse.click(coords=meio(e))
    time.sleep(.3)


def digitar(e, texto, oque):
    clicar(e, oque)
    keyboard.send_keys('^a{DEL}', pause=0.02)
    keyboard.send_keys(texto, pause=0.03, with_spaces=True)   # só números, datas e "Não": nada que o send_keys leia como tecla
    keyboard.send_keys('{TAB}', pause=0.02)
    time.sleep(.6)


# ---------- mensagens e limpeza ----------
FORM = {'h': None}


def mensagens():
    return [h for h in topo_do_fiscal() if win32gui.GetClassName(h) in ('TMessageForm', '#32770') and (win32gui.GetWindowText(h) or '') not in ('Salvar', 'Salvar como')]


def texto_da_mensagem(h):
    partes = []

    def ver(c, _):
        try:
            if win32gui.IsWindowVisible(c) and win32gui.GetClassName(c) not in ('Button', 'TButton', 'TBitBtn', 'TcxButton'):
                t = (win32gui.GetWindowText(c) or '').strip()
                if t:
                    partes.append(t)
        except Exception:
            pass
        return True
    try:
        win32gui.EnumChildWindows(h, ver, None)
    except Exception:
        pass
    if not partes:
        try:
            partes = [nome(e) for e in itens(h) if tipo(e) == 'Text' and nome(e)]
        except Exception:
            pass
    return ' '.join(partes)[:300] or (win32gui.GetWindowText(h) or '')


def botao_win32(h, *rotulos):
    rs = [norm(r) for r in rotulos]
    achou = []

    def ver(c, _):
        try:
            if win32gui.IsWindowVisible(c) and norm(win32gui.GetWindowText(c)) in rs:
                achou.append(c)
        except Exception:
            pass
        return True
    try:
        win32gui.EnumChildWindows(h, ver, None)
    except Exception:
        pass
    return achou[0] if achou else None


def responder_nao(h):
    b = botao_win32(h, 'Não', 'Nao', 'Cancelar', 'OK', 'Fechar')
    if b:
        x0, y0, x1, y1 = win32gui.GetWindowRect(b)
        mouse.click(coords=((x0 + x1) // 2, (y0 + y1) // 2))
    else:
        win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)


def limpar():
    for h in topo_do_fiscal():
        if (win32gui.GetWindowText(h) or '') in ('Salvar', 'Salvar como'):
            b = botao_win32(h, 'Cancelar')
            if b:
                win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
    for h in mensagens():
        responder_nao(h)
    if FORM['h']:
        try:
            win32gui.PostMessage(FORM['h'], win32con.WM_CLOSE, 0, 0)   # é só consulta: nada a gravar
        except Exception:
            pass


def falhar(motivo):
    try:
        if FORM['h'] and win32gui.IsWindow(FORM['h']):
            contar_tela(FORM['h'], 'a tela quando parou')
    except Exception:
        pass
    try:
        import alterdata_tela
        motivo = alterdata_tela.resumo_do_erro(motivo, 'fiscal-' + RELATORIO)
    except Exception:
        pass
    try:
        limpar()
    except Exception:
        pass
    fim(ok=False, erro=motivo)


def mensagem_na_frente(quando):
    for h in mensagens():
        falhar('o Alterdata Fiscal mostrou uma mensagem ' + quando + ': ' + texto_da_mensagem(h))


# ---------- abrir a tela ----------
def janelas_tfrm_dentro(h):
    r = []

    def ver(c, _):
        try:
            if win32gui.IsWindowVisible(c) and win32gui.GetClassName(c).startswith('Tfrm'):
                r.append(c)
        except Exception:
            pass
        return True
    try:
        win32gui.EnumChildWindows(h, ver, None)
    except Exception:
        pass
    return r


def abrir_a_tela(principal):
    antes_topo = set(topo_do_fiscal())
    antes_dentro = set(janelas_tfrm_dentro(principal))
    caminho = 'Lançamentos → ' + TELA
    passo('abrindo ' + caminho)
    feito = False
    erros = []
    # 1) a faixa de opções (como no Contábil)
    try:
        import alterdata_faixa as fx
        try:
            fechadas = fx.liberar(win32_da(principal))
            if fechadas:
                print('TELA: o Fiscal estava travado por ' + ', '.join(fechadas) + ' (janela na frente da principal): fechei', flush=True)
        except fx.Falha as e:
            falhar(str(e).replace('Contábil', 'Fiscal'))
        clique('aba Lançamentos')
        fx.aba(win32_da(principal), 'Lançamentos')
        clique(TELA)
        fx.botao(win32_da(principal), TELA, pedacos=PEDACOS_DA_TELA)
        feito = True
    except Exception as e:
        erros.append('faixa: ' + str(e)[:300])
    # 2) o menu de cima (Lançamentos ▸ …)
    if not feito:
        try:
            menu_por_nome(principal, ['Lançamentos', TELA])
            feito = True
        except Exception as e:
            erros.append('menu: ' + str(e)[:300])
    if not feito:
        contar_tela(principal, 'a janela principal do Fiscal')
        falhar('não achei ' + caminho + ' (' + ' · '.join(erros) + ')')

    fechados = []

    def nova():
        # os avisos do Alterdata que abrem junto (16/11/2026, no PC do Vitor: a "Apresentação" da Reforma Tributária, só
        # com o Fechar, abriu no lugar da tela): fecha e continua esperando a tela de verdade
        fechar_avisos(fechados)
        for h in topo_do_fiscal():
            if h not in antes_topo and h != principal and win32gui.GetClassName(h).startswith('Tfrm') and not eh_aviso(h):
                return h
        for h in janelas_tfrm_dentro(principal):
            if h not in antes_dentro and not eh_aviso(h):
                return h
        return None
    h = esperar(nova, 40)
    if fechados:
        print('TELA: fechei o aviso do Alterdata (' + ', '.join(fechados) + ')', flush=True)
        diag('fechei os avisos do Alterdata: ' + ', '.join(fechados))
    if not h:
        mensagem_na_frente('ao abrir ' + TELA)
        falhar('cliquei em ' + caminho + ' e nenhuma janela nova abriu (janelas: ' + '; '.join(descrever(x) for x in topo_do_fiscal()) + ')')
    FORM['h'] = h
    time.sleep(1.5)
    fechar_avisos(fechados)
    return h


AVISOS = ('aviso', 'apresentacao', 'notificacao', 'novidade', 'tour', 'dica', 'propaganda', 'informativo')


def eh_aviso(h):
    """Uma janela de aviso do Alterdata (apresentação, novidade, reforma tributária…): pelo nome da classe ou por só ter o Fechar."""
    try:
        cls = norm(win32gui.GetClassName(h))
    except Exception:
        return False
    if any(a in cls for a in AVISOS):
        return True
    return False


def fechar_avisos(fechados):
    for h in topo_do_fiscal():
        if not eh_aviso(h):
            continue
        nomecls = win32gui.GetClassName(h)
        b = None
        for e in itens(h):
            if tipo(e) == 'Button' and norm(nome(e)) in ('fechar', 'ok', 'ver depois', 'agora nao', 'nao mostrar', 'pular'):
                b = e
                break
        if b:
            clique('Fechar (' + nomecls + ')')
            mouse.click(coords=meio(b))
        else:
            win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
        if nomecls not in fechados:
            fechados.append(nomecls)
        time.sleep(.8)


class _W:
    """O mínimo de uma janela do pywinauto (win32) que o alterdata_faixa.py usa: o handle."""

    def __init__(self, h):
        self.handle = h


def win32_da(h):
    return _W(h)


def menu_por_nome(principal, caminho):
    """Lançamentos ▸ item: o item de menu pelo nome (barra de menu do Windows ou do DevExpress)."""
    pid = proc.pid_da_janela(principal)
    for i, alvo in enumerate(caminho):
        achado = None
        limite = time.time() + 6
        while time.time() < limite and not achado:
            janelas = [principal] + [h for h in topo_do_fiscal() if h != principal and proc.pid_da_janela(h) == pid]
            for h in janelas:
                for e in itens(h):
                    if tipo(e) in ('MenuItem', 'Button', 'ListItem', 'TreeItem', 'Hyperlink') and norm(nome(e)) == norm(alvo):
                        achado = e
                        break
                if achado:
                    break
            if not achado:
                time.sleep(.3)
        if not achado:
            raise RuntimeError('não achei o item "' + alvo + '"')
        clicar(achado, alvo)
        time.sleep(.8)


# ---------- preencher ----------
def escolher_opcao(its, nomes, oque):
    """Uma opção (botão de rádio, item de lista, aba, caixa de marcar) pelo nome; devolve True se clicou."""
    ns = [norm(x) for x in nomes]
    for e in its:
        if tipo(e) in ('RadioButton', 'ListItem', 'TabItem', 'CheckBox', 'Button', 'DataItem') and norm(nome(e)) in ns:
            clicar(e, oque + ': ' + nome(e))
            return True
    return False


def combo_ao_lado(its, comecos, texto, oque):
    rot = rotulo_achado(its, *comecos)
    if not rot:
        return False
    cx = entradas_ao_lado(its, rot, 1)
    if not cx:
        return False
    digitar(cx[0], texto, oque + ': ' + texto)
    return True


BOTOES = {}


def preencher(h):
    its = itens(h)
    # o Exportar guardado agora, com a grade vazia (17/11/2026, Vitor: "um delay imenso": depois do Filtrar, achar o botão lia cada
    # linha da grade pelo UI Automation; 35 s parado em "exportando")
    BOTOES['exportar'] = next((e for e in its if 'excel' in norm(nome(e)) and ('export' in norm(nome(e)) or 'dados' in norm(nome(e))) and tipo(e) not in ('Text', 'Pane', 'Window')), None)
    contar_tela(h, 'a tela ' + TELA)
    if SO_VER:
        fim(ok=True, so_ver=True)

    # O que o Vitor ensinou (17/11/2026, robo/alterdata_ensinar.py no PC dele, a tela TfrmConsultaNotasCDFiscais "Consulta de
    # Notas Fiscais e Produtos"): a empresa é uma caixa com botão (TcxButtonEdit) no alto à esquerda, digita o código e Enter;
    # o período são duas datas (TcxDateEdit) UMA EMBAIXO DA OUTRA, digitadas só com os números (ddmmaaaa); o tipo e as
    # canceladas são botões de opção ("&Entrada"/"&Saída" e "Não", num TcxRadioGroup ao lado); depois o "&Filtrar".
    def por_classe(cls):
        return sorted([e for e in itens(h) if classe(e) == cls], key=lambda e: (caixa(e)[1], caixa(e)[0]))

    def interna(e):
        """A caixa de dentro (onde se digita) de uma caixa do DevExpress; sem ela, a própria."""
        try:
            for f2 in e.descendants():
                if tipo(f2) == 'Edit' or 'inner' in classe(f2).lower():
                    return f2
        except Exception:
            pass
        return e

    # a empresa
    passo('empresa ' + CODIGO)
    caixas_emp = por_classe('TcxButtonEdit')
    if caixas_emp:
        alvo = interna(caixas_emp[0])
    else:
        rot = rotulo_achado(its, 'empresa', 'emp.', 'cod. empresa', 'codigo da empresa')
        cx = entradas_ao_lado(its, rot, 1) if rot else []
        if not cx:
            cx = sorted([e for e in its if entrada(e)], key=lambda e: (caixa(e)[1] // 10, caixa(e)[0]))[:1]
        if not cx:
            falhar('não achei o campo da empresa')
        alvo = cx[0]
    clicar(alvo, 'campo Empresa: ' + str(int(CODIGO)))
    keyboard.send_keys('^a{DEL}' + str(int(CODIGO)) + '{ENTER}', pause=0.04)
    time.sleep(1.5)
    mensagem_na_frente('ao escolher a empresa ' + CODIGO)
    its = itens(h)

    # o tipo
    if NOTAS:
        quero = ('Entrada', 'Entradas') if RELATORIO == 'entradas' else ('Saída', 'Saídas', 'Saida', 'Saidas')
        passo('tipo ' + quero[0])
        radios = [e for e in its if tipo(e) == 'RadioButton']
        diag('as opções da tela: ' + ' | '.join(nome(e) + '@' + str(caixa(e)[0]) + ',' + str(caixa(e)[1]) for e in radios))
        tipo_r = next((e for e in radios if norm(nome(e)) in [norm(q) for q in quero]), None)
        if tipo_r:
            clicar(tipo_r, 'tipo: ' + nome(tipo_r).replace('&', ''))
        elif not escolher_opcao(its, quero, 'tipo') and not combo_ao_lado(its, ('tipo',), quero[0], 'tipo'):
            falhar('não achei onde escolher o tipo ' + quero[0])
        passo('notas canceladas: não')
        # o "Não" das canceladas: o botão de opção "Não" mais perto, à direita do tipo (a tela pode ter outros "Não")
        naos = [e for e in radios if norm(nome(e)) == 'nao']
        if tipo_r and naos:
            tx, ty = caixa(tipo_r)[0], caixa(tipo_r)[1]
            perto = sorted([e for e in naos if caixa(e)[0] > tx], key=lambda e: (abs(caixa(e)[1] - ty), caixa(e)[0] - tx))
            nao = (perto or sorted(naos, key=lambda e: abs(caixa(e)[1] - ty)))[0]
            clicar(nao, 'notas canceladas: Não')
        elif naos:
            clicar(naos[0], 'notas canceladas: Não')
        else:
            diag('não achei o "Não" das canceladas: segui com o que a tela já tinha')
    else:
        # a tela do ISS como o Vitor ensinou (17/11/2026, TfrmConsultaISSFatDed "Consulta de movimento de ISS / Faturamento e
        # Deduções"): "ISS Saída" (os prestados) ou "ISS Tomador" (os tomados), depois "Referência" (a data da competência)
        quero = ('ISS Tomador', 'Tomador', 'Tomados', 'Serviços Tomados') if RELATORIO == 'tomados' else ('ISS Saída', 'ISS Saida', 'Saída', 'Saida', 'Prestados', 'Serviços Prestados')
        passo('tipo ' + quero[0])
        radios = [e for e in its if tipo(e) == 'RadioButton']
        diag('as opções da tela: ' + ' | '.join(nome(e) for e in radios))
        ref = next((e for e in radios if norm(nome(e)) == 'referencia'), None)
        if not escolher_opcao(its, quero, 'tipo') and not combo_ao_lado(its, ('tipo', 'iss', 'operacao', 'movimento'), quero[0], 'tipo'):
            chave = 'tomad' if RELATORIO == 'tomados' else 'saida'
            alvo = next((e for e in its if chave in norm(nome(e)) and tipo(e) not in ('Text', 'Pane', 'Window', 'Edit')), None)
            if not alvo:
                falhar('não achei onde escolher ' + quero[0])
            clicar(alvo, 'tipo: ' + nome(alvo))
        if ref:
            time.sleep(.3)
            clicar(ref, 'data pela Referência')
        else:
            diag('não achei o "Referência": segui com a data que a tela já tinha')
    time.sleep(.5)
    its = itens(h)

    # o período: as duas datas (TcxDateEdit), a de cima é o início
    passo('período ' + INICIO + ' a ' + FIM)
    datas = por_classe('TcxDateEdit')
    if len(datas) < 2:
        rot = rotulo_achado(its, 'periodo', 'data', 'competencia', 'de ')
        datas = entradas_ao_lado(its, rot, 2) if rot else []
    if len(datas) < 2:
        datas = sorted([e for e in its if entrada(e) and len(valor(e)) >= 8 and valor(e).count('/') == 2], key=lambda e: (caixa(e)[1], caixa(e)[0]))
    if len(datas) < 2:
        falhar('não achei as duas datas do período')
    datas = datas[:2]
    for c, d in zip(datas, (INICIO, FIM)):
        clicar(interna(c), 'período ' + d)
        keyboard.send_keys('{HOME}' + d.replace('/', '') + '{TAB}', pause=0.04)
        time.sleep(.5)
    # a data do DevExpress não diz o valor ao UI Automation (17/11/2026: voltava vazio): lê o texto da janela da caixa e o da
    # caixa de dentro pelo Windows
    def texto_da_data(c):
        v = valor(c)
        if v:
            return v
        try:
            hd = c.handle
        except Exception:
            hd = None
        if not hd:
            return ''
        t = (win32gui.GetWindowText(hd) or '').strip()
        if t:
            return t
        filhos_t = []

        def ver(x, _):
            try:
                tx = (win32gui.GetWindowText(x) or '').strip()
                if tx:
                    filhos_t.append(tx)
            except Exception:
                pass
            return True
        try:
            win32gui.EnumChildWindows(hd, ver, None)
        except Exception:
            pass
        return filhos_t[0] if filhos_t else ''
    lidos = [texto_da_data(c) for c in datas]
    diag('as datas na tela depois de digitar: ' + ' a '.join(x or '(sem leitura)' for x in lidos))
    if all(lidos) and not (INICIO in lidos[0] and FIM in lidos[1]):
        falhar('o período na tela (' + ' a '.join(lidos) + ') não é o pedido (' + INICIO + ' a ' + FIM + ')')
    mensagem_na_frente('ao preencher o período')

    # Filtrar; o aviso que aparece depois (o Vitor clicou em OK) vai para o log e leva OK
    passo('filtrando')
    its = itens(h)
    f = next((e for e in its if norm(nome(e)) in ('filtrar', 'pesquisar', 'consultar') and tipo(e) in ('Button', 'MenuItem', 'SplitButton', 'Custom', 'Text')), None)
    if not f:
        falhar('não achei o Filtrar')
    clicar(f, 'Filtrar')
    # o aviso vem logo depois do Filtrar; sem aviso em 20 s, segue (o Exportar espera a consulta terminar)
    limite = time.time() + 20
    while time.time() < limite:
        time.sleep(1.5)
        ms = mensagens()
        if not ms:
            continue
        texto = texto_da_mensagem(ms[0])
        diag('depois do Filtrar, o Fiscal avisou: ' + texto)
        t = norm(texto)
        if any(x in t for x in ('nenhum', 'nao ha', 'nao foram encontrad', 'nao existe', 'sem registro')):
            responder_nao(ms[0])
            falhar('o Fiscal não achou notas: ' + texto)
        b = botao_win32(ms[0], 'OK')
        if b:
            clique('OK (aviso do Fiscal)')
            win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
        else:
            responder_nao(ms[0])
        time.sleep(1)
        break
    time.sleep(2)


def achar_exportar(h, principal):
    if BOTOES.get('exportar'):
        b = BOTOES['exportar']
        BOTOES['exportar'] = None   # se não abrir, procura de novo na próxima volta
        return b
    for w in (h, principal):
        for e in itens(w):
            n = norm(nome(e))
            if 'excel' in n and ('export' in n or 'dados' in n or n == 'excel') and tipo(e) not in ('Text', 'Pane', 'Window'):
                return e
    return None


def salvar_como():
    for x in topo_do_fiscal():
        if (win32gui.GetWindowText(x) or '') in ('Salvar', 'Salvar como') or win32gui.GetClassName(x) == '#32770' and 'salvar' in norm(win32gui.GetWindowText(x)):
            return x
    # o "Salvar como" pode ser de outro processo (o Windows): pelo título
    for t in ('Salvar como', 'Salvar'):
        x = win32gui.FindWindow('#32770', t)
        if x and win32gui.IsWindowVisible(x):
            return x
    return None


def exportar(h, principal):
    passo('exportando para o Excel')
    pasta = os.path.dirname(DESTINO)
    antes = set(glob.glob(os.path.join(pasta, '*')))
    sv = None
    limite = time.time() + 120
    tentou_menu = False
    while time.time() < limite and not sv:
        b = achar_exportar(h, principal)
        if not b:
            time.sleep(2)
            continue
        clicar(b, 'Exportar dados em Excel')
        sv = esperar(salvar_como, 8, .2)
        if sv:
            break
        msgs = mensagens()
        if msgs:
            falhar('o Alterdata Fiscal mostrou uma mensagem ao exportar: ' + texto_da_mensagem(msgs[0]))
        # o botão abriu uma lista: o item com "excel"
        if not tentou_menu:
            tentou_menu = True
            pid = proc.pid_da_janela(principal)
            for x in topo_do_fiscal():
                if x in (h, principal) or proc.pid_da_janela(x) != pid:
                    continue
                for e in itens(x):
                    if 'excel' in norm(nome(e)):
                        clicar(e, nome(e))
                        sv = esperar(salvar_como, 8)
                        break
                if sv:
                    break
    if not sv:
        falhar('a janela Salvar não abriu depois do Exportar dados em Excel (2 min)')
    # a caixa "Nome:" do "Salvar como" do Windows (a gravação do Vitor, 17/11/2026: o controle 1148, um Edit dentro do ComboBox)
    nomecx = None
    edits = []

    def ver(c, _):
        try:
            if win32gui.GetClassName(c) == 'Edit' and win32gui.IsWindowVisible(c):
                pai = win32gui.GetParent(c)
                ids = (win32gui.GetDlgCtrlID(c), win32gui.GetDlgCtrlID(pai) if pai else 0, win32gui.GetDlgCtrlID(win32gui.GetParent(pai)) if pai and win32gui.GetParent(pai) else 0)
                edits.append((c, 1148 in ids))
        except Exception:
            pass
        return True
    win32gui.EnumChildWindows(sv, ver, None)
    nomecx = next((c for c, eh in edits if eh), None) or (edits[0][0] if edits else None)
    if not nomecx:
        falhar('não achei o Nome na janela Salvar')
    win32gui.SendMessage(nomecx, win32con.WM_SETTEXT, 0, DESTINO)
    time.sleep(.3)
    b = botao_win32(sv, 'Salvar')
    if not b:
        falhar('não achei o botão Salvar')
    clique('Salvar')
    win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
    # depois do Salvar: "deseja abrir o arquivo?" leva Não; "já existe, substituir?" não acontece (a pasta é nova)
    novo = None
    tamanhos = []
    limite = time.time() + 120
    while time.time() < limite:
        time.sleep(.5)
        for m in mensagens():
            # a pergunta depois do Salvar (a gravação: "Informação", Sim/Não; o Vitor clicou em Sim e o Excel abriu): o robô
            # responde Não (não abre nada); o texto vai para o log
            diag('depois do Salvar, o Fiscal perguntou: ' + texto_da_mensagem(m))
            clique('Não (não abrir o arquivo)')
            responder_nao(m)
            time.sleep(.8)
        novos = [p for p in glob.glob(os.path.join(pasta, '*')) if p not in antes and not p.lower().endswith(('.tmp', '.~tmp')) and not os.path.basename(p).startswith('~$')]
        if novos:
            novo = max(novos, key=os.path.getmtime)
            t = os.path.getsize(novo)
            tamanhos.append(t)
            if t > 0 and tamanhos[-2:] == [t, t]:
                break
    if not novo or os.path.getsize(novo) <= 0:
        falhar('a planilha não apareceu na pasta depois do Salvar')
    return novo



# ---------- a grade: os filtros das colunas e a seleção ----------
# O ensaio de 17/11/2026 mostrou que o UI Automation NÃO vê o cxGrid do Fiscal (nem colunas, nem linhas). Então: o filtro da coluna do
# CFOP pelo lugar onde o Vitor clicou nas duas gravações (na janela da consulta, maximizada: x 729, y 367); a lista do filtro
# (TcxGridFilterPopup) o UI Automation vê. A contagem: seleciona tudo e copia (Ctrl+C) — as linhas copiadas são as notas filtradas.
FUNIL_CFOP = (729, 367)
LINHA_1 = (300, 390)


def no_form(h, x, y):
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    return (x0 + x, y0 + y)


def filtrar_cfop_pelo_lugar(h, valores):
    pop = None
    for dx in (0, -3, 3):
        px, py = no_form(h, FUNIL_CFOP[0] + dx, FUNIL_CFOP[1])
        mouse.move(coords=(px - 40, py))
        time.sleep(.4)
        mouse.move(coords=(px, py))
        time.sleep(.3)
        clique('filtro da coluna do CFOP')
        mouse.click(coords=(px, py))
        pop = esperar(popup_do_filtro, 3, .2)
        if pop:
            break
    if not pop:
        falhar('não abriu o filtro da coluna do CFOP (o lugar da gravação: ' + str(FUNIL_CFOP) + ')')
    time.sleep(.6)
    lista = [e for e in itens(pop) if tipo(e) in ('ListItem', 'CheckBox', 'DataItem')]
    nomes = [nome(e) for e in lista]
    diag('o filtro da coluna tem: ' + ' | '.join(nomes[:60]))
    cfops_na_lista = [n for n in nomes if len(n.strip()) == 4 and n.strip().isdigit() and n.strip()[0] in '1234567']
    if not cfops_na_lista:
        keyboard.send_keys('{ESC}')
        falhar('o filtro aberto não é o da coluna do CFOP (as colunas da grade mudaram de lugar?): ' + ' | '.join(nomes[:12]))
    faltam = []
    for v in valores:
        alvo = next((e for e in lista if nome(e).strip() == v), None)
        if not alvo:
            faltam.append(v)
            continue
        clicar(alvo, 'CFOP ' + v)
        time.sleep(.5)
    keyboard.send_keys('{ESC}')
    time.sleep(1)
    if popup_do_filtro():
        win32gui.PostMessage(popup_do_filtro(), win32con.WM_CLOSE, 0, 0)
        time.sleep(.5)
    if faltam:
        falhar('o filtro do CFOP não tem ' + ', '.join(faltam) + ' (nenhuma nota assim no período?)')


def copiar_selecao(h):
    """Clica na primeira linha, Ctrl+A e Ctrl+C: o texto das linhas selecionadas (as notas filtradas)."""
    import win32clipboard
    try:
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.CloseClipboard()
    except Exception:
        pass
    px, py = no_form(h, *LINHA_1)
    clique('a primeira nota da grade')
    mouse.click(coords=(px, py))
    time.sleep(.5)
    keyboard.send_keys('^a')
    time.sleep(.6)
    keyboard.send_keys('^c')
    time.sleep(1)
    texto = ''
    for _ in range(5):
        try:
            win32clipboard.OpenClipboard()
            try:
                if win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
                    texto = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT) or ''
            finally:
                win32clipboard.CloseClipboard()
            break
        except Exception:
            time.sleep(.4)
    return texto


def contar_pela_copia(texto, cfops):
    linhas = [l for l in texto.splitlines() if l.strip()]
    if linhas and 'cfop' in norm(linhas[0]):
        linhas = linhas[1:]   # o título das colunas
    com_cfop = [l for l in linhas if any(('\t' + c + '\t') in ('\t' + l + '\t') or (' ' + c + ' ') in (' ' + l.replace('\t', ' ') + ' ') for c in cfops)]
    return linhas, com_cfop

def cabecalhos(h):
    """Os títulos das colunas da grade (o UI Automation do cxGrid dá HeaderItem; sem ele, os Text no alto da grade)."""
    its = itens(h)
    cabs = [e for e in its if tipo(e) in ('HeaderItem', 'Header') and nome(e)]
    return cabs, its


def coluna(cabs, *chaves):
    for ch in chaves:
        for e in cabs:
            if norm(nome(e)) == ch:
                return e
    for ch in chaves:
        for e in cabs:
            if norm(nome(e)).startswith(ch):
                return e
    return None


def popup_do_filtro():
    for x in topo_do_fiscal():
        try:
            if win32gui.GetClassName(x) == 'TcxGridFilterPopup' and win32gui.IsWindowVisible(x):
                return x
        except Exception:
            pass
    hs = []
    win32gui.EnumWindows(lambda x, _: hs.append(x) or True, None)
    for x in hs:
        try:
            if win32gui.GetClassName(x) == 'TcxGridFilterPopup' and win32gui.IsWindowVisible(x):
                return x
        except Exception:
            pass
    return None


def filtrar_coluna(h, cab, valores, oque):
    """O funil da coluna (canto direito do título) → marca os valores na lista → fecha a lista."""
    x0, y0, x1, y1 = caixa(cab)
    pop = None
    for dx in (9, 6, 13, 16):
        mouse.move(coords=((x0 + x1) // 2, (y0 + y1) // 2))
        time.sleep(.4)
        clique('filtro da coluna ' + nome(cab))
        mouse.click(coords=(x1 - dx, (y0 + y1) // 2))
        pop = esperar(popup_do_filtro, 3, .2)
        if pop:
            break
    if not pop:
        falhar('não abriu o filtro da coluna ' + nome(cab) + ' (' + oque + ')')
    time.sleep(.6)
    lista = [e for e in itens(pop) if tipo(e) in ('ListItem', 'CheckBox', 'DataItem')]
    diag('o filtro de ' + oque + ' tem: ' + ' | '.join(nome(e) for e in lista[:60]))
    faltam = []
    for v in valores:
        alvo = next((e for e in lista if norm(nome(e)) == norm(v)), None)
        if not alvo:
            alvo = next((e for e in lista if norm(nome(e)).lstrip('0') == norm(v).lstrip('0')), None)
        if not alvo:
            faltam.append(v)
            continue
        clicar(alvo, oque + ' ' + nome(alvo))
        time.sleep(.5)
    keyboard.send_keys('{ESC}')
    time.sleep(1)
    if popup_do_filtro():
        win32gui.PostMessage(popup_do_filtro(), win32con.WM_CLOSE, 0, 0)
        time.sleep(.5)
    if faltam:
        falhar('o filtro de ' + oque + ' não tem ' + ', '.join(faltam) + ' (nenhuma nota assim no período?)')


def contar_linhas(h):
    """Quantas notas a grade mostra: o "Registros: N" da tela, ou as linhas que o UI Automation dá."""
    its = itens(h)
    for e in its:
        t = nome(e) or valor(e)
        n = norm(t)
        if 'registro' in n:
            num = ''.join(ch for ch in t.split(':')[-1] if ch.isdigit())
            if num:
                return int(num), 'registros'
    linhas = [e for e in its if tipo(e) in ('DataItem', 'ListItem', 'TreeItem') and caixa(e)[1] > 0]
    return len(linhas), 'linhas'


def selecionar_tudo(h):
    """Clica na primeira linha da grade e Ctrl+A (o Vitor: "filtrando, pode selecionar tudo")."""
    its = itens(h)
    grade = sorted([e for e in its if classe(e) in ('TcxGridSite',) or tipo(e) == 'DataGrid'], key=lambda e: -(caixa(e)[2] - caixa(e)[0]) * (caixa(e)[3] - caixa(e)[1]))
    linhas = sorted([e for e in its if tipo(e) in ('DataItem', 'ListItem')], key=lambda e: caixa(e)[1])
    if linhas:
        clicar(linhas[0], 'a primeira nota da grade')
    elif grade:
        x0, y0, x1, y1 = caixa(grade[0])
        clique('a primeira nota da grade')
        mouse.click(coords=(x0 + 60, y0 + 30))
    else:
        falhar('não achei a grade das notas')
    time.sleep(.4)
    keyboard.send_keys('^a')
    time.sleep(.6)


def alterar_notas(h):
    """Editar → Alterar Notas: "Lanc. Cont. Vl. Contábil" = PADRAO → Adicionar → Aplicar."""
    its = itens(h)
    ed = next((e for e in its if norm(nome(e)) == 'editar' and tipo(e) in ('Button', 'MenuItem')), None)
    if not ed:
        falhar('não achei o Editar')
    clicar(ed, 'Editar')
    alt = esperar(lambda: next((x for x in topo_do_fiscal() if win32gui.GetClassName(x) == 'TfrmAlterarNotas'), None), 15, .3)
    if not alt:
        mensagem_na_frente('depois do Editar')
        falhar('a janela Alterar Notas não abriu')
    time.sleep(.8)
    contar_tela(alt, 'a janela Alterar Notas')
    w = Desktop(backend='win32').window(handle=alt)
    combos = [c for c in w.descendants() if c.class_name() == 'TComboBox' and c.is_visible()]
    if not combos:
        falhar('não achei a lista de campos do Alterar Notas')
    cb = sorted(combos, key=lambda c: (c.rectangle().top, c.rectangle().left))[0]
    opcoes = cb.texts()[1:] if hasattr(cb, 'texts') else []
    diag('os campos do Alterar Notas: ' + ' | '.join(opcoes[:40]))
    quero = next((o for o in opcoes if norm(o).startswith('lanc. cont. vl. contabil') or norm(o) == 'lanc. cont. vl. contabil'), None)
    if not quero:
        quero = next((o for o in opcoes if 'lanc' in norm(o) and 'contab' in norm(o) and 'vl' in norm(o)), None)
    if not quero:
        falhar('o Alterar Notas não tem o campo "Lanc. Cont. Vl. Contábil"')
    clique('campo ' + quero)
    cb.select(quero)
    time.sleep(.5)
    eds = [c for c in w.descendants() if c.class_name() == 'TAltEditN' and c.is_visible()]
    if not eds:
        falhar('não achei onde digitar o lançamento no Alterar Notas')
    ed2 = sorted(eds, key=lambda c: (c.rectangle().top, c.rectangle().left))[0]
    clique('lançamento ' + str(int(PADRAO)))
    ed2.click_input()
    keyboard.send_keys('^a{DEL}' + str(int(PADRAO)), pause=0.05)
    time.sleep(.4)
    a_its = itens(alt)
    add = next((e for e in a_its if norm(nome(e)) == 'adicionar' and tipo(e) == 'Button'), None)
    if not add:
        falhar('não achei o Adicionar (+) do Alterar Notas')
    clicar(add, 'Adicionar')
    time.sleep(.8)
    mensagem_na_frente('depois do Adicionar')
    a_its = itens(alt)
    diag('o Alterar Notas depois do Adicionar: ' + ' | '.join((tipo(e) + ':' + (nome(e) or valor(e)))[:60] for e in a_its if (nome(e) or valor(e)))[:900])
    ap = next((e for e in a_its if norm(nome(e)) == 'aplicar' and tipo(e) == 'Button'), None)
    if not ap:
        falhar('não achei o Aplicar')
    passo('aplicando o lançamento ' + PADRAO)
    clicar(ap, 'Aplicar')
    # depois do Aplicar: as perguntas e avisos vão para o log; pergunta com Sim/Não leva SIM só se for a confirmação da alteração
    limite = time.time() + 120
    while time.time() < limite:
        time.sleep(1)
        ms = mensagens()
        aberto = any(win32gui.GetClassName(x) == 'TfrmAlterarNotas' for x in topo_do_fiscal())
        if ms:
            texto = texto_da_mensagem(ms[0])
            diag('depois do Aplicar, o Fiscal disse: ' + texto)
            t = norm(texto)
            b = botao_win32(ms[0], 'OK')
            if b:
                win32gui.PostMessage(b, win32con.BM_CLICK, 0, 0)
            elif ('confirma' in t or 'deseja' in t) and ('alter' in t or 'aplic' in t):
                s = botao_win32(ms[0], 'Sim', '&Sim')
                if not s:
                    falhar('a confirmação da alteração não tem Sim: ' + texto)
                clique('Sim (confirma a alteração)')
                win32gui.PostMessage(s, win32con.BM_CLICK, 0, 0)
            else:
                responder_nao(ms[0])
                falhar('o Fiscal perguntou algo que eu não conheço depois do Aplicar: ' + texto)
            time.sleep(1)
            continue
        if not aberto:
            break
    if any(win32gui.GetClassName(x) == 'TfrmAlterarNotas' for x in topo_do_fiscal()):
        diag('o Alterar Notas continuou aberto depois do Aplicar')


try:
    if not CODIGO.isdigit() or not (INICIO and FIM and CFOPS and ATUAL.isdigit() and PADRAO.isdigit()):
        fim(ok=False, erro='uso: alterdata_lancamento_padrao.py <código> <início> <fim> <cfops> <atual> <padrão> <esperado> [--ensaio]')
    if not ENSAIO and ESPERADO <= 0:
        fim(ok=False, erro='sem o número de notas esperado não altero nada')
    try:
        import alterdata_tela
        t = alterdata_tela.preparar_tela()
        if t:
            print('TELA: ' + t, flush=True)
    except Exception as e:
        print('TELA: não preparei a tela: ' + type(e).__name__, flush=True)
    principal = entrar_no_fiscal()
    win32gui.ShowWindow(principal, win32con.SW_MAXIMIZE)
    try:
        win32gui.SetForegroundWindow(principal)
    except Exception:
        pass
    time.sleep(.6)
    for m in mensagens():
        responder_nao(m)
    fechar_avisos([])
    form = abrir_a_tela(principal)
    preencher(form)
    time.sleep(1)
    passo('filtrando a grade: CFOP ' + ', '.join(CFOPS))
    filtrar_cfop_pelo_lugar(form, CFOPS)
    passo('conferindo as notas filtradas')
    texto = copiar_selecao(form)
    linhas, com_cfop = contar_pela_copia(texto, CFOPS)
    achadas = len(linhas)
    diag('a cópia da grade: ' + str(achadas) + ' linha(s), ' + str(len(com_cfop)) + ' com o CFOP; o nads espera ' + str(ESPERADO) + ' · ' + ' // '.join(l[:120] for l in linhas[:3]))
    if not texto.strip():
        falhar('a grade não copiou nada (Ctrl+C): não sei quantas notas o filtro deixou; não alterei nada')
    if len(com_cfop) != achadas:
        falhar('há linha copiada sem o CFOP pedido (' + str(achadas - len(com_cfop)) + '): não alterei nada')
    if ENSAIO:
        try:
            import alterdata_tela
            diag(alterdata_tela.resumo_do_erro('ensaio: a grade filtrada', 'lancamento-padrao-ensaio'))
        except Exception:
            pass
        passo('ensaio: nada foi alterado')
        limpar()
        fim(ok=True, ensaio=True, achadas=achadas, esperado=ESPERADO)
    if achadas != ESPERADO:
        falhar('a grade filtrada tem ' + str(achadas) + ' nota(s) e o nads espera ' + str(ESPERADO) + ': não alterei nada')
    passo(str(achadas) + ' nota(s) selecionadas')
    alterar_notas(form)
    passo(str(achadas) + ' nota(s) com o lançamento ' + PADRAO)
    limpar()
    fim(ok=True, alteradas=achadas)
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + type(e).__name__ + ': ' + str(e)[:200])
