// A marca do escritório no lugar do avatar "NC" (Vitor, 16/10/2026): o N oficial da Nilma, o mesmo do menu, num círculo
// claro com a borda fina. Vai no card Atendimento e no rodapé da lateral. Peça do catálogo (Avatares).
import { MarcaN } from '@nads/ui';

export function MarcaDoEscritorio({ tamanho = 44 }: { /** em px */ tamanho?: number }) {
  return (
    <span className="cli-marca-escritorio" style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <span style={{ display: 'flex', height: Math.round(tamanho * 0.6) }}><MarcaN /></span>
    </span>
  );
}
