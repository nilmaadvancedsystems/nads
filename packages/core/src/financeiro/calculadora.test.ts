import { describe, expect, it } from 'vitest';
import { CALCULADORA_INICIAL, calcular, contaEmAberto, resultadoEmReais, teclaDoTeclado, visorFormatado, type EstadoDaCalculadora } from './index';

/** digita uma sequência pelo teclado, como o usuário */
function digitar(texto: string, de: EstadoDaCalculadora = CALCULADORA_INICIAL): EstadoDaCalculadora {
  let e = de;
  for (const k of texto.split('')) { const t = teclaDoTeclado(k); if (t) e = calcular(e, t); }
  return e;
}

describe('a calculadora', () => {
  it('soma sem o erro de vírgula flutuante', () => {
    const e = digitar('0,1+0,2=');
    expect(e.visor).toBe('0,3');
    expect(resultadoEmReais(e)).toBe(0.3);
  });
  it('encadeia as contas na ordem digitada', () => {
    expect(digitar('2+3*4=').visor).toBe('20');
    expect(digitar('100-30-20=').visor).toBe('50');
    expect(contaEmAberto(digitar('1250+'))).toBe('1.250 +');
  });
  it('o último operador vale quando se troca logo depois', () => {
    expect(digitar('5+*3=').visor).toBe('15');
  });
  it('divide, e divisão por zero dá erro até o C', () => {
    expect(digitar('10/4=').visor).toBe('2,5');
    const e = digitar('5/0=');
    expect(e.erro).toBe(true);
    expect(visorFormatado(e)).toBe('Erro');
    expect(resultadoEmReais(e)).toBe(0);
    expect(digitar('7', e).visor).toBe('7');
    expect(calcular(e, { tipo: 'limpar' })).toEqual(CALCULADORA_INICIAL);
  });
  it('percentual: de um número, e sobre o valor anterior na soma e na subtração', () => {
    expect(digitar('50%').visor).toBe('0,5');
    expect(digitar('200+10%=').visor).toBe('220');
    expect(digitar('200-25%=').visor).toBe('150');
    expect(digitar('200*10%=').visor).toBe('20');
  });
  it('apagar, sinal e vírgula', () => {
    expect(digitar('123').visor).toBe('123');
    let e = calcular(digitar('123'), { tipo: 'apagar' });
    expect(e.visor).toBe('12');
    e = calcular(calcular(e, { tipo: 'sinal' }), { tipo: 'digito', digito: '5' });
    expect(e.visor).toBe('-125');
    expect(calcular(calcular(CALCULADORA_INICIAL, { tipo: 'apagar' }), { tipo: 'apagar' }).visor).toBe('0');
    expect(digitar('1,2,3').visor).toBe('1,23');
    expect(digitar(',5').visor).toBe('0,5');
  });
  it('mostra no formato brasileiro, com milhar', () => {
    expect(visorFormatado(digitar('1234567,50'))).toBe('1.234.567,50');
    expect(visorFormatado(digitar('1234,'))).toBe('1.234,');
    expect(visorFormatado(calcular(digitar('1234'), { tipo: 'sinal' }))).toBe('-1.234');
  });
  it('o resultado vai para o lançamento em centavos', () => {
    expect(resultadoEmReais(digitar('10/3='))).toBe(3.33);
  });
  it('as teclas do teclado', () => {
    expect(teclaDoTeclado('Enter')).toEqual({ tipo: 'igual' });
    expect(teclaDoTeclado('Backspace')).toEqual({ tipo: 'apagar' });
    expect(teclaDoTeclado('a')).toBeNull();
  });
});
