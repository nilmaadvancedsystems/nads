// Fiscal › Cartas (12/11/2026): a Carta de balanço do fim do ano (o Fiscal marca os clientes e o robô manda o PDF assinado)
// e o Checklist mensal (o robô manda sozinho no último dia útil do mês). Só desenha: tudo vem de useTelaDasCartas.
import { BotaoAcao, BotaoIcone, Esqueleto, Icone, Interruptor, MenuSuspenso, Segmentado, useCarregando, useEntradaAnimada } from '@nads/ui';
import type { cartasFiscal as cf } from '@nads/core';
import { useTelaDasCartas, type AbaDasCartas } from './useCartasDoFiscal';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const SELO: Record<cf.SituacaoDoEnvio, { classe: string; rotulo: string }> = {
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila' },
  enviada: { classe: 'badge badge-ok', rotulo: 'Enviada' },
  erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
};
const ABAS: { valor: AbaDasCartas; rotulo: string }[] = [{ valor: 'balanco', rotulo: 'Carta de balanço' }, { valor: 'checklist', rotulo: 'Checklist do mês' }];

function Selo({ s, enviada = 'Enviada' }: { s: cf.SituacaoDoCliente | undefined; enviada?: string }) {
  if (!s) return <span className="fraco">—</span>;
  const selo = SELO[s.situacao];
  return (
    <span title={s.erro || (s.para.length ? 'para ' + s.para.join(', ') : '')}>
      <span className={selo.classe}>{s.situacao === 'enviada' ? enviada : selo.rotulo}</span> <span className="fraco">{hora(s.em)}</span>
    </span>
  );
}

export function CartasDoFiscal() {
  const vm = useTelaDasCartas();
  useCarregando(vm.carregando);
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.carregando, vm.aba, vm.ano], 'lista');
  const anos = [vm.ano - 1, vm.ano, vm.ano + 1].filter((x, k, l) => l.indexOf(x) === k);
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <Segmentado valor={vm.aba} opcoes={ABAS} onMudar={vm.setAba} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
            onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={'Regime: ' + (vm.regime || 'Todos')} titulo="Regime" dica="Regime" className={'btn btn-outline' + (vm.regime ? ' ativo' : '')}
          itens={[{ rotulo: 'Todos', marcado: !vm.regime, onClick: () => vm.setRegime('') }, ...vm.regimes.map(r => ({ rotulo: r, marcado: r === vm.regime, onClick: () => vm.setRegime(r) }))]} />
        {vm.exemplos && <span className="badge badge-warn" title="Modo de exemplo: nada vai para o robô">Exemplo</span>}
      </div>

      {vm.aba === 'balanco' ? (
        <>
          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">Carta de balanço</h3>
              <span className="hint">A Carta de balanço e a Declaração de inventário em PDF, assinadas com o certificado do escritório, para o e-mail do cadastro de cada cliente marcado.</span>
            </div>
            <div className="tarefas-barra-topo dp-filtros-linha">
              <span className="hint">Ano do balanço</span>
              <select className="select-compact" value={vm.ano} onChange={e => vm.setAno(Number(e.target.value))} aria-label="Ano do balanço">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span className="hint">Entregar o inventário até</span>
              <input type="date" className="select-compact" value={vm.prazo} onChange={e => vm.setPrazo(e.target.value)} aria-label="Prazo de entrega do inventário" />
              {vm.problema && <span className="badge badge-parada">{vm.problema}</span>}
              <span className="tarefas-barra-espaco" />
              <span className="hint">
                {(vm.contagem.enviada || 0)} {(vm.contagem.enviada || 0) === 1 ? 'enviada' : 'enviadas'}
                {vm.contagem.fila ? ' · ' + vm.contagem.fila + ' na fila' : ''}{vm.contagem.erro ? ' · ' + vm.contagem.erro + ' não deu' : ''}
              </span>
              <BotaoAcao className="btn btn-outline" carregando={vm.pedindo === 'teste'} textoCarregando="Pedindo…" disabled={!!vm.problema || !vm.linhas.length}
                onClick={() => void vm.mandarTeste()} title="Manda a carta do 1º marcado só para o e-mail do escritório">
                <Icone nome="envelope" />Mandar teste ao escritório
              </BotaoAcao>
              <BotaoAcao carregando={vm.pedindo === 'enviar'} textoCarregando="Pedindo…" disabled={!vm.quantosMarcados || !!vm.problema} onClick={() => void vm.enviar()}>
                <Icone nome="aviao" />Enviar marcados{vm.quantosMarcados ? ' · ' + vm.quantosMarcados : ''}
              </BotaoAcao>
            </div>
            {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap" ref={tabela}>
                <table className="dp-tabela fgts-tabela">
                  <thead>
                    <tr>
                      <th className="fgts-marca"><input type="checkbox" checked={vm.todosMarcados} onChange={e => vm.marcarTodos(e.target.checked)} aria-label="Marcar todos" title="Marcar todos da tela" /></th>
                      <th>Cód.</th><th>Cliente</th><th>Regime</th><th>E-mail</th><th>Carta de {vm.ano}</th><th className="dp-tabela-acao" aria-label="Ver a carta" />
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.codigo} className={'dp-linha' + (l.situacao?.situacao === 'enviada' ? ' feita' : '')}>
                        <td className="fgts-marca">
                          <input type="checkbox" checked={vm.marcado(l.codigo)} disabled={!vm.podeMarcar(l)} onChange={() => vm.alternar(l.codigo)} aria-label={'Marcar ' + l.nome} />
                        </td>
                        <td className="num fraco">{l.codigo}</td>
                        <td className="dp-cliente"><span className="dp-cliente-nome">{l.nome}</span></td>
                        <td className="fraco">{l.regime || '—'}</td>
                        <td className="fraco">{l.email || <span className="badge badge-parada">Sem e-mail</span>}</td>
                        <td><Selo s={l.situacao} /></td>
                        <td className="dp-tabela-acao"><BotaoIcone icone="olho" titulo={'Ver a carta de ' + l.nome} disabled={!!vm.problema} onClick={() => void vm.verCarta(l)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">Checklist de {vm.mes}</h3>
              <span className="tarefas-barra-espaco" />
              <Interruptor ligado={vm.config.ligado} rotulo={vm.config.ligado ? 'Saindo todo mês' : 'Pausado'} onMudar={() => void vm.pausar(!vm.config.ligado)} />
            </div>
            <p className="hint">
              O robô manda sozinho no último dia útil do mês (<b>{vm.diaDoChecklist}</b>), a partir das 8h, para cada cliente ativo com e-mail: o checklist no corpo do
              e-mail e o PDF do escritório anexo. O prazo do cliente é o 2º dia útil do mês seguinte (<b>{vm.prazoDoChecklist}</b>).
              {' '}{(vm.doChecklist.enviada || 0)} {(vm.doChecklist.enviada || 0) === 1 ? 'cliente recebeu' : 'clientes receberam'} neste mês{vm.doChecklist.erro ? ', ' + vm.doChecklist.erro + ' não deu' : ''}.
            </p>
            {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhasDoChecklist.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap" ref={tabela}>
                <table className="dp-tabela fgts-tabela">
                  <thead><tr><th>Cód.</th><th>Cliente</th><th>Regime</th><th>E-mail</th><th>Checklist de {vm.mes}</th><th>Recebe</th></tr></thead>
                  <tbody>
                    {vm.linhasDoChecklist.map(l => (
                      <tr key={l.codigo} className={'dp-linha' + (l.fora ? ' fraco' : '')}>
                        <td className="num fraco">{l.codigo}</td>
                        <td className="dp-cliente"><span className="dp-cliente-nome">{l.nome}</span></td>
                        <td className="fraco">{l.regime || '—'}</td>
                        <td className="fraco">{l.email || <span className="badge badge-parada">Sem e-mail</span>}</td>
                        <td><Selo s={l.situacao} enviada="Enviado" /></td>
                        <td>
                          <label className="hint">
                            <input type="checkbox" checked={!l.fora} disabled={vm.pedindo === 'config'} onChange={e => void vm.alternarFora(l.codigo, !e.target.checked)} aria-label={'Mandar o checklist para ' + l.nome} />
                            {' '}{l.fora ? 'Não' : 'Sim'}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
