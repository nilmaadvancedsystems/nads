// Financeiro › Resultado (22/10/2026, o item 6 da lista do Painel): o mês escolhido contra o mês anterior e o mesmo mês do
// ano passado, conta por conta: as entradas, as saídas e o resultado (entradas − saídas), com a variação sobre o mês
// anterior. Só as peças do catálogo (SeletorMes, Tabela, Vazio).
import { formatos, type financeiro } from '@nads/core';
import { Icone, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { useResultadoPorConta } from './useResultadoPorConta';

const reais = (v: number) => (v ? formatos.reais(v) : '—');
/** a cor do valor: verde no positivo, vermelho no negativo (ou na saída), cinza no zero */
const cor = (v: number, saida?: boolean) => (!v ? 'fraco' : saida || v < 0 ? 'fin-valor-saida' : 'fin-valor-entrada');

function Variacao({ v, saida }: { v: number | null; saida?: boolean }) {
  if (v == null) return <span className="fraco">—</span>;
  // na saída, subir é ruim (vermelho); na entrada, subir é bom (verde)
  const bom = saida ? v <= 0 : v >= 0;
  return <span className={v === 0 ? 'fraco' : bom ? 'fin-valor-entrada' : 'fin-valor-saida'}>{v > 0 ? '+' : ''}{v.toLocaleString('pt-BR')}%</span>;
}

function Linhas({ titulo, linhas, total, saida }: { titulo: string; linhas: financeiro.LinhaDoResultado[]; total: financeiro.ValoresDoResultado; saida?: boolean }) {
  return (
    <>
      <tr className="fin-resultado-grupo"><td colSpan={5}>{titulo}</td></tr>
      {linhas.length ? linhas.map(l => (
        <tr key={l.rotulo}>
          <td className="fin-resultado-conta">{l.rotulo}</td>
          <td className="num">{reais(l.atual)}</td>
          <td className="num"><Variacao v={l.variacao} saida={saida} /></td>
          <td className="num fraco">{reais(l.anterior)}</td>
          <td className="num fraco">{reais(l.anoPassado)}</td>
        </tr>
      )) : <tr><td colSpan={5} className="fraco fin-resultado-conta">Nada nos três meses.</td></tr>}
      <tr className="fin-resultado-total">
        <td>Total</td>
        <td className={'num ' + cor(total.atual, saida)}>{formatos.reais(total.atual)}</td>
        <td className="num"><Variacao v={total.anterior ? Math.round(((total.atual - total.anterior) / total.anterior) * 1000) / 10 : null} saida={saida} /></td>
        <td className="num">{formatos.reais(total.anterior)}</td>
        <td className="num">{formatos.reais(total.anoPassado)}</td>
      </tr>
    </>
  );
}

export function ResultadoPorConta() {
  const vm = useResultadoPorConta();
  useCarregando(vm.carregando);
  const r = vm.resultado, c = vm.colunas;
  const res = r?.totais.resultado;
  return (
    <section className="fin-painel">
      <div className="tarefas-barra-topo">
        <SeletorMes valor={vm.mes} onMudar={vm.setMes} rotulo="Mês" />
        <span className="fraco">comparado com o mês anterior e com o mesmo mês do ano passado</span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {!r || !c ? <Vazio icone="calendar" titulo="Escolha um mês" /> : (
        <div className="card">
          <div className="table-wrap">
            <table className="table-compact fin-resultado">
              <thead><tr><th>Conta</th><th className="num">{c.atual}</th><th className="num">Variação</th><th className="num">{c.anterior}</th><th className="num">{c.anoPassado}</th></tr></thead>
              <tbody>
                <Linhas titulo="Entradas" linhas={r.entradas} total={r.totais.entradas} />
                <Linhas titulo="Saídas" linhas={r.saidas} total={r.totais.saidas} saida />
                {res && (
                  <tr className="fin-resultado-final">
                    <td>Resultado (entradas − saídas)</td>
                    <td className={'num ' + cor(res.atual)}>{formatos.reais(res.atual)}</td>
                    <td />
                    <td className={'num ' + cor(res.anterior)}>{formatos.reais(res.anterior)}</td>
                    <td className={'num ' + cor(res.anoPassado)}>{formatos.reais(res.anoPassado)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
