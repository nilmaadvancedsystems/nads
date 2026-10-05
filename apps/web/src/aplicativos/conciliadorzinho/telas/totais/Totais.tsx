// Etapa Totais (conciliadorZINHO.html #step-totals ~L640). "Baixar PDF" imprime esta tela.
import { conciliadorzinho as cz } from '@nads/core';
import { Alerta, Icone } from '@nads/ui';
import { AcoesDoTopo } from '../../../../comum/topo';
import { useTotais } from './useTotais';

function imprimir(titulo: string) {
  const antes = document.title;
  document.title = titulo;
  window.print();
  setTimeout(() => { document.title = antes; }, 500);
}

export function Totais() {
  const vm = useTotais();
  if (!vm.ok) {
    return (
      <section>
        <Alerta titulo="Não conseguimos bater os totais" texto="Mesmo reanalisando do zero, encontramos diferenças:">
          {vm.problemas.map((p, i) => <p key={i} className="alert-text">{p}</p>)}
          <div style={{ marginTop: 8 }}><button className="btn btn-outline" type="button" onClick={vm.recomecar}>Reenviar arquivos do zero</button></div>
        </Alerta>
      </section>
    );
  }
  return (
    <section>
      <AcoesDoTopo>
        <button className="btn btn-outline" type="button" onClick={() => imprimir(vm.tituloPdf)}><Icone nome="impressora" />Baixar PDF</button>
      </AcoesDoTopo>
      <p className="page-desc" style={{ marginTop: 0, marginBottom: 16 }}>Conferimos os totais antes de liberar os arquivos.</p>
      {vm.meses.map(m => (
        <div key={m.rotulo} className="card">
          <div className="card-head"><h3>{m.rotulo}</h3></div>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Notas conciliadas (com cartão): <strong className="num">{cz.brl(m.vendasComCartao)}</strong></p>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Notas não conciliadas (Saídas): <strong className="num">{cz.brl(m.vendasSemCartao)}</strong></p>
          <p style={{ fontSize: 13, marginBottom: 12 }}>Total de vendas do mês: <strong className="num">{cz.brl(m.vendasComCartao)}</strong> + <strong className="num">{cz.brl(m.vendasSemCartao)}</strong> = <strong className="num">{cz.brl(m.totalVendas)}</strong></p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bandeira</th><th className="num">Vendas brutas</th><th className="num">Taxas</th></tr></thead>
              <tbody>
                {m.linhas.map(l => <tr key={l.id}><td>{l.rotulo}</td><td className="num">{cz.brl(l.bruto)}</td><td className="num">{cz.brl(l.taxa)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {/* sem o Voltar (Vitor, 05/10/2026: tudo é navegável pela barra de cima) */}
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-success" type="button" onClick={vm.baixarArquivos}>Baixar arquivos</button>
      </div>
    </section>
  );
}
