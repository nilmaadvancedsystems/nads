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
  // "PERIODO: 01 A 31/07/2026" (o extrato novo do BB, 28/10/2026: o dia inicial sem o mês, grudado na conta "40282-6PERIODO")
  const m = /PERIODO\s*:?\s*(\d{1,2})\s*(?:A|ATE|-)\s*(\d{1,2})[/.-](\d{2})[/.-](\d{4})(?![\d/])/.exec(u);
  if (m && +m[3] >= 1 && +m[3] <= 12 && anoOk(+m[4]) && +m[1] >= 1 && +m[1] <= +m[2]) return { de: { dia: +m[1], mes: +m[3], ano: +m[4] }, ate: { dia: +m[2], mes: +m[3], ano: +m[4] } };
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
 * juntando dígitos do nome. `grudados`: também o CNPJ formatado colado no número de antes (abaixo).
 */
function documentosDoTexto(t, grudados) {
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
  // o CNPJ formatado grudado no número de antes (27/10/2026: o recibo do SEDIF da DeSTDA imprime a inscrição estadual e o
  // CNPJ colados, "680737193000101.884.649/0001-85"): a máscara já diz onde ele começa. Só com `grudados` (o documento sem
  // título conhecido e a pasta de origem da migração): o DANFE da HELLO também cola, e lá vale a decisão do 2º lote do Vitor
  const reGrudado = grudados ? /(?<=\d)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})(?![\d])/g : null;
  while (reGrudado && (m = reGrudado.exec(s))) {
    const d = so(m[1]);
    if (cnpjValido(d) && !achados.some(a => a.doc === d && Math.abs(a.pos - m.index) <= 1)) achados.push({ doc: d, pos: m.index });
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
  // as contas bancárias do cadastro (Vitor, 28/10/2026), uma linha por conta: { codigo, banco, agencia, conta } normalizadas
  const contas = [];
  for (const l of linhas || []) {
    const codigo = Number(l.codigo);
    if (!porCod.has(codigo)) continue;
    const vistas = new Set();
    for (const c of l.contas || []) {
      const conta = numeroDeConta(c.conta);
      if (!conta || conta.base.length < 3) continue;
      // a conta que o robô aprendeu sozinho dos extratos (origem drive/gmail) é menos certa que a posta por uma pessoa (o Vitor no
      // Entregas, o Cadastro do nads): numa conta em dois clientes, a posta por uma pessoa desempata
      const x = { codigo, banco: bancoDoCadastro(c.banco), agencia: numeroDeConta(c.agencia), conta, aprendida: c.fonte === 'entregas' && /^(drive|gmail)$/i.test(String(c.origem || '')) };
      const k = [x.banco, x.agencia && x.agencia.base, conta.base, conta.dv].join('|');
      if (!vistas.has(k)) { vistas.add(k); contas.push(x); }
    }
    porCod.get(codigo).contas = contas.filter(x => x.codigo === codigo);
    if (l.socios && l.socios.length) porCod.get(codigo).socios = l.socios;
  }
  const cad = { porCod, porDoc, porRaiz, porNome, porNomeEntregas, contas };
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
  const nomeArq = partesDoCaminho(rel).slice(-1)[0] || '';
  const mapa = cad.mapaMigracao || null;
  const vistas = [];
  for (const parte of partes.reverse()) {
    const maisFundas = vistas.slice(); vistas.push(parte);
    if (/^\d{4}-\d{2}$/.test(parte) || /^\d{6}/.test(parte)) continue;
    // 23/10/2026 (a migração): pasta de data ("03", "04.2025", "2026") não é código de cliente; a decisão do admin para a
    // pasta (o mapa da migração) vale primeiro; pasta de pessoa da equipe ou de área (FERNANDO, ADIVANIA, IMPORTAÇÃO,
    // OUTROS…) e pasta que junta matriz e filiais não dão o cliente
    if (/^\d{1,2}$/.test(parte) || /^\d{1,2}[.\-_ ]\d{4}$/.test(parte) || /^(19|20)\d{2}\b/.test(parte)) continue;
    const pm = mapa ? mapa.clienteDaPasta(parte) : undefined;
    if (pm === null) {
      // 27/10/2026 (Vitor): na pasta que junta matriz e filiais, o nome do arquivo pode dizer qual (o mapa: "OV1" = 409)
      const g = typeof mapa.grupoDaPasta === 'function' ? mapa.grupoDaPasta(parte) : null;
      const c = g ? codigoDoGrupoPeloNome(nomeArq, g) : null;
      if (c != null && cad.porCod.has(c)) return { codigo: c, como: 'pasta "' + parte + '" com "' + nomeArq + '": o nome do arquivo diz o cliente ' + c + ' (Vitor, 27/10/2026)', forte: true };
      continue;
    }
    if (pm !== undefined) { if (cad.porCod.has(pm.cliente)) return { codigo: pm.cliente, como: 'pasta "' + parte + '" = cliente ' + pm.cliente + ' (' + pm.porque + ')', forte: true }; continue; }
    if (mapa && mapa.semPista(parte)) continue;
    const m = /^(\d{1,4})\b/.exec(parte);
    if (m && cad.porCod.has(+m[1])) {
      // o código com o nome junto ("0010 - DORNAS HAVANA LTDA - ME") confere com o cadastro: pista forte (a migração)
      const resto = parte.slice(m[0].length).replace(/^\s*-?\s*/, '');
      const c = cad.porCod.get(+m[1]);
      const k = s => chaveNome(s).slice(0, 10);
      const confere = resto.length >= 4 && [c.razao].concat(c.outrosNomes || [], c.fantasia ? [c.fantasia] : []).some(n => k(n) && k(resto) && (k(n).startsWith(k(resto).slice(0, 8)) || k(resto).startsWith(k(n).slice(0, 8))));
      // uma subpasta mais funda com o nome de OUTRO cliente ("0434 - CONSTRUNOVO…\EXTRATOS - ANDRIELE.rar\…" = a 429): a pasta
      // do código não decide (27/10/2026)
      const outros = maisFundas.filter(p => /\.(zip|rar|7z)$/i.test(p)).flatMap(p => palavrasDistintivas(p).map(w => clientesPeloNomeCurto(w, cad))).filter(l => l.length && l.length <= 3 && !l.includes(+m[1]));
      if (outros.length) return null;
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

/** As palavras de uma subpasta que podem ser nome de cliente (as de 6+ letras que não são de pasta nem de mês). */
const PALAVRAS_DE_PASTA = new Set(['EXTRATOS', 'EXTRATO', 'BANCARIOS', 'DOCUMENTOS', 'DOCUMENTO', 'CONSTITUTIVOS', 'FISCAL', 'FISCAIS', 'DEPARTAMENTO', 'OUTROS', 'COMPROVANTES', 'COMPROVANTE', 'PAGTOS', 'PAGAMENTOS', 'BOLETOS', 'IMPORTACAO', 'CERTIDOES', 'CONTRATO', 'CONTRATOS', 'SOCIAL', 'LICITACAO', 'DESCOMPACTADO', 'SUCESSO', 'MATRIZ', 'FILIAL', 'SINTEGRA', 'ADICIONADOS', 'RELATORIOS', 'RELATORIO', 'PARCELAMENTO', 'SIMPLES', 'NACIONAL', 'ESTADUAL', 'FEDERAL', 'MUNICIPAL', 'CONTRIBUICAO', 'CONTRIBUICOES', 'BALANCETES', 'BALANCETE', 'PESSOAL', 'FOLHA', 'CADASTRO', 'BANCARIO', 'BANCARIA', 'NOTAS', 'ENTRADA', 'ENTRADAS', 'SAIDAS', 'EMITIDAS', 'RECEBIDAS', 'ARQUIVOS', 'DOWNLOADS', 'IMAGENS', 'PLANILHAS', 'DIVERSOS', 'ESCRITA', 'CONTABIL', 'CONTABILIDADE', 'ALTERACAO', 'CONTRATUAL', 'APLICACAO', 'APLICACOES', 'INVESTIMENTO', 'CARTAO', 'CREDITO', 'DEBITO', 'MAQUININHA', 'MAQUININHAS', 'IMPOSTOS', 'GUIAS', 'RESTITUICAO', 'SOLICITACAO', 'CERTIFICADO', 'DIGITAL', 'ESCRITURA', 'FAZENDA', 'FAZENDAS', 'VEICULOS', 'ATIVO', 'IMOBILIZADO', 'DEPRECIACAO', 'TRIMESTRE', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']);
function palavrasDistintivas(parte) {
  return norm(String(parte || '').replace(/\.(zip|rar|7z)$/i, '')).split(/[^A-Z0-9]+/).filter(w => w.length >= 6 && /^[A-Z]+$/.test(w) && !PALAVRAS_DE_PASTA.has(w));
}
/**
 * A pasta da migração que junta matriz e filiais (o mapa: { matriz, filiais, peloNome }), a mais funda do caminho:
 * { parte, matriz, filiais, peloNome, porque } ou null (27/10/2026).
 */
function grupoDaPasta(rel, cad) {
  const mapa = cad && cad.mapaMigracao;
  if (!mapa || typeof mapa.grupoDaPasta !== 'function') return null;
  for (const parte of partesDoCaminho(rel).slice(0, -1).reverse()) { const g = mapa.grupoDaPasta(parte); if (g) return Object.assign({ parte }, g); }
  return null;
}
/**
 * O código do grupo pelo nome do arquivo (Vitor, 27/10/2026, a 408 OURO VERDE e as filiais 409 e 410): a palavra do mapa
 * (peloNome: "OV" = 408, "OV1" = 409, "OV3" = 410, sem diferenciar maiúsculas) ou o código do grupo no começo do nome
 * ("408Balancete2025.pdf"). Só no grupo que tem peloNome; mais de um código no nome não decide.
 */
function codigoDoGrupoPeloNome(nome, g) {
  if (!g || !g.peloNome) return null;
  const base = norm(String(nome || '').replace(/\.[a-z0-9]{2,4}$/i, ''));
  const codigos = [g.matriz].concat(g.filiais || []).filter(c => c != null);
  const achados = new Set();
  const ini = /^(\d{1,4})(?!\d)/.exec(base);
  if (ini && codigos.includes(+ini[1])) achados.add(+ini[1]);
  for (const t of base.split(/[^A-Z0-9]+/)) if (Object.prototype.hasOwnProperty.call(g.peloNome, t)) achados.add(+g.peloNome[t]);
  return achados.size === 1 ? [...achados][0] : null;
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
  ['BANCO DO BRASIL', /^[\s\S]{0,150}RENDE FACIL/],
  // a aplicação do BB (o fundo; 28/10/2026, a 174 ARMARINHO): "RESUMO DO MES - JULHO/2024 / SALDO BRUTO EM … / APLICACOES NO MES"
  ['BANCO DO BRASIL', /^[\s\S]{0,300}RESUMO DO MES - [A-Z]+\/\d{4}\s*\n\s*SALDO BRUTO EM[\s\S]{0,200}APLICACOES NO MES/],
  // o extrato do internet banking do BB (o nome do banco só no logo; 27/10/2026, a 407 DUDA HOME): "EXTRATO DE CONTA
  // CORRENTE / CLIENTE: … / AGENCIA: 2705-7 CONTA: 28265-0", a agência e a conta com o dígito
  // (o nome do cliente às vezes vem na linha de baixo do rótulo: "Cliente:\nLARISSA E SOUZA MENDES\nAgência: 2705-7 Conta: …")
  ['BANCO DO BRASIL', /^\s*EXTRATO DE CONTA CORRENTE\s*\n\s*CLIENTE:?.*\n(?:[^\n]{3,80}\n)?\s*AGENCIA:\s*\d{4}-[\dX]\s+CONTA:\s*[\d.]+-[\dX](?![\d])/m], ['CAIXA', /CONTA CORRENTE PESSOA (JURIDICA|FISICA) CAIXA/],
  // o extrato do internet banking do BNB (28/10/2026, a 579 MORONI): "EXTRATO DE CONTA CORRENTE / TITULAR: … / AGENCIA:60 / CONTA:68653-2"
  ['BNB', /^\s*EXTRATO DE CONTA CORRENTE\s*\n\s*TITULAR:.*\n\s*AGENCIA:\s*\d{1,4}\s*\/\s*CONTA:\s*[\d.]+-[\dX](?![\d])/m],
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
  // o campo "INSTITUIÇÃO" do cabeçalho vale antes de tudo; sem ele, a instituição que aparece PRIMEIRO (27/10/2026: o
  // extrato da Stone da 407 foi para NUBANK pelo "NU PAGAMENTOS S.A." das contrapartes dos Pix)
  const inst = /\bINSTITUICAO\s*:?\s*\n?\s*([^\n]+)/.exec(u);
  if (inst) { for (const [b, re] of ASSINATURAS.concat(BANCOS)) if (re.test(inst[1])) return b; }
  const semLancamentos = tudo.split('\n').filter(l => !LINHA_DE_LANCAMENTO.test(l)).join('\n');
  let primeira = null;
  for (const [b, re] of ASSINATURAS) { const m = re.exec(semLancamentos); if (m && (!primeira || m.index < primeira.pos)) primeira = { banco: b, pos: m.index }; }
  if (primeira) return primeira.banco;
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
  // o código do banco que o internet banking põe no nome ("Extrato Mensal [B0033]_Janeiro2022.pdf" = 033, Santander; 27/10/2026)
  const cod = /\[B0?(\d{3})\]/i.exec(String(nome || ''));
  return cod && BANCO_POR_CODIGO[cod[1]] ? BANCO_POR_CODIGO[cod[1]] : null;
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
  // o "Relatório do Super Simples" (conferência do Simples do Alterdata; Vitor, 27/10/2026): FISCAL\<regime>\RELATÓRIOS ALTERDATA\
  // ANO\, nome original; o ano é o da competência do relatório ("Período:01/01/2021a31/01/2021")
  { tipo: 'RELATORIO ALTERDATA', setor: 'FISCAL', re: /^[\s\S]{0,800}RELATORIO DE CONFERENCIA DO SIMPLES NACIONAL/, fonte: 'relatório de conferência do Simples do Alterdata (Vitor, 27/10/2026)',
    campos: u => { const p = periodoEscrito(u) || periodoLivre(u.slice(0, 1500)); return { competencia: p ? { mes: p.ate.mes, ano: p.ate.ano } : null }; } },
  // a Certidão Simplificada da Junta Comercial (Vitor, 27/10/2026): SOCIETÁRIO\DOCUMENTOS CONSTITUTIVOS\, nome original, na raiz do ano da emissão
  { tipo: 'DOC CONSTITUTIVO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,400}CERTIDAO SIMPLIFICADA\b[\s\S]{0,400}JUNTA COMERCIAL/, fonte: 'certidão simplificada da Junta (Vitor, 27/10/2026)',
    campos: u => { const d = dataDaCertidao(u); return { ano: d ? +d.slice(6) : null }; } },
  // a escritura pública (Vitor, 27/10/2026; 04, Venda de Ativos): CONTÁBIL\VENDA DE ATIVOS\[ANO da lavratura]\, nome original
  // o contrato de câmbio (Vitor, 27/10/2026; 04, Op. Câmbio / Op. Crédito): o câmbio em OPERAÇÕES DE CÂMBIO\ANO\[BANCO]\[Nº], o do
  // mútuo (empréstimo do exterior) em OPERAÇÕES DE CRÉDITO\ANO\EMPRÉSTIMO\[BANCO]\[Nº]; nome original; o ano da contratação
  { tipo: 'OPERACAO DE CAMBIO', setor: 'CONTABIL', re: /^[\s\S]{0,600}CONTRATO DE CAMBIO/, fonte: '04 (Op. Câmbio; o mútuo em Op. Crédito)',
    campos: u => {
      const m = /NUMERO DO CONTRATO DE CAMBIO[\s\S]{0,160}?\|\s*(\d{6,})\s*\|\s*(\d{2})\/(\d{2})\/(20\d{2})/.exec(u);
      const inst = /INSTITUICAO AUTORIZADA A OPERAR NO MERCADO DE CAMBIO[\s\S]{0,300}/.exec(u);
      return { numero: m ? m[1] : null, ano: m ? +m[4] : null, banco: inst ? bancoDoTexto(inst[0], true) : null, mutuo: /\bMUTUO\b/.test(u) };
    } },
  { tipo: 'VENDA DE ATIVOS', setor: 'CONTABIL', re: /^[\s\S]{0,1500}ESCRITURA PUBLICA/, fonte: '04 (Venda de Ativos: escritura de imóvel)',
    campos: u => { const m = /SAIBAM[\s\S]{0,500}?\((\d{2})\/(\d{2})\/(20\d{2})\)/.exec(u) || /LAVRAD[AO][\s\S]{0,200}?(\d{2})\/(\d{2})\/(20\d{2})/.exec(u); return { ano: m ? +m[3] : null }; } },
  // ---- 27/10/2026 (Vitor): o relatório da DEFIS do Alterdata e o PGDAS-D, antes do DAS (o título do PGDAS-D contém o dele) ----
  // o relatório da DEFIS que o Alterdata gera (um PDF por cliente, "Declaração Anual do Simples Nacional - DASN"): em 14. DEFIS
  // como a DEFIS do portal, com nome próprio; o ano-calendário vem colado depois do nome do Alterdata ("… Ltda. 2025Emissão:")
  { tipo: 'DEFIS ALTERDATA', setor: 'FISCAL', re: /DECLARACAO ANUAL DO SIMPLES NACIONAL\s*-\s*DASN\b(?!\s*-?\s*SIMEI)[\s\S]{0,400}ALTERDATA/, fonte: 'relatório da DEFIS do Alterdata (Vitor, 27/10/2026)',
    campos: u => {
      const a = /ANO[- ]CALENDARIO[^0-9]{0,80}?(20\d{2})/.exec(u), em = /EMISSAO:?\s*\d{2}\/\d{2}\/(20\d{2})/.exec(u);
      const m = /CNPJ MATRIZ:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/.exec(u);
      return { ano: a ? +a[1] : null, anoEmissao: em ? +em[1] : null, cnpjMatriz: m ? so(m[1]) : null };
    } },
  // o PGDAS-D (declaração, recibo e extrato): 01. DAS com o período de apuração. A guia do DAS traz "Pagar este documento
  // até" e o PGDAS-D não: com ele, é DAS; a DEFIS (que pode citar o PGDAS-D) também fica de fora
  { tipo: 'PGDAS-D', setor: 'FISCAL', re: /^(?![\s\S]*PAGAR (ESTE DOCUMENTO )?ATE)(?![\s\S]{0,600}(\bDEFIS\b|SOCIOECONOMICAS))[\s\S]{0,1500}?(PROGRAMA\s+GERADOR\s+DO\s+DOCUMENTO\s+DE\s+ARRECADACAO\s+DO\s+SIMPLES\s+NACIONAL|\bPGDAS-?D\b|RECIBO DE ENTREGA DA APURACAO|EXTRATO DO SIMPLES NACIONAL)/, fonte: 'PGDAS-D (Vitor, 27/10/2026); 05a (01. DAS)',
    campos: u => {
      // o recibo de 2021 traz o PA numa tabela, grudado no número da apuração: "06/2021" + CNPJ básico + "2021" "06" + seq
      const pa = /PERIODO DE APURACAO\s*(?:\(PA\))?\s*:?\s*(?:\d{2}\/)?(0[1-9]|1[0-2])\/(20\d{2})/.exec(u) || /\bPA\)?\s*:\s*(0[1-9]|1[0-2])\/(20\d{2})/.exec(u)
        || /(0[1-9]|1[0-2])\/(20\d{2})\d{8}\2\1\d{3}/.exec(u);
      // o documento pelo conteúdo: o recibo e o extrato têm título próprio; sem nenhum dos dois, é a declaração
      const docs = [/RECIBO DE ENTREGA DA APURACAO/.test(u) && 'RECIBO', /EXTRATO DO SIMPLES NACIONAL/.test(u) && 'EXTRATO'].filter(Boolean);
      return { competencia: pa ? { mes: +pa[1], ano: +pa[2] } : null, docs: docs.length ? docs : ['DECLARACAO'] };
    } },
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
  { tipo: 'LIVRO_FISCAL', setor: 'FISCAL', re: /REGISTRO DE ENTRADAS|REGISTRO DE SAIDAS|REGISTRO DE APURACAO DO ICMS|APURACAO DO ICMS|RELATORIO DE APURACAO DE ICMS/, fonte: '05d §1c',
    campos: u => ({ livro: /REGISTRO DE ENTRADAS/.test(u) ? 'REGISTRO DE ENTRADAS' : /REGISTRO DE SAIDAS/.test(u) ? 'REGISTRO DE SAIDAS' : 'APURACAO ICMS', periodo: periodoEscrito(u) || periodoLivre(u) }) },
  // ---- documentos fiscais em PDF (05d §1) ----
  { tipo: 'NFC-e PDF', setor: 'FISCAL', re: /DANFE NFC-E|DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR|PORTALNFCE|\/NFCE\b|CONSUMIDOR NAO IDENTIFICADO/, fonte: '05d §1 (NFC-e em PDF)', campos: u => camposDeNota(u) },
  { tipo: 'NF-e PDF', setor: 'FISCAL', re: /\bDANFE\b|DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA/, fonte: '05d §1', campos: u => camposDeNota(u) },
  { tipo: 'CT-e PDF', setor: 'FISCAL', re: /\bDACTE\b|DOCUMENTO AUXILIAR DO CONHECIMENTO DE TRANSPORTE/, fonte: '05d §1', campos: u => camposDeNota(u) },
  { tipo: 'NFS-e PDF', setor: 'FISCAL', re: /\bDANFSE\b|^\s*DANFSE\s*V\d|DOCUMENTO\s*AUXILIAR\s*DA\s*NFS-E|NOTA FISCAL DE SERVICOS? ELETRONICA|\bNFS-E\b/, fonte: '05d §1 (NFS-e)', campos: u => camposDeNfse(u) },
  // relatório mensal de notas (05d §1: emitidas em EMITIDOS\RELATÓRIO MENSAL\[ANO]; recebidas em RECEBIDOS\RELATÓRIO MENSAL)
  // 27/10/2026 (os relatórios dos sistemas dos clientes na migração): o GDOOR ("NF-e, NFC-e e SAT (Resumo)", "Relatório de
  // Compras"), o "Notas fiscais emitidas/sintético" e o "Mapa Resumo" (Intervalo colado), o "NFCe / Mês: 2 Ano: 2026"
  { tipo: 'RELATORIO DE NOTAS', setor: 'FISCAL', re: /^[\s\S]{0,300}(NOTAS DE (ENTRADA|SAIDA) POR PERIODO|NOTAS FISCAIS (DE )?(SAIDA|ENTRADA|CONSUMIDOR ELETRONICA)|NOTAS FISCAIS (EMITIDAS|SINTETICO)|RELATORIO DE CUPOM|RELATORIO (MENSAL )?DE NOTAS (FISCAIS )?(EMITIDAS|RECEBIDAS)|NF-E, NFC-E E SAT \(RESUMO\)|RELATORIO DE COMPRAS|RELATORIO DE NOTAS DE COMPRA|^\s*MAPA RESUMO\s*\n\s*INTERVALO|\n\s*NFC?E\s*\n\s*MES:\s*\d{1,2}\s*ANO:\s*20\d{2})/, fonte: '05d §1 (Relatório Mensal de Notas Emitidas/Recebidas)',
    campos: u => ({ recebidas: /^[\s\S]{0,300}(NOTAS DE ENTRADA POR PERIODO|NOTAS FISCAIS (DE )?ENTRADA|NOTAS (FISCAIS )?RECEBIDAS|RELATORIO DE COMPRAS|RELATORIO DE NOTAS DE COMPRA)/.test(u), periodo: periodoEscrito(u) || periodoDoRelatorio(u) || periodoLivre(u.slice(0, 1500)) || periodoPelasDatas(u) }) },
  // ---- folha e societário (04b) ----
  { tipo: 'CARTAO CNPJ', setor: 'FOLHA_SOCIETARIO', re: /^(?![\s\S]*JUNTA COMERCIAL[\s\S]{0,600}CERTIFICO (O )?(REGISTRO|ARQUIVAMENTO))[\s\S]{0,800}COMPROVANTE DE INSCRICAO E DE SITUACAO\s+CADASTRAL/, fonte: '04b (Documentos Constitutivos)', campos: () => ({}) },
  // a inscrição estadual (Vitor, 27/10/2026): SOCIETÁRIO\INSCRIÇÕES\, sem pasta de ano, nome original; o comprovante da SEFAZ/MG e a
  // consulta do Cadastro Centralizado de Contribuintes (SVRS); a raiz do ano é a da emissão (a data com a hora)
  { tipo: 'INSCRICAO ESTADUAL', setor: 'FOLHA_SOCIETARIO', re: /COMPROVANTE DE INSCRICAO ESTADUAL|INFORMACAO DA IE COMO DESTINATARIO|CADASTRO CENTRALIZADO DE CONTRIBUINTE/, fonte: 'inscrição estadual (Vitor, 27/10/2026)',
    campos: u => { const m = /(\d{2})\/(\d{2})\/(20\d{2})\s*\d{2}:\d{2}/.exec(u); return { ano: m ? +m[3] : null }; } },
  // (Vitor, 27/10/2026) com o requerimento da Junta na 1ª página, o título só vem depois: vale o carimbo de registro/arquivamento;
  // a raiz do ano é a do registro (o carimbo), senão a data do nome do arquivo, senão a pasta de origem
  { tipo: 'DOC CONSTITUTIVO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,600}(CONTRATO SOCIAL|ALTERACAO CONTRATUAL|ATO CONSTITUTIVO|ESTATUTO SOCIAL|ATA DA? (ASSEMBLEIA|REUNIAO))|JUNTA COMERCIAL[\s\S]{0,300}CERTIFICO (O )?(REGISTRO|ARQUIVAMENTO)\b/, fonte: '04b (Documentos Constitutivos)',
    campos: u => { const m = /CERTIFICO (?:O )?(?:REGISTRO|ARQUIVAMENTO)[^\n]{0,40}?\bEM:?\s*\d{2}\/\d{2}\/(20\d{2})/.exec(u); return { ano: m ? +m[1] : null }; } },
  // a certidão de falência e concordata do TJ (Vitor, 27/10/2026): CERTIDÕES\JUDICIAL
  { tipo: 'CERTIDAO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(CERTIDAO (NEGATIVA|POSITIVA|CONJUNTA|DE REGULARIDADE|DE DEBITOS)|CERTIFICADO\s+DE\s+REGULARIDADE\s+DO\s+FGTS|CERTIDAO CIVEL DE FALENCIA|FALENCIA E CONCORDATA)/, fonte: '04b (Certidões)',
    campos: u => ({ orgao: /FALENCIA|CONCORDATA/.test(u.slice(0, 800)) ? 'JUDICIAL' : /FGTS|CAIXA ECONOMICA/.test(u) ? 'FGTS' : /TRABALHISTA|\bCNDT\b|JUSTICA DO TRABALHO/.test(u) ? 'TRABALHISTA' : /RECEITA FEDERAL|PROCURADORIA-GERAL DA FAZENDA|DIVIDA ATIVA DA UNIAO|TRIBUTOS FEDERAIS/.test(u) ? 'FEDERAL' : /PREFEITURA|MUNICIPIO DE|MUNICIPAL/.test(u) ? 'MUNICIPAL' : /ESTADO D[EO]|SECRETARIA DE ESTADO|FAZENDA ESTADUAL|SEFAZ/.test(u) ? 'ESTADUAL' : null,
      data: dataDaCertidao(u) }) },
  // documentos POR FUNCIONÁRIO (Vitor, 23/10/2026): <cliente>\DEPARTAMENTO PESSOAL\FUNCIONÁRIOS\<NOME>\<tipo> <data>.pdf
  { tipo: 'DP FUNCIONARIO', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(ATESTADO DE SAUDE OCUPACIONAL|TERMO DE RESCISAO DO CONTRATO DE TRABALHO|AVISO DE FERIAS|RECIBO DE FERIAS|AVISO PREVIO|CONTRATO (INDIVIDUAL )?DE TRABALHO|CONTRATO DE EXPERIENCIA|FICHA DE REGISTRO DE EMPREGADO)/, fonte: 'DP por funcionário (Vitor, 23/10/2026)',
    campos: u => camposDoFuncionario(u) },
  // 27/10/2026 (Vitor, os exemplos do DP): o holerite "Demonstrativo de Pagamento de Salário" (o "Ref.:10/2026" é a competência)
  { tipo: 'FOLHA', setor: 'FOLHA_SOCIETARIO', re: /^[\s\S]{0,800}(FOLHA DE PAGAMENTO|RECIBO DE PAGAMENTO DE SALARIO|DEMONSTRATIVO DE PAGAMENTO DE SALARIO|HOLERITE|RECIBO DE FERIAS|RECIBO DE 13|RESUMO DA FOLHA)/, fonte: '04b (Folha)',
    campos: u => ({ competencia: competenciaSolta(linhaApos(u, /COMPETENCIA|REFERENCIA|MES\/ANO|PERIODO|\bREF\.?:/, 120)) || competenciaSolta(u.slice(0, 800)) }) },
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
  { tipo: 'OPERACAO DE CREDITO', setor: 'CONTABIL', re: /^(?![\s\S]{0,200}EXTRATO DE CONTA CORRENTE)[\s\S]{0,1500}(EXTRATO DE (EMPRESTIMOS?|OPERACAO DE CREDITO)|EVOLUCAO CONTRATUAL|CONTRATO DE (EMPRESTIMO|FINANCIAMENTO)|CEDULA DE CREDITO BANCARIO|DADOS DA CONTRATACAO|GIRO PRONAMPE)/, fonte: '04 (Op. Crédito)', campos: () => ({}) },
  { tipo: 'RECEBIMENTO DE CLIENTES', setor: 'CONTABIL', re: /RELATORIO DE RECEBIMENTOS|TITULOS LIQUIDADOS|TITULOS BAIXADOS|TITULOS PAGOS POR CONTA CREDITO|RELATORIO DE COBRANCA|CREDITOS? DE LIQUIDACAO|CRED\.? LIQUIDACAO/, fonte: 'Dicionário §6.1', campos: u => camposDeExtrato(u) },
  { tipo: 'MAQUININHAS', setor: 'CONTABIL', re: /^[\s\S]{0,300}FILTROS SELECIONADOS[\s\S]{0,200}QUANTIDADE DE VENDAS|RELATORIO DE VENDAS|LISTA DE VENDAS|EXTRATO DE VENDAS|EXTRATO DE LIQUIDACAO|EXTRATO DE RECEBIVEIS|RESUMO DE VENDAS|VENDAS POR BANDEIRA|CONCILIACAO DE (VENDAS|RECEBIVEIS)|RELATORIO DE CONCILIACAO/, fonte: 'Dicionário §6.1', campos: u => camposDeExtrato(u) },
  { tipo: 'APLICACOES', setor: 'CONTABIL', re: /^[\s\S]{0,300}RESUMO DO MES - [A-Z]+\/\d{4}\s*\n\s*SALDO BRUTO EM[\s\S]{0,200}APLICACOES NO MES|EXTRATO DE APLICAC|EXTRATO DE INVESTIMENTO|EXTRATO INVESTIMENTOS FINANCEIROS|EXTRATO DE FUNDOS|POSICAO DE INVESTIMENTO|RENDIMENTOS DE APLICAC|INVESTIMENTOS BRADESCO|TOTAL APLICADO|^[\s\S]{0,150}RENDE FACIL|^[\s\S]{0,600}(OUROCAP|BRASILCAP|TITULO DE CAPITALIZACAO)/, fonte: 'Dicionário §6.1; 04 (capitalização)', campos: u => camposDeExtrato(u) },
  { tipo: 'COMPROVANTE', setor: 'CONTABIL', re: /COMPROVANTE\s+(DE\s+)?(PAGAMENTO|TRANSFERENCIA|PIX|AGENDAMENTO|TITULOS|OPERACAO|TRANSACAO)|PIX (ENVIADO|REALIZADO)\s*\n.*COMPROVANTE/, fonte: 'Dicionário §6.1 e §6.1.1', campos: u => camposDeComprovante(u) },
  { tipo: 'FATURA CARTAO', setor: 'CONTABIL', re: /FATURA DO CARTAO|EXTRATO DE CARTAO DE CREDITO|FATURA MASTERCARD|FATURA VISA|RESUMO DA FATURA/, fonte: '04 (fatura de cartão → fallback extrato avulso)',
    campos: u => ({ competencia: competenciaSolta(linhaApos(u, /VENCIMENTO/, 60)) || (dataBr(linhaApos(u, /VENCIMENTO/, 60)) ? (d => ({ mes: +d.slice(3, 5), ano: +d.slice(6) }))(dataBr(linhaApos(u, /VENCIMENTO/, 60))) : null) }) },
  // o boleto (ficha de compensação) que o cliente paga (27/10/2026): 04, Pag. Fornecedores — Fatura (decidirBoleto)
  { tipo: 'BOLETO FORNECEDOR', setor: 'CONTABIL', re: /^(?=[\s\S]*(BENEFICIARIO|CEDENTE))(?=[\s\S]*(PAGADOR|SACADO))(?![\s\S]*SALDO ANTERIOR)[\s\S]*\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}(?!\d)/, fonte: '04 (Pag. Fornecedores — Fatura)', campos: u => camposDoBoleto(u) },
  { tipo: 'EXTRATO', setor: 'CONTABIL', re: /^[\s\S]{0,400}INSTITUICAO: [^\n,]{2,40}, AGENCIA: [\d-]+, CONTA: [\d.-]+|EXTRATO EXPORTADO NO DIA|^[\s\S]{0,200}APLICATIVO SANTANDER EMPRESAS[\s\S]{0,300}PERIODOS?:|EXTRATO (DE |DA )?(CONTA|C\/C|MENSAL|CONSOLIDADO|FINANCEIRO|POR PERIODO|BANCARIO)|EXTRATOMENSAL|EXTRATO HISTORICO|EXTRATO DE: AG|EXTRATO CONTA CORRENTE|RELATORIO DE MOVIMENTACOES|SALDO FINAL DO PERIODO|SALDO ANTERIOR[\s\S]{0,4000}SALDO/, fonte: 'Dicionário §6.1; 04 (Bancários)', campos: u => camposDeExtrato(u) },
];

/**
 * O documento por funcionário: o tipo (ASO, Rescisão, Férias, Aviso prévio, Contrato, Admissão), o nome do funcionário
 * (o nome que vem antes do CPF, depois do rótulo Funcionário/Empregado/Trabalhador/Colaborador) e a data do documento.
 */
function camposDoFuncionario(u) {
  const doc = /ATESTADO DE SAUDE OCUPACIONAL/.test(u) ? 'ASO' : /TERMO DE RESCISAO/.test(u) ? 'Rescisão' : /AVISO DE FERIAS|RECIBO DE FERIAS/.test(u) ? 'Férias'
    : /AVISO PREVIO/.test(u) ? 'Aviso prévio' : /CONTRATO (INDIVIDUAL )?DE TRABALHO|CONTRATO DE EXPERIENCIA/.test(u) ? 'Contrato' : 'Admissão';
  // o aviso de férias do sistema do DP (27/10/2026): "Funcionário:CTPS/Série/UF:\nELIECIO SOARES DA COSTA//MG", sem o CPF
  const m = /\b(?:FUNCIONARIO|EMPREGADO|TRABALHADOR|COLABORADOR)\b[^\n]{0,60}\n?\s*([A-Z][A-Z ]{4,80}?)\s+(?:CPF:?\s*)?\d{3}\.\d{3}\.\d{3}-\d{2}/.exec(u)
    || /\bFUNCIONARIO:\s*CTPS\/SERIE\/UF:?\s*\n\s*([A-Z][A-Z ]{4,80}?)\s*\/\//.exec(u);
  let nome = m ? m[1].replace(/\s+/g, ' ').trim() : null;
  if (nome && (nome.split(' ').length < 2 || /\b(CPF|DATA|NASC|NOME|FUNCAO|SETOR)\b/.test(nome))) nome = null;
  const dataApos = re => { const i = u.search(re); if (i < 0) return null; const d = /(\d{2})\/(\d{2})\/(20\d{2})/.exec(u.slice(i, i + 400)); return d ? d[1] + '/' + d[2] + '/' + d[3] : null; };
  const data = doc === 'ASO' ? dataApos(/EXAMES? COMPLEMENTARES|NOME DO EXAME/) || dataApos(/\bDATA:/)
    : doc === 'Rescisão' ? dataApos(/DATA DE AFASTAMENTO/)
    : doc === 'Férias' ? dataApos(/PERIODO DE (GOZO|FERIAS)|PERIODO A SER GOZADO|INICIO D[AE]S? FERIAS/)
    : doc === 'Aviso prévio' ? dataApos(/DATA DO AVISO|AVISO EM|EM\s+\d{2}\/\d{2}\/20\d{2}/)
    : dataApos(/DATA DE ADMISSAO|ADMITIDO EM|ADMISSAO:/);
  return { doc, nome, data };
}

/**
 * A data de emissão da certidão (04b: [DATA] = a emissão, nunca a validade). 27/10/2026, as certidões da migração que caíam
 * em COMPETENCIA_AUSENTE: a trabalhista diz "Expedição:", a estadual de MG "Data de emissão" (na linha de baixo), a municipal
 * de Taiobeiras só por extenso no fim ("Prefeitura Municipal de Taiobeiras, Segunda-feira, 2 de Março de 2026") e o CRF do
 * FGTS só a validade ("Validade:22/09/2022 a 21/10/2022": o certificado é emitido no 1º dia dela).
 */
function dataDaCertidao(u) {
  const d = dataBr(linhaApos(u, /EMITIDA (AS|EM)|DATA DA EMISSAO|DATA DE EMISSAO|EMISSAO:|EXPEDICAO:|EXPEDIDA EM|EMITIDA/, 160));
  if (d) return d;
  const v = /VALIDADE:?\s*(\d{2}\/\d{2}\/20\d{2})\s*A\s*\d{2}\/\d{2}\/20\d{2}/.exec(u);
  if (v) return dataBr(v[1]);
  const x = /PREFEITURA MUNICIPAL DE [A-Z ]+,\s*(?:[A-Z-]+,\s*)?(\d{1,2}) DE (JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO) DE (20\d{2})/.exec(u);
  if (x) return dois(+x[1]) + '-' + dois(mesDoNome(x[2])) + '-' + x[3];
  const y = /(?:,|SOLICITADA EM)\s*(\d{1,2}) DE (JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO) DE (20\d{2})/.exec(u);
  return y ? dois(+y[1]) + '-' + dois(mesDoNome(y[2])) + '-' + y[3] : null;
}
function anoCalendario(u) {
  const m = /ANO[- ]CALENDARIO[^0-9]{0,20}(20\d{2})/.exec(u) || /PERIODO[^0-9]{0,30}\d{2}\/\d{2}\/(20\d{2})/.exec(u) || /EXERCICIO[^0-9]{0,20}(20\d{2})/.exec(u);
  if (!m) return null;
  return /EXERCICIO/.test(m[0]) ? +m[1] - 1 : +m[1];
}
/** O período dos relatórios de notas: "Intervalo:à01/02/202628/02/2026" (colado) e "Mês: 2 Ano: 2026". */
function periodoDoRelatorio(u) {
  const c = u.slice(0, 600);
  let m = /INTERVALO:?\s*A?\s*(\d{2})\/(\d{2})\/(20\d{2})\s*(\d{2})\/(\d{2})\/(20\d{2})/.exec(c);
  if (m) return { de: { dia: +m[1], mes: +m[2], ano: +m[3] }, ate: { dia: +m[4], mes: +m[5], ano: +m[6] } };
  m = /\bMES:\s*(\d{1,2})\s*ANO:\s*(20\d{2})/.exec(c);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { de: { dia: 1, mes: +m[1], ano: +m[2] }, ate: { dia: 28, mes: +m[1], ano: +m[2] } };
  return null;
}
/** Sem período impresso: o mês de 90% ou mais das datas listadas (no mínimo 5), como um período de um mês. */
function periodoPelasDatas(u) {
  const c = {};
  let n = 0;
  for (const m of u.matchAll(/(?<!\d)(\d{2})\/(\d{2})\/(20\d{2})/g)) { if (+m[2] < 1 || +m[2] > 12) continue; const k = m[3] + '-' + m[2]; c[k] = (c[k] || 0) + 1; n++; }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  if (!top || n < 5 || top[1] < n * 0.9) return null;
  const ano = +top[0].slice(0, 4), mes = +top[0].slice(5);
  return { de: { dia: 1, mes, ano }, ate: { dia: 28, mes, ano } };
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
  // a NFS-e da Prefeitura de Taiobeiras (a de honorários da Nilma, 27/10/2026): "Nº da Nota Fiscal\n849" e, no canhoto,
  // "A NOTA FISCAL Nº 849, EMITIDA EM 17/02/2022"
  // 27/10/2026 (os ~700 da migração com "nº ou data da NFS-e não lidos"): o número depois do rótulo nunca é uma data (Montes
  // Claros imprime o número ANTES do rótulo e a data do serviço depois: "202200000000002\nNúmero da NFS-e\n07/12/2022"); o
  // layout da Síntese (Divisa Alegre) só traz o número no canhoto ("Nº da NFS-e/Ano do exercício\n1/2020")
  // o DANFSe v2.0 da NFS-e nacional sai do pdf.js sem os espaços ("NÚMERODANFS-e\n74", "DATAE HORADAEMISSÃODANFS-e")
  // a Prefeitura de São Paulo (28/10/2026, as da Loggi na HELLO): os rótulos em bloco e depois o código, o RPS, o número e a data
  const sp = /NUMERO DA NOTA\s*\n\s*DATA E HORA DE EMISSAO\s*\n\s*CODIGO DE VERIFICACAO\s*\n[^\n]*\n(?:\s*RPS[^\n]*\n)?\s*(\d{4,9})\s*\n\s*(\d{2}\/\d{2}\/20\d{2})/.exec(u);
  const numero = (sp || /NUMERO\s*DA\s*NFS-E[^0-9]{0,30}(\d{1,15})(?![\d/])/.exec(u) || /(?:^|\n)\s*(\d{1,15})\s*\n\s*NUMERO DA NFS-E/.exec(u) || /NFS-E\s*N[O°º.]*\s*:?\s*(\d{1,15})/.exec(u) || /NUMERO DA NOTA[^0-9]{0,20}(\d{1,15})/.exec(u)
    || /N[º°O]\.?\s*DA NOTA FISCAL\s*:?\s*(\d{1,15})/.exec(u) || /NOTA FISCAL N[º°O]\.?\s*(\d{1,15}),?\s*EMITIDA EM/.exec(u) || /N[º°O]\.?\s*DA NFS-E\s*\/\s*ANO DO EXERCICIO\s*(\d{1,10})\s*\/\s*20\d{2}/.exec(u) || [])[1] || null;
  const emissao = (sp ? sp[2].replace(/\//g, '-') : null) || dataBr(linhaApos(u, /DATA\s*E\s*HORA\s*DA\s*EMISSAO|DATA DA EMISSAO|EMISSAO DA NFS-E|DATA DE EMISSAO|DT\.? DE EMISSAO|EMITIDA EM/, 120)) || dataBr(linhaApos(u, /DATA FATO GERADOR/, 80))
    || dataBr(linhaApos(u, /DATA DE EMISSAO/, 400));
  const comp = competenciaSolta(linhaApos(u, /COMPETENCIA\s*DA\s*NFS-E|COMPETENCIA/, 80));
  // o que a leitura de antes (até 27/10/2026) já lia: o que ela não lia e tem o XML da chave arquivado continua indo ao lado do
  // XML (o 2º lote do Vitor, que o reprocesso em produção está aplicando); as leituras novas só valem para o resto
  const antes = !!((/NUMERO DA NFS-E[^0-9]{0,30}(d{1,15})/.exec(u) || /NFS-Es*N[O°º.]*s*:?s*(d{1,15})/.exec(u) || /NUMERO DA NOTA[^0-9]{0,20}(d{1,15})/.exec(u) || /N[º°O].?s*DA NOTA FISCALs*:?s*(d{1,15})/.exec(u) || /NOTA FISCAL N[º°O].?s*(d{1,15}),?s*EMITIDA EM/.exec(u))
    && (dataBr(linhaApos(u, /DATA E HORA DA EMISSAO|DATA DA EMISSAO|EMISSAO DA NFS-E|DATA DE EMISSAO|EMITIDA EM/, 120)) || dataBr(linhaApos(u, /DATA FATO GERADOR/, 80))));
  return { numero: numero ? String(+numero) : null, emissao, competencia: comp, cancelada: /CANCELAD[AO]/.test(u.slice(0, 1500)), lidoAntes: antes };
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
function decidir0(entrada, ctx) {
  const ev = [];
  const nome = String(entrada.nome || '');
  const rel = entrada.rel || nome;
  const ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1];
  const e = (ext || '').toLowerCase();
  const fim = o => finalizar(Object.assign({ evidencias: ev, nomeOriginal: nome, ocr: entrada.ocr || null, anoPista: anoDaPasta(rel) || competenciaDaPasta(rel), anoEntrega: anoDaEntrega(entrada) }, o), ctx);
  if (VIDEO_AUDIO.test(nome)) return { acao: 'IGNORAR', motivo: 'VIDEO_OU_AUDIO', confianca: 1, evidencias: ['Dicionário §1: vídeo/áudio fica na origem'] };
  if (entrada.hash && HASH_DESCARTE[entrada.hash]) return { acao: 'DESCARTAR', motivo: 'DESCARTE_CONFIRMADO', confianca: 1, tipo: 'DESCARTE', evidencias: ['descarte confirmado pelo responsável (' + HASH_DESCARTE[entrada.hash] + '): vai para a quarentena, nunca é apagado direto'] };
  // o pacote de transmissão do Sintegra para a SEFAZ (o TED: extensão .zip, mas sem ser zip; Vitor, 27/10/2026)
  if (entrada.tedSintegra) return fim(decidirTedSintegra(entrada, ctx, ev));
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
  if (e === 'txt') {
    // o extrato do internet banking do BB exportado em texto (27/10/2026: ~260 nas pastas do FERNANDO, "EXTRATO BB C.C.
    // JANEIRO-2025 SPIROU.txt"): 04, Bancários/Aplicações "[MÊS E ANO].[ext]" — o mesmo caminho do PDF, a extensão .txt fica
    // a exportação e o log de erros do emissor (Vitor, 28/10/2026: os "NFe_Export_229.txt" e "erros.txt" da Olaria TK): descarte
    if (/^(NFe_Export_\d+|erros)\.txt$/i.test(nome)) return { acao: 'DESCARTAR', motivo: 'DESCARTE_CONFIRMADO', confianca: 1, tipo: 'DESCARTE', evidencias: ['exportação/log de erros do emissor ("' + nome + '"): vai para a quarentena, nunca apagado (Vitor, 28/10/2026)'] };
    const dt = decidirTxt(entrada, ctx, ev);
    const t0 = norm(String(entrada.txt || '').slice(0, 3000));
    if (dt.motivo === 'FORMATO_SEM_REGRA' && /^\s*=*\s*EXTRATO CONTA CORRENTE\b|BANCO DO BRASIL S\.?A\.?\s*\n\s*AUTO-ATENDIMENTO/m.test(t0)) {
      ev.push('extrato do BB exportado em texto (.txt): lido como o PDF');
      return fim(decidirPdf(Object.assign({}, entrada, { texto: [String(entrada.txt || '').slice(0, 20000)] }), ctx, ev, porHash));
    }
    return fim(dt);
  }
  // 27/10/2026 (Vitor): o que o conteúdo do PDF não decide pode ir pelo XML da mesma chave ou pelo nome do comprovante do banco
  if (e === 'pdf') {
    const dp = pdfSemDecisao(decidirPdf(entrada, ctx, ev, porHash), entrada, ctx, ev, porHash);
    // o recibo do SPED/DAPI em PDF que o conteúdo não decidiu, pelo nome (28/10/2026: "Recibo Sped Contribuições 012025.pdf", "DAPI 022025.pdf")
    if (dp && dp.acao === 'NAO_IDENTIFICADO' && /^(RECIBO\s+(DE\s+)?|RECIBO_)?(SPED|DAPI|EFD)\b/i.test(nome)) {
      const rs = decidirReciboSped(entrada, ctx, ev, porHash);
      // o CNPJ de outro cliente no conteúdo vence a pasta (Vitor, 26/10/2026): aí fica para a migração
      const doTexto = [...new Set(documentosDoTexto((entrada.texto || []).slice(0, 3).join('\n')).flatMap(x => clientesDoDoc(x.doc, cad)))];
      if (rs && rs.acao === 'ARQUIVAR' && !doTexto.some(x => x !== rs.cliente)) return fim(rs);
    }
    return fim(dp);
  }
  if (['xlsx', 'xls', 'csv'].includes(e)) return fim(decidirPlanilha(entrada, ctx, ev, porHash));
  // a imagem lida por OCR (27/10/2026): o comprovante de pagamento escaneado
  if (/^(jpe?g|png)$/.test(e) && entrada.texto) return fim(decidirImagem(entrada, ctx, ev, porHash));
  // o registro de envio do emissor, sem extensão ("env-lot=2026-02-12-…-env-sinc-lot.xml"; Vitor, 27/10/2026): descarte, como os da
  // MADEIREIRA (a quarentena, nunca apagado)
  if (!e && /^\s*env-lot=\S+\.xml\s*$/i.test(String(entrada.semExtensao || ''))) return { acao: 'DESCARTAR', motivo: 'DESCARTE_CONFIRMADO', confianca: 1, tipo: 'DESCARTE', evidencias: ['registro de envio do emissor ("env-lot=…", sem extensão): vai para a quarentena, nunca é apagado (Vitor, 27/10/2026)'] };
  if (e === 'rec' || e === 'qrp') { const r = decidirReciboSped(entrada, ctx, ev, porHash); if (r) return fim(r); }
  if (porHash) return fim({ acao: 'NAO_IDENTIFICADO', motivo: 'HASH_CONFIRMADO_SEM_REGRA_DE_DESTINO', confianca: 0.5, cliente: porHash });
  return fim({ acao: 'NAO_IDENTIFICADO', motivo: 'FORMATO_SEM_REGRA', confianca: 0, evidencias: ev.concat('extensão .' + (e || '?') + ' sem regra determinística (imagem, Word, etc.)') });
}

const unico = arr => { const s = [...new Set(arr)]; return s.length === 1 ? s[0] : null; };

/**
 * O recibo de transmissão do SPED/DAPI (Vitor, 27/10/2026: "SPED00524_01_2025.REC", "SpedPisCofins_2026.02.REC", "Recibo DAPI
 * 012025.QRP"): a pasta do SPED do regime (01. SPED FISCAL, 02. SPED CONTRIBUIÇÕES ou DAPI) pela competência do nome, nome
 * original; o cliente pela pasta de origem (o código do nome confere).
 */
function decidirReciboSped(entrada, ctx, ev, porHash) {
  const nome = String(entrada.nome || ''), n = norm(nome.replace(/\.[a-z0-9]+$/i, ''));
  const tipo = /DAPI/.test(n) || /\.qrp$/i.test(nome) ? 'DAPI' : /PIS|COFINS|CONTRIB|\bCONT\b/.test(n) ? 'SPEDC' : /SPED|EFD/.test(n) ? 'SPEDF' : null;
  if (!tipo) return null;
  const rotulo = { DAPI: 'DAPI', SPEDC: 'SPED CONTRIBUIÇÕES', SPEDF: 'SPED FISCAL' }[tipo];
  const base = { tipo: rotulo, setor: 'FISCAL', fonte: 'recibo do ' + rotulo + ' (Vitor, 27/10/2026)' };
  const cad = ctx.cadastro;
  const m = /(20\d{2})[._-](0[1-9]|1[0-2])(?![0-9])/.exec(n);
  const comp = competenciaDoNome(nome) || (m ? { mes: +m[2], ano: +m[1] } : null) || (r => (r && r.mes ? r : null))(anoDaPasta(entrada.rel || ''));
  const cod = /^(?:SPED(?:_?PIS_?COFINS)?|EFD)\D*?0*(\d{2,4})_/.exec(n);
  let cli = porHash, como = 'hash';
  const sub = clienteDaPasta(entrada.rel || nome, cad);
  if (cli == null && sub) { if (cod && +cod[1] !== sub.codigo && cad.porCod.has(+cod[1])) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, evidencias: ev.concat('o código no nome (' + +cod[1] + ') não é o da pasta de origem (' + sub.codigo + ')') }); cli = sub.codigo; como = sub.forte ? 'pastaConferida' : 'pasta'; ev.push(sub.como); }
  if (cli == null && cod && cad.porCod.has(+cod[1])) { cli = +cod[1]; como = 'pasta'; ev.push('o código do cliente no nome do recibo'); }
  if (cli == null) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3 });
  if (!comp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, cliente: cli });
  return Object.assign(base, { acao: 'ARQUIVAR', cliente: cli, comoCliente: como, confianca: como === 'pasta' ? 0.85 : 0.9, competencia: { mes: comp.mes, ano: comp.ano }, fiscal: [tipo], nomeFinal: nome });
}

/**
 * O que o conteúdo não decidiu, pelo nome do arquivo e pela pasta de origem (Vitor, 28/10/2026). Só depois das regras (decidir0),
 * só nos NÃO IDENTIFICADOS por tipo/leitura (nunca no CLIENTE_AMBIGUO nem na conta em dois clientes), e o cliente é o que a decisão
 * já tinha ou o da pasta de origem (a matriz, na pasta que junta matriz e filiais). Nome original em todos.
 */
const NI_PELO_NOME = new Set(['TIPO_NAO_RECONHECIDO', 'VOCABULARIO_AUSENTE', 'BANCO_AUSENTE', 'CLIENTE_NAO_LOCALIZADO', 'COMPETENCIA_AUSENTE', 'ANO_INDETERMINADO', 'CONTRATO_SEM_NUMERO', 'FORMATO_SEM_REGRA', 'CONTEUDO_SEM_TEXTO', 'CONTEUDO_ILEGIVEL', 'CONFIANCA_ABAIXO_DO_LIMIAR']);
function decidir(entrada, ctx) {
  const d = decidir0(entrada, ctx);
  if (!d || d.acao !== 'NAO_IDENTIFICADO' || d.contaAmbigua || !NI_PELO_NOME.has(d.motivo)) return d;
  let p = null;
  try { p = pelaPastaENome(entrada, ctx, d); } catch (e) { return d; }
  return p && p.acao === 'ARQUIVAR' ? p : d;
}
// (a) as planilhas de controle sem ano no caminho: CONTÁBIL\RELATÓRIOS ALTERDATA\ ("aqui não vem o ano, então não precisa caminho")
const PLANILHA_DE_CONTROLE = /^(MOVIMENTO (CONTABIL|BANCARIO)|PLANILHA DE FORNECEDOR|CALCULO (ICMS|SERVICOS?)|ST$|DISTRIBUICAO DE LUCROS|PORCENTAGEM|MODELO DFC|FA[RT]+URAMENTO\b|CONTROLE MENSAL)/;
// o ano da compra da fazenda quando nem o nome, nem a pasta, nem o contrato dizem (Vitor, 28/10/2026: a Renascer, 2021)
const ANO_DA_FAZENDA = { RENASCER: 2021 };
const CONCESSIONARIA = /\b(CEMIG|COELBA|NEOENERGIA|COPASA|EMBASA|SAAE|ENERGISA|2W TELECOM|VIVO|CLARO)\b/;
function pelaPastaENome(entrada, ctx, d) {
  const cad = ctx.cadastro;
  const nome = String(entrada.nome || ''), rel = entrada.rel || nome;
  const n = norm(nome.replace(/\.[a-z0-9]{2,4}$/i, '')).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const pastas = partesDoCaminho(rel).slice(0, -1).map(p => norm(p).replace(/\s+/g, ' ').trim());
  const bruto = Array.isArray(entrada.texto) ? entrada.texto.slice(0, 3).join('\n') : String(entrada.texto || '');
  const u = norm(bruto);
  const ev = (d.evidencias || []).slice();
  let c = d.cliente != null && cad.porCod.has(+d.cliente) ? { cliente: +d.cliente, conf: 0.9, como: d.comoCliente || 'doc' } : null;
  const cliente = () => c || (c = clientePelaPastaOuGrupo(rel, nome, cad, ev));
  const pastaAno = anoDaPasta(rel);
  const anosNome = (n.match(/(?:^|[^0-9])(20\d{2})(?![0-9])/g) || []).map(x => +x.replace(/\D/g, '')).filter(anoOk);
  const anoNome = anosNome.length ? anosNome[anosNome.length - 1] : null;
  const anoArq = entrada.dataArquivo && anoOk(+String(entrada.dataArquivo).slice(0, 4)) ? +String(entrada.dataArquivo).slice(0, 4) : null;
  const ano = (...xs) => xs.find(x => x && anoOk(+x)) || null;
  const dataDe = re => { const m = re.exec(u); return m ? { dia: +m[1], mes: +m[2], ano: +m[3] } : null; };
  const fim = (o, porque) => {
    const x = cliente();
    if (!x) return null;
    ev.push(porque + ' (Vitor, 28/10/2026)');
    return finalizar(Object.assign({ acao: 'ARQUIVAR', cliente: x.cliente, comoCliente: x.como, confianca: Math.min(x.conf, 0.9), evidencias: ev, nomeOriginal: nome, nomeFinal: nome, ocr: entrada.ocr || null, anoPista: pastaAno, fonte: 'pelo nome e pela pasta de origem (Vitor, 28/10/2026)' }, o), ctx);
  };
  const mesDe = () => competenciaDoNome(nome) || (pastaAno && pastaAno.mes ? { mes: pastaAno.mes, ano: pastaAno.ano } : null) || (v => v ? { mes: +v.slice(3, 5), ano: +v.slice(6) } : null)(dataBr(linhaApos(u, /VENCIMENTO/, 60)));

  // (c) os documentos de funcionário numa pasta "Docs <Nome>" ("Docs Veronica": a ficha, o diploma, a foto): a pasta decide
  if (pastas.some(p => /^DOCS? (?!(ECF|SPED|FISCA|CONTAB|EMPRESA|SOCIO|CADASTRO|BANCO)\b)[A-Z]{3,}( [A-Z]{2,})?$/.test(p)))
    return fim({ tipo: 'DOCUMENTO DE FUNCIONARIO', setor: 'FOLHA_SOCIETARIO', caminho: ['DEPARTAMENTO PESSOAL', 'FUNCIONÁRIOS', 'DOCUMENTOS FUNCIONARIOS'], competencia: (a => a ? { ano: a } : null)(ano(anoNome, pastaAno && pastaAno.ano, anoArq)) }, 'documento de funcionário na pasta "Docs <nome>"');
  // a compra do imóvel rural: tudo de "Documentos da Faz. <Nome>" (as matrículas, o contrato, os juros) em VENDA DE ATIVOS\ANO\FAZENDA <NOME>
  const faz = pastas.map(p => /^DOCUMENTOS DA FAZ(?:ENDA)?\.? ([A-Z][A-Z ]+?)(?:\.(?:RAR|ZIP|7Z))?$/.exec(p)).find(Boolean);
  if (faz) {
    const contrato = dataDe(/CONTRATO[\s\S]{0,400}?(\d{2})\/(\d{2})\/(20\d{2})/);
    const a = ano(anoNome, pastaAno && pastaAno.ano, contrato && contrato.ano, ANO_DA_FAZENDA[faz[1].trim()]);
    if (!a) return null;
    return fim({ tipo: 'VENDA DE ATIVOS', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'VENDA DE ATIVOS', String(a), 'FAZENDA ' + faz[1].trim()], competencia: { ano: a } }, 'documento da compra da fazenda ("Documentos da Faz. ' + faz[1].trim() + '")');
  }
  // (b) o CRLV e o documento do veículo: SOCIETÁRIO\VEÍCULOS\<PLACA>\, sem ano; a venda do veículo: CONTÁBIL\VENDA DE ATIVOS\ANO
  if (/\bCRLV/.test(n) || /CERTIFICADO DE REGISTRO E LICENCIAMENTO/.test(u)) {
    const pl = /(?:^|[^A-Z0-9])([A-Z]{3})[ -]?(\d[A-Z0-9]\d{2})(?![A-Z0-9])/.exec(n.replace(/CRLV ?(DIGITAL)?/g, ' ')) || /PLACA\s*:?\s*\n?\s*([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/.exec(u);
    if (!pl) return null;
    return fim({ tipo: 'VEICULO', setor: 'FOLHA_SOCIETARIO', caminho: ['SOCIETÁRIO', 'VEÍCULOS', pl[1] + pl[2]], competencia: (a => a ? { ano: a } : null)(ano(anoNome, +((/EXERCICIO\s*:?\s*\n?\s*(20\d{2})/.exec(u) || [])[1]), pastaAno && pastaAno.ano, (dataDe(/(\d{2})\/(\d{2})\/(20\d{2})/) || {}).ano, anoArq)) }, 'documento do veículo (placa ' + pl[1] + pl[2] + ')');
  }
  if (/^VEICULO VENDIDO\b/.test(n)) {
    const m = /(\d{2})[./-](\d{2})[./-](20\d{2})/.exec(n);
    const a = ano(m && +m[3], anoNome, pastaAno && pastaAno.ano);
    if (!a) return null;
    return fim({ tipo: 'VENDA DE ATIVOS', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'VENDA DE ATIVOS', String(a)], competencia: { ano: a } }, 'venda de veículo');
  }
  // (lote 6, a) a apólice e a proposta de seguro: CONTÁBIL\SEGUROS\ANO (o da vigência, senão o da emissão)
  if (!/^BOLETO/.test(n) && (/\bAPOLICE\b|PROPOSTA DE SEGURO/.test(n) || /^[\s\S]{0,800}(APOLICE|PROPOSTA DE SEGURO)/.test(u))) {
    const vig = dataDe(/VIGENCIA[\s\S]{0,120}?(\d{2})\/(\d{2})\/(20\d{2})/), emi = dataDe(/EMISSAO[\s\S]{0,60}?(\d{2})\/(\d{2})\/(20\d{2})/);
    const a = ano(vig && vig.ano, emi && emi.ano, anoNome, pastaAno && pastaAno.ano);
    if (!a) return null;
    return fim({ tipo: 'SEGURO', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'SEGUROS', String(a)], competencia: { ano: a } }, 'apólice/proposta de seguro (o ano da ' + (vig ? 'vigência' : 'emissão') + ')');
  }
  // (d) o contrato e a proposta de prestação de serviço: SOCIETÁRIO\CONTRATOS\ANO; o ofício continua NAO_IDENTIFICADO
  if (!/OFICIO/.test(n) && (/^(\d+ )?(CONTRATO DE PRESTACAO|PROPOSTA|ADITIVO A PROPOSTA)\b/.test(n) || /^[\s\S]{0,300}CONTRATO DE PRESTACAO DE SERVICOS/.test(u))) {
    const dt = dataDe(/(\d{2})\/(\d{2})\/(20\d{2})/);
    const a = ano(anoNome, dt && dt.ano, pastaAno && pastaAno.ano, anoArq);
    if (!a) return null;
    return fim({ tipo: 'CONTRATO', setor: 'FOLHA_SOCIETARIO', caminho: ['SOCIETÁRIO', 'CONTRATOS', String(a)], competencia: { ano: a } }, 'contrato/proposta de prestação de serviço');
  }
  // (lote 6, b) a conta de consumo (CEMIG, COELBA, água, telefone): PAGAMENTOS DE FORNECEDORES\ANO\MÊS\<CONCESSIONÁRIA>
  const conc = CONCESSIONARIA.exec(n);
  if (conc) {
    const m = mesDe();
    if (!m) return null;
    return fim({ tipo: 'CONTA DE CONSUMO', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(m.ano), dois(m.mes), conc[1]], competencia: { mes: m.mes, ano: m.ano } }, 'conta de consumo (' + conc[1] + ', o mês pelo nome, pela pasta ou pelo vencimento)');
  }
  // (lote 6, e) o DAJE (custas do cartório): PAGAMENTOS DE FORNECEDORES\ANO\MÊS\DAJE; a DCF: FISCAL\<regime>\03. DOCUMENTOS FISCAIS
  if (/^DAJE\b/.test(n) || /^[\s\S]{0,1500}\bDAJE\b/.test(u) && /CARTORIO/.test(u)) {
    const m = mesDe();
    if (!m) return null;
    return fim({ tipo: 'DAJE', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(m.ano), dois(m.mes), 'DAJE'], competencia: { mes: m.mes, ano: m.ano } }, 'DAJE (custas do cartório)');
  }
  if (/^DCF\b/.test(n) || /^[\s\S]{0,600}DEMONSTRACAO DO FLUXO DE CAIXA/.test(u)) {
    const p = periodoEscrito(u) || periodoLivre(u.slice(0, 1500));
    const a = ano(p && p.ate.ano, anoNome, pastaAno && pastaAno.ano);
    if (!a) return null;
    return fim({ tipo: 'DCF', setor: 'FISCAL', fiscal: ['DOCS'], competencia: { ano: a } }, 'DCF (demonstração do fluxo de caixa)');
  }
  // (a) a planilha de controle
  // (só a planilha; o PDF só no cálculo do ICMS ST: o "Faturamento PJ 01.09.2022.pdf" é outra coisa)
  if (PLANILHA_DE_CONTROLE.test(n) && (/\.(xlsx?|xlsm|csv|ods)$/i.test(nome) || /^(CALCULO ICMS|FA[RT]+URAMENTO\b)/.test(n))) {
    const a = ano(anoNome, pastaAno && pastaAno.ano, anoArq);
    if (!a) return null;
    return fim({ tipo: 'PLANILHA DE CONTROLE', setor: 'CONTABIL', caminho: ['CONTÁBIL', 'RELATÓRIOS ALTERDATA'], competencia: { ano: a } }, 'planilha de controle (o ano ' + (a === anoNome ? 'do nome' : pastaAno && a === pastaAno.ano ? 'da pasta' : 'da data do arquivo') + ', sem a pasta do ano)');
  }
  return null;
}

/** XML: o porte do xml_lote.decidir (cliente) + pasta do regime (05d §1b). */
// as mensagens trocadas com a SEFAZ (23/10/2026, Vitor: "quarentena automática"): não são documento do cliente. A
// distribuição de DF-e (distDFeInt / retDistDFeInt) traz os documentos dentro: essa não entra aqui (fica para resolver).
const MENSAGEM_SEFAZ = /^(Envelope|Body|nfeDadosMsg|nfeResultMsg|cteDadosMsg|cteResultMsg|mdfeDadosMsg|mdfeResultMsg|(cons|retCons)(Sit|StatServ|Reci|Cad)(NFe|CTe|Cte|MDFe)?|(envi|retEnvi)(NFe|CTe|Cte|MDFe)|consMDFeNaoEnc|retConsMDFeNaoEnc|(env|retEnv)Evento|retInut(NFe|CTe)Pendente|resEvento|RetornoConsulta)$/;   // resEvento/RetornoConsulta: Vitor, 27/10/2026
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
  // a conta do cadastro (Vitor, 28/10/2026): <BRANCHID>/<ACCTID> de um cliente só decide (matriz ou filial); de dois, CLIENTE_AMBIGUO.
  // As contas aprendidas (contas.json) e as do 03 continuam de reforço, quando o cadastro não tem a conta
  const pcad = clientesPelasContas(numeroDeConta(tag('ACCTID')) ? [{ agencia: numeroDeConta(tag('BRANCHID')), conta: numeroDeConta(tag('ACCTID')) }] : [], banco, cad);
  const pcadP = pcad.clientes.length > 1 ? daPastaEntre(pcad.clientes, entrada.rel, cad) : null;
  if (pcadP != null) { pcad.clientes = [pcadP]; ev.push('a conta está em mais de um cliente do cadastro (' + pcad.contas.join('; ') + '); a pasta de origem é de um só deles: a ' + pcadP); }
  if (pcad.clientes.length > 1) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, tipo: 'EXTRATO OFX', setor: 'CONTABIL', contaAmbigua: true, candidatos: pcad.clientes, evidencias: ev.concat('a mesma conta está em ' + pcad.clientes.length + ' clientes do cadastro: ' + pcad.contas.join('; ') + ' (corrigir no Cadastro › Empresas › Bancos)') };
  if (pcad.clientes.length === 1) { cliente = pcad.clientes[0]; conf = 0.96; como = 'conta'; ev.push('a conta do cadastro: ' + pcad.contas.join('; ') + ' (Vitor, 28/10/2026)'); if (pcad.desempate) ev.push(pcad.desempate); }
  const confirmada = !cliente && CONTAS_CONFIRMADAS.find(c => c.banco === banco && conta && (conta.endsWith(c.conta) || c.conta.endsWith(conta)));
  if (cliente) { /* pela conta do cadastro */ }
  else if (confirmada && confirmado(confirmada.codigo, confirmada.nome, cad) != null) { cliente = confirmado(confirmada.codigo, confirmada.nome, cad); conf = 0.97; como = 'conta'; ev.push('conta ' + conta + ' confirmada no 03'); }
  else if (donoDaConta(ctx, banco, conta, entrada.hash) != null) { cliente = donoDaConta(ctx, banco, conta, entrada.hash); conf = 0.92; como = 'conta'; ev.push('conta ' + conta + ' já arquivada só deste cliente (03)'); }
  else { const sub = clienteDaPasta(entrada.rel, cad); if (sub) { cliente = sub.codigo; conf = sub.forte ? 0.9 : 0.8; como = sub.forte ? 'pastaConferida' : 'pasta'; ev.push(sub.como + ' (OFX não traz CNPJ)'); } }
  if (!cliente) {
    // a pasta que junta matriz e filiais (Vitor, 27/10/2026): a conta já arquivada numa delas, senão a matriz
    const g = grupoDaPasta(entrada.rel, cad);
    if (g && g.matriz != null && cad.porCod.has(g.matriz)) { const dono = donoDaConta(ctx, banco, conta, entrada.hash); const G = [g.matriz].concat(g.filiais || []); cliente = dono != null && G.includes(dono) ? dono : g.matriz; conf = 0.9; como = 'pastaConferida'; ev.push('pasta "' + g.parte + '": ' + (cliente === dono ? 'a conta ' + conta + ' já arquivada na ' + dono : 'sem a conta numa filial, a matriz ' + g.matriz) + ' (Vitor, 27/10/2026)'); }
  }
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
/**
 * O cliente pelo nome curto escrito no nome do arquivo ("DEFIS - 2025 A7 MOBILE.xlsx" = A7 MOBILE LTDA): todas as palavras dele
 * começam palavras da razão, do nome fantasia ou de outro nome do cadastro, e de um cliente só.
 */
function clientePeloNomeCurto(resto, cad) {
  const achados = clientesPeloNomeCurto(resto, cad);
  return achados.length === 1 ? achados[0] : null;
}
function clientesPeloNomeCurto(resto, cad) {
  const ws = textoDeNome(resto).trim().split(' ').filter(w => w.length >= 2 && !/^(LTDA|ME|EPP|EIRELI|DE|DA|DO|E)$/.test(w));
  if (!ws.length || ws.join('').length < 4) return [];
  const achados = [];
  for (const c of cad.porCod.values()) {
    const nomes = [c.razao, c.fantasia].concat(c.outrosNomes || []).filter(Boolean).map(n => textoDeNome(n).trim().split(' '));
    if (nomes.some(pal => ws.every(w => pal.some(p => p.startsWith(w))))) achados.push(c.codigo);
  }
  return achados;
}
/** O cliente pela pasta de origem; na pasta que junta matriz e filiais, o código do grupo no começo do nome ("414 Depreciação…"), senão a matriz. */
function clientePelaPastaOuGrupo(rel, nome, cad, ev) {
  const sub = clienteDaPasta(rel, cad);
  if (sub) { ev.push(sub.como); return { cliente: sub.codigo, conf: sub.forte ? 0.9 : 0.8, como: sub.forte ? 'pastaConferida' : 'pasta' }; }
  const g = grupoDaPasta(rel, cad);
  if (!g || g.matriz == null || !cad.porCod.has(g.matriz)) return null;
  const ini = /^(\d{2,4})(?!\d)/.exec(norm(nome));
  const codigos = [g.matriz].concat(g.filiais || []);
  if (ini && codigos.includes(+ini[1]) && cad.porCod.has(+ini[1])) { ev.push('pasta "' + g.parte + '": o código ' + ini[1] + ' no começo do nome'); return { cliente: +ini[1], conf: 0.9, como: 'pastaConferida' }; }
  ev.push('pasta "' + g.parte + '": sem o código no nome, a matriz ' + g.matriz);
  return { cliente: g.matriz, conf: 0.9, como: 'pastaConferida' };
}
function decidirPlanilha(entrada, ctx, ev, porHash) {
  const cad = ctx.cadastro;
  const linhas = (entrada.planilha || []).slice(0, 12).map(l => (l || []).join(' | '));
  const u = norm(linhas.join('\n'));
  const nome = norm(entrada.nome);
  const ext0 = (/\.[a-z0-9]+$/i.exec(entrada.nome) || ['.xlsx'])[0].toLowerCase();
  // a planilha de apoio da DEFIS (Vitor, 27/10/2026: "DEFIS - 2025 A7 MOBILE.xlsx", do "DEFIS 2025.zip"): 14. DEFIS do cliente,
  // "AAAA - DEFIS PLANILHA" (AAAA = o ano-calendário do nome), na raiz do ano da entrega (ano + 1); o cliente pelo CNPJ da
  // planilha, pelo nome no arquivo contra o cadastro ou pela pasta de origem
  const mDefis = /^DEFIS\s*-?\s*(20\d{2})\b\s*-?\s*(.*)$/.exec(nome.replace(/\.[A-Z0-9]{2,4}$/, '').trim());
  if (mDefis) {
    const base = { tipo: 'DEFIS PLANILHA', setor: 'FISCAL', fonte: 'planilha de apoio da DEFIS (Vitor, 27/10/2026)' };
    let cli = unico(documentosDoTexto((entrada.planilha || []).map(l => (l || []).join(' | ')).join('\n')).flatMap(d => clientesDoDoc(d.doc, cad))), como = 'doc', conf = 0.95;
    // a razão social no título da planilha ("DRE - ALDINEI MIRANDA ARAUJO ME - JANEIRO A DEZEMBRO 2025")
    const tit = /\bDRE\s*-\s*(.+?)\s*-\s*JANEIRO A DEZEMBRO/.exec(u);
    const doTitulo = tit ? (unico(clientesPeloNomeNoTexto(tit[1], cad)) || clientePeloNomeCurto(tit[1], cad)) : null;
    const doNomeArq = mDefis[2].trim() ? clientePeloNomeCurto(mDefis[2], cad) : null;
    const sub = clienteDaPasta(entrada.rel || entrada.nome, cad), daPasta = sub && sub.forte ? sub.codigo : null;
    if (cli == null) {
      const votos = [doTitulo, doNomeArq, daPasta].filter(x => x != null);
      if (new Set(votos).size > 1) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, evidencias: ev.concat('o título da planilha, o nome do arquivo e a pasta de origem dizem clientes diferentes: ' + [...new Set(votos)].join(', ')) });
      if (votos.length) { cli = votos[0]; como = daPasta != null && cli === daPasta ? 'pastaConferida' : 'nome'; conf = votos.length >= 2 ? 0.92 : 0.88; ev.push('cliente pelo ' + (doTitulo != null ? 'título da planilha' : doNomeArq != null ? 'nome no arquivo' : 'pasta de origem') + (votos.length >= 2 ? ' (confere com ' + (votos.length - 1) + ' outra fonte)' : '')); }
    }
    if (cli == null) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, evidencias: ev.concat('o nome no arquivo não é de um cliente só do cadastro') });
    return Object.assign(base, { acao: 'ARQUIVAR', cliente: cli, comoCliente: como, confianca: conf, competencia: { ano: +mDefis[1] }, caminho: ['FISCAL', 'SIMPLES NACIONAL', '14. DEFIS'], nomeFinal: mDefis[1] + ' - DEFIS PLANILHA' + ext0 });
  }
  // o papel de trabalho (Vitor, 27/10/2026; 04): a depreciação e as planilhas de controle do Simples ("PLANILHA SIMPLES NACIONAL
  // 2018…", "TRIBUTADO.xls") → CONTÁBIL\PAPÉIS DE TRABALHO\ANO\, nome original; o cliente pela pasta de origem (03); o ano pelo
  // nome, senão pela pasta; o nome com o código de OUTRO cliente ("lançamentos 509") fica
  // (27/10/2026, Vitor) a declaração de inventário e o balanço em planilha ("BALANÇO 2021 - DORNAS HAVANA.xlsx") também
  if (/DEPRECIA[CÇ][AÃ]O/.test(norm(entrada.nome)) || /^PLANILHA SIMPLES NACIONAL|^TRIBUTADO\.|DECLARACAO DE INVENTARIO|^BALANCO\b/.test(nome)) {
    const base = { tipo: 'PAPEL DE TRABALHO', setor: 'CONTABIL', fonte: 'papéis de trabalho (Vitor, 27/10/2026; 04)' };
    const c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : clientePelaPastaOuGrupo(entrada.rel || entrada.nome, entrada.nome, cad, ev);
    if (!c) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, evidencias: ev.concat('a pasta de origem não diz o cliente') });
    const outros = (nome.replace(/(19|20)\d{2}/g, ' ').match(/(?<![\d.])\d{2,3}(?![\d.])/g) || []).map(Number).filter(x => x !== c.cliente && cad.porCod.has(x) && x > 12);
    if (outros.length) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, cliente: c.cliente, evidencias: ev.concat('o nome traz o código de outro cliente (' + outros.join(', ') + ')') });
    const a = /(?:^|[^0-9])(20\d{2})(?![0-9])/.exec(nome.replace(/\.[A-Z0-9]{2,4}$/, '')), p = anoDaPasta(entrada.rel || '') || competenciaDaPasta(entrada.rel || '');
    const ano = a ? +a[1] : p ? p.ano : null;
    if (!ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'ANO_INDETERMINADO', confianca: 0.5, cliente: c.cliente, evidencias: ev.concat('sem o ano no nome nem na pasta de origem') });
    return Object.assign(base, { acao: 'ARQUIVAR', cliente: c.cliente, comoCliente: c.como, confianca: c.conf, competencia: { ano }, caminho: ['CONTÁBIL', 'PAPÉIS DE TRABALHO', String(ano)], nomeFinal: entrada.nome });
  }
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

/**
 * A conta bancária do CADASTRO (Vitor, 28/10/2026: "o cliente do extrato, do comprovante e da aplicação deve sair da CONTA
 * BANCÁRIA, conta por conta, para separar matriz e filiais"): clientes.contasBancarias do Entregas e os bancos do Cadastro do
 * nads, guardados no cache do cadastro com o código (arquivador-cadastro.js). Agência e conta só com os dígitos, sem pontos,
 * traços e zeros à esquerda; o dígito verificador separado e opcional ("2705-7" → 2705 e 7; "0001" → 1; "9558283" sem dígito).
 */
function numeroDeConta(s) {
  const t = String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '');
  const m = /^([\d.]+)-([\dX])$/.exec(t) || /^([\d.]+)$/.exec(t);
  if (!m) return null;
  const base = so(m[1]).replace(/^0+/, '');
  return base ? { base, dv: m[2] || null } : null;
}
/**
 * A mesma conta? Com os dois dígitos, base e dígito iguais; sem um deles, a base do outro, ou a base + o dígito ("95582839" do
 * extrato da Stone = "9558283" do cadastro). O número com a operação da Caixa na frente ("1292.000577985298-3") também casa
 * com o sem ela (o mais curto com 8 dígitos ou mais no fim do mais comprido).
 */
function mesmaConta(a, b) {
  if (!a || !b) return false;
  const fim = (x, y) => { const [c, l] = x.length <= y.length ? [x, y] : [y, x]; return c === l || (c.length >= 8 && l.endsWith(c)); };
  if (a.dv && b.dv) return a.dv === b.dv && fim(a.base, b.base);
  if (a.dv || b.dv) { const [x, y] = a.dv ? [a, b] : [b, a]; return fim(y.base, x.base) || fim(y.base, x.base + x.dv); }
  if (fim(a.base, b.base)) return true;
  const [c, l] = a.base.length <= b.base.length ? [a.base, b.base] : [b.base, a.base];
  return c.length >= 5 && l.length === c.length + 1 && l.startsWith(c);
}
const BANCO_DO_CADASTRO = { BB: 'BANCO DO BRASIL', 'BANCO DO BRASIL': 'BANCO DO BRASIL', BNB: 'BNB', 'BANCO DO NORDESTE': 'BNB', MERCADOPAGO: 'MERCADO PAGO', 'MERCADO PAGO': 'MERCADO PAGO', ITAU: 'ITAU', C6: 'C6', 'C6 BANK': 'C6', CEF: 'CAIXA', CAIXA: 'CAIXA', INFINITEPAY: 'INFINITEPAY', BTG: 'BTG PACTUAL' };
/** O banco do cadastro ("bb", "banco-do-brasil", "mercadopago", "Itaú") no nome que as regras usam ("BANCO DO BRASIL"…). */
function bancoDoCadastro(b) {
  const k = norm(String(b || '')).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!k) return null;
  if (BANCO_DO_CADASTRO[k]) return BANCO_DO_CADASTRO[k];
  const peloNome = BANCOS.find(([, re]) => re.test(k));
  return peloNome ? peloNome[0] : k;
}
/**
 * A agência e a conta do titular escritas no documento: [{ agencia, conta, pos }] (cada uma { base, dv }; a agência pode faltar).
 * Layouts: "Agência: 2705-7 Conta: 28265-0" e "Ag. 2705-7 C/C 26345-1" (BB), "AGENCIA 0001 CONTA 95582839" (Stone),
 * "3411 | 1292 | 000577985345-9" e "3411/1292/000578855317-9" (Caixa: agência, operação, conta), "EXTRATO DE: AG: 02557 | CC:
 * 0030590-1" e "02557 | 0006310-0" (Bradesco), "Agência/Conta Corrente: 060 - SALINAS/000011887-9" (BNB), "Cooperativa: 3144-5
 * Conta: 80.368-5" (Sicoob), "Conta: 15.062-2" (só a conta). Fica de fora a conta de quem recebeu (o rótulo mais perto antes
 * dela é o do destino, favorecido, beneficiário, recebedor) e, no extrato, a da linha de lançamento ("TED … AG 1234 CC 5678-9").
 */
function contasDoDocumento(texto, extrato) {
  const u = norm(texto).slice(0, 4000);
  const out = [], usados = [];
  const livre = (i, j) => !usados.some(([a, b]) => i < b && j > a);
  const linhaDe = pos => { const i = u.lastIndexOf('\n', pos); const j = u.indexOf('\n', pos); return u.slice(i + 1, j < 0 ? undefined : j); };
  const doTitular = pos => {
    const antes = u.slice(Math.max(0, pos - 160), pos);
    const ultimo = re => { let k = -1; for (const m of antes.matchAll(re)) k = m.index; return k; };
    return ultimo(/\b(DESTIN\w*|FAVORECID\w*|BENEFICIARI\w*|RECEBEDOR\w*|CREDITAD\w*)\b/g) <= ultimo(/\b(ORIGEM|PAGADOR\w*|DEBITAD\w*|REMETENTE|CLIENTE|TITULAR|CORRENTISTA|ASSOCIADO|COOPERADO)\b/g);
  };
  const add = (m, ag, ct) => {
    const i = m.index, j = m.index + m[0].length;
    if (!livre(i, j)) return;
    usados.push([i, j]);
    const conta = numeroDeConta(ct);
    if (!conta || conta.base.length < 3 || !doTitular(i) || (extrato && LINHA_DE_LANCAMENTO.test(linhaDe(i)))) return;
    out.push({ agencia: ag ? numeroDeConta(ag) : null, conta, pos: i });
  };
  const CT = '(\\d[\\d.]{2,17}(?:-[\\dX])?)(?![\\d])';
  for (const m of u.matchAll(/(?<![\d.])(\d{4})\s*[|/]\s*(\d{3,4})\s*[|/]\s*(\d{8,13}-\d)(?![\d])/g)) add(m, m[1], m[3]);
  for (const m of u.matchAll(new RegExp('\\bAGENCIA\\s*[/|]\\s*CONTA(?: CORRENTE)?[^\\d\\n]{0,40}\\n?\\s*(\\d{1,5}(?:-[\\dX])?)(?:\\s*-\\s*[A-Z][A-Z ]{1,30})?\\s*[/|]\\s*' + CT, 'g'))) add(m, m[1], m[2]);
  for (const m of u.matchAll(new RegExp('(?:\\b(?:AGENCIA|AG|COOPERATIVA|COOP)|(?<=[A-Z])AGENCIA)\\b\\.?(?:\\s*N[O°º]\\.?)?\\s*:?\\s*(\\d{1,5}(?:-[\\dX])?)(?![\\d.])\\s*[,;|/-]?\\s*(?:[A-Z][A-Z ]{0,25}\\s)?(?:CONTA(?: CORRENTE)?|C/C|CC)\\b\\.?(?:\\s*N[O°º]\\.?)?\\s*:?\\s*' + CT, 'g'))) add(m, m[1], m[2]);
  for (const m of u.matchAll(/(?<![\d.|/])(\d{4,5})\s*\|\s*(\d{5,13}-[\dX])(?![\d])/g)) add(m, m[1], m[2]);
  for (const m of u.matchAll(new RegExp('\\b(?:CONTA(?: CORRENTE)?|C/C)\\s*:\\s*(\\d[\\d.]{2,17}-[\\dX])(?![\\d])', 'g'))) add(m, null, m[1]);
  return out.sort((a, b) => a.pos - b.pos);
}
/**
 * A agência e a conta no nome do arquivo (28/10/2026: "Entradas_Saidas_ag3155cc990348_01-09-26.pdf", o relatório do Sicredi),
 * e o que o documento traz (contasDoDocumento).
 */
function contasDoNome(nome) {
  const m = /(?:^|[^A-Z0-9])AG\.?\s*(\d{3,5})[\s_.-]*C\.?\/?C\.?\s*(\d{4,13}(?:-[\dX])?)(?![\d])/.exec(norm(String(nome || '')));
  const conta = m && numeroDeConta(m[2]);
  return conta ? [{ agencia: numeroDeConta(m[1]), conta, pos: -1, doNome: true }] : [];
}
function contasDoArquivo(bruto, entrada, extrato) { return contasDoDocumento(bruto, extrato).concat(contasDoNome(entrada && entrada.nome)); }
/**
 * Os clientes do cadastro donos das contas do documento (cad.contas): o banco e a agência, quando os dois lados têm, precisam
 * bater. → { clientes, contas (o texto das que bateram, para a evidência) }.
 */
function clientesPelasContas(contas, banco, cad) {
  const clientes = new Set(), achadas = [], postas = new Set();
  for (const d of contas) {
    for (const c of (cad && cad.contas) || []) {
      if (banco && c.banco && c.banco !== banco) continue;
      if (c.aprendida && !banco) continue;   // a conta que o robô aprendeu só vale com o banco do documento lido (há contas erradas aprendidas)
      if (d.agencia && c.agencia && d.agencia.base !== c.agencia.base) continue;
      if (!mesmaConta(d.conta, c.conta)) continue;
      clientes.add(c.codigo);
      if (!c.aprendida) postas.add(c.codigo);
      achadas.push((c.banco || '?') + ' ag. ' + (c.agencia ? c.agencia.base : '?') + ' c/c ' + c.conta.base + (c.conta.dv ? '-' + c.conta.dv : '') + ' → ' + c.codigo);
    }
  }
  // em dois clientes, só um com a conta posta por uma pessoa (a outra o robô aprendeu de um extrato arquivado na pasta errada)
  if (clientes.size > 1 && postas.size === 1) return { clientes: [...postas], contas: [...new Set(achadas)], desempate: 'a conta está em ' + clientes.size + ' clientes, mas só na ' + [...postas][0] + ' foi posta por uma pessoa (nas outras o robô aprendeu de um extrato)' };
  return { clientes: [...clientes], contas: [...new Set(achadas)] };
}
/**
 * A conta em mais de um cliente do cadastro (quase sempre a que o robô aprendeu de um extrato posto na pasta errada): se a pasta de
 * origem (o cliente dela, ou a matriz e as filiais do grupo do mapa) é de UM só desses clientes, é ele; senão null (CLIENTE_AMBIGUO).
 */
function daPastaEntre(clientes, rel, cad) {
  const sub = clienteDaPasta(rel || '', cad);
  const g = grupoDaPasta(rel || '', cad);
  const daPasta = sub ? [sub.codigo] : g && g.matriz != null ? [g.matriz].concat(g.filiais || []) : [];
  const x = clientes.filter(c => daPasta.includes(c));
  return x.length === 1 ? x[0] : null;
}
/**
 * O titular abreviado pelo banco ("OURO VERDE MIN E FLORESTAS LTDA" = OURO VERDE MINERACAO E FLORESTAS, 28/10/2026): as mesmas
 * palavras, na ordem, cada uma o começo da palavra do nome do cadastro (razão, fantasia ou outros nomes); 3 palavras ou mais.
 */
function clientesPeloNomeAbreviado(titular, cad) {
  const fora = new Set(['LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'S', 'A', 'CIA', 'FILIAL', 'MATRIZ']);
  const tok = s => textoDeNome(s).trim().split(/\s+/).filter(w => w && !fora.has(w));
  const t = tok(titular);
  if (t.length < 3) return [];
  const bate = nome => { const n = tok(nome); return n.length === t.length && t.every((w, i) => n[i] === w || (w.length >= 3 && n[i].startsWith(w))); };
  return [...cad.porCod.values()].filter(c => c.ativo !== false && [c.razao, c.fantasia].concat(c.outrosNomes || []).some(x => x && bate(x))).map(c => c.codigo);
}
const PELA_CONTA_DO_CADASTRO = ['EXTRATO', 'APLICACOES', 'COMPROVANTE', 'RECEBIMENTO DE CLIENTES', 'MAQUININHAS'];

/** O cliente de um PDF: CNPJ/CPF do texto > raiz/máscara > razão social escrita > pasta de origem. */
/**
 * O extrato, a aplicação e o DAE na pasta que junta matriz e filiais (Vitor, 27/10/2026: 413, 415, 408) sem o CNPJ de uma filial:
 * a matriz; a conta já arquivada numa delas vale essa. O CNPJ de uma filial só (fora dos lançamentos) vale a filial; o de mais
 * de uma, ou o de outro cliente, continua como as regras dizem.
 */
function clienteDoPdf(u, bruto, entrada, ctx, ev, regra, campos) {
  const r = clienteDoPdf0(u, bruto, entrada, ctx, ev, regra, campos);
  if (r.cliente != null || r.contaAmbigua || !['EXTRATO', 'APLICACOES', 'DAE'].includes(regra.tipo)) return r;
  const cad = ctx.cadastro;
  const g = grupoDaPasta(entrada.rel || entrada.nome, cad);
  if (!g || g.matriz == null || !cad.porCod.has(g.matriz) || clienteDaPasta(entrada.rel || entrada.nome, cad)) return r;
  const G = [g.matriz].concat(g.filiais || []);
  const conta = regra.tipo !== 'DAE';
  const linhaDe = pos => { const i = bruto.lastIndexOf('\n', pos); const j = bruto.indexOf('\n', pos); return norm(bruto.slice(i + 1, j < 0 ? undefined : j)); };
  const doDoc = [...new Set(documentosDoTexto(bruto).filter(d => !ESCRITORIO.has(d.doc) && (!conta || (d.pos <= 800 && !LINHA_DE_LANCAMENTO.test(linhaDe(d.pos))))).flatMap(d => clientesDoDoc(d.doc, cad)))];
  if (doDoc.some(c => !G.includes(c))) return r;
  const filiais = doDoc.filter(c => c !== g.matriz);
  if (filiais.length > 1) return r;
  if (filiais.length === 1) { ev.push('pasta "' + g.parte + '": a filial ' + filiais[0] + ' pelo CNPJ no conteúdo'); return { cliente: filiais[0], conf: 0.93, como: 'doc' }; }
  const pc = conta ? clientePelaConta(bruto, bancoDoTexto(bruto) || bancoDoNome(entrada.nome), ctx, entrada.hash) : null;
  if (pc != null && G.includes(pc)) { ev.push('pasta "' + g.parte + '": a conta já arquivada na ' + pc + ' (Vitor, 27/10/2026)'); return { cliente: pc, conf: 0.92, como: 'conta' }; }
  ev.push('pasta "' + g.parte + '": sem o CNPJ de uma filial, a matriz ' + g.matriz + ' (Vitor, 27/10/2026)');
  return { cliente: g.matriz, conf: 0.9, como: 'pastaConferida' };
}
function clienteDoPdf0(u, bruto, entrada, ctx, ev, regra, campos) {
  const cad = ctx.cadastro;
  const CONTA = ['EXTRATO', 'APLICACOES', 'RECEBIMENTO DE CLIENTES', 'MAQUININHAS', 'FATURA CARTAO'].includes(regra.tipo);
  const linhaDe = pos => { const i = bruto.lastIndexOf('\n', pos); const j = bruto.indexOf('\n', pos); return norm(bruto.slice(i + 1, j < 0 ? undefined : j)); };
  // num extrato, o CNPJ de quem pagou/recebeu aparece no lançamento: só vale o do cabeçalho / fora dos lançamentos
  // relatório de maquininha traz o CNPJ do estabelecimento depois dos filtros (Cielo): limite maior
  const limite = regra.tipo === 'MAQUININHAS' ? 2500 : CONTA ? 800 : regra.tipo === 'BALANCETE' ? 1500 : Infinity;
  const docs = documentosDoTexto(bruto, regra.tipo === '?').filter(d => !ESCRITORIO.has(d.doc) && d.pos <= limite && !(CONTA && LINHA_DE_LANCAMENTO.test(linhaDe(d.pos))));
  const sub = clienteDaPasta(entrada.rel, cad);
  // Guia de DCTFWeb/FGTS: o CNPJ/CPF do contribuinte vem no nome do arquivo ("GuiaPagamento_<CNPJ>_<MMAAAA>_…").
  const docNome = (/(?:^|_)(\d{14}|\d{11})_/.exec(entrada.nome) || [])[1];
  let candidatos = [];
  const porDoc = new Map();
  for (const d of docs) for (const c of clientesDoDoc(d.doc, cad)) { if (!porDoc.has(c)) { porDoc.set(c, d.pos); candidatos.push(c); } }

  // a conta do cadastro (Vitor, 28/10/2026): a que bate com UM cliente decide, matriz ou filial; vence a pasta de origem, o grupo
  // matriz+filiais do mapa e o nome do titular (o mesmo na matriz e na filial), mas não o CNPJ de cliente escrito no documento.
  // A que bate com dois clientes do cadastro fica CLIENTE_AMBIGUO (a não ser que o CNPJ do documento diga qual)
  if (PELA_CONTA_DO_CADASTRO.includes(regra.tipo) && cad.contas && cad.contas.length) {
    const banco = bancoDoTexto(bruto, true) || bancoDoNome(entrada.nome);
    const pc = clientesPelasContas(contasDoArquivo(bruto, entrada, regra.tipo !== 'COMPROVANTE'), banco, cad);
    const comDoc = pc.clientes.filter(c => candidatos.includes(c));
    if (pc.clientes.length === 1 && (!candidatos.length || comDoc.length === 1)) { ev.push('a conta do cadastro: ' + pc.contas.join('; ') + ' (Vitor, 28/10/2026)'); if (pc.desempate) ev.push(pc.desempate); return { cliente: pc.clientes[0], conf: 0.95, como: 'conta' }; }
    if (pc.clientes.length === 1) ev.push('a conta ' + pc.contas.join('; ') + ' é da ' + pc.clientes[0] + ' no cadastro, mas o documento traz o CNPJ de outro cliente: vale o CNPJ');
    else if (pc.clientes.length > 1 && comDoc.length === 1) { ev.push('a conta é de dois clientes no cadastro (' + pc.contas.join('; ') + '); o CNPJ do documento diz qual'); return { cliente: comDoc[0], conf: 0.93, como: 'doc' }; }
    else if (pc.clientes.length > 1 && !candidatos.length && daPastaEntre(pc.clientes, entrada.rel, cad) != null) { const x = daPastaEntre(pc.clientes, entrada.rel, cad); ev.push('a conta está em ' + pc.clientes.length + ' clientes do cadastro (' + pc.contas.join('; ') + '); a pasta de origem é de um só deles: a ' + x + ' (corrigir a conta errada no Cadastro)'); return { cliente: x, conf: 0.9, como: 'conta' }; }
    else if (pc.clientes.length > 1 && !candidatos.length) { ev.push('a mesma conta está em ' + pc.clientes.length + ' clientes do cadastro: ' + pc.contas.join('; ') + ' (corrigir no Cadastro › Empresas › Bancos)'); return { motivo: 'CLIENTE_AMBIGUO', candidatos: pc.clientes, contaAmbigua: true }; }
  }

  // papéis: comprovante = titular da conta ("Cliente:" no cabeçalho); nota = emitente × destinatário (03)
  if (regra.tipo === 'COMPROVANTE' || regra.tipo === 'EXTRATO' || regra.tipo === 'APLICACOES' || regra.tipo === 'RECEBIMENTO DE CLIENTES' || regra.tipo === 'MAQUININHAS') {
    const tit = /\b(?:CLIENTE|TITULAR|CORRENTISTA|NOME DO PAGADOR|NOME)\s*:\s*([A-Z0-9&. -]{6,})/.exec(u) || /\bCONTA(?: CORRENTE)?\s*:?\s*[\d.]+-[\dX]\s*\/?\s*([A-Z][A-Z0-9&. -]{5,})/.exec(u);
    if (tit) {
      // o nome do titular que bate com a matriz e as filiais (mesma raiz de CNPJ; 28/10/2026, "OURO VERDE MIN E FLORESTAS" = 408/409):
      // vale a matriz (a conta já desempatou acima); o nome de OUTRO cliente vence a pasta de origem (os "Caixa Economica OV" na pasta da Vera)
      let peloNome = [...new Set(clientesPeloNomeNoTexto(tit[1], cad))];
      const abreviado = !peloNome.length;
      if (abreviado) peloNome = clientesPeloNomeAbreviado(tit[1], cad);
      const raizes = new Set(peloNome.map(x => ((cad.porCod.get(x) || {}).doc || '').slice(0, 8)));
      const matrizes = peloNome.filter(x => ((cad.porCod.get(x) || {}).doc || '').slice(8, 12) === '0001');
      // a conta já arquivada (contas.json) numa das empresas do mesmo nome desempata; sem ela, a matriz
      const daRaiz = r => (r && cad.porRaiz.has(r) ? [...cad.porRaiz.get(r)] : []);
      const aprendida = peloNome.length ? clientePelaConta(bruto, bancoDoTexto(bruto) || bancoDoNome(entrada.nome), ctx, entrada.hash) : null;
      const r0 = peloNome.length ? ((cad.porCod.get(peloNome[0]) || {}).doc || '').slice(0, 8) : '';
      let n = aprendida != null && raizes.size === 1 && daRaiz(r0).includes(aprendida) ? aprendida
        : peloNome.length === 1 ? peloNome[0] : abreviado && peloNome.length > 1 && raizes.size === 1 && !raizes.has('') && matrizes.length === 1 ? matrizes[0] : null;
      // o nome de uma filial, sem "FILIAL" no titular, vale o grupo: sem a conta, a matriz da mesma raiz (Vitor, 28/10/2026)
      const dN = n != null ? ((cad.porCod.get(n) || {}).doc || '') : '';
      if (abreviado && n !== aprendida && !/FILIAL/.test(tit[1]) && dN.length === 14 && dN.slice(8, 12) !== '0001' && cad.porRaiz.has(dN.slice(0, 8))) { const m = [...cad.porRaiz.get(dN.slice(0, 8))].filter(x => ((cad.porCod.get(x) || {}).doc || '').slice(8, 12) === '0001'); if (m.length === 1) n = m[0]; }
      if (n) { ev.push('titular da conta no cabeçalho: ' + tit[1].trim()); return { cliente: n, conf: candidatos.length <= 1 || candidatos.includes(n) ? 0.95 : 0.88, como: 'nome' }; }
    }
  }
  if (candidatos.length > 1 && sub && candidatos.includes(sub.codigo)) { ev.push('CNPJ do documento e ' + sub.como); return { cliente: sub.codigo, conf: 0.93, como: 'doc' }; }
  if (candidatos.length > 1 && docNome) { const c = unico(clientesDoDoc(docNome, cad)); if (c && candidatos.includes(c)) { ev.push('CNPJ do nome da guia'); return { cliente: c, conf: 0.97, como: 'doc' }; } }
  if (candidatos.length > 1 && /^(DAS|PGDAS-D|DARF|DAE|DAM|FGTS|DEFIS|DEFIS ALTERDATA|ECF|DIRF|BALANCETE|CARTAO CNPJ|CERTIDAO|LIVRO_FISCAL|RELATORIO LJ)$/.test(regra.tipo)) {
    // guia/declaração: o contribuinte é o primeiro CNPJ/CPF do documento (é o campo do cabeçalho)
    candidatos.sort((a, b) => porDoc.get(a) - porDoc.get(b));
    ev.push('contribuinte = 1º CNPJ/CPF do documento'); return { cliente: candidatos[0], conf: 0.9, como: 'doc' };
  }
  // o contrato social que só traz o CPF dos sócios (clientes pessoa física) na pasta da empresa: é da empresa (Vitor, 26/10/2026)
  if (candidatos.length && regra.tipo === 'DOC CONSTITUTIVO' && sub && sub.forte && (cad.porCod.get(sub.codigo) || {}).doc && cad.porCod.get(sub.codigo).doc.length === 14
    && !candidatos.includes(sub.codigo) && candidatos.every(x => ((cad.porCod.get(x) || {}).doc || '').length === 11)) { ev.push('só o CPF de sócio(s) no documento: a empresa da pasta de origem (' + sub.como + ')'); return { cliente: sub.codigo, conf: 0.9, como: 'pastaConferida' }; }
  if (candidatos.length === 1) { ev.push('CNPJ/CPF do documento'); return { cliente: candidatos[0], conf: sub && sub.codigo !== candidatos[0] ? 0.9 : 0.96, como: 'doc' }; }
  if (!candidatos.length && regra.tipo === 'INSCRICAO ESTADUAL') {
    // a inscrição estadual impressa (ou no nome do arquivo) de um cliente só do cadastro (27/10/2026)
    const nums = new Set((bruto + ' ' + entrada.nome).match(/\d[\d./-]{7,18}\d/g) || []);
    const ies = [...nums].map(so).filter(x => x.length >= 9);
    const porIe = [...new Set([...cad.porCod.values()].filter(x => x.ie && x.ie.length >= 9 && ies.some(i => i === x.ie || i.replace(/^0+/, '') === x.ie.replace(/^0+/, ''))).map(x => x.codigo))];
    if (porIe.length === 1) { ev.push('inscrição estadual do cadastro no documento'); return { cliente: porIe[0], conf: 0.95, como: 'doc' }; }
  }
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
  // o emitente das chaves listadas (27/10/2026: o GDOOR não imprime o CNPJ no cabeçalho): todas do mesmo CNPJ, de um cliente
  const emits = [...new Set([...u.matchAll(/(?<!\d)\d{6}(\d{14})(?:55|65|57)\d{23}(?!\d)/g)].map(m => m[1]).filter(cnpjValido))];
  if (emits.length === 1 && !/^[\s\S]{0,300}(ENTRADA|RECEBIDAS|COMPRAS)/.test(u)) { const c = unico(clientesDoDoc(emits[0], cad)); if (c) { ev.push('o emitente das chaves listadas no relatório'); return { cliente: c, conf: 0.93, como: 'doc' }; } }
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

/**
 * Pagamento de FORNECEDOR (Vitor, 27/10/2026): comprovante, NF, boleto ou fatura que o cliente guarda nas pastas de
 * pagamentos ("Comprovantes e Pagtos\NFs e Boletos", "Comprovantes e NFs"), com o nome no padrão do escritório: a data
 * DD-MM-AAAA e/ou "NF nnn"/"NFSE nn"/"FATURAS Nº nnn", o fornecedor e o valor ("28-04-2025 POSTO 116 NF18203 R$4.107,85.pdf").
 * Fora da árvore de EXTRATOS (o comprovante bancário continua em EXTRATOS\…\COMPROVANTES\[BANCO]). → { fornecedor, data } ou null.
 */
const PASTA_DE_PAGAMENTOS = /\b(COMPROVANTES|PAGTOS|NFS E BOLETOS)\b/;
const DOC_DO_FORNECEDOR = '(?:NFS-?E|NF-?E|NF|FATURAS?|BOLETOS?)\\s*(?:N[O°º.]*\\s*)?\\d';
function pagamentoDeFornecedor(entrada) {
  const nome = String(entrada.nome || '');
  if (!/\.pdf$/i.test(nome)) return null;
  const pastas = partesDoCaminho(entrada.rel || nome).slice(0, -1).map(p => norm(p).replace(/[^A-Z0-9 ]+/g, ' ').replace(/ +/g, ' ').trim());
  if (!pastas.some(p => PASTA_DE_PAGAMENTOS.test(p)) || pastas.includes('EXTRATOS')) return null;
  const base = norm(nome.replace(/\.[a-z0-9]{2,4}$/i, '')).replace(/\s+/g, ' ').trim();
  // 27/10/2026 (Vitor, 2ª leva): o boleto/NF/apólice SEM data nem "NF nnn" no nome, só o valor ("BOLETO SEGURO FROTA PARC.07
  // DE 10 R$2.893,77", "NFSE 19 IFEM R42.750,00", "Apolice_1009715020959 ESSOR R$215,45"): o mês da pasta de origem, o
  // fornecedor pelo nome (fornecedorDoNomeSemData) ou, no boleto, pelo beneficiário do conteúdo (decidirFornecedor)
  const comValor = /R\$\s*\d/.test(base), semCifrao = !comValor && /(?:^|\s)R\$?\s*\d[\d.]*,\d{2}(?!\d)/.test(base);
  if (!comValor && !semCifrao) return null;
  const dm = /^(\d{2})-(\d{2})-(\d{4})\s/.exec(base);
  const data = dm && +dm[1] >= 1 && +dm[1] <= 31 && +dm[2] >= 1 && +dm[2] <= 12 && anoOk(+dm[3]) ? { mes: +dm[2], ano: +dm[3] } : null;
  if (!data && !new RegExp('^' + DOC_DO_FORNECEDOR + '|\\s(?:NFS-?E|NF-?E|NF)\\s*\\d').test(base)) {
    // só o documento de fornecedor (boleto, nota, fatura, apólice, o relatório de cobrança): a guia de imposto, o pró-labore etc. ficam
    if (!/^(BOLETOS?|NFS-?E|NFFS|NF-?E|NFC|NF|FT|FATURAS?|APOLICE|SEGURO|RELATORIO PERIODICO AO CLIENTE|RECIBO|REEMBOLSO|RELATORIO CUSTO|RELATORIO)\b|\bCOND\.? AP\b|\bCONDOMINIO\b/.test(base.replace(/_/g, ' '))
      || /\b(DAE|DARF|DAM|DAJE|DAJI|GRU|CCIR|IPVA|ISSQN|IRPJ|CSLL|PRO-?\s?LABORE|PROLABORE|FERIAS)\b/.test(base)) return null;
    return { fornecedor: fornecedorDoNomeSemData(base), data, semData: true, base };
  }
  // o fornecedor: o trecho entre a data / o "NF nnn" do começo e o próximo "NF nnn" ou o "R$"
  // "BOLETO LUSO BRASIL NF60236 R$454,00" (27/10/2026, a 415 LAVICA): a palavra BOLETO do começo é o tipo, não o fornecedor
  let s = base.replace(/^\d{2}-\d{2}-\d{4}\s+/, '').replace(new RegExp('^' + DOC_DO_FORNECEDOR + '+(?:\\s*(?:E|,|/|-)\\s*\\d+)*\\s+'), '').replace(/^BOLETOS?\s+(?=[A-Z])/, '');
  const corte = s.search(new RegExp('\\s' + DOC_DO_FORNECEDOR + '|\\s*R\\$|\\s+R\\d[\\d.]*,\\d{2}'));
  if (corte >= 0) s = s.slice(0, corte);
  return { fornecedor: nomeSeguro(semAcento(nomeNormalizado(s))).toUpperCase(), data };
}
/** O fornecedor pelo nome do boleto/NF sem data: tira o tipo do começo, o valor, a parcela, o trimestre e o número solto do fim. */
function fornecedorDoNomeSemData(base) {
  let s = String(base || '').replace(/_/g, ' ');
  s = s.replace(/\s*-?\s*R\$?\s*\d[\d.]*,\d{2}.*$/, '').replace(/\b\d+\s*[O°º]?\s*TRIM(?:ESTRE)?\b\.?/g, ' ');
  s = s.replace(/\b(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[-/ ]?(20\d{2})\b/g, ' ').replace(/^RELATORIO\s+(?!PERIODICO)(CUSTO\s+)?/, '').replace(/^REEMBOLSO\s+/, '');
  s = s.replace(/^(?:(?:BOLETOS?|FATURAS?|NFS-?E|NFFS|NF-?E|NFSC|NFC|NF|NC|FT|APOLICE|RECIBO|TAXA|GUIA)\b[\s.:-]*(?:N[O°º.]+\s*)?(?:\d[\d.\/-]*)?\s*)+/, '');
  s = s.replace(/\bRELATORIO PERIODICO AO CLIENTE\b/g, ' ').replace(/\bPARC(?:ELA)?\.?\s*\d+\s*(?:DE|\/)\s*\d+\b/g, ' ')
    .replace(/\b(MATRIZ|FILIAL\s*\d*)\b/g, ' ').replace(/(?:\s+-?\s*\d+)+\s*$/, '').replace(/^[\s•\-–.]+|[\s•\-–.]+$/g, '').replace(/\s+/g, ' ').trim();
  // só um nome de fornecedor: sem número e sem começar por uma palavra do que se paga (mensalidade, multa, matrícula…)
  if (!/[A-Z]{3}/.test(s) || /\d/.test(s) || /^(MENSALIDADE|MULTA|SEFAZ|PEDIDO|MAT|MATRICULAS?|CERTIDAO|CARTIDAO|AVERBACAO|REPOSICAO|PARCELA|PARC|DOACAO|LOCACAO|DE|DA|DO|DOS|DAS|E|EM|A|O)\b/.test(s)) return null;
  return nomeSeguro(semAcento(nomeNormalizado(s))).toUpperCase() || null;
}
function decidirFornecedor(pg, entrada, u, bruto, ctx, ev, porHash) {
  const cad = ctx.cadastro;
  const rel = entrada.rel || entrada.nome;
  const base = { tipo: 'FATURA FORNECEDOR', setor: 'CONTABIL', fonte: 'pagamentos de fornecedores (Vitor, 27/10/2026); 04 (Pag. Fornecedores)' };
  ev.push('pagamento de fornecedor pelo padrão do nome (data/NF/R$) e pela pasta de pagamentos da origem');
  const r = clienteDoPagamento(rel, bruto, cad, ev, porHash, false);
  if (r.erro) return Object.assign(base, r.erro);
  const c = r.c;
  Object.assign(base, { cliente: c.cliente, comoCliente: c.como });
  if (pg.semData) {
    // sem data no nome (27/10/2026): no boleto, o beneficiário lido no conteúdo vale antes do nome; no nome, as palavras do
    // nome do próprio cliente saem ("BOLETO TAXA 1° TRIM. IBAMA BRAZILIAN MATRIZ" = IBAMA)
    const cli = cad.porCod.get(c.cliente) || {};
    const ehDoCliente = n => [cli.razao].concat(cli.outrosNomes || []).filter(Boolean).some(r => chaveNome(nomeNormalizado(r)) === chaveNome(n) || chaveNome(r).startsWith(chaveNome(n)));
    const regraBoleto = REGRAS_PDF.find(x => x.tipo === 'BOLETO FORNECEDOR');
    const doBoleto = u && regraBoleto.re.test(u) ? beneficiariosDoBoleto(u).find(b => b.rotulo !== 'pagador' && !ehDoCliente(b.nome) && !(b.doc && clientesDoDoc(b.doc, cad).includes(c.cliente))) : null;
    const palavrasDoCliente = new Set(textoDeNome(cli.razao || '').trim().split(' ').filter(w => w.length >= 4 && !/^(LTDA|EIRELI|COMERCIO|INDUSTRIA|SERVICOS|EMPREENDIMENTOS|FLORESTAIS)$/.test(w)));
    const doNome = fornecedorDoNomeSemData(String(pg.base || '').split(' ').filter(w => !palavrasDoCliente.has(semAcento(w))).join(' '));
    pg = Object.assign({}, pg, { fornecedor: doBoleto ? doBoleto.nome : (doNome && /[A-Z]{3}/.test(doNome) ? doNome : null) });
    ev.push('sem data no nome: o mês pela pasta de origem; o fornecedor ' + (doBoleto ? 'pelo beneficiário do boleto' : 'pelo nome do arquivo') + ' (Vitor, 27/10/2026)');
  }
  if (!pg.fornecedor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('o nome do fornecedor não foi lido no nome do arquivo (04: Fornecedores)') });
  // o mês: a data do começo do nome; sem ela, o mês da pasta de origem; sem ele, o vencimento no conteúdo
  let comp = pg.data;
  if (comp) ev.push('mês pela data no começo do nome');
  const pasta = anoDaPasta(rel) || competenciaDaPasta(rel);
  if (!comp && pasta && pasta.mes) { comp = { mes: pasta.mes, ano: pasta.ano }; ev.push('mês pela pasta de origem (' + mesAno(comp) + ')'); }
  if (!comp) { const v = dataBr(linhaApos(u, /VENCIMENTO/, 60)); if (v) { comp = { mes: +v.slice(3, 5), ano: +v.slice(6) }; ev.push('mês pelo vencimento no conteúdo (' + v + ')'); } }
  if (!comp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('sem a data no começo do nome, o mês na pasta de origem ou o vencimento no conteúdo') });
  // o nome original fica (já traz a data, o fornecedor, a NF e o valor)
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: comp, caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(comp.ano), dois(comp.mes), pg.fornecedor], nomeFinal: entrada.nome });
}

/**
 * O cliente de um pagamento (27/10/2026): com `pagador`, o do CNPJ do pagador no conteúdo primeiro (o comprovante do Berizal);
 * depois o da pasta de origem; na pasta que junta matriz e filiais (o mapa: 413, 415…), a filial cujo CNPJ está no conteúdo,
 * senão a matriz. → { c: { cliente, conf, como } } ou { erro: { acao, motivo, confianca, evidencias } }.
 */
function clienteDoPagamento(rel, bruto, cad, ev, porHash, pagador) {
  if (porHash) return { c: { cliente: porHash, conf: 0.97, como: 'hash' } };
  if (pagador) { const p = pagadorDoComprovante(bruto, cad); if (p != null) { ev.push('cliente pelo CNPJ do pagador'); return { c: { cliente: p, conf: 0.95, como: 'doc' } }; } }
  const sub = clienteDaPasta(rel, cad);
  if (sub) { ev.push(sub.como); return { c: { cliente: sub.codigo, conf: sub.forte ? 0.9 : 0.8, como: sub.forte ? 'pastaConferida' : 'pasta' } }; }
  const g = grupoDaPasta(rel, cad);
  if (g && g.matriz != null && cad.porCod.has(g.matriz)) {
    const fil = [...new Set(documentosDoTexto(bruto).flatMap(d => clientesDoDoc(d.doc, cad)))].filter(x => (g.filiais || []).includes(x));
    if (fil.length > 1) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_AMBIGUO', confianca: 0.4, evidencias: ev.concat('o conteúdo traz o CNPJ de mais de uma filial da pasta "' + g.parte + '": ' + fil.join(', ')) } };
    if (fil.length === 1) { ev.push('pasta "' + g.parte + '": a filial ' + fil[0] + ' pelo CNPJ no conteúdo'); return { c: { cliente: fil[0], conf: 0.93, como: 'doc' } }; }
    ev.push('pasta "' + g.parte + '": sem o CNPJ de uma filial no conteúdo, a matriz ' + g.matriz);
    return { c: { cliente: g.matriz, conf: 0.9, como: 'pastaConferida' } };
  }
  return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, evidencias: ev.concat(pagador ? 'nem o CNPJ do pagador nem a pasta de origem dizem o cliente' : 'a pasta de origem não diz o cliente') } };
}
/** O cliente pagador de um comprovante: o CNPJ/CPF cujo rótulo mais próximo antes dele é Pagador/Sacado/Correntista (um cliente só). */
function pagadorDoComprovante(bruto, cad) {
  const achados = clientesDoRotulo(bruto, cad, /^(PAGADOR|SACADO|CORRENTISTA)$/);
  return achados.size === 1 ? [...achados][0] : null;
}
/** Os clientes cujo CNPJ/CPF tem, como rótulo mais próximo antes dele, um dos rótulos de `re` (Pagador, Beneficiário…). */
function clientesDoRotulo(bruto, cad, re) {
  const achados = new Set();
  for (const d of documentosDoTexto(bruto)) {
    const antes = norm(bruto.slice(Math.max(0, d.pos - 160), d.pos));
    const rotulos = [...antes.matchAll(/\b(PAGADOR|SACADO|CORRENTISTA|BENEFICIARIO|CEDENTE|FAVORECIDO|SACADOR)\b/g)];
    const ult = rotulos.length ? rotulos[rotulos.length - 1][1] : null;
    if (re.test(ult || '')) clientesDoDoc(d.doc, cad).forEach(c => achados.add(c));
  }
  return achados;
}

/**
 * O boleto (a ficha de compensação) que o cliente recebe para pagar (27/10/2026, os exemplos do DP: o boleto de honorários
 * da Nilma para o PEDRO JORGE): 04, "Pag. Fornecedores — Fatura": CONTÁBIL\PAGAMENTOS DE FORNECEDORES\[ANO]\[MÊS]\
 * [FORNECEDOR]\Fatura_[FORNECEDOR]_R$[VALOR]_[MÊS E ANO].pdf, a competência é o mês do VENCIMENTO (04, 05/10/2026). O cliente é
 * o pagador (sacado) pelo CNPJ/CPF; sem ele, a pasta de origem — nunca quando a pasta é a do beneficiário (o boleto que o
 * próprio cliente emitiu é a receber, não pagamento dele). O fornecedor é o beneficiário (cedente); o valor, o do código de
 * barras (os 10 últimos dígitos da linha digitável), senão o impresso.
 */
const LINHA_DIGITAVEL = /(\d{5})\.(\d{5})\s+(\d{5})\.(\d{6})\s+(\d{5})\.(\d{6})\s+(\d)\s+(\d{14})(?!\d)/;
function camposDoBoleto(u) {
  const ld = LINHA_DIGITAVEL.exec(u);
  const cents = ld ? +ld[8].slice(4) : 0;
  let valor = cents > 0 ? 'R$' + Math.floor(cents / 100) + ',' + dois(cents % 100) : null;
  if (!valor) valor = valorBr(linhaApos(u, /VALOR (DO )?DOCUMENTO|VALOR COBRADO|\bVALOR\b/, 80));
  const venc = dataBr(linhaApos(u, /VENCIMENTO/, 80));
  return { valor, vencimento: venc, competencia: venc ? { mes: +venc.slice(3, 5), ano: +venc.slice(6) } : null, beneficiarios: beneficiariosDoBoleto(u) };
}
/**
 * Os nomes que podem ser o beneficiário de um boleto, na ordem do texto. O pdf.js embaralha a ficha de compensação (cada
 * banco de um jeito), então só vale o nome que vem colado no CPF/CNPJ dele ("FUNDO AEROVIARIO-ANAC CPF/CNPJ: 08.471.457/0001-96",
 * "NILMA DIAS OLIVEIRA CPF: 032.318.376-00…") e, na linha logo abaixo do rótulo "Beneficiário", só a razão social que termina
 * num sufixo societário ("PACTUAL CONSULTORIA E FOMENTO LTDAR$2377…" = PACTUAL CONSULTORIA E FOMENTO LTDA). Nome com número,
 * endereço ou rótulo da ficha não vale (fica em NÃO IDENTIFICADOS, VOCABULARIO_AUSENTE): pasta de fornecedor errada é pior.
 */
const ROTULO_DA_FICHA = /\b(AGENCIA|CODIGO|NOSSO|NUMERO|DOCUMENTO|ESPECIE|QUANTIDADE|CARTEIRA|VENCIMENTO|VALOR|LOCAL|PAGAMENTO|PAGADOR|SACADO|SACADOR|AVALISTA|BENEFICIARIO|CEDENTE|ENDERECO|DATA|INSTRUCOES|RECIBO|AUTENTICACAO|MECANICA|COBRANCA|DESCONTO|JUROS|MULTA|ACRESCIMOS|DEDUCOES|USO|BANCO|ACEITE|PROCESSAMENTO|CPF|CNPJ)\b/;
const ENDERECO = /\b(RUA|AV|AVENIDA|ESTRADA|QUADRA|QD|LOTE|SALA|BLOCO|CONJ|CEP|BAIRRO|ROD|RODOVIA|TRAVESSA|PRACA|KM|ZONA|S\s?N)\b|[ /-](AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
function nomeDeBeneficiarioValido(t) {
  const n = String(t || '').replace(/[\s:—–-]+$/g, '').replace(/^[\s:—–-]+/g, '').trim();
  if (!/^[A-Z][A-Z &.,'\/-]{3,90}$/.test(n) || !/[A-Z]{3}/.test(n) || ROTULO_DA_FICHA.test(n) || ENDERECO.test(n) || /\bNAO (DISPONIVEL|INFORMADO)\b/.test(n)) return null;
  return nomeSeguro(semAcento(nomeNormalizado(n))).toUpperCase() || null;
}
function beneficiariosDoBoleto(u) {
  const out = [];
  for (const m of u.matchAll(/(?:^|\n)([^\n]*?)\s*-?\s*\b(?:CPF\s*\/\s*CNPJ|CNPJ\s*\/\s*CPF|CNPJ|CPF)\s*:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/g)) {
    let bruto1 = m[1];
    // o nome quebrado em duas linhas ("CONSELHO REGIONAL DE ENGENHARIA E\nAGRONOMIA DE MINAS GERAIS\nCNPJ: …")
    const antesDaLinha = m.index > 0 && m[0][0] === '\n' ? u.slice(0, m.index).split('\n').pop() : null;
    if (antesDaLinha && /\b(E|DE|DA|DO|DOS|DAS|&)$/.test(antesDaLinha.trim()) && nomeDeBeneficiarioValido(antesDaLinha)) bruto1 = antesDaLinha.trim() + ' ' + bruto1;
    const nome = nomeDeBeneficiarioValido(bruto1.replace(/^.*\b(?:SACADOR\s*\/\s*AVALISTA|SACADO\s*\/\s*PAGADOR|PAGADOR|SACADO|BENEFICIARIO|CEDENTE)\b\s*:?/, ''));
    // o rótulo mais próximo antes (na mesma linha ou logo acima): "PAGADOR\nJANICELME DA SILVEIRA - CPF: …" é o pagador
    const rots = [...u.slice(Math.max(0, m.index - 80), m.index + m[0].length).matchAll(/\b(SACADOR|AVALISTA|PAGADOR|SACADO|BENEFICIARIO|CEDENTE)\b/g)];
    const rotulo = rots.length && /^(SACADOR|AVALISTA|PAGADOR|SACADO)$/.test(rots[rots.length - 1][1]) ? 'pagador' : null;
    if (nome) out.push({ nome, rotulo, doc: so(m[2]) });
  }
  for (const m of u.matchAll(/(?:^|\n)[^\n]{0,20}(?:BENEFICIARIO|CEDENTE)[^\n]{0,60}\n([^\n]+)/g)) {
    const corte = /^(.*?\b(?:LTDA|EIRELI|S\.?\/?A|EPP|ME))(?![A-Z])/.exec(m[1].replace(/\s*(?:R\$|\d).*$/, '').trim()) || /^(.*?\b(?:LTDA|EIRELI|EPP))/.exec(m[1]);
    const nome = corte && nomeDeBeneficiarioValido(corte[1]);
    if (nome) out.push({ nome, rotulo: 'beneficiario' });
  }
  return out;
}
function decidirBoleto(campos, entrada, u, bruto, ctx, ev, porHash) {
  const cad = ctx.cadastro;
  const base = { tipo: 'BOLETO FORNECEDOR', setor: 'CONTABIL', fonte: '04 (Pag. Fornecedores — Fatura; competência = mês do vencimento)' };
  ev.push('boleto: ficha de compensação (linha digitável, beneficiário e pagador)');
  const doBenef = clientesDoRotulo(bruto, cad, /^(BENEFICIARIO|CEDENTE)$/);
  let c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : null;
  if (!c) { const p = pagadorDoComprovante(bruto, cad); if (p != null && !doBenef.has(p)) { c = { cliente: p, conf: 0.95, como: 'doc' }; ev.push('cliente pelo CNPJ/CPF do pagador (sacado)'); } }
  if (!c) {
    // a pasta de origem (e, na pasta que junta matriz e filiais, a filial do CNPJ no conteúdo, senão a matriz), como no
    // pagamento de fornecedor (27/10/2026); nunca quando ela é a do beneficiário
    const evp = [];
    const r = clienteDoPagamento(entrada.rel || entrada.nome, bruto, cad, evp, null, false);
    if (r.c && !doBenef.has(r.c.cliente)) { c = r.c; ev.push.apply(ev, evp.map(x => 'cliente: ' + x)); }
  }
  if (!c) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: doBenef.size ? 'TIPO_NAO_RECONHECIDO' : 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, evidencias: ev.concat(doBenef.size ? 'o cliente ' + [...doBenef].join(', ') + ' é o beneficiário: boleto a receber, sem regra' : 'nem o pagador nem a pasta de origem dizem o cliente') });
  Object.assign(base, { cliente: c.cliente, comoCliente: c.como });
  // o fornecedor: o primeiro beneficiário lido que não é o pagador nem o próprio cliente
  const cli = cad.porCod.get(c.cliente);
  const ehCliente = n => cli && [cli.razao].concat(cli.outrosNomes || []).some(r => chaveNome(nomeNormalizado(r)) === chaveNome(n) || chaveNome(r).startsWith(chaveNome(n)));
  // (o nome colado no CPF/CNPJ do próprio cliente é a linha do pagador: "PEDRO JORGE SANTOS\nSOUZA\nCPF: 595…")
  const benef = (campos.beneficiarios || []).find(b => b.rotulo !== 'pagador' && !ehCliente(b.nome) && !(b.doc && clientesDoDoc(b.doc, cad).includes(c.cliente)));
  campos.fornecedor = benef ? benef.nome : null;
  if (!campos.fornecedor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('o beneficiário do boleto não foi lido (04: Fornecedores)') });
  if (!campos.valor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VALOR_AUSENTE', confianca: 0.5 });
  if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('o vencimento do boleto não foi lido') });
  const comp = campos.competencia;
  const ext = (/\.[a-z0-9]+$/i.exec(entrada.nome) || ['.pdf'])[0].toLowerCase();
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: comp, caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(comp.ano), dois(comp.mes), campos.fornecedor], nomeFinal: 'Fatura_' + campos.fornecedor + '_' + campos.valor + '_' + mesAno(comp) + ext });
}
/** O beneficiário de um comprovante de pagamento (o "Nome/Razão Social" depois de Beneficiário/Cedente, o Favorecido, o Convênio), como nome de pasta. */
function beneficiarioDoComprovante(u) {
  const limpa = s => {
    const t = String(s || '').replace(/\(?\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\)?/g, ' ').replace(/^[\s:—–-]+|[\s:—–-]+$/g, '').trim();
    return /[A-Z]{3}/.test(t) ? nomeSeguro(semAcento(nomeNormalizado(t))).toUpperCase() || null : null;
  };
  const i = u.search(/BENEFICIARIO|CEDENTE/);
  if (i >= 0) {
    // só o bloco do beneficiário: o "Nome/Razão Social" do Sacador Avalista e do Pagador logo abaixo não valem
    let bloco = u.slice(i, i + 500);
    const fim = bloco.slice(12).search(/\b(SACADOR|PAGADOR|SACADO)\b/);
    if (fim >= 0) bloco = bloco.slice(0, fim + 12);
    const m = /NOME\s*\/\s*RAZAO\s*SOCIAL\s*:?[ \t]*([^\n]+)/.exec(bloco);
    if (m && limpa(m[1])) return limpa(m[1]);
  }
  for (const re of [/\b(?:BENEFICIARIO|FAVORECIDO|CEDENTE)\s*:[ \t]*([^\n]+)/, /\bCONVENIO\s*:?[ \t]*(?:\d+[ \t]+)?([A-Z][^\n]*)/]) { const m = re.exec(u); if (m && limpa(m[1])) return limpa(m[1]); }
  return null;
}
/** A data do pagamento (efetivação, pagamento, débito, transferência) → "DD-MM-AAAA" ou null; e o valor pago como impresso ("1.400,00"). */
function dataDoPagamento(u) {
  for (const r of [/DATA DE EFETIVACAO/, /DATA DO PAGAMENTO/, /DATA DO DEBITO/, /DATA DA TRANSFERENCIA/]) { const d = dataBr(linhaApos(u, r, 60)); if (d) return d; }
  return null;
}
function valorPago(u) {
  const m = /VALOR PAGO[^0-9\n]{0,15}(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(u) || /VALOR (?:TOTAL|DO DEBITO)[^0-9\n]{0,15}(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(u);
  return m ? m[1] : null;
}

/**
 * A imagem escaneada (27/10/2026, Vitor: os "Imagem (10).jpg" do Posto Berizal, lidos por OCR no arquivador-novo.js): o
 * "Comprovante de Pagamento" (Gerenciador CAIXA) vai para CONTÁBIL\PAGAMENTOS DE FORNECEDORES\[ANO]\[MÊS]\[BENEFICIÁRIO]\ do
 * cliente pagador (o CNPJ do pagador, senão a pasta de origem), com o nome "DD-MM-AAAA BENEFICIÁRIO R$ VALOR.jpg" (a data da
 * efetivação, o valor pago). Outra imagem segue sem regra, como antes.
 */
function decidirImagem(entrada, ctx, ev, porHash) {
  const nome = String(entrada.nome || '');
  const ext = ((/\.[a-z0-9]+$/i.exec(nome) || ['.jpg'])[0]).toLowerCase();
  const bruto = Array.isArray(entrada.texto) ? entrada.texto.join('\n') : String(entrada.texto || '');
  const u = norm(bruto);
  const semRegra = () => (porHash ? { acao: 'NAO_IDENTIFICADO', motivo: 'HASH_CONFIRMADO_SEM_REGRA_DE_DESTINO', confianca: 0.5, cliente: porHash }
    : { acao: 'NAO_IDENTIFICADO', motivo: u.replace(/\s/g, '').length < 40 ? 'FORMATO_SEM_REGRA' : 'TIPO_NAO_RECONHECIDO', confianca: 0, evidencias: ev.concat(u.replace(/\s/g, '').length < 40 ? 'imagem sem texto lido (OCR) e sem regra determinística' : 'imagem lida por OCR, mas não é comprovante de pagamento') });
  if (!/COMPROVANTE DE PAGAMENTO/.test(u) && /BENEFICIARIO|CEDENTE/.test(u) && /VENCIMENTO/.test(u) && /PAGADOR|SACADO/.test(u)) {
    // a foto do boleto, não o comprovante (Vitor, 28/10/2026: as "Imagem (n).jpg" do Berizal, "BOLETO NF2685 SBVC R$504,36.jpg"):
    // PAGAMENTOS DE FORNECEDORES\ANO\MÊS (do vencimento)\[BENEFICIÁRIO]\"DD-MM-AAAA BENEFICIÁRIO R$ VALOR - BOLETO.jpg"; sem os três, NI
    const cb = camposDoBoleto(u);
    const b = decidirBoleto(cb, entrada, u, bruto, ctx, ev, porHash);
    if (b.acao !== 'ARQUIVAR') return b;
    const venc = cb.vencimento, valor = String(cb.valor || '').replace(/^R\$\s*/, '');
    return Object.assign(b, { nomeFinal: venc + ' ' + cb.fornecedor + ' R$ ' + valor + ' - BOLETO' + ext, fonte: 'foto do boleto pelo OCR (Vitor, 28/10/2026); 04 (Pag. Fornecedores)' });
  }
  if (!/COMPROVANTE DE PAGAMENTO/.test(u)) return semRegra();
  const base = { tipo: 'COMPROVANTE FORNECEDOR', setor: 'CONTABIL', fonte: 'comprovante de pagamento escaneado (Vitor, 27/10/2026); 04 (Pag. Fornecedores)' };
  ev.push('imagem: comprovante de pagamento (texto por OCR)');
  const r = clienteDoPagamento(entrada.rel || nome, bruto, ctx.cadastro, ev, porHash, true);
  if (r.erro) return Object.assign(base, r.erro);
  Object.assign(base, { cliente: r.c.cliente, comoCliente: r.c.como });
  const benef = beneficiarioDoComprovante(u), data = dataDoPagamento(u), valor = valorPago(u);
  if (!benef) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('o beneficiário do pagamento não foi lido') });
  if (!data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('a data de efetivação/pagamento não foi lida') });
  if (!valor) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VALOR_AUSENTE', confianca: 0.5, evidencias: ev.concat('o valor pago não foi lido') });
  const comp = { mes: +data.slice(3, 5), ano: +data.slice(6) };
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: r.c.conf, competencia: comp, caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(comp.ano), dois(comp.mes), benef], nomeFinal: data + ' ' + benef + ' R$ ' + valor + ext });
}

/**
 * O comprovante exportado do internet banking com o nome "N - DDMMAAAA - Pagamento - V.pdf" (27/10/2026, Vitor: os do Posto
 * Berizal): PAGAMENTOS DE FORNECEDORES\[ANO]\[MÊS]\[BENEFICIÁRIO]\, o nome original; o mês e o ano pela data do nome; o
 * beneficiário pelo conteúdo (o texto, ou o OCR do escaneado); o cliente pelo CNPJ do pagador, senão pela pasta de origem.
 * Só quando o conteúdo não decidiu (o PDF não vira outra coisa que já se arquivava).
 */
const NOME_PAGAMENTO_BANCO = /^\d+ - (\d{2})(\d{2})(\d{4}) - Pagamento - [\d.]+,\d{2}\.pdf$/i;
function decidirPagamentoPdf(entrada, u, bruto, ctx, ev, porHash) {
  const m = NOME_PAGAMENTO_BANCO.exec(String(entrada.nome || ''));
  if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12 || !anoOk(+m[3])) return null;
  const base = { tipo: 'COMPROVANTE FORNECEDOR', setor: 'CONTABIL', fonte: 'comprovante de pagamento do banco (Vitor, 27/10/2026); 04 (Pag. Fornecedores)' };
  ev.push('comprovante de pagamento pelo nome "N - DDMMAAAA - Pagamento - V" (o mês pela data do nome)');
  const r = clienteDoPagamento(entrada.rel || entrada.nome, bruto, ctx.cadastro, ev, porHash, true);
  if (r.erro) return Object.assign(base, r.erro);
  Object.assign(base, { cliente: r.c.cliente, comoCliente: r.c.como });
  const benef = beneficiarioDoComprovante(u);
  if (!benef) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('o beneficiário (convênio, favorecido, cedente) não foi lido no conteúdo') });
  const comp = { mes: +m[2], ano: +m[3] };
  return Object.assign(base, { acao: 'ARQUIVAR', confianca: r.c.conf, competencia: comp, caminho: ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', String(comp.ano), dois(comp.mes), benef], nomeFinal: entrada.nome });
}

/**
 * O PDF da nota cuja chave está no índice com o XML já arquivado (27/10/2026, Vitor: ~3.900 da HELLO NUTRITION, Torra Torra,
 * Fito, Antonia's, 463): vai para a MESMA pasta do XML, com o MESMO nome do XML e a extensão .pdf (o XML em mais de um cliente,
 * como a nota entre clientes: o PDF em todos). A chave pelo nome do arquivo (44 dígitos; a NFS-e nacional, 50) e pelo
 * conteúdo. O nome do XML sai da chave como o classificarXml o monta ("MM-AAAA_NF-e_<nº>.xml": o mês/ano de emissão, o
 * modelo e o número estão na chave). O evento ("…-procEventoNFe.pdf") não entra: o índice não guarda o nome do XML do evento.
 */
function nfseNacionalValida(ch) {
  if (!/^\d{50}$/.test(ch) || !/^(0[1-9]|1[0-2])$/.test(ch.slice(38, 40))) return false;
  return ch[8] === '2' ? cnpjValido(ch.slice(9, 23)) : ch[8] === '1' ? cpfValido(ch.slice(12, 23)) : false;
}
function chavesDoPdf(nome, u) {
  const K = require('./arquivador-chaves');
  const out = [];
  for (const m of String(nome || '').matchAll(/(?<!\d)(\d{44})(?!\d)/g)) if (K.chaveValida(m[1])) out.push(m[1]);
  for (const m of String(nome || '').matchAll(/(?<!\d)(\d{50})(?!\d)/g)) if (nfseNacionalValida(m[1])) out.push(m[1]);
  const ch = (/(?<!\d)(\d{4}(?: ?\d{4}){10})(?!\d)/.exec(u) || [])[1];
  if (ch && K.chaveValida(so(ch))) out.push(so(ch));
  const n50 = /CHAVE\s*DE\s*ACESSO\s*DA\s*NFS-?E\s*(\d{50})/.exec(u);
  if (n50 && nfseNacionalValida(n50[1])) out.push(n50[1]);
  return [...new Set(out)];
}
function xmlDaChave(ch) {
  if (ch.length === 50) { const comp = { mes: +ch.slice(38, 40), ano: 2000 + +ch.slice(36, 38) }; return { tipo: 'NFS-e', comp, nome: mesAno(comp) + '_NFS-e_' + (+ch.slice(23, 36)) }; }
  const t = { 55: 'NF-e', 65: 'NFC-e', 57: 'CT-e', 67: 'CT-e OS' }[ch.slice(20, 22)];
  if (!t) return null;
  const comp = { mes: +ch.slice(4, 6), ano: 2000 + +ch.slice(2, 4) };
  return { tipo: t === 'CT-e OS' ? 'CT-e' : t, comp, nome: mesAno(comp) + '_' + t + '_' + (+ch.slice(25, 34)) };
}
function pdfPeloXmlDaChave(entrada, u, ctx, ev) {
  if (!ctx.chaves || typeof ctx.chaves.achar !== 'function') return null;
  const nome = String(entrada.nome || '');
  if (/EVENTO/i.test(nome) || /(?<!\d)\d{52}(?!\d)/.test(nome) || /\bEVENTO\b|CANCELAMENTO DE NF-?E|CARTA DE CORRECAO/.test(u.slice(0, 400))) return null;
  const cad = ctx.cadastro;
  for (const ch of chavesDoPdf(nome, u)) {
    const x = xmlDaChave(ch);
    if (!x) continue;
    const orig = ctx.chaves.achar(ch).filter(o => o.de === 'doc' && o.sub && o.sub.length && cad.porCod.has(o.cliente));
    if (!orig.length) continue;
    // o cliente da pasta de origem primeiro (o PDF costuma estar na pasta de um deles)
    const sub = clienteDaPasta(entrada.rel || nome, cad);
    if (sub) orig.sort((a, b) => (b.cliente === sub.codigo) - (a.cliente === sub.codigo));
    ev.push('chave ' + ch + ': o XML está arquivado em ' + orig.map(o => o.cliente + ' (' + o.sub.join('\\') + ')').join(', ') + '; o PDF vai ao lado, com o nome do XML');
    return { acao: 'ARQUIVAR', cliente: orig[0].cliente, comoCliente: 'chave', confianca: 0.95, copias: orig.slice(1).map(o => ({ cliente: o.cliente, comoCliente: 'chave', caminho: o.sub })),
      tipo: x.tipo + ' PDF', setor: 'FISCAL', caminho: orig[0].sub, nomeFinal: x.nome + '.pdf', chave: ch, competencia: x.comp, fonte: 'índice de chaves: o PDF ao lado do XML (Vitor, 27/10/2026)' };
  }
  return null;
}

/** O PDF que o conteúdo não decidiu (27/10/2026): a nota pelo XML da mesma chave; o comprovante "N - DDMMAAAA - Pagamento". */
function pdfSemDecisao(d, entrada, ctx, ev, porHash) {
  if (!d || d.acao !== 'NAO_IDENTIFICADO' || d.motivo === 'PDF_COMPOSTO_NAO_SEPARADO') return d;
  const paginas = Array.isArray(entrada.texto) ? entrada.texto : [String(entrada.texto || '')];
  const bruto = paginas.slice(0, 3).join('\n');
  const u = norm(bruto);
  const ev2 = ev.concat('o conteúdo não decidiu (' + d.motivo + ')');
  const n = pdfPeloXmlDaChave(entrada, u, ctx, ev2) || decidirPagamentoPdf(entrada, u, bruto, ctx, ev2, porHash);
  return n ? Object.assign({ evidencias: ev2 }, n) : d;
}

/**
 * O pacote de transmissão do Sintegra (TED, "02CL_PADRAO CONV57/95 …" + o conteúdo comprimido no formato da SEFAZ; não abre
 * como zip). 27/10/2026 (Vitor): 05. SINTEGRA, "MM-AAAA - TRANSMISSAO.zip" (ao lado do "MM-AAAA.txt"), sem abrir; o cliente
 * pela pasta de origem ("0010 - DORNAS …\DEPARTAMENTO FISCAL\SINTEGRA\2026\02-2026.zip") e a competência pelo nome ou pela pasta.
 */
function decidirTedSintegra(entrada, ctx, ev) {
  const rel = entrada.rel || entrada.nome;
  const base = { tipo: 'SINTEGRA', setor: 'FISCAL', fonte: 'Sintegra, pacote de transmissão (Vitor, 27/10/2026); 05a (Sintegra)' };
  ev.push('pacote de transmissão do Sintegra (TED): o cabeçalho "02CL_PADRAO", sem abrir');
  const sub = clienteDaPasta(rel, ctx.cadastro);
  if (!sub) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, evidencias: ev.concat('a pasta de origem não diz o cliente (o pacote não traz o CNPJ legível)') });
  ev.push(sub.como);
  const pasta = anoDaPasta(rel) || competenciaDaPasta(rel);
  const comp = competenciaDoNome(entrada.nome) || (pasta && pasta.mes ? { mes: pasta.mes, ano: pasta.ano } : null);
  if (!comp) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, cliente: sub.codigo, evidencias: ev.concat('sem o MM-AAAA no nome nem o mês na pasta de origem') });
  return Object.assign(base, { acao: 'ARQUIVAR', cliente: sub.codigo, comoCliente: sub.forte ? 'pastaConferida' : 'pasta', confianca: 0.9, competencia: comp, fiscal: ['SINTEGRA'], nomeFinal: mesAno(comp) + ' - TRANSMISSAO.zip' });
}

/**
 * O documento que vai inteiro para uma pasta só, com o nome original (pró-labore, declaração do ISS, declaração de inventário):
 * o cliente pelo CNPJ/CPF do documento (um cliente só), senão a pasta de origem (no grupo matriz/filiais, o código do nome ou a
 * matriz); a competência pelo nome ("JAN-2025", "04.2023"), senão a data do começo do nome, senão a pasta de origem.
 */
function decidirSimples(entrada, u, bruto, ctx, ev, porHash, o) {
  const cad = ctx.cadastro, nome = String(entrada.nome || '');
  const base = { tipo: o.tipo, setor: o.setor, fonte: o.tipo.toLowerCase() + ' (Vitor, 27/10/2026)' };
  let c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : null;
  if (!c) { const d = unico(documentosDoTexto(bruto).filter(x => !ESCRITORIO.has(x.doc)).flatMap(x => clientesDoDoc(x.doc, cad))); if (d != null) { c = { cliente: d, conf: 0.95, como: 'doc' }; ev.push('CNPJ/CPF do documento'); } }
  if (!c) c = clientePelaPastaOuGrupo(entrada.rel || nome, nome, cad, ev);
  if (!c) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3 });
  const dm = /^(\d{2})-(\d{2})-(20\d{2})\s/.exec(nome);
  const pasta = (r => (r && (o.mes ? r.mes : r.ano) ? r : null))(anoDaPasta(entrada.rel || '') || competenciaDaPasta(entrada.rel || ''));
  const a = /(?:^|[^0-9])(20\d{2})(?![0-9])/.exec(nome.replace(/\.[a-z0-9]+$/i, ''));
  const comp = competenciaDoNome(nome) || (dm ? { mes: +dm[2], ano: +dm[3] } : null) || (pasta && (o.mes ? pasta.mes : true) ? { mes: pasta.mes, ano: pasta.ano } : null) || (!o.mes && a ? { ano: +a[1] } : null);
  if (!comp || (o.mes && !comp.mes)) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, cliente: c.cliente, evidencias: ev.concat('o mês não foi lido no nome nem na pasta de origem') });
  const out = Object.assign(base, { acao: 'ARQUIVAR', cliente: c.cliente, comoCliente: c.como, confianca: c.conf, competencia: o.mes ? { mes: comp.mes, ano: comp.ano } : { ano: comp.ano }, nomeFinal: nome });
  if (o.fiscal) out.fiscal = o.fiscal; else out.caminho = o.caminho(comp);
  return out;
}
function decidirPdf(entrada, ctx, ev, porHash) {
  const paginas = Array.isArray(entrada.texto) ? entrada.texto : [String(entrada.texto || '')];
  const bruto = paginas.slice(0, 3).join('\n');
  const u = norm(bruto);
  // 27/10/2026 (Vitor): o pagamento de fornecedor vale pelo nome e pela pasta de origem, mesmo sem texto (escaneado)
  // o pró-labore (Vitor, 27/10/2026): DEPARTAMENTO PESSOAL\MM\PRÓ-LABORE\, nome original — antes do pagamento de fornecedor
  if (/\bPRO\s?-?\s?LABORE|PROLABORE/.test(norm(entrada.nome))) return decidirSimples(entrada, u, bruto, ctx, ev, porHash, { tipo: 'PRO-LABORE', setor: 'FOLHA_SOCIETARIO', mes: true, caminho: comp => ['DEPARTAMENTO PESSOAL', dois(comp.mes), 'PRÓ-LABORE'] });
  // a declaração municipal do ISS (DEISS de Montes Claros, DES de BH; Vitor, 27/10/2026): <regime>\DAM\DECLARAÇÕES\, nome original
  if (/\bDEISS\b|\bDES\s*-?\s*BH\b/.test(norm(entrada.rel || entrada.nome))) return decidirSimples(entrada, u, bruto, ctx, ev, porHash, { tipo: 'DECLARACAO ISS', setor: 'FISCAL', mes: true, fiscal: ['DAM', 'DECLARAÇÕES'] });
  // a declaração de inventário (Vitor, 27/10/2026): CONTÁBIL\PAPÉIS DE TRABALHO\ANO\, nome original
  if (/DECLARA[CÇ][AÃ]O DE INVENT[AÁ]RIO/.test(norm(entrada.nome))) return decidirSimples(entrada, u, bruto, ctx, ev, porHash, { tipo: 'PAPEL DE TRABALHO', setor: 'CONTABIL', mes: false, caminho: comp => ['CONTÁBIL', 'PAPÉIS DE TRABALHO', String(comp.ano)] });
  const pg = pagamentoDeFornecedor(entrada);
  // a nota sem data no nome cujo XML da chave está arquivado continua ao lado do XML (o 2º lote do Vitor)
  if (pg && pg.semData) { const ev2 = ev.slice(); const px = pdfPeloXmlDaChave(entrada, u, ctx, ev2); if (px) return Object.assign({ evidencias: ev2 }, px); }
  if (pg) return decidirFornecedor(pg, entrada, u, bruto, ctx, ev, porHash);
  if (u.replace(/\s/g, '').length < 40) return { acao: 'NAO_IDENTIFICADO', motivo: 'CONTEUDO_SEM_TEXTO', confianca: 0, tipo: 'PDF', evidencias: ev.concat('PDF sem camada de texto (escaneado): sem OCR, o robô não lê; a rotina antiga lia a imagem (Dicionário §12)'), cliente: porHash || null };
  // Santander: título, competência e titular costumam estar na página 2 (Dicionário §6.1.2) — já está em `bruto`
  let regra = REGRAS_PDF.find(r => r.re.test(u));
  // a inscrição estadual pelo nome do arquivo ("Inscrição Estadual Brazilian IE 35612260253.pdf"), quando o conteúdo não diz outro tipo
  if (!regra && /INSCRI[CÇ][AÃ]O ESTADUAL|\bINSC\.? ESTADUAL\b/i.test(norm(entrada.nome))) regra = REGRAS_PDF.find(r => r.tipo === 'INSCRICAO ESTADUAL');
  // a provisão anual de impostos do sistema do escritório ("358Prov2025.pdf", "524 Prov. imposto 2025.pdf"): 04, papel de trabalho
  // anual em REGISTRO DE LIVROS\(001) [ANO]\ junto do balancete, nome original (27/10/2026: 23 em NÃO IDENTIFICADOS)
  if (!regra && /^\d{0,4}\s*PROV\.?\s*(IMPOSTOS?)?\s*20\d{2}\b/.test(norm(entrada.nome).replace(/\.[A-Z]{3,4}$/, ''))) regra = REGRAS_PDF.find(r => r.tipo === 'BALANCETE');
  // a DRE ("292DRE03.2025.pdf", "DRE _2025.pdf"; Vitor, 27/10/2026): REGISTRO DE LIVROS\(001) ANO\, como o balancete, nome original
  if (!regra && (/(?:^|[^A-Z])DRE(?:[^A-Z]|$)/.test(norm(entrada.nome)) || /DEMONSTRA[CÇ]AO D[OE]S? RESULTADOS? DO EXERCICIO/.test(u.slice(0, 800)))) regra = REGRAS_PDF.find(r => r.tipo === 'BALANCETE');
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
    // as notas juntas num PDF só (Vitor, 28/10/2026: os "00009250001-BRAZIL E AMORIM SUPERMERCADOS LTDA.pdf" da Fito): ARQUIVAR INTEIRO
    // na pasta das notas do mês (a da 1ª nota: EMITIDOS ou RECEBIDOS), nome original, sem separar as páginas
    if (titulos > 2 && /^(NF-e|NFC-e|CT-e|NFS-e) PDF$/.test(regra.tipo) && !entrada.primeiraDoComposto) {
      const d1 = decidirPdf(Object.assign({}, entrada, { texto: [paginas[0]], primeiraDoComposto: true }), ctx, ev, porHash);
      if (d1 && d1.acao === 'ARQUIVAR') return Object.assign(d1, { nomeFinal: entrada.nome, evidencias: (d1.evidencias || ev).concat(titulos + ' notas num PDF só: arquivado inteiro pela 1ª, nome original (Vitor, 28/10/2026)') });
    }
    if (titulos > 2 || (regra.tipo.startsWith('DA') && venc.size > 1)) return { acao: 'FICA', motivo: 'PDF_COMPOSTO_NAO_SEPARADO', confianca: 0.5, tipo: regra.tipo, setor: regra.setor, evidencias: ev.concat(titulos + ' páginas com o título ' + regra.tipo + ': o robô não separa PDF (02-SEPARADOR)') };
  }
  if (regra.tipo === 'COMPROVANTE' && campos.pareceExtrato) {
    // Dicionário §6.1.1: "Comprovante" com várias transações e saldo é extrato
    const r2 = REGRAS_PDF.find(r => r.tipo === 'EXTRATO');
    ev.push('§6.1.1: título "Comprovante" com saldo corrente → extrato');
    return montarContabil(r2, r2.campos(u), u, bruto, entrada, ctx, ev, porHash);
  }
  if (regra.tipo === 'BOLETO FORNECEDOR') return decidirBoleto(campos, entrada, u, bruto, ctx, ev, porHash);
  if (regra.setor === 'CONTABIL') return montarContabil(regra, campos, u, bruto, entrada, ctx, ev, porHash);
  // o relatório da DEFIS do Alterdata (27/10/2026): o cliente é o do "CNPJ Matriz" (as filiais da declaração vêm depois)
  let doMatriz = null;
  if (!porHash && regra.tipo === 'DEFIS ALTERDATA' && campos.cnpjMatriz) {
    const m = unico(clientesDoDoc(campos.cnpjMatriz, ctx.cadastro));
    if (m == null) return { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO', confianca: 0.3, tipo: regra.tipo, setor: regra.setor, evidencias: ev.concat('o CNPJ Matriz ' + campos.cnpjMatriz + ' não é de um cliente só do cadastro') };
    doMatriz = { cliente: m, conf: 0.96, como: 'doc' };
    ev.push('cliente pelo CNPJ Matriz do relatório');
  }
  // a NFS-e emitida pelo escritório (honorários) em PDF (27/10/2026): como o XML (21/10/2026), na pasta do escritório E uma
  // cópia na do tomador (montarNfsePdf); o CNPJ do escritório nunca é o cliente pelo caminho comum
  if (!porHash && regra.tipo === 'NFS-e PDF') {
    const { prestador } = papeisDaNfse(u, documentosDoTexto(bruto));
    if (prestador && ESCRITORIO.has(prestador) && ctx.cadastro.porDoc.has(prestador)) { doMatriz = { cliente: [...ctx.cadastro.porDoc.get(prestador)][0], conf: 0.97, como: 'doc' }; ev.push('NFS-e emitida pelo escritório: na pasta dele e uma cópia na do tomador'); }
  }
  const c = porHash ? { cliente: porHash, conf: 0.97, como: 'hash' } : doMatriz || (regra.tipo === 'RELATORIO DE NOTAS' && clienteDoRelatorio(u, entrada, ctx, ev)) || clienteDoPdf(u, bruto, entrada, ctx, ev, regra, campos);
  if (!c.cliente) return { acao: 'NAO_IDENTIFICADO', motivo: c.motivo, confianca: 0.3, tipo: regra.tipo, setor: regra.setor, contaAmbigua: c.contaAmbigua || undefined, candidatos: c.contaAmbigua ? c.candidatos : undefined, evidencias: ev.concat(c.candidatos ? 'candidatos ' + c.candidatos.join(', ') : []) };
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
    case 'PGDAS-D': {
      // 27/10/2026 (Vitor): FISCAL\SIMPLES NACIONAL\01. DAS\MM-AAAA - PGDAS-D DECLARACAO|RECIBO|EXTRATO.pdf, a competência é o
      // período de apuração (não é declaração anual); o regime é o do cadastro (fora do Simples: o que a árvore faz com o DAS)
      // sem o PA no conteúdo: o do nome do arquivo (o número da declaração "03238183202106001" = CNPJ básico + AAAA + MM +
      // seq; ou "REF. 10.2024", "02-2023")
      if (!campos.competencia) {
        const n = String(nomeOrig || '');
        const m = /(?<!\d)\d{8}(20\d{2})(0[1-9]|1[0-2])\d{3}(?!\d)/.exec(n), r = /(?:REF\.?\s*|\b)(0[1-9]|1[0-2])[.\-\/](20\d{2})\b/i.exec(n);
        if (m) campos.competencia = { mes: +m[2], ano: +m[1] }; else if (r) campos.competencia = { mes: +r[1], ano: +r[2] };
        if (campos.competencia) ev.push('período de apuração pelo nome do arquivo');
      }
      if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('período de apuração do PGDAS-D não lido') });
      let doc = campos.docs.length === 1 ? campos.docs[0] : null;
      if (!doc) { const n = norm(nomeOrig); const pn = campos.docs.filter(x => n.includes(x)); if (pn.length === 1) { doc = pn[0]; ev.push('o nome do arquivo desempata: ' + doc); } }
      if (!doc) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('o conteúdo traz ' + campos.docs.join(' e ') + ' do PGDAS-D e o nome do arquivo não desempata') });
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, fiscal: ['DAS'], nomeFinal: mesAno(campos.competencia) + ' - PGDAS-D ' + doc + '.pdf' });
    }
    case 'DEFIS ALTERDATA': {
      // 27/10/2026 (Vitor): 14. DEFIS\AAAA - DEFIS ALTERDATA.pdf (AAAA = ano-calendário), na raiz do ano da entrega: o da emissão
      // do relatório, senão o ano-calendário + 1 (ANUAIS); a DEFIS do portal continua "AAAA - DEFIS.pdf"
      if (!campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('ano-calendário do relatório não lido') });
      if (campos.anoEmissao && campos.anoEmissao >= campos.ano) ev.push('o ano da entrega pela emissão do relatório (' + campos.anoEmissao + ')');
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, caminho: ['FISCAL', 'SIMPLES NACIONAL', '14. DEFIS'], nomeFinal: campos.ano + ' - DEFIS ALTERDATA.pdf', competencia: { ano: campos.ano } }, campos.anoEmissao ? { anoEntrega: campos.anoEmissao } : {});
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
    case 'NFS-e PDF': {
      if (!campos.lidoAntes) { const ev2 = ev.slice(); const px = pdfPeloXmlDaChave(entrada, u, ctx, ev2); if (px) return Object.assign({ evidencias: ev2 }, px); }
      return montarNfsePdf(campos, u, bruto, base, c, ctx, ev);
    }
    case 'RELATORIO DE NOTAS': {
      const p = campos.periodo;
      if (!p || p.de.mes !== p.ate.mes || p.de.ano !== p.ate.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('relatório de notas sem período de um mês') });
      const comp = { mes: p.ate.mes, ano: p.ate.ano };
      const cli = ctx.cadastro.porCod.get(c.cliente);
      const lado = campos.recebidas ? 'RECEBIDOS' : 'EMITIDOS';
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, 0.95), competencia: comp, fiscal: ['DOCS', lado, 'RELATÓRIO MENSAL', String(comp.ano)], nomeFinal: mesAno(comp) + ' - RELATORIO NOTAS ' + (campos.recebidas ? 'RECEBIDAS' : 'EMITIDAS') + ' - ' + nomeNormalizado(cli ? cli.razao : '') + '.pdf' });
    }
    case 'DP FUNCIONARIO': {
      // o sistema do DP nomeia o arquivo "<CPF do funcionário><NOME>.pdf" (27/10/2026, "04034148659ELIECIO SOARES DA COSTA.pdf"):
      // vale o nome quando o CPF confere (dígito) e o nome está escrito no documento
      if (!campos.nome) {
        const pn = /^(\d{11})\s*-?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{4,80})\.pdf$/i.exec(String(nomeOrig || ''));
        const nn = pn && norm(pn[2]).replace(/\s+/g, ' ').trim();
        if (pn && cpfValido(pn[1]) && nn.split(' ').length >= 2 && textoDeNome(u).includes(' ' + nn + ' ')) { campos.nome = nn; ev.push('nome do funcionário pelo nome do arquivo (CPF + nome), também escrito no documento'); }
      }
      if (!campos.nome) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, tipo: 'DP FUNCIONARIO ' + campos.doc, evidencias: ev.concat('nome do funcionário não lido no documento') });
      if (!campos.data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, tipo: 'DP FUNCIONARIO ' + campos.doc, evidencias: ev.concat('data do ' + campos.doc + ' não lida') });
      ev.push('funcionário: ' + campos.nome + ' · ' + campos.doc + ' de ' + campos.data);
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: Math.min(c.conf, 0.95), tipo: 'DP FUNCIONARIO ' + campos.doc, competencia: { mes: +campos.data.slice(3, 5), ano: +campos.data.slice(6) }, caminho: ['DEPARTAMENTO PESSOAL', 'FUNCIONÁRIOS', campos.nome], nomeFinal: campos.doc + ' ' + campos.data.replace(/\//g, '-') + '.pdf' });
    }
    case 'CARTAO CNPJ': case 'DOC CONSTITUTIVO': {
      // o ano (a raiz): o do registro na Junta; senão a data do nome ("_01112023", "10-01-2018", "2021"); senão a pasta de origem
      let ano = campos.ano || null;
      if (!ano) { const n = norm(String(nomeOrig || '').replace(/\.[a-z0-9]{2,4}$/i, '')); const m = /(?:^|[^0-9])\d{2}[-._ ]?\d{2}[-._ ]?(20\d{2})(?![0-9])/.exec(n) || /(?:^|[^0-9])(20\d{2})(?![0-9])/.exec(n); if (m) { ano = +m[1]; ev.push('ano pelo nome do arquivo'); } }
      else ev.push('ano pelo registro na Junta Comercial');
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, caminho: ['SOCIETÁRIO', 'DOCUMENTOS CONSTITUTIVOS'], nomeFinal: nomeOrig }, ano ? { competencia: { ano } } : {});
    }
    case 'INSCRICAO ESTADUAL':
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, caminho: ['SOCIETÁRIO', 'INSCRIÇÕES'], nomeFinal: nomeOrig }, campos.ano ? { competencia: { ano: campos.ano } } : {});
    case 'CERTIDAO':
      if (!campos.orgao || !campos.data) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: !campos.orgao ? 'EMITENTE_INDETERMINADO' : 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      // a raiz do ano (23/10/2026): o ano da data da certidão
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: /^\d{2}-\d{2}-\d{4}$/.test(campos.data) ? { mes: +campos.data.slice(3, 5), ano: +campos.data.slice(6) } : null, caminho: ['SOCIETÁRIO', 'CERTIDÕES', campos.orgao], nomeFinal: campos.data + '.pdf' });
    case 'RELATORIO ALTERDATA': {
      const cli = ctx.cadastro.porCod.get(c.cliente) || {};
      if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('o período do relatório não foi lido') });
      if (!cli.regime) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: cli.regime === undefined ? 'VOCABULARIO_AUSENTE' : 'REGIME_INDEFINIDO', confianca: 0.5 });
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, caminho: ['FISCAL', cli.regime, 'RELATÓRIOS ALTERDATA', String(campos.competencia.ano)], nomeFinal: nomeOrig });
    }
    case 'FOLHA':
      if (!campos.competencia) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5 });
      // 27/10/2026 (Vitor): <cliente>\DEPARTAMENTO PESSOAL\MM\FOLHA\, nome original (como o FGTS; era SOCIETÁRIO\FOLHA DE PAGAMENTO)
      return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: campos.competencia, caminho: ['DEPARTAMENTO PESSOAL', dois(campos.competencia.mes), 'FOLHA'], nomeFinal: nomeOrig });
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
  const { prestador, tomador } = papeisDaNfse(u, docs);
  if (!campos.numero) { const n = /(?:^|[^A-Z])N?F?S-?E\s*N?[º°O.]*\s*(\d{1,9})(?!\d)/i.exec(String(base.nomeArquivo || '').replace(/\.[a-z0-9]+$/i, '')); if (n) { campos.numero = String(+n[1]); ev.push('o número da NFS-e pelo nome do arquivo (o texto não traz)'); } }
  if (!campos.numero || !campos.emissao) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', confianca: 0.5, evidencias: ev.concat('nº ou data da NFS-e não lidos') });
  // emitida pelo escritório (27/10/2026): a cópia no tomador, como nota recebida (o isento, em CONTÁBIL\NOTAS DE SERVIÇO RECEBIDAS)
  const copias = [];
  if (prestador && ESCRITORIO.has(prestador) && tomador) {
    const t = unico(clientesDoDoc(tomador, cad).filter(x => x !== c.cliente));
    const ct = t != null ? cad.porCod.get(t) : null;
    const comp0 = campos.competencia || { mes: +campos.emissao.slice(3, 5), ano: +campos.emissao.slice(6) };
    if (ct) copias.push(ct.regime === 'ISENTA' ? { cliente: t, comoCliente: 'doc', caminho: ['CONTÁBIL', 'NOTAS DE SERVIÇO RECEBIDAS', String(comp0.ano), dois(comp0.mes)] } : { cliente: t, comoCliente: 'doc', fiscal: ['DOCS', 'RECEBIDOS'] });
  }
  if (copias.length) base.copias = copias;
  const cli = cad.porCod.get(c.cliente) || {};
  const emitida = prestador && (prestador === cli.doc || clientesDoDoc(prestador, cad).includes(c.cliente));
  let emissor = emitida ? cli.razao : null;
  if (!emissor && prestador) {
    const d = docs.find(x => x.doc === prestador);
    const depois = bruto.slice(d.pos, d.pos + 400).split('\n').map(s => s.trim());
    // "Razão Social: X" logo antes do CNPJ do prestador (o layout de Taiobeiras/Itaobim) vale primeiro
    const rsAntes = /RAZ[AÃ]O SOCIAL\s*:\s*([^\n]+)\n[^]{0,300}$/i.exec(bruto.slice(Math.max(0, d.pos - 300), d.pos));
    const ir = rsAntes ? -1 : depois.findIndex(s => /^(NOME|RAZAO|RAZÃO)/i.test(s));
    if (rsAntes) emissor = rsAntes[1].trim(); else
    // "Nome/ NomeEmpresarial" (o DANFSe nacional) é só o rótulo: o nome vem na linha de baixo
    emissor = ir < 0 ? null : /:/.test(depois[ir]) ? depois[ir].replace(/^[^:]*:\s*/, '') : (depois[ir + 1] || null);
    if (emissor && /^(NOME|RAZAO|RAZÃO|E-?MAIL|MUNIC)/i.test(emissor)) emissor = null;
    if (!emissor) { const antes = bruto.slice(Math.max(0, d.pos - 200), d.pos).split('\n').map(s => s.trim()).filter(s => /[A-Za-z]{3}/.test(s) && !/CNPJ|CPF|INSCRI|ENDERE|PRESTADOR|DADOS/i.test(s)); emissor = antes.pop() || null; }
    // a nota recebida: o emissor nunca é o próprio cliente (o tomador)
    if (emissor && cli.razao && chaveNome(nomeNormalizado(emissor)) === chaveNome(nomeNormalizado(cli.razao))) emissor = null;
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
  if (!c.cliente) return { acao: 'NAO_IDENTIFICADO', motivo: c.motivo, confianca: 0.3, tipo: regra.tipo, setor: 'CONTABIL', contaAmbigua: c.contaAmbigua || undefined, candidatos: c.contaAmbigua ? c.candidatos : undefined, evidencias: ev.concat(c.candidatos ? 'candidatos ' + c.candidatos.join(', ') : []) };
  const base = { cliente: c.cliente, comoCliente: c.como, setor: 'CONTABIL', tipo: regra.tipo, fonte: regra.fonte };
  if (regra.tipo === 'OPERACAO DE CAMBIO') {
    const mutuo = campos.mutuo || /\bMUTUO\b/.test(norm(entrada.nome));
    if (!campos.banco) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'BANCO_AUSENTE', confianca: 0.5, evidencias: ev.concat('a instituição do contrato de câmbio não foi lida') });
    if (!campos.numero || !campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'CONTRATO_SEM_NUMERO', confianca: 0.5, evidencias: ev.concat('o número ou a data do contrato de câmbio não foram lidos') });
    ev.push(mutuo ? 'contrato de câmbio de mútuo (empréstimo): Op. Crédito (Vitor, 27/10/2026)' : 'contrato de câmbio: Op. Câmbio (04)');
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, tipo: mutuo ? 'OPERACAO DE CREDITO' : 'OPERACAO DE CAMBIO', competencia: { ano: campos.ano }, caminho: mutuo ? ['CONTÁBIL', 'OPERAÇÕES DE CRÉDITO', String(campos.ano), 'EMPRÉSTIMO', campos.banco, campos.numero] : ['CONTÁBIL', 'OPERAÇÕES DE CÂMBIO', String(campos.ano), campos.banco, campos.numero], nomeFinal: entrada.nome });
  }
  if (regra.tipo === 'VENDA DE ATIVOS') {
    if (!campos.ano) return Object.assign(base, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', confianca: 0.5, evidencias: ev.concat('a data da lavratura da escritura não foi lida') });
    return Object.assign(base, { acao: 'ARQUIVAR', confianca: c.conf, competencia: { ano: campos.ano }, caminho: ['CONTÁBIL', 'VENDA DE ATIVOS', String(campos.ano)], nomeFinal: entrada.nome });
  }
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
  if (!banco && PELA_CONTA_DO_CADASTRO.includes(regra.tipo)) {
    // sem o nome do banco no texto nem no arquivo (28/10/2026: o extrato do BNB "bancodonordeste3.pdf"): o banco da conta do
    // cadastro que decidiu o cliente — a agência e a conta lidas batem com uma conta só dele, de um banco só
    const bancos = [...new Set(((ctx.cadastro && ctx.cadastro.contas) || []).filter(x => x.codigo === c.cliente && x.banco && contasDoArquivo(bruto, entrada, regra.tipo !== 'COMPROVANTE').some(d => mesmaConta(d.conta, x.conta) && (!d.agencia || !x.agencia || d.agencia.base === x.agencia.base))).map(x => x.banco))];
    if (bancos.length === 1) { banco = bancos[0]; confBanco = 0.9; ev.push('banco pela conta do cadastro (' + banco + ')'); }
    // sem agência e conta no texto: todas as contas do cliente no cadastro são de um banco só
    const doCli = [...new Set(((ctx.cadastro && ctx.cadastro.contas) || []).filter(x => x.codigo === c.cliente && x.banco).map(x => x.banco))];
    if (!banco && doCli.length === 1 && regra.tipo === 'EXTRATO') { banco = doCli[0]; confBanco = 0.88; ev.push('banco: o cliente só tem conta no ' + banco + ' no cadastro (o extrato não diz o banco)'); }
  }
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
    // 27/10/2026 (Vitor): o nome parecido sozinho não segura (463 × 455 CENTRO DE ODONTOLOGIA, 429/49 × 237 POSTO, 309 × 292
    // FITO, 587 × 333 DIRCEU, 475 × 66 ADERLEI, 566 × 494 CAIXA ESCOLAR são empresas diferentes): segura com o MESMO CNPJ/CPF no
    // cadastro, ou quando a pasta não é da empresa do código dela (a pasta antiga "591 - ZELO…" com o 591 hoje da AAP)
    if (!outro) continue;
    if (outro.doc && outro.doc === cli.doc) return p;
    const k10 = s => chaveNome(s).slice(0, 10);
    const resto = p.replace(/^\d+\s*-\s*/, '');
    const palavras = s => textoDeNome(s).trim().split(' ').filter(w => w.length >= 3 && !/^(LTDA|EIRELI|DOS|DAS|CIA|EPP)$/.test(w));
    const daEmpresaDoCodigo = [outro.razao].concat(outro.outrosNomes || [], outro.fantasia ? [outro.fantasia] : []).some(n => (k10(n) && k10(resto) && (k10(n).startsWith(k10(resto).slice(0, 8)) || k10(resto).startsWith(k10(n).slice(0, 8))))
      || (palavras(resto).length >= 2 && palavras(resto).every(w => palavras(n).includes(w))));
    if (daEmpresaDoCodigo) continue;
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
    let regime = cli.regime, arv = ARVORE[cli.regime];
    const chave = d.fiscal[0];
    if (!arv[chave] && ano && ano < new Date().getFullYear()) {
      // 23/10/2026 (Vitor): o documento antigo de quando a empresa tinha outro regime vai para a pasta do regime daquela
      // época — o tipo que só existe num regime diz qual era (a DeSTDA e o Sintegra, só no Simples Nacional); sem como
      // saber, a pasta do regime de hoje com o nome do tipo; nunca recusa
      const comOTipo = Object.keys(ARVORE).filter(r => ARVORE[r][chave]);
      if (comOTipo.length === 1) { regime = comOTipo[0]; arv = ARVORE[regime]; (d.evidencias || (d.evidencias = [])).push(chave + ' só existe no ' + regime + ': o documento é de quando a empresa era do ' + regime + ' (hoje ' + cli.regime + ')'); }
      else if (comOTipo.length) { arv = Object.assign({}, arv, { [chave]: ARVORE[comOTipo[0]][chave].replace(/^\d+\.\s*/, '') }); (d.evidencias || (d.evidencias = [])).push(chave + ' não está na árvore do ' + cli.regime + ': na pasta do regime de hoje, com o nome do tipo'); }
      else return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_INCOMPATIVEL_COM_REGIME', evidencia: chave + ' não previsto em ' + cli.regime } };
    }
    // o documento do ano corrente (o regime muda na virada do ano): o tipo fora da árvore de hoje continua recusado
    if (!arv[chave]) return { erro: { acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_INCOMPATIVEL_COM_REGIME', evidencia: chave + ' não previsto em ' + cli.regime } };
    caminho = ['FISCAL', regime, arv[chave]].concat(d.fiscal.slice(1));
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
  return { pastaCliente, criarPastaCliente, caminho, regime: (d.fiscal && caminho[1]) || cli.regime || null, destinoRelativo: [pastaCliente].concat(caminho).join('\\') };
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
const ANUAIS = new Set(['DEFIS', 'DEFIS ALTERDATA', 'DEFIS PLANILHA', 'DIRF', 'ECF', 'BALANCETE', 'DMED', 'DIMOB', 'IRPF']);
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
/**
 * Os honorários do escritório (Vitor, 28/10/2026): só o boleto e a fatura de cobrança (o comprovante não) cujo beneficiário é a Nilma ("NILMA DIAS
 * OLIVEIRA", "NILMA CONTABILIDADE", "NILMA CONTADORA", "NILMA CONT"), que as regras de pagamento a fornecedor mandavam para
 * PAGAMENTOS DE FORNECEDORES\ANO\MÊS\NILMA…: <cliente>\CONTÁBIL\PAGAMENTOS DE FORNECEDORES\HONORÁRIOS CONTÁBEIS\ANO\, os meses
 * juntos, "MM-AAAA - HONORÁRIOS R$ VALOR.ext" (o mês do vencimento ou do pagamento, o valor do documento). A NFS-e de honorários
 * continua como é (a 284 e a cópia no tomador): ela não passa por aqui.
 */
function honorariosDoEscritorio(d) {
  const c = d.caminho;
  if (!Array.isArray(c) || c[0] !== 'CONTÁBIL' || c[1] !== 'PAGAMENTOS DE FORNECEDORES' || c.length < 5 || !/^NILMA\b/.test(norm(c[4]))) return;
  if (!d.competencia || !d.competencia.mes || !d.competencia.ano) return;
  // só o boleto e a fatura de cobrança (Vitor, 28/10/2026: "apenas os boletos vão para a pasta de honorários, pois vai ficar ruim
  // para verificar"): o comprovante de pagamento e a NFS-e seguem a regra de sempre
  const nomeU = norm(String(d.nomeOriginal || ''));
  if (/^N?FS-?E\b/.test(nomeU) || !(d.tipo === 'BOLETO FORNECEDOR' || /\b(BOLETOS?|FATURAS?)\b/.test(nomeU))) return;
  const nfse = null;
  const v = /R\$\s?([\d.]+,\d{2})/.exec(String(d.nomeFinal || '')) || /R\$\s?([\d.]+,\d{2})/.exec(String(d.nomeOriginal || ''));
  if (!v) return;
  const ext = ((/\.[a-z0-9]+$/i.exec(String(d.nomeFinal || d.nomeOriginal || '')) || ['.pdf'])[0]).toLowerCase();
  d.evidencias.push('honorários do escritório (beneficiário ' + c[4] + '): HONORÁRIOS CONTÁBEIS\\ANO do cliente (Vitor, 28/10/2026)');
  d.caminho = ['CONTÁBIL', 'PAGAMENTOS DE FORNECEDORES', 'HONORÁRIOS CONTÁBEIS', String(d.competencia.ano)];
  d.nomeFinal = dois(d.competencia.mes) + '-' + d.competencia.ano + (nfse ? ' - NFS-e HONORÁRIOS ' + +nfse[1] + ext : ' - HONORÁRIOS R$ ' + v[1] + ext);
  d.tipo = 'HONORARIOS CONTABEIS';
}
function finalizar(d, ctx) {
  const cad = ctx.cadastro;
  d.evidencias = d.evidencias || [];
  const cli = d.cliente != null ? cad.porCod.get(d.cliente) : null;
  if (cli) d.clienteNome = cli.razao;
  if (d.acao !== 'ARQUIVAR') return comMotivoDoCodigo(d);
  if (!cli) return comMotivoDoCodigo(Object.assign(d, { acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO' }));
  honorariosDoEscritorio(d);
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
    [/FOLHA DE PAGAMENTO|DEPARTAMENTO PESSOAL\/\d{2}\/FOLHA$/, () => 'FOLHA'], [/DEPARTAMENTO PESSOAL\/\d{2}\/PRO-LABORE$/, () => 'PRO-LABORE'], [/RELATORIOS LJ/, () => 'RELATORIO LJ'], [/PARCELAMENTOS/, () => 'PARCELAMENTO'],
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
  regimeCanonico, montarCadastro, comAnosEMapa, clientesDoDoc, clienteDaPasta, grupoDaPasta, pagamentoDeFornecedor, clientesPeloNomeNoTexto,
  confirmado, pastaParecida, bancoDoTexto, bancoDoNome, lerXml, classificarXml, camposDaGuia,
  contasDoTexto, clientePelaConta, numeroDeConta, mesmaConta, bancoDoCadastro, contasDoDocumento, contasDoNome, clientesPelasContas, decidir, decidir0, pelaPastaENome, perfilDoDocumento, tipoDoDestino,
  // a decisão do admin no nads (arquivador-manual.js) passa pelo mesmo último passo: a árvore do regime e a pasta do cliente
  finalizar,
};
