# Extrair os lançamentos de uma empresa do SCI em Excel (27/11/2026, ensinado pelo Vitor com o sci_ensinar.py, rotina
# "contabil_extrair_lancamentos", e corrigido com ele na tela).
#
# A competência do SCI é MM/AAAA e o mês 00 é o ano inteiro:
#
#     02/2026 → só fevereiro de 2026
#     00/2026 → tudo de 2026        00/2025 → tudo de 2025
#     00/0000 → tudo, de todos os anos
#
# O caminho, com o SCI (Novo Visual Contábil) aberto e logado:
#   1. a empresa: o botão "00590 - NOME - CNPJ" no topo; se não for a pedida, abre "Escolha da empresa atual", digita o número
#   2. Lançamentos › Contábeis (Ctrl+L): a janela abre com o cursor no mês da Referência. O mês tem 2 dígitos e pula sozinho
#      para o ano; NUNCA Enter depois do ano: o Enter leva para a Chave e o SCI pergunta se quer gerar um registro novo
#   3. a lupa (5º botão da barra) abre a "Consulta lançamentos da empresa"
#   4. Retirar filtro (o funil vermelho, 13º botão, F11): OBRIGATÓRIO (Vitor: "tem que retirar o filtro, obrigatoriamente")
#   5. a impressora (15º botão) abre a "Impressão de campos da consulta"; o 4º botão dela exporta para Excel
#   6. "Opções de exportação": Todas, "Abrir depois de exportar" DESMARCADO, OK
#   7. o "Exportar" do Windows: o caminho digitado (colar no campo não vale: o SCI salvava com o nome padrão em Downloads)
#   8. fecha tudo o que abriu, de trás para frente (Impressão → Consulta → Lançamentos), e volta para a tela inicial
#      (Vitor: "ele abre muitas e muitas janelas… para voltar as telas tem que sair fechando")
#
# A planilha sai em C:\Users\<você>\Downloads\robo_sci_nads\<DDMMAAAA de hoje>\<empresa>\lancamentos\ (dia novo, pasta nova).
#
# Uso:  python sci_extrair_lancamentos.py <empresa> <MM/AAAA>      ex.: python sci_extrair_lancamentos.py 590 00/2026
import os
import re
import sys
import time

import win32con
import win32gui
from pywinauto import Desktop, keyboard, mouse

sys.stdout.reconfigure(encoding='utf-8')

SAIDA = os.path.join(os.path.expanduser('~'), 'Downloads', 'robo_sci_nads')
JANELAS_DA_ROTINA = ('TfrxExport_Padrao_SCI', 'TfrRelatorio_Consulta_Padrao_SCI', 'TfrConsultaLancamento', 'TfrLancamento', 'TfrConsultaEmpresaPadrao')
uia = Desktop(backend='uia')


class Parou(Exception):
    pass


def esperar(f, segundos=20, passo=.3):
    fim = time.time() + segundos
    while time.time() < fim:
        r = f()
        if r:
            return r
        time.sleep(passo)
    return None


def janela(cls, titulo=None):
    h = win32gui.FindWindow(cls, titulo)
    return h if h and win32gui.IsWindowVisible(h) else 0


def esperar_janela(cls, nome, titulo=None, segundos=20):
    h = esperar(lambda: janela(cls, titulo), segundos)
    if not h:
        raise Parou('não abriu: ' + nome)
    time.sleep(.6)
    return h


def frente(h):
    try:
        win32gui.SetForegroundWindow(h)
    except Exception:
        keyboard.send_keys('%')   # o Windows só deixa trazer para a frente depois de uma tecla
        win32gui.SetForegroundWindow(h)
    time.sleep(.4)


def botao_da_barra(h, barra, indice):
    w = uia.window(handle=h)
    barras = [tb for tb in w.descendants(control_type='ToolBar') if tb.element_info.name == barra]
    if not barras:
        raise Parou('não achei a barra ' + barra)
    botoes = barras[0].children()
    if len(botoes) <= indice:
        raise Parou('a barra ' + barra + ' tem ' + str(len(botoes)) + ' botões, esperava mais de ' + str(indice))
    return botoes[indice]


def recusar_confirmacao():
    """Uma "Confirmação!" que apareceu (ex.: gerar registro novo): responde Não e avisa. Nunca grava nada no SCI."""
    h = janela('#32770', 'Confirmação!')
    if not h:
        return False
    for b in uia.window(handle=h).descendants(control_type='Button'):
        if (b.element_info.name or '').replace('&', '') == 'Não':
            b.invoke()
            time.sleep(.8)
            return True
    win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
    return True


def fechar_tudo():
    """Volta para a tela inicial: fecha as janelas da rotina, de trás para frente, até sobrar só a principal."""
    for _ in range(3):
        sobrou = False
        for cls in JANELAS_DA_ROTINA:
            while True:
                h = janela(cls)
                if not h:
                    break
                sobrou = True
                win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
                if not esperar(lambda: not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h), 5):
                    recusar_confirmacao()
                    break
        if not sobrou:
            return


def empresa_atual(principal):
    for b in uia.window(handle=principal).descendants(control_type='Button'):
        m = re.match(r'^\s*(\d{3,6}) - ', b.element_info.name or '')   # o nome vem com um espaço na frente
        if m:
            return int(m.group(1)), b
    return None, None


def escolher_empresa(principal, codigo):
    atual, botao = empresa_atual(principal)
    if atual == codigo:
        print('empresa: ' + str(codigo) + ' (já era a atual)', flush=True)
        return
    if not botao:
        raise Parou('não achei o botão da empresa no topo do SCI')
    botao.click_input()
    h = esperar_janela('TfrConsultaEmpresaPadrao', 'Escolha da empresa atual')
    grade = [e for e in uia.window(handle=h).descendants() if e.element_info.class_name == 'TDBGrid_Padrao_SCI']
    if grade:
        grade[0].click_input()
    keyboard.send_keys(str(codigo))
    time.sleep(1)
    keyboard.send_keys('{ENTER}')
    if not esperar(lambda: not janela('TfrConsultaEmpresaPadrao'), 5):
        # como o Vitor fez: dois cliques na linha achada
        x0, y0, _, _ = win32gui.GetWindowRect(h)
        mouse.double_click(coords=(x0 + 145, y0 + 116))
        esperar(lambda: not janela('TfrConsultaEmpresaPadrao'), 10)
    time.sleep(1)
    atual, _ = empresa_atual(principal)
    if atual != codigo:
        raise Parou('a empresa atual ficou ' + str(atual) + ', não a ' + str(codigo))
    print('empresa: ' + str(codigo), flush=True)


def digitar_no_campo(h, x, y, texto):
    """Clica no campo da posição (x, y) dentro da janela, apaga o que tinha e digita, sem Enter."""
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    mouse.click(coords=(x0 + x, y0 + y))
    time.sleep(.3)
    keyboard.send_keys('{HOME}+{END}' + texto)
    time.sleep(.4)


def abrir_lancamentos(principal, mes, ano):
    frente(principal)
    keyboard.send_keys('^l')
    h = esperar_janela('TfrLancamento', 'Lançamentos contábeis')
    frente(h)
    # a Referência: o mês e o ano (as posições dentro da janela de 1233 px; sem Enter)
    digitar_no_campo(h, 710, 52, mes)
    digitar_no_campo(h, 749, 52, ano)
    if recusar_confirmacao():
        raise Parou('o SCI pediu confirmação ao digitar a referência (respondi Não)')
    print('referência: ' + mes + '/' + ano, flush=True)
    return h


def filtrada(h):
    """A consulta mostra a faixa amarela "Os registros apresentados nesta consulta estão filtrados"."""
    try:
        return any('filtrad' in (e.element_info.name or '').lower() or 'filtrad' in (win32gui.GetWindowText(e.handle) if e.handle else '').lower()
                   for e in uia.window(handle=h).descendants())
    except Exception:
        return False


def exportar(h_lanc, arquivo):
    botao_da_barra(h_lanc, 'tlbCadastro_Padrao_Pai', 4).click_input()   # a lupa
    h = esperar_janela('TfrConsultaLancamento', 'a Consulta lançamentos', segundos=60)
    frente(h)
    # Retirar filtro (F11): obrigatório, com duplo clique para garantir (Vitor, 27/11/2026: "clicar duas vezes naquele
    # filtro vermelho, para garantir que removeu"); se a faixa "…estão filtrados" continuar, tenta de novo
    print('consulta aberta' + (' (filtrada)' if filtrada(h) else ''), flush=True)
    for _ in range(3):
        botao_da_barra(h, 'ToolBar1', 12).double_click_input()
        time.sleep(2)
        if not filtrada(h):
            break
    else:
        raise Parou('a consulta continuou filtrada depois de retirar o filtro 3 vezes')
    print('filtro retirado', flush=True)
    botao_da_barra(h, 'ToolBar1', 14).click_input()   # a impressora
    h = esperar_janela('TfrRelatorio_Consulta_Padrao_SCI', 'a Impressão de campos da consulta')
    botao_da_barra(h, 'tlbRelatorio_Pai', 3).click_input()   # exportar para Excel
    h = esperar_janela('TfrxExport_Padrao_SCI', 'as Opções de exportação')
    w = uia.window(handle=h)
    abrir = w.child_window(title='Abrir depois de exportar', control_type='CheckBox')
    if abrir.get_toggle_state() == 1:
        abrir.toggle()
    if abrir.get_toggle_state() != 0:
        raise Parou('não consegui desmarcar "Abrir depois de exportar"')
    w.child_window(title='Todas', control_type='RadioButton').select()
    w.child_window(title='OK', control_type='Button').invoke()
    h = esperar_janela('#32770', 'o Exportar do Windows', titulo='Exportar')
    nome = [e for e in uia.window(handle=h).descendants(control_type='Edit') if e.element_info.automation_id == '1001']
    if not nome:
        raise Parou('não achei o campo do nome no Exportar')
    if os.path.exists(arquivo):
        os.remove(arquivo)
    nome[0].set_focus()
    time.sleep(.3)
    keyboard.send_keys('^a{BACKSPACE}')
    keyboard.send_keys(re.sub(r'([(){}+^%~\[\]])', r'{\1}', arquivo), with_spaces=True)
    time.sleep(.3)
    if (nome[0].get_value() or '').lower() != arquivo.lower():
        raise Parou('o nome no Exportar ficou "' + (nome[0].get_value() or '') + '"')
    keyboard.send_keys('{ENTER}')
    if not esperar(lambda: os.path.exists(arquivo) and os.path.getsize(arquivo) > 0 and not janela('#32770', 'Exportar'), 120):
        raise Parou('a planilha não apareceu em ' + arquivo)
    time.sleep(1)


def main():
    if len(sys.argv) < 3 or not re.match(r'^\d{1,6}$', sys.argv[1]) or not re.match(r'^\d{2}/\d{4}$', sys.argv[2]):
        print('uso: python sci_extrair_lancamentos.py <empresa> <MM/AAAA>   (00/2026 = o ano todo; 00/0000 = tudo)')
        sys.exit(2)
    codigo = int(sys.argv[1])
    mes, ano = sys.argv[2].split('/')
    principal = janela('TfrUnico')
    if not principal:
        print('o SCI (Novo Visual Contábil) não está aberto')
        sys.exit(1)
    pasta = os.path.join(SAIDA, time.strftime('%d%m%Y'), str(codigo), 'lancamentos')
    os.makedirs(pasta, exist_ok=True)
    arquivo = os.path.join(pasta, 'lancamentos-' + str(codigo) + '-' + mes + '-' + ano + '.xls')
    try:
        fechar_tudo()
        escolher_empresa(principal, codigo)
        h = abrir_lancamentos(principal, mes, ano)
        exportar(h, arquivo)
        print('pronto: ' + arquivo + ' (' + str(os.path.getsize(arquivo)) + ' bytes)', flush=True)
    except Parou as e:
        print('parei: ' + str(e), flush=True)
        sys.exit(1)
    finally:
        fechar_tudo()
        print('voltei para a tela inicial do SCI', flush=True)


if __name__ == '__main__':
    main()
