declare module 'convert-gitmoji' {
  function convert(content: string, withSpace?: boolean | 'leading' | 'trailing' | 'both'): string;

  export { convert };
}
