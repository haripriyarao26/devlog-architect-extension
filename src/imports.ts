/**
 * Collect ES module import specifiers (package or relative paths) from source text.
 */
export function extractImportSpecifiers(source: string): string[] {
  const found = new Set<string>();

  const fromImport =
    /import\s+(?:type\s+)?(?:[\w*{}\s,/$]+?\s+from\s+)?["']([^"']+)["']\s*;?/g;
  let m: RegExpExecArray | null;
  while ((m = fromImport.exec(source)) !== null) {
    found.add(m[1]);
  }

  const sideEffect = /^import\s+["']([^"']+)["']\s*;?/gm;
  while ((m = sideEffect.exec(source)) !== null) {
    found.add(m[1]);
  }

  const dynamicImport = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynamicImport.exec(source)) !== null) {
    found.add(m[1]);
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}
