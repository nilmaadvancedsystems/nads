// Carteira › Holerites e pagamentos (12/11/2026: "o cara do financeiro pode upar o holerite e o comprovante de pagamento,
// aparecendo pra pessoa"): em cima, os valores do mês e os últimos 6 meses (vieram da Visão geral, que saiu: "na pagina
// de holerite voce mostra os valores"); embaixo, os holerites e comprovantes que o Financeiro subiu para a pessoa e as
// contas a pagar que ele ligou a ela (salário, comissão, adiantamento…), com o comprovante quando a conta foi paga.
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { dataBr } from '../financeiro/formatosDaNota';
import { mesCurto, SeletorDoMes, tamanhoBr } from './comum';

function Numero({ rotulo, valor, dica, icone, tom }: { rotulo: string; valor: string; dica: string; icone: NomeIcone; tom: 'neutro' | 'aviso' | 'ok' }) {
  return (
    <div className={'stat painel-numero painel-' + tom}>
      <span className="painel-numero-icone" aria-hidden="true"><Icone nome={icone} /></span>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value num">{valor}</p>
      <p className="hint dp-numero-dica">{dica}</p>
    </div>
  );
}
import { useHoleritesEPagamentos } from './useCarteiraDaPessoa';

export function HoleritesEPagamentos() {
  const vm = useHoleritesEPagamentos();
  const { m, pags, erro, salario, recebido, totais: t, hist, maior, carregando } = vm;
  const docs = { carregada: vm.docsCarregados, lista: vm.docs };
  const contas = { carregada: vm.contasCarregadas };
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel cart-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{erro}</p>}

      <div className="stat-grid dp-numeros">
        <Numero rotulo="Salário" icone="recibo" tom="neutro" valor={carregando || salario == null ? '—' : formatos.reais(salario)}
          dica={salario == null ? 'O holerite do mês ainda não chegou' : 'Líquido do holerite'} />
        <Numero rotulo="Recebido do escritório" icone="check" tom="ok" valor={carregando ? '—' : formatos.reais(recebido.recebido)}
          dica={recebido.aReceber ? formatos.reais(recebido.aReceber) + ' a receber' : 'Pagamentos com comprovante'} />
        <Numero rotulo="Comissões" icone="dinheiro" tom="aviso" valor={carregando ? '—' : formatos.reais(t.total)}
          dica={t.aprovadas ? formatos.reais(t.aprovadas) + ' aprovadas, a receber' : t.lancadas ? formatos.reais(t.lancadas) + ' esperando aprovação' : t.quantas ? 'Todas pagas' : 'Nenhuma no mês'} />
      </div>

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
        <h3 className="cart-titulo">Holerites e comprovantes</h3>
        {docs.carregada && !docs.lista.length ? <Vazio compacto icone="recibo" titulo="Nenhum documento ainda" texto="Quando o Financeiro subir o seu holerite, ele aparece aqui." /> : (
          <ul className="cart-docs">
            {docs.lista.map(d => (
              <li key={d.id}>
                <span className="cart-doc-icone" aria-hidden="true"><Icone nome={d.tipo === 'holerite' ? 'recibo' : 'checkCircle'} /></span>
                <span className="cart-doc-texto">
                  <b>{carteira.rotuloDoDocumento(d.tipo)} · {mesCurto(d.competencia)}</b>
                  <span className="fraco">{d.arquivo} · {tamanhoBr(d.tamanho)} · enviado por {d.enviadoPor} em {dataBr(d.enviadoEm.slice(0, 10))}</span>
                </span>
                {d.valor != null && <b className="num">{formatos.reais(d.valor)}</b>}
                <button type="button" className="btn btn-outline" onClick={() => vm.abrirDocumento(d)}><Icone nome="olho" />Abrir</button>
                <button type="button" className="btn btn-outline" onClick={() => vm.baixarDocumento(d)}><Icone nome="download" />Baixar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card cart-cartao">
        <h3 className="cart-titulo">Pagamentos do escritório</h3>
        {contas.carregada && !pags.length ? <Vazio compacto icone="dinheiro" titulo="Nenhum pagamento lançado para você" texto="O Financeiro liga as contas a pagar (salário, comissão…) à sua Carteira." /> : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Vencimento</th><th>Pagamento</th><th className="num">Valor</th><th>Situação</th><th>Comprovante</th></tr></thead>
              <tbody>
                {pags.map(p => (
                  <tr key={p.id}>
                    <td className="num">{dataBr(p.vencimento)}</td>
                    <td>{p.rotulo}</td>
                    <td className="num">{formatos.reais(p.pago ? p.valorPago ?? p.valor : p.valor)}</td>
                    <td>{p.pago ? <><span className="badge badge-ok">Pago</span>{p.pagoEm && <span className="fraco cp-pago-em">em {dataBr(p.pagoEm).slice(0, 5)}</span>}</> : <span className="badge badge-warn">A receber</span>}</td>
                    <td>
                      {p.comprovantes.length ? p.comprovantes.map(c => (
                        <button key={c.id} type="button" className="btn btn-ghost btn-sm" title={c.nome} onClick={() => vm.abrirComprovante(p.id, c)}><Icone nome="clipe" />Abrir</button>
                      )) : <span className="fraco">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
