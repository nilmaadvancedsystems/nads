import { describe, expect, it } from 'vitest';
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
    expect(e).toMatchObject({ valido: true, exemplos: true, documentos: [], empregados: [], pagas: [], avisos: [], codigos: {}, ficha: null, certificado: null, atendimento: null });
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
