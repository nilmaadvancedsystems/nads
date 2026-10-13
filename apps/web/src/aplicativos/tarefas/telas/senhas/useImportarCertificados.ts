// ViewModel do Importar certificados (07/10/2026: "como já tem o CNPJ nos certificados, quero que ele já puxe e salve
// na empresa correta"): solta vários .pfx; de cada um, o CNPJ (no nome do arquivo e, com a senha, no próprio
// certificado) acha a empresa pelo cadastro do Entregas (clientes.documento → o código do ERP); a senha de cada um lê a
// validade e o titular; Guardar põe cada certificado na empresa dele (embaralhado; a senha gov.br da empresa fica).
import { cofre as c, empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useGmailDoEntregas } from '../../dados/repo';
import type { VmCofre } from './useCofre';

export interface EmpresaDoCertificado { nome: string; codigo: number | null }

export interface CertificadoNaFila {
  id: string;
  nomeArquivo: string;
  arquivo: string;
  senha: string;
  cnpj: string;
  lendo: boolean;
  erro: string;
  validade: string;
  titular: string;
  empresa: EmpresaDoCertificado | null;
  /** a empresa foi escolhida à mão (não troca mais sozinha) */
  escolhida: boolean;
}

export function useImportarCertificados(cofre: VmCofre) {
  const gmail = useGmailDoEntregas();
  const { toast } = useRetorno();
  const clientes = gmail.clientes().lista;
  const [fila, setFila] = useState<CertificadoNaFila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const leituras = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const todas = empresas.EMPRESAS_COM_DP;
  /** a empresa do CNPJ: o cliente do Entregas com esse documento → o código do ERP → a empresa do nads */
  function empresaDoCodigo(codigo: number | null): EmpresaDoCertificado | null {
    const e = codigo != null ? todas.find(x => x.codigo === codigo) : undefined;
    return e ? { nome: e.nome, codigo: e.codigo } : null;
  }
  function empresaDoCnpj(cnpj: string): EmpresaDoCertificado | null {
    if (cnpj.length !== 14) return null;
    const cli = clientes.find(k => k.documento === cnpj);
    if (!cli) return null;
    const cod = Number(cli.codigo);
    const e = Number.isFinite(cod) && cli.codigo ? todas.find(x => x.codigo === cod) : undefined;
    return e ? { nome: e.nome, codigo: e.codigo } : { nome: cli.nome, codigo: Number.isFinite(cod) && cli.codigo ? cod : null };
  }

  // os clientes chegaram depois: tenta de novo os que ficaram sem empresa
  useEffect(() => {
    setFila(f => f.map(x => (x.empresa || x.escolhida ? x : { ...x, empresa: empresaDoCnpj(x.cnpj) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length]);

  const mudar = (id: string, m: Partial<CertificadoNaFila>) => setFila(f => f.map(x => (x.id === id ? { ...x, ...m } : x)));

  function ler(item: CertificadoNaFila, senha: string) {
    const t = leituras.current.get(item.id);
    if (t) clearTimeout(t);
    if (!senha) { mudar(item.id, { lendo: false, erro: '', validade: '', titular: '' }); return; }
    leituras.current.set(item.id, setTimeout(() => {
      mudar(item.id, { lendo: true, erro: '' });
      void c.lerCertificado(item.arquivo, senha).then(r => {
        setFila(f => f.map(x => {
          if (x.id !== item.id || x.senha !== senha) return x;
          if (!r.ok) return { ...x, lendo: false, erro: r.erro, validade: '', titular: '' };
          const cnpj = r.documento.length === 14 ? r.documento : x.cnpj;
          return { ...x, lendo: false, erro: '', validade: r.validade, titular: r.titular + (r.documento ? ':' + r.documento : ''), cnpj,
            empresa: x.escolhida ? x.empresa : empresaDoCnpj(cnpj) || x.empresa };
        }));
      });
    }, 400));
  }

  const prontos = fila.filter(x => x.empresa && x.validade && !x.erro && !x.lendo);
  return {
    fila,
    guardando,
    empresas: todas,
    prontos: prontos.length,
    async adicionar(arquivos: readonly File[]) {
      const novos: CertificadoNaFila[] = [];
      for (const f of arquivos) {
        // o pacote do Toriba (13/10/2026: "exporte o banco de dados do Toriba para o nads, incluindo certificados"): um .json
        // com cada certificado, a senha, o CNPJ e o código do cliente; cada um entra na fila já com a senha e é lido na hora
        if (/\.json$/i.test(f.name)) {
          try {
            const pacote = JSON.parse(await f.text()) as { certificados?: { nome?: string; codigo?: string | number; cnpj?: string; nomeArquivo?: string; arquivo?: string; senha?: string }[] };
            for (const k of pacote.certificados || []) {
              if (!k.arquivo) continue;
              const cnpj = String(k.cnpj || '').replace(/\D/g, '');
              const codigo = k.codigo != null && String(k.codigo).trim() !== '' && Number.isFinite(Number(k.codigo)) ? Number(k.codigo) : null;
              novos.push({ id: 'toriba|' + (k.nomeArquivo || cnpj) + '|' + Math.random().toString(36).slice(2, 8), nomeArquivo: k.nomeArquivo || ((k.nome || 'certificado') + '_' + cnpj + '.pfx'),
                arquivo: k.arquivo, senha: k.senha || '', cnpj, lendo: false, erro: '', validade: '', titular: '', empresa: empresaDoCnpj(cnpj) || empresaDoCodigo(codigo), escolhida: false });
            }
          } catch { toast('Não consegui ler o pacote ' + f.name + '.'); }
          continue;
        }
        if (!/\.(pfx|p12)$/i.test(f.name)) continue;
        const cnpj = c.cnpjDoNomeDoArquivo(f.name);
        novos.push({ id: f.name + '|' + f.size + '|' + Math.random().toString(36).slice(2, 8), nomeArquivo: f.name, arquivo: c.paraBase64(await f.arrayBuffer()),
          senha: '', cnpj, lendo: false, erro: '', validade: '', titular: '', empresa: empresaDoCnpj(cnpj), escolhida: false });
      }
      if (!novos.length) toast('Escolha arquivos .pfx ou .p12, ou o pacote do Toriba (.json).');
      setFila(f => [...f, ...novos]);
      // os que já vieram com a senha (o pacote do Toriba): lê cada um logo (a validade, o titular e se a senha abre)
      for (const x of novos) if (x.senha) ler(x, x.senha);
    },
    senha(id: string, senha: string) {
      const item = fila.find(x => x.id === id);
      if (!item) return;
      mudar(id, { senha });
      ler(item, senha);
    },
    escolherEmpresa(id: string, e: EmpresaDoCertificado) { mudar(id, { empresa: e, escolhida: true }); },
    tirar(id: string) { setFila(f => f.filter(x => x.id !== id)); },
    /** guarda cada certificado lido na empresa dele (a senha gov.br que já estiver lá fica) */
    async guardar() {
      if (guardando || !prontos.length) return;
      setGuardando(true);
      let n = 0;
      try {
        for (const x of prontos) {
          const e = x.empresa as EmpresaDoCertificado;
          const atual = (await cofre.ler(e.nome)) || {};
          await cofre.salvar(e.nome, e.codigo, { ...atual, certificado: { nomeArquivo: x.nomeArquivo, arquivo: x.arquivo, senha: x.senha, validade: x.validade, ...(x.titular ? { titular: x.titular } : {}) } }, false);
          n++;
          setFila(f => f.filter(y => y.id !== x.id));
        }
        toast(n + (n === 1 ? ' certificado guardado' : ' certificados guardados') + ' no cofre.');
      } catch (err) { toast('Parou no meio: ' + (err instanceof Error ? err.message : String(err))); } finally { setGuardando(false); }
    },
  };
}
