// Troca o CÓDIGO de empresas no banco (Entregas `clientes` + Cadastro do nads `cadastro` + os documentos que guardam o
// código), pela empresa (CNPJ), nunca pelo nome. Feito para a troca ZELO × AAP (Vitor, 23/10/2026: "pode trocar o código
// das 2": a ZELO AGROINDUSTRIAS - MATRIZ passa a 591 e a AAP INTERMEDIAÇÕES a 602).
//
//   node trocar-codigo-cadastro.js --troca 53636418000156=591 --troca 65116389000180=602            simulação (só lê)
//   node trocar-codigo-cadastro.js --troca … --troca … --gravar --confirmo                            grava (um lote só)
//   node trocar-codigo-cadastro.js --desfazer <diario.json> --gravar --confirmo                         volta ao que era
//
// O que muda (só o campo do código, mais nada):
//   clientes.codigoOrigem (o id do documento fica: nada no código monta o id pelo código; um documento novo duplicaria a
//     empresa e quebraria quem aponta para o id) + codigoAnterior/codigoTrocadoEm, para quem olhar depois;
//   cadastro.codigo + uma linha no historico (como as outras mudanças do Cadastro);
//   os documentos que guardam o código e são, comprovadamente, da mesma empresa (CNPJ, nome ou o id do Cadastro):
//     rotinas.codigo, cofre.codigo (só o código; nada do cofre é lido além disso), financeiroHonorarios.codigo,
//     nfseEmissoes.empresaCodigo.
//   siegContagens e driveIndice são refeitos pelos robôs (o id da contagem leva o código; o índice lê o nome da pasta):
//     só relatados.
// Tudo num lote (batch) só: não há um momento com dois documentos no mesmo código. Antes de gravar, o diário com os
// valores de antes vai para %LOCALAPPDATA%\nads\arquivador-novo\correcao\ (é o que o --desfazer usa).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('./arquivador-regras');

const DIARIOS = path.join(process.env.LOCALAPPDATA || os.homedir(), 'nads', 'arquivador-novo', 'correcao');
const DEPENDENTES = [
  { col: 'rotinas', campo: 'codigo' }, { col: 'cofre', campo: 'codigo' }, { col: 'financeiroHonorarios', campo: 'codigo' },
  { col: 'nfseEmissoes', campo: 'empresaCodigo' },
  { col: 'siegContagens', campo: 'codigo', soRelatar: 'contagem refeita pelo robô do SIEG (o id leva o código)' },
  { col: 'driveIndice', campo: 'codigo', soRelatar: 'índice refeito pelo robô a partir do nome da pasta' },
];
const so = s => String(s == null ? '' : s).replace(/\D/g, '');
const slug = s => R.semAcento(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** O mesmo tipo do valor de antes (número ou texto). */
const comoAntes = (antes, novo) => (typeof antes === 'number' ? Number(novo) : String(novo));

/** É da empresa? Pelo CNPJ (raiz igual não basta: matriz e filiais têm códigos próprios), pelo nome inteiro ou pelo id do Cadastro. */
function daEmpresa(id, x, emp) {
  const docs = [x.cnpj, x.documento, x.cpfCnpj, x.tomador && (x.tomador.cnpj || x.tomador.documento || x.tomador.cpfCnpj || x.tomador.doc)].map(so).filter(Boolean);
  if (docs.includes(emp.cnpj)) return 'CNPJ';
  if (docs.length && docs.some(d => d.length === 14)) return null;   // tem CNPJ e é de outro
  const nomes = [x.nome, x.empresa, x.razao, x.cliente].filter(v => typeof v === 'string').map(R.chaveNome);
  if (nomes.some(n => n && emp.nomes.includes(n))) return 'nome';
  if (emp.slug && (id === emp.slug || id.startsWith(emp.slug + '_'))) return 'id do Cadastro';
  return null;
}

async function levantar(db, trocas) {
  const [cli, cad] = await Promise.all([db.collection('clientes').get(), db.collection('cadastro').get()]);
  const emps = [];
  for (const t of trocas) {
    const cs = cli.docs.filter(d => so(d.data().documento) === t.cnpj);
    if (cs.length !== 1) throw new Error('CNPJ ' + t.cnpj + ': ' + cs.length + ' clientes no Entregas (esperava 1)');
    const c = cs[0], antigo = String(c.data().codigoOrigem);
    const ns = cad.docs.filter(d => String(d.data().codigo) === antigo);
    const nome = c.data().nome;
    // no Cadastro do nads o documento é o do mesmo código E do mesmo nome (o nads não guarda CNPJ)
    const n = ns.filter(d => R.chaveNome(d.data().nome) === R.chaveNome(nome));
    if (ns.length && n.length !== 1) throw new Error('código ' + antigo + ': o Cadastro do nads não tem um documento só com o nome "' + nome + '"');
    emps.push({ cnpj: t.cnpj, novo: String(t.novo), antigo, nome, cliente: c, cadastro: n[0] || null, slug: n[0] ? n[0].id : slug(nome), nomes: [nome, c.data().nomeFantasia, n[0] && n[0].data().nome].filter(Boolean).map(R.chaveNome) });
  }
  // a troca tem de fechar: cada código novo ou está livre ou é o antigo de outra empresa da troca
  const antigos = new Set(emps.map(e => e.antigo));
  for (const e of emps) {
    const ocupado = cli.docs.filter(d => String(d.data().codigoOrigem) === e.novo && !emps.some(x => x.cliente.id === d.id));
    if (ocupado.length) throw new Error('o código ' + e.novo + ' já é de ' + ocupado.map(d => d.data().nome).join(', ') + ' (fora da troca)');
    if (!antigos.has(e.novo) && cad.docs.some(d => String(d.data().codigo) === e.novo)) throw new Error('o código ' + e.novo + ' já existe no Cadastro do nads');
  }
  const ops = [], relatar = [];
  for (const e of emps) {
    ops.push({ col: 'clientes', id: e.cliente.id, campo: 'codigoOrigem', antes: e.cliente.data().codigoOrigem, depois: comoAntes(e.cliente.data().codigoOrigem, e.novo), empresa: e.nome, extra: { codigoAnterior: String(e.antigo) } });
    if (e.cadastro) ops.push({ col: 'cadastro', id: e.cadastro.id, campo: 'codigo', antes: e.cadastro.data().codigo, depois: comoAntes(e.cadastro.data().codigo, e.novo), empresa: e.nome, historico: true });
  }
  for (const dep of DEPENDENTES) {
    for (const e of emps) {
      const snap = await db.collection(dep.col).where(dep.campo, 'in', [Number(e.antigo), String(e.antigo)]).get();
      for (const d of snap.docs) {
        const x = d.data();
        const porque = daEmpresa(d.id, x, e);
        const linha = { col: dep.col, id: d.id, campo: dep.campo, antes: x[dep.campo], depois: comoAntes(x[dep.campo], e.novo), empresa: e.nome, porque };
        if (dep.soRelatar) relatar.push(Object.assign(linha, { motivo: dep.soRelatar }));
        else if (!porque) relatar.push(Object.assign(linha, { motivo: 'não deu para confirmar que é da ' + e.nome + ': não mexo' }));
        else ops.push(linha);
      }
    }
  }
  return { emps: emps.map(e => ({ cnpj: e.cnpj, nome: e.nome, antigo: e.antigo, novo: e.novo, cliente: e.cliente.id, cadastro: e.cadastro && e.cadastro.id })), ops, relatar };
}

async function gravar(db, ops, quem, desfazer) {
  const { FieldValue } = require('firebase-admin/firestore');
  const agora = new Date().toISOString();
  const lote = db.batch();
  for (const o of ops) {
    const ref = db.collection(o.col).doc(o.id);
    const mud = { [o.campo]: desfazer ? o.antes : o.depois };
    if (o.extra && !desfazer) Object.assign(mud, o.extra, { codigoTrocadoEm: agora });
    if (o.extra && desfazer) Object.assign(mud, { codigoAnterior: FieldValue.delete(), codigoTrocadoEm: FieldValue.delete() });
    if (o.historico) Object.assign(mud, { atualizadoEm: agora, historico: FieldValue.arrayUnion({ ts: agora, por: quem, acao: desfazer ? 'Troca de código desfeita' : 'Código trocado', detalhe: (desfazer ? o.depois + ' → ' + o.antes : o.antes + ' → ' + o.depois) + ' (Vitor, 23/10/2026: troca ZELO × AAP)' }) });
    lote.update(ref, mud);
  }
  await lote.commit();
  // confere: relê cada um
  const erros = [];
  for (const o of ops) { const d = await db.collection(o.col).doc(o.id).get(); const v = d.data()[o.campo]; const esperado = desfazer ? o.antes : o.depois; if (v !== esperado) erros.push(o.col + '/' + o.id + ': ' + JSON.stringify(v) + ' ≠ ' + JSON.stringify(esperado)); }
  return erros;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const valores = k => a.flatMap((x, i) => (x === k ? [a[i + 1]] : []));
  const db = require('./firestore-client').getDb('entregas-2e5e2');
  const gravarDeVerdade = a.includes('--gravar') && a.includes('--confirmo');
  (async () => {
    const arqDesfazer = valores('--desfazer')[0];
    if (arqDesfazer) {
      const d = JSON.parse(fs.readFileSync(arqDesfazer, 'utf8'));
      console.log('desfazer ' + d.ops.length + ' mudanças de ' + d.em);
      for (const o of d.ops) console.log('  ' + o.col + '/' + o.id + ' ' + o.campo + ': ' + JSON.stringify(o.depois) + ' → ' + JSON.stringify(o.antes));
      if (!gravarDeVerdade) { console.log('(simulação: nada gravado)'); process.exit(0); }
      const erros = await gravar(db, d.ops, 'arquivador (troca de código)', true);
      console.log(erros.length ? 'ERROS: ' + erros.join('; ') : 'desfeito e conferido');
      process.exit(erros.length ? 1 : 0);
    }
    const trocas = valores('--troca').map(t => { const [cnpj, novo] = t.split('='); return { cnpj: so(cnpj), novo: String(+novo) }; });
    if (!trocas.length) throw new Error('uso: --troca <CNPJ>=<código novo> (uma por empresa)');
    const lev = await levantar(db, trocas);
    console.log('empresas:'); for (const e of lev.emps) console.log('  ' + e.nome + ' (' + e.cnpj + '): ' + e.antigo + ' → ' + e.novo + '  [clientes/' + e.cliente + ', cadastro/' + e.cadastro + ']');
    console.log('mudanças (' + lev.ops.length + '):'); for (const o of lev.ops) console.log('  ' + (o.col + '/' + o.id).padEnd(60) + ' ' + o.campo + ': ' + JSON.stringify(o.antes) + ' → ' + JSON.stringify(o.depois) + (o.porque ? '  (da empresa pelo ' + o.porque + ')' : ''));
    console.log('não mexo (' + lev.relatar.length + '):'); for (const o of lev.relatar) console.log('  ' + (o.col + '/' + o.id).padEnd(60) + ' ' + o.campo + '=' + JSON.stringify(o.antes) + ' — ' + o.motivo);
    if (!gravarDeVerdade) { console.log('(simulação: nada gravado; --gravar --confirmo grava)'); process.exit(0); }
    fs.mkdirSync(DIARIOS, { recursive: true });
    const diario = path.join(DIARIOS, 'troca-codigo-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(diario, JSON.stringify({ em: new Date().toISOString(), emps: lev.emps, ops: lev.ops, relatar: lev.relatar }, null, 1));
    console.log('diário (para desfazer): ' + diario);
    const erros = await gravar(db, lev.ops, 'arquivador (troca de código)', false);
    console.log(erros.length ? 'ERROS: ' + erros.join('; ') : 'gravado e conferido: ' + lev.ops.length + ' documentos');
    process.exit(erros.length ? 1 : 0);
  })().catch(e => { console.error('PAREI: ' + e.message); process.exit(1); });
}

module.exports = { levantar, daEmpresa };
