import '@testing-library/jest-dom';

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

if (typeof window !== 'undefined') {
  const localStore = new MemoryStorage();
  const sessionStore = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { value: localStore, writable: true, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: sessionStore, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStore, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStore, writable: true, configurable: true });
}
