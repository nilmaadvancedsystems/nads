// A decisão do admin para um arquivo que ficou em "Para resolver" (Vitor, 23/10/2026: "coloca um botão para abrir o
// arquivo direto daqui e selecionar para onde vai também"). O admin escolhe o CLIENTE, o TIPO e a competência no site;
// aqui sai a decisão no mesmo formato das regras, para o MESMO executor (arquivador-novo.executar → aplicar: copia,
// confere o hash, nunca sobrescreve, registra no manifesto e tira o original para a quarentena).
//
// Como o destino sai (sem montar caminho na mão):
//   1. as regras de sempre (R.decidir), com o cliente dado como confirmado pelo responsável (como os "arquivos
//      confirmados" do 03, pelo hash): quando elas chegam ao mesmo cliente e ao tipo escolhido, vale o nome que elas dão
//      (DARF com o tributo, o valor e o vencimento; extrato com o banco…), e a confiança da leitura (OCR) não segura mais;
//   2. senão, o destino do tipo escolhido pela mesma árvore do Dicionário (R.finalizar: a pasta do regime, a pasta do
//      cliente, o nome seguro), com a competência que o admin deu e o nome original do arquivo onde a regra precisaria de
//      um dado que não foi lido.
// O descarte vai para a quarentena (nunca apagado), como os descartes confirmados das regras.
'use strict';
const path = require('path');
const R = require('./arquivador-regras');

const dois = n => String(n).padStart(2, '0');
const mesAno = c => dois(c.mes) + '-' + c.ano;
const extDe = nome => ((/\.[a-z0-9]+$/i.exec(nome || '') || ['.pdf'])[0]).toLowerCase();
const baseDe = nome => String(nome || '').replace(/\.[a-z0-9]+$/i, '');
const textoDe = entrada => (Array.isArray(entrada.texto) ? entrada.texto.slice(0, 3).join('\n') : String(entrada.texto || entrada.ofx || entrada.txt || ''));
/** o banco do extrato/comprovante: pelo conteúdo (fora das linhas de lançamento) ou pelo nome do arquivo, como as regras */
const bancoDe = entrada => R.bancoDoTexto(textoDe(entrada), true) || R.bancoDoNome(entrada.nome || '');

/** A nota: o PDF em DOCUMENTOS FISCAIS\<lado>; o XML na pasta XML do modelo (o nome que o XML já traz, como as regras). */
function nota({ comp, ext, base, nome, entrada }, lado) {
  if (ext === '.xml') {
    let info = {};
    try { info = R.classificarXml(entrada.xml) || {}; } catch (e) { info = {}; }
    return { fiscal: ['XML', info.tipo && !info.erro ? info.tipo : 'NF-e'].concat(info.sub && !info.erro ? [info.sub] : []), nomeFinal: info.nome || nome };
  }
  return { fiscal: ['DOCS', lado], nomeFinal: mesAno(comp) + ' - ' + base + ext };
}

/**
 * Os tipos que o admin escolhe (a lista vai para o site). precisa: 'mes' (MM/AAAA), 'ano' (AAAA) ou null. aceita: os tipos
 * das regras que contam como este (passo 1). montar: o destino do passo 2 ({ fiscal } ou { caminho }, e o nome final), ou
 * { erro } quando falta um dado que só o arquivo traria.
 */
const TIPOS = [
  { id: 'AUTO', rotulo: 'Pelo conteúdo (o robô escolhe o tipo)', precisa: null, aceita: /./, montar: () => ({ erro: 'as regras não acharam o tipo deste arquivo: escolha o tipo' }) },
  { id: 'DAS', rotulo: 'DAS (Simples Nacional)', precisa: 'mes', aceita: /^DAS$/, setor: 'FISCAL', montar: ({ comp, ext }) => ({ fiscal: ['DAS'], nomeFinal: mesAno(comp) + ext }) },
  { id: 'DARF', rotulo: 'DARF (Receita Federal)', precisa: 'mes', aceita: /^DARF$/, setor: 'FISCAL', montar: ({ comp, ext, base }) => ({ fiscal: ['DARF'], nomeFinal: mesAno(comp) + ' - DARF - ' + base + ext }) },
  { id: 'DAE', rotulo: 'DAE (estadual)', precisa: 'mes', aceita: /^DAE$/, setor: 'FISCAL', montar: ({ comp, ext, base }) => ({ fiscal: ['DAE'], nomeFinal: mesAno(comp) + ' - DAE - ' + base + ext }) },
  { id: 'DAM', rotulo: 'DAM (municipal)', precisa: 'mes', aceita: /^DAM$/, setor: 'FISCAL', montar: ({ comp, ext, base }) => ({ fiscal: ['DAM'], nomeFinal: mesAno(comp) + ' - DAM - ' + base + ext }) },
  { id: 'FGTS', rotulo: 'FGTS', precisa: 'mes', aceita: /^FGTS$/, setor: 'FOLHA_SOCIETARIO', montar: ({ comp, ext }) => ({ caminho: ['SOCIETÁRIO', 'IMPOSTOS', 'FGTS', String(comp.ano)], nomeFinal: mesAno(comp) + ext }) },
  { id: 'NOTA_RECEBIDA', rotulo: 'Nota fiscal recebida (NF-e, NFS-e, CT-e)', precisa: 'mes', aceita: /^(NF-e|NFS-e|CT-e) PDF$|^XML (NF-e|NFS-e|CT-e)/, setor: 'FISCAL', montar: a => nota(a, 'RECEBIDOS') },
  { id: 'NOTA_EMITIDA', rotulo: 'Nota fiscal emitida (NF-e, NFS-e, NFC-e)', precisa: 'mes', aceita: /^(NF-e|NFS-e|NFC-e) PDF$|^XML (NF-e|NFS-e|NFC-e)/, setor: 'FISCAL', montar: a => nota(a, 'EMITIDOS') },
  { id: 'EXTRATO', rotulo: 'Extrato bancário', precisa: 'mes', aceita: /^EXTRATO/, setor: 'CONTABIL', montar: ({ comp, ext, entrada }) => { const b = bancoDe(entrada); return b ? { caminho: ['CONTÁBIL', 'EXTRATOS', String(comp.ano), dois(comp.mes), 'BANCÁRIOS', b], nomeFinal: mesAno(comp) + ext } : { erro: 'o banco não foi lido: ponha o nome do banco no nome do arquivo ou escolha "Outros documentos"' }; } },
  { id: 'COMPROVANTE', rotulo: 'Comprovante de pagamento', precisa: 'mes', aceita: /^COMPROVANTE$/, setor: 'CONTABIL', montar: ({ comp, ext, entrada }) => { const b = bancoDe(entrada); return b ? { caminho: ['CONTÁBIL', 'EXTRATOS', String(comp.ano), dois(comp.mes), 'COMPROVANTES', b], nomeFinal: 'Comprovantes ' + mesAno(comp) + ext } : { erro: 'o banco não foi lido: ponha o nome do banco no nome do arquivo ou escolha "Outros documentos"' }; } },
  { id: 'FOLHA', rotulo: 'Folha de pagamento', precisa: 'mes', aceita: /^FOLHA$/, setor: 'FOLHA_SOCIETARIO', montar: ({ comp, nome }) => ({ caminho: ['SOCIETÁRIO', 'FOLHA DE PAGAMENTO', String(comp.ano), dois(comp.mes)], nomeFinal: nome }) },
  { id: 'DEFIS', rotulo: 'DEFIS', precisa: 'ano', aceita: /^DEFIS$/, setor: 'FISCAL', montar: ({ comp, ext }) => ({ caminho: ['FISCAL', 'SIMPLES NACIONAL', '14. DEFIS'], nomeFinal: comp.ano + ' - DEFIS' + ext }) },
  { id: 'DIRF', rotulo: 'DIRF', precisa: 'ano', aceita: /^DIRF$/, setor: 'FISCAL', montar: ({ comp, ext }) => ({ fiscal: ['DIRF'], nomeFinal: comp.ano + ' - DIRF' + ext }) },
  { id: 'ECF', rotulo: 'ECF', precisa: 'ano', aceita: /^ECF$/, setor: 'FISCAL', montar: ({ comp, ext }) => ({ fiscal: ['ECF'], nomeFinal: comp.ano + ' - ECF' + ext }) },
  { id: 'BALANCETE', rotulo: 'Balancete e livros contábeis', precisa: 'ano', aceita: /^BALANCETE$/, setor: 'CONTABIL', montar: ({ comp, nome }) => ({ caminho: ['CONTÁBIL', 'REGISTRO DE LIVROS', '(001) ' + comp.ano], nomeFinal: nome }) },
  { id: 'DOC_CONSTITUTIVO', rotulo: 'Contrato social e documentos constitutivos', precisa: null, aceita: /^(DOC CONSTITUTIVO|CARTAO CNPJ)$/, setor: 'FOLHA_SOCIETARIO', montar: ({ nome }) => ({ caminho: ['SOCIETÁRIO', 'DOCUMENTOS CONSTITUTIVOS'], nomeFinal: nome }) },
  { id: 'OUTROS', rotulo: 'Outros documentos (contábil)', precisa: 'ano', aceita: /^OUTROS DOCUMENTOS$/, setor: 'CONTABIL', montar: ({ comp, nome }) => ({ caminho: ['CONTÁBIL', 'OUTROS DOCUMENTOS', String(comp.ano)], nomeFinal: nome }) },
];
const PORID = new Map(TIPOS.map(t => [t.id, t]));
/** A lista que vai para o site (o formulário "Arquivar em…"). */
function tiposDoFormulario() { return TIPOS.map(t => ({ id: t.id, rotulo: t.rotulo, precisa: t.precisa })); }

/** "2026-01" → { mes: 1, ano: 2026 }; "2026" → { ano: 2026 }; o resto → null. */
function lerCompetencia(c) {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(String(c || '').trim());
  if (!m) return null;
  const ano = +m[1], mes = m[2] ? +m[2] : null;
  if (ano < 2000 || ano > 2100 || (mes != null && (mes < 1 || mes > 12))) return null;
  return mes ? { mes, ano } : { ano };
}

const ni = (motivo, evidencia, extra) => Object.assign({ acao: 'NAO_IDENTIFICADO', motivo, confianca: 0, evidencias: [evidencia] }, extra || {});

/**
 * A decisão do admin. escolha: { descartar?, codigo, tipoDoc, competencia ('AAAA-MM' ou 'AAAA'), por (o nome de quem
 * decidiu) }. Devolve a decisão no formato de R.decidir (com decididoPor), já finalizada (destinoRelativo, nomeFinal,
 * pastaCliente, criarPastaCliente) — ou NAO_IDENTIFICADO com o motivo do que faltou.
 */
function decidirManual(entrada, ctx, escolha) {
  const e = escolha || {};
  const por = String(e.por || 'admin').slice(0, 80);
  if (e.descartar) return { acao: 'DESCARTAR', motivo: 'DESCARTADO_PELO_ADMIN', confianca: 1, tipo: 'DESCARTE', decididoPor: por, evidencias: ['descartado por ' + por + ' no nads: vai para a quarentena, nunca é apagado direto'] };
  const codigo = Number(e.codigo);
  const cli = Number.isInteger(codigo) ? ctx.cadastro.porCod.get(codigo) : null;
  if (!cli) return ni('CLIENTE_NAO_LOCALIZADO', 'o código ' + (e.codigo == null ? '(vazio)' : e.codigo) + ' não está no cadastro do arquivador', { decididoPor: por });
  const tipo = PORID.get(String(e.tipoDoc || 'AUTO'));
  if (!tipo) return ni('TIPO_NAO_RECONHECIDO', 'tipo "' + e.tipoDoc + '" fora da lista', { decididoPor: por, cliente: codigo });
  const comp = lerCompetencia(e.competencia);
  if (tipo.precisa === 'mes' && !(comp && comp.mes)) return ni('COMPETENCIA_AUSENTE', 'o tipo ' + tipo.rotulo + ' precisa do mês (MM/AAAA)', { decididoPor: por, cliente: codigo });
  if (tipo.precisa === 'ano' && !comp) return ni('COMPETENCIA_AUSENTE', 'o tipo ' + tipo.rotulo + ' precisa do ano', { decididoPor: por, cliente: codigo });
  const quem = 'decidido por ' + por + ' no nads: ' + cli.codigo + ' - ' + cli.razao + ' · ' + tipo.rotulo + (comp ? ' · ' + (comp.mes ? mesAno(comp) : comp.ano) : '');

  // 1. as regras, com o cliente confirmado pelo admin (como os arquivos confirmados pelo responsável, pelo hash)
  const confirmados = new Map(ctx.confirmados || []);
  if (entrada.hash) confirmados.set(entrada.hash, cli.codigo);
  let d1 = null;
  try { d1 = R.decidir(entrada, Object.assign({}, ctx, { confirmados })); } catch (err) { d1 = null; }
  const chegou = d1 && (d1.acao === 'ARQUIVAR' || (d1.motivo === 'CONFIANCA_ABAIXO_DO_LIMIAR' && d1.destinoRelativo && d1.nomeFinal));
  const mesmaComp = !comp || !d1 || !d1.competencia || (d1.competencia.ano === comp.ano && (!comp.mes || d1.competencia.mes === comp.mes));
  if (chegou && Number(d1.cliente) === cli.codigo && tipo.aceita.test(String(d1.tipo || '')) && mesmaComp) {
    return Object.assign(d1, { acao: 'ARQUIVAR', motivo: null, confianca: 1, decididoPor: por, destinoSugerido: null, evidencias: (d1.evidencias || []).concat(quem + ' (o nome saiu das regras)') });
  }
  if (tipo.id === 'AUTO') {
    const porque = d1 && Number(d1.cliente) === cli.codigo && d1.acao === 'ARQUIVAR' ? '' : d1 ? ' (' + (d1.motivo || d1.acao) + ')' : '';
    return ni(d1 && d1.motivo ? d1.motivo : 'TIPO_NAO_RECONHECIDO', 'as regras não chegaram a um destino para este cliente' + porque + ': escolha o tipo', { decididoPor: por, cliente: codigo });
  }

  // 2. o destino do tipo escolhido, pela mesma árvore do Dicionário (R.finalizar: o regime, a pasta do cliente, o nome seguro)
  const nome = entrada.nome || path.basename(String(entrada.rel || 'arquivo'));
  const b = tipo.montar({ comp, ext: extDe(nome), base: baseDe(nome), nome, entrada });
  if (b.erro) return ni('VOCABULARIO_AUSENTE', b.erro, { decididoPor: por, cliente: codigo, tipo: tipo.id });
  const d2 = R.finalizar(Object.assign({ acao: 'ARQUIVAR', cliente: cli.codigo, comoCliente: 'hash', confianca: 1, tipo: tipo.id === 'NOTA_RECEBIDA' || tipo.id === 'NOTA_EMITIDA' ? 'NOTA PDF' : tipo.id.replace(/_/g, ' '), setor: tipo.setor,
    competencia: comp, nomeOriginal: nome, decididoPor: por, evidencias: [quem + ' (o destino do tipo pela árvore do Dicionário)'], fonte: 'decisão do admin no nads' }, b), ctx);
  d2.decididoPor = por;
  return d2;
}

module.exports = { decidirManual, tiposDoFormulario, lerCompetencia, TIPOS };
