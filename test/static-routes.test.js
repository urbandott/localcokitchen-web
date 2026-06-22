const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const routeFiles = [];

const walk = (directory) => {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if ([".git", ".idea", "node_modules"].includes(entry.name)) return;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name === "index.html") routeFiles.push(fullPath);
  });
};
walk(root);

const internalTargetExists = (target) => {
  const pathname = target.split(/[?#]/)[0];
  if (!pathname.startsWith("/")) return true;
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  return fs.existsSync(path.join(root, relative))
    || fs.existsSync(path.join(root, relative, "index.html"));
};

test("every static route has one document title, main landmark, and h1", () => {
  assert.ok(routeFiles.length >= 20);
  routeFiles.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    assert.match(html, /^<!doctype html>/i, relative);
    assert.match(html, /<html\b[^>]*\blang="en"/i, relative);
    assert.equal((html.match(/<title\b/gi) || []).length, 1, `${relative}: title`);
    assert.equal((html.match(/<main\b/gi) || []).length, 1, `${relative}: main`);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${relative}: h1`);
  });
});

test("static routes have unique IDs, valid labels, and resolvable local assets", () => {
  routeFiles.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    const ids = [...html.matchAll(/\bid=["']([^"']+)/gi)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${relative}: duplicate id`);

    for (const match of html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)/gi)) {
      assert.ok(ids.includes(match[1]), `${relative}: label target ${match[1]}`);
    }

    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)/gi)) {
      assert.ok(internalTargetExists(match[1]), `${relative}: missing ${match[1]}`);
    }
  });
});

test("HTML contains no inline event handlers or ARIA application-menu roles", () => {
  routeFiles.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, relative);
    assert.doesNotMatch(html, /\srole=["']menu(?:item)?["']/i, relative);
  });
});

test("customer menu contains real loading and error-state hooks, not fake inventory", () => {
  const menu = fs.readFileSync(path.join(root, "menu/index.html"), "utf8");
  assert.match(menu, /data-menu-status/);
  assert.doesNotMatch(menu, /Smoked brisket plate|Tamales dozen|Baklava box/);
});
