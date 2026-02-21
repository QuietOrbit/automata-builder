## Summary

<!-- Brief description of what this PR does and why. -->

## Changes

<!-- List the key changes made in this PR. -->

-

## Testing

- [ ] Tested locally with `npm run dev`
- [ ] Type-check passes (`npx tsc --noEmit`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Tested in both DFA and NFA modes (if applicable)

## Related Issues

<!-- Link any related issues: Closes #123, Fixes #456 -->

## Code Style Checklist

- [ ] Enums used instead of raw string literals for keys and discriminators
- [ ] `Number.isNaN()` / `Number.isFinite()` used instead of global equivalents
- [ ] CSS custom properties used for colors (no hardcoded values)
- [ ] Pinia stores used as single source of truth (no component-local state for shared data)
- [ ] JSDoc added or updated for any new/modified exports
