// ViewModel da Nova empresa (Vitor, 07/10/2026: "um cadastro de empresas sem o botão de cadastrar empresa"): o código do
// ERP, o nome e o regime. Grava o cadastro da empresa (marcada como cadastrada pelo nads) e abre a janela dela.
import { empresas, formatos } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoCadastro } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { empresasNovas } from '../../../dados/fonte';
import { useGravarCadastro } from '../../../dados/repo';

export const REGIMES = ['Simples', 'Presumido', 'Real', 'Isentas', 'Física', 'Domésticas', 'MEI'] as const;

export function useNovaEmpresa(fechar: () => void) {
  const gravar = useGravarCadastro();
  const navegar = useNavigate();
  const por = useOperador().operador?.nome || '';
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [regime, setRegime] = useState('');
  const [erros, setErros] = useState<string[]>([]);
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
      await gravar(n, cod, () => empresas.cadastro.cadastrarEmpresa(n, cod, regime, por, new Date()));
      fechar();
      navegar(caminhoDoCadastro(empresas.rotaDaEmpresa({ codigo: cod, nome: n, regime })));
    } finally {
      setSalvando(false);
    }
  }

  return { codigo, setCodigo, nome, setNome, regime, setRegime, erros, salvando, cadastrar, regimes: REGIMES };
}
