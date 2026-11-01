// @vitest-environment node
/**
 * T14. Static check: every /api call in client code (src/, excluding tests) has a matching
 * method + path in server/apiHandler.ts. Also requires every fetch() to use a literal URL,
 * so no call can hide from this check.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

interface ServerRoute {
  method: string;
  matches: (p: string) => boolean;
  label: string;
}

function serverRoutes(): ServerRoute[] {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'server', 'apiHandler.ts'), 'utf8');
  const routes: ServerRoute[] = [];

  // pathname === '/api/x' && req.method === 'GET'
  for (const m of src.matchAll(/pathname === '([^']+)' && req\.method === '([A-Z]+)'/g)) {
    const [, p, method] = m;
    routes.push({ method, matches: (x) => x === p, label: `${method} ${p}` });
  }

  // const fooMatch = pathname.match(/^...$/);  ...  if (fooMatch && req.method === 'GET')
  const regexByVar = new Map<string, RegExp>();
  for (const m of src.matchAll(/const (\w+) = pathname\.match\(\/(.+?)\/\);/g)) {
    regexByVar.set(m[1], new RegExp(m[2]));
  }
  for (const m of src.matchAll(/if \((\w+) && req\.method === '([A-Z]+)'\)/g)) {
    const re = regexByVar.get(m[1]);
    if (re) routes.push({ method: m[2], matches: (x) => re.test(x), label: `${m[2]} ${re.source}` });
  }
  return routes;
}

interface ClientCall {
  file: string;
  method: string;
  url: string;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Text of the call's argument list, from just after "fetch(" to the matching ")". */
function callArgs(src: string, start: number): string {
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  return src.slice(start, i - 1);
}

function clientCalls(): { calls: ClientCall[]; nonLiteral: string[] } {
  const calls: ClientCall[] = [];
  const nonLiteral: string[] = [];
  for (const file of sourceFiles(path.resolve(process.cwd(), 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    for (const m of src.matchAll(/\bfetch\(/g)) {
      const args = callArgs(src, m.index! + m[0].length).trim();
      const lit = args.match(/^(['`])(.*?)\1/s);
      if (!lit) {
        nonLiteral.push(`${rel}: fetch(${args.slice(0, 40)}...)`);
        continue;
      }
      // `${x}` right after "/" is a path segment; any other placeholder is a query-string suffix.
      const url = lit[2]
        .replace(/\/\$\{[^}]*\}/g, '/x')
        .replace(/\$\{[^}]*\}/g, '')
        .split('?')[0];
      if (!url.startsWith('/api/')) continue;
      const method = args.match(/method:\s*'([A-Z]+)'/)?.[1] ?? 'GET';
      calls.push({ file: rel, method, url });
    }
  }
  return { calls, nonLiteral };
}

describe('T14: client /api calls all exist on the server', () => {
  const routes = serverRoutes();
  const { calls, nonLiteral } = clientCalls();

  it('parses a non-trivial route list and call list', () => {
    expect(routes.length).toBeGreaterThan(15);
    expect(calls.length).toBeGreaterThan(10);
  });

  it('every fetch() uses a literal URL', () => {
    expect(nonLiteral).toEqual([]);
  });

  it('every client /api call matches a server route (method + path)', () => {
    const missing = calls
      .filter((c) => !routes.some((r) => r.method === c.method && r.matches(c.url)))
      .map((c) => `${c.file}: ${c.method} ${c.url}`);
    expect(missing).toEqual([]);
  });

  it('the client no longer calls the removed student endpoints', () => {
    const removed = calls.filter(
      (c) =>
        (c.method === 'DELETE' && /^\/api\/students\/[^/]+$/.test(c.url) && !c.file.startsWith('src/features/Admin/')) ||
        (c.method === 'POST' && /^\/api\/students\/[^/]+\/progress$/.test(c.url)) ||
        (c.method === 'POST' && (c.url === '/api/students' || c.url === '/api/sync'))
    );
    expect(removed.map((c) => `${c.file}: ${c.method} ${c.url}`)).toEqual([]);
  });
});
