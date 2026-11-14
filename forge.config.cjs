const path = require('node:path');

const icon = path.join(__dirname, 'assets', 'typist');

module.exports = {
  packagerConfig: {
    asar: true,
    icon,
    extraResource: ['data'],
    ignore: [/^\/(?!dist(?:\/|$)|package\.json$|node_modules(?:\/|$))/]
  },
  makers: [
    {name:'@electron-forge/maker-zip',platforms:['darwin','win32']},
    {name:'@electron-forge/maker-dmg',platforms:['darwin']},
    {name:'@electron-forge/maker-squirrel',platforms:['win32'],config:{name:'Typist',setupIcon:`${icon}.ico`}}
  ]
};
