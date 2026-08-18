const sharp = require('sharp');
async function testRender() {
  const p1 = await sharp('public/logo.png').resize(1,1).raw().toBuffer();
  console.log('logo 1x1 pixel raw RGBA bytes:', p1);
  const p2 = await sharp('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png').resize(1,1).raw().toBuffer();
  console.log('ic_launcher 1x1 pixel raw RGBA bytes:', p2);
}
testRender();
