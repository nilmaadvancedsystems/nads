# Excluir um lote de lançamentos no SCI (27/11/2026, ensinado pelo Vitor passo a passo no chat):
#   1. Ctrl+L (Lançamentos contábeis) → a Empresa (escrita direto no campo + Tab)
#   2. a Referência 00/0000: clicar no mês, "00" (pula sozinho para o ano), "0000" e UM Enter só (libera a lupa; o 2º Enter
#      cai na Chave: "Código não pode ser zero")
#   3. a lupa → Consulta lançamentos da empresa
#   4. duplo clique no funil vermelho (Retirar filtro, F11)
#   5. clicar na célula do 1º lançamento na coluna Lote e digitar o lote: é a forma de filtrar do SCI (célula da coluna +
#      digitar); só o lote fica, com a faixa "Os registros apresentados nesta consulta estão filtrados"
#   6. a lixeira vermelha (o 6º ícone) → "Senha de segurança do processo": QUEM DIGITA É A PESSOA (master ou responsável);
#      o robô espera até 5 min, nunca preenche nem guarda senha
#   7. "Confirma a exclusão destes registros?" → Sim
#   8. fecha a Consulta e os Lançamentos, uma janela por vez e com o SCI respondendo; nunca o SCI (o Vitor: "nao feche o
#      sistema sem permissao")
#
# Uso:  python sci_excluir_lote.py <empresa> <lote>      ex.: python sci_excluir_lote.py 583 M00583BR6W
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
from sci_extrair_lancamentos import Parou, esperar, esperar_janela, filtrada, frente, janela, uia  # noqa: E402
from sci_importar_planilha import responde  # noqa: E402

LUPA = 4             # tlbCadastro_Padrao_Pai dos Lançamentos contábeis
RETIRAR_FILTRO = 12  # ToolBar1 da Consulta lançamentos
LIXEIRA = 5          # ToolBar1 da Consulta lançamentos: o 6º ícone
CAMPO_EMPRESA = (241, 52)   # o centro, em relação ao canto da janela Lançamentos contábeis (a tela do Vitor em 27/11/2026)
MES_DA_REFERENCIA = (711, 53)
CELULA_DO_LOTE = (74, 90)   # a 1ª célula da coluna Lote (a 1ª coluna), em relação ao canto da Consulta, sem filtro


def botao(h, barra, indice):
    tb = [t for t in uia.window(handle=h).descendants(control_type='ToolBar') if t.element_info.name == barra]
    if not tb or len(tb[0].children()) <= indice:
        raise Parou('não achei o botão ' + str(indice + 1) + ' da barra ' + barra)
    return tb[0].children()[indice]


def no_canto(h, ponto):
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    return (x0 + ponto[0], y0 + ponto[1])


def dialogo(pid, vistas):
    """A janela nova do SCI (aviso ou pergunta) com o texto e os botões."""
    achadas = []

    def ver(x, _):
        if x not in vistas and win32gui.IsWindowVisible(x):
            try:
                if win32process.GetWindowThreadProcessId(x)[1] == pid and win32gui.GetClassName(x) == '#32770':
                    achadas.append(x)
            except Exception:
                pass
    win32gui.EnumWindows(ver, None)
    for x in achadas:
        try:
            nomes = [(e.element_info.control_type, e.element_info.name) for e in uia.window(handle=x).descendants()]
        except Exception:
            continue
        texto = ' '.join(n for t, n in nomes if t == 'Text' and n)
        botoes = {n.replace('&', ''): e for e, (t, n) in zip(uia.window(handle=x).descendants(), nomes) if t == 'Button' and n}
        return x, win32gui.GetWindowText(x), ' '.join(texto.split()), botoes
    return None


def abrir_consulta(principal, codigo):
    frente(principal)
    keyboard.send_keys('^l')
    h = esperar_janela('TfrLancamento', 'Lançamentos contábeis')
    time.sleep(1)
    eds = uia.window(handle=h).descendants(control_type='Edit')
    x, y = no_canto(h, CAMPO_EMPRESA)
    e = min(eds, key=lambda e: abs((e.rectangle().left + e.rectangle().right) // 2 - x) + abs((e.rectangle().top + e.rectangle().bottom) // 2 - y))
    win32gui.SendMessage(e.handle, win32con.WM_SETTEXT, 0, codigo)
    frente(h)
    e.set_focus()
    keyboard.send_keys('{TAB}')
    time.sleep(1.5)
    if (e.get_value() or '').strip().lstrip('0') != codigo.lstrip('0'):
        raise Parou('a Empresa ficou "' + (e.get_value() or '').strip() + '", não a ' + codigo)
    print('empresa: ' + codigo, flush=True)
    frente(h)
    mouse.click(coords=no_canto(h, MES_DA_REFERENCIA))
    time.sleep(.4)
    keyboard.send_keys('{HOME}+{END}00')
    time.sleep(.5)
    keyboard.send_keys('{HOME}+{END}0000{ENTER}')
    time.sleep(1.5)
    frente(h)
    botao(h, 'tlbCadastro_Padrao_Pai', LUPA).click_input()
    c = esperar_janela('TfrConsultaLancamento', 'Consulta lançamentos da empresa', segundos=60)
    time.sleep(2)
    print('consulta aberta (00/0000)', flush=True)
    return h, c


def filtrar_lote(c, lote):
    frente(c)
    botao(c, 'ToolBar1', RETIRAR_FILTRO).double_click_input()
    time.sleep(2)
    if filtrada(c):
        raise Parou('a consulta continuou filtrada depois do Retirar filtro')
    # o título da grade não se lê por UIA: a 1ª célula da 1ª coluna (Lote é a 1ª coluna na consulta do Vitor, 27/11/2026)
    frente(c)
    mouse.click(coords=no_canto(c, CELULA_DO_LOTE))
    time.sleep(.6)
    keyboard.send_keys(lote)
    time.sleep(2.5)
    if not filtrada(c):
        raise Parou('a consulta não filtrou pelo lote ' + lote)
    print('filtrado pelo lote ' + lote, flush=True)


def esperar_fim(principal, c, segundos=300):
    """Terminou quando a consulta filtrada fica vazia e o SCI responde."""
    pid = win32process.GetWindowThreadProcessId(principal)[1]
    vistas = set()
    win32gui.EnumWindows(lambda x, _: vistas.add(x), None)
    frente(c)
    botao(c, 'ToolBar1', LIXEIRA).click_input()
    print('cliquei na lixeira: esperando a senha de segurança (quem digita é a pessoa, até 5 min)', flush=True)
    fim = time.time() + segundos
    confirmou = False
    while time.time() < fim:
        time.sleep(1)
        d = dialogo(pid, vistas)
        if d:
            x, titulo, texto, botoes = d
            vistas.add(x)
            print('o SCI mostrou "' + titulo + '": ' + texto + ' [' + ', '.join(botoes) + ']', flush=True)
            if 'CONFIRMA A EXCLUSÃO' in texto.upper() and 'Sim' in botoes:
                botoes['Sim'].invoke()
                print('respondi Sim', flush=True)
                confirmou = True
                continue
            if set(botoes) <= {'OK', 'Fechar'} and 'OK' in botoes:
                botoes['OK'].invoke()
                continue
            raise Parou('o SCI perguntou: "' + texto + '"; deixei na tela')
        if confirmou and responde(principal) and responde(c) and not janela('TfrStatusProcessoForm'):
            time.sleep(3)
            return
    raise Parou('passaram ' + str(segundos // 60) + ' min sem a exclusão terminar' + ('' if confirmou else ' (a senha foi digitada?)'))


def voltar_a_tela_inicial(principal, janelas):
    for h in janelas:
        if not h or not win32gui.IsWindow(h):
            continue
        if not esperar(lambda: responde(principal) and responde(h), 120, 2):
            print('o SCI não respondeu em 2 min: deixei a "' + win32gui.GetWindowText(h) + '" aberta', flush=True)
            return
        time.sleep(3)
        win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
        if not esperar(lambda: not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h), 60, 1):
            print('a "' + win32gui.GetWindowText(h) + '" não fechou: deixei como está', flush=True)
            return
    print('de volta à tela inicial', flush=True)


def main():
    if len(sys.argv) < 3 or not re.match(r'^\d{1,6}$', sys.argv[1]) or not re.match(r'^[A-Z0-9]{1,10}$', sys.argv[2]):
        print('uso: python sci_excluir_lote.py <empresa> <lote>')
        sys.exit(2)
    codigo, lote = sys.argv[1], sys.argv[2]
    principal = janela('TfrUnico')
    if not principal:
        print('o SCI (Novo Visual Contábil) não está aberto')
        sys.exit(1)
    try:
        h, c = abrir_consulta(principal, codigo)
        filtrar_lote(c, lote)
        esperar_fim(principal, c)
        print('pronto: lote ' + lote + ' excluído da empresa ' + codigo, flush=True)
        voltar_a_tela_inicial(principal, [c, h])
    except Parou as e:
        print('parei: ' + str(e), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
