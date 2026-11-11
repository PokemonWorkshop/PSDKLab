import base from '@psdk-lab/eslint-config';

export default [
  ...base,
  {
    // The core's main entry runs Node code: bundled in the page, it breaks the
    // renderer. Types are fine; values come from "@psdk-lab/core/constants".
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@psdk-lab/core',
              message: 'Renderer: import types only, or use @psdk-lab/core/constants.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];
