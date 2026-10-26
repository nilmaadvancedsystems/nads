// O robô do suporte de leitura do nads, NESTE PC, com o Claude instalado aqui (Vitor, 20/10/2026: o suporte que investiga o
// arquivo que o sistema leu errado ou que travou, para o bug não tomar o tempo dele).
//
// De ponta a ponta:
//   1. a pessoa conversa no balão do nads (cápsulas → instruções); não resolveu, o balão grava o bug em feedbacks/{id}
//      (tipo 'bug', analise 'pendente', a conversa, a empresa, a tela) e o arquivo em feedbacks/{id}/partes;
//   2. aqui: pega o bug (transação: analise 'analisando'), espera os pedaços do arquivo e grava o arquivo numa pasta
//      temporária;
//   3. roda o leitor do nads sobre ele (suporte-ler.js: o mesmo código do site) e entrega ao Claude o contexto e o
//      resumo da leitura;
//   4. o Claude investiga o código do leitor e escreve o report, que termina em "Realmente, isso é erro do sistema" ou
//      "Precisa da sua análise"; o report vai para o feedback (analise 'pronta') e aparece para o admin na aba Bugs.
//
// O QUE O CLAUDE PODE FAZER AQUI: só LER — o código do nads (Read, Grep, Glob), o arquivo do bug e rodar o leitor
// (`node robo/suporte-ler.js`, e nada mais). Não edita arquivo, não roda outro comando, não fala com banco nem internet:
// as ferramentas ficam travadas na linha de comando (--tools / --allowedTools / dontAsk), não só no pedido.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CLAUDE = process.env.CLAUDE_EXE || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const MODELO = process.env.SUPORTE_MODELO || 'claude-opus-5-5';
const RAIZ = path.join(__dirname, '..');
const PASTA = path.join(os.tmpdir(), 'nads-suporte');
const LIMITE_MS = 15 * 60000;
const ESPERA_DOS_PEDACOS_MS = 3 * 60000;

const VEREDITOS = ['Realmente, isso é erro do sistema', 'Precisa da sua análise'];

const INSTRUCOES = [
  'Você é o suporte de leitura do nads, o sistema do escritório de contabilidade Nilma (React + TypeScript; os leitores de arquivo ficam em packages/core/src).',
  'Uma pessoa da equipe conversou no balão do suporte, seguiu as instruções e o problema continuou. Sua tarefa é INVESTIGAR e escrever um report para o Vitor (o desenvolvedor). Você não corrige nada: não tem ferramenta para editar.',
  'Você pode: ler o código (Read, Grep, Glob), ler o arquivo do bug e rodar o leitor do nads sobre ele com `node robo/suporte-ler.js "<arquivo>" <ano>` (é o único comando permitido).',
  'Escopo: só leitura de arquivo (extrato em PDF/OFX/planilha, razão, balancete, relatório de notas) — o arquivo lido errado, o mês errado, o lançamento faltando, a importação que travou ou demorou. Tela, regra de negócio ou funcionalidade nova não é com você.',
  'Investigue de verdade: compare o que o arquivo diz (saldo anterior, saldo final, totais, período, as linhas) com o que o nads leu; ache a regra do leitor que falha e cite arquivo:linha.',
  'Escreva o report em português, direto e curto, nesta ordem: **O que a pessoa viu** · **O arquivo × a leitura** (os números) · **A causa** (arquivo:linha) · **A correção** (o que mudar no leitor, em poucas linhas; sem código longo).',
  'Nunca invente: se não conseguiu reproduzir, diga isso.',
  'A ÚLTIMA linha do report é exatamente uma destas duas, sozinha:',
  '- "Realmente, isso é erro do sistema" — quando o arquivo é válido e o leitor do nads leu errado (ou travou);',
  '- "Precisa da sua análise" — quando o arquivo não é o esperado, a pessoa quer outro jeito de ler ou mudar o fluxo, ou é algo novo.',
].join('\n');

// Sem as variáveis de uma sessão do Claude que por acaso tenha ligado este programa (a mesma regra do arquivador).
function ambienteLimpo() {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach(k => { if (/^CLAUDE_?CODE|^CLAUDECODE$|^ANTHROPIC_/.test(k)) delete env[k]; });
  return env;
}

/** O que o Claude escreveu (o texto final), ou o erro. */
function perguntarAoClaude(pedido, pastaDoArquivo) {
  return new Promise((resolve, reject) => {
    const args = ['-p', pedido, '--model', MODELO, '--append-system-prompt', INSTRUCOES,
      '--tools', 'Read,Grep,Glob,Bash', '--allowedTools', 'Read,Grep,Glob,Bash(node robo/suporte-ler.js:*)',
      '--permission-mode', 'dontAsk', '--add-dir', pastaDoArquivo, '--setting-sources', 'project',
      '--strict-mcp-config', '--no-session-persistence', '--output-format', 'text'];
    const filho = spawn(CLAUDE, args, { cwd: RAIZ, env: ambienteLimpo(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '', erro = '';
    const fim = setTimeout(() => { filho.kill(); reject(new Error('o Claude passou de ' + LIMITE_MS / 60000 + ' minutos')); }, LIMITE_MS);
    filho.stdout.on('data', d => { saida += d; });
    filho.stderr.on('data', d => { erro += d; });
    filho.on('error', err => { clearTimeout(fim); reject(err); });
    filho.on('close', codigo => {
      clearTimeout(fim);
      if (codigo === 0 && saida.trim()) resolve(saida.trim());
      else reject(new Error('o Claude saiu com ' + codigo + ': ' + (erro || saida).slice(-500)));
    });
  });
}

/** O resumo da leitura do arquivo pelo nads (suporte-ler.js), em texto. */
function lerComONads(arquivo, ano) {
  return new Promise(resolve => {
    const filho = spawn(process.execPath, [path.join(__dirname, 'suporte-ler.js'), arquivo, String(ano)], { cwd: RAIZ, windowsHide: true });
    let saida = '';
    const fim = setTimeout(() => { filho.kill(); resolve('{"erro":"o leitor do nads passou de 3 minutos (travou?)"}'); }, 3 * 60000);
    filho.stdout.on('data', d => { saida += d; });
    filho.on('close', () => { clearTimeout(fim); resolve(saida.trim() || '{"erro":"o leitor não respondeu"}'); });
    filho.on('error', err => { clearTimeout(fim); resolve(JSON.stringify({ erro: err.message })); });
  });
}

/** Os pedaços dos arquivos, na ordem (esperando chegarem todos). */
async function pedacosDoBug(ref, esperadas) {
  const ate = Date.now() + ESPERA_DOS_PEDACOS_MS;
  for (;;) {
    const s = await ref.collection('partes').get();
    if (s.size >= esperadas) {
      return s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(d => Buffer.from(d.get('dados').toUint8Array ? d.get('dados').toUint8Array() : d.get('dados')));
    }
    if (Date.now() > ate) throw new Error('o arquivo não chegou inteiro (' + s.size + ' de ' + esperadas + ' pedaços)');
    await new Promise(r => setTimeout(r, 5000));
  }
}

function iniciarSuporteClaude({ db, log = console.log }) {
  if (!fs.existsSync(CLAUDE)) { log('[suporte] sem o Claude neste PC (' + CLAUDE + '): desligado'); return () => {}; }
  const fila = db.collection('feedbacks').where('tipo', '==', 'bug').where('analise', '==', 'pendente');
  let ocupado = false;
  const esperando = [];

  async function investigar(ref) {
    // pega o bug (só um robô investiga cada um)
    const pegou = await db.runTransaction(async t => {
      const s = await t.get(ref);
      if (!s.exists || s.get('analise') !== 'pendente') return null;
      t.update(ref, { analise: 'analisando', analisandoEm: new Date().toISOString(), analisandoNo: os.hostname() });
      return s.data();
    });
    if (!pegou) return;
    const id = ref.id;
    log('[suporte] investigando', id, pegou.contexto && pegou.contexto.empresa, '·', pegou.caminho);
    const pasta = path.join(PASTA, id);
    try {
      fs.mkdirSync(pasta, { recursive: true });
      const ctx = pegou.contexto || {};
      const ano = (ctx.meses && ctx.meses[0] && Number(ctx.meses[0].slice(0, 4))) || new Date().getFullYear();
      // um ou mais arquivos (26/10/2026: o balão anexa vários): cada um com os pedaços dele (de, partes); o de antes, um só
      const lista = pegou.arquivo && pegou.arquivo.partes
        ? (Array.isArray(pegou.arquivo.arquivos) ? pegou.arquivo.arquivos : [{ nome: pegou.arquivo.nome, de: 0, partes: pegou.arquivo.partes }]) : [];
      const arquivos = [];
      const leituras = [];
      if (lista.length) {
        const total = Number(pegou.arquivo.total) || lista.reduce((t, a) => t + (Number(a.partes) || 0), 0);
        const pedacos = await pedacosDoBug(ref, total);
        for (const a of lista) {
          const nome = String(a.nome || 'arquivo').replace(/[\\/:*?"<>|]/g, '_');
          const arq = path.join(pasta, nome);
          const de = Number(a.de) || 0;
          fs.writeFileSync(arq, Buffer.concat(pedacos.slice(de, de + (Number(a.partes) || 0))));
          arquivos.push(arq);
          leituras.push((lista.length > 1 ? '### ' + nome + '\n' : '') + await lerComONads(arq, ano));
        }
      }
      const leitura = leituras.length ? leituras.join('\n\n') : '(sem arquivo anexado)';
      const pedido = [
        'O bug:',
        '- quem: ' + (pegou.nome || pegou.email || '—'),
        '- empresa: ' + (ctx.empresa || '—') + (ctx.codigo != null ? ' (código ' + ctx.codigo + ')' : ''),
        '- tela: ' + (ctx.tela || pegou.tela || '—') + ' · caminho da página: ' + (pegou.tela || '—'),
        '- meses da tarefa: ' + ((ctx.meses || []).join(', ') || '—'),
        '- a conversa no balão (as cápsulas): ' + (pegou.caminho || '—'),
        '- o que a pessoa escreveu: ' + (pegou.texto || '—'),
        '- ' + (arquivos.length > 1 ? 'os arquivos: ' : 'o arquivo: ') + (arquivos.length ? arquivos.map(a => a + ' (' + Math.round(fs.statSync(a).size / 1024) + ' KB)').join('; ') : 'nenhum'),
        '',
        'A leitura do nads sobre o arquivo (node robo/suporte-ler.js):',
        leitura.slice(0, 20000),
      ].join('\n');
      let relatorio = await perguntarAoClaude(pedido, pasta);
      // a última linha tem de ser um dos dois finais; sem ele, pede a análise
      const fim = relatorio.trim().split('\n').pop().replace(/[*_.\s]+/g, ' ').trim().toLowerCase();
      if (!VEREDITOS.some(v => fim.endsWith(v.toLowerCase()))) relatorio += '\n\nPrecisa da sua análise';
      await ref.update({ analise: 'pronta', relatorio: relatorio.slice(0, 20000), analisadoEm: new Date().toISOString() });
      log('[suporte] report pronto', id);
    } catch (err) {
      log('[suporte] não consegui investigar', id, err.message);
      await ref.update({ analise: 'erro', relatorio: 'O robô do suporte não conseguiu investigar: ' + err.message + '\n\nPrecisa da sua análise', analisadoEm: new Date().toISOString() }).catch(() => {});
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  }

  // um de cada vez (o Claude investiga um bug por vez)
  async function proximo() {
    if (ocupado || !esperando.length) return;
    ocupado = true;
    const ref = esperando.shift();
    try { await investigar(ref); } catch (err) { log('[suporte] erro:', err.message); }
    ocupado = false;
    void proximo();
  }

  const parar = fila.onSnapshot(s => {
    for (const d of s.docs) if (!esperando.some(r => r.id === d.id)) esperando.push(d.ref);
    void proximo();
  }, err => log('[suporte] a fila parou:', err.message));
  log('[suporte] ligado (Claude ' + MODELO + ')');
  return parar;
}

module.exports = { iniciarSuporteClaude };
