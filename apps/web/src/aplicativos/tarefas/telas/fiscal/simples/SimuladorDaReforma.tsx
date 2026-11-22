// Fiscal › Calculadora do Simples › "Reforma 2027: IBS/CBS dentro ou fora do DAS" (22/11/2026): o simulador do
// escritório para orientar o cliente. Parte do DAS do mês que a calculadora acabou de fazer (e da parte do PIS e da COFINS
// dele, que vira CBS) e das compras do SIEG; a pessoa ajusta quanto a empresa vende para contribuintes, as compras e as
// alíquotas. A conta é do core (reforma.simularDentroOuFora); aqui só se desenha. Só as peças do catálogo: Alerta,
// Tabela padrão, Valor editável e selo suave.
import { reforma, tarefas as t } from '@nads/core';
import { Alerta } from '@nads/ui';
import { useMemo, useState } from 'react';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = (texto: string) => { const n = Number(String(texto).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function SimuladorDaReforma({ calculo, comprasDoSieg }: { calculo: t.sieg.CalculoDoSimples; comprasDoSieg: number | null }) {
  const pisCofins = calculo.porTributo.filter(x => x.tributo === 'PIS' || x.tributo === 'COFINS').reduce((s, x) => s + x.valor, 0);
  const [parte, setParte] = useState(50);
  const [compras, setCompras] = useState<number | null>(null);
  const [cbs, setCbs] = useState<number>(reforma.ALIQUOTAS_PADRAO.cbs);
  const [ibs, setIbs] = useState<number>(reforma.ALIQUOTAS_PADRAO.ibs);
  const comprasUsadas = compras ?? comprasDoSieg ?? 0;
  const r = useMemo(() => reforma.simularDentroOuFora({
    receita: calculo.receita, das: calculo.total, pisCofinsNoDas: pisCofins, parteParaContribuintes: parte, comprasComCredito: comprasUsadas, aliquotaCbs: cbs, aliquotaIbs: ibs,
  }), [calculo.receita, calculo.total, pisCofins, parte, comprasUsadas, cbs, ibs]);
  const editar = (definir: (n: number) => void) => (texto: string) => { const n = numero(texto); if (n != null && n >= 0) definir(n); };
  const titulo = r.sugestao === 'fora' ? 'Vale avaliar recolher fora do DAS' : r.sugestao === 'dentro' ? 'Dentro do DAS sai melhor' : 'Sem como comparar';
  return (
    <div className="fc-reforma">
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>O que a simulação usa</th><th className="num">Valor</th><th>De onde vem</th></tr></thead>
          <tbody>
            <tr><td>Receita do mês</td><td className="num">{brl(calculo.receita)}</td><td><span className="badge badge-suave badge-ok">A conta acima</span></td></tr>
            <tr><td>DAS do mês · parte do PIS e da COFINS (vira CBS)</td><td className="num">{brl(calculo.total)} · {brl(pisCofins)}</td><td><span className="badge badge-suave badge-ok">A conta acima</span></td></tr>
            <tr>
              <td>Quanto da receita vai para empresas que tomam crédito (%)</td>
              <td className="num"><ValorEditavel zeroVale valor={parte} rotulo="Parte da receita para contribuintes (%)" aoSalvar={editar(n => setParte(Math.min(100, n)))} /></td>
              <td><span className="badge badge-suave badge-warn">Digite</span></td>
            </tr>
            <tr>
              <td>Compras do mês com crédito (revenda, insumos, frete)</td>
              <td className="num"><ValorEditavel zeroVale valor={comprasUsadas} rotulo="Compras com crédito (R$)" aoSalvar={editar(setCompras)} /></td>
              <td><span className={'badge badge-suave ' + (compras != null ? 'badge-warn' : comprasDoSieg != null ? 'badge-ok' : 'badge-neutral')}>{compras != null ? 'Digitado' : comprasDoSieg != null ? 'SIEG' : 'Sem dado'}</span></td>
            </tr>
            <tr>
              <td>Alíquota da CBS (%) · estimativa</td>
              <td className="num"><ValorEditavel zeroVale valor={cbs} rotulo="Alíquota da CBS (%)" aoSalvar={editar(setCbs)} /></td>
              <td><span className="badge badge-suave badge-neutral">Troque quando sair a de 2027</span></td>
            </tr>
            <tr>
              <td>Alíquota do IBS (%)</td>
              <td className="num"><ValorEditavel zeroVale valor={ibs} rotulo="Alíquota do IBS (%)" aoSalvar={editar(setIbs)} /></td>
              <td><span className="badge badge-suave badge-neutral">2027 e 2028</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Por mês</th><th className="num">Dentro do DAS</th><th className="num">Fora do DAS</th></tr></thead>
          <tbody>
            <tr><td>DAS</td><td className="num">{brl(r.dentro.das)}</td><td className="num">{brl(r.fora.das)}</td></tr>
            <tr><td>CBS e IBS fora do DAS (já com o crédito das compras, de {brl(r.fora.creditoDasCompras)})</td><td className="num">—</td><td className="num">{brl(r.fora.cbsIbsFora)}</td></tr>
            <tr><td><b>A empresa paga</b></td><td className="num"><b>{brl(r.dentro.imposto)}</b></td><td className="num"><b>{brl(r.fora.imposto)}</b></td></tr>
            <tr><td>Crédito que os clientes contribuintes tomam</td><td className="num">{brl(r.dentro.creditoDosClientes)}</td><td className="num">{brl(r.fora.creditoDosClientes)}</td></tr>
          </tbody>
        </table>
      </div>
      <Alerta naLinha tom={r.sugestao === 'tanto-faz' ? undefined : 'ok'} titulo={titulo} texto={r.texto} />
      <ul className="hint fc-reforma-hipoteses">
        {reforma.HIPOTESES.map(h => <li key={h}>{h}</li>)}
      </ul>
    </div>
  );
}
