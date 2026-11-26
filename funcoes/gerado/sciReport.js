// GERADO — NÃO EDITE. Feito por scripts/funcoes-sci.mjs a partir de packages/core/src/areaCliente/sciReport*.ts.
// Mudou alguma dessas fontes? Rode `node scripts/funcoes-sci.mjs` e commite este arquivo junto.
//#region packages/core/src/areaCliente/guias.ts
const ROTULO_DA_SITUACAO_DA_GUIA = {
	"a vencer": "A vencer",
	"vence hoje": "Vence hoje",
	vencida: "Vencida"
};
function dataDoVencimento(vencimento) {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(vencimento);
	if (!m) return null;
	const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
	return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}
function situacaoDaGuia(vencimento, hoje) {
	const v = dataDoVencimento(vencimento);
	if (!v) return "a vencer";
	const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
	return v.getTime() > h ? "a vencer" : v.getTime() === h ? "vence hoje" : "vencida";
}

//#endregion
//#region packages/core/src/areaCliente/sciReport.ts
const SCI_AUTH = "https://api-auth.sci.com.br";
const SCI_RELATORIO = "https://api-relatorio.sci.com.br";
const SCI_POR_PAGINA = 200;
const SCI_MARGEM_DO_JWT_MS = 3e5;
const SCI_MESES_NA_AREA = 3;
const objeto = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null;
const texto = (v) => typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const numero = (v) => {
	const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
	return Number.isFinite(n) ? n : NaN;
};
const inteiro = (v) => {
	const n = numero(v);
	return Number.isInteger(n) ? n : NaN;
};
const sim = (v) => v === true || v === 1 || v === "1" || v === "true";
const digitos = (v) => texto(v).replace(/\D/g, "");
function dataDoSci(v) {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(texto(v));
	if (!m) return "";
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return "";
	return m[3] + "/" + m[2] + "/" + m[1];
}
function lerLoginDoSci(resposta, agora) {
	const r = objeto(resposta);
	const token = texto(r?.token);
	if (!token) return null;
	const validade = numero(r?.validade);
	return {
		token,
		expiraEm: agora + (validade > 0 ? validade : 3600) * 1e3
	};
}
function sessaoDoSciVale(s, agora) {
	return !!s && s.expiraEm - agora > 3e5;
}
function sessaoDoSciAindaAceita(s, agora) {
	return !!s && s.expiraEm > agora;
}
function lerEmpresasDoSci(resposta) {
	const lista = objeto(resposta)?.empresas;
	if (!Array.isArray(lista)) return [];
	const saida = [];
	for (const x of lista) {
		const e = objeto(x);
		const empresaId = inteiro(e?.empresaId);
		const cnpj = digitos(e?.numeroDocumento);
		if (Number.isInteger(empresaId) && empresaId > 0 && cnpj) saida.push({
			empresaId,
			nome: texto(e?.nome),
			cnpj
		});
	}
	return saida;
}
function empresaDoSciPeloDocumento(empresas, documento) {
	const d = digitos(documento);
	if (d.length !== 14 && d.length !== 11) return null;
	const iguais = [...new Set(empresas.filter((e) => e.cnpj === d).map((e) => e.empresaId))];
	return iguais.length === 1 ? iguais[0] : null;
}
function competenciaDoSci(mes, ano) {
	const m = inteiro(mes);
	const a = inteiro(ano);
	if (!(a >= 2e3 && a <= 2100) || !(m >= 1 && m <= 13)) return "";
	return a + "-" + String(Math.min(m, 12)).padStart(2, "0");
}
function lerPublicacaoDoSci(x) {
	const p = objeto(x);
	if (!p) return null;
	const publicadosId = inteiro(p.publicadosId);
	const empresaId = inteiro(p.empresaId);
	const competencia = competenciaDoSci(p.mesRef, p.anoRef);
	if (!(publicadosId > 0) || !(empresaId > 0) || !competencia) return null;
	const valor = numero(p.valor);
	const valorPago = numero(p.valorPagamento);
	return {
		publicadosId,
		empresaId,
		competencia,
		tipo: texto(p.tipo),
		relatorioId: texto(p.relatorioId),
		nomeRelatorio: texto(p.nomeRelatorio),
		descricao: texto(p.descricao),
		vencimento: dataDoSci(p.dataVencimento),
		valor: Number.isFinite(valor) ? valor : 0,
		individual: sim(p.individual),
		visualizado: sim(p.visualizado),
		vistoEm: dataDoSci(p.dataHoraPrimeiraVisualizacao),
		pagamentoEm: dataDoSci(p.dataPagamento),
		valorPago: Number.isFinite(valorPago) ? valorPago : 0
	};
}
function lerPaginaDePublicados(resposta) {
	const pub = objeto(objeto(resposta)?.publicados);
	const itens = (Array.isArray(pub?.dados) ? pub.dados : []).map(lerPublicacaoDoSci).filter((p) => !!p);
	const paginaAtual = inteiro(pub?.paginaAtual);
	const ultimaPagina = inteiro(pub?.ultimaPagina);
	return {
		itens,
		paginaAtual: paginaAtual > 0 ? paginaAtual : 1,
		ultimaPagina: ultimaPagina > 0 ? ultimaPagina : 1
	};
}
const referenciaDoSci = (competencia) => competencia.slice(5, 7) + "/" + competencia.slice(0, 4);
function janelaDoSci(hoje, meses = 3) {
	const comp = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
	return {
		de: comp(new Date(hoje.getFullYear(), hoje.getMonth() - Math.max(1, meses) + 1, 1)),
		ate: comp(hoje)
	};
}
function consultaDePublicados(p) {
	const q = new URLSearchParams({
		tipoDocumento: "imposto",
		status: "todos",
		empresaId: String(p.empresaId),
		referenciaInicial: referenciaDoSci(p.de),
		referenciaFinal: referenciaDoSci(p.ate),
		individual: "false",
		page: String(p.pagina ?? 1),
		registrosPorPagina: String(200)
	});
	if (p.publicadosId) q.set("publicadosId", String(p.publicadosId));
	return q.toString();
}
const ROTULO_DA_SITUACAO_DO_SCI = {
	...ROTULO_DA_SITUACAO_DA_GUIA,
	"pagamento informado": "Pagamento informado"
};
function guiaDoSciReport(p, hoje) {
	if (p.individual || !p.vencimento) return null;
	const nome = p.nomeRelatorio || p.descricao || "Guia";
	const base = {
		id: String(p.publicadosId),
		nome,
		competencia: p.competencia,
		vencimento: p.vencimento,
		valor: p.valor
	};
	if (p.pagamentoEm) return {
		...base,
		situacao: "pagamento informado",
		pagamentoEm: p.pagamentoEm,
		...p.valorPago > 0 ? { valorPago: p.valorPago } : {}
	};
	return {
		...base,
		situacao: situacaoDaGuia(p.vencimento, hoje)
	};
}
function guiasDoSciReport(publicacoes, hoje) {
	const porId = /* @__PURE__ */ new Map();
	for (const p of publicacoes) {
		const g = guiaDoSciReport(p, hoje);
		if (g) porId.set(g.id, g);
	}
	const dia = (v) => v.slice(6) + v.slice(3, 5) + v.slice(0, 2);
	const paga = (g) => g.situacao === "pagamento informado" ? 1 : 0;
	return [...porId.values()].sort((a, b) => paga(a) - paga(b) || dia(a.vencimento).localeCompare(dia(b.vencimento)) || a.nome.localeCompare(b.nome));
}
function urlDoPdfDoSci(resposta) {
	const url = texto(objeto(resposta)?.urlPdf);
	return /^https:\/\/[^\s]+$/.test(url) ? url : "";
}
function acessoDaArea(token, link, login) {
	if (!/^[0-9a-f]{40}$/.test(token) || !link?.existe) return "link invalido";
	if (link.exigeSenha !== true) return "liberado";
	return login?.cliente === true && Array.isArray(login.a) && login.a.includes(token) ? "liberado" : "precisa entrar";
}

//#endregion
//#region packages/core/src/areaCliente/sciReportCliente.ts
function publicadosIdDaResposta(resposta) {
	const lista = resposta && typeof resposta === "object" ? resposta.publicados : null;
	const primeiro = Array.isArray(lista) && lista[0] && typeof lista[0] === "object" ? lista[0].publicadosId : 0;
	const n = Number(primeiro);
	return Number.isInteger(n) && n > 0 ? n : 0;
}
var ErroDoSci = class extends Error {
	status;
	constructor(status, mensagem) {
		super(mensagem);
		this.status = status;
		this.name = "ErroDoSci";
	}
};
const MAX_PAGINAS = 10;
function criarClienteSciReport(deps) {
	const agora = deps.agora ?? (() => Date.now());
	let sessao = null;
	const empresas = /* @__PURE__ */ new Map();
	async function json(r) {
		if (r.status === 204) return null;
		try {
			return await r.json();
		} catch {
			return null;
		}
	}
	const mensagemDe = (corpo) => {
		const m = corpo && typeof corpo === "object" ? corpo.mensagem : "";
		return typeof m === "string" && m.trim() ? m.trim().slice(0, 200) : "";
	};
	async function entrar() {
		if (sessaoDoSciAindaAceita(sessao, agora())) {
			const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/refresh", {
				method: "POST",
				headers: { Authorization: "Bearer " + sessao.token }
			});
			const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
			if (nova) return sessao = nova;
		}
		const s = await deps.segredos();
		if (!s.parceiro || !s.cliente) throw new ErroDoSci(0, "faltam os tokens do SCI Report");
		const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/credencial/login", {
			method: "POST",
			headers: { Authorization: "Basic " + btoa(s.parceiro + ":" + s.cliente) }
		});
		const corpo = await json(r);
		const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(corpo, agora()) : null;
		if (!nova) throw new ErroDoSci(r.status, r.status === 401 ? "a SCI recusou os tokens (o de Parceiro ou o de Cliente)" : "o login na SCI não deu certo (" + r.status + ")");
		return sessao = nova;
	}
	async function chamar(metodo, caminho, montarCorpo) {
		for (let vez = 0; vez < 2; vez++) {
			const s = sessaoDoSciVale(sessao, agora()) ? sessao : await entrar();
			const r = await deps.buscar(SCI_RELATORIO + caminho, {
				method: metodo,
				headers: {
					Authorization: "Bearer " + s.token,
					Accept: "application/json"
				},
				...montarCorpo ? { body: montarCorpo() } : {}
			});
			if (r.status === 401 && vez === 0) {
				sessao = null;
				continue;
			}
			const corpo = await json(r);
			if (r.status >= 200 && r.status < 300) return corpo;
			throw new ErroDoSci(r.status, mensagemDe(corpo) || "o SCI Report respondeu " + r.status);
		}
		throw new ErroDoSci(401, "o SCI Report recusou o login");
	}
	return {
		async empresaPeloDocumento(documento) {
			const d = documento.replace(/\D/g, "");
			if (empresas.has(d)) return empresas.get(d) ?? null;
			if (d.length !== 14 && d.length !== 11) return null;
			const formatado = d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
			const id = empresaDoSciPeloDocumento(lerEmpresasDoSci(await chamar("GET", "/api/v1/empresa/busca/?" + new URLSearchParams({ numeroDocumento: formatado }).toString())), d);
			empresas.set(d, id);
			return id;
		},
		async publicacoes(empresaId, de, ate, publicadosId) {
			const todas = [];
			for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
				const p = lerPaginaDePublicados(await chamar("GET", "/api/v1/publicados/busca?" + consultaDePublicados({
					empresaId,
					de,
					ate,
					pagina,
					publicadosId
				})));
				todas.push(...p.itens.filter((x) => x.empresaId === empresaId));
				if (p.paginaAtual >= p.ultimaPagina) break;
			}
			return todas;
		},
		async urlDoPdf(publicadosId, empresaId) {
			const q = new URLSearchParams({
				publicadoId: String(publicadosId),
				empresaId: String(empresaId)
			});
			const url = urlDoPdfDoSci(await chamar("PUT", "/api/v1/publicados/visualiza?" + q.toString()));
			if (!url) throw new ErroDoSci(0, "o SCI Report não devolveu o PDF");
			return url;
		},
		async publicar(campos, pdf, nomeDoArquivo) {
			const id = publicadosIdDaResposta(await chamar("POST", "/api/v1/publicacao-manual", () => {
				const f = new FormData();
				for (const [k, v] of Object.entries(campos)) f.append(k, v);
				f.append("arquivo", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), nomeDoArquivo.replace(/[^\w.-]+/g, "_") || "guia.pdf");
				return f;
			}));
			if (!id) throw new ErroDoSci(0, "o SCI Report não devolveu o número da publicação");
			return id;
		}
	};
}
function criarAtendimentoDaArea(deps) {
	async function conferir(token, idToken) {
		if (!/^[0-9a-f]{40}$/.test(token)) return "link invalido";
		const link = await deps.lerLink(token);
		const login = link?.exigeSenha === true && idToken ? await deps.lerLogin(idToken) : null;
		return acessoDaArea(token, link, login);
	}
	async function empresasDoLink(token) {
		const cfg = deps.config ? await deps.config() : null;
		if (cfg && !cfg.ligado) return null;
		const ligadas = cfg ? new Set(cfg.empresas) : null;
		const empresas = (await deps.lerEmpresas(token)).filter((e) => !ligadas || ligadas.has(Number(e.codigo)));
		const documentos = [...new Set(empresas.map((e) => String(e.cnpj ?? "").replace(/\D/g, "")).filter(Boolean))];
		const ids = [];
		let semEmpresaNoSci = 0;
		for (const d of documentos) {
			const id = await deps.sci.empresaPeloDocumento(d);
			if (id) ids.push(id);
			else semEmpresaNoSci++;
		}
		return {
			ids: [...new Set(ids)],
			semEmpresaNoSci
		};
	}
	return {
		async guias(token, idToken, hoje) {
			const acesso = await conferir(token, idToken);
			if (acesso !== "liberado") return { acesso };
			const doLink = await empresasDoLink(token);
			if (!doLink) return {
				acesso,
				guias: [],
				semEmpresaNoSci: 0,
				desligado: true
			};
			const { ids, semEmpresaNoSci } = doLink;
			const { de, ate } = janelaDoSci(hoje);
			const publicacoes = [];
			for (const id of ids) publicacoes.push(...await deps.sci.publicacoes(id, de, ate));
			return {
				acesso,
				guias: guiasDoSciReport(publicacoes, hoje),
				semEmpresaNoSci
			};
		},
		async pdf(token, idToken, publicadosId, hoje) {
			const acesso = await conferir(token, idToken);
			if (acesso !== "liberado") return { acesso };
			const id = Number(publicadosId);
			if (!Number.isInteger(id) || id <= 0) return { acesso: "guia de outra empresa" };
			const { de, ate } = janelaDoSci(hoje);
			for (const empresaId of (await empresasDoLink(token))?.ids ?? []) if ((await deps.sci.publicacoes(empresaId, de, ate, id)).some((p) => p.publicadosId === id && !p.individual)) return {
				acesso,
				url: await deps.sci.urlDoPdf(id, empresaId)
			};
			return { acesso: "guia de outra empresa" };
		}
	};
}

//#endregion
export { ErroDoSci, criarAtendimentoDaArea, criarClienteSciReport };