// Lint do nads: além do básico, segura as camadas do MVVM.
// Se precisar furar uma regra daqui, a estrutura está errada: mova o código, não o lint.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-tipos/**', '**/node_modules/**', '.claude/**', 'docs/**', '**/__legado__/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // scripts de Node da raiz (a trava sem-rede)
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } },
  },
  {
    // Model: TypeScript puro — não conhece React nem tela
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-*', '@nads/ui', '@nads/web'], message: 'O core (Model) não conhece React nem tela.' }] }],
    },
  },
  {
    // ui: design compartilhado — sem regra de domínio
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: '@nads/core/conferencia', message: 'O ui não conhece domínio: só formatos.' }] }],
    },
  },
  {
    // ViewModel: estado e ações — nada de DOM
    files: ['apps/web/src/**/use*.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'document', message: 'ViewModel não mexe no DOM (isso é da View).' }],
    },
  },
  {
    // View: desenha o que o hook devolve — não fala com o repositório
    files: ['apps/web/src/modulos/**/*.tsx'],
    ignores: ['apps/web/src/modulos/**/sessao.tsx', 'apps/web/src/modulos/**/EmpresaAberta.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/dados/repo'], message: 'View não fala com o repositório: use o hook da tela.' }] }],
    },
  },
);
