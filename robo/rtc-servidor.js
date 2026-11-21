// A calculadora da Receita no ar no PC do servidor, sem ninguém precisar ir até ele (21/11/2026: "nao consigo nao estou
// no escritorio"). Quando o SIEG liga (sieg.js › iniciarSieg), e depois a cada 6 horas: se a calculadora não responde
// em 127.0.0.1:8080, o robô roda o robo/calculadoras-rtc/instalar.ps1 por trás. Na primeira vez ele baixa o Java 25 e as
// duas calculadoras para D:\nads-rtc e gera o banco e os .jar (uns 10 min); nas outras, só liga o que já está lá. O
// andamento vai para o registro e o resultado (a memória de cada uma e a livre no PC) vai para o painel do robô.
// Só no Windows. Uma tentativa que falhou só se repete depois de 6 h. O registro completo fica em D:\nads-rtc\instalar.log.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { criarCalculadora } = require('./sieg-ibscbs');

const SCRIPT = path.join(__dirname, 'calculadoras-rtc', 'instalar.ps1');
const DE_NOVO_MS = 6 * 3600e3;
const ESPERA_MAX_MS = 45 * 60e3;

/** A pasta da instalação: RTC_PASTA, ou D:\nads-rtc (C:\nads-rtc sem o disco D:). */
function pastaPadrao(existe = fs.existsSync) {
  if (process.env.RTC_PASTA) return process.env.RTC_PASTA;
  return existe('D:\\') ? 'D:\\nads-rtc' : 'C:\\nads-rtc';
}

/** As linhas que importam da saída do instalar.ps1: a versão do Java, o "no ar" de cada uma e a memória. */
function resumoDaSaida(texto) {
  return String(texto || '').split(/\r?\n/).map(l => l.trim())
    .filter(l => /^(regime-regular|simples-nacional):|^Mem[oó]ria|NÃO respondeu|já instalada|^Instalando/i.test(l));
}

/** Roda o instalar.ps1 e devolve { codigo, saida }. A saída em UTF-8 (o PowerShell 5.1 usa a página do console). */
function rodarInstalador({ pasta, executar = spawn, esperaMax = ESPERA_MAX_MS } = {}) {
  return new Promise(resolve => {
    const cmd = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; & '" + SCRIPT.replace(/'/g, "''") + "' -Pasta '" + pasta.replace(/'/g, "''") + "'";
    let saida = '';
    let fim = false;
    const p = executar('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
    const acabar = codigo => { if (fim) return; fim = true; clearTimeout(relogio); resolve({ codigo, saida }); };
    const relogio = setTimeout(() => { acabar(-1); try { p.kill(); } catch { /* já saiu */ } }, esperaMax);
    p.stdout && p.stdout.on('data', b => { saida += b.toString('utf8'); });
    p.stderr && p.stderr.on('data', b => { saida += b.toString('utf8'); });
    p.on('error', err => { saida += '\n' + err.message; acabar(-2); });
    p.on('close', codigo => acabar(codigo));
  });
}

/**
 * Garante a calculadora no ar. Devolve 'no-ar' (já estava), 'ligada' (o instalador ligou), 'falhou' ou 'pulou'
 * (não é Windows, já está tentando, ou falhou há menos de 6 h).
 */
function criarGarantia({ log = () => {}, painel = null, calc = criarCalculadora(), pasta = pastaPadrao(), plataforma = process.platform, executar, agora = () => Date.now(), esperaMax } = {}) {
  let tentando = false;
  let falhouEm = 0;
  const aoPainel = (f, ...a) => { try { if (painel) painel[f](...a); } catch { /* só o painel */ } };
  async function garantir() {
    if (plataforma !== 'win32' || tentando) return 'pulou';
    const antes = await calc.versao();
    if (antes) { aoPainel('modulo', 'rtc', 'Calculadora da Receita (IBS/CBS)', true, antes); return 'no-ar'; }
    if (falhouEm && agora() - falhouEm < DE_NOVO_MS) return 'pulou';
    tentando = true;
    try {
      log('Calculadora da Receita: fora do ar; rodando o instalar.ps1 em', pasta, '(a primeira vez baixa o Java e as calculadoras, uns 10 min)');
      aoPainel('modulo', 'rtc', 'Calculadora da Receita (IBS/CBS)', false, 'instalando ou ligando em ' + pasta);
      const { codigo, saida } = await rodarInstalador({ pasta, executar, esperaMax });
      try { fs.mkdirSync(pasta, { recursive: true }); fs.appendFileSync(path.join(pasta, 'instalar.log'), '\n==== ' + new Date(agora()).toISOString() + ' (código ' + codigo + ')\n' + saida); } catch { /* sem o registro em arquivo */ }
      const linhas = resumoDaSaida(saida);
      for (const l of linhas) log('Calculadora da Receita:', l);
      const depois = await calc.versao();
      if (depois) {
        falhouEm = 0;
        aoPainel('modulo', 'rtc', 'Calculadora da Receita (IBS/CBS)', true, depois);
        aoPainel('atividade', 'sieg', 'Calculadora da Receita no ar (' + depois + ')', linhas.filter(l => /^Mem/i.test(l)).join(' · '));
        return 'ligada';
      }
      falhouEm = agora();
      const ultima = String(saida || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
      log('Calculadora da Receita: não ficou no ar (código ' + codigo + ')', ultima);
      aoPainel('modulo', 'rtc', 'Calculadora da Receita (IBS/CBS)', false, 'não ficou no ar; ver ' + path.join(pasta, 'instalar.log'));
      aoPainel('erro', 'sieg', 'A calculadora da Receita não ficou no ar', 'código ' + codigo + (ultima ? ' — ' + ultima : ''));
      return 'falhou';
    } finally { tentando = false; }
  }
  return { garantir };
}

/** Liga a garantia: uma vez agora (sem segurar quem chamou) e a cada 6 h. Devolve o parar. */
function ligar(opcoes) {
  const g = criarGarantia(opcoes);
  const vez = () => g.garantir().catch(err => (opcoes && opcoes.log ? opcoes.log('Calculadora da Receita:', err.message) : null));
  setTimeout(vez, 60e3).unref();
  const relogio = setInterval(vez, DE_NOVO_MS);
  relogio.unref();
  return () => clearInterval(relogio);
}

module.exports = { criarGarantia, ligar, rodarInstalador, resumoDaSaida, pastaPadrao, SCRIPT };
