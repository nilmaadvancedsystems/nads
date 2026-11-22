#!/usr/bin/env node
// As tabelas oficiais da Reforma Tributária (22/11/2026: "termina resto" — a fase 2 das calculadoras da Receita): o CST, o
// cClassTrib, as alíquotas de referência e as atividades do Simples, tiradas do banco SQLite da calculadora oficial
// (ReceitaFederal/calculadora-rtc-regime-regular, MIT; dados públicos). Sai em packages/core/src/reforma/tabelas.json,
// que vai para o repositório: o site e o robô leem dele, sem precisar da calculadora no ar.
//
//   node scripts/tabelas-rtc.mjs <caminho do calculadora-pro.db>
//
// O banco fica na pasta da calculadora instalada (D:\nads-rtc\regime-regular\calculadora\db\calculadora-pro.db no
// servidor; o robo/calculadoras-rtc/instalar.ps1 gera). Quando a Receita publicar uma versão nova da calculadora (o
// instalar.ps1 com a versão nova), rode de novo e commite o JSON.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const banco = process.argv[2];
if (!banco) { console.error('uso: node scripts/tabelas-rtc.mjs <caminho do calculadora-pro.db>'); process.exit(2); }
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'packages', 'core', 'src', 'reforma', 'tabelas.json');
const db = new DatabaseSync(banco, { readOnly: true });
const todas = sql => db.prepare(sql).all();
const sim = v => Number(v) === 1;
const texto = v => (v == null ? '' : String(v).replace(/\\n/g, '\n').trim());

const versao = db.prepare('select * from VERSAO_BASE_DADO order by VRBD_ID desc limit 1').get() || {};
const tributos = new Map(todas('select TBTO_ID, TBTO_SIGLA from TRIBUTO').map(r => [r.TBTO_ID, r.TBTO_SIGLA]));

// só os CST do IBS e da CBS (a tabela também tem os do Imposto Seletivo, com os mesmos códigos)
const cst = todas('select * from SITUACAO_TRIBUTARIA where SITR_ID in (select TRST_SITR_ID from TRIBUTO_SITUACAO_TRIBUTARIA where TRST_TBTO_ID in (2, 3, 4)) order by SITR_CD, SITR_INICIO_VIGENCIA').map(r => ({
  codigo: r.SITR_CD, descricao: texto(r.SITR_DESCRICAO), inicio: r.SITR_INICIO_VIGENCIA, fim: r.SITR_FIM_VIGENCIA || null,
  grupos: Object.fromEntries([['gIBSCBS', r.SITR_IND_GIBSCBS], ['gIBSCBSMono', r.SITR_IND_GIBSCBSMONO], ['gRed', r.SITR_IND_GRED], ['gDif', r.SITR_IND_GDIF],
    ['gTransfCred', r.SITR_IND_GTRANSFCRED], ['gCredPresIBSZFM', r.SITR_IND_GCREDPRESIBSZFM], ['gAjusteCompet', r.SITR_IND_GAJUSTECOMPET]].filter(([, v]) => sim(v)).map(([k]) => [k, true])),
}));
const cstPorId = new Map(todas('select SITR_ID, SITR_CD from SITUACAO_TRIBUTARIA').map(r => [r.SITR_ID, r.SITR_CD]));

// a redução vigente de cada classificação, por tributo (CBS, IBSUF, IBSMun)
const reducoes = new Map();
for (const r of todas('select * from PERCENTUAL_REDUCAO where PERE_FIM_VIGENCIA is null order by PERE_INICIO_VIGENCIA')) {
  const sigla = tributos.get(r.PERE_TBTO_ID);
  if (!sigla) continue;
  if (!reducoes.has(r.PERE_CLTR_ID)) reducoes.set(r.PERE_CLTR_ID, {});
  reducoes.get(r.PERE_CLTR_ID)[sigla] = Number(r.PERE_VALOR) || 0;
}
// a fundamentação (o texto curto: "LC 214/2025", "Art. 11, VIII")
const fundamentos = new Map();
for (const r of todas('select c.FDCL_CLTR_ID id, l.FDLG_TEXTO_CURTO curto from FUNDAMENTACAO_CLASSIFICACAO c join FUNDAMENTACAO_LEGAL l on l.FDLG_ID = c.FDCL_FDLG_ID where c.FDCL_FIM_VIGENCIA is null')) {
  if (!fundamentos.has(r.id)) fundamentos.set(r.id, []);
  if (r.curto && !fundamentos.get(r.id).includes(texto(r.curto))) fundamentos.get(r.id).push(texto(r.curto));
}

const cClassTrib = todas('select * from CLASSIFICACAO_TRIBUTARIA order by CLTR_CD, CLTR_INICIO_VIGENCIA').map(r => ({
  codigo: r.CLTR_CD, descricao: texto(r.CLTR_DESCRICAO), cst: cstPorId.get(r.CLTR_SITR_ID) || r.CLTR_CD.slice(0, 3),
  tipoAliquota: texto(r.CLTR_TIPO_ALIQUOTA), nomenclatura: texto(r.CLTR_NOMENCLATURA),
  reducao: reducoes.get(r.CLTR_ID) || {},
  creditoAdquirente: { CBS: sim(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_CBS), IBS: sim(r.CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_IBS) },
  creditoPresumidoFornecedor: sim(r.CLTR_IN_CREDITO_PRESUMIDO_FORNECEDOR), creditoPresumidoAdquirente: sim(r.CLTR_IN_CREDITO_PRESUMIDO_ADQUIRENTE),
  creditoOperacaoAntecedente: texto(r.CLTR_CREDITO_OPERACAO_ANTECEDENTE),
  // só os anexos da LC 214 (1 a 99): a coluna também traz códigos internos de 5 dígitos (90111, 81641...)
  anexo: /^\d{1,2}$/.test(String(r.CLTR_ANEXO ?? '')) ? String(r.CLTR_ANEXO) : '',
  fundamentacao: fundamentos.get(r.CLTR_ID) || [],
  inicio: r.CLTR_INICIO_VIGENCIA, fim: r.CLTR_FIM_VIGENCIA || null,
}));

const aliquotasReferencia = todas('select * from ALIQUOTA_REFERENCIA order by ALRE_INICIO_VIGENCIA, ALRE_TBTO_ID').map(r => ({
  tributo: tributos.get(r.ALRE_TBTO_ID) || String(r.ALRE_TBTO_ID), valor: Number(r.ALRE_VALOR), inicio: r.ALRE_INICIO_VIGENCIA, fim: r.ALRE_FIM_VIGENCIA || null,
}));

const atividadesSimples = todas('select * from ATIVIDADE_SIMPLES_NACIONAL order by ATSN_ORDEM').map(r => ({
  codigo: r.ATSN_CATIVSN, descricao: texto(r.ATSN_DESCRICAO), anexo: r.ATSN_ANEXO_SEM_FATOR_R || '', anexoComFatorR: r.ATSN_ANEXO_COM_FATOR_R || '',
  rotulo: texto(r.ATSN_ROTULO), naoTributavel: sim(r.ATSN_IN_NAO_TRIBUTAVEL), issNoSimples: sim(r.ATSN_IN_ISS_NO_SIMPLES),
  inicio: r.ATSN_INICIO_VIGENCIA, fim: r.ATSN_FIM_VIGENCIA || null,
}));

const saida = {
  fonte: 'ReceitaFederal/calculadora-rtc-regime-regular (MIT), banco ' + versao.VRBD_VERSAO_BASE_DADO + ' de ' + String(versao.VRBD_DATA || '').slice(0, 10),
  versaoDoBanco: versao.VRBD_VERSAO_BASE_DADO || '', descricaoDoBanco: texto(versao.VRBD_DESCRICAO),
  cst, cClassTrib, aliquotasReferencia, atividadesSimples,
};
// um registro por linha: o diff de uma versão nova da Receita mostra só o que mudou
const lista = v => (Array.isArray(v) ? '[\n' + v.map(x => '  ' + JSON.stringify(x)).join(',\n') + '\n ]' : JSON.stringify(v));
writeFileSync(SAIDA, '{\n' + Object.entries(saida).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + lista(v)).join(',\n') + '\n}\n');
console.log('packages/core/src/reforma/tabelas.json: ' + cst.length + ' CST, ' + cClassTrib.length + ' cClassTrib, ' + aliquotasReferencia.length + ' alíquotas de referência, '
  + atividadesSimples.length + ' atividades do Simples (' + saida.fonte + ')');
