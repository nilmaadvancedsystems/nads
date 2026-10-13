// "Buscar no e-mail" (Vitor, 13/10/2026): no menu do mês sem extrato, ao lado do "Buscar no Drive". A janela tem os filtros
// (o remetente e o período recebido); a pessoa clica em Buscar e o robô procura no Gmail do escritório os e-mails com
// anexo; clicou num anexo, ele vem e entra como se fosse do computador (o mesmo caminho: importa, o sem movimento e o
// Drive). Só com o login do Entregas. ViewModel (useBuscarNoEmail) e View (JanelaBuscarNoEmail) juntos: são só desta tela.
import type { creditor } from '@nads/core';
import { classeDaJanela, Icone, LogoGmail } from '@nads/ui';
import { useState } from 'react';
import { useDrive } from '../../dados/repo';

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** O período padrão: do 1º dia do mês do extrato até o fim do mês seguinte (quando o extrato costuma chegar), não depois de hoje. */
function periodoPadrao(mes: string): { de: string; ate: string } {
  const [a, m] = mes.split('-').map(Number);
  const prox = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
  const fim = prox.a + '-' + String(prox.m).padStart(2, '0') + '-' + String(ultimoDia(prox.a, prox.m)).padStart(2, '0');
  const hoje = new Date().toISOString().slice(0, 10);
  return { de: mes + '-01', ate: fim < hoje ? fim : hoje };
}

interface Linha { id: string; nome: string }
interface Estado {
  linha: Linha; mes: string; remetente: string; de: string; ate: string;
  buscando: boolean; passo: string; erro: string; resultados: creditor.AnexoDoEmail[] | null; trazendo: string | null;
}

export function useBuscarNoEmail(importar: (linha: Linha, fs: File[]) => void, pedirLogin: (depois: () => void) => void) {
  const { drive, acesso } = useDrive();
  const [e, setE] = useState<Estado | null>(null);
  const muda = (m: Partial<Estado>) => setE(x => (x ? { ...x, ...m } : x));
  const existe = !!drive.buscarNoEmail && !!drive.trazerDoEmail;

  function abrir(linha: Linha, mes: string) {
    const ir = () => setE({ linha, mes, remetente: '', ...periodoPadrao(mes), buscando: false, passo: '', erro: '', resultados: null, trazendo: null });
    if (!acesso.entrou && !drive.exemplos) { pedirLogin(ir); return; }
    ir();
  }

  async function buscar() {
    if (!e || !drive.buscarNoEmail) return;
    if (!e.remetente.trim() && !(e.de && e.ate)) { muda({ erro: 'Informe o remetente ou o período.' }); return; }
    if (e.de && e.ate && e.de > e.ate) { muda({ erro: 'O começo do período é depois do fim.' }); return; }
    muda({ buscando: true, erro: '', resultados: null, passo: '' });
    try {
      const r = await drive.buscarNoEmail({ remetente: e.remetente, de: e.de, ate: e.ate }, passo => muda({ passo }));
      muda({ buscando: false, resultados: r, passo: '' });
    } catch (err) { muda({ buscando: false, erro: mensagemDeErro(err), passo: '' }); }
  }

  async function trazer(a: creditor.AnexoDoEmail) {
    if (!e || !drive.trazerDoEmail) return;
    muda({ trazendo: a.anexoId, erro: '' });
    try {
      const conteudo = await drive.trazerDoEmail(a, passo => muda({ passo }));
      const linha = e.linha;
      setE(null);
      importar(linha, [new File([conteudo], a.nome)]);
    } catch (err) { muda({ trazendo: null, erro: mensagemDeErro(err), passo: '' }); }
  }

  return { existe, estado: e, abrir, fechar: () => setE(null), muda, buscar: () => { void buscar(); }, trazer: (a: creditor.AnexoDoEmail) => { void trazer(a); } };
}

type Vm = ReturnType<typeof useBuscarNoEmail>;
const rotuloDoMes = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
const dataBR = (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

export function JanelaBuscarNoEmail({ vm }: { vm: Vm }) {
  const e = vm.estado;
  if (!e) return null;
  const ocupado = e.buscando || !!e.trazendo;
  return (
    <div className="modal-overlay" role="presentation" onClick={() => { if (!ocupado) vm.fechar(); }}>
      <div className={classeDaJanela({})} role="dialog" aria-modal="true" aria-labelledby="tituloEmail" style={{ width: 'min(760px, 100%)' }} onClick={ev => ev.stopPropagation()}>
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" disabled={ocupado} onClick={vm.fechar}><Icone nome="x" /></button>
        <h3 id="tituloEmail">Buscar no e-mail · {e.linha.nome} · {rotuloDoMes(e.mes)}</h3>
        <form style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 12 }} onSubmit={ev => { ev.preventDefault(); vm.buscar(); }}>
          <label className="field" style={{ margin: 0, flex: '1 1 240px' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Remetente</span>
            <input type="text" placeholder="E-mail ou nome de quem mandou" value={e.remetente} disabled={ocupado} onChange={ev => vm.muda({ remetente: ev.target.value })} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Recebido de</span>
            <input type="date" value={e.de} disabled={ocupado} onChange={ev => vm.muda({ de: ev.target.value })} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>até</span>
            <input type="date" value={e.ate} disabled={ocupado} onChange={ev => vm.muda({ ate: ev.target.value })} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={ocupado}>
            {e.buscando ? <><span className="btn-spinner" />Buscando</> : <><Icone nome="search" />Buscar</>}
          </button>
        </form>
        {e.passo && <p className="hint" style={{ marginTop: 8 }}>{e.passo}…</p>}
        {e.erro && <p className="hint ext-neg" style={{ marginTop: 8 }}>{e.erro}</p>}
        {e.resultados && (e.resultados.length === 0
          ? <p className="hint" style={{ marginTop: 12 }}>Nenhum e-mail com anexo para esses filtros.</p>
          : (
            <div className="table-wrap" style={{ marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
              <table className="table-compact">
                <thead><tr><th>Recebido</th><th>Remetente</th><th>Anexo</th><th /></tr></thead>
                <tbody>
                  {e.resultados.map(a => (
                    <tr key={a.mensagemId + a.anexoId}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dataBR(a.em)}</td>
                      <td className="wrap" title={a.de}>{a.de.replace(/<.*>/, '').replace(/"/g, '').trim() || a.de}<span className="hint" style={{ display: 'block' }}>{a.assunto}</span></td>
                      <td className="wrap">{a.nome}<span className="hint" style={{ display: 'block' }}>{tamanho(a.tamanho)}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn" disabled={ocupado} onClick={() => vm.trazer(a)} title={'Importar ' + a.nome + ' no ' + e.linha.nome}>
                          {e.trazendo === a.anexoId ? <><span className="btn-spinner" />Trazendo</> : <><LogoGmail />Importar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
