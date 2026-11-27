# Importar uma planilha do minimum no SCI (27/11/2026, ensinado pelo Vitor com o sci_ensinar.py, rotina "contabil_importacao_sci":
# "ensina ele ao importar o arquivo, clicar nesse certinho azul e sempre selecionar o gerador 14, sempre").
#
# O caminho, com o SCI (Novo Visual Contábil) aberto e logado:
#   1. a "Importação de lançamentos via arquivo planilha" (o item 982 do menu, o que o Vitor clicou na gravação)
#   2. a Empresa: o código digitado no campo (sem a lupa)
#   3. o Gerador: SEMPRE o 14, o "LAYOUT MINIMUM" (o robô confere o nome; outro gerador, para)
#   4. o Arquivo: o caminho inteiro escrito no campo
#   5. o ✔ azul (o primeiro botão da barra)
#   6. "Deseja realizar o processo?" → Sim (o Vitor, no teste de 27/11/2026: "clica em sim")
#   7. a "Consulta importação dos lançamentos" abre ATRÁS do "Aguarde" (que fica em 100%): trazer para a frente e clicar no
#      Importar dados (F12), o 8º botão da barra a partir do binóculo
#   8. "Deseja comparar lançamentos a importar com lançamentos já lançados?" → Sim
#   9. o aviso só com OK (o resumo "Registros importados: …") é lido e fechado; as Inconsistências e qualquer outra pergunta
#      param o robô e ficam na tela, para a pessoa ver
# A planilha: a coluna I (CNPJ da filial) vazia, nem cabeçalho; preenchida, o SCI diz "Arquivo não corresponde ao leiaute esperado".
# As datas, o Plano de troca e as caixas de marcar ficam como o SCI abre.
#
# Uso:  python sci_importar_planilha.py <empresa> "<arquivo .xlsx>"
#   ex.: python sci_importar_planilha.py 583 "C:\Users\Vitor\Downloads\Lote M00583BR6W - 583 - teste de exclusao.xlsx"
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
from sci_extrair_lancamentos import Parou, esperar, esperar_janela, frente, janela, uia  # noqa: E402

GERADOR = '14'
NOME_DO_GERADOR = 'LAYOUT MINIMUM'
MENU_DA_IMPORTACAO = 982   # o item do menu que o Vitor clicou (o id do Windows do item)
IMPORTACAO = 'TfrImportacaoLancamentoViaPlanilha'
CONSULTA = 'TfrConsultaImportacaoLancCCTxtHuge'   # a "Consulta importação dos lançamentos": a prévia, antes de gravar
BOTAO_IMPORTAR_DADOS = 7   # na barra da Consulta, o 8º botão a partir do binóculo: Importar dados (F12)
# as perguntas que o Vitor mandou responder Sim (27/11/2026): "Deseja realizar o processo?" e
# "Deseja comparar lançamentos a importar com lançamentos já lançados?"
PERGUNTAS_DO_SIM = ('REALIZAR O PROCESSO', 'COMPARAR LANÇAMENTOS')
# as janelas desta rotina, para começar e terminar limpo (as consultas da lupa e a própria importação)
JANELAS_DA_ROTINA = ('TfrConsultaEmpresas', 'TfrConsultaGeradorIntegracaoLancContabeisPlan', IMPORTACAO)
# onde ficam os campos na janela da Importação (o centro, em relação ao canto da janela; a tela do Vitor em 27/11/2026)
CAMPO_EMPRESA = (261, 54)
CAMPO_GERADOR = (251, 161)
BOTAO_OK = (20, 95)


def fechar_rotina():
    for cls in JANELAS_DA_ROTINA:
        for _ in range(3):
            h = janela(cls)
            if not h:
                break
            win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
            esperar(lambda: not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h), 5)


def responde(h, segundos=5):
    """O SCI está respondendo? (às vezes demora: o Vitor, 27/11/2026)"""
    try:
        win32gui.SendMessageTimeout(h, win32con.WM_NULL, 0, 0, win32con.SMTO_ABORTIFHUNG, segundos * 1000)
        return True
    except Exception:
        return False


def voltar_a_tela_inicial(principal):
    """Depois do "concluída": fecha a Consulta e depois a Importação, UMA POR VEZ, só com o SCI respondendo e calmo.
    Nunca a TfrUnico: fechar o sistema só com permissão do Vitor. Em 27/11/2026 o WM_CLOSE nas duas, 1,5 s depois do OK,
    derrubou o SCI inteiro (APPCRASH no SCIPackagesComponents.bpl)."""
    for cls in (CONSULTA, IMPORTACAO):
        h = janela(cls)
        if not h:
            continue
        if not esperar(lambda: responde(principal) and responde(h), 120, 2):
            print('o SCI não respondeu em 2 min: deixei a "' + win32gui.GetWindowText(h) + '" aberta', flush=True)
            return
        time.sleep(5)   # o SCI termina de gravar depois do OK
        win32gui.PostMessage(h, win32con.WM_CLOSE, 0, 0)
        if not esperar(lambda: not win32gui.IsWindow(h) or not win32gui.IsWindowVisible(h), 60, 1):
            print('a "' + win32gui.GetWindowText(h) + '" não fechou: deixei como está', flush=True)
            return
    print('de volta à tela inicial', flush=True)


def relativo(h, ret):
    x0, y0, _, _ = win32gui.GetWindowRect(h)
    return ((ret.left + ret.right) // 2 - x0, (ret.top + ret.bottom) // 2 - y0)


def mais_perto(h, elementos, alvo, tolerancia=30):
    melhor, dist = None, None
    for e in elementos:
        x, y = relativo(h, e.rectangle())
        d = abs(x - alvo[0]) + abs(y - alvo[1])
        if dist is None or d < dist:
            melhor, dist = e, d
    return melhor if dist is not None and dist <= tolerancia else None


def campo(h, alvo, nome):
    edits = uia.window(handle=h).descendants(control_type='Edit')
    e = mais_perto(h, edits, alvo)
    if not e:
        raise Parou('não achei o campo ' + nome + ' na Importação')
    return e


def valor(e):
    try:
        return (e.get_value() or '').strip()
    except Exception:
        try:
            return (e.window_text() or '').strip()
        except Exception:
            return ''


def digitar(h, e, texto, depois='{TAB}'):
    # o texto vai direto no campo (WM_SETTEXT) e só o Tab é tecla: nos campos de código a 1ª tecla abre a pesquisa do SCI, que
    # engole o resto do número, e o Ctrl+A escapa para o SCI e abre o Razão e livro caixa (testes de 27/11/2026)
    win32gui.SendMessage(e.handle, win32con.WM_SETTEXT, 0, texto)
    time.sleep(.3)
    if depois:
        frente(h)
        e.set_focus()
        time.sleep(.3)
        keyboard.send_keys(depois)
    time.sleep(1)


def textos_da_janela(h):
    nomes = []
    try:
        for e in uia.window(handle=h).descendants():
            n = (e.element_info.name or '').strip()
            if n and n not in nomes:
                nomes.append(n)
    except Exception:
        pass
    return nomes


def abrir_importacao(principal):
    frente(principal)
    win32gui.PostMessage(principal, win32con.WM_COMMAND, MENU_DA_IMPORTACAO, 0)
    try:
        return esperar_janela(IMPORTACAO, 'a Importação de lançamentos via arquivo planilha (menu ' + str(MENU_DA_IMPORTACAO) + ')')
    except Parou:
        raise Parou('o item ' + str(MENU_DA_IMPORTACAO) + ' do menu não abriu a Importação de lançamentos via arquivo planilha (o menu do SCI mudou?)')


def janelas_do_sci(pid, fora):
    achadas = []

    def ver(h, _):
        if win32gui.IsWindowVisible(h) and h not in fora:
            try:
                if win32process.GetWindowThreadProcessId(h)[1] == pid:
                    achadas.append(h)
            except Exception:
                pass
    win32gui.EnumWindows(ver, None)
    return achadas


def acompanhar(principal, h_imp, vistas, segundos=180):
    """Depois do ✔: lê cada janela nova do SCI. Só OK: lê, fecha e segue. Outra pergunta: para e deixa na tela.
    vistas = as janelas de antes do clique (a Confirmação abre durante o clique, antes de começar a olhar)."""
    pid = win32process.GetWindowThreadProcessId(principal)[1]
    vistas = set(vistas)
    fim = time.time() + segundos
    avisos = []
    ultimo = time.time()
    while time.time() < fim:
        time.sleep(1)
        novas = [h for h in janelas_do_sci(pid, vistas) if h not in (principal, h_imp)]
        if not novas:
            # depois do último aviso com OK, 8 s sem nada novo: terminou
            if avisos and time.time() - ultimo > 8:
                return avisos
            continue
        ultimo = time.time()
        for h in novas:
            vistas.add(h)
            try:
                titulo, classe = win32gui.GetWindowText(h), win32gui.GetClassName(h)
            except Exception:   # o SCI abre e fecha janelas rápidas (a do "Aguarde"): a que já sumiu, pula
                continue
            if classe == 'TfrStatusProcessoForm':   # "Aguarde, processando..." (só o Cancelar): espera
                continue
            if classe == CONSULTA:
                # abre atrás do "Aguarde" (que fica em 100%) e não vem sozinha: trazer para a frente (o Vitor, 27/11/2026)
                frente(h)
                print('a "' + titulo + '" veio para a frente', flush=True)
                time.sleep(1)
                barra = [t for t in uia.window(handle=h).descendants(control_type='ToolBar') if t.element_info.name == 'tbBarraRazao']
                if not barra or len(barra[0].children()) <= BOTAO_IMPORTAR_DADOS:
                    raise Parou('não achei o Importar dados (F12) na Consulta importação dos lançamentos')
                frente(h)
                barra[0].children()[BOTAO_IMPORTAR_DADOS].click_input()
                print('cliquei no Importar dados (F12)', flush=True)
                continue
            if classe.startswith('TfrInconsistencias'):
                itens = []
                for li in uia.window(handle=h).descendants(control_type='ListItem'):
                    partes = [li.element_info.name] + [c.element_info.name for c in li.children()]
                    itens.append(' '.join(x.strip() for x in partes if x and x.strip()))
                raise Parou('o SCI listou inconsistências: ' + ('; '.join(i for i in itens if i) or 'veja a janela na tela'))
            try:
                textos = textos_da_janela(h)
                botoes = [b for b in uia.window(handle=h).descendants(control_type='Button')]
                nomes = [(b.element_info.name or '').replace('&', '').strip() for b in botoes]
            except Exception:
                if not win32gui.IsWindow(h):
                    continue
                raise
            texto = ' · '.join(t for t in textos if t not in nomes and t != titulo)[:400]
            print('o SCI mostrou "' + titulo + '": ' + texto + (' [' + ', '.join(n for n in nomes if n) + ']' if nomes else ''), flush=True)
            so_ok = [b for b, n in zip(botoes, nomes) if n.upper() == 'OK']
            outros = [n for n in nomes if n and n.upper() != 'OK' and n not in ('Fechar', 'Minimizar', 'Maximizar', 'Restaurar')]
            sim = [b for b, n in zip(botoes, nomes) if n.upper() == 'SIM']
            if sim and any(p in (texto + ' ' + titulo).upper() for p in PERGUNTAS_DO_SIM):
                sim[0].invoke()
                print('respondi Sim', flush=True)
                time.sleep(1)
            elif so_ok and not outros:
                avisos.append(texto or titulo)
                so_ok[0].invoke()
                time.sleep(1)
            elif outros:
                raise Parou('o SCI perguntou: "' + (texto or titulo) + '" (' + ', '.join(outros) + '); deixei na tela para responder')
    if avisos:
        return avisos
    raise Parou('o SCI não respondeu nada em ' + str(segundos) + ' s depois do ✔')


def main():
    if len(sys.argv) < 3 or not re.match(r'^\d{1,6}$', sys.argv[1]):
        print('uso: python sci_importar_planilha.py <empresa> "<arquivo .xlsx>"')
        sys.exit(2)
    codigo, arquivo = sys.argv[1], os.path.abspath(sys.argv[2])
    if not os.path.isfile(arquivo):
        print('não achei o arquivo: ' + arquivo)
        sys.exit(2)
    principal = janela('TfrUnico')
    if not principal:
        print('o SCI (Novo Visual Contábil) não está aberto')
        sys.exit(1)
    try:
        fechar_rotina()
        h = abrir_importacao(principal)
        frente(h)
        print('importação aberta', flush=True)
        e = campo(h, CAMPO_EMPRESA, 'Empresa')
        digitar(h, e, codigo)
        if valor(e).lstrip('0') != codigo.lstrip('0'):
            raise Parou('a Empresa ficou "' + valor(e) + '", não a ' + codigo)
        print('empresa: ' + codigo, flush=True)
        g = campo(h, CAMPO_GERADOR, 'Gerador')
        digitar(h, g, GERADOR)
        if valor(g) != GERADOR:
            raise Parou('o Gerador ficou "' + valor(g) + '", não o ' + GERADOR)
        if not esperar(lambda: any(NOME_DO_GERADOR in t.upper() for t in textos_da_janela(h)), 5):
            raise Parou('o gerador ' + GERADOR + ' não apareceu como ' + NOME_DO_GERADOR)
        print('gerador: ' + GERADOR + ' - ' + NOME_DO_GERADOR, flush=True)
        caminhos = [x for x in uia.window(handle=h).descendants(control_type='Edit') if x.element_info.class_name == 'TEdit_Diretorio_Padrao_SCI']
        if not caminhos:
            raise Parou('não achei o campo Arquivo')
        digitar(h, caminhos[0], arquivo, depois='')
        if valor(caminhos[0]).lower() != arquivo.lower():
            raise Parou('o Arquivo ficou "' + valor(caminhos[0]) + '"')
        print('arquivo: ' + arquivo, flush=True)
        botoes = [b for tb in uia.window(handle=h).descendants(control_type='ToolBar') for b in tb.children()]
        ok = mais_perto(h, botoes, BOTAO_OK, 25)
        if not ok:
            raise Parou('não achei o ✔ da Importação')
        antes = janelas_do_sci(win32process.GetWindowThreadProcessId(principal)[1], set())
        frente(h)
        ok.click_input()
        print('cliquei no ✔', flush=True)
        avisos = acompanhar(principal, h, antes)
        resumo = ' | '.join(' '.join(a.split()) for a in avisos)
        if 'NENHUM REGISTRO IMPORTADO' in resumo.upper():
            raise Parou('o SCI não importou nada: ' + resumo)
        print('pronto: ' + resumo, flush=True)
        voltar_a_tela_inicial(principal)
    except Parou as e:
        print('parei: ' + str(e), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
