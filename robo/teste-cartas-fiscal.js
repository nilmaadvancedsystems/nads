// Teste sem rede das cartas do Fiscal (cartas-fiscal.js): a assinatura do PDF, a trava, o pedido da carta e o checklist do
// mês com um banco de mentira. Rodar: node teste-cartas-fiscal.js
const assert = require('assert');
const forge = require('node-forge');
const K = require('./cartas-fiscal');
const C = require('./gerado/cartas');

let ok = 0;
let falhas = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('ok  ', nome); } catch (err) { falhas++; console.log('FALHOU', nome, '\n     ', err && err.message); }
}

// um certificado de mentira (como o e-CNPJ: "NOME:CNPJ"), assinado por uma "autoridade" de mentira
function certificadoDeTeste() {
  const ac = forge.pki.rsa.generateKeyPair(1024);
  const acCert = forge.pki.createCertificate();
  acCert.publicKey = ac.publicKey; acCert.serialNumber = '01';
  acCert.validity.notBefore = new Date(Date.now() - 864e5); acCert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  acCert.setSubject([{ name: 'commonName', value: 'AC de teste' }]); acCert.setIssuer([{ name: 'commonName', value: 'AC de teste' }]);
  acCert.sign(ac.privateKey, forge.md.sha256.create());
  const k = forge.pki.rsa.generateKeyPair(1024);
  const c = forge.pki.createCertificate();
  c.publicKey = k.publicKey; c.serialNumber = '02';
  c.validity.notBefore = acCert.validity.notBefore; c.validity.notAfter = acCert.validity.notAfter;
  c.setSubject([{ name: 'commonName', value: 'NILMA DIAS OLIVEIRA:27872981000113' }]); c.setIssuer(acCert.subject.attributes);
  c.sign(ac.privateKey, forge.md.sha256.create());
  return { chavePem: forge.pki.privateKeyToPem(k.privateKey), certPem: forge.pki.certificateToPem(c), cadeiaPem: [forge.pki.certificateToPem(acCert)], titular: 'NILMA DIAS OLIVEIRA', documento: '27872981000113', publica: k.publicKey };
}

/** confere a assinatura do PDF como um leitor faria: o /ByteRange, o resumo SHA-256 e a assinatura RSA dos atributos */
function conferirAssinatura(pdf, publica) {
  const s = pdf.toString('latin1');
  const m = /\/ByteRange \[0 (\d+) (\d+) (\d+)\s*\]/.exec(s);
  assert.ok(m, 'sem o /ByteRange preenchido');
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  assert.strictEqual(b + c, pdf.length, 'o /ByteRange não vai até o fim do arquivo');
  assert.strictEqual(s[a], '<'); assert.strictEqual(s[b - 1], '>');
  const dados = Buffer.concat([pdf.subarray(0, a), pdf.subarray(b)]);
  const der = Buffer.from(s.slice(a + 1, b - 1).replace(/(00)+$/, ''), 'hex');
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString('binary')), { parseAllBytes: false });
  const p7 = forge.pkcs7.messageFromAsn1(asn1);
  assert.strictEqual(p7.certificates.length, 2, 'o certificado e a cadeia vão junto');
  // os atributos assinados: o resumo do PDF tem que bater
  const signerInfo = asn1.value[1].value[0].value[4].value[0];
  const atributos = signerInfo.value[3];
  const digest = atributos.value.find(x => forge.asn1.derToOid(x.value[0].value) === forge.pki.oids.messageDigest).value[1].value[0].value;
  assert.strictEqual(Buffer.from(digest, 'binary').toString('hex'), require('crypto').createHash('sha256').update(dados).digest('hex'), 'o resumo do PDF não bate');
  // e a assinatura RSA sobre os atributos (re-codificados como SET)
  const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, atributos.value);
  const md = forge.md.sha256.create(); md.update(forge.asn1.toDer(set).getBytes());
  const assinatura = signerInfo.value[5].value;
  assert.ok(publica.verify(md.digest().bytes(), assinatura), 'a assinatura RSA não confere');
}

// um banco de mentira com o que o robô usa
function bancoDeMentira({ usuarios = {}, cadastro = [], config = {}, existentes = [] } = {}) {
  const docs = new Map(existentes.map(id => ['solicitacoesEmail/' + id, { status: 'enviado' }]));
  const db = {
    docs,
    collection(nome) {
      return {
        doc(id) {
          const chave = nome + '/' + id;
          return {
            async get() {
              const d = nome === 'usuarios' ? usuarios[id] : nome === 'config' ? config[id] : docs.get(chave);
              return { exists: !!d, data: () => d };
            },
            async create(x) { if (docs.has(chave)) { const e = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; throw e; } docs.set(chave, Object.assign({}, x)); },
            async update(x) { docs.set(chave, Object.assign({}, docs.get(chave), x)); },
          };
        },
        where(campo, op, valor) {
          return { limit: () => ({ get: async () => ({ docs: (nome === 'cadastro' ? cadastro : []).filter(c => c[campo] === valor).map(c => ({ data: () => c })) }) }) };
        },
      };
    },
  };
  return db;
}
const ativosDe = lista => ({ size: lista.length, forEach: fn => lista.forEach((c, k) => fn({ id: 'c' + k, data: () => c })) });

(async () => {
  const cert = certificadoDeTeste();

  await caso('assinarPdf: o /ByteRange cobre o PDF todo menos a assinatura, o resumo e a assinatura RSA conferem', async () => {
    const d = C.dadosDaCarta({ empresa: 'Marisfrutas LTDA', ano: 2025, prazo: '2026-01-10', hoje: new Date(2025, 11, 5) });
    const desenho = Buffer.from(await C.desenharCartaDeBalanco(d, { assinatura: { titular: K.titularDoCertificado(cert), quando: new Date() }, reservarAssinatura: true }));
    const pdf = K.assinarPdf(desenho, cert, new Date('2025-12-05T12:00:00Z'));
    assert.strictEqual(pdf.length, desenho.length, 'o tamanho do PDF muda');
    assert.ok(pdf.toString('latin1').startsWith('%PDF-'));
    assert.ok(/\/SubFilter \/adbe\.pkcs7\.detached/.test(pdf.toString('latin1')));
    conferirAssinatura(pdf, cert.publica);
  });

  await caso('assinarPdf: sem o lugar reservado, não assina', async () => {
    const d = C.dadosDaCarta({ empresa: 'X', ano: 2025, prazo: '2026-01-10', hoje: new Date() });
    const semLugar = Buffer.from(await C.desenharCartaDeBalanco(d));
    assert.throws(() => K.assinarPdf(semLugar, cert), /lugar da assinatura/);
  });

  await caso('a trava: só o teste sai enquanto não for liberado; só o Fiscal e o admin; ano e prazo conferidos', async () => {
    const p = { tipo: 'cartaBalanco', codigo: '58', ano: 2026, prazo: '2027-01-10' };
    assert.strictEqual(K.LIBERADO_PARA_CLIENTES, false, 'a carta não pode nascer liberada');
    assert.match(K.motivoParaNaoMandarCarta(p, { podeFiscal: true }), /ainda não foi liberado/);
    assert.strictEqual(K.motivoParaNaoMandarCarta(Object.assign({ teste: true }, p), { podeFiscal: true }), '');
    assert.strictEqual(K.motivoParaNaoMandarCarta(p, { podeFiscal: true, liberado: true }), '');
    assert.match(K.motivoParaNaoMandarCarta(p, { podeFiscal: false, liberado: true }), /só o Fiscal/);
    assert.match(K.motivoParaNaoMandarCarta(Object.assign({}, p, { prazo: '2026-12-20' }), { podeFiscal: true, liberado: true }), /depois de 31\/12\/2026/);
    assert.match(K.motivoParaNaoMandarCarta(Object.assign({}, p, { codigo: '' }), { podeFiscal: true, liberado: true }), /código/);
  });

  await caso('a carta de teste: para o escritório, com o nome do cliente, assinada, e "[TESTE]" no assunto', async () => {
    const db = bancoDeMentira({ usuarios: { u1: { roles: ['fiscal'] } } });
    let mandado = null;
    const r = await K.atenderCartaBalanco({ tipo: 'cartaBalanco', codigo: '58', ano: 2026, prazo: '2027-01-10', teste: true, criadoPorUid: 'u1' }, {
      db, clientesAtivos: async () => ativosDe([{ codigoOrigem: '58', nome: 'Marisfrutas LTDA' }]), certificado: () => cert,
      agora: () => Date.parse('2026-12-05T12:00:00Z'), de: 'fiscal@x.com', assinatura: 'Nilma Contabilidade', enviar: async dados => { mandado = dados; return 'g1'; },
    });
    assert.deepStrictEqual(r.para, K.INTERNOS);
    assert.strictEqual(mandado.para, K.INTERNOS.join(', '));
    assert.strictEqual(mandado.assunto, '[TESTE] Carta de balanço 2026 · Marisfrutas LTDA');
    assert.strictEqual(mandado.anexos[0].nome, 'Carta de balanço 2026 - Marisfrutas LTDA.pdf');
    conferirAssinatura(mandado.anexos[0].buffer, cert.publica);
    assert.strictEqual(r.status, 'enviado');
  });

  await caso('a carta de verdade, travada: não manda nada', async () => {
    const db = bancoDeMentira({ usuarios: { u1: { roles: ['fiscal'] } } });
    let mandou = false;
    await assert.rejects(K.atenderCartaBalanco({ tipo: 'cartaBalanco', codigo: '58', ano: 2026, prazo: '2027-01-10', criadoPorUid: 'u1' }, {
      db, clientesAtivos: async () => ativosDe([]), certificado: () => cert, agora: () => Date.now(), enviar: async () => { mandou = true; },
    }), /ainda não foi liberado/);
    assert.strictEqual(mandou, false);
  });

  await caso('o certificado com erro (sem o .pfx na máquina) vira o erro do pedido', async () => {
    const db = bancoDeMentira({ usuarios: { u1: { departamento: 'fiscal' } } });
    await assert.rejects(K.atenderCartaBalanco({ tipo: 'cartaBalanco', codigo: '58', ano: 2026, prazo: '2027-01-10', teste: true, criadoPorUid: 'u1' }, {
      db, clientesAtivos: async () => ativosDe([{ codigoOrigem: '58', nome: 'M' }]), certificado: () => ({ erro: 'falta o certificado do escritório na máquina do robô' }), agora: () => Date.now(), enviar: async () => 'x',
    }), /falta o certificado/);
  });

  await caso('agoraEmBrasilia: depois das 21h de Brasília o UTC já é o dia seguinte', async () => {
    assert.deepStrictEqual(K.agoraEmBrasilia(new Date('2026-12-01T02:30:00Z')), { dia: '2026-11-30', hora: 23 });
    assert.deepStrictEqual(K.agoraEmBrasilia(new Date('2026-11-30T11:00:00Z')), { dia: '2026-11-30', hora: 8 });
  });

  await caso('os clientes do checklist: só com código, sem repetir, sem os de fora, em ordem', async () => {
    const l = K.clientesDoChecklist([{ codigoOrigem: '58', nome: 'B' }, { codigoOrigem: ' 7 ', nome: 'A' }, { codigoOrigem: '58', nome: 'B2' }, { codigoOrigem: '', nome: 'Sem' }, { codigoOrigem: '9', nome: 'Fora' }], ['9']);
    assert.deepStrictEqual(l, [{ codigo: '7', nome: 'A' }, { codigo: '58', nome: 'B' }]);
  });

  await caso('o e-mail do checklist: o prazo, os blocos e o PDF anexo', async () => {
    const e = K.emailDoChecklist({ competencia: '2026-11', cliente: 'Marisfrutas LTDA', pdf: Buffer.from('%PDF-1.4'), de: 'fiscal@x.com', assinatura: 'Nilma' });
    assert.strictEqual(e.assunto, 'Checklist de documentos de novembro de 2026 · Marisfrutas LTDA');
    assert.ok(e.html.includes('Prazo de envio: até 02/12/2026'));
    assert.ok(e.html.includes('3.1) Retirada de lucros dos sócios'));
    assert.ok(e.html.includes('Extratos bancários de TODAS as contas da empresa (PDF e OFX)'));
    assert.ok(e.corpo.includes('6) SITUAÇÕES ESPECIAIS (ENVIAR QUANDO OCORRER)'));
    assert.strictEqual(e.anexos[0].nome, 'Checklist mensal de documentos.pdf');
    assert.ok(require('fs').existsSync(K.PDF_DO_CHECKLIST), 'falta o PDF do checklist em modelos-fiscal/');
  });

  await caso('o checklist do mês: um por cliente, nunca dois; o sem e-mail vira erro; o freio para e continua depois', async () => {
    const db = bancoDeMentira({
      cadastro: [{ codigo: 7, emails: ['a@cliente.com'] }, { codigo: 58, emails: ['b@cliente.com'] }, { codigo: 60, emails: ['c@cliente.com'] }],
      existentes: ['checklist_2026-11_60'], config: { checklistMensal: { fora: ['9'] } },
    });
    const ativos = ativosDe([{ codigoOrigem: '7', nome: 'A', email: 'a@cliente.com' }, { codigoOrigem: '58', nome: 'B', email: 'b@cliente.com' }, { codigoOrigem: '60', nome: 'C', email: 'c@cliente.com' }, { codigoOrigem: '8', nome: 'Sem e-mail' }, { codigoOrigem: '9', nome: 'Fora', email: 'f@cliente.com' }]);
    const mandados = [];
    let vagas = 1;
    const deps = {
      clientesAtivos: async () => ativos, pdf: Buffer.from('%PDF-1.4'), agora: () => Date.parse('2026-11-30T12:00:00Z'),
      envio: async () => ({ de: 'fiscal@x.com', assinatura: 'Nilma', podeMais: () => vagas > 0, enviar: async d => { vagas--; mandados.push(d.para); return 'g' + mandados.length; } }),
    };
    const ja = new Set();
    const r1 = await K.mandarChecklistDoMes(db, deps, '2026-11', ja);
    assert.deepStrictEqual(r1, { enviados: 1, erros: 0, parou: true });
    vagas = 10;
    const r2 = await K.mandarChecklistDoMes(db, deps, '2026-11', ja);
    assert.deepStrictEqual(r2, { enviados: 1, erros: 1, parou: false });
    assert.strictEqual(mandados.length, 2, 'o 60 já tinha registro e o 9 está fora');
    assert.strictEqual(db.docs.get('solicitacoesEmail/checklist_2026-11_7').status, 'enviado');
    assert.strictEqual(db.docs.get('solicitacoesEmail/checklist_2026-11_8').status, 'erro');
    assert.ok(!db.docs.has('solicitacoesEmail/checklist_2026-11_9'));
    // o robô caiu e voltou (sem a memória): ninguém recebe de novo
    const r3 = await K.mandarChecklistDoMes(db, Object.assign({}, deps), '2026-11', new Set());
    assert.deepStrictEqual(r3, { enviados: 0, erros: 0, parou: false });
    assert.strictEqual(mandados.length, 2);
  });

  await caso('o checklist pausado em config/checklistMensal não manda nada', async () => {
    const db = bancoDeMentira({ config: { checklistMensal: { ligado: false } } });
    assert.strictEqual(await K.mandarChecklistDoMes(db, { clientesAtivos: async () => ativosDe([{ codigoOrigem: '7', nome: 'A' }]), envio: async () => ({ podeMais: () => true }) }, '2026-11', new Set()), null);
  });

  console.log('\n' + ok + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
