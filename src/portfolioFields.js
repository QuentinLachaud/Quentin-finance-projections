export const formatPropertyAddress = (...parts) => parts
  .map((part) => String(part ?? '').trim())
  .filter(Boolean)
  .join(', ')

export const shouldSelectZeroInput = (input) => input?.type === 'number'
  && input.value !== ''
  && Number(input.value) === 0

