// Célula editável das tabelas do Creditor: mostra o valor e grava ao sair do campo (ou com Enter).
// A chave muda quando o valor gravado muda, então a célula sempre mostra o que está no estado.
import { creditor as cr } from '@nads/core';

export function Celula({ valor, onGravar, numero, largura, rotulo, placeholder }: {
  valor: string | number | null;
  onGravar: (v: string) => void;
  numero?: boolean;
  largura?: number;
  rotulo: string;
  placeholder?: string;
}) {
  const texto = valor == null ? '' : typeof valor === 'number' ? cr.brl(valor) : valor;
  return (
    <input key={texto} type="text" className={'celula' + (numero ? ' celula-num' : '')} defaultValue={texto} aria-label={rotulo}
      placeholder={placeholder} style={largura ? { minWidth: largura } : undefined} inputMode={numero ? 'decimal' : undefined}
      onBlur={e => { if (e.target.value !== texto) onGravar(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}
