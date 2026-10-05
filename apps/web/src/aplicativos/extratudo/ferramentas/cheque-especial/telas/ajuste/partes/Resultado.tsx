// Resultado do ajuste: números, aviso do estorno projetado e a tabela dos lançamentos
// (cheque_especial.html renderResults ~L688).
import { chequeEspecial as ce, formatos } from '@nads/core';
import { Alerta, Stat } from '@nads/ui';
import type { ResultadoTela } from '../useAjuste';

function Selo({ l }: { l: ce.Lancamento }) {
  if (l.projetado) return <span className="badge badge-bad">Estorno (projetado)</span>;
  return <span className={'badge ' + (l.tipo === 'Ajuste' ? 'badge-warn' : 'badge-ok')}>{l.tipo}</span>;
}

const valor = (n: number) => formatos.reais(n);

export function Resultado({ r }: { r: ResultadoTela }) {
  const { resumo, res } = r;
  if (!res.lancamentos.length) {
    return (
      <>
        <div className="stat-grid">
          <Stat rotulo="Dias analisados" valor={resumo.diasAnalisados} />
          <Stat rotulo="Dias negativos" valor={0} />
        </div>
        <p className="empty">Nenhum dia com saldo de fechamento negativo foi encontrado — nenhum lançamento de ajuste é necessário.</p>
      </>
    );
  }
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Dias analisados" valor={resumo.diasAnalisados} />
        <Stat rotulo="Dias negativos" valor={resumo.diasNegativos} cor="entrada" />
        <Stat rotulo="Lançamentos gerados" valor={resumo.qtdLancamentos} />
        <Stat rotulo="Total ajustado" valor={formatos.reais(resumo.totalAjustado)} cor="saida" />
      </div>
      {r.dataProjetada && (
        <Alerta titulo="Estorno projetado"
          texto={'O período do relatório termina em um dia com saldo negativo ainda não revertido. O último estorno foi calculado para o próximo dia útil (' + r.dataProjetada + '), mas confirme com o extrato bancário real antes de lançar, pois esse dia está fora do período enviado.'} />
      )}
      <div className="card">
        <div className="card-head">
          <h3>Lançamentos de ajuste</h3>
          <span className="hint">{res.lancamentos.length} linha(s) · arquivo: (vazio) · Débito · Crédito · Data · Valor · Histórico</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Débito</th><th>Crédito</th><th className="num">Valor</th><th>Histórico</th><th>Observação</th></tr></thead>
            <tbody>
              {res.lancamentos.map((l, i) => (
                <tr key={i}>
                  <td>{ce.dataBR(l.data)}</td>
                  <td><Selo l={l} /></td>
                  <td>{l.debito}</td>
                  <td>{l.credito}</td>
                  <td className="num">{valor(l.valor)}</td>
                  <td>{l.historico}</td>
                  <td className="wrap">{l.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
