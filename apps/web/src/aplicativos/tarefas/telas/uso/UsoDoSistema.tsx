// Cadastro › Uso do sistema (só o admin; Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no
// sistema, botões e funcionalidades para sabermos o que está 'inútil'"; refeita em 21/10/2026: "a tela com botões
// coloridos e refazer essa tela"): o período e a coleta no topo, os números, e em duas colunas a lista das telas
// (pintadas pelas visitas) e a tela escolhida, com os botões coloridos do frio ao quente, os sem clique tracejados, o
// mapa dos cliques e o "Ver na tela" (abre a tela de verdade com os botões pintados). Embaixo, o "possivelmente inútil"
// e quem mais usa. Só as peças do catálogo (Segmentado, Interruptor, Dica, Stat, Cartão, Pílula de calor, Mapa de
// calor, Vazio).
import { BotaoIcone, Dica, Esqueleto, Icone, Interruptor, MapaDeCalor, Segmentado, Stat, Vazio, useCarregando } from '@nads/ui';
import { useUsoDoSistema } from './useUsoDoSistema';

export function UsoDoSistema() {
  const vm = useUsoDoSistema();
  useCarregando(vm.carregando);
  if (!vm.admin) return <Vazio icone="lock" titulo="Só o admin" texto="O uso do sistema só o administrador vê." />;
  const t = vm.tela;
  return (
    <section className="uso">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
        <BotaoIcone icone="girar" titulo="Ler de novo" onClick={vm.recarregar} />
        <span className="tarefas-barra-espaco" />
        <span className="uso-coleta">
          <span>Coletar o uso</span>
          <Dica texto={'Cada pessoa grava no máximo uma vez a cada 5 minutos (e ao sair da página), num documento por dia: cerca de '
            + vm.estimativa.toLocaleString('pt-BR') + ' gravações por dia para 10 pessoas. Só a tela, o rótulo do botão e o ponto do clique: nada do que se digita, nem dado de cliente, nem do cofre.'} />
          <Interruptor ligado={vm.coletando} onMudar={() => void vm.alternarColeta()} rotulo="Coletar o uso do sistema" />
        </span>
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: 90 dias inventados, mais o que você clicar nesta sessão.</p>}
      {vm.erro && <p className="feedback-erro">{vm.erro}</p>}

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : !vm.numeros.dias ? (
        <Vazio icone="barChart" titulo="Nada coletado no período" texto={vm.coletando ? 'Assim que a equipe usar, aparece aqui (grava a cada 5 minutos).' : 'Ligue a coleta para começar a juntar o uso.'} />
      ) : (
        <>
          <div className="stat-grid">
            <Stat rotulo="Visitas" valor={vm.numeros.visitas.toLocaleString('pt-BR')} />
            <Stat rotulo="Cliques" valor={vm.numeros.cliques.toLocaleString('pt-BR')} />
            <Stat rotulo="Telas nunca abertas" valor={String(vm.numeros.nuncaVisitadas)} />
            <Stat rotulo="Botões sem clique" valor={String(vm.numeros.semClique)} />
          </div>

          <div className="uso-mestre">
            <div className="card uso-telas">
              <h3>
                <span>Telas</span>
                <Segmentado valor={vm.filtro} onMudar={vm.setFiltro}
                  opcoes={vm.filtros.map(f => ({ ...f, rotulo: f.rotulo + ' ' + (f.valor === 'todas' ? vm.contagem.todas : f.valor === 'usadas' ? vm.contagem.usadas : vm.contagem.semUso) }))} />
              </h3>
              <div className="uso-telas-lista">
                {vm.lista.map(x => (
                  <button key={x.tela} type="button" className={'uso-tela-item' + (t?.tela === x.tela ? ' ativo' : '') + (x.visitas ? '' : ' sem-uso')}
                    onClick={() => vm.escolher(x.tela)} aria-pressed={t?.tela === x.tela}>
                    <span className={'uso-calor-ponto calor-' + x.nivel} aria-hidden="true" />
                    <span className="uso-tela-nome">{x.rotulo}</span>
                    <span className="uso-tela-val num">{x.visitas ? x.visitas : 'nunca'}</span>
                    <span className="uso-tela-barra" aria-hidden="true"><span className={'calor-' + x.nivel} style={{ width: x.pct + '%' }} /></span>
                  </button>
                ))}
                {!vm.lista.length && <p className="fraco">Nenhuma tela neste filtro.</p>}
              </div>
            </div>

            {t && (
              <div className="card uso-detalhe">
                <div className="uso-detalhe-topo">
                  <div>
                    <h3>{t.rotulo}</h3>
                    <p className="fraco">
                      {t.visitas ? t.visitas + (t.visitas === 1 ? ' visita' : ' visitas') + ' · ' + t.cliques + (t.cliques === 1 ? ' clique' : ' cliques') : 'Ninguém abriu esta tela no período.'}
                      {t.departamentos.length > 0 && ' · ' + t.departamentos.map(d => d.rotulo + ' ' + d.total).join(' · ')}
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => vm.verNaTela(t.tela)}>
                    <Icone nome="alvo" width={16} height={16} />Ver na tela
                  </button>
                </div>

                <p className="uso-secao">Botões <span className="fraco">do frio ao quente, pelo número de cliques</span></p>
                {t.botoes.length || t.semClique.length ? (
                  <div className="uso-botoes">
                    {t.botoes.map(b => (
                      <span key={b.controle} className={'uso-pilula calor-' + b.nivel}>{b.controle}<b className="num">{b.cliques}</b></span>
                    ))}
                    {t.semClique.map(c => <span key={c} className="uso-pilula calor-0">{c}<b className="num">0</b></span>)}
                  </div>
                ) : <p className="fraco">Nenhum botão registrado nesta tela no período.</p>}
                <div className="uso-legenda" aria-label="Legenda">
                  <span className="fraco">frio</span>
                  {[1, 2, 3, 4, 5].map(n => <span key={n} className={'uso-calor-ponto calor-' + n} />)}
                  <span className="fraco">quente</span>
                  <span className="uso-calor-ponto calor-0" /><span className="fraco">apareceu e ninguém clicou</span>
                </div>

                {t.cliques > 0 && (
                  <>
                    <p className="uso-secao">Onde clicam <span className="fraco">a tela inteira, com o topo e a lateral</span></p>
                    <MapaDeCalor grade={t.grade} maior={t.maiorCelula} rotulo={'Os cliques em ' + t.rotulo} />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="uso-colunas">
            {/* o destaque (Gustavo: "para sabermos o que está inútil"): as telas nunca abertas e os botões sem clique */}
            <div className="card">
              <h3><Icone nome="alert" width={16} height={16} />Possivelmente inútil no período</h3>
              <p className="uso-secao">Telas nunca abertas <span className="gh-counter">{vm.nuncaVisitadas.length}</span></p>
              {vm.nuncaVisitadas.length ? (
                <div className="uso-botoes">{vm.nuncaVisitadas.map(n => (
                  <button key={n.tela} type="button" className="uso-pilula calor-0" onClick={() => vm.escolher(n.tela)}>{n.rotulo}</button>
                ))}</div>
              ) : <p className="fraco">Toda tela da navegação foi aberta no período.</p>}
              <p className="uso-secao">Botões sem clique, por tela <span className="gh-counter">{vm.numeros.semClique}</span></p>
              {vm.semCliquePorTela.length ? (
                <div className="uso-inutil-telas">{vm.semCliquePorTela.slice(0, 30).map(s => (
                  <button key={s.tela} type="button" className="uso-inutil-tela" onClick={() => vm.escolher(s.tela)} title={s.controles.join(' · ')}>
                    <span className="uso-tela-nome">{s.rotulo}</span><span className="gh-counter">{s.controles.length}</span>
                  </button>
                ))}</div>
              ) : <p className="fraco">Todo botão visto teve clique.</p>}
            </div>
            {vm.pessoas.length > 0 && (
              <div className="card">
                <h3>Quem mais usa</h3>
                <div className="rank uso-rank">
                  {vm.pessoas.map(p => (
                    <div key={p.nome} className="rank-item">
                      <span className="rank-nome">{p.nome}</span><span className="rank-val num">{p.total}</span>
                      <span className="rank-barra"><span style={{ width: p.pct + '%', background: 'var(--accent)' }} /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
