// Guias e obrigações da Área do Cliente (Vitor, 16 e 17/10/2026: "melhora essa aba"), no layout da "Agenda de tributos e
// obrigações" do protótipo com as peças do nads. Versão D: à esquerda (2/3), as guias a pagar e as pagas no mês em listas
// de grade (as mesmas colunas da Visão geral: logo, nome, situação, valor e ações), com o baixar carmim só na vencida (ou
// na mais urgente); à direita (1/3), o resumo do mês (o total a pagar, o total pago e o próximo vencimento) e os avisos
// da contabilidade (os recados e o certificado digital); embaixo, o que o escritório entrega no mês. Com o banco
// (17/10/2026) as guias pagas ainda não têm fonte: somem o card "Pagas no mês" e o "Total pago" do resumo. Polida de
// 17/10/2026: sem recado nem certificado (sempre, com o banco), o card dos avisos some em vez de dizer "Nenhum aviso"; o
// contador some no zero; o vazio diz o que importa ("Nada para pagar neste mês"). "Melhora mais" de 17/10/2026: o Baixar
// com nome (carmim na próxima a pagar) e, na vencida, o "Pedir nova", que abre o chamado já com o assunto e o título.
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { Icone, SeletorMes } from '@nads/ui';
import { useRef } from 'react';
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { LinhaDePaga } from '../partes/LinhaDePaga';
import { Vazio } from '../partes/Vazio';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  const lista = useRef<HTMLDivElement>(null);
  // o clique no dia (no calendário ou na linha) abre as ações do dia e, se ele estiver fora da vista, leva até ele
  const abrirDia = (dia: number) => {
    vm.painel.escolherDia(dia);
    requestAnimationFrame(() => lista.current?.querySelector<HTMLElement>('[data-dia="' + dia + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const temAvisos = vm.avisos.length > 0 || !!vm.certificado;
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Guias e obrigações</h1>
        </div>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês" max={vm.ultimo} />
      </div>

      {/* os números do mês (12/11/2026: no lugar do "Resumo do mês") */}
      <div className="cli-numeros cli-numeros-guias">
        {vm.painel.numeros.map(n => (
          <div key={n.chave} className={'cli-numero' + (n.tom ? ' tom-' + n.tom : '')}>
            <span className="cli-sobre">{n.rotulo}</span>
            <span className="cli-numero-valor menor">{n.valor}</span>
            <span className="hint">{n.dica}</span>
          </div>
        ))}
      </div>

      {/* a agenda do mês (12/11/2026, refeita: "boa ideia, mal executada"): à esquerda o mini calendário (o dia num círculo,
          hoje em carmim, o escolhido com anel, os pontos na cor da situação); à direita a agenda em blocos por data (o
          quadradinho do dia e, em cada item, a faixa da situação, o nome, a situação e o valor). O clique no dia rola a
          agenda até ele. */}
      {vm.painel.temCalendario && (
        <section className="card cli-agenda-mes">
          <div className="card-head"><h3>{vm.painel.titulo}</h3><span className="card-head-ctl hint">{vm.painel.resumo}</span></div>
          <div className="cli-agenda-corpo">
            <div className="cli-cal">
              <table className="cli-calendario">
                <thead><tr>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, k) => <th key={k} scope="col">{d}</th>)}</tr></thead>
                <tbody>
                  {vm.painel.semanas.map((sem, s) => (
                    <tr key={s}>
                      {sem.map(d => d.vazio ? <td key={d.chave} /> : (
                        <td key={d.chave}>
                          <button type="button" disabled={!d.pontos.length} title={d.titulo || undefined} aria-label={d.titulo || 'Dia ' + d.dia}
                            aria-pressed={d.pontos.length ? d.escolhido : undefined} onClick={() => abrirDia(d.dia)}
                            className={'cli-cal-dia' + (d.hoje ? ' hoje' : '') + (d.passou ? ' passou' : '') + (d.fimDeSemana ? ' fds' : '') + (d.escolhido ? ' escolhido' : '') + (d.pontos.length ? ' tem' : '')}>
                            <span className="cli-cal-num">{d.dia}</span>
                            <span className="cli-cal-pontos">{d.pontos.map((c, k) => <i key={k} className={c} />)}</span>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="cli-legenda-cal" aria-hidden="true">
                <span><i className="m-guia t-aberta" />a pagar</span>
                <span><i className="m-guia t-vencida" />vencida</span>
                {vm.mostraPagas && <span><i className="m-paga t-feita" />paga</span>}
                <span><i className="m-entrega t-aberta" />entrega do escritório</span>
              </div>
            </div>
            {/* a agenda em lista, estilo extrato (12/11/2026, a escolhida entre as três propostas): a data e, embaixo, uma linha por item com a
                situação e o valor em colunas; o clique na linha (ou no dia do calendário) abre as ações embaixo dela */}
            <div className="cli-extrato" ref={lista}>
              {vm.painel.agenda.map(g => (
                <section key={g.dia} data-dia={g.dia} className={'cli-extrato-dia' + (g.escolhido ? ' aberto' : '') + (g.passou ? ' passou' : '') + (g.hoje ? ' hoje' : '')} aria-label={g.extenso}>
                  <button type="button" className="cli-extrato-data" aria-expanded={g.escolhido} onClick={() => abrirDia(g.dia)}>
                    <span>{g.cabecalho}</span>{g.hoje && <b className="cli-extrato-hoje">hoje</b>}
                  </button>
                  <ul>
                    {(g.escolhido ? g.detalhe : g.itens.map(x => ({ ...x, sub: '', acoes: [] as typeof g.detalhe[number]['acoes'] }))).map(x => (
                      <li key={x.chave} className={'cli-extrato-item ' + x.classe + (x.entrega ? ' entrega' : '')}>
                        <button type="button" className="cli-extrato-linha" onClick={() => abrirDia(g.dia)} aria-expanded={g.escolhido}>
                          <i className="cli-extrato-ponto" aria-hidden="true" />
                          <span className="cli-extrato-nome">{x.nome}{x.sub && <small>{x.sub}</small>}</span>
                          <span className="cli-extrato-sit">{x.situacao}</span>
                          <span className="cli-extrato-valor">{x.valor}</span>
                        </button>
                        {x.acoes.length > 0 && (
                          <span className="cli-extrato-acoes">
                            {x.acoes.map(a => a.tipo === 'ver' ? (
                              <button key="ver" type="button" className="btn btn-sm btn-ghost" disabled={vm.vista.abrindo === a.id} onClick={() => vm.verGuia(a.id)}><Icone nome="olho" width={14} height={14} />Ver</button>
                            ) : a.tipo === 'copiar' ? (
                              <button key="copiar" type="button" className="btn btn-sm btn-ghost" onClick={() => vm.copiarCodigo(a.codigo)}><Icone nome="copiar" width={14} height={14} />Copiar código</button>
                            ) : a.tipo === 'baixar' ? (
                              <button key="baixar" type="button" className={'btn btn-sm' + (a.destaque ? ' btn-primary' : '')} disabled={vm.baixando === a.id} onClick={() => void vm.baixar(a.id)}><Icone nome="download" width={14} height={14} />Baixar</button>
                            ) : a.tipo === 'pedir' ? (
                              <button key="pedir" type="button" className="btn btn-sm cli-pedir-nova" onClick={() => { const guia = vm.guias.find(y => y.id === a.id); if (guia) vm.pedirGuiaNova(guia); }}><Icone nome="repeat" width={14} height={14} />Pedir nova</button>
                            ) : (
                              <button key="comprovante" type="button" className="btn btn-sm btn-ghost" disabled={vm.baixando === a.id} onClick={() => void vm.comprovante(a.id)}><Icone nome="download" width={14} height={14} />Comprovante</button>
                            ))}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className={temAvisos ? 'cli-duas cli-guias' : ''}>
        <div className="cli-coluna">
          <section className="card">
            <div className="card-head"><h3>A pagar</h3>{vm.guias.length > 0 && <span className="cli-conta">{vm.guias.length}</span>}</div>
            {vm.guias.length ? (
              <ul className="cli-lista">
                {vm.guias.map(g => (
                  <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} faltam={vm.faltam(g)} destaque={g.id === vm.urgente}
                    ocupado={vm.baixando === g.id || vm.vista.abrindo === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} onPedirNova={vm.pedirGuiaNova} onVer={vm.verGuia} />
                ))}
              </ul>
            ) : <Vazio icone="checkCircle" titulo="Nada para pagar neste mês" />}
          </section>

          {vm.mostraPagas && (
            <section className="card">
              <div className="card-head"><h3>Pagas no mês</h3>{vm.pagas.length > 0 && <span className="cli-conta">{vm.pagas.length}</span>}</div>
              {vm.pagas.length ? (
                <ul className="cli-lista cli-pagas">
                  {vm.pagas.map(p => <LinhaDePaga key={p.id} paga={p} ocupado={vm.baixando === p.id} onComprovante={id => void vm.comprovante(id)} />)}
                </ul>
              ) : <Vazio icone="recibo" titulo="Nada pago neste mês" />}
            </section>
          )}
        </div>

        {temAvisos && (
        <div className="cli-coluna">
          {temAvisos && (
            <section className="card cli-avisos-card">
              <div className="card-head"><h3>Avisos da contabilidade</h3></div>
              <ul className="cli-lista">
                {vm.avisos.map(a => (
                  <li key={a.id} className="cli-linha cli-aviso-bloco">
                    <span className="cli-aviso-ico" aria-hidden="true"><Icone nome="sino" width={16} height={16} /></span>
                    <div className="cli-g-txt"><b>{a.titulo}</b><p className="hint cli-quebra">{a.texto}</p>
                      {a.ir && <button type="button" className="btn btn-ghost cli-link" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar agora' : 'Abrir'}<Icone nome="chevronRight" width={16} height={16} /></button>}
                    </div>
                  </li>
                ))}
                {vm.certificado && (
                  <li className="cli-linha cli-aviso-bloco">
                    <span className="cli-aviso-ico" aria-hidden="true"><Icone nome="escudo" width={16} height={16} /></span>
                    <div className="cli-g-txt">
                      <div className="cli-aviso-titulo">
                        <b>Certificado digital {vm.certificado.tipo}</b>
                        <span className={'badge ' + (vm.certificado.tom === 'bad' ? 'badge-bad' : vm.certificado.tom === 'ok' ? 'badge-ok' : 'badge-warn')}>{vm.certificado.tom === 'bad' ? 'Vencido' : vm.certificado.tom === 'ok' ? 'Em dia' : 'Vence logo'}</span>
                      </div>
                      <p className="hint cli-quebra">{vm.certificado.texto}</p>
                      {vm.certificado.tom !== 'ok' && <button type="button" className="btn btn-ghost cli-link" onClick={() => vm.irPara('chamados')}>Pedir a renovação<Icone nome="chevronRight" width={16} height={16} /></button>}
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
        )}
      </div>

      {/* o que o escritório entrega no mês está na agenda do mês, no alto (12/11/2026: o cartão daqui repetia) */}
      {/* a pré-visualização da guia (12/11/2026) */}
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar} />}
    </>
  );
}
