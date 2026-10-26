// O vigia do Google Drive do PC (26/10/2026: o G: sumiu de 23/10 21:37 a 26/10 13:06 e ninguém viu; o arquivador ficou
// esperando e o SIEG errou por cliente). Se o G:\Meu Drive some por mais de 10 min, fecha o GoogleDriveFS e abre de novo
// (o mesmo que foi feito à mão em 26/10), no máximo uma vez a cada 30 min, com aviso no painel e na atividade.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const PASTA = process.env.DRIVE_PASTA || 'G:\\Meu Drive';
const SUMIDO_MS = 10 * 60000;
const ENTRE_REINICIOS_MS = 30 * 60000;
const INSTALACAO = 'C:\\Program Files\\Google\\Drive File Stream';

/** O GoogleDriveFS.exe da versão mais nova instalada (as pastas são as versões: 132.0.0.0, 133.0.2.0…). */
function exeDoDrive(instalacao = INSTALACAO) {
  let versoes = [];
  try { versoes = fs.readdirSync(instalacao, { withFileTypes: true }).filter(d => d.isDirectory() && /^\d+(\.\d+)*$/.test(d.name)).map(d => d.name); } catch (e) { return null; }
  const num = v => v.split('.').map(Number);
  versoes.sort((a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0); return 0; });
  for (const v of versoes) { const exe = path.join(instalacao, v, 'GoogleDriveFS.exe'); if (fs.existsSync(exe)) return exe; }
  return null;
}

/**
 * A decisão, sem efeito (para os testes): { reiniciar, motivo }. estado: { sumiuEm, ultimoReinicioEm }; existe: o G: agora.
 */
function decidir(estado, existe, agora) {
  if (existe) return { reiniciar: false, voltou: !!estado.sumiuEm };
  if (!estado.sumiuEm) return { reiniciar: false, sumiu: true };
  if (agora - estado.sumiuEm < SUMIDO_MS) return { reiniciar: false };
  if (estado.ultimoReinicioEm && agora - estado.ultimoReinicioEm < ENTRE_REINICIOS_MS) return { reiniciar: false };
  return { reiniciar: true };
}

/** Liga o vigia: confere a cada minuto. o: { log, painel }. Devolve { parar }. */
function iniciar(o) {
  const log = o.log || (() => {});
  const painel = o.painel || null;
  const estado = { sumiuEm: 0, ultimoReinicioEm: 0, tentativas: 0 };
  const reiniciar = () => new Promise(r => {
    const exe = exeDoDrive();
    if (!exe) { log('Google Drive: não achei o GoogleDriveFS.exe em ' + INSTALACAO); return r(false); }
    execFile('taskkill', ['/F', '/IM', 'GoogleDriveFS.exe'], { windowsHide: true }, () => {
      setTimeout(() => {
        try { spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); r(true); }
        catch (e) { log('Google Drive: não abri ' + exe + ' (' + e.message + ')'); r(false); }
      }, 5000);
    });
  });
  const conferir = async () => {
    const agora = Date.now();
    const existe = fs.existsSync(PASTA);
    const d = decidir(estado, existe, agora);
    if (d.sumiu) { estado.sumiuEm = agora; log('Google Drive: ' + PASTA + ' sumiu; reinicio o Drive se não voltar em 10 min'); }
    if (d.voltou) {
      log('Google Drive: ' + PASTA + ' voltou depois de ' + Math.round((agora - estado.sumiuEm) / 60000) + ' min');
      if (painel) { painel.fazendo('drive', null); if (estado.tentativas) painel.atividade('robo', 'O Google Drive do PC voltou', 'depois de ' + estado.tentativas + ' reinício(s) automático(s)'); }
      estado.sumiuEm = 0; estado.tentativas = 0;
    }
    if (d.reiniciar) {
      estado.ultimoReinicioEm = agora; estado.tentativas++;
      const min = Math.round((agora - estado.sumiuEm) / 60000);
      log('Google Drive: ' + PASTA + ' sumido há ' + min + ' min: reinicio o Google Drive (tentativa ' + estado.tentativas + ')');
      if (painel) { painel.fazendo('drive', 'Google Drive (G:) fora há ' + min + ' min: reiniciando'); painel.erro('robo', 'O Google Drive do PC caiu: reiniciei', 'G: sumido há ' + min + ' min (tentativa ' + estado.tentativas + '; a próxima em 30 min se não voltar)'); }
      await reiniciar();
    }
  };
  const timer = setInterval(() => { void conferir().catch(e => log('Google Drive: vigia deu erro:', e.message)); }, 60000);
  void conferir().catch(() => {});
  return { parar: () => clearInterval(timer) };
}

module.exports = { iniciar, decidir, exeDoDrive, SUMIDO_MS, ENTRE_REINICIOS_MS };
