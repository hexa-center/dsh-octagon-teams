/**
 * Client half of Octagon Teams: adds an "open configuration" button to the
 * team preset card in Settings → Agent presets.
 *
 * DSH renders preset cards inside its own client package and exposes no
 * card-level slot, so this module decorates the card node marked with
 * `data-agent-preset-id="octagon-*"`. The decoration is idempotent, survives
 * React re-renders through a MutationObserver, and is removed on dispose.
 */
window.__ModuleLoader__.load({
  id: '@hexa-center/octagon-teams',
  factory(require) {
    const ZH = { openCard: '打开配置', openTitle: '在浏览器打开 Octagon Teams 的配置页', resolving: '解析地址…', unavailable: '无法获取地址' }
    const EN = { openCard: 'Open config', openTitle: 'Open the Octagon Teams configuration page in the browser', resolving: 'Resolving…', unavailable: 'Address unavailable' }
    const MARK = 'data-octagon-open'
    const CARD_SELECTOR = 'li[data-agent-preset-id^="octagon-"]'

    // The desktop shell loads this page from its own `app://app/…` origin, so the
    // browser location is not a usable address. The Host answers with the origin
    // its HTTP listener actually bound (see `ctx.webServer.getOrigin()`), and the
    // relative request below is proxied to that same Host.
    let resolvedOrigin = null
    let loadingOrigin = null

    function loadOrigin() {
      if (loadingOrigin !== null) return loadingOrigin
      loadingOrigin = fetch('/octagon-teams/api/roles', { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data !== null && typeof data.origin === 'string' && data.origin !== '') {
            resolvedOrigin = data.origin
          }
          return resolvedOrigin
        })
        .catch(() => null)
        .then((origin) => {
          if (origin === null) {
            // Desktop shells expose the Host address on the transport bridge.
            const base = globalThis.__DSH_TRANSPORT__?.streamBaseUrl
            if (typeof base === 'string' && base !== '') resolvedOrigin = base
          }
          return resolvedOrigin
        })
      return loadingOrigin
    }

    function configUrl() {
      if (resolvedOrigin !== null) return resolvedOrigin + '/octagon-teams'
      if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return window.location.origin + '/octagon-teams'
      }
      return null
    }

    function openConfig(button, t) {
      const url = configUrl()
      if (url !== null) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      // The address is not known yet (slow Host round-trip): say so, then open.
      const label = button.textContent
      button.disabled = true
      button.textContent = t('resolving')
      void loadOrigin().then((origin) => {
        button.disabled = false
        button.textContent = label
        if (origin !== null) {
          window.open(origin + '/octagon-teams', '_blank', 'noopener,noreferrer')
        } else {
          button.textContent = t('unavailable')
          setTimeout(() => { button.textContent = t('openCard') }, 2500)
        }
      })
    }

    function makeButton(t) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute(MARK, '')
      button.textContent = t('openCard')
      button.title = t('openTitle')
      button.style.cssText = [
        'font: inherit', 'font-size: 12px', 'line-height: 18px', 'padding: 3px 10px',
        'min-height: 26px', 'margin-right: auto', 'border-radius: 6px', 'cursor: pointer',
        'border: 1px solid color-mix(in srgb, currentColor 30%, transparent)',
        'background: color-mix(in srgb, currentColor 8%, transparent)',
        'color: inherit',
      ].join(';')
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        openConfig(event.currentTarget, t)
      })
      return button
    }

    function decorate(card, t) {
      if (card.querySelector('[' + MARK + ']')) return
      const foot = card.querySelector(':scope > div:last-child')
      if (foot === null) return
      foot.insertBefore(makeButton(t), foot.firstChild)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('octagon.teams', { zh: ZH, en: EN }), 'octagon: dictionaries')
        void loadOrigin()
        const t = ctx.locale.bind('octagon.teams')
        ctx.effect(() => {
          let scheduled = false
          const scan = () => {
            for (const card of document.querySelectorAll(CARD_SELECTOR)) decorate(card, t)
          }
          const nearCard = (node) => node !== null && node.nodeType === 1
            && (node.closest(CARD_SELECTOR) !== null || node.querySelector(CARD_SELECTOR) !== null)
          const touched = (records) => records.some((record) => nearCard(record.target)
            || Array.from(record.addedNodes).some(nearCard))
          const schedule = (records) => {
            if (scheduled || !touched(records)) return
            scheduled = true
            requestAnimationFrame(() => { scheduled = false; scan() })
          }
          const observer = new MutationObserver(schedule)
          observer.observe(document.body, { childList: true, subtree: true })
          scan()
          return () => {
            observer.disconnect()
            for (const button of document.querySelectorAll('[' + MARK + ']')) button.remove()
          }
        }, 'octagon: preset card action')
      },
    }
  },
})
