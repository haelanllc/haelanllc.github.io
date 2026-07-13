const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const errors = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("http://localhost:4173/games/tide-skimmer/", { waitUntil: "networkidle" });
  await page.tap("#start");
  await page.waitForTimeout(700);

  const info = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas.getContext("2d");
    const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;

    return {
      title: document.title,
      messageHidden: document.querySelector("#message").hidden,
      score: document.querySelector("#score").textContent,
      canvas: [canvas.width, canvas.height],
      pixel: Array.from(pixel),
      soundText: document.querySelector("#sound").textContent
    };
  });

  console.log(JSON.stringify({ info, errors }, null, 2));
  await browser.close();

  if (errors.length > 0) process.exit(1);
})();
