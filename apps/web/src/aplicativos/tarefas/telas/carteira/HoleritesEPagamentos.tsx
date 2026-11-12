// Carteira › Holerites e pagamentos (12/11/2026: "o cara do financeiro pode upar o holerite e o comprovante de pagamento,
// aparecendo pra pessoa"): os holerites e comprovantes que o Financeiro subiu para a pessoa e as contas a pagar que ele
// ligou a ela (salário, comissão, adiantamento…), com o comprovante quando a conta foi paga.
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { dataBr } from '../financeiro/formatosDaNota';
import { mesCurto, tamanhoBr } from './comum';
import { useHoleritesEPagamentos } from './useCarteiraDaPessoa';

export function HoleritesEPagamentos() {
  const vm = useHoleritesEPagamentos();
  const { pags, erro } = vm;
  const docs = { carregada: vm.docsCarregados, lista: vm.docs };
  const contas = { carregada: vm.contasCarregadas };
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <span className="fraco">O Financeiro sobe aqui os seus holerites e comprovantes; os pagamentos que ele lançar para você também aparecem.</span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{erro}</p>}

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
