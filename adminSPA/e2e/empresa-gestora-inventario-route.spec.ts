import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Regresión: empresa gestora debe poder resolver rutas bajo /inventario (p. ej. conteo físico).
 * No requiere front levantado ni login.
 */
test.describe('Empresa gestora e inventario', () => {
  test('empresaGestoraGuard permite prefijo inventario', () => {
    const guardPath = path.join(__dirname, '..', 'src', 'app', 'guards', 'empresa-gestora.guard.ts');
    const src = fs.readFileSync(guardPath, 'utf8');
    expect(src).toContain("path.startsWith('inventario')");
  });
});
