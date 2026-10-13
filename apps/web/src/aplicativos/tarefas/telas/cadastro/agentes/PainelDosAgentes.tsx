// Cadastro › Agentes (Vitor, 13/10/2026: "tem como upar uma página no nads disso?"; depois: "muita informação, muito
// feio"): o essencial de cada sessão do Claude Code. Um cartão curto por sessão: o projeto, o estado, o nível do porteiro
// e há quanto tempo; uma linha com o que está fazendo agora; e os subagentes em etiquetas (os que terminaram, só contados).
import { Alerta, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { createPortal } from 'react-dom';
import type { AgenteNoPainel } from '../../../dados/agentes';
import { JanelaDaExplicacao } from './JanelaDaExplicacao';
import { NIVEL, STATUS, nomeDaFerramenta, useAgentesNoPainel, type FiltroDosAgentes } from './useAgentesNoPainel';

const FILTROS: { valor: FiltroDosAgentes; rotulo: string }[] = [{ valor: 'ativas', rotulo: 'Ativas' }, { valor: 'todas', rotulo: 'Todas (24 h)' }];
const UMA_LINHA = { margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const limpo = (t: string) => t.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();

/** O que o agente faz agora, numa linha: a ferramenta e o alvo. */
const fazendo = (a: AgenteNoPainel) => (a.agora ? nomeDaFerramenta(a.agora.fer) + (a.agora.txt ? ' · ' + limpo(a.agora.txt) : '') : '');

export function PainelDosAgentes() {
  const vm = useAgentesNoPainel();
  useCarregando(!vm.carregada);
  const n = (rotulo: string) => vm.numeros.find(x => x.rotulo === rotulo)?.valor ?? 0;
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <Segmentado opcoes={FILTROS} valor={vm.filtro} onMudar={vm.setFiltro} />
        <span className="hint">
          {n('Trabalhando agora')} trabalhando · {n('Esperando você')} esperando você · {n('Subagentes rodando')} {n('Subagentes rodando') === 1 ? 'subagente' : 'subagentes'}
          {vm.exemplos ? ' · dados de exemplo' : ''}
        </span>
      </div>
      {!vm.carregada ? <Esqueleto linhas={4} /> : vm.erro ? <Alerta naLinha titulo="Sem o painel" texto={vm.erro} /> : !vm.sessoes.length ? (
        <div className="gh-blank">
          <Icone nome="robo" />
          <h4>{vm.filtro === 'ativas' ? 'Nenhuma sessão ativa agora' : 'Nenhuma sessão nas últimas 24 h'}</h4>
          <p>As sessões do Claude Code do PC do escritório aparecem aqui sozinhas.</p>
        </div>
      ) : vm.sessoes.map(s => {
        const st = STATUS[s.status] || STATUS.parado;
        const principal = s.agentes.find(a => a.chave === 'principal');
        const subs = s.agentes.filter(a => a.chave !== 'principal');
        const rodando = subs.filter(a => a.status === 'trabalhando');
        const terminaram = subs.length - rodando.length;
        const agora = principal && fazendo(principal);
        return (
          <section key={s.sessao} className="card agentes-cartao" style={s.inativa ? { opacity: 0.55 } : undefined}
            role="button" tabIndex={0} aria-label={'Como está funcionando: ' + (s.projeto || 'sessão')} title="Clique para ver como está funcionando"
            onClick={() => vm.abrir(s.sessao)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vm.abrir(s.sessao); } }}>
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">{s.projeto || 'Sessão'}</h3>
              <span className={'badge ' + st.badge}>{st.rotulo}</span>
              {s.nivel && <span className="badge badge-neutral">{NIVEL[s.nivel] || s.nivel}</span>}
              <span className="tarefas-barra-espaco" />
              <span className="hint">{s.haQuanto}</span>
            </div>
            {s.status === 'esperando' && s.aviso
              ? <p className="hint" style={UMA_LINHA}><b>Esperando você:</b> {limpo(s.aviso)}</p>
              : <p className="hint" style={UMA_LINHA} title={agora || s.pedido}>{agora ? <><b>Agora:</b> {agora}</> : <><b>Pedido:</b> {limpo(s.pedido) || '—'}</>}</p>}
            {(rodando.length > 0 || terminaram > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {rodando.map(a => (
                  <span key={a.chave} className="badge badge-ok" title={fazendo(a)}>{a.tipo}{a.modelo ? ' · ' + a.modelo : ''}</span>
                ))}
                {terminaram > 0 && <span className="badge badge-neutral">{terminaram === 1 ? '1 terminou' : terminaram + ' terminaram'}</span>}
              </div>
            )}
          </section>
        );
      })}
      {vm.explicacao && createPortal(<JanelaDaExplicacao e={vm.explicacao} fechar={vm.fechar} />, document.body)}
    </section>
  );
}
