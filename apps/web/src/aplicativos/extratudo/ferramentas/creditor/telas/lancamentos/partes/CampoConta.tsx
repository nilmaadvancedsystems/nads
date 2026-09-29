// Um campo de conta (ou histórico). Grava quando sai do campo (ou no Enter), não a cada tecla: cada
// gravação vai para o banco. Com `lista`, sugere as contas do balancete enquanto digita.
interface Props {
  id: string;
  rotulo: string;
  valor: string;
  lista?: string;
  onGravar: (v: string) => void;
}

export function CampoConta({ id, rotulo, valor, lista, onGravar }: Props) {
  return (
    <>
      <label htmlFor={id}>{rotulo}</label>
      {/* key = valor: quando o valor muda por fora (balancete atualizado, outra aba), o campo acompanha */}
      <input key={valor} type="text" id={id} inputMode="numeric" autoComplete="off" list={lista} defaultValue={valor}
        onBlur={e => { if (e.target.value.trim() !== valor) onGravar(e.target.value); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </>
  );
}
