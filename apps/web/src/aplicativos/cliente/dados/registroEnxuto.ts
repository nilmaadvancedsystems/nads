// O Registro mais enxuto (16/11/2026: o dono apresentou a Área do Cliente e ouviu que tinha "muita informação"): os
// três cartões de número viram dois fatos curtos embaixo do título; as férias de cada um viram uma frase curta (só a
// data, sem o período aquisitivo); a nota longa do pé das férias vira uma frase. Regras puras, sem React.

/** um pedaço do resumo embaixo do título: o número em destaque, o texto em volta e o tom */
export type TrechoDoRegistro = { valor: string; depois: string; tom?: 'atencao'; aba?: 'ferias' };

/**
 * O resumo do Registro, no máximo dois fatos: quantos estão ativos e, das férias, a mais urgente (as que vencem logo ou
 * já venceram) ou, sem urgência, quantas dá para tirar. Sem ninguém ativo, só o primeiro.
 */
export function resumoDoRegistro(n: { ativos: number; paraTirar: number; urgentes: number }): TrechoDoRegistro[] {
  const trechos: TrechoDoRegistro[] = [{ valor: String(n.ativos), depois: n.ativos === 1 ? 'funcionário ativo' : 'funcionários ativos' }];
  if (n.urgentes > 0) trechos.push({ valor: String(n.urgentes), depois: 'com férias para tirar logo', tom: 'atencao', aba: 'ferias' });
  else if (n.paraTirar > 0) trechos.push({ valor: String(n.paraTirar), depois: 'com férias para tirar', aba: 'ferias' });
  return trechos;
}

/**
 * A frase curta das férias de um funcionário, para a linha da lista: só a data ("Tirar até 15/05/2026", "Venceu em
 * 10/2026", "Férias a partir de 01/03/2027"), sem os dias e o período aquisitivo (estão no selo e com o escritório).
 * Quando o holerite marcou férias vencidas, diz isso em poucas palavras.
 */
export function fraseCurtaDasFerias(texto: string): string {
  const partes = texto.split(' · ').map(p => p.trim()).filter(Boolean);
  if (!partes.length) return '';
  if (/^O holerite marca/i.test(partes[0])) return 'Vencidas, pelo holerite';
  return partes.find(p => /^(Venceu|Tirar|Pode tirar|Férias)/.test(p)) ?? partes[0];
}

/** A nota do pé das férias, numa frase: pela previsão do DP, só a regra da dobra; pela estimativa, avisa que é estimativa. */
export function notaDasFerias(fonte: 'folha' | 'misto' | 'guias'): string {
  return fonte === 'folha'
    ? 'Férias vencidas são pagas em dobro.'
    : 'As datas são uma estimativa pelo registro e as vencidas são pagas em dobro; o escritório confirma.';
}

/**
 * De quem é o documento, só quando o nome do arquivo ainda não diz ("Recibo de Férias - Carlos Eduardo" já tem o
 * Carlos; 16/11/2026: "muita informação"). Compara o primeiro nome, sem acento e sem caixa.
 */
export function donoQueNaoRepete(nomeDoArquivo: string, dono: string): string {
  const primeiro = dono.trim().split(/\s+/)[0] ?? '';
  if (!primeiro) return '';
  const sem = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return sem(nomeDoArquivo).includes(sem(primeiro)) ? '' : dono;
}
