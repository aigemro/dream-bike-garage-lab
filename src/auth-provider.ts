export type AuthSession = {
  accountId: string;
  provider: 'lab-mock';
  providerUserKey: string;
  displayLabel: string;
};

export type AuthAccountOption = AuthSession & {
  description: string;
};

export interface AuthProvider {
  getSession(): AuthSession | null;
  listAccounts(): AuthAccountOption[];
  login(accountId: string): Promise<AuthSession>;
  logout(): Promise<void>;
}

const SESSION_KEY = 'dbg-lab-auth-session-v1';

const MOCK_ACCOUNTS: AuthAccountOption[] = [
  {
    accountId: 'lab-account-a',
    provider: 'lab-mock',
    providerUserKey: 'mock-user-a',
    displayLabel: '테스트 계정 A',
    description: '처음 시작하는 정비사 계정',
  },
  {
    accountId: 'lab-account-b',
    provider: 'lab-mock',
    providerUserKey: 'mock-user-b',
    displayLabel: '테스트 계정 B',
    description: '계정별 진행 분리 확인용',
  },
];

function isKnownSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthSession>;
  return candidate.provider === 'lab-mock'
    && typeof candidate.accountId === 'string'
    && typeof candidate.providerUserKey === 'string'
    && typeof candidate.displayLabel === 'string'
    && MOCK_ACCOUNTS.some((account) => account.accountId === candidate.accountId);
}

export class BrowserMockAuthProvider implements AuthProvider {
  getSession(): AuthSession | null {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as unknown;
      return isKnownSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  listAccounts() {
    return MOCK_ACCOUNTS.map((account) => ({ ...account }));
  }

  async login(accountId: string) {
    const account = MOCK_ACCOUNTS.find((candidate) => candidate.accountId === accountId);
    if (!account) throw new Error('지원하지 않는 Lab 테스트 계정입니다.');
    const session: AuthSession = {
      accountId: account.accountId,
      provider: account.provider,
      providerUserKey: account.providerUserKey,
      displayLabel: account.displayLabel,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
