// O ⚡ das telas de banco da Tarefa (Bancos, Cheque especial; Vitor, 16/10/2026: "em todas as telas, no modo desenvolvedor,
// a opção de nutrir com dados de teste"): os mesmos extratos e razões fictícios da Importação, no primeiro banco da empresa.
// Só no modo desenvolvedor (ou na empresa de teste): nada vai para o banco.
import { demo, extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useAplicarNoExtrator, useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useCadastro } from '../../../../dados/repo';
import { useDadosDeTesteDaEtapa, useEtapaAberta } from '../contexto';

const OPCOES = [
  { id: 'extratos', rotulo: 'Extratos do período (1º mês com dia negativo)' },
  { id: 'bate', rotulo: 'Razão batendo' },
  { id: 'cheque', rotulo: 'Razão com o cheque especial' },
  { id: 'erros', rotulo: 'Razão com erros' },
];

let seq = 0;
const novoId = () => 'teste-' + Date.now().toString(36) + '-' + (seq++).toString(36);

export function useBancosDeTeste() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const aplicar = useAplicarNoExtrator(s.nome);
  const ext = useExtratorDaEmpresa(s.nome);
  const vivo = useCadastro(s.nome, s.codigo);
  const { primeiro } = x.bancosDaEmpresaNa(ext, vivo.carregada ? vivo.cadastro : null, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
  useDadosDeTesteDaEtapa(s.dev || demo.ehEmpresaDemo(s.nome) ? OPCOES : [], id => {
    const lado: x.Lado = id === 'extratos' ? 'banco' : 'sistema';
    const lidos = id === 'extratos' ? demo.extratosDeTeste(s.meses) : demo.razaoDeTeste(s.meses, id as demo.RazaoDeTeste);
    aplicar(e => {
      const antes = new Set(e.arquivos.map(a => a.id));
      const r = x.importar(e, lado, lidos, 'sobrepor', new Date(), novoId);
      // os novos ficam no primeiro banco da empresa (como na Importação, de um banco só)
      return { ...r.empresa, arquivos: r.empresa.arquivos.map(a => (antes.has(a.id) || !primeiro ? a : { ...a, banco: primeiro })) };
    });
    aviso({ tom: 'ok', titulo: 'Dados de teste', texto: OPCOES.find(o => o.id === id)?.rotulo + ' · só nesta tela: nada vai para o banco.' });
  });
}
