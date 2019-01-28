const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'ibatis-to-mybatis-converter.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  target: 'node',
  module: {
    rules: [{
      test: /\.ts$/,
      use: ['ts-loader'],
      exclude: /node_modules/
    }]
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true
    })
  ]
};
