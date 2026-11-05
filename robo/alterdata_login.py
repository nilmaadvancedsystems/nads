# O login do robô no Alterdata Contábil (04/11/2026, Vitor: "tem um login criado especificamente para o robo, onde ele tem
# permissão so de puxar relatorio, mais nada"). O usuário e a senha ficam SÓ no Gerenciador de Credenciais do Windows da
# sessão onde o robô roda (credencial genérica "nads-alterdata-robo", gravada pelo Vitor com
#   cmdkey /generic:nads-alterdata-robo /user:<usuario> /pass
# que pede a senha sem mostrar). Este roteiro lê a credencial na hora e preenche a tela de login; a senha nunca é escrita
# em lugar nenhum (nem no log, nem no banco, nem na saída). Nenhuma pessoa nem o Claude vê a senha.
#
# Uso: python alterdata_login.py --tem     → TEM: sim | nao (se a credencial existe; não lê a senha)
#      python alterdata_login.py           → preenche e entra; RESULTADO: {"ok": true} ou {"ok": false, "erro": "..."}
#
# Sem coordenadas: a caixa da senha é a que tem o estilo de senha do Windows (ES_PASSWORD); a do usuário, a caixa de texto
# visível logo acima dela. Se a tela não for reconhecida assim, não digita nada e devolve os campos que viu. Uma tentativa
# só: quem chama não repete (a conta pode ser bloqueada).
import json
import os
import sys
import time

import win32con
import win32cred
import win32gui

sys.stdout.reconfigure(encoding='utf-8')
ALVO = os.environ.get('ALTERDATA_CRED', 'nads-alterdata-robo')
# a classe da tela de login (TfrmLogin no 7.1106, TfrmLoginSimultaneo no 7.1029); outra só no teste
CLASSE_LOGIN = os.environ.get('ALTERDATA_CLASSE_LOGIN', 'TfrmLogin')
ES_PASSWORD = 0x20


def fim(ok, erro=''):
    print('RESULTADO: ' + json.dumps({'ok': ok, 'erro': erro} if not ok else {'ok': True}, ensure_ascii=False), flush=True)
    sys.exit(0)


def credencial():
    try:
        return win32cred.CredRead(ALVO, win32cred.CRED_TYPE_GENERIC, 0)
    except Exception:
        return None


if '--tem' in sys.argv:
    print('TEM: ' + ('sim' if credencial() else 'nao'), flush=True)
    sys.exit(0)


def topo():
    r = []
    win32gui.EnumWindows(lambda h, _: r.append(h) or True, None)
    return [(h, win32gui.GetClassName(h)) for h in r if win32gui.IsWindowVisible(h)]


def tela_de_login():
    return next((h for h, c in topo() if c.startswith(CLASSE_LOGIN)), None)


def principal_visivel():
    return any(c == 'TfrmPrincipal' for _, c in topo())


def filhos(h):
    r = []
    win32gui.EnumChildWindows(h, lambda c, _: r.append(c) or True, None)
    return [c for c in r if win32gui.IsWindowVisible(c)]


def eh_caixa(cls):
    return 'edit' in cls.lower() or 'mask' in cls.lower()


cred = credencial()
if not cred:
    fim(False, 'sem a credencial ' + ALVO + ' no Gerenciador de Credenciais desta sessão')


def caixa_de_senha_pronta(h):
    try:
        return any(eh_caixa(win32gui.GetClassName(c)) and win32gui.GetWindowLong(c, win32con.GWL_STYLE) & ES_PASSWORD for c in filhos(h))
    except Exception:
        return False


# 05/11/2026 (Vitor: "o robo demora muito para coloca a senha e confirmar quando abre o contabil"): logo depois de abrir o
# Contábil, o robô não espera a checagem do minuto: fica olhando a cada meio segundo até a tela de login estar pronta
if '--esperar' in sys.argv:
    try:
        limite_tela = time.time() + float(sys.argv[sys.argv.index('--esperar') + 1])
    except Exception:
        limite_tela = time.time() + 180
    while time.time() < limite_tela:
        h = tela_de_login()
        if h and caixa_de_senha_pronta(h):
            time.sleep(0.4)   # a tela acabou de desenhar os campos
            break
        if principal_visivel() and not h:
            print('RESULTADO: ' + json.dumps({'ok': True, 'jaEntrou': True}), flush=True)
            sys.exit(0)
        time.sleep(0.5)
login = tela_de_login()
if not login:
    print('RESULTADO: ' + json.dumps({'ok': False, 'semTela': True, 'erro': 'a tela de login do Contábil não apareceu'}, ensure_ascii=False), flush=True)
    sys.exit(0)

caixas = []
for c in filhos(login):
    cls = win32gui.GetClassName(c)
    if not eh_caixa(cls):
        continue
    # as caixas internas (TcxCustomInnerTextEdit) e as simples (TEdit) aceitam WM_SETTEXT; as de fora (TcxTextEdit) têm
    # uma interna dentro: fica a interna
    if any(eh_caixa(win32gui.GetClassName(f)) for f in filhos(c)):
        continue
    estilo = win32gui.GetWindowLong(c, win32con.GWL_STYLE)
    l, t, _, _ = win32gui.GetWindowRect(c)
    caixas.append({'h': c, 'cls': cls, 'senha': bool(estilo & ES_PASSWORD), 'x': l, 'y': t})

senhas = [c for c in caixas if c['senha']]
descricao = ', '.join(c['cls'] + ('(senha)' if c['senha'] else '') + '@' + str(c['x']) + ',' + str(c['y']) for c in caixas)
if len(senhas) != 1:
    fim(False, 'não reconheci a tela de login (' + str(len(senhas)) + ' caixas de senha): ' + descricao)
senha = senhas[0]
acima = sorted([c for c in caixas if not c['senha'] and c['y'] < senha['y']], key=lambda c: c['y'])
if not acima:
    fim(False, 'não achei a caixa do usuário acima da senha: ' + descricao)
usuario = acima[-1]

botoes = []
for c in filhos(login):
    txt = (win32gui.GetWindowText(c) or '').replace('&', '').strip().lower()
    if txt in ('ok', 'entrar', 'confirmar', 'acessar', 'login', 'conectar'):
        botoes.append(c)
if len(botoes) != 1:
    fim(False, 'não achei um botão de entrar só (' + str(len(botoes)) + ')')

try:
    win32gui.SendMessage(usuario['h'], win32con.WM_SETTEXT, 0, cred['UserName'])
    win32gui.SendMessage(senha['h'], win32con.WM_SETTEXT, 0, cred['CredentialBlob'].decode('utf-16-le'))
finally:
    cred = None  # a senha não fica na memória além do necessário
time.sleep(0.5)


def clicar(h):
    # o Entrar do Contábil é um TcxButton (DevExpress): não atende o BM_CLICK do Windows (04/11/2026, Vitor: "tem que
    # clicar em entrar"); vai o clique do mouse como mensagem no próprio botão, no meio dele (sem mexer no cursor, então
    # vale com o RDP desconectado)
    _, _, w, a = win32gui.GetClientRect(h)
    pos = (a // 2) << 16 | (w // 2)
    win32gui.PostMessage(h, win32con.WM_MOUSEMOVE, 0, pos)
    win32gui.PostMessage(h, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, pos)
    time.sleep(0.15)
    win32gui.PostMessage(h, win32con.WM_LBUTTONUP, 0, pos)


clicar(botoes[0])

# entrou: a tela de login some (o resto do Contábil carrega depois, a checagem do robô acompanha); uma mensagem
# (TMessageForm) no meio é o login recusado. Se em 3 s a tela de login continua lá sem mensagem nenhuma, o clique não
# pegou: vai o Enter na caixa da senha (o Entrar é o padrão)
limite = time.time() + 90
enter = time.time() + 3
sumiu = 0
while time.time() < limite:
    time.sleep(0.4)
    janelas = topo()
    if enter and time.time() > enter:
        enter = 0
        if tela_de_login() and not any(c in ('TMessageForm', '#32770') for _, c in janelas):
            win32gui.PostMessage(senha['h'], win32con.WM_KEYDOWN, win32con.VK_RETURN, 0x001C0001)
            win32gui.PostMessage(senha['h'], win32con.WM_KEYUP, win32con.VK_RETURN, 0xC01C0001)
    msg = next((h for h, c in janelas if c in ('TMessageForm', '#32770')), None)
    if msg:
        texto = ' '.join((win32gui.GetWindowText(f) or '') for f in filhos(msg) if win32gui.GetClassName(f) in ('TLabel', 'Static', 'TMemo')).strip()
        # fecha a mensagem; não tenta de novo
        ok = next((f for f in filhos(msg) if (win32gui.GetWindowText(f) or '').replace('&', '').strip().lower() in ('ok', 'fechar')), None)
        if ok:
            win32gui.PostMessage(ok, win32con.BM_CLICK, 0, 0)
        fim(False, 'o Contábil recusou o login: ' + (texto[:200] or 'mensagem sem texto'))
    if tela_de_login():
        sumiu = 0
    elif not sumiu:
        sumiu = time.time()
    elif time.time() - sumiu > 1.5:   # sumiu e nenhuma mensagem de recusa em 1,5 s: entrou
        fim(True)
fim(False, 'passou de 90 s depois de entrar e o Contábil não abriu')
