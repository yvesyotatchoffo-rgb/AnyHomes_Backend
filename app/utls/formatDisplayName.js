/**
 * Format a user's display name for use in automated email content.
 *
 * Rules:
 *  - Pro user (accountType === 'pro', or has companyName with no accountType):
 *      companyName → firstName + lastName → fullName → 'Un professionnel'
 *  - Non-pro / individual user:
 *      username → firstName + first-letter-of-lastName. → first word of fullName → 'Un membre'
 *
 * This function is intentionally NEVER used for the invitation email sender
 * (that email explicitly shows the sender's full name per product decision).
 *
 * @param {object|null} user - Mongoose document or plain object.
 * @returns {string}
 */
function formatDisplayName(user) {
  if (!user) return 'Un utilisateur';

  // Pro detection: explicit accountType OR presence of companyName
  const isPro =
    user.accountType === 'pro' ||
    (user.accountType == null && typeof user.companyName === 'string' && user.companyName.trim().length > 0);

  if (isPro) {
    if (user.companyName && user.companyName.trim()) return user.companyName.trim();
    const parts = [user.firstName, user.lastName].filter((p) => p && p.trim());
    if (parts.length) return parts.join(' ');
    return user.fullName || 'Un professionnel';
  }

  // Non-pro: prefer username
  if (user.username && user.username.trim()) return user.username.trim();

  // Then: firstName + initial of lastName
  if (user.firstName && user.firstName.trim()) {
    const initial =
      user.lastName && user.lastName.trim()
        ? ` ${user.lastName.trim()[0].toUpperCase()}.`
        : '';
    return `${user.firstName.trim()}${initial}`;
  }

  // Fallback: first word of fullName
  const first = user.fullName && user.fullName.trim().split(/\s+/)[0];
  return first || 'Un membre';
}

module.exports = { formatDisplayName };
