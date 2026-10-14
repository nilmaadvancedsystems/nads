// ViewModel da Nova empresa (Vitor, 07/10/2026: "um cadastro de empresas sem o botão de cadastrar empresa"): o código do
// ERP, o nome e o regime. Grava o cadastro da empresa (marcada como cadastrada pelo nads) e abre a janela dela.
// Pelo CNPJ (13/10/2026: "coloca o cadastro por CNPJ via Receita"): a consulta preenche o nome e, no Simples ou no
// MEI, o regime; fora do Simples, a pessoa escolhe Presumido ou Real. O CNPJ fica no cadastro.
import { empresas, formatos } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoCadastro } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { empresasNovas } from '../../../dados/fonte';
import { consultarCnpj } from '../../../dados/receita';
import { useGravarCadastro } from '../../../dados/repo';

export const REGIMES = empresas.cadastro.REGIMES;

export function useNovaEmpresa(fechar: () => void) {
  const gravar = useGravarCadastro();
  const navegar = useNavigate();
  const por = useOperador().operador?.nome || '';
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [regime, setRegime] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [receita, setReceita] = useState<empresas.cadastro.DadosDaReceita | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [avisoReceita, setAvisoReceita] = useState('');
  const [erros, setErros] = useState<string[]>([]);

  async function buscar() {
    if (consultando) return;
    setConsultando(true);
    setAvisoReceita('');
    try {
      const d = await consultarCnpj(cnpj);
      setReceita(d);
      setCnpj(empresas.cadastro.cnpjFormatado(d.cnpj));
      setNome(d.razaoSocial);
      if (d.regime) setRegime(d.regime);
    } catch (err) {
      setReceita(null);
      setAvisoReceita(err instanceof Error ? err.message : String(err));
    } finally {
      setConsultando(false);
    }
  }
  /** o que a Receita disse, numa linha (a situação, o regime, a atividade e a cidade) */
  const resumoDaReceita = receita ? [
    receita.situacao && receita.situacao !== 'ATIVA' ? 'Atenção: ' + receita.situacao : receita.situacao,
    receita.regime || 'Fora do Simples: escolha Presumido ou Real',
    receita.cnae ? receita.cnae + ' ' + receita.cnaeDescricao : '',
    receita.municipio ? receita.municipio + '/' + receita.uf : '',
  ].filter(Boolean).join(' · ') : '';
  const [salvando, setSalvando] = useState(false);

  async function cadastrar() {
    const n = nome.trim().toUpperCase();
    const cod = codigo.trim() ? Number(codigo.trim()) : null;
    const lista = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()];
    const problemas = [
      !n ? 'Falta o nome.' : '',
      cod != null && lista.some(e => e.codigo === cod) ? 'Já tem empresa com o código ' + cod + '.' : '',
      n && lista.some(e => formatos.slug(e.nome) === formatos.slug(n)) ? 'Já tem empresa com esse nome.' : '',
      !regime ? 'Escolha o regime.' : '',
    ].filter(Boolean);
    setErros(problemas);
    if (problemas.length) return;
    setSalvando(true);
    try {
      await gravar(n, cod, () => empresas.cadastro.cadastrarEmpresa(n, cod, regime, por, new Date(), receita?.cnpj || ''));
      fechar();
      navegar(caminhoDoCadastro(empresas.rotaDaEmpresa({ codigo: cod, nome: n, regime })));
    } finally {
      setSalvando(false);
    }
  }

  return {
    codigo, setCodigo, nome, setNome, regime, setRegime, erros, salvando, cadastrar, regimes: REGIMES,
    cnpj, setCnpj: (v: string) => { setCnpj(v); setReceita(null); setAvisoReceita(''); },
    buscar, consultando, avisoReceita, resumoDaReceita, receitaAtiva: !receita || receita.situacao === 'ATIVA',
  };
}
