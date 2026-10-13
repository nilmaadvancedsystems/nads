// Cadastro › Agentes (Vitor, 13/10/2026: "tem como upar uma página no nads disso?"): o que cada agente do Claude Code
// está fazendo, de qualquer lugar. Os números no topo; um cartão por sessão (o projeto, o estado, o nível do porteiro e o
// último pedido) com a tabela dos agentes (o principal e cada subagente: o modelo, o que faz agora e as últimas ações).
import { Alerta, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { NIVEL, STATUS, nomeDaFerramenta, useAgentesNoPainel, type FiltroDosAgentes } from './useAgentesNoPainel';

const FILTROS: { valor: FiltroDosAgentes; rotulo: string }[] = [{ valor: 'ativas', rotulo: 'Ativas' }, { valor: 'todas', rotulo: 'Todas (24 h)' }];
const hora = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const duracao = (ms: number) => (!ms ? '' : ms >= 1000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : ms + ' ms');

export function PainelDosAgentes() {
  const vm = useAgentesNoPainel();
  useCarregando(!vm.carregada);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro">
          <span className="hint">Mostrar</span>
          <Segmentado opcoes={FILTROS} valor={vm.filtro} onMudar={vm.setFiltro} />
        </label>
        {vm.exemplos && <span className="hint">Dados de exemplo (modo desenvolvedor).</span>}
      </div>
      {!vm.carregada ? <Esqueleto linhas={6} numeros={4} /> : vm.erro ? <Alerta naLinha titulo="Sem o painel" texto={vm.erro} /> : (
        <>
          <div className="stat-grid dp-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value num">{n.valor}</p>
              </div>
            ))}
          </div>
          {!vm.sessoes.length && (
            <div className="gh-blank">
              <Icone nome="robo" />
              <h4>{vm.filtro === 'ativas' ? 'Nenhuma sessão ativa agora' : 'Nenhuma sessão nas últimas 24 h'}</h4>
              <p>As sessões do Claude Code do PC do escritório aparecem aqui sozinhas, enquanto trabalham.</p>
            </div>
          )}
          {vm.sessoes.map(s => {
            const st = STATUS[s.status] || STATUS.parado;
            return (
              <section key={s.sessao} className="card dp-lista" style={s.inativa ? { opacity: 0.6 } : undefined}>
                <div className="dp-lista-topo">
                  <h3 className="dp-titulo">{s.projeto || 'Sessão'}</h3>
                  <span className={'badge ' + st.badge}>{st.rotulo}</span>
                  {s.nivel && <span className="badge badge-neutral">Porteiro: {NIVEL[s.nivel] || s.nivel}</span>}
                  {s.modelo && <span className="hint">{s.modelo}</span>}
                  <span className="tarefas-barra-espaco" />
                  <span className="hint">{s.maquina ? s.maquina + ' · ' : ''}{s.haQuanto}</span>
                </div>
                {s.status === 'esperando' && s.aviso && <Alerta naLinha titulo="Esperando você" texto={s.aviso} />}
                {s.pedido && <p className="hint" style={{ margin: '0 0 8px' }}><b>Último pedido:</b> {s.pedido}</p>}
                <div className="table-wrap table-compact">
                  <table>
                    <thead><tr><th>Agente</th><th>Modelo</th><th>Estado</th><th>Agora</th><th>Últimas ações</th></tr></thead>
                    <tbody>
                      {s.agentes.map(a => {
                        const sa = a.chave === 'principal' ? (a.agora ? STATUS.trabalhando : st) : STATUS[a.status] || STATUS.parado;
                        return (
                          <tr key={a.chave}>
                            <td><b>{a.chave === 'principal' ? 'Principal' : a.tipo}</b></td>
                            <td className="hint">{a.chave === 'principal' ? s.modelo.replace(/^claude-/, '') : a.modelo || 'herda'}</td>
                            <td><span className={'badge ' + sa.badge}>{sa.rotulo}</span></td>
                            <td className="wrap">
                              {a.agora ? <><b>{nomeDaFerramenta(a.agora.fer)}</b> {a.agora.txt} <span className="hint">{vm.haQuanto(a.agora.ts)}</span></>
                                : a.msg ? <span className="hint">{a.msg}</span> : <span className="hint">—</span>}
                            </td>
                            <td className="wrap">
                              {a.hist.slice(0, 3).map(h => (
                                <span key={h.ts + h.fer + h.txt} className="hint" style={{ display: 'block', margin: 0 }}>
                                  {hora(h.ts)} · <b style={h.falhou ? { color: 'var(--danger, #f85149)' } : undefined}>{nomeDaFerramenta(h.fer)}</b> {h.txt}{h.ms ? ' · ' + duracao(h.ms) : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {s.maisAgentes > 0 && <p className="hint" style={{ margin: '6px 0 0' }}>+ {s.maisAgentes} agentes</p>}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
