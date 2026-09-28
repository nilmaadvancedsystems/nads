import { describe, expect, it } from 'vitest';
import { empresaPelaRota, rotaDaEmpresa } from './repo';
import { CLIENTES } from './tabelas/clientes';
import type { EmpresaDaLista } from './tipos';

const LISTA: EmpresaDaLista[] = [
  { codigo: 292, nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', regime: 'Presumido' },
  { codigo: 79, nome: 'BN ELETRODOMESTICOS LTDA', regime: 'Simples' },
  { codigo: 145, nome: 'BN ELETRODOMESTICOS LTDA', regime: 'Simples' },
];

describe('rotas da empresa pelo código do ERP', () => {
  it('a rota é o código', () => {
    expect(rotaDaEmpresa(LISTA, 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA')).toBe('292');
  });

  it('empresa sem código (só no banco) fica pelo nome', () => {
    expect(rotaDaEmpresa(LISTA, 'EMPRESA SÓ NO BANCO LTDA')).toBe('empresa-so-no-banco-ltda');
    expect(empresaPelaRota(LISTA, ['EMPRESA SÓ NO BANCO LTDA'], 'empresa-so-no-banco-ltda'))
      .toEqual({ nome: 'EMPRESA SÓ NO BANCO LTDA', codigo: null, rota: 'empresa-so-no-banco-ltda' });
  });

  it('/292 abre a FITO', () => {
    expect(empresaPelaRota(LISTA, [], '292')).toEqual({ nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', codigo: 292, rota: '292' });
  });

  it('link antigo pelo nome aponta para o código', () => {
    expect(empresaPelaRota(LISTA, [], 'fito-industria-e-comercio-de-alimentos-ltda')?.rota).toBe('292');
  });

  it('mesmo nome com dois códigos: cada código abre a mesma empresa e guarda o seu número', () => {
    expect(empresaPelaRota(LISTA, [], '79')).toEqual({ nome: 'BN ELETRODOMESTICOS LTDA', codigo: 79, rota: '79' });
    expect(empresaPelaRota(LISTA, [], '145')).toEqual({ nome: 'BN ELETRODOMESTICOS LTDA', codigo: 145, rota: '145' });
    // pelo nome, vai para o primeiro código
    expect(empresaPelaRota(LISTA, [], 'bn-eletrodomesticos-ltda')?.rota).toBe('79');
  });

  it('código ou nome que não existe → nada', () => {
    expect(empresaPelaRota(LISTA, [], '999')).toBeNull();
    expect(empresaPelaRota(LISTA, [], 'nao-existe')).toBeNull();
  });

  it('a lista real não tem código repetido', () => {
    const cods = CLIENTES.map(c => c.codigo);
    expect(new Set(cods).size).toBe(cods.length);
  });
});
