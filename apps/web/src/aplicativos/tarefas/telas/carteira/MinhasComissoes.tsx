// Carteira › Comissões (12/11/2026): a pessoa registra as comissões e acompanha cada uma (lançada → aprovada → paga, ou
// recusada com o motivo). Em cima, o total do mês com a barra das partes; clicar numa linha abre a comissão (muda enquanto está lançada).
import { carteira, formatos } from '@nads/core';
import { baixarBytes, Icone, MenuSuspenso, useCarregando, Vazio } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DadosDeTesteDaCarteira, SeletorDoMes, type useMes, SeloDaComissao } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { useMinhasComissoes } from './useCarteiraDaPessoa';

const ddmm = (d: string) => d.slice(0, 10).split('-').reverse().join('/').slice(0, 5);
const ddmmaa = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
/** o nome do cliente sem o começo do CNPJ que o MEI leva no nome ("70.162.470 FELIPE…" → "FELIPE…") */
const nomeDoCliente = (n: string) => n.replace(/^[\d./-]{6,}\s+/, '').trim() || n;

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
                {/* os anexos do mês só como ícones no Pagas (Vitor, 19/11/2026: "Coloca so os icones na box de Pagas"): o holerite, o extrato
                    de comissões, o comprovante de pagamento e o das comissões; apagado o que ainda não chegou */}
                {x.id === 'paga' && <AnexosDoMes vm={vm} mes={m.mes} />}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* os lançamentos do mês numa tabela (Vitor, 19/11/2026: "Data, nome do cliente, porte, tipo: Comissao, salario, materiais, valor,
          status. Faz uma tabela disso"): as comissões, os holerites, os pagamentos do escritório e os materiais, pela data */}
      <section className="card cmc-lista" aria-label="Os lançamentos do mês">
        {vm.carregada && !lista.length && !vm.docsDoMes.length && !vm.pagsDoMes.length && !vm.materiaisDoMes.length ? (
          <Vazio compacto icone="dinheiro" titulo={'Nada em ' + carteira.mesPorExtenso(m.mes)} texto="As comissões que você registrar, os holerites, os pagamentos do escritório e os materiais do mês aparecem aqui." />
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela cmc-tabela">
              <thead><tr><th>Data</th><th>Cliente</th><th>Porte</th><th>Tipo</th><th className="num">Valor</th><th>Status</th><th className="cmc-mais-th">
                {/* a planilha dos lançamentos do mês, no cabeçalho da tabela (Vitor, 19/11/2026: "Coloca um icone de excel no cabecalho da tabela") */}
                <button type="button" className="icon-btn icon-btn-sm cmc-excel" title="Exportar em Excel" aria-label="Exportar os lançamentos do mês em Excel"
                  onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" /><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              </th></tr></thead>
              <tbody>
                {[
                  ...lista.map(c => ({ data: c.data, chave: 'c' + c.id, linha: (
                    <tr key={'c' + c.id} className={'linha-abre cmc-tr-' + c.situacao} tabIndex={0} title="Abrir a comissão" onClick={() => setAberta(c)} onKeyDown={e => { if (e.key === 'Enter') setAberta(c); }}>
                      <td className="cmc-dia">{ddmmaa(c.data)}</td>
                      <td><b>{nomeDoCliente(c.cliente)}</b></td>
                      <td>{c.porte || <span className="fraco">—</span>}</td>
                      <td>Comissão<span className="fraco"> · {c.descricao}</span></td>
                      <td className={'num' + (c.situacao === 'recusada' ? ' cmc-riscado' : '')}><b>{c.oculta ? '—' : formatos.reais(c.valor)}</b></td>
                      <td><SeloDaComissao s={c.situacao} semAprovacao />{c.pagoEm && <span className="fraco"> em {ddmm(c.pagoEm)}</span>}{c.situacao === 'recusada' && c.motivo && <span className="fraco" title={c.motivo}> · {c.motivo}</span>}</td>
                      <td className="cmc-mais" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <MenuSuspenso rotulo="" icone="mais" semSeta className="icon-btn icon-btn-sm" dica="Editar ou excluir" flutuante direita largura={180}
                          itens={vm.podeMexer(c) ? [
                            { rotulo: 'Editar', icone: 'lapis', onClick: () => setAberta(c) },
                            { rotulo: 'Excluir', icone: 'lixeira', perigo: true, onClick: () => { void vm.excluir(c); } },
                          ] : [{ rotulo: 'Abrir', icone: 'olho', onClick: () => setAberta(c) }]} />
                      </td>
                    </tr>
                  ) })),
                  ...vm.docsDoMes.map(doc => ({ data: doc.enviadoEm.slice(0, 10), chave: 'd' + doc.id, linha: (
                    <tr key={'d' + doc.id}>
                      <td className="cmc-dia">{ddmmaa(doc.enviadoEm.slice(0, 10))}</td>
                      <td><span className="fraco">—</span></td>
                      <td><span className="fraco">—</span></td>
                      <td>{doc.tipo === 'holerite' ? 'Salário · holerite' : carteira.rotuloDoDocumento(doc.tipo)}</td>
                      <td className="num"><b>{doc.valor != null ? formatos.reais(doc.valor) : '—'}</b></td>
                      <td className="cmc-acoes">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.abrirDocumento(doc)}><Icone nome="olho" />Abrir</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.baixarDocumento(doc)} aria-label="Baixar" title="Baixar"><Icone nome="download" /></button>
                      </td>
                      <td />
                    </tr>
                  ) })),
                  ...vm.pagsDoMes.map(p => ({ data: p.pago && p.pagoEm ? p.pagoEm : p.vencimento, chave: 'p' + p.id, linha: (
                    <tr key={'p' + p.id}>
                      <td className="cmc-dia">{ddmmaa(p.pago && p.pagoEm ? p.pagoEm : p.vencimento)}</td>
                      <td><span className="fraco">—</span></td>
                      <td><span className="fraco">—</span></td>
                      <td>{p.rotulo}</td>
                      <td className="num"><b>{formatos.reais(p.pago ? p.valorPago ?? p.valor : p.valor)}</b></td>
                      <td className="cmc-acoes">
                        {p.pago ? <span className="badge badge-ok">Pago</span> : <span className="badge badge-suave badge-info">A receber</span>}
                        {p.comprovantes.map(c => (
                          <button key={c.id} type="button" className="btn btn-ghost btn-sm" title={'Comprovante: ' + c.nome} onClick={() => vm.abrirComprovante(p.id, c)} aria-label="Abrir o comprovante"><Icone nome="clipe" /></button>
                        ))}
                      </td>
                      <td />
                    </tr>
                  ) })),
                  ...vm.materiaisDoMes.map(x => ({ data: x.data, chave: 'm' + x.id, linha: (
                    <tr key={'m' + x.id}>
                      <td className="cmc-dia">{ddmmaa(x.data)}</td>
                      <td><b>{x.cliente}</b>{x.codigo != null && <span className="fraco num"> · {x.codigo}</span>}</td>
                      <td><span className="fraco">—</span></td>
                      <td>Materiais<span className="fraco"> · {x.nome} × {x.quantidade.toLocaleString('pt-BR')}</span></td>
                      <td className="num"><span className="fraco" title="O valor dos materiais fica no Financeiro">—</span></td>
                      <td><span className="badge badge-neutral">Registrado</span></td>
                      <td />
                    </tr>
                  ) })),
                ].sort((a, b) => a.data.localeCompare(b.data)).map(x => x.linha)}
              </tbody>
            </table>
          </div>
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

/** Os 4 anexos do mês, em ícones (no cartão Pagas): o holerite, o extrato das comissões, o comprovante de pagamento e o das comissões. */
function AnexosDoMes({ vm, mes }: { vm: ReturnType<typeof useMinhasComissoes>; mes: string }) {
  const holerite = vm.docsDoMes.find(d => d.tipo === 'holerite') || null;
  const docComprovante = vm.docsDoMes.find(d => d.tipo !== 'holerite') || null;
  const compSalario = vm.pagsDoMes.filter(p => p.tipo !== 'comissao').flatMap(p => p.comprovantes.map(c => ({ p, c })))[0] || null;
  const compComissoes = vm.pagsDoMes.filter(p => p.tipo === 'comissao').flatMap(p => p.comprovantes.map(c => ({ p, c })))[0] || null;
  const comissoes = vm.lista.filter(c => c.situacao !== 'recusada').length;
  const icone = (nome: 'recibo' | 'fileDown' | 'checkCircle' | 'dinheiro', titulo: string, onClick: (() => void) | null) => (
    <button type="button" className="icon-btn icon-btn-sm cmc-anexo-icone-btn" disabled={!onClick} onClick={onClick || undefined}
      title={onClick ? titulo : titulo + ': ainda não chegou'} aria-label={titulo}><Icone nome={nome} /></button>
  );
  return (
    <span className="cmc-anexos-icones">
      {icone('recibo', 'Holerite', holerite ? () => vm.abrirDocumento(holerite) : null)}
      {icone('fileDown', 'Extrato de comissões', comissoes ? () => { const x = vm.extratoDeComissoes(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } : null)}
      {icone('checkCircle', 'Comprovante de pagamento', docComprovante ? () => vm.abrirDocumento(docComprovante) : compSalario ? () => vm.abrirComprovante(compSalario.p.id, compSalario.c) : null)}
      {icone('dinheiro', 'Comprovante de comissões', compComissoes ? () => vm.abrirComprovante(compComissoes.p.id, compComissoes.c) : null)}
      <span className="sr-only">{mes}</span>
    </span>
  );
}
