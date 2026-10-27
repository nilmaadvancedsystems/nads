// ViewModel do cartão da empresa aberta no cabeçalho (CartaoDaEmpresa): o nome, o código e o CNPJ (o do Cadastro ou o do
// Entregas) e o abrir do Cadastro, para quem mexe nele.
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useCadastro, useDadosDaEmpresaNoEntregas } from '../dados/repo';
import { caminhoDoCadastro, podeMexerNoCadastro } from './navegacao';
import { useOperador } from './operador';

export function useCartaoDaEmpresa(empresa: { codigo: number | null; nome: string; rota: string }) {
  const navegar = useNavigate();
  const op = useOperador().operador;
  const c = useCadastro(empresa.nome, empresa.codigo);
  const doEntregas = useDadosDaEmpresaNoEntregas(empresa.codigo);
  const cnpj = c.cadastro.cnpj || doEntregas.dados?.documento || '';
  const pode = podeMexerNoCadastro(op);
  return {
    nome: empresa.nome,
    doc: [empresa.codigo != null ? 'Código ' + empresa.codigo : '', cnpj ? (cnpj.replace(/\D/g, '').length === 11 ? 'CPF ' : 'CNPJ ') + empresas.cadastro.cnpjFormatado(cnpj) : ''].filter(Boolean).join(' · '),
    pode,
    abrir: () => { if (pode) navegar(caminhoDoCadastro(empresa.rota)); },
  };
}
