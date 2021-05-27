const escapeRegExp = (s: string): string => {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

const genSplitKeepDelimExpr = (rawDelims: string[], delims: string[]): RegExp => {
  return new RegExp('(' + rawDelims.map(escapeRegExp).concat(delims).join('|') + ')')
}

const splitExpr = genSplitKeepDelimExpr(
  ['\'', '"', '\\'],
  ['\\s']
)

const splitKeepDelim = (s: string): string[] => {
  return s.split(splitExpr).filter(s => s.length)
}

export const parse = (s: string): string[] => {
  let isBackslashed = false
  let isSingleQuoted = false
  let isDoubleQuoted = false
  let inSpace = true
  const argv: string[] = []
  let argHead: string = ''
  splitKeepDelim(s).forEach((c: string) => {
    const isSpace = /\s/.test(c)
    if (inSpace) {
      if (isSpace) {
        return
      } else {
        inSpace = false
      }
    }
    if (isBackslashed) {
      isBackslashed = false
      argHead += c
    } else if (c === '\\' && !isSingleQuoted) {
      isBackslashed = true
    } else if (c === '"' && !isSingleQuoted) {
      isDoubleQuoted = !isDoubleQuoted
    } else if (c === '\'' && !isDoubleQuoted) {
      isSingleQuoted = !isSingleQuoted
    } else if (isSpace && !isDoubleQuoted && !isSingleQuoted) {
      inSpace = true
      argv.push(argHead)
      argHead = ''
    } else {
      argHead += c
    }
  })
  if (isSingleQuoted || isDoubleQuoted || isBackslashed) {
    throw new Error('special character sequences not closed')
  }
  if (!inSpace) {
    argv.push(argHead)
  }
  return argv
}
