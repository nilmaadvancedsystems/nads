// Tela de entrada da Conferência: a escolha de empresa comum do nads (conferencia.html #login ~L955).
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return (
    <EscolherEmpresa {...vm} titulo="Entrar na Conferência Contábil" versao={VERSAO_SISTEMA} onAplicativos={vm.aplicativos}
      rodape={vm.exemplos && (
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          Dados de exemplo (901, 902, 903) · nada é gravado em banco ·{' '}
          <button type="button" className="link-btn" onClick={vm.restaurarExemplos}>restaurar exemplos</button>
        </p>
      )} />
  );
}
