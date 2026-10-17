// ViewModel da aba Guias e obrigações (Vitor, 16/10/2026): as guias por mês, as mais novas primeiro, o baixar do PDF e o
// copiar da linha digitável; as guias já pagas no mês com o comprovante; o certificado digital e os avisos do escritório.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { situacaoDoCertificado } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useGuias({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const meses = ac.guiasPorCompetencia(ac.guiasDeHoje(area.guias, hoje));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  async function comprovante(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  return {
    meses, baixando, baixar, vazio: area.guias.length === 0, codigos: area.codigos,
    pagas: area.pagas, comprovante,
    certificado: area.certificado ? { ...area.certificado, ...situacaoDoCertificado(area.certificado, hoje) } : null,
    avisos: area.avisos, irPara, copiar,
  };
}
