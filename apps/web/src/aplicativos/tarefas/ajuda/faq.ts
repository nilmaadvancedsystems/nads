// As perguntas frequentes da Tarefas (Vitor, 02/10/2026: "crie um FAQ para o usuário e a IA usar"). O texto fica em
// faq-tarefas.md (linguagem de quem usa: "## Seção", "### Pergunta" e a resposta embaixo): a Minha página › Perguntas
// frequentes mostra, e `npm run faq` copia para o guia que a IA do escritório consulta (Entregas/scripts/guia-do-app.md).
// Quando o app mudar, atualize o .md e rode `npm run faq`.
import texto from './faq-tarefas.md?raw';

export interface PerguntaFrequente { id: string; secao: string; pergunta: string; resposta: string }

/** Lê o markdown: cada "### " é uma pergunta da seção "## " de cima; a resposta é o texto até a próxima. */
export function lerFaq(md: string): PerguntaFrequente[] {
  const itens: PerguntaFrequente[] = [];
  let secao = '';
  let atual: PerguntaFrequente | null = null;
  for (const linha of md.split(/\r?\n/)) {
    if (linha.startsWith('## ')) { secao = linha.slice(3).trim(); atual = null; continue; }
    if (linha.startsWith('### ')) {
      atual = { id: 'faq-' + itens.length, secao, pergunta: linha.slice(4).trim(), resposta: '' };
      itens.push(atual);
      continue;
    }
    if (atual && linha.trim()) atual.resposta = (atual.resposta ? atual.resposta + '\n' : '') + linha.trim();
  }
  return itens;
}

export const FAQ: readonly PerguntaFrequente[] = lerFaq(texto);

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * As perguntas que batem com o que a pessoa escreveu, as melhores primeiro: cada palavra (de 3 letras ou mais) que
 * aparece na pergunta conta mais que na resposta. Sem texto: todas.
 */
export function buscarNoFaq(busca: string, faq: readonly PerguntaFrequente[] = FAQ): PerguntaFrequente[] {
  const palavras = semAcento(busca).split(/[^a-z0-9]+/).filter(p => p.length >= 3);
  if (!palavras.length) return [...faq];
  return faq
    .map(f => {
      const p = semAcento(f.pergunta + ' ' + f.secao);
      const r = semAcento(f.resposta);
      const pontos = palavras.reduce((s, w) => s + (p.includes(w) ? 3 : 0) + (r.includes(w) ? 1 : 0), 0);
      return { f, pontos };
    })
    .filter(x => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map(x => x.f);
}
