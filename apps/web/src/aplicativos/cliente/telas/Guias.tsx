// Guias e obrigações da Área do Cliente (Vitor, 16 e 17/10/2026: "melhora essa aba"). Refeita em 13/11/2026 ("refaça
// esses 3"; "muita informação", a mesma guia aparecia duas vezes), na linguagem da tela de Solicitações: o resumo do mês
// numa linha embaixo do título (no lugar dos três cartões grandes); à esquerda, as guias do mês com abas (A pagar e
// Pagas) dentro do cartão, cada uma com as ações em três casas fixas, e embaixo o que o escritório entrega no mês numa
// lista simples alinhada; à direita, o calendário discreto (só os pontos; o clique no dia destaca o que vence nele) e os
// avisos da contabilidade. No celular, uma coluna: as guias primeiro. Só desenha: o estado e as contas vêm de useGuias.ts.
// Enxugada em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"): saíram o cartão "O que o escritório
// entrega" (trabalho interno do escritório) e os "Avisos da contabilidade" (já aparecem no "Precisa de você" da Visão
// geral); o resumo ficou com dois fatos; cada guia com a data curta, o valor e um botão (o resto no "⋯"). Ficam a lista
// (com as abas A pagar e Pagas) e, ao lado, o calendário.
import './guias.css';
import { Icone, MenuSuspenso, SeletorMes } from '@nads/ui';
import { useRef } from 'react';
import { JanelaDoArquivo } from '../partes/JanelaDoArquivo';
import { LinhaGuiaDoMes, LinhaPagaDoMes } from '../partes/LinhaGuiaDoMes';
import { SiglaDaGuia } from '../partes/SiglaDaGuia';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';
import { AjudaDaTela } from '../partes/AjudaDaTela';
import { MarcaDaTela } from '../partes/MarcaDaTela';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  const raiz = useRef<HTMLDivElement>(null);
  // o clique no dia destaca o que vence nele e, se estiver fora da vista, leva até lá
  const escolherDia = (dia: number) => {
    const soltar = vm.diaEscolhido === dia;
    vm.escolherDia(dia);
    if (!soltar) requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('.cli-gu-lista [data-dia="' + dia + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  // (16/11/2026) sobrou só o calendário ao lado: sem nada no mês, a lista ocupa a largura toda
  const temLado = vm.calendario.mostra;
  const naPagas = vm.aba === 'pagas';
  return (
    <>
      <div className="cli-titulo">
        <div>
          <MarcaDaTela /><h1 className="page-title">Guias e obrigações</h1><AjudaDaTela />
          {/* os números do mês numa linha (16/11/2026, "muita informação": no máximo dois fatos) */}
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
                <button type="button" className="cli-gu-todas" disabled={!!vm.juntando} onClick={vm.baixarTodas} title={vm.separados ? 'Baixar as guias do mês, uma por uma' : 'Baixar as guias do mês num .zip'}>
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
                    ocupado={vm.baixando === x.guia.id || vm.vista.abrindo === x.guia.id} onVer={vm.verGuia} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} onPedirNova={vm.pedirGuiaNova}
                    onComprovante={vm.mandarComprovante} comprovanteEm={vm.comprovanteEm(x.guia)} />
                ))}
              </ul>
            ) : <p className="cli-gu-vazio"><Icone nome="checkCircle" width={18} height={18} />{vm.vazio}</p>}
          </section>
          {/* (24/11/2026: "essas 2") os parcelamentos ativos (ficha parcelamentos, 18/11/2026) e o boleto dos honorários do
              escritório (ficha 50; só os já enviados, sem "pago") num cartão só, com as linhas no desenho das guias */}
          {(vm.parcelamentos.length > 0 || vm.honorarios.length > 0) && (
            <section className="card cli-gu-lista cli-gu-outros" aria-label="Outros pagamentos">
              <div className="cli-gu-cabeca"><h3>Outros pagamentos</h3></div>
              <ul className="cli-gu-itens">
                {vm.honorarios.map(h => (
                  <li key={h.id} className="cli-gu-linha">
                    <span className="cli-gu-logo"><SiglaDaGuia tipo="HON" tamanho={34} /></span>
                    <span className="cli-gu-txt"><b className="cli-gu-nome">{h.nome}</b><span className="cli-gu-sub"><span className="cli-gu-junto">{h.sub}</span></span></span>
                    <span className="cli-gu-valor">{h.valor}</span>
                    {/* (24/11/2026: "ela tem que poder ver o boleto por aqui"; "se possivel poder gerar um codigo pix") o Ver
                        boleto abre a pré-visualização; no "⋯", baixar, o código de barras e o Pix copia e cola */}
                    <span className="cli-gu-acoes cli-g-acoes">
                      {h.temPdf ? (
                        <button type="button" className="btn cli-gu-principal" disabled={vm.baixando === h.id || vm.vista.abrindo === h.id} onClick={() => vm.verGuia(h.id)}><Icone nome="olho" width={15} height={15} />Ver boleto</button>
                      ) : h.pix ? (
                        <button type="button" className="btn cli-gu-principal" onClick={() => vm.copiarPix(h.pix)}><Icone nome="copiar" width={15} height={15} />Copiar Pix</button>
                      ) : h.linha ? (
                        <button type="button" className="btn cli-gu-principal" onClick={() => vm.copiarCodigo(h.linha)}><Icone nome="copiar" width={15} height={15} />Copiar código</button>
                      ) : <span className="cli-gu-vaga" aria-hidden="true" />}
                      {h.temPdf || h.pix || h.linha ? (
                        <span className="cli-gu-mais">
                          <MenuSuspenso rotulo="" icone="mais" className="icon-btn" semSeta direita flutuante compacto dica="Mais ações" titulo="Mais ações: honorários do escritório" itens={[
                            ...(h.temPdf ? [{ rotulo: 'Baixar o boleto', icone: 'download' as const, desabilitado: vm.baixando === h.id, onClick: () => void vm.baixar(h.id) }] : []),
                            ...(h.pix ? [{ rotulo: 'Copiar o Pix copia e cola', icone: 'copiar' as const, onClick: () => vm.copiarPix(h.pix) }] : []),
                            ...(h.linha ? [{ rotulo: 'Copiar o código de barras', icone: 'copiar' as const, onClick: () => vm.copiarCodigo(h.linha) }] : []),
                          ]} />
                        </span>
                      ) : <span className="cli-gu-vaga" aria-hidden="true" />}
                    </span>
                  </li>
                ))}
                {vm.parcelamentos.map(p => (
                  <li key={p.id} className="cli-gu-linha">
                    <span className="cli-gu-logo"><span className="cli-sigla cli-gu-sigla-icone" style={{ width: 34, height: 34 }} aria-hidden="true"><Icone nome="calendar" width={18} height={18} /></span></span>
                    <span className="cli-gu-txt"><b className="cli-gu-nome">{p.nome}</b><span className="cli-gu-sub"><span className="cli-gu-junto">{p.sub}</span></span></span>
                    <span className="cli-gu-valor">{p.valor}</span>
                    <span className="cli-gu-acoes cli-g-acoes cli-gu-sem-acao"><span className="cli-gu-vaga" aria-hidden="true" /><span className="cli-gu-vaga" aria-hidden="true" /></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* (26/11/2026: "tem que parecer que sci report nem existe para o usuario") as guias do SCI Report já vêm
              juntas às outras, na lista de cima (dados/repo.ts, comGuiasDoSci) */}
        </div>

        {temLado && (
          <div className="cli-gu-col cli-gu-lado">
            {/* o calendário do mês, discreto: hoje em carmim, os pontos na cor da situação; o clique destaca o dia */}
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
          </div>
        )}
      </div>

      {/* a pré-visualização da guia (12/11/2026) */}
      {vm.vista.aberto && <JanelaDoArquivo arquivo={vm.vista.aberto} onBaixar={vm.vista.baixar} onFechar={vm.vista.fechar}
        onAnterior={vm.setas.anterior} onProximo={vm.setas.proximo} posicao={vm.setas.posicao} abrindo={!!vm.vista.abrindo} />}
    </>
  );
}
