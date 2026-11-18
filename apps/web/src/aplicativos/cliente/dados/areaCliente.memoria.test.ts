import { describe, expect, it } from 'vitest';
import { areaCliente as ac } from '@nads/core';
import { SECOES_DO_BANCO, TODAS_AS_SECOES, type EstadoDaArea } from './areaCliente';
import { areaComoNoBanco, criarRepoAreaClienteMemoria, TOKEN_COMO_NO_BANCO, TOKEN_COMO_NO_BANCO_VAZIO, TOKEN_DE_EXEMPLO } from './areaCliente.memoria';

const HOJE = new Date(2026, 9, 17, 10, 0, 0);

/** o primeiro estado que o repositório entrega para o token */
function primeiro(token: string): EstadoDaArea {
  let e: EstadoDaArea | null = null;
  criarRepoAreaClienteMemoria(() => HOJE).assinar(token, x => { e ??= x; })();
  return e!;
}

describe('a Área do Cliente como o cliente real vê (exemplo-real)', () => {
  it('tem só o que o banco tem: sem pessoal, documentos, pagas, ficha, linha digitável, avisos nem telefone', () => {
    const e = areaComoNoBanco(HOJE);
    expect(e.secoes).toEqual(SECOES_DO_BANCO);
    expect(e).toMatchObject({ valido: true, exemplos: true, documentos: [], pessoal: null, documentosDp: [], faturamento: null, pagas: [], avisos: [], codigos: {}, ficha: null, certificado: null, atendimento: null });
    expect(e.resumo?.escritorio).toEqual({ whatsapp: '(31) 99999-0000', email: 'atendimento@nilma.example' });
    expect(e.resumo?.empresas[0].cnpj).toBe('00.000.000/0001-91');
    expect(e.guias.map(g => g.situacao)).toEqual(['vencida']);
    expect(e.agenda.length).toBeGreaterThan(0);
  });

  it('o vazio: nenhuma guia, a agenda vazia, nenhum chamado e nenhum envio', () => {
    expect(areaComoNoBanco(HOJE, true)).toMatchObject({ guias: [], agenda: [], chamados: [], envios: [], secoes: SECOES_DO_BANCO });
  });

  it('cada token abre o seu; o resto é link inválido', () => {
    expect(primeiro(TOKEN_DE_EXEMPLO).secoes).toEqual(TODAS_AS_SECOES);
    expect(primeiro(TOKEN_COMO_NO_BANCO).secoes).toEqual(SECOES_DO_BANCO);
    expect(primeiro(TOKEN_COMO_NO_BANCO_VAZIO).guias).toEqual([]);
    expect(primeiro('outro')).toMatchObject({ carregado: true, valido: false });
  });

  it('o chamado aberto num token fica só nele', async () => {
    const repo = criarRepoAreaClienteMemoria(() => HOJE);
    const vistos: Record<string, number> = {};
    const paraA = repo.assinar(TOKEN_COMO_NO_BANCO_VAZIO, e => { vistos.vazio = e.chamados.length; });
    const paraB = repo.assinar(TOKEN_DE_EXEMPLO, e => { vistos.exemplo = e.chamados.length; });
    const antes = vistos.exemplo;
    expect(await repo.abrirChamado(TOKEN_COMO_NO_BANCO_VAZIO, { tipo: 'duvida', texto: 'Como mando o extrato?' })).not.toBe('');
    expect(vistos).toEqual({ vazio: 1, exemplo: antes });
    paraA(); paraB();
  });
});

// "Já paguei: mandar o comprovante" (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia, parte A)
describe('o comprovante da guia no exemplo', () => {
  it('enviar com o prefixo gera o recibo com o nome prefixado, e a guia acha o comprovante', async () => {
    const repo = criarRepoAreaClienteMemoria(() => HOJE);
    let estado: EstadoDaArea | null = null;
    const parar = repo.assinar(TOKEN_DE_EXEMPLO, e => { estado = e; });
    const g = { tipo: 'FGTS' as const, competencia: '2026-09' };
    const nome = ac.nomeComPrefixo(ac.prefixoDoComprovante(g), 'pix.pdf');
    await repo.enviar(TOKEN_DE_EXEMPLO, 'comprovante', [new File(['x'], nome, { type: 'application/pdf' })]);
    const recibo = ac.comprovanteDaGuia(g, estado!.envios);
    parar();
    expect(recibo?.nome).toBe('Comprovante FGTS 09-2026 - pix.pdf');
    expect(recibo?.tipo).toBe('comprovante');
  });
});

// a entrega confirmada sai da lista (plano do Acessórias, 18/11/2026, ficha confirmar-entrega)
describe('confirmar a entrega no exemplo', () => {
  it('a entrega confirmada sai da lista', async () => {
    const repo = criarRepoAreaClienteMemoria(() => HOJE);
    let estado: EstadoDaArea | null = null;
    const parar = repo.assinar(TOKEN_DE_EXEMPLO, e => { estado = e; });
    expect(estado!.entregas.map(x => x.id)).toEqual(['exemplo-entrega-1']);
    await repo.confirmarRecebido(TOKEN_DE_EXEMPLO, 'exemplo-entrega-1');
    parar();
    expect(estado!.entregas).toEqual([]);
  });
});
