# O razão de UMA conta do Alterdata Contábil pelo robô (17/11/2026, Vitor gravou o caminho com o alterdata_ensinar.py: "como
# puxar um razao que upa no nads"; "ate o botao de exportar para excel ta certo, o resto de gravar nos diretorios corretos vc
# orienta ele"). É o arquivo que a pessoa sobe na linha "Razão" de cada banco na Importação da Tarefa. O caminho ensinado:
#   aba Consultas → Lançamentos (a janela TfrmConsultaMovimento "Consulta de Movimentos / Lançamentos") → a empresa (a primeira
#   caixa, Enter) → a conta contábil (a caixa da conta) → as duas datas lado a lado (TcxMaskEdit, ddmmaaaa) → Consultar →
#   Imprimir → Exportar para excel → o "Salvar" do Windows com o caminho que o robô dá.
# Usa o Contábil JÁ ABERTO E LOGADO (nunca digita login nem senha). Travas: só preenche empresa, conta e período e só clica em
# Consultar, Imprimir › Exportar para excel e Salvar; pergunta depois do Salvar leva Não; janela inesperada: para e conta.
#
# Uso: python alterdata_razao_conta.py <código> <conta contábil> <dd/mm/aaaa início> <dd/mm/aaaa fim> <caminho .xls>
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

ARGS = sys.argv[1:]
CODIGO = ARGS[0] if ARGS else ''
CONTA = ARGS[1] if len(ARGS) > 1 else ''
INICIO = ARGS[2] if len(ARGS) > 2 else ''
FIM = ARGS[3] if len(ARGS) > 3 else ''
DESTINO = ARGS[4] if len(ARGS) > 4 else ''
RELATORIO = 'razao-conta'
TELA = 'Lançamentos'
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
            if win32gui.IsWindowVisible(h) and proc.do_contabil(h) and '\\alterdata\\' in proc.exe_da_janela(h):
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




def salvar_como():
    for x in topo_do_fiscal():
        if win32gui.GetClassName(x) == '#32770' and 'salvar' in norm(win32gui.GetWindowText(x)):
            return x
    for t in ('Salvar', 'Salvar como'):
        x = win32gui.FindWindow('#32770', t)
        if x and win32gui.IsWindowVisible(x):
            return x
    return None


def meses_do_periodo():
    """'09/2026' ou '01/2026 a 09/2026' (o período pedido)."""
    a, b = INICIO[3:], FIM[3:]
    return a if a == b else a + ' a ' + b


def principal_do_contabil():
    hs = [h for h in topo_do_fiscal() if win32gui.GetClassName(h) == 'TfrmPrincipal']
    return hs[0] if len(hs) == 1 else None


class _W:
    def __init__(self, h):
        self.handle = h


def abrir_a_consulta(principal):
    antes = set(topo_do_fiscal())
    import alterdata_faixa as fx
    passo('abrindo Consultas → Lançamentos')
    try:
        fechadas = fx.liberar(_W(principal))
        if fechadas:
            print('TELA: o Contábil estava travado por ' + ', '.join(fechadas) + ': fechei', flush=True)
        clique('aba Consultas')
        fx.aba(_W(principal), 'Consultas')
        clique('Lançamentos')
        fx.botao(_W(principal), 'Lançamentos')
    except Exception as e:
        falhar('não achei Consultas → Lançamentos: ' + str(e)[:300])

    def nova():
        for h in topo_do_fiscal():
            if h not in antes and h != principal and win32gui.GetClassName(h).startswith('Tfrm') and 'aviso' not in win32gui.GetClassName(h).lower():
                return h
        for h in janelas_dentro(principal):
            if win32gui.GetClassName(h) == 'TfrmConsultaMovimento':
                return h
        return None
    h = esperar(nova, 40)
    if not h:
        mensagem_na_frente('ao abrir a consulta de lançamentos')
        falhar('cliquei em Consultas → Lançamentos e a consulta não abriu (janelas: ' + '; '.join(descrever(x) for x in topo_do_fiscal()) + ')')
    FORM['h'] = h
    time.sleep(1.5)
    return h


def janelas_dentro(h):
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


def preencher(h):
    contar_tela(h, 'a consulta de lançamentos')
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    its = itens(h)
    textos = sorted([e for e in its if classe(e) == 'TcxTextEdit'], key=lambda e: (caixa(e)[1] // 20, caixa(e)[0]))
    mascaras = sorted([e for e in its if classe(e) == 'TcxMaskEdit'], key=lambda e: (caixa(e)[1] // 20, caixa(e)[0]))
    diag('as caixas: ' + ' | '.join(classe(e) + '@' + str(caixa(e)[0] - x0) + ',' + str(caixa(e)[1] - y0) + ' ' + str(caixa(e)[2] - caixa(e)[0]) + 'w' for e in textos + mascaras))
    if not textos:
        falhar('não achei a caixa da empresa')
    emp = textos[0]
    passo('empresa ' + CODIGO)
    clicar(emp, 'campo Empresa: ' + str(int(CODIGO)))
    keyboard.send_keys('^a{DEL}' + str(int(CODIGO)) + '{ENTER}', pause=0.04)
    time.sleep(1.5)
    mensagem_na_frente('ao escolher a empresa ' + CODIGO)
    # a conta: a caixa estreita da mesma linha, depois da empresa (as largas são os nomes que o Alterdata mostra)
    its = itens(h)
    textos = sorted([e for e in its if classe(e) == 'TcxTextEdit'], key=lambda e: (caixa(e)[1] // 20, caixa(e)[0]))
    linha = [e for e in textos if abs(caixa(e)[1] - caixa(emp)[1]) < 15 and caixa(e)[0] > caixa(emp)[0] + 5]
    estreitas = [e for e in linha if caixa(e)[2] - caixa(e)[0] < 250]
    conta = (estreitas or linha)[:1]
    if not conta:
        falhar('não achei a caixa da conta')
    passo('conta ' + CONTA)
    clicar(conta[0], 'campo Conta: ' + CONTA)
    keyboard.send_keys('^a{DEL}' + CONTA + '{TAB}', pause=0.04)
    time.sleep(1)
    mensagem_na_frente('ao escolher a conta ' + CONTA)
    passo('período ' + INICIO + ' a ' + FIM)
    its = itens(h)
    mascaras = sorted([e for e in its if classe(e) == 'TcxMaskEdit'], key=lambda e: (caixa(e)[1] // 20, caixa(e)[0]))
    if len(mascaras) < 2:
        falhar('não achei as duas datas do período')
    for c, d in zip(mascaras[:2], (INICIO, FIM)):
        clicar(c, 'período ' + d)
        keyboard.send_keys('{HOME}' + d.replace('/', '') + '{TAB}', pause=0.04)
        time.sleep(.4)
    lidos = [valor(c) for c in mascaras[:2]]
    diag('o período na tela: ' + ' a '.join(x or '(sem leitura)' for x in lidos))
    if all(lidos) and not (INICIO in lidos[0] and FIM in lidos[1]):
        falhar('o período na tela (' + ' a '.join(lidos) + ') não é o pedido (' + INICIO + ' a ' + FIM + ')')
    mensagem_na_frente('ao preencher o período')
    passo('consultando')
    its = itens(h)
    f = next((e for e in its if norm(nome(e)) == 'consultar' and tipo(e) == 'Button'), None)
    if not f:
        falhar('não achei o Consultar')
    clicar(f, 'Consultar')
    limite = time.time() + 20
    while time.time() < limite:
        time.sleep(1.5)
        ms = mensagens()
        if not ms:
            continue
        # o texto do aviso: o do Windows e o que o UI Automation lê (o TLabel do Delphi não é janela: "Confirmação" só tinha o
        # título; 17/11/2026, na 292: "Não existe movimento no período informado para esta conta. Deseja localizar a próxima
        # conta com movimento?")
        texto = texto_da_mensagem(ms[0])
        try:
            texto = texto + ' ' + ' '.join(nome(e) for e in itens(ms[0]) if tipo(e) in ('Text', 'Edit', 'Document') and nome(e))
        except Exception:
            pass
        diag('depois do Consultar, o Contábil avisou: ' + texto)
        t = norm(texto)
        sim_nao = botao_win32(ms[0], 'Sim') and botao_win32(ms[0], 'Não', 'Nao')
        if any(x in t for x in ('nenhum', 'nao ha', 'nao foram encontrad', 'nao existe', 'sem movimento', 'sem lancamento', 'proxima conta com movimento')) or (sim_nao and 'confirma' in t):
            responder_nao(ms[0])
            # o aviso para o nads (Vitor, 17/11/2026: "no nads vai aparecer o erro 'Movimento [meses] nao importado'")
            fim(ok=False, semMovimento=True, erro='Movimento ' + meses_do_periodo() + ' não importado')
        responder_nao(ms[0])
        break
    time.sleep(2)


def exportar(h):
    passo('exportando para o Excel')
    pasta = os.path.dirname(DESTINO)
    antes = set(glob.glob(os.path.join(pasta, '*')))
    sv = None
    limite = time.time() + 120
    while time.time() < limite and not sv:
        imp = next((e for e in itens(h) if norm(nome(e)) == 'imprimir' and tipo(e) in ('Button', 'MenuItem', 'SplitButton')), None)
        if not imp:
            time.sleep(2)
            continue
        clicar(imp, 'Imprimir')
        item = None
        lim2 = time.time() + 6
        while time.time() < lim2 and not item:
            for x in topo_do_fiscal():
                if win32gui.GetClassName(x) in ('TdxBarSubMenuControl', 'TdxBarPopupMenuControl') or 'menu' in win32gui.GetClassName(x).lower():
                    item = next((e for e in itens(x) if 'excel' in norm(nome(e))), None)
                    if item:
                        break
            if not item:
                time.sleep(.3)
        if not item:
            falhar('o Imprimir não mostrou o "Exportar para excel"')
        clicar(item, nome(item))
        sv = esperar(salvar_como, 15)
        if not sv:
            mensagem_na_frente('ao exportar')
    if not sv:
        falhar('a janela Salvar não abriu depois do Exportar para excel')
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
    novo, tamanhos = None, []
    limite = time.time() + 120
    while time.time() < limite:
        time.sleep(.5)
        for m in mensagens():
            diag('depois do Salvar, o Contábil perguntou: ' + texto_da_mensagem(m))
            responder_nao(m)
            time.sleep(.8)
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
    if not CODIGO.isdigit() or not CONTA.strip() or not (INICIO and FIM and DESTINO):
        fim(ok=False, erro='uso: alterdata_razao_conta.py <código> <conta> <início> <fim> <destino>')
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    try:
        import alterdata_tela
        t = alterdata_tela.preparar_tela()
        if t:
            print('TELA: ' + t, flush=True)
    except Exception as e:
        print('TELA: não preparei a tela: ' + type(e).__name__, flush=True)
    if any(win32gui.GetClassName(h).startswith('TfrmLogin') for h in topo_do_fiscal()):
        fim(ok=False, erro='o Alterdata Contábil está na tela de login')
    principal = principal_do_contabil()
    if not principal:
        fim(ok=False, erro='o Alterdata Contábil não está aberto (ou há dois abertos)')
    win32gui.ShowWindow(principal, win32con.SW_MAXIMIZE)
    try:
        win32gui.SetForegroundWindow(principal)
    except Exception:
        pass
    time.sleep(.6)
    for m in mensagens():
        responder_nao(m)
    form = abrir_a_consulta(principal)
    preencher(form)
    arquivo = exportar(form)
    passo('razão salvo')
    limpar()
    fim(ok=True, arquivo=arquivo, bytes=os.path.getsize(arquivo))
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + type(e).__name__ + ': ' + str(e)[:200])
