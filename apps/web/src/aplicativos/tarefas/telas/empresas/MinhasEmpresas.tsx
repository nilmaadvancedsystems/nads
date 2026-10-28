// Minhas empresas, uma tela só (27/10/2026), sem a barra lateral: a barra de cima, no jeito da do GitHub (competência no
// lugar do "main ▾"; à direita a busca curta com atalho "/" e Situação ▾), as empresas por situação, a lista (clicar no
// título da coluna ordena; clicar na linha abre a página da empresa), as etapas paradas e, no Contábil, os históricos do
// Creditor. O "Iniciar", o Progresso do mês e os Insights saíram (27/10/2026).
import { Icone, MenuSuspenso, type NomeIcone, Segmentado, useCarregando, useEntradaAnimada, useLinhasQueSeMovem, Vazio } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { LIMITE, useMinhasEmpresas, type Coluna } from './useMinhasEmpresas';
import { JanelaDaCompetencia } from './partes/JanelaDaCompetencia';
import { TransferenciasPendentes } from '../cadastro/responsaveis/TransferenciasPendentes';


/** A cor e o ícone de cada situação no número (os tons do painel do DP). */
const TOM_DA_SITUACAO: Record<string, { tom: string; icone: NomeIcone }> = {
  parada: { tom: 'laranja', icone: 'alert' },
  'em-andamento': { tom: 'aviso', icone: 'clock' },
  'nao-iniciada': { tom: 'neutro', icone: 'list' },
  concluida: { tom: 'ok', icone: 'check' },
};

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
  useCarregando(vm.carregando);
  // as linhas chegam em cascata quando o banco responde
  // tela com muitas caixas (Vitor, 01/10/2026: "tudo que tiver muita box pode reduzir"): a lista inteira só acende rápido
  const tabela = useEntradaAnimada<HTMLDivElement>(null, [vm.carregando], 'repetida');
  // ordenou, filtrou, chegou ou saiu uma: as linhas deslizam até o lugar novo (a busca é teclado: vai sem animar)
  const linhasQueSeMovem = useLinhasQueSeMovem<HTMLTableElement>(vm.carregando ? '' : vm.linhas.map(l => l.chave).join('|'), vm.busca);

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
      {/* as transferências de empresa em que a pessoa é o emitente ou o destinatário (Vitor, 07/10/2026) */}
      <TransferenciasPendentes />
      <div className="tarefas-barra-topo">
        {vm.perguntarCompetencia && <JanelaDaCompetencia competencias={vm.competencias} competencia={vm.competencia} onSeguir={vm.setCompetencia} />}
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        {/* o número de empresas e os Insights saíram daqui por enquanto (Vitor, 05/10/2026) */}
        {/* só as da pessoa; o admin e o diretor podem ver todas (26/10/2026) */}
        {vm.podeVerTodas && <Segmentado valor={vm.escopo} onMudar={vm.setEscopo} opcoes={[{ valor: 'minhas', rotulo: 'Minhas' }, { valor: 'todas', rotulo: 'Todas' }]} />}

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
      </div>

      {/* as empresas por situação; clicar numa situação filtra a lista (o Progresso do mês saiu; 27/10/2026) */}
      {/* coloridos como os do Departamento Pessoal (Vitor, 28/10/2026: "dá um feedback visual melhor de paradas, em andamento") */}
      <div className="stat-grid dp-numeros empresa-numeros">
        {vm.situacoes.map(s => (
          <button key={s.valor} type="button" className={'stat stat-filtro painel-numero painel-' + TOM_DA_SITUACAO[s.valor].tom + (vm.situacao === s.valor ? ' ativo' : '')} aria-pressed={vm.situacao === s.valor}
            title={vm.situacao === s.valor ? 'Mostrar todas' : 'Mostrar só as ' + s.rotulo.toLowerCase()} onClick={() => vm.setSituacao(vm.situacao === s.valor ? '' : s.valor)}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={TOM_DA_SITUACAO[s.valor].icone} /></span>
            <p className="stat-label">{s.rotulo}</p>
            <p className="stat-value">{vm.carregando ? '—' : vm.resumo.porSituacao[s.valor]}</p>
          </button>
        ))}
      </div>

      {/* a tabela aparece na hora; as linhas entram quando o banco responde (a barra do topo termina) */}
      {!vm.carregando && vm.total === 0 ? <Vazio icone="briefcase" titulo={vm.filtrandoPorResponsavel && !vm.busca && !vm.situacao ? 'Nenhuma empresa no seu nome' : 'Nenhuma empresa nesta situação'}
        texto={vm.filtrandoPorResponsavel && !vm.busca && !vm.situacao ? 'Aqui aparecem as empresas em que você é o responsável no seu setor e as que ainda não têm responsável (Cadastro › Empresas por responsável).' : undefined}>
        {/* a saída do vazio (revisão da UI, 18/10/2026) */}
        {(vm.busca || vm.situacao) && <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar a busca e a situação</button>}
      </Vazio> : (
        <div ref={tabela} className="table-wrap">
          <table ref={linhasQueSeMovem} className="tabela-empresas">
            <thead><tr>
              <Titulo vm={vm} coluna="codigo" rotulo="Código" />
              <Titulo vm={vm} coluna="nome" rotulo="Empresa" />
              <th>Progresso</th>
              <th />
              <th />
            </tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(l => (
                <tr key={l.chave} data-linha={l.chave} className="linha-abre" tabIndex={0} title={'Ver ' + l.nome}
                  onClick={() => vm.abrirEmpresa(l.rota)} onKeyDown={e => { if (e.key === 'Enter') vm.abrirEmpresa(l.rota); }}>
                  <td className="num">
                    {/* a situação em cor: laranja parada, amarelo em andamento, cinza não iniciada, verde concluída */}
                    <span className="codigo-sit">
                      <span className={'bolinha-sit ' + l.situacao} title={l.rotuloSituacao} role="img" aria-label={l.rotuloSituacao} />
                      <span className="codigo-num">{l.codigo ?? '—'}</span>
                    </span>
                  </td>
                  <td>{l.nome}</td>
                  <td className="num" title={l.concluidas + ' de ' + l.total + ' etapas'}>
                    <span className="progresso-linha">
                      <span className="tarefas-barra"><span className={l.situacao === 'parada' ? 'parada' : undefined} style={{ width: l.porcentagem + '%' }} /></span>
                      <span className="fraco">{l.concluidas}/{l.total}</span>
                    </span>
                  </td>
                  <td className="fraco">{l.etapaAtual}</td>
                  <td className="fraco num" title={l.quandoCompleto || undefined}>{l.quando}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vm.total > LIMITE && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {LIMITE} de {vm.total}. Use a busca ou a situação.</p>}
        </div>
      )}
      {/* as etapas paradas e os históricos do Creditor foram para Justificativas e Configurações, no menu de cima (28/10/2026) */}
    </section>
  );
}
