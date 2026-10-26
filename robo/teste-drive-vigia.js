// Testes do vigia do Google Drive (drive-vigia.js): a decisão de reiniciar, sem mexer no Drive.
'use strict';
const D = require('./drive-vigia');
const m = 60000;
let total = 0, falhas = 0;
const igual = (nome, a, b) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) { falhas++; console.log('FALHOU ', nome, JSON.stringify(a), '≠', JSON.stringify(b)); } };
igual('o G: está lá: nada', D.decidir({}, true, 0).reiniciar, false);
igual('sumiu agora: anota', D.decidir({}, false, 0).sumiu, true);
igual('sumido há 5 min: espera', D.decidir({ sumiuEm: 1 }, false, 5 * m).reiniciar, false);
igual('sumido há 11 min: reinicia', D.decidir({ sumiuEm: 1 }, false, 11 * m).reiniciar, true);
igual('reiniciou há 10 min: espera', D.decidir({ sumiuEm: 1, ultimoReinicioEm: 20 * m }, false, 30 * m).reiniciar, false);
igual('reiniciou há 31 min: tenta de novo', D.decidir({ sumiuEm: 1, ultimoReinicioEm: 20 * m }, false, 51 * m).reiniciar, true);
igual('voltou: avisa', D.decidir({ sumiuEm: 1 }, true, 9 * m).voltou, true);
const fs = require('fs'), os = require('os'), path = require('path');
const inst = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'));
for (const v of ['99.0.0.0', '133.0.2.0', '132.0.0.0', '200.0.0.0']) { fs.mkdirSync(path.join(inst, v)); if (v !== '200.0.0.0') fs.writeFileSync(path.join(inst, v, 'GoogleDriveFS.exe'), ''); }
igual('o exe da versão mais nova que tem o exe', path.basename(path.dirname(D.exeDoDrive(inst))), '133.0.2.0');
fs.rmSync(inst, { recursive: true, force: true });
console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
process.exit(falhas ? 1 : 0);
