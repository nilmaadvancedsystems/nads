// A calculadora do Caixa (19/10/2026: "uma calculadora funcional"): um redutor puro, sem tela. O visor é um texto no jeito
// brasileiro (vírgula; "1234,5" é mostrado "1.234,5" por visorFormatado). As contas são arredondadas em 8 casas, o que
// tira o erro de ponto flutuante (0,1 + 0,2 dá 0,3); o resultado que vai para o lançamento é arredondado em centavos.

export type OperadorDaCalculadora = '+' | '-' | '*' | '/';

export interface EstadoDaCalculadora {
  /** o que o visor mostra, sem pontos de milhar: "-12,5" */
  visor: string;
  anterior: number | null;
  operador: OperadorDaCalculadora | null;
  /** o próximo dígito começa um número novo (depois de um operador, de = ou de uma %) */
  novo: boolean;
  erro: boolean;
}

export type TeclaDaCalculadora =
  | { tipo: 'digito'; digito: string }
  | { tipo: 'virgula' }
  | { tipo: 'operador'; operador: OperadorDaCalculadora }
  | { tipo: 'igual' } | { tipo: 'percentual' } | { tipo: 'limpar' } | { tipo: 'apagar' } | { tipo: 'sinal' };

export const CALCULADORA_INICIAL: EstadoDaCalculadora = { visor: '0', anterior: null, operador: null, novo: true, erro: false };
export const SIMBOLO_DO_OPERADOR: Record<OperadorDaCalculadora, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const MAX_DIGITOS = 15;

const arredondar = (n: number) => Math.round(n * 1e8) / 1e8;
const valorDoVisor = (v: string) => Number(v.replace(',', '.')) || 0;
const textoDe = (n: number) => arredondar(n).toFixed(8).replace(/\.?0+$/, '').replace('.', ',') || '0';
const falha = (e: EstadoDaCalculadora): EstadoDaCalculadora => ({ ...e, visor: 'Erro', anterior: null, operador: null, novo: true, erro: true });

function aplicar(a: number, op: OperadorDaCalculadora, b: number): number | null {
  const r = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : b === 0 ? null : a / b;
  return r === null || !Number.isFinite(r) || Math.abs(r) >= 1e15 ? null : arredondar(r);
}

export function calcular(e: EstadoDaCalculadora, t: TeclaDaCalculadora): EstadoDaCalculadora {
  if (t.tipo === 'limpar') return CALCULADORA_INICIAL;
  // depois de um erro só o C (ou começar a digitar de novo) limpa
  const s = e.erro ? CALCULADORA_INICIAL : e;
  switch (t.tipo) {
    case 'digito': {
      if (s.novo) return { ...s, visor: t.digito, novo: false };
      if (s.visor.replace(/\D/g, '').length >= MAX_DIGITOS) return s;
      return { ...s, visor: s.visor === '0' ? t.digito : s.visor === '-0' ? '-' + t.digito : s.visor + t.digito };
    }
    case 'virgula':
      if (s.novo) return { ...s, visor: '0,', novo: false };
      return s.visor.includes(',') ? s : { ...s, visor: s.visor + ',' };
    case 'operador': {
      // outro operador logo depois de um operador só troca o operador; depois de um número, fecha a conta que estava aberta
      if (s.operador && s.novo && s.anterior != null) return { ...s, operador: t.operador };
      if (s.operador && s.anterior != null) {
        const r = aplicar(s.anterior, s.operador, valorDoVisor(s.visor));
        return r === null ? falha(s) : { ...s, visor: textoDe(r), anterior: r, operador: t.operador, novo: true };
      }
      return { ...s, anterior: valorDoVisor(s.visor), operador: t.operador, novo: true };
    }
    case 'igual': {
      if (!s.operador || s.anterior == null) return { ...s, novo: true };
      const r = aplicar(s.anterior, s.operador, valorDoVisor(s.visor));
      return r === null ? falha(s) : { ...s, visor: textoDe(r), anterior: null, operador: null, novo: true };
    }
    case 'percentual': {
      const v = valorDoVisor(s.visor);
      // 200 + 10% é 10% de 200; nas outras contas (e sozinho) é o número dividido por 100
      const p = s.anterior != null && (s.operador === '+' || s.operador === '-') ? (s.anterior * v) / 100 : v / 100;
      return { ...s, visor: textoDe(p), novo: true };
    }
    case 'apagar': {
      if (s.novo) return s;
      const v = s.visor.slice(0, -1);
      return { ...s, visor: v === '' || v === '-' ? '0' : v };
    }
    case 'sinal':
      if (valorDoVisor(s.visor) === 0 && !s.visor.endsWith(',') && !s.visor.includes(',')) return s;
      return { ...s, visor: s.visor.startsWith('-') ? s.visor.slice(1) : '-' + s.visor };
  }
}

/** O visor com os pontos de milhar: "1234567,5" → "1.234.567,5" (a vírgula e os zeros digitados ficam). */
export function visorFormatado(e: EstadoDaCalculadora): string {
  if (e.erro) return e.visor;
  const neg = e.visor.startsWith('-');
  const [inteiro, ...resto] = e.visor.replace('-', '').split(',');
  return (neg ? '-' : '') + inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (resto.length ? ',' + resto[0] : '');
}

/** A conta aberta, para o visorzinho de cima: "1.250 +". */
export function contaEmAberto(e: EstadoDaCalculadora): string {
  if (e.erro || e.anterior == null || !e.operador) return '';
  return visorFormatado({ ...CALCULADORA_INICIAL, visor: textoDe(e.anterior), novo: false }) + ' ' + SIMBOLO_DO_OPERADOR[e.operador];
}

/** O que o "Usar no lançamento" leva: o visor em reais, arredondado em centavos (0 se deu erro). */
export function resultadoEmReais(e: EstadoDaCalculadora): number {
  return e.erro ? 0 : Math.round(valorDoVisor(e.visor) * 100) / 100;
}

/** A tecla do teclado do computador (null = não é da calculadora). */
export function teclaDoTeclado(key: string): TeclaDaCalculadora | null {
  if (/^\d$/.test(key)) return { tipo: 'digito', digito: key };
  switch (key) {
    case ',': case '.': return { tipo: 'virgula' };
    case '+': return { tipo: 'operador', operador: '+' };
    case '-': return { tipo: 'operador', operador: '-' };
    case '*': case 'x': case 'X': return { tipo: 'operador', operador: '*' };
    case '/': return { tipo: 'operador', operador: '/' };
    case '=': case 'Enter': return { tipo: 'igual' };
    case '%': return { tipo: 'percentual' };
    case 'Backspace': return { tipo: 'apagar' };
    case 'Delete': case 'c': case 'C': return { tipo: 'limpar' };
    default: return null;
  }
}
