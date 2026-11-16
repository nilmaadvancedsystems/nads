// O ouvinte que não desiste da primeira negada (16/11/2026, "Não consegui abrir as tarefas (o banco recusou)" com um
// usuário comum no Início novo). O banco nega a leitura quando o login ainda está chegando, quando a liberação deste
// computador acabou de sair (a tela abre com o registro do login ainda a caminho do banco) ou com o token vencido depois de
// o PC dormir; o onSnapshot negado morre, e a lista ficava vazia com o aviso até recarregar a página. O admin não passa
// pela liberação, por isso não via. Aqui, negada, renova o login e ouve de novo (1, 2, 4 e 8 s, como as Tarefas; depois a
// cada minuto); `falhou` avisa a tela quando as tentativas rápidas acabam (e o que não é negada, na hora).
import { onSnapshot, type DocumentData, type Query, type QuerySnapshot } from 'firebase/firestore';
import { renovarLogin } from './entregas.firestore';

const ESPERAS = [1000, 2000, 4000, 8000];
const DEPOIS_DAS_RAPIDAS = 60 * 1000;
const negada = (e: unknown) => /permission|insufficient|unauthenticated/i.test(e instanceof Error ? e.message : String(e));

/** Ouve a busca e, negada, tenta de novo; devolve o parar. */
export function ouvirInsistindo<T = DocumentData>(q: Query<T>, chegou: (s: QuerySnapshot<T>) => void, falhou: (e: unknown) => void): () => void {
  let parar = () => {};
  let relogio: ReturnType<typeof setTimeout> | undefined;
  let encerrado = false;
  const ouvir = (tentativa: number) => {
    if (encerrado) return;
    parar = onSnapshot(q, chegou, e => {
      if (encerrado) return;
      if (!negada(e)) { falhou(e); return; }
      if (tentativa >= ESPERAS.length) falhou(e);
      relogio = setTimeout(() => { void renovarLogin().then(() => ouvir(tentativa + 1)); }, ESPERAS[tentativa] ?? DEPOIS_DAS_RAPIDAS);
    });
  };
  ouvir(0);
  return () => { encerrado = true; clearTimeout(relogio); parar(); };
}
