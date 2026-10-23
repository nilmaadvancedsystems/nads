// Arquivador novo: as REGRAS, sem o Claude (Vitor, 20/10/2026: "sem o Claude, um robô de verdade").
//
// Este arquivo só DECIDE: recebe o que foi lido de um arquivo da pasta "Claudio Secretario" (texto do PDF por página,
// o XML, o OFX, o TXT do SPED/Sintegra, as linhas da planilha) e a lista de empresas, e devolve para onde ele vai, com
// que nome, com que confiança e por quê. Não lê disco, não move nada: quem lê e move é o arquivador-novo.js. Por isso
// tudo aqui é testável (teste-arquivador-regras.js).
//
// As regras são as da rotina antiga (repositório GUSTAVO\claudio, só leitura), escritas como código:
//   Dicionário   = 00-DICIONARIO-CANONICO.md          03  = 03-LOCALIZADOR-ROTEADOR.md
//   04  = 04-ESPECIALISTA-CONTABIL.md                 04b = 04b-ESPECIALISTA-FOLHA-SOCIETARIO.md
//   05/05a..05f = especialistas fiscais               05d = 05d-FISCAL-MODULO-COMUM.md
//   xml_lote = ferramentas/xml_lote.py (o arquivamento de XML em lote, que já era determinístico)
// Cada regra cita de onde veio. O que a rotina decidia "lendo como um humano" (PDF escaneado, PDF com vários documentos,
// documento sem título conhecido) aqui não é adivinhado: vai para NÃO IDENTIFICADOS com o motivo, ou fica na origem.
'use strict';

const LIMIAR = 0.85;                       // Dicionário §3: confiança mínima do Roteador
const OCR_TETO = 0.9;                      // texto lido por OCR nunca passa disso (pedido de 21/10/2026)
const ESCRITORIO = new Set(['27872981000113', '03231837600']);   // 03: CNPJ da Nilma e CPF da contadora nunca são o cliente
const RAIZ_CLIENTES = 'G:\\Meu Drive\\2026';                    // Dicionário §1(c)
// a raiz pelo ano da COMPETÊNCIA (Vitor, 23/10/2026, a migração de ~320 mil arquivos: "opção (b)"): G:\Meu Drive\<AAAA>\
// <cód> - <nome>\…, de ANO_MINIMO até o ano atual; sem ano dedutível nunca vai para 2026 por padrão
const ANO_MINIMO = 2015;
const ANO_DAS_PASTAS = 2026;   // o ano das pastas que o cadastro recebe em "pastas" (as de RAIZ_CLIENTES)
const VIDEO_AUDIO = /\.(mp4|mov|avi|mkv|wmv|webm|mp3|wav|m4a)$/i; // Dicionário §1: ignorados, ficam na origem
const CONTEINER = /\.(zip|rar|7z)$/i;                            // Dicionário §1: extraídos, cada arquivo vira item

// ---------------------------------------------------------------------------------------------------------------------
// texto
// ---------------------------------------------------------------------------------------------------------------------
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const so = s => String(s == null ? '' : s).replace(/\D/g, '');
const dois = n => String(n).padStart(2, '0');
/** Maiúsculas, sem acento, espaços colapsados: é nisso que as regras procuram. */
const norm = s => semAcento(s).toUpperCase().replace(/[ \t\u00a0]+/g, ' ').replace(/(\d) ?\/ ?(?=\d)/g, '$1/');   // "01 / 01 / 2026" (BB) = "01/01/2026"
/** Só letras e números (para comparar nomes de empresa: "A7 COMÉRCIO DE VEÍCULOS LTDA." = "A7COMERCIODEVEICULOSLTDA"). */
// o robô do Gmail grava "&" e "'" no nome da pasta como 0026 e 0027 ("MORONI 0026 XAVIER", "ANTONIA0027S LTDA")
const chaveNome = s => semAcento(String(s == null ? '' : s).replace(/0026/g, '&').replace(/0027/g, "'")).toUpperCase().replace(/[^A-Z0-9]/g, '');

const SUFIXOS = /(\s*[-–]?\s*\b(LTDA\.?|ME|EPP|EIRELI|S\.?\s?\/?\s?A\.?|CIA\.?|& CIA\.?)\s*)+$/;
/** Dicionário §5.2: nome de fornecedor/emissor para pasta e nome de arquivo. */
function nomeNormalizado(razao) {
  let t = String(razao || '').toUpperCase();                         // 2: maiúsculas, preservando acentos
  t = t.replace(/\b(FILIAL\s*\d+|\d{4}-\d{2})\s*$/, '');           // 4b: identificação de filial sai do nome
  t = t.replace(/[.,;/\\|"']/g, ' ').replace(/\s+/g, ' ').trim();   // 4a: pontuação interna vira espaço
  for (let i = 0; i < 3; i++) t = t.replace(SUFIXOS, '').trim();    // 3: sufixos societários no fim
  return t.replace(/[\s-]+$/, '').trim();
}
/** Nome que pode ir para o disco (Windows). */
const nomeSeguro = s => String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');

// ---------------------------------------------------------------------------------------------------------------------
// datas e valores (Dicionário §2)
// ---------------------------------------------------------------------------------------------------------------------
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MES_CURTO = MESES.map(m => m.slice(0, 3));
const anoOk = a => a >= 2000 && a <= 2099;
function mesDoNome(t) {
  const u = norm(t);
  let i = MESES.indexOf(u);
  if (i < 0) i = MES_CURTO.indexOf(u.slice(0, 3));
  return i < 0 ? null : i + 1;
}
/** { mes, ano } → "MM-AAAA" ([MÊS E ANO]). */
const mesAno = c => (c ? dois(c.mes) + '-' + c.ano : null);
/** "dd/mm/aaaa" → "DD-MM-AAAA" ([DATA]); null se não for data. */
function dataBr(t) {
  // "07.16.26283" não é data: segue procurando; "2026-01-30" (ISO, comprovante PIX do Sicoob) também vale
  const re = /(?<!\d)(\d{2})[/.-](\d{2})[/.-](\d{4})(?!\d)|(\d{2})\/(\d{2})\/(\d{4})|(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(String(t || '')))) {
    const d = +(m[1] || m[4] || m[9]), me = +(m[2] || m[5] || m[8]), a = +(m[3] || m[6] || m[7]);
    if (d >= 1 && d <= 31 && me >= 1 && me <= 12 && anoOk(a)) return dois(d) + '-' + dois(me) + '-' + a;
  }
  return null;
}
/** "1.917,42" → "R$1917,42" ([VALOR]); null se não for valor. */
function valorBr(t) {
  // o PDF cola números ("15.869,950,000,0015.869,95"): o 1º valor bem formado, sem exigir separação depois
  const m = /(?<![\d.])(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/.exec(String(t || ''));
  return m ? 'R$' + m[1].replace(/\./g, '') + ',' + m[2] : null;
}

/** A competência escrita num texto: "09/2026", "setembro/2026", "SET/2026", "09.2026". */
function competenciaSolta(t) {
  const u = norm(t);
  // sem \b no fim: o PDF cola campos ("setembro/202620/10/2026"); "20/10/2026" não vira "10/2026" (precedido de "/")
  let m = /(?<![\d/])(0[1-9]|1[0-2])\s*[/.-]\s*(20\d{2})/.exec(u);
  if (m) return { mes: +m[1], ano: +m[2] };
  m = /\b(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*(?:DE\s*)?[/.,-]?\s*(20\d{2})/.exec(u);
  if (m) return { mes: mesDoNome(m[1]), ano: +m[2] };
  return null;
}

/** Período "dd/mm/aaaa a dd/mm/aaaa" escrito no documento (o mesmo critério do periodo-extrato.js). */
function periodoEscrito(t) {
  const u = norm(t);
  const D = '(\\d{2})[/.-](\\d{2})[/.-](\\d{4})';
  const res = [
    // "Movimentações desde o dia 01/01/2026 até o dia 31/07/2026" (Caixa)
    new RegExp('(?:PERIODO|EXTRATO\\s+(?:DE|DO\\s+PERIODO)|MOVIMENTACAO\\s+DE|MOVIMENTACOES\\s+DESDE|REFERENCIA)[^0-9\\n]{0,40}' + D + '[^0-9\\n]{1,25}?' + D),
    new RegExp('DATA\\s+INICIAL[^0-9\\n]{0,10}' + D + '[\\s\\S]{0,60}?DATA\\s+FINAL[^0-9\\n]{0,10}' + D),
  ];
  for (const re of res) {
    const m = re.exec(u);
    if (!m) continue;
    const de = { dia: +m[1], mes: +m[2], ano: +m[3] }, ate = { dia: +m[4], mes: +m[5], ano: +m[6] };
    if (de.mes < 1 || de.mes > 12 || ate.mes < 1 || ate.mes > 12 || !anoOk(de.ano) || !anoOk(ate.ano)) continue;
    return { de, ate };
  }
  return null;
}

/** Competência pelo nome do arquivo: "07-2026", "07.2026", "072026", "202607", "SETEMBRO 2026", "AGO2026". */
function competenciaDoNome(nome) {
  const u = norm(String(nome || '').replace(/\.[a-z0-9]{2,4}$/i, ''));
  let m = /(?:^|[^0-9])(0[1-9]|1[0-2])[-._ ](20\d{2})(?![0-9])/.exec(u);
  if (m) return { mes: +m[1], ano: +m[2] };
  m = /(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[ ._-]*(?:DE[ ._-]*)?(20\d{2})(?![0-9])/.exec(u);
  if (m) return { mes: mesDoNome(m[1]), ano: +m[2] };
  m = /(?:^|[^0-9])(0[1-9]|1[0-2])(20\d{2})(?![0-9])/.exec(u);
  if (m) return { mes: +m[1], ano: +m[2] };
  m = /(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(?![0-9])/.exec(u);
  if (m) return { mes: +m[2], ano: +m[1] };
  return null;
}
/** Competência pela pasta de mês que o robô do Gmail e o nads criam ("Claudio Secretario\2026-09\<cliente>"). */
function competenciaDaPasta(rel) {
  for (const p of partesDoCaminho(rel).slice(0, -1).reverse()) {
    const m = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(p);
    if (m) return { mes: +m[2], ano: +m[1] };
  }
  return null;
}
const partesDoCaminho = rel => String(rel || '').split(/[\\/]+/).filter(Boolean);
/**
 * O ano (e o mês, quando há) pelas pastas de origem (23/10/2026, a migração): "2024", "03.2025", "2026-03", "2026\03".
 * A pasta mais funda vale. Fora as do cliente ("0010 - …") e as que só têm o ano no meio de outro nome.
 */
function anoDaPasta(rel) {
  const partes = partesDoCaminho(rel).slice(0, -1);
  for (let i = partes.length - 1; i >= 0; i--) {
    const p = partes[i].trim();
    let m = /^(20\d{2}|19\d{2})$/.exec(p);
    if (m) { const prox = partes[i + 1] && /^(0[1-9]|1[0-2])$/.exec(partes[i + 1].trim()); return prox ? { ano: +m[1], mes: +prox[1] } : { ano: +m[1] }; }
    m = /^(0[1-9]|1[0-2])[.\-_ ](20\d{2})$/.exec(p);
    if (m) return { ano: +m[2], mes: +m[1] };
    m = /^(20\d{2})[.\-_ ](0[1-9]|1[0-2])$/.exec(p);
    if (m) return { ano: +m[1], mes: +m[2] };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// CNPJ / CPF
// ---------------------------------------------------------------------------------------------------------------------
function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +d[12] && calc(13) === +d[13];
}
function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === +d[9] && calc(10) === +d[10];
}
/**
 * Todos os CNPJ/CPF de um texto, na ordem em que aparecem (só os de dígito verificador certo). CNPJ formatado ou com 14
 * dígitos soltos; CPF só formatado (11 dígitos soltos é qualquer coisa: telefone, conta). 03: nunca montar um CNPJ
 * juntando dígitos do nome.
 */
function documentosDoTexto(t) {
  const s = String(t || '');
  const achados = [];
  const re = /(?<![\d./-])(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14})(?![\d])/g;
  let m;
  while ((m = re.exec(s))) {
    const d = so(m[1]);
    if ((d.length === 14 && cnpjValido(d)) || (d.length === 11 && cpfValido(d))) achados.push({ doc: d, pos: m.index });
  }
  // "053.997.059/0001-62": o Bradesco imprime o CNPJ com um zero à frente (15 dígitos)
  const re15 = /(?<![\d])0(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})(?![\d])/g;
  while ((m = re15.exec(s))) {
    const d = m.slice(1, 6).join('');
    if (cnpjValido(d)) achados.push({ doc: d, pos: m.index });
  }
  return achados.sort((a, b) => a.pos - b.pos);
}
/** Raiz de CNPJ impressa sozinha ("CPF/CNPJ do Empregador 11.536.337", guia do FGTS Digital). */
function raizesDoTexto(t) {
  const out = [];
  const re = /(?<![\d./-])(\d{2}\.\d{3}\.\d{3})(?![\d./-])/g;
  let m;
  while ((m = re.exec(String(t || '')))) out.push(so(m[1]));
  return out;
}
/** CNPJ mascarado "22.***.579/****-**" (guia estadual da internet): dígitos visíveis por posição. */
function mascarasDoTexto(t) {
  const out = [];
  const re = /(\d{2}|\*\*)\.(\d{3}|\*{3})\.(\d{3}|\*{3})\/(\d{4}|\*{4})-(\d{2}|\*\*)/g;
  let m;
  while ((m = re.exec(String(t || '')))) { if (m[0].includes('*')) out.push(m.slice(1, 6).join('')); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// cadastro de empresas (03 regra 1 e regra 3; Dicionário §2.1)
// ---------------------------------------------------------------------------------------------------------------------
const REGIMES = { SIMPLES: 'SIMPLES NACIONAL', PRESUMIDO: 'LUCRO PRESUMIDO', REAL: 'LUCRO REAL', MEI: 'MEI', FISICA: 'PESSOA FISICA', ISENTAS: 'ISENTA', DOMESTICAS: 'DOMESTICA' };
/** Dicionário §2.1: texto da planilha → regime canônico. Aceita também o canônico e os nomes do core do nads. */
function regimeCanonico(t) {
  const k = chaveNome(t);
  if (!k) return null;
  for (const [de, para] of Object.entries(REGIMES)) if (k === de || k === chaveNome(para)) return para;
  if (k === 'SIMPLESNACIONAL') return 'SIMPLES NACIONAL';
  if (k === 'ISENTA' || k === 'IMUNE') return 'ISENTA';
  if (k === 'PESSOAFISICA') return 'PESSOA FISICA';
  if (k === 'DOMESTICA') return 'DOMESTICA';
  return undefined;   // fora da tabela: VOCABULARIO_AUSENTE
}

// 03: decisões do responsável que valem sem perguntar de novo.
// Os códigos vêm da planilha antiga. Com o cadastro do nads como fonte, o código pode ter mudado de dono (a ZELO era a 591
// na planilha; no Entregas a 591 é a AAP INTERMEDIAÇÕES e a ZELO é a 602): por isso cada linha leva o nome, e quem decide
// é confirmado(), que confere o nome e, se o código mudou, acha o código atual pelo nome (único) — senão não usa.
const DOC_CONFIRMADO = { '42460727615': [62, 'CARLOS LUCAS MENDES'], '36857858691': [424, 'JOELFLOR PEREIRA'],   // (03)
  // 23/10/2026 (Vitor, pelo coordenador: "Joelflor 422 × 424: siga a regra confirmada (424)"): o CNPJ da JOELFLOR PEREIRA
  // DA ROCHA LTDA (422, inativa no Entregas, sem pasta no Drive) também vai para a 424
  '17683269000112': [424, 'JOELFLOR PEREIRA'] };
// a ZELO (matriz e filiais na mesma pasta) saiu daqui em 23/10/2026 (Vitor: "o código da ZELO mudou para 591"): vale o cadastro
const RAIZ_MESMA_PASTA = {};
const APELIDOS = [                                                          // 03: "Apelidos confirmados pelo responsável"
  { re: /\bFITO A\b(?!\s*LIMENTOS)/, codigo: 309, nome: 'FITO ALIMENTOS' },
  // 23/10/2026 (Vitor): "FITO IND…" / "FITO IND. E COM." = 292 (a 294 tem o mesmo nome, inativa); "FITO A…" = 309
  { re: /\bFITO IND(USTRIA)?\b/, codigo: 292, nome: 'FITO INDUSTRIA', venceHomonimo: true },
  { re: /\bFACIL VISTORIAS\b/, codigo: 358, nome: 'MITRA TRANSPORTE' },
  { re: /\bGMM ATIVOS FLORESTAIS\b/, codigo: 356, nome: 'A7 COMERCIO' },
];
const CONTAS_CONFIRMADAS = [                                                // 03: "Contas bancárias confirmadas"
  // as contas da ZELO (BB 402427, Bradesco 33229) saíram em 23/10/2026: vale o cadastro (a conta já arquivada só dela)
  { banco: 'ITAU', conta: '996992', codigo: 356, nome: 'A7 COMERCIO' },
  { banco: 'BNB', conta: '626840', codigo: 356, nome: 'A7 COMERCIO' },
  { banco: 'SANTANDER', conta: '130098175', codigo: 356, nome: 'A7 COMERCIO' },
  { banco: 'SANTANDER', conta: '130099585', codigo: 515, nome: 'A7 MOBILE' },
];
const HASH_CONFIRMADO = {                                                   // 03: "Arquivos confirmados pelo responsável"
  dccd3c24ffca7f0a184c2f90ca210e3c9c75824a6efb66d4747a705040571a8e: 584, da752bfbd3b83177484ce280ff7f3e262d8f79075d81ef5e8529c52dc2ae4f32: 584,
  b5131c8dc30d5bb5f3b9f72bada2216c1c1afb1a4e1b43a0c910d69abafd0926: 584, dd56e069fa619f1f5a39c574d7f50bab50a50c635a7251b43aa163337e006e05: 584,
  '8bf8a1df2177acadf84e66aeff6314e6990bb801bf3da3313864e7852bc03dbe': 584, '88b8241f82eb6330052e19c71f48a76971f737126e43b6bd66d5267258b05985': 356,
  '50d18b3ac3eb39c03318a74c19f01436b0c842cf005875f469837731edb106d8': 358, '20e9669e6912372a6244a0a3a598a1a267c25a7611c4eb39845333e80d789b6c': 358,
  '7e7d073c73b34ac734566803ab78110f1ee97695c281a36fae5698a74538833e': 358, d822931f9674c02f5bc61d3801a24ce3af0f24fabab3cf68dc23c4fa03455909: 358,
};
HASH_CONFIRMADO.d378ba6934daa35ef03df5c440a8d3319356924ff51f81318f2cb4e9109b6a1e = 413;   // Relatório_Set_26.xlsx (Vitor, 23/10/2026)
const NOME_DO_HASH = { 584: 'IMOBILIARIOS M', 356: 'A7 COMERCIO', 358: 'MITRA TRANSPORTE', 413: 'BRAZILIAN FORESTRY' };
// Descartes confirmados pelo responsável (Vitor, 23/10/2026): vão para a QUARENTENA (nunca apagados), com linha no manifesto.
// Os registros de envio do emissor da MADEIREIRA ("env-lot=…", "Erro-…") e os 2 editais da Prefeitura de Rio Pardo de Minas.
const HASH_DESCARTE = Object.fromEntries([
  ['028a68a74d8caa4c0f467fc6acf818019496a492326c26c055b4e2be648f48bc', 'registro de envio do emissor'], ['73ae80fe26e4bbae825387d5c9e92b36a7b623c895e9f2b10a63a7cb2a6396a3', 'registro de envio do emissor'],
  ['9f9a21b15a3b45c63fee50c9ddb3871fb2c5d2d2e4eefd72615469dff1f790c0', 'registro de envio do emissor'], ['03134a61a35de451e31e6488eb4e29a55e5ac76ba7e69fc24de666de53137953', 'registro de envio do emissor'],
  ['193ff17418636c51577ed1566fad65c71d18487568645d620cae8c07b52ed393', 'registro de envio do emissor'], ['7d36ede5f1db040da0dbd14f1170d2d3010f07d41be4586e70b2e1c934a582dd', 'registro de envio do emissor'],
  ['ac3267c3dbb2b49d1a2235d734ec05f9fb84bfe90758c61f4d3c87d240623bbe', 'registro de envio do emissor'], ['45682ab4f3720981da8aee1eccc93d1df09c7585af416d62d7f655d0cefe73b8', 'registro de erro do emissor'],
  ['561a74ee0b27cdbd39e09df63fab6157f83830cb3b9ae767d2fcf7bbc3a91e83', 'edital de licitação da prefeitura'], ['02d945e9300c0e1d35e277682291fe755ed179688ca21f0a42cdd2458351ce5b', 'edital de licitação da prefeitura'],
]);

/** O código confirmado no 03, conferido contra o cadastro atual (null se o código não é mais daquela empresa e o nome não acha um só). */
function confirmado(codigo, nome, cad) {
  if (!cad || !nome) return codigo;
  const k = chaveNome(nome);
  const casa = c => c && [c.razao].concat(c.outrosNomes || []).some(n => chaveNome(n).includes(k));
  if (casa(cad.porCod.get(codigo))) return codigo;
  const outros = [...cad.porCod.values()].filter(casa).map(c => c.codigo);
  // matriz e filiais com o mesmo nome: fica a de menor código (a matriz, como "ZELO … - MATRIZ" 602)
  const matriz = outros.filter(c => /MATRIZ/.test(norm(cad.porCod.get(c).razao)));
  return outros.length === 1 ? outros[0] : matriz.length === 1 ? matriz[0] : null;
}

/**
 * A lista de empresas: linhas { codigo, razao, fantasia, doc, ie, regime } (a planilha da rotina e/ou o cadastro do
 * nads) e as pastas que já existem em G:\Meu Drive\2026 (nomes "<código> - <nome>").
 */
function montarCadastro(linhas, pastas) {
  const porCod = new Map(), porDoc = new Map(), porRaiz = new Map(), porNome = new Map(), porNomeEntregas = new Map();
  const add = (m, k, c) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(c); };
  for (const l of linhas || []) {
    const codigo = Number(l.codigo);
    if (!Number.isInteger(codigo) || codigo <= 1) continue;   // a linha 1 da planilha é a "Empresa EXEMPLO"
    const doc = so(l.doc);
    const reg = regimeCanonico(l.regime);
    const outrosNomes = (l.outrosNomes || []).map(n => String(n).trim()).filter(Boolean);
    porCod.set(codigo, { codigo, razao: String(l.razao || '').trim(), outrosNomes, fantasia: String(l.fantasia || '').trim(), doc, ie: so(l.ie), regime: reg === undefined ? undefined : reg, regimeTexto: l.regime || null, ativo: l.ativo !== false });
    for (const d of [doc].concat((l.outrosDocs || []).map(so))) {   // CPF e CNPJ do mesmo cliente (fontes diferentes)
      if (d.length === 14 || d.length === 11) add(porDoc, d, codigo);
      if (d.length === 14) add(porRaiz, d.slice(0, 8), codigo);
    }
    add(porNome, chaveNome(l.razao), codigo);
    if (l.nomeEntregas) add(porNomeEntregas, chaveNome(l.nomeEntregas), codigo);
    outrosNomes.forEach(n => add(porNome, chaveNome(n), codigo));
    if (l.fantasia && chaveNome(l.fantasia).length >= 6) add(porNome, chaveNome(l.fantasia), codigo);
  }
  const cad = { porCod, porDoc, porRaiz, porNome, porNomeEntregas };
  for (const [d, [c, nome]] of Object.entries(DOC_CONFIRMADO)) { const atual = confirmado(c, nome, cad); if (atual != null && porCod.has(atual)) porDoc.set(d, new Set([atual])); }
  // pastas no Drive: duas pastas com o mesmo código (ex.: "591 - AAP INTERMEDIACOES" e "591 - ZELO …") não servem a ninguém
  const pastasPorCod = new Map(), pastasDuplicadas = new Map();
  for (const p of pastas || []) {
    const m = /^(\d+)\s*-\s*/.exec(p);
    if (!m) continue;
    if (pastasPorCod.has(+m[1])) pastasDuplicadas.set(+m[1], (pastasDuplicadas.get(+m[1]) || [pastasPorCod.get(+m[1])]).concat(p));
    else pastasPorCod.set(+m[1], p);
  }
  return Object.assign(cad, { pastas: pastasPorCod, pastasDuplicadas, todasAsPastas: (pastas || []).slice() });
}
/** As pastas de cliente das outras raízes de ano (G:\Meu Drive\<AAAA>) e o mapa da migração no cadastro (23/10/2026). */
function comAnosEMapa(cad, pastasPorAno, mapaMigracao) {
  cad.pastasPorAno = pastasPorAno instanceof Map ? pastasPorAno : new Map(Object.entries(pastasPorAno || {}).map(([a, l]) => [+a, l]));
  cad._porAno = null;
  if (mapaMigracao) cad.mapaMigracao = mapaMigracao;
  return cad;
}

/** Os clientes de um CNPJ/CPF (03: 14 dígitos completos decidem sozinhos; raiz da tabela da ZELO vai para a matriz). */
function clientesDoDoc(doc, cad) {
  if (!doc || ESCRITORIO.has(doc)) return [];
  if (cad.porDoc.has(doc)) return [...cad.porDoc.get(doc)];
  if (doc.length === 14 && RAIZ_MESMA_PASTA[doc.slice(0, 8)]) { const [c, nome] = RAIZ_MESMA_PASTA[doc.slice(0, 8)]; const atual = confirmado(c, nome, cad); return atual != null ? [atual] : []; }
  return [];
}

/** Cliente pela pasta (ou contêiner) onde o arquivo estava: "356 A7 …", "2026-09\GRANMIX …", "SIEG 2026-09 - <nome>.zip". */
function clienteDaPasta(rel, cad) {
  const partes = partesDoCaminho(rel).slice(0, -1);
  const mapa = cad.mapaMigracao || null;
  for (const parte of partes.reverse()) {
    if (/^\d{4}-\d{2}$/.test(parte) || /^\d{6}/.test(parte)) continue;
    // 23/10/2026 (a migração): pasta de data ("03", "04.2025", "2026") não é código de cliente; a decisão do admin para a
    // pasta (o mapa da migração) vale primeiro; pasta de pessoa da equipe ou de área (FERNANDO, ADIVANIA, IMPORTAÇÃO,
    // OUTROS…) e pasta que junta matriz e filiais não dão o cliente
    if (/^\d{1,2}$/.test(parte) || /^\d{1,2}[.\-_ ]\d{4}$/.test(parte) || /^(19|20)\d{2}\b/.test(parte)) continue;
    const pm = mapa ? mapa.clienteDaPasta(parte) : undefined;
    if (pm !== undefined) { if (pm === null) continue; if (cad.porCod.has(pm.cliente)) return { codigo: pm.cliente, como: 'pasta "' + parte + '" = cliente ' + pm.cliente + ' (' + pm.porque + ')', forte: true }; continue; }
    if (mapa && mapa.semPista(parte)) continue;
    const m = /^(\d{1,4})\b/.exec(parte);
    if (m && cad.porCod.has(+m[1])) {
      // o código com o nome junto ("0010 - DORNAS HAVANA LTDA - ME") confere com o cadastro: pista forte (a migração)
      const resto = parte.slice(m[0].length).replace(/^\s*-?\s*/, '');
      const c = cad.porCod.get(+m[1]);
      const k = s => chaveNome(s).slice(0, 10);
      const confere = resto.length >= 4 && [c.razao].concat(c.outrosNomes || [], c.fantasia ? [c.fantasia] : []).some(n => k(n) && k(resto) && (k(n).startsWith(k(resto).slice(0, 8)) || k(resto).startsWith(k(n).slice(0, 8))));
      return { codigo: +m[1], como: 'código no nome da pasta "' + parte + '"' + (confere ? ' (o nome confere com o cadastro)' : ''), forte: confere };
    }
    const limpo = parte.replace(/\.(zip|rar|7z)$/i, '').replace(/^SIEG \d{4}-\d{2} - /i, '');
    const n = chaveNome(limpo);
    // uma palavra só ("FERNANDO", "FISCAL") não é nome de cliente (23/10/2026: a pasta FERNANDO da migração dava a 161)
    if (n.length >= 6 && norm(limpo).split(/[^A-Z0-9]+/).filter(w => w.length >= 2).length >= 2) {
      if (cad.porNome.has(n) && cad.porNome.get(n).size === 1) return { codigo: [...cad.porNome.get(n)][0], como: 'nome da pasta "' + parte + '"' };
      const cands = new Set();
      for (const [k, cs] of cad.porNome) if (k.length >= 6 && (k.startsWith(n) || n.startsWith(k))) cs.forEach(c => cands.add(c));
      if (cands.size === 1) return { codigo: [...cands][0], como: 'nome da pasta "' + parte + '"' };
      // 23/10/2026: o robô do SIEG nomeia a pasta e o lote ("SIEG AAAA-MM - <nome>.zip") com o nome do cliente no Entregas;
      // as filiais costumam ter a mesma razão no nads, mas no Entregas o nome é de um código só (TEOBALDO … LTDA = 299)
      const pe = cad.porNomeEntregas && cad.porNomeEntregas.get(n);
      if (pe && pe.size === 1) return { codigo: [...pe][0], como: 'nome do cliente no Entregas na pasta "' + parte + '" (lote do SIEG)' };
    }
  }
  return null;
}

/** Razão social do cadastro escrita no texto, inteira e única (03: "nome exato e único", só sem CNPJ no documento). */
// para comparar nomes: "&" = "E", número colado em letra separado ("3273-5DORNAS HAVANA" → "3273 5 DORNAS HAVANA")
const textoDeNome = s => ' ' + norm(s).replace(/&/g, ' E ').replace(/(\d)(?=[A-Z])/g, '$1 ').replace(/([A-Z])(?=\d)/g, '$1 ').replace(/[^A-Z0-9]+/g, ' ').trim() + ' ';
function clientesPeloNomeNoTexto(texto, cad) {
  const t = textoDeNome(texto);
  const achados = new Map();   // código → trecho que casou
  for (const [codigo, c] of cad.porCod) {
    if (ESCRITORIO.has(c.doc)) continue;   // 03: o escritório (Nilma) aparece em honorários, assinatura etc.: nunca é o cliente pelo nome
    for (const nome of [c.razao].concat(c.outrosNomes || [])) {   // o nome do nads, o do Entregas e o da planilha
      const r = textoDeNome(nome);
      if (r.trim().length >= 8 && t.includes(r)) { if (!achados.has(codigo) || r.length > achados.get(codigo).length) achados.set(codigo, r); continue; }
      const sem = textoDeNome(nomeNormalizado(nome));
      if (sem.trim().length >= 10 && sem.trim().split(' ').length >= 2 && t.includes(sem) && !achados.has(codigo)) achados.set(codigo, sem);
    }
  }
  // "ADERLEI DOS SANTOS" (pessoa física) dentro de "ADERLEI DOS SANTOS E CIA LTDA": vale o nome mais longo
  for (const [c1, r1] of [...achados]) for (const [c2, r2] of achados) if (c1 !== c2 && r2.length > r1.length && r2.includes(r1)) { achados.delete(c1); break; }
  for (const a of APELIDOS) if (a.re.test(t)) {
    const c = confirmado(a.codigo, a.nome, cad);
    if (c == null) continue;
    achados.set(c, String(c));
    // o apelido decide entre códigos com a MESMA razão social (ex.: FITO 292 × 294)
    if (a.venceHomonimo) { const k = chaveNome(cad.porCod.get(c).razao); for (const o of [...achados.keys()]) if (o !== c && cad.porCod.get(o) && chaveNome(cad.porCod.get(o).razao) === k) achados.delete(o); }
  }
  return [...achados.keys()];
}

// ---------------------------------------------------------------------------------------------------------------------
// bancos e operadoras (Dicionário §5.1 — lista fechada; a pasta é exatamente o canônico)
// ---------------------------------------------------------------------------------------------------------------------
const BANCOS = [
  ['SICOOB', /\bSICOOB\b|\bBANCOOB\b|\bSISBR\b/], ['BNB', /BANCO DO NORDESTE|\bBNB\b/], ['BRADESCO', /BRADESCO/],
  ['BANCO DO BRASIL', /BANCO DO BRASIL|\bSISBB\b|BB\.COM\.BR|EXTRATO (MENSAL|CONSOLIDADO) \/ POR PERIODO|OUROCAP|BRASILCAP|\bBB SEGUROS\b/],
  ['CAIXA', /CAIXA ECONOMICA|\bCAIXA\.GOV\b/], ['SANTANDER', /SANTANDER/], ['SICREDI', /\bSICREDI\b/], ['BTG PACTUAL', /\bBTG\b/],
  ['UNICRED', /\bUNICRED\b/], ['BANESE', /\bBANESE\b/], ['BANRISUL', /\bBANRISUL\b/], ['SAFRA', /BANCO SAFRA/],
  ['INTER', /BANCO INTER\b|BANCOINTER|INTER&CO/], ['NUBANK', /NU PAGAMENTOS|NUBANK/], ['C6', /\bC6 BANK\b|\bBANCO C6\b/],
  ['CORA', /CORA SCD|CORA SOCIEDADE|BANCO CORA/], ['MERCADO PAGO', /MERCADO ?PAGO/], ['PAGBANK', /PAGSEGURO|PAGBANK/],
  ['STONE', /STONE PAGAMENTOS|STONE INSTITUI/], ['CIELO', /\bCIELO\b/], ['REDE', /REDECARD|\bREDE ITAU\b|\bITAU REDE\b/],
  ['GETNET', /\bGETNET\b/], ['INFINITEPAY', /INFINITE ?PAY/], ['SUMUP', /\bSUMUP\b/], ['BIGCARD', /\bBIG ?CARD\b/],
  ['ITAU', /ITAU UNIBANCO|\bBANCO ITAU\b|\bITAU\b/],
];
// Linha de lançamento cita banco dos outros ("PIX RECEBIDO REM: …", "TED … PAGSEGURO"): não vale para dizer de quem é o
// documento (a mesma lição do bancos.js do robô).
const LINHA_DE_LANCAMENTO = /\b(REM|DES|REMET|DEST|FAVORECIDO|PIX|TED|DOC|TRANSF|TRANSFERENCIA|PAGTO|BENEFICIARIO|INSTITUICAO EMISSORA|INSTITUICAO RECEBEDORA|BANCO DESTINO|BANCO DESTINATARIO|BANCO ORIGEM|BANCO CEDENTE|CEDENTE|SACADO|BCO|RECEBID[AO]|ENVIAD[AO])\b/;
// Assinaturas de layout (o texto do banco não traz o nome): aprendidas com os extratos já arquivados e com a pasta
// EXEMPLOS DE ARQUIVOS da rotina (Dicionário §1, "Regra de identificação por exemplos").
const LAYOUTS = [   // cabeçalho/título próprio do layout: vale no texto todo
  ['BRADESCO', /^EXTRATO DE: AG: \| CC:/m], ['BRADESCO', /ALO BRADESCO|BRADESCO NET EMPRESA|TITULOS PAGOS POR CONTA CREDITO/],
  ['MERCADO PAGO', /LIBERACAO DE DINHEIRO|DETALHE DOS MOVIMENTOS/], ['GETNET', /EXTRATO DE VENDAS POR CARTOES/],
  ['INFINITEPAY', /^INFINITE ID\b/m], ['REDE', /EXTRATO PARA SIMPLES CONFERENCIA|TOTAL BRUTO REDE|TAXAS REDE|^REDE CONSOLIDADO/m],
  ['BANCO DO BRASIL', /^[\s\S]{0,150}RENDE FACIL/], ['CAIXA', /CONTA CORRENTE PESSOA (JURIDICA|FISICA) CAIXA/],
  ['CAIXA', /CONTA:\s*\d{4}\s*[/|]\s*\d{3,4}\s*[/|]\s*\d{12}-\d/],   // agência/operação/conta da Caixa ("3411/1292/000578855317-9")
  ['BANCO DO BRASIL', /^CONSULTAS - (EXTRATO|EMISSAO DE COMPROVANTES)|^G\d{16}$|DT\. BALANCETE/m], ['BNB', /\bFNE\b|INTERNET BANKING BNB|BNB\.GOV\.BR/],
];
const ASSINATURAS = [   // razão social da instituição: só fora das linhas de lançamento (um PIX "de" alguém do Nubank não é extrato do Nubank)
  ['INFINITEPAY', /\bCLOUDWALK\b/], ['NUBANK', /NU PAGAMENTOS S\.?A/], ['PAGBANK', /PAGSEGURO INTERNET INSTITUICAO DE PAGAMENTO/],
  ['STONE', /STONE INSTITUICAO DE PAGAMENTO/], ['BNB', /BANCO DO NORDESTE DO BRASIL S\.?A/],
];

/** O banco/operadora do documento: o primeiro que aparece no cabeçalho fora das linhas de lançamento. */
const SO_MAQUININHA = new Set(['CIELO', 'REDE', 'GETNET', 'SUMUP', 'BIGCARD']);
/** soConta: extrato/comprovante/aplicação — operadora que só faz maquininha (Cielo, Rede, Getnet…) não é a conta. */
function bancoDoTexto(texto, soConta) {
  const tudo = norm(texto);
  const u = tudo.slice(0, 2500);
  for (const [b, re] of LAYOUTS) if (re.test(tudo)) return b;
  const semLancamentos = tudo.split('\n').filter(l => !LINHA_DE_LANCAMENTO.test(l)).join('\n');
  for (const [b, re] of ASSINATURAS) if (re.test(semLancamentos)) return b;
  let melhor = null;
  const linhas = u.split('\n');
  let pos = 0;
  for (const l of linhas) {
    if (!LINHA_DE_LANCAMENTO.test(l)) {
      for (const [b, re] of BANCOS) {
        if (soConta && SO_MAQUININHA.has(b)) continue;
        const m = re.exec(l);
        if (m && (!melhor || pos + m.index < melhor.pos)) melhor = { banco: b, pos: pos + m.index };
      }
    }
    pos += l.length + 1;
  }
  return melhor ? melhor.banco : null;
}
function bancoDoNome(nome) {
  const u = ' ' + norm(nome).replace(/[^A-Z0-9]+/g, ' ') + ' ';
  const atalhos = [['BANCO DO BRASIL', / (BB|BRASIL) /], ['ITAU', / ITAU /], ['CAIXA', / CAIXA | CEF /]];
  for (const [b, re] of BANCOS) if (re.test(u)) return b;
  for (const [b, re] of atalhos) if (re.test(u)) return b;
  return null;
}
const BANCO_POR_CODIGO = { '001': 'BANCO DO BRASIL', '004': 'BNB', '033': 'SANTANDER', '041': 'BANRISUL', '047': 'BANESE', '077': 'INTER', '104': 'CAIXA', '208': 'BTG PACTUAL', '237': 'BRADESCO', '260': 'NUBANK', '290': 'PAGBANK', '323': 'MERCADO PAGO', '336': 'C6', '341': 'ITAU', '403': 'CORA', '422': 'SAFRA', '748': 'SICREDI', '756': 'SICOOB', '136': 'UNICRED', '197': 'STONE' };

// ---------------------------------------------------------------------------------------------------------------------
// XML (porte do ferramentas/xml_lote.py; 05d §1b)
// ---------------------------------------------------------------------------------------------------------------------
/** Leitor de XML mínimo: árvore { tag, filhos, texto }, sem namespace no nome da tag. Não precisa de dependência. */
function lerXml(s) {
  const raiz = { tag: '#', filhos: [], texto: '' };
  const pilha = [raiz];
  const ent = t => t.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()] || (e[1] === 'x' || e[1] === 'X' ? String.fromCharCode(parseInt(e.slice(2), 16)) : String.fromCharCode(+e.slice(1)))));
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  const texto = String(s || '').replace(/^\uFEFF/, '');
  if (!/^\s*</.test(texto)) return null;
  while ((m = re.exec(texto))) {
    const topo = pilha[pilha.length - 1];
    if (m[1] !== undefined) { topo.texto += m[1]; continue; }
    if (m[3]) {
      const tag = m[3].replace(/^.*:/, '');
      if (m[2]) { if (pilha.length > 1 && pilha[pilha.length - 1].tag === tag) pilha.pop(); else return null; continue; }
      const no = { tag, filhos: [], texto: '' };
      topo.filhos.push(no);
      if (!m[5]) pilha.push(no);
      continue;
    }
    if (m[6] !== undefined) topo.texto += ent(m[6]);
  }
  if (pilha.length !== 1) return null;
  return raiz.filhos[0] || null;
}
function* todos(no, tag) { for (const f of no.filhos) { if (f.tag === tag) yield f; yield* todos(f, tag); } }
const primeiro = (no, tag) => { if (!no) return null; for (const x of todos(no, tag)) return x; return null; };
/** Caminho de filhos diretos ("ide/nNF"); "//x" procura em qualquer profundidade. */
function achar(no, caminho) {
  if (!no) return null;
  if (caminho.startsWith('//')) return primeiro(no, caminho.slice(2));
  let atual = no;
  for (const p of caminho.split('/')) { atual = atual.filhos.find(f => f.tag === p); if (!atual) return null; }
  return atual;
}
function txt(no, ...caminhos) {
  for (const c of caminhos) { const x = achar(no, c); if (x && x.texto.trim()) return x.texto.trim(); }
  return null;
}
function docsDe(no) {
  if (!no) return [];
  const out = [];
  // ABRASF (NFS-e municipal) usa <Cnpj>/<Cpf>
  for (const t of ['CNPJ', 'CPF', 'Cnpj', 'Cpf']) for (const x of todos(no, t)) { const d = so(x.texto); if (d) out.push(d); }
  if (/^(CNPJ|CPF)$/i.test(no.tag)) out.unshift(so(no.texto));
  return out;
}
function nomesDe(raiz) {
  const out = {};
  for (const t of ['emit', 'dest', 'rem', 'exped', 'receb', 'toma', 'toma4', 'prest', 'Prestador', 'PrestadorServico', 'Tomador', 'TomadorServico']) {
    for (const el of todos(raiz, t)) {
      const ds = docsDe(el);
      let nm = null;
      for (const k of ['xNome', 'RazaoSocial', 'xFant']) { const x = primeiro(el, k); if (x && x.texto.trim()) { nm = x.texto.trim(); break; } }
      if (ds.length && nm && !(ds[0] in out)) out[ds[0]] = nm;
    }
  }
  return out;
}
const mesAnoIso = d => { const m = /^(\d{4})-(\d{2})/.exec(d || ''); return m ? m[2] + '-' + m[1] : null; };
const diaIso = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const nomeEvento = d => semAcento(d || '').toUpperCase().replace(/\s+/g, ' ').trim();
const numChave = ch => (ch && /^\d{44}$/.test(ch) ? String(+ch.slice(25, 34)) : null);
/** A "chave" da NFS-e no índice de chaves (23/10/2026): prestador + número — o SIEG grava "nfse-<prestador>-<número>.xml". */
const chaveDaNfse = (prestador, n) => (prestador && n != null && String(n) !== '' ? 'NFSE:' + prestador + ':' + (/^\d+$/.test(String(n)) ? String(+n) : String(n)) : null);

/** O que o XML é: { tipo, sub, nome, emit, partes, evento, nomes, competencia } ou { erro }. */
function classificarXml(textoXml) {
  const raiz = lerXml(textoXml);
  if (!raiz) return { erro: 'CONTEUDO_ILEGIVEL' };
  const r = _classificarXml(raiz);
  if (!r) return { erro: 'TIPO_XML_NAO_TRATADO', tag: raiz.tag };
  r.nomes = nomesDe(raiz);
  // a chave de acesso (índice de chaves, 23/10/2026): do evento, a do documento a que ele se refere; da nota, a dela
  if (!r.chave) r.chave = ((/Id="(?:NFe|CTe|MDFe)(\d{44})"/.exec(String(textoXml))) || [])[1] || txt(raiz, 'protNFe/infProt/chNFe', 'protCTe/infProt/chCTe', 'protMDFe/infProt/chMDFe') || null;
  return r;
}
function _classificarXml(raiz) {
  const tag = raiz.tag;
  // a inutilização de numeração (Vitor, 23/10/2026): o XML do cliente (o emitente), em <XML>\<modelo>\INUTILIZAÇÕES
  if (/^(procInut|inut|retInut)(NFe|CTe)$/.test(tag)) {
    const pedido = primeiro(raiz, 'inutNFe') || primeiro(raiz, 'inutCTe') || (/^inut/.test(tag) ? raiz : null);
    const inf = (pedido && primeiro(pedido, 'infInut')) || primeiro(raiz, 'infInut');
    const ret = primeiro(raiz, 'retInutNFe') || primeiro(raiz, 'retInutCTe') || (/^retInut/.test(tag) ? raiz : null);
    const infRet = ret ? primeiro(ret, 'infInut') : null;
    if (!inf && !infRet) return null;
    const de = inf || infRet;
    const mod = txt(de, 'mod') || (/CTe$/.test(tag) ? '57' : '55');
    const tipo = { 55: 'NF-e', 65: 'NFC-e', 57: 'CT-e' }[mod];
    const ini = txt(de, 'nNFIni', 'nCTIni'), fim = txt(de, 'nNFFin', 'nCTFin'), ano = txt(de, 'ano');
    const quando = (infRet && txt(infRet, 'dhRecbto')) || null;
    const cnpj = so(txt(de, 'CNPJ') || txt(infRet, 'CNPJ') || '');
    if (!tipo || !ini || !cnpj) return null;
    const faixa = ini === fim || !fim ? String(+ini) : (+ini) + ' A ' + (+fim);
    const data = quando && mesAnoIso(quando) ? quando : ano ? '20' + String(ano).slice(-2) + '-01-01' : null;
    if (!data) return null;
    return { tipo, sub: 'INUTILIZAÇÕES', nome: (quando && diaIso(quando) ? diaIso(quando) : '20' + String(ano).slice(-2)) + ' - INUTILIZACAO ' + tipo + ' ' + faixa + (txt(de, 'serie') ? ' SERIE ' + txt(de, 'serie') : '') + '.xml', emit: [cnpj], partes: [cnpj], data, inutilizacao: true };
  }
  if (tag === 'nfeProc' || tag === 'NFe') {
    const inf = primeiro(raiz, 'infNFe') || (raiz.tag === 'infNFe' ? raiz : null);
    if (!inf) return null;
    const tipo = { 55: 'NF-e', 65: 'NFC-e' }[txt(inf, 'ide/mod')];
    const n = txt(inf, 'ide/nNF'), d = txt(inf, 'ide/dhEmi', 'ide/dEmi');
    if (!tipo || !n || !mesAnoIso(d)) return null;
    const emit = docsDe(achar(inf, 'emit')).slice(0, 1);
    return { tipo, sub: '', nome: mesAnoIso(d) + '_' + tipo + '_' + (+n) + '.xml', emit, partes: emit.concat(docsDe(achar(inf, 'dest'))), data: d };
  }
  if (tag === 'cteProc' || tag === 'CTe') {
    const inf = primeiro(raiz, 'infCte');
    if (!inf) return null;
    const n = txt(inf, 'ide/nCT'), d = txt(inf, 'ide/dhEmi');
    if (!n || !mesAnoIso(d)) return null;
    const emit = docsDe(achar(inf, 'emit')).slice(0, 1);
    let partes = emit.slice();
    for (const p of ['rem', 'dest', 'exped', 'receb', 'ide/toma4']) partes = partes.concat(docsDe(achar(inf, p)));
    // o tomador do serviço: <toma3><toma> 0 remetente, 1 expedidor, 2 recebedor, 3 destinatário; ou <toma4> com o CNPJ
    const papel = { 0: 'rem', 1: 'exped', 2: 'receb', 3: 'dest' }[txt(inf, 'ide/toma3/toma', 'ide/toma03/toma')];
    const tomador = (papel ? docsDe(achar(inf, papel)) : docsDe(achar(inf, 'ide/toma4'))).slice(0, 1);
    return { tipo: 'CT-e', sub: '', nome: mesAnoIso(d) + '_CT-e_' + (+n) + '.xml', emit, partes, tomador, data: d };
  }
  if (tag === 'cteOSProc' || tag === 'CTeOS') {
    // CT-e OS (modelo 67, transporte de pessoas/valores): na pasta do CT-e, com "CT-e OS" no nome; o tomador é <toma>
    const inf = primeiro(raiz, 'infCte');
    if (!inf) return null;
    const n = txt(inf, 'ide/nCT'), d = txt(inf, 'ide/dhEmi');
    if (!n || !mesAnoIso(d)) return null;
    const emit = docsDe(achar(inf, 'emit')).slice(0, 1);
    return { tipo: 'CT-e', sub: '', nome: mesAnoIso(d) + '_CT-e OS_' + (+n) + '.xml', emit, partes: emit.concat(docsDe(achar(inf, 'toma'))), data: d };
  }
  // evento da NFS-e nacional (cancelamento etc.): <evento><infEvento><pedRegEvento><infPedReg> com a chave de 50 dígitos
  const ped = tag === 'evento' ? primeiro(raiz, 'infPedReg') : null;
  if (ped && txt(ped, 'chNFSe')) {
    const ch = txt(ped, 'chNFSe');
    const d = txt(ped, 'dhEvento') || txt(raiz, '//dhProc');
    const desc = txt(ped, '//xDesc');
    const n = /^\d{50}$/.test(ch) ? String(+ch.slice(23, 36)) : null;   // cLocEmi(7) ambGer(1) tpInsc(1) inscrição(14) nNFSe(13)…
    if (!(n && desc && diaIso(d))) return null;
    const emit = [ch.slice(9, 23)];
    const autor = [txt(ped, 'CNPJAutor'), txt(ped, 'CPFAutor')].filter(Boolean).map(so);
    return { tipo: 'NFS-e', sub: 'EVENTOS', nome: diaIso(d) + ' - ' + nomeEvento(desc) + ' NFS-e ' + n + '.xml', emit, partes: autor.concat(emit), evento: true, data: d, chave: ch };
  }
  if (['procEventoNFe', 'procEventoCTe', 'procEventoMDFe', 'evento', 'eventoCTe', 'eventoMDFe'].includes(tag)) {
    const inf = primeiro(raiz, 'infEvento');
    if (!inf) return null;
    const ch = txt(inf, 'chNFe', 'chCTe', 'chMDFe');
    // o tipo do documento a que o evento se refere: pelo modelo da chave (58 = MDF-e, 57/67 = CT-e); NFC-e fica com NF-e (xml_lote)
    const modelo = ch && /^\d{44}$/.test(ch) ? ch.slice(20, 22) : '';
    const tipo = modelo === '58' || tag.endsWith('MDFe') ? 'MDF-e' : (modelo === '57' || modelo === '67' || tag.endsWith('CTe') || achar(inf, 'chCTe')) ? 'CT-e' : 'NF-e';
    const desc = txt(inf, 'detEvento/descEvento', '//descEvento');
    const d = txt(inf, 'dhEvento');
    const n = numChave(ch);
    if (!(n && desc && diaIso(d))) return null;
    const emitChave = [ch.slice(6, 20)];
    const autor = [txt(inf, 'CNPJ'), txt(inf, 'CPF')].filter(Boolean).map(so);
    return { tipo, sub: 'EVENTOS', nome: diaIso(d) + ' - ' + nomeEvento(desc) + ' ' + tipo + ' ' + n + '.xml', emit: emitChave, partes: autor.concat(emitChave, docsDe(achar(inf, 'detEvento'))), evento: true, data: d, chave: ch };
  }
  if (['procinutnfe', 'inutnfe', 'retinutnfe'].includes(tag.toLowerCase())) {   // há emissor que grava "ProcInutNFe"
    const inf = primeiro(raiz, 'infInut');
    if (!inf) return null;
    const a = txt(inf, 'nNFIni'), z = txt(inf, 'nNFFin');
    const d = txt(raiz, '//dhRecbto');
    const doc = docsDe(inf).slice(0, 1);
    if (!(a && z && diaIso(d) && doc.length)) return null;
    return { tipo: 'NF-e', sub: 'EVENTOS', nome: diaIso(d) + ' - INUTILIZACAO NF-e ' + (+a) + ' A ' + (+z) + '.xml', emit: doc, partes: doc, data: d };
  }
  // NFS-e: padrão nacional (infNFSe) e ABRASF (InfNfse)
  let inf = primeiro(raiz, 'infNFSe') || (tag === 'infNFSe' ? raiz : null);
  if (inf) {
    const n = txt(inf, 'nNFSe');
    const d = txt(inf, 'DPS/infDPS/dhEmi', '//dhEmi', 'dhProc');
    const emit = (docsDe(achar(inf, 'emit')).length ? docsDe(achar(inf, 'emit')) : docsDe(primeiro(inf, 'prest'))).slice(0, 1);
    if (!n || !mesAnoIso(d)) return null;
    return { tipo: 'NFS-e', sub: '', nome: mesAnoIso(d) + '_NFS-e_' + (/^\d+$/.test(n) ? +n : n) + '.xml', emit, partes: emit.concat(docsDe(primeiro(inf, 'toma'))), data: d, chave: chaveDaNfse(emit[0], n) };
  }
  inf = primeiro(raiz, 'InfNfse');
  if (inf || /nfse/i.test(tag)) {
    if (!inf) return null;
    const n = txt(inf, 'Numero');
    const d = txt(inf, 'DataEmissao', '//DataEmissao');
    const emit = (docsDe(primeiro(inf, 'PrestadorServico')).length ? docsDe(primeiro(inf, 'PrestadorServico')) : docsDe(primeiro(inf, 'Prestador'))).slice(0, 1);
    if (!n || !mesAnoIso(d)) return null;
    return { tipo: 'NFS-e', sub: '', nome: mesAnoIso(d) + '_NFS-e_' + (/^\d+$/.test(n) ? +n : n) + '.xml', emit, partes: emit.concat(docsDe(primeiro(inf, 'TomadorServico')), docsDe(primeiro(inf, 'Tomador'))), data: d, chave: chaveDaNfse(emit[0], n) };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// pastas por regime (05a, 05b, 05c, 05e, 05f)
// ---------------------------------------------------------------------------------------------------------------------
const ARVORE = {
  'SIMPLES NACIONAL': { DAS: '01. DAS', DAE: '02. DAE', DOCS: '03. DOCUMENTOS FISCAIS', DESTDA: '04. DeSTDA', SINTEGRA: '05. SINTEGRA', PARC: '06. PARCELAMENTOS', REST: '07. RESTITUIÇÃO', DAM: '08. DAM', XML: '12. XML', LIVROS: '13. LIVROS FISCAIS', DEFIS: '14. DEFIS', DIRF: '15. DIRF', DARF: '16. DARF' },
  'LUCRO PRESUMIDO': { SPEDF: '01. SPED FISCAL', SPEDC: '02. SPED CONTRIBUIÇÕES', DOCS: '03. DOCUMENTOS FISCAIS', MIT: '04. MIT', DARF: '05. DARF', DAE: '06. DAE', DAPI: '07. DAPI', PARC: '08. PARCELAMENTOS', REST: '09. RESTITUIÇÃO', DAM: '10. DAM', XML: '14. XML', LIVROS: '15. LIVROS FISCAIS', ECF: '16. ECF', DIRF: '17. DIRF' },
  'LUCRO REAL': { SPEDF: '01. SPED FISCAL', SPEDC: '02. SPED CONTRIBUIÇÕES', DOCS: '03. DOCUMENTOS FISCAIS', DARF: '04. DARF', DAE: '05. DAE', DAPI: '06. DAPI', PARC: '07. PARCELAMENTOS', REST: '08. RESTITUIÇÃO', DAM: '10. DAM', XML: '14. XML', LIVROS: '15. LIVROS FISCAIS', ECF: '16. ECF', DIRF: '17. DIRF' },
  ISENTA: { DOCS: '01. DOCUMENTOS FISCAIS', DARF: '02. DARF', DAE: '03. DAE', DAM: '04. DAM', PARC: '05. PARCELAMENTOS', REST: '06. RESTITUIÇÃO', XML: '10. XML', DIRF: '11. DIRF' },
  'PESSOA FISICA': { DOCS: '01. DOCUMENTOS FISCAIS', DARF: '02. DARF', DAE: '03. DAE', DAM: '04. DAM', PARC: '05. PARCELAMENTOS', XML: '06. XML' },
  DOMESTICA: { DOCS: '01. DOCUMENTOS FISCAIS', DARF: '02. DARF', DAE: '03. DAE', DAM: '04. DAM', PARC: '05. PARCELAMENTOS', XML: '06. XML' },
};

// ---------------------------------------------------------------------------------------------------------------------
// tipos de PDF (título/cabeçalho decide — Dicionário §6; 04; 04b; 05a-05d)
// ---------------------------------------------------------------------------------------------------------------------
const TRIBUTO_POR_CODIGO = {   // DARF: código da receita → [TRIBUTO] (05d §4)
  '2089': 'IRPJ', '2362': 'IRPJ', '0220': 'IRPJ', '3373': 'IRPJ', '2372': 'CSLL', '2484': 'CSLL', '6012': 'CSLL',
  '8109': 'PIS', '6912': 'PIS', '2172': 'COFINS', '5856': 'COFINS', '0561': 'IRRF', '1708': 'IRRF', '3208': 'IRRF', '0588': 'IRRF', '5952': 'CSRF',
  '1099': 'INSS', '1138': 'INSS', '1082': 'INSS', '1646': 'INSS', '1657': 'INSS', '1213': 'INSS', '1141': 'INSS', '1170': 'INSS', '1176': 'INSS', '1191': 'INSS', '1196': 'INSS', '1200': 'INSS', '1162': 'INSS', '1769': 'INSS', '2141': 'INSS', '2158': 'INSS', '2985': 'INSS', '2991': 'INSS',
  '0190': 'CARNE-LEAO', '4600': 'GCAP', '6015': 'IRPF',
  '0289': 'INSS',   // auto de infração de INSS (Vitor, 23/10/2026: os 13 DARFs da OURO VERDE 409)
};

function linhaApos(u, rotulo, distancia) {
  const i = u.search(rotulo);
  return i < 0 ? '' : u.slice(i, i + (distancia || 160));
}

/** Os campos de uma guia (DAS/DARF/DAE/DAM/FGTS): período, vencimento, valor. */
function camposDaGuia(u) {
  let venc = dataBr(linhaApos(u, /PAGAR (ESTE DOCUMENTO )?ATE|VENCIMENTO:|DATA DE VENCIMENTO|VENCIMENTO|VALIDADE/, 120));
  // comprovante de arrecadação: "Período Apuração" e "Data de Vencimento" impressos colados ("30/04/202523/05/2025")
  const colados = /COMPROVANTE DE ARRECADACAO/.test(u) ? /(\d{2})\/(\d{2})\/(20\d{2})(\d{2}\/\d{2}\/20\d{2})/.exec(u) : null;
  if (colados) venc = dataBr(colados[4]);
  let valor = valorBr(linhaApos(u, /VALOR\s*TOTAL\s*DO\s*DOCUMENTO|VALOR A RECOLHER|TOTAL DA GUIA|VALOR\s*TOTAL|VALOR:|\bTOTAIS\b/, 200));
  if (colados) {
    // "Totais 7.186,7523,710,007.210,46": principal, juros, multa, total — o total é o último
    const linha = (/\bTOTAIS\n([^\n]+)/.exec(u) || [])[1] || '';
    const todos = [...linha.matchAll(/(\d{1,3}(?:\.\d{3})+|\d{1,3}),(\d{2})/g)];
    if (todos.length) { const t = todos[todos.length - 1]; valor = 'R$' + t[1].replace(/\./g, '') + ',' + t[2]; }
  }
  if (!valor) valor = valorBr(linhaApos(u, /\bTOTAL\b/, 200));
  let per = null;
  const pa = /PA:\s*(\d{2})\/(\d{4})/.exec(u) || /PERIODO\s*DE\s*APURACAO[^0-9A-Z]{0,40}(?:\d{2}\/)?(\d{2})\/(\d{4})/.exec(u);
  if (pa) per = { mes: +pa[1], ano: +pa[2] };
  if (!per && colados) per = { mes: +colados[2], ano: +colados[3] };
  if (!per) {
    const t = linhaApos(u, /PERIODO DE APURACAO|COMPETENCIA|MES ANO DE REFERENCIA|REFERENCIA/, 260);
    per = competenciaSolta(t.replace(/\d{2}\/\d{2}\/\d{4}/g, ' '));
  }
  return { vencimento: venc, valor, competencia: per };
}

/**
 * Regras de PDF, na ordem: a primeira cujo título bate decide o TIPO. Cada uma devolve o que precisa para montar o
 * destino; campo obrigatório ausente vira motivo (Dicionário §4.3, "Dados ausentes").
 */
const REGRAS_PDF = [
  // ---- guias fiscais (05a, 05d §4) ----
  { tipo: 'DAS', setor: 'FISCAL', re: /DOCUMENTO DE ARRECADACAO DO SIMPLES NACIONAL|\bDAS\s+DE\s+PARCELAMENTO\b/, fonte: '05a',
    campos: u => Object.assign(camposDaGuia(u), { parcelamento: /PARCELAMENTO/.test(u) }) },
  { tipo: 'DARF', setor: 'FISCAL', re: /DOCUMENTO\s*DE\s*ARRECADACAO\s*(DE\s*)?RECEITAS\s*FEDERAIS|\bDARF\b.*CODIGO DA RECEITA|REGISTRO DE ARRECADACAO DE DARF/, fonte: '05d §4',
    campos: u => {
      const c = camposDaGuia(u);
      const cod = /COMPOSICAO DO DOCUMENTO[\s\S]{0,200}?\n\s*(\d{4})/.exec(u) || /CODIGO\s*DA\s*RECEITA[^0-9]{0,40}(\d{4})/.exec(u) || /\n(\d{4})[A-Z]/.exec(u);
      let trib = cod ? TRIBUTO_POR_CODIGO[cod[1]] : null;
      if (!trib && /DCTFWEB|CP SEGURADOS|PREVIDENCI|CONTRIB(UICAO)? (PATRONAL|INDIVIDUAL)|GILRAT|SENAR/.test(u)) trib = 'INSS';
      if (!trib && /ESOCIAL|DOMESTIC/.test(u)) trib = 'ESOCIAL DOMESTICO';
      return Object.assign(c, { tributo: trib, parcelamento: /PARCELAMENTO|PGFN/.test(u) && !/DCTFWEB/.test(u) });
    } },
  { tipo: 'DAE', setor: 'FISCAL', re: /DOCUMENTO DE ARRECADACAO ESTADUAL/, fonte: '05d §4',
    campos: u => {
      const c = camposDaGuia(u);
      const trib = /TFAMG/.test(u) ? 'TFAMG' : /IPVA/.test(u) ? 'IPVA' : /TAXA/.test(u) && !/ICMS/.test(u) ? 'TAXA' : 'ICMS';
      if (!c.competencia) { const m = /(\d{2})\/(\d{4})/.exec(linhaApos(u, /MES ANO DE REFERENCIA/, 400)); if (m) c.competencia = { mes: +m[1], ano: +m[2] }; }
      if (!c.competencia && trib === 'TFAMG') { const m = /TRIMESTRE\s+(20\d{2})/.exec(u); if (m) c.ano = +m[1]; }
      return Object.assign(c, { tributo: trib, parcelamento: /PARCELAMENTO/.test(u) });
    } },
  { tipo: 'DAM', setor: 'FISCAL', re: /DOCUMENTO DE ARRECADACAO MUNICIPAL|\bDAM\b.*PREFEITURA|PREFEITURA[\s\S]{0,300}\bDAM\b/, fonte: '05d §4',
    campos: u => Object.assign(camposDaGuia(u), { tributo: /ITBI/.test(u) ? 'ITBI' : /\bISS/.test(u) ? 'ISS' : /IPTU/.test(u) ? 'IPTU' : /TAXA/.test(u) ? 'TAXA' : null }) },
  { tipo: 'FGTS', setor: 'FOLHA_SOCIETARIO', re: /GUIA DO FGTS DIGITAL|\bGFD\b - GUIA DO FGTS/, fonte: '04b',
    campos: u => { const c = camposDaGuia(u); const m = /(\d{2})\/(\d{4})\s*MENSAL/.exec(u) || /COMPETENCIA[\s\S]{0,300}?(\d{2})\/(20\d{2})/.exec(u); if (m) c.competencia = { mes: +m[1], ano: +m[2] }; return c; } },
  // ---- declarações (05a, 05b, 05c) ----
  { tipo: 'DEFIS', setor: 'FISCAL', re: /DECLARACAO DE INFORMACOES SOCIOECONOMICAS E FISCAIS|\bDEFIS\b/, fonte: '05a + 05 (DEFIS)',
    campos: u => ({ ano: anoCalendario(u), recibo: /RECIBO/.test(u.slice(0, 600)) }) },
  { tipo: 'DIRF', setor: 'FISCAL', re: /SISTEMA DIRF|\bDIRF\b|IMPOSTO SOBRE A RENDA RETIDO NA FONTE|FONTES PAGADORAS/, fonte: '05a/05b/05c/05e (DIRF)',
    campos: u => ({ ano: anoCalendario(u) || (m => m ? +m[1] : null)(/ANO-?CALENDARIO[\s\S]{0,80}?(20\d{2})/.exec(u)) }) },
  { tipo: 'ECF', setor: 'FISCAL', re: /ESCRITURACAO CONTABIL FISCAL|\bECF\b.*RECIBO|RECIBO DE ENTREGA.*\bECF\b/, fonte: '05b/05c',
    campos: u => ({ ano: anoCalendario(u), recibo: /RECIBO/.test(u.slice(0, 600)) }) },
  // ---- livros fiscais (05d §1c) ----
  { tipo: 'LIVRO_FISCAL', setor: 'FISCAL', re: /REGISTRO DE ENTRADAS|REGISTRO DE SAIDAS|REGISTRO DE APURACAO DO ICMS|APURACAO DO ICMS/, fonte: '05d §1c',
    campos: u => ({ livro: /REGISTRO DE ENTRADAS/.test(u) ? 'REGISTRO DE ENTRADAS' : /REGISTRO DE SAIDAS/.test(u) ? 'REGISTRO DE SAIDAS' : 'APURACAO ICMS', periodo: periodoEscrito(u) || periodoLivre(u) }) },
  // ---- documentos fiscais em PDF (05d §1) ----
  { tipo: 'NFC-e PDF', setor: 'FISCAL', re: /DANFE NFC-E|DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR|PORTALNFCE|\/NFCE\b|CONSUMIDOR NAO IDENTIFICADO/, fonte: '05d §1 (NFC-e em PDF)', campos: u => camposDeNota(u) },
  { tipo: 'NF-e PDF', setor: 'FISCAL', re: /\bDANFE\b|DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA/, fonte: '05d §1', campos: u => camposDeNota(u) },
  { tipo: 'CT-e PDF', setor: 'FISCAL', re: /\bDACTE\b|DOCUMENTO AUXILIAR DO CONHECIMENTO DE TRANSPORTE/, fonte: '05d §1', campos: u => camposDeNota(u) },
  { tipo: 'NFS-e PDF', setor: 'FISCAL', re: /\bDANFSE\b|NOTA FISCAL DE SERVICOS? ELETRONICA|\bNFS-E\b/, fonte: '05d §1 (NFS-e)', campos: u => camposDeNfse(u) },
  // relatório mensal de notas (05d §1: emitidas em EMITIDOS\RELATÓRIO MENSAL\[ANO]; recebidas em RECEBIDOS\RELATÓRIO MENSAL)
  { tipo: 'RELATORIO DE NOTAS', setor: 'FISCAL', re: /^[\s\S]{0,300}(NOTAS FISCAIS (DE )?(SAIDA|ENTRADA|CONSUMIDOR ELETRONICA)|RELATORIO DE CUPOM|RELATORIO (MENSAL )?DE NOTAS (FISCAIS )?(EMITIDAS|RECEBIDAS))/, fonte: '05d §1 (Relatório Mensal de Notas Emitidas/Recebidas)',
    campos: u => ({ recebidas: /^[\s\S]{0,300}(NOTAS FISCAIS (DE )?ENTRADA|NOTAS (FISCAIS )?RECEBIDAS)/.test(u), periodo: periodoEscrito(u) || periodoLivre(u.slice(0, 1500)) }) },
  // ---- folha e societário (04b) ----
  { tipo: 'CARTAO CNPJ', setor: 'FOLHA_SOCIETARIO', re: /COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL/, fonte: '04b (Documentos Constitutivos)', campos: () => ({}) },
  { tipo: 'DOC CONSTITUTIVO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,600}(CONTRATO SOCIAL|ALTERACAO CONTRATUAL|ATO CONSTITUTIVO|ESTATUTO SOCIAL|ATA DA? (ASSEMBLEIA|REUNIAO))/, fonte: '04b (Documentos Constitutivos)', campos: () => ({}) },
  { tipo: 'CERTIDAO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(CERTIDAO (NEGATIVA|POSITIVA|CONJUNTA|DE REGULARIDADE|DE DEBITOS)|CERTIFICADO DE REGULARIDADE DO FGTS)/, fonte: '04b (Certidões)',
    campos: u => ({ orgao: /FGTS|CAIXA ECONOMICA/.test(u) ? 'FGTS' : /TRABALHISTA|\bCNDT\b|JUSTICA DO TRABALHO/.test(u) ? 'TRABALHISTA' : /RECEITA FEDERAL|PROCURADORIA-GERAL DA FAZENDA|DIVIDA ATIVA DA UNIAO|TRIBUTOS FEDERAIS/.test(u) ? 'FEDERAL' : /PREFEITURA|MUNICIPIO DE|MUNICIPAL/.test(u) ? 'MUNICIPAL' : /ESTADO D[EO]|SECRETARIA DE ESTADO|FAZENDA ESTADUAL|SEFAZ/.test(u) ? 'ESTADUAL' : null,
      data: dataBr(linhaApos(u, /EMITIDA (AS|EM)|DATA DA EMISSAO|EMISSAO:|EMITIDA/, 160)) }) },
  // documentos POR FUNCIONÁRIO (Vitor, 23/10/2026): <cliente>\DEPARTAMENTO PESSOAL\FUNCIONÁRIOS\<NOME>\<tipo> <data>.pdf
  { tipo: 'DP FUNCIONARIO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(ATESTADO DE SAUDE OCUPACIONAL|TERMO DE RESCISAO DO CONTRATO DE TRABALHO|AVISO DE FERIAS|RECIBO DE FERIAS|AVISO PREVIO|CONTRATO (INDIVIDUAL )?DE TRABALHO|CONTRATO DE EXPERIENCIA|FICHA DE REGISTRO DE EMPREGADO)/, fonte: 'DP por funcionário (Vitor, 23/10/2026)',
    campos: u => camposDoFuncionario(u) },
  { tipo: 'FOLHA', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(FOLHA DE PAGAMENTO|RECIBO DE PAGAMENTO DE SALARIO|HOLERITE|RECIBO DE FERIAS|RECIBO DE 13|RESUMO DA FOLHA)/, fonte: '04b (Folha)',
    campos: u => ({ competencia: competenciaSolta(linhaApos(u, /COMPETENCIA|REFERENCIA|MES\/ANO|PERIODO/, 120)) || competenciaSolta(u.slice(0, 800)) }) },
  // ---- contábil (04; Dicionário §6.1) ----
  { tipo: 'BALANCETE', setor: 'CONTABIL', re: /^[\s\S]{0,800}((?<!DT\.\s?)BALANCETE|ESCRITURACAO CONTABIL DIGITAL|\bECD\b|BALANCO PATRIMONIAL)/, fonte: '04 (Balancete e ECD)',
    campos: u => { const p = periodoEscrito(u) || periodoLivre(u); const a = /(?:EXERCICIO|ANO)[^0-9]{0,15}(20\d{2})/.exec(u.slice(0, 1500)); return { ano: p ? p.ate.ano : a ? +a[1] : null }; } },
  { tipo: 'RELATORIO LJ', setor: 'CONTABIL', re: /RELATORIO PERIODICO \(SALDO\/EXTRATO\)|RELACAO DE TITULOS (PAGOS|RECEBIDOS)/, fonte: '04 (Relatório LJ Sistemas)',
    campos: u => { const p = periodoEscrito(u) || periodoLivre(u); return { competencia: p ? { mes: p.ate.mes, ano: p.ate.ano } : null, sufixo: /TITULOS PAGOS/.test(u) ? ' - TITULOS PAGOS' : /TITULOS RECEBIDOS/.test(u) ? ' - TITULOS RECEBIDOS' : '' }; } },
  { tipo: 'INFORME DE RENDIMENTOS', setor: 'CONTABIL', re: /INFORME DE RENDIMENTOS|COMPROVANTE DE RENDIMENTOS|FONTE PAGADORA[\s\S]{0,400}BENEFICIARI[AO] DOS RENDIMENTOS/, fonte: 'Dicionário §6.2; 04 (Informe de Rendimentos)',
    campos: u => {
      const a = /ANO[- ]?CALENDARIO[^0-9]{0,20}(20\d{2})/.exec(u) || /EXERCICIO[^0-9]{0,20}(20\d{2})/.exec(u);
      let ano = a ? (/EXERCICIO/.test(a[0]) ? +a[1] - 1 : +a[1]) : null;
      // informe trimestral (Vitor, 23/10/2026: o Nubank da LC FLORESTAL, "Terceiro trimestre 2026"): o período vai no nome
      let trimestre = null;
      if (!ano) { const t = /\b(PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO|[1-4]\s*[O°º]?)\s*TRIMESTRE\s*(?:DE\s*)?(20\d{2})/.exec(u.slice(0, 1500)); if (t) { trimestre = { PRIMEIRO: 1, SEGUNDO: 2, TERCEIRO: 3, QUARTO: 4 }[t[1]] || +t[1][0]; ano = +t[2]; } }
      const fonte = (/FONTE PAGADORA[\s\S]{0,160}?NOME(?: EMPRESARIAL)?\s*:?\s*[—-]?\s*\|?\s*\[?([A-Z0-9&. /-]{4,})/.exec(u) || [])[1];
      return { ano, trimestre, fonte: fonte ? fonte.trim() : null };
    } },
  { tipo: 'OPERACAO DE CREDITO', setor: 'CONTABIL', re: /EXTRATO DE (EMPRESTIMOS?|OPERACAO DE CREDITO)|EVOLUCAO CONTRATUAL|CONTRATO DE (EMPRESTIMO|FINANCIAMENTO)|CEDULA DE CREDITO BANCARIO|DADOS DA CONTRATACAO|GIRO PRONAMPE/, fonte: '04 (Op. Crédito)', campos: () => ({}) },
  { tipo: 'RECEBIMENTO DE CLIENTES', setor: 'CONTABIL', re: /RELATORIO DE RECEBIMENTOS|TITULOS LIQUIDADOS|TITULOS BAIXADOS|TITULOS PAGOS POR CONTA CREDITO|RELATORIO DE COBRANCA|CREDITOS? DE LIQUIDACAO|CRED\.? LIQUIDACAO/, fonte: 'Dicionário §6.1', campos: u => camposDeExtrato(u) },
  { tipo: 'MAQUININHAS', setor: 'CONTABIL', re: /RELATORIO DE VENDAS|LISTA DE VENDAS|EXTRATO DE VENDAS|EXTRATO DE LIQUIDACAO|EXTRATO DE RECEBIVEIS|RESUMO DE VENDAS|VENDAS POR BANDEIRA|CONCILIACAO DE (VENDAS|RECEBIVEIS)|RELATORIO DE CONCILIACAO/, fonte: 'Dicionário §6.1', campos: u => camposDeExtrato(u) },
  { tipo: 'APLICACOES', setor: 'CONTABIL', re: /EXTRATO DE APLICAC|EXTRATO DE INVESTIMENTO|EXTRATO DE FUNDOS|POSICAO DE INVESTIMENTO|RENDIMENTOS DE APLICAC|INVESTIMENTOS BRADESCO|TOTAL APLICADO|^[\s\S]{0,150}RENDE FACIL|OUROCAP|BRASILCAP|TITULO DE CAPITALIZACAO/, fonte: 'Dicionário §6.1; 04 (capitalização)', campos: u => camposDeExtrato(u) },
  { tipo: 'COMPROVANTE', setor: 'CONTABIL', re: /COMPROVANTE\s+(DE\s+)?(PAGAMENTO|TRANSFERENCIA|PIX|AGENDAMENTO|TITULOS|OPERACAO|TRANSACAO)|PIX (ENVIADO|REALIZADO)\s*\n.*COMPROVANTE/, fonte: 'Dicionário §6.1 e §6.1.1', campos: u => camposDeComprovante(u) },
  { tipo: 'FATURA CARTAO', setor: 'CONTABIL', re: /FATURA DO CARTAO|EXTRATO DE CARTAO DE CREDITO|FATURA MASTERCARD|FATURA VISA|RESUMO DA FATURA/, fonte: '04 (fatura de cartão → fallback extrato avulso)',
    campos: u => ({ competencia: competenciaSolta(linhaApos(u, /VENCIMENTO/, 60)) || (dataBr(linhaApos(u, /VENCIMENTO/, 60)) ? (d => ({ mes: +d.slice(3, 5), ano: +d.slice(6) }))(dataBr(linhaApos(u, /VENCIMENTO/, 60))) : null) }) },
  { tipo: 'EXTRATO', setor: 'CONTABIL', re: /EXTRATO EXPORTADO NO DIA|EXTRATO (DE |DA )?(CONTA|C\/C|MENSAL|CONSOLIDADO|FINANCEIRO|POR PERIODO|BANCARIO)|EXTRATOMENSAL|EXTRATO HISTORICO|EXTRATO DE: AG|EXTRATO CONTA CORRENTE|RELATORIO DE MOVIMENTACOES|SALDO FINAL DO PERIODO|SALDO ANTERIOR[\s\S]{0,4000}SALDO/, fonte: 'Dicionário §6.1; 04 (Bancários)', campos: u => camposDeExtrato(u) },
];

/**
 * O documento por funcionário: o tipo (ASO, Rescisão, Férias, Aviso prévio, Contrato, Admissão), o nome do funcionário
 * (o nome que vem antes do CPF, depois do rótulo Funcionário/Empregado/Trabalhador/Colaborador) e a data do documento.
 */
function camposDoFuncionario(u) {
  const doc = /ATESTADO DE SAUDE OCUPACIONAL/.test(u) ? 'ASO' : /TERMO DE RESCISAO/.test(u) ? 'Rescisão' : /AVISO DE FERIAS|RECIBO DE FERIAS/.test(u) ? 'Férias'
    : /AVISO PREVIO/.test(u) ? 'Aviso prévio' : /CONTRATO (INDIVIDUAL )?DE TRABALHO|CONTRATO DE EXPERIENCIA/.test(u) ? 'Contrato' : 'Admissão';
  const m = /\b(?:FUNCIONARIO|EMPREGADO|TRABALHADOR|COLABORADOR)\b[^\n]{0,60}\n?\s*([A-Z][A-Z ]{4,80}?)\s+(?:CPF:?\s*)?\d{3}\.\d{3}\.\d{3}-\d{2}/.exec(u);
  let nome = m ? m[1].replace(/\s+/g, ' ').trim() : null;
  if (nome && (nome.split(' ').length < 2 || /\b(CPF|DATA|NASC|NOME|FUNCAO|SETOR)\b/.test(nome))) nome = null;
  const dataApos = re => { const i = u.search(re); if (i < 0) return null; const d = /(\d{2})\/(\d{2})\/(20\d{2})/.exec(u.slice(i, i + 400)); return d ? d[1] + '/' + d[2] + '/' + d[3] : null; };
  const data = doc === 'ASO' ? dataApos(/EXAMES? COMPLEMENTARES|NOME DO EXAME/) || dataApos(/\bDATA:/)
    : doc === 'Rescisão' ? dataApos(/DATA DE AFASTAMENTO/)
    : doc === 'Férias' ? dataApos(/PERIODO DE (GOZO|FERIAS)|INICIO D[AE]S? FERIAS/)
    : doc === 'Aviso prévio' ? dataApos(/DATA DO AVISO|AVISO EM|EM\s+\d{2}\/\d{2}\/20\d{2}/)
    : dataApos(/DATA DE ADMISSAO|ADMITIDO EM|ADMISSAO:/);
  return { doc, nome, data };
}

function anoCalendario(u) {
  const m = /ANO[- ]CALENDARIO[^0-9]{0,20}(20\d{2})/.exec(u) || /PERIODO[^0-9]{0,30}\d{2}\/\d{2}\/(20\d{2})/.exec(u) || /EXERCICIO[^0-9]{0,20}(20\d{2})/.exec(u);
  if (!m) return null;
  return /EXERCICIO/.test(m[0]) ? +m[1] - 1 : +m[1];
}
/** "01/09/2026 a 30/09/2026" sem rótulo (livros, relatórios). */
function periodoLivre(u) {
  const m = /(\d{2})[/-](\d{2})[/-](20\d{2})\s*(?:A|AL|ATE|-|À)\s*(\d{2})[/-](\d{2})[/-](20\d{2})/.exec(u);
  return m ? { de: { dia: +m[1], mes: +m[2], ano: +m[3] }, ate: { dia: +m[4], mes: +m[5], ano: +m[6] } } : null;
}
function camposDeExtrato(u) {
  const p = periodoEscrito(u) || periodoLivre(u.slice(0, 1500));
  if (p) return { periodo: p, competencia: { mes: p.ate.mes, ano: p.ate.ano }, variosMeses: (p.de.ano * 12 + p.de.mes) !== (p.ate.ano * 12 + p.ate.mes) && !(p.de.dia >= 25 && (p.ate.ano * 12 + p.ate.mes) - (p.de.ano * 12 + p.de.mes) === 1) };
  let c = competenciaSolta(linhaApos(u, /MES\/ANO|MES DE REFERENCIA|\bMES:|COMPETENCIA|REFERENCIA|PERIODO/, 120));
  if (!c) {
    // o mês mais recente do cabeçalho ("-Julho/2026 -Agosto/2026": o primeiro é o do saldo anterior)
    const cab = u.slice(0, 600).split('\n').map(competenciaSolta).filter(Boolean);
    if (cab.length) c = cab.sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes))[0];
  }
  return { competencia: c, variosMeses: false };
}
/** Comprovante: a data do pagamento decide o mês; titular da conta pelo cabeçalho (03). */
function camposDeComprovante(u) {
  // rótulos em ordem de preferência; nunca "a primeira data do papel" (costuma ser a da impressão do comprovante)
  const ROTULOS = [/DATA DO PAGAMENTO/, /\bPAGAMENTO:\s*\d/, /DATA DE DEBITO/, /DATA DA TRANSFERENCIA/, /DATA DO PIX/, /DATA DE EFETIVACAO/, /DATA\/HORA DA OPERACAO/, /DATA DA OPERACAO/, /REALIZADO:/, /DEBITADO EM/, /\bDATA:/];
  let d = null;
  for (const r of ROTULOS) { d = dataBr(linhaApos(u, r, 60)); if (d) break; }
  if (!d) { const m = /(\d{2}\/\d{2}\/\d{4})\s*\n?DATA DE DEBITO/.exec(u); if (m) d = dataBr(m[1]); }   // Bradesco: valor antes do rótulo
  const saldos = (u.match(/\bSALDO\b/g) || []).length;
  return { competencia: d ? { mes: +d.slice(3, 5), ano: +d.slice(6) } : null, data: d, pareceExtrato: saldos >= 3 };
}
function camposDeNota(u) {
  // chave de acesso: 44 dígitos, em blocos de 4 separados por espaço (nunca começa no meio de outro número)
  const chave = (/(?<!\d)(\d{4}(?: ?\d{4}){10})(?!\d)/.exec(u) || [])[1];
  const ch = chave ? so(chave) : null;
  const emissao = dataBr(linhaApos(u, /DATA (DA |DE )?EMISSAO|\bEMISSAO\b/, 80)) || dataBr(u.slice(0, 1500));
  return { chave: ch && ch.length === 44 ? ch : null, emissao, cancelada: /CANCELAD[AO]/.test(u.slice(0, 1500)) };
}
function camposDeNfse(u) {
  const numero = (/NUMERO DA NFS-E[^0-9]{0,30}(\d{1,15})/.exec(u) || /NFS-E\s*N[O°º.]*\s*:?\s*(\d{1,15})/.exec(u) || /NUMERO DA NOTA[^0-9]{0,20}(\d{1,15})/.exec(u) || [])[1] || null;
  const emissao = dataBr(linhaApos(u, /DATA E HORA DA EMISSAO|DATA DA EMISSAO|EMISSAO DA NFS-E|DATA DE EMISSAO|EMITIDA EM/, 120)) || dataBr(linhaApos(u, /DATA FATO GERADOR/, 80));
  const comp = competenciaSolta(linhaApos(u, /COMPETENCIA DA NFS-E|COMPETENCIA/, 80));
  return { numero: numero ? String(+numero) : null, emissao, competencia: comp, cancelada: /CANCELAD[AO]/.test(u.slice(0, 1500)) };
}

/** Prestador e tomador de uma NFS-e em PDF: o 1º CNPJ é o do prestador (emitente), o seguinte o do tomador. */
function papeisDaNfse(u, docs) {
  const iTom = u.search(/TOMADOR/);
  const prest = docs.find(d => iTom < 0 || d.pos < iTom);
  const tom = iTom >= 0 ? docs.find(d => d.pos > iTom) : docs[1];
  return { prestador: prest ? prest.doc : null, tomador: tom ? tom.doc : null };
}

// ---------------------------------------------------------------------------------------------------------------------
// a decisão
// ---------------------------------------------------------------------------------------------------------------------
/**
 * entrada: { nome, rel, hash, texto (PDF: [página, …]), xml, ofx, txt, planilha ([[célula…]…]) }
 * ctx: { cadastro (montarCadastro), hoje: Date }
 * Devolve { acao, motivo, confianca, cliente, setor, tipo, competencia, pastaCliente, criarPastaCliente, caminho, nomeFinal,
 *           destinoRelativo, evidencias, fonte }.
 *   acao: ARQUIVAR | NAO_IDENTIFICADO | FICA (fora do escopo: fica na origem) | IGNORAR (vídeo/áudio) | CONTEINER
 */
function decidir(entrada, ctx) {
  const ev = [];
  const nome = String(entrada.nome || '');
  const rel = entrada.rel || nome;
  const ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1];
  const e = (ext || '').toLowerCase();
  const fim = o => finalizar(Object.assign({ evidencias: ev, nomeOriginal: nome, ocr: entrada.ocr || null, anoPista: anoDaPasta(rel) || competenciaDaPasta(rel), anoEntrega: anoDaEntrega(entrada) }, o), ctx);
  if (VIDEO_AUDIO.test(nome)) return { acao: 'IGNORAR', motivo: 'VIDEO_OU_AUDIO', confianca: 1, evidencias: ['Dicionário §1: vídeo/áudio fica na origem'] };
  if (entrada.hash && HASH_DESCARTE[entrada.hash]) return { acao: 'DESCARTAR', motivo: 'DESCARTE_CONFIRMADO', confianca: 1, tipo: 'DESCARTE', evidencias: ['descarte confirmado pelo responsável (' + HASH_DESCARTE[entrada.hash] + '): vai para a quarentena, nunca é apagado direto'] };
  if (CONTEINER.test(nome)) return { acao: 'CONTEINER', motivo: null, confianca: 1, evidencias: ['Dicionário §1: compactado é extraído, cada arquivo vira item'] };
  const cad = ctx.cadastro;

  // 03: arquivo confirmado pelo responsável (vale pelo hash exato)
  // (23/10/2026) e o arquivo que o admin decidiu no nads (arquivador-manual.js: ctx.confirmados, hash → código)
  const porHash = entrada.hash && HASH_CONFIRMADO[entrada.hash] ? confirmado(HASH_CONFIRMADO[entrada.hash], NOME_DO_HASH[HASH_CONFIRMADO[entrada.hash]], ctx.cadastro)
    : (entrada.hash && ctx.confirmados && ctx.confirmados.get(entrada.hash)) || null;

  if (e === 'xml') return fim(decidirXml(entrada, ctx, ev));
  if (e === 'ofx') return fim(decidirOfx(entrada, ctx, ev));
  if (e === 'pfx' || e === 'p12') {
    // 04b: certificado digital — cliente pelo CNPJ no nome do arquivo; nunca abrir a chave
    const docs = documentosDoTexto(nome.replace(/_/g, ' ')).map(d => d.doc).concat((nome.match(/\d{14}|\d{11}/g) || []).filter(d => cnpjValido(d) || cpfValido(d)));
    const cli = unico(docs.flatMap(d => clientesDoDoc(d, cad)));
    if (!cli) return fim({ acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.5, tipo: 'CERTIFICADO DIGITAL', setor: 'FOLHA_SOCIETARIO' });
    ev.push('CNPJ no nome do certificado');
    return fim({ acao: 'ARQUIVAR', cliente: cli, comoCliente: 'doc', confianca: 0.97, tipo: 'CERTIFICADO DIGITAL', setor: 'FOLHA_SOCIETARIO', caminho: ['SOCIETÁRIO', 'CERTIFICADO DIGITAL'], nomeFinal: nome, fonte: '04b (Certificado Digital)' });
  }
  if (e === 'txt') return fim(decidirTxt(entrada, ctx, ev));
  if (e === 'pdf') return fim(decidirPdf(entrada, ctx, ev, porHash));
  if (['xlsx', 'xls', 'csv'].includes(e)) return fim(decidirPlanilha(entrada, ctx, ev, porHash));
  if (porHash) return fim({ acao: 'NAO_IDENTIFICADO', motivo: 'HASH_CONFIRMADO_SEM_REGRA_DE_DESTINO', confianca: 0.5, cliente: porHash });
  return fim({ acao: 'NAO_IDENTIFICADO', motivo: 'FORMATO_SEM_REGRA', confianca: 0, evidencias: ev.concat('extensão .' + (e || '?') + ' sem regra determinística (imagem, Word, etc.)') });
}

const unico = arr => { const s = [...new Set(arr)]; return s.length === 1 ? s[0] : null; };

/** XML: o porte do xml_lote.decidir (cliente) + pasta do regime (05d §1b). */
// as mensagens trocadas com a SEFAZ (23/10/2026, Vitor: "quarentena automática"): não são documento do cliente. A
// distribuição de DF-e (distDFeInt / retDistDFeInt) traz os documentos dentro: essa não entra aqui (fica para resolver).
const MENSAGEM_SEFAZ = /^(Envelope|Body|nfeDadosMsg|nfeResultMsg|cteDadosMsg|cteResultMsg|mdfeDadosMsg|mdfeResultMsg|(cons|retCons)(Sit|StatServ|Reci|Cad)(NFe|CTe|Cte|MDFe)?|(envi|retEnvi)(NFe|CTe|Cte|MDFe)|consMDFeNaoEnc|retConsMDFeNaoEnc|(env|retEnv)Evento|retInut(NFe|CTe)Pendente)$/;
const NOME_MENSAGEM_SEFAZ = /-(ped-sta|sta|env-lot|pro-lot|rec|pro-rec|ped-rec|ped-sit|sit|ped-can|ped-cce|soap|ped-sta-soap|ped-inu|env-cce|env-canc)\.xml$/i;
function decidirXml(entrada, ctx, ev) {
  const info = classificarXml(entrada.xml);
  if (info.erro === 'TIPO_XML_NAO_TRATADO' && (MENSAGEM_SEFAZ.test(info.tag || '') || NOME_MENSAGEM_SEFAZ.test(entrada.nome || ''))) {
    return { acao: 'DESCARTAR', motivo: 'MENSAGEM_DA_SEFAZ', confianca: 1, tipo: 'DESCARTE', setor: 'FISCAL', evidencias: ['mensagem trocada com a SEFAZ (' + (info.tag || '?') + ', ' + entrada.nome + '): não é documento do cliente; vai para a quarentena, nunca apagada (Vitor, 23/10/2026)'] };
  }
  if (info.erro) return { acao: 'NAO_IDENTIFICADO', motivo: info.erro, confianca: 0, tipo: 'XML ' + (info.tag || '?'), setor: 'FISCAL' };
  const cad = ctx.cadastro;
  let cand = [];
  for (const d of info.partes) for (const c of clientesDoDoc(d, cad)) if (!cand.includes(c)) cand.push(c);
  if (info.partes.includes('27872981000113') && !info.emit.includes('27872981000113')) cand = cand.filter(c => !clientesDoDoc('27872981000113', cad).includes(c));
  const sub = clienteDaPasta(entrada.rel, cad);
  let cliente = null, conf = 0, como = null;
  const copias = [];
  // o escritório como emitente decide antes da pasta de origem (a nota de honorários pode estar na pasta do cliente)
  if (info.emit.length && ESCRITORIO.has(info.emit[0])) cand = cand.filter(c => !(cad.porCod.get(c) && ESCRITORIO.has(cad.porCod.get(c).doc)));
  // 23/10/2026 (Vitor, "é a regra contábil"): a nota entre DUAS empresas clientes vai para as duas — saída na pasta do
  // emitente, entrada na do destinatário/tomador —, cada uma com a sua linha no manifesto (como a NFS-e de honorários).
  // Só quando cada CNPJ/CPF da nota é de um código só; cliente inativo e sem pasta no Drive não recebe a nota.
  const duas = !info.evento ? clientesDaNota(info, cad) : null;
  if (duas && duas.inativos.length) ev.push('inativo(s) sem pasta no Drive, fora da nota: ' + duas.inativos.join(', '));
  if (duas && duas.codigos.length >= 2) {
    const [principal, ...outros] = duas.codigos;
    ev.push('nota entre clientes: ' + duas.papeis.join(', ') + ' — na pasta de cada um (regra das duas clientes, 23/10/2026)');
    return { acao: 'ARQUIVAR', cliente: principal, comoCliente: 'doc', confianca: 0.97, copias: outros.map(c => ({ cliente: c, comoCliente: 'doc' })), tipo: 'XML ' + info.tipo + (info.sub ? ' ' + info.sub : ''), setor: 'FISCAL', fiscal: ['XML', info.tipo].concat(info.sub ? [info.sub] : []), nomeFinal: info.nome, chave: info.chave || null, fonte: '05d §1b; regra das duas clientes (Vitor, 23/10/2026)', competencia: info.data ? { mes: +info.data.slice(5, 7), ano: +info.data.slice(0, 4) } : null };
  }
  if (duas && duas.codigos.length === 1 && duas.inativos.length && cand.length > 1) cand = duas.codigos.slice();
  if (sub && cand.includes(sub.codigo) && !(info.emit.length && ESCRITORIO.has(info.emit[0]))) { cliente = sub.codigo; conf = 0.99; como = 'doc'; ev.push('CNPJ/CPF do XML e ' + sub.como); }
  else if (info.emit.length && ESCRITORIO.has(info.emit[0]) && cad.porDoc.has(info.emit[0])) {
    // emitida pelo escritório (honorários): na pasta da Nilma (xml_lote) E, desde 21/10/2026 (Vitor), também na do tomador
    cliente = [...cad.porDoc.get(info.emit[0])][0]; conf = 0.97; como = 'doc';
    const tomadores = cand.filter(c => c !== cliente);
    if (tomadores.length === 1) copias.push({ cliente: tomadores[0], comoCliente: 'doc' });
    ev.push('emitida pelo escritório: na pasta dele' + (tomadores.length === 1 ? ' e uma cópia na do tomador (' + tomadores[0] + ')' : ''));
  }
  else if (cand.length === 1) { cliente = cand[0]; conf = 0.98; como = 'doc'; ev.push('CNPJ/CPF do XML'); }
  else if (info.evento && info.chave && ctx.chaves && ctx.chaves.achar(info.chave).length) {
    // índice de chaves (23/10/2026, Vitor: "não tem como ele verificar com a chave de acesso?"): o evento vai para a
    // MESMA pasta do documento original, na subpasta EVENTOS. Original em mais de um cliente: o evento em todos.
    // só um evento anterior da mesma nota (o original não foi arquivado) não desempata dois clientes possíveis
    let orig = ctx.chaves.achar(info.chave).filter(o => o.de !== 'evento' || !cand.length);
    const entre = orig.filter(o => cand.includes(o.cliente));
    if (entre.length) orig = entre;
    const vale = orig.filter(o => cad.porCod.has(o.cliente));
    if (vale.length) {
      const caminhoDe = o => (o.sub && o.sub.length ? o.sub.concat('EVENTOS') : null);
      const fiscal = ['XML', info.tipo, 'EVENTOS'];
      ev.push('chave ' + info.chave + ': o documento original está arquivado em ' + vale.map(o => o.cliente).join(', ') + (vale[0].sub ? ' (' + vale[0].sub.join('\\') + ')' : ''));
      for (const o of vale.slice(1)) copias.push({ cliente: o.cliente, comoCliente: 'chave', caminho: caminhoDe(o), fiscal: caminhoDe(o) ? null : fiscal });
      const c0 = caminhoDe(vale[0]);
      return { acao: 'ARQUIVAR', cliente: vale[0].cliente, comoCliente: 'chave', confianca: 0.95, copias, tipo: 'XML ' + info.tipo + ' EVENTOS', setor: 'FISCAL', caminho: c0, fiscal: c0 ? null : fiscal, nomeFinal: info.nome, chave: info.chave, fonte: 'índice de chaves (manifestos e decisões)', competencia: info.data ? { mes: +info.data.slice(5, 7), ano: +info.data.slice(0, 4) } : null };
    }
  }
  if (cliente != null) { /* já decidido acima */ }
  else if (!cand.length && info.evento && sub) { cliente = sub.codigo; conf = 0.88; como = 'pasta'; ev.push('evento órfão: cliente da subpasta (03), ' + sub.como); }
  else if (!cand.length) {
    // 03: raiz do CNPJ igual à de cliente(s), sufixo diferente (matriz/filial não cadastrada) → CLIENTE_AMBIGUO, não "não localizado"
    const raiz = [...new Set(info.partes.filter(d => d.length === 14 && cad.porRaiz.has(d.slice(0, 8))).flatMap(d => [...cad.porRaiz.get(d.slice(0, 8))]))];
    if (info.evento && info.chave) return semOriginal(info, ev, raiz.length ? 'raiz do CNPJ de ' + raiz.join(', ') + ' com outro estabelecimento' : 'nenhum CNPJ/CPF do evento é de cliente');
    if (raiz.length) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, tipo: 'XML ' + info.tipo, setor: 'FISCAL', chave: info.chave || null, evidencias: ev.concat('raiz do CNPJ de ' + raiz.join(', ') + ' com outro estabelecimento (matriz/filial sem cadastro próprio)') };
    return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: 'XML ' + info.tipo, setor: 'FISCAL', chave: info.chave || null, evidencias: ev.concat('nenhum CNPJ/CPF do XML é de cliente') };
  }
  else if (info.evento && info.chave) return semOriginal(info, ev, 'candidatos ' + cand.join(', '));
  else return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.5, tipo: 'XML ' + info.tipo, setor: 'FISCAL', chave: info.chave || null, evidencias: ev.concat('candidatos ' + cand.join(', ')) };
  const caminho = ['XML', info.tipo].concat(info.sub ? [info.sub] : []);
  return { acao: 'ARQUIVAR', cliente, comoCliente: como, confianca: conf, copias, tipo: 'XML ' + info.tipo + (info.sub ? ' ' + info.sub : ''), setor: 'FISCAL', fiscal: caminho, nomeFinal: info.nome, chave: info.chave || null, fonte: '05d §1b; xml_lote.py', competencia: info.data ? { mes: +info.data.slice(5, 7), ano: +info.data.slice(0, 4) } : null };
}

/**
 * Os clientes de uma nota (regra das duas clientes, 23/10/2026): { codigos (o emitente, ou no CT-e o tomador, primeiro),
 * papeis, inativos } — ou null quando algum CNPJ/CPF da nota é de mais de um código (ambíguo de verdade).
 */
function clientesDaNota(info, cad) {
  const codigos = [], papeis = [], inativos = [];
  for (const d of [...new Set(info.partes)]) {
    const cs = clientesDoDoc(d, cad);
    if (cs.length > 1) return null;
    if (!cs.length || codigos.includes(cs[0]) || inativos.includes(cs[0])) continue;
    const c = cad.porCod.get(cs[0]);
    if (c && c.ativo === false && !(cad.pastas && cad.pastas.has(cs[0]))) { inativos.push(cs[0]); continue; }
    codigos.push(cs[0]);
    papeis.push(cs[0] + (info.emit.includes(d) ? ' (emitente)' : (info.tomador || []).includes(d) ? ' (tomador)' : ''));
  }
  // o primeiro: o emitente cliente; no CT-e de transportadora que não é cliente, o tomador
  const primeiro = [info.emit[0], (info.tomador || [])[0]].map(d => d && clientesDoDoc(d, cad)[0]).find(c => c != null && codigos.includes(c));
  if (primeiro != null) codigos.sort((a, b) => (b === primeiro) - (a === primeiro));
  return { codigos, papeis, inativos };
}

/**
 * Evento cujo documento original não está no índice de chaves (23/10/2026): AGUARDANDO_ORIGINAL — fica na origem e o
 * modo contínuo tenta de novo a cada ciclo (o evento costuma chegar antes do original no lote do SIEG). Passada a
 * espera, o executor pergunta ao SIEG pela chave e, sem resposta, manda para NÃO IDENTIFICADOS com EVENTO_SEM_ORIGINAL.
 */
function semOriginal(info, ev, porque) {
  return { acao: 'AGUARDANDO_ORIGINAL', motivo: 'EVENTO_SEM_ORIGINAL', confianca: 0.3, tipo: 'XML ' + info.tipo + ' EVENTOS', setor: 'FISCAL', chave: info.chave,
    evidencias: ev.concat(porque, 'chave ' + info.chave + ': o documento original ainda não foi arquivado (índice de chaves)') };
}

/** O cliente de uma conta já arquivada (contas.json: banco:conta → cliente → hashes), sem contar o próprio arquivo. */
function donoDaConta(ctx, banco, conta, hash) {
  const porCli = ctx.contas && conta ? ctx.contas.get(banco + ':' + conta) : null;
  if (!porCli || typeof porCli.entries !== 'function') return null;
  const donos = [...porCli.entries()].filter(([, hs]) => [...hs].some(h => h !== hash)).map(([c]) => +c);
  return donos.length === 1 ? donos[0] : null;
}
/** OFX: sempre Bancários (Dicionário §6.1.4); banco pelas tags; conta pela tabela do 03. */
function decidirOfx(entrada, ctx, ev) {
  const t = String(entrada.ofx || '');
  const tag = n => { const m = new RegExp('<' + n + '>\\s*([^<\\r\\n]+)', 'i').exec(t); return m ? m[1].trim() : null; };
  const bankid = so(tag('BANKID') || tag('FID') || '').padStart(3, '0').slice(-3);
  const banco = BANCO_POR_CODIGO[bankid] || bancoDoTexto(tag('ORG') || '') || null;
  const fimP = tag('DTEND'), iniP = tag('DTSTART');
  // a competência (23/10/2026: o Bradesco exporta DTSTART = DTEND = o dia da exportação; os extratos de fevereiro, março e
  // abril de 2022 da 183 foram todos para 05-2022): o mês com mais lançamentos (DTPOSTED); o período DTSTART–DTEND só quando
  // ele de fato cobre os lançamentos; sem lançamentos, o DTEND; e, de reserva, o mês das pastas de origem e o do nome
  const p = ofxCompetencia(t, iniP, fimP);
  let comp = p.comp;
  const pista = (r => (r && r.mes ? r : null))(anoDaPasta(entrada.rel || '')) || competenciaDoNome(entrada.nome);
  if (!comp && pista) { comp = { mes: pista.mes, ano: pista.ano }; ev.push('competência pela pasta de origem ou pelo nome (o OFX não traz o período)'); }
  if (comp && pista && (pista.mes !== comp.mes || pista.ano !== comp.ano)) ev.push('o período do conteúdo (' + mesAno(comp) + ') difere do da pasta de origem ou do nome (' + mesAno(pista) + '): vale o do conteúdo');
  if (p.porque) ev.push(p.porque);
  if (!banco) return { acao: 'NAO_IDENTIFICADO', motivo: 'BANCO_AUSENTE', confianca: 0.3, tipo: 'EXTRATO OFX', setor: 'CONTABIL' };
  if (!comp) return { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.3, tipo: 'EXTRATO OFX', setor: 'CONTABIL' };
  const conta = so(tag('ACCTID') || '');
  const cad = ctx.cadastro;
  let cliente = null, conf = 0, como = null;
  const confirmada = CONTAS_CONFIRMADAS.find(c => c.banco === banco && conta && (conta.endsWith(c.conta) || c.conta.endsWith(conta)));
  if (confirmada && confirmado(confirmada.codigo, confirmada.nome, cad) != null) { cliente = confirmado(confirmada.codigo, confirmada.nome, cad); conf = 0.97; como = 'conta'; ev.push('conta ' + conta + ' confirmada no 03'); }
  else if (donoDaConta(ctx, banco, conta, entrada.hash) != null) { cliente = donoDaConta(ctx, banco, conta, entrada.hash); conf = 0.92; como = 'conta'; ev.push('conta ' + conta + ' já arquivada só deste cliente (03)'); }
  else { const sub = clienteDaPasta(entrada.rel, cad); if (sub) { cliente = sub.codigo; conf = sub.forte ? 0.9 : 0.8; como = sub.forte ? 'pastaConferida' : 'pasta'; ev.push(sub.como + ' (OFX não traz CNPJ)'); } }
  if (!cliente) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: 'EXTRATO OFX', setor: 'CONTABIL' };
  let nomeFinal = mesAno(comp) + '.ofx';
  if (p.de) nomeFinal = mesAno(p.de) + ' A ' + mesAno(comp) + '.ofx';   // 04: extrato consolidado (vários meses de verdade)
  return { acao: 'ARQUIVAR', cliente, comoCliente: como, confianca: conf, tipo: 'EXTRATO', setor: 'CONTABIL', competencia: comp, caminho: ['CONTÁBIL', 'EXTRATOS', String(comp.ano), dois(comp.mes), 'BANCÁRIOS', banco], nomeFinal, fonte: 'Dicionário §6.1.4; 04 (Bancários)' };
}

/**
 * A competência de um OFX pelos lançamentos: { comp, de (o primeiro mês do consolidado, quando há), porque }.
 * Um mês com metade ou mais dos lançamentos: é dele (o resto são lançamentos do dia da exportação etc.). Sem um mês assim:
 * o extrato de vários meses (o do ano inteiro que o cliente baixou de uma vez) — de o primeiro ao último mês com
 * lançamentos relevantes, a competência é o último. Sem lançamentos: o DTEND (se não for zero).
 */
function ofxCompetencia(t, iniP, fimP) {
  const porMes = new Map();
  for (const m of String(t).matchAll(/<DTPOSTED>\s*((?:19|20)\d{2})(\d{2})/gi)) { const k = m[1] + '-' + m[2]; porMes.set(k, (porMes.get(k) || 0) + 1); }
  const valida = d => d && /^(19|20)\d{6}/.test(d) && +d.slice(4, 6) >= 1 && +d.slice(4, 6) <= 12;
  const total = [...porMes.values()].reduce((s, n) => s + n, 0);
  const deK = k => ({ ano: +k.slice(0, 4), mes: +k.slice(5, 7) });
  if (total) {
    const ordem = [...porMes.entries()].sort((a, b) => b[1] - a[1]);
    const [maior, nMaior] = ordem[0];
    if (nMaior >= total * 0.5 || porMes.size === 1) return { comp: deK(maior), porque: 'competência pelos lançamentos (' + nMaior + ' de ' + total + ' em ' + maior.slice(5) + '/' + maior.slice(0, 4) + ')' };
    // vários meses: os que têm ao menos 1% dos lançamentos (tira o lançamento solto do dia da exportação)
    const meses = [...porMes.entries()].filter(([, n]) => n >= Math.max(2, total * 0.01)).map(([k]) => k).sort();
    return { comp: deK(meses[meses.length - 1]), de: meses.length > 1 ? deK(meses[0]) : null, porque: 'extrato de ' + meses.length + ' meses pelos lançamentos (' + meses[0].slice(5) + '/' + meses[0].slice(0, 4) + ' a ' + meses[meses.length - 1].slice(5) + '/' + meses[meses.length - 1].slice(0, 4) + ')' };
  }
  if (valida(fimP)) return { comp: { mes: +fimP.slice(4, 6), ano: +fimP.slice(0, 4) }, porque: 'sem lançamentos: o fim do período (DTEND)' };
  return { comp: null };
}

/** TXT: SPED Fiscal, SPED Contribuições e Sintegra pelo conteúdo (registro 0000 / registro 10). */
function decidirTxt(entrada, ctx, ev) {
  const t = String(entrada.txt || '');
  const cad = ctx.cadastro;
  // livro fiscal em texto (05d §1c, 23/10/2026: "RELATORIO 04 SET.txt" = RAICMS modelo P9): mesma pasta e nome do PDF, .txt
  const ut = norm(t.slice(0, 4000));
  const livro = /REGISTRO DE APURACAO DO ICMS/.test(ut) ? 'APURACAO ICMS' : /REGISTRO DE ENTRADAS/.test(ut) ? 'REGISTRO DE ENTRADAS' : /REGISTRO DE SAIDAS/.test(ut) ? 'REGISTRO DE SAIDAS' : null;
  if (livro) {
    const cli = unico(documentosDoTexto(t.slice(0, 4000)).map(d => d.doc).flatMap(d => clientesDoDoc(d, cad)));
    const p = periodoEscrito(ut) || periodoLivre(ut);
    if (!cli) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: 'LIVRO_FISCAL', setor: 'FISCAL' };
    if (!p) return { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, cliente: cli, tipo: 'LIVRO_FISCAL', setor: 'FISCAL' };
    const ini = { mes: p.de.mes, ano: p.de.ano }, f = { mes: p.ate.mes, ano: p.ate.ano };
    ev.push('livro fiscal em texto: ' + livro + ' (CNPJ e período do cabeçalho)');
    return { acao: 'ARQUIVAR', cliente: cli, comoCliente: 'doc', confianca: 0.96, tipo: 'LIVRO_FISCAL', setor: 'FISCAL', fiscal: ['LIVROS', String(f.ano)], competencia: f, nomeFinal: (mesAno(ini) === mesAno(f) ? mesAno(f) : mesAno(ini) + ' A ' + mesAno(f)) + ' - ' + livro + '.txt', fonte: '05d §1c (livro fiscal; extensão original preservada)' };
  }
  const l0 = /^\|0000\|([^\r\n]*)/m.exec(t);
  if (l0) {
    const c = l0[1].split('|');
    // EFD ICMS/IPI: COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ ; EFD Contribuições: COD_VER|TIPO_ESCRIT|IND_SIT_ESP|NUM_REC|DT_INI|DT_FIN|NOME|CNPJ
    let tipo, ini, cnpj;
    if (/^\d{8}$/.test(c[2]) && /^\d{8}$/.test(c[3])) { tipo = 'SPEDF'; ini = c[2]; cnpj = so(c[5]) || so(c[6]); }
    else if (/^\d{8}$/.test(c[4]) && /^\d{8}$/.test(c[5])) { tipo = 'SPEDC'; ini = c[4]; cnpj = so(c[7]); }
    if (tipo) {
      const cli = unico(clientesDoDoc(cnpj, cad));
      const comp = { mes: +ini.slice(2, 4), ano: +ini.slice(4, 8) };
      if (!cli) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: tipo === 'SPEDF' ? 'SPED FISCAL' : 'SPED CONTRIBUIÇÕES', setor: 'FISCAL' };
      ev.push('registro 0000 do SPED (CNPJ e período)');
      return { acao: 'ARQUIVAR', cliente: cli, comoCliente: 'doc', confianca: 0.98, tipo: tipo === 'SPEDF' ? 'SPED FISCAL' : 'SPED CONTRIBUIÇÕES', setor: 'FISCAL', fiscal: [tipo], nomeFinal: mesAno(comp) + '.txt', competencia: comp, fonte: '05b/05c (SPED)' };
    }
  }
  const r10 = /^10(\d{14})(.{14})(.{35}).{30}.{2}.{10}(\d{8})(\d{8})/m.exec(t);
  if (r10) {
    const cli = unico(clientesDoDoc(r10[1], cad));
    const comp = { mes: +r10[5].slice(4, 6), ano: +r10[5].slice(0, 4) };
    if (!cli) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: 'SINTEGRA', setor: 'FISCAL' };
    ev.push('registro 10 do Sintegra (CNPJ e período)');
    return { acao: 'ARQUIVAR', cliente: cli, comoCliente: 'doc', confianca: 0.98, tipo: 'SINTEGRA', setor: 'FISCAL', fiscal: ['SINTEGRA'], nomeFinal: mesAno(comp) + '.txt', competencia: comp, fonte: '05a (Sintegra)' };
  }
  return { acao: 'NAO_IDENTIFICADO', motivo: 'FORMATO_SEM_REGRA', confianca: 0, tipo: 'TXT', evidencias: ev.concat('TXT que não é SPED nem Sintegra') };
}

/** §6.1.3: colunas de liquidação de cartão (taxa/tarifa/bandeira/NSU) junto de débito/crédito ou bruto/líquido. */
const ehMaquininha = u => /TARIFA|TAXA|BANDEIRA|\bNSU\b|\bMDR\b/.test(u) && /(DEBITO|CREDITO|VALOR BRUTO|LIQUIDO)/.test(u);

/** Planilha: só o balancete do Alterdata (Balancetes\Balancete <cód> <AAAA-MM>.xlsx) e a conciliação de maquininha (§6.1.3). */
function decidirPlanilha(entrada, ctx, ev, porHash) {
  const cad = ctx.cadastro;
  const linhas = (entrada.planilha || []).slice(0, 12).map(l => (l || []).join(' | '));
  const u = norm(linhas.join('\n'));
  const nome = norm(entrada.nome);
  const mBal = /BALANCETE\s+(\d{1,4})\s+(20\d{2})-(\d{2})/.exec(nome);
  if (mBal || /BALANCETE/.test(u)) {
    let cli = mBal && cad.porCod.has(+mBal[1]) ? +mBal[1] : null;
    let conf = cli ? 0.9 : 0;
    const docs = documentosDoTexto(linhas.join('\n')).map(d => d.doc);
    const porDoc = unico(docs.flatMap(d => clientesDoDoc(d, cad)));
    if (porDoc) { if (cli && cli !== porDoc) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, tipo: 'BALANCETE', setor: 'CONTABIL' }; cli = porDoc; conf = 0.97; }
    if (!cli) { const n = unico(clientesPeloNomeNoTexto(linhas.join('\n'), cad)); if (n) { cli = n; conf = 0.88; } }
    if (!cli) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: 'BALANCETE', setor: 'CONTABIL' };
    const ano = mBal ? +mBal[2] : ((/(20\d{2})/.exec(u) || [])[1] | 0) || null;
    if (!ano) return { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, cliente: cli, tipo: 'BALANCETE', setor: 'CONTABIL' };
    ev.push(mBal ? 'nome do arquivo do Alterdata (código e mês)' : 'título "Balancete"');
    return { acao: 'ARQUIVAR', cliente: cli, comoCliente: porDoc ? 'doc' : 'nome', confianca: conf, tipo: 'BALANCETE', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'REGISTRO DE LIVROS', '(001) ' + ano], nomeFinal: entrada.nome, fonte: '04 (Balancete e ECD)' };
  }
  if (ehMaquininha(u)) {
    // Dicionário §6.1.3: planilha sem título, colunas de conciliação de cartão = maquininha
    ev.push('§6.1.3: colunas de conciliação de maquininha');
    const operadora = bancoDoTexto(u) || bancoDoNome(entrada.nome);
    const linhasTxt = (entrada.planilha || []).map(l => (l || []).join(' | '));
    const texto = linhasTxt.join('\n');
    // o cliente: CNPJ da planilha; senão a razão social que aparece na maioria das linhas (nome do comprador também
    // pode casar com um cliente pessoa física, por isso a maioria e não "qualquer linha")
    let cli = unico(documentosDoTexto(texto).flatMap(d => clientesDoDoc(d.doc, cad)));
    if (!cli) {
      const votos = new Map();
      linhasTxt.forEach(l => clientesPeloNomeNoTexto(l, cad).forEach(c => votos.set(c, (votos.get(c) || 0) + 1)));
      const ord = [...votos.entries()].sort((a, b) => b[1] - a[1]);
      if (ord.length && ord[0][1] >= Math.max(2, linhasTxt.length / 2) && (!ord[1] || ord[0][1] >= 3 * ord[1][1])) cli = ord[0][0];
    }
    const p = periodoEscrito(u) || periodoLivre(u);
    const meses = {};
    for (const m of texto.matchAll(/\b\d{2}[/-](\d{2})[/-](20\d{2})\b/g)) { const k = m[2] + '-' + m[1]; meses[k] = (meses[k] || 0) + 1; }
    const top = Object.entries(meses).sort((a, b) => b[1] - a[1])[0];
    const comp = p ? { mes: p.ate.mes, ano: p.ate.ano } : top ? { ano: +top[0].slice(0, 4), mes: +top[0].slice(5) } : competenciaDoNome(entrada.nome);
    if (!operadora || !cli || !comp) return { acao: 'NAO_IDENTIFICADO', motivo: !operadora ? 'BANCO_AUSENTE' : !cli ? 'CLIENTE_NAO_LOCALIZADO' : 'COMPETENCIA_AUSENTE', confianca: 0.5, tipo: 'MAQUININHAS', setor: 'CONTABIL', cliente: cli };
    const ext = (/\.[a-z0-9]+$/i.exec(entrada.nome) || ['.xlsx'])[0].toLowerCase();
    return { acao: 'ARQUIVAR', cliente: cli, comoCliente: 'nome', confianca: 0.88, tipo: 'MAQUININHAS', setor: 'CONTABIL', competencia: comp, caminho: ['CONTÁBIL', 'EXTRATOS', String(comp.ano), dois(comp.mes), 'MAQUININHAS', operadora], nomeFinal: mesAno(comp) + ext, fonte: 'Dicionário §6.1.3; 04 (Maquininhas)' };
  }
  if (porHash) {
    // 04: documento contábil sem sub-regra, com cliente identificado → CONTÁBIL\OUTROS DOCUMENTOS\[ANO]\, nome original;
    // o ano do conteúdo, senão o da subpasta de origem ("2026-10\"), senão o ano corrente
    const ano = ((/(?:^|\\)(20\d{2})-\d{2}(?:\\|$)/.exec(entrada.rel || '')) || [])[1] || String((ctx.hoje || new Date()).getFullYear());
    ev.push('cliente confirmado pelo responsável (arquivo) e sem sub-regra: OUTROS DOCUMENTOS (04)');
    return { acao: 'ARQUIVAR', cliente: porHash, comoCliente: 'hash', confianca: 0.97, tipo: 'OUTROS DOCUMENTOS', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'OUTROS DOCUMENTOS', ano], nomeFinal: entrada.nome, fonte: '04 (Outros documentos)' };
  }
  return { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_NAO_RECONHECIDO', confianca: 0, tipo: 'PLANILHA', evidencias: ev.concat('planilha sem regra determinística') };
}

/**
 * Números de conta escritos no documento ("Conta:15.062-2", "AG 3110 CC 99699-2", "02557 | 0006310-0",
 * "Agência/Conta Corrente: 060 - SALINAS/000011887-9"): só dígitos, sem zeros à esquerda.
 */
function contasDoTexto(texto) {
  const u = norm(texto).slice(0, 4000);
  const out = new Set();
  const res = [
    /(?:\bCONTA(?: CORRENTE)?|\bC\/C|\bCC)\b[^0-9\n]{0,30}?(?:\d{3,5}\s*[|/ -]\s*)?(?:[A-Z ]{0,20}\/)?([\d.]{3,15}-[\dX])(?![\d])/g,
    /\b\d{4,5} \| (\d{5,13}-[\dX])/g,
  ];
  for (const re of res) for (const m of u.matchAll(re)) { const c = so(m[1]).replace(/^0+/, ''); if (c.length >= 4) out.add(c); }
  return [...out];
}
/**
 * 03: "conta que aparece em extrato já arquivado de um cliente: achou em um único cliente → é dele". ctx.contas é o
 * índice banco:conta → Map(cliente → Set(hash dos arquivos)) montado com o que já está arquivado (arquivador-novo.js,
 * --aprender-contas). `excluir`: o hash do próprio arquivo (na medição, para ele não se reconhecer).
 */
function clientePelaConta(bruto, banco, ctx, excluir) {
  if (!ctx.contas || !banco) return null;
  const achados = new Set();
  for (const c of contasDoTexto(bruto)) {
    const porCli = ctx.contas.get(banco + ':' + c);
    if (!porCli) continue;
    for (const [cli, hashes] of porCli) if ([...hashes].some(h => h !== excluir)) achados.add(cli);
  }
  for (const k of CONTAS_CONFIRMADAS) if (k.banco === banco && contasDoTexto(bruto).some(c => c.endsWith(k.conta) || k.conta.endsWith(c))) { const c = confirmado(k.codigo, k.nome, ctx.cadastro); if (c != null) achados.add(c); }
  return achados.size === 1 ? [...achados][0] : null;
}

/** O cliente de um PDF: CNPJ/CPF do texto > raiz/máscara > razão social escrita > pasta de origem. */
function clienteDoPdf(u, bruto, entrada, ctx, ev, regra, campos) {
  const cad = ctx.cadastro;
  const CONTA = ['EXTRATO', 'APLICACOES', 'RECEBIMENTO DE CLIENTES', 'MAQUININHAS', 'FATURA CARTAO'].includes(regra.tipo);
  const linhaDe = pos => { const i = bruto.lastIndexOf('\n', pos); const j = bruto.indexOf('\n', pos); return norm(bruto.slice(i + 1, j < 0 ? undefined : j)); };
  // num extrato, o CNPJ de quem pagou/recebeu aparece no lançamento: só vale o do cabeçalho / fora dos lançamentos
  // relatório de maquininha traz o CNPJ do estabelecimento depois dos filtros (Cielo): limite maior
  const limite = regra.tipo === 'MAQUININHAS' ? 2500 : CONTA ? 800 : regra.tipo === 'BALANCETE' ? 1500 : Infinity;
  const docs = documentosDoTexto(bruto).filter(d => !ESCRITORIO.has(d.doc) && d.pos <= limite && !(CONTA && LINHA_DE_LANCAMENTO.test(linhaDe(d.pos))));
  const sub = clienteDaPasta(entrada.rel, cad);
  // Guia de DCTFWeb/FGTS: o CNPJ/CPF do contribuinte vem no nome do arquivo ("GuiaPagamento_<CNPJ>_<MMAAAA>_…").
  const docNome = (/(?:^|_)(\d{14}|\d{11})_/.exec(entrada.nome) || [])[1];
  let candidatos = [];
  const porDoc = new Map();
  for (const d of docs) for (const c of clientesDoDoc(d.doc, cad)) { if (!porDoc.has(c)) { porDoc.set(c, d.pos); candidatos.push(c); } }

  // papéis: comprovante = titular da conta ("Cliente:" no cabeçalho); nota = emitente × destinatário (03)
  if (regra.tipo === 'COMPROVANTE' || regra.tipo === 'EXTRATO' || regra.tipo === 'APLICACOES' || regra.tipo === 'RECEBIMENTO DE CLIENTES' || regra.tipo === 'MAQUININHAS') {
    const tit = /\b(?:CLIENTE|TITULAR|CORRENTISTA|NOME DO PAGADOR|NOME)\s*:\s*([A-Z0-9&. -]{6,})/.exec(u) || /\bCONTA(?: CORRENTE)?\s*:?\s*[\d.]+-[\dX]\s*\/?\s*([A-Z][A-Z0-9&. -]{5,})/.exec(u);
    if (tit) {
      const n = unico(clientesPeloNomeNoTexto(tit[1], cad));
      if (n) { ev.push('titular da conta no cabeçalho: ' + tit[1].trim()); return { cliente: n, conf: candidatos.length <= 1 || candidatos.includes(n) ? 0.95 : 0.88, como: 'nome' }; }
    }
  }
  if (candidatos.length > 1 && sub && candidatos.includes(sub.codigo)) { ev.push('CNPJ do documento e ' + sub.como); return { cliente: sub.codigo, conf: 0.93, como: 'doc' }; }
  if (candidatos.length > 1 && docNome) { const c = unico(clientesDoDoc(docNome, cad)); if (c && candidatos.includes(c)) { ev.push('CNPJ do nome da guia'); return { cliente: c, conf: 0.97, como: 'doc' }; } }
  if (candidatos.length > 1 && /^(DAS|DARF|DAE|DAM|FGTS|DEFIS|ECF|DIRF|BALANCETE|CARTAO CNPJ|CERTIDAO|LIVRO_FISCAL|RELATORIO LJ)$/.test(regra.tipo)) {
    // guia/declaração: o contribuinte é o primeiro CNPJ/CPF do documento (é o campo do cabeçalho)
    candidatos.sort((a, b) => porDoc.get(a) - porDoc.get(b));
    ev.push('contribuinte = 1º CNPJ/CPF do documento'); return { cliente: candidatos[0], conf: 0.9, como: 'doc' };
  }
  if (candidatos.length === 1) { ev.push('CNPJ/CPF do documento'); return { cliente: candidatos[0], conf: sub && sub.codigo !== candidatos[0] ? 0.9 : 0.96, como: 'doc' }; }
  const contabil = ['COMPROVANTE', 'EXTRATO', 'APLICACOES', 'RECEBIMENTO DE CLIENTES', 'MAQUININHAS', 'FATURA CARTAO', 'OPERACAO DE CREDITO'].includes(regra.tipo);
  if (contabil) {
    const pc = clientePelaConta(bruto, bancoDoTexto(bruto) || bancoDoNome(entrada.nome), ctx, entrada.hash);
    if (pc && (!candidatos.length || candidatos.includes(pc))) { ev.push('conta bancária já arquivada só deste cliente (03)'); return { cliente: pc, conf: 0.92, como: 'conta' }; }
  }
  if (candidatos.length > 1) return { motivo: 'CLIENTE_AMBIGUO', candidatos };
  if (docNome) { const c = unico(clientesDoDoc(docNome, cad)); if (c) { ev.push('CNPJ/CPF no nome da guia'); return { cliente: c, conf: 0.95, como: 'doc' }; } }
  // raiz impressa sozinha (FGTS Digital) ou CNPJ mascarado (guia estadual): só vale se apontar um cliente só (03)
  const raizes = raizesDoTexto(bruto).filter(r => cad.porRaiz.has(r));
  const porRaiz = [...new Set(raizes.flatMap(r => [...cad.porRaiz.get(r)]))];
  if (porRaiz.length === 1) { ev.push('raiz do CNPJ impressa'); return { cliente: porRaiz[0], conf: 0.92, como: 'doc' }; }
  // a razão social do cabeçalho primeiro (no corpo de um extrato aparecem os nomes de quem pagou/recebeu)
  const noCabecalho = clientesPeloNomeNoTexto(bruto.slice(0, 700), cad);
  const nomes = noCabecalho.length === 1 ? noCabecalho : clientesPeloNomeNoTexto(bruto.slice(0, 4000), cad);
  for (const mk of mascarasDoTexto(bruto)) {
    const bate = [...cad.porCod.values()].filter(c => c.doc.length === 14 && [...mk].every((ch, i) => ch === '*' || ch === c.doc[i])).map(c => c.codigo);
    const ambos = bate.filter(c => nomes.includes(c));
    if (ambos.length === 1) { ev.push('CNPJ mascarado + razão social'); return { cliente: ambos[0], conf: 0.9, como: 'doc' }; }
  }
  if (nomes.length === 1) { ev.push('razão social escrita no documento'); return { cliente: nomes[0], conf: sub && sub.codigo !== nomes[0] ? 0.8 : 0.88, como: 'nome' }; }
  if (nomes.length > 1 && sub && nomes.includes(sub.codigo)) { ev.push('razão social escrita e ' + sub.como); return { cliente: sub.codigo, conf: 0.88, como: 'nome' }; }
  if (nomes.length > 1) return { motivo: 'CLIENTE_AMBIGUO', candidatos: nomes };
  // 23/10/2026 (a migração): a pasta com o código E o nome do cadastro ("0010 - DORNAS HAVANA LTDA - ME") é pista forte
  if (sub) { ev.push('só a pasta de origem (' + sub.como + ')'); return { cliente: sub.codigo, conf: sub.forte ? 0.9 : 0.8, como: sub.forte ? 'pastaConferida' : 'pasta' }; }
  return { motivo: 'CLIENTE_NAO_LOCALIZADO' };
}

/**
 * O cliente do relatório de notas (23/10/2026): é quem emitiu o relatório (o cabeçalho), nunca os favorecidos da lista —
 * o CNPJ no nome do arquivo ("RelatSaidasCupom55887431000103_202609") ou no cabeçalho; senão a pasta de origem, quando o
 * nome do cabeçalho é o do cliente dela (abreviado: "ALMEIDA E SOUZA PROD ALIMENTICIOS" = ALMEIDA & SOUZA PRODUTOS …).
 */
function clienteDoRelatorio(u, entrada, ctx, ev) {
  const cad = ctx.cadastro;
  const doNome = unico((String(entrada.nome || '').match(/\d{14}/g) || []).filter(cnpjValido).flatMap(d => clientesDoDoc(d, cad)));
  if (doNome) { ev.push('CNPJ do emitente no nome do arquivo do relatório'); return { cliente: doNome, conf: 0.95, como: 'doc' }; }
  const cab = u.slice(0, 600);
  const doCab = unico(documentosDoTexto(cab).map(d => d.doc).flatMap(d => clientesDoDoc(d, cad)));
  if (doCab) { ev.push('CNPJ do cabeçalho do relatório'); return { cliente: doCab, conf: 0.95, como: 'doc' }; }
  const sub = clienteDaPasta(entrada.rel, cad);
  const cli = sub && cad.porCod.get(sub.codigo);
  if (cli) {
    const fora = new Set(['LTDA', 'EPP', 'EIRELI', 'ME', 'SA', 'CIA', 'E', 'DE', 'DA', 'DO', 'DOS', 'DAS']);
    const tok = s => textoDeNome(s).trim().split(' ').filter(w => w.length >= 2 && !fora.has(w));
    const doCli = tok(cli.razao), noCab = tok(cab.slice(0, 400));
    const bate = w => noCab.some(x => x.length >= 4 && w.length >= 4 ? (w.startsWith(x) || x.startsWith(w)) : x === w);
    if (doCli.length >= 2 && doCli.every(bate)) { ev.push('a razão do cabeçalho é a do cliente da pasta (' + sub.como + ')'); return { cliente: sub.codigo, conf: 0.9, como: 'pasta' }; }
  }
  return null;
}

function decidirPdf(entrada, ctx, ev, porHash) {
  const paginas = Array.isArray(entrada.texto) ? entrada.texto : [String(entrada.texto || '')];
  const bruto = paginas.slice(0, 3).join('\n');
  const u = norm(bruto);
  if (u.replace(/\s/g, '').length < 40) return { acao: 'NAO_IDENTIFICADO', motivo: 'CONTEUDO_SEM_TEXTO', confianca: 0, tipo: 'PDF', evidencias: ev.concat('PDF sem camada de texto (escaneado): sem OCR, o robô não lê; a rotina antiga lia a imagem (Dicionário §12)'), cliente: porHash || null };
  // Santander: título, competência e titular costumam estar na página 2 (Dicionário §6.1.2) — já está em `bruto`
  const regra = REGRAS_PDF.find(r => r.re.test(u));
  if (!regra) {
    const c = clienteDoPdf(u, bruto, entrada, ctx, ev, { tipo: '?' }, {});
    return { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_NAO_RECONHECIDO', confianca: 0.3, tipo: 'PDF', cliente: c.cliente || porHash || null, evidencias: ev.concat('nenhum título conhecido no cabeçalho') };
  }
  ev.push('título: ' + regra.tipo + ' (' + regra.fonte + ')');
  const campos = regra.campos(u) || {};
  // PDF com vários documentos: a rotina antiga separava (02-SEPARADOR). Aqui não se corta: se cada página traz outro
  // contribuinte ou outro período de guia, o arquivo fica na origem como PDF composto (Dicionário §4.1).
  if (paginas.length > 1 && ['DAS', 'DARF', 'DAE', 'DAM', 'FGTS', 'NF-e PDF', 'NFS-e PDF', 'CT-e PDF', 'NFC-e PDF', 'CERTIDAO'].includes(regra.tipo)) {
    const titulos = paginas.filter(p => regra.re.test(norm(p))).length;
    const venc = new Set(paginas.map(p => camposDaGuia(norm(p)).vencimento).filter(Boolean));
    if (titulos > 2 || (regra.tipo.startsWith('DA') && venc.size > 1)) return { acao: 'FICA', motivo: 'PDF_COMPOSTO_NAO_SEPARADO', confianca: 0.5, tipo: regra.tipo, setor: regra.setor, evidencias: ev.concat(titulos + ' páginas com o título ' + regra.tipo + ': o robô não separa PDF (02-SEPARADOR)') };
  }
  if (regra.tipo === 'COMPROVANTE' && campos.pareceExtrato) {
    // Dicionário §6.1.1: "Comprovante" com várias transações e saldo é extrato
    const r2 = REGRAS_PDF.find(r => r.tipo === 'EXTRATO');
    ev.push('§6.1.1: título "Comprovante" com saldo corrente → extrato');
    return montarContabil(r2, r2.campos(u), u, bruto, entrada, ctx, ev, porHash);
  }
  if (regra.setor === 'CONTABIL') return montarContabil(regra, campos, u, bruto, entrada, ctx, ev, porHash);
  const c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : (regra.tipo === 'RELATORIO DE NOTAS' && clienteDoRelatorio(u, entrada, ctx, ev)) || clienteDoPdf(u, bruto, entrada, ctx, ev, regra, campos);
  if (!c.cliente) return { acao: 'NAO_IDENTIFICADO', motivo: c.motivo, confianca: 0.3, tipo: regra.tipo, setor: regra.setor, evidencias: ev.concat(c.candidatos ? 'candidatos ' + c.candidatos.join(', ') : []) };
  const base = { cliente: c.cliente, comoCliente: c.como, setor: regra.setor, tipo: regra.tipo, fonte: regra.fonte, nomeArquivo: entrada.nome };
  const nomeOrig = entrada.nome;
  switch (regra.tipo) {
    case 'DAS': case 'DARF': case 'DAE': case 'DAM': {
      const comp = campos.competencia || (campos.ano ? { ano: campos.ano } : null);
      if (!comp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      if (campos.parcelamento) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'PARCELAMENTO_SEM_REGRA_DETERMINISTICA', confianca: 0.6, evidencias: ev.concat('05d §2: parcelamento precisa de nº da parcela/modalidade; fica para conferência') });
      if (regra.tipo === 'DAS') return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: comp, fiscal: ['DAS'], nomeFinal: mesAno(comp) + '.pdf' });
      if (!campos.tributo) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('tributo da guia não reconhecido (05d §4)') });
      if (!campos.valor || !campos.vencimento) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: !campos.valor ? 'VALOR_AUSENTE' : 'VENCIMENTO_AUSENTE', confianca: 0.5 });
      const ma = comp.mes ? mesAno(comp) : String(comp.ano);
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: comp, fiscal: [regra.tipo], nomeFinal: ma + ' - ' + regra.tipo + ' ' + campos.tributo + ' - VALOR ' + campos.valor + ' - VENCIMENTO ' + campos.vencimento + '.pdf' });
    }
    case 'FGTS': {
      if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      // 23/10/2026 (Vitor): <ano>\<cliente>\DEPARTAMENTO PESSOAL\<MM>\FGTS\, como o robô do FGTS grava (era SOCIETÁRIO\IMPOSTOS\FGTS\AAAA)
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, caminho: ['DEPARTAMENTO PESSOAL', dois(campos.competencia.mes), 'FGTS'], nomeFinal: 'FGTS ' + mesAno(campos.competencia) + '.pdf' });
    }
    case 'DIRF': {
      if (!campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, fiscal: ['DIRF'], nomeFinal: campos.ano + ' - DIRF.pdf', competencia: { ano: campos.ano } });
    }
    case 'DEFIS': case 'ECF': {
      if (!campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      const nf = campos.ano + ' - ' + (campos.recibo ? 'RECIBO ' : '') + regra.tipo + '.pdf';
      if (regra.tipo === 'DEFIS') return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, caminho: ['FISCAL', 'SIMPLES NACIONAL', '14. DEFIS'], nomeFinal: nf, competencia: { ano: campos.ano } });
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, fiscal: ['ECF'], nomeFinal: nf, competencia: { ano: campos.ano } });
    }
    case 'LIVRO_FISCAL': {
      const p = campos.periodo;
      if (!p) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      const ini = { mes: p.de.mes, ano: p.de.ano }, f = { mes: p.ate.mes, ano: p.ate.ano };
      const nm = (mesAno(ini) === mesAno(f) ? mesAno(f) : mesAno(ini) + ' A ' + mesAno(f)) + ' - ' + campos.livro + '.pdf';
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: f, fiscal: ['LIVROS', String(f.ano)], nomeFinal: nm });
    }
    case 'NFC-e PDF': case 'NF-e PDF': case 'CT-e PDF': return montarNotaPdf(regra, campos, u, bruto, base, c, ctx, ev);
    case 'NFS-e PDF': return montarNfsePdf(campos, u, bruto, base, c, ctx, ev);
    case 'RELATORIO DE NOTAS': {
      const p = campos.periodo;
      if (!p || p.de.mes !== p.ate.mes || p.de.ano !== p.ate.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('relatório de notas sem período de um mês') });
      const comp = { mes: p.ate.mes, ano: p.ate.ano };
      const cli = ctx.cadastro.porCod.get(c.cliente);
      const lado = campos.recebidas ? 'RECEBIDOS' : 'EMITIDOS';
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, 0.95), competencia: comp, fiscal: ['DOCS', lado, 'RELATÓRIO MENSAL', String(comp.ano)], nomeFinal: mesAno(comp) + ' - RELATORIO NOTAS ' + (campos.recebidas ? 'RECEBIDAS' : 'EMITIDAS') + ' - ' + nomeNormalizado(cli ? cli.razao : '') + '.pdf' });
    }
    case 'DP FUNCIONARIO': {
      if (!campos.nome) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, tipo: 'DP FUNCIONARIO ' + campos.doc, evidencias: ev.concat('nome do funcionário não lido no documento') });
      if (!campos.data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, tipo: 'DP FUNCIONARIO ' + campos.doc, evidencias: ev.concat('data do ' + campos.doc + ' não lida') });
      ev.push('funcionário: ' + campos.nome + ' · ' + campos.doc + ' de ' + campos.data);
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, 0.95), tipo: 'DP FUNCIONARIO ' + campos.doc, competencia: { mes: +campos.data.slice(3, 5), ano: +campos.data.slice(6) }, caminho: ['DEPARTAMENTO PESSOAL', 'FUNCIONÁRIOS', campos.nome], nomeFinal: campos.doc + ' ' + campos.data.replace(/\//g, '-') + '.pdf' });
    }
    case 'CARTAO CNPJ': case 'DOC CONSTITUTIVO':
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, caminho: ['SOCIETÁRIO', 'DOCUMENTOS CONSTITUTIVOS'], nomeFinal: nomeOrig });
    case 'CERTIDAO':
      if (!campos.orgao || !campos.data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: !campos.orgao ? 'EMITENTE_INDETERMINADO' : 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      // a raiz do ano (23/10/2026): o ano da data da certidão
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: /^\d{2}-\d{2}-\d{4}$/.test(campos.data) ? { mes: +campos.data.slice(3, 5), ano: +campos.data.slice(6) } : null, caminho: ['SOCIETÁRIO', 'CERTIDÕES', campos.orgao], nomeFinal: campos.data + '.pdf' });
    case 'FOLHA':
      if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, caminho: ['SOCIETÁRIO', 'FOLHA DE PAGAMENTO', String(campos.competencia.ano), dois(campos.competencia.mes)], nomeFinal: nomeOrig });
    default:
      return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_NAO_RECONHECIDO', confianca: 0.3 });
  }
}

/** NF-e/NFC-e/CT-e em PDF: tudo sai da chave de acesso (emitente, número, modelo). */
function montarNotaPdf(regra, campos, u, bruto, base, c, ctx, ev) {
  const ch = campos.chave;
  if (!ch) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('chave de acesso não lida') });
  const mod = ch.slice(20, 22);
  const tipo = mod === '65' ? 'NFC-e' : mod === '57' ? 'CT-e' : 'NF-e';
  const emit = ch.slice(6, 20);
  const num = String(+ch.slice(25, 34));
  const cad = ctx.cadastro;
  const ehEmitente = clientesDoDoc(emit, cad).includes(c.cliente) || (cad.porCod.get(c.cliente) || {}).doc === emit;
  const data = campos.emissao;
  if (!data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
  const lado = ehEmitente ? 'EMITIDOS' : 'RECEBIDOS';
  if (tipo === 'NFC-e') {
    if (!ehEmitente) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'EMITENTE_INDETERMINADO', confianca: 0.5 });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, tipo: 'NFC-e PDF', competencia: { mes: +data.slice(3, 5), ano: +data.slice(6) }, fiscal: ['DOCS', 'EMITIDOS', 'NFC-e', data.slice(6), data.slice(3, 5)], nomeFinal: data + ' - NFC-e ' + num + '.pdf' });
  }
  let emissor = ehEmitente ? (cad.porCod.get(c.cliente) || {}).razao : null;
  // o download do SIEG/portal nomeia "<chave> - <RAZÃO SOCIAL DO EMITENTE>.pdf": a razão vem do nome quando a chave confere
  const peloNome = /^(\d{44}) - (.+)\.pdf$/i.exec(base.nomeArquivo || '');
  if (!emissor && peloNome && peloNome[1] === ch) emissor = peloNome[2];
  if (!emissor) {
    // razão social do emitente: a linha que vem logo antes do CNPJ dele no texto
    const docs = documentosDoTexto(bruto);
    const d = docs.find(x => x.doc === emit);
    if (d) { const antes = bruto.slice(Math.max(0, d.pos - 200), d.pos).split('\n').map(s => s.trim()).filter(s => /[A-Za-z]{3}/.test(s) && !/CNPJ|INSCRI|ENDERE|RUA|AV\.|BAIRRO|CEP|FONE|PROTOCOLO|AUTORIZA|CHAVE|DANFE|NATUREZA|EMISS|ENTRADA|SA[IÍ]DA/i.test(s)); emissor = antes.pop() || null; }
  }
  if (!emissor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('razão social do emissor não lida') });
  const agro = tipo === 'NF-e' ? (/CARVAO VEGETAL|\bCARVAO\b/.test(u) ? 'CARVÃO' : /\bCAFE (EM GRAO|CRU|BENEFICIADO|ARABICA|CONILON)/.test(u) ? 'CAFÉ' : /\b(BOVINOS?|GADO|NOVILH[AO]S?|BEZERR[AO]S?)\b/.test(u) ? 'GADO' : null) : null;
  const pasta = ['DOCS', lado].concat(campos.cancelada ? ['CANCELADAS'] : tipo === 'CT-e' ? ['ESPECÍFICOS', 'TRANSPORTES', 'CT-E'] : agro ? ['ESPECÍFICOS', 'AGRO', agro] : []);
  const nm = data + ' - ' + (campos.cancelada ? 'CANCELAMENTO ' : '') + tipo + (agro && !campos.cancelada ? ' ' + semAcento(agro) : '') + ' ' + num + ' - ' + nomeNormalizado(emissor) + '.pdf';
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, ehEmitente ? 0.95 : 0.88), tipo: tipo + ' PDF', competencia: { mes: +data.slice(3, 5), ano: +data.slice(6) }, fiscal: pasta, nomeFinal: nm, evidencias: ev.concat('05d §1: ' + lado + ' (emitente da chave ' + (ehEmitente ? '=' : '≠') + ' cliente)') });
}

function montarNfsePdf(campos, u, bruto, base, c, ctx, ev) {
  const cad = ctx.cadastro;
  const docs = documentosDoTexto(bruto).filter(d => !ESCRITORIO.has(d.doc) || true);
  const { prestador } = papeisDaNfse(u, docs);
  if (!campos.numero || !campos.emissao) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('nº ou data da NFS-e não lidos') });
  const cli = cad.porCod.get(c.cliente) || {};
  const emitida = prestador && (prestador === cli.doc || clientesDoDoc(prestador, cad).includes(c.cliente));
  let emissor = emitida ? cli.razao : null;
  if (!emissor && prestador) {
    const d = docs.find(x => x.doc === prestador);
    const depois = bruto.slice(d.pos, d.pos + 400).split('\n').map(s => s.trim());
    const r = depois.find(s => /^(NOME|RAZAO|RAZÃO)/i.test(s));
    emissor = r ? r.replace(/^[^:]*:\s*/, '') : null;
    if (!emissor) { const antes = bruto.slice(Math.max(0, d.pos - 200), d.pos).split('\n').map(s => s.trim()).filter(s => /[A-Za-z]{3}/.test(s) && !/CNPJ|CPF|INSCRI|ENDERE|PRESTADOR|DADOS/i.test(s)); emissor = antes.pop() || null; }
  }
  if (!emissor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'EMITENTE_INDETERMINADO', confianca: 0.5 });
  const comp = campos.competencia || { mes: +campos.emissao.slice(3, 5), ano: +campos.emissao.slice(6) };
  const nm = campos.emissao + ' - NFS-e ' + campos.numero + ' - ' + nomeNormalizado(emissor) + (campos.cancelada ? ' - CANCELADA' : '') + '.pdf';
  if (!emitida && cli.regime === 'ISENTA') {
    // 05/05e: NFS-e recebida por cliente isento vai para o contábil (04, Nota de Serviço Recebida)
    return Object.assign(base, { acao: 'ARQUIVAR', setor: 'CONTABIL', confianca: Math.min(c.conf, 0.88), competencia: comp, caminho: ['CONTÁBIL', 'NOTAS DE SERVIÇO RECEBIDAS', String(comp.ano), dois(comp.mes)], nomeFinal: nm, fonte: '04 (Nota de Serviço Recebida, só ISENTA)' });
  }
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, emitida ? 0.95 : 0.88), competencia: comp, fiscal: ['DOCS', emitida ? 'EMITIDOS' : 'RECEBIDOS'].concat(campos.cancelada ? ['CANCELADAS'] : []), nomeFinal: nm });
}

/** Contábil (04): extratos, comprovantes, aplicações, maquininhas, recebimentos, balancete, relatório LJ. */
function montarContabil(regra, campos, u, bruto, entrada, ctx, ev, porHash) {
  const c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : clienteDoPdf(u, bruto, entrada, ctx, ev, regra, campos);
  if (!c.cliente) return { acao: 'NAO_IDENTIFICADO', motivo: c.motivo, confianca: 0.3, tipo: regra.tipo, setor: 'CONTABIL', evidencias: ev.concat(c.candidatos ? 'candidatos ' + c.candidatos.join(', ') : []) };
  const base = { cliente: c.cliente, comoCliente: c.como, setor: 'CONTABIL', tipo: regra.tipo, fonte: regra.fonte };
  if (regra.tipo === 'OPERACAO DE CREDITO') {
    // 04: OPERAÇÕES DE CRÉDITO\[ANO]\[TIPO]\[BANCO]\[Nº CONTRATO]\CONTRATO.pdf. Só o CONTRATO/comprovante da contratação, com
    // o nº do contrato escrito (ex. "Comprovante de Transação Bancária · Giro Pronampe · Número contrato: 17896320"); o
    // extrato/evolução da operação (nome com o período) ainda vai para conferência
    const num = (/N(?:UMERO|º|O\.?)?\s*(?:DO\s+)?CONTRATO\s*:?\s*([0-9][0-9./-]{4,})/.exec(u) || [])[1];
    const tipoOp = /CONSORCIO/.test(u) ? 'CONSÓRCIO' : /FINANCIAMENTO|FINAME|\bFNE\b/.test(u) ? 'FINANCIAMENTO' : /EMPRESTIMO|GIRO|PRONAMPE/.test(u) ? 'EMPRÉSTIMO' : null;
    const ehContrato = /DADOS DA CONTRATACAO|DATA DE CONTRATACAO|CONTRATO DE (EMPRESTIMO|FINANCIAMENTO)|CEDULA DE CREDITO BANCARIO/.test(u) && !/EXTRATO|EVOLUCAO CONTRATUAL/.test(u.slice(0, 400));
    const bancoOp = bancoDoTexto(bruto, true);
    const dataOp = dataBr(linhaApos(u, /DATA DE CONTRATACAO|DATA DA CONTRATACAO|DATA DA OPERACAO/, 120));
    if (!ehContrato || !num || !tipoOp || !bancoOp || !dataOp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: !num ? 'CONTRATO_SEM_NUMERO' : !tipoOp ? 'TIPO_AUSENTE' : !bancoOp ? 'BANCO_AUSENTE' : 'CONTRATO_SEM_NUMERO', confianca: 0.6, evidencias: ev.concat('operação de crédito: só o contrato com nº, tipo, banco e data escritos é arquivado sozinho (extrato da operação vai para conferência)') });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: { ano: +dataOp.slice(6) }, caminho: ['CONTÁBIL', 'OPERAÇÕES DE CRÉDITO', dataOp.slice(6), tipoOp, bancoOp, num.replace(/[./]/g, '-')], nomeFinal: 'CONTRATO.pdf', fonte: '04 (Op. Crédito)' });
  }
  if (regra.tipo === 'INFORME DE RENDIMENTOS') {
    if (!campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
    const fonte = bancoDoTexto(bruto, true) || (campos.fonte ? nomeNormalizado(campos.fonte) : null);
    if (!fonte) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'EMITENTE_INDETERMINADO', confianca: 0.5 });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: { ano: campos.ano }, caminho: ['CONTÁBIL', 'INFORME DE RENDIMENTOS', String(campos.ano)], nomeFinal: (campos.trimestre ? campos.trimestre + 'º TRIMESTRE ' : '') + campos.ano + ' - INFORME DE RENDIMENTOS ' + fonte + '.pdf' });
  }
  if (regra.tipo === 'BALANCETE') {
    let ano = campos.ano;
    if (!ano) { const n = /(20\d{2})/.exec(entrada.nome); if (n) { ano = +n[1]; ev.push('ano pelo nome do arquivo'); } }
    if (!ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: { ano }, caminho: ['CONTÁBIL', 'REGISTRO DE LIVROS', '(001) ' + ano], nomeFinal: entrada.nome });
  }
  if (regra.tipo === 'RELATORIO LJ') {
    if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, caminho: ['Relatorios LJ'], nomeFinal: mesAno(campos.competencia) + campos.sufixo + '.pdf' });
  }
  // banco: cabeçalho fora dos lançamentos; senão o nome do arquivo (confiança menor)
  let banco = bancoDoTexto(bruto, regra.tipo !== 'MAQUININHAS');
  const doNome = bancoDoNome(entrada.nome);
  const reNome = doNome && (BANCOS.find(b => b[0] === doNome) || [])[1];
  if (banco && doNome && banco !== doNome && reNome && reNome.test(norm(bruto))) { ev.push('banco do nome do arquivo, também escrito no documento: ' + doNome); banco = doNome; }
  if (banco && doNome && banco !== doNome) {
    // o nome do arquivo diz um banco e o conteúdo outro (que pode ser o do lançamento): não escolhe
    return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'BANCO_DIVERGENTE', confianca: 0.6, evidencias: ev.concat('conteúdo: ' + banco + ' × nome do arquivo: ' + doNome) });
  }
  let confBanco = 0.97;
  if (!banco) { banco = bancoDoNome(entrada.nome) || bancoDoNome(partesDoCaminho(entrada.rel).slice(-2, -1)[0] || ''); confBanco = 0.88; if (banco) ev.push('banco pelo nome do arquivo'); }
  if (!banco) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'BANCO_AUSENTE', confianca: 0.5 });
  let comp = campos.competencia, confComp = 0.97;
  if (!comp) { comp = competenciaDoNome(entrada.nome); confComp = 0.88; if (comp) ev.push('competência pelo nome do arquivo'); }
  if (!comp) { comp = competenciaDaPasta(entrada.rel); confComp = 0.8; if (comp) ev.push('competência pela pasta do mês'); }
  // a migração (23/10/2026): a pasta de origem com o mês ("…\EXTRATOS\2022\02\") de reserva; quando o conteúdo discorda, vale o
  // conteúdo e fica registrado
  const pastaComp = (r => (r && r.mes ? r : null))(anoDaPasta(entrada.rel || ''));
  if (!comp && pastaComp) { comp = { mes: pastaComp.mes, ano: pastaComp.ano }; confComp = 0.88; ev.push('competência pela pasta de origem (' + mesAno(comp) + ')'); }
  if (comp && pastaComp && (pastaComp.mes !== comp.mes || pastaComp.ano !== comp.ano)) ev.push('o período do conteúdo (' + mesAno(comp) + ') difere do da pasta de origem (' + mesAno(pastaComp) + '): vale o do conteúdo');
  if (!comp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
  const conf = Math.min(c.conf, confBanco, confComp);
  const ano = String(comp.ano), mes = dois(comp.mes), ma = mesAno(comp);
  const ext = (/\.[a-z0-9]+$/i.exec(entrada.nome) || ['.pdf'])[0].toLowerCase();
  const pasta = { EXTRATO: 'BANCÁRIOS', COMPROVANTE: 'COMPROVANTES', APLICACOES: 'APLICAÇÕES', MAQUININHAS: 'MAQUININHAS' }[regra.tipo];
  if (pasta) {
    let nomeFinal = (regra.tipo === 'COMPROVANTE' ? 'Comprovantes ' : '') + ma + ext;
    if (regra.tipo === 'EXTRATO' && campos.variosMeses && campos.periodo) nomeFinal = mesAno(campos.periodo.de) + ' A ' + ma + ext;   // 04: extrato consolidado
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: conf, competencia: comp, caminho: ['CONTÁBIL', 'EXTRATOS', ano, mes, pasta, banco], nomeFinal });
  }
  if (regra.tipo === 'RECEBIMENTO DE CLIENTES') return Object.assign(base, { acao: 'ARQUIVAR', confianca: conf, competencia: comp, caminho: ['CONTÁBIL', 'RECEBIMENTO DE CLIENTES', ano, mes], nomeFinal: banco + ' ' + ma + ext });
  if (regra.tipo === 'FATURA CARTAO') return Object.assign(base, { acao: 'ARQUIVAR', confianca: conf, competencia: comp, caminho: ['CONTÁBIL', 'EXTRATOS', ano, mes], nomeFinal: 'EXTRATO_' + banco + '_' + ma + ext });
  return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_NAO_RECONHECIDO', confianca: 0.3 });
}

/**
 * Só o "o que é", sem o cliente: tipo, banco/operadora e competência pelo conteúdo (e, se `usarNome`, pelo nome do
 * arquivo como as regras fazem). Serve para medir a classificação nos EXEMPLOS DE ARQUIVOS da rotina, que são modelos.
 */
function perfilDoDocumento(entrada, usarNome) {
  const nome = usarNome ? entrada.nome : 'documento' + ((/\.[a-z0-9]+$/i.exec(entrada.nome) || [''])[0]);
  if (/\.pdf$/i.test(entrada.nome)) {
    const paginas = Array.isArray(entrada.texto) ? entrada.texto : [String(entrada.texto || '')];
    const bruto = paginas.slice(0, 3).join('\n');
    const u = norm(bruto);
    if (u.replace(/\s/g, '').length < 40) return { tipo: null, motivo: 'CONTEUDO_SEM_TEXTO' };
    let regra = REGRAS_PDF.find(r => r.re.test(u));
    if (!regra) return { tipo: null, motivo: 'TIPO_NAO_RECONHECIDO' };
    let campos = regra.campos(u) || {};
    if (regra.tipo === 'COMPROVANTE' && campos.pareceExtrato) { regra = REGRAS_PDF.find(r => r.tipo === 'EXTRATO'); campos = regra.campos(u); }
    const banco = bancoDoTexto(bruto) || bancoDoNome(nome);
    const comp = campos.competencia || competenciaDoNome(nome);
    return { tipo: regra.tipo, banco, competencia: comp ? mesAno(comp) : null };
  }
  if (/\.(xlsx|xls|csv)$/i.test(entrada.nome)) {
    const u = norm((entrada.planilha || []).slice(0, 15).map(l => (l || []).join(' | ')).join('\n'));
    if (ehMaquininha(u)) return { tipo: 'MAQUININHAS', banco: bancoDoTexto(u) || bancoDoNome(nome) };
    return { tipo: null, motivo: 'TIPO_NAO_RECONHECIDO' };
  }
  return { tipo: null, motivo: 'FORMATO_SEM_REGRA' };
}

/** Uma pasta de OUTRO código com o mesmo começo de nome (as 2 primeiras palavras significativas): a empresa já tem pasta. */
function pastaParecida(cli, cad) {
  const chave = n => norm(n).replace(/^\d+\s*-\s*/, '').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(p => p.length >= 3 && !/^(LTDA|EIRELI|COMERCIO|INDUSTRIA|SERVICOS|DE|DA|DO|DOS|DAS)$/.test(p)).slice(0, 2).join(' ');
  const k = chave(cli.razao);
  if (k.split(' ').length < 2) return null;
  for (const p of cad.todasAsPastas || []) {
    const m = /^(\d+)\s*-\s*/.exec(p);
    if (!m || +m[1] === cli.codigo || chave(p).slice(0, k.length - 1) !== k.slice(0, k.length - 1)) continue;
    // matriz e filial com códigos próprios (mesma raiz de CNPJ) têm pastas próprias (03): não é a mesma empresa repetida
    const outro = cad.porCod.get(+m[1]);
    if (outro && outro.doc.length === 14 && cli.doc.length === 14 && outro.doc.slice(0, 8) === cli.doc.slice(0, 8)) continue;
    return p;
  }
  return null;
}

/**
 * Último passo, igual para todos: regime e pasta do regime (fiscal), pasta raiz do cliente, limiar de confiança.
 * 03 regra 5: a confiança é a do elo mais fraco; abaixo de 0.85 → NAO_IDENTIFICADO.
 */
/**
 * O destino de um documento num cliente: regime e pasta do regime (fiscal), pasta raiz (existente, ou nova só com o CNPJ
 * do documento). Devolve { erro: { acao, motivo, evidencia } } ou { pastaCliente, criarPastaCliente, caminho, regime }.
 */
function destinoNoCliente(d, cli, comoCliente, cad, ano) {
  let caminho = d.caminho;
  if (d.fiscal) {
    // 03 regra 3 / 05: regime do cadastro (nunca do documento); MEI sem especialista fica na origem
    if (cli.regime === undefined) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', evidencia: 'enquadramento "' + cli.regimeTexto + '" fora do Dicionário §2.1' } };
    if (!cli.regime) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'REGIME_INDEFINIDO' } };
    if (cli.regime === 'MEI') return { erro: { acao: 'FICA', motivo: 'REGIME_SEM_ESPECIALISTA', evidencia: '05: MEI ainda sem regra fiscal; fica na origem' } };
    const arv = ARVORE[cli.regime];
    const chave = d.fiscal[0];
    if (!arv[chave]) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_INCOMPATIVEL_COM_REGIME', evidencia: chave + ' não previsto em ' + cli.regime } };
    caminho = ['FISCAL', cli.regime, arv[chave]].concat(d.fiscal.slice(1));
  }
  // 03 regra 1/2: pasta raiz pelo código; sem pasta, só cria se o cliente veio do CNPJ do documento. A raiz é a do ano
  // (23/10/2026): G:\Meu Drive\<ano>; a pasta do cliente num ano tem o mesmo nome que a de 2026 (ou "<cód> - <razão>")
  const doAno = pastasDoAno(cad, ano);
  if (doAno.duplicadas.has(cli.codigo)) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'PASTA_DO_CLIENTE_DUPLICADA', evidencia: 'o código ' + cli.codigo + ' tem mais de uma pasta em ' + (ano || ANO_DAS_PASTAS) + ' no Drive: ' + doAno.duplicadas.get(cli.codigo).join(' | ') } };
  const pasta = doAno.pastas.get(cli.codigo);
  const parecida = !pasta && pastaParecida(cli, Object.assign({}, cad, { todasAsPastas: doAno.todas }));
  if (parecida) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'PASTA_EXISTE_COM_OUTRO_CODIGO', evidencia: 'o cadastro diz ' + cli.codigo + ' - ' + cli.razao + ', mas o Drive já tem "' + parecida + '": não crio uma segunda pasta da mesma empresa' } };
  let pastaCliente, criarPastaCliente = false;
  if (pasta) pastaCliente = pasta;
  else if (['doc', 'conta', 'hash'].includes(comoCliente) || (!doAno.base && comoCliente === 'pastaConferida')) { pastaCliente = (doAno.base ? null : cad.pastas.get(cli.codigo)) || cli.codigo + ' - ' + nomeSeguro(cli.razao); criarPastaCliente = true; }
  else if (!doAno.base) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'PASTA_DO_ANO_SEM_CNPJ', evidencia: 'a pasta do cliente em ' + ano + ' ainda não existe e o documento não traz o CNPJ dele: ela só nasce com o CNPJ conferido (Vitor, 23/10/2026)' } };
  else return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', evidencia: 'pasta do cliente não existe e o documento não traz o CNPJ dele (03 regra 2)' } };
  caminho = caminho.map(nomeSeguro);
  return { pastaCliente, criarPastaCliente, caminho, regime: cli.regime || null, destinoRelativo: [pastaCliente].concat(caminho).join('\\') };
}

/**
 * As pastas de cliente de um ano: as de RAIZ_CLIENTES (ANO_DAS_PASTAS) ou as que o cadastro leu da raiz do ano
 * (cad.pastasPorAno: Map ano → [nomes]); as que o arquivador decidiu criar nesta execução entram na hora (cad.criadasPorAno).
 */
function pastasDoAno(cad, ano) {
  if (!ano || ano === ANO_DAS_PASTAS || !cad.pastasPorAno) return { base: true, pastas: cad.pastas, duplicadas: cad.pastasDuplicadas || new Map(), todas: cad.todasAsPastas || [] };
  cad._porAno = cad._porAno || new Map();
  if (!cad._porAno.has(ano)) {
    const pastas = new Map(), duplicadas = new Map(), todas = (cad.pastasPorAno.get(ano) || []).slice();
    for (const p of todas) { const m = /^(\d+)\s*-\s*/.exec(p); if (!m) continue; if (pastas.has(+m[1])) duplicadas.set(+m[1], (duplicadas.get(+m[1]) || [pastas.get(+m[1])]).concat(p)); else pastas.set(+m[1], p); }
    cad._porAno.set(ano, { base: false, pastas, duplicadas, todas });
  }
  return cad._porAno.get(ano);
}
/** O ano da raiz: o da competência do documento; sem ela, o das pastas de origem (a migração, as pastas de mês do robô). */
const ANUAIS = new Set(['DEFIS', 'DIRF', 'ECF', 'BALANCETE', 'DMED', 'DIMOB']);
/** A data de entrega escrita no recibo ("Data e hora da transmissão: 27/03/2026", "entregue em …"): o ano, ou null. */
function anoDaEntrega(entrada) {
  const t = norm(Array.isArray(entrada && entrada.texto) ? entrada.texto.slice(0, 3).join('\n') : String((entrada && (entrada.texto || entrada.txt)) || ''));
  const m = /(TRANSMISS[AÃ]O|TRANSMITID[OA]|ENTREGUE|DATA DA ENTREGA|RECEPCAO|RECEBID[OA] EM|DATA DE RECEBIMENTO)[^0-9]{0,40}(\d{2})\/(\d{2})\/(20\d{2})/.exec(t);
  return m ? +m[4] : null;
}
function anoDoDestino(d, ctx) {
  // a declaração ou o livro ANUAL (só o ano na competência): a raiz do ano da entrega — a do recibo, ou o ano seguinte
  if (ANUAIS.has(String(d.tipo || '')) && d.competencia && d.competencia.ano && !d.competencia.mes) {
    const ano = +d.competencia.ano;
    const entrega = d.anoEntrega && d.anoEntrega >= ano ? d.anoEntrega : ano + 1;
    return { ano: entrega, de: d.anoEntrega && d.anoEntrega >= ano ? 'ano da entrega (recibo)' : 'ano da entrega (o seguinte ao do documento)' };
  }
  if (d.competencia && d.competencia.ano) return { ano: +d.competencia.ano, de: 'competência' };
  if (d.anoPista && d.anoPista.ano) return { ano: +d.anoPista.ano, de: 'pasta de origem' };
  return null;
}

/**
 * Último passo, igual para todos: destino no cliente, cópias (NFS-e da Nilma: também no tomador), OCR e limiar.
 * 03 regra 5: a confiança é a do elo mais fraco; abaixo de 0.85 → NAO_IDENTIFICADO.
 */
function finalizar(d, ctx) {
  const cad = ctx.cadastro;
  d.evidencias = d.evidencias || [];
  const cli = d.cliente != null ? cad.porCod.get(d.cliente) : null;
  if (cli) d.clienteNome = cli.razao;
  if (d.acao !== 'ARQUIVAR') return comMotivoDoCodigo(d);
  if (!cli) return comMotivoDoCodigo(Object.assign(d, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO' }));
  // a raiz do ano (23/10/2026): a competência; sem ela, o ano das pastas de origem; sem nenhum, NÃO IDENTIFICADOS (nunca 2026 por padrão)
  const anoMax = (ctx.hoje ? new Date(ctx.hoje) : new Date()).getFullYear();
  const a = anoDoDestino(d, ctx);
  if (!a) return comMotivoDoCodigo(Object.assign(d, { acao: 'NAO_IDENTIFICADO', motivo: 'ANO_INDETERMINADO', evidencias: d.evidencias.concat('sem a competência no documento nem o ano nas pastas de origem: o ano da pasta (G:\\Meu Drive\\<AAAA>) não é dedutível e não vai para 2026 por padrão') }));
  if (a.ano > anoMax && /entrega/.test(a.de)) a.ano = anoMax;   // a entrega do ano corrente ainda por vir: o ano atual
  if (a.ano < ANO_MINIMO || a.ano > anoMax) return comMotivoDoCodigo(Object.assign(d, { acao: 'NAO_IDENTIFICADO', motivo: 'ANO_FORA_DA_FAIXA', evidencias: d.evidencias.concat('o ano ' + a.ano + ' (' + a.de + ') fora de ' + ANO_MINIMO + ' a ' + anoMax) }));
  d.anoRaiz = a.ano;
  if (a.ano !== ANO_DAS_PASTAS) d.evidencias.push('raiz do ano ' + a.ano + ' (' + a.de + ')');
  const dest = destinoNoCliente(d, cli, d.comoCliente, cad, a.ano);
  if (dest.erro) return comMotivoDoCodigo(Object.assign(d, { acao: dest.erro.acao, motivo: dest.erro.motivo, evidencias: d.evidencias.concat(dest.erro.evidencia || []) }));
  Object.assign(d, { pastaCliente: dest.pastaCliente, criarPastaCliente: dest.criarPastaCliente, caminho: dest.caminho, regime: dest.regime, destinoRelativo: dest.destinoRelativo });
  d.nomeFinal = nomeSeguro(d.nomeFinal);
  // a mesma peça em outro cliente (decisão do Vitor, 21/10/2026: NFS-e de honorários da Nilma na 284 E no tomador)
  if (d.copias && d.copias.length) {
    const feitas = [];
    for (const c of d.copias) {
      const outro = cad.porCod.get(c.cliente);
      if (!outro || outro.codigo === cli.codigo) continue;
      const base = c.caminho ? Object.assign({}, d, { caminho: c.caminho, fiscal: null }) : c.fiscal ? Object.assign({}, d, { fiscal: c.fiscal }) : d;
      const dc = destinoNoCliente(base, outro, c.comoCliente || 'doc', cad, d.anoRaiz);
      if (dc.erro) { d.evidencias.push('cópia em ' + outro.codigo + ' - ' + outro.razao + ' não feita: ' + dc.erro.motivo + (dc.erro.evidencia ? ' (' + dc.erro.evidencia + ')' : '')); continue; }
      feitas.push({ cliente: outro.codigo, clienteNome: outro.razao, pastaCliente: dc.pastaCliente, criarPastaCliente: dc.criarPastaCliente, destinoRelativo: dc.destinoRelativo, nomeFinal: d.nomeFinal, anoRaiz: d.anoRaiz });
    }
    d.copias = feitas;
  }
  if (d.ocr && !d.ocr.erro) {
    // texto que veio de OCR (PDF escaneado): no máximo 0,90; leitura ruim do Tesseract (< 60%) fica abaixo do limiar
    // com OCR, tipo/banco/competência tirados só do nome do arquivo não bastam: abaixo do limiar
    const teto = d.ocr.confianca < 60 || d.evidencias.some(e => /pelo nome do arquivo/.test(e)) ? 0.8 : OCR_TETO;
    d.confianca = Math.min(d.confianca || 0, teto);
    d.evidencias.push('texto por OCR (Tesseract ' + d.ocr.confianca + '%): confiança limitada a ' + teto);
  }
  d.confianca = Math.round((d.confianca || 0) * 100) / 100;
  if (d.confianca < LIMIAR) return comMotivoDoCodigo(Object.assign(d, { acao: 'NAO_IDENTIFICADO', motivo: 'CONFIANCA_ABAIXO_DO_LIMIAR', destinoSugerido: (d.anoRaiz && d.anoRaiz !== ANO_DAS_PASTAS ? d.anoRaiz + '\\' : '') + d.destinoRelativo + '\\' + d.nomeFinal, copias: [] }));
  // a pasta do ano que nasce aqui vale para os próximos da mesma execução (e do mesmo cadastro em memória)
  for (const x of [d].concat(d.copias || [])) if (x.criarPastaCliente && x.anoRaiz && x.anoRaiz !== ANO_DAS_PASTAS) { const doAno = pastasDoAno(cad, x.anoRaiz); if (!doAno.base && !doAno.pastas.has(x.cliente != null ? x.cliente : d.cliente)) { doAno.pastas.set(x.cliente != null ? x.cliente : d.cliente, x.pastaCliente); doAno.todas.push(x.pastaCliente); } }
  return d;
}

// Dicionário §4.4: código curto de cada motivo (o que o relatório mostra)
const CODIGOS = {
  CLIENTE_NAO_LOCALIZADO: 'E101', CLIENTE_AMBIGUO: 'E102', EVENTO_SEM_ORIGINAL: 'E103', REGIME_INDEFINIDO: 'E104', SETOR_INDETERMINADO: 'E105', CONFIANCA_ABAIXO_DO_LIMIAR: 'E106',
  REGIME_SEM_ESPECIALISTA: 'E108', ANO_INDETERMINADO: 'E308', ANO_FORA_DA_FAIXA: 'E309', PASTA_DO_ANO_SEM_CNPJ: 'E110', PISTA_DA_PASTA_DIVERGE: 'E111', VOCABULARIO_AUSENTE: 'E201', TIPO_INCOMPATIVEL_COM_REGIME: 'E202', EMITENTE_INDETERMINADO: 'E205',
  COMPETENCIA_AUSENTE: 'E303', VALOR_AUSENTE: 'E304', BANCO_AUSENTE: 'E305', CONTEUDO_ILEGIVEL: 'E307', CONTEUDO_SEM_TEXTO: 'E307', MENSAGEM_DA_SEFAZ: 'E402',
  IDENTICO_JA_ARQUIVADO: 'E401', PDF_COMPOSTO_NAO_SEPARADO: 'E701', FERRAMENTA_EXTRACAO_AUSENTE: 'E703', ARQUIVO_COMPACTADO_CORROMPIDO: 'E704',
};
function comMotivoDoCodigo(d) { if (d.motivo) d.codigo = CODIGOS[d.motivo] || null; return d; }

// ---------------------------------------------------------------------------------------------------------------------
// para medir contra a história: o "tipo" de um destino já arquivado pela rotina antiga
// ---------------------------------------------------------------------------------------------------------------------
/** "G:\Meu Drive\2026\58 - X\CONTÁBIL\EXTRATOS\2026\06\BANCÁRIOS\SICOOB" → { codigo: 58, tipo: 'EXTRATO', resto: 'CONTÁBIL/…' } */
function tipoDoDestino(destino) {
  const partes = String(destino || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const i = partes.findIndex(p => /^\d+\s*-\s*/.test(p));
  if (i < 0) return { codigo: null, tipo: 'FORA_DA_ARVORE', resto: partes.join('/') };
  const codigo = +/^(\d+)/.exec(partes[i])[1];
  const resto = partes.slice(i + 1);
  const r = norm(resto.join('/'));
  let tipo = 'OUTROS';
  const regras = [
    [/\bXML\/(NF-E|NFC-E|CT-E|NFS-E)\/EVENTOS/, m => 'XML ' + m[1].replace('NF-E', 'NF-e').replace('NFC-E', 'NFC-e').replace('CT-E', 'CT-e').replace('NFS-E', 'NFS-e') + ' EVENTOS'],
    [/\bXML\/(NF-E|NFC-E|CT-E|NFS-E)/, m => 'XML ' + m[1].replace('NF-E', 'NF-e').replace('NFC-E', 'NFC-e').replace('CT-E', 'CT-e').replace('NFS-E', 'NFS-e')],
    [/EXTRATOS\/\d{4}\/[\d-]+\/BANCARIOS/, () => 'EXTRATO'], [/EXTRATOS\/\d{4}\/[\d-]+\/COMPROVANTES/, () => 'COMPROVANTE'],
    [/EXTRATOS\/\d{4}\/[\d-]+\/APLICACOES/, () => 'APLICACOES'], [/EXTRATOS\/\d{4}\/[\d-]+\/MAQUININHAS/, () => 'MAQUININHAS'],
    [/EXTRATOS\/\d{4}\/\d{2}$/, () => 'FATURA CARTAO'], [/RECEBIMENTO DE CLIENTES/, () => 'RECEBIMENTO DE CLIENTES'],
    [/DOCUMENTOS FISCAIS\/EMITIDOS\/NFC-E/, () => 'NFC-e PDF'], [/DOCUMENTOS FISCAIS\/.*RELATORIO MENSAL/, () => 'RELATORIO DE NOTAS'],
    [/DOCUMENTOS FISCAIS/, () => 'NOTA PDF'], [/\d\d\. DAS$/, () => 'DAS'], [/\d\d\. DARF$/, () => 'DARF'], [/\d\d\. DAE$/, () => 'DAE'], [/\d\d\. DAM$/, () => 'DAM'],
    [/IMPOSTOS\/FGTS|DEPARTAMENTO PESSOAL\/\d{2}\/FGTS/, () => 'FGTS'], [/SPED FISCAL/, () => 'SPED FISCAL'], [/SPED CONTRIBUICOES/, () => 'SPED CONTRIBUIÇÕES'], [/SINTEGRA/, () => 'SINTEGRA'],
    [/LIVROS FISCAIS/, () => 'LIVRO_FISCAL'], [/DEFIS/, () => 'DEFIS'], [/\bECF\b/, () => 'ECF'], [/REGISTRO DE LIVROS/, () => 'BALANCETE'],
    [/DOCUMENTOS CONSTITUTIVOS/, () => 'DOC CONSTITUTIVO'], [/CERTIFICADO DIGITAL/, () => 'CERTIFICADO DIGITAL'], [/CERTIDOES/, () => 'CERTIDAO'],
    [/FOLHA DE PAGAMENTO/, () => 'FOLHA'], [/RELATORIOS LJ/, () => 'RELATORIO LJ'], [/PARCELAMENTOS/, () => 'PARCELAMENTO'],
    [/NOTAS DE SERVICO RECEBIDAS/, () => 'NFS-e PDF'], [/PAGAMENTOS DE FORNECEDORES/, () => 'FATURA FORNECEDOR'], [/OPERACOES DE CREDITO/, () => 'OPERACAO DE CREDITO'],
    [/VENDA DE ATIVOS/, () => 'VENDA DE ATIVOS'], [/PAPEIS DE TRABALHO/, () => 'PAPEL DE TRABALHO'], [/INFORME DE RENDIMENTOS/, () => 'INFORME DE RENDIMENTOS'], [/OUTROS DOCUMENTOS/, () => 'OUTROS DOCUMENTOS'], [/GUIAS/, () => 'GUIA (layout antigo)'],
  ];
  for (const [re, f] of regras) { const m = re.exec(r); if (m) { tipo = f(m); break; } }
  return { codigo, tipo, resto: resto.join('/') };
}

module.exports = {
  LIMIAR, RAIZ_CLIENTES, ARVORE, REGRAS_PDF, BANCOS, ANUAIS, ofxCompetencia, anoDaEntrega, ANO_MINIMO, ANO_DAS_PASTAS, anoDaPasta, pastasDoAno, partesDoCaminho, comMotivoDoCodigo,
  semAcento, norm, chaveNome, nomeNormalizado, nomeSeguro, so, dataBr, valorBr, competenciaSolta, competenciaDoNome, competenciaDaPasta, periodoEscrito,
  cnpjValido, cpfValido, documentosDoTexto, raizesDoTexto, mascarasDoTexto,
  regimeCanonico, montarCadastro, comAnosEMapa, clientesDoDoc, clienteDaPasta, clientesPeloNomeNoTexto,
  confirmado, pastaParecida, bancoDoTexto, bancoDoNome, lerXml, classificarXml, camposDaGuia,
  contasDoTexto, clientePelaConta, decidir, perfilDoDocumento, tipoDoDestino,
  // a decisão do admin no nads (arquivador-manual.js) passa pelo mesmo último passo: a árvore do regime e a pasta do cliente
  finalizar,
};
