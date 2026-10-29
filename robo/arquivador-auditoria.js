// AUDITORIA de G:\Meu Drive\2026 (Vitor, 23/10/2026: "há muito arquivo arquivado errado nela").
//
// SÓ LEITURA. Nunca move, renomeia, copia nem apaga nada no Drive: o que sai daqui é um relatório, um CSV com cada achado
// e um PLANO de correção em simulação (plano-simulado.jsonl), gravados fora do Drive (--saida).
//
// O G: é o Google Drive em STREAMING: abrir um arquivo é baixá-lo. Por isso a auditoria vai em três fases:
//   1. INVENTÁRIO: percorre a raiz em fluxo (fs.opendir) e anota cada pasta e arquivo (nome, tamanho, data). Só metadados:
//      nada é aberto. O inventário fica em <saida>\inventario.jsonl e é reaproveitado (--reinventariar refaz).
//   2. NOME E PASTA: compara onde cada arquivo ESTÁ com a árvore canônica (Dicionário + 04/04b/05a-f, as mesmas que o
//      arquivador-regras.js usa), a pasta do cliente com o cadastro (arquivador-novo.carregarCadastro), o nome com o
//      formato canônico e o ano com a raiz (a raiz é a do ano da competência: G:\Meu Drive\<AAAA>, Vitor, 23/10/2026).
//      Duplicados pelo hash que os manifestos e os índices já guardam (rotina antiga, arquivador novo, diário do contínuo,
//      índice de conteúdo) — sem abrir nada.
//   3. CONTEÚDO, numa AMOSTRA (--amostra, 3000): primeiro os suspeitos da fase 2 (outro cliente pelo nome, duplicado só
//      pelo tamanho), depois uma amostra distribuída por cliente e tipo. Cada arquivo lido passa pelas regras do
//      arquivador novo (arquivador-regras.decidir) duas vezes: sem a pista da pasta (o que o conteúdo diz sozinho) e com
//      ela (onde as regras o colocariam). Para quando o lido passa de --teto-gb (3 GB).
//
// Gravidade dos achados: ERRADO-CLIENTE (grave), ERRADO-ANO, ERRADO-PASTA, NOME-FORA-DO-PADRAO, DUPLICADO,
// PASTA-FORA-DO-PADRAO, INCERTO.
//
// Uso:
//   node arquivador-auditoria.js --saida <pasta>                 tudo (inventário, se não houver, + nome/pasta + conteúdo)
//   node arquivador-auditoria.js --saida <pasta> --so-inventario  só a fase 1
//   node arquivador-auditoria.js --saida <pasta> --sem-conteudo   fases 1 e 2
//   opções: --raiz "G:\Meu Drive\2026"  --amostra 3000  --teto-gb 3  --reinventariar  --semente 42  --sem-medir-cache
//           --nota "texto" (uma linha de observação no cabeçalho do relatório)
// Saída (em --saida): inventario.jsonl, achados.csv (um achado por linha, ";" e UTF-8 com BOM), plano-simulado.jsonl,
// resumo.json e relatorio.md.
'use strict';
process.env.ARQ_NOVO_OCR = '0';   // a auditoria não roda OCR (carregaria o Tesseract; o escaneado conta como "sem texto")
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const K = require('./arquivador-chaves');
const CT = require('./arquivador-conteudos');

const W = path.win32;
const ROTINA = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const MANIFESTO_ANTIGO = W.join(ROTINA, '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
const DUPLICATAS_ANTIGAS = W.join(ROTINA, '_CONTROLE', 'MANIFESTO', 'duplicatas.jsonl');
const CONTROLE = A.CONTROLE;
const GRAVIDADES = ['ERRADO-CLIENTE', 'ERRADO-ANO', 'ERRADO-PASTA', 'NOME-FORA-DO-PADRAO', 'DUPLICADO', 'PASTA-FORA-DO-PADRAO', 'INCERTO'];
const AUTOMATICO = 0.9;   // confiança a partir da qual o plano propõe a correção sem revisão humana

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const N = s => R.norm(s).trim();
const dois = n => String(n).padStart(2, '0');
const lower = s => String(s).toLowerCase();

// ---------------------------------------------------------------------------------------------------------------------
// fase 1: inventário (só metadados)
// ---------------------------------------------------------------------------------------------------------------------
async function inventariar(raiz, arquivo, log) {
  const tmp = arquivo + '.parcial';
  const out = fs.createWriteStream(tmp);
  const escrever = o => out.write(JSON.stringify(o) + '\n');
  const fila = [''];
  let ativos = 0, nArq = 0, nPastas = 0, erros = 0, proxLog = 10000;
  const t0 = Date.now();
  async function lerPasta(rel) {
    const dir = await fs.promises.opendir(rel ? W.join(raiz, rel) : raiz, { bufferSize: 256 });
    const arquivos = [];
    let n = 0;
    for await (const e of dir) {
      n++;
      const p = rel ? rel + '\\' + e.name : e.name;
      if (e.isDirectory()) fila.push(p); else arquivos.push(p);
    }
    for (let i = 0; i < arquivos.length; i += 32) {
      const lote = arquivos.slice(i, i + 32);
      const st = await Promise.all(lote.map(p => fs.promises.stat(W.join(raiz, p)).then(s => s, e => ({ erro: e.message }))));
      lote.forEach((p, j) => { const s = st[j]; if (s.erro) { erros++; escrever({ t: 'e', p, erro: s.erro }); } else { nArq++; escrever({ t: 'f', p, s: s.size, m: Math.round(s.mtimeMs) }); } });
    }
    nPastas++;
    escrever({ t: 'd', p: rel, n });
    if (nArq >= proxLog) { proxLog += 10000; log('  inventário: ' + nArq + ' arquivos, ' + nPastas + ' pastas, ' + Math.round((Date.now() - t0) / 1000) + ' s'); }
  }
  await new Promise(resolve => {
    const proxima = () => {
      while (ativos < 12 && fila.length) {
        const rel = fila.pop();
        ativos++;
        lerPasta(rel).catch(e => { erros++; escrever({ t: 'e', p: rel, erro: e.message }); })
          .finally(() => { ativos--; if (!fila.length && !ativos) resolve(); else proxima(); });
      }
    };
    proxima();
  });
  await new Promise(r => out.end(r));
  fs.renameSync(tmp, arquivo);
  const ms = Date.now() - t0;
  fs.writeFileSync(arquivo + '.info.json', JSON.stringify({ raiz, em: new Date().toISOString(), ms, arquivos: nArq, pastas: nPastas, erros }, null, 1));
  log('inventário pronto: ' + nArq + ' arquivos, ' + nPastas + ' pastas, ' + erros + ' erros, ' + Math.round(ms / 1000) + ' s');
}
function lerInventario(arquivo) {
  const arquivos = [], pastas = [], erros = [];
  CT.cadaLinha(arquivo, r => { if (r.t === 'f') arquivos.push(r); else if (r.t === 'd') pastas.push(r); else erros.push(r); });
  return { arquivos, pastas, erros };
}

// ---------------------------------------------------------------------------------------------------------------------
// índices já existentes (nada é aberto no G:)
// ---------------------------------------------------------------------------------------------------------------------
/** caminho (minúsculo) → { h (sha256 curto), xk (chave+protocolo do XML), nomeOriginal, origem, fontes, tipo, cliente, evidencias } */
function carregarIndices(raiz, log) {
  const porCaminho = new Map();
  const juntar = (onde, info, fonte) => {
    if (!onde) return;
    onde = String(onde).replace(/\//g, '\\').replace(/ \(neste lote\)$/, '');
    if (!/^[a-z]:\\/i.test(onde)) onde = W.join(raiz, onde);
    const k = lower(onde);
    const a = porCaminho.get(k) || { fontes: [] };
    for (const [c, v] of Object.entries(info)) if (v != null && v !== '' && a[c] == null) a[c] = v;
    if (!a.fontes.includes(fonte)) a.fontes.push(fonte);
    porCaminho.set(k, a);
  };
  const doManifesto = fonte => r => {
    const onde = A.caminhoArquivado(r.destino_final, r.nome_final);
    juntar(onde, { h: r.hash_destino || r.hash_origem ? CT.curta(r.hash_destino || r.hash_origem) : null, xk: r.conteudo_xml || null, nomeOriginal: r.nome_original, quando: r.timestamp, execucao: r.id_execucao, tipo: r.tipo || null, cliente: r.cliente != null ? +r.cliente : null, confianca: r.confianca != null ? r.confianca : null }, fonte);
  };
  const est = {};
  est.manifestoAntigo = CT.cadaLinha(MANIFESTO_ANTIGO, doManifesto('rotina antiga'));
  est.manifestoNovo = CT.cadaLinha(W.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl'), doManifesto('arquivador novo'));
  // duplicatas da rotina antiga: o hash de um arquivo NÃO arquivado porque o idêntico já estava no destino
  est.duplicatasAntigas = CT.cadaLinha(DUPLICATAS_ANTIGAS, r => juntar(r.destino_ja_existente, { h: r.hash_origem ? CT.curta(r.hash_origem) : null }, 'duplicatas da rotina antiga'));
  const cont = W.join(CONTROLE, 'continuo');
  let diarios = [];
  try { diarios = fs.readdirSync(cont); } catch (e) { /* sem diário */ }
  est.decisoes = 0; est.arquivados = 0;
  for (const f of diarios.filter(f => /^decisoes-\d{4}-\d{2}\.jsonl$/.test(f))) {
    est.decisoes += CT.cadaLinha(W.join(cont, f), r => {
      if (r.modo !== 'PRODUCAO' || !r.onde || !(r.acao === 'ARQUIVAR' || r.acao === 'JA_ARQUIVADO')) return;
      // JA_ARQUIVADO: o arquivador novo só VIU o arquivo lá (quem o pôs foi outro); vale pelo hash, não pela autoria
      const fonte = r.acao === 'ARQUIVAR' ? 'diário do contínuo' : 'visto pelo arquivador novo';
      juntar(r.onde, r.acao === 'ARQUIVAR' ? { h: r.hash ? CT.curta(r.hash) : null, origem: r.rel, nomeOriginal: r.rel ? W.basename(r.rel) : null, tipo: r.tipo, confianca: r.confianca, quando: r.em } : { h: r.hash ? CT.curta(r.hash) : null }, fonte);
      for (const c of r.copias || []) if (c && c.onde) juntar(c.onde, { h: r.hash ? CT.curta(r.hash) : null, origem: r.rel, nomeOriginal: r.rel ? W.basename(r.rel) : null, tipo: r.tipo, copia: true }, fonte);
    });
  }
  for (const f of diarios.filter(f => /^arquivados-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))) {
    est.arquivados += CT.cadaLinha(W.join(cont, f), r => {
      if (!r.destino || r.acao !== 'arquivou') return;   // "jaArquivado": só viu o arquivo lá
      juntar(r.destino, { origem: r.rel, nomeOriginal: r.nome, tipo: r.tipo, cliente: r.cliente != null ? +r.cliente : null, evidencias: (r.evidencias || []).join('; '), confianca: r.confianca != null ? (r.confianca > 1 ? r.confianca / 100 : r.confianca) : null }, 'diário do contínuo');
      for (const c of r.copias || []) if (c && c.destino) juntar(c.destino, { origem: r.rel, nomeOriginal: r.nome, tipo: r.tipo, cliente: c.cliente != null ? +c.cliente : null, copia: true }, 'diário do contínuo');
    });
  }
  est.conteudos = CT.cadaLinha(W.join(cont, 'conteudos.jsonl'), r => {
    for (const k of r.k || []) { if (/^[0-9a-f]{32}$/.test(k)) juntar(r.onde, { h: k }, 'índice de conteúdo'); else juntar(r.onde, { xk: k }, 'índice de conteúdo'); }
  });
  log('índices: ' + JSON.stringify(est) + ' → ' + porCaminho.size + ' caminhos');
  return { porCaminho, est };
}

// ---------------------------------------------------------------------------------------------------------------------
// a árvore canônica (Dicionário; 04; 04b; 05a, 05b, 05c, 05d, 05e, 05f)
// ---------------------------------------------------------------------------------------------------------------------
const ARVORE_COMPLETA = {
  'SIMPLES NACIONAL': ['01. DAS', '02. DAE', '03. DOCUMENTOS FISCAIS', '04. DeSTDA', '05. SINTEGRA', '06. PARCELAMENTOS', '07. RESTITUIÇÃO', '08. DAM', '09. REEMBOLSO', '10. RESSARCIMENTO', '11. COMPENSAÇÃO', '12. XML', '13. LIVROS FISCAIS', '14. DEFIS', '15. DIRF', '16. DARF'],
  'LUCRO PRESUMIDO': ['01. SPED FISCAL', '02. SPED CONTRIBUIÇÕES', '03. DOCUMENTOS FISCAIS', '04. MIT', '05. DARF', '06. DAE', '07. DAPI', '08. PARCELAMENTOS', '09. RESTITUIÇÃO', '10. DAM', '11. REEMBOLSO', '12. RESSARCIMENTO', '13. COMPENSAÇÃO', '14. XML', '15. LIVROS FISCAIS', '16. ECF', '17. DIRF'],
  'LUCRO REAL': ['01. SPED FISCAL', '02. SPED CONTRIBUIÇÕES', '03. DOCUMENTOS FISCAIS', '04. DARF', '05. DAE', '06. DAPI', '07. PARCELAMENTOS', '08. RESTITUIÇÃO', '09. CONTROLES', '10. DAM', '11. REEMBOLSO', '12. RESSARCIMENTO', '13. COMPENSAÇÃO', '14. XML', '15. LIVROS FISCAIS', '16. ECF', '17. DIRF'],
  ISENTA: ['01. DOCUMENTOS FISCAIS', '02. DARF', '03. DAE', '04. DAM', '05. PARCELAMENTOS', '06. RESTITUIÇÃO', '07. REEMBOLSO', '08. RESSARCIMENTO', '09. COMPENSAÇÃO', '10. XML', '11. DIRF'],
  'PESSOA FISICA': ['01. DOCUMENTOS FISCAIS', '02. DARF', '03. DAE', '04. DAM', '05. PARCELAMENTOS', '06. XML'],
  DOMESTICA: ['01. DOCUMENTOS FISCAIS', '02. DARF', '03. DAE', '04. DAM', '05. PARCELAMENTOS', '06. XML'],
};
/** "12. XML" → "XML"; "07. RESTITUIÇÃO" → "RESTITUICAO". */
const chaveDaPastaFiscal = p => N(p).replace(/^\d{2}\.\s*/, '');
const CONTABIL = ['EXTRATOS', 'RECEBIMENTO DE CLIENTES', 'REGISTRO DE LIVROS', 'OUTROS DOCUMENTOS', 'PAPÉIS DE TRABALHO', 'VENDA DE ATIVOS', 'INFORME DE RENDIMENTOS', 'OPERAÇÕES DE CRÉDITO', 'OPERAÇÕES DE CÂMBIO', 'PAGAMENTOS DE FORNECEDORES', 'NOTAS DE SERVIÇO RECEBIDAS'];
const SOCIETARIO = ['IMPOSTOS', 'FOLHA DE PAGAMENTO', 'CERTIDÕES', 'CERTIFICADO DIGITAL', 'DOCUMENTOS CONSTITUTIVOS', 'DOCUMENTOS DE SÓCIOS', 'OUTROS DOCUMENTOS'];
const EXTRATO_TIPOS = ['APLICAÇÕES', 'BANCÁRIOS', 'COMPROVANTES', 'MAQUININHAS'];
const CERTIDOES = ['FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'TRABALHISTA', 'FGTS'];
const PARCELAMENTOS = ['DÍVIDA ATIVA', 'PREVIDENCIÁRIA', 'SIMPLES NACIONAL', 'FEDERAL', 'ESTADUAL'];
const XML_TIPOS = ['NF-e', 'NFC-e', 'CT-e', 'NFS-e', 'MDF-e'];
const BANCOS = R.BANCOS.map(b => b[0]);
/** Pastas não canônicas que já se sabe para onde vão (sugestão do destino). */
const MAPA_FORA = {
  'CONTRATO SOCIAL': ['SOCIETÁRIO', 'DOCUMENTOS CONSTITUTIVOS'], 'CARTAO CNPJ': ['SOCIETÁRIO', 'DOCUMENTOS CONSTITUTIVOS'],
  'DOCUMENTOS PESSOAIS': ['SOCIETÁRIO', 'DOCUMENTOS DE SÓCIOS'],
};

/** Igual ao canônico ('igual'), igual só sem acento/caixa ('grafia') ou outro (null). */
function bate(parte, lista) {
  for (const c of lista) if (parte === c) return { c, como: 'igual' };
  for (const c of lista) if (N(parte) === N(c)) return { c, como: 'grafia' };
  return null;
}

// nomes canônicos (Dicionário §2; 04; 04b; 05a-05d)
const MA = '(0[1-9]|1[0-2])-((?:19|20)\\d{2})';           // [MÊS E ANO]
const SUF = '(?: \\(\\d+\\))?';                          // a numeração do nome repetido (Dicionário §2)
const re = s => new RegExp(s, 'i');
const NOMES = {
  MES: re('^' + MA + '(?: A ' + MA + ')?' + SUF + '\\.(pdf|ofx|xlsx|xls|csv|txt)$'),
  COMPROVANTES: re('^Comprovantes ' + MA + SUF + '\\.pdf$'),
  RECEBIMENTO: re('^[A-Z0-9 ]+ ' + MA + SUF + '\\.(pdf|xlsx|xls|csv)$'),
  AVULSO: re('^EXTRATO_[A-Z0-9 ]+_' + MA + SUF + '\\.\\w+$'),
  // o PGDAS-D fica com o DAS do mês (Vitor, 27/10/2026): "MM-AAAA - PGDAS-D DECLARACAO|RECIBO|EXTRATO.pdf"
  DAS: re('^' + MA + '( - PGDAS-D (DECLARACAO|RECIBO|EXTRATO))?' + SUF + '\\.pdf$'),
  GUIA: re('^' + MA + ' - (DARF|DAE|DAM|GPS|DAS)\\b.*\\.pdf$'),
  XML: re('^' + MA + '_(NF-e|NFC-e|CT-e|CT-e OS|NFS-e|MDF-e)_[^_]+' + SUF + '\\.xml$'),
  EVENTO: re('^(\\d{2})-' + MA + ' - .+ (NF-e|NFC-e|CT-e|CT-e OS|NFS-e|MDF-e) .+\\.xml$'),
  NOTA_PDF: re('^(\\d{2})-' + MA + ' - (NF-e|NFC-e|CT-e|CT-e OS|NFS-e|MDF-e)\\b.*\\.pdf$'),
  RELATORIO: re('^(?:' + MA + '|((?:19|20)\\d{2})) - RELATORIO (?:NOTAS (?:EMITIDAS|RECEBIDAS)|VENDAS)\\b.*\\.pdf$'),
  MES_TXT: re('^' + MA + '(?: A ' + MA + ')?' + SUF + '(?: - .+)?\\.(txt|pdf|zip)$'),
  LIVRO: re('^' + MA + '(?: A ' + MA + ')? - .+\\.(pdf|txt)$'),
  ANUAL: re('^((?:19|20)\\d{2}) - (RECIBO )?(DEFIS|DIRF|ECF)\\b.*\\.(pdf|txt)$'),
  INFORME: re('^(?:\\dº TRIMESTRE )?((?:19|20)\\d{2}) - INFORME DE RENDIMENTOS .+\\.pdf$'),
  CERTIDAO: re('^(\\d{2})-' + MA + SUF + '\\.pdf$'),
  PARC: re('^(?:' + MA + ' - (PARCELAMENTO|CONSULTA)|(\\d{2})-' + MA + ' - CONSULTA PARCELAMENTO)\\b.*\\.pdf$'),
  PERDCOMP: re('^' + MA + ' - (PER|DCOMP)\\b.*\\.pdf$'),
  LJ: re('^' + MA + '( - TITULOS (PAGOS|RECEBIDOS))?' + SUF + '\\.pdf$'),
  NFSE_RECEBIDA: re('^(\\d{2})-' + MA + ' - NFS-e .+\\.pdf$'),
};
const LIXO = /^(desktop\.ini|thumbs\.db|\.ds_store)$|^~\$|\.(tmp|crdownload|part|lnk)$/i;
const ATALHO_GOOGLE = /\.(gdoc|gsheet|gslides|gform|gdraw|gmap|gsite)$/i;

/** Todas as [MÊS E ANO] do nome, na ordem; "DD-MM-AAAA" conta como o mês dela. */
function mesesDoNome(nome) {
  const out = [];
  const s = String(nome).replace(/\.[a-z0-9]{2,5}$/i, '');
  for (const m of s.matchAll(/(?<![0-9])(0[1-9]|1[0-2])-((?:19|20)\d{2})(?![0-9])/g)) out.push({ mes: +m[1], ano: +m[2] });
  return out;
}
const anoDaParte = p => (/^((?:19|20)\d{2})$/.exec(p) || [])[1];

/**
 * Onde o arquivo está × a árvore canônica do cliente. sub = pastas entre a do cliente e o arquivo; cli = cadastro.
 * Devolve { tipo, achados: [{ g, problema, sugestao (sub novo, array) ou null, conf, ev }], comp: { mes, ano } | null, fonte }.
 */
// empresas do mesmo dono (Vitor, 23/10/2026): o cruzamento entre elas não é ERRADO-CLIENTE; vale o conteúdo
const MESMO_DONO = [[55, 174]];
const ANUAIS = /^(DEFIS|DIRF|ECF|BALANCETE)$/;   // ficam no ano da ENTREGA (Vitor, 23/10/2026); o INFORME DE RENDIMENTOS fica no ano-base (Vitor, 26/10/2026), como nas regras
const COM_EXTENSAO = /\.(pdf|xml|ofx|txt|xlsx|xls|csv|zip|rar|7z|jpe?g|png|docx?|pfx|p12)$/i;
function analisarLocal(sub, nome, cli) {
  // a rotina antiga deixou PASTAS com nome de arquivo ("…\NFC-e\09-2026_NFC-e_31411.xml\09-2026_NFC-e_31411.xml",
  // "…\17896320\CONTRATO.pdf\…"): o arquivo sobe para a pasta de cima; o resto da análise vale para o caminho sem ela
  const iArq = sub.findIndex(p => COM_EXTENSAO.test(p));
  if (iArq >= 0) {
    const sub2 = sub.filter(p => !COM_EXTENSAO.test(p));
    const r = analisarLocal(sub2, nome, cli);
    const local = r.achados.find(a => a.local);
    r.achados.unshift({ g: 'ERRADO-PASTA', problema: 'o arquivo está dentro de uma pasta com nome de arquivo ("' + sub[iArq] + '")', sugestao: local ? local.sugestao.slice() : sub2, conf: 0.95, ev: 'a pasta "' + sub[iArq] + '" deveria ser o próprio arquivo', local: false, pastaArquivo: sub.slice(0, iArq + 1).join('\\') });
    return r;
  }
  const achados = [];
  const ach = (g, problema, sugestao, conf, ev, local) => achados.push({ g, problema, sugestao: sugestao || null, conf, ev: ev || '', local: !!local });
  const corr = sub.slice();   // as correções locais (grafia, mês/ano, regime) juntas: o destino sugerido é um só
  let tipo = 'OUTROS', comp = null, compDe = null;
  const porNome = (rx, pos, ultimo) => {           // a competência pelo nome; ultimo = o último mês (extrato de vários meses)
    const m = rx.exec(nome);
    if (!m) return false;
    const ms = mesesDoNome(nome);
    if (ms.length) { comp = ultimo ? ms[ms.length - 1] : ms[0]; compDe = 'nome'; }
    else if (pos != null && m[pos]) { comp = { ano: +m[pos] }; compDe = 'nome'; }
    return true;
  };
  const nomeFora = (padrao, conf) => ach('NOME-FORA-DO-PADRAO', 'nome fora do padrão ' + padrao, null, conf || 0.9, 'Dicionário §2 / ' + padrao);
  const pastaFora = (i, porque, sugestao, conf) => { ach('ERRADO-PASTA', porque + ' ("' + sub.slice(0, i + 1).join('\\') + '")', sugestao, conf || 0.7, 'a subpasta não existe na árvore canônica'); achados[achados.length - 1].pastaArquivo = sub.slice(0, i + 1).join('\\'); };
  const grafia = (i, canon) => { corr[i] = canon; ach('PASTA-FORA-DO-PADRAO', 'grafia da pasta "' + sub[i] + '" difere da canônica "' + canon + '"', corr, 0.95, 'Dicionário §5.1 / 10-AUDITORIA verificação 4', true); };
  const exigeAno = (i, rot) => {
    const a = anoDaParte(sub[i] || '');
    if (!a) { pastaFora(i, 'faltou a pasta do ano em ' + rot); return null; }
    comp = comp || { ano: +a }; if (!compDe) compDe = 'pasta';
    return +a;
  };
  const exigeMes = i => { const m = /^(0[1-9]|1[0-2])$/.exec(sub[i] || ''); if (!m) { pastaFora(i, 'faltou a pasta do mês'); return null; } return +m[1]; };
  // a competência do nome tem de bater com as pastas [ANO]\[MÊS]
  const conferePastas = (iAno, iMes) => {
    if (compDe !== 'nome' || !comp) return;
    const a = +sub[iAno], m = iMes != null ? +sub[iMes] : null;
    if (comp.ano !== a || (m && comp.mes && comp.mes !== m)) {
      corr[iAno] = String(comp.ano); if (m && comp.mes) corr[iMes] = dois(comp.mes);
      ach('ERRADO-PASTA', 'a competência do nome (' + (comp.mes ? dois(comp.mes) + '-' : '') + comp.ano + ') não bate com a pasta ' + sub[iAno] + (m ? '\\' + sub[iMes] : ''), corr, 0.85, '04: [ANO]/[MÊS] sempre da competência do documento', true);
    }
  };
  if (LIXO.test(nome)) { ach('NOME-FORA-DO-PADRAO', 'arquivo de sistema ou temporário', null, 0.95, 'não é documento'); return { tipo: 'SISTEMA', achados, comp: null }; }
  const s0 = sub[0];
  if (!sub.length) { ach('ERRADO-PASTA', 'arquivo solto na raiz da pasta do cliente', null, 0.9, 'todo documento vai para CONTÁBIL, FISCAL, SOCIETÁRIO ou DEPARTAMENTO PESSOAL'); return { tipo: 'SOLTO', achados, comp: null }; }
  const n0 = N(s0);
  if (MAPA_FORA[n0]) { pastaFora(0, 'pasta fora da árvore', MAPA_FORA[n0].concat(sub.slice(1)), 0.85); return { tipo: 'DOC CONSTITUTIVO', achados, comp: null }; }
  if (n0 === 'RELATORIOS LJ') {
    if (s0 !== 'Relatorios LJ') grafia(0, 'Relatorios LJ');
    tipo = 'RELATORIO LJ';
    if (!porNome(NOMES.LJ)) nomeFora('[MÊS E ANO].pdf (Relatório LJ)');
  } else if (n0 === 'CONTABIL') {
    if (s0 !== 'CONTÁBIL') grafia(0, 'CONTÁBIL');
    const b1 = sub[1] != null ? bate(sub[1], CONTABIL) : null;
    if (sub.length === 1) ach('ERRADO-PASTA', 'arquivo solto em CONTÁBIL', null, 0.85, '04: cada sub-regra tem a sua pasta');
    else if (!b1) pastaFora(1, 'subpasta fora do 04-ESPECIALISTA-CONTABIL', /GUIAS? FISCA/.test(N(sub[1])) ? guiaPeloNome(nome, cli) : null);
    else {
      if (b1.como === 'grafia') grafia(1, b1.c);
      const c1 = b1.c;
      if (c1 === 'EXTRATOS') {
        tipo = 'EXTRATO';
        if (exigeAno(2, 'EXTRATOS') != null && exigeMes(3) != null) {
          if (sub.length === 4) { tipo = 'EXTRATO AVULSO'; if (!porNome(NOMES.AVULSO, null, true)) nomeFora('EXTRATO_[BANCO]_[MÊS E ANO] (fallback extrato avulso)', 0.8); else conferePastas(2, 3); }
          else {
            const b4 = bate(sub[4], EXTRATO_TIPOS);
            if (!b4) pastaFora(4, 'categoria de extrato fora do Dicionário §6.1 (APLICAÇÕES, BANCÁRIOS, COMPROVANTES, MAQUININHAS)');
            else {
              if (b4.como === 'grafia') grafia(4, b4.c);
              tipo = { 'APLICAÇÕES': 'APLICACOES', 'BANCÁRIOS': 'EXTRATO', COMPROVANTES: 'COMPROVANTE', MAQUININHAS: 'MAQUININHAS' }[b4.c];
              if (sub.length === 5) ach('ERRADO-PASTA', 'falta a pasta do banco/operadora em ' + b4.c, null, 0.8, '04: …\\' + b4.c + '\\[BANCO]\\');
              else {
                const bb = bate(sub[5], BANCOS);
                if (!bb) ach('PASTA-FORA-DO-PADRAO', 'banco/operadora "' + sub[5] + '" fora da lista fechada do Dicionário §5.1', null, 0.9, 'Dicionário §5.1: nunca crie pasta com nome novo');
                else if (bb.como === 'grafia') grafia(5, bb.c);
                if (sub.length > 6) pastaFora(6, 'subpasta a mais dentro do banco');
                const ok = b4.c === 'COMPROVANTES' ? porNome(NOMES.COMPROVANTES, null, true) : porNome(NOMES.MES, null, true);
                if (!ok) {
                  // "Comprovante 09-04-2026 16h24m57s.pdf": o nome do banco preservado (o BACKFILL de 27/08/2026 registrou assim)
                  const doBanco = /^Comprovante \d{2}-\d{2}-\d{4}\b/i.test(nome);
                  nomeFora(b4.c === 'COMPROVANTES' ? 'Comprovantes [MÊS E ANO].pdf' + (doBanco ? ' (ficou o nome do banco, com a data e a hora)' : '') : '[MÊS E ANO].[ext]', b4.c === 'COMPROVANTES' ? (doBanco ? 0.95 : 0.9) : 0.85);
                  // comprovantes: renomear para "Comprovantes MM-AAAA.pdf" (o mês da pasta), com " (N)" (Vitor, 23/10/2026)
                  if (b4.c === 'COMPROVANTES') { const x = achados[achados.length - 1]; x.sugestao = sub.slice(); x.nomeNovo = 'Comprovantes ' + sub[3] + '-' + sub[2] + (W.extname(nome).toLowerCase() || '.pdf'); x.ev += ' (Vitor, 23/10/2026: renomear com " (N)")'; }
                  const ms = mesesDoNome(nome);
                  if (ms.length) { comp = b4.c === 'COMPROVANTES' ? ms[0] : ms[ms.length - 1]; compDe = 'nome'; conferePastas(2, 3); }
                } else conferePastas(2, 3);
              }
            }
          }
        }
      } else if (c1 === 'RECEBIMENTO DE CLIENTES') {
        tipo = 'RECEBIMENTO DE CLIENTES';
        if (exigeAno(2, c1) != null && exigeMes(3) != null) { if (!porNome(NOMES.RECEBIMENTO, null, true)) nomeFora('[BANCO] [MÊS E ANO].pdf'); else conferePastas(2, 3); }
      } else if (c1 === 'REGISTRO DE LIVROS') {
        tipo = 'BALANCETE';
        const m = /^\((\d{3})\) ((?:19|20)\d{2})$/.exec(sub[2] || '');
        if (!m) pastaFora(2, 'a pasta do livro não é "(NNN) AAAA"'); else { comp = { ano: +m[2] }; compDe = 'pasta'; }
      } else if (['OUTROS DOCUMENTOS', 'PAPÉIS DE TRABALHO', 'VENDA DE ATIVOS'].includes(c1)) {
        tipo = c1 === 'OUTROS DOCUMENTOS' ? 'OUTROS DOCUMENTOS' : c1 === 'VENDA DE ATIVOS' ? 'VENDA DE ATIVOS' : 'PAPEL DE TRABALHO';
        exigeAno(2, c1);
      } else if (c1 === 'INFORME DE RENDIMENTOS') {
        tipo = 'INFORME DE RENDIMENTOS';
        if (exigeAno(2, c1) != null) { const a = +sub[2]; comp = null; compDe = null; if (!porNome(NOMES.INFORME, 1)) { nomeFora('[ANO-CALENDÁRIO] - INFORME DE RENDIMENTOS [FONTE].pdf', 0.85); comp = { ano: a }; compDe = 'pasta'; } else conferePastas(2, null); }
      } else if (c1 === 'OPERAÇÕES DE CRÉDITO') {
        tipo = 'OPERACAO DE CREDITO';
        if (exigeAno(2, c1) != null && !bate(sub[3] || '', ['CONSÓRCIO', 'EMPRÉSTIMO', 'FINANCIAMENTO'])) pastaFora(3, 'o tipo da operação não é CONSÓRCIO, EMPRÉSTIMO ou FINANCIAMENTO');
      } else if (c1 === 'OPERAÇÕES DE CÂMBIO') { tipo = 'OPERACAO DE CAMBIO'; exigeAno(2, c1); }
      else if (c1 === 'PAGAMENTOS DE FORNECEDORES') { tipo = 'FATURA FORNECEDOR'; if (exigeAno(2, c1) != null) exigeMes(3); }
      else if (c1 === 'NOTAS DE SERVIÇO RECEBIDAS') {
        tipo = 'NFS-e PDF';
        if (cli && cli.regime && cli.regime !== 'ISENTA') ach('ERRADO-PASTA', 'NOTAS DE SERVIÇO RECEBIDAS em CONTÁBIL é só para cliente ISENTA (o cadastro diz ' + cli.regime + ')', ['FISCAL', cli.regime, (ARVORE_COMPLETA[cli.regime] || []).find(p => /DOCUMENTOS FISCAIS/.test(p)) || '03. DOCUMENTOS FISCAIS', 'RECEBIDOS'], 0.85, '04: Nota de Serviço Recebida (só regime=ISENTA)');
        if (exigeAno(2, c1) != null && exigeMes(3) != null) { if (!porNome(NOMES.NFSE_RECEBIDA)) nomeFora('[DATA] - NFS-e [Nº] - [PRESTADOR].pdf', 0.85); else conferePastas(2, 3); }
      }
    }
  } else if (n0 === 'FISCAL') {
    if (s0 !== 'FISCAL') grafia(0, 'FISCAL');
    const regPasta = sub[1] ? R.regimeCanonico(sub[1]) : null;
    if (sub.length === 1) ach('ERRADO-PASTA', 'arquivo solto em FISCAL', null, 0.85, '05: FISCAL\\[REGIME]\\[NN. PASTA]');
    else if (!regPasta || !ARVORE_COMPLETA[regPasta]) {
      if (regPasta === 'MEI') ach('INCERTO', 'pasta FISCAL\\MEI: o regime MEI ainda não tem árvore (Dicionário §2.1)', null, 0.5, 'REGIME_SEM_ESPECIALISTA');
      else pastaFora(1, 'a pasta do regime não é um regime canônico (Dicionário §2.1)');
    } else {
      if (sub[1] !== regPasta) grafia(1, regPasta);
      const arv = ARVORE_COMPLETA[regPasta];
      const regCad = cli ? cli.regime : null;
      // o regime do cadastro vale (03 regra 3; o do nads vence, 21/10/2026)
      let alvoReg = regPasta;
      if (regCad && regCad !== regPasta && ARVORE_COMPLETA[regCad]) {
        alvoReg = regCad;
        const chave = sub[2] ? chaveDaPastaFiscal(sub[2]) : null;
        const no = chave ? ARVORE_COMPLETA[regCad].find(p => chaveDaPastaFiscal(p) === chave) : null;
        if (chave && !no) ach('INCERTO', 'regime da pasta (' + regPasta + ') diferente do cadastro (' + regCad + ') e "' + sub[2] + '" não existe em ' + regCad, null, 0.6, 'TIPO_INCOMPATIVEL_COM_REGIME (E202): confirmar o regime ou se o documento é de outro ano/cliente');
        else { corr[1] = regCad; if (no) corr[2] = no; ach('ERRADO-PASTA', 'regime da pasta (' + regPasta + ') diferente do cadastro (' + regCad + ')', corr, 0.8, '03 regra 3: o regime vem do cadastro, nunca do documento (o regime pode ter mudado no ano: conferir)', true); }
      } else if (!regCad && cli) ach('INCERTO', 'cliente sem regime no cadastro; a pasta diz ' + regPasta, null, 0.5, 'REGIME_INDEFINIDO (E104)');
      if (sub.length === 2) ach('ERRADO-PASTA', 'arquivo solto em FISCAL\\' + sub[1], null, 0.85, '05: falta a pasta numerada');
      else {
        let p2 = arv.includes(sub[2]) ? { c: sub[2], como: 'igual' } : null;
        if (!p2) { const k = chaveDaPastaFiscal(sub[2]); const c = arv.find(p => chaveDaPastaFiscal(p) === k); if (c) p2 = { c, como: 'grafia' }; }
        const k2 = chaveDaPastaFiscal(sub[2]);
        if (!p2 && k2 === 'OUTROS DOCUMENTOS') p2 = { c: sub[2], como: 'igual' };   // 05d: OUTROS DOCUMENTOS\[ANO] dentro do regime
        if (!p2) pastaFora(2, 'pasta fora da árvore numerada de ' + regPasta + ' (05a/05b/05c/05e/05f)');
        else {
          if (p2.como === 'grafia') grafia(2, p2.c);
          const k = chaveDaPastaFiscal(p2.c);
          const fundo = sub.length;
          if (k === 'DAS') { tipo = 'DAS'; if (fundo > 3) pastaFora(3, 'subpasta dentro de DAS'); if (!porNome(NOMES.DAS) && !porNome(NOMES.GUIA)) nomeFora('[MÊS E ANO].pdf (DAS)'); }
          else if (['DARF', 'DAE', 'DAM'].includes(k)) { tipo = k; if (!porNome(NOMES.GUIA) && !porNome(NOMES.DAS)) nomeFora('[MÊS E ANO] - ' + k + ' [TRIBUTO] - VALOR [VALOR] - VENCIMENTO [DATA].pdf (05d §4)'); }
          else if (k === 'XML') {
            const t = sub[3] ? bate(sub[3], XML_TIPOS) : null;
            if (!t) { if (fundo === 3) ach('ERRADO-PASTA', 'XML solto em ' + sub[2] + ' (falta a pasta do tipo: NF-e, NFC-e, CT-e, NFS-e, MDF-e)', null, 0.75, '05d §1b'); else pastaFora(3, 'tipo de XML fora de NF-e, NFC-e, CT-e, NFS-e, MDF-e'); }
            else {
              if (t.como === 'grafia') grafia(3, t.c);
              const ev = sub[4] && N(sub[4]) === 'EVENTOS';
              tipo = 'XML ' + t.c + (ev ? ' EVENTOS' : '');
              if (sub[4] && !ev) pastaFora(4, 'subpasta dentro de XML\\' + t.c + ' que não é EVENTOS');
              if (!/\.xml$/i.test(nome)) ach('ERRADO-PASTA', 'arquivo que não é XML dentro de ' + sub[2], null, 0.8, '05d §1b: a pasta XML é só de XML');
              else if (!(ev ? porNome(NOMES.EVENTO) : porNome(NOMES.XML))) nomeFora(ev ? '[DATA] - [EVENTO] ' + t.c + ' [Nº].xml' : '[MÊS E ANO]_' + t.c + '_[Nº].xml', 0.9);
            }
          } else if (k === 'DOCUMENTOS FISCAIS') {
            const lado = sub[3] ? bate(sub[3], ['EMITIDOS', 'RECEBIDOS']) : null;
            tipo = 'NOTA PDF';
            if (!lado) { if (fundo === 3) ach('ERRADO-PASTA', 'solto em DOCUMENTOS FISCAIS (falta EMITIDOS/RECEBIDOS)', null, 0.75, '05d §1'); else pastaFora(3, 'fora de EMITIDOS/RECEBIDOS'); }
            else {
              if (lado.como === 'grafia') grafia(3, lado.c);
              const r4 = sub[4] ? N(sub[4]) : null;
              if (r4 === 'RELATORIO MENSAL') { tipo = 'RELATORIO DE NOTAS'; if (exigeAno(5, 'RELATÓRIO MENSAL') != null && !porNome(NOMES.RELATORIO, 3)) nomeFora('[MÊS E ANO] - RELATORIO NOTAS EMITIDAS/RECEBIDAS - [RAZÃO].pdf', 0.85); }
              else if (r4 === 'NFC-E') { tipo = 'NFC-e PDF'; if (exigeAno(5, 'NFC-e') != null && exigeMes(6) != null && !porNome(NOMES.NOTA_PDF)) nomeFora('[DATA] - NFC-e [Nº].pdf', 0.85); }
              else if (r4 && !['ESPECIFICOS', 'CANCELADAS'].includes(r4)) pastaFora(4, 'subpasta fora do 05d §1 (ESPECÍFICOS, CANCELADAS, NFC-e, RELATÓRIO MENSAL)', null, 0.6);
              else if (!/\.pdf$/i.test(nome)) ach('ERRADO-PASTA', 'arquivo que não é PDF em DOCUMENTOS FISCAIS' + (/\.xml$/i.test(nome) ? ' (XML vai para a pasta XML)' : ''), /\.xml$/i.test(nome) ? ['FISCAL', regPasta, arv.find(p => /XML$/.test(p))] : null, 0.75, '05d §1 / §1b');
              else if (!porNome(NOMES.NOTA_PDF)) nomeFora('[DATA] - NF-e [Nº] - [EMITENTE].pdf (05d §1)', 0.8);
            }
          } else if (['SPED FISCAL', 'SPED CONTRIBUICOES', 'SINTEGRA', 'DESTDA', 'MIT', 'DAPI'].includes(k)) { tipo = k; if (!porNome(NOMES.MES_TXT)) nomeFora('[MÊS E ANO].txt', 0.85); }
          else if (k === 'LIVROS FISCAIS') { tipo = 'LIVRO_FISCAL'; if (exigeAno(3, sub[2]) != null) { if (!porNome(NOMES.LIVRO, null, true)) nomeFora('[MÊS E ANO] - [LIVRO].pdf', 0.8); else conferePastas(3, null); } }
          else if (['DEFIS', 'DIRF', 'ECF'].includes(k)) { tipo = k; if (!porNome(NOMES.ANUAL, 1)) nomeFora('[ANO-CALENDÁRIO] - ' + k + '.pdf', 0.85); }
          else if (k === 'PARCELAMENTOS') {
            tipo = 'PARCELAMENTO';
            const m = sub[3] ? bate(sub[3], PARCELAMENTOS) : null;
            if (!m) pastaFora(3, 'modalidade de parcelamento fora do 05d §2');
            else { if (m.como === 'grafia') grafia(3, m.c); if (exigeAno(4, sub[3]) != null) { exigeMes(5); if (!porNome(NOMES.PARC)) nomeFora('[MÊS E ANO] - PARCELAMENTO … - PARCELA [Nº] - VALOR [VALOR].pdf', 0.8); } }
          } else if (['RESTITUICAO', 'REEMBOLSO', 'RESSARCIMENTO', 'COMPENSACAO'].includes(k)) { tipo = 'PER/DCOMP'; if (!porNome(NOMES.PERDCOMP)) nomeFora('[MÊS E ANO] - PER … [Nº] - VALOR [VALOR].pdf', 0.8); }
          else if (k === 'OUTROS DOCUMENTOS') { tipo = 'OUTROS DOCUMENTOS'; exigeAno(3, sub[2]); }
          else if (k === 'CONTROLES') tipo = 'CONTROLES';
          if (alvoReg !== regPasta) for (const a of achados) if (a.sugestao && !a.local && a.sugestao[0] === 'FISCAL' && a.sugestao[1] === regPasta) a.sugestao[1] = alvoReg;
        }
      }
    }
  } else if (n0 === 'SOCIETARIO') {
    if (s0 !== 'SOCIETÁRIO') grafia(0, 'SOCIETÁRIO');
    const b1 = sub[1] != null ? bate(sub[1], SOCIETARIO) : null;
    if (sub.length === 1) ach('ERRADO-PASTA', 'arquivo solto em SOCIETÁRIO', null, 0.85, '04b');
    else if (!b1) {
      const n1 = N(sub[1]);
      const sug = MAPA_FORA[n1] ? MAPA_FORA[n1].concat(sub.slice(2)) : n1 === 'SINTEGRA' && cli && cli.regime === 'SIMPLES NACIONAL' ? ['FISCAL', 'SIMPLES NACIONAL', '05. SINTEGRA'].concat(sub.slice(2)) : null;
      pastaFora(1, 'subpasta fora do 04b-ESPECIALISTA-FOLHA-SOCIETARIO', sug, sug ? 0.85 : 0.7);
      tipo = MAPA_FORA[n1] ? 'DOC CONSTITUTIVO' : 'OUTROS';
    } else {
      if (b1.como === 'grafia') grafia(1, b1.c);
      const c1 = b1.c;
      if (c1 === 'IMPOSTOS') {
        const t = sub[2] ? bate(sub[2], ['FGTS', 'IRPF']) : null;
        if (!t) pastaFora(2, 'em IMPOSTOS só há FGTS e IRPF (04b)');
        else { tipo = t.c; if (exigeAno(3, 'IMPOSTOS\\' + t.c) != null && t.c === 'FGTS') { if (!porNome(NOMES.DAS)) nomeFora('[MÊS E ANO].pdf (FGTS)', 0.85); else conferePastas(3, null); } }
      } else if (c1 === 'FOLHA DE PAGAMENTO') { tipo = 'FOLHA'; if (exigeAno(2, c1) != null) exigeMes(3); }
      else if (c1 === 'CERTIDÕES') {
        tipo = 'CERTIDAO';
        const t = sub[2] ? bate(sub[2], CERTIDOES) : null;
        if (!t) pastaFora(2, 'tipo de certidão fora de FEDERAL, ESTADUAL, MUNICIPAL, TRABALHISTA, FGTS');
        else { if (t.como === 'grafia') grafia(2, t.c); if (!porNome(NOMES.CERTIDAO)) nomeFora('[DATA].pdf (data de emissão)', 0.85); }
      } else if (c1 === 'OUTROS DOCUMENTOS') { tipo = 'OUTROS DOCUMENTOS'; exigeAno(2, c1); }
      else tipo = c1 === 'CERTIFICADO DIGITAL' ? 'CERTIFICADO DIGITAL' : c1 === 'DOCUMENTOS CONSTITUTIVOS' ? 'DOC CONSTITUTIVO' : 'DOC SOCIO';
    }
  } else if (n0 === 'DEPARTAMENTO PESSOAL') {
    if (s0 !== 'DEPARTAMENTO PESSOAL') grafia(0, 'DEPARTAMENTO PESSOAL');
    if (/^(0[1-9]|1[0-2])$/.test(sub[1] || '') && N(sub[2] || '') === 'FGTS') {
      // o robô do FGTS no PC (09/10/2026): <cliente>\DEPARTAMENTO PESSOAL\MM\FGTS — sem o ano na pasta (o 04b diz SOCIETÁRIO\IMPOSTOS\FGTS\[ANO])
      tipo = 'FGTS (robô do DP)';
      if (!porNome(NOMES.DAS)) { const ms = mesesDoNome(nome); if (ms.length) { comp = ms[0]; compDe = 'nome'; } }
      if (comp && comp.mes && comp.mes !== +sub[1]) ach('ERRADO-PASTA', 'a competência do nome (' + dois(comp.mes) + '-' + comp.ano + ') não bate com a pasta do mês ' + sub[1], sub.slice(0, 1).concat(dois(comp.mes), sub.slice(2)), 0.8, 'robô do FGTS: DEPARTAMENTO PESSOAL\\MM\\FGTS');
    } else if (N(sub[1] || '') === 'FUNCIONARIOS') { tipo = 'DP FUNCIONARIO'; if (sub.length < 3) ach('ERRADO-PASTA', 'solto em FUNCIONÁRIOS (falta a pasta do funcionário)', null, 0.8, 'DP por funcionário (Vitor, 23/10/2026)'); }
    else pastaFora(1, 'subpasta fora do DEPARTAMENTO PESSOAL (MM\\FGTS ou FUNCIONÁRIOS\\<NOME>)', null, 0.6);
  } else {
    pastaFora(0, 'pasta de primeiro nível fora da árvore (CONTÁBIL, FISCAL, SOCIETÁRIO, DEPARTAMENTO PESSOAL, Relatorios LJ)', null, 0.7);
  }
  for (const a of achados) if (a.local) a.sugestao = corr.slice();
  return { tipo, achados, comp, compDe };
}
/** A pasta fiscal de uma guia solta pelo nome ("DAS 09-2026.pdf" → FISCAL\SIMPLES NACIONAL\01. DAS). */
function guiaPeloNome(nome, cli) {
  const t = (/\b(DAS|DARF|DAE|DAM)\b/.exec(N(nome)) || [])[1];
  if (!t || !cli || !ARVORE_COMPLETA[cli.regime]) return null;
  const p = ARVORE_COMPLETA[cli.regime].find(x => chaveDaPastaFiscal(x) === t);
  return p ? ['FISCAL', cli.regime, p] : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// a pasta do cliente × o cadastro
// ---------------------------------------------------------------------------------------------------------------------
function analisarPastaCliente(nome, cad) {
  const out = { nome, codigo: null, cli: null, achados: [] };
  const ach = (problema, conf, ev, outro) => out.achados.push({ g: 'PASTA-FORA-DO-PADRAO', problema, conf, ev: ev || '', outro: outro || null });
  const m = /^(\d+)\s*-\s*(.+)$/.exec(nome);
  if (!m) { ach('nome da pasta do cliente fora do padrão "[CÓDIGO] - [RAZÃO]"', 0.95, '10-AUDITORIA: G:\\Meu Drive\\2026\\[ID] - [CLIENTE]'); return out; }
  out.codigo = +m[1];
  if (/^0\d/.test(m[1])) ach('código com zero à esquerda ("' + m[1] + '")', 0.8, 'o arquivador cria "<código> - <razão>" sem zeros');
  const cli = cad.porCod.get(out.codigo);
  if (!cli) { ach('código ' + out.codigo + ' não existe no cadastro', 0.9, 'cadastro: ' + cad.fonte); return out; }
  out.cli = cli;
  const k = s => R.chaveNome(s);
  const resto = k(m[2]);
  const nomes = [cli.razao].concat(cli.outrosNomes || [], cli.fantasia ? [cli.fantasia] : []).map(k).filter(Boolean);
  // "ADERLEI SANTOS E CIA" = "ADERLEI DOS SANTOS & CIA LTDA": as palavras do nome (sem sufixo e sem preposição) quase todas iguais
  const palavras = s => new Set(N(R.nomeNormalizado(s)).replace(/&/g, ' E ').split(/[^A-Z0-9]+/).filter(w => w.length >= 2 && !/^(DE|DA|DO|DOS|DAS|E|LTDA|ME|EPP|CIA)$/.test(w)));
  const parecidos = (a, b) => { const x = palavras(a), y = palavras(b); if (!x.size || !y.size) return false; let c = 0; for (const w of x) if (y.has(w)) c++; return c / Math.min(x.size, y.size) >= 0.75; };
  const todosOsNomes = [cli.razao].concat(cli.outrosNomes || [], cli.fantasia ? [cli.fantasia] : []);
  const confere = nomes.some(n => n.startsWith(resto.slice(0, 10)) || resto.startsWith(n.slice(0, 10))) || todosOsNomes.some(n => parecidos(n, m[2]));
  if (!confere) {
    // de quem é o nome da pasta? (a 591 era a ZELO na planilha antiga; no cadastro de hoje a 591 é a AAP e a ZELO é a 602)
    const donos = new Set();
    for (const [nk, cs] of cad.porNome) if (nk.length >= 8 && (nk.startsWith(resto.slice(0, 12)) || resto.startsWith(nk.slice(0, 12)))) cs.forEach(c => donos.add(c));
    donos.delete(out.codigo);
    let outro = donos.size === 1 ? [...donos][0] : null;
    if (!outro && donos.size > 1) { const mz = [...donos].filter(c => /MATRIZ/.test(N(cad.porCod.get(c).razao))); if (mz.length === 1) outro = mz[0]; }
    ach('o código ' + out.codigo + ' no cadastro é "' + cli.razao + '"' + (cli.ativo === false ? ' (inativo)' : '') + ', não "' + m[2] + '"' + (donos.size ? ' (o nome da pasta é do código ' + [...donos].join(', ') + (outro ? '; a matriz/o dono é o ' + outro : '') + ')' : ''), 0.85, 'arquivador-cadastro (nads + Entregas + planilha)', outro);
    out.outro = outro; out.donos = [...donos];
  }
  if (cad.pastasDuplicadas && cad.pastasDuplicadas.has(out.codigo)) ach('duas pastas com o mesmo código: ' + cad.pastasDuplicadas.get(out.codigo).join(' | ') + ' (o arquivador recusa arquivar neste código: PASTA_DO_CLIENTE_DUPLICADA)', 0.99, 'PASTA_DO_CLIENTE_DUPLICADA');
  // duas pastas com o MESMO nome e códigos diferentes (matriz e filial com código próprio é normal: só aviso)
  const meu = R.chaveNome(R.nomeNormalizado(m[2]));
  for (const p of cad.todasAsPastas || []) {
    const q = /^(\d+)\s*-\s*(.+)$/.exec(p);
    if (!q || +q[1] === out.codigo || R.chaveNome(R.nomeNormalizado(q[2])) !== meu) continue;
    const o = cad.porCod.get(+q[1]);
    const filial = o && o.doc && cli.doc && o.doc.length === 14 && o.doc.slice(0, 8) === cli.doc.slice(0, 8);
    if (!filial) ach('outra pasta com o mesmo nome e outro código: "' + p + '"', 0.7, 'a mesma empresa com dois códigos, ou duas empresas com o mesmo nome');
  }
  if (cli.ativo === false) out.inativo = true;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// fase 3: conteúdo
// ---------------------------------------------------------------------------------------------------------------------
/** Os clientes que o conteúdo cita: pelo CNPJ/CPF (XML: as partes; PDF: o texto) e, no PDF, pela razão social. */
function clientesDoConteudo(entrada, cad) {
  let docs = [], nomes = [];
  if (entrada.xml) { const i = R.classificarXml(entrada.xml); docs = i.partes || []; }
  else if (entrada.texto) { const t = entrada.texto.join('\n'); docs = R.documentosDoTexto(t).map(d => d.doc); nomes = R.clientesPeloNomeNoTexto(t.slice(0, 6000), cad); }
  else if (entrada.ofx || entrada.txt) docs = R.documentosDoTexto(entrada.ofx || entrada.txt).map(d => d.doc);
  const porDoc = new Set(docs.flatMap(d => R.clientesDoDoc(d, cad)));
  const raizes = new Set(docs.filter(d => d.length === 14).map(d => d.slice(0, 8)));
  return { porDoc, nomes, raizes, docs: [...new Set(docs)] };
}
const semSufixo = s => N(s).replace(/ \(\d+\)(?=\.[A-Z0-9]+$)/, '');

/** Lê um arquivo do G: (é o download) e confere com as regras. Devolve os achados de conteúdo. */
async function conferirConteudo(item, buf, ctx, cad, raiz) {
  const achados = [];
  const ach = (g, problema, sugestao, conf, ev) => achados.push({ g, problema, sugestao: sugestao || null, conf, ev: ev || '', fase: 'conteúdo' });
  const nome = W.basename(item.p);
  const e0 = await A.montarEntrada(nome, nome, buf);
  const X = item.codigo;
  const info = { lido: true, tipoConteudo: null, decisao: null, cliente: 'sem informação' };
  let d0 = null, d1 = null;
  try { d0 = R.decidir(Object.assign({}, e0), ctx); } catch (e) { info.erro = e.message; }
  try { d1 = R.decidir(Object.assign({}, e0, { rel: item.p }), ctx); } catch (e) { info.erro = e.message; }
  if (d1) { info.tipoConteudo = d1.tipo || null; info.decisao = d1.acao + (d1.motivo ? ' ' + d1.motivo : ''); }
  const cc = clientesDoConteudo(e0, cad);
  const cliX = cad.porCod.get(X);
  const raizX = cliX && cliX.doc && cliX.doc.length === 14 ? cliX.doc.slice(0, 8) : null;
  const nosCopias = d => d && (d.copias || []).some(c => c.cliente === X);
  const destinoDe = (d, alvo) => {
    const c = alvo && d.cliente !== alvo ? (d.copias || []).find(x => x.cliente === alvo) : null;
    const rel = c ? c.destinoRelativo : d.destinoRelativo;
    const ano = d.anoRaiz || ctx.anoRaiz;
    return rel ? W.join(W.dirname(raiz), String(ano), rel, (c ? c.nomeFinal : d.nomeFinal) || nome) : null;
  };
  if (X != null && (cc.porDoc.has(X) || cc.nomes.includes(X) || (raizX && cc.raizes.has(raizX)) || (d0 && d0.cliente === X) || nosCopias(d0))) info.cliente = 'confere';
  else if (X != null && d0 && d0.acao === 'ARQUIVAR' && d0.cliente != null && d0.cliente !== X && (d0.confianca || 0) >= R.LIMIAR) {
    const forte = ['doc', 'conta', 'hash', 'chave'].includes(d0.comoCliente);
    info.cliente = 'outro';
    ach(forte ? 'ERRADO-CLIENTE' : 'INCERTO', (forte ? '' : 'provavelmente ') + 'de outro cliente: ' + d0.cliente + ' - ' + (d0.clienteNome || ''), destinoDe(d0), forte ? Math.min(d0.confianca, 0.97) : 0.7, 'conteúdo: ' + (d0.evidencias || []).slice(0, 3).join('; '));
  } else if (X != null && cc.porDoc.size >= 1) {
    info.cliente = 'outro';
    const outros = [...cc.porDoc];
    // o destino: a pasta do outro cliente, no mesmo caminho (se ela existe; senão nasce com o CNPJ, 03 regra 2)
    const pastaOutro = outros.length === 1 ? cad.pastas.get(outros[0]) || outros[0] + ' - ' + R.nomeSeguro((cad.porCod.get(outros[0]) || {}).razao || '') : null;
    // no extrato/comprovante o CNPJ no corpo costuma ser da OUTRA parte (favorecido, pagador); o CPF de cliente pessoa
    // física pode ser o do sócio; vários documentos no texto: não dá para dizer de quem é
    const contraparte = /EXTRATO|COMPROVANTE|APLICAC|MAQUININHA|RECEBIMENTO|FATURA/.test(String((d0 && d0.tipo) || '') + ' ' + (item.tipo || ''));
    const soCpf = outros.every(c => ((cad.porCod.get(c) || {}).doc || '').length === 11);
    if (outros.length === 1 && (contraparte || soCpf || cc.docs.length > 1)) ach('INCERTO', 'o documento cita ' + (soCpf ? 'o CPF' : 'o CNPJ') + ' de outro cliente (' + outros[0] + ' - ' + (cad.porCod.get(outros[0]) || {}).razao + ') e não o deste' + (contraparte ? ' — pode ser a outra parte do pagamento' : soCpf ? ' — pode ser o sócio' : ''), null, 0.55, 'documentos no conteúdo: ' + cc.docs.slice(0, 4).join(', '));
    else if (outros.length === 1) ach('ERRADO-CLIENTE', 'o CNPJ/CPF do documento é de outro cliente: ' + outros[0] + ' - ' + (cad.porCod.get(outros[0]) || {}).razao + (cad.pastas.get(outros[0]) ? '' : ' (sem pasta no Drive)'), W.join(raiz, pastaOutro, ...item.p.split('\\').slice(1)), 0.85, 'documentos no conteúdo: ' + cc.docs.slice(0, 4).join(', ') + (d0 && d0.motivo ? ' (as regras: ' + d0.motivo + ')' : ''));
    else ach('INCERTO', 'o documento cita outros clientes (' + outros.join(', ') + ') e não este', null, 0.6, 'documentos no conteúdo: ' + cc.docs.slice(0, 4).join(', '));
  } else if (X != null && cc.nomes.length && !cc.nomes.includes(X)) {
    info.cliente = 'outro?';
    ach('INCERTO', 'o texto cita a razão social de outro cliente (' + cc.nomes.slice(0, 3).join(', ') + ') e não a deste', null, 0.55, 'clientesPeloNomeNoTexto');
  }
  // onde as regras o colocariam (com a pista da pasta atual)
  if (info.cliente !== 'outro' && d1 && d1.acao === 'ARQUIVAR' && (d1.confianca || 0) >= R.LIMIAR && (d1.cliente === X || nosCopias(d1))) {
    const c = d1.cliente === X ? d1 : d1.copias.find(x => x.cliente === X);
    const ano = d1.anoRaiz || ctx.anoRaiz;
    const relSug = String(c.destinoRelativo || '').split('\\').slice(1);   // sem a pasta do cliente
    const subAtual = item.p.split('\\').slice(1, -1);
    const nomeSug = c.nomeFinal || d1.nomeFinal;
    const sug = destinoDe(d1, X);
    info.decisao += ' → ' + (ano !== ctx.anoRaiz ? ano + '\\' : '') + c.destinoRelativo;
    // as declarações anuais ficam no ano da ENTREGA (Vitor, 23/10/2026): o anoRaiz das regras JÁ é o da entrega (o do recibo,
    // ou o seguinte ao ano-calendário; arquivador-regras, "ano da entrega"). 26/10/2026: somar +1 aqui de novo mandava
    // "2025 - DEFIS.pdf" (exercício 2026, ano-calendário 2025), certo em 2026, para 2027 (305 achados falsos)
    const anual = ANUAIS.test(d1.tipo || '');
    const anoCerto = ano;
    if (anoCerto !== ctx.anoRaiz) ach('ERRADO-ANO', (anual ? 'declaração/livro anual entregue em ' + anoCerto : 'a competência é de ' + ano) + ' (raiz ' + ctx.anoRaiz + ')', anual ? String(sug).replace('\\' + ano + '\\', '\\' + anoCerto + '\\') : sug, anual ? 0.7 : Math.min(d1.confianca, 0.95), 'conteúdo: ' + (d1.evidencias || []).filter(x => /raiz do ano|compet/i.test(x)).slice(0, 2).join('; '));
    else if (N(subAtual[0] || '') === 'DEPARTAMENTO PESSOAL' && N(subAtual[2] || '') === 'FGTS' && d1.tipo === 'FGTS') {
      // o FGTS fica em DEPARTAMENTO PESSOAL\MM\FGTS, com o nome do robô (Vitor, 23/10/2026): o cliente confere, nada a corrigir
      return { achados, info, sha: sha(buf) };
    } else if (relSug.map(N).join('\\') !== subAtual.map(N).join('\\')) ach('ERRADO-PASTA', 'as regras põem em ' + relSug.join('\\') + ' (' + (d1.tipo || '?') + ')', sug, Math.min(d1.confianca, 0.95), 'conteúdo: ' + (d1.evidencias || []).slice(0, 3).join('; ') + (d1.fonte ? ' [' + d1.fonte + ']' : ''));
    if (nomeSug && semSufixo(nomeSug) !== semSufixo(nome)) {
      // "11-09-2026 - NF-e 10186 - FITO IND. E COM. DE ALIMENTOS" × "… - FITO INDUSTRIA E COMERCIO DE ALIMENTOS": só a grafia do emitente
      const cab = s => (/^(\d{2}-\d{2}-\d{4} - \S+(?: OS)? \d+)( - |\.)/.exec(s) || [])[1];
      const soEmitente = cab(nome) && cab(nome) === cab(nomeSug);
      ach('NOME-FORA-DO-PADRAO', soEmitente ? 'só a grafia do emitente difere: "' + nomeSug + '"' : 'o nome canônico seria "' + nomeSug + '"', W.join(W.dirname(sug || ''), nomeSug), soEmitente ? 0.5 : Math.min(d1.confianca, 0.9), 'conteúdo (' + (d1.tipo || '?') + ')');
    }
  }
  return { achados, info, sha: sha(buf) };
}

// ---------------------------------------------------------------------------------------------------------------------
// a execução
// ---------------------------------------------------------------------------------------------------------------------
function aleatorio(semente) { let s = semente >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function tamanhoPasta(p) { let t = 0, n = 0; const pilha = [p]; while (pilha.length) { const d = pilha.pop(); let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; } for (const e of es) { const f = W.join(d, e.name); if (e.isDirectory()) pilha.push(f); else { try { t += fs.statSync(f).size; n++; } catch (x) {} } } } return { bytes: t, arquivos: n }; }
const csv = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const mb = b => (b / 1048576).toFixed(1) + ' MB';
const gb = b => (b / 1073741824).toFixed(2) + ' GB';

async function auditar(opcoes) {
  const t0 = Date.now();
  const log = opcoes.log || (m => console.log(new Date().toLocaleTimeString('pt-BR'), m));
  const raiz = opcoes.raiz || R.RAIZ_CLIENTES;
  const anoRaiz = +W.basename(raiz) || 2026;
  const saida = opcoes.saida;
  // só leitura no Drive: a saída nunca vai para o mesmo disco da raiz auditada (o G:)
  if (!saida || lower(W.resolve(saida)).slice(0, 2) === lower(W.resolve(raiz)).slice(0, 2)) throw new Error('--saida tem de ficar fora do disco de ' + raiz + ' (a auditoria não grava no Drive)');
  fs.mkdirSync(saida, { recursive: true });
  const inv = W.join(saida, 'inventario.jsonl');
  const tempos = {};
  const cacheDrive = opcoes.cacheDrive || W.join(process.env.LOCALAPPDATA || '', 'Google', 'DriveFS');
  let cacheAntes = null;
  if (!opcoes.semMedirCache) { try { const conta = fs.readdirSync(cacheDrive).filter(d => /^\d{10,}$/.test(d)).map(d => W.join(cacheDrive, d, 'content_cache'))[0]; if (conta) { cacheAntes = { pasta: conta, ...tamanhoPasta(conta) }; log('cache do Drive antes: ' + mb(cacheAntes.bytes)); } } catch (e) {} }

  // 1. inventário
  if (opcoes.reinventariar || !fs.existsSync(inv)) { const t = Date.now(); log('fase 1: inventário de ' + raiz + ' (só metadados)'); await inventariar(raiz, inv, log); tempos.inventarioMs = Date.now() - t; }
  else log('fase 1: inventário reaproveitado (' + inv + ')');
  if (opcoes.soInventario) return;
  let infoInv = {}; try { infoInv = JSON.parse(fs.readFileSync(inv + '.info.json', 'utf8')); } catch (e) {}
  const { arquivos, pastas, erros } = lerInventario(inv);
  log('inventário: ' + arquivos.length + ' arquivos, ' + pastas.length + ' pastas, ' + erros.length + ' erros');

  // 2. nome e pasta
  const t2 = Date.now();
  const cad = A.carregarCadastro({ clientes: raiz });
  log('cadastro: ' + cad.porCod.size + ' códigos (' + cad.fonte + ')');
  const { porCaminho, est } = carregarIndices(raiz, log);
  const achados = [];
  const novo = (g, p, codigo, problema, sugestao, conf, ev, fase, extra) => achados.push(Object.assign({ g, p, codigo, problema, sugestao: sugestao || null, conf, ev: ev || '', fase: fase || 'nome/pasta' }, extra || {}));
  const pastasCli = new Map();
  for (const d of pastas) if (d.p && !d.p.includes('\\')) pastasCli.set(d.p, analisarPastaCliente(d.p, cad));
  for (const pc of pastasCli.values()) for (const a of pc.achados) novo(a.g, pc.nome, pc.codigo, a.problema, null, a.conf, a.ev, 'cadastro', { pasta: true, outro: a.outro });
  // pastas vazias (o Drive recria pasta vazia sozinho: 01, Fase 8) — uma linha por pasta
  for (const d of pastas) if (d.p && d.n === 0) novo('PASTA-FORA-DO-PADRAO', d.p, pastasCli.get(d.p.split('\\')[0]) ? pastasCli.get(d.p.split('\\')[0]).codigo : null, 'pasta vazia', null, 0.99, 'sem nenhum arquivo nem subpasta', 'nome/pasta', { pasta: true, vazia: true });
  // pastas fora da árvore: uma linha por pasta (o primeiro nível que sai do padrão), com quantos arquivos tem dentro
  const porArquivo = new Map();   // p → { tipo, comp, codigo, achados: [] }
  const vistos = new Set(arquivos.map(a => lower(W.join(raiz, a.p))));
  const tiposCont = {};
  for (const a of arquivos) {
    const partes = a.p.split('\\');
    if (partes.length < 2) { novo('ERRADO-PASTA', a.p, null, 'arquivo solto na raiz ' + raiz, null, 0.95, 'Dicionário §1(c)'); continue; }
    const pc = pastasCli.get(partes[0]);
    const sub = partes.slice(1, -1), nome = partes[partes.length - 1];
    const loc = analisarLocal(sub, nome, pc && pc.cli);
    const reg = { tipo: loc.tipo, comp: loc.comp, compDe: loc.compDe, codigo: pc ? pc.codigo : null, s: a.s, m: a.m };
    porArquivo.set(a.p, reg);
    tiposCont[loc.tipo] = (tiposCont[loc.tipo] || 0) + 1;
    const sugAbs = (s, nomeNovo) => s ? W.join(raiz, partes[0], ...s, nomeNovo || nome) : null;
    for (const x of loc.achados) novo(x.g, a.p, reg.codigo, x.problema, sugAbs(x.sugestao, x.nomeNovo), x.conf, x.ev, 'nome/pasta', x.pastaArquivo ? { pastaFora: partes[0] + '\\' + x.pastaArquivo } : null);
    // o ano: a raiz é a do ano da competência (Vitor, 23/10/2026)
    // as declarações anuais ficam no ano da ENTREGA (Vitor, 23/10/2026): o ano-calendário + 1 (não se lê o recibo aqui)
    // o balancete do mês ("Balancete 292 2026-01.xlsx") não é o anual: fica no ano da competência (26/10/2026: ia para 2027)
    const anual = ANUAIS.test(loc.tipo) && !(loc.comp && loc.comp.mes);
    const anoCerto = loc.comp && loc.comp.ano ? (anual ? loc.comp.ano + 1 : loc.comp.ano) : null;
    if (anoCerto && anoCerto !== anoRaiz) {
      novo('ERRADO-ANO', a.p, reg.codigo, (anual ? 'declaração/livro anual do ano-calendário ' + loc.comp.ano + ' (entregue em ' + anoCerto + ')' : 'competência ' + (loc.comp.mes ? dois(loc.comp.mes) + '-' : '') + loc.comp.ano) + ' na raiz ' + anoRaiz, W.join(W.dirname(raiz), String(anoCerto), a.p), anual ? (loc.tipo === 'BALANCETE' ? 0.7 : 0.85) : loc.compDe === 'nome' ? 0.9 : 0.85, anual ? 'ano da entrega = ano-calendário + 1 (Vitor, 23/10/2026: "no ano da entrega")' : 'pelo ' + (loc.compDe || '?') + '; regra da raiz pelo ano da competência (arquivador-regras, 23/10/2026)');
    }
    // o cliente pelo que os índices sabem do arquivo (sem abrir)
    // na pasta com nome de arquivo, o manifesto aponta para a PASTA ("…\09-2026_NFC-e_31411.xml"): é o registro do arquivo
    const ix = porCaminho.get(lower(W.join(raiz, a.p))) || (COM_EXTENSAO.test(W.dirname(a.p)) ? porCaminho.get(lower(W.join(raiz, W.dirname(a.p)))) : null);
    if (ix) { reg.ix = ix; reg.fontes = ix.fontes; }
    if (pc && pc.codigo != null) {
      const X = pc.codigo;
      const nomesTexto = [nome, ix && ix.nomeOriginal].filter(Boolean).join(' ');
      const docs = R.documentosDoTexto(nomesTexto.replace(/_/g, ' ')).map(d => d.doc).concat((nomesTexto.match(/(?<!\d)\d{14}(?!\d)/g) || []).filter(R.cnpjValido));
      const doNome = new Set(docs.flatMap(d => R.clientesDoDoc(d, cad)));
      // chave de acesso no nome (o SIEG grava "<chave>-nfe.xml"): o CNPJ do emitente está nela
      for (const ch of K.chavesDoTexto(nomesTexto)) if (/^\d{44}$/.test(ch)) { reg.chave = ch; for (const c of R.clientesDoDoc(ch.slice(6, 20), cad)) reg.emitente = c; }
      if (doNome.size && !doNome.has(X)) { reg.suspeito = 'o nome' + (ix && ix.nomeOriginal ? ' (ou o original "' + ix.nomeOriginal + '")' : '') + ' traz o CNPJ de ' + [...doNome].join(', '); }
      // a razão social de OUTRO cliente no nome de uma subpasta ou do arquivo ("356 - A7 COMERCIO\…\EXTRATOS\2026\A7 MOBILE\…")
      if (!reg.suspeito && !pc.outro) {
        const naSub = sub.flatMap(s => clientesNoNome(s, cad));
        // nas notas e XML o nome da outra parte (emitente/tomador) é normal: só a subpasta conta
        const noNome = /NOTA|XML|NFC|NFS|RELATORIO|CT-e|FATURA/.test(loc.tipo) ? [] : clientesNoNome(nome.replace(/\.[a-z0-9]+$/i, '') + (ix && ix.nomeOriginal ? ' ' + ix.nomeOriginal : ''), cad);
        const outros = [...new Set(naSub.concat(noNome))];
        if (outros.length && !outros.includes(X) && !(pc.donos || []).some(d => outros.includes(d))) reg.suspeito = (naSub.length ? 'uma subpasta' : 'o nome') + ' traz a razão social de ' + outros.map(c => c + ' - ' + cad.porCod.get(c).razao).join(', ');
      }
      if (pc.outro != null) {
        const destPasta = cad.pastas.get(pc.outro) || pc.outro + ' - ' + R.nomeSeguro(cad.porCod.get(pc.outro).razao);
        novo('ERRADO-CLIENTE', a.p, X, 'a pasta "' + partes[0] + '" tem o código ' + X + ' (no cadastro: ' + (pc.cli ? pc.cli.razao : '?') + '), mas o nome é do cliente ' + pc.outro, W.join(raiz, destPasta, ...partes.slice(1)), 0.85, 'código antigo da planilha × cadastro atual (arquivador-regras: DOC_CONFIRMADO/confirmado)', 'cadastro');
      }
      if (ix && ix.cliente != null && ix.cliente !== X && !ix.copia) reg.suspeito = 'o arquivador novo decidiu o cliente ' + ix.cliente + ', mas o arquivo está na pasta ' + X;
      if (ix && ix.origem && !reg.suspeito) {
        const o = R.clienteDaPasta(ix.origem, cad);
        if (o && o.codigo !== X && /razão social|só a pasta|nome da pasta/i.test(ix.evidencias || '')) reg.suspeito = 'veio da pasta de origem do cliente ' + o.codigo + ' e foi decidido por ' + (ix.evidencias || '').slice(0, 80);
      }
      if (reg.emitente != null && reg.emitente !== X && /XML|NOTA|NFC|CT-e/i.test(loc.tipo)) reg.verXml = true;   // emitente é outro cliente: só o conteúdo diz se este é o destinatário
      if (reg.suspeito) novo('INCERTO', a.p, X, 'suspeita de outro cliente: ' + reg.suspeito, null, 0.5, 'pelo nome/índice; conferido no conteúdo se entrou na amostra', 'índice', { suspeitaCliente: true });
    }
  }
  // pastas fora do padrão: a primeira pasta de cada caminho que gerou ERRADO-PASTA "fora da árvore" vira um achado de pasta
  const pastaForaConta = new Map();
  for (const x of achados) if (x.pastaFora) pastaForaConta.set(x.pastaFora, (pastaForaConta.get(x.pastaFora) || 0) + 1);
  for (const [p, n] of pastaForaConta) novo('PASTA-FORA-DO-PADRAO', p, (pastasCli.get(p.split('\\')[0]) || {}).codigo, 'pasta fora da árvore canônica, com ' + n + ' arquivo(s)', null, 0.9, '10-AUDITORIA verificação 3', 'nome/pasta', { pasta: true, arquivos: n });

  // duplicados pelo hash que os índices já têm
  const porHash = new Map();
  const anotarHash = (h, p, de) => { if (!h) return; const k = CT.curta(h); if (!porHash.has(k)) porHash.set(k, new Map()); porHash.get(k).set(p, de); };
  for (const [p, r] of porArquivo) if (r.ix && r.ix.h) anotarHash(r.ix.h, p, 'índice');
  const porXk = new Map();
  for (const [p, r] of porArquivo) if (r.ix && r.ix.xk) { if (!porXk.has(r.ix.xk)) porXk.set(r.ix.xk, new Set()); porXk.get(r.ix.xk).add(p); }
  // candidatos pelo nome e tamanho (sem abrir): "X.ext" e "X (n).ext" com o mesmo tamanho na mesma pasta; o mesmo nome e tamanho em pastas diferentes do mesmo cliente
  const grupoNome = new Map();
  for (const [p, r] of porArquivo) {
    if (!r.s) continue;
    const partes = p.split('\\');
    const nomeBase = semSufixo(partes[partes.length - 1]);
    const k1 = lower(partes.slice(0, -1).join('\\')) + '|' + nomeBase + '|' + r.s;
    const k2 = partes[0] + '|*|' + nomeBase + '|' + r.s;
    const k3 = '**|' + nomeBase + '|' + r.s;   // o mesmo nome e tamanho em OUTRO cliente (ex.: as pastas 2026\MM.2026 da 591 e da 602)
    for (const k of r.s >= 10240 ? [k1, k2, k3] : [k1, k2]) { if (!grupoNome.has(k)) grupoNome.set(k, []); grupoNome.get(k).push(p); }
  }
  const candDup = new Map();   // p → motivo
  for (const [k, ps] of grupoNome) {
    if (ps.length < 2) continue;
    if (k.startsWith('**|') && new Set(ps.map(p => p.split('\\')[0])).size < 2) continue;
    for (const p of ps) if (!candDup.has(p)) candDup.set(p, k.startsWith('**|') ? 'mesmo nome e tamanho em OUTRO cliente' : k.includes('|*|') ? 'mesmo nome e tamanho em outra pasta do cliente' : 'mesmo nome (sem o " (n)") e tamanho na mesma pasta');
  }
  tempos.nomePastaMs = Date.now() - t2;
  log('fase 2: ' + achados.length + ' achados por nome/pasta; ' + candDup.size + ' candidatos a duplicado pelo nome+tamanho; ' + [...porHash.values()].filter(m => m.size > 1).length + ' grupos de hash repetido');

  // 3. conteúdo, numa amostra
  const conteudo = { lidos: 0, bytes: 0, pulados: 0, erros: 0, parouNoTeto: false, porTipo: {}, cliente: {}, decisao: {} };
  const shaLido = new Map();
  if (!opcoes.semConteudo) {
    const t3 = Date.now();
    const amostra = +opcoes.amostra || 3000;
    const teto = (+opcoes.tetoGb || 3) * 1073741824;
    const maxArquivo = 15 * 1048576;
    const rnd = aleatorio(+opcoes.semente || 42);
    const ctx = { cadastro: cad, hoje: new Date(), contas: A.lerContas(CONTROLE), clientes: raiz, manifesto: new Map(), chaves: K.carregar({ controle: CONTROLE, manifestoAntigo: MANIFESTO_ANTIGO, raiz }), conteudos: null, manual: null, anoRaiz };
    const fila = [], naFila = new Set();
    const por = (p, porque) => { if (naFila.has(p) || fila.length >= amostra) return; const r = porArquivo.get(p); if (!r || !r.s || r.s > maxArquivo || ATALHO_GOOGLE.test(p) || LIXO.test(W.basename(p))) { conteudo.pulados++; return; } naFila.add(p); fila.push({ p, porque }); };
    // (a) os suspeitos de outro cliente, (b) os XML cujo emitente é outro cliente, (c) os candidatos a duplicado, (d) a amostra por cliente e tipo
    const sus = [...porArquivo].filter(([, r]) => r.suspeito).map(([p]) => p);
    const xmls = [...porArquivo].filter(([, r]) => r.verXml && !r.suspeito).map(([p]) => p);
    const embaralhar = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
    for (const p of embaralhar(sus).slice(0, Math.round(amostra * 0.25))) por(p, 'suspeita de outro cliente');
    for (const p of embaralhar(xmls).slice(0, Math.round(amostra * 0.1))) por(p, 'XML de emitente que é outro cliente');
    // os candidatos a duplicado em GRUPO (todos os do mesmo nome+tamanho), para o sha256 comparar os dois lados
    const cotaDup = fila.length + Math.round(amostra * 0.15);
    const semHash = p => !(porArquivo.get(p).ix && porArquivo.get(p).ix.h);
    for (const [, ps] of embaralhar([...grupoNome].filter(([, ps]) => ps.length > 1 && ps.some(semHash)))) { if (fila.length >= cotaDup) break; for (const p of ps) por(p, 'candidato a duplicado'); }
    // (e) os que estão fora da árvore sem destino conhecido: só o conteúdo diz para onde vão
    const semDestino = embaralhar([...new Set(achados.filter(x => x.g === 'ERRADO-PASTA' && !x.sugestao && !x.pasta).map(x => x.p))]);
    for (const p of semDestino.slice(0, Math.round(amostra * 0.15))) por(p, 'fora da árvore, sem destino conhecido');
    const estratos = new Map();
    for (const [p, r] of porArquivo) { const k = (r.codigo || '?') + '|' + r.tipo; if (!estratos.has(k)) estratos.set(k, []); estratos.get(k).push(p); }
    const listas = embaralhar([...estratos.values()].map(embaralhar));
    for (let rodada = 0; fila.length < amostra; rodada++) { let algum = false; for (const l of listas) { if (rodada < l.length) { algum = true; por(l[rodada], 'amostra por cliente e tipo'); if (fila.length >= amostra) break; } } if (!algum) break; }
    log('fase 3: amostra de ' + fila.length + ' arquivos (' + sus.length + ' suspeitos de outro cliente, ' + xmls.length + ' XML de emitente cliente, ' + candDup.size + ' candidatos a duplicado)');
    const juntas = 6;
    let i = 0;
    const umPorVez = async () => {
      while (i < fila.length) {
        if (conteudo.bytes >= teto) { conteudo.parouNoTeto = true; return; }
        const it = fila[i++];
        const r = porArquivo.get(it.p);
        let buf;
        try { buf = await fs.promises.readFile(W.join(raiz, it.p)); } catch (e) { conteudo.erros++; continue; }
        conteudo.bytes += buf.length; conteudo.lidos++;
        if (conteudo.lidos % 250 === 0) log('  conteúdo: ' + conteudo.lidos + '/' + fila.length + ' lidos, ' + mb(conteudo.bytes));
        try {
          const res = await conferirConteudo({ p: it.p, codigo: r.codigo, tipo: r.tipo }, buf, ctx, cad, raiz);
          shaLido.set(it.p, res.sha); anotarHash(res.sha, it.p, 'lido agora');
          r.conteudo = Object.assign(res.info, { porque: it.porque });
          const t = res.info.tipoConteudo || 'sem tipo';
          conteudo.porTipo[r.tipo] = conteudo.porTipo[r.tipo] || { lidos: 0, comAchado: 0 };
          conteudo.porTipo[r.tipo].lidos++;
          if (res.achados.length) conteudo.porTipo[r.tipo].comAchado++;
          conteudo.cliente[res.info.cliente] = (conteudo.cliente[res.info.cliente] || 0) + 1;
          const dk = (res.info.decisao || '?').split(' → ')[0];
          conteudo.decisao[dk] = (conteudo.decisao[dk] || 0) + 1;
          for (const x of res.achados) novo(x.g, it.p, r.codigo, x.problema, x.sugestao, x.conf, x.ev + ' [tipo pelo conteúdo: ' + t + ']', 'conteúdo');
        } catch (e) { conteudo.erros++; }
      }
    };
    await Promise.all(Array.from({ length: juntas }, umPorVez));
    tempos.conteudoMs = Date.now() - t3;
    log('fase 3: ' + conteudo.lidos + ' lidos, ' + mb(conteudo.bytes) + (conteudo.parouNoTeto ? ' (PAROU NO TETO)' : ''));
  }
  // empresas do MESMO DONO (Vitor, 23/10/2026: a 55 TORRA TORRA e a 174 ARMARINHO): o documento de uma na pasta da outra não
  // é erro grave — valem as regras pelo conteúdo, como um erro de pasta; a suspeita só pelo nome entre elas cai
  for (let k = achados.length - 1; k >= 0; k--) {
    const x = achados[k];
    if (x.pasta || !['ERRADO-CLIENTE', 'INCERTO'].includes(x.g) || x.codigo == null) continue;
    const g = MESMO_DONO.find(gr => gr.includes(+x.codigo));
    const outro = +((/(\d+) - [A-Z]/.exec(x.problema) || [])[1] || NaN);
    if (!g || !g.includes(outro) || outro === +x.codigo) continue;
    if (x.g === 'INCERTO') { achados.splice(k, 1); continue; }
    Object.assign(x, { g: 'ERRADO-PASTA', mesmoDono: true, problema: 'do outro cliente do mesmo dono (' + g.join(' e ') + '), pelas regras: ' + x.problema, ev: x.ev + ' | Vitor, 23/10/2026: ' + g.join(' e ') + ' são do mesmo dono' });
  }
  // o mesmo arquivo com a mesma gravidade pelo nome e pelo conteúdo: um achado só (o que tem destino, a maior confiança)
  juntarRepetidos(achados);
  // a suspeita pelo nome que o conteúdo confirmou ou desmentiu: tira o INCERTO
  for (let k = achados.length - 1; k >= 0; k--) {
    const x = achados[k];
    if (!x.suspeitaCliente) continue;
    const r = porArquivo.get(x.p);
    if (r && r.conteudo && r.conteudo.lido) achados.splice(k, 1);
  }
  // os duplicados: o mesmo sha256 (índices + o que foi lido agora) em mais de um caminho que existe
  const ordemManter = p => { const r = porArquivo.get(p) || {}; const ruins = achados.filter(x => x.p === p && x.g !== 'DUPLICADO').length; return [ruins, / \(\d+\)\.[a-z0-9]+$/i.test(p) ? 1 : 0, r.m || 0]; };
  const cmp = (a, b) => { const x = ordemManter(a), y = ordemManter(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return a.length - b.length; };
  const jaDup = new Set();
  const entreClientes = { grupos: 0, fiscais: 0, foraDoFiscal: 0 };
  const mesmoConteudo = new Map();   // p → os outros caminhos com o mesmo sha256 (o plano: já está no destino certo → quarentena, não mover)
  let gruposDup = 0;
  for (const [h, m] of porHash) {
    const ps = [...m.keys()].filter(p => vistos.has(lower(W.join(raiz, p))));
    if (ps.length < 2) continue;
    gruposDup++;
    ps.sort(cmp);
    // dentro do mesmo cliente: um fica, os outros são duplicados; entre clientes: a regra das duas clientes (a nota entre
    // duas clientes vai para as duas, 23/10/2026; a NFS-e da Nilma também no tomador, 21/10/2026) — no FISCAL é esperado
    const porCli = new Map();
    for (const p of ps) { const c = p.split('\\')[0]; if (!porCli.has(c)) porCli.set(c, []); porCli.get(c).push(p); mesmoConteudo.set(p, ps.filter(q => q !== p)); }
    const ficam = [];
    for (const lista of porCli.values()) {
      const fica = lista[0];
      ficam.push(fica);
      for (const p of lista.slice(1)) {
        const de = m.get(p) === 'lido agora' && m.get(fica) === 'lido agora' ? 'sha256 calculado agora (os dois lidos)' : 'sha256 dos manifestos/índices' + (m.get(p) === 'lido agora' || m.get(fica) === 'lido agora' ? ' + lido agora' : '');
        novo('DUPLICADO', p, (porArquivo.get(p) || {}).codigo, 'o mesmo conteúdo está em ' + fica, 'QUARENTENA', de.includes('agora (os dois') ? 0.99 : 0.9, de + ' ' + h, 'índice', { igualA: W.join(raiz, fica) });
        jaDup.add(p);
      }
    }
    if (ficam.length > 1) {
      entreClientes.grupos++;
      const fiscal = ficam.every(p => N(p.split('\\')[1] || '') === 'FISCAL');
      if (fiscal) entreClientes.fiscais += ficam.length;
      else for (const p of ficam.slice(1)) { novo('INCERTO', p, (porArquivo.get(p) || {}).codigo, 'o mesmo conteúdo também está em outro cliente: ' + ficam.filter(q => q !== p).join(' | '), null, 0.6, 'sha256 ' + h + '; fora do FISCAL a regra das duas clientes não se aplica'); entreClientes.foraDoFiscal++; }
    }
  }
  for (const [xk, set] of porXk) {
    const ps = [...set].filter(p => vistos.has(lower(W.join(raiz, p))) && !jaDup.has(p));
    if (ps.length < 2) continue;
    ps.sort(cmp);
    for (const p of ps.slice(1)) if (p.split('\\')[0] === ps[0].split('\\')[0]) { novo('DUPLICADO', p, (porArquivo.get(p) || {}).codigo, 'o mesmo XML (chave + protocolo) está em ' + ps[0], 'QUARENTENA', 0.85, 'índice de conteúdo do XML', 'índice', { igualA: W.join(raiz, ps[0]), soXml: true }); jaDup.add(p); }
  }
  // candidato pelo nome+tamanho que não foi confirmado nem desmentido pelo hash
  for (const [p, porque] of candDup) {
    if (jaDup.has(p)) continue;
    if (shaLido.has(p)) continue;   // lido: se fosse igual, já apareceu acima
    const r = porArquivo.get(p);
    if (r && r.ix && r.ix.h) continue;   // tem o hash: se fosse igual, já apareceu acima
    novo('INCERTO', p, r ? r.codigo : null, 'possível duplicado: ' + porque + ' (não confirmado pelo conteúdo)', null, 0.5, 'nome+tamanho iguais');
  }

  // fora do plano: o que a migração de 23/10 gravou em 2026 com o ano errado — o outro agente corrige pelo manifesto
  // (corrigir-ano.js, a mesma janela); aqui não se mexe neles
  const excluir = new Set();
  const [jDe, jAte] = String(opcoes.excluirJanela || '2026-10-23T19:10:00Z..2026-10-23T21:30:00Z').split('..');
  CT.cadaLinha(W.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl'), m => {
    if (!m.timestamp || m.timestamp < jDe || m.timestamp >= jAte || m.descarte || m.correcao) return;
    const onde = A.caminhoArquivado(m.destino_final, m.nome_final);
    if (lower(onde).startsWith(lower(raiz) + '\\')) excluir.add(lower(onde.slice(raiz.length + 1)));
  });
  log('fora do plano (migração de 23/10, o outro agente corrige): ' + excluir.size + ' linhas do manifesto; ' + [...porArquivo.keys()].filter(p => excluir.has(lower(p))).length + ' ainda em ' + raiz);

  // grava
  const tFim = Date.now();
  let cacheDepois = null;
  if (cacheAntes) { try { cacheDepois = tamanhoPasta(cacheAntes.pasta); } catch (e) {} }
  const res = resumir({ raiz, anoRaiz, achados, porArquivo, pastasCli, arquivos, pastas, erros, conteudo, est, cad, gruposDup, candDup, entreClientes, mesmoConteudo, shaLido, excluir, nota: opcoes.nota || null, tempos: Object.assign(tempos, { totalMs: tFim - t0 }), infoInv, cacheAntes, cacheDepois, tiposCont });
  gravar(saida, res, achados, porArquivo, log);
  log('pronto: ' + achados.length + ' achados; ' + W.join(saida, 'relatorio.md'));
  await A.encerrarOcr();
  return res;
}

/** Os clientes cuja razão social (sem sufixo, 2+ palavras) aparece inteira num texto curto (nome de pasta ou de arquivo). */
const _nomesCad = new WeakMap();
function clientesNoNome(texto, cad) {
  if (!_nomesCad.has(cad)) {
    const l = [];
    for (const [c, x] of cad.porCod) for (const n of [x.razao].concat(x.outrosNomes || [])) { const k = ' ' + N(R.nomeNormalizado(n)).replace(/&/g, ' E ').replace(/[^A-Z0-9]+/g, ' ').trim() + ' '; if (k.trim().length >= 8 && k.trim().split(' ').length >= 2) l.push([c, k]); }
    _nomesCad.set(cad, l);
  }
  const t = ' ' + N(texto).replace(/&/g, ' E ').replace(/[^A-Z0-9]+/g, ' ').trim() + ' ';
  const achou = new Map();
  for (const [c, k] of _nomesCad.get(cad)) if (t.includes(k) && (!achou.has(c) || k.length > achou.get(c).length)) achou.set(c, k);
  // "ADERLEI DOS SANTOS" (pessoa) dentro de "ADERLEI DOS SANTOS E CIA": vale o mais longo; homônimos (FITO 292/294) ficam todos
  for (const [c1, k1] of [...achou]) for (const [c2, k2] of achou) if (c1 !== c2 && k2.length > k1.length && k2.includes(k1)) { achou.delete(c1); break; }
  return [...achou.keys()];
}

/**
 * A causa provável de um achado: qual regra ou rotina errou. Pelo texto do achado e por quem arquivou (manifestos).
 * Devolve a chave de CAUSAS.
 */
const CAUSAS = {
  BACKFILL_COMPROVANTE: 'O BACKFILL de 27/08/2026 (rotina antiga) registrou no manifesto os comprovantes que já estavam no Drive com o nome do banco ("Comprovante DD-MM-AAAA HHhMMmSSs.pdf"); o 04 manda "Comprovantes [MÊS E ANO].pdf", numerado.',
  RAIZ_FIXA_NOVO: 'Arquivador novo antes da raiz por ano (23/10/2026): a raiz era fixa (RAIZ_CLIENTES = G:\\Meu Drive\\2026) e a migração das PASTAS ANTIGAS levou documentos de 2018-2025 para 2026 (o processo do contínuo em execução, carregado antes da mudança, continuava gravando assim durante a auditoria).',
  RAIZ_FIXA_ANTIGA: 'Rotina antiga: o Dicionário §1(c) tem uma raiz só (G:\\Meu Drive\\2026), então o documento de outro ano entra em 2026 com [ANO] só na subpasta.',
  ANUAL: 'Declarações e livros anuais (DEFIS, DIRF, ECF, balancete, informe) do ano-calendário anterior, entregues em 2026: com a raiz pelo ano da competência vão para a raiz do ano-calendário (regra a confirmar para os anuais).',
  PASTA_COM_NOME_DE_ARQUIVO: 'Rotina antiga (execuções de 08 e 15/10/2026): o manifesto gravou destino_final já com o nome do arquivo e a cópia tratou esse caminho como pasta — criou a pasta "09-2026_NFC-e_31411.xml" e pôs o arquivo dentro dela.',
  MANUAL: 'Pastas criadas à mão (sem rastro em nenhum manifesto): "2026\\MM.2026", "Contrato Social", "Cartão CNPJ", "Documentos Pessoais", "GUIAS FISCAIS/TRABALHISTAS", banco em minúsculas, extrato sem pasta do mês.',
  CODIGO_ANTIGO: 'Código antigo da planilha × cadastro atual: a pasta "591 - ZELO" é do tempo em que a ZELO era a 591; hoje a 591 é a AAP (inativa) e a ZELO é a 602 (matriz). Duas pastas 591 travam o arquivador (PASTA_DO_CLIENTE_DUPLICADA).',
  REGIME: 'Regime da pasta diferente do regime do cadastro (o do nads vale, 21/10/2026): o regime mudou ou o documento foi para a árvore errada.',
  NOME_CRU_XML: 'Rotina antiga (09 e 16/10/2026): eventos de CT-e arquivados com o nome cru do SIEG ("<chave>-evento-310610-001.xml", MDF-e autorizado com CT-e), tipo de evento que o 05d não listava; as regras de hoje dão "[DATA] - MDF-E AUTORIZADO CT-e [Nº].xml".',
  DUPLICADO: 'O mesmo arquivo (sha256 igual) duas vezes no mesmo cliente, com nomes ou pastas diferentes: reenvio do cliente, cópia manual ou as duas rotinas arquivando o mesmo documento.',
  CONTEUDO: 'Achado pelo conteúdo: as regras de hoje (arquivador-regras.js) decidem outro destino que o da época (regra mudou, ou a rotina antiga decidiu pelo nome/pasta de origem).',
  OUTRO_CLIENTE_NOME: 'Suspeita pelo nome (CNPJ ou razão social de outro cliente no nome do arquivo ou de uma subpasta), a conferir no conteúdo.',
  OUTRAS: 'Outros desvios do padrão (nome fora do formato, pasta vazia, grafia).',
  CLIENTE_MANUAL: 'Documento de um cliente posto à mão (sem rastro nos manifestos) na pasta de outro, às vezes numa subpasta com o nome do outro ("356 - A7 COMERCIO\\…\\EXTRATOS\\2026\\A7 MOBILE\\…"), muitas vezes com a cópia certa também no cliente dono.',
  FGTS_ROBO: 'Robô do FGTS no PC (Claude no Chrome, desde 09/10/2026): gravou a MESMA guia (o mesmo PDF, sha256 igual) em clientes diferentes, cada uma com o número de guia do cliente no nome — o PDF baixado não era o do cliente.',
  FGTS_DUAS_REGRAS: 'Duas regras para a guia do FGTS: o robô do DP grava em DEPARTAMENTO PESSOAL\\MM\\FGTS (sem o ano), o 04b e o arquivador em SOCIETÁRIO\\IMPOSTOS\\FGTS\\[ANO]\\[MÊS E ANO].pdf.',
};
function causaDe(a, pa, pastasDeOutro) {
  const quem = quemArquivou(pa);
  if (/\\DEPARTAMENTO PESSOAL\\\d{2}\\FGTS\\/i.test('\\' + a.p + '\\') && (a.g === 'ERRADO-CLIENTE' || /também está em outro cliente/.test(a.problema))) return 'FGTS_ROBO';
  if (/duas regras para a guia do FGTS/.test(a.problema)) return 'FGTS_DUAS_REGRAS';
  if (pastasDeOutro && pastasDeOutro.has(a.p.split('\\')[0]) && (a.g === 'ERRADO-CLIENTE' || a.pasta)) return 'CODIGO_ANTIGO';
  if ((a.g === 'ERRADO-CLIENTE' || /também está em outro cliente|outro cliente/.test(a.problema)) && quem.startsWith('sem rastro')) return 'CLIENTE_MANUAL';
  if (String(a.fase).includes('conteúdo') && !/ficou o nome do banco|pasta com nome de arquivo/.test(a.problema) && a.g !== 'ERRADO-ANO') return 'CONTEUDO';
  if (/ficou o nome do banco/.test(a.problema)) return 'BACKFILL_COMPROVANTE';
  if (a.g === 'ERRADO-ANO') return /anual/.test(a.problema) ? 'ANUAL' : quem === 'arquivador novo' ? 'RAIZ_FIXA_NOVO' : 'RAIZ_FIXA_ANTIGA';
  if (/pasta com nome de arquivo/.test(a.problema)) return 'PASTA_COM_NOME_DE_ARQUIVO';
  if (a.g === 'ERRADO-CLIENTE' && a.fase === 'cadastro' || /código \d+ no cadastro|duas pastas com o mesmo código|mesmo nome e outro código/.test(a.problema)) return 'CODIGO_ANTIGO';
  if (/regime da pasta/.test(a.problema)) return 'REGIME';
  if (a.g === 'DUPLICADO' || /possível duplicado/.test(a.problema)) return 'DUPLICADO';
  if (/suspeita de outro cliente/.test(a.problema)) return 'OUTRO_CLIENTE_NOME';
  if (a.g === 'NOME-FORA-DO-PADRAO' && /\.xml$/i.test(a.p) && /\d{44}/.test(a.p)) return 'NOME_CRU_XML';
  if ((a.g === 'ERRADO-PASTA' || a.g === 'PASTA-FORA-DO-PADRAO' || a.g === 'NOME-FORA-DO-PADRAO') && quem.startsWith('sem rastro') && !/pasta vazia/.test(a.problema)) return 'MANUAL';
  return 'OUTRAS';
}

/** Junta, no lugar, os achados do mesmo arquivo com a mesma gravidade (fica o que tem destino, depois a maior confiança, depois o do conteúdo). */
function juntarRepetidos(achados) {
  const por = new Map(), out = [];
  const peso = x => [x.sugestao ? 1 : 0, x.conf || 0, x.fase === 'conteúdo' ? 1 : 0];
  for (const a of achados) {
    if (a.pasta || a.suspeitaCliente) { out.push(a); continue; }
    const k = a.p + '|' + a.g, b = por.get(k);
    if (!b) { por.set(k, a); out.push(a); continue; }
    const pa = peso(a), pb = peso(b);
    let troca = false;
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) { troca = pa[i] > pb[i]; break; }
    const fase = [...new Set(String(b.fase).split(' + ').concat(String(a.fase).split(' + ')))].join(' + ');
    const outro = troca ? b : a;
    if (troca) Object.assign(b, a);
    b.fase = fase;
    if (b.ev.length < 400) b.ev += ' | também: ' + outro.problema;
  }
  achados.splice(0, achados.length, ...out);
}

/** Quem pôs o arquivo onde ele está, pelos manifestos e diários. */
function quemArquivou(r) {
  if (!r || !r.fontes || !r.fontes.length) return 'sem rastro (manual ou outra rotina)';
  if (r.fontes.includes('arquivador novo') || r.fontes.includes('diário do contínuo')) return 'arquivador novo';
  if (r.fontes.includes('rotina antiga')) return /^BACKFILL/.test((r.ix && r.ix.execucao) || '') ? 'rotina antiga, BACKFILL (já estava no Drive em 27/08)' : 'rotina antiga';
  return 'sem rastro (manual ou outra rotina)';   // só o hash conhecido (visto pelo arquivador novo, duplicatas, índice de conteúdo)
}

function resumir(x) {
  const { achados, porArquivo } = x;
  const pesoG = g => GRAVIDADES.indexOf(g);
  const porG = {}, arqG = {}, porCli = new Map(), porTipo = {}, porProblema = new Map();
  const principal = new Map();   // arquivo → gravidade principal
  for (const a of achados) {
    porG[a.g] = (porG[a.g] || 0) + 1;
    if (!a.pasta) { const atual = principal.get(a.p); if (atual == null || pesoG(a.g) < pesoG(atual)) principal.set(a.p, a.g); }
    const c = a.codigo != null ? a.codigo : '?';
    if (!porCli.has(c)) porCli.set(c, { total: 0 });
    const pc = porCli.get(c); pc.total++; pc[a.g] = (pc[a.g] || 0) + 1;
    const t = (porArquivo.get(a.p) || {}).tipo || (a.pasta ? '(pasta)' : '?');
    porTipo[t] = porTipo[t] || {}; porTipo[t][a.g] = (porTipo[t][a.g] || 0) + 1;
    const chave = a.g + ' · ' + a.problema.replace(/ (está|estão) em .*$/, ' está em outro lugar').replace(/"[^"]*"/g, '"…"').replace(/\d{2}-\d{4}/g, 'MM-AAAA').replace(/\b(19|20)\d{2}\b/g, 'AAAA').replace(/\b\d+\b/g, 'N').replace(/: .*$/, '').slice(0, 140);
    if (!porProblema.has(chave)) porProblema.set(chave, { n: 0, arquivos: new Set(), exemplos: [] });
    const pp = porProblema.get(chave); pp.n++; if (!a.pasta) pp.arquivos.add(a.p); if (pp.exemplos.length < 5) pp.exemplos.push(a);
  }
  for (const g of principal.values()) arqG[g] = (arqG[g] || 0) + 1;
  const porCausa = {};
  const pastasDeOutro = new Set([...x.pastasCli.values()].filter(pc => pc.outro != null).map(pc => pc.nome));
  for (const a of achados) { const c = causaDe(a, porArquivo.get(a.p), pastasDeOutro); porCausa[c] = porCausa[c] || { achados: 0, arquivos: new Set(), g: {} }; porCausa[c].achados++; if (!a.pasta) porCausa[c].arquivos.add(a.p); porCausa[c].g[a.g] = (porCausa[c].g[a.g] || 0) + 1; }
  // estimativa: um movimento por arquivo com ERRADO-CLIENTE/ANO/PASTA; rename por NOME; quarentena por DUPLICADO
  const mover = new Set(), renomear = new Set(), quarentena = new Set(), revisar = new Set(), auto = new Set();
  for (const a of achados) {
    if (a.pasta) continue;
    if (['ERRADO-CLIENTE', 'ERRADO-ANO', 'ERRADO-PASTA'].includes(a.g)) { mover.add(a.p); if (a.conf >= AUTOMATICO && a.sugestao) auto.add(a.p); }
    else if (a.g === 'NOME-FORA-DO-PADRAO') renomear.add(a.p);
    else if (a.g === 'DUPLICADO' && a.sugestao === 'QUARENTENA') quarentena.add(a.p);
    else if (a.g === 'INCERTO' && principal.get(a.p) === 'INCERTO') revisar.add(a.p);
  }
  for (const p of mover) renomear.delete(p);
  // a origem de cada arquivo com achado: quem o pôs lá
  const origem = {}, origemTodos = {};
  for (const [p, g] of principal) { const f = quemArquivou(porArquivo.get(p)); origem[f] = origem[f] || {}; origem[f][g] = (origem[f][g] || 0) + 1; }
  for (const [, r] of porArquivo) { const f = quemArquivou(r); origemTodos[f] = (origemTodos[f] || 0) + 1; }
  // anos (pela competência do nome/pasta)
  const anos = {};
  for (const [, r] of porArquivo) { const a = r.comp && r.comp.ano ? r.comp.ano : 'sem ano'; anos[a] = (anos[a] || 0) + 1; }
  const tamanho = x.arquivos.reduce((s, a) => s + (a.s || 0), 0);
  const ext = {};
  for (const a of x.arquivos) { const e = (/\.([a-z0-9]{1,6})$/i.exec(a.p) || [, '(sem)'])[1].toLowerCase(); ext[e] = (ext[e] || 0) + 1; }
  return Object.assign({}, x, { porCausa, porG, arqG, porCli, porTipo, porProblema, principal, mover, renomear, quarentena, revisar, auto, origem, origemTodos, anos, tamanho, ext });
}

function gravar(saida, r, achados, porArquivo, log) {
  const pesoG = g => GRAVIDADES.indexOf(g);
  const ordenados = achados.slice().sort((a, b) => pesoG(a.g) - pesoG(b.g) || (b.conf - a.conf) || String(a.p).localeCompare(String(b.p)));
  // CSV: um achado por linha (separador ";", UTF-8 com BOM, para abrir no Excel)
  const linhas = ['gravidade;cliente;caminho_atual;problema;destino_sugerido;confianca;evidencia;fase;tipo_pela_pasta;quem_arquivou;causa'];
  const pastasDeOutro = new Set([...r.pastasCli.values()].filter(pc => pc.outro != null).map(pc => pc.nome));
  for (const a of ordenados) {
    const pa = porArquivo.get(a.p) || {};
    const quem = a.pasta ? '' : quemArquivou(pa) + (pa.ix && pa.ix.execucao ? ' [' + pa.ix.execucao + ']' : '');
    linhas.push([a.g, a.codigo, W.join(r.raiz, a.p), a.problema, a.sugestao === 'QUARENTENA' ? 'QUARENTENA (duplicado)' : a.sugestao, a.conf != null ? a.conf.toFixed(2).replace('.', ',') : '', a.ev, a.fase, pa.tipo || '', quem, causaDe(a, pa, pastasDeOutro)].map(csv).join(';'));
  }
  fs.writeFileSync(W.join(saida, 'achados.csv'), '\ufeff' + linhas.join('\r\n'));
  // o plano em SIMULAÇÃO: nada disto foi executado
  // um passo por arquivo: o do achado mais grave; se ele não tem destino seguro e é só de pasta, o renome (no lugar) ainda
  // pode ir; cliente/ano sem destino seguro: o arquivo inteiro fica para revisão. Os repetidos vão para a quarentena só
  // se o executor conferir o sha256 dos dois (o "igualA"). O executor só faz os "automatico".
  const plano = [];
  const ordemG = { 'ERRADO-CLIENTE': 1, 'ERRADO-ANO': 2, 'ERRADO-PASTA': 3, DUPLICADO: 4, 'NOME-FORA-DO-PADRAO': 5 };
  const ETAPA = { 'ERRADO-CLIENTE': 'cliente', 'ERRADO-ANO': 'ano', 'ERRADO-PASTA': 'pasta', DUPLICADO: 'duplicados', 'NOME-FORA-DO-PADRAO': 'renomes' };
  const porArq = new Map();
  for (const a of ordenados) if (!a.pasta && ordemG[a.g]) { if (!porArq.has(a.p)) porArq.set(a.p, []); porArq.get(a.p).push(a); }
  // o que já está, igual, no cliente dono (a subpasta com o nome do outro cliente: "356 - A7 COMERCIO\…\A7 MOBILE\…")
  for (const a of ordenados) {
    if (a.g !== 'INCERTO' || !/também está em outro cliente/.test(a.problema) || porArq.has(a.p)) continue;
    const pa = porArquivo.get(a.p) || {};
    const codigos = [...String(pa.suspeito || '').matchAll(/(\d+) - /g)].map(m => m[1]);
    const la = codigos.length && /uma subpasta/.test(pa.suspeito || '') ? (r.mesmoConteudo.get(a.p) || []).find(q => codigos.some(c => q.startsWith(c + ' - '))) : null;
    if (la) porArq.set(a.p, [{ g: 'ERRADO-CLIENTE', p: a.p, codigo: a.codigo, problema: 'cópia de outro cliente numa subpasta com o nome dele; o original está em ' + la, sugestao: null, conf: 0.95, ev: a.ev, igualA: W.join(r.raiz, la) }]);
  }
  const passoDe = a => {
    const de = W.join(r.raiz, a.p);
    let acao = a.g === 'DUPLICADO' ? 'QUARENTENA' : a.g === 'NOME-FORA-DO-PADRAO' ? 'RENOMEAR' : 'MOVER';
    let para = a.g === 'DUPLICADO' ? null : a.sugestao;
    let porque = a.problema, igualA = a.igualA || null;
    // o mesmo conteúdo JÁ está no cliente/pasta de destino: não move, vai para a quarentena
    if (acao === 'MOVER' && r.mesmoConteudo && r.mesmoConteudo.has(a.p)) {
      const alvoCli = para ? lower(String(para).slice(W.dirname(r.raiz).length + 1).split('\\').slice(1, 2).join('')) : null;
      const la = alvoCli ? r.mesmoConteudo.get(a.p).find(q => lower(q.split('\\')[0]) === alvoCli) : null;
      if (la) { igualA = W.join(r.raiz, la); porque += ' — o mesmo conteúdo já está em ' + la; }
    }
    if (igualA) { acao = 'QUARENTENA'; para = null; }
    const pa = porArquivo.get(a.p) || {};
    let auto = acao === 'QUARENTENA' ? !!igualA && a.conf >= AUTOMATICO : !!para && a.conf >= AUTOMATICO;
    // mover para OUTRO cliente: só com revisão (a quarentena do que já está igual no dono, conferida pelo sha256, pode)
    if (auto && a.g === 'ERRADO-CLIENTE' && acao === 'MOVER') { auto = false; porque += ' — mover entre clientes só com revisão'; }
    // repetido com nome de OUTRA coisa (outra pasta e outro começo de nome: "Fatura_JOSE…" × "Fatura_MAGNO…"): um dos dois
    // está com o nome errado; qual fica é decisão humana
    if (auto && a.g === 'DUPLICADO' && igualA) {
      const cab = s => R.norm(W.basename(s)).replace(/ \(\d+\)(?=\.[A-Z0-9]+$)/, '').replace(/\.[A-Z0-9]+$/, '').split(/ - |_/).slice(0, 2).join(' - ');
      if (lower(W.dirname(de)) !== lower(W.dirname(igualA)) && cab(de) !== cab(igualA)) { auto = false; porque += ' — nomes de coisas diferentes: conferir qual é o certo'; }
    }
    return { ordem: ordemG[a.g], etapa: ETAPA[a.g], gravidade: a.g, acao, de, para, igualA, confianca: a.conf, automatico: auto, porque, evidencia: a.ev, tamanho: pa.s || null, hash: (pa.ix && pa.ix.h) || ((r.shaLido && r.shaLido.get(a.p)) || null) };
  };
  for (const [p, lista] of porArq) {
    const passos = lista.map(passoDe);
    const primeiro = passos[0];
    let feito = primeiro.automatico ? primeiro : null;
    if (!feito && primeiro.gravidade === 'ERRADO-PASTA') feito = passos.find(s => s.automatico && s.acao === 'RENOMEAR') || null;
    const entrada = Object.assign({}, feito || primeiro, { automatico: !!feito });
    entrada.outros = passos.filter(s => s !== (feito || primeiro)).map(s => s.gravidade + ': ' + s.porque).slice(0, 4);
    if (r.excluir && r.excluir.has(lower(p))) Object.assign(entrada, { automatico: false, excluido: 'migração de 23/10 (16:10-18:30): o outro agente corrige pelo manifesto (corrigir-ano.js)' });
    plano.push(entrada);
  }
  plano.sort((a, b) => a.ordem - b.ordem || b.confianca - a.confianca);
  fs.writeFileSync(W.join(saida, 'plano-simulado.jsonl'), plano.map(p => JSON.stringify(p)).join('\n') + '\n');
  // a estimativa sai do plano: um passo por arquivo
  const conta = f => plano.filter(f).length;
  r.estimativa = {
    mover: conta(p => p.acao === 'MOVER'), moverComDestino: conta(p => p.acao === 'MOVER' && p.para), moverAutomatico: conta(p => p.acao === 'MOVER' && p.automatico),
    quarentena: conta(p => p.acao === 'QUARENTENA'), quarentenaJaNoLugarCerto: conta(p => p.acao === 'QUARENTENA' && p.gravidade !== 'DUPLICADO'),
    renomear: conta(p => p.acao === 'RENOMEAR'), revisarHumano: r.revisar.size, automaticos: conta(p => p.automatico),
    excluidosMigracao: conta(p => p.excluido), porEtapa: {},
  };
  for (const p of plano) { const e = r.estimativa.porEtapa[p.etapa] = r.estimativa.porEtapa[p.etapa] || { passos: 0, automaticos: 0, excluidos: 0, porAcao: {} }; e.passos++; if (p.automatico) e.automaticos++; if (p.excluido) e.excluidos++; e.porAcao[p.acao] = (e.porAcao[p.acao] || 0) + 1; }
  // resumo em JSON (para a resposta e para comparar com a próxima auditoria)
  const top = [...r.porProblema].sort((a, b) => b[1].n - a[1].n);
  const resumo = {
    raiz: r.raiz, em: new Date().toISOString(), tempos: r.tempos, inventario: { arquivos: r.arquivos.length, pastas: r.pastas.length, erros: r.erros.length, bytes: r.tamanho, clientes: r.pastasCli.size },
    achadosPorGravidade: r.porG, arquivosPorGravidadePrincipal: r.arqG, arquivosComAchado: r.principal.size,
    estimativa: r.estimativa,
    conteudo: r.conteudo, origemDosAchados: r.origem, origemDeTodos: r.origemTodos, anos: r.anos, indices: r.est, gruposDeHashRepetido: r.gruposDup, copiasEntreClientes: r.entreClientes, porCausa: Object.fromEntries(Object.entries(r.porCausa).map(([c, v]) => [c, { achados: v.achados, arquivos: v.arquivos.size, porGravidade: v.g }])),
    cacheDoDrive: r.cacheAntes ? { antes: r.cacheAntes.bytes, depois: r.cacheDepois ? r.cacheDepois.bytes : null } : null,
    top: top.slice(0, 40).map(([k, v]) => ({ problema: k, achados: v.n, arquivos: v.arquivos.size })),
  };
  fs.writeFileSync(W.join(saida, 'resumo.json'), JSON.stringify(resumo, null, 1));
  fs.writeFileSync(W.join(saida, 'relatorio.md'), relatorioMd(r, top, plano));
  log('gravados: achados.csv (' + (linhas.length - 1) + '), plano-simulado.jsonl (' + plano.length + '), resumo.json, relatorio.md');
}

function relatorioMd(r, top, plano) {
  const L = [];
  const n = v => (v || 0).toLocaleString('pt-BR');
  const seg = ms => ms == null ? '—' : ms < 120000 ? Math.round(ms / 1000) + ' s' : (ms / 60000).toFixed(1) + ' min';
  L.push('# Auditoria de ' + r.raiz, '');
  L.push('Gerada em ' + new Date().toLocaleString('pt-BR') + ' por `robo/arquivador-auditoria.js`. **Só leitura**: nada foi movido, renomeado nem apagado. O plano de correção (fim deste relatório e `plano-simulado.jsonl`) é uma SIMULAÇÃO.', '');
  L.push('## Números', '');
  L.push('| | |', '|---|---|');
  L.push('| Pastas de cliente | ' + n(r.pastasCli.size) + ' |', '| Pastas | ' + n(r.pastas.length) + ' |', '| Arquivos | ' + n(r.arquivos.length) + ' (' + gb(r.tamanho) + ') |');
  L.push('| Arquivos com algum achado | ' + n(r.principal.size) + ' (' + (100 * r.principal.size / Math.max(1, r.arquivos.length)).toFixed(1) + '%) |');
  L.push('| Tempo | inventário ' + seg(r.tempos.inventarioMs != null ? r.tempos.inventarioMs : r.infoInv.ms) + ' · nome/pasta ' + seg(r.tempos.nomePastaMs) + ' · conteúdo ' + seg(r.tempos.conteudoMs) + ' · total desta execução ' + seg(r.tempos.totalMs) + ' |');
  L.push('| Lido do Drive (conteúdo) | ' + n(r.conteudo.lidos) + ' arquivos, ' + mb(r.conteudo.bytes) + (r.conteudo.parouNoTeto ? ' — **parou no teto**' : '') + ' |');
  if (r.cacheAntes) L.push('| Cache do Google Drive no PC | antes ' + mb(r.cacheAntes.bytes) + ', depois ' + (r.cacheDepois ? mb(r.cacheDepois.bytes) : '?') + ' (outros programas também baixam) |');
  if (r.nota) L.push('| Observação | ' + String(r.nota).replace(/\|/g, '/') + ' |');
  L.push('');
  L.push('## Totais por gravidade', '', '| Gravidade | Achados | Arquivos (gravidade principal) |', '|---|---:|---:|');
  for (const g of GRAVIDADES) L.push('| ' + g + ' | ' + n(r.porG[g]) + ' | ' + n(r.arqG[g]) + ' |');
  L.push('', 'Um arquivo pode ter mais de um achado; a "gravidade principal" é a mais grave dele. Os achados de pasta (pasta vazia, código × cadastro) não contam como arquivo.', '');
  L.push('## Os problemas mais comuns', '', '| # | Problema | Achados | Arquivos |', '|---:|---|---:|---:|');
  top.slice(0, 25).forEach(([k, v], i) => L.push('| ' + (i + 1) + ' | ' + k.replace(/\|/g, '/') + ' | ' + n(v.n) + ' | ' + n(v.arquivos.size) + ' |'));
  L.push('', '## Por cliente (top 30)', '', '| Cliente | Achados | ' + GRAVIDADES.join(' | ') + ' |', '|---|---:|' + GRAVIDADES.map(() => '---:').join('|') + '|');
  const nomeCli = c => { for (const pc of r.pastasCli.values()) if (pc.codigo === c) return pc.nome; return String(c); };
  [...r.porCli].sort((a, b) => b[1].total - a[1].total).slice(0, 30).forEach(([c, v]) => L.push('| ' + nomeCli(c).replace(/\|/g, '/') + ' | ' + n(v.total) + ' | ' + GRAVIDADES.map(g => n(v[g])).join(' | ') + ' |'));
  L.push('', '## Por tipo de documento (pela pasta)', '', '| Tipo | ' + GRAVIDADES.join(' | ') + ' |', '|---|' + GRAVIDADES.map(() => '---:').join('|') + '|');
  Object.entries(r.porTipo).sort((a, b) => Object.values(b[1]).reduce((s, x) => s + x, 0) - Object.values(a[1]).reduce((s, x) => s + x, 0)).slice(0, 30).forEach(([t, v]) => L.push('| ' + t + ' | ' + GRAVIDADES.map(g => n(v[g])).join(' | ') + ' |'));
  L.push('', '## Quem arquivou (pelos manifestos e diários)', '', '| Origem | Arquivos no Drive | Com achado: ' + GRAVIDADES.join(' / ') + ' |', '|---|---:|---|');
  for (const [f, tot] of Object.entries(r.origemTodos).sort((a, b) => b[1] - a[1])) L.push('| ' + f + ' | ' + n(tot) + ' | ' + GRAVIDADES.map(g => n((r.origem[f] || {})[g])).join(' / ') + ' |');
  L.push('', '## Causas prováveis', '', '| Causa | Achados | Arquivos | Por gravidade |', '|---|---:|---:|---|');
  for (const [c, v] of Object.entries(r.porCausa).sort((a, b) => b[1].achados - a[1].achados)) L.push('| ' + CAUSAS[c].replace(/\|/g, '/') + ' | ' + n(v.achados) + ' | ' + n(v.arquivos.size) + ' | ' + Object.entries(v.g).map(([g, k]) => g + ' ' + n(k)).join(', ') + ' |');
  L.push('', '## Empresas do mesmo dono', '', MESMO_DONO.map(g => g.join(' e ')).join('; ') + ' são do mesmo dono (Vitor, 23/10/2026): o documento de uma na pasta da outra não é erro grave; vale o destino que as regras dão pelo conteúdo (entra como ERRADO-PASTA, etapa "pasta"). Achados assim nesta rodada: ' + n(r.achados.filter(a => a.mesmoDono).length) + '.');
  L.push('', '## Cópias entre clientes', '', 'O mesmo conteúdo em mais de um cliente: ' + n(r.entreClientes.grupos) + ' grupos; ' + n(r.entreClientes.fiscais) + ' arquivos no FISCAL (esperado: a regra das duas clientes e a NFS-e da Nilma no tomador; não contam como achado); ' + n(r.entreClientes.foraDoFiscal) + ' fora do FISCAL (INCERTO).');
  L.push('', '## Anos (competência pelo nome ou pela pasta)', '', Object.entries(r.anos).sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([a, v]) => a + ': ' + n(v)).join(' · '), '');
  L.push('## Conteúdo (amostra)', '');
  L.push('Lidos ' + n(r.conteudo.lidos) + ' arquivos (' + mb(r.conteudo.bytes) + '); ' + n(r.conteudo.pulados) + ' pulados (grandes > 15 MB, atalhos do Google, lixo); ' + n(r.conteudo.erros) + ' erros de leitura.', '');
  L.push('Cliente pelo conteúdo: ' + Object.entries(r.conteudo.cliente).map(([k, v]) => k + ' ' + n(v)).join(' · '), '');
  L.push('Decisão das regras com a pasta atual como pista: ' + Object.entries(r.conteudo.decisao).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + n(v)).join(' · '), '');
  L.push('| Tipo (pela pasta) | Lidos | Com achado |', '|---|---:|---:|');
  Object.entries(r.conteudo.porTipo).sort((a, b) => b[1].lidos - a[1].lidos).forEach(([t, v]) => L.push('| ' + t + ' | ' + n(v.lidos) + ' | ' + n(v.comAchado) + ' (' + Math.round(100 * v.comAchado / Math.max(1, v.lidos)) + '%) |'));
  L.push('', '## Exemplos de cada problema', '');
  for (const [k, v] of top.slice(0, 30)) {
    L.push('**' + k + '** (' + n(v.n) + ')', '');
    for (const a of v.exemplos.slice(0, 3)) L.push('- `' + a.p + '` — ' + a.problema + (a.sugestao && a.sugestao !== 'QUARENTENA' ? ' → `' + a.sugestao + '`' : a.sugestao === 'QUARENTENA' ? ' → quarentena' : '') + ' (confiança ' + (a.conf != null ? a.conf.toFixed(2) : '?') + (a.ev ? '; ' + a.ev.slice(0, 160) : '') + ')');
    L.push('');
  }
  L.push('## Estimativa de quantos arquivos teriam de ser mexidos', '');
  const e = r.estimativa;
  L.push('- mover (cliente, ano ou pasta errados): **' + n(e.mover) + '** (' + n(e.moverComDestino) + ' com destino sugerido; ' + n(e.moverAutomatico) + ' com confiança ≥ ' + AUTOMATICO + ')');
  L.push('- para a quarentena: **' + n(e.quarentena) + '** (' + n(e.quarentena - e.quarentenaJaNoLugarCerto) + ' duplicados no mesmo cliente; ' + n(e.quarentenaJaNoLugarCerto) + ' no lugar errado mas com o mesmo conteúdo já no lugar certo)');
  L.push('- só renomear (no lugar certo, nome fora do padrão): **' + n(e.renomear) + '**');
  L.push('- revisão humana (INCERTO, sem outro achado mais grave): **' + n(r.revisar.size) + '**', '');
  L.push('## Plano de correção (SIMULAÇÃO, não executado)', '');
  const porOrdem = {};
  for (const p of plano) { const k = p.ordem + '. ' + p.gravidade + ' (' + p.acao + ')'; porOrdem[k] = porOrdem[k] || { total: 0, auto: 0, excl: 0 }; porOrdem[k].total++; if (p.automatico) porOrdem[k].auto++; if (p.excluido) porOrdem[k].excl++; }
  for (const [k, v] of Object.entries(porOrdem).sort()) L.push('- ' + k + ': ' + n(v.total) + ' passos, ' + n(v.auto) + ' automáticos (confiança ≥ ' + AUTOMATICO + ' e destino conhecido)' + (v.excl ? ', ' + n(v.excl) + ' fora (migração: o outro agente corrige)' : ''));
  L.push('', 'ERRADO-ANO não entra nesta correção (etapa "ano"): a migração o outro agente corrige pelo manifesto; o resto espera a raiz por ano. Executor: `robo/arquivador-correcao.js` (etapas zelo, cliente, pasta, duplicados, renomes).');
  L.push('', 'Os passos estão em `plano-simulado.jsonl` (de, para, confiança, por quê), na ordem: os graves primeiro.', '');
  L.push('### Como executar com segurança (quando aprovado)', '');
  L.push('1. **Antes de tudo:** desligar o arquivador contínuo e a rotina antiga (a trava `_execucao.lock` e o `config.json` do arquivador novo em "desligado") e refazer o inventário (`--reinventariar`): o plano só vale para o Drive como ele está.');
  L.push('2. **Ordem** (`arquivador-correcao.js`): (a) zelo — a troca ZELO × AAP (feita em 23/10/2026: a ZELO é a 591, a AAP a 602; "591 - AAP" → "602 - AAP", a 602-ZELO juntada na 591-ZELO); (b) cliente — ERRADO-CLIENTE, só com confiança ≥ 0,9 ou revisão humana; (c) pasta — ERRADO-PASTA (pastas com nome de arquivo, regime, mês, pastas manuais); (d) duplicados para a quarentena; (e) renomes (no lugar, por último). ERRADO-ANO fica fora (a migração o outro agente corrige; o resto espera a raiz por ano).');
  L.push('3. **Mover sempre por rename dentro do G:** (`fs.renameSync`, o mesmo `mover()` do arquivador novo): no Google Drive é só trocar a pasta no servidor, sem baixar nem subir. Nunca sobrescrever: destino ocupado com outro conteúdo → " (N)" (Dicionário §2); destino com o mesmo conteúdo → o de origem vira duplicado e vai para a quarentena.');
  L.push('4. **Registrar cada passo** numa linha do manifesto do arquivador novo (`%LOCALAPPDATA%\\nads\\arquivador-novo\\MANIFESTO\\manifesto.jsonl`, `id_execucao` "CORRECAO-AAAAMMDD-…", com `de`, `destino_final`, `nome_final`, hash quando conhecido) e no índice de conteúdo/chaves, para o "já arquivado" e os eventos acharem o lugar novo.');
  L.push('5. **Duplicados:** nunca apagar. Quarentena DENTRO do G: (rename, sem baixar), numa pasta que nenhuma rotina varre — recomendo `G:\\Meu Drive\\CLAUDE FAVOR NÃO MEXER\\QUARENTENA-AUDITORIA\\<DD-MM-AAAA>\\<caminho relativo>` (a quarentena do arquivador novo fica no C:, e mover do G: para o C: é baixar). Só depois de conferir o sha256 dos DOIS arquivos (no plano, "automatico" só quando os dois foram lidos e o sha256 conferiu agora; o hash dos manifestos é de quando foram gravados); retenção de 7 dias antes de qualquer purga, como o Dicionário §1.');
  L.push('6. **Em lotes pequenos** (ex.: 200 por vez, por cliente), conferindo depois de cada lote que o arquivo existe no destino com o mesmo tamanho; parar no primeiro erro. Os INCERTO e os de confiança < 0,9 vão para a fila de decisão do admin no nads (como o arquivador-manual), nunca no automático.');
  L.push('7. **Pastas vazias** só no fim, e só as que continuarem vazias (o Drive recria pasta vazia sozinho: 01, Fase 8).', '');
  return L.join('\n') + '\n';
}

module.exports = { auditar, analisarLocal, analisarPastaCliente, mesesDoNome, conferirConteudo, ARVORE_COMPLETA, NOMES };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const saida = valor('--saida') || process.env.AUD_SAIDA || W.join(os.tmpdir(), 'auditoria-2026');
  auditar({ saida, raiz: valor('--raiz'), amostra: valor('--amostra'), tetoGb: valor('--teto-gb'), semente: valor('--semente'), reinventariar: a.includes('--reinventariar'), soInventario: a.includes('--so-inventario'), semConteudo: a.includes('--sem-conteudo'), semMedirCache: a.includes('--sem-medir-cache'), nota: valor('--nota') })
    .catch(e => { console.error(e); process.exitCode = 1; });
}
