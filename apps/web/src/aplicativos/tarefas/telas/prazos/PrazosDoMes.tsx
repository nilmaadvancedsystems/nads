// Prazos › Prazos do mês (plano do Acessórias, ficha E04): a lista das obrigações com prazo da competência, no desenho do
// Controle Forestry e do painel do DP (os filtros em cima; o resumo, a busca e o Excel embaixo; a tabela do Relatório do
// Fiscal). Clicar na linha abre a empresa no Executor. Só desenha: os dados vêm do usePrazosDoMes.
import { tarefas as t } from '@nads/core';
import { baixarBytes, Esqueleto, Icone, LogoExcel, useCarregando } from '@nads/ui';
import { useNavigate } from 'react-router';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { diaCurto, usePrazosDoMes } from './usePrazosDoMes';
import './prazosDoMes.css';

export function PrazosDoMes() {
  const vm = usePrazosDoMes();
  const f = vm.filtros;
  const navegar = useNavigate();
  useCarregando(vm.carregando);
  const resumo = (['atrasada', 'prazo-interno', 'a-fazer', 'entregue-com-atraso', 'entregue-no-prazo', 'entregue-antes', 'dispensada'] as const)
    .map(s => ({ valor: s, rotulo: t.ROTULO_DA_SITUACAO_DO_PRAZO[s].toLowerCase(), n: vm.contagem[s] }));
  return (
    <section className="dp-painel pz">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuDeFiltro rotulo="Competência" valor={vm.competencia} mudar={v => { if (v) vm.setCompetencia(v); }} opcoes={vm.competencias} todos={vm.competencias[0].rotulo} />
        <MenuDeFiltro rotulo="Responsável" valor={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />
        <MenuDeFiltro rotulo="Obrigação" valor={f.obrigacao} mudar={f.setObrigacao} opcoes={f.obrigacoes} todos="Todas" />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>
      <p className="hint">Por enquanto, só o Fiscal: o Contábil ainda não tem prazos cadastrados e o DP segue no DP › Início.</p>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo.</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <>
          <div className="tarefas-barra-topo dp-filtros-linha">
            <span className="pz-resumo">
              <button type="button" className={'pz-resumo-item' + (f.situacao === 'acao' ? ' ativo' : '')} aria-pressed={f.situacao === 'acao'}
                onClick={() => f.setSituacao(f.situacao === 'acao' ? '' : 'acao')} title="As atrasadas e as que já estão no prazo interno">
                <b>{vm.contagem.atrasada + vm.contagem['prazo-interno']}</b> pedem ação
              </button>
              {resumo.map(s => (
                <button key={s.valor} type="button" className={'pz-resumo-item pz-' + s.valor + (f.situacao === s.valor ? ' ativo' : '')} disabled={!s.n && f.situacao !== s.valor}
                  onClick={() => f.setSituacao(f.situacao === s.valor ? '' : s.valor)} aria-pressed={f.situacao === s.valor}>
                  <b>{s.n}</b> {s.rotulo}
                </button>
              ))}
            </span>
            <span className="tarefas-barra-espaco" />
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar empresa (nome ou código)"
                onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
            </label>
            <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel" disabled={!vm.linhas.length}
              onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <LogoExcel />
            </button>
          </div>
          <section className="card fr-cartao" aria-label="Prazos do mês">
            {!vm.total ? <p className="hint dp-vazio">Nenhuma obrigação com prazo nesta competência.</p>
              : !vm.linhas.length ? <p className="hint dp-vazio">Nenhuma obrigação com esses filtros.</p> : (
                <div className="fr-rola">
                  <table className="fr-tabela pz-tabela">
                    <colgroup>
                      <col className="pz-c-cod" /><col className="pz-c-nome" /><col className="pz-c-obr" /><col className="pz-c-prazo" />
                      <col className="pz-c-sit" /><col className="pz-c-resp" /><col className="pz-c-feita" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="fr-num">Nº</th><th>Empresa</th><th>Obrigação</th><th title="O prazo legal (e o interno, quando o escritório começa a cobrar)">Prazo</th>
                        <th>Situação</th><th>Responsável</th><th>Entregue por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.linhas.map(l => (
                        <tr key={l.chave} className="pz-linha" onClick={() => navegar(l.caminho)} title={'Abrir ' + l.empresa + ' no Executor'}>
                          <td className="fr-num fr-cod">{l.codigo}</td>
                          <td className="fr-cliente"><span title={l.empresa}>{l.empresa}</span></td>
                          <td className="pz-texto" title={l.nomeDaEtapa}>{l.nomeDaEtapa}</td>
                          <td className="pz-prazo">
                            {diaCurto(l.legal || '')}
                            {l.interno && <span className="hint"> · interno {diaCurto(l.interno)}</span>}
                            {l.aConfirmar && <span className="pz-confirmar" title="O setor ainda vai confirmar este prazo: o atraso pode não ser de verdade">a confirmar</span>}
                          </td>
                          <td><span className={'pz-sit pz-sit-' + l.situacao}>{l.rotulo}</span></td>
                          <td className="pz-texto">{l.responsavel || <span className="hint">—</span>}</td>
                          <td className="pz-texto">{l.feitaPor ? l.feitaPor + ' · ' + diaCurto(l.feitaEm) : <span className="hint">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        </>
      )}
    </section>
  );
}
