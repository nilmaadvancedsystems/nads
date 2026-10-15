// A sugestão de baixa da nota em aberto no razão do cliente ou do fornecedor (Vitor, 15/10/2026: "relacionar as notas em
// aberto daquele razão e mostrar uma sugestão de baixa, pegando os valores dos bancos, junto a data, descrição, o que for
// preciso para identificar se houve algum pagamento daquela nota em aberto, para o usuário já achar no banco e analisar").
// Procura nos extratos importados (todos os bancos da empresa) o lançamento no sentido certo (cliente: entrou; fornecedor:
// saiu), da data da nota até 6 meses depois, com o mesmo valor ou com o nome do participante no histórico. Só sugere.
import { normalizarTexto } from '../../formatos';

/** Um lançamento do extrato: data 'aaaa-mm-dd', valor em centavos (+ entrou, − saiu), o histórico e o banco. */
export interface LancamentoDoBanco { data: string; valor: number; historico: string; banco: string }

export interface SugestaoDeBaixa extends LancamentoDoBanco {
  /** o mesmo valor da nota */
  mesmoValor: boolean;
  /** o nome do participante aparece no histórico */
  mesmoNome: boolean;
}

/** Até quantos dias depois da nota o pagamento costuma vir. */
const DIAS_DEPOIS = 183;
/** Até quantos dias antes (o pagamento adiantado ou a nota emitida depois). */
const DIAS_ANTES = 5;

/** Palavras do nome que não identificam ninguém. */
const GENERICAS = new Set(['ltda', 'eireli', 'epp', 'me', 'sa', 'cia', 'comercio', 'industria', 'servicos', 'servico', 'empresa', 'de', 'da', 'do', 'dos', 'das', 'e',
  'brasil', 'distribuidora', 'transportes', 'construtora', 'engenharia', 'grupo', 'outros', 'diversos', 'clientes', 'fornecedores', 'comercial', 'industrial']);

const dia = (d: string) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x) / 86400000; };

/** As palavras do nome que identificam (4 letras ou mais, sem as genéricas). */
export function palavrasDoNome(nome: string): string[] {
  return normalizarTexto(nome).split(' ').filter(p => p.length >= 4 && !GENERICAS.has(p));
}

/**
 * As sugestões para uma nota em aberto (valor em reais, como no razão). sentido: +1 = o dinheiro entra (o cliente pagou),
 * −1 = sai (pagamos o fornecedor). O mesmo valor vem antes; com o nome no histórico, sobe; o mais perto da data, primeiro.
 */
export function sugestoesDeBaixa(nota: { data: string; valor: number }, nome: string, lancamentos: readonly LancamentoDoBanco[], sentido: 1 | -1, limite = 3): SugestaoDeBaixa[] {
  const alvo = Math.round(Math.abs(nota.valor) * 100);
  if (!alvo || !/^\d{4}-\d{2}-\d{2}$/.test(nota.data)) return [];
  const palavras = palavrasDoNome(nome);
  const d0 = dia(nota.data);
  const achados: (SugestaoDeBaixa & { nota: number; dist: number })[] = [];
  for (const l of lancamentos) {
    if (Math.sign(l.valor) !== sentido) continue;
    const dist = dia(l.data) - d0;
    if (dist < -DIAS_ANTES || dist > DIAS_DEPOIS) continue;
    const mesmoValor = Math.abs(l.valor) === alvo;
    const h = ' ' + normalizarTexto(l.historico) + ' ';
    const mesmoNome = palavras.some(p => h.includes(' ' + p + ' '));
    // com o nome no histórico, vale também o pagamento parcial ou com juros/desconto (até 50% a mais ou a menos)
    if (!mesmoValor && !(mesmoNome && Math.abs(Math.abs(l.valor) - alvo) <= alvo * 0.5)) continue;
    achados.push({ ...l, mesmoValor, mesmoNome, nota: (mesmoValor ? 4 : 0) + (mesmoNome ? 3 : 0), dist: Math.abs(dist) });
  }
  return achados.sort((a, b) => b.nota - a.nota || a.dist - b.dist).slice(0, limite).map(({ nota: _n, dist: _d, ...s }) => s);
}
