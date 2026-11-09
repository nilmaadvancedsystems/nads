# O razão de todas as contas do Alterdata Contábil pelo robô do PC (Vitor, 04/11/2026: "quero criar um robo que puxa
# balancete e planilha de conta e upa no nads"). Usa o Contábil JÁ ABERTO E LOGADO neste PC (nunca digita login nem senha;
# não toca no banco) e faz o caminho que o Vitor ensinou:
#   Livros e Relatórios → Razão ▾ → Razão → o código da empresa (Enter; filiais: Não) → Avançar → o período → Avançar →
#   Tipo Geral → Avançar → Ordem Nome + Código → Avançar → Avançar → "Gerar o relatório em arquivo CSV", a PASTA no
#   "Local para geração" (o nome o Alterdata põe: Razão<código>.csv), Sem Limite → Avançar → Visualizar → Concluir.
#
# Travas (nada além de gerar e salvar o relatório):
# - cada pedido numa pasta própria e vazia (o robô cria): o CSV de um pedido nunca é pego por outro;
# - confere cada página do assistente pelo nome dela antes de mexer; qualquer janela inesperada: para e fecha o que abriu;
# - só clica em Concluir com o CSV marcado, a pasta certa e a operação Visualizar (nunca Imprimir, que iria ao papel).
#
# Uso: python alterdata_razao.py <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <pasta do pedido> <caminho final do .csv>
# Escreve PASSO: … por passo e, no fim, RESULTADO: {"ok":true,"arquivo":…,"bytes":…} ou {"erro":"…"}.
import glob, json, os, sys, time

from pywinauto import Desktop, mouse

sys.stdout.reconfigure(encoding='utf-8')
CODIGO, INICIO, FIM, PASTA, DESTINO = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
d = Desktop(backend='win32')


def passo(t):
    print('PASSO: ' + t, flush=True)


def clique(t):
    # o que o robô está fazendo agora, para a barra de andamento do nads (05/11/2026, Vitor: "quero que no nads tenha um
    # feedback do que o robo ta fazendo, onde ele ta clicando")
    print('CLIQUE: ' + t, flush=True)


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


def sem_e(t):
    return (t or '').replace('&', '').strip()


def botao(w, nome):
    """O TBitBtn visível do assistente pelo nome sem o & ('Avançar >', 'Concluir', 'Fechar', 'Cancelar')."""
    b = [c for c in filhos(w, 'TBitBtn') if sem_e(c.window_text()) == nome]
    return b[0] if b else None


def pagina(w):
    """O nome da página do assistente que está à mostra (pgeSelecao, pgeTipo, pgeOpcoes, pgeOpcoesImpressao…)."""
    p = filhos(w, 'TTabSheet')
    return p[0].window_text() if p else ''


def limpar():
    """Fecha o que este roteiro abre (pergunta, visualização, o assistente do Razão), sem gerar nada."""
    fechou = False   # só espera quando fechou alguma coisa
    for w in janelas('TMessageForm'):   # pergunta aberta: Não (ou Cancelar), nunca Sim
        for b in filhos(w):
            if sem_e(b.window_text()) in ('Não', 'Nao', 'Cancelar'):
                b.click_input()
                fechou = True
                break
    for w in janelas('TAlterdataTppPrintPreview'):
        w.close()
        fechou = True
    if fechou:
        time.sleep(.5)
    for w in janelas('TfrmRazaoDlg'):
        b = botao(w, 'Fechar') or botao(w, 'Cancelar')
        if b:
            b.click_input()
        else:
            w.close()
        time.sleep(.5)


def falhar(motivo):
    try:
        limpar()
    except Exception:
        pass
    fim(erro=motivo)


def com_tela(motivo, nome):
    """O erro de janela que não abriu leva a tela junto (tamanho, janelas à mostra, foto): alterdata_tela.py (09/11/2026)."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
        import alterdata_tela
        return alterdata_tela.resumo_do_erro(motivo, nome)
    except Exception:
        return motivo


def avancar(dlg, de):
    """Avançar e esperar a página mudar (de = o nome da página de agora)."""
    b = botao(dlg, 'Avançar >')
    if not b:
        falhar('não achei o Avançar na página ' + de)
    clique('Avançar')
    b.click_input()
    nova = esperar(lambda: (pagina(dlg) != de and pagina(dlg)) or (janelas('TMessageForm') and 'mensagem'), 15, .2)
    if nova == 'mensagem' or janelas('TMessageForm'):
        falhar('o Alterdata mostrou uma mensagem ao avançar da página ' + de)
    if not nova:
        falhar('o assistente do Razão não saiu da página ' + de)
    time.sleep(.2)
    return nova


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
    if not os.path.isdir(PASTA) or os.listdir(PASTA):
        fim(erro='a pasta do pedido não está vazia ou não existe: ' + PASTA)
    principal.set_focus()
    if not principal.is_maximized():
        principal.maximize()
    time.sleep(.5)
    r = principal.rectangle()
    ox, oy = r.left + 8, r.top + 8   # a janela maximizada fica em (-8, -8)

    # ── Livros e Relatórios → Razão ▾ → Razão
    passo('abrindo Livros e Relatórios → Razão')
    clique('menu Livros e Relatórios')
    mouse.click(coords=(ox + 288, oy + 47))
    time.sleep(.8)
    clique('Razão ▾')
    mouse.click(coords=(ox + 143, oy + 125))
    time.sleep(1)
    clique('Razão')
    mouse.click(coords=(ox + 168, oy + 148))
    dlg = esperar(lambda: janelas('TfrmRazaoDlg'), 25, .25)
    if not dlg:
        falhar(com_tela('a janela do Razão não abriu', 'razao-nao-abriu'))
    dlg = dlg[0]
    dlg.set_focus()
    time.sleep(.5)
    if pagina(dlg) != 'pgeSelecao':
        falhar('o Razão abriu fora da página da empresa (' + pagina(dlg) + ')')

    # ── a empresa (só ela; as filiais não)
    passo('empresa ' + CODIGO)
    edits = [c for c in filhos(dlg, 'TcxTextEdit')]
    if not edits:
        falhar('não achei o campo Código')
    cod = min(edits, key=lambda c: (c.rectangle().top, c.rectangle().left))
    clique('campo Código: ' + str(int(CODIGO)))
    cod.click_input()
    cod.type_keys(str(int(CODIGO)), pause=0.02)
    cod.type_keys('{ENTER}', pause=0.05)
    def pergunta_das_filiais():
        r = []
        for w in janelas('TMessageForm'):
            botoes = [sem_e(b.window_text()) for b in filhos(w)]
            if 'Sim' in botoes and ('Não' in botoes or 'Nao' in botoes):
                r.append(w)
        return r
    # segue assim que a empresa entra (o Livro e a Página se preenchem) ou a pergunta das filiais aparece; antes esperava
    # 5 s fixos pela pergunta (04/11/2026: "ele demora bastante depois de colocar a empresa")
    def empresa_entrou():
        return any((c.window_text() or '').strip() for c in filhos(dlg, 'TDBEdit'))
    esperar(lambda: pergunta_das_filiais() or empresa_entrou(), 8, 0.2)
    conf = pergunta_das_filiais() or esperar(pergunta_das_filiais, 0.6, 0.2)
    if conf:
        nao = [b for b in filhos(conf[0]) if sem_e(b.window_text()) in ('Não', 'Nao')]
        if not nao:
            falhar('não achei o "Não" da pergunta das filiais')
        clique('"Não" para as filiais')
        nao[0].click_input()
        time.sleep(.5)
    if janelas('TMessageForm'):
        falhar('o Alterdata mostrou uma mensagem ao escolher a empresa ' + CODIGO + ' (empresa inexistente?)')
    if not empresa_entrou():
        falhar('a empresa ' + CODIGO + ' não entrou na seleção do Razão')
    time.sleep(.3)
    pg = avancar(dlg, 'pgeSelecao')

    # ── o período (campos com máscara: começo do campo e os 8 números por cima)
    passo('período ' + INICIO + ' a ' + FIM)
    def campos_de_data():
        r = []
        for c in dlg.descendants():
            try:
                if c.is_visible() and ('Mask' in c.class_name() or 'DateEdit' in c.class_name()):
                    r.append(c)
            except Exception:
                pass
        return sorted(r, key=lambda c: c.rectangle().left)
    datas = campos_de_data()
    if len(datas) < 2:
        falhar('não achei as datas do período (página ' + pg + ')')
    for campo, valor in zip(datas[:2], (INICIO, FIM)):
        clique('data ' + valor)
        campo.click_input()
        campo.type_keys('{HOME}', pause=0.02)
        campo.type_keys(valor.replace('/', ''), pause=0.02)
        time.sleep(.2)
    lidas = [c.window_text() for c in campos_de_data()[:2]]
    if lidas != [INICIO, FIM]:
        falhar('o período não ficou certo na tela (' + ' a '.join(lidas) + ')')
    pg = avancar(dlg, pg)

    # ── Tipo: Geral (todas as contas)
    if pg != 'pgeTipo':
        falhar('esperava a página do Tipo e veio ' + pg)
    geral = [c for c in filhos(dlg, 'TGroupButton') if sem_e(c.window_text()) == 'Geral']
    if not geral:
        falhar('não achei o tipo Geral')
    clique('tipo Geral (todas as contas)')
    geral[0].click_input()
    time.sleep(.2)
    if geral[0].get_check_state() != 1:
        falhar('não consegui marcar o tipo Geral')
    pg = avancar(dlg, pg)

    # ── Ordem: Nome + Código
    if pg != 'pgeOpcoes':
        falhar('esperava a página das Opções e veio ' + pg)
    ordem = filhos(dlg, 'TRadioButton', 'Nome + Código')
    if not ordem:
        falhar('não achei a ordem Nome + Código')
    clique('ordem Nome + Código')
    ordem[0].click_input()
    time.sleep(.2)
    if ordem[0].get_check_state() != 1:
        falhar('não consegui marcar Nome + Código')
    pg = avancar(dlg, pg)

    # ── as opções de impressão ficam como estão; a página do arquivo texto vem em seguida
    for _ in range(2):
        if pg == 'pgeOpcoesImpressao':
            break
        pg = avancar(dlg, pg)
    if pg != 'pgeOpcoesImpressao':
        falhar('não cheguei à página do arquivo CSV (' + pg + ')')

    # ── o CSV na pasta do pedido (o nome o Alterdata põe), Sem Limite
    passo('gerando o CSV na pasta do pedido')
    caixa = [c for c in filhos(dlg, 'TcxCheckBox') if 'CSV' in (c.window_text() or '')]
    edicao = [c for c in filhos(dlg, 'TcxButtonEdit')]
    if not caixa or not edicao:
        falhar('não achei o "Gerar o relatório em arquivo CSV"')
    interno = [c for c in edicao[0].children() if c.class_name() == 'TcxCustomInnerTextEdit']
    if not interno:
        falhar('não achei o campo Local para geração do arquivo')
    interno = interno[0]
    # o "Gerar o relatório em arquivo CSV" abre desmarcado (o assistente não guarda a escolha): um clique marca. O campo da
    # pasta fica ligado com ou sem a marca, então não serve de prova (04/11/2026: o primeiro teste encheu a pasta sem marcar)
    clique('"Gerar o relatório em arquivo CSV"')
    caixa[0].click_input()
    time.sleep(.5)
    clique('pasta do pedido no "Local para geração"')
    interno.set_edit_text(PASTA)
    time.sleep(.2)
    sem_limite = [c for c in filhos(dlg, 'TGroupButton') if sem_e(c.window_text()) == 'Sem Limite']
    if sem_limite and sem_limite[0].get_check_state() != 1:
        clique('Sem Limite')
        sem_limite[0].click_input()
        time.sleep(.2)
    if interno.window_text() != PASTA:
        falhar('a pasta do CSV não ficou certa (' + interno.window_text() + ')')
    pg = avancar(dlg, pg)

    # ── Visualizar → Concluir (nunca Imprimir)
    vis = [c for c in filhos(dlg, 'TGroupButton') if sem_e(c.window_text()) == 'Visualizar']
    if not vis:
        falhar('não achei a operação Visualizar (página ' + pg + ')')
    clique('Visualizar')
    vis[0].click_input()
    time.sleep(.2)
    if vis[0].get_check_state() != 1:
        falhar('não consegui marcar Visualizar (não vou mandar para a impressora)')
    concluir = botao(dlg, 'Concluir')
    if not concluir:
        falhar('não achei o Concluir')
    clique('Concluir (o Alterdata monta o razão)')
    concluir.click_input()

    # ── o resultado e o CSV pronto (o tamanho parou de mudar)
    def resultado():
        if pagina(dlg) != 'pgeResultado':
            return None
        m = filhos(dlg, 'TMemo')
        return m[0].window_text() if m else None
    texto = esperar(resultado, 8 * 60 - 60, .5)
    if not texto:
        falhar('o Razão não terminou em 7 min')
    if 'conclu' not in texto.lower():
        falhar('o Alterdata não concluiu o Razão: ' + ' '.join(texto.split())[:200])
    def csv_pronto():
        achados = glob.glob(os.path.join(PASTA, '*.csv'))
        return achados if len(achados) == 1 else None
    achado = esperar(csv_pronto, 60, .3)
    if not achado:
        falhar('o CSV não apareceu na pasta do pedido (' + str(len(glob.glob(os.path.join(PASTA, '*.csv')))) + ' arquivos)')
    tamanhos = []
    for _ in range(60):
        t = os.path.getsize(achado[0])
        tamanhos.append(t)
        if tamanhos[-3:] == [t, t, t]:
            break
        time.sleep(.4)
    limpar()
    if os.path.abspath(achado[0]) != os.path.abspath(DESTINO):
        if os.path.exists(DESTINO):
            os.remove(DESTINO)
        os.replace(achado[0], DESTINO)
    fim(ok=True, arquivo=DESTINO, bytes=os.path.getsize(DESTINO))
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + str(e)[:200])
