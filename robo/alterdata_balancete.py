# O balancete do Alterdata Contábil pelo robô do PC (Vitor, 14/10/2026: "vamos começar com o balancete"; "eu não quero o
# Claude como robô"). Usa o Contábil JÁ ABERTO E LOGADO neste PC (nunca digita login nem senha; não toca no banco de dados)
# e faz o caminho que o Vitor mostrou: Livros e Relatórios → Balancete ▾ → Balancete → Analítico, a empresa, o período,
# Visualizar → Concluir → na visualização, o ícone da impressora → "Imprimir para arquivo", Xlsx Dados Arquivo, o caminho no
# "Onde:" → OK. O arquivo é o "XLS Dados" que a Conferência já importa (código da conta entre colchetes).
#
# Travas (nada além de gerar e salvar o relatório):
# - nunca marca opção do balancete; responde "Não" para as filiais;
# - só clica em Concluir se o período na tela for o pedido;
# - só dá OK na janela Imprimir com "Imprimir para arquivo" MARCADO (senão sairia na impressora de papel);
# - se abrir o "Salvar como" do Windows, cancela; qualquer janela inesperada: para e fecha o que abriu.
#
# Uso: python alterdata_balancete.py <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <caminho do .xlsx>
# Escreve uma linha por passo: PASSO: …  e, no fim, RESULTADO: {"ok":true,"arquivo":…,"bytes":…} ou {"erro":"…"}.
import json, os, sys, time

from pywinauto import Desktop, mouse

sys.stdout.reconfigure(encoding='utf-8')   # o robô do nads lê em UTF-8 (o console do Windows não escreve '→')
CODIGO, INICIO, FIM, DESTINO = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = Desktop(backend='win32')


def passo(t):
    print('PASSO: ' + t, flush=True)


def fim(**r):
    print('RESULTADO: ' + json.dumps(r, ensure_ascii=False), flush=True)
    sys.exit(0 if r.get('ok') else 1)


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
    for w in janelas('TMessageForm'):   # pergunta aberta: Não (ou Cancelar), nunca Sim
        for b in filhos(w):
            if (b.window_text() or '').replace('&', '') in ('Não', 'Nao', 'Cancelar'):
                b.click_input()
                break
    for w in janelas('#32770', 'Salvar como'):
        for b in filhos(w, 'Button'):
            if b.control_id() == 2:
                b.click_input()
    for w in janelas('TAlterdataPpPrintDialogPatch'):
        for b in filhos(w, 'TButton', 'Cancelar'):
            b.click_input()
    for w in janelas('TAlterdataTppPrintPreview'):
        w.close()
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
    fim(erro=motivo)


try:
    # ── o Contábil aberto e logado
    if janelas('TfrmLogin'):
        fim(erro='o Alterdata Contábil está na tela de login: entre no Contábil deste PC e peça de novo')
    principais = janelas('TfrmPrincipal')
    if not principais:
        fim(erro='o Alterdata Contábil não está aberto neste PC: abra e entre, e peça de novo')
    if len(principais) > 1:
        fim(erro='há dois Contábil abertos neste PC: feche um e peça de novo')
    principal = principais[0]
    limpar()
    principal.set_focus()
    if not principal.is_maximized():
        principal.maximize()
    time.sleep(.5)
    r = principal.rectangle()
    ox, oy = r.left + 8, r.top + 8   # a janela maximizada fica em (-8, -8)

    # ── Livros e Relatórios → Balancete ▾ → Balancete
    passo('abrindo Livros e Relatórios → Balancete')
    mouse.click(coords=(ox + 288, oy + 47))
    time.sleep(1.2)
    mouse.click(coords=(ox + 258, oy + 100))
    time.sleep(1.5)
    mouse.click(coords=(ox + 286, oy + 147))
    cfg = esperar(lambda: janelas('TfrmBalanceteRelatorioConfiguracoes'), 25)
    if not cfg:
        falhar('a janela do Balancete não abriu')
    cfg = cfg[0]
    cfg.set_focus()
    time.sleep(.5)

    # ── a empresa (só ela; as filiais não)
    passo('empresa ' + CODIGO)
    edits = filhos(cfg, 'TcxTextEdit')
    if not edits:
        falhar('não achei o campo Código')
    cod = min(edits, key=lambda c: (c.rectangle().top, c.rectangle().left))
    cod.click_input()
    cod.type_keys(str(int(CODIGO)), pause=0.05)
    cod.type_keys('{ENTER}', pause=0.05)
    # a pergunta "Deseja selecionar as filiais desta empresa?" (janela Confirmação com Sim/Não): sempre Não
    def pergunta_das_filiais():
        r = []
        for w in janelas('TMessageForm'):
            botoes = [(b.window_text() or '').replace('&', '') for b in filhos(w)]
            if w.window_text() == 'Confirmação' and 'Sim' in botoes and ('Não' in botoes or 'Nao' in botoes):
                r.append(w)
        return r
    conf = esperar(pergunta_das_filiais, 8)
    if conf:
        nao = [b for b in filhos(conf[0]) if (b.window_text() or '').replace('&', '') in ('Não', 'Nao')]
        if not nao:
            falhar('não achei o "Não" da pergunta das filiais')
        nao[0].click_input()
        time.sleep(1)
    outros = [w for w in janelas('TMessageForm')]
    if outros:
        falhar('o Alterdata mostrou uma mensagem ao escolher a empresa ' + CODIGO + ' (empresa inexistente?)')

    # ── tipo e saída
    for cls, t in (('TcxRadioButton', 'Analítico'), ('TcxCustomRadioGroupButton', 'Visualizar')):
        b = filhos(cfg, cls, t)
        if not b:
            falhar('não achei ' + t)
        b[0].click_input()
        time.sleep(.3)

    # ── o período (campos com máscara: começo do campo e os 8 números por cima)
    passo('período ' + INICIO + ' a ' + FIM)
    datas = sorted(filhos(cfg, 'TcxMaskEdit'), key=lambda c: c.rectangle().left)
    if len(datas) < 2:
        falhar('não achei as datas do período')
    for campo, valor in zip(datas[:2], (INICIO, FIM)):
        campo.click_input()
        campo.type_keys('{HOME}', pause=0.05)
        campo.type_keys(valor.replace('/', ''), pause=0.05)
        campo.type_keys('{TAB}', pause=0.05)
        time.sleep(.4)
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
    mouse.click(coords=((rc.left + rc.right) // 2, (rc.top + rc.bottom) // 2))
    pv = esperar(lambda: janelas('TAlterdataTppPrintPreview'), 240, 2)
    if not pv:
        falhar('o balancete não abriu em 4 min')
    pv = pv[0]
    time.sleep(4)

    # ── a impressora da visualização → "Imprimir para arquivo", Xlsx Dados, o caminho no Onde:
    passo('salvando em Xlsx')
    dlg = None
    for tentativa in range(3):   # a visualização pode ainda estar terminando de carregar as páginas
        pv.set_focus()
        time.sleep(1)
        rp = pv.rectangle()
        mouse.click(coords=(rp.left + 8 + 18, rp.top + 8 + 35))
        dlg = esperar(lambda: janelas('TAlterdataPpPrintDialogPatch') or janelas('#32770', 'Salvar como'), 10)
        if dlg:
            break
    if not dlg:
        falhar('a janela Imprimir não abriu')
    dlg = dlg[0]
    if dlg.class_name() == '#32770':
        falhar('abriu o "Salvar como" em vez da janela Imprimir')
    dlg.set_focus()
    caixas = [c for c in filhos(dlg, 'TCheckBox') if c.window_text() == 'cbxPrintToFile']
    if not caixas:
        falhar('não achei o "Imprimir para arquivo"')
    caixa = max(caixas, key=lambda c: c.rectangle().top)
    if caixa.get_check_state() != 1:
        caixa.click_input()
        time.sleep(.8)
    if caixa.get_check_state() != 1:
        falhar('não consegui marcar "Imprimir para arquivo" (não vou mandar para a impressora)')
    tipos = [c for c in filhos(dlg, 'TComboBox') if 'Xlsx Dados Arquivo' in c.texts()]
    if not tipos:
        falhar('não achei o tipo Xlsx Dados Arquivo')
    tipo = tipos[0]
    tipo.select('Xlsx Dados Arquivo')
    time.sleep(.6)
    onde = [c for c in filhos(dlg, 'TEdit') if c.rectangle().top > tipo.rectangle().bottom]
    if not onde:
        falhar('não achei o campo Onde')
    onde = onde[0]
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    if os.path.exists(DESTINO):
        os.remove(DESTINO)
    onde.set_edit_text(DESTINO)
    time.sleep(.5)
    if tipo.window_text() != 'Xlsx Dados Arquivo' or onde.window_text() != DESTINO or caixa.get_check_state() != 1:
        falhar('a janela Imprimir não ficou como devia; não cliquei OK')
    ok = [c for c in filhos(dlg, 'TButton', 'OK')]
    ok[0].click_input()

    # ── o arquivo pronto (o tamanho parou de mudar)
    tamanhos = []
    for _ in range(90):
        time.sleep(1)
        t = os.path.getsize(DESTINO) if os.path.exists(DESTINO) else 0
        tamanhos.append(t)
        if t > 0 and tamanhos[-3:] == [t, t, t]:
            break
    t = os.path.getsize(DESTINO) if os.path.exists(DESTINO) else 0
    if t <= 0:
        falhar('o arquivo não apareceu em ' + DESTINO)
    limpar()
    fim(ok=True, arquivo=DESTINO, bytes=t)
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + str(e)[:200])
