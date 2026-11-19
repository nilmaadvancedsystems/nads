'use strict';
// Teste do robo/smtp-naoresponda.js (19/11/2026), sem rede: um servidor SMTP de mentira na própria máquina.
// Rodar: node robo/teste-smtp-naoresponda.js
const assert = require('assert');
const net = require('net');
const { criarCorreioNaoresponda } = require('./smtp-naoresponda');

function servidorDeMentira({ recusarSenha = false } = {}) {
  const recebido = { comandos: [], dados: '' };
  const srv = net.createServer(s => {
    s.setEncoding('utf8');
    let modoDados = false, buf = '';
    s.write('220 mentira ESMTP\r\n');
    s.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2);
        if (modoDados) {
          if (l === '.') { modoDados = false; s.write('250 2.0.0 Ok: na fila\r\n'); } else recebido.dados += l + '\n';
          continue;
        }
        recebido.comandos.push(l);
        if (l.startsWith('EHLO')) s.write('250-mentira\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n');
        else if (l === 'AUTH LOGIN') s.write('334 VXNlcm5hbWU6\r\n');
        else if (recebido.comandos.length === 3) s.write('334 UGFzc3dvcmQ6\r\n');
        else if (recebido.comandos.length === 4) s.write(recusarSenha ? '535 5.7.8 Error: authentication failed\r\n' : '235 2.7.0 Ok\r\n');
        else if (l.startsWith('MAIL FROM') || l.startsWith('RCPT TO')) s.write('250 Ok\r\n');
        else if (l === 'DATA') { modoDados = true; s.write('354 manda\r\n'); }
        else if (l === 'QUIT') { s.write('221 tchau\r\n'); s.end(); }
      }
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, recebido, porta: srv.address().port })));
}

(async () => {
  const logs = [];
  const pelaReserva = [];
  const reserva = { enviar: async d => { pelaReserva.push(d); return 'gmail'; } };
  const dados = { para: 'maria@padaria.com', assunto: 'Crie ou troque a sua senha da Área do Cliente', corpo: 'Olá,\n.linha com ponto\nfim', html: '<p>Olá</p>' };

  // com a senha: sai pela Hostinger, com o remetente naoresponda, Date e Message-ID
  const a = await servidorDeMentira();
  const c1 = criarCorreioNaoresponda({ reserva, log: m => logs.push(m), lerSenha: async () => 'senha-de-teste', conectar: () => Promise.resolve(net.connect(a.porta, '127.0.0.1')) });
  assert.strictEqual(await c1.enviar(dados), 'smtp');
  assert.ok(a.recebido.comandos.includes('MAIL FROM:<naoresponda@nilmacontabilidade.com>'));
  assert.ok(a.recebido.comandos.includes('RCPT TO:<maria@padaria.com>'));
  assert.strictEqual(a.recebido.comandos[2], Buffer.from('naoresponda@nilmacontabilidade.com').toString('base64'));
  assert.ok(/^From: Nilma Contabilidade <naoresponda@nilmacontabilidade\.com>$/m.test(a.recebido.dados), 'o remetente');
  assert.ok(/^To: maria@padaria\.com$/m.test(a.recebido.dados));
  assert.ok(/^Date: /m.test(a.recebido.dados) && /^Message-ID: <[0-9a-f]+@nilmacontabilidade\.com>$/m.test(a.recebido.dados));
  assert.ok(a.recebido.dados.includes('multipart/alternative'), 'texto e HTML');
  assert.strictEqual(pelaReserva.length, 0);
  assert.ok(!logs.join(' ').includes('senha-de-teste'), 'a senha não vai para o log');
  a.srv.close();

  // sem a senha (o dono ainda não pôs no metadado): vai pela caixa do robô
  assert.strictEqual(await criarCorreioNaoresponda({ reserva, log: () => {}, lerSenha: async () => '' }).enviar(dados), 'gmail');
  assert.strictEqual(pelaReserva.length, 1);

  // senha errada: avisa no log e vai pela caixa do robô (o cliente não fica sem o e-mail)
  const b = await servidorDeMentira({ recusarSenha: true });
  const c3 = criarCorreioNaoresponda({ reserva, log: m => logs.push(m), lerSenha: async () => 'errada', conectar: () => Promise.resolve(net.connect(b.porta, '127.0.0.1')) });
  assert.strictEqual(await c3.enviar(dados), 'gmail');
  assert.strictEqual(pelaReserva.length, 2);
  assert.ok(logs.some(m => m.includes('535')), 'o motivo no log');
  assert.ok(!logs.join(' ').includes('errada'));
  b.srv.close();

  console.log('teste-smtp-naoresponda: ok');
})().catch(e => { console.error(e); process.exit(1); });
