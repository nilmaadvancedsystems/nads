import { describe, expect, it } from 'vitest';
import { chaveEmGrupos, danfeDoXml, docFormatado, htmlDaDanfe } from './danfe';

const CHAVE = '31260921012190001613550050001114731368248106';
const XML = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00">
<ide><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>5</serie><nNF>111473</nNF><dhEmi>2026-09-29T10:15:00-03:00</dhEmi><tpNF>1</tpNF></ide>
<emit><CNPJ>21012190001613</CNPJ><xNome>IRMAOS SILVA S.A</xNome><enderEmit><xLgr>RUA A</xLgr><nro>10</nro><xBairro>CENTRO</xBairro><xMun>BELO HORIZONTE</xMun><UF>MG</UF><CEP>30000000</CEP></enderEmit><IE>0011223344</IE></emit>
<dest><CNPJ>11426314000177</CNPJ><xNome>LEONARDO MENDES MARQUES ME</xNome><enderDest><xLgr>AV B</xLgr><nro>S/N</nro><xBairro>BAIRRO</xBairro><xMun>VESPASIANO</xMun><UF>MG</UF></enderDest></dest>
<det nItem="1"><prod><cProd>PN-01</cProd><xProd>PNEU 175/70 R13 &amp; CAMARA</xProd><NCM>40117090</NCM><CFOP>5405</CFOP><uCom>UN</uCom><qCom>4.0000</qCom><vUnCom>1404.6125</vUnCom><vProd>5618.45</vProd><vDesc>693.45</vDesc></prod>
<imposto><ICMS><ICMS60><orig>0</orig><CST>60</CST></ICMS60></ICMS><IPI><IPITrib><vIPI>0.00</vIPI></IPITrib></IPI></imposto><infAdProd>LOTE 9</infAdProd></det>
<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vBCST>0.00</vBCST><vST>0.00</vST><vProd>5618.45</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>693.45</vDesc><vIPI>0.00</vIPI><vOutro>0.00</vOutro><vNF>4925.00</vNF></ICMSTot></total>
<transp><modFrete>9</modFrete><vol><qVol>4</qVol><esp>PNEU</esp><pesoB>30.5</pesoB></vol></transp>
<cobr><dup><nDup>001</nDup><dVenc>2026-10-29</dVenc><vDup>4925.00</vDup></dup></cobr>
<pag><detPag><tPag>15</tPag><vPag>4925.00</vPag></detPag></pag>
<infAdic><infCpl>PEDIDO 123</infCpl></infAdic>
</infNFe></NFe><protNFe><infProt><dhRecbto>2026-09-29T10:16:00-03:00</dhRecbto><nProt>131260000000001</nProt></infProt></protNFe></nfeProc>`;

describe('a nota original pelo XML (23/10/2026)', () => {
  it('a identificação, as pessoas, os produtos com a descrição, os totais e o resto da DANFE', () => {
    const d = danfeDoXml(XML)!;
    expect(d).toMatchObject({ chave: CHAVE, modelo: '55', numero: '111473', serie: '5', emissao: '29/09/2026 10:15', tipo: 'saida', natureza: 'VENDA DE MERCADORIA' });
    expect(d.emitente).toMatchObject({ nome: 'IRMAOS SILVA S.A', doc: '21012190001613', ie: '0011223344', endereco: 'RUA A, 10 · CENTRO', municipio: 'BELO HORIZONTE', uf: 'MG' });
    expect(d.destinatario.nome).toBe('LEONARDO MENDES MARQUES ME');
    expect(d.itens).toEqual([expect.objectContaining({ n: 1, codigo: 'PN-01', descricao: 'PNEU 175/70 R13 & CAMARA', ncm: '40117090', cst: '060', cfop: '5405', unidade: 'UN', quantidade: 4, valor: 5618.45, desconto: 693.45, infAdic: 'LOTE 9' })]);
    expect(d.totais).toMatchObject({ produtos: 5618.45, desconto: 693.45, nota: 4925 });
    expect(d.transporte).toMatchObject({ modalidade: 'Sem frete', volumes: '4 PNEU', pesoBruto: 30.5 });
    expect(d.faturas).toEqual([{ numero: '001', vencimento: '29/10/2026', valor: 4925 }]);
    expect(d.pagamentos).toEqual([{ forma: 'Boleto', valor: 4925 }]);
    expect(d.informacoes).toBe('PEDIDO 123');
    expect(d.protocolo).toEqual({ numero: '131260000000001', data: '29/09/2026 10:16' });
  });
  it('o que não é NF-e é null; a chave em grupos, o documento com máscara e o HTML da impressão', () => {
    expect(danfeDoXml('<CTe></CTe>')).toBeNull();
    expect(chaveEmGrupos(CHAVE)).toBe('3126 0921 0121 9000 1613 5500 5000 1114 7313 6824 8106');
    expect(docFormatado('21012190001613')).toBe('21.012.190/0016-13');
    const h = htmlDaDanfe(danfeDoXml(XML)!);
    expect(h).toContain('PNEU 175/70 R13 &amp; CAMARA');
    expect(h).toContain('1 - SAÍDA');
    expect(h).toContain('size:A4');
  });
});
