# TSConfigs

tsconfig plays such an important role in our project, and is decently complex, so it sadly
deserves it's own folder in our mono repo.

## Handy commands

tsc --noEmit --extendedDiagnostics

tsc --traceResolution > resolution.txt

tsc -b --dry

tsc -b --clean

tsc -b --verbose

## References

-   tsconfig options reference https://www.typescriptlang.org/tsconfig

-   tsc build flag https://www.typescriptlang.org/docs/handbook/project-references.html#tsc--b-commandline

-   Tips for Performant TypeScript https://github.com/microsoft/TypeScript/wiki/Performance

-   Centralized Recommendations for TSConfig bases https://github.com/tsconfig/bases/

-   Project References https://www.typescriptlang.org/docs/handbook/project-references.html (especially #overall-structure)

-   Look at tsconfigs in the TypeScript project https://github.com/microsoft/TypeScript/tree/master/src

-   config file inheritance https://www.typescriptlang.org/docs/handbook/tsconfig-json.html

-   how shopify does it: https://shopify.engineering/migrating-large-typescript-codebases-project-references

-   project references demos: https://github.com/RyanCavanaugh/project-references-demo

## FAQ

What is `rootDir` vs `baseUrl`?

`baseUrl` is Base directory to resolve non-relative module names.

(https://stackoverflow.com/questions/63515076/difference-between-rootdir-and-baseurl-in-tsconfig)

Eslint issues:
https://github.com/typescript-eslint/typescript-eslint/issues/967
