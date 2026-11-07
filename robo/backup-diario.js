// Backup de todo dia, disparado pelo vigia do robô.
//
// O backup-firestore.js já existia e já é seguro (só lê o banco, nunca apaga
// nada, pula se o retrato de hoje já existe), mas dependia de alguém lembrar
// de rodar. Aqui o PC do robô roda sozinho, uma vez por dia a partir do
// meio-dia, e deixa em robo/estado.backup quando foi e se deu certo — é o
// que a tela de funções usa pra avisar quando o backup está atrasado.
//
// Depois de um backup-firestore.js bom, roda o backup-planilha.js em cima do
// MESMO arquivo que acabou de ser escrito — sem ler o Firestore de novo, sem
// gastar cota — e deixa uma planilha .xlsx (Clientes, Documentos Mensais,
// Entregas) na mesma pasta, ordenada por empresa.
//
// 07/11/2026: o backup tem prazo (passou, é interrompido e conta como
// tentativa); as tentativas do dia ficam em robo/estado (sobrevivem a
// reinício: no máximo duas leituras completas do banco por dia); a planilha
// roda com limite de memória próprio; o envio ao Drive é em partes e
// retomável; e, se o dia acabar sem backup, o admin recebe um aviso (uma vez).
const path = require('path');
const { spawn } = require('child_process');

// Entre 12h e 20h: nesse intervalo a data daqui e a data UTC (que o
// backup-firestore.js usa no nome do arquivo) são a mesma. Rodando depois das
// 21h o arquivo saía com a data de amanhã, e o backup de amanhã respondia "já
// existe" sem ter lido nada.
const HORA_MINIMA = 12;
const HORA_MAXIMA = 20;
const MAX_TENTATIVAS = 2;     // o backup lê o banco inteiro: duas leituras completas por dia, mesmo com reinícios
const MAX_TENTATIVAS_PLANILHA = 2;
const MAX_TENTATIVAS_DRIVE = 6;   // o envio é retomável e barato: pode insistir a cada hora
const PRAZO_BACKUP_MS = 2 * 60 * 60 * 1000;   // 05/11/2026: um backup ficou 12 h preso
const PRAZO_PLANILHA_MS = 30 * 60 * 1000;
// A máquina do robô (e2-micro) tem 1 GB de memória + 1 GB de troca, e o vigia já ocupa parte: a planilha lê o
// retrato em fluxo (backup-planilha.js) e cabe folgada em 512 MB.
const MEMORIA_PLANILHA_MB = 512;
const hojeIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// Quantas tentativas o dia já gastou, lido do documento robo/estado (campo backupTentativas), que sobrevive a
// reinício. Outro dia: tudo zerado.
function tentativasDoDia(estado, dia) {
  const t = (estado && estado.backupTentativas) || {};
  if (t.dia !== dia) return { dia, backup: 0, planilha: 0, drive: 0, avisado: {} };
  return { dia, backup: t.backup || 0, planilha: t.planilha || 0, drive: t.drive || 0, avisado: t.avisado || {} };
}

// Roda um script do robô num processo filho, com prazo: passou do prazo, mata o filho e devolve { ok: false, prazo: true }.
// opcoes: { prazoMs, execArgv, args, filtro(linhas, fatal) -> resumo }
function rodarFilho(script, opcoes) {
  opcoes = opcoes || {};
  const prazoMs = opcoes.prazoMs || PRAZO_BACKUP_MS;
  const msgPrazo = 'passou do prazo de ' + (prazoMs >= 60000 ? Math.round(prazoMs / 60000) + ' min' : prazoMs + ' ms') + ' e foi interrompido';
  return new Promise(resolve => {
    const linhas = [];
    let fatal = '', terminou = false, estourou = false;
    const filho = spawn(process.execPath, [].concat(opcoes.execArgv || [], [script], opcoes.args || []), { cwd: opcoes.cwd || __dirname });
    const fim = r => { if (terminou) return; terminou = true; clearTimeout(relogio); resolve(r); };
    const relogio = setTimeout(() => {
      estourou = true;
      try { filho.kill('SIGKILL'); } catch (e) { /* já saiu */ }
      // se o sistema não entregar o "close", não fica esperando: o prazo é o prazo
      setTimeout(() => fim({ ok: false, prazo: true, resumo: msgPrazo }), 5000).unref();
    }, prazoMs);
    const guardar = b => String(b).split(/\r?\n/).filter(Boolean).forEach(l => { if (/FATAL/.test(l)) fatal = l; linhas.push(l); if (linhas.length > 12) linhas.shift(); });
    filho.stdout.on('data', guardar);
    filho.stderr.on('data', guardar);
    filho.on('error', err => fim({ ok: false, resumo: err.message }));
    filho.on('close', code => {
      if (estourou) return fim({ ok: false, prazo: true, resumo: msgPrazo });
      const util = opcoes.filtro ? opcoes.filtro(linhas, fatal) : linhas.slice(-2).join(' | ');
      fim({ ok: code === 0, resumo: String(util || '').slice(0, 300) });
    });
  });
}

function rodarBackup(prazoMs) {
  return rodarFilho(path.join(__dirname, 'backup-firestore.js'), {
    prazoMs: prazoMs || PRAZO_BACKUP_MS,
    // FATAL: quando o Node cai (falta de memória) a última linha é a pilha ("13: 0x19fb1be ..."), não o motivo (03/11/2026)
    filtro: (linhas, fatal) => fatal || linhas.filter(l => /^OK:|documentos:|ja existe|ERRO/.test(l)).join(' | ') || linhas.slice(-1)[0] || '',
  });
}

function rodarPlanilha(prazoMs) {
  return rodarFilho(path.join(__dirname, 'backup-planilha.js'), {
    prazoMs: prazoMs || PRAZO_PLANILHA_MS,
    execArgv: ['--max-old-space-size=' + MEMORIA_PLANILHA_MB],
  });
}

function iniciarBackupDiario(db, log, avisos) {
  const estadoRef = db.collection('robo').doc('estado');
  let rodando = false;
  let feitoNoDia = '';
  const anotar = campos => estadoRef.set(campos, { merge: true });
  const anotarTentativas = t => anotar({ backupTentativas: { dia: t.dia, backup: t.backup, planilha: t.planilha, drive: t.drive } });
  // avisa o admin uma vez por assunto por dia (a marca fica no estado, então reinício não repete)
  async function avisarUmaVez(t, assunto, titulo, corpo) {
    if (t.avisado[assunto] === t.dia) return;   // a marca guarda o dia, então a de ontem não vale
    t.avisado[assunto] = t.dia;
    await anotar({ backupTentativas: { avisado: { [assunto]: t.dia } } }).catch(() => {});
    if (!avisos) { log('backup: sem como avisar o admin (avisos desligados):', titulo); return; }
    try { await avisos.enviar('admin', '', titulo, corpo, 'backup'); }
    catch (err) { log('aviso do backup não saiu:', err.message); }
  }
  async function talvez() {
    const hora = new Date().getHours();
    if (rodando || hora < HORA_MINIMA || hora >= HORA_MAXIMA || feitoNoDia === hojeIso()) return;
    rodando = true;
    try {
      const dia = hojeIso();
      const estado = (await estadoRef.get()).data() || {};
      const t = tentativasDoDia(estado, dia);
      let backupBom = !!(estado.backup && estado.backup.dia === dia && estado.backup.ok);

      if (!backupBom) {
        if (t.backup >= MAX_TENTATIVAS) return;   // já leu o banco duas vezes hoje: fica pra amanhã
        // a tentativa é anotada ANTES de ler: se o robô cair no meio, ela já foi gasta
        t.backup++;
        await anotarTentativas(t);
        log('backup do dia: começando (tentativa ' + t.backup + ' de ' + MAX_TENTATIVAS + ')');
        const r = await rodarBackup();
        // "em" só anda quando deu certo: é a data do último backup BOM
        const patch = { dia, ok: r.ok, resumo: r.resumo, tentadoEm: new Date().toISOString() };
        if (r.ok) patch.em = patch.tentadoEm;
        await anotar({ backup: patch });
        log('backup do dia:', r.ok ? 'ok' : 'FALHOU', '-', r.resumo);
        backupBom = r.ok;
        if (!r.ok && t.backup >= MAX_TENTATIVAS) {
          await avisarUmaVez(t, 'backup', 'Backup do dia falhou', ('Duas tentativas hoje. ' + r.resumo).slice(0, 140));
        }
      }
      if (!backupBom) return;

      // Planilha: em cima do arquivo que acabou de sair do forno, sem ler o banco de novo. Se falhar, o backup já
      // está salvo e seguro; só a planilha (um extra) fica pra próxima hora, até o limite do dia.
      let planilhaFeita = !!(estado.backup && estado.backup.planilhaDia === dia);
      if (!planilhaFeita && t.planilha < MAX_TENTATIVAS_PLANILHA) {
        t.planilha++;
        await anotarTentativas(t);
        const p = await rodarPlanilha();
        log('planilha do backup:', p.ok ? 'ok' : 'falhou', '-', p.resumo);
        if (p.ok) { planilhaFeita = true; await anotar({ backup: { planilhaDia: dia } }); }
      }
      const planilhaResolvida = planilhaFeita || t.planilha >= MAX_TENTATIVAS_PLANILHA;

      // Na nuvem o backup nasce no disco da máquina, e daqui vai pra mesma pasta do Drive onde o PC sempre gravou.
      // O envio é em partes e retomável (drive-arquivos.js): falhou, a próxima hora continua de onde parou.
      let driveFeito = !(process.env.USAR_DRIVE_API === '1' && process.env.BACKUP_PASTA) || !!(estado.backup && estado.backup.driveDia === dia);
      if (!driveFeito && t.drive < MAX_TENTATIVAS_DRIVE) {
        t.drive++;
        await anotarTentativas(t);
        try {
          const da = require('./drive-arquivos.js');
          const drive = da.getDrive();
          const destino = await da.garantirCaminho(drive, ['NILMA-PROTOCOLO-BACKUPS', 'banco']);
          const e = await da.espelharPasta(drive, process.env.BACKUP_PASTA, destino);
          log('backup no Drive:', e.enviados, 'arquivo(s) novo(s) (' + (e.bytes / 1048576).toFixed(1) + ' MB),', e.jaEstavam, 'já estavam lá');
          driveFeito = true;
          await anotar({ backup: { driveDia: dia } });
        } catch (err) {
          log('backup no Drive falhou (fica no disco e continua na próxima hora, tentativa ' + t.drive + ' de ' + MAX_TENTATIVAS_DRIVE + '):', err.message);
          if (t.drive >= MAX_TENTATIVAS_DRIVE) await avisarUmaVez(t, 'drive', 'Backup não subiu ao Drive', ('Ficou no disco da máquina. ' + err.message).slice(0, 140));
        }
      }
      if (planilhaResolvida && (driveFeito || t.drive >= MAX_TENTATIVAS_DRIVE)) feitoNoDia = dia;
    } catch (err) {
      log('backup do dia falhou:', err.message);
    } finally { rodando = false; }
  }
  setTimeout(talvez, 10 * 60 * 1000);
  setInterval(talvez, 60 * 60 * 1000);
  log('backup diário ligado (uma vez por dia, entre ' + HORA_MINIMA + 'h e ' + HORA_MAXIMA + 'h, prazo de ' + PRAZO_BACKUP_MS / 3600000 + ' h)');
}

module.exports = { iniciarBackupDiario, rodarFilho, tentativasDoDia, PRAZO_BACKUP_MS, MAX_TENTATIVAS };
