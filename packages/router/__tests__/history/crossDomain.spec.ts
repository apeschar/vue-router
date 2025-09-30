import { JSDOM } from 'jsdom'
import { createCrossDomainWebHistory } from '../../src/history/crossDomain'
import { createDom } from '../utils'
import {
  vi,
  describe,
  expect,
  it,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from 'vitest'

// override the value of isBrowser because the variable is created before JSDOM
// is created
vi.mock('../../src/utils/env', () => ({
  isBrowser: true,
}))

// These unit tests are supposed to tests very specific scenarios that are easier to setup
// on a unit test than an e2e tests
describe('Cross-domain history', () => {
  let dom: JSDOM
  beforeAll(() => {
    dom = createDom()
  })

  beforeEach(() => {
    // empty the state to simulate an initial navigation by default
    window.history.replaceState(null, '', '')
  })

  afterAll(() => {
    dom.window.close()
  })

  afterEach(() => {
    // ensure no base element is left after a test as only the first is
    // respected
    for (let element of Array.from(document.getElementsByTagName('base')))
      element.remove()
  })

  it('handles a basic base', () => {
    expect(createCrossDomainWebHistory().base).toBe('')
  })

  it('handles a base tag', () => {
    const baseEl = document.createElement('base')
    baseEl.href = '/foo/'
    document.head.appendChild(baseEl)
    expect(createCrossDomainWebHistory().base).toBe('/foo')
  })

  it('handles a base tag with origin', () => {
    const baseEl = document.createElement('base')
    baseEl.href = 'https://example.com/foo/'
    document.head.appendChild(baseEl)
    expect(createCrossDomainWebHistory().base).toBe('/foo')
  })

  it('handles a base tag with origin without trailing slash', () => {
    const baseEl = document.createElement('base')
    baseEl.href = 'https://example.com/bar'
    document.head.appendChild(baseEl)
    expect(createCrossDomainWebHistory().base).toBe('/bar')
  })

  it('prepends the host to support // urls', () => {
    let history = createCrossDomainWebHistory()
    let spy = vi.spyOn(window.history, 'pushState')
    history.push('/foo')
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'https://example.com/foo'
    )
    history.push('//foo')
    expect(spy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(String),
      'https://example.com//foo'
    )
    spy.mockRestore()
  })

  for (const testcase of [
    { path: '/nl', expected: 'https://example.nl/' },
    { path: '/nl/qqq', expected: 'https://example.nl/qqq' },
    { path: '//nl//qqq', expected: 'https://example.nl//qqq' },
    { path: '/nlz', expected: 'https://example.com/nlz' },
    {
      url: 'https://example.nl/',
      path: '/test',
      expected: 'https://example.com/test',
    },
  ]) {
    it(`adjusts the domain when navigating (${testcase.path} -> ${testcase.expected})`, () => {
      dom.reconfigure({ url: testcase.url ?? 'https://example.com/abc' })
      const history = createCrossDomainWebHistory({
        'https://example.com': '',
        'https://example.nl': '/nl',
      })
      const spy = vi.spyOn(window.history, 'pushState')
      history.push(testcase.path)
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        testcase.expected
      )
    })
  }

  it('removes the domain from the current location', () => {
    dom.reconfigure({ url: 'https://example.nl/abc' })
    const history = createCrossDomainWebHistory({
      'https://example.com': '',
      'https://example.nl': '/nl',
    })
    expect(history.location).toEqual('/nl/abc')
  })

  it('ignores unknown domains', () => {
    dom.reconfigure({ url: 'https://example.lol/abc' })
    const history = createCrossDomainWebHistory({
      'https://example.com': '',
      'https://example.nl': '/nl',
    })
    expect(history.location).toEqual('/abc')
  })
})
