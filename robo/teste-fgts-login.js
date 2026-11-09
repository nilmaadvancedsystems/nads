// O login do FGTS no servidor (08/11/2026: 25 guias pararam em "o login não foi", sem dizer o que a página mostrava).
// A extensão e o relógio são falsos: nada abre o Chrome nem o gov.br.
const { _teste } = require('./fgts-extensao.js');
const { garantirLogin, descreverTela, manifestoComVersao, argumentosDoChrome } = _teste;
let ok = 0, falha = 0;
const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };

const LOGIN = 'https://sso.acesso.gov.br/login?client_id=por-p-fgtsd.estaleiro.serpro.gov.br&authorization_id=abc';
const TELA_LOGIN = { url: LOGIN, titulo: 'Acesso gov.br', texto: 'Identifique-se no gov.br com:\nSeu certificado digital', captcha: false, visivel: 'visible', foco: true, avisos: [], certCarregando: false };
const LOGADO = { url: 'https://fgtsdigital.sistema.gov.br/portal/servicos', texto: 'Empregador: X\nTrocar Perfil', captcha: false };

/** Uma extensão falsa: `aoClicar(n)` diz como a tela fica depois do clique n no certificado. */
function cenario(aoClicar, tela0 = TELA_LOGIN) {
  const st = { tela: tela0, cliques: 0, fontes: [], t: 0, logs: [] };
  st.dep = {
    agora: () => st.t,
    dormir: async ms => { st.t += ms; },
    log: (...m) => st.logs.push(m.join(' ')),
    mandar: async cmd => {
      if (cmd.tipo === 'abrir') return { valor: cmd.url };
      if (cmd.tipo === 'ler') return { valor: typeof st.tela === 'function' ? st.tela(st) : st.tela };
      if (cmd.tipo === 'clicar') { st.fontes.push(cmd.fonte); st.cliques++; st.tela = aoClicar(st.cliques, st); return { valor: true }; }
      return { erro: 'comando ' + cmd.tipo };
    },
  };
  return st;
}
const passos = [];
const passo = t => passos.push(t);

(async () => {
  // 1) o hCaptcha falha no 1º clique (o botão volta e o gov.br mostra o erro); no 2º entra
  const erroHc = Object.assign({}, TELA_LOGIN, { avisos: ['Não foi possível validar o hCaptcha. Tente novamente. (FERL0010000)'] });
  let s = cenario(n => n === 1 ? erroHc : LOGADO);
  let r = await garantirLogin(passo, s.dep);
  igual('hCaptcha falhou: clica de novo e entra', [r, s.cliques], ['', 2]);
  igual('clica só no botão exato (não no "em nuvem")', s.fontes[0], '^Seu certificado digital$');
  igual('log diz a página e o clique de novo', [s.logs.some(l => /página visible, foco sim/.test(l)), s.logs.some(l => /clicando de novo.*hCaptcha/.test(l)), s.logs.some(l => /no clique 2/.test(l))], [true, true, true]);

  // 2) a tela do servidor apagada: a página escondida e o botão carregando para sempre; não insiste e diz o que via
  const escondida = Object.assign({}, TELA_LOGIN, { visivel: 'hidden', foco: false });
  s = cenario(() => Object.assign({}, escondida, { certCarregando: true }), escondida);
  r = await garantirLogin(passo, s.dep);
  igual('desiste com login', r.erro, 'login');
  igual('não clica de novo com o botão carregando', s.cliques, 1);
  igual('o detalhe conta onde ficou e por quê', [/^ficou em sso\.acesso\.gov\.br\/login \("Acesso gov\.br"\)/.test(r.detalhe), /escondida/.test(r.detalhe), /carregando/.test(r.detalhe), /cliquei 1 vez/.test(r.detalhe)], [true, true, true, true]);
  igual('espera os 150 s', s.t >= 150000 && s.t < 160000, true);
  igual('o log diz que desistiu', s.logs.some(l => /desisti do login depois de 150 s: ficou em sso/.test(l)), true);

  // 3) o botão volta sem erro e sem a página andar: clica de novo a cada 40 s, no máximo 3 vezes
  s = cenario(() => TELA_LOGIN);
  r = await garantirLogin(passo, s.dep);
  igual('no máximo 3 cliques', [r.erro, s.cliques], ['login', 3]);
  igual('detalhe com os 3 cliques', /cliquei 3 vez/.test(r.detalhe), true);

  // 4) o "não sou um robô" na tela
  s = cenario(() => Object.assign({}, TELA_LOGIN, { captcha: true }));
  r = await garantirLogin(passo, s.dep);
  igual('captcha', r.erro, 'captcha');

  // 5) já logado: não clica em nada
  s = cenario(() => LOGADO, LOGADO);
  igual('já logado', [await garantirLogin(passo, s.dep), s.cliques], ['', 0]);

  // 6) a extensão antiga (sem os campos novos) ainda funciona
  const antiga = { url: LOGIN, texto: 'Seu certificado digital', captcha: false };
  s = cenario(() => antiga, antiga);
  r = await garantirLogin(passo, s.dep);
  igual('extensão antiga: desiste com detalhe', [r.erro, /^ficou em sso\.acesso\.gov\.br\/login; cliquei 3 vez/.test(r.detalhe)], ['login', true]);

  // a descrição não leva CPF nem CNPJ
  const d = descreverTela({ url: 'https://fgtsdigital.sistema.gov.br/portal/erro', texto: 'Erro para 12.345.678/0001-95 e 123.456.789-09 e 12345678000195' });
  igual('sem documentos', [/12\.345|123\.456|12345678000195/.test(d), /^ficou em fgtsdigital\.sistema\.gov\.br\/portal\/erro; a página dizia "Erro para … e … e …"$/.test(d)], [false, true]);
  igual('sem página', descreverTela(null), 'ficou em sem página');

  // a versão da extensão muda com o conteúdo (o Chrome só troca o service worker quando a versão muda)
  const man = JSON.stringify({ manifest_version: 3, name: 'x', version: '1.0.0' });
  const v1 = JSON.parse(manifestoComVersao(man, { 'servico.js': 'a', 'roteiros.js': 'b' })).version;
  const v2 = JSON.parse(manifestoComVersao(man, { 'servico.js': 'a', 'roteiros.js': 'b' })).version;
  const v3 = JSON.parse(manifestoComVersao(man, { 'servico.js': 'a2', 'roteiros.js': 'b' })).version;
  igual('mesmo conteúdo, mesma versão', v1, v2);
  igual('conteúdo novo, versão nova', v1 !== v3, true);
  igual('versão no formato do Chrome', /^1\.0\.\d{1,5}$/.test(v1) && Number(v1.split('.')[2]) <= 65535, true);

  // o Chrome do robô abre sem tratar a janela como coberta (a tela do servidor apagada)
  const a = argumentosDoChrome();
  igual('opções do Chrome', [a.includes('--disable-features=CalculateNativeWinOcclusion'), a.includes('--disable-backgrounding-occluded-windows'), /^--profile-directory=/.test(a[0]), /fgtsdigital/.test(a[a.length - 1])], [true, true, true, true]);

  console.log((falha ? 'FALHA ' : 'ok: ') + ok + ' testes');
  process.exit(falha ? 1 : 0);
})();
