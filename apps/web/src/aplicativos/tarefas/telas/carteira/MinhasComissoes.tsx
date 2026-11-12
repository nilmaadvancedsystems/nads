// Carteira › Comissões (12/11/2026): a pessoa registra as comissões e acompanha cada uma (lançada → aprovada → paga, ou
// recusada com o motivo). Em cima, os números do mês; clicar numa linha abre a comissão (muda enquanto está lançada).
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { SeletorDoMes } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { useMinhasComissoes } from './useCarteiraDaPessoa';
import { SeloDaComissao } from './VisaoDaCarteira';

export function MinhasComissoes() {
  const vm = useMinhasComissoes();
  const { m, lista, totais: t, aberta, setAberta } = vm;
  const todas = { carregada: vm.carregada, erro: vm.erro };
  useCarregando(!vm.carregada);
  const numeros = [
    { rotulo: 'Total do mês', valor: t.total, tom: 'neutro', icone: 'dinheiro' as const },
    { rotulo: 'Esperando aprovação', valor: t.lancadas, tom: 'aviso', icone: 'clock' as const },
    { rotulo: 'Aprovadas, a receber', valor: t.aprovadas, tom: 'laranja', icone: 'check' as const },
    { rotulo: 'Pagas', valor: t.pagas, tom: 'ok', icone: 'checkCircle' as const },
  ];
  return (
    <section className="dp-painel">
      {aberta && <JanelaDaComissao comissao={aberta === 'nova' ? null : aberta} fechar={() => setAberta(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => setAberta('nova')}><Icone nome="plus" />Registrar comissão</button>
      </div>
      {todas.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{todas.erro}</p>}
      <div className="stat-grid dp-numeros">
        {numeros.map(n => (
          <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{todas.carregada ? formatos.reais(n.valor) : '—'}</p>
          </div>
        ))}
      </div>
      <section className="card dp-lista">
        {todas.carregada && !lista.length ? (
          <Vazio icone="dinheiro" titulo={'Nenhuma comissão em ' + carteira.mesPorExtenso(m.mes)} texto="Registre cada comissão aqui: o Financeiro vê, aprova e paga.">
            <button type="button" className="btn btn-primary" onClick={() => setAberta('nova')}><Icone nome="plus" />Registrar comissão</button>
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Data</th><th>Cliente</th><th>Descrição</th><th className="num">Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c.id} className="linha-abre" tabIndex={0} title="Abrir a comissão" onClick={() => setAberta(c)} onKeyDown={e => { if (e.key === 'Enter') setAberta(c); }}>
                    <td className="num">{c.data.split('-').reverse().join('/')}</td>
                    <td>{c.cliente}</td>
                    <td className="fraco">{c.descricao}{c.situacao === 'recusada' && c.motivo ? ' · recusada: ' + c.motivo : ''}</td>
                    <td className="num">{formatos.reais(c.valor)}</td>
                    <td><SeloDaComissao s={c.situacao} />{c.pagoEm && <span className="fraco cp-pago-em">em {c.pagoEm.slice(0, 10).split('-').reverse().join('/').slice(0, 5)}</span>}</td>
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
