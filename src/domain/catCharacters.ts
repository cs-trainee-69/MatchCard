export const CAT_CHARACTER_IDS = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
  'cat-9',
  'cat-10',
] as const

export type CatCharacterId = (typeof CAT_CHARACTER_IDS)[number]
