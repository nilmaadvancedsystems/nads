// Carteira › Comissões (12/11/2026): a pessoa registra as comissões e acompanha cada uma (lançada → aprovada → paga, ou
// recusada com o motivo). Em cima, o total do mês com a barra das partes; clicar numa linha abre a comissão (muda enquanto está lançada).
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { DadosDeTesteDaCarteira, SeletorDoMes, SeloDaComissao } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { useMinhasComissoes } from './useCarteiraDaPessoa';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** '2026-11-15' → { dia: '15', mes: 'nov' } */
const diaEMes = (d: string) => ({ dia: d.slice(8, 10), mes: MES_CURTO[Number(d.slice(5, 7)) - 1] || '' });
const ddmm = (d: string) => d.slice(0, 10).split('-').reverse().join('/').slice(0, 5);

/**
 * O topo redesenhado (Vitor, 15/11/2026: "melhora o visual desse inicio da carteira, não to achando legal, refaça de outra
 * maneira"): no lugar dos quatro cartões coloridos, um cartão só com o total do mês e a barra das partes (a receber e pagas,
 * sem a aprovação desde 19/11/2026; as cores das cápsulas da lista); e, no lugar da tabela, a lista em linhas: a data num bloquinho, o cliente
 * com o serviço embaixo, o valor e a situação à direita.
 */
export function MinhasComissoes() {
  const vm = useMinhasComissoes();
  const { m, lista, totais: t, aberta, setAberta } = vm;
  useCarregando(!vm.carregada);
  // sem a aprovação (Vitor, 19/11/2026: "nao existe isso, nao existe aprovacao"): o que falta receber e o que já foi pago
  const partes = [
    { id: 'aprovada', rotulo: 'A receber', valor: t.lancadas + t.aprovadas },
    { id: 'paga', rotulo: 'Pagas', valor: t.pagas },
  ];
  const nomeDoMes = carteira.mesPorExtenso(m.mes).split(' ')[0];
  return (
    <section className="dp-painel cmc">
      {aberta && <JanelaDaComissao comissao={aberta === 'nova' ? null : aberta} fechar={() => setAberta(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <DadosDeTesteDaCarteira />
        <button type="button" className="btn btn-primary" onClick={() => setAberta('nova')}><Icone nome="plus" />Registrar comissão</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <section className="card cmc-resumo" aria-label={'O total de ' + nomeDoMes}>
        <div className="cmc-total">
          <span className="cmc-rotulo">Total de {nomeDoMes}</span>
          <b className="cmc-valor num">{vm.carregada ? formatos.reais(t.total) : '—'}</b>
          <span className="hint">{t.quantas === 1 ? '1 comissão' : t.quantas + ' comissões'}{t.recusadas > 0 ? ' · ' + formatos.reais(t.recusadas) + ' recusado' : ''}</span>
        </div>
        <div className="cmc-partes">
          <div className="cmc-barra" aria-hidden="true">
            {t.total > 0 && partes.filter(x => x.valor > 0).map(x => <i key={x.id} className={'cmc-' + x.id} style={{ flexGrow: x.valor }} />)}
          </div>
          <ul className="cmc-legenda">
            {partes.map(x => (
              <li key={x.id}>
                <span className={'cmc-ponto cmc-' + x.id} aria-hidden="true" />
                <span className="cmc-rotulo">{x.rotulo}</span>
                <b className="num">{vm.carregada ? formatos.reais(x.valor) : '—'}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card cmc-lista" aria-label="As comissões do mês">
        {vm.carregada && !lista.length ? (
          <Vazio icone="dinheiro" titulo={'Nenhuma comissão em ' + carteira.mesPorExtenso(m.mes)} texto="Registre cada comissão aqui: ela entra para pagamento no mês seguinte, e o Financeiro vê e paga.">
            <button type="button" className="btn btn-primary" onClick={() => setAberta('nova')}><Icone nome="plus" />Registrar comissão</button>
          </Vazio>
        ) : (
          <ul>
            {lista.map(c => {
              const d = diaEMes(c.data);
              return (
                <li key={c.id}>
                  <button type="button" className={'cmc-linha ' + c.situacao} title="Abrir a comissão" onClick={() => setAberta(c)}>
                    <span className="cmc-data" aria-label={c.data.split('-').reverse().join('/')}><b>{d.dia}</b><span>{d.mes}</span></span>
                    <span className="cmc-quem">
                      <b>{c.cliente}{c.porte && <span className="fraco"> · {c.porte}</span>}</b>
                      <span className="fraco">{c.descricao}</span>
                      {c.situacao === 'recusada' && c.motivo && <span className="cmc-motivo">Recusada: {c.motivo}</span>}
                    </span>
                    {/* a escondida (16/11/2026): sem o valor */}
                    <b className="cmc-quanto num">{c.oculta ? '—' : formatos.reais(c.valor)}</b>
                    <span className="cmc-situacao">
                      <SeloDaComissao s={c.situacao} semAprovacao />
                      {c.pagoEm && <span className="fraco">em {ddmm(c.pagoEm)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
