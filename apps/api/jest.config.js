module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // tsconfig moduleResolution=nodenext-ийн шаардлагаар relative import бүр
  // ".js" өргөтгөлтэй бичигдсэн (жиш: "./auth/auth.module.js") ч бодит эх
  // файл нь .ts. ts-jest CJS горимд үүнийг өөрөө .ts рүү буцааж чаддаггүй
  // тул ".js"-г тайлж, moduleFileExtensions-аар олгоно.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // `jose` ESM-only (CJS build байхгүй) тул node_modules-ийн стандарт
  // transform-skip-оос онцгойлон гаргаж, ts-jest-ээр CJS болгоно. pnpm нь
  // бодит багцыг node_modules/.pnpm/<pkg>@<version>/... дор хадгалдаг тул
  // энгийн "node_modules/(?!jose)" маягийн pattern ажиллахгүй (эхний
  // node_modules/.pnpm/ түвшинд аль хэдийн match хийгээд ignore хийчихдэг).
  transformIgnorePatterns: ['node_modules/\\.pnpm/(?!(jose)@)'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
