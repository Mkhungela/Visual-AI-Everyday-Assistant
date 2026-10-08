/**
 * Tolerant JSON extraction.
 *
 * Models are asked for pure JSON, but in practice you get code fences, prose
 * preambles, trailing commas, smart quotes and truncated tails. Rather than
 * failing, we salvage whatever is there.
 */

export function extractJson<T = unknown>(input: string): T | null {
  if (!input) return null
  let text = input.trim()

  // 1. straight parse
  const direct = tryParse<T>(text)
  if (direct !== null) return direct

  // 2. strip markdown fences
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    const f = tryParse<T>(fence[1].trim())
    if (f !== null) return f
    text = fence[1].trim()
  }

  // 3. slice from first brace/bracket to its matching close
  const sliced = sliceBalanced(text)
  if (sliced) {
    const s = tryParse<T>(sliced)
    if (s !== null) return s
    const repaired = repair(sliced)
    const r = tryParse<T>(repaired)
    if (r !== null) return r
  }

  // 4. last resort: repair the whole payload
  const repaired = repair(text)
  const r = tryParse<T>(repaired)
  if (r !== null) return r

  return null
}

function tryParse<T>(s: string): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

/**
 * Walk the string tracking string/escape state and return the first balanced
 * object/array. If the response was cut off mid-way, still return a repaired
 * version — a partial analysis beats an error, and this happens regularly when a
 * model hits its output limit.
 */
function sliceBalanced(text: string): string | null {
  const start = (() => {
    const o = text.indexOf('{')
    const a = text.indexOf('[')
    if (o === -1) return a
    if (a === -1) return o
    return Math.min(o, a)
  })()
  if (start === -1) return null

  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') {
      stack.pop()
      if (stack.length === 0) return text.slice(start, i + 1)
    }
  }

  // Unbalanced: the tail was truncated. Close every still-open bracket, innermost first.
  return closeTruncated(text.slice(start), stack, inString)
}

/** Close unterminated strings and brackets so a truncated response can still parse. */
function closeTruncated(text: string, stack: string[], inString: boolean): string {
  let out = text
  if (inString) out += '"'
  // drop a dangling key like  ,"title":   or a trailing comma
  out = out.replace(/,\s*"[^"]*"\s*:\s*$/, '').replace(/,\s*$/, '')
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']'
  return out
}

/** Normalise the usual model-generated JSON sins. */
function repair(s: string): string {
  let out = s
  out = out.replace(/^\uFEFF/, '')
  // smart quotes → straight
  out = out.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
  // trailing commas
  out = out.replace(/,\s*([}\]])/g, '$1')
  // pythonic true/false/none
  out = out.replace(/\b(\w+)\s*:\s*True\b/g, '$1: true')
  out = out.replace(/\b(\w+)\s*:\s*False\b/g, '$1: false')
  out = out.replace(/\b(\w+)\s*:\s*None\b/g, '$1: null')
  out = out.replace(/\b(\w+)\s*:\s*NaN\b/g, '$1: null')
  // unquoted keys
  out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
  // // line comments
  out = out.replace(/(^|[^:"'\\])\/\/[^\n\r]*/g, '$1')
  return out
}

/** Convenience wrapper that returns a fallback instead of null. */
export function extractJsonOr<T>(input: string, fallback: T): T {
  const parsed = extractJson<T>(input)
  return parsed === null ? fallback : parsed
}
