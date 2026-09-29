// Minhas empresas: a barra de cima, no jeito da do GitHub (competência no lugar do "main ▾", quantas
// empresas, Insights; à direita a busca curta com atalho "/", Situação ▾ e "Iniciar ▾", que abre
// o painel para escolher a empresa, em partes/PainelIniciar) e a lista (clicar no título da coluna ordena; clicar na linha abre a empresa). Os números por situação ficam em Insights.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { PainelIniciar } from './partes/PainelIniciar';
import { LIMITE, useMinhasEmpresas, type Coluna } from './useMinhasEmpresas';


/** Título de coluna que ordena: clicar ordena por ela (crescente), clicar de novo inverte; a setinha cinza só aparece depois do clique. */
function Titulo({ vm, coluna, rotulo }: { vm: ReturnType<typeof useMinhasEmpresas>; coluna: Coluna; rotulo: string }) {
  const ativo = vm.ordem?.coluna === coluna;
  return (
    <th className="th-sort" onClick={() => vm.ordenar(coluna)} aria-sort={ativo ? (vm.ordem?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      title="Ordenar por esta coluna">
      {rotulo}{ativo && <Icone nome="caretDown" className={'th-seta' + (vm.ordem?.dir === 'asc' ? ' cima' : '')} />}
    </th>
  );
}

export function MinhasEmpresas() {
  const vm = useMinhasEmpresas();
  const campoBusca = useRef<HTMLInputElement>(null);

  // "/" leva para a busca (como o "T" do "Go to file" do GitHub)
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target;
      if (e.key !== '/' || (alvo instanceof Element && alvo.closest('input, textarea, select, [contenteditable]'))) return;
      e.preventDefault();
      campoBusca.current?.focus();
    };
    document.addEventListener('keydown', atalho);
    return () => document.removeEventListener('keydown', atalho);
  }, []);

  if (!vm.temRotina) return <EmDesenvolvimento nome={'A rotina do ' + (vm.departamento === 'fiscal' ? 'Fiscal' : 'Departamento Pessoal')} />;
  return (
    <section>
      <div className="tarefas-barra-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <button type="button" className="tarefas-contador" disabled={!vm.filtrando} onClick={vm.limparFiltros}
          title={vm.filtrando ? 'Limpar a busca e a situação' : undefined}>
          <Icone nome="briefcase" /><b>{vm.total}</b> {vm.total === 1 ? 'empresa' : 'empresas'}
        </button>
        <button type="button" className="tarefas-contador" onClick={vm.abrirInsights}>
          <Icone nome="barChart" />Insights
        </button>

        <span className="tarefas-barra-espaco" />

        <label className="busca-curta">
          <Icone nome="search" />
          <input ref={campoBusca} type="text" placeholder="Buscar empresa" aria-label="Buscar empresa (nome ou código)"
            value={vm.busca} onChange={e => vm.setBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { vm.setBusca(''); e.currentTarget.blur(); } }} />
          {!vm.busca && <kbd>/</kbd>}
        </label>
        <MenuSuspenso rotulo={vm.situacao ? vm.rotuloSituacao : 'Situação'} titulo="Situação" direita
          className={'btn btn-outline' + (vm.situacao ? ' ativo' : '')}
          itens={[{ rotulo: 'Todas', marcado: !vm.situacao, onClick: () => vm.setSituacao('') },
            ...vm.situacoes.map(s => ({ rotulo: s.rotulo, marcado: s.valor === vm.situacao, onClick: () => vm.setSituacao(s.valor) }))]} />
        <MenuSuspenso icone="play" rotulo="Iniciar" className="btn btn-primary" direita largura={400} dica="Escolher a empresa para iniciar"
          conteudo={fechar => <PainelIniciar vm={vm} fechar={fechar} />} />
      </div>

      {vm.carregando ? <p className="empty">Carregando…</p> : vm.total === 0 ? <p className="empty">Nenhuma empresa nesta situação.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <Titulo vm={vm} coluna="codigo" rotulo="Código" />
              <Titulo vm={vm} coluna="nome" rotulo="Empresa" />
              <th />
              <th />
            </tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.chave} className="linha-abre" tabIndex={0} title={l.acao + ': ' + l.nome}
                  onClick={() => vm.abrir(l.rota)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(l.rota); }}>
                  <td className="num">
                    {/* a situação em cor: laranja parada, amarelo em andamento, cinza não iniciada, verde concluída */}
                    <span className="codigo-sit">
                      <span className={'bolinha-sit ' + l.situacao} title={l.rotuloSituacao} role="img" aria-label={l.rotuloSituacao} />
                      {l.codigo ?? '—'}
                    </span>
                  </td>
                  <td>{l.nome}</td>
                  <td className="fraco">{l.etapaAtual}</td>
                  <td className="fraco num" title={l.quandoCompleto || undefined}>{l.quando}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vm.total > LIMITE && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {LIMITE} de {vm.total}. Use a busca ou a situação.</p>}
        </div>
      )}
    </section>
  );
}
