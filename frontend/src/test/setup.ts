import "@testing-library/jest-dom";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(() => Promise.resolve(null)),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
