// A aba "Balancete e razões" da Importação (Vitor, 16/10/2026: "aplique todas as suas sugestões"): o balancete dinâmico, o
// primeiro passo (ele monta a Tarefa: os adiantamentos, os empréstimos, o adiantamento salarial e as despesas e receitas
// entram ou saem por ele), e os razões das contas de uma vez só — cada um reconhecido pelo código da aba do XLS e pelo
// nome da conta no dinâmico, e entregue à etapa que usa. No desenho das linhas da Importação (imp-bloco).
import { clientes as cl, tarefas as t } from '@nads/core';
import { BotaoIcone, CampoArquivo, Icone, useRetorno } from '@nads/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ROBO_NAS_ETAPAS, useContabilDaEmpresa } from './contabilDaEmpresa';
import { BotaoDiario } from './BotaoDiario';

/**
 * meses: o período da Tarefa (para acusar o mês que falta no razão). soDiario: a empresa ainda não saiu da Importação (Vitor,
 * 04/11/2026): sem o bloco dos razões; o razão que o robô puxou do Alterdata (06/11/2026, no lugar do Diário em PDF) preenche
 * sozinho os razões que as etapas pedem (os que já estão ficam). As que já saíram seguem com os razões, como antes.
 */
export function ContabilNaImportacao({ nome, codigo, meses = [], soDiario = false, blocoDoRobo = null }: {
  nome: string; codigo: number | null; meses?: readonly string[]; soDiario?: boolean;
  /** o bloco "Razões do Alterdata" (o robô), desenhado por quem tem os dados do robô */
  blocoDoRobo?: ReactNode;
}) {
  const vm = useContabilDaEmpresa(nome, codigo);
  const { aviso } = useRetorno();
  const idDin = useId();
  const idRaz = useId();
  const razoes = Object.entries(vm.razoes).sort(([a], [b]) => a.localeCompare(b));
  // os razões que a Tarefa precisa, pelo dinâmico (Vitor, 19/10/2026: "especifique quais razões você quer"): as contas que as
  // etapas usam, importadas ou não; depois, os importados que nenhuma etapa pediu
  const pedidos = vm.dinamico ? cl.razoesPedidos(vm.dinamico.d) : [];
  const linhas = [
    ...pedidos.map(p => ({ conta: p.codigo, nome: p.nome, tipo: p.tipo as cl.TipoDoRazao | null, r: vm.razoes[p.codigo] || null })),
    ...razoes.filter(([conta]) => !pedidos.some(p => p.codigo === conta))
      .map(([conta, r]) => ({ conta, nome: vm.dinamico?.d.linhas.find(l => l.codigo === conta)?.descricao || '', tipo: vm.tipos[conta] ?? null, r })),
  ];
  const faltam = pedidos.filter(p => !vm.razoes[p.codigo]).length;
  // o razão importado sem algum mês do período em que a conta mexeu (Vitor, 19/10/2026: "às vezes pode faltar alguns meses")
  const mesesQueFaltam = (conta: string, r: { razao: { lancamentos: { data: string }[] } } | null) =>
    r && vm.dinamico && meses.length ? cl.mesesFaltandoNoRazao(vm.dinamico.d, conta, r.razao, meses) : [];
  const incompletos = linhas.filter(x => mesesQueFaltam(x.conta, x.r).length).length;
  const rotuloDoMes = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);
  // só o Diário: os razões que faltam saem dele, uma vez por diário (a conta sem lançamento nele continua faltando)
  const semRazao = pedidos.filter(p => !vm.razoes[p.codigo]).map(p => p.codigo);
  const chaveDoDiario = soDiario && vm.diario && semRazao.length ? vm.diario.arquivo + '|' + semRazao.join(',') : '';
  const jaPreencheu = useRef('');
  useEffect(() => {
    if (!chaveDoDiario || jaPreencheu.current === chaveDoDiario) return;
    jaPreencheu.current = chaveDoDiario;
    vm.preencherDoDiario(chaveDoDiario.split('|')[1].split(','));
  }, [chaveDoDiario, vm]);

  async function importarDinamico(f: File | null) {
    if (!f) return;
    try {
      const d = await vm.importarDinamico(f);
      aviso({ tom: 'ok', titulo: 'Balancete dinâmico importado', texto: f.name + ' · ' + d.meses.length + ' meses' });
    } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
  }
  // o razão do robô nos razões: preenche de uma vez as contas que as etapas pedem (a mais recente vence)
  function diarioNosRazoes() {
    if (!vm.diario) { aviso({ tom: 'erro', titulo: 'Sem o razão do robô', texto: 'Espere o robô terminar os meses (bloco Razões do Alterdata, acima).' }); return; }
    if (!pedidos.length) { aviso({ tom: 'erro', titulo: 'Sem as contas dos razões', texto: 'Importe o balancete dinâmico para saber quais razões a Tarefa precisa.' }); return; }
    const r = vm.preencherDoDiario(pedidos.map(p => p.codigo));
    aviso({
      tom: r.contas.length ? 'ok' : 'erro', titulo: 'Razões pelo robô',
      texto: r.contas.length + (r.contas.length === 1 ? ' razão preenchido' : ' razões preenchidos') + (r.semLancamento.length ? ' · sem lançamento no período: ' + r.semLancamento.join(', ') : ''),
    });
  }

  async function importarRazoes(fs: File[]) {
    if (!fs.length) return;
    const r = await vm.importarRazoes(fs);
    const partes = [
      r.contas.length ? r.contas.length + (r.contas.length === 1 ? ' razão importado' : ' razões importados') : '',
      r.semConta.length ? 'sem o código da conta: ' + r.semConta.join(', ') : '',
      ...r.erros,
    ].filter(Boolean);
    aviso({ tom: r.erros.length || r.semConta.length ? 'erro' : 'ok', titulo: 'Razões', texto: partes.join(' · ') });
  }

  return (
    <div className="imp-lista imp-contabil">
      <div className={'imp-bloco' + (vm.dinamico ? ' imp-ok' : '')}>
        <div className="imp-linha">
          <span className="imp-ico"><Icone nome="scale" /></span>
          <div className="imp-txt">
            <span><b>Balancete dinâmico</b>{vm.dinamico && <span className="imp-conta">{vm.dinamico.nome}</span>}</span>
          </div>
          <div className="imp-resumo">{vm.dinamico
            ? <div><span>{vm.dinamico.d.meses.length} {vm.dinamico.d.meses.length === 1 ? 'mês' : 'meses'} · {vm.dinamico.d.linhas.length.toLocaleString('pt-BR')} contas</span></div>
            : blocoDoRobo ? <div><span>Entra sozinho quando o robô terminar os meses</span></div> : null}</div>
          <div className="imp-grupos">
            <div className="imp-grupo" aria-label="Balancete dinâmico">
              <span className="imp-rotulo">Dinâmico</span>
              {vm.temDinamicoProprio ? (
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.tirarDinamico} title="Importado. Clique para tirar (para importar o corrigido)." aria-label="Tirar o balancete dinâmico">
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
              ) : (
                <>
                  <label htmlFor={idDin} className="icon-btn icon-btn-sm imp-btn" title={vm.dinamico ? 'Importar o balancete dinâmico de novo (o do Clientes está valendo)' : 'Importar o balancete dinâmico (XLS do Alterdata)'} aria-label="Importar o balancete dinâmico"><Icone nome="upload" /></label>
                  <CampoArquivo semCaixa id={idDin} aceitar=".xls,.xlsx,.ods" onEscolher={f => { void importarDinamico(f); }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* os razões do Alterdata pelo robô (Vitor, 06/11/2026: no lugar do Diário em PDF): quem desenha é a Importação da
          Tarefa (o robô fica nos dados dela); o resumo do que chegou fica aqui embaixo */}
      {blocoDoRobo}
      {vm.diario && (
        <div className="imp-bloco imp-ok">
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="arquivo" /></span>
            <div className="imp-txt">
              <span><b>Razão de todas as contas</b><span className="imp-conta">{vm.diario.arquivo}</span></span>
            </div>
            <div className="imp-resumo">
              <div>
                <span>{vm.diario.lido.periodo ? rotuloDoMes(vm.diario.lido.periodo.inicio) + ' a ' + rotuloDoMes(vm.diario.lido.periodo.fim) + ' · ' : ''}{vm.diario.lido.lancamentos.length.toLocaleString('pt-BR')} lançamentos · {Object.keys(t.contasDoDiario(vm.diario.lido.lancamentos)).length} contas</span>
                {soDiario && pedidos.length > 0 && <span>{faltam
                  ? <span className="ext-neg" title="Contas que as etapas usam sem lançamento no período: continuam sem razão">{faltam} de {pedidos.length} razões sem lançamento</span>
                  : <span title="Os razões das contas que as etapas usam saíram do razão do robô">{pedidos.length} razões das etapas preenchidos</span>}</span>}
              </div>
            </div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label="Razão de todas as contas">
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.tirarDiario} title={ROBO_NAS_ETAPAS ? 'Clique para tirar (o robô lê de novo os meses prontos).' : 'Clique para tirar.'} aria-label="Tirar o razão de todas as contas">
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* sem o robô nas etapas, os razões voltam a ser importados aqui */}
      {(!soDiario || !ROBO_NAS_ETAPAS) && <div className={'imp-bloco' + (pedidos.length ? (faltam || incompletos ? '' : ' imp-ok') : razoes.length && !incompletos ? ' imp-ok' : '')}>
        <div className="imp-linha">
          <span className="imp-ico"><Icone nome="arquivo" /></span>
          <div className="imp-txt">
            <span><b>Razões das contas</b></span>
          </div>
          <div className="imp-resumo"><div><span>{pedidos.length ? (pedidos.length - faltam) + ' de ' + pedidos.length + ' importados' + (faltam ? ' · falta' + (faltam === 1 ? '' : 'm') + ' ' + faltam : '') + (incompletos ? ' · ' + incompletos + (incompletos === 1 ? ' com mês faltando' : ' com meses faltando') : '')
            : razoes.length ? razoes.length + (razoes.length === 1 ? ' razão' : ' razões') : vm.dinamico ? 'Nenhuma conta das etapas com saldo no dinâmico' : 'Importe o dinâmico para ver quais razões a Tarefa precisa'}</span></div></div>
          <div className="imp-grupos">
            <div className="imp-grupo" aria-label="Razões das contas">
              <span className="imp-rotulo">Razões</span>
              <BotaoDiario onClick={diarioNosRazoes} titulo="Preencher os razões das contas que as etapas usam, pelo razão que o robô puxou" />
              <label htmlFor={idRaz} className="icon-btn icon-btn-sm imp-btn" title="Importar os razões (XLS da conciliação do Alterdata; vários de uma vez)" aria-label="Importar os razões"><Icone nome="upload" /></label>
              <CampoArquivo semCaixa multiplo id={idRaz} aceitar=".xls,.xlsx,.ods" onEscolherVarios={fs => { void importarRazoes(fs); }} />
            </div>
          </div>
        </div>
        {linhas.length > 0 && (
          <div className="table-wrap" style={{ margin: '0 16px 16px' }}>
            <table className="table-compact">
              <thead><tr><th>Conta</th><th>Nome no dinâmico</th><th>Vai para</th><th>Arquivo</th><th className="num">Lançamentos</th><th /></tr></thead>
              <tbody>
                {linhas.map(({ conta, nome, tipo, r }) => (
                  <tr key={conta}>
                    <td>{conta}</td>
                    <td className="wrap">{nome || <span className="hint">{vm.dinamico ? 'fora do dinâmico' : 'sem o dinâmico'}</span>}</td>
                    <td>{tipo ? <span className="badge badge-ok">{cl.NOME_DO_TIPO_DO_RAZAO[tipo]}</span> : <span className="badge badge-neutral" title="Nenhuma etapa usa esta conta">Nenhuma etapa</span>}</td>
                    <td className="hint">
                      {r ? r.arquivo : <span className="badge badge-warn" title={'Exporte o razão da conta ' + conta + ' no Alterdata (XLS da conciliação) e importe aqui'}>Falta importar</span>}
                      {/* o mês do período em que a conta mexeu no dinâmico e o razão não trouxe: exportar o razão com o período todo */}
                      {mesesQueFaltam(conta, r).length > 0 && (
                        <span className="badge badge-warn" style={{ marginLeft: 6 }} title="A conta mexeu nestes meses no balancete dinâmico e o razão não trouxe lançamento: exporte o razão com o período todo">
                          Falta{mesesQueFaltam(conta, r).length > 1 ? 'm' : ''} {mesesQueFaltam(conta, r).map(rotuloDoMes).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="num">{r ? r.razao.lancamentos.length : '—'}</td>
                    <td className="num">
                      {r && <BotaoIcone icone="x" pequeno titulo={'Tirar o razão da conta ' + conta} onClick={() => vm.tirarRazao(conta)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  );
}
