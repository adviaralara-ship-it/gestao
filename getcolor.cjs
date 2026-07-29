const fs = require('fs');
// We need to read the background color of logo.png. Since we can't easily install jimp, we'll just read the image buffer and search.
// Actually, it's easier to just install jimp locally and run it.
const { execSync } = require('child_process');
try {
  execSync('npm install jimp@0.22.10 --no-save');
  const jimp = require('jimp');
  jimp.read('C:\\Users\\ESCRITORIO\\Downloads\\Automacao\\Gestão\\public\\logo.png').then(img => {
    const hex = img.getPixelColor(10, 10).toString(16);
    console.log("COLOR IS: #" + hex.slice(0, 6));
  });
} catch(e) {
  console.error(e);
}
