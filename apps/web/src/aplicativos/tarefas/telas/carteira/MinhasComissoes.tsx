// Carteira › Comissões (12/11/2026): a pessoa registra as comissões e acompanha cada uma (lançada → aprovada → paga, ou
// recusada com o motivo). Em cima, o total do mês com a barra das partes; clicar numa linha abre a comissão (muda enquanto está lançada).
import { carteira, formatos } from '@nads/core';
import { baixarBytes, Icone, LogoExcel, MenuSuspenso, useCarregando, type NomeIcone } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DadosDeTesteDaCarteira, SeletorDoMes, type useMes, SeloDaComissao } from './comum';
import { JanelaDaComissao } from './JanelaDaComissao';
import { useMinhasComissoes } from './useCarteiraDaPessoa';

const ddmm = (d: string) => d.slice(0, 10).split('-').reverse().join('/').slice(0, 5);
/** o nome do cliente sem o começo do CNPJ que o MEI leva no nome ("70.162.470 FELIPE…" → "FELIPE…") */
const nomeDoCliente = (n: string) => n.replace(/^[\d./-]{6,}\s+/, '').trim() || n;

/**
 * O Seu Financeiro no jeito de app de banco (Vitor, 19/11/2026: "fazer algo mais diferente, parecendo um app de banco", com o exemplo do
 * app de cripto): no alto, sem caixa, o saldo do mês grande (com o olho para esconder) e a linha dos últimos meses; os botões redondos
 * das ações (registrar, materiais, extrato, holerite e comprovantes; apagado o que ainda não chegou); embaixo, os lançamentos em lista,
 * cada um com o ícone redondo, o cliente, o tipo e a data, o valor e a situação (com os ⋯ e o Excel).
 */
export function MinhasComissoes({ m: mesDeFora, onMateriais }: { m?: ReturnType<typeof useMes>; onMateriais?: () => void } = {}) {
  const vm = useMinhasComissoes(mesDeFora);
  const { m, lista, totais: t, aberta, setAberta } = vm;
  useCarregando(!vm.carregada);
  const nomeDoMes = carteira.mesPorExtenso(m.mes).split(' ')[0];
  // o olho do saldo (fica neste navegador)
  const [oculto, setOculto] = useState(() => { try { return localStorage.getItem('carteira-saldo-oculto') === '1'; } catch { return false; } });
  const alternarOculto = () => setOculto(o => { try { localStorage.setItem('carteira-saldo-oculto', o ? '0' : '1'); } catch { /* sem armazenamento */ } return !o; });
  const valor = (n: number) => (oculto ? '••••••' : formatos.reais(n));

  // os anexos do mês, nos botões redondos
  const holerite = vm.docsDoMes.find(d => d.tipo === 'holerite') || null;
  const docComprovante = vm.docsDoMes.find(d => d.tipo !== 'holerite') || null;
  const compSalario = vm.pagsDoMes.filter(p => p.tipo !== 'comissao').flatMap(p => p.comprovantes.map(c => ({ p, c })))[0] || null;
  const compComissoes = vm.pagsDoMes.filter(p => p.tipo === 'comissao').flatMap(p => p.comprovantes.map(c => ({ p, c })))[0] || null;
  const comComissao = lista.some(c => c.situacao !== 'recusada');
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const acoes: { rotulo: string; icone: NomeIcone; onClick: (() => void) | null; destaque?: boolean; dica?: string }[] = [
    { rotulo: 'Registrar', icone: 'plus', onClick: () => setAberta('nova'), destaque: true, dica: 'Registrar comissão' },
    { rotulo: 'Materiais', icone: 'impressora', onClick: onMateriais ?? null, dica: 'Impressões e materiais' },
    { rotulo: 'Extrato', icone: 'download', onClick: comComissao ? () => { const x = vm.extratoDeComissoes(); baixarBytes(x.bytes, x.nome, xlsx); } : null, dica: 'Extrato de comissões' },
    { rotulo: 'Holerite', icone: 'recibo', onClick: holerite ? () => vm.abrirDocumento(holerite) : null },
    { rotulo: 'Pagamento', icone: 'comprovante', onClick: docComprovante ? () => vm.abrirDocumento(docComprovante) : compSalario ? () => vm.abrirComprovante(compSalario.p.id, compSalario.c) : null, dica: 'Comprovante de pagamento' },
    { rotulo: 'Comissões', icone: 'comprovante', onClick: compComissoes ? () => vm.abrirComprovante(compComissoes.p.id, compComissoes.c) : null, dica: 'Comprovante de comissões' },
  ];

  // os lançamentos do mês numa lista só, pela data
  type Item = { chave: string; data: string; icone: NomeIcone; tom: string; titulo: string; sub: string; valor: string; riscado?: boolean; status: ReactNode; abrir?: () => void; mais?: ReactNode };
  const itens: Item[] = [
    ...lista.map(c => ({
      chave: 'c' + c.id, data: c.data, icone: 'dinheiro' as NomeIcone, tom: 'comissao', titulo: nomeDoCliente(c.cliente),
      sub: 'Comissão · ' + c.descricao + (c.porte ? ' · ' + c.porte : '') + ' · ' + ddmm(c.data), valor: c.oculta ? '—' : valor(c.valor), riscado: c.situacao === 'recusada',
      status: <SeloDaComissao s={c.situacao} semAprovacao />, abrir: () => setAberta(c),
      mais: (
        <MenuSuspenso rotulo="" icone="mais" semSeta className="icon-btn icon-btn-sm" dica="Editar ou excluir" flutuante direita largura={180}
          itens={vm.podeMexer(c) ? [
            { rotulo: 'Editar', icone: 'lapis', onClick: () => setAberta(c) },
            { rotulo: 'Excluir', icone: 'lixeira', perigo: true, onClick: () => { void vm.excluir(c); } },
          ] : [{ rotulo: 'Abrir', icone: 'olho', onClick: () => setAberta(c) }]} />
      ),
    })),
    ...vm.docsDoMes.map(doc => ({
      chave: 'd' + doc.id, data: doc.enviadoEm.slice(0, 10), icone: (doc.tipo === 'holerite' ? 'recibo' : 'checkCircle') as NomeIcone, tom: 'salario',
      titulo: doc.tipo === 'holerite' ? 'Holerite' : carteira.rotuloDoDocumento(doc.tipo), sub: 'Salário · ' + ddmm(doc.enviadoEm), valor: doc.valor != null ? valor(doc.valor) : '',
      status: <span className="fraco">PDF</span>, abrir: () => vm.abrirDocumento(doc),
    })),
    ...vm.pagsDoMes.map(p => ({
      chave: 'p' + p.id, data: p.pago && p.pagoEm ? p.pagoEm : p.vencimento, icone: 'landmark' as NomeIcone, tom: 'salario', titulo: p.rotulo,
      sub: 'Pagamento do escritório · ' + ddmm(p.pago && p.pagoEm ? p.pagoEm : p.vencimento), valor: valor(p.pago ? p.valorPago ?? p.valor : p.valor),
      status: p.pago ? <span className="badge badge-ok">Pago</span> : <span className="badge badge-suave badge-info">A receber</span>,
      abrir: p.comprovantes[0] ? () => vm.abrirComprovante(p.id, p.comprovantes[0]) : undefined,
    })),
    ...vm.materiaisDoMes.map(x => ({
      chave: 'm' + x.id, data: x.data, icone: 'impressora' as NomeIcone, tom: 'material', titulo: x.cliente,
      sub: 'Materiais · ' + x.nome + ' × ' + x.quantidade.toLocaleString('pt-BR') + ' · ' + ddmm(x.data), valor: '', status: <span className="fraco">Registrado</span>,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <section className="dp-painel cmc banco">
      {aberta && <JanelaDaComissao comissao={aberta === 'nova' ? null : aberta} fechar={() => setAberta(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <DadosDeTesteDaCarteira />
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {/* o saldo do mês, sem caixa */}
      <div className="banco-saldo" aria-label={'O total de ' + nomeDoMes}>
        <div className="banco-saldo-txt">
          <span className="banco-rotulo">Seu saldo de {nomeDoMes}
            <button type="button" className="banco-olho" onClick={alternarOculto} title={oculto ? 'Mostrar os valores' : 'Esconder os valores'} aria-label={oculto ? 'Mostrar os valores' : 'Esconder os valores'}><Icone nome="olho" /></button>
          </span>
          <b className="banco-valor num">{!vm.carregada ? '—' : oculto ? '••••••' : <ValorQueSobe key={m.mes} valor={vm.totalDoMes} />}</b>
          <span className="banco-partes">
            <span><i className="cmc-ponto cmc-aprovada" />A receber <b className="num">{valor(t.lancadas + t.aprovadas)}</b></span>
            <span><i className="cmc-ponto cmc-paga" />Pagas <b className="num">{valor(t.pagas)}</b></span>
            <span className="fraco">{t.quantas === 1 ? '1 comissão' : t.quantas + ' comissões'}</span>
          </span>
        </div>
        <LinhaDosMeses serie={vm.serie} />
      </div>

      {/* as ações em botões redondos */}
      <div className="banco-acoes">
        {acoes.map(a => (
          <button key={a.rotulo} type="button" className={'banco-acao' + (a.destaque ? ' destaque' : '')} disabled={!a.onClick} onClick={a.onClick || undefined}
            title={a.onClick ? a.dica || a.rotulo : (a.dica || a.rotulo) + ': ainda não chegou'}>
            <span className="banco-acao-bola" aria-hidden="true"><Icone nome={a.icone} /></span>
            <span>{a.rotulo}</span>
          </button>
        ))}
      </div>

      {/* os lançamentos, em lista */}
      <div className="banco-lista-topo">
        <h3>Lançamentos</h3>
        {itens.length > 0 && (
          <button type="button" className="icon-btn cmc-excel" title="Exportar em Excel" aria-label="Exportar os lançamentos do mês em Excel"
            onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, xlsx); }}>
            <LogoExcel />
          </button>
        )}
      </div>
      {vm.carregada && !itens.length ? (
        <p className="banco-vazio">Nada em {carteira.mesPorExtenso(m.mes)}. As comissões que você registrar, os holerites, os pagamentos e os materiais do mês aparecem aqui.</p>
      ) : (
        <ul className="banco-lista">
          {itens.map(x => (
            <li key={x.chave} className={x.abrir ? 'abre' : undefined} tabIndex={x.abrir ? 0 : undefined} onClick={x.abrir} onKeyDown={x.abrir ? e => { if (e.key === 'Enter') x.abrir!(); } : undefined}>
              <span className={'banco-bola banco-' + x.tom} aria-hidden="true"><Icone nome={x.icone} /></span>
              <span className="banco-item-txt"><b>{x.titulo}</b><span>{x.sub}</span></span>
              <span className="banco-item-valor"><b className={'num' + (x.riscado ? ' riscado' : '')}>{x.valor}</b>{x.status}</span>
              <span className="banco-item-mais" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{x.mais}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A linha das comissões dos últimos 6 meses (a do app de banco): o traço e o ponto do mês escolhido. */
function LinhaDosMeses({ serie }: { serie: { mes: string; valor: number }[] }) {
  const maior = Math.max(1, ...serie.map(x => x.valor));
  const L = 220, A = 64;
  const pts = serie.map((x, i) => [i * (L / Math.max(1, serie.length - 1)), A - 6 - (x.valor / maior) * (A - 14)] as const);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const ultimo = pts[pts.length - 1];
  return (
    <svg className="banco-linha" viewBox={'-4 0 ' + (L + 8) + ' ' + A} role="img" aria-label="As comissões dos últimos 6 meses">
      <path d={d + ' L' + L + ' ' + A + ' L0 ' + A + ' Z'} className="banco-linha-area" />
      <path d={d} className="banco-linha-traco" />
      {ultimo && <circle cx={ultimo[0]} cy={ultimo[1]} r="3.5" className="banco-linha-ponto" />}
    </svg>
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
