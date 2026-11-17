// A medição da folha de verdade (13/11/2026): antes de confiar no holerite para o Registro da Área do Cliente, quantas
// empresas têm o PDF da folha na pasta do DP e quantos o leitor (packages/core/src/areaCliente/folhaLida.ts, pelo
// robo/gerado) entende. SÓ LÊ: não grava nada, não toca no banco, não manda nada para fora.
//
// Imprime só números e o código de cada empresa — nunca nome de pessoa, CPF ou valor de alguém.
//
// Uso (na máquina com o G:\Meu Drive, o NILMA-SERVER):  node medir-folha.js [meses=3]
//   ARQUIVO_DRIVE troca a raiz do Drive (o padrão é G:\Meu Drive, como no area-cliente.js).
const fs = require('fs');
const path = require('path');

const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const MAIOR = 5 * 1024 * 1024;

/** Os PDFs de uma pasta, descendo nas subpastas. */
function pdfsDe(pasta) {
  let saida = [];
  let itens = [];
  try { itens = fs.readdirSync(pasta, { withFileTypes: true }); } catch (e) { return saida; }
  for (const i of itens) {
    const p = path.join(pasta, i.name);
    if (i.isDirectory()) saida = saida.concat(pdfsDe(p));
    else if (/\.pdf$/i.test(i.name)) saida.push(p);
  }
  return saida;
}

async function medir(meses = 3, hoje = new Date()) {
  const P = require('./gerado/danfse');
  const competencias = Array.from({ length: meses }, (_, k) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1); return { ano: String(d.getFullYear()), mm: String(d.getMonth() + 1).padStart(2, '0') }; });
  const porEmpresa = new Map(); // código → { arquivos, lidos, holerites, conferem, comCargo, comAdmissao, previsaoDeFerias, meses: Set }
  const geral = { empresas: 0, pdfsDaFolha: 0, pdfsLidos: 0, pdfsSemTexto: 0, holerites: 0, conferem: 0, previsoes: 0, erros: 0 };
  for (const { ano, mm } of competencias) {
    let empresas = [];
    try { empresas = fs.readdirSync(path.join(DRIVE, ano), { withFileTypes: true }).filter(d => d.isDirectory() && /^\d+ - /.test(d.name)); } catch (e) { continue; }
    for (const e of empresas) {
      const codigo = e.name.split(' - ')[0];
      const dp = path.join(DRIVE, ano, e.name, 'DEPARTAMENTO PESSOAL', mm);
      for (const arquivo of pdfsDe(dp)) {
        const rel = path.relative(path.join(DRIVE, ano, e.name), path.dirname(arquivo)).split(path.sep).join('/');
        const categoria = P.categoriaDoArquivoDp(path.basename(arquivo), rel);
        if (!['folha', 'recibo', 'ferias'].includes(categoria)) continue;
        const m = porEmpresa.get(codigo) || { arquivos: 0, lidos: 0, holerites: 0, conferem: 0, comCargo: 0, comAdmissao: 0, previsaoDeFerias: 0, meses: new Set() };
        porEmpresa.set(codigo, m);
        if (categoria !== 'ferias') { m.arquivos++; geral.pdfsDaFolha++; }
        try {
          if (fs.statSync(arquivo).size > MAIOR) continue;
          const paginas = await P.itensDoPdf(new Uint8Array(fs.readFileSync(arquivo)));
          if (!paginas.some(p => p.some(i => String(i.texto || '').trim()))) { geral.pdfsSemTexto++; continue; }
          const ferias = P.feriasDasPaginas(paginas);
          if (ferias) { m.previsaoDeFerias++; geral.previsoes++; }
          if (categoria === 'ferias') continue;
          const hs = P.holeritesDasPaginas(paginas);
          if (hs.length) { m.lidos++; geral.pdfsLidos++; m.meses.add(ano + '-' + mm); }
          m.holerites += hs.length; geral.holerites += hs.length;
          const ok = hs.filter(h => h.confere).length;
          m.conferem += ok; geral.conferem += ok;
          m.comCargo += hs.filter(h => h.cargo).length;
          m.comAdmissao += hs.filter(h => h.admissao).length;
        } catch (err) { geral.erros++; }
      }
    }
  }
  geral.empresas = porEmpresa.size;
  return { competencias: competencias.map(c => c.ano + '-' + c.mm), geral, porEmpresa };
}

if (require.main === module) {
  const meses = Math.max(1, Math.min(12, Number(process.argv[2]) || 3));
  medir(meses).then(({ competencias, geral, porEmpresa }) => {
    console.log('Meses: ' + competencias.join(', ') + ' · raiz: ' + DRIVE);
    console.log('Empresas com PDF da folha/recibo/férias: ' + geral.empresas);
    console.log('PDFs da folha/recibo: ' + geral.pdfsDaFolha + ' · com holerite lido: ' + geral.pdfsLidos + ' · sem texto (escaneado): ' + geral.pdfsSemTexto + ' · erros: ' + geral.erros);
    console.log('Holerites lidos: ' + geral.holerites + ' · fecham (proventos − descontos = líquido): ' + geral.conferem);
    console.log('Previsões de férias lidas: ' + geral.previsoes);
    console.log('\ncódigo  pdfs  lidos  holerites  fecham  c/cargo  c/admissão  previsão  meses');
    for (const [c, m] of [...porEmpresa].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      console.log([c.padEnd(6), String(m.arquivos).padStart(4), String(m.lidos).padStart(6), String(m.holerites).padStart(10), String(m.conferem).padStart(7), String(m.comCargo).padStart(8), String(m.comAdmissao).padStart(11), String(m.previsaoDeFerias).padStart(9), '  ' + [...m.meses].sort().join(' ')].join(' '));
    }
  }).catch(e => { console.error('medir-folha:', e.message); process.exit(1); });
}

module.exports = { medir };
