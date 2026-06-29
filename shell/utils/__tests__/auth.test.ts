import {
  notLoggedIn,
  tryEmbeddedGenericOidcLogin,
  isEmbedded,
  hasRedirectedEmbeddedGenericOidc,
  setRedirectedEmbeddedGenericOidc,
  EMBEDDED_GENERIC_OIDC_REDIRECT_KEY
} from '@shell/utils/auth';

const ORIGINAL_SELF = window.self;
const ORIGINAL_TOP = window.top;

function setEmbedded(value: boolean) {
  if (value) {
    // Simulate running inside an iframe: `window.self !== window.top`
    Object.defineProperty(window, 'self', { value: {}, configurable: true });
    Object.defineProperty(window, 'top', { value: ORIGINAL_TOP, configurable: true });
  } else {
    Object.defineProperty(window, 'self', { value: ORIGINAL_SELF, configurable: true });
    Object.defineProperty(window, 'top', { value: ORIGINAL_TOP, configurable: true });
  }
}

describe('auth utils: embedded Generic OIDC helpers', () => {
  afterEach(() => {
    setEmbedded(false);
    try {
      window.sessionStorage.removeItem(EMBEDDED_GENERIC_OIDC_REDIRECT_KEY);
    } catch (e) {}
  });

  describe('isEmbedded', () => {
    it('returns false when window.self === window.top', () => {
      setEmbedded(false);

      expect(isEmbedded()).toStrictEqual(false);
    });

    it('returns true when window.self !== window.top', () => {
      setEmbedded(true);

      expect(isEmbedded()).toStrictEqual(true);
    });

    it('returns true when accessing window.top throws', () => {
      Object.defineProperty(window, 'top', {
        get() { throw new Error('cross-origin'); },
        configurable: true,
      });

      expect(isEmbedded()).toStrictEqual(true);

      Object.defineProperty(window, 'top', { value: ORIGINAL_TOP, configurable: true });
    });
  });

  describe('hasRedirectedEmbeddedGenericOidc / setRedirectedEmbeddedGenericOidc', () => {
    it('returns false before the flag is set', () => {
      expect(hasRedirectedEmbeddedGenericOidc()).toStrictEqual(false);
    });

    it('returns true after the flag is set', () => {
      setRedirectedEmbeddedGenericOidc();

      expect(hasRedirectedEmbeddedGenericOidc()).toStrictEqual(true);
    });
  });
});

describe('auth utils: tryEmbeddedGenericOidcLogin', () => {
  let store: any;
  let route: any;

  beforeEach(() => {
    setEmbedded(true);
    try {
      window.sessionStorage.removeItem(EMBEDDED_GENERIC_OIDC_REDIRECT_KEY);
    } catch (e) {}

    store = {
      dispatch: jest.fn((action: string) => {
        if (action === 'auth/getAuthProviders') {
          return [{ id: 'genericoidc' }, { id: 'local' }];
        }

        return undefined;
      }),
      commit: jest.fn(),
      state:   { prefs: {} },
      $router: { resolve: jest.fn((r: any) => ({ href: r?.fullPath || '/' })) },
    };
    route = { name: 'c-cluster-explorer' };
  });

  afterEach(() => {
    setEmbedded(false);
  });

  it('redirects to Generic OIDC when embedded and the provider is enabled', async() => {
    const result = await tryEmbeddedGenericOidcLogin(store, route);

    expect(result).toStrictEqual(true);
    expect(store.dispatch).toHaveBeenCalledWith('auth/redirectTo', {
      provider: 'genericoidc',
      backTo:   '/',
    });
    expect(hasRedirectedEmbeddedGenericOidc()).toStrictEqual(true);
  });

  it('uses the pending authRedirect as the back-to target', async() => {
    store.state = { prefs: { authRedirect: { name: 'c-cluster-explorer', params: { cluster: 'local' } } } };
    store.$router.resolve = jest.fn(() => ({ href: '/c/local/explorer' }));

    await tryEmbeddedGenericOidcLogin(store, route);

    expect(store.$router.resolve).toHaveBeenCalledWith({ name: 'c-cluster-explorer', params: { cluster: 'local' } });
    expect(store.dispatch).toHaveBeenCalledWith('auth/redirectTo', {
      provider: 'genericoidc',
      backTo:   '/c/local/explorer',
    });
  });

  it('falls back to authRedirect.fullPath when the store has no $router', async() => {
    store.state = { prefs: { authRedirect: { fullPath: '/c/local/explorer' } } };
    delete store.$router;

    await tryEmbeddedGenericOidcLogin(store, route);

    expect(store.dispatch).toHaveBeenCalledWith('auth/redirectTo', {
      provider: 'genericoidc',
      backTo:   '/c/local/explorer',
    });
  });

  it('returns false when not embedded', async() => {
    setEmbedded(false);

    const result = await tryEmbeddedGenericOidcLogin(store, route);

    expect(result).toStrictEqual(false);
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });

  it('returns false when a redirect is already in progress', async() => {
    setRedirectedEmbeddedGenericOidc();

    const result = await tryEmbeddedGenericOidcLogin(store, route);

    expect(result).toStrictEqual(false);
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });

  it('returns false when Generic OIDC is not an enabled provider', async() => {
    store.dispatch = jest.fn((action: string) => {
      if (action === 'auth/getAuthProviders') {
        return [{ id: 'local' }];
      }

      return undefined;
    });

    const result = await tryEmbeddedGenericOidcLogin(store, route);

    expect(result).toStrictEqual(false);
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });

  it('returns false when fetching auth providers fails', async() => {
    store.dispatch = jest.fn(() => Promise.reject(new Error('network')));

    const result = await tryEmbeddedGenericOidcLogin(store, route);

    expect(result).toStrictEqual(false);
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });
});

describe('auth utils: notLoggedIn (embedded direct login)', () => {
  let store: any;
  let route: any;
  let redirect: jest.Mock;

  beforeEach(() => {
    setEmbedded(true);
    try {
      window.sessionStorage.removeItem(EMBEDDED_GENERIC_OIDC_REDIRECT_KEY);
    } catch (e) {}

    store = {
      dispatch: jest.fn((action: string) => {
        if (action === 'auth/getAuthProviders') {
          return [{ id: 'genericoidc' }];
        }

        return undefined;
      }),
      commit: jest.fn(),
      state:   { prefs: {} },
      $router: { resolve: jest.fn(() => ({ href: '/' })) },
    };
    route = { name: 'c-cluster-explorer' };
    redirect = jest.fn();
  });

  afterEach(() => {
    setEmbedded(false);
  });

  it('records the auth redirect target and triggers OIDC login when embedded', async() => {
    await notLoggedIn(store, redirect, route);

    expect(store.commit).toHaveBeenCalledWith('prefs/setAuthRedirect', route);
    expect(store.dispatch).toHaveBeenCalledWith('auth/redirectTo', {
      provider: 'genericoidc',
      backTo:   '/',
    });
    // Should NOT bounce through the login page
    expect(redirect).not.toHaveBeenCalled();
  });

  it('does not set the auth redirect when navigating to an auth route', async() => {
    route = { name: 'auth-login' };

    await notLoggedIn(store, redirect, route);

    expect(store.commit).not.toHaveBeenCalledWith('prefs/setAuthRedirect', expect.anything());
  });

  it('falls back to the login page when not embedded', async() => {
    setEmbedded(false);
    route = { name: 'index' };

    await notLoggedIn(store, redirect, route);

    expect(redirect).toHaveBeenCalledWith('/auth/login');
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });

  it('falls back to the login page with TIMED_OUT for non-index routes when not embedded', async() => {
    setEmbedded(false);

    await notLoggedIn(store, redirect, route);

    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('timed-out'));
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });

  it('falls back to the login page when embedded but Generic OIDC is not enabled', async() => {
    store.dispatch = jest.fn((action: string) => {
      if (action === 'auth/getAuthProviders') {
        return [{ id: 'local' }];
      }

      return undefined;
    });
    route = { name: 'index' };

    await notLoggedIn(store, redirect, route);

    expect(redirect).toHaveBeenCalledWith('/auth/login');
  });

  it('falls back to the login page when an embedded redirect already happened', async() => {
    setRedirectedEmbeddedGenericOidc();
    route = { name: 'index' };

    await notLoggedIn(store, redirect, route);

    expect(redirect).toHaveBeenCalledWith('/auth/login');
    expect(store.dispatch).not.toHaveBeenCalledWith('auth/redirectTo', expect.anything());
  });
});
