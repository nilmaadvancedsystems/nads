import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CODE128, desenharDanfe, modeloDaDanfe, valoresDoCodigo } from './danfePdf';

const CHAVE = '31260240470754000120550010000000171041317010';
const pessoa = (nome: string, grupo: string) => `<CNPJ>40470754000120</CNPJ><xNome>${nome}</xNome><${grupo}><xLgr>RUA CEARÁ</xLgr><nro>202</nro><xBairro>CENTRO</xBairro><xMun>ÁGUAS VERMELHAS</xMun><UF>MG</UF><CEP>39990000</CEP><fone>33999068727</fone></${grupo}><IE>0039458230004</IE>`;
const item = (n: number, descricao = 'PRODUTO', imposto = '<ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>20.00</vBC><pICMS>18.0000</pICMS><vICMS>3.60</vICMS></ICMS00></ICMS>', extra = '') =>
  `<det nItem="${n}"><prod><cProd>C${n}</cProd><xProd>${descricao}</xProd><NCM>12345678</NCM>${extra}<CFOP>5102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>10.1250000000</vUnCom><vProd>20.25</vProd></prod><imposto>${imposto}</imposto></det>`;
const nota = (itens: string, ops: { infCpl?: string; tpImp?: string; dup?: string; total?: string } = {}) => `<nfeProc><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"><ide><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>17</nNF><dhEmi>2026-02-02T09:27:00-03:00</dhEmi><dhSaiEnt>2026-02-02T10:15:30-03:00</dhSaiEnt><tpNF>1</tpNF><tpImp>${ops.tpImp ?? '1'}</tpImp></ide><emit>${pessoa('COMÉRCIO &amp; CIA LTDA', 'enderEmit')}</emit><dest>${pessoa('MARIA', 'enderDest')}</dest>${itens}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>2940.00</vProd><vNF>2940.00</vNF>${ops.total ?? ''}</ICMSTot></total><transp><modFrete>9</modFrete><vol><qVol>3</qVol><esp>CX</esp><pesoB>1.500</pesoB></vol><vol><qVol>2</qVol><pesoB>1.000</pesoB></vol></transp>${ops.dup ?? ''}<infAdic><infCpl>${ops.infCpl ?? ''}</infCpl></infAdic></infNFe></NFe><protNFe><infProt><dhRecbto>2026-02-02T09:38:53-03:00</dhRecbto><nProt>131267273476352</nProt></infProt></protNFe></nfeProc>`;
const paginas = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe('a DANFE igual à do portal do SIEG (10/11/2026)', () => {
  it('uma nota pequena: uma folha A4 em pé', async () => {
    const pdf = await PDFDocument.load(await desenharDanfe(nota(item(1))));
    expect(pdf.getPageCount()).toBe(1);
    expect(Math.round(pdf.getPage(0).getWidth())).toBe(595);
  });

  it('tpImp 2: a folha deitada', async () => {
    const pdf = await PDFDocument.load(await desenharDanfe(nota(item(1), { tpImp: '2' })));
    expect(Math.round(pdf.getPage(0).getWidth())).toBe(842);
  });

  it('as máscaras da original', () => {
    const m = modeloDaDanfe(nota(item(1)))!;
    expect(m.numero).toBe('000.000.017');
    expect(m.emitente.cep).toBe('39990-000');
    expect(m.emitente.fone).toBe('(33) 99906-8727');
    expect(m.emitente.rua).toBe('RUA CEARÁ, 202');
    expect(m.emitente.nome).toBe('COMÉRCIO & CIA LTDA');
    expect(m.emissao).toBe('02/02/2026');
    expect(m.horaSaida).toBe('10:15:30');
    expect(m.protocolo).toBe('131267273476352 - 02/02/2026 09:38:53');
    expect(m.itens[0].cfop).toBe('5.102');
    expect(m.itens[0].quant).toBe('2,00');
    expect(m.itens[0].unit).toBe('10,125');
    expect(m.transporte.frete).toBe('9-Sem Transporte');
    expect(m.transporte.quantidade).toBe('5');
    expect(m.transporte.pesoBruto).toBe('2,500');
    expect(m.transporte.pesoLiquido).toBe('');
  });

  it('o campo sem tag fica em branco; o zero que veio sai 0,00', () => {
    const semIcms = modeloDaDanfe(nota(item(1, 'P', '<ICMS><ICMS40><orig>0</orig><CST>40</CST></ICMS40></ICMS>')))!;
    expect(semIcms.itens[0].bc).toBe('');
    expect(semIcms.itens[0].aliqIcms).toBe('');
    expect(semIcms.itens[0].cst).toBe('040');
    const t = modeloDaDanfe(nota(item(1), { total: '<vFCPUFDest>0.00</vFCPUFDest>' }))!.totais;
    expect(t.fcp).toBe('0,00');
    expect(t.ufDest).toBe('');
    expect(t.bc).toBe('0,00');
  });

  it('a substituição tributária e o CEST entram na descrição, sem ponto de milhar', () => {
    const st = '<ICMS><ICMS10><orig>0</orig><CST>10</CST><vBC>1.00</vBC><pMVAST>55.6100</pMVAST><vBCST>1013.91</vBCST><pICMSST>18.0000</pICMSST><vICMSST>104.32</vICMSST></ICMS10></ICMS>';
    expect(modeloDaDanfe(nota(item(1, 'CAIXA', st, '<CEST>1001500</CEST>')))!.itens[0].descricao).toBe('CAIXA\nIVA=55,61% pIcmsST=18,00% vBcIcmsSt=1013,91 vIcmsST=104,32  CEST:1001500');
  });

  it('as duplicatas, e os dados adicionais com o rótulo da original', () => {
    const m = modeloDaDanfe(nota(item(1), { infCpl: 'A ; B', dup: '<cobr><dup><nDup>001</nDup><dVenc>2026-03-28</dVenc><vDup>707.56</vDup></dup></cobr>' }))!;
    expect(m.duplicatas).toEqual([{ numero: '001', vencimento: '28/03/2026', valor: 'R$ 707,56' }]);
    expect(m.informacoes).toBe('Inf. Contribuinte: A   B');
  });

  it('muitos produtos e texto enorme: mais folhas, sem derrubar', async () => {
    const itens = Array.from({ length: 150 }, (_, i) => item(i + 1, 'DESCRIÇÃO COMPRIDA DO PRODUTO '.repeat(8))).join('');
    expect(await paginas(await desenharDanfe(nota(itens, { infCpl: 'INFORMAÇÃO '.repeat(3000) })))).toBeGreaterThan(3);
  });

  it('caractere que a fonte não tem e palavra sem espaço não derrubam', async () => {
    expect(await paginas(await desenharDanfe(nota(item(1, '日本語 ✓ ' + 'X'.repeat(500)), { infCpl: 'linha 😀' })))).toBe(1);
  });

  it('XML que não é nota: recusa', async () => {
    expect(modeloDaDanfe('<nfse/>')).toBeNull();
    await expect(desenharDanfe('<nfse/>')).rejects.toThrow();
  });

  it('o Code 128: 107 desenhos de 11 módulos (o de fim, 13)', () => {
    expect(CODE128).toHaveLength(107);
    const soma = (s: string) => Array.from(s).reduce((t, c) => t + Number(c), 0);
    expect(CODE128.slice(0, 106).every(p => p.length === 6 && soma(p) === 11)).toBe(true);
    expect(soma(CODE128[106])).toBe(13);
    expect(new Set(CODE128).size).toBe(107);
  });

  it('o Code 128 C: início, pares, verificador e fim', () => {
    // 105 + 12*1 + 34*2 = 185; 185 % 103 = 82
    expect(valoresDoCodigo('1234')).toEqual([105, 12, 34, 82, 106]);
  });
});
