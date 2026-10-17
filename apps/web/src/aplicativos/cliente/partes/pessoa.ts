// As iniciais e o tom do círculo de uma pessoa na Área do Cliente (versão D, Vitor, 16/10/2026): a primeira e a última
// inicial ("Maria Souza" → "MS") e um dos seis tons suaves do nads, sempre o mesmo para o mesmo nome.
export const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();

export function tomDoNome(nome: string) {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const t = h % 6;
  return t ? ' t' + t : '';
}
