// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis").
// Os seis painéis num quadro só (o Painel) e o Modo TV: tela cheia, um painel por vez, letras grandes, girando.
import { Alerta, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import type { tarefas as t } from '@nads/core';
import { useEffect } from 'react';
import { SEGUNDOS_POR_PAINEL, useInsights } from './useInsights';
import './insights.css';

function Cartao({ p, grande = false }: { p: t.PainelDosInsights; grande?: boolean }) {
  return (
    <section className={'card ins-cartao' + (grande ? ' ins-grande' : '')} aria-label={p.titulo}>
      <div className="ins-cabeca"><h3>{p.titulo}</h3><span className="hint">{p.subtitulo}</span></div>
      <div className="ins-numeros">
        {p.numeros.map(n => (
          <div key={n.rotulo} className={'ins-numero' + (n.tom ? ' t-' + n.tom : '')}>
            <b>{n.valor}</b><span>{n.rotulo}</span>
          </div>
        ))}
      </div>
      {p.linhas.length > 0 && (
        <ul className="ins-linhas">
          {p.linhas.slice(0, grande ? 12 : 6).map(l => (
            <li key={l.nome} className={l.tom ? 't-' + l.tom : ''}><span>{l.nome}</span><span>{l.texto}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Insights() {
  const vm = useInsights();
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
  if (vm.tv && vm.atual) {
    return (
      <div className="ins-tv" role="dialog" aria-label="Modo TV">
        <Cartao p={vm.atual} grande />
        <div className="ins-tv-pe">
          <span className="ins-pontos">
            {vm.paineis.map((p, i) => <button key={p.id} type="button" className={i === vm.indice ? 'ativo' : ''} aria-label={p.titulo} onClick={() => vm.irPara(i)} />)}
          </span>
          <span className="hint">Atualizado {vm.atualizado}{vm.pausado ? ' · pausado' : ''}</span>
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
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <span className="hint">{vm.atualizado ? 'Atualizado ' + vm.atualizado : ''}</span>
        <span className="tarefas-barra-espaco" />
        <label className="hint" htmlFor="ins-segundos">Cada painel na TV</label>
        <Segmentado valor={String(vm.segundos)} onMudar={v => vm.mudarSegundos(Number(v))} opcoes={SEGUNDOS_POR_PAINEL.map(s => ({ valor: String(s), rotulo: s + ' s' }))} />
        <button type="button" className="btn btn-primary" disabled={!vm.paineis.length} onClick={vm.entrarNaTv}><Icone nome="monitor" width={16} height={16} />Modo TV</button>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : vm.semNumeros ? (
        <p className="hint" style={{ marginTop: 16 }}>Ainda não há números. Ligue a Tela de Insights em Robôs › Ajustes; o robô do PC monta os primeiros em até 15 minutos.</p>
      ) : (
        <div className="ins-grade">{vm.paineis.map(p => <Cartao key={p.id} p={p} />)}</div>
      )}
    </section>
  );
}
