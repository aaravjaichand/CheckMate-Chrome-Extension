const path = require('path');
const Dotenv = require('dotenv-webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  // Load environment variables
  require('dotenv').config({ path: './.env' });

  return {
    entry: {
      sidebar: './src/sidebar.jsx',
      background: './src/background.js'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader'
          ]
        }
      ]
    },
    resolve: {
      extensions: ['.js', '.jsx']
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      new Dotenv({
        path: './.env',
        safe: false,
        allowEmptyValues: true,
        systemvars: true,
        silent: true,
        defaults: false
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
            transform(content) {
              // Replace environment variables in manifest.json
              let manifestContent = content.toString();
              manifestContent = manifestContent.replace('"GOOGLE_CLIENT_ID"', `"${process.env.GOOGLE_CLIENT_ID}"`);
              return manifestContent;
            }
          },
          { from: 'src/sidebar.html', to: 'sidebar.html' }
        ]
      })
    ],
    mode: argv.mode || 'production',
    devtool: argv.mode === 'production' ? 'source-map' : 'cheap-module-source-map'
  };
};