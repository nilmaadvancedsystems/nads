// O registro de alterações no banco (22/11/2026, ficha E20): as últimas 300 linhas da auditoria, uma leitura ao abrir.
import { usuarios as u } from '@nads/core';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { bancoDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { RepoDoRegistro } from './registro';

export function criarRegistroFirestore(): RepoDoRegistro {
  return {
    async ultimas() {
      try {
        const s = await getDocs(query(collection(bancoDoEntregas(), 'auditoria'), orderBy('quando', 'desc'), limit(300)));
        return s.docs.map(d => u.linhaDaAuditoria(d.id, d.data())).filter((x): x is u.LinhaDaAuditoria => !!x);
      } catch (e) {
        throw new Error(/permission/i.test(String((e as { code?: string }).code ?? e)) ? 'O banco não deixou ler o registro (só o admin e os diretores leem).' : 'Não deu para ler o registro agora. Tente de novo.', { cause: e });
      }
    },
  };
}
