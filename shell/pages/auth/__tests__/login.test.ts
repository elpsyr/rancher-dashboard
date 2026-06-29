import Login from '@shell/pages/auth/login.vue';

jest.mock('@components/Form/LabeledInput', () => ({ LabeledInput: {} }));
jest.mock('@shell/components/AsyncButton', () => ({}));
jest.mock('@shell/components/LocaleSelector', () => ({}));
jest.mock('@shell/components/BrandImage', () => ({}));
jest.mock('@shell/components/InfoBox', () => ({}));
jest.mock('@shell/components/CopyCode', () => ({}));
jest.mock('@components/Banner', () => ({ Banner: {} }));
jest.mock('@components/Form/Checkbox', () => ({ Checkbox: {} }));
jest.mock('@shell/components/form/Password', () => ({}));
jest.mock('@shell/plugins/plugin', () => jest.fn());
jest.mock('@shell/components/Loading', () => ({}));
jest.mock('@shell/components/TabTitle.vue', () => ({}));

const methods = (Login as any).methods;

describe('page: auth/login', () => {
  describe('embedded Generic OIDC auto login', () => {
    const defaultContext = {
      isEmbedded:                       jest.fn(() => true),
      firstLogin:                       false,
      loggedOut:                        false,
      timedOut:                         false,
      isSessionIdle:                    false,
      isSsoLogout:                      false,
      isSlo:                            false,
      err:                              '',
      providers:                        ['genericoidc'],
      hasRedirectedEmbeddedGenericOidc: jest.fn(() => false),
      $store:                           { dispatch: jest.fn(), state: { prefs: {} } },
      embeddedGenericOidcBackTo:        jest.fn(() => '/c/local/explorer'),
    };

    it('redirects to Generic OIDC when login is embedded and the provider is enabled', async() => {
      const context = {
        ...defaultContext,
        shouldAutoLoginEmbedded:          jest.fn(() => true),
        setRedirectedEmbeddedGenericOidc: jest.fn(),
        embeddedGenericOidcRedirecting:   false,
        $store:                           { dispatch: jest.fn(), state: { prefs: {} } },
      };

      await methods.redirectEmbeddedGenericOidc.call(context);

      expect(context.$store.dispatch).toHaveBeenCalledWith('auth/redirectTo', {
        provider: 'genericoidc',
        backTo:   '/c/local/explorer'
      });
    });

    it('uses the pending auth redirect as the OIDC back-to target', () => {
      const context = {
        $store:  { state: { prefs: { authRedirect: { name: 'c-cluster-explorer', params: { cluster: 'local' } } } } },
        $router: { resolve: jest.fn(() => ({ href: '/c/local/explorer' })) },
      };

      expect(methods.embeddedGenericOidcBackTo.call(context)).toStrictEqual('/c/local/explorer');
      expect(context.$router.resolve).toHaveBeenCalledWith({ name: 'c-cluster-explorer', params: { cluster: 'local' } });
    });

    it('falls back to root when there is no pending auth redirect', () => {
      const context = {
        $store:  { state: { prefs: {} } },
        $router: { resolve: jest.fn() },
      };

      expect(methods.embeddedGenericOidcBackTo.call(context)).toStrictEqual('/');
      expect(context.$router.resolve).not.toHaveBeenCalled();
    });

    it.each([
      ['not embedded', { isEmbedded: jest.fn(() => false) }],
      ['first login', { firstLogin: true }],
      ['missing Generic OIDC', { providers: ['local'] }],
      ['redirect is in progress', { embeddedGenericOidcRedirecting: true }],
      ['redirect already happened', { hasRedirectedEmbeddedGenericOidc: jest.fn(() => true) }],
    ])('does not auto login when %s', (name, overrides) => {
      const context = {
        ...defaultContext,
        ...overrides,
      };

      expect(methods.shouldAutoLoginEmbedded.call(context)).toStrictEqual(false);
    });

    it.each([
      ['logged out', { loggedOut: true }],
      ['timed out', { timedOut: true }],
      ['session idle', { isSessionIdle: true }],
      ['SSO logout', { isSsoLogout: true }],
      ['SLO logout', { isSlo: true }],
      ['login error', { err: 'server' }],
    ])('still auto logs in when embedded and %s', (name, overrides) => {
      const context = {
        ...defaultContext,
        ...overrides,
      };

      expect(methods.shouldAutoLoginEmbedded.call(context)).toStrictEqual(true);
    });
  });
});
