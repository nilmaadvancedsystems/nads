// ViewModel do Importar códigos do Simples (03/11/2026: "preciso que baseado nesses docx, pegue e coloque o codigo de
// acesso do simples no cadastro, nos docx está nomeado como codigo de acesso"): solta os relatórios do Fiscal em Word
// (.docx); de cada empresa, o CNPJ acha a empresa pelo cadastro do Entregas (clientes.documento → o código do ERP), como
// no Importar certificados (o "Código:" do relatório nem sempre é o do ERP, então só vale quando o nome bate); o que já
// está no cofre diz se é novo, igual ou troca. Guardar põe o código de acesso e o CPF na empresa (embaralhado; a senha
// gov.br, o certificado e a observação do Simples ficam).
import { cofre as c, empresas, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useGmailDoEntregas } from '../../dados/repo';
import type { EmpresaDoCertificado } from './useImportarCertificados';
import type { VmCofre } from './useCofre';

export type SituacaoDoCodigo = 'lendo' | 'novo' | 'igual' | 'troca';

export interface CodigoNaFila extends c.CodigoDoSimplesDoRelatorio {
  id: string;
  /** a empresa do nads (null = não achada: escolher) */
  alvo: EmpresaDoCertificado | null;
  situacao: SituacaoDoCodigo;
  /** o código que já estava no cofre, quando é troca */
  antes: string;
}

// o nome sem acento, sem pontuação e sem LTDA/ME/EPP, para ver se o "Código:" do relatório é mesmo o da empresa
const chave = (s: string) => formatos.slug(s).replace(/-(ltda|me|epp|eireli|s-a|sa|mei)(?=-|$)/g, '').replace(/-/g, '');
const mesmoNome = (a: string, b: string) => { const x = chave(a); const y = chave(b); return !!x && !!y && (x.startsWith(y.slice(0, 10)) || y.startsWith(x.slice(0, 10))); };

export function useImportarCodigosDoSimples(cofre: VmCofre) {
  const gmail = useGmailDoEntregas();
  const { toast } = useRetorno();
  const clientes = gmail.clientes().lista;
  const todas = empresas.EMPRESAS_COM_DP;
  const [fila, setFila] = useState<CodigoNaFila[]>([]);
  const [semCodigo, setSemCodigo] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  /** a empresa do nads: pelo CNPJ no cadastro do Entregas; senão pelo "Código:" do relatório, se o nome bater */
  function alvoDe(x: c.CodigoDoSimplesDoRelatorio): EmpresaDoCertificado | null {
    const cli = x.cnpj ? clientes.find(k => k.documento === x.cnpj) : undefined;
    const cod = cli && cli.codigo ? Number(cli.codigo) : NaN;
    if (Number.isFinite(cod)) {
      const e = todas.find(y => y.codigo === cod);
      return e ? { nome: e.nome, codigo: e.codigo } : { nome: cli!.nome, codigo: cod };
    }
    const e = x.codigo != null ? todas.find(y => y.codigo === x.codigo) : undefined;
    return e && mesmoNome(e.nome, x.empresa) ? { nome: e.nome, codigo: e.codigo } : null;
  }

  // o que já está no cofre: novo, igual ou troca (lê embaralhado e compara aqui, no navegador)
  async function conferir(itens: CodigoNaFila[]) {
    for (const x of itens) {
      if (!x.alvo) continue;
      const atual = await cofre.ler(x.alvo.nome).catch(() => null);
      const antes = atual?.simples?.codigo || '';
      const situacao: SituacaoDoCodigo = !antes ? 'novo' : antes === x.acesso ? 'igual' : 'troca';
      setFila(f => f.map(y => (y.id === x.id ? { ...y, situacao, antes } : y)));
    }
  }

  // os clientes do Entregas chegaram depois: tenta de novo os que ficaram sem empresa
  useEffect(() => {
    const achados: CodigoNaFila[] = [];
    setFila(f => f.map(x => {
      if (x.alvo) return x;
      const alvo = alvoDe(x);
      if (!alvo) return x;
      const y = { ...x, alvo, situacao: 'lendo' as const };
      achados.push(y);
      return y;
    }));
    if (achados.length) void conferir(achados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length]);

  const prontos = fila.filter(x => x.alvo && (x.situacao === 'novo' || x.situacao === 'troca'));
  return {
    fila,
    semCodigo,
    guardando,
    empresas: todas,
    prontos: prontos.length,
    contagem: {
      novo: fila.filter(x => x.alvo && x.situacao === 'novo').length, troca: fila.filter(x => x.situacao === 'troca').length,
      igual: fila.filter(x => x.situacao === 'igual').length, semEmpresa: fila.filter(x => !x.alvo).length,
    },
    async adicionar(arquivos: readonly File[]) {
      const novos: CodigoNaFila[] = [];
      const sem: string[] = [];
      for (const f of arquivos) {
        if (!/\.docx$/i.test(f.name)) { toast(f.name + ' não é .docx.'); continue; }
        const r = c.lerCodigosDoSimples(await f.arrayBuffer());
        if (r.erro) { toast(f.name + ': ' + r.erro); continue; }
        sem.push(...r.semCodigo);
        for (const x of r.itens) {
          const alvo = alvoDe(x);
          novos.push({ ...x, id: (x.cnpj || x.empresa) + '|' + f.name, alvo, situacao: alvo ? 'lendo' : 'novo', antes: '' });
        }
      }
      // a mesma empresa em dois relatórios (ou já na fila): fica a primeira
      const ja = new Set(fila.map(x => x.cnpj || x.empresa));
      const unicos = novos.filter(x => { const k = x.cnpj || x.empresa; if (ja.has(k)) return false; ja.add(k); return true; });
      setFila(f => [...f, ...unicos].sort((a, b) => (a.alvo?.codigo ?? 1e9) - (b.alvo?.codigo ?? 1e9) || a.empresa.localeCompare(b.empresa, 'pt-BR')));
      setSemCodigo(s => [...new Set([...s, ...sem])]);
      if (!unicos.length && !sem.length) toast('Não achei nenhum "Código de Acesso" nesses arquivos.');
      void conferir(unicos);
    },
    escolherEmpresa(id: string, e: EmpresaDoCertificado) {
      const x = fila.find(y => y.id === id);
      if (!x) return;
      const y = { ...x, alvo: e, situacao: 'lendo' as const };
      setFila(f => f.map(z => (z.id === id ? y : z)));
      void conferir([y]);
    },
    tirar(id: string) { setFila(f => f.filter(x => x.id !== id)); },
    /** guarda os novos e as trocas, cada um na empresa dele (o resto dos segredos fica como está no banco) */
    async guardar() {
      if (guardando || !prontos.length) return;
      setGuardando(true);
      let n = 0;
      try {
        for (const x of prontos) {
          const e = x.alvo as EmpresaDoCertificado;
          await cofre.mudar(e.nome, e.codigo, atual => ({ ...atual, simples: { ...atual.simples, codigo: x.acesso, ...(x.cpf ? { cpf: x.cpf } : {}) } }), false);
          n++;
          setFila(f => f.map(y => (y.id === x.id ? { ...y, situacao: 'igual', antes: '' } : y)));
        }
        toast(n + (n === 1 ? ' código guardado' : ' códigos guardados') + ' no cofre.');
      } catch (err) { toast('Parou no meio (' + n + ' guardados): ' + (err instanceof Error ? err.message : String(err))); } finally { setGuardando(false); }
    },
  };
}
