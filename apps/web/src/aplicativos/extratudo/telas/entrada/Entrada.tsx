// Entrada do Extratudo: a escolha de empresa comum do nads.
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return (
    <EscolherEmpresa {...vm} titulo="Entrar no Extratudo" versao={VERSAO_SISTEMA}
      rodape={
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          {vm.exemplos ? <>Dados de exemplo (901, 902, 903) · nada é gravado em banco ·{' '}
            <button type="button" className="btn" onClick={vm.restaurarExemplos}>Restaurar exemplos</button></>
            : 'Os PDFs não são guardados: só os lançamentos lidos deles, na nuvem.'}
        </p>
      } />
  );
}
