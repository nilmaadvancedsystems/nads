// Carteira › Finanças pessoais (12/11/2026: "ter seu controle financeiro pessoal (individual)"): as entradas e as saídas
// do mês, o saldo e para onde foi o dinheiro. Só a própria pessoa vê.
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { SeletorDoMes } from './comum';
import { JanelaDoLancamentoPessoal } from './JanelaDoLancamentoPessoal';
import { useFinancasPessoais } from './useCarteiraDaPessoa';

export function FinancasPessoais() {
  const vm = useFinancasPessoais();
  const { m, lista, resumo: r, aberto, setAberto } = vm;
  const todos = { carregada: vm.carregado, erro: vm.erro };
  useCarregando(!vm.carregado);
  return (
    <section className="dp-painel">
      {aberto && <JanelaDoLancamentoPessoal lancamento={aberto === 'novo' ? null : aberto} fechar={() => setAberto(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="fraco cart-privado"><Icone nome="lock" />Só você vê</span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Novo lançamento</button>
      </div>
      {todos.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{todos.erro}</p>}
      <div className="stat-grid dp-numeros">
        <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arrowDown" /></span><p className="stat-label">Entradas</p><p className="stat-value num">{formatos.reais(r.entradas)}</p></div>
        <div className="stat painel-numero painel-laranja"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arrowUp" /></span><p className="stat-label">Saídas</p><p className="stat-value num">{formatos.reais(r.saidas)}</p></div>
        <div className={'stat painel-numero ' + (r.saldo < 0 ? 'painel-laranja' : 'painel-neutro')}><span className="painel-numero-icone" aria-hidden="true"><Icone nome="dinheiro" /></span><p className="stat-label">Saldo do mês</p><p className="stat-value num">{formatos.reais(r.saldo)}</p></div>
      </div>
      <div className="cart-duas cart-duas-larga">
        <section className="card dp-lista">
          {todos.carregada && !lista.length ? (
            <Vazio icone="cartao" titulo={'Nada lançado em ' + carteira.mesPorExtenso(m.mes)} texto="Lance o que entra e o que sai para ver o saldo e para onde vai o dinheiro.">
              <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Novo lançamento</button>
            </Vazio>
          ) : (
            <div className="table-wrap">
              <table className="dp-tabela">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {lista.map(l => (
                    <tr key={l.id} className="linha-abre" tabIndex={0} title="Abrir o lançamento" onClick={() => setAberto(l)} onKeyDown={e => { if (e.key === 'Enter') setAberto(l); }}>
                      <td className="num">{l.data.split('-').reverse().join('/')}</td>
                      <td>{l.descricao}</td>
                      <td className="fraco">{l.categoria}</td>
                      <td className={'num ' + (l.tipo === 'entrada' ? 'cart-entrada' : 'cart-saida')}>{(l.tipo === 'entrada' ? '+ ' : '− ') + formatos.reais(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card cart-cartao">
          <h3 className="cart-titulo">Saídas por categoria</h3>
          {r.porCategoria.length ? (
            <ul className="cart-categorias">
              {r.porCategoria.map(x => (
                <li key={x.categoria}>
                  <span>{x.categoria}</span>
                  <span className="cart-trilho"><span style={{ width: Math.max(3, x.parte * 100) + '%' }} /></span>
                  <b className="num">{Math.round(x.parte * 100)}%</b>
                </li>
              ))}
            </ul>
          ) : <p className="fraco cart-vazio">Nenhuma saída no mês.</p>}
        </section>
      </div>
    </section>
  );
}
