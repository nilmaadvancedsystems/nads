// A página Alterdata da empresa aberta (Vitor, 04/11/2026: "quero criar um robo que puxa balancete e planilha de conta e
// upa no nads"): o mês e o Pedir ao robô na barra; o aviso quando o Contábil do servidor não está pronto; a tabela dos
// pedidos da empresa com a situação ao vivo e o Baixar do balancete (.xlsx) e do razão de todas as contas (.csv). Só as
// peças do catálogo (SeletorMes, BotaoAcao, Alerta na linha, Tabela padrão, selos, Vazio, Esqueleto, Andamento do robô).
// 05/11/2026 (Vitor: "quero que no nads tenha um feedback do que o robo ta fazendo, onde ele ta clicando com uma barra de
// progresso"): enquanto o robô trabalha num pedido desta empresa, o Andamento do robô em cima da tabela.
import { Alerta, BotaoAcao, Esqueleto, Icone, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { useEffect, useState } from 'react';
import { tarefas as t } from '@nads/core';
import { RELATORIOS_DO_ALTERDATA, type PedidoMensalDoAlterdata } from '../../../dados/alterdata';
import { situacaoDo, useAlterdataDaEmpresa, type SituacaoDoPedido, type VmAlterdataDaEmpresa } from './useAlterdataDaEmpresa';

// os selos como os do FGTS: verde pronto, laranja andando, vermelho parado, cinza o resto
const SELO: Record<SituacaoDoPedido, { classe: string; rotulo: string }> = {
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila' },
  trabalhando: { classe: 'badge badge-warn', rotulo: 'Com o robô' },
  pronto: { classe: 'badge badge-ok', rotulo: 'Pronto' },
  parcial: { classe: 'badge badge-warn', rotulo: 'Saiu um só' },
  erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
  cancelado: { classe: 'badge badge-neutral', rotulo: 'Cancelado' },
};
const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const tamanho = (n: number) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB');

/** o que se diz embaixo do selo: a posição na fila, o último passo do robô ou o motivo do erro */
function detalhe(vm: VmAlterdataDaEmpresa, p: PedidoMensalDoAlterdata): string {
  const s = situacaoDo(p);
  if (s === 'fila') { const n = vm.posicao(p); return n > 1 ? 'Esperando a vez: ' + n + 'º na fila' : 'É o próximo'; }
  if (s === 'trabalhando') return p.passos.length ? p.passos[p.passos.length - 1].nome : 'Começando…';
  if (s === 'erro' || s === 'parcial') return p.erro;
  if (p.mesmoQue) return 'O mesmo mês já tinha saído: são os mesmos arquivos';
  return '';
}

// as etapas grandes do pedido mensal, para a lista que vai ficando verde
const ETAPAS = ['O robô pegou o pedido', 'O balancete no Alterdata', 'O razão de todas as contas no Alterdata', 'Os números para dentro do nads'] as const;
function etapaAtual(p: PedidoMensalDoAlterdata): number {
  const nomes = p.passos.map(x => x.nome);
  if (nomes.some(n => n.startsWith('lendo os números'))) return 3;
  if (nomes.some(n => n.startsWith('razão'))) return 2;
  if (nomes.some(n => n.startsWith('balancete'))) return 1;
  return 0;
}
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const segundos = (ms: number) => (ms < 60_000 ? Math.max(1, Math.round(ms / 1000)) + ' s' : Math.floor(ms / 60_000) + ' min ' + String(Math.round(ms % 60_000 / 1000)).padStart(2, '0') + ' s');

/** O Andamento do robô (a peça sieg-andamento do catálogo, no lugar, sem flutuar): a porcentagem, a barra, o que está
 *  fazendo e onde clicou, e as etapas. */
function AndamentoDoPedido({ p }: { p: PedidoMensalDoAlterdata }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const a = p.andamento;
  const pct = a ? a.pct : 0;
  const passou = p.inicioEm ? Math.max(0, agora - Date.parse(p.inicioEm)) : 0;
  const falta = pct >= 8 && pct < 100 ? passou * (100 - pct) / pct : 0;
  const atual = etapaAtual(p);
  const etapa = a && a.etapa && a.etapa !== 'começando' ? maiuscula(a.etapa) : 'Começando…';
  return (
    <div className="card gmail-andamento sieg-andamento" role="status" aria-live="polite">
      <div className="fgts-resumo-topo">
        <div className="fgts-resumo-titulo">
          <h3>Gerando {t.rotuloCompetencia(p.competencia)} no Alterdata</h3>
          <span className="hint">{passou ? segundos(passou) : 'agora'}{falta ? ' · falta uns ' + segundos(falta) : ''}</span>
        </div>
        <b className="sieg-andamento-pct num">{pct}%</b>
      </div>
      <span className="tarefas-barra fgts-barra andando"><span style={{ width: pct + '%' }} /></span>
      <span className="fgts-robo-linha"><span className="bolinha-sit em-andamento" aria-hidden="true" />{etapa}</span>
      {a?.clique && <span className="hint">{/^(subindo|lendo)/.test(a.clique) ? maiuscula(a.clique) : 'Clicando em: ' + a.clique}</span>}
      <ol className="fgts-passos sieg-andamento-passos">
        {ETAPAS.map((nome, i) => (
          <li key={nome} className={i < atual ? 'feito' : i === atual ? 'atual' : undefined}>
            <span className="fgts-passo-marca" aria-hidden="true">{i < atual ? <Icone nome="check" width={13} height={13} /> : i + 1}</span>
            <div>{i === atual ? <b>{nome}</b> : nome}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** embaixo do Baixar: quantas contas (e lançamentos) o robô leu para dentro do nads */
function lidos(a: { importado?: { contas: number; lancamentos?: number; erro?: string } }): string {
  const i = a.importado;
  if (!i) return '';
  if (i.erro) return 'Os números não entraram';
  const n = (x: number) => x.toLocaleString('pt-BR');
  return i.lancamentos != null ? n(i.lancamentos) + ' lançamentos em ' + n(i.contas) + ' contas' : n(i.contas) + ' contas no nads';
}

export function AlterdataDaEmpresa() {
  const vm = useAlterdataDaEmpresa();
  useCarregando(vm.carregando);
  if (!vm.empresa) return <div className="card fc-cartao"><Vazio icone="briefcase" titulo="Empresa não encontrada" /></div>;
  const andando = vm.andandoNoMes;
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <BotaoAcao onClick={() => void vm.pedir()} carregando={vm.fazendo === 'pedir'} textoCarregando="Pedindo…" disabled={!!andando}
          title={andando ? vm.rotuloCompetencia + ' já está na fila do robô' : 'O robô gera o balancete e o razão de todas as contas no Alterdata'}>
          <Icone nome="download" width={16} height={16} />{andando ? 'Já está na fila' : 'Pedir balancete e razão'}
        </BotaoAcao>
      </div>
      {vm.robo.carregado && !vm.robo.pronto && (
        <Alerta naLinha titulo="O robô não está com o Contábil aberto" texto={vm.robo.motivo + ' Os pedidos esperam na fila até alguém entrar no Contábil do NILMA-SERVER.'} />
      )}
      {vm.lista.filter(p => p.status === 'trabalhando').map(p => <AndamentoDoPedido key={p.id} p={p} />)}
      <section className="card fc-cartao">
        <header className="fc-cartao-topo">
          <h3 className="fc-cartao-titulo">Pedidos ao robô do Alterdata</h3>
          <span className="fc-contagem">{vm.lista.length === 1 ? '1 pedido' : vm.lista.length + ' pedidos'}</span>
        </header>
        {vm.carregando ? <Esqueleto linhas={4} /> : !vm.lista.length ? (
          <Vazio icone="fileText" titulo="Nenhum pedido ainda" texto="Escolha o mês e clique em Pedir: o robô gera no Alterdata o balancete e o razão de todas as contas, e os dois ficam aqui para baixar." />
        ) : (
          <div className="table-wrap fc-tabela">
            <table className="table-compact">
              <thead>
                <tr><th>Mês</th><th>Situação</th><th>Pedido por</th>{RELATORIOS_DO_ALTERDATA.map(r => <th key={r.id}>{r.rotulo}</th>)}<th aria-label="Ações" /></tr>
              </thead>
              <tbody>
                {vm.lista.map(p => {
                  const s = situacaoDo(p);
                  const d = detalhe(vm, p);
                  return (
                    <tr key={p.id}>
                      <td><b>{t.rotuloCompetencia(p.competencia)}</b></td>
                      <td>
                        <span className={SELO[s].classe}>{SELO[s].rotulo}</span>
                        {d && <div className="fraco">{d}</div>}
                      </td>
                      <td>{p.criadoPor}<div className="fraco">{hora(p.criadoEm)}</div></td>
                      {RELATORIOS_DO_ALTERDATA.map(r => {
                        const a = p.arquivos[r.id];
                        if (!a) return <td key={r.id} className="fraco">—</td>;
                        if (a.status === 'erro') return <td key={r.id}><span className="fraco" title={a.erro}>Não saiu</span></td>;
                        return (
                          <td key={r.id}>
                            <BotaoAcao className="btn btn-outline btn-sm" onClick={() => void vm.baixar(p, r.id)} carregando={vm.fazendo === 'baixar:' + p.id + ':' + r.id} textoCarregando="Baixando…" title={a.nome}>
                              <Icone nome="download" width={14} height={14} />Baixar <span className="fraco">{tamanho(a.tamanho)}</span>
                            </BotaoAcao>
                            {lidos(a) && <div className="fraco" title={a.importado?.erro}>{lidos(a)}</div>}
                          </td>
                        );
                      })}
                      <td>
                        {(s === 'fila' || s === 'trabalhando') && (
                          <BotaoAcao className="btn btn-ghost btn-sm" onClick={() => void vm.cancelar(p)} carregando={vm.fazendo === 'cancelar:' + p.id} textoCarregando="Cancelando…">Cancelar</BotaoAcao>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
