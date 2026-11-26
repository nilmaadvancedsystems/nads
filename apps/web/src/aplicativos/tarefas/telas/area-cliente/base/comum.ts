// As contas pequenas do módulo Área do Cliente (26/11/2026, o módulo refeito): a busca sem acento, as datas e o erro de
// regra do banco. Antes cada tela tinha a sua cópia (useAcoesDoLink, usePessoasComSenha, useLinkDaEmpresa).

/** sem acento e minúsculo, para a busca */
export const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** a busca: todas as palavras aparecem em algum dos textos */
export function bate(busca: string, ...textos: (string | number | null | undefined)[]): boolean {
  const q = simples(busca.trim());
  if (!q) return true;
  const alvo = simples(textos.filter(t => t != null).join(' '));
  return q.split(/\s+/).every(p => alvo.includes(p));
}

/** "26/11/2026, 13:55" */
export function dataEHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "12/10/2026" */
export function haQuanto(iso: string, agora = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.round((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'há ' + h + ' h';
  const dias = Math.round(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return 'há ' + dias + ' dias';
  return d.toLocaleDateString('pt-BR');
}

/** o erro é a regra do banco que ainda não deixa (permission-denied) */
export const ehFaltaDeRegra = (err: unknown) => /permission|insufficient/i.test(err instanceof Error ? err.message : String(err ?? ''));

/** a mensagem do erro em português, para o toast */
export const mensagemDoErro = (err: unknown, padrao = 'Não deu certo agora. Tente de novo.') =>
  ehFaltaDeRegra(err) ? 'O banco ainda não deixa fazer isso (falta a regra do Vitor).' : err instanceof Error && err.message ? err.message : padrao;

/** "1 arquivo" / "3 arquivos" */
export const plural = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);
