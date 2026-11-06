// o "perguntar onde salvar" do Chrome do FGTS: a política + o Preferences, com o reg e o tasklist falsos (06/11/2026)
const fs = require('fs'), path = require('path'), os = require('os');
const { _teste } = require('./fgts-extensao.js');
let ok = 0, falha = 0; const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, a, '!=', b); } };
function falso(val, chromeAberto, regFalha) { const st = { val, adds: 0 }; st.exec = (c, a) => {
  if (c === 'reg' && a[0] === 'query') { if (st.val === null) throw new Error('nao achou'); return '\n    PromptForDownloadLocation    REG_DWORD    0x' + st.val.toString(16) + '\n'; }
  if (c === 'reg' && a[0] === 'add') { st.adds++; if (regFalha) throw new Error('negado'); st.val = +a[a.indexOf('/d') + 1]; return 'ok'; }
  if (c === 'tasklist') return chromeAberto ? 'chrome.exe 123 Console' : 'INFO: Nenhuma tarefa';
}; return st; }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pref-')); const arq = path.join(dir, 'Preferences');
// sem política, Chrome fechado, Preferences com prompt ligado
fs.writeFileSync(arq, JSON.stringify({ download: { prompt_for_download: true, default_directory: 'X' } }));
let s = falso(null, false); let r = _teste.semPerguntarOndeSalvar(s.exec, arq);
igual('grava a política', [s.val, s.adds], [0, 1]); igual('mensagem', /desliguei .*sem política.*perfil/.test(r), true);
igual('Preferences desligado e mantém o resto', JSON.parse(fs.readFileSync(arq)).download, { prompt_for_download: false, default_directory: 'X' });
// política ligada (1), Chrome aberto: troca a política, não mexe no arquivo
fs.writeFileSync(arq, JSON.stringify({ download: { prompt_for_download: true } }));
s = falso(1, true); r = _teste.semPerguntarOndeSalvar(s.exec, arq);
igual('política religada vira 0', s.val, 0); igual('Chrome aberto: avisa e não mexe', [/estava ligado/.test(r), /já estava aberto/.test(r), JSON.parse(fs.readFileSync(arq)).download.prompt_for_download], [true, true, true]);
// já certo: só confere, sem gravar
fs.writeFileSync(arq, JSON.stringify({ download: { prompt_for_download: false } }));
s = falso(0, false); r = _teste.semPerguntarOndeSalvar(s.exec, arq);
igual('já certo: não grava', [s.adds, /^conferi/.test(r)], [0, true]);
// reg negado: diz que NÃO conseguiu
s = falso(null, false, true); r = _teste.semPerguntarOndeSalvar(s.exec, arq);
igual('reg negado avisa', /NÃO consegui/.test(r), true);
console.log((falha ? 'FALHA ' : 'ok: ') + ok + ' testes'); process.exit(falha ? 1 : 0);
