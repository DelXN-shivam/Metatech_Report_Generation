module.exports = {
  plugins: [
    'tailwindcss',
    'postcss-flexbugs-fixes',
    [
      'postcss-preset-env',
      {
        autoprefixer: {
          flexbox: 'no-2009',
        },
        stage: 3,
        features: {
          'custom-properties': false,
        },
      },
    ],
  ],
}


// module.exports = {
//   plugins: {
//     'postcss-import': {},
//     'tailwindcss/nesting': {},
//     tailwindcss: {},
//     autoprefixer: {},
//   }
// } 