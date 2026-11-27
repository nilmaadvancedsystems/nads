import { describe, expect, it } from 'vitest';
import {
  CHAVES_DESLIGADAS, chavesParaGravar, envioMaisRecente, lerChaves, lerMensagemRecebida, mensagemDasGuias, mensagemDoBoleto, mensagemDoMandei,
  numeroDoWhatsapp, numeroFormatado, passoDoAtendimento, pedidoParaCliente, pedidoRespondido, respostaParaGravar, textoDaResposta, textoDosDocumentos,
  desdeDasRespostas, esperaParaResponder, lerRespostaRecebida, linhaComChaves, mudancasDasChaves, respostasDoPedido,
  CONVERSA_NOVA, MENU_DE_NOVO_MS, TEXTO_NAO_ENTENDI, TEXTO_NAO_ENTENDI_EQUIPE, TEXTO_DE_ENCERRAR, TEXTO_DE_MAIS_ALGUMA, nomeDaEmpresa, saudacaoDoAtendimento, NOME_DO_ATENDIMENTO, MENU_VALE_MS, NUMERO_DO_ESCRITORIO, RESPOSTA_VALE_MS, TEXTO_DO_ESCRITORIO, TEXTO_FORA_DO_CADASTRO,
  type EmpresaDoAtendimento,
} from './whatsappAtendimento';

const AGORA = Date.parse('2026-11-27T15:00:00.000Z');
const PADARIA: EmpresaDoAtendimento = { codigo: '123', nome: 'Padaria Boa', clienteId: 'c1' };
const MERCADO: EmpresaDoAtendimento = { codigo: '456', nome: 'Mercado Bom', clienteId: 'c2' };

describe('as chaves', () => {
  it('tudo desligado quando não tem nada ou vem lixo', () => {
    expect(lerChaves(undefined)).toEqual(CHAVES_DESLIGADAS);
    expect(lerChaves({ guias: 'sim', liberado: 1, empresaDeTeste: 'abc' })).toEqual(CHAVES_DESLIGADAS);
  });
  it('só true liga; a empresa de teste é um código', () => {
    const c = lerChaves({ guias: true, liberado: true, empresaDeTeste: ' 123 ', atualizadoPor: 'Ana' });
    expect(c.guias).toBe(true);
    expect(c.liberado).toBe(true);
    expect(c.boletos).toBe(false);
    expect(c.empresaDeTeste).toBe('123');
  });
  it('grava só os campos conhecidos e recusa código estranho', () => {
    const g = chavesParaGravar({ ...CHAVES_DESLIGADAS, mandei: true, empresaDeTeste: '77' }, 'Ana', '2026-11-27T15:00:00.000Z');
    expect(Object.keys(g).sort()).toEqual(['atualizadoEm', 'atualizadoPor', 'autoatendimento', 'boletos', 'empresaDeTeste', 'guias', 'liberado', 'mandei', 'numerosDeTeste', 'respostas']);
    expect(g.mandei).toBe(true);
    expect(() => chavesParaGravar({ ...CHAVES_DESLIGADAS, empresaDeTeste: 'x1' }, 'Ana', '')).toThrow(/código/);
  });
});

describe('o número e a trava', () => {
  it('55 + DDD + número', () => {
    expect(numeroDoWhatsapp('(38) 99999-1234')).toBe('5538999991234');
    expect(numeroDoWhatsapp('123')).toBe('');
    expect(numeroFormatado(NUMERO_DO_ESCRITORIO)).toBe('(38) 9138-3638');
  });
  it('trava fechada: vai ao escritório como TESTE, dizendo para quem iria', () => {
    const p = pedidoParaCliente({ telefone: '38999991234', cliente: 'Padaria Boa', texto: 'Olá' }, false);
    expect(p).toEqual({ para: NUMERO_DO_ESCRITORIO, texto: '[TESTE: iria para Padaria Boa, (38) 99999-1234]\n\nOlá', teste: true });
  });
  it('trava aberta: vai ao cliente; sem telefone, nada', () => {
    expect(pedidoParaCliente({ telefone: '38999991234', cliente: 'Padaria Boa', texto: 'Olá' }, true)).toEqual({ para: '5538999991234', texto: 'Olá', teste: false });
    expect(pedidoParaCliente({ telefone: '', cliente: 'Padaria Boa', texto: 'Olá' }, true)).toBeNull();
  });
});

describe('as mensagens', () => {
  it('guias: com o menu ligado, ensina a pedir; sem ele, avisa que não lê', () => {
    const com = mensagemDasGuias({ cliente: 'Padaria Boa', competencia: '2026-10', link: 'https://x/guias' }, true);
    expect(com).toContain('As guias de outubro de 2026 já estão na sua Área do Cliente: https://x/guias');
    expect(com).toContain('responda MENU');
    expect(mensagemDasGuias({ cliente: '', competencia: '', link: '' }, false)).toContain('não lê respostas');
  });
  it('boleto: mês, valor e vencimento', () => {
    const m = mensagemDoBoleto({ cliente: 'Padaria Boa', competencia: '2026-11', valor: 850.5, vencimento: '2026-12-10' }, false);
    expect(m).toMatch(/^Olá, Padaria Boa! Segue o boleto dos honorários contábeis de novembro de 2026, no valor de R\$\s?850,50, com vencimento em 10\/12\/2026\./);
  });
  it('Mandei: o número do pedido e o link', () => {
    expect(mensagemDoMandei({ cliente: 'Padaria Boa', numero: '#0003', link: 'https://cliente/mandei/ABC' }, false)).toContain('(pedido #0003). Responda e mande os arquivos por este link: https://cliente/mandei/ABC');
  });
});

// mensagens de exemplo como a Baileys entrega no messages.upsert
const msg = (message: unknown, key: Record<string, unknown> = {}) => ({
  key: { remoteJid: '5538999991234@s.whatsapp.net', fromMe: false, id: 'ABC1', ...key }, messageTimestamp: 1795000000, message,
});

describe('a mensagem que chega', () => {
  it('texto simples e texto com link', () => {
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }))).toEqual({ id: 'ABC1', numero: '5538999991234', em: new Date(1795000000 * 1000).toISOString(), tipo: 'texto', texto: 'oi', arquivo: '' });
    expect(lerMensagemRecebida(msg({ extendedTextMessage: { text: 'segue' } }))?.texto).toBe('segue');
  });
  it('PDF, foto e áudio', () => {
    expect(lerMensagemRecebida(msg({ documentMessage: { fileName: 'extrato.pdf', mimetype: 'application/pdf', caption: 'outubro' } }))).toMatchObject({ tipo: 'pdf', arquivo: 'extrato.pdf', texto: 'outubro' });
    expect(lerMensagemRecebida(msg({ documentWithCaptionMessage: { message: { documentMessage: { fileName: 'a.xlsx', mimetype: 'x' } } } }))).toMatchObject({ tipo: 'documento', arquivo: 'a.xlsx' });
    expect(lerMensagemRecebida(msg({ imageMessage: { caption: 'nota' } }))).toMatchObject({ tipo: 'imagem', texto: 'nota' });
    expect(lerMensagemRecebida(msg({ audioMessage: {} }))).toMatchObject({ tipo: 'audio' });
  });
  it('mensagem temporária e contato novo (LID, com o telefone ao lado)', () => {
    expect(lerMensagemRecebida(msg({ ephemeralMessage: { message: { conversation: '1' } } }))?.texto).toBe('1');
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }, { remoteJid: '1234567@lid', remoteJidAlt: '5538988887777@s.whatsapp.net' }))?.numero).toBe('5538988887777');
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }, { remoteJid: '1234567@lid' }))).toBeNull();
  });
  it('não é de cliente: nossa, de grupo, status, reação', () => {
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }, { fromMe: true }))).toBeNull();
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }, { remoteJid: '123-456@g.us' }))).toBeNull();
    expect(lerMensagemRecebida(msg({ conversation: 'oi' }, { remoteJid: 'status@broadcast' }))).toBeNull();
    expect(lerMensagemRecebida(msg({ reactionMessage: { text: '👍' } }))).toBeNull();
    expect(lerMensagemRecebida(null)).toBeNull();
  });
});

describe('as respostas', () => {
  const conversas = {
    '5538999991234': { caminho: 'solicitacoesEmail/p2', em: AGORA - 3600000 },
    '553899991234': { caminho: 'solicitacoesEmail/p1', em: AGORA - 2 * 3600000 },
    '5538988887777': { caminho: 'solicitacoesEmail/velho', em: AGORA - RESPOSTA_VALE_MS - 1 },
  };
  it('a resposta vai para o último pedido mandado ao número (com ou sem o 9)', () => {
    expect(pedidoRespondido(conversas, '553899991234', AGORA)).toBe('solicitacoesEmail/p2');
    expect(pedidoRespondido(conversas, '5538988887777', AGORA)).toBeNull();
    expect(pedidoRespondido(conversas, '5511911112222', AGORA)).toBeNull();
  });
  it('grava curto e mostra em poucas palavras', () => {
    const r = respostaParaGravar({ id: 'x', numero: '1', em: '', tipo: 'pdf', texto: ' ' + 'a'.repeat(2000), arquivo: 'extrato.pdf' }, '2026-11-27T15:00:00.000Z');
    expect(r.em).toBe('2026-11-27T15:00:00.000Z');
    expect(r.texto.length).toBe(1000);
    expect(textoDaResposta({ tipo: 'pdf', arquivo: 'extrato.pdf', texto: '' })).toBe('mandou um PDF (extrato.pdf)');
    expect(textoDaResposta({ tipo: 'texto', texto: 'ok, mando amanhã' })).toBe('ok, mando amanhã');
  });
});

describe('o autoatendimento', () => {
  it('número fora do cadastro: avisa uma vez por dia', () => {
    const p = passoDoAtendimento(null, 'oi', [], AGORA);
    expect(p.responder).toBe(TEXTO_FORA_DO_CADASTRO);
    expect(passoDoAtendimento(p.conversa, 'oi', [], AGORA + 60000).responder).toBe('');
  });
  it('uma empresa: menu, opção e o pedido ao robô', () => {
    const p1 = passoDoAtendimento(null, 'Bom dia!', [PADARIA], AGORA);
    expect(p1.responder).toContain('1️⃣ Guias do mês');
    expect(p1.conversa.etapa).toBe('menu');
    const p2 = passoDoAtendimento(p1.conversa, ' 2 ', [PADARIA], AGORA + 60000);
    expect(p2.acao).toEqual({ tipo: 'boleto', empresa: PADARIA });
    expect(p2.responder).toBe('');
    // depois de atender, outro número da lista vale direto (sem repetir o menu)
    const p3 = passoDoAtendimento(p2.conversa, '4', [PADARIA], AGORA + 120000);
    expect(p3.acao).toEqual({ tipo: 'escritorio', empresa: PADARIA });
    expect(p3.responder).toBe(TEXTO_DO_ESCRITORIO);
  });
  it('falar com o escritório responde e avisa a equipe', () => {
    const p1 = passoDoAtendimento(null, 'menu', [PADARIA], AGORA);
    const p2 = passoDoAtendimento(p1.conversa, '4', [PADARIA], AGORA + 1000);
    expect(p2.responder).toBe(TEXTO_DO_ESCRITORIO);
    expect(p2.acao?.tipo).toBe('escritorio');
  });
  it('mais de uma empresa: pergunta qual antes do menu', () => {
    const p1 = passoDoAtendimento(null, 'oi', [PADARIA, MERCADO], AGORA);
    expect(p1.responder).toContain('2️⃣ Mercado Bom');
    expect(p1.conversa.etapa).toBe('empresa');
    const p2 = passoDoAtendimento(p1.conversa, '2', [PADARIA, MERCADO], AGORA + 1000);
    expect(p2.responder).toContain('atendimento de *Mercado Bom*');
    const p3 = passoDoAtendimento(p2.conversa, '1', [PADARIA, MERCADO], AGORA + 2000);
    expect(p3.acao).toEqual({ tipo: 'guias', empresa: MERCADO });
  });
  it('opção fora da lista mostra o menu de novo; depois de 30 min, o número reabre o menu', () => {
    const p1 = passoDoAtendimento(null, 'oi', [PADARIA], AGORA);
    expect(passoDoAtendimento(p1.conversa, '9', [PADARIA], AGORA + 1000).acao).toBeNull();
    const tarde = passoDoAtendimento(p1.conversa, '1', [PADARIA], AGORA + MENU_VALE_MS + 1);
    expect(tarde.acao).toBeNull();
    expect(tarde.responder).toContain('Escolha uma opção');
  });
  it('texto solto depois de atender não repete o menu nem atrapalha quem responde a uma mensagem do robô', () => {
    const p1 = passoDoAtendimento(null, 'oi', [PADARIA], AGORA);
    const p2 = passoDoAtendimento(p1.conversa, '1', [PADARIA], AGORA + 30000);
    expect(passoDoAtendimento(p2.conversa, 'obrigado', [PADARIA], AGORA + 60000).responder).toBe('');
    expect(passoDoAtendimento(p2.conversa, 'obrigado', [PADARIA], AGORA + 30000 + MENU_DE_NOVO_MS + 1).responder).toContain('Escolha uma opção');
    expect(passoDoAtendimento({ ...CONVERSA_NOVA }, 'mando amanhã', [PADARIA], AGORA, AGORA - 3600000).responder).toBe('');
    // "menu" sempre abre
    expect(passoDoAtendimento({ ...CONVERSA_NOVA }, 'MENU', [PADARIA], AGORA, AGORA - 60000).responder).toContain('Escolha uma opção');
  });
  it('não entendeu: pede de novo sem culpar e, na 2ª vez, chama a equipe', () => {
    const p1 = passoDoAtendimento(null, 'oi', [PADARIA], AGORA);
    const p2 = passoDoAtendimento(p1.conversa, 'quero a guia do das', [PADARIA], AGORA + 10000);
    expect(p2.responder.startsWith(TEXTO_NAO_ENTENDI)).toBe(true);
    expect(p2.responder).toContain('1️⃣ Guias do mês');
    expect(p2.acao).toBeNull();
    const p3 = passoDoAtendimento(p2.conversa, '7', [PADARIA], AGORA + 20000);
    expect(p3.responder).toBe(TEXTO_NAO_ENTENDI_EQUIPE);
    expect(p3.acao).toEqual({ tipo: 'escritorio', empresa: PADARIA });
    // um número certo depois de um errado zera a conta
    const p4 = passoDoAtendimento(p2.conversa, '2', [PADARIA], AGORA + 20000);
    expect(p4.acao?.tipo).toBe('boleto');
    expect(p4.conversa.invalidas).toBe(0);
  });
  it('o 0 encerra', () => {
    const p1 = passoDoAtendimento(null, 'oi', [PADARIA], AGORA);
    const p2 = passoDoAtendimento(p1.conversa, '0', [PADARIA], AGORA + 10000);
    expect(p2.responder).toBe(TEXTO_DE_ENCERRAR);
    expect(p2.conversa.etapa).toBe('');
    expect(passoDoAtendimento(p2.conversa, 'valeu', [PADARIA], AGORA + 20000).responder).toBe('');
  });
});

describe('o jeito do menu', () => {
  it('o nome, a saudação pela hora de Brasília e o nome da empresa sem tudo em maiúsculas', () => {
    expect(NOME_DO_ATENDIMENTO).toBe('Autoatendimento Nilma Contabilidade');
    expect(saudacaoDoAtendimento(Date.parse('2026-11-27T11:00:00.000Z'))).toBe('Bom dia');     // 8h
    expect(saudacaoDoAtendimento(Date.parse('2026-11-27T18:00:00.000Z'))).toBe('Boa tarde');   // 15h
    expect(saudacaoDoAtendimento(Date.parse('2026-11-27T23:30:00.000Z'))).toBe('Boa noite');   // 20h30
    expect(nomeDaEmpresa('TORIBA TECNOLOGIA E GESTAO EMPRESARIAL LTDA')).toBe('Toriba Tecnologia e Gestao Empresarial LTDA');
    expect(nomeDaEmpresa('padaria do joão me')).toBe('Padaria do João ME');
  });
  it('o menu: título em negrito, opções com emoji, o 0 e o lembrete do menu', () => {
    const m = passoDoAtendimento(null, 'oi', [PADARIA], Date.parse('2026-11-27T13:00:00.000Z')).responder;
    expect(m.startsWith('*Autoatendimento Nilma Contabilidade*\n\nBom dia! Você está no atendimento de *Padaria Boa*.')).toBe(true);
    expect(m).toContain('4️⃣ Falar com a equipe do escritório\n0️⃣ Encerrar');
    expect(m).toContain('digite *menu*');
  });
});

describe('os documentos do autoatendimento', () => {
  it('o envio mais recente com arquivo, até 5', () => {
    const r = envioMaisRecente([
      { competencia: '2026-09', enviadoEm: '2026-10-05', arquivos: [{ nome: 'a', id: '1' }] },
      { competencia: '2026-10', enviadoEm: '2026-11-05', arquivos: [] },
      { competencia: '2026-10', enviadoEm: '2026-11-04', arquivos: Array.from({ length: 7 }, (_, i) => ({ nome: 'g' + i, id: String(i) })) },
    ]);
    expect(r?.competencia).toBe('2026-10');
    expect(r?.arquivos.length).toBe(5);
    expect(envioMaisRecente([])).toBeNull();
  });
  it('o texto antes dos arquivos e o "não achei"', () => {
    expect(textoDosDocumentos('guias', PADARIA, { competencia: '2026-10', enviadoEm: '', arquivos: [{ nome: 'a', id: '1' }, { nome: 'b', id: '2' }] }))
      .toBe('Seguem as guias de Padaria Boa (outubro de 2026), 2 arquivos.\n\n' + TEXTO_DE_MAIS_ALGUMA);
    expect(textoDosDocumentos('boleto', PADARIA, { competencia: '2026-11', enviadoEm: '', arquivos: [{ nome: 'a', id: '1' }] })).toBe('Segue o boleto de honorários de Padaria Boa (novembro de 2026).\n\n' + TEXTO_DE_MAIS_ALGUMA);
    expect(textoDosDocumentos('dp', PADARIA, null)).toMatch(/^Não achamos os documentos do DP de Padaria Boa/);
  });
});

describe('as respostas na tela', () => {
  it('o mapa r1, r2... em ordem, sem lixo', () => {
    const r = respostasDoPedido({ r10: { em: 'c', tipo: 'texto', texto: 'dez' }, r2: { em: 'b', tipo: 'pdf', texto: '', arquivo: 'x.pdf' }, r1: { em: 'a', tipo: 'xx', texto: 'um' }, outro: { em: 'z' } });
    expect(r.map(x => x.em)).toEqual(['a', 'b', 'c']);
    expect(r[0].tipo).toBe('outro');
    expect(r[1].arquivo).toBe('x.pdf');
    expect(respostasDoPedido(null)).toEqual([]);
  });
  it('o pedido respondido e o pedido para falar com o escritório', () => {
    const boleto = lerRespostaRecebida('p1', { tipo: 'whatsapp', origem: 'boleto', clienteNome: 'Padaria Boa', teste: true, respondidoEm: '2026-11-27T15:00:00.000Z', ultimaResposta: 'pago', respostas: { r1: { em: 'x', tipo: 'texto', texto: 'pago' } } });
    expect([boleto.empresa, boleto.origem, boleto.teste, boleto.ultima, boleto.numero]).toEqual(['Padaria Boa', 'Boleto de honorários', true, 'pago', '']);
    const extratos = lerRespostaRecebida('p2', { tipo: 'whatsapp', clienteNome: 'Mercado', respostas: { r1: { tipo: 'pdf', arquivo: 'extrato.pdf' } } });
    expect([extratos.origem, extratos.ultima]).toEqual(['Pedir extratos', 'mandou um PDF (extrato.pdf)']);
    const esc = lerRespostaRecebida('p3', { tipo: 'whatsapp-recebida', origem: 'autoatendimento', pedeEscritorio: true, empresa: 'Padaria Boa', numero: '5538999991234', ultimaResposta: 'pediu para falar com o escritório' });
    expect([esc.origem, esc.pedeEscritorio, esc.numero]).toEqual(['Autoatendimento', true, '(38) 99999-1234']);
  });
  it('lê os últimos 7 dias', () => {
    expect(desdeDasRespostas(new Date(AGORA))).toBe('2026-11-20T15:00:00.000Z');
  });
});

describe('a confirmação das chaves', () => {
  it('só o que mudou, de → para', () => {
    expect(mudancasDasChaves(CHAVES_DESLIGADAS, { ...CHAVES_DESLIGADAS, liberado: true, empresaDeTeste: '123' }))
      .toEqual(['Liberar para clientes: desligada → ligada', 'Empresa de teste: nenhuma → 123']);
    expect(mudancasDasChaves(CHAVES_DESLIGADAS, CHAVES_DESLIGADAS)).toEqual([]);
  });
});

describe('os números de teste a mais (no banco, não no código)', () => {
  it('só telefone válido, sem repetir (com ou sem o 9), até 5', () => {
    expect(lerChaves({ numerosDeTeste: ['(38) 98888-7777', '3888887777', 'abc', 5] }).numerosDeTeste).toEqual(['5538988887777']);
    expect(() => chavesParaGravar({ ...CHAVES_DESLIGADAS, numerosDeTeste: ['123'] }, 'Ana', '')).toThrow(/inválido/);
  });
  it('com a trava fechada, o telefone do cadastro que é de teste recebe direto', () => {
    expect(pedidoParaCliente({ telefone: '38988887777', cliente: 'Empresa de teste', texto: 'Olá' }, false, ['5538988887777']))
      .toEqual({ para: '5538988887777', texto: 'Olá', teste: true });
  });
  it('aparece na confirmação', () => {
    expect(mudancasDasChaves(CHAVES_DESLIGADAS, { ...CHAVES_DESLIGADAS, numerosDeTeste: ['5538988887777'] })).toEqual(['Números de teste a mais: nenhum → (38) 98888-7777']);
  });
});

describe('a espera do autoatendimento e o registro', () => {
  it('responde a quem escreveu em 3 a 8 segundos', () => {
    expect(esperaParaResponder(0, AGORA, 0.5)).toBe(0);
    expect(esperaParaResponder(AGORA, AGORA, 0)).toBe(3000);
    expect(esperaParaResponder(AGORA, AGORA, 1)).toBe(8000);
    expect(esperaParaResponder(AGORA - 60000, AGORA, 1)).toBe(0);
  });
  it('engole só as linhas com as chaves da criptografia', () => {
    expect(linhaComChaves('Closing session:')).toBe(true);
    expect(linhaComChaves('Opening session:')).toBe(true);
    expect(linhaComChaves('Session error:Error: Bad MAC')).toBe(true);
    expect(linhaComChaves('whatsapp: conectado')).toBe(false);
    expect(linhaComChaves({ a: 1 })).toBe(false);
  });
});
