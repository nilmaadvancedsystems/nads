// O PDF da DANFE a partir do XML, no robô e sem navegador (robo/gerado/danfse.js). Vitor, 10/11/2026: "quero que a danfe fique
// exatamente igual a original". A original é a que o portal do SIEG entrega (gerada pelo DanfeSharp 2.2): as medidas abaixo
// saíram de PDFs reais do portal (retrato, paisagem, duplicatas e a 2ª folha), e os títulos, as máscaras e os campos são os dela.
// Tudo é medido do alto da folha, em pontos; as larguras são frações da área útil, como na original.
// A nota de consumidor (NFC-e) não tem exemplar: sai neste mesmo desenho A4.

const decodificar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => (e[0] === '#'
  ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e] ?? m));
function tag(x: string, nome: string): string {
  const m = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>').exec(x);
  return m ? m[1] : '';
}
const texto = (x: string, nome: string) => decodificar(tag(x, nome).trim());
const blocos = (x: string, nome: string) => [...x.matchAll(new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', 'g'))].map(m => m[1]);
/** o número da tag, ou null quando a tag não veio: na original o campo sem tag fica em branco e o zero que veio sai "0,00" */
const numero = (x: string, nome: string): number | null => {
  const t = tag(x, nome).trim();
  return t === '' || !Number.isFinite(Number(t)) ? null : Number(t);
};

const decimais = (n: number | null, min: number, max: number) => (n === null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max }));
const rs = (n: number | null) => decimais(n, 2, 2);
const chaveEmGrupos = (ch: string) => ch.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
function documento(d: string): string {
  const s = d.replace(/\D/g, '');
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
const cepFormatado = (c: string) => (/^\d{8}$/.test(c) ? c.slice(0, 5) + '-' + c.slice(5) : c);
function foneFormatado(f: string): string {
  const s = f.replace(/\D/g, '');
  if (s.length === 10) return s.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  if (s.length === 11) return s.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  return f;
}
const numeroDaNota = (n: string) => n.padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
const cfopFormatado = (c: string) => (/^\d{4}$/.test(c) ? c[0] + '.' + c.slice(1) : c);
/** dd/mm/aaaa e hh:mm:ss como vieram no XML (sem converter o fuso) */
function dataEHora(s: string): { data: string; hora: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}:\d{2}))?/.exec(s.trim());
  return m ? { data: m[3] + '/' + m[2] + '/' + m[1], hora: m[4] || '' } : { data: s.trim(), hora: '' };
}

const FRETE: Record<string, string> = {
  '0': '0-Por conta Remetente', '1': '1-Por conta Destinatário', '2': '2-Por conta Terceiros',
  '3': '3-Próprio, por conta Rem.', '4': '4-Próprio, por conta Dest.', '9': '9-Sem Transporte',
};

interface Parte { nome: string; doc: string; ie: string; rua: string; bairro: string; cep: string; municipio: string; uf: string; fone: string }
function parte(x: string, grupo: string): Parte {
  const e = tag(x, grupo);
  const numeroDaRua = texto(e, 'nro');
  const complemento = texto(e, 'xCpl');
  return {
    // o nome vai como veio no XML, até com o espaço do fim: a original centraliza contando com ele
    nome: decodificar(tag(x, 'xNome')).replace(/00A0/g, ''), doc: texto(x, 'CNPJ') || texto(x, 'CPF') || texto(x, 'idEstrangeiro'), ie: texto(x, 'IE'),
    rua: texto(e, 'xLgr') + (numeroDaRua ? ', ' + numeroDaRua : '') + (complemento ? ' - ' + complemento : ''),
    bairro: texto(e, 'xBairro'), cep: cepFormatado(texto(e, 'CEP')), municipio: texto(e, 'xMun'), uf: texto(e, 'UF'), fone: foneFormatado(texto(e, 'fone')),
  };
}

/** o que a DANFE mostra, já com as máscaras (null = o XML não é NF-e nem NFC-e) */
export function modeloDaDanfe(xml: string) {
  const inf = /<(?:\w+:)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?infNFe>/.exec(xml);
  if (!inf) return null;
  const x = inf[2];
  const ide = tag(x, 'ide');
  const emit = tag(x, 'emit');
  const dest = tag(x, 'dest');
  const total = tag(tag(x, 'total'), 'ICMSTot');
  const issqn = tag(tag(x, 'total'), 'ISSQNtot');
  const transp = tag(x, 'transp');
  const transporta = tag(transp, 'transporta');
  const veiculo = tag(transp, 'veicTransp');
  const vols = blocos(transp, 'vol');
  const prot = tag(xml, 'infProt');
  const adic = tag(x, 'infAdic');
  const emissao = dataEHora(texto(ide, 'dhEmi') || texto(ide, 'dEmi'));
  const saida = dataEHora(texto(ide, 'dhSaiEnt') || texto(ide, 'dSaiEnt'));
  const horaSaida = saida.hora || texto(ide, 'hSaiEnt');
  const recebido = dataEHora(texto(prot, 'dhRecbto'));
  const somaVol = (n: string) => (vols.some(v => numero(v, n) !== null) ? vols.reduce((s, v) => s + (numero(v, n) ?? 0), 0) : null);
  const primeiroVol = (n: string) => vols.map(v => texto(v, n)).find(Boolean) || '';

  const itens = [...x.matchAll(/<(?:\w+:)?det\s+nItem="\d+"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g)].map(m => {
    const prod = tag(m[1], 'prod');
    const imp = tag(m[1], 'imposto');
    const icms = tag(imp, 'ICMS');
    const ipi = tag(imp, 'IPI');
    const mva = numero(icms, 'pMVAST');
    // o que a original acrescenta na descrição: a substituição tributária, a redução da base e o CEST (números sem ponto de milhar)
    const semMilhar = (n: number | null) => (n ?? 0).toFixed(2).replace('.', ',');
    const st = mva === null ? '' : 'IVA=' + semMilhar(mva) + '% pIcmsST=' + semMilhar(numero(icms, 'pICMSST')) + '% vBcIcmsSt=' + semMilhar(numero(icms, 'vBCST')) + ' vIcmsST=' + semMilhar(numero(icms, 'vICMSST'));
    const reducao = numero(icms, 'pRedBC');
    const cest = texto(prod, 'CEST');
    const extras = [st, reducao === null ? '' : 'pRedBc=' + semMilhar(reducao) + '%', cest ? 'CEST:' + cest : ''].join(' ').trim();
    const adicional = texto(m[1], 'infAdProd');
    const complemento = [adicional, extras].filter(Boolean).join(' ');
    return {
      codigo: texto(prod, 'cProd'), descricao: texto(prod, 'xProd') + (complemento ? '\n' + complemento : ''), ncm: texto(prod, 'NCM'),
      cst: texto(icms, 'orig') + (texto(icms, 'CST') || texto(icms, 'CSOSN')), cfop: cfopFormatado(texto(prod, 'CFOP')), un: texto(prod, 'uCom'),
      quant: decimais(numero(prod, 'qCom'), 2, 4), unit: decimais(numero(prod, 'vUnCom'), 2, 4), total: rs(numero(prod, 'vProd')),
      bc: rs(numero(icms, 'vBC')), icms: rs(numero(icms, 'vICMS')), ipi: rs(numero(ipi, 'vIPI')), aliqIcms: rs(numero(icms, 'pICMS')), aliqIpi: rs(numero(ipi, 'pIPI')),
    };
  });

  const compras = tag(x, 'compra');
  const adicionais: [string, string][] = [
    ['Inf. Contribuinte', texto(adic, 'infCpl').replace(/;/g, ' ')],
    ['Email do Destinatário', texto(dest, 'email')],
    ...[...adic.matchAll(/<(?:\w+:)?obsCont\s+xCampo="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?obsCont>/g)].map((m): [string, string] => [decodificar(m[1]), texto(m[2], 'xTexto')]),
    ['Inf. fisco', texto(adic, 'infAdFisco')],
    ['Pedido', texto(compras, 'xPed')],
    ['Contrato', texto(compras, 'xCont')],
    ['Nota de Empenho', texto(compras, 'xNEmp')],
  ];

  return {
    chave: ((/Id="NFe(\d{44})"/.exec(inf[1])) || [])[1] || '',
    nfce: texto(ide, 'mod') === '65', paisagem: texto(ide, 'tpImp') === '2',
    numero: numeroDaNota(texto(ide, 'nNF')), serie: texto(ide, 'serie'), tipo: texto(ide, 'tpNF') === '0' ? '0' : '1',
    natureza: texto(ide, 'natOp'), emissao: emissao.data, saida: saida.data, horaSaida,
    protocolo: prot ? texto(prot, 'nProt') + ' - ' + recebido.data + ' ' + recebido.hora : '',
    iest: texto(emit, 'IEST'), emitente: parte(emit, 'enderEmit'), destinatario: parte(dest, 'enderDest'),
    duplicatas: blocos(tag(x, 'cobr'), 'dup').map(d => ({ numero: texto(d, 'nDup'), vencimento: dataEHora(texto(d, 'dVenc')).data, valor: 'R$ ' + rs(numero(d, 'vDup')) })),
    totais: {
      bc: rs(numero(total, 'vBC')), icms: rs(numero(total, 'vICMS')), bcSt: rs(numero(total, 'vBCST')), st: rs(numero(total, 'vST')), ii: rs(numero(total, 'vII')),
      ufRemet: rs(numero(total, 'vICMSUFRemet')), fcp: rs(numero(total, 'vFCPUFDest')), pis: rs(numero(total, 'vPIS')), produtos: rs(numero(total, 'vProd')),
      frete: rs(numero(total, 'vFrete')), seguro: rs(numero(total, 'vSeg')), desconto: rs(numero(total, 'vDesc')), outras: rs(numero(total, 'vOutro')), ipi: rs(numero(total, 'vIPI')),
      ufDest: rs(numero(total, 'vICMSUFDest')), tributos: rs(numero(total, 'vTotTrib')), cofins: rs(numero(total, 'vCOFINS')), nota: numero(total, 'vNF'),
    },
    transporte: {
      nome: texto(transporta, 'xNome'), frete: FRETE[texto(transp, 'modFrete')] || texto(transp, 'modFrete'), antt: texto(veiculo, 'RNTC'), placa: texto(veiculo, 'placa'), ufPlaca: texto(veiculo, 'UF'),
      doc: documento(texto(transporta, 'CNPJ') || texto(transporta, 'CPF')), endereco: texto(transporta, 'xEnder'), municipio: texto(transporta, 'xMun'), uf: texto(transporta, 'UF'), ie: texto(transporta, 'IE'),
      quantidade: somaVol('qVol') === null ? '' : String(somaVol('qVol')), especie: primeiroVol('esp'), marca: primeiroVol('marca'), numeracao: primeiroVol('nVol'),
      pesoBruto: decimais(somaVol('pesoB'), 3, 3), pesoLiquido: decimais(somaVol('pesoL'), 3, 3),
    },
    issqn: numero(issqn, 'vServ') === null ? null : { im: texto(emit, 'IM'), servicos: rs(numero(issqn, 'vServ')), base: rs(numero(issqn, 'vBC')), iss: rs(numero(issqn, 'vISS')) },
    informacoes: adicionais.filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join(' '),
    itens,
  };
}

/** as larguras de barras e espaços de cada valor do Code 128 (0 a 102, 103 a 105 = início A, B e C, 106 = fim) */
export const CODE128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 '
  + '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 '
  + '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 '
  + '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 '
  + '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 '
  + '114131 311141 411131 211412 211214 211232 2331112').split(' ');

/** os valores do Code 128 C (pares de dígitos) da chave, com o início, o dígito verificador e o fim */
export function valoresDoCodigo(digitos: string): number[] {
  const pares = digitos.match(/\d\d/g) || [];
  const v = pares.map(Number);
  const soma = v.reduce((s, x, i) => s + x * (i + 1), 105);
  return [105, ...v, soma % 103, 106];
}

// as medidas da original
const A4_MENOR = 595.28;
const A4_MAIOR = 841.89;
const MARGEM = 11.34;
const ALTURA_CANHOTO = 65.2;
const ALTURA_TOPO = 85.04;
const LINHA = 19.13;
const VAO = 8.6;
const ALTURA_ADICIONAIS = 70.87;
const ALTURA_TITULOS = 16.5;
const ENTRELINHA = 5.4;
const SOBRA_DA_LINHA = 2.96;
const FOLGA = 2.12;
const INTERNO = 4.25;

// as bordas das colunas dos produtos, em frações da largura útil
const COLUNAS_RETRATO = [0, 0.08508, 0.42752, 0.48356, 0.52251, 0.55762, 0.59010, 0.65002, 0.71003, 0.77001, 0.83002, 0.88, 0.93006, 0.96500, 1];
const COLUNAS_PAISAGEM = [0, 0.08103, 0.46058, 0.51548, 0.54651, 0.57755, 0.60752, 0.66000, 0.71596, 0.77199, 0.82801, 0.88398, 0.94, 0.97, 1];
const TITULOS = ['CÓDIGO PRODUTO', 'DESCRIÇÃO DO PRODUTO / SERVIÇO', 'NCM/SH', 'O/CST', 'CFOP', 'UN', 'QUANTI.', 'VALOR UNIT.', 'VALOR TOTAL', 'B CÁLC ICMS', 'VALOR ICMS', 'VALOR IPI', 'ALIQ. ICMS', 'ALIQ. IPI'];
const NUMERICA_DESDE = 6;

type Modelo = NonNullable<ReturnType<typeof modeloDaDanfe>>;
type Alinhamento = 'e' | 'c' | 'd';

export async function desenharDanfe(xml: string): Promise<Uint8Array> {
  const d: Modelo | null = modeloDaDanfe(xml);
  if (!d) throw new Error('não é NF-e nem NFC-e');
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('DANFE ' + d.numero);
  doc.setProducer('nads');
  const fonte = await doc.embedFont(StandardFonts.TimesRoman);
  const negrito = await doc.embedFont(StandardFonts.TimesRomanBold);
  const preto = rgb(0, 0, 0);
  const aceitos = new Set(fonte.getCharacterSet());
  const limpo = (t: string) => Array.from(String(t).replace(/[\r\n\t]+/g, ' ')).map(c => (aceitos.has(c.codePointAt(0) as number) ? c : '?')).join('');
  // a original soma as larguras letra a letra (o widthOfTextAtSize do pdf-lib desconta o kerning, que o desenho não aplica)
  const porLetra = new Map<unknown, Map<string, number>>();
  const largura = (t: string, tam: number, f = fonte) => {
    let medidas = porLetra.get(f);
    if (!medidas) { medidas = new Map(); porLetra.set(f, medidas); }
    let soma = 0;
    for (const c of t) {
      let w = medidas.get(c);
      if (w === undefined) { w = f.widthOfTextAtSize(c, 1000); medidas.set(c, w); }
      soma += w;
    }
    return (soma * tam) / 1000;
  };
  /** o tamanho em que cabe, sem passar do pedido: a original encolhe o texto em vez de cortar */
  const ajustar = (t: string, tam: number, w: number, f = fonte) => { const l = largura(t, tam, f); return l > w && l > 0 ? (tam * w) / l : tam; };
  const quebrar = (bruto: string, tam: number, w: number, f = fonte) => {
    const linhas: string[] = [];
    for (const paragrafo of String(bruto).split('\n')) {
      let atual: string | null = null;
      for (let p of limpo(paragrafo).split(' ')) {
        while (largura(p, tam, f) > w && p.length > 1) {
          let n = p.length - 1;
          while (n > 1 && largura(p.slice(0, n), tam, f) > w) n--;
          if (atual) { linhas.push(atual); atual = null; }
          linhas.push(p.slice(0, n));
          p = p.slice(n);
        }
        const junto: string = atual === null ? p : atual + ' ' + p;
        if (largura(junto, tam, f) <= w) atual = junto;
        else { linhas.push(atual as string); atual = p; }
      }
      if (atual !== null) linhas.push(atual);
    }
    return linhas;
  };

  const LARGURA_FOLHA = d.paisagem ? A4_MAIOR : A4_MENOR;
  const ALTURA_FOLHA = d.paisagem ? A4_MENOR : A4_MAIOR;
  let pag = doc.addPage([LARGURA_FOLHA, ALTURA_FOLHA]);
  let x0 = d.paisagem ? 76.54 : MARGEM;
  let W = LARGURA_FOLHA - MARGEM - x0;

  const escrever = (t: string, x: number, base: number, tam: number, f = fonte) => { if (t) pag.drawText(t, { x, y: ALTURA_FOLHA - base, size: tam, font: f, color: preto }); };
  const centrado = (t: string, a: number, b: number, base: number, tam: number, f = fonte) => escrever(t, (a + b - largura(t, tam, f)) / 2, base, tam, f);
  const retangulo = (a: number, topo: number, b: number, fim: number) => pag.drawRectangle({ x: a, y: ALTURA_FOLHA - fim, width: b - a, height: fim - topo, borderColor: preto, borderWidth: 0.25 });
  const fracao = (p: number) => x0 + W * p;
  const titulo = (t: string, base: number) => escrever(limpo(t), x0, base, 7);

  function campo(a: number, b: number, topo: number, rotulo: string, valor: string, al: Alinhamento = 'e', tamRotulo = 6) {
    retangulo(a, topo, b, topo + LINHA);
    escrever(limpo(rotulo), a + FOLGA, topo + (tamRotulo === 6 ? 5.92 : 5.08), tamRotulo);
    const v = limpo(valor);
    if (!v) return;
    const tam = ajustar(v, 10, b - a - INTERNO, negrito);
    const larg = largura(v, tam, negrito);
    const x = al === 'e' ? a + FOLGA : al === 'd' ? b - FOLGA - larg : (a + b - larg) / 2;
    escrever(v, x, topo + 16.09, tam, negrito);
  }

  const folhas: { pag: typeof pag; x: number; base: number }[] = [];
  /** o quadro de cima (emitente, DANFE e chave) e as duas linhas da natureza; devolve onde terminou */
  function topo(t: number): number {
    const e = d!.emitente;
    const [a, b, c] = [fracao(0.385), fracao(0.535), fracao(1)];
    retangulo(x0, t, a, t + ALTURA_TOPO);
    retangulo(a, t, b, t + ALTURA_TOPO);
    centrado('IDENTIFICAÇÃO DO EMITENTE', x0, a, t + 6.22, 6);
    const nome = limpo(e.nome);
    const tamNome = ajustar(nome, 12, a - x0 - INTERNO, negrito);
    const alturaNome = tamNome * 0.9;
    const inicio = 45.31 - (alturaNome + 21.6) / 2;
    centrado(nome, x0, a, t + inicio + 0.678 * tamNome, tamNome, negrito);
    const linhas = [e.rua, e.bairro + ' - CEP: ' + e.cep, e.municipio + ' - ' + e.uf + (e.fone ? ' Fone: ' + e.fone : '')];
    linhas.forEach((l, i) => {
      const s = limpo(l);
      const tam = ajustar(s, 8, a - x0 - INTERNO);
      centrado(s, x0, a, t + inicio + alturaNome + 5.41 + i * 7.2, tam);
    });
    const r = d!.paisagem;
    centrado('DANFE', a, b, t + 11.07, 12, negrito);
    const linha1 = 'Documento Auxiliar da';
    const linha2 = d!.nfce ? 'Nota Fiscal de Consumidor' : 'Nota Fiscal Eletrônica';
    centrado(linha1, a, b, t + (r ? 20.55 : 20.27), ajustar(linha1, 8, b - a - 14.2));
    centrado(linha2, a, b, t + (r ? 29.55 : 29.1), ajustar(linha2, 8, b - a - 14.2));
    const xEntrada = a + (r ? 14.2 : 7.08);
    escrever('0 - ENTRADA', xEntrada, t + 39.2, 8);
    escrever('1 - SAÍDA', xEntrada, t + 48.2, 8);
    const xCaixa = r ? 86.4 : 66.2;
    retangulo(a + xCaixa, t + 34.6, a + xCaixa + 12.6, t + 47.2);
    centrado(d!.tipo, a + xCaixa, a + xCaixa + 12.6, t + 43.27, 10, negrito);
    centrado('Nº.: ' + d!.numero, a, b, t + 60.79, 10, negrito);
    centrado('Série: ' + limpo(d!.serie), a, b, t + 72.04, 10, negrito);
    folhas.push({ pag, x: (a + b) / 2, base: t + 81.49 });

    retangulo(b, t, c, t + 43.3);
    retangulo(b, t + 43.3, c, t + 62.43);
    retangulo(b, t + 62.43, c, t + ALTURA_TOPO);
    const digitos = d!.chave.replace(/\D/g, '');
    if (digitos.length === 44) {
      const barras = valoresDoCodigo(digitos).map(v => CODE128[v]).join('');
      const modulos = Array.from(barras).reduce((s, n) => s + Number(n), 0);
      const larguraTotal = 212.6;
      const passo = larguraTotal / modulos;
      let x = (b + c - larguraTotal) / 2;
      Array.from(barras).forEach((n, i) => {
        const w = Number(n) * passo;
        if (i % 2 === 0) pag.drawRectangle({ x, y: ALTURA_FOLHA - (t + 37.6), width: w, height: 31.9, color: preto });
        x += w;
      });
    }
    escrever('CHAVE DE ACESSO', b + FOLGA, t + 49.2, 6);
    centrado(chaveEmGrupos(d!.chave), b, c, t + 59.38, 10, negrito);
    quebrar('Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', 9, c - b - INTERNO)
      .slice(0, 2).forEach((l, i) => centrado(l, b, c, t + 71.78 + i * 8.1, 9));

    let y = t + ALTURA_TOPO;
    campo(x0, b, y, 'NATUREZA DA OPERAÇÃO', d!.natureza);
    campo(b, c, y, 'PROTOCOLO DE AUTORIZAÇÃO', d!.protocolo, 'c');
    y += LINHA;
    const [t1, t2] = [fracao(1 / 3), fracao(2 / 3)];
    campo(x0, t1, y, 'INSCRIÇÃO ESTADUAL', e.ie, 'c');
    campo(t1, t2, y, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO', d!.iest, 'c');
    campo(t2, c, y, 'CNPJ / CPF', documento(e.doc), 'c');
    return y + LINHA;
  }

  /** a moldura da tabela e os títulos das colunas; devolve as bordas das colunas */
  function tabela(y0: number, fim: number): number[] {
    const proporcoes = d!.paisagem ? COLUNAS_PAISAGEM : COLUNAS_RETRATO;
    const bordas = proporcoes.map(fracao);
    const meio = y0 + ALTURA_TITULOS / 2;
    TITULOS.forEach((t, i) => {
      const [a, b] = [bordas[i], bordas[i + 1]];
      retangulo(a, y0, b, y0 + ALTURA_TITULOS);
      retangulo(a, y0, b, fim);
      const interno = b - a - 5.67;
      // deitado, coluna larga fica numa linha só (e encolhe); estreita e em pé quebra nos espaços, nunca no meio da palavra
      const umaLinha = d!.paisagem ? b - a >= 40 : largura(t, 6) <= interno;
      const palavras: string[] = [];
      if (umaLinha) palavras.push(t);
      else for (const p of t.split(' ')) {
        const junto = palavras.length ? palavras[palavras.length - 1] + ' ' + p : p;
        if (palavras.length && largura(junto, 6) <= interno) palavras[palavras.length - 1] = junto;
        else palavras.push(p);
      }
      const inicio = palavras.length === 1 ? meio + 1.37 : meio - 2;
      palavras.forEach((l, n) => centrado(l, a, b, inicio + n * 6.75, ajustar(l, 6, interno)));
    });
    return bordas;
  }

  /** a segunda folha em diante: sem canhoto, o quadro de cima sobe e a tabela vai até o pé */
  function novaFolha(): { bordas: number[]; y: number; fim: number } {
    pag = doc.addPage([LARGURA_FOLHA, ALTURA_FOLHA]);
    x0 = MARGEM;
    W = LARGURA_FOLHA - 2 * MARGEM;
    const y = topo(MARGEM);
    titulo('DADOS DOS PRODUTOS / SERVIÇOS', y + 7.09);
    const y0 = y + VAO;
    const fim = ALTURA_FOLHA - MARGEM;
    return { bordas: tabela(y0, fim), y: y0 + ALTURA_TITULOS, fim };
  }

  // o canhoto: em pé no retrato e deitado à esquerda na paisagem (o mesmo desenho, girado)
  (function canhoto() {
    const texto1 = 'Recebemos de ' + d!.emitente.nome + ' os produtos e/ou serviços constantes na Nota Fiscal Eletrônica indicada ' + (d!.paisagem ? 'ao lado' : 'abaixo') + '. Emissão: ' + d!.emissao + ' Valor Total: R$ ' + rs(d!.totais.nota) + ' Destinatário: ' + d!.destinatario.nome;
    const larg = A4_MENOR - 2 * MARGEM;
    const girado = d!.paisagem;
    // (px, py) é a posição no canhoto em pé
    const ponto = (px: number, py: number) => (girado ? { x: py, y: ALTURA_FOLHA - (MARGEM + larg - (px - MARGEM)) } : { x: px, y: ALTURA_FOLHA - py });
    const caixa = (a: number, t: number, b: number, f: number) => {
      const p = girado ? { x: t, y: ALTURA_FOLHA - (MARGEM + larg - (a - MARGEM)), width: f - t, height: b - a } : { x: a, y: ALTURA_FOLHA - f, width: b - a, height: f - t };
      pag.drawRectangle({ ...p, borderColor: preto, borderWidth: 0.25 });
    };
    const txt = (t: string, px: number, py: number, tam: number, f = fonte) => { if (t) pag.drawText(t, { ...ponto(px, py), size: tam, font: f, color: preto, rotate: degrees(girado ? 90 : 0) }); };
    const fimTexto = 492.3;
    caixa(MARGEM, MARGEM, fimTexto, 39.7);
    quebrar(texto1, 8, fimTexto - MARGEM - INTERNO).slice(0, 3).forEach((l, i) => txt(l, 13.46, 18.93 + i * 7.2, 8));
    caixa(MARGEM, 39.7, 251.8, 65.2);
    caixa(251.8, 39.7, fimTexto, 65.2);
    txt('DATA DE RECEBIMENTO', 13.46, 45.63, 6);
    txt('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', 253.96, 45.63, 6);
    caixa(fimTexto, MARGEM, A4_MENOR - MARGEM, 65.2);
    const centroX = (fimTexto + A4_MENOR - MARGEM) / 2;
    const meio = (t: string, base: number, tam: number) => txt(t, centroX - largura(t, tam, negrito) / 2, base, tam, negrito);
    meio(d!.nfce ? 'NFC-e' : 'NF-e', 23.74, 14);
    meio('Nº.: ' + d!.numero, 42.18, 11);
    meio('Série: ' + limpo(d!.serie), 52.08, 11);
    const tracejado = girado ? { start: { x: 70.9, y: ALTURA_FOLHA - MARGEM }, end: { x: 70.9, y: MARGEM } } : { start: { x: MARGEM, y: ALTURA_FOLHA - 70.9 }, end: { x: A4_MENOR - MARGEM, y: ALTURA_FOLHA - 70.9 } };
    pag.drawLine({ ...tracejado, thickness: 0.25, color: preto, dashArray: [3, 2] });
  })();

  let y = topo(d.paisagem ? MARGEM : MARGEM + ALTURA_CANHOTO);
  const secao = (t: string) => { titulo(t, y + 7.09); y += VAO; };

  secao('DESTINATÁRIO / REMETENTE');
  const q = d.destinatario;
  campo(x0, fracao(0.625), y, 'RAZÃO SOCIAL', q.nome);
  campo(fracao(0.625), fracao(0.85), y, 'CNPJ / CPF', documento(q.doc), 'c');
  campo(fracao(0.85), fracao(1), y, 'DATA DE EMISSÃO', d.emissao, 'c');
  y += LINHA;
  campo(x0, fracao(0.5), y, 'ENDEREÇO', q.rua);
  campo(fracao(0.5), fracao(0.725), y, 'BAIRRO / DISTRITO', q.bairro);
  campo(fracao(0.725), fracao(0.85), y, 'CEP', q.cep, 'c');
  campo(fracao(0.85), fracao(1), y, 'DATA ENTRADA / SAÍDA', d.saida, 'c');
  y += LINHA;
  campo(x0, fracao(0.44), y, 'MUNICÍPIO', q.municipio);
  campo(fracao(0.44), fracao(0.615), y, 'FONE / FAX', q.fone, 'c');
  campo(fracao(0.615), fracao(0.65), y, 'UF', q.uf, 'c');
  campo(fracao(0.65), fracao(0.85), y, 'INSCRIÇÃO ESTADUAL', q.ie, 'c');
  campo(fracao(0.85), fracao(1), y, 'HORA ENTRADA / SAÍDA', d.horaSaida, 'c');
  y += LINHA;

  if (d.duplicatas.length) {
    secao('FATURA / DUPLICATA');
    const porLinha = d.paisagem ? 8 : 6;
    const w = W / porLinha;
    const ALTURA = 22.9;
    d.duplicatas.forEach((f, i) => {
      const col = i % porLinha;
      if (i && col === 0) y += ALTURA;
      const a = x0 + w * col;
      retangulo(a, y, a + w, y + ALTURA);
      ([['Número', f.numero, 6.94], ['Vencimento:', f.vencimento, 13.69], ['Valor:', f.valor, 20.44]] as const).forEach(([r, v, b]) => {
        escrever(r, a + FOLGA, y + b, 7.5);
        const s = limpo(v);
        escrever(s, a + w - FOLGA - largura(s, 7.5, negrito), y + b, 7.5, negrito);
      });
    });
    y += ALTURA;
  }

  secao('CÁLCULO DO IMPOSTO');
  const t = d.totais;
  const tamImposto = d.paisagem ? 6 : 4.8;
  const nono = (linha: [string, string][]) => { linha.forEach(([r, v], i) => campo(fracao(i / 9), fracao((i + 1) / 9), y, r, v, 'd', tamImposto)); y += LINHA; };
  nono([['BASE DE CÁLC. DO ICMS', t.bc], ['VALOR DO ICMS', t.icms], ['BASE DE CÁLC. ICMS S.T.', t.bcSt], ['VALOR DO ICMS SUBST.', t.st], ['V. IMP. IMPORTAÇÃO', t.ii], ['V. ICMS UF REMET.', t.ufRemet], ['VALOR DO FCP', t.fcp], ['VALOR DO PIS', t.pis], ['V. TOTAL PRODUTOS', t.produtos]]);
  nono([['VALOR DO FRETE', t.frete], ['VALOR DO SEGURO', t.seguro], ['DESCONTO', t.desconto], ['OUTRAS DESPESAS', t.outras], ['VALOR IPI', t.ipi], ['V. ICMS UF DEST.', t.ufDest], ['V. TOT. TRIB.', t.tributos], ['VALOR DO COFINS', t.cofins], ['VALOR TOTAL DA NOTA', rs(t.nota)]]);

  secao('TRANSPORTADOR / VOLUMES TRANSPORTADOS');
  const v = d.transporte;
  campo(x0, fracao(0.38), y, 'RAZÃO SOCIAL', v.nome);
  campo(fracao(0.38), fracao(0.55), y, 'FRETE', v.frete, 'c');
  campo(fracao(0.55), fracao(0.7), y, 'CÓDIGO ANTT', v.antt, 'c');
  campo(fracao(0.7), fracao(0.81), y, 'PLACA DO VEÍCULO', v.placa, 'c');
  campo(fracao(0.81), fracao(0.845), y, 'UF', v.ufPlaca, 'c');
  campo(fracao(0.845), fracao(1), y, 'CNPJ / CPF', v.doc, 'c');
  y += LINHA;
  campo(x0, fracao(0.55), y, 'ENDEREÇO', v.endereco);
  campo(fracao(0.55), fracao(0.81), y, 'MUNICÍPIO', v.municipio);
  campo(fracao(0.81), fracao(0.845), y, 'UF', v.uf, 'c');
  campo(fracao(0.845), fracao(1), y, 'INSCRIÇÃO ESTADUAL', v.ie, 'c');
  y += LINHA;
  campo(x0, fracao(0.1), y, 'QUANTIDADE', v.quantidade);
  campo(fracao(0.1), fracao(0.325), y, 'ESPÉCIE', v.especie);
  campo(fracao(0.325), fracao(0.55), y, 'MARCA', v.marca);
  campo(fracao(0.55), fracao(0.7), y, 'NUMERAÇÃO', v.numeracao);
  campo(fracao(0.7), fracao(0.85), y, 'PESO BRUTO', v.pesoBruto, 'd');
  campo(fracao(0.85), fracao(1), y, 'PESO LÍQUIDO', v.pesoLiquido, 'd');
  y += LINHA;

  // o pé da primeira folha: o ISSQN (quando tem) e os dados adicionais
  const fimAdicionais = ALTURA_FOLHA - MARGEM;
  const topoAdicionais = fimAdicionais - ALTURA_ADICIONAIS;
  const tituloAdicionais = topoAdicionais - VAO;
  let fimTabela = tituloAdicionais;
  if (d.issqn) fimTabela -= VAO + LINHA;

  // a primeira folha termina antes de a tabela mudar a folha
  const paginaUm = pag;
  const [x0Um, wUm] = [x0, W];
  const fracaoUm = (p: number) => x0Um + wUm * p;
  (function pe() {
    if (d.issqn) {
      const topoIssqn = tituloAdicionais - LINHA;
      titulo('CÁLCULO DO ISSQN', topoIssqn - 1.51);
      const c = ([['INSCRIÇÃO MUNICIPAL', d.issqn.im, 'e'], ['VALOR TOTAL DOS SERVIÇOS', d.issqn.servicos, 'd'], ['BASE DE CÁLCULO DO ISSQN', d.issqn.base, 'd'], ['VALOR TOTAL DO ISSQN', d.issqn.iss, 'd']] as const);
      c.forEach(([r, val, al], i) => campo(fracaoUm(i / 4), fracaoUm((i + 1) / 4), topoIssqn, r, val, al));
    }
    titulo('DADOS ADICIONAIS', tituloAdicionais + 7.09);
    const corte = fracaoUm(0.75);
    retangulo(x0Um, topoAdicionais, corte, fimAdicionais);
    retangulo(corte, topoAdicionais, fracaoUm(1), fimAdicionais);
    escrever('INFORMAÇÕES COMPLEMENTARES', x0Um + FOLGA, topoAdicionais + 5.59, 6);
    escrever('RESERVADO AO FISCO', corte + FOLGA, topoAdicionais + 5.59, 6);
  })();

  // os dados adicionais: em 8 pontos; se não couber, encolhe até 5 e o que ainda sobrar vai para uma folha só de dados adicionais
  const larguraAdicionais = fracaoUm(0.75) - x0Um - INTERNO;
  let tamAdicionais = 8;
  let linhasAdicionais = quebrar(d.informacoes, tamAdicionais, larguraAdicionais);
  const cabemAdicionais = (tam: number) => Math.floor((ALTURA_ADICIONAIS - 8.6) / (tam * 0.9));
  while (linhasAdicionais.length > cabemAdicionais(tamAdicionais) && tamAdicionais > 5) {
    tamAdicionais -= 0.5;
    linhasAdicionais = quebrar(d.informacoes, tamAdicionais, larguraAdicionais);
  }
  linhasAdicionais.slice(0, cabemAdicionais(tamAdicionais)).forEach((l, i) => escrever(l, x0Um + FOLGA, topoAdicionais + 6.35 + tamAdicionais * 0.891 + i * tamAdicionais * 0.9, tamAdicionais));
  const restoAdicionais = linhasAdicionais.slice(cabemAdicionais(tamAdicionais));

  // os produtos: cada item fica inteiro numa folha, com um tracejado entre eles
  secao('DADOS DOS PRODUTOS / SERVIÇOS');
  let bordas = tabela(y, fimTabela);
  y += ALTURA_TITULOS;
  let limite = fimTabela;
  let primeiroDaFolha = true;
  for (const i of d.itens) {
    const larguraDe = (c: number) => bordas[c + 1] - bordas[c];
    const maximoDeLinhas = Math.floor((ALTURA_FOLHA - 2 * MARGEM - 200) / ENTRELINHA);
    const descricao = quebrar(i.descricao, 6, larguraDe(1) - 4.25).slice(0, maximoDeLinhas);
    const codigo = quebrar(i.codigo, 6, larguraDe(0) - 4.25).slice(0, maximoDeLinhas);
    const unidade = quebrar(i.un, 6, larguraDe(5) - 4.25).slice(0, maximoDeLinhas);
    const altura = Math.max(descricao.length, codigo.length, unidade.length, 1) * ENTRELINHA + SOBRA_DA_LINHA;
    if (y + altura > limite) {
      const f = novaFolha();
      bordas = f.bordas; y = f.y; limite = f.fim; primeiroDaFolha = true;
    }
    if (!primeiroDaFolha) pag.drawLine({ start: { x: bordas[0], y: ALTURA_FOLHA - y }, end: { x: bordas[14], y: ALTURA_FOLHA - y }, thickness: 0.25, color: preto, dashArray: [6, 1] });
    primeiroDaFolha = false;
    const base = y + 6.18;
    codigo.forEach((l, n) => centrado(l, bordas[0] + 1.7, bordas[1] - 2.55, base + n * ENTRELINHA, 6));
    descricao.forEach((l, n) => escrever(l, bordas[1] + 1.7, base + n * ENTRELINHA, 6));
    unidade.forEach((l, n) => centrado(l, bordas[5] + 1.7, bordas[6] - 2.55, base + n * ENTRELINHA, 6));
    [i.ncm, i.cst, i.cfop, '', i.quant, i.unit, i.total, i.bc, i.icms, i.ipi, i.aliqIcms, i.aliqIpi].forEach((valor, k) => {
      const c = k + 2;
      const s = limpo(valor);
      if (!s) return;
      const tam = ajustar(s, 6, larguraDe(c) - 4.25);
      if (c < NUMERICA_DESDE) centrado(s, bordas[c] + 1.7, bordas[c + 1] - 2.55, base, tam);
      else escrever(s, bordas[c + 1] - 2.55 - largura(s, tam), base, tam);
    });
    y += altura;
  }

  // o que não coube nos dados adicionais continua em folhas próprias, para nada se perder
  for (let i = 0; i < restoAdicionais.length;) {
    pag = doc.addPage([LARGURA_FOLHA, ALTURA_FOLHA]);
    x0 = MARGEM;
    W = LARGURA_FOLHA - 2 * MARGEM;
    const inicio = topo(MARGEM);
    titulo('DADOS ADICIONAIS (CONTINUAÇÃO)', inicio + 7.09);
    const y0 = inicio + VAO;
    const fim = ALTURA_FOLHA - MARGEM;
    retangulo(x0, y0, x0 + W, fim);
    const tam = tamAdicionais;
    const n = Math.floor((fim - y0 - 6) / (tam * 0.9));
    const larguraDaFolha = W - INTERNO;
    // a folha é mais larga que o quadro, mas o texto já vem quebrado na largura do quadro: mantém
    void larguraDaFolha;
    restoAdicionais.slice(i, i + n).forEach((l, k) => escrever(l, x0 + FOLGA, y0 + 3 + tam * 0.891 + k * tam * 0.9, tam));
    i += n;
  }

  void paginaUm;
  const total = doc.getPageCount();
  folhas.forEach((f, i) => {
    const s = 'Folha ' + (i + 1) + '/' + total;
    f.pag.drawText(s, { x: f.x - largura(s, 10, negrito) / 2, y: ALTURA_FOLHA - f.base, size: 10, font: negrito, color: preto });
  });
  return doc.save();
}
