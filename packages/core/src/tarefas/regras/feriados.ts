// Os feriados e os pontos facultativos de Taiobeiras (Vitor, 15/11/2026: "Atualiza o calendário com essas datas", com o link do
// Decreto nº 4068, de 05/01/2026, da Prefeitura: o calendário oficial de 2026 e o Ano Novo de 2027; o Art. 2º passa Nossa
// Senhora de Fátima de 13/05 para 18/05). O calendário do Início mostra cada dia com o nome. Só a lógica (sem tela e sem banco).
// Ano novo: acrescente as datas do decreto do ano na lista.

export type TipoDoFeriado = 'feriado' | 'facultativo' | 'meio-expediente';

export interface Feriado {
  /** AAAA-MM-DD */
  data: string;
  nome: string;
  tipo: TipoDoFeriado;
  /** no meio expediente: até que horas ('13:00') */
  ate?: string;
}

/** Decreto nº 4068/2026 de Taiobeiras (o Anexo I e o Art. 2º). */
export const FERIADOS: readonly Feriado[] = [
  { data: '2026-01-01', nome: 'Ano Novo', tipo: 'feriado' },
  { data: '2026-01-20', nome: 'São Sebastião', tipo: 'feriado' },
  { data: '2026-02-16', nome: 'Carnaval', tipo: 'facultativo' },
  { data: '2026-02-17', nome: 'Carnaval', tipo: 'facultativo' },
  { data: '2026-02-18', nome: 'Quarta-feira de Cinzas', tipo: 'facultativo' },
  { data: '2026-04-02', nome: 'Quinta-feira Santa', tipo: 'facultativo' },
  { data: '2026-04-03', nome: 'Paixão de Cristo', tipo: 'feriado' },
  { data: '2026-04-20', nome: 'Ponto facultativo', tipo: 'facultativo' },
  { data: '2026-04-21', nome: 'Tiradentes', tipo: 'feriado' },
  { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'feriado' },
  { data: '2026-05-18', nome: 'Nossa Senhora de Fátima (do dia 13)', tipo: 'feriado' },
  { data: '2026-06-04', nome: 'Corpus Christi', tipo: 'facultativo' },
  { data: '2026-06-05', nome: 'Ponto facultativo', tipo: 'facultativo' },
  { data: '2026-06-24', nome: 'São João Batista', tipo: 'feriado' },
  { data: '2026-09-07', nome: 'Independência do Brasil', tipo: 'feriado' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida', tipo: 'feriado' },
  { data: '2026-10-30', nome: 'Dia do Servidor Público', tipo: 'facultativo' },
  { data: '2026-11-02', nome: 'Finados', tipo: 'feriado' },
  { data: '2026-11-15', nome: 'Proclamação da República', tipo: 'feriado' },
  { data: '2026-11-20', nome: 'Consciência Negra', tipo: 'feriado' },
  { data: '2026-12-12', nome: 'Emancipação de Taiobeiras', tipo: 'feriado' },
  { data: '2026-12-24', nome: 'Véspera de Natal', tipo: 'meio-expediente', ate: '13:00' },
  { data: '2026-12-25', nome: 'Natal', tipo: 'feriado' },
  { data: '2026-12-31', nome: 'Véspera de Ano Novo', tipo: 'meio-expediente', ate: '13:00' },
  { data: '2027-01-01', nome: 'Ano Novo', tipo: 'feriado' },
];

const porData = new Map(FERIADOS.map(f => [f.data, f]));

/** O feriado (ou ponto facultativo, ou meio expediente) do dia 'AAAA-MM-DD'; null quando é um dia comum. */
export const feriadoDoDia = (data: string): Feriado | null => porData.get(data) ?? null;

/** Os do mês 'AAAA-MM', na ordem. */
export const feriadosDoMes = (mes: string): Feriado[] => FERIADOS.filter(f => f.data.startsWith(mes + '-'));

/** O que o dia é, para a dica e a lista: "Feriado", "Ponto facultativo" ou "Expediente até 13h". */
export function rotuloDoFeriado(f: Feriado): string {
  if (f.tipo === 'meio-expediente') return 'Expediente até ' + (f.ate || '13:00').replace(/:00$/, '') + 'h';
  return f.tipo === 'feriado' ? 'Feriado' : 'Ponto facultativo';
}

/** A dica do dia no calendário ("Tiradentes · Feriado"; o ponto facultativo sem nome fica só "Ponto facultativo"). */
export const dicaDoFeriado = (f: Feriado): string => f.nome === rotuloDoFeriado(f) ? f.nome : f.nome + ' · ' + rotuloDoFeriado(f);
