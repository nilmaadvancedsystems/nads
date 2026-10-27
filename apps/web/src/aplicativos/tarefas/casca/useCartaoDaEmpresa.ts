// ViewModel do cartão da empresa aberta no cabeçalho (CartaoDaEmpresa) e da janela flutuante com os dados dela (27/10/2026:
// "quando eu clicar e para abrir uma janela flutuante dos dados da empresa não ir para o cadastro"): o nome, o código e o
// CNPJ (o do Cadastro ou o do Entregas), o regime, os responsáveis e o que o Entregas e a Receita têm dela. Só ler; quem
// mexe no Cadastro tem, no pé da janela, o atalho para lá.
import { empresas, tarefas } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCadastro, useDadosDaEmpresaNoEntregas } from '../dados/repo';
import { caminhoDoCadastro, podeMexerNoCadastro } from './navegacao';
import { useOperador } from './operador';

export function useCartaoDaEmpresa(empresa: { codigo: number | null; nome: string; rota: string }) {
  const navegar = useNavigate();
  const op = useOperador().operador;
  const c = useCadastro(empresa.nome, empresa.codigo);
  const doEntregas = useDadosDaEmpresaNoEntregas(empresa.codigo);
  const [aberta, setAberta] = useState(false);
  const d = doEntregas.dados;
  const r = d?.receita || null;
  const cnpj = c.cadastro.cnpj || d?.documento || '';
  const tipoDoc = cnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';
  const docFormatado = cnpj ? empresas.cadastro.cnpjFormatado(cnpj) : '';
  const regime = (c.cadastro.regime as string | undefined) || tarefas.regimeDaEmpresa(empresa.codigo) || '';
  const resp = c.cadastro.responsaveis || {};
  // as datas da Receita vêm em aaaa-mm-dd: na tela, dd/mm/aaaa
  const data = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : v);
  // as linhas da janela (o código e o CNPJ ficam no alto): só as que têm valor
  const linhas = [
    { rotulo: 'Razão social', valor: r?.razaoSocial && r.razaoSocial !== empresa.nome ? r.razaoSocial : '' },
    { rotulo: 'Nome fantasia', valor: d?.nomeFantasia || '' },
    { rotulo: 'Regime', valor: regime },
    { rotulo: 'Inscrição estadual', valor: d?.inscricaoEstadual || '' },
    { rotulo: 'Situação na Receita', valor: r?.situacao ? r.situacao + (r.situacaoDesde ? ' desde ' + data(r.situacaoDesde) : '') : '' },
    { rotulo: 'Atividade', valor: r?.cnaeDescricao ? (r.cnae ? r.cnae + ' · ' : '') + r.cnaeDescricao : '' },
    { rotulo: 'Abertura', valor: r?.abertura ? data(r.abertura) : '' },
    { rotulo: 'Endereço', valor: d?.endereco ? d.endereco + (d.cidade ? ' · ' + d.cidade : '') : r?.endereco || '' },
    { rotulo: 'Sócios', valor: (c.cadastro.socios || []).map(s => s.nome).join(', ') || (r?.socios || []).join(', ') },
    { rotulo: 'Responsável no Contábil', valor: resp.contabil || '' },
    { rotulo: 'Responsável no Fiscal', valor: resp.fiscal || '' },
  ].filter(l => l.valor);
  const pode = podeMexerNoCadastro(op);
  return {
    nome: empresa.nome,
    doc: [empresa.codigo != null ? 'Código ' + empresa.codigo : '', docFormatado ? tipoDoc + ' ' + docFormatado : ''].filter(Boolean).join(' · '),
    aberta, abrir: () => setAberta(true), fechar: () => setAberta(false),
    carregando: !c.carregada || !doEntregas.carregado,
    linhas,
    /** o atalho para o Cadastro, no pé da janela (só quem mexe nele) */
    podeEditar: pode,
    editar: () => { setAberta(false); navegar(caminhoDoCadastro(empresa.rota)); },
  };
}
