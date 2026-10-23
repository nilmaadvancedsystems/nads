// Corrige o ANO da raiz do que o arquivador novo arquivou em G:\Meu Drive\2026 numa janela de tempo (23/10/2026: das
// 16:14 às 17:45 o robô arquivou 920 arquivos da migração em 2026, antes da raiz pelo ano da competência).
//
// Para cada linha do manifesto do arquivador novo na janela: lê o arquivo onde ele está (confere o hash), decide de novo
// pelas regras de agora (a raiz pelo ano da competência, o mapa da migração) com o caminho de origem que ele tinha, e:
//   - o ano é 2026: fica onde está;
//   - outro ano: MOVE (rename dentro do G:, sem sobrescrever) para G:\Meu Drive\<AAAA>\…, com uma linha no manifesto
//     ("corrigido o ano: 2026 → 2021"); o mesmo conteúdo já no destino certo: o de 2026 vai para a quarentena;
//   - as regras não chegam a um destino agora (sem o ano, a pasta do ano sem o CNPJ…): fica, e entra na lista.
// As cópias (NFS-e da Nilma, duas clientes) e os de dentro de um compactado: o mesmo, pelo cliente da linha.
//
//   node corrigir-ano.js --de 2026-10-23T19:10:00Z --ate 2026-10-23T21:30:00Z [--aplicar] [--saida <pasta>]
// Sem --aplicar: só a lista (corrigir-ano.jsonl e o resumo), nada é mexido.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./arquivador-novo');
const R = require('./arquivador-regras');
const K = require('./arquivador-chaves');
const MIG = require('./arquivador-migracao');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const DE = arg('--de'), ATE = arg('--ate', '9999');
const APLICAR = process.argv.includes('--aplicar');
const CONTROLE = arg('--controle', A.CONTROLE);
const CLIENTES = arg('--clientes', R.RAIZ_CLIENTES);
const SAIDA = arg('--saida', path.join(CONTROLE, 'correcao-do-ano'));
const EXCLUIR = new Set(String(arg('--excluir-clientes', '591,602')).split(',').map(Number).filter(Boolean));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const log = (...m) => console.log(new Date().toLocaleTimeString('pt-BR'), ...m);
const ler = a => { try { return fs.readFileSync(a, 'utf8').split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } };
const raizDoAno = ano => path.join(path.dirname(CLIENTES), String(ano));

(async () => {
  if (!DE) { console.log('uso: node corrigir-ano.js --de <ISO> [--ate <ISO>] [--aplicar]'); process.exit(1); }
  fs.mkdirSync(SAIDA, { recursive: true });
  const arqManifesto = path.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl');
  const linhas = ler(arqManifesto).filter(r => r.timestamp >= DE && r.timestamp < ATE && !r.descarte && !r.correcao && String(r.destino_final || '').toLowerCase().startsWith(CLIENTES.toLowerCase() + '\\'));
  const diario = [];
  for (const f of fs.readdirSync(path.join(CONTROLE, 'continuo')).filter(n => /^decisoes-\d{4}-\d{2}\.jsonl$/.test(n))) diario.push(...ler(path.join(CONTROLE, 'continuo', f)).filter(r => r.em >= DE && r.em < ATE && r.modo === 'PRODUCAO'));
  const relPeloHash = new Map(diario.filter(r => r.hash).map(r => [r.hash, r.rel]));
  log('na janela: ' + linhas.length + ' linhas do manifesto, ' + diario.length + ' decisões em produção no diário');
  const manifestoAntigo = path.join(process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio', '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
  const cadastro = A.carregarCadastro({ controle: CONTROLE, clientes: CLIENTES });
  const chaves = K.carregar({ controle: CONTROLE, manifestoAntigo, raiz: CLIENTES }); chaves.arquivo = null;
  const ctx = { cadastro, hoje: new Date(), clientes: CLIENTES, contas: A.lerContas(CONTROLE), manifesto: A.indiceDoManifesto(manifestoAntigo), chaves, reservados: new Map(), existe: new Map(), hashes: new Map(), conteudos: null };
  const out = [];
  const conta = {};
  const anotar = (x) => { out.push(x); conta[x.situacao] = (conta[x.situacao] || 0) + 1; };
  const quarentena = path.join(CONTROLE, 'QUARENTENA', 'correcao-do-ano-' + new Date().toISOString().slice(0, 10));
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i];
    if (i % 50 === 0) log(i + '/' + linhas.length + ' ' + JSON.stringify(conta));
    const atual = A.caminhoArquivado(m.destino_final, m.nome_final);
    const base = { atual, cliente: m.cliente, tipo: m.tipo, hash: m.hash_origem, linha: m.timestamp };
    // os clientes deixados para depois (23/10/2026: a ZELO, até a junção das pastas 602 → 591)
    if (EXCLUIR.has(Number(m.cliente)) || /\\(591|602) - /.test(atual)) { anotar(Object.assign(base, { situacao: 'FICA_EXCLUIDO', motivo: 'cliente deixado para depois (--excluir-clientes)' })); continue; }
    let buf;
    try { buf = fs.readFileSync(atual); } catch (e) { anotar(Object.assign(base, { situacao: 'SUMIU', motivo: e.code || e.message })); continue; }
    if (sha(buf) !== m.hash_origem) { anotar(Object.assign(base, { situacao: 'MUDOU', motivo: 'o hash não confere com o do manifesto' })); continue; }
    const rel = m.origem || relPeloHash.get(m.hash_origem) || m.nome_original;
    const nome = path.win32.basename(rel);
    let d;
    try {
      const entrada = await A.montarEntrada(nome, rel, buf);
      d = R.decidir(entrada, ctx);
      if (d.acao === 'NAO_IDENTIFICADO') { const mg = MIG.decidir(entrada, ctx, d); if (mg) d = mg; }
    } catch (e) { anotar(Object.assign(base, { rel, situacao: 'ERRO', motivo: e.message })); continue; }
    base.rel = rel;
    if (d.acao !== 'ARQUIVAR') { anotar(Object.assign(base, { situacao: 'FICA_SEM_DESTINO', motivo: d.motivo || d.acao, evidencia: (d.evidencias || []).slice(-1)[0] || '' })); continue; }
    // a linha é o principal ou uma cópia (pelo cliente)
    const copia = Number(m.cliente) !== Number(d.cliente) ? (d.copias || []).find(c => Number(c.cliente) === Number(m.cliente)) : null;
    if (Number(m.cliente) !== Number(d.cliente) && !copia) { anotar(Object.assign(base, { situacao: 'FICA_OUTRO_CLIENTE', motivo: 'as regras de agora dão o cliente ' + d.cliente + ' (a linha é do ' + m.cliente + ')' })); continue; }
    const alvoRel = copia ? copia.destinoRelativo : d.destinoRelativo;
    const ano = (copia && copia.anoRaiz) || d.anoRaiz;
    const atualRel = path.win32.relative(CLIENTES, path.win32.dirname(atual));
    const mesmoCaminho = atualRel.toLowerCase() === String(alvoRel).toLowerCase() && path.win32.basename(atual).toLowerCase() === String(d.nomeFinal).toLowerCase();
    if (!ano || +ano === R.ANO_DAS_PASTAS) { anotar(Object.assign(base, { situacao: mesmoCaminho ? 'FICA_2026' : 'FICA_2026_OUTRO_CAMINHO', ano: ano || null, certo: mesmoCaminho ? null : alvoRel + '\\' + d.nomeFinal })); continue; }
    const hx = /\.xml$/i.test(nome) ? A.conteudoXml(buf) : null;
    const c = A.conferirDestino({ destinoRelativo: alvoRel, nomeFinal: d.nomeFinal, raiz: raizDoAno(ano) }, m.hash_origem, ctx, !!copia, hx);
    anotar(Object.assign(base, { situacao: c.situacao === 'JA_ARQUIVADO' ? 'DUPLICADO_NO_ANO_CERTO' : 'MOVER', ano, para: c.onde.replace(/ \(neste lote\)$/, ''), mesmoCaminhoRelativo: atualRel.toLowerCase() === String(alvoRel).toLowerCase(), pastaNova: !!(copia ? copia.criarPastaCliente : d.criarPastaCliente) }));
  }
  const arqLista = path.join(SAIDA, 'corrigir-ano.jsonl');
  fs.writeFileSync(arqLista, out.map(x => JSON.stringify(x)).join('\n') + '\n');
  log('lista: ' + JSON.stringify(conta) + ' → ' + arqLista);
  if (!APLICAR) { try { await A.encerrarOcr(); } catch (e) { /* segue */ } process.exit(0); }
  // aplicar: rename dentro do G:, sem sobrescrever; o duplicado vai para a quarentena; tudo com a linha no manifesto
  const feitos = { movidos: 0, quarentena: 0, erros: 0 };
  const linha = o => fs.appendFileSync(arqManifesto, JSON.stringify(o) + '\n');
  for (const x of out) {
    try {
      if (x.situacao === 'MOVER') {
        if (fs.existsSync(x.para)) throw new Error('o destino certo apareceu no meio: ' + x.para);
        const st = fs.statSync(x.atual);
        fs.mkdirSync(path.dirname(x.para), { recursive: true });
        fs.renameSync(x.atual, x.para);
        if (fs.statSync(x.para).size !== st.size) throw new Error('o tamanho não confere depois do rename: ' + x.para);
        linha({ hash_origem: x.hash, hash_original: x.hash, nome_original: path.win32.basename(x.rel || x.atual), destino_final: path.dirname(x.para), nome_final: path.basename(x.para), id_execucao: 'CORRECAO-ANO-' + new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(), tipo: x.tipo, cliente: x.cliente, movido: true, correcao: { de: x.atual, ano: '2026 → ' + x.ano, motivo: 'corrigido o ano: 2026 → ' + x.ano + ' (a raiz pelo ano da competência)' } });
        x.feito = 'movido'; feitos.movidos++;
      } else if (x.situacao === 'DUPLICADO_NO_ANO_CERTO') {
        const alvo = path.join(quarentena, path.win32.relative(CLIENTES, x.atual));
        fs.mkdirSync(path.dirname(alvo), { recursive: true });
        const buf = fs.readFileSync(x.atual);
        fs.writeFileSync(alvo, buf, { flag: 'wx' });
        if (sha(fs.readFileSync(alvo)) !== x.hash) throw new Error('a cópia para a quarentena não conferiu: ' + alvo);
        fs.unlinkSync(x.atual);
        linha({ hash_origem: x.hash, hash_original: x.hash, nome_original: path.win32.basename(x.atual), destino_final: path.dirname(alvo), nome_final: path.basename(alvo), id_execucao: 'CORRECAO-ANO-' + new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(), tipo: 'DESCARTE', cliente: null, descarte: true, correcao: { de: x.atual, motivo: 'corrigido o ano: o mesmo conteúdo já está em ' + x.para + '; o de 2026 foi para a quarentena' } });
        x.feito = 'quarentena'; feitos.quarentena++;
      }
    } catch (e) { x.feito = 'erro: ' + e.message; feitos.erros++; log('erro em ' + x.atual + ': ' + e.message); }
  }
  fs.writeFileSync(path.join(SAIDA, 'corrigir-ano-aplicado.jsonl'), out.map(x => JSON.stringify(x)).join('\n') + '\n');
  log('aplicado: ' + JSON.stringify(feitos));
  try { await A.encerrarOcr(); } catch (e) { /* segue */ }
  process.exit(feitos.erros ? 2 : 0);
})().catch(e => { console.log('erro:', e.stack); process.exit(1); });
