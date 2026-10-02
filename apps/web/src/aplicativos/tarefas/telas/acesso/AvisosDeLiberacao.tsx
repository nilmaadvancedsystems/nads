// Para o admin, em qualquer tela da Tarefas: quem está pedindo para entrar (Aprovar / Recusar) e, depois de
// aprovar, o código grande para passar à pessoa.
import { Icone } from '@nads/ui';
import { useAvisosDeLiberacao } from './useLiberacao';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export function AvisosDeLiberacao({ admin }: { admin: boolean }) {
  const vm = useAvisosDeLiberacao(admin);
  if (!vm.pendentes.length && !vm.codigos.length) return null;
  return (
    <div className="liberar-avisos" role="status" aria-live="polite">
      {vm.pendentes.map(p => (
        <div key={p.id} className="liberar-aviso">
          <p><Icone nome="lock" /><b>{p.nome || p.email}</b> quer entrar no nads</p>
          <p className="fraco">{p.computador} · pediu às {hora(p.criadoEm)}</p>
          <div className="liberar-aviso-acoes">
            <button type="button" className="btn btn-outline" onClick={() => void vm.recusar(p)}>Recusar</button>
            <button type="button" className="btn btn-primary" onClick={() => void vm.aprovar(p)}>Aprovar</button>
          </div>
        </div>
      ))}
      {vm.codigos.map(c => (
        <div key={c.codigo} className="liberar-aviso liberado">
          <p>Passe este código para <b>{c.nome}</b> ({c.computador}):</p>
          <p className="liberar-codigo-grande">{c.codigo.slice(0, 3)} {c.codigo.slice(3)}</p>
          <div className="liberar-aviso-acoes"><button type="button" className="btn btn-outline" onClick={() => vm.fecharCodigo(c.codigo)}>Pronto</button></div>
        </div>
      ))}
    </div>
  );
}
