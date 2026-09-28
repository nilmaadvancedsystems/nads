import { describe, expect, it } from 'vitest';
import { EMPRESAS_EXEMPLO } from './__exemplos__/empresas';
import { criarRepoConferenciaMemoria } from './repo.memoria';

describe('repositório em memória', () => {
  it('lista = empresas da lista + as guardadas que não estão nela', () => {
    const repo = criarRepoConferenciaMemoria({ guarda: null, lista: [{ codigo: 1, nome: 'LISTA SO LTDA', regime: 'Simples' }] });
    expect(repo.listarEmpresas().map(x => x.nome)).toEqual(['LISTA SO LTDA', 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', 'EXEMPLO SERVICOS MEDICOS LTDA']);
    expect(repo.listarEmpresas()[1].codigo).toBeNull();
  });
  it('lista padrão = os exemplos, sem repetir', () => {
    const repo = criarRepoConferenciaMemoria({ guarda: null });
    expect(repo.listarEmpresas().length).toBe(EMPRESAS_EXEMPLO.length);
  });
  it('salvar avisa quem ouve e muda a versão', () => {
    const repo = criarRepoConferenciaMemoria({ guarda: null });
    let avisos = 0;
    const parar = repo.assinar(() => { avisos++; });
    const e = repo.obter('EXEMPLO COMERCIO DE ALIMENTOS LTDA');
    expect(e).not.toBeNull();
    const v0 = repo.versao();
    repo.salvar({ ...e!, entradas: [] });
    expect(avisos).toBe(1);
    expect(repo.versao()).toBe(v0 + 1);
    parar();
    repo.salvar({ ...e!, saidas: [] });
    expect(avisos).toBe(1);
  });
  it('restaurarExemplos volta ao estado inicial', () => {
    const repo = criarRepoConferenciaMemoria({ guarda: null });
    const nome = 'EXEMPLO COMERCIO DE ALIMENTOS LTDA';
    const qtd = repo.obter(nome)!.entradas.length;
    repo.salvar({ ...repo.obter(nome)!, entradas: [] });
    repo.salvar({ ...repo.obter(nome)!, nome: 'NOVA LTDA' });
    repo.restaurarExemplos();
    expect(repo.obter(nome)!.entradas.length).toBe(qtd);
    expect(repo.obter('NOVA LTDA')).toBeNull();
  });
  it('nome pelo slug da URL', () => {
    const repo = criarRepoConferenciaMemoria({ guarda: null });
    expect(repo.empresaPelaRota('903')).toEqual({ nome: 'EXEMPLO EMPRESA NOVA LTDA', codigo: 903, rota: '903' });
    // link antigo pelo nome aponta para o código
    expect(repo.empresaPelaRota('exemplo-empresa-nova-ltda')).toEqual({ nome: 'EXEMPLO EMPRESA NOVA LTDA', codigo: 903, rota: '903' });
    expect(repo.empresaPelaRota('nao-existe')).toBeNull();
    expect(repo.empresaPelaRota('999')).toBeNull();
  });
  it('guarda: grava a cada mudança e relê na próxima abertura', () => {
    let salvo: string | null = null;
    const guarda = { ler: () => salvo, gravar: (v: string) => { salvo = v; }, apagar: () => { salvo = null; } };
    const r1 = criarRepoConferenciaMemoria({ guarda });
    r1.salvar({ ...r1.obter('EXEMPLO SERVICOS MEDICOS LTDA')!, nome: 'GUARDADA LTDA' });
    const r2 = criarRepoConferenciaMemoria({ guarda });
    expect(r2.obter('GUARDADA LTDA')).not.toBeNull();
  });
});
