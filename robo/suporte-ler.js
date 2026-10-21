// O leitor do suporte (Vitor, 20/10/2026): roda os leitores do nads — o mesmo código do site — sobre um arquivo e imprime
// o resumo da leitura em JSON (quantos lançamentos, de quais meses, a soma, o saldo anterior, se o saldo fecha, quanto
// tempo levou). O robô do suporte (suporte-claude.js) usa para reproduzir o bug; o Claude dele também pode rodar este
// comando (é a única coisa que ele roda). Só lê o arquivo: não grava em banco nenhum, não mexe no código.
//
// Uso: node robo/suporte-ler.js <arquivo> [ano]
// Na primeira vez (ou quando o core mudar), junta os leitores em robo/.suporte/leitores.mjs (rolldown, da raiz do nads).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const PASTA = path.join(__dirname, '.suporte');
const SAIDA = path.join(PASTA, 'leitores.mjs');
const ENTRADA = path.join(__dirname, 'suporte-ler-entrada.ts');

/** O arquivo mais novo do core (para refazer o pacote quando o código mudar). */
function maisNovoDoCore() {
  let mais = 0;
  const andar = d => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) { if (n.name !== 'node_modules') andar(p); } else if (/\.ts$/.test(n.name)) mais = Math.max(mais, fs.statSync(p).mtimeMs);
    }
  };
  andar(path.join(RAIZ, 'packages', 'core', 'src'));
  return Math.max(mais, fs.statSync(ENTRADA).mtimeMs);
}

async function leitores() {
  const pronto = fs.existsSync(SAIDA) && fs.statSync(SAIDA).mtimeMs >= maisNovoDoCore();
  if (!pronto) {
    fs.mkdirSync(PASTA, { recursive: true });
    const { build } = require(require.resolve('rolldown', { paths: [RAIZ] }));
    // as bibliotecas (o PDF, a planilha) ficam de fora: vêm do node_modules da raiz, como no site
    await build({ input: ENTRADA, platform: 'node', external: [/^pdfjs-dist/, /^xlsx/, /^pdf-lib/], output: { file: SAIDA, format: 'esm' }, logLevel: 'silent' });
  }
  return import(pathToFileURL(SAIDA).href);
}

const centavos = c => Math.round(c) / 100;

async function main() {
  const arquivo = process.argv[2];
  const ano = Number(process.argv[3]) || new Date().getFullYear();
  if (!arquivo || !fs.existsSync(arquivo)) { console.log(JSON.stringify({ erro: 'arquivo não encontrado: ' + arquivo })); process.exit(1); }
  const L = await leitores();
  const bytes = new Uint8Array(fs.readFileSync(arquivo));
  const nome = path.basename(arquivo);
  const saida = { arquivo: nome, tamanhoKB: Math.round(bytes.length / 1024) };

  // como extrato (lado do banco) e como razão (lado do sistema)
  for (const lado of ['banco', 'sistema']) {
    const t = Date.now();
    try {
      const l = await L.lerArquivo(nome, bytes.slice(), lado, ano);
      const porMes = {};
      for (const x of l.lancamentos) {
        const m = x.data.slice(0, 7);
        porMes[m] = porMes[m] || { qtd: 0, entradas: 0, saidas: 0 };
        porMes[m].qtd++;
        if (x.valor >= 0) porMes[m].entradas += x.valor; else porMes[m].saidas += x.valor;
      }
      for (const m of Object.keys(porMes)) { porMes[m].entradas = centavos(porMes[m].entradas); porMes[m].saidas = centavos(porMes[m].saidas); }
      const soma = l.lancamentos.reduce((s, x) => s + x.valor, 0);
      const ultimoSaldo = l.saldosDoDia && l.saldosDoDia.length ? l.saldosDoDia[l.saldosDoDia.length - 1] : null;
      saida[lado === 'banco' ? 'comoExtrato' : 'comoRazao'] = {
        segundos: (Date.now() - t) / 1000, erro: l.erro || null, semMovimento: l.semMovimento || null, ocr: !!l.ocr,
        lancamentos: l.lancamentos.length, porMes,
        saldoAnterior: l.saldoAnterior != null ? centavos(l.saldoAnterior) : null,
        // o saldo fecha? saldo anterior + soma dos lançamentos = o último saldo do dia que o extrato mostra
        saldoFecha: l.saldoAnterior != null && ultimoSaldo ? Math.abs(l.saldoAnterior + soma - ultimoSaldo.saldo) <= 1 : null,
        ultimoSaldoDoDia: ultimoSaldo ? { data: ultimoSaldo.data, saldo: centavos(ultimoSaldo.saldo) } : null,
        primeiros: l.lancamentos.slice(0, 5).map(x => ({ data: x.data, valor: centavos(x.valor), historico: x.historico.slice(0, 80) })),
        ultimos: l.lancamentos.slice(-5).map(x => ({ data: x.data, valor: centavos(x.valor), historico: x.historico.slice(0, 80) })),
      };
    } catch (e) {
      saida[lado === 'banco' ? 'comoExtrato' : 'comoRazao'] = { segundos: (Date.now() - t) / 1000, erro: 'o leitor quebrou: ' + (e && e.message || e) };
    }
  }
  // planilha: também como balancete dinâmico
  if (/\.(xlsx?|ods)$/i.test(nome)) {
    const t = Date.now();
    try {
      const d = L.lerBalanceteDinamico(L.lerPlanilha(bytes.slice().buffer));
      saida.comoBalanceteDinamico = { segundos: (Date.now() - t) / 1000, meses: d.meses, contas: d.linhas.length };
    } catch (e) {
      saida.comoBalanceteDinamico = { segundos: (Date.now() - t) / 1000, erro: e && e.message || String(e) };
    }
  }
  console.log(JSON.stringify(saida, null, 1));
}

main().catch(e => { console.log(JSON.stringify({ erro: 'suporte-ler falhou: ' + (e && e.stack || e) })); process.exit(1); });
