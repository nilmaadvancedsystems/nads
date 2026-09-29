// Entrada do Extrator: a escolha de empresa comum do nads.
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return (
    <EscolherEmpresa {...vm} titulo="Entrar no Extrator" versao={VERSAO_SISTEMA} onAplicativos={vm.aplicativos}
      rodape={
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          {vm.exemplos ? <>Dados de exemplo (901, 902, 903) · nada é gravado em banco ·{' '}
            <button type="button" className="link-btn" onClick={vm.restaurarExemplos}>restaurar exemplos</button></>
            : 'Os PDFs não são guardados: só os lançamentos lidos deles, neste navegador.'}
        </p>
      } />
  );
}
