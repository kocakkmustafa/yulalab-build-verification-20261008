import { expect, test } from "@playwright/test";

// Compare observable v3 layout/style behavior against the real built CSS.
// These controls supplement the unchanged route, product and accessibility suites.
for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 800 }]) {
  test(`legal layout retains sibling spacing and resets at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/en/privacy/motion");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const styles = await page.evaluate(() => {
      const host = document.createElement("div");
      host.className = "space-y-8";
      host.innerHTML = '<p>First</p><p hidden>Hidden</p><p>Last</p>';
      document.body.append(host);
      const first = getComputedStyle(host.children[0]);
      const hidden = getComputedStyle(host.children[1]);
      const last = getComputedStyle(host.children[2]);
      const button = document.createElement("button");
      button.textContent = "Fixture";
      document.body.append(button);
      const result = {
        firstMarginTop: first.marginTop, firstMarginBottom: first.marginBottom,
        lastMarginTop: last.marginTop, lastMarginBottom: last.marginBottom,
        hiddenDisplay: hidden.display, buttonCursor: getComputedStyle(button).cursor,
        bodyFont: getComputedStyle(document.body).fontFamily,
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
      host.remove();
      button.remove();
      return result;
    });
    expect(styles.rootFontSize).toBe("16px");
    expect(styles.firstMarginTop).toBe("0px");
    expect(styles.firstMarginBottom).toBe("0px");
    expect(styles.lastMarginTop).toBe("32px");
    expect(styles.lastMarginBottom).toBe("0px");
    expect(styles.hiddenDisplay).toBe("none");
    expect(styles.buttonCursor).toBe("pointer");
    expect(styles.bodyFont).not.toContain("var(");
    expect(styles.bodyFont).toMatch(/Inter|sans-serif/);
    expect(styles.pageOverflows).toBe(false);
  });
}

test("status colors, font variables, gradients and focus transitions retain their behavior", async ({ page }) => {
  await page.goto("/en/support");
  const styles = await page.evaluate(() => {
    const host = document.createElement("div");
    host.innerHTML = '<span class="text-amber-300">A</span><span class="text-emerald-400">B</span>' +
      '<span class="font-display">Display</span><span class="font-mono">Mono</span>' +
      '<div class="bg-gradient-to-t from-black/40 to-transparent">Gradient</div>' +
      '<button class="transition-colors focusable">Focus</button>';
    document.body.append(host);
    const read = (index: number) => getComputedStyle(host.children[index]);
    const button = host.children[5] as HTMLButtonElement;
    button.focus();
    const result = {
      amber: read(0).color, emerald: read(1).color,
      displayFont: read(2).fontFamily, monoFont: read(3).fontFamily,
      gradient: read(4).backgroundImage,
      transition: read(5).transitionProperty,
      outlineStyle: read(5).outlineStyle, outlineWidth: read(5).outlineWidth,
    };
    host.remove();
    return result;
  });
  expect(styles.amber).toBe("rgb(252, 211, 77)");
  expect(styles.emerald).toBe("rgb(52, 211, 153)");
  expect(styles.displayFont).not.toContain("var(");
  expect(styles.displayFont).toMatch(/Manrope|Inter/);
  expect(styles.monoFont).not.toContain("var(");
  expect(styles.monoFont).toMatch(/JetBrains|monospace/);
  expect(styles.gradient).toContain("linear-gradient(");
  expect(styles.gradient).toContain("to top");
  expect(styles.gradient).toContain("srgb");
  expect(styles.transition).toBe("color, background-color, border-color, text-decoration-color, fill, stroke");
  expect(styles.outlineStyle).toBe("solid");
  expect(styles.outlineWidth).toBe("2px");
});
