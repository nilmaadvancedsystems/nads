// ViewModel do "Buscar no e-mail" (Vitor, 13/10/2026), separado da janela (JanelaBuscarNoEmail) porque a tela não fala
// com o repositório (a regra do lint): os filtros, a busca no Gmail pelo robô e o anexo que vem e entra como do computador.
import type { creditor } from '@nads/core';
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

export type VmBuscarNoEmail = ReturnType<typeof useBuscarNoEmail>;
