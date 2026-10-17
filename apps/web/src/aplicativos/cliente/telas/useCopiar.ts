// Copiar um texto (a linha digitável, o e-mail, o telefone) e avisar (Área do Cliente, 16/10/2026).
import { useRetorno } from '@nads/ui';

export function useCopiar() {
  const { toast } = useRetorno();
  return async (texto: string, oQue: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast(oQue + ' copiado.');
    } catch {
      toast('Não deu para copiar. Selecione e copie à mão: ' + texto);
    }
  };
}
