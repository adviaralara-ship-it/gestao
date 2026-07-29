const jimp = require('jimp'); jimp.read('C:\\Users\\ESCRITORIO\\Desktop\\Alpha\\AS-Logomarca.jpg').then(img => console.log('COLOR IS: #' + img.getPixelColor(10, 10).toString(16).slice(0, 6)));
