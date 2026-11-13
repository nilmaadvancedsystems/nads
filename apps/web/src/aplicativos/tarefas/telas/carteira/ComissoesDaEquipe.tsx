// Carteira › Comissões da equipe, o lado do Financeiro (12/11/2026: "para que fique resumido para o financeiro fazer o
// pagamento"): no mês, uma linha por pessoa com o que falta revisar, o que está aprovado (a pagar) e o que já foi pago, com
// Aprovar tudo e Marcar como pago; abrir a pessoa mostra as comissões dela, uma a uma (aprovar, recusar com o motivo,
// voltar para lançada).
import { carteira, formatos } from '@nads/core';
import { BotaoIcone, Icone, MenuSuspenso, useCarregando, Vazio } from '@nads/ui';
import { Fragment } from 'react';
import type { Decisao } from '../../dados/carteira';
import { SeletorDoMes, SeloDaComissao } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { JanelaDosServicos } from './JanelaDosServicos';
import { useComissoesDaEquipe } from './useCarteiraDaPessoa';

// o ⚡ do modo desenvolvedor, como no Início: marcar põe os exemplos na tela; nada vai para o banco
function DadosDeTeste({ t }: { t: ReturnType<typeof useComissoesDaEquipe>['teste'] }) {
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={280} titulo="Modo desenvolvedor · nada vai para o banco"
      itens={[
        { rotulo: 'Comissões de exemplo', icone: 'dinheiro', marcado: t.comissoes && !t.propria, onClick: () => t.ligar(t.comissoes && !t.propria ? false : 'comissoes') },
        { rotulo: 'Comissões com a % própria (50%)', icone: 'usuario', marcado: t.propria, onClick: () => t.ligar(t.propria ? false : 'propria') },
        'separador',
        { rotulo: 'Apagar os dados de teste', icone: 'x', desabilitado: !t.comissoes, onClick: () => t.ligar(false) },
      ]} />
  );
}

export function ComissoesDaEquipe() {
  const vm = useComissoesDaEquipe();
  const { m, resumo, totais: t, aberta, fazendo } = vm;
  const doMes = { carregada: vm.carregada, erro: vm.erro, lista: vm.todas };
  useCarregando(!vm.carregada);
  const motivo = (guardar: (t: string) => void) => <input type="text" className="usuario-campo cart-motivo" placeholder="O motivo (opcional)" aria-label="O motivo da recusa" maxLength={300} onChange={e => guardar(e.target.value)} />;
  const decidir = (chave: string, ids: string[], situacao: Decisao, ok: string) => vm.decidir(chave, ids, situacao, ok, motivo);
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {vm.dev && <DadosDeTeste t={vm.teste} />}
        <button type="button" className="btn btn-outline" onClick={() => vm.setJanela('servicos')}><Icone nome="settings" />Serviços</button>
        <button type="button" className="btn btn-primary" onClick={() => vm.setJanela('registrar')}><Icone nome="plus" />Registrar comissão</button>
      </div>
      {vm.janela === 'registrar' && <JanelaDaComissao comissao={null} doFinanceiro fechar={() => vm.setJanela('')} />}
      {vm.janela === 'servicos' && <JanelaDosServicos fechar={() => vm.setJanela('')} />}
      {doMes.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{doMes.erro}</p>}
      <div className="stat-grid dp-numeros">
        <div className="stat painel-numero painel-aviso"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="clock" /></span><p className="stat-label">Para revisar</p><p className="stat-value num">{formatos.reais(t.lancadas)}</p></div>
        <div className="stat painel-numero painel-laranja"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="dinheiro" /></span><p className="stat-label">Aprovado, a pagar</p><p className="stat-value num">{formatos.reais(t.aprovadas)}</p></div>
        <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="checkCircle" /></span><p className="stat-label">Pago no mês</p><p className="stat-value num">{formatos.reais(t.pagas)}</p></div>
      </div>
      <section className="card dp-lista">
        {doMes.carregada && !resumo.length ? <Vazio icone="dinheiro" titulo={'Nenhuma comissão em ' + carteira.mesPorExtenso(m.mes)} texto="As comissões que a equipe registrar na Carteira aparecem aqui." /> : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Pessoa</th><th className="num">Comissões</th><th className="num">Para revisar</th><th className="num">A pagar</th><th className="num">Pago</th><th /></tr></thead>
              <tbody>
                {resumo.map(p => {
                  const dela = doMes.lista.filter(c => c.uid === p.uid);
                  return (
                    <Fragment key={p.uid}>
                      <tr className="linha-abre" tabIndex={0} title={aberta === p.uid ? 'Fechar' : 'Ver as comissões'} onClick={() => vm.alternar(p.uid)} onKeyDown={e => { if (e.key === 'Enter') vm.alternar(p.uid); }}>
                        <td><Icone nome={aberta === p.uid ? 'caretDown' : 'chevronRight'} width={14} height={14} /> <b>{p.nome}</b></td>
                        <td className="num">{p.quantas}</td>
                        <td className="num">{p.aRevisar ? formatos.reais(p.aRevisar) : '—'}</td>
                        <td className="num"><b>{p.aPagar ? formatos.reais(p.aPagar) : '—'}</b></td>
                        <td className="num">{p.pagas ? formatos.reais(p.pagas) : '—'}</td>
                        <td className="cart-acoes" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                          {p.ids.lancadas.length > 0 && <button type="button" className="btn btn-outline btn-sm" disabled={!!fazendo} onClick={() => void decidir('a' + p.uid, p.ids.lancadas, 'aprovada', 'Comissões aprovadas.')}><Icone nome="check" />Aprovar tudo</button>}
                          {p.ids.aprovadas.length > 0 && <button type="button" className="btn btn-primary btn-sm" disabled={!!fazendo} onClick={() => void decidir('p' + p.uid, p.ids.aprovadas, 'paga', 'Marcado como pago.')}><Icone nome="dinheiro" />Marcar como pago</button>}
                        </td>
                      </tr>
                      {aberta === p.uid && dela.map(c => (
                        <tr key={c.id} className="cart-sublinha">
                          <td className="fraco">{c.data.split('-').reverse().join('/')} · {c.cliente}</td>
                          <td colSpan={2} className="fraco">{c.descricao}{c.motivo ? ' · ' + c.motivo : ''}</td>
                          <td className="num">{formatos.reais(c.valor)}</td>
                          <td><SeloDaComissao s={c.situacao} /></td>
                          <td className="cart-acoes">
                            {c.situacao === 'lancada' && <BotaoIcone icone="check" titulo="Aprovar" pequeno disabled={!!fazendo} onClick={() => void decidir(c.id, [c.id], 'aprovada', 'Aprovada.')} />}
                            {c.situacao === 'lancada' && <BotaoIcone icone="x" titulo="Recusar" pequeno disabled={!!fazendo} onClick={() => void decidir(c.id, [c.id], 'recusada', 'Recusada.')} />}
                            {(c.situacao === 'aprovada' || c.situacao === 'recusada') && <BotaoIcone icone="repeat" titulo="Voltar para lançada" pequeno disabled={!!fazendo} onClick={() => void decidir(c.id, [c.id], 'lancada', 'Voltou para lançada.')} />}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
