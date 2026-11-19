// Carteira › Comissões (12/11/2026): a pessoa registra as comissões e acompanha cada uma (lançada → aprovada → paga, ou
// recusada com o motivo). Em cima, o total do mês com a barra das partes; clicar numa linha abre a comissão (muda enquanto está lançada).
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DadosDeTesteDaCarteira, SeletorDoMes, type useMes, SeloDaComissao } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { useMinhasComissoes } from './useCarteiraDaPessoa';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** '2026-11-15' → { dia: '15', mes: 'nov' } */
const diaEMes = (d: string) => ({ dia: d.slice(8, 10), mes: MES_CURTO[Number(d.slice(5, 7)) - 1] || '' });
const ddmm = (d: string) => d.slice(0, 10).split('-').reverse().join('/').slice(0, 5);

/**
 * O topo redesenhado (Vitor, 15/11/2026: "melhora o visual desse inicio da carteira, não to achando legal, refaça de outra
 * maneira"): no lugar dos quatro cartões coloridos, um cartão só com o total do mês e a barra das partes (a receber e pagas,
 * sem a aprovação desde 19/11/2026; as cores das cápsulas da lista); e, no lugar da tabela, a lista em linhas: a data num bloquinho, o cliente
 * com o serviço embaixo, o valor e a situação à direita.
 */
/** extra: o que vai na linha do mês, antes do Registrar (o Impressões e materiais da Carteira; 19/11/2026) */
export function MinhasComissoes({ extra, m: mesDeFora }: { extra?: ReactNode; m?: ReturnType<typeof useMes> } = {}) {
  const vm = useMinhasComissoes(mesDeFora);
  const { m, lista, totais: t, aberta, setAberta } = vm;
  useCarregando(!vm.carregada);
  // sem a aprovação (Vitor, 19/11/2026: "nao existe isso, nao existe aprovacao"): o que falta receber e o que já foi pago
  const partes = [
    { id: 'aprovada', rotulo: 'A receber', valor: t.lancadas + t.aprovadas },
    { id: 'paga', rotulo: 'Pagas', valor: t.pagas },
  ];
  const nomeDoMes = carteira.mesPorExtenso(m.mes).split(' ')[0];
  return (
    <section className="dp-painel cmc">
      {aberta && <JanelaDaComissao comissao={aberta === 'nova' ? null : aberta} fechar={() => setAberta(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <DadosDeTesteDaCarteira />
        {extra}
        <button type="button" className="btn btn-primary" onClick={() => setAberta('nova')}><Icone nome="plus" />Registrar comissão</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {/* a caixa do total redesenhada (Vitor, 19/11/2026: "Tem como fazer uma box melhor nao? Um valor maior, quando entra ele carrega
          fazendo uma animacao de numero subindo"): o valor grande que sobe ao entrar, a barra que cresce e as partes em cartõezinhos */}
      <section className="card cmc-resumo cmc-novo" aria-label={'O total de ' + nomeDoMes}>
        <div className="cmc-total">
          <span className="cmc-rotulo">Total de {nomeDoMes}</span>
          <b className="cmc-valor num">{vm.carregada ? <ValorQueSobe key={m.mes} valor={vm.totalDoMes} /> : '—'}</b>
          <span className="hint">{t.quantas === 1 ? '1 comissão' : t.quantas + ' comissões'}{t.recusadas > 0 ? ' · ' + formatos.reais(t.recusadas) + ' recusado' : ''}</span>
        </div>
        <div className="cmc-partes">
          <div className="cmc-barra" aria-hidden="true" key={m.mes}>
            {vm.totalDoMes > 0 && partes.filter(x => x.valor > 0).map(x => <i key={x.id} className={'cmc-' + x.id} style={{ flexGrow: x.valor }} />)}
          </div>
          <ul className="cmc-legenda">
            {partes.map(x => (
              <li key={x.id}>
                <span className={'cmc-ponto cmc-' + x.id} aria-hidden="true" />
                <span className="cmc-rotulo">{x.rotulo}</span>
                <b className="num">{vm.carregada ? <ValorQueSobe key={m.mes} valor={x.valor} /> : '—'}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* os lançamentos do mês numa caixa só (Vitor, 19/11/2026: "Essas boxes da pra unificar em uma unica box de lancamentos"): as
          comissões, os holerites e comprovantes e os pagamentos do escritório, pela data */}
      <section className="card cmc-lista" aria-label="Os lançamentos do mês">
        <h3 className="cart-titulo">Lançamentos de {nomeDoMes}</h3>
        {vm.carregada && !lista.length && !vm.docsDoMes.length && !vm.pagsDoMes.length ? (
          <Vazio compacto icone="dinheiro" titulo={'Nada em ' + carteira.mesPorExtenso(m.mes)} texto="As comissões que você registrar, os holerites e os pagamentos do escritório do mês aparecem aqui." />
        ) : (
          <ul>
            {lista.map(c => {
              const d = diaEMes(c.data);
              return (
                <li key={'c' + c.id}>
                  <button type="button" className={'cmc-linha ' + c.situacao} title="Abrir a comissão" onClick={() => setAberta(c)}>
                    <span className="cmc-data" aria-label={c.data.split('-').reverse().join('/')}><b>{d.dia}</b><span>{d.mes}</span></span>
                    <span className="cmc-quem">
                      <b>{c.cliente}{c.porte && <span className="fraco"> · {c.porte}</span>}</b>
                      <span className="fraco"><Icone nome="dinheiro" width={12} height={12} /> Comissão · {c.descricao}</span>
                      {c.situacao === 'recusada' && c.motivo && <span className="cmc-motivo">Recusada: {c.motivo}</span>}
                    </span>
                    {/* a escondida (16/11/2026): sem o valor */}
                    <b className="cmc-quanto num">{c.oculta ? '—' : formatos.reais(c.valor)}</b>
                    <span className="cmc-situacao">
                      <SeloDaComissao s={c.situacao} semAprovacao />
                      {c.pagoEm && <span className="fraco">em {ddmm(c.pagoEm)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {vm.docsDoMes.map(doc => {
              const d = diaEMes(doc.enviadoEm.slice(0, 10));
              return (
                <li key={'d' + doc.id}>
                  <div className="cmc-linha cmc-linha-doc">
                    <span className="cmc-data"><b>{d.dia}</b><span>{d.mes}</span></span>
                    <span className="cmc-quem">
                      <b>{carteira.rotuloDoDocumento(doc.tipo)}</b>
                      <span className="fraco"><Icone nome={doc.tipo === 'holerite' ? 'recibo' : 'checkCircle'} width={12} height={12} /> {doc.arquivo}</span>
                    </span>
                    <b className="cmc-quanto num">{doc.valor != null ? formatos.reais(doc.valor) : ''}</b>
                    <span className="cmc-situacao">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.abrirDocumento(doc)}><Icone nome="olho" />Abrir</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.baixarDocumento(doc)} aria-label="Baixar"><Icone nome="download" /></button>
                    </span>
                  </div>
                </li>
              );
            })}
            {vm.pagsDoMes.map(p => {
              const d = diaEMes(p.pago && p.pagoEm ? p.pagoEm : p.vencimento);
              return (
                <li key={'p' + p.id}>
                  <div className="cmc-linha cmc-linha-doc">
                    <span className="cmc-data"><b>{d.dia}</b><span>{d.mes}</span></span>
                    <span className="cmc-quem">
                      <b>{p.rotulo}</b>
                      <span className="fraco"><Icone nome="landmark" width={12} height={12} /> Pagamento do escritório{p.pago ? '' : ' · vence ' + ddmm(p.vencimento)}</span>
                    </span>
                    <b className="cmc-quanto num">{formatos.reais(p.pago ? p.valorPago ?? p.valor : p.valor)}</b>
                    <span className="cmc-situacao">
                      {p.pago ? <span className="badge badge-ok">Pago</span> : <span className="badge badge-suave badge-info">A receber</span>}
                      {p.comprovantes.map(c => (
                        <button key={c.id} type="button" className="btn btn-ghost btn-sm" title={c.nome} onClick={() => vm.abrirComprovante(p.id, c)} aria-label="Abrir o comprovante"><Icone nome="clipe" /></button>
                      ))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

/** O valor que sobe do zero até o número quando a caixa aparece (e a cada mês trocado), em ~0,9 s; quem pede menos movimento vê
 *  direto o número (Vitor, 19/11/2026: "quando entra ele carrega fazendo uma animacao de numero subindo"). */
function ValorQueSobe({ valor }: { valor: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!valor || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(valor); return; }
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 900);
      setV(valor * (1 - Math.pow(1 - t, 3)));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor]);
  return <>{formatos.reais(Math.round(v * 100) / 100)}</>;
}
