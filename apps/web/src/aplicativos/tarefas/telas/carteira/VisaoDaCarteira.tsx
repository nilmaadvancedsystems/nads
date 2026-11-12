// Carteira › Visão geral (12/11/2026): o mês da pessoa num olhar — o salário (o holerite), o que o escritório já pagou a
// ela, as comissões (lançadas, aprovadas, pagas) e o saldo das finanças pessoais; os últimos 6 meses num gráfico de barras
// e, embaixo, as comissões do mês e para onde foi o dinheiro.
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, type NomeIcone } from '@nads/ui';
import { Link } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { mesCurto, SeletorDoMes } from './comum';
import { useVisaoDaCarteira } from './useCarteiraDaPessoa';

function Numero({ rotulo, valor, dica, icone, tom }: { rotulo: string; valor: string; dica: string; icone: NomeIcone; tom: 'neutro' | 'aviso' | 'laranja' | 'ok' }) {
  return (
    <div className={'stat painel-numero painel-' + tom}>
      <span className="painel-numero-icone" aria-hidden="true"><Icone nome={icone} /></span>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value num">{valor}</p>
      <p className="hint dp-numero-dica">{dica}</p>
    </div>
  );
}

export function VisaoDaCarteira() {
  const vm = useVisaoDaCarteira();
  const { m, carregando, erro, salario, recebido, totais: t, financas: f, hist, maior, doMes } = vm;
  useCarregando(carregando);
  return (
    <section className="dp-painel cart-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <Link className="btn btn-outline" to={caminhoDaPagina('carteira', 'financas')}><Icone nome="cartao" />Finanças</Link>
        <Link className="btn btn-primary" to={caminhoDaPagina('carteira', 'comissoes') + '?nova=1'}><Icone nome="plus" />Registrar comissão</Link>
      </div>
      {erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{erro}</p>}

      <div className="stat-grid dp-numeros">
        <Numero rotulo="Salário" icone="recibo" tom="neutro" valor={carregando ? '—' : salario == null ? '—' : formatos.reais(salario)}
          dica={salario == null ? 'O holerite do mês ainda não chegou' : 'Líquido do holerite'} />
        <Numero rotulo="Recebido do escritório" icone="check" tom="ok" valor={carregando ? '—' : formatos.reais(recebido.recebido)}
          dica={recebido.aReceber ? formatos.reais(recebido.aReceber) + ' a receber' : 'Pagamentos com comprovante'} />
        <Numero rotulo="Comissões" icone="dinheiro" tom="aviso" valor={carregando ? '—' : formatos.reais(t.total)}
          dica={t.aprovadas ? formatos.reais(t.aprovadas) + ' aprovadas, a receber' : t.lancadas ? formatos.reais(t.lancadas) + ' esperando aprovação' : t.quantas ? 'Todas pagas' : 'Nenhuma no mês'} />
        <Numero rotulo="Saldo das finanças" icone="cartao" tom={f.saldo < 0 ? 'laranja' : 'ok'} valor={carregando ? '—' : formatos.reais(f.saldo)}
          dica={formatos.reais(f.entradas) + ' entraram · ' + formatos.reais(f.saidas) + ' saíram'} />
      </div>

      <div className="cart-duas">
        <section className="card cart-cartao">
          <h3 className="cart-titulo">Últimos 6 meses</h3>
          <div className="cart-grafico" role="img" aria-label="Salário e comissões nos últimos 6 meses">
            {hist.map(h => (
              <div key={h.competencia} className={'cart-coluna' + (h.competencia === m.mes ? ' atual' : '')} title={mesCurto(h.competencia) + ': salário ' + formatos.reais(h.salario) + ', comissões ' + formatos.reais(h.comissoes)}>
                <div className="cart-barras">
                  <span className="cart-barra comissao" style={{ height: (h.comissoes / maior) * 100 + '%' }} />
                  <span className="cart-barra salario" style={{ height: (h.salario / maior) * 100 + '%' }} />
                </div>
                <span className="cart-mes">{mesCurto(h.competencia).slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <p className="cart-legenda"><span className="cart-ponto salario" />Salário <span className="cart-ponto comissao" />Comissões</p>
        </section>

        <section className="card cart-cartao">
          <h3 className="cart-titulo">Para onde foi o dinheiro</h3>
          {f.porCategoria.length ? (
            <ul className="cart-categorias">
              {f.porCategoria.slice(0, 6).map(x => (
                <li key={x.categoria}>
                  <span>{x.categoria}</span>
                  <span className="cart-trilho"><span style={{ width: Math.max(3, x.parte * 100) + '%' }} /></span>
                  <b className="num">{formatos.reais(x.valor)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="fraco cart-vazio">Nenhuma saída lançada no mês. <Link to={caminhoDaPagina('carteira', 'financas')}>Lançar nas finanças</Link></p>}
        </section>
      </div>

      <section className="card cart-cartao">
        <h3 className="cart-titulo">Comissões do mês</h3>
        {doMes.length ? (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Data</th><th>Cliente</th><th>Descrição</th><th className="num">Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {doMes.map(c => (
                  <tr key={c.id}>
                    <td className="num">{c.data.split('-').reverse().join('/')}</td><td>{c.cliente}</td><td className="fraco">{c.descricao}</td>
                    <td className="num">{formatos.reais(c.valor)}</td><td><SeloDaComissao s={c.situacao} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco cart-vazio">Nenhuma comissão em {carteira.mesPorExtenso(m.mes)}.</p>}
      </section>
    </section>
  );
}

const TOM: Record<carteira.SituacaoDaComissao, string> = { lancada: 'badge-warn', aprovada: 'badge-suave badge-info', paga: 'badge-ok', recusada: 'badge-bad' };
export function SeloDaComissao({ s }: { s: carteira.SituacaoDaComissao }) {
  return <span className={'badge ' + TOM[s]}>{carteira.rotuloDaSituacao(s)}</span>;
}
