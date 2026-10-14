// ViewModel da janela de uma empresa no Cadastro: a empresa, as abas em grupos por setor (Empresa · Contábil · Fiscal ·
// Acessos · Registro), cada uma com o aviso do que falta, trocar de aba e fechar (volta para a lista, que ficou atrás da janela).
// E o resumo do topo da aba Empresa (13/10/2026: "reveja a estrutura inteira do cadastro"): o CNPJ, o regime e o que o
// cadastro já tem, com o atalho para a aba de cada item.
import { empresas, tarefas } from '@nads/core';
import { useNavigate } from 'react-router';
import { empresaDaRota } from '../../../../../comum/empresaDaRota';
import { ABAS_DO_CADASTRO, caminhoDoCadastro } from '../../../casca/navegacao';
import { useCadastro, useRegimesDoEntregas } from '../../../dados/repo';

export interface ItemDoResumo { id: string; rotulo: string; tem: boolean; texto: string; aba: string }

export function useJanelaDaEmpresa(rota: string, aba: string) {
  useRegimesDoEntregas();
  const navegar = useNavigate();
  // o CadastroAberto só abre a janela quando a empresa está na lista
  const empresa = empresaDaRota(rota) as empresas.EmpresaDoEscritorio;
  const vivo = useCadastro(empresa.nome, empresa.codigo);
  const c = vivo.cadastro;
  const regime = tarefas.regimeDaEmpresa(empresa.codigo) || empresa.regime || '';
  const contas = (c.bancos || []).filter(b => !b.ate).length;
  const itens: ItemDoResumo[] = [
    { id: 'regime', rotulo: 'Regime', tem: !!regime, texto: regime || 'não escolhido', aba: 'fiscal' },
    { id: 'contato', rotulo: 'Contato', tem: !!(c.contato?.email || c.contato?.whatsapp), texto: c.contato?.email || c.contato?.whatsapp || 'sem e-mail e sem WhatsApp', aba: 'empresa' },
    { id: 'bancos', rotulo: 'Bancos', tem: contas > 0, texto: contas ? contas + (contas === 1 ? ' conta' : ' contas') : 'nenhuma conta', aba: 'bancos' },
    { id: 'plano', rotulo: 'Plano de contas', tem: c.plano?.contas != null, texto: c.plano?.contas != null ? c.plano.contas.toLocaleString('pt-BR') + ' contas' : 'não importado', aba: 'plano' },
    { id: 'socios', rotulo: 'Sócios', tem: !!c.socios?.length, texto: c.socios?.length ? c.socios.length + (c.socios.length === 1 ? ' sócio' : ' sócios') : 'nenhum', aba: 'empresa' },
  ];
  // o aviso de cada aba: o que falta nela
  const falta = (id: string) => itens.filter(i => i.aba === id && !i.tem).length;
  return {
    empresa,
    regime,
    abas: ABAS_DO_CADASTRO.map(a => ({ ...a, ativa: a.id === aba, pendente: vivo.carregada ? falta(a.id) : 0 })),
    aba,
    abaAberta: ABAS_DO_CADASTRO.find(a => a.id === aba) || null,
    resumo: {
      carregado: vivo.carregada,
      cnpj: c.cnpj ? empresas.cadastro.cnpjFormatado(c.cnpj) : '',
      itens,
      completos: itens.filter(i => i.tem).length,
    },
    irPara: (id: string) => navegar(caminhoDoCadastro(rota, id), { replace: true }),
    fechar: () => navegar(caminhoDoCadastro(null)),
  };
}
