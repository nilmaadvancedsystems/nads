// "Buscar no e-mail" (Vitor, 13/10/2026): no menu do mês sem extrato, ao lado do "Buscar no Drive". A janela tem os filtros
// (o remetente e o período recebido); a pessoa clica em Buscar e o robô procura no Gmail do escritório os e-mails com
// anexo; clicou num anexo, ele vem e entra como se fosse do computador (o mesmo caminho: importa, o sem movimento e o
// Drive). Só com o login do Entregas. O remetente vem sugerido (os e-mails do cadastro do cliente no Entregas e os que a
// pessoa já usou aqui) e o período tem os atalhos do mês (Vitor, 13/10/2026: "puxa do e-mail para ajudar a preencher" e
// as datas no campo do sistema). ViewModel (useBuscarNoEmail) e View (JanelaBuscarNoEmail) juntos: são só desta tela.
import type { creditor } from '@nads/core';
import { CampoData, classeDaJanela, Icone, LogoGmail, Segmentado } from '@nads/ui';
import { useState } from 'react';
import { useDrive } from '../../dados/repo';

const mensagemDeErro = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const br = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const iso = (d: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const mesSeguinte = (mes: string) => { const [a, m] = mes.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
const fimDoMes = (mes: string) => { const [a, m] = mes.split('-').map(Number); return mes + '-' + String(ultimoDia(a, m)).padStart(2, '0'); };

/** Os atalhos do período: o mês do extrato, o mês seguinte (quando o extrato costuma chegar) ou os dois. */
export type Atalho = 'mes' | 'seguinte' | 'dois' | 'outro';
function periodoDoAtalho(mes: string, a: Atalho): { de: string; ate: string } {
  const prox = mesSeguinte(mes);
  const p = a === 'mes' ? { de: mes + '-01', ate: fimDoMes(mes) } : a === 'seguinte' ? { de: prox + '-01', ate: fimDoMes(prox) } : { de: mes + '-01', ate: fimDoMes(prox) };
  const hoje = new Date().toISOString().slice(0, 10);
  return { de: br(p.de), ate: br(p.ate < hoje ? p.ate : hoje) };
}

// os remetentes que a pessoa já usou aqui (conveniência deste navegador; sem ela, só as sugestões do cadastro)
const CHAVE = 'nads-remetentes-email';
const lembrados = (): string[] => { try { const v = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } };
const lembrar = (r: string) => { try { localStorage.setItem(CHAVE, JSON.stringify([r, ...lembrados().filter(x => x !== r)].slice(0, 8))); } catch { /* sem armazenamento: fica sem lembrar */ } };

interface Linha { id: string; nome: string }
interface Estado {
  linha: Linha; mes: string; remetente: string; de: string; ate: string; atalho: Atalho; sugestoes: string[];
  buscando: boolean; passo: string; erro: string; resultados: creditor.AnexoDoEmail[] | null; trazendo: string | null;
}

export function useBuscarNoEmail(importar: (linha: Linha, fs: File[]) => void, pedirLogin: (depois: () => void) => void, codigo: number | null) {
  const { drive, acesso } = useDrive();
  const [e, setE] = useState<Estado | null>(null);
  const muda = (m: Partial<Estado>) => setE(x => (x ? { ...x, ...m } : x));
  const existe = !!drive.buscarNoEmail && !!drive.trazerDoEmail;

  function abrir(linha: Linha, mes: string) {
    const ir = () => {
      const usados = lembrados();
      setE({ linha, mes, remetente: usados[0] || '', ...periodoDoAtalho(mes, 'dois'), atalho: 'dois', sugestoes: usados, buscando: false, passo: '', erro: '', resultados: null, trazendo: null });
      // os e-mails do cliente no cadastro do Entregas entram nas sugestões (e no campo, se ainda estiver vazio)
      if (codigo != null && drive.contatoDoCliente) {
        drive.contatoDoCliente(codigo).then(c => {
          const doCliente = (c?.emails || []).filter(Boolean);
          if (!doCliente.length) return;
          setE(x => (x ? { ...x, remetente: x.remetente || doCliente[0], sugestoes: [...new Set([...doCliente, ...x.sugestoes])].slice(0, 10) } : x));
        }, () => { /* sem o cadastro agora: ficam as lembradas */ });
      }
    };
    if (!acesso.entrou && !drive.exemplos) { pedirLogin(ir); return; }
    ir();
  }

  async function buscar() {
    if (!e || !drive.buscarNoEmail) return;
    const de = iso(e.de), ate = iso(e.ate);
    if ((e.de && !de) || (e.ate && !ate)) { muda({ erro: 'A data precisa ser dd/mm/aaaa.' }); return; }
    if (!e.remetente.trim() && !(de && ate)) { muda({ erro: 'Informe o remetente ou o período.' }); return; }
    if (de && ate && de > ate) { muda({ erro: 'O começo do período é depois do fim.' }); return; }
    if (e.remetente.trim()) lembrar(e.remetente.trim());
    muda({ buscando: true, erro: '', resultados: null, passo: '' });
    try {
      const r = await drive.buscarNoEmail({ remetente: e.remetente, de, ate }, passo => muda({ passo }));
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

  return {
    existe, estado: e, abrir, fechar: () => setE(null), muda,
    atalho: (a: Atalho) => { if (e && a !== 'outro') muda({ atalho: a, ...periodoDoAtalho(e.mes, a) }); },
    buscar: () => { void buscar(); }, trazer: (a: creditor.AnexoDoEmail) => { void trazer(a); },
  };
}

type Vm = ReturnType<typeof useBuscarNoEmail>;
const rotuloDoMes = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
const dataBR = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '');
const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const ROTULO: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 };

export function JanelaBuscarNoEmail({ vm }: { vm: Vm }) {
  const e = vm.estado;
  if (!e) return null;
  const ocupado = e.buscando || !!e.trazendo;
  return (
    <div className="modal-overlay" role="presentation" onClick={() => { if (!ocupado) vm.fechar(); }}>
      <div className={classeDaJanela({})} role="dialog" aria-modal="true" aria-labelledby="tituloEmail" style={{ width: 'min(760px, 100%)', textAlign: 'left' }} onClick={ev => ev.stopPropagation()}>
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" disabled={ocupado} onClick={vm.fechar}><Icone nome="x" /></button>
        <h3 id="tituloEmail">Buscar no e-mail · {e.linha.nome} · {rotuloDoMes(e.mes)}</h3>
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }} onSubmit={ev => { ev.preventDefault(); vm.buscar(); }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="fRemetente" style={ROTULO}>Remetente</label>
            <input id="fRemetente" type="text" placeholder="E-mail ou nome de quem mandou" value={e.remetente} disabled={ocupado} style={{ width: '100%' }}
              onChange={ev => vm.muda({ remetente: ev.target.value })} />
            {/* as sugestões: os e-mails do cadastro do cliente e os já usados aqui; clicou, vai para o campo */}
            {e.sugestoes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {e.sugestoes.map(s => (
                  <button key={s} type="button" className={'badge ' + (s === e.remetente ? 'badge-ok' : 'badge-neutral')} style={{ cursor: 'pointer' }} disabled={ocupado}
                    onClick={() => vm.muda({ remetente: s })} title={'Usar ' + s}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <span style={ROTULO}>Recebido</span>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Segmentado<Atalho> valor={e.atalho} onMudar={vm.atalho} opcoes={[
                { valor: 'mes', rotulo: 'Mês do extrato' }, { valor: 'seguinte', rotulo: 'Mês seguinte' }, { valor: 'dois', rotulo: 'Os dois' }, { valor: 'outro', rotulo: 'Outro', oculta: e.atalho !== 'outro' },
              ]} />
              <span style={{ width: 118 }}><CampoData valor={e.de} rotulo="Recebido de" onMudar={v => vm.muda({ de: v, atalho: 'outro' })} onEnter={vm.buscar} /></span>
              <span className="hint">até</span>
              <span style={{ width: 118 }}><CampoData valor={e.ate} rotulo="Recebido até" onMudar={v => vm.muda({ ate: v, atalho: 'outro' })} onEnter={vm.buscar} /></span>
              <span style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={ocupado}>
                {e.buscando ? <><span className="btn-spinner" />Buscando</> : <><Icone nome="search" />Buscar</>}
              </button>
            </div>
          </div>
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
