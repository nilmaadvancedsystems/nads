// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "Todos os seis", "faz algo bonito assim como no acessorias"). O visual é do NADS (regra 2: sem copiar telas):
// os destaques do mês, a equipe em cartões com o anel do quanto concluiu, e os painéis em barras, funil e estrelas. O
// Modo TV mostra um painel por vez, grande, girando.
import { Alerta, Esqueleto, Icone, Segmentado, useCarregando, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { PAINEIS_DA_TV, SEGUNDOS_POR_PAINEL, useInsights, type Segmento, type Tom } from './useInsights';
import './insights.css';

type Tela = NonNullable<ReturnType<typeof useInsights>['tela']>;

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

function Equipe({ tela }: { tela: Tela }) {
  return (
    <Cartao titulo="A equipe no mês" subtitulo="As rotinas do Fiscal e do Contábil, por responsável" icone="equipe" classe="ins-equipe-cartao">
      {tela.equipe.length ? (
        <div className="ins-equipe">
          {tela.equipe.map(p => (
            <div key={p.setor + p.nome} className="ins-pessoa">
              <Anel pct={p.pct} tom={p.tom} tamanho={84} espessura={7}><span className="ins-iniciais">{p.iniciais}</span></Anel>
              <b className="ins-pessoa-nome">{p.nome}</b>
              <span className="hint">{p.setor}</span>
              <span className={'ins-pilula t-' + p.tom}>{p.pct}% · {p.texto}</span>
              {p.atrasadas > 0 && <span className="ins-pilula t-ruim">{p.atrasadas} {p.atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</span>}
            </div>
          ))}
        </div>
      ) : <p className="hint">Ninguém com rotina no mês.</p>}
    </Cartao>
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

const DO_PAINEL = { equipe: Equipe, dp: Dp, guias: Guias, clientes: Clientes, entregas: Entregas, tarefas: Tarefas } as const;

export function Insights({ pagina = 'painel' }: { pagina?: string }) {
  const vm = useInsights();
  // a página do menu lateral: a Visão geral ou um assunto só (18/11/2026: "pode dividir em menu lateral")
  const Sozinho = pagina in DO_PAINEL ? DO_PAINEL[pagina as keyof typeof DO_PAINEL] : null;
  useCarregando(vm.carregando);
  // a tela cheia do Modo TV: entra junto; sair da tela cheia (o Esc do navegador) sai da TV
  const { tv, sairDaTv } = vm;
  useEffect(() => {
    if (!tv) return;
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const aoMudar = () => { if (!document.fullscreenElement) sairDaTv(); };
    document.addEventListener('fullscreenchange', aoMudar);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [tv, sairDaTv]);

  if (vm.tv && vm.tela) {
    const Painel = DO_PAINEL[vm.painelDaTv];
    return (
      <div className="ins-tv" role="dialog" aria-label="Modo TV">
        <div className="ins-tv-topo"><h2>Indicadores de {vm.tela.competencia}</h2><span className="hint">Atualizado {vm.atualizado}{vm.pausado ? ' · pausado' : ''}</span></div>
        <div className="ins-tv-corpo" key={vm.painelDaTv}><Painel tela={vm.tela} /></div>
        <div className="ins-tv-pe">
          <span className="ins-pontos">
            {PAINEIS_DA_TV.map((p, i) => <button key={p} type="button" className={i === vm.indice ? 'ativo' : ''} aria-label={'Painel ' + (i + 1)} onClick={() => vm.irPara(i)} />)}
          </span>
          <button type="button" className="btn btn-ghost" onClick={vm.pausar}><Icone nome={vm.pausado ? 'play' : 'clock'} width={16} height={16} />{vm.pausado ? 'Continuar' : 'Pausar'}</button>
          <button type="button" className="btn btn-ghost" onClick={vm.sairDaTv}><Icone nome="x" width={16} height={16} />Sair</button>
        </div>
      </div>
    );
  }
  return (
    <section className="ins">
      {vm.exemplos && <div className="alerta-linha"><Alerta titulo="Dados de exemplo" texto="Os números são de mentira; no banco, quem monta é o robô do PC a cada 15 minutos." /></div>}
      {vm.erro && <div className="alerta-linha"><Alerta titulo="Sem os números" texto={vm.erro} /></div>}
      {vm.velho && <div className="alerta-linha"><Alerta titulo="Números atrasados" texto={'O robô do PC não atualiza os números há mais de uma hora (última vez ' + vm.atualizado + ').'} /></div>}
      <div className="ins-topo">
        <div>
          <h2>Indicadores {vm.tela ? 'de ' + vm.tela.competencia : 'do mês'}</h2>
          {vm.atualizado && <span className="hint"><span className="ins-ao-vivo" aria-hidden="true" />Atualizado {vm.atualizado}</span>}
        </div>
        <span className="tarefas-barra-espaco" />
        <span className="hint">Cada painel na TV</span>
        <Segmentado valor={String(vm.segundos)} onMudar={v => vm.mudarSegundos(Number(v))} opcoes={SEGUNDOS_POR_PAINEL.map(s => ({ valor: String(s), rotulo: s + ' s' }))} />
        <button type="button" className="btn btn-primary" disabled={!vm.tela} onClick={vm.entrarNaTv}><Icone nome="monitor" width={16} height={16} />Modo TV</button>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : vm.semNumeros || !vm.tela ? (
        <p className="hint" style={{ marginTop: 16 }}>Ainda não há números. Ligue a Tela de Insights em Robôs › Ajustes; o robô do PC monta os primeiros em até 15 minutos.</p>
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
          <Equipe tela={vm.tela} />
          <div className="ins-grade">
            <Dp tela={vm.tela} />
            <Guias tela={vm.tela} />
            <Clientes tela={vm.tela} />
            <Entregas tela={vm.tela} />
            <Tarefas tela={vm.tela} />
          </div>
        </>
      )}
    </section>
  );
}
