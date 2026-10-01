// A saúde do robô no banco do Entregas (só leitura; as regras deixam admin e contábil lerem robo/* e driveIndice):
//   robo/estado, robo/arquivador, robo/uso, driveIndice/raiz e os pedidos com erro de solicitacoesEmail.
// Lê a cada 30 s enquanto alguém acompanha (o robo/estado muda a cada 2 s durante a leitura do Gmail: ouvir ao vivo
// gastaria leitura à toa).
import { entregas as e } from '@nads/core';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import type { RepoSaude } from './saude';
import { bancoDoEntregas } from './entregas.firestore';

const A_CADA_MS = 30 * 1000;

export function criarSaudeFirestore(): RepoSaude {
  const db = bancoDoEntregas();
  let docs: e.DocsDaSaude | null = null;
  let ver = 0;
  let quantos = 0;
  let relogio: ReturnType<typeof setInterval> | null = null;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const ler = async (caminho: [string, string]) => {
    try { const s = await getDoc(doc(db, caminho[0], caminho[1])); return s.exists() ? s.data() : null; } catch { return null; }
  };

  async function atualizar() {
    const [estado, arquivador, uso, raiz, erros] = await Promise.all([
      ler(['robo', 'estado']), ler(['robo', 'arquivador']), ler(['robo', 'uso']), ler(['driveIndice', 'raiz']),
      getDocs(query(collection(db, 'solicitacoesEmail'), where('status', '==', 'erro'), limit(30)))
        .then(s => s.docs.map(d => e.erroDaFila(d.data())), () => [] as e.ErroNaFila[]),
    ]);
    docs = { estado, arquivador, uso, raiz, erros };
    mudou();
  }

  return {
    exemplos: false,
    docs: () => docs,
    acompanhar() {
      quantos++;
      if (!relogio) { void atualizar(); relogio = setInterval(() => void atualizar(), A_CADA_MS); }
      return () => {
        quantos--;
        if (!quantos && relogio) { clearInterval(relogio); relogio = null; }
      };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
