import {
  RouterHistory,
  NavigationCallback,
  START,
  HistoryState,
  NavigationType,
  NavigationDirection,
  NavigationInformation,
  normalizeBase,
  HistoryLocation,
} from './common'
import { Origins, addDomainPrefix, externalUrl } from './crossDomain'

export function createCrossDomainMemoryHistory(
  origins: Origins = {}
): RouterHistory {
  let listeners: NavigationCallback[] = []
  let queue: [url: HistoryLocation, state: HistoryState][] = [[START, {}]]
  let position: number = 0
  const base = normalizeBase(undefined)

  function setLocation(location: HistoryLocation, state: HistoryState = {}) {
    if (/^https?:\/\//.test(location)) {
      const url = new URL(location)
      location = addDomainPrefix(origins, url.origin, url.pathname + url.search)
    }
    position++
    if (position !== queue.length) {
      // we are in the middle, we remove everything from here in the queue
      queue.splice(position)
    }
    queue.push([location, state])
  }

  function triggerListeners(
    to: HistoryLocation,
    from: HistoryLocation,
    { direction, delta }: Pick<NavigationInformation, 'direction' | 'delta'>
  ): void {
    const info: NavigationInformation = {
      direction,
      delta,
      type: NavigationType.pop,
    }
    for (const callback of listeners) {
      callback(to, from, info)
    }
  }

  const routerHistory: RouterHistory = {
    // rewritten by Object.defineProperty
    location: START,
    // rewritten by Object.defineProperty
    state: {},
    base,
    createHref: (to: string): string =>
      externalUrl(origins, getBaseLocation(origins) + base + to),

    replace(to, state?: HistoryState) {
      // remove current entry and decrement position
      queue.splice(position--, 1)
      setLocation(to, state)
    },

    push(to, state?: HistoryState) {
      setLocation(to, state)
    },

    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    destroy() {
      listeners = []
      queue = [[START, {}]]
      position = 0
    },

    go(delta, shouldTrigger = true) {
      const from = this.location
      const direction: NavigationDirection =
        // we are considering delta === 0 going forward, but in abstract mode
        // using 0 for the delta doesn't make sense like it does in html5 where
        // it reloads the page
        delta < 0 ? NavigationDirection.back : NavigationDirection.forward
      position = Math.max(0, Math.min(position + delta, queue.length - 1))
      if (shouldTrigger) {
        triggerListeners(this.location, from, {
          direction,
          delta,
        })
      }
    },
  }

  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => queue[position][0],
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => queue[position][1],
  })

  if (__TEST__) {
    // @ts-expect-error: only for tests
    routerHistory.changeURL = function (url: string, state: HistoryState = {}) {
      const from = this.location
      queue.splice(position++ + 1, queue.length, [url, state])
      triggerListeners(this.location, from, {
        direction: NavigationDirection.unknown,
        delta: 0,
      })
    }
  }

  return routerHistory
}

function getBaseLocation(origins: Origins) {
  for (const [origin, prefix] of Object.entries(origins)) {
    if (prefix === '') {
      return origin
    }
  }
  throw new Error('No origin with empty prefix')
}
