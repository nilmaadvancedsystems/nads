# De qual programa do Alterdata é uma janela (16/11/2026, Vitor: o robô passa a puxar as notas no Alterdata Fiscal).
# O Contábil e o Fiscal são programas diferentes, mas montados do mesmo jeito: os dois podem ter uma janela TfrmPrincipal
# e uma TfrmLogin. Sem olhar o programa, o Fiscal aberto no servidor virava "dois Contábil abertos" e o balancete parava.
# Aqui: o caminho do .exe da janela (só pergunta ao Windows; não manda mensagem para a janela, então não trava).
import os

import win32api
import win32con
import win32process

CONTABIL = os.environ.get('ALTERDATA_WCONT', r'C:\Program Files (x86)\Alterdata\Pack\Diamond\Contabil\wcont.exe')
_cache = {}


def exe_do_pid(pid):
    """O caminho do .exe do processo, em minúsculas ('' se o Windows não disser)."""
    if pid in _cache:
        return _cache[pid]
    caminho = ''
    try:
        h = win32api.OpenProcess(0x1000, False, pid)   # PROCESS_QUERY_LIMITED_INFORMATION
        try:
            caminho = win32process.GetModuleFileNameEx(h, 0)
        finally:
            win32api.CloseHandle(h)
    except Exception:
        try:
            h = win32api.OpenProcess(win32con.PROCESS_QUERY_INFORMATION | win32con.PROCESS_VM_READ, False, pid)
            try:
                caminho = win32process.GetModuleFileNameEx(h, 0)
            finally:
                win32api.CloseHandle(h)
        except Exception:
            caminho = ''
    _cache[pid] = (caminho or '').lower()
    return _cache[pid]


def pid_da_janela(h):
    return win32process.GetWindowThreadProcessId(h)[1]


def exe_da_janela(h):
    try:
        return exe_do_pid(pid_da_janela(h))
    except Exception:
        return ''


def do_contabil(h):
    """A janela é do Contábil (o wcont.exe). Sem saber o programa, vale como do Contábil (como era antes)."""
    exe = exe_da_janela(h)
    return not exe or os.path.basename(exe) == os.path.basename(CONTABIL).lower()


def do_contabil_certo(h):
    """A janela é do Contábil, com certeza (o programa lido é o wcont.exe). Para as mensagens: uma janela de outro programa (ou
    de um programa que o Windows não deixa ler) não é pergunta do Contábil (18/11/2026: uma janela vazia de outro programa no PC
    do Vitor parava o Importar no Alterdata com "o Alterdata mostrou uma mensagem: ")."""
    exe = exe_da_janela(h)
    return bool(exe) and os.path.basename(exe) == os.path.basename(CONTABIL).lower()


def do_fiscal(h):
    """A janela é de um programa do Alterdata cuja pasta ou nome fala de fiscal (Pack\\Diamond\\Fiscal…, wfiscal.exe…)."""
    exe = exe_da_janela(h)
    if '\\alterdata\\' not in exe or os.path.basename(exe) == os.path.basename(CONTABIL).lower():
        return False
    return 'fisc' in exe.split('\\alterdata\\', 1)[1]
