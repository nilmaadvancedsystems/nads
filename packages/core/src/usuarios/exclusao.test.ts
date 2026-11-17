import { describe, expect, it } from 'vitest';
import { buscasDoLugar, COLECOES_VARRIDAS, contemAPessoa, registrosDaBusca, chavesDaPessoa, LUGARES_DE_REGISTRO, podeExcluirUsuarios, rotulosDosRegistros, situacaoDaExclusao, type LugarDeRegistro } from '.';

const dono = { nivel: 'dono', admin: true, email: 'vitor@nilma.local' };
const diretor = { nivel: 'diretor', admin: true, email: 'nilma@nilma.local' };
const inativo = { uid: 'u1', nome: 'Maria', sobrenome: 'Souza', email: 'Maria@nilma.local', ativo: false, nivel: 'junior' as const };

describe('excluir usuário: quem pode', () => {
  it('só o Diretor e o Dono (com o Admin, como a regra do banco)', () => {
    expect(podeExcluirUsuarios(dono)).toBe(true);
    expect(podeExcluirUsuarios(diretor)).toBe(true);
    expect(podeExcluirUsuarios({ nivel: 'senior', admin: true })).toBe(false);
    expect(podeExcluirUsuarios({ nivel: 'diretor', admin: false })).toBe(false);
    expect(podeExcluirUsuarios({ nivel: null, admin: true })).toBe(false);
    expect(podeExcluirUsuarios(null)).toBe(false);
  });
});

describe('excluir usuário: a situação', () => {
  it('quem não é Diretor/Dono, ou a conta ativa: nada aparece', () => {
    expect(situacaoDaExclusao({ nivel: 'pleno', admin: true }, inativo, [])).toEqual({ tipo: 'nada' });
    expect(situacaoDaExclusao(diretor, { ...inativo, ativo: true }, [])).toEqual({ tipo: 'nada' });
  });
  it('inativo sem registro: pode', () => {
    expect(situacaoDaExclusao(diretor, inativo, [])).toEqual({ tipo: 'pode' });
    expect(situacaoDaExclusao(dono, inativo, [])).toEqual({ tipo: 'pode' });
  });
  it('ainda procurando: conferindo; a busca falhou: não deixa', () => {
    expect(situacaoDaExclusao(diretor, inativo, null)).toEqual({ tipo: 'conferindo' });
    const s = situacaoDaExclusao(diretor, inativo, { semConferir: ['Comissões', 'Insumos'] });
    expect(s.tipo).toBe('nao-pode');
    expect(s.tipo === 'nao-pode' && s.motivo).toMatch(/Não consegui conferir .*\(Comissões e Insumos\)/);
    expect(situacaoDaExclusao(diretor, inativo, { semConferir: [] }).tipo).toBe('nao-pode');
  });
  it('com registro: não pode, e diz onde', () => {
    const s = situacaoDaExclusao(diretor, inativo, ['Tarefas', 'Avisos', 'Reuniões']);
    expect(s.tipo).toBe('nao-pode');
    expect(s.tipo === 'nao-pode' && s.motivo).toMatch(/tem registro no sistema \(Tarefas, Avisos e Reuniões\)/);
    const um = situacaoDaExclusao(diretor, inativo, ['Comissões']);
    expect(um.tipo === 'nao-pode' && um.motivo).toMatch(/\(Comissões\)/);
  });
  it('o Dono e a própria conta não se excluem', () => {
    expect(situacaoDaExclusao(diretor, { ...inativo, nivel: 'dono' }, []).tipo).toBe('nao-pode');
    expect(situacaoDaExclusao({ ...diretor, email: ' maria@NILMA.local ' }, inativo, []).tipo).toBe('nao-pode');
  });
});

describe('excluir usuário: onde procurar', () => {
  it('as chaves da pessoa: o uid, o nome (o login e o completo) e o e-mail', () => {
    expect(chavesDaPessoa(inativo)).toEqual({ uid: ['u1'], nome: ['Maria', 'Maria Souza'], email: ['Maria@nilma.local', 'maria@nilma.local'] });
    expect(chavesDaPessoa({ uid: 'u2', nome: ' Clara ', email: 'clara@nilma.local' })).toEqual({ uid: ['u2'], nome: ['Clara'], email: ['clara@nilma.local'] });
  });
  it('uma busca por valor da pessoa', () => {
    const l: LugarDeRegistro = { colecao: 'x', campo: 'por', chave: 'nome', forma: 'valor', rotulo: 'X' };
    expect(buscasDoLugar(l, inativo).map(b => b.valor)).toEqual(['Maria', 'Maria Souza']);
  });
  it('a busca: achou em algum lugar basta; senão, faltar ler um lugar é não conferir', () => {
    expect(registrosDaBusca({ achados: ['Tarefas'], semConferir: ['Comissões'] })).toEqual(['Tarefas']);
    expect(registrosDaBusca({ achados: [], semConferir: ['Comissões'] })).toEqual({ semConferir: ['Comissões'] });
    expect(registrosDaBusca({ achados: [], semConferir: [] })).toEqual([]);
  });
  it('o nome com os finais conhecidos (a etapa da REINF grava "Maria (Fiscal)")', () => {
    const l: LugarDeRegistro = { colecao: 'eventos', campo: 'por', chave: 'nome', forma: 'valor', rotulo: 'Etapas', grupo: true, sufixos: [' (Fiscal)'] };
    expect(buscasDoLugar(l, inativo).map(b => b.valor)).toEqual(['Maria', 'Maria Souza', 'Maria (Fiscal)', 'Maria Souza (Fiscal)']);
    const porUid: LugarDeRegistro = { ...l, chave: 'uid' };
    expect(buscasDoLugar(porUid, inativo).map(b => b.valor)).toEqual(['u1']);
  });
  it('a pessoa dentro do documento: listas de objetos, mapas, em qualquer fundura; só texto inteiro igual', () => {
    expect(contemAPessoa({ participantes: [{ uid: 'x', nome: 'Ana' }, { uid: 'u1', nome: 'Maria' }] }, inativo)).toBe(true);
    expect(contemAPessoa({ historico: [{ por: 'Maria Souza', em: '2026' }] }, inativo)).toBe(true);
    expect(contemAPessoa({ etapas: { conferir: { por: 'Maria (Fiscal)' } } }, inativo)).toBe(true);
    expect(contemAPessoa({ autor: 'MARIA@nilma.local' }, inativo)).toBe(true);
    expect(contemAPessoa({ recebidos: [{ uid: 'u9', nome: 'Mariana' }], texto: 'Falar com Maria amanhã' }, inativo)).toBe(false);
    expect(contemAPessoa({ n: 1, ok: true, nada: null, lista: [] }, inativo)).toBe(false);
  });
  it('as coleções varridas são as das listas de objetos', () => {
    expect(COLECOES_VARRIDAS.map(c => c.colecao)).toEqual(['nadsTarefasDelegadas', 'nadsReunioes', 'nadsAvisos', 'chamados']);
  });
  it('os rótulos sem repetir, na ordem', () => {
    const a: LugarDeRegistro = { colecao: 'a', campo: 'x', chave: 'uid', forma: 'valor', rotulo: 'Tarefas' };
    const b: LugarDeRegistro = { colecao: 'b', campo: 'y', chave: 'nome', forma: 'lista', rotulo: 'Avisos' };
    expect(rotulosDosRegistros([a, b, a])).toEqual(['Tarefas', 'Avisos']);
  });
  it('a tabela: cada lugar com coleção, campo e rótulo, sem repetir', () => {
    expect(LUGARES_DE_REGISTRO.length).toBeGreaterThan(10);
    for (const l of LUGARES_DE_REGISTRO) {
      expect(l.colecao).toMatch(/^[A-Za-z]+$/);
      expect(l.campo).toMatch(/^[A-Za-z.]+$/);
      expect(l.rotulo.trim()).not.toBe('');
    }
    const chaves = LUGARES_DE_REGISTRO.map(l => l.colecao + '|' + l.campo + '|' + l.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
