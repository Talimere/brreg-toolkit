# brreg-toolkit

Simple TypeScript toolkit for working with [Brreg](https://www.brreg.no) APIs.

It lets you easily look up information about Norwegian organizations from the official **Enhetsregisteret** endpoint, with built-in input validation, retries, and helpful errors.

---

## Quick start

Install it:

```bash
npm install brreg-toolkit
```

## Use it
```ts
import { lookupOrgNumber } from 'brreg-toolkit'

async function main() {
  const data = await lookupOrgNumber('509100675')
  console.log(data.navn)
}
```

## NPM Package
- NPM package over at **[brreg-toolkit](https://www.npmjs.com/package/brreg-toolkit)**


## Maintainers
**[Talimere](https://github.com/Talimere)**