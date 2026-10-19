// O banco do anexo no "Buscar no e-mail" (Vitor, 19/10/2026: "filtra direto os bancos também pelo título e corpo; se no
// título e no corpo só tem Sicoob, quando eu quiser o Nubank, nem deixe aparecer o do Sicoob; porém se tiver os dois, ou o
// banco que eu quero e outro, pode puxar tranquilamente"). O nome do anexo manda: se ele cita um banco, é por ele. Sem banco
// no nome, o assunto e o corpo: só outros bancos, some; o banco procurado (mesmo junto de outros) ou nenhum, fica.
import { bancoDoTexto, bancosCitados } from '../../conversor/regras/arquivo';
import type { AnexoDoEmail } from '../drive';

type Anexo = Pick<AnexoDoEmail, 'nome' | 'assunto'> & { trecho?: string };

/** O anexo é do banco procurado? (alvo: o nome do banco como o conversor conhece; '' = não filtra) */
export function anexoDoBanco(a: Anexo, alvo: string): boolean {
  if (!alvo) return true;
  const doNome = bancosCitados(a.nome);
  if (doNome.length) return doNome.includes(alvo);
  const doEmail = bancosCitados((a.assunto || '') + ' ' + (a.trecho || ''));
  return !doEmail.length || doEmail.includes(alvo);
}

/** O banco procurado pela linha do banco (o nome dela e o id, como "banco-do-brasil"); '' = não reconheceu. */
export function bancoDaLinha(nome: string, id = ''): string {
  return bancoDoTexto(nome + ' ' + id.replace(/-/g, ' '));
}

/** Os anexos do banco procurado e os de outros bancos (escondidos na tela). */
export function separarPeloBanco<T extends Anexo>(anexos: readonly T[], alvo: string): { doBanco: T[]; outros: T[] } {
  const r = { doBanco: [] as T[], outros: [] as T[] };
  for (const a of anexos) (anexoDoBanco(a, alvo) ? r.doBanco : r.outros).push(a);
  return r;
}
