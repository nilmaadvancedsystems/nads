# O balancete do PERÍODO pelo robô (17/11/2026, o caminho que o Vitor gravou com o alterdata_ensinar.py para a Conferência:
# "Vamo puxar o balancete... clicando em salvar, vem aquela logica de salvar... que voce ja sabe, ensina ele"). No Contábil JÁ
# ABERTO E LOGADO: Livros e Relatórios → Balancete ▾ → Balancete → a empresa (Enter) → "Não" para as filiais → o período
# (dd/mm/aaaa, as duas datas) → Concluir → na visualização, o botão Salvar → o salvar (a janela do Windows ou a Imprimir para
# arquivo) → a planilha na pasta do pedido.
#
# Travas (nada além de gerar e salvar o relatório):
# - não mexe nas opções do balancete (o Vitor não mexeu); só garante o "Visualizar" (senão sairia na impressora de papel);
# - responde "Não" para as filiais e para qualquer pergunta depois do Salvar;
# - só clica em Concluir se o período na tela for o pedido;
# - janela inesperada depois do Salvar: descreve (DIAG) e para, fechando o que abriu.
#
# Uso: python alterdata_balancete_periodo.py <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <caminho .xls>
# Escreve PASSO:/CLIQUE:/DIAG: e, no fim, RESULTADO: {"ok":true,"arquivo":…,"bytes":…} ou {"ok":false,"erro":"…"}.
import glob, json, os, sys, time

import win32con
import win32gui
from pywinauto import Desktop, mouse

sys.stdout.reconfigure(encoding='utf-8')
CODIGO, INICIO, FIM, DESTINO = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
PASTA = os.path.dirname(DESTINO)
BASE = os.path.splitext(DESTINO)[0]
d = Desktop(backend='win32')
uia = Desktop(backend='uia')


def passo(t):
    print('PASSO: ' + t, flush=True)


def clique(t):
    print('CLIQUE: ' + t, flush=True)


def diag(t):
    t = ' '.join(str(t).split())
    while t:
        print('DIAG: ' + t[:260], flush=True)
        t = t[260:]


def fim(**r):
    if 'erro' in r and 'ok' not in r:
        r['ok'] = False
    print('RESULTADO: ' + json.dumps(r, ensure_ascii=False), flush=True)
    sys.exit(0 if r.get('ok') else 1)


def so_contabil(ws):
    """Só as janelas do Contábil (o Fiscal aberto no mesmo servidor tem janelas com as mesmas classes; 16/11/2026)."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
        import alterdata_processo
        return [w for w in ws if alterdata_processo.do_contabil(w.handle)]
    except Exception:
        return ws

def janelas(cls=None, titulo=None):
    r = []
    for w in d.windows():
        try:
            if w.is_visible() and (cls is None or w.class_name() == cls) and (titulo is None or w.window_text() == titulo):
                r.append(w)
        except Exception:
            pass
    return r


def esperar(teste, segundos, intervalo=0.5):
    limite = time.time() + segundos
    while time.time() < limite:
        x = teste()
        if x:
            return x
        time.sleep(intervalo)
    return None


def filhos(w, cls=None, texto=None):
    r = []
    for c in w.descendants():
        try:
            if c.is_visible() and (cls is None or c.class_name() == cls) and (texto is None or (c.window_text() or '').strip() == texto):
                r.append(c)
        except Exception:
            pass
    return r


def limpar():
    """Fecha o que este roteiro abre (visualização, Salvar como, Imprimir, Balancete), sem gerar nada."""
    fechou = False   # só espera quando fechou alguma coisa (antes eram 2 × 0,5 s sempre, também no começo)
    for w in janelas('TMessageForm'):   # pergunta aberta: Não (ou Cancelar), nunca Sim
        for b in filhos(w):
            if (b.window_text() or '').replace('&', '') in ('Não', 'Nao', 'Cancelar'):
                b.click_input()
                fechou = True
                break
    for w in janelas('#32770'):
        if 'salvar' in (w.window_text() or '').lower() or 'exportar' in (w.window_text() or '').lower():
            for b in filhos(w, 'Button'):
                if b.control_id() == 2:
                    b.click_input()
                    fechou = True
    for w in janelas('TAlterdataPpPrintDialogPatch'):
        for b in filhos(w, 'TButton', 'Cancelar'):
            b.click_input()
            fechou = True
    for w in janelas('TAlterdataTppPrintPreview'):
        w.close()
        fechou = True
    if fechou:
        time.sleep(.5)
    for w in janelas('TfrmBalanceteRelatorioConfiguracoes'):
        for b in filhos(w, 'TcxButton', '&Cancelar'):
            b.click_input()
            time.sleep(.5)


def falhar(motivo):
    try:
        limpar()
    except Exception:
        pass
    fim(ok=False, erro=motivo)



def com_tela(motivo, nome):
    """O erro de janela que não abriu leva a tela junto (tamanho, janelas à mostra, foto): alterdata_tela.py (09/11/2026)."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
        import alterdata_tela
        return alterdata_tela.resumo_do_erro(motivo, nome)
    except Exception:
        return motivo


def preparar_tela():
    """A tela acesa enquanto o roteiro roda (sem trocar a resolução): alterdata_tela.py (09/11/2026)."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
        import alterdata_tela
        t = alterdata_tela.preparar_tela()
    except Exception as e:
        t = 'não preparei a tela: ' + type(e).__name__ + ': ' + str(e)[:120]
    if t:
        print('TELA: ' + t, flush=True)

try:
    # ── o Contábil aberto e logado
    if so_contabil(janelas('TfrmLogin')):
        fim(erro='o Alterdata Contábil está na tela de login: entre no Contábil deste PC e peça de novo')
    principais = so_contabil(janelas('TfrmPrincipal'))
    if not principais:
        fim(erro='o Alterdata Contábil não está aberto neste PC: abra e entre, e peça de novo')
    if len(principais) > 1:
        # mais de um Contábil aberto (Vitor, 19/11/2026: "se tiver mais de um contabil aberto, ele escolher qualquer um e usar,
        # fechar as janelas abertas e executar a acao"): usa o que não está travado por uma janela; as janelas abertas fecham
        # no limpar/liberar de sempre
        import win32gui
        principais.sort(key=lambda w: 0 if win32gui.IsWindowEnabled(w.handle) else 1)
        print('TELA: ' + str(len(principais)) + ' Contábil abertos: usei um deles', flush=True)
    principal = principais[0]
    limpar()
    preparar_tela()
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
        import alterdata_faixa
        fechadas = alterdata_faixa.liberar(principal)
        if fechadas:
            print('TELA: o Contábil estava travado por ' + ', '.join(fechadas) + ' (janela na frente da principal): fechei', flush=True)
    except Exception as e:
        print('TELA: não liberei o Contábil: ' + str(e)[:200], flush=True)
        if 'alterdata_faixa' not in sys.modules:
            fim(erro='não carreguei o alterdata_faixa.py: ' + str(e)[:200])
    principal.set_focus()
    if not principal.is_maximized():
        principal.maximize()
    time.sleep(.5)

    # ── Livros e Relatórios → Balancete ▾ → Balancete, pelo nome (09/11/2026: pela posição medida no PC, no console de
    # 1024x768 do servidor o clique caía noutro botão)
    passo('abrindo Livros e Relatórios → Balancete')
    try:
        clique('menu Livros e Relatórios')
        alterdata_faixa.aba(principal, 'Livros e Relatórios')
        clique('Balancete ▾')
        alterdata_faixa.botao(principal, 'Balancete', embaixo=True)
        # o botão de lista abre o menu; se já abriu a configuração (o clique pegou a parte de cima), segue
        if not esperar(lambda: janelas('TfrmBalanceteRelatorioConfiguracoes'), 1.5, .25):
            clique('Balancete')
            alterdata_faixa.item_do_menu(principal, 'Balancete', primeiro_se_mudo=True)
    except alterdata_faixa.Falha as e:
        falhar(com_tela(str(e), 'balancete-faixa'))
    cfg = esperar(lambda: janelas('TfrmBalanceteRelatorioConfiguracoes'), 25, .25)
    if not cfg:
        falhar(com_tela('a janela do Balancete não abriu', 'balancete-nao-abriu'))
    cfg = cfg[0]
    cfg.set_focus()
    time.sleep(.5)

    # ── a empresa (só ela; as filiais não)
    passo('empresa ' + CODIGO)
    edits = filhos(cfg, 'TcxTextEdit')
    if not edits:
        falhar('não achei o campo Código')
    cod = min(edits, key=lambda c: (c.rectangle().top, c.rectangle().left))
    clique('campo Código: ' + str(int(CODIGO)))
    cod.click_input()
    cod.type_keys(str(int(CODIGO)), pause=0.02)
    cod.type_keys('{ENTER}', pause=0.05)
    # a pergunta "Deseja selecionar as filiais desta empresa?" (a Confirmação, o Vitor clicou em Não): toda pergunta do Contábil
    # com "Não" leva Não; mensagem sem "Não" (empresa inexistente) para o roteiro. Só as janelas do Contábil (o Fiscal aberto
    # no mesmo PC tem as mesmas classes).
    def mensagens_do_contabil():
        return [w for w in so_contabil(janelas('TMessageForm'))] + [w for w in so_contabil(janelas('#32770')) if 'salvar' not in (w.window_text() or '').lower()]
    calmo = 0
    limite = time.time() + 10
    while time.time() < limite:
        ms = mensagens_do_contabil()
        if not ms:
            calmo += 1
            if calmo >= 4:
                break
            time.sleep(.4)
            continue
        calmo = 0
        m = ms[0]
        texto = ' '.join((c.window_text() or '').strip() for c in filhos(m) if (c.window_text() or '').strip())
        diag('ao escolher a empresa: ' + m.class_name() + ' "' + (m.window_text() or '') + '": ' + texto[:200])
        nao = [x for x in filhos(m) if (x.window_text() or '').replace('&', '').strip() in ('Não', 'Nao')]
        if not nao:
            falhar('o Alterdata mostrou uma mensagem ao escolher a empresa ' + CODIGO + ': ' + texto[:200])
        clique('"Não" (' + (m.window_text() or 'pergunta') + ')')
        nao[0].click_input()
        time.sleep(.6)

    # ── as opções do balancete ficam como estão (o Vitor não mexeu); só o Visualizar, para não ir à impressora de papel
    for t in ('Analítico', 'Sintético'):
        for x in filhos(cfg, 'TcxRadioButton', t):
            try:
                diag('opção ' + t + ': ' + ('marcada' if x.get_check_state() == 1 else 'desmarcada'))
            except Exception:
                pass
    vis = filhos(cfg, 'TcxCustomRadioGroupButton', 'Visualizar')
    if not vis:
        falhar('não achei o Visualizar (não vou gerar: sairia na impressora)')
    clique('Visualizar')
    vis[0].click_input()
    time.sleep(.2)

    # ── o período (campos com máscara: começo do campo e os 8 números por cima)
    passo('período ' + INICIO + ' a ' + FIM)
    datas = sorted(filhos(cfg, 'TcxMaskEdit'), key=lambda c: c.rectangle().left)
    if len(datas) < 2:
        falhar('não achei as datas do período')
    for campo, valor in zip(datas[:2], (INICIO, FIM)):
        clique('data ' + valor)
        campo.click_input()
        campo.type_keys('{HOME}', pause=0.02)
        campo.type_keys(valor.replace('/', ''), pause=0.02)
        campo.type_keys('{TAB}', pause=0.02)
        time.sleep(.2)
    datas = sorted(filhos(cfg, 'TcxMaskEdit'), key=lambda c: c.rectangle().left)
    if [c.window_text() for c in datas[:2]] != [INICIO, FIM]:
        falhar('o período não ficou certo na tela (' + ' a '.join(c.window_text() for c in datas[:2]) + ')')

    # ── Concluir e a visualização
    passo('gerando o balancete')
    concluir = filhos(cfg, 'TcxButton', 'C&oncluir')
    if not concluir:
        falhar('não achei o Concluir')
    cfg.set_focus()
    time.sleep(.3)
    rc = concluir[0].rectangle()
    clique('Concluir (o Alterdata monta o balancete)')
    mouse.click(coords=((rc.left + rc.right) // 2, (rc.top + rc.bottom) // 2))
    pv = esperar(lambda: janelas('TAlterdataTppPrintPreview'), 240, .5)
    if not pv:
        falhar('o balancete não abriu em 4 min')
    pv = pv[0]
    time.sleep(2)

    # ── o Salvar da visualização (o botão da barra, como o Vitor clicou)
    def depois_do_salvar():
        r = []
        for w in so_contabil(d.windows()):
            try:
                cls = w.class_name()
                if not w.is_visible() or w.handle == pv.handle:
                    continue
                if cls in ('#32770', 'TAlterdataPpPrintDialogPatch', 'TMessageForm') or (cls.startswith('Tfrm') and cls not in ('TfrmPrincipal', 'TfrmBalanceteRelatorioConfiguracoes')):
                    r.append(w)
            except Exception:
                pass
        return r

    passo('salvando a planilha')
    antes = set(glob.glob(os.path.join(PASTA, '*')))
    os.makedirs(PASTA, exist_ok=True)
    janela = None
    for tentativa in range(3):   # a visualização pode ainda estar terminando de carregar as páginas
        pv.set_focus()
        time.sleep(.5)
        botao = None
        try:
            botao = next((e for e in uia.window(handle=pv.handle).descendants(control_type='Button') if (e.window_text() or '').strip() == 'Salvar'), None)
        except Exception as e:
            diag('UIA na visualização: ' + str(e)[:150])
        clique('Salvar')
        if botao:
            botao.click_input()
        else:   # onde o Vitor clicou: a 595,40 da janela
            rp = pv.rectangle()
            mouse.click(coords=(rp.left + 595, rp.top + 40))
        janela = esperar(depois_do_salvar, 10)
        if janela:
            break
    if not janela:
        falhar('nada abriu depois do Salvar da visualização')
    j = janela[0]
    diag('depois do Salvar abriu: ' + j.class_name() + ' "' + (j.window_text() or '') + '"')
    for c in filhos(j):
        try:
            t = (c.window_text() or '').strip()
            extra = ' [' + ' | '.join(c.texts()[1:12]) + ']' if c.class_name() in ('ComboBox', 'TComboBox', 'TcxComboBox') else ''
            if t or extra:
                diag('  ' + c.class_name() + ' "' + t[:60] + '"' + extra)
        except Exception:
            pass

    if j.class_name() == 'TAlterdataPpPrintDialogPatch':
        # a janela Imprimir: "Imprimir para arquivo" marcado, Xlsx Dados Arquivo e o caminho no Onde
        caixas = [c for c in filhos(j, 'TCheckBox') if c.window_text() == 'cbxPrintToFile']
        if not caixas:
            falhar('não achei o "Imprimir para arquivo"')
        caixa = max(caixas, key=lambda c: c.rectangle().top)
        if caixa.get_check_state() != 1:
            clique('"Imprimir para arquivo"')
            caixa.click_input()
            time.sleep(.5)
        if caixa.get_check_state() != 1:
            falhar('não consegui marcar "Imprimir para arquivo" (não vou mandar para a impressora)')
        tipos = [c for c in filhos(j, 'TComboBox') if 'Xlsx Dados Arquivo' in c.texts()]
        if not tipos:
            falhar('não achei o tipo Xlsx Dados Arquivo')
        tipo = tipos[0]
        tipo.select('Xlsx Dados Arquivo')
        time.sleep(.3)
        onde = [c for c in filhos(j, 'TEdit') if c.rectangle().top > tipo.rectangle().bottom]
        if not onde:
            falhar('não achei o campo Onde')
        alvo = BASE + '.xlsx'
        onde[0].set_edit_text(alvo)
        time.sleep(.2)
        if tipo.window_text() != 'Xlsx Dados Arquivo' or onde[0].window_text() != alvo or caixa.get_check_state() != 1:
            falhar('a janela Imprimir não ficou como devia; não cliquei OK')
        clique('OK (salvando o arquivo)')
        filhos(j, 'TButton', 'OK')[0].click_input()
    elif j.class_name() == '#32770':
        # o Salvar do Windows: o tipo de Excel, se houver escolha, e o caminho no Nome
        h = j.handle
        combos = [c for c in filhos(j) if c.class_name() == 'ComboBox' and c.control_id() == 1136]
        ext = '.xls'
        if combos:
            ops = combos[0].texts()[1:]
            pref = next((o for o in ops if 'xlsx' in o.lower()), None) or next((o for o in ops if 'xls' in o.lower() or 'excel' in o.lower()), None)
            if pref:
                if pref != combos[0].window_text():
                    clique('tipo ' + pref)
                    combos[0].select(pref)
                    time.sleep(.3)
                ext = '.xlsx' if 'xlsx' in pref.lower() else '.xls'
            else:
                falhar('o Salvar não oferece Excel (tipos: ' + ' | '.join(ops)[:200] + ')')
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
        win32gui.EnumChildWindows(h, ver, None)
        nomecx = next((c for c, eh in edits if eh), None) or (edits[0][0] if edits else None)
        if not nomecx:
            falhar('não achei o Nome na janela Salvar')
        win32gui.SendMessage(nomecx, win32con.WM_SETTEXT, 0, BASE + ext)
        time.sleep(.3)
        sv = [c for c in filhos(j, 'Button') if (c.window_text() or '').replace('&', '') == 'Salvar']
        if not sv:
            falhar('não achei o botão Salvar')
        clique('Salvar')
        win32gui.PostMessage(sv[0].handle, win32con.BM_CLICK, 0, 0)
    else:
        falhar('depois do Salvar abriu uma janela que eu ainda não conheço: ' + j.class_name() + ' "' + (j.window_text() or '') + '"')

    # ── o arquivo pronto (apareceu na pasta e o tamanho parou de mudar); pergunta depois do Salvar: Não
    novo, tamanhos = None, []
    limite = time.time() + 180
    while time.time() < limite:
        time.sleep(.5)
        for w in janelas('TMessageForm'):
            diag('depois do Salvar, o Contábil perguntou: ' + ' '.join((c.window_text() or '') for c in filhos(w))[:200])
            nao = [b for b in filhos(w) if (b.window_text() or '').replace('&', '') in ('Não', 'Nao', 'OK')]
            if nao:
                nao[0].click_input()
                time.sleep(.6)
        novos = [p for p in glob.glob(os.path.join(PASTA, '*')) if p not in antes and not p.lower().endswith(('.tmp', '.~tmp')) and not os.path.basename(p).startswith('~$')]
        if novos:
            novo = max(novos, key=os.path.getmtime)
            t = os.path.getsize(novo)
            tamanhos.append(t)
            if t > 0 and tamanhos[-3:] == [t, t, t]:
                break
    if not novo or os.path.getsize(novo) <= 0:
        falhar('a planilha não apareceu na pasta depois do Salvar')
    passo('balancete salvo')
    limpar()
    fim(ok=True, arquivo=novo, bytes=os.path.getsize(novo))
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + str(e)[:200])
