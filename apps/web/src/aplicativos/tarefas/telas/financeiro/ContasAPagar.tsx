// Financeiro › Contas a pagar (28/10/2026: "o Contas a Pagar do Toriba, no nads"): uma barra só, como a do Caixa (o período
// do vencimento num menu, o fornecedor, a conta contábil, a situação, a busca e, à direita, o Exportar Excel e o Nova
// conta), os totais do que está na lista e a lista: a vencida em vermelho. Clicar na linha abre a conta; o Pagar da linha
// abre direto no Pagamento.
import { financeiro, formatos } from '@nads/core';
import { CampoData, Icone, MenuSuspenso, Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { dataBr } from './formatosDaNota';
import { JanelaDaContaAPagar } from './JanelaDaContaAPagar';
import { FILTROS_DE_SITUACAO, useContasAPagar } from './useContasAPagar';

const TOM: Record<financeiro.SituacaoDaConta, string> = { aberta: 'badge-warn', vencida: 'badge-bad', paga: 'badge-ok' };

export function ContasAPagar() {
  const vm = useContasAPagar();
  useCarregando(vm.carregando);
  const t = vm.totais;
  return (
    <section>
      {vm.aberta && <JanelaDaContaAPagar id={vm.aberta.id} topico={vm.aberta.topico} fechar={vm.fechar} />}

      <div className="tarefas-barra-topo fin-barra">
        <MenuSuspenso rotulo={vm.rotuloDoPeriodo} icone="calendar" titulo="O período, pelo vencimento" largura={220}
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
        <MenuSuspenso rotulo={vm.rotuloDoFornecedor} icone="predio" titulo="O fornecedor" largura={280}
          itens={[
            { rotulo: 'Todos os fornecedores', marcado: !vm.fornecedor, onClick: () => vm.setFornecedor('') },
            ...vm.fornecedores.map(f => ({ rotulo: financeiro.nomeDoFornecedor(f), marcado: vm.fornecedor === f.id, onClick: () => vm.setFornecedor(f.id) })),
          ]} />
        {vm.contasUsadas.length > 0 && (
          <MenuSuspenso rotulo={vm.rotuloDaConta} icone="list" titulo="A conta contábil" largura={300}
            itens={[
              { rotulo: 'Todas as contas', marcado: !vm.conta, onClick: () => vm.setConta('') },
              ...vm.contasUsadas.map(c => ({ rotulo: c.codigo + ' · ' + c.descricao, marcado: vm.conta === c.id, onClick: () => vm.setConta(c.id) })),
            ]} />
        )}
        <Segmentado valor={vm.situacao} opcoes={FILTROS_DE_SITUACAO} onMudar={vm.setSituacao} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar conta" aria-label="Buscar conta (ID, fornecedor, documento, valor, observações)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="fin-acoes">
          {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          <button type="button" className="btn btn-outline" disabled={!vm.periodoValido || !vm.linhas.length} onClick={vm.exportar} title="A planilha com o que está na lista"><Icone nome="download" />Exportar Excel</button>
          <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Nova conta</button>
        </span>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.periodoValido && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Confira o período: as duas datas precisam existir e a primeira não pode vir depois da segunda.</p>}
      {vm.semFornecedor && <p className="registro-dica"><Icone nome="predio" />Nenhum fornecedor cadastrado ainda: cadastre na própria conta (Novo, ao lado do fornecedor) ou em Fornecedores.</p>}

      <div className="stat-grid fin-numeros">
        <Stat rotulo="Total" valor={formatos.reais(t.valor)} sub={t.quantas + (t.quantas === 1 ? ' conta' : ' contas')} />
        <Stat rotulo="A pagar" valor={formatos.reais(t.aPagar)} />
        <Stat rotulo="Vencido" valor={formatos.reais(t.vencido)} cor={t.vencido > 0 ? 'saida' : undefined} />
        <Stat rotulo="Pago" valor={formatos.reais(t.pago)} />
      </div>

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
          <table className="tabela-empresas cad-lista fin-lista cp-lista">
            <thead><tr><th>ID</th><th>Vencimento</th><th>Fornecedor</th><th>Documento</th><th>Conta contábil</th><th className="fin-direita">Valor</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(({ conta: c, fornecedor, contaDoPlano, situacao }) => (
                <tr key={c.id} className={'linha-abre' + (situacao === 'vencida' ? ' cp-vencida' : '')} tabIndex={0} title="Abrir a conta"
                  onClick={() => vm.abrir({ id: c.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: c.id }); }}>
                  <td><span className="emp-cod">{c.numero}</span></td>
                  <td className="num">{dataBr(c.vencimento)}</td>
                  <td>
                    <span className="fin-corta" title={fornecedor}>{fornecedor}</span>
                    {c.recorrencia && <span className="fraco cp-parcela">{c.recorrencia.parcela}/{c.recorrencia.de}</span>}
                    {c.anexos.length > 0 && <span className="cp-clipe" title={c.anexos.length + (c.anexos.length === 1 ? ' anexo' : ' anexos')}><Icone nome="clipe" /></span>}
                  </td>
                  <td className="fraco">{c.documento || '—'}</td>
                  <td className="fraco">{contaDoPlano ? <span className="fin-corta" title={contaDoPlano.descricao}>{contaDoPlano.codigo} · {contaDoPlano.descricao}</span> : '—'}</td>
                  <td className="num fin-direita">{formatos.reais(c.valor)}</td>
                  <td>
                    <span className={'badge ' + TOM[situacao]}>{financeiro.rotuloDaSituacao(situacao)}</span>
                    {c.pagamento && <span className="fraco cp-pago-em">em {dataBr(c.pagamento.data).slice(0, 5)}</span>}
                  </td>
                  <td className="fin-direita">
                    {!c.pagamento && (
                      <button type="button" className="btn btn-outline" title="Pagar a conta (lança a saída no Caixa)"
                        onClick={e => { e.stopPropagation(); vm.abrir({ id: c.id, topico: 'pagamento' }); }} onKeyDown={e => e.stopPropagation()}>
                        <Icone nome="check" />Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
