// O acompanhamento do arquivador novo no banco do Entregas (só leitura; as regras deixam só o admin): robo/arquivadorNovo
// (o campo painel, que o robô do PC regrava no máximo a cada 45 s) ouvido enquanto a página está aberta, e o histórico de
// um dia (robo/arquivadorNovo/dias, as partes do dia) lido quando a aba Arquivados pede. O de hoje é relido quando o painel
// diz que o dia cresceu (no máximo a cada 2 min, para não baixar as partes a cada gravação do robô).
import { entregas as e } from '@nads/core';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { bancoDoEntregas } from '../../tarefas/dados/entregas.firestore';
import { hojeLocal, type DiaDoArquivador, type DocsDoArquivadorNovo, type RepoArquivadorNovo } from './arquivadorNovo';

const RELER_HOJE_MS = 2 * 60 * 1000;
const negado = (err: unknown) => /permission|insufficient/i.test(err instanceof Error ? err.message : String(err));

export function criarArquivadorNovoFirestore(): RepoArquivadorNovo {
  const db = bancoDoEntregas();
  let docs: DocsDoArquivadorNovo = { carregado: false, semPermissao: false, painel: null };
  const dias = new Map<string, DiaDoArquivador & { lidoEm: number; itensNoPainel: number; lendo: boolean }>();
  let ver = 0;
  let quantos = 0;
  let parar: (() => void) | null = null;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  async function lerDia(dia: string) {
    const atual = dias.get(dia);
    if (!atual || atual.lendo) return;
    atual.lendo = true;
    try {
      const snap = await getDocs(query(collection(db, 'robo', 'arquivadorNovo', 'dias'), where('dia', '==', dia)));
      const partes = snap.docs.map(d => e.lerParteDoDia(d.data())).sort((a, b) => a.parte - b.parte);
      const itens = partes.flatMap(p => p.itens).sort((a, b) => b.em.localeCompare(a.em));
      dias.set(dia, { ...atual, carregado: true, erro: '', itens, lidoEm: Date.now(), lendo: false });
    } catch (err) {
      dias.set(dia, { ...atual, carregado: true, erro: negado(err) ? 'Sem acesso ao histórico do arquivador.' : 'Não consegui ler o histórico do dia: ' + (err instanceof Error ? err.message : String(err)), lidoEm: Date.now(), lendo: false });
    }
    mudou();
  }

  return {
    exemplos: false,
    docs: () => docs,
    acompanhar() {
      quantos++;
      if (!parar) {
        parar = onSnapshot(doc(db, 'robo', 'arquivadorNovo'), s => {
          docs = { carregado: true, semPermissao: false, painel: e.lerPainelDoArquivador(s.exists() ? s.data() : null) };
          // o histórico de hoje cresceu: relê (com folga)
          const h = docs.painel?.historico;
          const hoje = h?.dia ? dias.get(h.dia) : undefined;
          if (h && hoje && h.itens !== hoje.itensNoPainel && Date.now() - hoje.lidoEm > RELER_HOJE_MS) { hoje.itensNoPainel = h.itens; void lerDia(h.dia); }
          mudou();
        }, err => { docs = { carregado: true, semPermissao: negado(err), painel: docs.painel }; mudou(); });
      }
      return () => {
        quantos--;
        if (!quantos && parar) { parar(); parar = null; }
      };
    },
    dia(dia) {
      let d = dias.get(dia);
      if (!d) {
        d = { dia, carregado: false, erro: '', itens: [], lidoEm: 0, itensNoPainel: dia === hojeLocal() ? docs.painel?.historico.itens ?? 0 : 0, lendo: false };
        dias.set(dia, d);
        void lerDia(dia);
      }
      return d;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
