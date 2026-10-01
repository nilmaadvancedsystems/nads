// A página de uma empresa na Tarefas (os insights dela). Em cima: voltar, a bolinha e o nome, a
// competência e o botão para abrir o executor; os números da competência; as etapas com quem fez,
// quando e por que parou; o histórico dos últimos meses (clicar abre aquele mês); e os arquivos que o
// Extrator tem da empresa.
import { Esqueleto, Icone, MenuSuspenso, useCarregando, useSemAnimacao } from '@nads/ui';
import { Navigate } from 'react-router';
import { BASE } from '../../casca/navegacao';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { useEmpresa } from './useEmpresa';

export function EmpresaTarefas({ rota }: { rota: string }) {
  // tela cheia de caixas (Vitor, 01/10/2026: "tudo que tiver muita box pode reduzir ou remover as animações"): sem animação
  useSemAnimacao();
  const vm = useEmpresa(rota);
  useCarregando(vm.pronta && (vm.carregando || vm.carregandoExtratos || vm.historico.some(h => h.carregando)));
  if (!vm.empresa) return <Navigate to={BASE} replace />;
  if (!vm.pronta) return <EmDesenvolvimento nome={'A rotina do ' + (vm.departamento === 'fiscal' ? 'Fiscal' : 'Departamento Pessoal')} />;

  return (
    <section className="empresa-tarefas">
      <button type="button" className="link-btn empresa-voltar" onClick={vm.voltar}>
        <Icone nome="arrowDown" style={{ transform: 'rotate(90deg)' }} />Minhas empresas
      </button>

      <div className="empresa-cabeca">
        <div className="empresa-quem">
          <span className={'bolinha-sit ' + vm.situacao} title={vm.rotuloSituacao} role="img" aria-label={vm.rotuloSituacao} />
          <div>
            <h2>{vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : ''}{vm.empresa.nome}</h2>
            <p className="hint">{vm.rotuloSituacao}{vm.empresa.regime ? ' · ' + vm.empresa.regime : ''}</p>
          </div>
        </div>
        <div className="empresa-acoes">
          <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" direita
            itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
          <button type="button" className={'btn ' + (vm.situacao === 'concluida' ? 'btn-outline' : 'btn-primary')} onClick={vm.abrirExecutor}>
            <Icone nome="play" />{vm.acao}
          </button>
        </div>
      </div>

      {vm.carregando ? <Esqueleto numeros={3} linhas={5} /> : (
        <>
          <div className="stat-grid empresa-numeros">
            <div className="stat"><p className="stat-label">Etapas</p><p className="stat-value">{vm.feitas}<span className="hint"> de {vm.total}</span></p></div>
            <div className="stat"><p className="stat-label">Etapa atual</p><p className="stat-texto">{vm.etapaAtual || '—'}</p></div>
            <div className="stat">
              <p className="stat-label">Último acesso</p>
              <p className="stat-texto" title={vm.ultimo?.quandoCompleto}>{vm.ultimo ? vm.ultimo.quando : '—'}</p>
              {vm.ultimo && <p className="hint">por {vm.ultimo.por}</p>}
            </div>
            <div className="stat"><p className="stat-label">Paradas</p><p className={'stat-value' + (vm.paradas ? ' cor-entrada' : '')}>{vm.paradas}</p></div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Etapas de {vm.rotuloCompetencia}</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Etapa</th><th>Situação</th><th>Quem</th><th /><th>Motivo</th></tr></thead>
                <tbody>
                  {vm.etapas.map(e => (
                    <tr key={e.id} className={e.atual ? 'linha-atual' : undefined}>
                      <td><span className="hint">{e.n}.</span> {e.nome}</td>
                      <td><span className={'bolinha-sit ' + e.cor} />{e.rotulo}</td>
                      <td className="fraco">{e.por}</td>
                      <td className="fraco" title={e.quandoCompleto || undefined}>{e.quando}</td>
                      <td className="fraco wrap">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head"><h3>Últimos meses</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Competência</th><th>Situação</th><th>Etapas</th><th /></tr></thead>
            <tbody>
              {vm.historico.map(h => (
                <tr key={h.competencia} className={'linha-abre' + (h.aberta ? ' linha-atual' : '')} tabIndex={0} title={'Abrir ' + h.rotulo}
                  onClick={() => vm.abrirCompetencia(h.competencia)} onKeyDown={e => { if (e.key === 'Enter') vm.abrirCompetencia(h.competencia); }}>
                  <td>{h.rotulo}</td>
                  <td>{h.carregando ? <span className="hint">…</span> : <><span className={'bolinha-sit ' + h.situacao} />{h.rotuloSituacao}</>}</td>
                  <td className="fraco">{h.carregando ? '' : h.feitas + ' de ' + vm.total}</td>
                  <td className="fraco num" title={h.quandoCompleto || undefined}>{h.quando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>No Extrator</h3></div>
        {vm.carregandoExtratos ? null : vm.extratos.length === 0 ? (
          <p className="empty">Nenhum arquivo importado no Extrator.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Origem</th><th>Arquivo</th><th>Período</th><th className="num">Lançamentos</th><th /></tr></thead>
              <tbody>
                {vm.extratos.slice(0, 8).map(a => (
                  <tr key={a.id}>
                    <td>{a.lado}</td>
                    <td>{a.nome}</td>
                    <td className="fraco">{a.periodo}</td>
                    <td className="num">{a.qtd}</td>
                    <td className="fraco num" title={a.quandoCompleto}>{a.quando}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
