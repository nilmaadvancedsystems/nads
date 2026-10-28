// Financeiro › Painel (22/10/2026: "no financeiro, faça um dashboard de entradas, saídas dentre outros"): o período e
// quatro números (entradas, saídas, resultado, saldo do caixa hoje); para onde foi e de onde veio o dinheiro, por conta do
// plano (com o extrato do banco importado somado, 23/10/2026); os honorários do mês passado, o banco (o saldo de cada um)
// e as notas emitidas no período. O mês a mês saiu (23/10/2026). O aviso das contas a pagar (28/10/2026): as vencidas em
// vermelho, as de hoje e as dos próximos 7 dias, com o link para lá. Só as peças do catálogo (Segmentado, Stat, Cartão,
// Ranking, Vazio).
import { formatos } from '@nads/core';
import { Icone, LogoBanco, Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { useState } from 'react';
import { JanelaDoResultado } from './ResultadoPorConta';
import { usePainelFinanceiro } from './usePainelFinanceiro';

const reais = (v: number) => formatos.reais(v);

function PorConta({ titulo, itens, cor, vazio }: { titulo: string; itens: { rotulo: string; total: number; pct: number }[]; cor: string; vazio: string }) {
  return (
    <div className="card">
      <h3>{titulo}</h3>
      {itens.length ? (
        <div className="rank">
          {itens.map(x => (
            <div key={x.rotulo} className="rank-item">
              <span className="rank-nome">{x.rotulo}</span><span className="rank-val num">{reais(x.total)} <span className="fraco">{x.pct.toLocaleString('pt-BR')}%</span></span>
              <span className="rank-barra"><span style={{ width: x.pct + '%', background: cor }} /></span>
            </div>
          ))}
        </div>
      ) : <p className="fraco">{vazio}</p>}
    </div>
  );
}

/** comResultado: já abre com a janela do Resultado por conta (o endereço antigo /financeiro/resultado) */
export function PainelFinanceiro({ comResultado }: { comResultado?: boolean }) {
  const [resultado, setResultado] = useState(!!comResultado);
  const vm = usePainelFinanceiro();
  useCarregando(vm.carregando);
  const n = vm.numeros, h = vm.honorarios, p = vm.pagar;
  return (
    <section className="fin-painel">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <span className="fin-acoes">
          <button type="button" className="btn btn-outline" onClick={vm.imprimirCaixa} title="O Demonstrativo de Caixa do período, para imprimir"><Icone nome="printer" />Imprimir o caixa</button>
          <button type="button" className="btn btn-outline" onClick={() => setResultado(true)}><Icone nome="scale" />Resultado por conta</button>
          <button type="button" className="btn btn-primary" onClick={() => vm.ir('extrato')}><Icone nome="fileUp" />Importar extrato</button>
        </span>
      </div>
      {resultado && <JanelaDoResultado fechar={() => setResultado(false)} />}

      <div className="stat-grid fin-numeros">
        <Stat rotulo="Entradas" valor={reais(n.entradas)} cor="entrada" />
        <Stat rotulo="Saídas" valor={reais(n.saidas)} cor="saida" />
        <Stat rotulo="Resultado" valor={reais(n.resultado)} cor={n.resultado < 0 ? 'saida' : 'entrada'} />
        <Stat rotulo="Saldo do caixa hoje" valor={reais(n.saldo)} cor={n.saldo < 0 ? 'saida' : undefined} />
        {n.saldoBanco != null && <Stat rotulo="Saldo no banco" valor={reais(n.saldoBanco)} cor={n.saldoBanco < 0 ? 'saida' : undefined} />}
      </div>
      {vm.dicas && <p className="hint fin-painel-dica">Entradas: {vm.dicas.entradas} · Saídas: {vm.dicas.saidas}</p>}

      {/* o aviso das contas a pagar: só quando há o que avisar */}
      {p.carregado && p.linhas.length > 0 && (
        <div className={'card cp-aviso' + (p.vencidas.length ? ' cp-aviso-vencidas' : '')}>
          <h3>
            <span className="cp-aviso-titulo"><Icone nome={p.vencidas.length ? 'alert' : 'calendar'} />Contas a pagar</span>
            <span className="fraco cp-aviso-resumo">
              {p.vencidas.length > 0 && <b className="fin-valor-saida">{p.vencidas.length} {p.vencidas.length === 1 ? 'vencida' : 'vencidas'} · {reais(p.totalVencido)}</b>}
              {p.vencidas.length > 0 && (p.hoje.length + p.proximas.length) > 0 && ' · '}
              {(p.hoje.length + p.proximas.length) > 0 && <>{p.hoje.length + p.proximas.length} a vencer {p.hoje.length ? 'hoje e ' : ''}nos próximos 7 dias · {reais(p.totalDaSemana)}</>}
            </span>
          </h3>
          <ul className="cp-aviso-lista">
            {p.linhas.map(l => (
              <li key={l.id} className={'cp-aviso-item cp-aviso-' + l.quando}>
                <span className="num cp-aviso-dia">{l.quando === 'hoje' ? 'Hoje' : l.vencimento}</span>
                <span className="cp-aviso-nome">{l.fornecedor}</span>
                <span className="num">{l.valor}</span>
                {l.quando === 'vencida' && <span className="badge badge-bad">Vencida</span>}
              </li>
            ))}
          </ul>
          <div className="btn-row">
            {p.vencidas.length > 0 && <button type="button" className="btn btn-outline btn-danger" onClick={() => vm.irParaAsContas(true)}>Ver as vencidas</button>}
            <button type="button" className="btn btn-outline" onClick={() => vm.irParaAsContas(false)}>Abrir Contas a pagar</button>
          </div>
        </div>
      )}

      {!vm.carregando && !n.lancamentos ? (
        <Vazio icone="dinheiro" titulo="Nenhum lançamento neste período">
          <button type="button" className="btn btn-outline" onClick={() => vm.ir('caixa')}>Abrir o Caixa</button>
        </Vazio>
      ) : (
        <div className="fin-painel-colunas">
          <PorConta titulo="Para onde foi o dinheiro" itens={vm.saidasPorConta} cor="var(--destructive)" vazio="Nenhuma saída no período." />
          <PorConta titulo="De onde veio o dinheiro" itens={vm.entradasPorConta} cor="var(--success)" vazio="Nenhuma entrada no período." />
        </div>
      )}

      <div className="fin-painel-colunas fin-painel-tres">
        <div className="card">
          <h3>Honorários de {h.competencia}</h3>
          {!h.carregado ? <p className="fraco">Lendo…</p> : !h.total ? <p className="fraco">Nenhum contrato de honorário ativo.</p> : (
            <>
              <div className="rank">
                <div className="rank-item">
                  <span className="rank-nome">Recebido {reais(h.recebido)} de {reais(h.previsto)}</span><span className="rank-val num">{h.pct}%</span>
                  <span className="rank-barra"><span style={{ width: h.pct + '%', background: 'var(--success)' }} /></span>
                </div>
              </div>
              <p className="fin-painel-linha">{h.pagos} de {h.total} clientes pagaram · <b>{reais(h.emAberto)}</b> em aberto</p>
            </>
          )}
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => vm.ir('honorarios')}>Ver os honorários</button></div>
        </div>
        <div className="card">
          <h3>Banco</h3>
          {vm.bancos.length ? (
            <div className="rank">
              {vm.bancos.map(b => (
                <div key={b.banco} className="rank-item">
                  <span className="rank-nome fin-conta"><span className="fin-logo" aria-hidden="true"><LogoBanco banco={b.marca} cor /></span>{b.banco} <span className="fraco">até {b.ateBr}</span></span><span className={'rank-val num' + (b.saldo < 0 ? ' fin-valor-saida' : '')}>{b.saldoBr}</span>
                </div>
              ))}
            </div>
          ) : <p className="fraco">{vm.ultimaImportacao ? 'O extrato importado não trouxe o saldo.' : 'Nenhum extrato importado ainda.'}</p>}
          {vm.ultimaImportacao && <p className="fin-painel-linha fraco">Última importação: {vm.ultimaImportacao.banco}, em {vm.ultimaImportacao.quando}</p>}
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => vm.ir('extrato')}>Importar extrato</button></div>
        </div>
        <div className="card">
          <h3>Notas fiscais emitidas no período</h3>
          {!vm.notas.carregada ? <p className="fraco">Lendo…</p> : (
            <p className="fin-painel-linha"><b className="fin-painel-grande num">{vm.notas.quantas}</b> {vm.notas.quantas === 1 ? 'nota autorizada' : 'notas autorizadas'} · {reais(vm.notas.valor)}</p>
          )}
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => vm.ir('notas')}>Ver as notas</button></div>
        </div>
      </div>

    </section>
  );
}
