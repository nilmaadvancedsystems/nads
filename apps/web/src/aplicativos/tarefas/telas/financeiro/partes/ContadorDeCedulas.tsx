// A contagem de cédulas (19/10/2026, do Toriba): uma linha por nota ou moeda (200, 100, 50 … 0,01) com a quantidade e o
// subtotal, e o total geral embaixo. A quantidade é o texto digitado, por valor ("0.5" é a de 50 centavos).
import { financeiro, formatos } from '@nads/core';

export function ContadorDeCedulas({ quantidades, onMudar }: { quantidades: Record<string, string>; onMudar: (valor: string, quantidade: string) => void }) {
  const numeros = Object.fromEntries(Object.entries(quantidades).map(([k, v]) => [k, Number(v)]));
  return (
    <div className="fin-cedulas">
      <div className="fin-cedulas-linhas">
        {financeiro.CEDULAS.map(c => {
          const chave = String(c);
          const sub = financeiro.totalDasCedulas({ [chave]: numeros[chave] });
          return (
            <label key={chave} className="fin-cedula">
              <span className="fin-cedula-valor">{formatos.reais(c)}</span>
              <span className="fin-cedula-x" aria-hidden="true">×</span>
              <input type="text" inputMode="numeric" value={quantidades[chave] ?? ''} placeholder="0" aria-label={'Quantidade de ' + formatos.reais(c)}
                onChange={e => onMudar(chave, e.target.value.replace(/\D/g, '').slice(0, 7))} />
              <span className={'fin-cedula-sub num' + (sub ? '' : ' fraco')}>{formatos.reais(sub)}</span>
            </label>
          );
        })}
      </div>
      <div className="fin-cedulas-total"><span>Total geral</span><b className="num">{formatos.reais(financeiro.totalDasCedulas(numeros))}</b></div>
    </div>
  );
}
