const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const source = path.join(root, "assets", "app-icon.svg");
const iconDir = path.join(root, "build", "icon.iconset");
const output = path.join(root, "build", "icon.icns");

const sizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"]
];

async function main() {
  fs.rmSync(iconDir, { recursive: true, force: true });
  fs.mkdirSync(iconDir, { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });

  await Promise.all(
    sizes.map(([size, filename]) =>
      sharp(source)
        .resize(size, size)
        .png()
        .toFile(path.join(iconDir, filename))
    )
  );

  execFileSync("iconutil", ["-c", "icns", iconDir, "-o", output], { stdio: "inherit" });
  console.log(`Generated ${path.relative(root, output)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
