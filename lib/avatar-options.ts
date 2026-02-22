const LEGACY_AVATAR_KEYS = new Set([
  "aurora",
  "atlas",
  "blaze",
  "cinder",
  "dune",
  "ember",
])

export const DEFAULT_AVATAR_KEY = "avatar-1"

export const AVATAR_OPTIONS = Array.from({ length: 16 }, (_, index) => {
  const number = index + 1
  const key = `avatar-${number}`
  return {
    key,
    label: `Avatar ${number}`,
    src: `/avatars/${key}.png`,
  }
})

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]["key"]

export function isAvatarKey(value: string | null | undefined): value is AvatarKey {
  return Boolean(value && AVATAR_OPTIONS.some((option) => option.key === value))
}

export function normalizeAvatarKey(avatarKey: string | null | undefined): AvatarKey {
  if (isAvatarKey(avatarKey)) {
    return avatarKey
  }
  if (avatarKey && LEGACY_AVATAR_KEYS.has(avatarKey)) {
    return DEFAULT_AVATAR_KEY
  }
  return DEFAULT_AVATAR_KEY
}

export function avatarSrcForKey(avatarKey: string | null | undefined) {
  const safeKey = normalizeAvatarKey(avatarKey)
  return `/avatars/${safeKey}.png`
}
