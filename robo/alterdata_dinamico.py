# O Balancete Dinâmico do Alterdata Contábil pelo robô (06/11/2026, Vitor: "e mais facil ele puxar o balancete dinamico ao
# invez do balancete, e buscar a razão das contas la no razão antigo mesmo"; "consultas - balancete dinamico"). Usa o
# Contábil JÁ ABERTO E LOGADO: Consultas → Balancete Dinâmico, a empresa, o período (mês/ano), Consultar, Exportar → o
# "Salvar" do Windows com o caminho. O XLS: Código, Classificação, Descrição, Saldo anterior, Debito, Credito, Saldo atual
# (devedor negativo, credor positivo; débito negativo, crédito positivo).
#
# Travas: só preenche empresa e período e clica em Consultar e Exportar. A exportação pede a "Configuração" gravada uma vez
# (sinais do Excel): se o Alterdata avisar que falta, o roteiro abre a Configuração e clica em Gravar SEM MUDAR NADA (o
# padrão), uma vez. Nunca marca opção da tela. Qualquer outra mensagem: para e fecha o que abriu.
#
# Uso: python alterdata_dinamico.py <código> <dd/mm/aaaa início> <dd/mm/aaaa fim> <caminho do .xls>
# Escreve PASSO:/CLIQUE: e, no fim, RESULTADO: {"ok":true,"arquivo":…,"bytes":…} ou {"ok":false,"erro":"…"}.
import json, os, sys, time

from pywinauto import Desktop, mouse

sys.stdout.reconfigure(encoding='utf-8')
CODIGO, INICIO, FIM, DESTINO = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
CLASSE = 'TfrmBalanceteDinamicoConsulta'
d = Desktop(backend='win32')


def passo(t):
    print('PASSO: ' + t, flush=True)


def clique(t):
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


def esperar(teste, segundos, intervalo=0.3):
    limite = time.time() + segundos
    while time.time() < limite:
        x = teste()
        if x:
            return x
        time.sleep(intervalo)
    return None


def filhos(w, cls=None):
    try:
        todos = w.descendants()
    except Exception:
        return []
    r = []
    for c in todos:
        try:
            if c.is_visible() and (cls is None or c.class_name() == cls):
                r.append(c)
        except Exception:
            pass
    return r


def texto(c):
    try:
        return (c.window_text() or '').strip()
    except Exception:
        return ''


def botao(w, rotulo):
    for b in filhos(w):
        if texto(b).replace('&', '') == rotulo and b.class_name() in ('TcxButton', 'TButton', 'TBitBtn', 'Button'):
            return b
    return None


def texto_da_mensagem(w):
    return ' '.join(texto(c) for c in filhos(w) if texto(c) and c.class_name() not in ('TButton', 'TBitBtn', 'TcxButton'))[:300]


def limpar():
    for w in janelas('#32770', 'Salvar'):
        b = botao(w, 'Cancelar')
        if b:
            b.click()
    for w in janelas('TfrmConfiguraExibicaoSaldo'):
        b = botao(w, 'Fechar')
        if b:
            b.click_input()
    for w in janelas('TMessageForm'):
        b = botao(w, 'OK') or botao(w, 'Não') or botao(w, 'Cancelar')
        if b:
            b.click_input()
    for w in janelas(CLASSE):
        try:
            w.close()   # é só consulta: nada a salvar
        except Exception:
            pass


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


def mes(data):
    # dd/mm/aaaa → mmaaaa (a máscara do período é mês/ano)
    return data[3:5] + data[6:10]


def campo(w, cls, esquerda, topo, ordem=0):
    """O campo na posição medida no PC (1366x768); com a janela montada noutra largura (o console do servidor tem
    1024x768), os da mesma linha em ordem da esquerda para a direita (ordem = 0 o primeiro, 1 o segundo…), contados a partir
    do que fica mais perto da posição medida."""
    r = w.rectangle()
    todos = filhos(w, cls)
    for c in todos:
        rc = c.rectangle()
        if abs(rc.left - r.left - esquerda) < 6 and abs(rc.top - r.top - topo) < 6:
            return c
    linha = sorted([c for c in todos if abs(c.rectangle().top - r.top - topo) < 12], key=lambda c: c.rectangle().left)
    if not linha:
        return None
    return linha[ordem] if ordem < len(linha) else None


def focar(c):
    """O clique no campo quando ele está inteiro na tela; senão, o foco direto (o campo pode ficar além da borda)."""
    rc = c.rectangle()
    import win32api
    if rc.left >= 0 and rc.right <= win32api.GetSystemMetrics(0) and rc.top >= 0 and rc.bottom <= win32api.GetSystemMetrics(1):
        c.click_input()
    else:
        c.set_focus()


def faixa():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
    import alterdata_faixa
    return alterdata_faixa



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
    if [w for w in janelas() if w.class_name().startswith('TfrmLogin')]:
        fim(ok=False, erro='o Alterdata Contábil está na tela de login')
    principais = janelas('TfrmPrincipal')
    if not principais:
        fim(ok=False, erro='o Alterdata Contábil não está aberto')
    if len(principais) > 1:
        fim(ok=False, erro='há dois Contábil abertos')
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    if os.path.exists(DESTINO):
        os.remove(DESTINO)
    limpar()

    passo('abrindo Consultas → Balancete Dinâmico')
    principal = principais[0]
    preparar_tela()
    fx = faixa()
    try:
        fechadas = fx.liberar(principal)
    except fx.Falha as e:
        falhar(com_tela(str(e), 'dinamico-travado'))
    if fechadas:
        print('TELA: o Contábil estava travado por ' + ', '.join(fechadas) + ' (janela na frente da principal): fechei', flush=True)
    principal.set_focus()
    if not principal.is_maximized():
        principal.maximize()
    time.sleep(.5)
    # a aba e o botão pelo nome (09/11/2026: pela posição, no console de 1024x768, o clique caía noutro botão)
    try:
        clique('aba Consultas')
        fx.aba(principal, 'Consultas')
        clique('Balancete Dinâmico')
        fx.botao(principal, 'Balancete Dinâmico')
    except fx.Falha as e:
        falhar(com_tela(str(e), 'dinamico-faixa'))
    w = esperar(lambda: janelas(CLASSE), 25)
    if not w:
        falhar(com_tela('o Balancete Dinâmico não abriu', 'dinamico-nao-abriu'))
    w = w[0]
    # a tela de novidade do Alterdata ("Tenho uma novidade…"): Fechar
    for n in esperar(lambda: janelas('TfrmAvaNotificacaoEstendida'), 3) or []:
        b = botao(n, 'Fechar')
        if b:
            clique('Fechar (novidade do Alterdata)')
            b.click_input()
    time.sleep(.5)
    w.set_focus()

    passo('empresa ' + CODIGO)
    emp = campo(w, 'TcxButtonEdit', 28, 101)
    if not emp:
        falhar('não achei o campo da empresa')
    clique('campo Empresa: ' + str(int(CODIGO)))
    focar(emp)
    emp.type_keys('^a{DEL}' + str(int(CODIGO)) + '{TAB}', pause=0.03)
    time.sleep(1.2)
    for m in janelas('TMessageForm'):
        falhar('o Alterdata mostrou uma mensagem ao escolher a empresa ' + CODIGO + ': ' + texto_da_mensagem(m))
    def nome_da_empresa():
        c = campo(w, 'TcxTextEdit', 103, 101)
        return texto(c) if c else ''
    nome = esperar(nome_da_empresa, 4)
    if not nome:
        falhar('a empresa ' + CODIGO + ' não apareceu na tela')

    passo('período ' + INICIO[3:] + ' a ' + FIM[3:])
    for i, (esq, valor) in enumerate(((967, INICIO), (1057, FIM))):
        c = campo(w, 'TcxMaskEdit', esq, 102, i)
        if not c:
            falhar('não achei o período')
        clique('período ' + valor[3:])
        focar(c)
        c.type_keys('{HOME}' + mes(valor) + '{TAB}', pause=0.03)
        time.sleep(.2)
    lidos = [texto(campo(w, 'TcxMaskEdit', e, 102, i)) for i, e in enumerate((967, 1057))]
    if lidos != [INICIO[3:], FIM[3:]]:
        falhar('o período na tela (' + ' a '.join(lidos) + ') não é o pedido')

    consultar = botao(w, 'Consultar')
    if not consultar:
        falhar('não achei o Consultar')
    passo('consultando')
    clique('Consultar')
    consultar.click_input()
    time.sleep(3)

    passo('exportando')
    rw = w.rectangle()
    wx, wy = rw.left + 8, rw.top + 8

    def botao_da_barra(rotulo, x):
        # o botão da barra do Balancete Dinâmico pelo nome (UI Automation); sem ele, a posição medida no PC
        b = fx.botao_da_janela(w, rotulo)
        if b:
            fx.clicar(b)
        else:
            mouse.click(coords=(wx + x, wy + 45))
    gravou = False
    sv = None
    limite = time.time() + 120
    while time.time() < limite and not sv:
        w.set_focus()
        clique('Exportar')
        botao_da_barra('Exportar', 235)
        x = esperar(lambda: janelas('#32770', 'Salvar') or janelas('TMessageForm'), 6)
        if not x:
            continue   # a consulta ainda não terminou (o Exportar fica cinza): tenta de novo
        if x[0].class_name() == '#32770':
            sv = x[0]
            break
        msg = texto_da_mensagem(x[0])
        if 'configura' in msg.lower() and not gravou:
            botao(x[0], 'OK').click_input()
            time.sleep(.5)
            # a Configuração para salvar em excel: Gravar com o padrão, sem mudar nada (uma vez)
            clique('Configuração → Gravar (o padrão)')
            w.set_focus()
            botao_da_barra('Configuração', 160)
            cf = esperar(lambda: janelas('TfrmConfiguraExibicaoSaldo'), 6)
            if not cf:
                falhar('a Configuração para salvar em excel não abriu')
            g = botao(cf[0], 'Gravar')
            if not g:
                falhar('não achei o Gravar da Configuração')
            g.click_input()
            gravou = True
            esperar(lambda: not janelas('TfrmConfiguraExibicaoSaldo'), 5)
            continue
        falhar('o Alterdata mostrou uma mensagem ao exportar: ' + msg)
    if not sv:
        falhar('a janela Salvar não abriu em 2 min')

    nomecx = filhos(sv, 'Edit')
    if not nomecx:
        falhar('não achei o Nome na janela Salvar')
    nomecx[0].set_edit_text(DESTINO)
    time.sleep(.2)
    if texto(nomecx[0]) != DESTINO:
        falhar('o caminho não ficou certo na janela Salvar')
    clique('Salvar')
    botao(sv, 'Salvar').click()
    tamanhos = []
    for _ in range(240):
        time.sleep(.25)
        t = os.path.getsize(DESTINO) if os.path.exists(DESTINO) else 0
        tamanhos.append(t)
        if t > 0 and tamanhos[-4:] == [t, t, t, t]:
            break
    if not os.path.exists(DESTINO) or os.path.getsize(DESTINO) <= 0:
        falhar('o XLS do balancete dinâmico não apareceu')
    for x in janelas('#32770', 'Salvar'):   # já existe? (não deveria: foi apagado antes)
        falhar('a janela Salvar não fechou')
    passo('balancete dinâmico salvo')
    limpar()
    fim(ok=True, arquivo=DESTINO, bytes=os.path.getsize(DESTINO), empresa=nome)
except SystemExit:
    raise
except Exception as e:
    falhar('o roteiro parou: ' + str(e)[:200])
