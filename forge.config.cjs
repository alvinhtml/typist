module.exports = {
  packagerConfig: { asar: true, extraResource: ['data'], ignore: [/^\/(?!dist(?:\/|$)|package\.json$|node_modules(?:\/|$))/] },
  makers: [
    {name:'@electron-forge/maker-zip',platforms:['darwin','win32']},
    {name:'@electron-forge/maker-dmg',platforms:['darwin']},
    {name:'@electron-forge/maker-squirrel',platforms:['win32'],config:{name:'Typist'}}
  ]
};
