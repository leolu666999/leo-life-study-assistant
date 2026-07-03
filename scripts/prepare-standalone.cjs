const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

if (fs.existsSync(standaloneDir)) {
  fs.rmSync(path.join(standaloneDir, "data"), { recursive: true, force: true });
  fs.rmSync(path.join(standaloneDir, "uploads"), { recursive: true, force: true });
  copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));
  copyDir(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
}
