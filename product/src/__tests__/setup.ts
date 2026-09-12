// Global test setup — runs before every test file
// Mock Next.js environment variables
process.env.NODE_ENV = "test";
process.env.NEXTAUTH_SECRET = "test-secret-32chars-abcdefghijkl";
process.env.DOCTOR_PIN = "1234";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost/test";

// Suppress noisy console output during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    // Allow test-relevant errors through, suppress known setup noise
    if (!msg.includes("[doctor-auth] CRITICAL") && !msg.includes("NEXTAUTH_SECRET")) {
      originalConsoleError(...args);
    }
  };
});
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
