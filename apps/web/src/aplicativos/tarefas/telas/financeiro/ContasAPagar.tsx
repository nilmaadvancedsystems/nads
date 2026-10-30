// Financeiro › Contas a pagar (28/10/2026: "o Contas a Pagar do Toriba, no nads"), no layout do DP (29/10/2026: "tem que
// seguir o mesmo layout do dp"): em cima, o período do vencimento e os filtros em menus (o fornecedor, a conta contábil)
// e o Nova conta; os números coloridos (Total, A vencer, Vencido, Pago), que filtram a lista ao clicar; no topo da tabela,
// a busca e o Excel só com o ícone; e a lista, a vencida em vermelho. Clicar na linha abre a conta; o Pagar da linha abre
// direto no Pagamento.
import { financeiro, formatos } from '@nads/core';
import { BotaoIcone, CampoData, Icone, LogoExcel, MenuSuspenso, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { dataBr } from './formatosDaNota';
import { JanelaDaContaAPagar } from './JanelaDaContaAPagar';
import { useContasAPagar } from './useContasAPagar';

const TOM: Record<financeiro.SituacaoDaConta, string> = { aberta: 'badge-warn', vencida: 'badge-bad', paga: 'badge-ok' };
// a cor e o ícone de cada número do alto (os tons do Resumo do DP)
const DO_NUMERO: Record<financeiro.FiltroDeSituacao, { tom: 'neutro' | 'aviso' | 'laranja' | 'ok'; icone: NomeIcone }> = {
  todas: { tom: 'neutro', icone: 'dinheiro' },
  aberta: { tom: 'aviso', icone: 'clock' },
  vencida: { tom: 'laranja', icone: 'alert' },
  paga: { tom: 'ok', icone: 'check' },
};

export function ContasAPagar() {
  const vm = useContasAPagar();
  useCarregando(vm.carregando);
  const algumFiltro = !!vm.fornecedor || !!vm.conta || vm.situacao !== 'todas' || !!vm.busca.trim();
  return (
    <section className="dp-painel">
      {vm.aberta && <JanelaDaContaAPagar id={vm.aberta.id} topico={vm.aberta.topico} fechar={vm.fechar} />}

      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuSuspenso rotulo={vm.rotuloDoPeriodo} icone="calendar" titulo="O período, pelo vencimento" dica="Trocar o período" largura={220}
          itens={[
            ...financeiro.PERIODOS_DAS_CONTAS.map(p => ({ rotulo: p.rotulo, marcado: vm.periodo === p.valor, onClick: () => vm.escolherPeriodo(p.valor) })),
            { rotulo: 'Escolher as datas…', marcado: vm.periodo === 'outro', onClick: () => vm.escolherPeriodo('outro') },
          ]} />
        {vm.periodo === 'outro' && (
          <span className="fin-periodo">
            <CampoData valor={vm.de} onMudar={vm.setDe} rotulo="Vencimento do dia" />
            <span className="fraco">até</span>
            <CampoData valor={vm.ate} onMudar={vm.setAte} rotulo="Vencimento até o dia" />
          </span>
        )}
        <MenuDeFiltro rotulo="Fornecedor" valor={vm.fornecedor} mudar={vm.setFornecedor} todos="Todos os fornecedores"
          opcoes={vm.fornecedores.map(f => ({ valor: f.id, rotulo: financeiro.nomeDoFornecedor(f) }))} />
        {vm.contasUsadas.length > 0 && (
          <MenuDeFiltro rotulo="Conta contábil" valor={vm.conta} mudar={vm.setConta} todos="Todas as contas"
            opcoes={vm.contasUsadas.map(c => ({ valor: c.id, rotulo: c.codigo + ' · ' + c.descricao }))} />
        )}
        {algumFiltro && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar filtros</button>}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Nova conta</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.periodoValido && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Confira o período: as duas datas precisam existir e a primeira não pode vir depois da segunda.</p>}
      {vm.semFornecedor && <p className="registro-dica"><Icone nome="predio" />Nenhum fornecedor cadastrado ainda: cadastre na própria conta (Novo, ao lado do fornecedor) ou em Fornecedores.</p>}

      {/* os números coloridos do DP; clicar num filtra a lista pela situação, clicar de novo volta a todas */}
      <div className="stat-grid dp-numeros">
        {vm.numeros.map(n => {
          const ativo = n.situacao !== 'todas' && vm.situacao === n.situacao;
          return (
            <button key={n.situacao} type="button" className={'stat stat-filtro painel-numero painel-' + DO_NUMERO[n.situacao].tom + (ativo ? ' ativo' : '')}
              aria-pressed={ativo} title={n.situacao === 'todas' ? 'Mostrar todas' : ativo ? 'Mostrar todas' : 'Mostrar só: ' + n.rotulo.toLowerCase()}
              onClick={() => vm.setSituacao(ativo ? 'todas' : n.situacao)}>
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome={DO_NUMERO[n.situacao].icone} /></span>
              <p className="stat-label">{n.rotulo}</p>
              <p className="stat-value num">{vm.carregando ? '—' : formatos.reais(n.valor)}</p>
              <p className="hint dp-numero-dica">{n.quantas + (n.quantas === 1 ? ' conta' : ' contas')}</p>
            </button>
          );
        })}
      </div>

      {/* o topo da tabela, como o do DP: a busca e o Excel só com o ícone */}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar conta" aria-label="Buscar conta (ID, fornecedor, documento, valor, observações)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <button type="button" className="icon-btn" title="Exportar a lista para o Excel" aria-label="Exportar a lista para o Excel"
          disabled={!vm.periodoValido || !vm.linhas.length} onClick={vm.exportar}>
          <LogoExcel />
        </button>
      </div>
      <section className="card dp-lista dp-lista-fixa">
        {!vm.carregando && vm.periodoValido && !vm.linhas.length ? (
          <Vazio icone="codigoBarras" titulo={!vm.total ? 'Nenhuma conta a pagar ainda' : vm.filtrando ? 'Nenhuma conta com isso' : 'Nenhuma conta neste período'}>
            {vm.total && vm.filtrando
              ? <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar os filtros</button>
              : vm.total && vm.periodo !== 'tudo'
                ? <button type="button" className="btn btn-outline" onClick={() => vm.escolherPeriodo('tudo')}>Ver todas as datas</button>
                : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Nova conta</button>}
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela cp-lista">
              <thead><tr><th>ID</th><th>Vencimento</th><th>Fornecedor</th><th>Documento</th><th>Conta contábil</th><th className="num">Valor</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {!vm.carregando && vm.linhas.map(({ conta: c, fornecedor, contaDoPlano, situacao }) => (
                  <tr key={c.id} className={'linha-abre' + (situacao === 'vencida' ? ' cp-vencida' : '')} tabIndex={0} title="Abrir a conta"
                    onClick={() => vm.abrir({ id: c.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: c.id }); }}>
                    <td className="num fraco">{c.numero}</td>
                    <td className="num">{dataBr(c.vencimento)}</td>
                    <td className="dp-cliente">
                      <span className="fin-corta" title={fornecedor}>{fornecedor}</span>
                      {c.recorrencia && <span className="fraco cp-parcela">{c.recorrencia.parcela}/{c.recorrencia.de}</span>}
                      {c.anexos.length > 0 && <span className="cp-clipe" title={c.anexos.length + (c.anexos.length === 1 ? ' anexo' : ' anexos')}><Icone nome="clipe" /></span>}
                    </td>
                    <td className="fraco">{c.documento || '—'}</td>
                    <td className="fraco">{contaDoPlano ? <span className="fin-corta" title={contaDoPlano.descricao}>{contaDoPlano.codigo} · {contaDoPlano.descricao}</span> : '—'}</td>
                    <td className="num">{formatos.reais(c.valor)}</td>
                    <td>
                      <span className={'badge ' + TOM[situacao]}>{financeiro.rotuloDaSituacao(situacao)}</span>
                      {c.pagamento && <span className="fraco cp-pago-em">em {dataBr(c.pagamento.data).slice(0, 5)}</span>}
                    </td>
                    <td className="cp-acao">
                      {!c.pagamento && (
                        <BotaoIcone icone="dinheiro" titulo="Pagar a conta" pequeno
                          onClick={e => { e.stopPropagation(); vm.abrir({ id: c.id, topico: 'pagamento' }); }} onKeyDown={e => e.stopPropagation()} />
                      )}
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
