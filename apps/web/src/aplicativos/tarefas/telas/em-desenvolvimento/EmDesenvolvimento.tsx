// Aplicação que ainda não foi feita (Fiscal, Drive, Contato; e a rotina de outros departamentos).
import { Icone } from '@nads/ui';

export function EmDesenvolvimento({ nome }: { nome: string }) {
  return (
    <div className="gh-blank">
      <Icone nome="settings" />
      <h4>{nome}: em desenvolvimento</h4>
      <p>Esta parte ainda está sendo feita.</p>
    </div>
  );
}
