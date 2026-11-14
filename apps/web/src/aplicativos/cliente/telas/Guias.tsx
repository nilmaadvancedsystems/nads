// Guias e obrigações da Área do Cliente (Vitor, 16 e 17/10/2026: "melhora essa aba"). Refeita em 13/11/2026 ("refaça
// esses 3"; "muita informação", a mesma guia aparecia duas vezes), na linguagem da tela de Solicitações: o resumo do mês
// numa linha embaixo do título (no lugar dos três cartões grandes); à esquerda, as guias do mês com abas (A pagar e
// Pagas) dentro do cartão, cada uma com as ações em três casas fixas, e embaixo o que o escritório entrega no mês numa
// lista simples alinhada; à direita, o calendário discreto (só os pontos; o clique no dia destaca o que vence nele) e os
// avisos da contabilidade. No celular, uma coluna: as guias primeiro. Só desenha: o estado e as contas vêm de useGuias.ts.
import './guias.css';
import { Icone, SeletorMes } from '@nads/ui';
import { useRef } from 'react';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { LinhaGuiaDoMes, LinhaPagaDoMes } from '../partes/LinhaGuiaDoMes';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const TOM_DO_CERTIFICADO = { ok: 'Em dia', warn: 'Vence logo', bad: 'Vencido' } as const;

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  const raiz = useRef<HTMLDivElement>(null);
  // o clique no dia destaca o que vence nele e, se estiver fora da vista, leva até lá
  const escolherDia = (dia: number) => {
    const soltar = vm.diaEscolhido === dia;
    vm.escolherDia(dia);
    if (!soltar) requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('.cli-gu-lista [data-dia="' + dia + '"], .cli-gu-entregas [data-dia="' + dia + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const temAvisos = vm.avisos.length > 0 || !!vm.certificado;
  const temLado = vm.calendario.mostra || temAvisos;
  const naPagas = vm.aba === 'pagas';
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Guias e obrigações</h1>
          {/* os números do mês numa linha (13/11/2026: no lugar dos três cartões grandes do alto) */}
          <p className="cli-subtitulo cli-gu-resumo cli-numeros-guias">
            {vm.resumo.map((t, i) => (
              <span key={i} className={'cli-gu-trecho' + (t.tom ? ' t-' + t.tom : '')}>{t.antes && t.antes + ' '}<b>{t.valor}</b>{t.depois && ' ' + t.depois}</span>
            ))}
          </p>
        </div>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês" max={vm.ultimo} />
      </div>

      <div ref={raiz} className={'cli-gu' + (temLado ? ' com-lado' : '')}>
        <div className="cli-gu-col">
          {/* as guias do mês, com as abas dentro do cartão (como em Solicitações) */}
          <section className="card cli-gu-lista" data-tutorial="a-pagar">
            <div className="cli-gu-barra">
              <div className="cli-gu-abas" role="tablist" aria-label="Guias do mês">
                {vm.abas.map(a => (
                  <button key={a.id} type="button" role="tab" aria-selected={vm.aba === a.id} className={'cli-gu-aba' + (vm.aba === a.id ? ' ativa' : '')} onClick={() => vm.escolherAba(a.id)}>
                    {a.rotulo}{a.n > 0 && <span className="cli-gu-conta">{a.n}</span>}
                  </button>
                ))}
              </div>
              {!naPagas && vm.comPdf > 1 && (
                <button type="button" className="cli-gu-todas" disabled={!!vm.juntando} onClick={vm.baixarTodas} title="Baixar as guias do mês num .zip">
                  <Icone nome="download" width={15} height={15} />{vm.juntando || 'Baixar todas'}
                </button>
              )}
            </div>
            {naPagas ? (
              vm.pagas.length ? (
                <ul className="cli-gu-itens">
                  {vm.pagas.map(x => <LinhaPagaDoMes key={x.paga.id} paga={x.paga} dia={x.dia} escolhida={x.escolhida} ocupado={vm.baixando === x.paga.id} onComprovante={id => void vm.comprovante(id)} />)}
                </ul>
              ) : <p className="cli-gu-vazio"><Icone nome="recibo" width={18} height={18} />{vm.vazio}</p>
            ) : vm.guias.length ? (
              <ul className="cli-gu-itens">
                {vm.guias.map(x => (
                  <LinhaGuiaDoMes key={x.guia.id} guia={x.guia} codigo={x.codigo} quando={x.quando} destaque={x.destaque} escolhida={x.escolhida} dia={x.dia}
                    ocupado={vm.baixando === x.guia.id || vm.vista.abrindo === x.guia.id} onVer={vm.verGuia} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} onPedirNova={vm.pedirGuiaNova} />
                ))}
              </ul>
            ) : <p className="cli-gu-vazio"><Icone nome="checkCircle" width={18} height={18} />{vm.vazio}</p>}
          </section>

          {/* o que o escritório entrega no mês, numa lista simples alinhada: a data, o nome e a situação */}
          {vm.entregas.length > 0 && (
            <section className="card cli-gu-entregas">
              <div className="cli-gu-cabeca"><h3>O que o escritório entrega</h3><span className="cli-gu-cabeca-dir">{vm.resumoDasEntregas}</span></div>
              <ul className="cli-gu-entregas-lista">
                {vm.entregas.map(e => (
                  <li key={e.id} data-dia={e.dia} className={'cli-gu-entrega' + (e.feita ? ' feita' : '') + (e.hoje ? ' hoje' : '') + (e.escolhida ? ' escolhida' : '')}>
                    <span className="cli-gu-data">{e.data}</span>
                    <span className="cli-gu-entrega-nome">{e.nome}</span>
                    <span className="cli-gu-entrega-sit">{e.feita ? <><Icone nome="check" width={13} height={13} />Entregue</> : e.hoje ? 'Hoje' : 'A entregar'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {temLado && (
          <div className="cli-gu-col cli-gu-lado">
            {/* o calendário do mês, discreto: hoje em carmim, os pontos na cor da situação; o clique destaca o dia */}
            {vm.calendario.mostra && (
              <section className="card cli-gu-agenda cli-agenda-mes">
                <div className="cli-gu-cabeca"><h3>{vm.calendario.titulo}</h3></div>
                <div className="cli-gu-semana" aria-hidden="true">{SEMANA.map((d, k) => <span key={k}>{d}</span>)}</div>
                <div className="cli-gu-cal cli-calendario">
                  {vm.calendario.semanas.flat().map(d => d.vazio ? <span key={d.chave} /> : (
                    <button key={d.chave} type="button" disabled={!d.pontos.length} title={d.titulo || undefined} aria-label={d.titulo || 'Dia ' + d.dia}
                      aria-pressed={d.pontos.length ? d.escolhido : undefined} onClick={() => escolherDia(d.dia)}
                      className={'cli-gu-dia' + (d.hoje ? ' hoje cli-cal-hoje' : '') + (d.passou ? ' passou' : '') + (d.escolhido ? ' escolhido' : '') + (d.pontos.length ? ' tem' : '')}>
                      <span className="cli-gu-num">{d.dia}</span>
                      <span className="cli-gu-pontos">{d.pontos.map((c, k) => <i key={k} className={c} />)}</span>
                    </button>
                  ))}
                </div>
                {/* (13/11/2026, revisão) só as cores que aparecem no mês */}
                <p className="cli-gu-legenda cli-legenda-cal" aria-hidden="true">
                  {vm.calendario.legenda.map(l => <span key={l.classe}><i className={l.classe} />{l.rotulo}</span>)}
                </p>
              </section>
            )}

            {/* os avisos da contabilidade: uma lista fina, sem ícones */}
            {temAvisos && (
              <section className="card cli-gu-avisos">
                <div className="cli-gu-cabeca"><h3>Avisos da contabilidade</h3></div>
                <ul className="cli-gu-avisos-lista">
                  {vm.avisos.map(a => (
                    <li key={a.id}>
                      <b>{a.titulo}</b>
                      <p>{a.texto}</p>
                      {a.ir && <button type="button" className="cli-gu-link" onClick={() => vm.irPara(a.ir!)}>{a.ir === 'documentos' ? 'Enviar agora' : 'Abrir'}<Icone nome="chevronRight" width={14} height={14} /></button>}
                    </li>
                  ))}
                  {vm.certificado && (
                    <li>
                      <span className="cli-gu-aviso-topo"><b>Certificado digital {vm.certificado.tipo}</b><span className={'cli-gu-tom t-' + vm.certificado.tom}>{TOM_DO_CERTIFICADO[vm.certificado.tom]}</span></span>
                      <p>{vm.certificado.texto}</p>
                      {vm.certificado.tom !== 'ok' && <button type="button" className="cli-gu-link" onClick={() => vm.irPara('chamados')}>Pedir a renovação<Icone nome="chevronRight" width={14} height={14} /></button>}
                    </li>
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {/* a pré-visualização da guia (12/11/2026) */}
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar}
        onAnterior={vm.setas.anterior} onProximo={vm.setas.proximo} posicao={vm.setas.posicao} abrindo={!!vm.vista.abrindo} />}
    </>
  );
}
