window.__pvtVersion = '2026-05-24-f1kranz6';

Object.defineProperty(window, 'EmbeddedBrowserWebView', {
    value: undefined,
    writable: false,
    configurable: false
});
Object.defineProperty(window, 'chrome', {
    value: undefined,
    writable: false,
    configurable: false
});

(() => {
    const isNavExpectedPath = () => {
        const p = location.pathname;
        return p.startsWith('/gp/video') || p === '/';
    };
    const apply = () => {
        const root = document.documentElement;
        if (!root) return false;
        if (isNavExpectedPath()) root.classList.add('pvt-has-nav');
        return true;
    };
    if (!apply()) {
        const observer = new MutationObserver(() => {
            if (apply()) observer.disconnect();
        });
        observer.observe(document, { childList: true });
    }
})();

(() => {
  const ICONS = {
    back: '',
    minimize: '',
    maximize: '',
    restore: '',
    close: ''
  };

  const STYLE = `
#pvt-titlebar-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #2d2d2d;
  z-index: 100;
  -webkit-app-region: drag;
}
#pvt-window-controls,
#pvt-back-button {
  position: fixed;
  top: 0;
  z-index: 2147483647;
  display: flex;
  height: 60px;
  -webkit-app-region: no-drag;
}
#pvt-window-controls { right: 0; }
#pvt-back-button { left: 0; }
#pvt-window-controls .pvt-wc-btn,
#pvt-back-button .pvt-bb-btn {
  width: 46px;
  height: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  margin: 0;
  padding: 0;
  color: #ffffff;
  font-family: "Segoe Fluent Icons", "Segoe MDL2 Assets", sans-serif;
  font-size: 10px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease;
  -webkit-app-region: no-drag;
}
#pvt-window-controls .pvt-wc-btn:hover,
#pvt-back-button .pvt-bb-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
#pvt-window-controls .pvt-wc-btn:active,
#pvt-back-button .pvt-bb-btn:active {
  background: rgba(255, 255, 255, 0.05);
}
#pvt-window-controls .pvt-wc-close:hover {
  background: #e81123;
}
#pvt-window-controls .pvt-wc-close:active {
  background: #f1707a;
}
`;

  const ensureStyle = () => {
    if (document.getElementById('pvt-window-controls-style')) return;
    const style = document.createElement('style');
    style.id = 'pvt-window-controls-style';
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  };

  const buildControls = () => {
    const container = document.createElement('div');
    container.id = 'pvt-window-controls';
    container.innerHTML = [
      '<button type="button" class="pvt-wc-btn pvt-wc-min" aria-label="最小化" title="最小化">' + ICONS.minimize + '</button>',
      '<button type="button" class="pvt-wc-btn pvt-wc-max" aria-label="最大化" title="最大化">' + ICONS.maximize + '</button>',
      '<button type="button" class="pvt-wc-btn pvt-wc-close" aria-label="閉じる" title="閉じる">' + ICONS.close + '</button>'
    ].join('');
    return container;
  };

  const buildBackButton = () => {
    const container = document.createElement('div');
    container.id = 'pvt-back-button';
    container.innerHTML = '<button type="button" class="pvt-bb-btn" aria-label="戻る" title="戻る">' + ICONS.back + '</button>';
    return container;
  };

  const buildTitleBar = () => {
    const bar = document.createElement('div');
    bar.id = 'pvt-titlebar-bg';
    return bar;
  };

  const isNavExpectedPath = () => {
    const p = location.pathname;
    return p.startsWith('/gp/video') || p === '/';
  };

  const updateTitleBarVisibility = () => {
    const root = document.documentElement;
    if (!root) return;
    const pvNav = document.querySelector('nav[data-testid="pv-navigation-bar"]');
    const hasNav = !!pvNav || isNavExpectedPath();
    root.classList.toggle('pvt-has-nav', hasNav);
    const playerTopbar = document.querySelector('.f1kranz6');
    root.classList.toggle('pvt-player-fullscreen', !!playerTopbar);
  };

  let appWindow = null;
  let unlistenResize = null;

  const getAppWindow = () => {
    if (appWindow) return appWindow;
    const w = window.__TAURI__ && window.__TAURI__.window;
    if (!w) return null;
    appWindow = w.getCurrentWindow();
    return appWindow;
  };

  const mount = async () => {
    ensureStyle();
    const root = document.body || document.documentElement;
    if (!root) return;

    if (!document.getElementById('pvt-titlebar-bg')) {
      root.appendChild(buildTitleBar());
    }
    updateTitleBarVisibility();

    if (!document.getElementById('pvt-back-button')) {
      const backContainer = buildBackButton();
      root.appendChild(backContainer);
      const backBtn = backContainer.querySelector('.pvt-bb-btn');
      backBtn.addEventListener('click', () => {
        try { window.history.back(); } catch (_) {}
      });
    }

    if (document.getElementById('pvt-window-controls')) return;
    const container = buildControls();
    root.appendChild(container);

    const win = getAppWindow();
    if (!win) return;

    const minBtn = container.querySelector('.pvt-wc-min');
    const maxBtn = container.querySelector('.pvt-wc-max');
    const closeBtn = container.querySelector('.pvt-wc-close');

    const updateMaxIcon = async () => {
      try {
        const maxed = await win.isMaximized();
        maxBtn.innerHTML = maxed ? ICONS.restore : ICONS.maximize;
        const label = maxed ? '元に戻す' : '最大化';
        maxBtn.setAttribute('aria-label', label);
        maxBtn.title = label;
      } catch (_) {}
    };

    minBtn.addEventListener('click', () => {
      win.minimize().catch(() => {});
    });
    maxBtn.addEventListener('click', async () => {
      try { await win.toggleMaximize(); } catch (_) {}
      updateMaxIcon();
    });
    closeBtn.addEventListener('click', () => {
      win.close().catch(() => {});
    });

    updateMaxIcon();
    try {
      if (typeof unlistenResize === 'function') unlistenResize();
      unlistenResize = await win.onResized(() => updateMaxIcon());
    } catch (_) {}
  };

  const ensureMounted = () => {
    if (document.getElementById('pvt-window-controls') && document.getElementById('pvt-back-button')) return;
    mount();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMounted, { once: true });
  } else {
    ensureMounted();
  }

  const startObserving = () => {
    if (!document.body) return;
    const observer = new MutationObserver(() => {
      if (!document.getElementById('pvt-window-controls') || !document.getElementById('pvt-back-button')) ensureMounted();
    });
    observer.observe(document.body, { childList: true });
  };
  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  }

  const SIGNIN_URL = 'https://www.amazon.co.jp/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.co.jp%2Fgp%2Fvideo%2Fstorefront%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=jpflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0';
  const SIGNOUT_URL = 'https://www.amazon.co.jp/gp/flex/sign-out.html?path=%2Fgp%2Fvideo%2Fstorefront&useRedirectOnSuccess=1&signIn=1&action=sign-out&ref_=nav_AccountFlyout_signout';

  const isLoggedIn = () => document.cookie.split(';').some((c) => /^\s*x-acbjp\s*=/.test(c));

  const ensureLoginItem = (container) => {
    if (!container || container.querySelector('[data-pvt-login]')) return;
    const list = container.querySelector('ul');
    if (!list) return;
    const sample = list.querySelector('li');
    if (!sample) return;
    const newItem = sample.cloneNode(true);
    const link = newItem.querySelector('a');
    if (!link) return;
    const loggedIn = isLoggedIn();
    const label = loggedIn ? 'ログアウト' : 'ログイン';
    const url = loggedIn ? SIGNOUT_URL : SIGNIN_URL;
    link.setAttribute('data-pvt-login', 'true');
    link.setAttribute('aria-label', label);
    link.setAttribute('href', url);
    link.removeAttribute('data-testid');
    const labelSpan = link.querySelector('span');
    if (labelSpan) labelSpan.textContent = label;
    list.prepend(newItem);
  };

  const scanAccountDropdowns = () => {
    document.querySelectorAll('[data-testid="pv-nav-account-and-profiles-dropdown-section-container"]').forEach(ensureLoginItem);
  };

  const startDropdownObserver = () => {
    const root = document.body || document.documentElement;
    if (!root) return;
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        scanAccountDropdowns();
        updateTitleBarVisibility();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    scanAccountDropdowns();
    updateTitleBarVisibility();
  };
  if (document.body) {
    startDropdownObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startDropdownObserver, { once: true });
  }
})();
