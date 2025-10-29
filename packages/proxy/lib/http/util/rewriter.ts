import * as inject from './inject'
import * as astRewriter from './ast-rewriter'
import * as regexRewriter from './regex-rewriter'
import type { CypressWantsInjection } from '../../types'
import type { SerializableAutomationCookie } from '@packages/server/lib/util/cookies'

export type SecurityOpts = {
  isNotJavascript?: boolean
  url: string
  useAstSourceRewriting: boolean
  modifyObstructiveThirdPartyCode: boolean
  modifyObstructiveCode: boolean
  deferSourceMapRewrite: (opts: any) => string
}

export type InjectionOpts = {
  cspNonce?: string
  domainName: string
  wantsInjection: CypressWantsInjection
  wantsSecurityRemoved: any
  simulatedCookies: SerializableAutomationCookie[]
  shouldInjectDocumentDomain: boolean
}

function getRewriter (useAstSourceRewriting: boolean) {
  return useAstSourceRewriting ? astRewriter : regexRewriter
}

function getHtmlToInject (opts: InjectionOpts & SecurityOpts) {
  const {
    cspNonce,
    domainName,
    wantsInjection,
    modifyObstructiveThirdPartyCode,
    modifyObstructiveCode,
    simulatedCookies,
    shouldInjectDocumentDomain,
  } = opts

  switch (wantsInjection) {
    case 'full':
      return inject.full(domainName, {
        shouldInjectDocumentDomain,
        cspNonce,
      })
    case 'fullCrossOrigin':
      return inject.fullCrossOrigin(domainName, {
        cspNonce,
        modifyObstructiveThirdPartyCode,
        modifyObstructiveCode,
        simulatedCookies,
        shouldInjectDocumentDomain,
      })
    case 'partial':
      return inject.partial(domainName, {
        shouldInjectDocumentDomain,
        cspNonce,
      })
    default:
      return
  }
}

export async function html (html: string, opts: SecurityOpts & InjectionOpts) {
  const htmlToInject = await Promise.resolve(getHtmlToInject(opts))

  // strip clickjacking and framebusting
  // from the HTML if we've been told to
  if (opts.wantsSecurityRemoved) {
    html = await Promise.resolve(getRewriter(opts.useAstSourceRewriting).strip(html, opts))
  }

  if (!htmlToInject) {
    return html
  }

  const head = /(<head[^>]*>)([\s\S]*?)(<\/head>)/i

  if (html.match(head)) {
    return html.replace(head, `$1$2${htmlToInject}$3`)
  }

  const body = /(<body[^>]*>)([\s\S]*?)(<\/body>)/i

  if (html.match(body)) {
    return html.replace(body, `$1<head>${htmlToInject}</head>$2$3`)
  }

  const htmlEl = /(<html[^>]*>)([\s\S]*?)(<\/html>)/i

  if (html.match(htmlEl)) {
    return html.replace(htmlEl, `$1<head>${htmlToInject}</head>$2$3`)
  }

  const doctype = /(<\!doctype.*?>)/i

  if (html.match(doctype)) {
    return html.replace(doctype, `$1<head>${htmlToInject}</head>`)
  }

  return `<head>${htmlToInject}</head>${html}`
}

export function security (opts: SecurityOpts) {
  return getRewriter(opts.useAstSourceRewriting).stripStream(opts)
}
