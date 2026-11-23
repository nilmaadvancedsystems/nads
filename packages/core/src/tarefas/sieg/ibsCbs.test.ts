import { describe, expect, it } from 'vitest';
import { conferirNota, lerConferenciaIbsCbs, notaParaConferir, resumoDaConferencia, ufDoMunicipio, type NotaConferida, type RespostaDaCalculadora } from './ibsCbs';

// dados de mentira (o repositório é público)
const CLIENTE = '12345678000195';
const OUTRO = '98765432000110';
const CHAVE = '31' + '2610' + CLIENTE + '55' + '001' + '000000123' + '1' + '12345678' + '9';

const grupo = (cst: string, cClass: string, vBC: string, uf: [string, string], mun: [string, string], vIBS: string, cbs: [string, string]) =>
  `<IBSCBS><CST>${cst}</CST><cClassTrib>${cClass}</cClassTrib><gIBSCBS><vBC>${vBC}</vBC>`
  + `<gIBSUF><pIBSUF>${uf[0]}</pIBSUF><vIBSUF>${uf[1]}</vIBSUF></gIBSUF><gIBSMun><pIBSMun>${mun[0]}</pIBSMun><vIBSMun>${mun[1]}</vIBSMun></gIBSMun>`
  + `<vIBS>${vIBS}</vIBS><gCBS><pCBS>${cbs[0]}</pCBS><vCBS>${cbs[1]}</vCBS></gCBS></gIBSCBS></IBSCBS>`;

function nfe({ chave = CHAVE, dhEmi = '2026-10-05T10:00:00-03:00', emit = CLIENTE, dest = OUTRO, crt = '3', itens = [
  { vProd: '100.00', ncm: '10063021', ibscbs: grupo('000', '000001', '100.00', ['0.1000', '0.10'], ['0.0000', '0.00'], '0.10', ['0.9000', '0.90']) },
  { vProd: '200.00', ncm: '10063021', ibscbs: grupo('200', '200003', '200.00', ['0.1000', '0.20'], ['0.0000', '0.00'], '0.20', ['0.9000', '1.80']) },
], total = '<IBSCBSTot><vBCIBSCBS>300.00</vBCIBSCBS><gIBS><vIBS>0.30</vIBS></gIBS><gCBS><vCBS>2.70</vCBS></gCBS></IBSCBSTot>' } = {}) {
  const dets = itens.map((it, i) => `<det nItem="${i + 1}"><prod><cProd>${i + 1}</cProd><xProd>ARROZ ${i + 1}</xProd><NCM>${it.ncm}</NCM><CFOP>5102</CFOP><uCom>KG</uCom><qCom>10.0000</qCom><vProd>${it.vProd}</vProd><vDesc>0.00</vDesc></prod>`
    + `<imposto><ICMS><ICMS00><CST>00</CST><vBC>${it.vProd}</vBC><pICMS>18.00</pICMS><vICMS>18.00</vICMS></ICMS00></ICMS><PIS><PISAliq><CST>01</CST><vPIS>0.65</vPIS></PISAliq></PIS><COFINS><COFINSAliq><CST>01</CST><vCOFINS>3.00</vCOFINS></COFINSAliq></COFINS>${it.ibscbs}</imposto></det>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00">`
    + `<ide><cUF>31</cUF><mod>${chave.slice(20, 22)}</mod><serie>1</serie><nNF>123</nNF><dhEmi>${dhEmi}</dhEmi><cMunFG>3106200</cMunFG></ide>`
    + `<emit><CNPJ>${emit}</CNPJ><xNome>EMPRESA EMITENTE LTDA</xNome><CRT>${crt}</CRT></emit>` + (dest ? `<dest><CNPJ>${dest}</CNPJ><xNome>CLIENTE DESTINO LTDA</xNome></dest>` : '')
    + dets + `<total><ICMSTot><vNF>300.00</vNF></ICMSTot>${total}</total></infNFe></NFe></nfeProc>`;
}

const ibscbs = (cst: string, cClass: string, g: Record<string, unknown> | null) => ({ IBSCBS: { CST: cst, cClassTrib: cClass, ...(g ? { gIBSCBS: g } : {}) } });
const valores = (vBC: string, uf: string, mun: string, cbs: string, red?: { uf: string; mun: string; cbs: string }) => ({
  vBC,
  gIBSUF: { pIBSUF: '0.10', ...(red ? { gRed: { pRedAliq: '100.00', pAliqEfet: red.uf } } : {}), vIBSUF: uf },
  gIBSMun: { pIBSMun: '0.00', ...(red ? { gRed: { pRedAliq: '100.00', pAliqEfet: red.mun } } : {}), vIBSMun: mun },
  vIBS: (Number(uf) + Number(mun)).toFixed(2),
  gCBS: { pCBS: '0.90', ...(red ? { gRed: { pRedAliq: '100.00', pAliqEfet: red.cbs } } : {}), vCBS: cbs },
});

/** a resposta de exemplo da calculadora (o formato de docs/exemplos.md do regime regular) */
const RESPOSTA: RespostaDaCalculadora = {
  objetos: [
    { nObj: 1, estadoItem: 'CALCULADO', tribCalc: ibscbs('000', '000001', valores('100.00', '0.10', '0.00', '0.90')) },
    { nObj: 1001, estadoItem: 'CALCULADO', tribCalc: ibscbs('000', '000001', valores('100.00', '0.10', '0.00', '0.90')) },
    // o item 2 tem redução de 100% (cesta básica): a nota destacou como se não tivesse
    { nObj: 2, estadoItem: 'CALCULADO', tribCalc: ibscbs('200', '200003', valores('200.00', '0.00', '0.00', '0.00', { uf: '0.00', mun: '0.00', cbs: '0.00' })) },
    { nObj: 1002, estadoItem: 'CALCULADO', tribCalc: ibscbs('200', '200003', valores('178.35', '0.00', '0.00', '0.00', { uf: '0.00', mun: '0.00', cbs: '0.00' })) },
  ],
};

describe('a leitura da NF-e para a calculadora', () => {
  it('a nota emitida pelo cliente: a operação com cada item duas vezes (os valores e a base pelos componentes)', () => {
    const n = notaParaConferir(nfe(), CLIENTE)!;
    expect(n).toMatchObject({ chave: CHAVE, numero: '123', tipo: 'NF-e', data: '05/10/2026', lado: 'emitida', nome: 'CLIENTE DESTINO LTDA', crt: '3', tipoXml: 'nfe', total: { vIBS: 0.3, vCBS: 2.7 } });
    expect(n.operacao).toMatchObject({ id: CHAVE, dhFatoGerador: '2026-10-05T10:00:00-03:00', municipio: 3106200, uf: 'MG', tpDoc: 55 });
    expect(n.operacao!.itens.map(i => i.numero)).toEqual([1, 1001, 2, 1002]);
    expect(n.operacao!.itens[0]).toEqual({ numero: 1, ncm: '10063021', cst: '000', cClassTrib: '000001', quantidade: 10, unidade: 'KG', baseCalculo: 100 });
    expect(n.operacao!.itens[1]).toEqual({ numero: 1001, ncm: '10063021', cst: '000', cClassTrib: '000001', quantidade: 10, unidade: 'KG', gComponentesBC: { vProd: 100, vPIS: 0.65, vCOFINS: 3, vICMS: 18 } });
    // em 2026 as alíquotas nominais são proibidas
    expect(n.operacao!.itens.some(i => i.aliquotasNominais)).toBe(false);
  });

  it('o recorte para validar no XSD: só os grupos de tributação, no namespace da NF-e', () => {
    const { grupoXml } = notaParaConferir(nfe(), CLIENTE)!;
    expect(grupoXml.startsWith('<infNFe xmlns="http://www.portalfiscal.inf.br/nfe"><det nItem="1"><imposto><IBSCBS><CST>000</CST>')).toBe(true);
    expect(grupoXml).toContain('<det nItem="2"><imposto><IBSCBS>');
    expect(grupoXml).not.toContain('ICMS00');
    expect(grupoXml.endsWith('<total><IBSCBSTot><vBCIBSCBS>300.00</vBCIBSCBS><gIBS><vIBS>0.30</vIBS></gIBS><gCBS><vCBS>2.70</vCBS></gCBS></IBSCBSTot></total></infNFe>')).toBe(true);
  });

  it('a recebida, a NFC-e, a de antes de 2026 e a de outra empresa', () => {
    expect(notaParaConferir(nfe({ emit: OUTRO, dest: CLIENTE }), CLIENTE)).toMatchObject({ lado: 'recebida', nome: 'EMPRESA EMITENTE LTDA' });
    const nfce = CHAVE.slice(0, 20) + '65' + CHAVE.slice(22);
    expect(notaParaConferir(nfe({ chave: nfce, dest: '' }), CLIENTE)).toMatchObject({ tipo: 'NFC-e', tipoXml: 'nfce', nome: 'Consumidor' });
    expect(notaParaConferir(nfe({ dhEmi: '2025-12-31T23:00:00-03:00' }), CLIENTE)).toBeNull();
    expect(notaParaConferir(nfe(), '11222333000181')).toBeNull();
    expect(notaParaConferir('<cteProc/>', CLIENTE)).toBeNull();
  });

  it('a partir de 2027 as alíquotas nominais vão da própria nota', () => {
    const n = notaParaConferir(nfe({ dhEmi: '2027-02-01T09:00:00-03:00' }), CLIENTE)!;
    expect(n.operacao!.itens[0].aliquotasNominais).toEqual({ cbs: 0.9, ibsEstadual: 0.1, ibsMunicipal: 0 });
  });

  it('o código do município dá a UF', () => {
    expect(ufDoMunicipio('3205309')).toBe('ES');
    expect(ufDoMunicipio('5300108')).toBe('DF');
    expect(ufDoMunicipio('')).toBe('');
  });
});

describe('a nota x a calculadora', () => {
  it('o item certo passa; o da redução não aplicada mostra cada campo e o total; a base de 2026 fica só no aviso', () => {
    const n = notaParaConferir(nfe(), CLIENTE)!;
    const r = conferirNota(n, RESPOSTA, { valido: true });
    expect(r.situacao).toBe('divergente');
    expect(r.divergencias.filter(d => d.item === 1)).toEqual([]);
    expect(r.divergencias).toContainEqual({ item: 2, campo: 'alíquota efetiva do IBS da UF (redução)', naNota: 'sem redução', calculadora: '0,00%' });
    expect(r.divergencias).toContainEqual({ item: 2, campo: 'IBS da UF', naNota: '0,20', calculadora: '0,00' });
    expect(r.divergencias).toContainEqual({ item: 2, campo: 'CBS', naNota: '1,80', calculadora: '0,00' });
    // 2026: a base diferente (a calculadora tira o ICMS, o PIS e a COFINS) é aviso, não divergência
    expect(r.divergencias.some(d => d.campo === 'base de cálculo (vBC)')).toBe(false);
    expect(r.baseDiferente2026).toBe(true);
    // o total da nota bate com a soma dos itens dela
    expect(r.divergencias.some(d => d.item === 0)).toBe(false);
  });

  it('de 2027 em diante a base diferente é divergência; em 2026, a nota só com ela fica certa (com o aviso)', () => {
    const so = (dh: string) => notaParaConferir(nfe({ dhEmi: dh, itens: [{ vProd: '100.00', ncm: '10063021', ibscbs: grupo('000', '000001', '100.00', ['0.1000', '0.10'], ['0.0000', '0.00'], '0.10', ['0.9000', '0.90']) }], total: '' }), CLIENTE)!;
    const resposta = (vbc: string): RespostaDaCalculadora => ({ objetos: [RESPOSTA.objetos![0], { nObj: 1001, estadoItem: 'CALCULADO', tribCalc: ibscbs('000', '000001', valores(vbc, '0.08', '0.00', '0.71')) }] });
    expect(conferirNota(so('2026-10-05T10:00:00-03:00'), resposta('78.35'), { valido: true })).toMatchObject({ situacao: 'certa', divergencias: [], baseDiferente2026: true });
    expect(conferirNota(so('2027-02-01T10:00:00-03:00'), resposta('81.35'), { valido: true }).divergencias).toEqual([{ item: 1, campo: 'base de cálculo (vBC)', naNota: '100,00', calculadora: '81,35' }]);
  });

  it('a base recusada pela calculadora (REG-023, base negativa): aviso em 2026, divergência depois', () => {
    const so = (dh: string) => notaParaConferir(nfe({ dhEmi: dh, itens: [{ vProd: '100.00', ncm: '10063021', ibscbs: grupo('000', '000001', '100.00', ['0.1000', '0.10'], ['0.0000', '0.00'], '0.10', ['0.9000', '0.90']) }], total: '' }), CLIENTE)!;
    const recusa: RespostaDaCalculadora = { objetos: [RESPOSTA.objetos![0], { nObj: 1001, estadoItem: 'INCONSISTENCIA_ENTRADA', erros: [{ code: 'REG-023', detail: 'A base de cálculo calculada a partir dos componentes é negativa' }] }] };
    expect(conferirNota(so('2026-10-05T10:00:00-03:00'), recusa, { valido: true })).toMatchObject({ situacao: 'certa', divergencias: [], baseDiferente2026: true });
    expect(conferirNota(so('2027-02-01T10:00:00-03:00'), recusa, { valido: true }).divergencias).toEqual([
      { item: 1, campo: 'base de cálculo (vBC)', naNota: '100,00', calculadora: 'REG-023 — A base de cálculo calculada a partir dos componentes é negativa' },
    ]);
  });

  it('tudo igual (com folga de 1 centavo): certa', () => {
    const certa: RespostaDaCalculadora = { objetos: [
      RESPOSTA.objetos![0], RESPOSTA.objetos![1],
      { nObj: 2, estadoItem: 'CALCULO_SIMULADO', tribCalc: ibscbs('200', '200003', valores('200.00', '0.21', '0.00', '1.80')) },
      { nObj: 1002, estadoItem: 'CALCULADO', tribCalc: ibscbs('200', '200003', valores('200.01', '0.21', '0.00', '1.80')) },
    ] };
    const r = conferirNota(notaParaConferir(nfe(), CLIENTE)!, certa, { valido: true });
    expect(r).toMatchObject({ situacao: 'certa', divergencias: [], naoConferidos: [] });
    expect(r.baseDiferente2026).toBeUndefined();
  });

  it('o item que a calculadora recusa (NCM fora da cClassTrib), o XSD e o total que não fecha', () => {
    const recusa: RespostaDaCalculadora = { objetos: [
      { nObj: 1, estadoItem: 'INCONSISTENCIA_ENTRADA', erros: [{ code: 'REG-011', title: 'NCM não vinculada', detail: 'NCM de código 10063021 não vinculada à Classificação Tributária de código 000001 (CBS e IBS)' }] },
      RESPOSTA.objetos![2],
    ] };
    const n = notaParaConferir(nfe({ total: '<IBSCBSTot><vBCIBSCBS>300.00</vBCIBSCBS><gIBS><vIBS>0.50</vIBS></gIBS><gCBS><vCBS>2.70</vCBS></gCBS></IBSCBSTot>' }), CLIENTE)!;
    const r = conferirNota(n, recusa, { valido: false, mensagem: 'Erro na linha 1, coluna 80: cvc-complex-type.2.4.a' });
    expect(r.divergencias).toContainEqual({ item: 1, campo: 'CST / cClassTrib / NCM', naNota: '000 / 000001 / NCM 10063021', calculadora: 'REG-011 — NCM de código 10063021 não vinculada à Classificação Tributária de código 000001 (CBS e IBS)' });
    expect(r.divergencias).toContainEqual({ item: 0, campo: 'leiaute do grupo IBSCBS (XSD)', naNota: 'Erro na linha 1, coluna 80: cvc-complex-type.2.4.a', calculadora: 'o grupo precisa seguir o leiaute' });
    expect(r.divergencias).toContainEqual({ item: 0, campo: 'total do IBS (IBSCBSTot)', naNota: '0,50', calculadora: 'soma dos itens: 0,30' });
  });

  it('sem o grupo em nenhum item, sem resposta e o caso que a calculadora ainda não faz', () => {
    const semGrupo = notaParaConferir(nfe({ crt: '1', itens: [{ vProd: '100.00', ncm: '10063021', ibscbs: '' }], total: '' }), CLIENTE)!;
    expect(semGrupo.operacao).toBeNull();
    expect(semGrupo.grupoXml).toBe('');
    expect(conferirNota(semGrupo, null, null)).toMatchObject({ situacao: 'semGrupo', simples: true });
    expect(conferirNota(notaParaConferir(nfe(), CLIENTE)!, null, null)).toMatchObject({ situacao: 'naoConferida' });
    const umSo = notaParaConferir(nfe({ itens: [{ vProd: '100.00', ncm: '10063021', ibscbs: grupo('000', '000001', '100.00', ['0.1000', '0.10'], ['0.0000', '0.00'], '0.10', ['0.9000', '0.90']) }], total: '' }), CLIENTE)!;
    const r = conferirNota(umSo, { objetos: [{ nObj: 1, estadoItem: 'NAO_IMPLEMENTADO' }] }, { valido: true });
    expect(r).toMatchObject({ situacao: 'naoConferida', naoConferidos: [{ item: 1, motivo: 'a calculadora ainda não calcula este caso' }] });
  });

  it('o item sem o grupo numa nota que tem o grupo nos outros', () => {
    const n = notaParaConferir(nfe({ itens: [
      { vProd: '100.00', ncm: '10063021', ibscbs: grupo('000', '000001', '100.00', ['0.1000', '0.10'], ['0.0000', '0.00'], '0.10', ['0.9000', '0.90']) },
      { vProd: '50.00', ncm: '10063021', ibscbs: '' },
    ], total: '' }), CLIENTE)!;
    const r = conferirNota(n, { objetos: RESPOSTA.objetos!.slice(0, 2) }, { valido: true });
    expect(r.divergencias).toEqual([{ item: 0, campo: 'grupo IBSCBS', naNota: 'falta no item 2', calculadora: 'todo item da nota leva o grupo' }]);
  });
});

describe('o resumo do mês no siegNotas', () => {
  const nota = (numero: string, lado: 'emitida' | 'recebida', situacao: NotaConferida['situacao']): NotaConferida => ({
    chave: 'K' + numero, numero, tipo: 'NF-e', data: '01/10/2026', lado, nome: 'X', situacao, simples: false,
    divergencias: situacao === 'divergente' ? Array.from({ length: 20 }, (_, i) => ({ item: i + 1, campo: 'CBS', naNota: '1,00', calculadora: '0,90' })) : [], naoConferidos: [],
  });

  it('conta por lado e guarda só as divergentes, as emitidas primeiro, cortando o que passa do limite', () => {
    const r = resumoDaConferencia([
      nota('5', 'recebida', 'divergente'), nota('3', 'emitida', 'divergente'), nota('1', 'emitida', 'certa'),
      nota('2', 'emitida', 'semGrupo'), nota('4', 'recebida', 'naoConferida'), nota('2', 'emitida', 'divergente'),
    ], '1.7.2', '2026-11-21T10:00:00.000Z');
    expect(r.emitidas).toEqual({ conferidas: 3, certas: 1, divergentes: 2, semGrupo: 1, naoConferidas: 0, baseDiferente2026: 0 });
    expect(r.recebidas).toEqual({ conferidas: 1, certas: 0, divergentes: 1, semGrupo: 0, naoConferidas: 1, baseDiferente2026: 0 });
    expect(resumoDaConferencia([{ ...nota('9', 'emitida', 'certa'), baseDiferente2026: true }], '1.7.2', 'x').emitidas.baseDiferente2026).toBe(1);
    expect(r.notas.map(n => n.numero)).toEqual(['2', '3', '5']);
    expect(r.notas[0].divergencias).toHaveLength(12);
    expect(r.cortadas).toBe(0);
    const muitas = resumoDaConferencia(Array.from({ length: 160 }, (_, i) => nota(String(i), 'emitida', 'divergente')), '1.7.2', 'x');
    expect(muitas.notas).toHaveLength(150);
    expect(muitas.cortadas).toBe(10);
  });

  it('o que volta do banco é lido sem confiar no formato', () => {
    const r = resumoDaConferencia([{ ...nota('3', 'emitida', 'divergente'), baseDiferente2026: true }], '1.7.2', '2026-11-21T10:00:00.000Z');
    expect(lerConferenciaIbsCbs(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(lerConferenciaIbsCbs(null)).toBeNull();
    expect(lerConferenciaIbsCbs({ em: 'x', notas: 'lixo' })).toMatchObject({ notas: [], emitidas: { conferidas: 0 } });
  });
});
