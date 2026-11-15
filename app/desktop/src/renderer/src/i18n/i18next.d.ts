import 'i18next';
import type en from './en.json';

// Translation keys are checked at compile time against en.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
