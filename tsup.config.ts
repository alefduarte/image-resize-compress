import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs', 'iife'],
  globalName: 'imageResizeCompress',
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  splitting: false,
  target: 'es2020',
});
