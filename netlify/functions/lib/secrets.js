// Dedicated server secrets, with key versioning for rotation.
//
//   NAME           the current key (signs new tokens and verifies)
//   NAME_PREVIOUS  optional, comma-separated older keys (verify only) – keeps
//                  links / sessions issued before a rotation working until
//                  you remove them.
// Each key must be ≥ 43 characters (32 random bytes, base64url) – generate with
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
// No fallback to any other key: a missing or short secret makes the feature
// that needs it refuse to work (fail closed), it never weakens it.
const MIN_LENGTH = 43;

export class MissingSecret extends Error {
  constructor(name) {
    super(`SECRET_MISSING:${name}`);
    this.secretName = name;
  }
}

/** { current, all } – throws MissingSecret when the current key is missing/short. */
export function secretKeys(name) {
  const current = process.env[name] || '';
  if (current.length < MIN_LENGTH) throw new MissingSecret(name);
  const previous = (process.env[`${name}_PREVIOUS`] || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_LENGTH);
  return { current, all: [current, ...previous] };
}

export function hasSecret(name) {
  try {
    secretKeys(name);
    return true;
  } catch {
    return false;
  }
}
