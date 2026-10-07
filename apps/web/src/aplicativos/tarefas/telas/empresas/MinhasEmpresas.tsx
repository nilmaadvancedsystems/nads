// Minhas empresas: a barra de cima, no jeito da do GitHub (competência no lugar do "main ▾", quantas
// empresas, Insights; à direita a busca curta com atalho "/", Situação ▾ e "Iniciar ▾", que abre
// o painel para escolher a empresa, em partes/PainelIniciar) e a lista (clicar no título da coluna ordena; clicar na linha abre a página da empresa). Os números por situação ficam em Insights.
import { Icone, MenuSuspenso, useCarregando, useEntradaAnimada, useLinhasQueSeMovem } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { PainelIniciar } from './partes/PainelIniciar';
import { LIMITE, useMinhasEmpresas, type Coluna } from './useMinhasEmpresas';
import { JanelaDaCompetencia } from './partes/JanelaDaCompetencia';
import { TransferenciasPendentes } from '../cadastro/responsaveis/TransferenciasPendentes';


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
        <MenuSuspenso icone="play" rotulo="Iniciar" className="btn btn-primary" classeAberto="botao-apagado" direita largura={400} dica="Escolher a empresa para iniciar"
          conteudo={fechar => <PainelIniciar vm={vm} fechar={fechar} />} />
      </div>

      {/* a tabela aparece na hora; as linhas entram quando o banco responde (a barra do topo termina) */}
      {!vm.carregando && vm.total === 0 ? <p className="empty">Nenhuma empresa nesta situação.</p> : (
        <div ref={tabela} className="table-wrap">
          <table ref={linhasQueSeMovem} className="tabela-empresas">
            <thead><tr>
              <Titulo vm={vm} coluna="codigo" rotulo="Código" />
              <Titulo vm={vm} coluna="nome" rotulo="Empresa" />
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
