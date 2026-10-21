// Cadastro › Uso do sistema (só o admin; Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no
// sistema, botões e funcionalidades para sabermos o que está 'inútil'"): o período, os números, as telas mais e menos
// visitadas, as nunca visitadas, por tela os controles (com e sem clique), quem usa e o mapa quente, e o "possivelmente
// inútil". Só as peças do catálogo (Segmentado, Interruptor, Stat, Cartão, Ranking, Tabela, MenuSuspenso, Vazio e o
// Mapa de calor, que entrou no catálogo).
import { BotaoIcone, Esqueleto, Icone, Interruptor, MapaDeCalor, MenuSuspenso, Segmentado, Stat, Vazio, useCarregando } from '@nads/ui';
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
          <Interruptor ligado={vm.coletando} onMudar={() => void vm.alternarColeta()} rotulo="Coletar o uso do sistema" />
        </span>
      </div>
      <p className="hint">
        {vm.coletando ? 'A coleta está ligada' : 'A coleta está desligada'}: cada pessoa grava no máximo uma vez a cada 5 minutos (e ao sair da página), num documento por dia
        (cerca de {vm.estimativa.toLocaleString('pt-BR')} gravações por dia para 10 pessoas). Só a tela, o rótulo do botão e o ponto do clique: nada do que se digita, nem dado de cliente, nem do cofre.
      </p>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: 90 dias inventados, mais o que você clicar nesta sessão.</p>}
      {vm.erro && <p className="feedback-erro">{vm.erro}</p>}

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : !vm.numeros.dias ? (
        <Vazio icone="barChart" titulo="Nada coletado no período" texto={vm.coletando ? 'Assim que a equipe usar, aparece aqui (grava a cada 5 minutos).' : 'Ligue a coleta para começar a juntar o uso.'} />
      ) : (
        <>
          <div className="stat-grid">
            <Stat rotulo="Visitas" valor={vm.numeros.visitas.toLocaleString('pt-BR')} />
            <Stat rotulo="Cliques" valor={vm.numeros.cliques.toLocaleString('pt-BR')} />
            <Stat rotulo="Telas usadas" valor={String(vm.numeros.telasUsadas)} />
            <Stat rotulo="Telas nunca visitadas" valor={String(vm.numeros.nuncaVisitadas)} />
          </div>

          <div className="uso-colunas">
            <div className="card">
              <h3>Telas mais visitadas</h3>
              <div className="rank uso-rank">
                {vm.maisVisitadas.map(x => (
                  <button key={x.tela} type="button" className="rank-item" onClick={() => vm.escolher(x.tela)} title={'Ver ' + x.rotulo}>
                    <span className="rank-nome">{x.rotulo}</span><span className="rank-val num">{x.visitas}</span>
                    <span className="rank-barra"><span style={{ width: x.pct + '%', background: 'var(--accent)' }} /></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>Telas menos visitadas</h3>
              <div className="rank uso-rank">
                {vm.menosVisitadas.map(x => (
                  <button key={x.tela} type="button" className="rank-item" onClick={() => vm.escolher(x.tela)} title={'Ver ' + x.rotulo}>
                    <span className="rank-nome">{x.rotulo}</span><span className="rank-val num">{x.visitas}</span>
                    <span className="rank-barra"><span style={{ width: x.pct + '%', background: 'var(--warn)' }} /></span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* o destaque (Gustavo: "para sabermos o que está inútil"): as telas sem visita e os botões sem clique no período */}
          <div className="card uso-inutil">
            <h3><Icone nome="alert" width={16} height={16} />Possivelmente inútil no período</h3>
            <div className="uso-inutil-corpo">
              <p className="uso-inutil-titulo">Telas nunca visitadas <span className="gh-counter">{vm.nuncaVisitadas.length}</span></p>
              {vm.nuncaVisitadas.length ? (
                <div className="chip-row">{vm.nuncaVisitadas.map(n => <span key={n.tela} className="chip-f">{n.rotulo}</span>)}</div>
              ) : <p className="fraco">Toda tela da navegação foi aberta no período.</p>}
              <p className="uso-inutil-titulo">Controles que apareceram e ninguém clicou <span className="gh-counter">{vm.possivelmenteInutil.controles.length}</span></p>
              {vm.possivelmenteInutil.controles.length ? (
                <div className="table-wrap uso-tabela-baixa">
                  <table className="table-compact">
                    <thead><tr><th>Tela</th><th>Controle</th></tr></thead>
                    <tbody>{vm.possivelmenteInutil.controles.slice(0, 200).map(c => <tr key={c.tela + '|' + c.controle}><td>{c.rotulo}</td><td>{c.controle}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <p className="fraco">Todo controle visto teve clique.</p>}
            </div>
          </div>

          {t && (
            <div className="card uso-tela">
              <h3>
                <span>Por tela</span>
                <MenuSuspenso rotulo={t.rotulo} className="btn btn-outline" titulo="Escolher a tela" largura={340}
                  itens={vm.telas.map(x => ({ rotulo: x.rotulo, marcado: x.valor === t.tela, onClick: () => vm.escolher(x.valor) }))} />
              </h3>
              <div className="uso-tela-corpo">
                <div className="uso-tela-mapa">
                  <MapaDeCalor grade={t.grade} maior={t.maiorCelula} rotulo={'Os cliques em ' + t.rotulo} />
                  <p className="hint">{t.visitas} {t.visitas === 1 ? 'visita' : 'visitas'} · {t.cliques} {t.cliques === 1 ? 'clique' : 'cliques'}. A área é a tela inteira (o topo e a lateral desenhados); quanto mais vermelho, mais cliques.</p>
                  {t.departamentos.length > 0 && (
                    <p className="uso-quem"><b>Quem usa:</b> {t.departamentos.map(d => d.rotulo + ' (' + d.total + ')').join(' · ')}</p>
                  )}
                </div>
                <div className="uso-tela-lista">
                  {t.controles.length ? (
                    <div className="table-wrap">
                      <table className="table-compact">
                        <thead><tr><th>Controle</th><th className="num">Cliques</th><th className="num">%</th></tr></thead>
                        <tbody>{t.controles.map(c => <tr key={c.controle}><td>{c.controle}</td><td className="num">{c.cliques}</td><td className="num">{c.pct}%</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="fraco">Nenhum clique nesta tela no período.</p>}
                  {t.semClique.length > 0 && (
                    <>
                      <p className="uso-inutil-titulo">Sem clique <span className="gh-counter">{t.semClique.length}</span></p>
                      <div className="chip-row">{t.semClique.map(c => <span key={c} className="chip-f">{c}</span>)}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {vm.pessoas.length > 0 && (
            <div className="card">
              <h3>Quem mais usa (visitas e cliques)</h3>
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
        </>
      )}
    </section>
  );
}
