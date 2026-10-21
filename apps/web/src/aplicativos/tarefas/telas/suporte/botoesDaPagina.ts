// Os botões de importação que estão na página da pessoa (Vitor, 21/10/2026: "você vai trackear o que está na página do
// usuário… qual dos botões de importação está com problema?"): cada campo de arquivo da página — e da ferramenta embutida,
// que é do mesmo site — pelo nome do botão que abre ele, sem o mês ("Importar extrato", "Importar razão").
import { suporte } from '@nads/core';

const nomeDe = (el: Element | null | undefined) => (el ? el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '' : '');

export function botoesDaPagina(maximo = 8): string[] {
  const docs: Document[] = [document];
  document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) docs.push(f.contentDocument); } catch { /* de outro site: fica de fora */ } });
  const nomes: string[] = [];
  for (const d of docs) {
    for (const campo of Array.from(d.querySelectorAll<HTMLInputElement>('input[type="file"]'))) {
      if (campo.closest('.suporte-balao')) continue;
      const rotulo = (campo.id && d.querySelector('label[for="' + CSS.escape(campo.id) + '"]')) || campo.closest('label')
        || campo.parentElement?.querySelector('label, button');
      const nome = suporte.nomeDoBotao(nomeDe(rotulo) || nomeDe(campo));
      if (nome && !nomes.includes(nome)) nomes.push(nome);
      if (nomes.length >= maximo) return nomes;
    }
  }
  return nomes;
}
