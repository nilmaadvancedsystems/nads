# Tirar o balancete de uma empresa do SCI em Excel (27/11/2026, ensinado pelo Vitor na tela):
#   1. Ctrl+B (Relatórios › Balancete; o Vitor: "aperta ctrl + B e mais facil")
#   2. a Empresa e o período pedidos (Data inicial e final); o resto fica como o SCI abre
#   3. a lupa (o 1º ícone, à esquerda da impressora) abre a Pré-visualização
#      - "Existe uma diferença contábil entre Ativo x Passivo. Deseja emitir relatório mesmo assim?" → Sim (aparece quando a
#        empresa não fez o encerramento do resultado)
#   4. na Pré-visualização, o ícone ao lado da impressora ("Exportar para...") → Planilha Microsoft Excel 1991-2003 (XLS)
#   5. "Exportar para Excel": Todas, "Abrir depois de exportar" desmarcado, OK
#   6. o "Salvar como": o caminho inteiro digitado, Enter
#   7. fecha a Pré-visualização e o Balancete, uma janela por vez e com o SCI respondendo; nunca o SCI
#
# A competência é MM/AAAA como nos lançamentos: 00/2026 = o ano todo (01/01 a 31/12), 03/2026 = só março.
# A planilha sai em Downloads\robo_sci_nads\<DDMMAAAA de hoje>\<empresa>\balancete\balancete-<empresa>-<MM>-<AAAA>.xls
#
# Uso:  python sci_balancete.py <empresa> <MM/AAAA>      ex.: python sci_balancete.py 583 00/2026
import calendar
import os
import re
import sys
import time

import win32con
import win32gui
import win32process
from pywinauto import keyboard, mouse

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # o -I tira a pasta do roteiro do caminho
from sci_extrair_lancamentos import SAIDA, Parou, esperar, esperar_janela, frente, janela, uia  # noqa: E402
from sci_excluir_lote import dialogo, voltar_a_tela_inicial  # noqa: E402
import sci_excluir_lote  # noqa: E402

BALANCETE = 'TfrRelBalancete'
PREVIA = 'TfrPreview_Padrao_SCI'
LUPA = 0                    # tlbRelatorio_Pai do Balancete
EXPORTAR_X = 631            # o "Exportar para..." na barra da Pré-visualização: o centro, em relação ao canto da janela
                            # (os botões não têm nome por UIA; a barra é alinhada à esquerda)
ITEM_XLS = (150, 263)       # o item XLS em relação ao canto do menu do Exportar (o menu em y≈143, o item em y≈406)
CAMPO_EMPRESA = (171, 48)  # em relação ao canto da janela do Balancete
DATA_INICIAL = (178, 126)
DATA_FINAL = (342, 126)
sci_excluir_lote.GRANDES = sci_excluir_lote.GRANDES + (BALANCETE, PREVIA)


def campo(h, ponto):
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    eds = uia.window(handle=h).descendants(control_type='Edit')
    return min(eds, key=lambda e: abs(e.rectangle().mid_point().x - x0 - ponto[0]) + abs(e.rectangle().mid_point().y - y0 - ponto[1]))


def escrever(h, ponto, texto):
    """Direto no campo (WM_SETTEXT) + Tab: digitar no código abre a pesquisa na 1ª tecla."""
    e = campo(h, ponto)
    win32gui.SendMessage(e.handle, win32con.WM_SETTEXT, 0, texto)
    frente(h)
    e.set_focus()
    keyboard.send_keys('{TAB}')
    time.sleep(1)
    return (e.get_value() or '').strip()


def abrir_balancete(principal, codigo, inicio, fim):
    if not esperar(lambda: not janela(BALANCETE) and not janela(PREVIA), 30):
        raise Parou('já tem um Balancete aberto no SCI')
    frente(principal)
    keyboard.send_keys('{ESC}{ESC}^b')   # um menu aberto engole o atalho
    h = esperar_janela(BALANCETE, 'Balancete')
    time.sleep(2)
    if not win32gui.IsWindow(h):
        h = esperar_janela(BALANCETE, 'Balancete')
    if escrever(h, CAMPO_EMPRESA, codigo).lstrip('0') != codigo.lstrip('0'):
        raise Parou('a Empresa do balancete não ficou ' + codigo)
    for ponto, data in ((DATA_INICIAL, inicio), (DATA_FINAL, fim)):
        if escrever(h, ponto, data) != data:
            raise Parou('a data não ficou ' + data)
    print('balancete: empresa ' + codigo + ', ' + inicio + ' a ' + fim, flush=True)
    return h


def responder(pid, vistas):
    """As perguntas do caminho: a da diferença Ativo x Passivo → Sim; avisos só com OK → OK; o resto para."""
    d = dialogo(pid, vistas)
    if not d:
        return False
    x, titulo, texto, botoes = d
    vistas.add(x)
    print('o SCI mostrou "' + titulo + '": ' + texto + ' [' + ', '.join(botoes) + ']', flush=True)
    if titulo.upper().startswith('ATEN') and 'Sim' in botoes:   # a diferença Ativo x Passivo (o texto não se lê por UIA)
        botoes['Sim'].invoke()
        print('respondi Sim', flush=True)
    elif set(botoes) <= {'OK', 'Fechar'} and 'OK' in botoes:
        botoes['OK'].invoke()
    else:
        raise Parou('o SCI perguntou: "' + titulo + ' ' + texto + '"; deixei na tela')
    return True


def previa(principal, h):
    pid = win32process.GetWindowThreadProcessId(principal)[1]
    vistas = set()
    win32gui.EnumWindows(lambda x, _: vistas.add(x), None)
    frente(h)
    tb = [t for t in uia.window(handle=h).descendants(control_type='ToolBar') if t.element_info.name == 'tlbRelatorio_Pai']
    if not tb:
        raise Parou('não achei a barra do Balancete')
    tb[0].children()[LUPA].click_input()
    fim = time.time() + 180
    while time.time() < fim:
        if responder(pid, vistas):
            continue
        p = janela(PREVIA)
        if p:
            time.sleep(2)
            print('pré-visualização aberta', flush=True)
            return p
        time.sleep(1)
    raise Parou('a Pré-visualização não abriu em 3 min')


def exportar(p, arquivo):
    frente(p)
    x0, _, _, _ = win32gui.GetWindowRect(p)
    tb = [t for t in uia.window(handle=p).descendants(control_type='ToolBar') if t.element_info.name == 'tbFerramentas']
    if not tb:
        raise Parou('não achei a barra da Pré-visualização')
    b = min(tb[0].children(), key=lambda b: abs(b.rectangle().mid_point().x - x0 - EXPORTAR_X))
    menu = 0
    for _ in range(3):   # o 1º clique às vezes só ativa a janela (27/11/2026)
        b.click_input()
        menu = esperar(lambda: janela('#32768'), 3)
        if menu:
            break
    if not menu:
        raise Parou('o menu do Exportar para... não abriu')
    # os itens do menu não se leem por UIA: "Planilha Microsoft Excel 1991 - 2003 (XLS)" é o 9º (PDF, HTML, CSV, CSV sem
    # quebra, TXT | RTF, DOC, DOCX | XLS…), a ITEM_XLS do canto do menu
    mx, my, _, _ = win32gui.GetWindowRect(menu)
    print('menu em', win32gui.GetWindowRect(menu), flush=True)
    mouse.click(coords=(mx + ITEM_XLS[0], my + ITEM_XLS[1]))
    h = esperar_janela(None, 'o Exportar para Excel', titulo='Exportar para Excel')
    w = uia.window(handle=h)
    abrir = w.child_window(title='Abrir depois de exportar', control_type='CheckBox')
    if abrir.get_toggle_state() == 1:
        abrir.toggle()
    if abrir.get_toggle_state() != 0:
        raise Parou('não consegui desmarcar "Abrir depois de exportar"')
    w.child_window(title='Todas', control_type='RadioButton').select()
    w.child_window(title='OK', control_type='Button').invoke()
    h = esperar_janela('#32770', 'o Salvar como', titulo='Salvar como')
    nome = [e for e in uia.window(handle=h).descendants(control_type='Edit') if e.element_info.automation_id == '1001']
    if not nome:
        raise Parou('não achei o campo do nome no Salvar como')
    if os.path.exists(arquivo):
        os.remove(arquivo)
    nome[0].set_focus()
    time.sleep(.3)
    keyboard.send_keys('^a{BACKSPACE}')
    keyboard.send_keys(re.sub(r'([(){}+^%~\[\]])', r'{\1}', arquivo), with_spaces=True)   # digitado: colar não pega
    time.sleep(.3)
    if (nome[0].get_value() or '').lower() != arquivo.lower():
        raise Parou('o nome no Salvar como ficou "' + (nome[0].get_value() or '') + '"')
    keyboard.send_keys('{ENTER}')
    if not esperar(lambda: os.path.exists(arquivo) and os.path.getsize(arquivo) > 0 and not janela('#32770', 'Salvar como'), 120):
        raise Parou('a planilha não apareceu em ' + arquivo)
    time.sleep(1)


def main():
    if len(sys.argv) < 3 or not re.match(r'^\d{1,6}$', sys.argv[1]) or not re.match(r'^\d{2}/\d{4}$', sys.argv[2]):
        print('uso: python sci_balancete.py <empresa> <MM/AAAA>   (00/2026 = o ano todo)')
        sys.exit(2)
    codigo = sys.argv[1]
    mes, ano = sys.argv[2].split('/')
    if mes == '00':
        inicio, fim = '01/01/' + ano, '31/12/' + ano
    else:
        inicio, fim = '01/' + mes + '/' + ano, str(calendar.monthrange(int(ano), int(mes))[1]) + '/' + mes + '/' + ano
    principal = janela('TfrUnico')
    if not principal:
        print('o SCI (Novo Visual Contábil) não está aberto')
        sys.exit(1)
    pasta = os.path.join(SAIDA, time.strftime('%d%m%Y'), codigo, 'balancete')
    os.makedirs(pasta, exist_ok=True)
    arquivo = os.path.join(pasta, 'balancete-' + codigo + '-' + mes + '-' + ano + '.xls')
    try:
        h = abrir_balancete(principal, codigo, inicio, fim)
        p = previa(principal, h)
        exportar(p, arquivo)
        print('pronto: ' + arquivo + ' (' + str(os.path.getsize(arquivo)) + ' bytes)', flush=True)
    except Parou as e:
        print('parei: ' + str(e), flush=True)
        sys.exit(1)
    finally:
        voltar_a_tela_inicial(principal, [janela(PREVIA), janela(BALANCETE)])


if __name__ == '__main__':
    main()
