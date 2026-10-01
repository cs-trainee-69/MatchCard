const MIN_PORT = 1
const MAX_PORT = 65_535

export function resolvePort(processValue, fileValue, variableName, fallback) {
  const value = processValue ?? fileValue
  const normalized = value?.trim()

  if (!normalized) {
    return fallback
  }

  const isWholeNumber = /^\d+$/.test(normalized)
  const port = Number(normalized)
  if (!isWholeNumber || !Number.isSafeInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`${variableName} must be a whole number between ${MIN_PORT} and ${MAX_PORT}; received "${value}"`)
  }

  return port
}
