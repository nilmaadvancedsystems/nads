# As notas do Alterdata Fiscal pelo robô do servidor (16/11/2026, Vitor: "queria ensinar o robo do servidor a pegar entradas,
# saidas e tomados e prestados da etapa de importacao"). O caminho que o Vitor passou:
#   - Entradas e Saídas: Lançamentos → Notas Fiscais e Produtos → a empresa, o tipo (Entrada / Saída), notas canceladas: Não,
#     o período (um mês ou o lote) → Filtrar → "Exportar dados em Excel" (canto superior) → Salvar;
#   - Tomados e Prestados: Lançamentos → ISS, Receitas e Deduções → a empresa, ISS Saída (prestados) ou Tomador (tomados),
#     o período → Filtrar → Exportar dados em Excel → Salvar.
# A planilha é a mesma que a pessoa sobe na Importação da Tarefa.
#
# O robô nunca viu essas telas: não há posição medida. Tudo é achado pelo NOME que o Alterdata expõe ao UI Automation (como a
# faixa de opções do Contábil, alterdata_faixa.py) e pelo rótulo ao lado de cada campo ("Empresa", "Período"…). Cada tela nova
# vai para o log (DIAG: os itens com tipo, nome e posição), e o erro diz o que faltou: é assim que o roteiro aprende a tela.
#
# Travas (nada além de filtrar e exportar):
# - só preenche empresa, tipo, canceladas e período; só clica em Filtrar, no Exportar dados em Excel e no Salvar;
# - nunca clica em Gravar, Incluir, Excluir, Alterar, Confirmar nem em Sim; pergunta depois do Salvar ("abrir o arquivo?") leva Não;
# - o login do Fiscal só com a credencial do robô (nads-alterdata-robo), uma tentativa, pelo alterdata_login.py;
# - qualquer janela inesperada: para, conta o que viu e fecha só a janela da consulta que abriu.
#
# Uso: python alterdata_fiscal.py <entradas|saidas|tomados|prestados> <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <caminho .xls>
#      python alterdata_fiscal.py --ver <entradas|…> <código>   (só abre a tela e conta o que tem nela; não filtra nem exporta)
# Escreve PASSO:/CLIQUE:/DIAG: e, no fim, RESULTADO: {"ok":true,"arquivo":…,"bytes":…} ou {"ok":false,"erro":"…"}.
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

SO_VER = '--ver' in sys.argv
ARGS = [a for a in sys.argv[1:] if a != '--ver']
RELATORIO = ARGS[0] if ARGS else ''
CODIGO = ARGS[1] if len(ARGS) > 1 else ''
INICIO = ARGS[2] if len(ARGS) > 2 else ''
FIM = ARGS[3] if len(ARGS) > 3 else ''
DESTINO = ARGS[4] if len(ARGS) > 4 else ''
NOTAS = RELATORIO in ('entradas', 'saidas')
TELA = 'Notas Fiscais e Produtos' if NOTAS else 'ISS, Receitas e Deduções'
PEDACOS_DA_TELA = ('notas', 'produtos') if NOTAS else ('iss', 'receitas')
# onde o Fiscal fica instalado (o Contábil fica em Pack\Diamond\Contabil\wcont.exe); ALTERDATA_WFISCAL manda
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

    def nova():
        for h in topo_do_fiscal():
            if h not in antes_topo and h != principal and win32gui.GetClassName(h).startswith('Tfrm'):
                return h
        for h in janelas_tfrm_dentro(principal):
            if h not in antes_dentro:
                return h
        return None
    h = esperar(nova, 30)
    if not h:
        mensagem_na_frente('ao abrir ' + TELA)
        falhar('cliquei em ' + caminho + ' e nenhuma janela nova abriu (janelas: ' + '; '.join(descrever(x) for x in topo_do_fiscal()) + ')')
    FORM['h'] = h
    time.sleep(1.5)
    # a tela de novidade do Alterdata: Fechar
    for n in [x for x in topo_do_fiscal() if win32gui.GetClassName(x) == 'TfrmAvaNotificacaoEstendida']:
        responder_nao(n)
    return h


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


def preencher(h):
    its = itens(h)
    contar_tela(h, 'a tela ' + TELA)
    if SO_VER:
        fim(ok=True, so_ver=True)

    # a empresa
    passo('empresa ' + CODIGO)
    rot = rotulo_achado(its, 'empresa', 'emp.', 'cod. empresa', 'codigo da empresa')
    cx = entradas_ao_lado(its, rot, 1) if rot else []
    if not cx:
        # sem o rótulo: a primeira caixa de cima, à esquerda
        ent = sorted([e for e in its if entrada(e)], key=lambda e: (caixa(e)[1] // 10, caixa(e)[0]))
        cx = ent[:1]
    if not cx:
        falhar('não achei o campo da empresa')
    digitar(cx[0], str(int(CODIGO)), 'campo Empresa: ' + str(int(CODIGO)))
    time.sleep(1)
    mensagem_na_frente('ao escolher a empresa ' + CODIGO)
    its = itens(h)

    # o tipo
    if NOTAS:
        quero = ('Entrada', 'Entradas') if RELATORIO == 'entradas' else ('Saída', 'Saídas', 'Saida', 'Saidas')
        passo('tipo ' + quero[0])
        if not escolher_opcao(its, quero, 'tipo') and not combo_ao_lado(its, ('tipo',), quero[0], 'tipo'):
            falhar('não achei onde escolher o tipo ' + quero[0])
        passo('notas canceladas: não')
        rot = rotulo_achado(its, 'notas canceladas', 'canceladas', 'considerar canceladas', 'exibir canceladas', 'mostrar canceladas')
        if rot:
            cx = entradas_ao_lado(its, rot, 1)
            if cx:
                digitar(cx[0], 'Não', 'notas canceladas: Não')
            else:
                # uma caixa de marcar com o nome: desmarcada
                diag('o rótulo das canceladas sem caixa ao lado: ' + tipo(rot) + ' "' + nome(rot) + '"')
        for e in its:
            if tipo(e) == 'CheckBox' and 'cancelad' in norm(nome(e)):
                try:
                    if e.get_toggle_state() == 1:
                        clicar(e, 'desmarcar ' + nome(e))
                except Exception:
                    pass
    else:
        quero = ('Tomador', 'ISS Tomador', 'Tomados', 'Serviços Tomados') if RELATORIO == 'tomados' else ('ISS Saída', 'ISS Saida', 'Saída', 'Saida', 'Prestados', 'Serviços Prestados')
        passo('tipo ' + quero[0])
        if not escolher_opcao(its, quero, 'tipo') and not combo_ao_lado(its, ('tipo', 'iss', 'operacao', 'movimento'), quero[0], 'tipo'):
            # qualquer item cujo nome tenha a palavra
            chave = 'tomad' if RELATORIO == 'tomados' else 'saida'
            alvo = next((e for e in its if chave in norm(nome(e)) and tipo(e) not in ('Text', 'Pane', 'Window', 'Edit')), None)
            if not alvo:
                falhar('não achei onde escolher ' + quero[0])
            clicar(alvo, 'tipo: ' + nome(alvo))
    time.sleep(.5)
    its = itens(h)

    # o período
    passo('período ' + INICIO + ' a ' + FIM)
    rot = rotulo_achado(its, 'periodo', 'data', 'competencia', 'de ')
    cxs = entradas_ao_lado(its, rot, 2) if rot else []
    if len(cxs) < 2:
        # as caixas que já mostram uma data
        cxs = [e for e in its if entrada(e) and len(valor(e)) >= 8 and valor(e).count('/') == 2]
        cxs = sorted(cxs, key=lambda e: (caixa(e)[1] // 10, caixa(e)[0]))[:2]
    if len(cxs) < 2:
        falhar('não achei as duas datas do período')
    for c, d in zip(cxs, (INICIO, FIM)):
        digitar(c, d.replace('/', ''), 'período ' + d)
    lidos = [valor(c) for c in cxs]
    if not (INICIO.replace('/', '') in lidos[0].replace('/', '') and FIM.replace('/', '') in lidos[1].replace('/', '')):
        # a máscara pode ser mês/ano
        if not (INICIO[3:].replace('/', '') in lidos[0].replace('/', '') and FIM[3:].replace('/', '') in lidos[1].replace('/', '')):
            falhar('o período na tela (' + ' a '.join(lidos) + ') não é o pedido (' + INICIO + ' a ' + FIM + ')')
    mensagem_na_frente('ao preencher o período')

    # Filtrar
    passo('filtrando')
    its = itens(h)
    f = next((e for e in its if norm(nome(e)) in ('filtrar', 'pesquisar', 'consultar') and tipo(e) in ('Button', 'MenuItem', 'SplitButton', 'Custom', 'Text')), None)
    if not f:
        falhar('não achei o Filtrar')
    clicar(f, 'Filtrar')
    time.sleep(3)
    mensagem_na_frente('ao filtrar')


def achar_exportar(h, principal):
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
        sv = esperar(salvar_como, 8)
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
    nomecx = None

    def ver(c, _):
        nonlocal nomecx
        if nomecx is None and win32gui.GetClassName(c) == 'Edit' and win32gui.IsWindowVisible(c):
            nomecx = c
        return True
    win32gui.EnumChildWindows(sv, ver, None)
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
            t = norm(texto_da_mensagem(m))
            if 'abrir' in t or 'visualizar' in t or 'excel' in t:
                clique('Não (não abrir o arquivo)')
                responder_nao(m)
            else:
                falhar('o Alterdata Fiscal mostrou uma mensagem depois do Salvar: ' + texto_da_mensagem(m))
        novos = [p for p in glob.glob(os.path.join(pasta, '*')) if p not in antes and not p.lower().endswith(('.tmp', '.~tmp')) and not os.path.basename(p).startswith('~$')]
        if novos:
            novo = max(novos, key=os.path.getmtime)
            t = os.path.getsize(novo)
            tamanhos.append(t)
            if t > 0 and tamanhos[-4:] == [t, t, t, t]:
                break
    if not novo or os.path.getsize(novo) <= 0:
        falhar('a planilha não apareceu na pasta depois do Salvar')
    return novo


try:
    if RELATORIO not in ('entradas', 'saidas', 'tomados', 'prestados') or not CODIGO.isdigit():
        fim(ok=False, erro='uso: alterdata_fiscal.py <entradas|saidas|tomados|prestados> <código> <início> <fim> <destino>')
    if not SO_VER and not (INICIO and FIM and DESTINO):
        fim(ok=False, erro='faltou o período ou o destino')
    if not SO_VER:
        os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
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
    form = abrir_a_tela(principal)
    preencher(form)
    arquivo = exportar(form, principal)
    passo('planilha salva')
    limpar()
    fim(ok=True, arquivo=arquivo, bytes=os.path.getsize(arquivo))
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + type(e).__name__ + ': ' + str(e)[:200])
