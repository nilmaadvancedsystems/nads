// ViewModel da janela de uma empresa no Cadastro: a empresa, as abas em grupos por setor (Empresa · Contábil · Fiscal ·
// Acessos · Registro), cada uma com o aviso do que falta, trocar de aba e fechar (volta para a lista, que ficou atrás da janela).
// E o resumo do topo da aba Empresa (13/10/2026: "reveja a estrutura inteira do cadastro"): o CNPJ, o regime e o que o
// cadastro já tem, com o atalho para a aba de cada item.
import { empresas, tarefas } from '@nads/core';
import { useNavigate } from 'react-router';
import { empresaDaRota } from '../../../../../comum/empresaDaRota';
import { abasDoCadastroDe, caminhoDoCadastro } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useCadastro, useRegimesDoEntregas } from '../../../dados/repo';
import { temCodigoDoSimples } from '../../senhas/useImportarCodigosDoSimples';

export interface ItemDoResumo { id: string; rotulo: string; tem: boolean; texto: string; aba: string }

/** local: a janela aberta por cima de outra tela (o cartão da empresa no cabeçalho; 27/10/2026), sem mexer no endereço */
export function useJanelaDaEmpresa(rota: string, aba: string, local?: { irPara: (id: string) => void; fechar: () => void }) {
  useRegimesDoEntregas();
  const navegar = useNavigate();
  // o CadastroAberto só abre a janela quando a empresa está na lista
  const empresa = empresaDaRota(rota) as empresas.EmpresaDoEscritorio;
  const vivo = useCadastro(empresa.nome, empresa.codigo);
  const c = vivo.cadastro;
  const regime = tarefas.regimeDaEmpresa(empresa.codigo) || empresa.regime || '';
  const contas = (c.bancos || []).filter(b => !b.ate).length;
  // as abas do Contábil só para o Contábil (06/11/2026: "quem é do fiscal, não é para ter acesso a coisas do contábil")
  const visiveis = abasDoCadastroDe(useOperador().operador);
  const itens: ItemDoResumo[] = [
    { id: 'regime', rotulo: 'Regime', tem: !!regime, texto: regime || 'não escolhido', aba: 'fiscal' },
    { id: 'contato', rotulo: 'Contato', tem: !!(c.contato?.email || c.contato?.whatsapp), texto: c.contato?.email || c.contato?.whatsapp || 'sem e-mail e sem WhatsApp', aba: 'empresa' },
    { id: 'bancos', rotulo: 'Bancos', tem: contas > 0, texto: contas ? contas + (contas === 1 ? ' conta' : ' contas') : 'nenhuma conta', aba: 'bancos' },
    { id: 'plano', rotulo: 'Plano de contas', tem: c.plano?.contas != null, texto: c.plano?.contas != null ? c.plano.contas.toLocaleString('pt-BR') + ' contas' : 'não importado', aba: 'plano' },
    { id: 'socios', rotulo: 'Sócios', tem: !!c.socios?.length, texto: c.socios?.length ? c.socios.length + (c.socios.length === 1 ? ' sócio' : ' sócios') : 'nenhum', aba: 'empresa' },
  ].filter(i => visiveis.some(a => a.id === i.aba));
  // o aviso de cada aba: o que falta nela
  const falta = (id: string) => itens.filter(i => i.aba === id && !i.tem).length;
  return {
    empresa,
    /** o nome para mostrar: a razão social trocada no Cadastro › Empresa (13/11/2026), ou o nome */
    nomeNaTela: empresas.nomeParaMostrar(empresa),
    regime,
    /** a empresa do Simples (ou ainda sem regime) tem o código de acesso; as outras, não (04/11/2026) */
    simples: temCodigoDoSimples(regime),
    abas: visiveis.filter(a => a.id !== 'simples' || temCodigoDoSimples(regime)).map(a => ({ ...a, ativa: a.id === aba, pendente: vivo.carregada ? falta(a.id) : 0 })),
    aba,
    abaAberta: visiveis.find(a => a.id === aba) || null,
    resumo: {
      carregado: vivo.carregada,
      cnpj: c.cnpj ? empresas.cadastro.cnpjFormatado(c.cnpj) : '',
      itens,
      completos: itens.filter(i => i.tem).length,
    },
    irPara: local ? local.irPara : (id: string) => navegar(caminhoDoCadastro(rota, id), { replace: true }),
    fechar: local ? local.fechar : () => navegar(caminhoDoCadastro(null)),
  };
}
