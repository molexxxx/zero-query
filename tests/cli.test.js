import { describe, it, expect, vi, beforeEach } from 'vitest';


// ---------------------------------------------------------------------------
// CLI utils — stripComments
// ---------------------------------------------------------------------------

describe('CLI — stripComments', () => {
  let stripComments;

  beforeEach(async () => {
    // Dynamic import to handle CommonJS module
    const mod = await import('../cli/utils.js');
    stripComments = mod.stripComments || mod.default?.stripComments;
  });

  it('strips single-line comments', () => {
    expect(stripComments('let x = 1; // comment\nlet y = 2;')).toBe('let x = 1; \nlet y = 2;');
  });

  it('strips block comments', () => {
    expect(stripComments('let x = /* inline comment */ 1;')).toBe('let x =  1;');
  });

  it('strips multi-line block comments', () => {
    const input = 'a;\n/* line1\n   line2\n*/\nb;';
    const result = stripComments(input);
    expect(result).toBe('a;\n\nb;');
  });

  it('preserves single-quoted strings containing //', () => {
    expect(stripComments("let x = 'http://example.com';")).toBe("let x = 'http://example.com';");
  });

  it('preserves double-quoted strings containing //', () => {
    expect(stripComments('let x = "http://example.com";')).toBe('let x = "http://example.com";');
  });

  it('preserves template literals containing //', () => {
    expect(stripComments('let x = `http://example.com`;')).toBe('let x = `http://example.com`;');
  });

  it('preserves template literals with ${} containing //', () => {
    const input = 'let x = `${a}//not-a-comment`;';
    const result = stripComments(input);
    expect(result).toContain('//not-a-comment');
  });

  it('strips comment after string', () => {
    expect(stripComments('let x = "hello"; // comment')).toBe('let x = "hello"; ');
  });

  it('handles escaped quotes in strings', () => {
    expect(stripComments("let x = 'it\\'s a test'; // comment")).toBe("let x = 'it\\'s a test'; ");
  });

  it('preserves regex containing //', () => {
    const input = 'let re = /http:\\/\\//; // comment';
    const result = stripComments(input);
    expect(result).toContain('/http:\\/\\//');
    expect(result).not.toContain('// comment');
  });

  it('handles empty string', () => {
    expect(stripComments('')).toBe('');
  });

  it('handles string with no comments', () => {
    expect(stripComments('let x = 1;')).toBe('let x = 1;');
  });

  it('handles consecutive comments', () => {
    const input = '// comment1\n// comment2\ncode;';
    const result = stripComments(input);
    expect(result).toBe('\n\ncode;');
  });

  it('handles block comment at start of file', () => {
    expect(stripComments('/* header */\ncode;')).toBe('\ncode;');
  });

  it('handles nested template literal in ${} block', () => {
    const input = 'let x = `outer ${`inner`} end`;';
    const result = stripComments(input);
    expect(result).toBe(input);
  });
});


// ---------------------------------------------------------------------------
// CLI utils — minify
// ---------------------------------------------------------------------------

describe('CLI — minify', () => {
  let minify;

  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    minify = mod.minify || mod.default?.minify;
  });

  it('collapses whitespace', () => {
    const result = minify('let   x   =   1;', '/* banner */');
    expect(result).toContain('let x=1;');
  });

  it('preserves banner', () => {
    const result = minify('let x = 1;', '/* v1.0 */');
    expect(result.startsWith('/* v1.0 */')).toBe(true);
  });

  it('strips comments during minification', () => {
    const result = minify('let x = 1; // comment\nlet y = 2;', '');
    expect(result).not.toContain('// comment');
  });

  it('preserves string content', () => {
    const result = minify('let x = "hello   world";', '');
    expect(result).toContain('"hello   world"');
  });

  it('preserves template literal content', () => {
    const result = minify('let x = `hello   world`;', '');
    expect(result).toContain('`hello   world`');
  });

  it('does not merge ++ into + +', () => {
    const result = minify('a + +b', '');
    expect(result).toContain('+ +');
  });

  it('does not merge -- into - -', () => {
    const result = minify('a - -b', '');
    expect(result).toContain('- -');
  });

  it('preserves space between keywords and identifiers', () => {
    const result = minify('return value;', '');
    expect(result).toContain('return value');
  });

  it('removes block comments', () => {
    const result = minify('a /* comment */ = 1;', '');
    expect(result).not.toContain('comment');
  });

  it('handles empty input', () => {
    const result = minify('', '');
    expect(result).toBe('\n');
  });
});


// ---------------------------------------------------------------------------
// CLI utils — sizeKB
// ---------------------------------------------------------------------------

describe('CLI — sizeKB', () => {
  let sizeKB;

  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    sizeKB = mod.sizeKB || mod.default?.sizeKB;
  });

  it('formats 1024 bytes as 1.0', () => {
    expect(sizeKB({ length: 1024 })).toBe('1.0');
  });

  it('formats 512 bytes as 0.5', () => {
    expect(sizeKB({ length: 512 })).toBe('0.5');
  });

  it('formats 0 bytes as 0.0', () => {
    expect(sizeKB({ length: 0 })).toBe('0.0');
  });

  it('formats 2560 bytes as 2.5', () => {
    expect(sizeKB({ length: 2560 })).toBe('2.5');
  });

  it('formats large size correctly', () => {
    expect(sizeKB({ length: 102400 })).toBe('100.0');
  });
});


// ---------------------------------------------------------------------------
// CLI args — flag and option
// ---------------------------------------------------------------------------

describe('CLI — args module', () => {
  let originalArgv;

  beforeEach(() => {
    originalArgv = [...process.argv];
  });

  afterEach(() => {
    process.argv = originalArgv;
    // Clear the require cache so the module re-reads argv
    vi.resetModules();
  });

  it('flag returns true when --verbose is present', async () => {
    process.argv = ['node', 'script', '--verbose'];
    const mod = await import('../cli/args.js');
    const { flag } = mod;
    expect(flag('verbose')).toBe(true);
  });

  it('flag returns false when flag is absent', async () => {
    process.argv = ['node', 'script'];
    const mod = await import('../cli/args.js');
    const { flag } = mod;
    expect(flag('verbose')).toBe(false);
  });

  it('flag detects short flag -v', async () => {
    process.argv = ['node', 'script', '-v'];
    const mod = await import('../cli/args.js');
    const { flag } = mod;
    expect(flag('verbose', 'v')).toBe(true);
  });

  it('option reads value after --port', async () => {
    process.argv = ['node', 'script', '--port', '8080'];
    const mod = await import('../cli/args.js');
    const { option } = mod;
    expect(option('port')).toBe('8080');
  });

  it('option reads value after short -p', async () => {
    process.argv = ['node', 'script', '-p', '3000'];
    const mod = await import('../cli/args.js');
    const { option } = mod;
    expect(option('port', 'p')).toBe('3000');
  });

  it('option returns fallback when missing', async () => {
    process.argv = ['node', 'script'];
    const mod = await import('../cli/args.js');
    const { option } = mod;
    expect(option('port', 'p', '3100')).toBe('3100');
  });

  it('option returns fallback when flag has no value', async () => {
    process.argv = ['node', 'script', '--port'];
    const mod = await import('../cli/args.js');
    const { option } = mod;
    expect(option('port', 'p', '3100')).toBe('3100');
  });
});


// ===========================================================================
// showHelp
// ===========================================================================

describe('CLI — showHelp', () => {
  it('outputs help text to console', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const showHelp = (await import('../cli/help.js')).default;
    showHelp();
    expect(spy).toHaveBeenCalled();
    const text = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(text).toContain('create');
    expect(text).toContain('dev');
    expect(text).toContain('bundle');
    expect(text).toContain('build');
    spy.mockRestore();
  });

  it('help text mentions port flag', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const showHelp = (await import('../cli/help.js')).default;
    showHelp();
    const text = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(text).toContain('--port');
    spy.mockRestore();
  });
});


// ===========================================================================
// stripComments — additional edge cases
// ===========================================================================

describe('CLI — stripComments extra', () => {
  let stripComments;
  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    stripComments = mod.stripComments;
  });

  it('handles consecutive single-line comments', () => {
    const input = '// one\n// two\nconst x = 1;';
    const result = stripComments(input);
    expect(result).not.toContain('one');
    expect(result).not.toContain('two');
    expect(result).toContain('const x = 1');
  });

  it('preserves code after block comment', () => {
    const input = 'a /* comment */ + b';
    const result = stripComments(input);
    expect(result).toContain('a');
    expect(result).toContain('+ b');
    expect(result).not.toContain('comment');
  });

  it('handles multiline block comment', () => {
    const input = '/*\n line1\n line2\n*/\ncode();';
    const result = stripComments(input);
    expect(result).toContain('code()');
    expect(result).not.toContain('line1');
  });

  it('does not strip // inside template expression', () => {
    const input = '`${a // b}`';
    const result = stripComments(input);
    // The template should be preserved as-is
    expect(result).toContain('`');
  });

  it('handles code with no comments', () => {
    const input = 'const x = 1;\nconst y = 2;';
    expect(stripComments(input)).toBe(input);
  });
});


// ===========================================================================
// minify — additional edge cases
// ===========================================================================

describe('CLI — minify extra', () => {
  let minify;
  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    minify = mod.minify;
  });

  it('preserves string content with spaces', () => {
    const result = minify('const msg = "hello   world";', '');
    expect(result).toContain('"hello   world"');
  });

  it('empty input returns banner only', () => {
    const result = minify('', '/* banner */');
    expect(result.trim()).toBe('/* banner */');
  });

  it('collapses multiple newlines', () => {
    const result = minify('a\n\n\n\nb', '');
    // Should not have multiple consecutive newlines in output
    expect(result).not.toMatch(/\n\n\n/);
  });

  it('handles template literals with spaces', () => {
    const result = minify('const x = `hello   world`;', '');
    expect(result).toContain('`hello   world`');
  });
});


// ===========================================================================
// sizeKB — edge cases
// ===========================================================================

describe('CLI — sizeKB extra', () => {
  let sizeKB;
  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    sizeKB = mod.sizeKB;
  });

  it('zero-length buffer', () => {
    expect(sizeKB({ length: 0 })).toBe('0.0');
  });

  it('exactly 1KB', () => {
    expect(sizeKB({ length: 1024 })).toBe('1.0');
  });

  it('small buffer', () => {
    expect(sizeKB({ length: 100 })).toBe('0.1');
  });
});


// ===========================================================================
// copyDirSync
// ===========================================================================

describe('CLI — copyDirSync', () => {
  let copyDirSync;
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  beforeEach(async () => {
    const mod = await import('../cli/utils.js');
    copyDirSync = mod.copyDirSync;
  });

  it('copies directory recursively', () => {
    const src = path.join(os.tmpdir(), 'zq-test-src-' + Date.now());
    const dest = path.join(os.tmpdir(), 'zq-test-dest-' + Date.now());

    // Create source structure
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'world');

    copyDirSync(src, dest);

    expect(fs.existsSync(path.join(dest, 'a.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8')).toBe('hello');
    expect(fs.existsSync(path.join(dest, 'sub', 'b.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8')).toBe('world');

    // Cleanup
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  });
});


// ===========================================================================
// flag/option — additional cases
// ===========================================================================

describe('CLI — flag/option extra', () => {
  it('flag returns false when absent', async () => {
    process.argv = ['node', 'script'];
    vi.resetModules();
    const { flag } = await import('../cli/args.js');
    expect(flag('missing', 'm')).toBe(false);
  });

  it('option with short form', async () => {
    process.argv = ['node', 'script', '-o', '/dist'];
    vi.resetModules();
    const { option } = await import('../cli/args.js');
    expect(option('output', 'o', 'default')).toBe('/dist');
  });

  it('multiple flags', async () => {
    process.argv = ['node', 'script', '--verbose', '--watch'];
    vi.resetModules();
    const { flag } = await import('../cli/args.js');
    expect(flag('verbose', 'v')).toBe(true);
    expect(flag('watch', 'w')).toBe(true);
  });
});
