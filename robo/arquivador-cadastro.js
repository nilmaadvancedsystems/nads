// A lista de empresas do arquivador novo (Vitor, 21/10/2026: "o regime do nads vale").
//
// Fontes, nesta ordem, por código:
//   - regime: o Cadastro do nads (coleção `cadastro`, campo regime) > o enquadramento do Entregas (`clientes`) > a planilha
//     da rotina antiga (cadastro_empresas_unificado.xlsx, repositório claudio, SÓ LEITURA);
//   - CNPJ/CPF: o Entregas (`clientes.documento`, o único lugar do banco com o documento) > a planilha;
//   - razão social: o nome do Cadastro do nads (inteiro: "… E BEBIDAS LTDA - FILIAL") > o do Entregas (que veio cortado
//     em 40 letras do Toriba) > a planilha.
// A planilha antiga NUNCA é alterada; ela só entra para o código que o banco não tem.
//
// O que uma fonte diz diferente da outra (CNPJ do Entregas ≠ da planilha, código sem CNPJ, nomes iguais em códigos
// diferentes) vira a lista de pendências (`divergencias`) que vai no relatório, para o Vitor corrigir no cadastro.
// Tudo puro aqui (juntar); quem lê o banco e grava o cache é ler()/atualizar().
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const so = s => String(s == null ? '' : s).replace(/\D/g, '');
// o Entregas perdeu o zero à esquerda de alguns CPF/CNPJ ("5108042680"): completa para 11 ou 14 dígitos
const doc = s => { const d = so(s); return d.length === 10 ? '0' + d : d.length === 13 ? '0' + d : d; };

/**
 * planilha: [{ codigo, razao, fantasia, doc, ie, regime }]; entregas: [{ codigoOrigem, nome, nomeFantasia, documento,
 * enquadramento, ativo, contasBancarias }]; nads: [{ codigo, nome, regime, bancos, socios }]. Devolve { linhas (para
 * R.montarCadastro), divergencias }.
 *
 * As contas bancárias (Vitor, 28/10/2026: o cliente do extrato, do comprovante e da aplicação sai da conta, para separar matriz
 * e filiais): as do Entregas (clientes.contasBancarias [{ banco, agencia, conta }]) e as do Cadastro do nads (cadastro.bancos
 * [{ marca, agencia, conta }], Cadastro › Empresas › Bancos), com o código; R.montarCadastro normaliza (só os dígitos, sem zeros
 * à esquerda, o dígito separado e opcional). Os sócios do Cadastro do nads (cadastro.socios [{ nome, cpf }]) vão junto.
 */
function juntar({ planilha = [], entregas = [], nads = [] }) {
  const porCod = new Map();
  const pega = c => { if (!porCod.has(c)) porCod.set(c, { codigo: c, fontes: [] }); return porCod.get(c); };
  for (const p of planilha) { const c = +p.codigo; if (!Number.isInteger(c) || c <= 1) continue; Object.assign(pega(c), { pl: p }); pega(c).fontes.push('planilha'); }
  for (const e of entregas) { const c = +e.codigoOrigem; if (!Number.isInteger(c) || c <= 1) continue; Object.assign(pega(c), { en: e }); pega(c).fontes.push('entregas'); }
  for (const n of nads) { const c = +n.codigo; if (!Number.isInteger(c) || c <= 1) continue; Object.assign(pega(c), { na: n }); pega(c).fontes.push('nads'); }
  const linhas = [];
  const divergencias = [];
  for (const [codigo, x] of [...porCod].sort((a, b) => a[0] - b[0])) {
    const docEn = doc(x.en && x.en.documento), docPl = doc(x.pl && x.pl.doc);
    const principal = docEn || docPl;
    const outraEmpresa = !!(docEn && docPl && docEn.length === 14 && docPl.length === 14 && docEn.slice(0, 8) !== docPl.slice(0, 8));
    // CPF numa fonte e CNPJ na outra (pessoa física que também tem CNPJ, ex. 332): os dois identificam o cliente
    if (docEn && docPl && docEn !== docPl && docEn.length === docPl.length) divergencias.push({ codigo, tipo: outraEmpresa ? 'CODIGO_DE_OUTRA_EMPRESA' : docEn.length === 14 ? 'CNPJ_DIFERENTE' : 'CPF_DIFERENTE', detalhe: 'Entregas ' + docEn + ' (' + ((x.en && x.en.nome) || '') + ') × planilha antiga ' + docPl + ' (' + ((x.pl && x.pl.razao) || '') + '): vale o do Entregas' });
    if (!principal) divergencias.push({ codigo, tipo: 'SEM_CNPJ', detalhe: 'nenhuma fonte tem o CNPJ/CPF de ' + ((x.na && x.na.nome) || (x.en && x.en.nome) || (x.pl && x.pl.razao) || codigo) });
    const regime = (x.na && x.na.regime) || (x.en && x.en.enquadramento) || (x.pl && x.pl.regime) || null;
    const razao = (x.na && x.na.nome) || (x.en && x.en.nome) || (x.pl && x.pl.razao) || '';
    linhas.push({
      codigo, razao, doc: principal, outrosDocs: docPl && docPl !== principal && !outraEmpresa && docPl.length !== principal.length ? [docPl] : [], regime,
      fantasia: (x.en && x.en.nomeFantasia) || (x.pl && x.pl.fantasia) || '',
      ie: x.pl ? x.pl.ie : '',
      // as outras grafias do nome (a do Entregas, cortada, e a da planilha) também casam com a pasta de origem
      // o nome da planilha só é "outra grafia" se for a mesma empresa (a planilha pode ter o código de outra: a 591)
      outrosNomes: [x.en && x.en.nome, outraEmpresa ? null : x.pl && x.pl.razao].filter(n => n && R.chaveNome(n) !== R.chaveNome(razao)),
      fonteRegime: x.na && x.na.regime ? 'nads' : x.en && x.en.enquadramento ? 'entregas' : x.pl && x.pl.regime ? 'planilha' : null,
      ativo: x.en ? x.en.ativo !== false : true,
      nomeEntregas: (x.en && x.en.nome) || '',
      contas: contasDe(x),
      socios: ((x.na && x.na.socios) || []).map(p => ({ nome: String(p.nome || '').trim(), cpf: doc(p.cpf) })).filter(p => p.cpf.length === 11),
    });
  }
  // o mesmo CNPJ em dois códigos (cadastro duplicado) e nomes iguais em códigos diferentes (matriz/filiais sem "FILIAL")
  const porDoc = new Map(), porNome = new Map();
  for (const l of linhas) {
    for (const d of [l.doc].concat(l.outrosDocs)) if (d) { if (!porDoc.has(d)) porDoc.set(d, []); porDoc.get(d).push(l.codigo); }
    const k = R.chaveNome(l.razao); if (k) { if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(l.codigo); }
  }
  for (const [d, cs] of porDoc) if (cs.length > 1) divergencias.push({ codigo: cs[0], tipo: 'CNPJ_EM_DOIS_CODIGOS', detalhe: d + ' nos códigos ' + cs.join(', ') });
  for (const [, cs] of porNome) if (cs.length > 1) divergencias.push({ codigo: cs[0], tipo: 'MESMO_NOME', detalhe: 'códigos ' + cs.join(', ') + ' com a mesma razão social (a pasta de origem não desempata)' });
  return { linhas, divergencias };
}

/** As contas bancárias de um código: Entregas e nads, só as que têm o número da conta. */
function contasDe(x) {
  const en = ((x.en && x.en.contasBancarias) || []).map(c => ({ banco: c.banco, agencia: c.agencia, conta: c.conta, fonte: 'entregas', origem: c.origem || null }));
  const na = ((x.na && x.na.bancos) || []).map(b => ({ banco: b.marca || b.nome, agencia: b.agencia, conta: b.conta, fonte: 'nads' }));
  return en.concat(na).filter(c => c && c.conta && /\d/.test(String(c.conta)));
}

/** A planilha da rotina antiga (só leitura). */
function lerPlanilha(arquivo) {
  const XLSX = require('xlsx');
  const ws = XLSX.readFile(arquivo).Sheets;
  const linhas = XLSX.utils.sheet_to_json(ws[Object.keys(ws)[0]], { header: 1 });
  const cab = linhas[0].map(c => R.chaveNome(c));
  const col = n => cab.indexOf(R.chaveNome(n));
  return linhas.slice(1).filter(l => l && l[col('Código')] != null).map(l => ({
    codigo: l[col('Código')], razao: l[col('Razão Social')], fantasia: l[col('Nome Fantasia')], doc: l[col('CNPJ')], ie: l[col('Insc.Estadual')], regime: l[col('Enquadramento')],
  }));
}

/** Lê o banco (Entregas `clientes` e nads `cadastro`, só os campos usados, com as contas bancárias e os sócios) e grava o cache. */
async function atualizar(db, cacheArq) {
  const [cli, cad] = await Promise.all([
    db.collection('clientes').select('codigoOrigem', 'nome', 'nomeFantasia', 'documento', 'enquadramento', 'ativo', 'contasBancarias').get(),
    db.collection('cadastro').select('codigo', 'nome', 'regime', 'bancos', 'socios').get(),
  ]);
  const dados = { em: new Date().toISOString(), entregas: cli.docs.map(d => d.data()), nads: cad.docs.map(d => d.data()) };
  fs.mkdirSync(path.dirname(cacheArq), { recursive: true });
  fs.writeFileSync(cacheArq + '.tmp', JSON.stringify(dados));
  fs.renameSync(cacheArq + '.tmp', cacheArq);
  return dados;
}
function lerCache(cacheArq) { try { return JSON.parse(fs.readFileSync(cacheArq, 'utf8')); } catch (e) { return null; } }

module.exports = { juntar, lerPlanilha, atualizar, lerCache };
