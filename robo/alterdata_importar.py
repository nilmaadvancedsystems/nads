# A importação dos lançamentos no Alterdata Contábil pelo robô (06/11/2026, Vitor: "importar os lancamentos direto no
# alterdata"; o caminho, corrigido no mesmo dia: "não é em importar lançamentos, é em importação financeira e o layout é
# importação personalizada - excel"; o resto é igual: a empresa, o nome do lote, o local da planilha, o layout, Concluir). A planilha é o .xls de 10 colunas que o nads gera (o mesmo do
# Baixar). Usa o Contábil JÁ ABERTO E LOGADO (nunca digita login nem senha).
#
# O caminho: aba Lançamentos → Importação financeira (texto ou planilha) → (se pedir o sistema: "Importação texto ou
# planilha" → Avançar) → a empresa, "Criar novo Lote", a descrição do lote, o caminho da planilha, o layout
# "Importação Personalizada - Excel" → Concluir.
#
# Travas (só importa o que foi pedido, num lote novo):
# - só clica em Concluir com a empresa, a descrição, o arquivo e o layout conferidos na tela;
# - nunca importa em lote já existente; nunca mexe no layout (Configurar Layout fica intocado);
# - depois do Concluir: mensagem só com OK é lida e fechada; pergunta (Sim/Não) nunca leva Sim: o roteiro conta o que ela
#   perguntava, responde Não e para;
# - cada janela nova que aparecer vai para o log (DIAG:), para conferir o que o Alterdata mostrou.
#
# Uso: python alterdata_importar.py <código> <descrição do lote> <caminho da planilha .xls>
# Escreve PASSO: … / CLIQUE: … e, no fim, RESULTADO: {"ok":true,"mensagens":[…]} ou {"ok":false,"erro":"…","mensagens":[…]}.
import json, os, sys, time

from pywinauto import Desktop, mouse

sys.stdout.reconfigure(encoding='utf-8')
CODIGO, LOTE, PLANILHA = sys.argv[1], sys.argv[2], sys.argv[3]
LAYOUT = 'Importação Personalizada - Excel'
d = Desktop(backend='win32')
mensagens = []
CLASSE = 'TfrmImportacaoLotes'   # a janela da importação (trocada pela que abrir de verdade)
BOTOES = ('TButton', 'TBitBtn', 'TcxButton', 'Button')


def passo(t):
    print('PASSO: ' + t, flush=True)


def clique(t):
    print('CLIQUE: ' + t, flush=True)


def fim(**r):
    r.setdefault('mensagens', mensagens)
    print('RESULTADO: ' + json.dumps(r, ensure_ascii=False), flush=True)
    sys.exit(0 if r.get('ok') else 1)


def janelas(cls=None):
    r = []
    for w in d.windows():
        try:
            if w.is_visible() and (cls is None or w.class_name() == cls):
                r.append(w)
        except Exception:
            pass
    return r


def esperar(teste, segundos, intervalo=0.3):
    limite = time.time() + segundos
    while time.time() < limite:
        x = teste()
        if x:
            return x
        time.sleep(intervalo)
    return None


def filhos(w, cls=None, texto=None):
    r = []
    try:
        todos = w.descendants()
    except Exception:   # a janela sumiu no meio
        return r
    for c in todos:
        try:
            if c.is_visible() and (cls is None or c.class_name() == cls) and (texto is None or (c.window_text() or '').strip() == texto):
                r.append(c)
        except Exception:
            pass
    return r


def texto_da_mensagem(w):
    partes = []
    for c in filhos(w):
        try:
            t = (c.window_text() or '').strip()
            if t and c.class_name() not in BOTOES:
                partes.append(t)
        except Exception:
            pass
    return ' '.join(partes)[:400]


def botoes(w):
    return [(b, (b.window_text() or '').replace('&', '').strip()) for b in filhos(w) if b.class_name() in BOTOES]


def apertar(w, nomes):
    for b, t in botoes(w):
        if t in nomes:
            b.click_input()
            return t
    return None


def mensagens_abertas():
    return janelas('TMessageForm') + [w for w in janelas('#32770') if w.window_text() != 'Salvar como']


ENSAIO = '--ensaio' in sys.argv


def limpar():
    """Fecha a Importação de Lançamentos aberta (Fechar/Cancelar), sem importar nada. No ensaio, nem o OK."""
    for w in mensagens_abertas():
        apertar(w, ('Não', 'Nao', 'No', 'Cancelar') + (() if ENSAIO else ('OK',)))
    for w in [x for x in janelas() if x.class_name() in ('TfrmImportacaoLotes', CLASSE)]:
        if apertar(w, ('Fechar', 'Cancelar')):
            time.sleep(.8)
        try:
            if w.is_visible():   # o clique não pegou (outra janela na frente): fecha pela mensagem de fechar
                w.close()
                time.sleep(.5)
        except Exception:
            pass


def falhar(motivo):
    try:
        limpar()
    except Exception:
        pass
    fim(ok=False, erro=motivo)


def digitar(campo, valor):
    campo.click_input()
    campo.type_keys('^a{DEL}', pause=0.02)
    # o pywinauto lê + ^ % ~ ( ) { } [ ] como teclas especiais (o ~ do caminho curto do Windows virava Enter)
    seguro = ''.join('{' + ch + '}' if ch in '+^%~(){}[]' else ch for ch in valor)
    campo.type_keys(seguro, pause=0.01, with_spaces=True)


def so_numeros(s):
    n = ''.join(ch for ch in (s or '') if ch.isdigit())
    return int(n) if n else 0



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
    if not os.path.isfile(PLANILHA):
        fim(ok=False, erro='a planilha não está em ' + PLANILHA)
    if [w for w in janelas() if w.class_name().startswith('TfrmLogin')]:
        fim(ok=False, erro='o Alterdata Contábil está na tela de login')
    principais = janelas('TfrmPrincipal')
    if not principais:
        fim(ok=False, erro='o Alterdata Contábil não está aberto')
    if len(principais) > 1:
        fim(ok=False, erro='há dois Contábil abertos')
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
            fim(ok=False, erro='não carreguei o alterdata_faixa.py: ' + str(e)[:200])
    principal.set_focus()
    if not principal.is_maximized():
        principal.maximize()
    time.sleep(.5)
    import win32gui
    if win32gui.GetForegroundWindow() != principal.handle:
        principal.set_focus()
        time.sleep(.5)
    if win32gui.GetForegroundWindow() != principal.handle:
        fim(ok=False, erro='o Contábil não veio para a frente (outra janela por cima); não cliquei em nada')

    # ── aba Lançamentos → Importação financeira, pelo nome (09/11/2026: pela posição medida no PC, no console de 1024x768
    # do servidor o clique caía noutro botão)
    passo('abrindo Lançamentos → Importação financeira')
    antes_de_abrir = {w.handle for w in janelas()}
    def a_janela_nova():
        return [w for w in janelas('TfrmImportacaoLotes') if w.handle not in antes_de_abrir]
    try:
        clique('aba Lançamentos')
        alterdata_faixa.aba(principal, 'Lançamentos')
        clique('Importação financeira (texto ou planilha)')
        alterdata_faixa.botao(principal, 'Importação financeira (texto ou planilha)', pedacos=('importa', 'financ'))
    except alterdata_faixa.Falha as e:
        falhar(com_tela(str(e), 'importar-faixa'))
    imp = esperar(a_janela_nova, 8)
    if not imp:
        imp = esperar(a_janela_nova, 15)
    if not imp:
        falhar(com_tela('a janela da Importação financeira não abriu', 'importar-nao-abriu'))
    print('DIAG: janela ' + imp[0].class_name() + ' "' + (imp[0].window_text() or '') + '"', flush=True)
    CLASSE = imp[0].class_name()
    imp = imp[0]
    imp.set_focus()
    time.sleep(.4)

    # ── se a janela pedir o sistema: Importação texto ou planilha (Personalizado) → Avançar
    op = [c for c in filhos(imp, 'TcxCustomRadioGroupButton') if (c.window_text() or '').replace('&', '').startswith('Importação texto ou planilha')]
    if op:
        clique('Importação texto ou planilha')
        op[0].click_input()
        time.sleep(.3)
        av = [b for b, t in botoes(imp) if t == 'Avançar >']
        if not av:
            falhar('não achei o Avançar')
        clique('Avançar')
        av[0].click_input()
        time.sleep(1)
    if not esperar(lambda: filhos(imp, 'TcxLabel', 'Descrição do lote'), 10):
        falhar('a tela com a empresa, o lote e a planilha não apareceu')
    time.sleep(.5)

    # ── a empresa (o campo pequeno de cima; o nome aparece ao lado)
    passo('empresa ' + CODIGO)
    edits = sorted(filhos(imp, 'TcxButtonEdit'), key=lambda c: c.rectangle().top)
    if len(edits) < 2:
        falhar('não achei os campos Empresa e Arquivo')
    emp, arq = edits[0], edits[1]
    clique('campo Empresa: ' + str(int(CODIGO)))
    digitar(emp, str(int(CODIGO)))
    emp.type_keys('{TAB}', pause=0.05)
    time.sleep(1.2)
    for w in mensagens_abertas():
        falhar('o Alterdata mostrou uma mensagem ao escolher a empresa ' + CODIGO + ': ' + texto_da_mensagem(w))
    ret = emp.rectangle()
    nomes = [c for c in filhos(imp, 'TcxTextEdit') if abs(c.rectangle().top - ret.top) < 6 and c.rectangle().left > ret.right]
    nome_emp = (nomes[0].window_text() or '').strip() if nomes else ''
    if not nome_emp:
        falhar('a empresa ' + CODIGO + ' não apareceu na tela (código inexistente?)')
    if so_numeros(emp.window_text()) != int(CODIGO):
        falhar('o código na tela (' + emp.window_text() + ') não é o ' + CODIGO)

    # ── Criar novo Lote (nunca o lote já existente)
    novo = filhos(imp, 'TcxRadioButton', 'Criar novo Lote')
    if not novo:
        falhar('não achei "Criar novo Lote"')
    clique('Criar novo Lote')
    novo[0].click_input()
    time.sleep(.4)

    # ── a descrição do lote (o TcxTextEdit logo abaixo do rótulo "Descrição do lote")
    passo('lote "' + LOTE + '"')
    rot = filhos(imp, 'TcxLabel', 'Descrição do lote')
    if not rot:
        falhar('não achei o campo Descrição do lote')
    rr = rot[0].rectangle()
    desc = [c for c in filhos(imp, 'TcxTextEdit') if 0 <= c.rectangle().top - rr.bottom < 30]
    if not desc:
        falhar('não achei o campo Descrição do lote')
    desc = desc[0]
    clique('descrição do lote')
    digitar(desc, LOTE)
    time.sleep(.3)

    # ── o arquivo
    passo('planilha')
    clique('caminho da planilha')
    digitar(arq, PLANILHA)
    time.sleep(.3)

    # ── o layout LAYOUT MISTER (a lista com pesquisa; a 1ª linha depois de pesquisar é o nome exato)
    passo('layout ' + LAYOUT)
    lay = filhos(imp, 'TcxPopupEdit')
    if not lay:
        falhar('não achei o campo Layout de importação')
    lay = lay[0]
    if (lay.window_text() or '').strip() != LAYOUT:
        rl = lay.rectangle()
        clique('lista de layouts')
        mouse.click(coords=(rl.right - 12, (rl.top + rl.bottom) // 2))
        pop = esperar(lambda: janelas('TcxPopupEditPopupWindow'), 5)
        if not pop:
            falhar('a lista de layouts não abriu')
        pop = pop[0]
        busca = filhos(pop, 'TcxCustomInnerTextEdit')
        grade = filhos(pop, 'TcxGridSite')
        if not busca or not grade:
            falhar('não achei a pesquisa da lista de layouts')
        digitar(busca[0], 'Personalizada - Excel')   # sem acento: o type_keys não digita ç/ã nessa caixa
        time.sleep(.8)
        rg = grade[0].rectangle()
        clique(LAYOUT)
        # a 1ª linha da lista filtrada: duplo clique escolhe e fecha a lista
        mouse.double_click(coords=(rg.left + 120, rg.top + 33))
        time.sleep(.8)
    if (lay.window_text() or '').strip() != LAYOUT:
        falhar('o layout na tela é "' + (lay.window_text() or '') + '", não ' + LAYOUT)

    # ── tudo conferido antes do Concluir
    confere = {
        'empresa': so_numeros(emp.window_text()) == int(CODIGO),
        'lote': (desc.window_text() or '').strip() == LOTE.strip(),
        'arquivo': os.path.normcase((arq.window_text() or '').strip()) == os.path.normcase(PLANILHA),
        'layout': (lay.window_text() or '').strip() == LAYOUT,
    }
    errados = [k for k, v in confere.items() if not v]
    if errados:
        falhar('a tela não ficou como devia (' + ', '.join(errados) + '); não cliquei em Concluir · na tela: empresa "'
               + (emp.window_text() or '') + '", lote "' + (desc.window_text() or '') + '", arquivo "' + (arq.window_text() or '')
               + '", layout "' + (lay.window_text() or '') + '"')
    for w in mensagens_abertas():
        falhar('apareceu uma mensagem antes do Concluir: ' + texto_da_mensagem(w))
    if ENSAIO:   # tudo preenchido e conferido, sem Concluir (para testar o caminho): a foto e fecha pelo Fechar/Cancelar
        foto = ''
        try:
            import alterdata_tela
            pasta_fotos = os.environ.get('ALTERDATA_TELA', '')
            foto = alterdata_tela.foto(pasta_fotos, 'importar-ensaio')[0] if pasta_fotos else ''
        except Exception:
            pass
        limpar()
        aberta = bool(janelas(CLASSE))
        fim(ok=not aberta, ensaio=True, empresa=nome_emp, foto=foto, fechou=not aberta,
            **({} if not aberta else {'erro': 'a janela da importação não fechou depois do ensaio'}))

    passo('importando no Alterdata')
    conc = [b for b, t in botoes(imp) if t == 'Concluir']
    if not conc:
        falhar('não achei o Concluir')
    antes = {w.handle for w in d.windows()}
    clique('Concluir (o Alterdata importa a planilha)')
    conc[0].click_input()

    # ── o que o Alterdata responde (06/11/2026, visto na 292): a própria janela vira "Resultado da operação", um texto com
    # o que aconteceu (ex.: "Linhas do arquivo que apresentaram lançamentos com data menor ou igual a data de trava
    # contábil: 5. Não teve importação de lançamentos." e o Início/Fim). Mensagem com OK no meio é lida e fechada; pergunta
    # (Sim/Não) é Não e para.
    def resultado():
        for c in filhos(imp):
            t = (c.window_text() or '').strip()
            if 'Início:' in t and 'Fim:' in t:
                return t
        return ''
    limite = time.time() + 300
    texto = ''
    while time.time() < limite:
        time.sleep(.5)
        for w in mensagens_abertas():
            txt = texto_da_mensagem(w)
            nomes_b = [t for _, t in botoes(w)]
            if 'Sim' in nomes_b or 'Yes' in nomes_b:
                mensagens.append('pergunta: ' + txt)
                apertar(w, ('Não', 'Nao', 'No', 'Cancelar'))
                falhar('o Alterdata perguntou "' + txt + '" e o robô respondeu Não (ainda não sabe responder essa)')
            mensagens.append(txt)
            print('DIAG: mensagem "' + txt + '" ' + str(nomes_b), flush=True)
            if not apertar(w, ('OK', 'Ok', 'Fechar')):
                falhar('uma mensagem sem OK: ' + txt)
            time.sleep(.5)
        texto = resultado()
        if texto:
            break
        if not janelas(CLASSE):
            falhar('a janela da importação fechou sem mostrar o resultado')
    if not texto:
        falhar('a importação não terminou em 5 min')
    linhas = [l.strip() for l in texto.splitlines() if l.strip()]
    print('DIAG: resultado ' + ' | '.join(linhas), flush=True)
    mensagens.extend(l for l in linhas if not l.startswith(('Início:', 'Fim:')))
    limpar()
    if any('não teve importação' in l.lower() or 'nao teve importacao' in l.lower() for l in linhas):
        fim(ok=False, erro='o Alterdata não importou: ' + ' '.join(l for l in linhas if not l.startswith(('Início:', 'Fim:')))[:300])
    fim(ok=True, empresa=nome_emp)
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + str(e)[:200])
