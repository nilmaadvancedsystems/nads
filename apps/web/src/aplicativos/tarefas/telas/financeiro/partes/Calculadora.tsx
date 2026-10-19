// A calculadora do Caixa (19/10/2026): a conta aberta em cima, o visor grande no jeito brasileiro (1.234,56) e as teclas
// em grade (C ⌫ % ÷ / 7 8 9 × / 4 5 6 − / 1 2 3 + / ± 0 , =). Só desenha: a conta é do redutor de @nads/core.
import { financeiro } from '@nads/core';

type Tecla = { rotulo: string; tecla: financeiro.TeclaDaCalculadora; tom?: 'op' | 'igual' | 'sup'; nome: string };
const d = (n: string): Tecla => ({ rotulo: n, nome: n, tecla: { tipo: 'digito', digito: n } });
const op = (o: financeiro.OperadorDaCalculadora, nome: string): Tecla => ({ rotulo: financeiro.SIMBOLO_DO_OPERADOR[o], nome, tom: 'op', tecla: { tipo: 'operador', operador: o } });
const TECLAS: Tecla[] = [
  { rotulo: 'C', nome: 'Limpar', tom: 'sup', tecla: { tipo: 'limpar' } }, { rotulo: '⌫', nome: 'Apagar', tom: 'sup', tecla: { tipo: 'apagar' } },
  { rotulo: '%', nome: 'Porcentagem', tom: 'sup', tecla: { tipo: 'percentual' } }, op('/', 'Dividir'),
  d('7'), d('8'), d('9'), op('*', 'Multiplicar'),
  d('4'), d('5'), d('6'), op('-', 'Subtrair'),
  d('1'), d('2'), d('3'), op('+', 'Somar'),
  { rotulo: '±', nome: 'Trocar o sinal', tom: 'sup', tecla: { tipo: 'sinal' } }, d('0'), { rotulo: ',', nome: 'Vírgula', tecla: { tipo: 'virgula' } },
  { rotulo: '=', nome: 'Igual', tom: 'igual', tecla: { tipo: 'igual' } },
];

export function Calculadora({ estado, aoTecla }: { estado: financeiro.EstadoDaCalculadora; aoTecla: (t: financeiro.TeclaDaCalculadora) => void }) {
  return (
    <div className="fin-calc">
      <div className="fin-calc-visor" aria-live="polite">
        <span className="fin-calc-conta fraco">{financeiro.contaEmAberto(estado) || ' '}</span>
        <output className={'fin-calc-numero num' + (estado.erro ? ' fin-calc-erro' : '')}>{financeiro.visorFormatado(estado)}</output>
      </div>
      <div className="fin-calc-teclas">
        {TECLAS.map(t => (
          <button key={t.nome} type="button" aria-label={t.nome} tabIndex={-1}
            className={'btn fin-calc-tecla ' + (t.tom === 'igual' ? 'btn-primary' : 'btn-outline') + (t.tom ? ' fin-calc-' + t.tom : '')}
            onClick={() => aoTecla(t.tecla)}>{t.rotulo}</button>
        ))}
      </div>
    </div>
  );
}
