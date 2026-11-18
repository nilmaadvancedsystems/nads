// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "Todos os seis", "faz algo bonito assim como no acessorias", "pode dividir em menu lateral", "quer que quando
// eu clique abra uma visao do que a pessoa ta fazendo", "remove o modo tv"). O visual é do NADS (regra 2: sem copiar
// telas): os destaques do mês, a equipe em cartões com o anel do quanto concluiu (o clique abre a visão da pessoa), e
// os painéis em barras, funil e estrelas. Cada assunto tem a página dele no menu lateral.
import { Alerta, BotaoFechar, Esqueleto, Icone, useCarregando, useJanela, type NomeIcone } from '@nads/ui';
import { useRef, type ReactNode } from 'react';
import { useInsights, type Segmento, type Tom } from './useInsights';
import './insights.css';

type Vm = ReturnType<typeof useInsights>;
type Tela = NonNullable<Vm['tela']>;

/** o anel de progresso (0 a 100), com o conteúdo no meio */
function Anel({ pct, tom, tamanho = 64, espessura = 6, children }: { pct: number; tom: Tom; tamanho?: number; espessura?: number; children?: ReactNode }) {
  const r = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * r;
  const meio = tamanho / 2;
  return (
    <span className={'ins-anel t-' + tom} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox={'0 0 ' + tamanho + ' ' + tamanho} width={tamanho} height={tamanho} aria-hidden="true">
        <circle className="ins-anel-fundo" cx={meio} cy={meio} r={r} strokeWidth={espessura} />
        <circle className="ins-anel-cheio" cx={meio} cy={meio} r={r} strokeWidth={espessura}
          strokeDasharray={volta} strokeDashoffset={volta * (1 - Math.min(100, Math.max(0, pct)) / 100)} transform={'rotate(-90 ' + meio + ' ' + meio + ')'} />
      </svg>
      <span className="ins-anel-meio">{children}</span>
    </span>
  );
}

/** a barra dividida (o DP, as entregas), com a legenda embaixo */
function Barra({ segmentos }: { segmentos: readonly Segmento[] }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1;
  return (
    <div className="ins-barra-bloco">
      <div className="ins-barra" role="img" aria-label={segmentos.map(s => s.rotulo + ': ' + s.valor).join(', ')}>
        {segmentos.filter(s => s.valor > 0).map(s => <span key={s.rotulo} className={'t-' + s.tom} style={{ flexGrow: s.valor / total }} />)}
      </div>
      <ul className="ins-legenda">
        {segmentos.map(s => <li key={s.rotulo} className={'t-' + s.tom}><i aria-hidden="true" /><b>{s.valor.toLocaleString('pt-BR')}</b><span>{s.rotulo}</span></li>)}
      </ul>
    </div>
  );
}

function Estrelas({ valor }: { valor: number }) {
  return (
    <span className="ins-estrelas" aria-label={valor.toLocaleString('pt-BR') + ' de 5'}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={valor >= i ? 'cheia' : valor >= i - 0.5 ? 'meia' : ''}>★</span>)}
    </span>
  );
}

function Cartao({ titulo, subtitulo, icone, children, classe = '' }: { titulo: string; subtitulo?: string; icone: NomeIcone; children: ReactNode; classe?: string }) {
  return (
    <section className={'card ins-cartao ' + classe} aria-label={titulo}>
      <header className="ins-cabeca"><span className="ins-icone"><Icone nome={icone} width={18} height={18} /></span><div><h3>{titulo}</h3>{subtitulo && <span className="hint">{subtitulo}</span>}</div></header>
      {children}
    </section>
  );
}

function Equipe({ tela, vm }: { tela: Tela; vm: Vm }) {
  return (
    <Cartao titulo="A equipe no mês" subtitulo="As rotinas do Fiscal e do Contábil, por responsável · clique na pessoa para ver o que ela está fazendo" icone="equipe">
      {tela.equipe.length ? (
        <div className="ins-equipe">
          {tela.equipe.map(p => (
            <button key={p.setor + p.nome} type="button" className="ins-pessoa" onClick={() => vm.abrirPessoa(p.setor, p.nome)} aria-label={'Ver o que ' + p.nome + ' está fazendo'}>
              <Anel pct={p.pct} tom={p.tom} tamanho={84} espessura={7}><span className="ins-iniciais">{p.iniciais}</span></Anel>
              <b className="ins-pessoa-nome">{p.nome}</b>
              <span className="hint">{p.setor}</span>
              <span className={'ins-pilula t-' + p.tom}>{p.pct}% · {p.texto}</span>
              {p.atrasadas > 0 && <span className="ins-pilula t-ruim">{p.atrasadas} {p.atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</span>}
            </button>
          ))}
        </div>
      ) : <p className="hint">Ninguém com rotina no mês.</p>}
    </Cartao>
  );
}

/** a visão da pessoa: o anel grande, as empresas que faltam com a etapa, as concluídas e as tarefas atrasadas */
function JanelaDaPessoa({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharPessoa);
  const p = vm.pessoa;
  if (!p) return null;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fecharPessoa(); }}>
      <div ref={janela} className="modal ins-janela" role="dialog" aria-modal="true" aria-label={'O que ' + p.nome + ' está fazendo'}>
        <header className="ins-janela-topo">
          <Anel pct={p.pct} tom={p.tom} tamanho={96} espessura={8}><b className="ins-janela-pct">{p.pct}%</b></Anel>
          <div className="ins-janela-quem">
            <h3>{p.nome}</h3>
            <span className="hint">{p.setor} · {p.texto} empresas concluídas</span>
            <div className="ins-janela-pilulas">
              <span className="ins-pilula t-alerta">{p.faltando.length} {p.faltando.length === 1 ? 'faltando' : 'faltando'}</span>
              <span className="ins-pilula t-bom">{p.feitas} {p.feitas === 1 ? 'concluída' : 'concluídas'}</span>
              {p.atrasadas > 0 && <span className="ins-pilula t-ruim">{p.atrasadas} {p.atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</span>}
            </div>
          </div>
          <BotaoFechar onClick={vm.fecharPessoa} />
        </header>
        <div className="ins-janela-corpo">
          {p.tarefas.length > 0 && (
            <section>
              <h4><Icone nome="clock" width={16} height={16} />Tarefas atrasadas</h4>
              <ul className="ins-lista">
                {p.tarefas.map(t => <li key={t.titulo + t.atraso}><span>{t.titulo}</span><span className="ins-pilula t-ruim">{t.atraso}</span></li>)}
              </ul>
            </section>
          )}
          <section>
            <h4><Icone nome="briefcase" width={16} height={16} />Empresas faltando</h4>
            {p.faltando.length ? (
              <ul className="ins-lista">
                {p.faltando.map(e => (
                  <li key={e.nome} className="ins-empresa">
                    <div className="ins-empresa-nome"><b>{e.nome}</b><span className="hint">{e.etapa ? 'Agora: ' + e.etapa : 'Ainda não começou'}</span></div>
                    <div className="ins-empresa-direita">
                      <span className={'ins-pilula t-' + e.tom}>{e.situacao}</span>
                      <span className={'ins-trilho t-' + e.tom} title={e.texto}><span style={{ width: e.progresso + '%' }} /></span>
                      <span className="hint">{e.texto}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="ins-tudo-certo"><Icone nome="checkCircle" width={18} height={18} />Todas as empresas do mês concluídas.</p>}
          </section>
          {p.concluidas.length > 0 && (
            <section>
              <h4><Icone nome="checkCircle" width={16} height={16} />Concluídas</h4>
              <ul className="ins-concluidas">{p.concluidas.map(e => <li key={e.nome}>{e.nome}</li>)}</ul>
            </section>
          )}
          {p.foraDaLista > 0 && <p className="hint">Mais {p.foraDaLista} empresas não cabem nesta lista.</p>}
        </div>
      </div>
    </div>
  );
}

function Dp({ tela }: { tela: Tela }) {
  return <Cartao titulo="Departamento Pessoal" subtitulo={'A tabela do DP · ' + tela.dp.competencia} icone="usuario"><Barra segmentos={tela.dp.segmentos} /></Cartao>;
}

function Guias({ tela }: { tela: Tela }) {
  return (
    <Cartao titulo="Guias" subtitulo={'Competência ' + tela.guias.competencia} icone="fileText">
      <div className="ins-funil">
        {tela.guias.funil.map(f => (
          <div key={f.rotulo} className={'ins-funil-linha t-' + f.tom}>
            <div className="ins-funil-topo"><span>{f.rotulo}</span><b>{f.valor.toLocaleString('pt-BR')}{f.rotulo !== 'Enviadas' && <small> · {f.pct}%</small>}</b></div>
            <div className="ins-trilho"><span style={{ width: f.pct + '%' }} /></div>
          </div>
        ))}
      </div>
    </Cartao>
  );
}

function Clientes({ tela }: { tela: Tela }) {
  const c = tela.clientes;
  return (
    <Cartao titulo="Clientes" subtitulo="Área do Cliente e Mandei" icone="mensagem">
      <div className="ins-nota">
        <b>{c.avaliacoes ? c.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—'}</b>
        <div><Estrelas valor={c.estrelas} /><span className="hint">{c.avaliacoes ? c.avaliacoes + (c.avaliacoes === 1 ? ' avaliação' : ' avaliações') + ' no mês' : 'Sem avaliação no mês'}</span></div>
      </div>
      <ul className="ins-itens">
        {c.itens.map(i => <li key={i.rotulo} className={'t-' + i.tom}><span>{i.rotulo}</span><b>{i.valor.toLocaleString('pt-BR')}</b></li>)}
      </ul>
    </Cartao>
  );
}

function Entregas({ tela }: { tela: Tela }) {
  return <Cartao titulo="Entregas físicas" subtitulo="O office boy e o link do cliente" icone="caminhao"><Barra segmentos={tela.entregas.segmentos} /></Cartao>;
}

function Tarefas({ tela }: { tela: Tela }) {
  return (
    <Cartao titulo="Tarefas atrasadas" subtitulo="As tarefas delegadas, por responsável" icone="clock">
      {tela.tarefas.length ? (
        <ul className="ins-atrasos">
          {tela.tarefas.map(p => (
            <li key={p.nome}>
              <span className="ins-mini">{p.iniciais}</span><span className="ins-atraso-nome">{p.nome}</span>
              <span className="ins-trilho t-ruim"><span style={{ width: p.pct + '%' }} /></span><b>{p.atrasadas}</b>
            </li>
          ))}
        </ul>
      ) : <p className="ins-tudo-certo"><Icone nome="checkCircle" width={18} height={18} />Nenhuma tarefa atrasada.</p>}
    </Cartao>
  );
}

/** as páginas de um assunto só (o menu lateral) */
const DO_PAINEL = { dp: Dp, guias: Guias, clientes: Clientes, entregas: Entregas, tarefas: Tarefas } as const;

export function Insights({ pagina = 'painel' }: { pagina?: string }) {
  const vm = useInsights();
  useCarregando(vm.carregando);
  // a página do menu lateral: a Visão geral, a Equipe ou um assunto só (18/11/2026: "pode dividir em menu lateral")
  const Sozinho = pagina in DO_PAINEL ? DO_PAINEL[pagina as keyof typeof DO_PAINEL] : null;
  return (
    <section className="ins">
      {vm.exemplos && <div className="alerta-linha"><Alerta titulo="Dados de exemplo" texto="Os números são de mentira; no banco, quem monta é o robô do PC a cada 15 minutos." /></div>}
      {vm.erro && <div className="alerta-linha"><Alerta titulo="Sem os números" texto={vm.erro} /></div>}
      {vm.velho && <div className="alerta-linha"><Alerta titulo="Números atrasados" texto={'O robô do PC não atualiza os números há mais de uma hora (última vez ' + vm.atualizado + ').'} /></div>}
      <div className="ins-topo">
        <h2>Indicadores {vm.tela ? 'de ' + vm.tela.competencia : 'do mês'}</h2>
        {vm.atualizado && <span className="hint"><span className="ins-ao-vivo" aria-hidden="true" />Atualizado {vm.atualizado}</span>}
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : vm.semNumeros || !vm.tela ? (
        <p className="hint" style={{ marginTop: 16 }}>Ainda não há números. Ligue a Tela de Insights em Robôs › Ajustes; o robô do PC monta os primeiros em até 15 minutos.</p>
      ) : pagina === 'equipe' ? (
        <div className="ins-sozinho"><Equipe tela={vm.tela} vm={vm} /></div>
      ) : Sozinho ? (
        <div className="ins-sozinho"><Sozinho tela={vm.tela} /></div>
      ) : (
        <>
          <div className="ins-destaques">
            {vm.tela.destaques.map(d => (
              <div key={d.id} className={'card ins-destaque t-' + d.tom}>
                {d.pct != null ? <Anel pct={d.pct} tom={d.tom} tamanho={56} espessura={6}><Icone nome={d.icone} width={18} height={18} /></Anel>
                  : <span className="ins-destaque-icone"><Icone nome={d.icone} width={20} height={20} /></span>}
                <div className="ins-destaque-texto"><b>{d.valor}</b><span>{d.rotulo}</span><small className="hint">{d.detalhe}</small></div>
              </div>
            ))}
          </div>
          <Equipe tela={vm.tela} vm={vm} />
          <div className="ins-grade">
            <Dp tela={vm.tela} />
            <Guias tela={vm.tela} />
            <Clientes tela={vm.tela} />
            <Entregas tela={vm.tela} />
            <Tarefas tela={vm.tela} />
          </div>
        </>
      )}
      {vm.pessoa && <JanelaDaPessoa vm={vm} />}
    </section>
  );
}
