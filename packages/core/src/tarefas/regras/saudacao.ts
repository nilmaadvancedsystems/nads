// A saudação do Início novo, no lugar do título (Vitor, 13/11/2026: "Fica variando, as frases, vai mudando: Bom dia, Vitor /
// Boa tarde, Vitor / Boa noite, Vitor / Segunda feira: Como foi o final de semana Vitor? / Perto do aniversário… Melhor mês
// do ano chegou! / Mensagens personalizadas"). E "Só que não pela atualização, pode ser em diferentes turnos": a frase é
// escolhida por pessoa, dia e turno (manhã, tarde, noite), então recarregar a página no mesmo turno mostra a mesma frase.
// 15/11/2026: "coloca algo de piada se tiver feriado na semana" e "se tiver sexta, coloca sextou tbm". Revisto em 16/11/2026: "As
// frases de saudação cuidado, que elas podem desmotivar o trabalho (...) remova as que desmotivam/transmitem preguiça (ansiedade
// para chegar feriado, isso é ruim!)"; e no mesmo dia, as que ele gostava voltaram com o texto dele (o Sextou, a véspera do
// feriado, o churrasco, a semana boa, o feriado no fim de semana, o feriado e você aqui, a metade do dia e as da noite); o
// "Segura a ansiedade" e o "Feriadão vem aí" saíram de vez. E "Feriado na semana, dose mais, não apareça com tanta frequência,
// deixa só na segunda e um dia antes do feriado": fora o próprio dia, o feriado só aparece nesses dois dias, e sem peso dobrado.
// Por fim, "Corrigidas que quero exatamente (tem sotaque é menos robotizado)": o texto de cada frase é o dele, letra por letra; e
// nas que "pode colocar apelido", o {apelido} sorteia entre o primeiro nome e os apelidos da pessoa (usuarios/{uid}.apelidos,
// no banco: o repositório é público, nome da equipe não entra no código).

import { feriadoDoDia, type Feriado } from './feriados';

export type Turno = 'manha' | 'tarde' | 'noite';

/** O turno da hora: manhã das 5h ao meio-dia, tarde até as 18h, noite o resto. */
export function turnoDe(hora: number): Turno {
  if (hora >= 5 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noite';
}

const POR_TURNO: Record<Turno, string> = { manha: 'Bom dia {apelido}!', tarde: 'Boa tarde {apelido}!', noite: 'Boa noite {nome}, bom descanso' };

/**
 * As mensagens personalizadas: entram no sorteio com as do turno. {nome} vira o primeiro nome, {apelido} o nome ou um dos
 * apelidos; turno: só naquele turno. Para ampliar, é só pôr mais uma linha aqui.
 */
export const FRASES_PERSONALIZADAS: readonly { texto: string; turno?: Turno }[] = [
  { texto: 'Bom te ver por aqui {apelido}' },
  { texto: 'Vamo que vamo {apelido}?', turno: 'manha' },
  { texto: 'Eae, já tomou café?', turno: 'manha' },
  { texto: 'Sol tá quente?', turno: 'tarde' },
  { texto: 'Metade do dia já foi, vamo pra cima!', turno: 'tarde' },
  { texto: 'Obrigado pelo empenho de hoje <3', turno: 'noite' },
  { texto: 'Tá apertado aí, né? Entendo... Mas não esqueça de você!', turno: 'noite' },
  { texto: 'Já matou o leão do dia e já tá querendo o da noite? Descanso é importante', turno: 'noite' },
];

/** O aniversário ('aaaa-mm-dd', 'mm-dd' ou 'dd/mm') como 'mm-dd'; '' quando não dá para ler. */
export function mesEDia(aniversario: string | null | undefined): string {
  const a = (aniversario || '').trim();
  let m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(a);
  if (m) return m[1] + '-' + m[2];
  m = /^(\d{2})\/(\d{2})(?:\/\d{4})?$/.exec(a);
  return m ? m[2] + '-' + m[1] : '';
}

/** Um número fixo para o texto (o mesmo texto dá sempre o mesmo número). */
function numeroDe(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 31) + texto.charCodeAt(i)) >>> 0;
  return h;
}

/** o dia da semana com o artigo: "na terça", "no sábado" */
const NO_DIA = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];

/**
 * O feriado mais perto na semana (de hoje até o domingo; da sexta em diante, até a segunda seguinte, o feriadão) e em quantos
 * dias (0 = hoje); null quando a semana não tem. Só os feriados (o ponto facultativo não conta).
 */
export function feriadoDaSemana(agora: Date): { feriado: Feriado; dias: number; diaDaSemana: number } | null {
  const hojeDia = agora.getDay();
  const ate = hojeDia === 0 ? 1 : hojeDia >= 5 ? 8 - hojeDia : 7 - hojeDia;
  for (let dias = 0; dias <= ate; dias++) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias);
    const f = feriadoDoDia(dataLocal(d));
    if (f?.tipo === 'feriado') return { feriado: f, dias, diaDaSemana: d.getDay() };
  }
  return null;
}

/**
 * As frases da semana com feriado (curtas, para caber na linha do título): só na segunda-feira da semana, na véspera (da sexta, o
 * feriado na segunda) e no próprio dia; nos outros dias, nenhuma.
 */
function frasesDoFeriado(x: { dias: number; diaDaSemana: number }, hojeDia: number): string[] {
  if (x.dias === 0) return ['Feriado e você aqui? Vai descansar, anda!'];
  const vespera = x.dias === 1 || (hojeDia === 5 && x.dias === 3);
  if (!vespera && hojeDia !== 1) return [];
  if (x.diaDaSemana === 0 || x.diaDaSemana === 6) return ['Feriadão no final de semana! Deu ruim :('];
  if (vespera && x.dias === 3) return ['Segunda é feriado {apelido}! Bora que bora!'];
  if (vespera) return ['Amanhã é feriadão, bora que bora!', 'Vai fazer churrasco no feriado? Vai me chamar não?'];
  return ['Feriado ' + NO_DIA[x.diaDaSemana] + ' em! Ôh semana boa', 'Semana mais curta, cuidado com os prazos!'];
}

const dataLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** O primeiro nome, com só a inicial maiúscula ("ADIVÂNIA" vira "Adivânia"; "Gustavo.S", "Gustavo"). */
export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/[ .]/)[0] || nome.trim();
  return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');
}

/** Os jeitos de chamar a pessoa: o primeiro nome e os apelidos (sem repetidos nem vazios). */
export function jeitosDeChamar(nome: string, apelidos?: readonly string[] | null): string[] {
  const todos = [primeiroNome(nome), ...(apelidos || []).map(a => String(a).trim()).filter(Boolean)];
  return todos.filter((a, i) => todos.findIndex(b => b.toLowerCase() === a.toLowerCase()) === i);
}

/** As frases que valem agora para a pessoa (a do aniversário, sozinha, no próprio dia). apelido: o {apelido} (o nome, sem ele). */
export function frasesDaSaudacao(nome: string, agora: Date, aniversario?: string | null, apelido?: string): string[] {
  const primeiro = primeiroNome(nome);
  const com = (t: string) => t.replace('{nome}', primeiro).replace('{apelido}', apelido || primeiro);
  const niver = mesEDia(aniversario);
  const hoje = dataLocal(agora).slice(5);
  if (niver && niver === hoje) return [com('Feliz aniversário {apelido}!')];
  const turno = turnoDe(agora.getHours());
  const daHora = com(POR_TURNO[turno]);
  // as especiais aparecem mais (duas vezes na lista): a segunda-feira, a sexta e o mês do aniversário; as do feriado, uma vez só
  const feriado = feriadoDaSemana(agora);
  const especiais = [
    ...(agora.getDay() === 1 ? [com('Como foi o final de semana {apelido}?')] : []),
    ...(agora.getDay() === 5 ? [com('Sextou!'), com('Sexta é dia!'), com('Vamos fechar a semana com tudo {apelido}')] : []),
    ...(niver && niver.slice(0, 2) === hoje.slice(0, 2) ? [com('Melhor mês do ano chegou {apelido}!')] : []),
  ];
  const personalizadas = FRASES_PERSONALIZADAS.filter(f => !f.turno || f.turno === turno).map(f => com(f.texto));
  const doFeriado = feriado ? frasesDoFeriado(feriado, agora.getDay()).map(com) : [];
  return [...especiais, ...doFeriado, daHora, ...especiais, daHora, ...personalizadas];
}

/**
 * A saudação de agora: uma das frases, escolhida pela pessoa (quem), pelo dia e pelo turno, e mais nada; recarregar no
 * mesmo turno dá a mesma frase (e o mesmo apelido). troca: soma ao número (o "Outra frase" do ⚡, para testar); simulando:
 * começa pela primeira frase (a especial, quando tem: a segunda-feira ou o aniversário simulados aparecem logo) e a troca anda
 * uma a uma, e o apelido junto.
 */
export function saudacao(o: { nome: string; quem: string; agora: Date; aniversario?: string | null; apelidos?: readonly string[] | null; troca?: number; simulando?: boolean }): string {
  const jeitos = jeitosDeChamar(o.nome, o.apelidos);
  const n = o.simulando ? (o.troca || 0) : numeroDe(o.quem + '|' + dataLocal(o.agora) + '|' + turnoDe(o.agora.getHours())) + (o.troca || 0);
  const frases = frasesDaSaudacao(o.nome, o.agora, o.aniversario, jeitos[(o.simulando ? n : Math.floor(n / 7)) % jeitos.length]);
  return frases[n % frases.length];
}
