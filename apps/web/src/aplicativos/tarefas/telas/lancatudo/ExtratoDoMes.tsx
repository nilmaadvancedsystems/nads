// O extrato e o razão do mês sem sair do Lançatudo (18/11/2026: "tem que ter como adicionar o extrato aqui ou puxar do
// drive"): a mesma tela da etapa Importação da rotina do Contábil (do computador, do Drive, do e-mail; o razão), aberta
// numa janela para a empresa e o mês do Lançatudo, como o Contatudo abre as ferramentas soltas. O Extrator é o mesmo: o que
// for importado aqui já aparece nos lançamentos ao fechar.
import { useState } from 'react';
import { modoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { EtapaProvider, type EtapaAberta } from '../executor/etapas/contexto';
import { PonteDaEtapaProvider } from '../executor/etapas/ponte';
import { TelaDaEtapa } from '../executor/etapas/TelaDaEtapa';

const nada = () => {};
const PONTE = { porMes: {}, periodo: null, etapaConcluida: false, marcarSemMovimento: nada, trocarCompetencia: nada, encerrarPeriodo: nada, assinarDestaque: () => nada };

export function ExtratoDoMes({ empresa, competencia }: { empresa: { codigo: number; nome: string }; competencia: string }) {
  const [alvoDosAvisos, setAlvo] = useState<HTMLElement | null>(null);
  const etapa: EtapaAberta = { nome: empresa.nome, codigo: empresa.codigo, competencia, meses: [competencia], dev: modoDesenvolvedor(), prestaServico: null, mesesDaTarefa: false };
  return (
    <>
        <div ref={setAlvo} className="lt-extrato-avisos" />
        <div className="executor-ferramenta">
          <EtapaProvider etapa={etapa} onRequisitos={nada} onTeste={nada} onAbas={nada} onBalancete={nada} alvoDosAvisos={alvoDosAvisos}>
            <PonteDaEtapaProvider valor={PONTE}>
              <TelaDaEtapa id="importacao" />
            </PonteDaEtapaProvider>
          </EtapaProvider>
        </div>
    </>
  );
}
