// ViewModel de Financeiro › Notas fiscais (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): o estado do
// emissor (o robô, o ambiente, o que falta na configuração), a lista das notas com a busca e o filtro, e qual janela está aberta
// (a Nova nota, a nota aberta, ou a recusada sendo corrigida).
import { nfse } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useNfse } from '../../dados/repo';

export type FiltroDeNotas = 'todas' | 'andamento' | 'autorizadas' | 'recusadas' | 'canceladas';
export const FILTROS_DE_NOTAS: { valor: FiltroDeNotas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'andamento', rotulo: 'Em andamento' },
  { valor: 'autorizadas', rotulo: 'Autorizadas' },
  { valor: 'recusadas', rotulo: 'Recusadas' },
  { valor: 'canceladas', rotulo: 'Canceladas' },
];

const noFiltro = (f: FiltroDeNotas, s: nfse.StatusNfse) =>
  f === 'todas' ? true : f === 'andamento' ? nfse.andando(s) : f === 'autorizadas' ? s === 'autorizada' : f === 'recusadas' ? s === 'erro' || s === 'erro-cancelamento' : s === 'cancelada';

export function useNotasFiscais() {
  const repo = useNfse();
  const navegar = useNavigate();
  const robo = repo.robo();
  const lista = repo.notas();
  const cfg = repo.config();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeNotas>('todas');
  const [nova, setNova] = useState(false);
  /** o Importar planilha (15/10/2026: "quero que ele leia uma planilha com clientes que já pagaram") */
  const [importando, setImportando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  /** a recusada que está sendo corrigida (a Nova nota abre preenchida) */
  const [corrigindo, setCorrigindo] = useState<nfse.NotaFiscal | null>(null);

  const q = busca.trim().toLowerCase();
  const qd = nfse.soDigitos(busca);
  const linhas = lista.lista.filter(n => noFiltro(filtro, n.status) && (!q || nfse.textoDaNota(n).includes(q) || (qd.length >= 3 && n.tomador.documento.includes(qd))));
  const faltas = cfg.carregada ? nfse.faltasNaConfig(cfg.config, !!cfg.tokenGravadoEm) : [];

  return {
    carregando: !lista.carregada || !cfg.carregada || !robo.carregado,
    erro: lista.erro,
    exemplos: repo.exemplos,
    robo,
    ambiente: cfg.config?.ambiente ?? nfse.CONFIG_PADRAO.ambiente,
    faltas,
    irParaConfiguracoes: () => navegar(caminhoDaPagina('financeiro', 'configuracoes')),
    total: lista.lista.length,
    linhas,
    busca, setBusca, filtro, setFiltro,
    nova, setNova, importando, setImportando, aberta, setAberta, corrigindo,
    corrigir(n: nfse.NotaFiscal) { setAberta(null); setCorrigindo(n); },
    fecharCorrecao: () => setCorrigindo(null),
  };
}
