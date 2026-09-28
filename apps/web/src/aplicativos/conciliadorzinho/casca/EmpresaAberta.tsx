// Rota da empresa aberta no Conciliadorzinho: /conciliadorzinho/:empresa/conciliacao/:etapa.
// Resolve a empresa (código do ERP ou nome), monta a sessão e a casca e escolhe a tela da etapa.
// Etapa que ainda não foi alcançada (ou de bandeira não escolhida) volta para a última possível.
import { empresas } from '@nads/core';
import { Navigate, useParams } from 'react-router';
import { empresaDaRota } from '../../../comum/empresaDaRota';
import { TopoProvider } from '../../../comum/topo';
import { Arquivos } from '../telas/arquivos/Arquivos';
import { Bandeiras } from '../telas/bandeiras/Bandeiras';
import { Contas } from '../telas/contas/Contas';
import { Extrato } from '../telas/extrato/Extrato';
import { Notas } from '../telas/notas/Notas';
import { Totais } from '../telas/totais/Totais';
import { caminho } from './caminho';
import { CascaConciliador } from './CascaConciliador';
import { idDaPagina, SECAO, type IdEtapa } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  const atual = s.lista.find(x => x.id === s.etapa);
  if (!atual || !s.podeAbrir(s.etapa)) {
    const ultima = s.lista[Math.min(s.estado.alcancada, s.lista.length - 1)];
    return <Navigate to={caminho(s.rota + '/' + idDaPagina(ultima.id))} replace />;
  }
  if (atual.bandeira) return <Extrato key={atual.bandeira} bandeira={atual.bandeira} />;
  switch (atual.id) {
    case 'bandeiras': return <Bandeiras />;
    case 'notas': return <Notas />;
    case 'contas': return <Contas />;
    case 'totais': return <Totais />;
    case 'arquivos': return <Arquivos />;
    default: return null;
  }
}

export function EmpresaAberta() {
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const empresa = empresaDaRota(param);
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  if (secao !== SECAO || !pagina || param !== rota) return <Navigate to={caminho(rota + '/' + idDaPagina(secao === SECAO && pagina ? pagina as IdEtapa : 'bandeiras'))} replace />;
  return (
    // key = empresa: trocar de empresa começa do zero (nada é guardado)
    <SessaoProvider key={rota} empresa={empresa} rota={rota} etapa={pagina as IdEtapa}>
      <TopoProvider>
        <CascaConciliador>
          <Tela />
        </CascaConciliador>
      </TopoProvider>
    </SessaoProvider>
  );
}
