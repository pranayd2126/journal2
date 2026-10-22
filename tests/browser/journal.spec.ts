import { test, expect } from "@playwright/test";
test("register, persist session, trade lifecycle, analytics, habits, settings, logout/login", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `browser-${info.project.name}-${info.repeatEachIndex}-${Date.now()}@test.com`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Need a new account? Register" })
    .click();
  await page.getByPlaceholder("Your Full Name").fill("Test Trader");
  await page.getByPlaceholder("name@terminal.com").fill(email);
  await page.locator("input[type=password]").fill("123456");
  await page
    .getByRole("button", { name: "Create Profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New Trade", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New Trade", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Manual Log", exact: true }).click();
  await page.getByLabel("Symbol", { exact: true }).fill("TEST");
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByLabel("Entry Price", { exact: true }).fill("100");
  await page.getByLabel("Exit Price", { exact: true }).fill("110");
  await page.getByLabel("Brokerage (₹)", { exact: true }).fill("5");
  await page.getByLabel("Other Charges (₹)", { exact: true }).fill("3");
  await page.getByLabel("Setup Type", { exact: true }).fill("Breakout");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next Step", exact: true }).click();
  await expect(page.getByText("₹100", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Pro Journal Entry" })
    .click();
  await expect(page.getByText("TEST", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(page.getByText("₹92", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Strategy", { exact: true }).selectOption("Breakout");
  await expect(
    page.getByText("1 closed trades", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("From exit date").fill("2099-01-01");
  await expect(
    page.getByText("No closed trades match", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("button", { name: "Behavior", exact: true }).click();
  await expect(page.getByText("Plan adherence", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Edit trade" }).first().click();
  await page.getByLabel("Exit Price", { exact: true }).fill("120");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next Step", exact: true }).click();
  await page.getByRole("button", { name: "Update Trade", exact: true }).click();
  await expect(page.getByText("+₹192", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(page.getByText("Recent Trades", { exact: true })).toBeVisible();
  await expect(page.getByText("+₹192", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete trade" }).first().click();
  await expect(page.getByText("TEST", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Followed Risk Plan" }).click();
  await expect(page.getByText("Score: 20%")).toBeVisible();
  await page.getByRole("button", { name: "Risk Rules", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: false }).click();
  await page.getByLabel("Daily Loss Limit (₹)", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Save", exact: false }).click();
  await page.reload();
  await page.getByRole("button", { name: "Risk Rules", exact: true }).click();
  await expect(
    page.getByLabel("Daily Loss Limit (₹)", { exact: true }),
  ).toHaveValue("250");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Request AI review" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Change password", { exact: true }).first().click();
  await page.getByLabel("Current password", { exact: true }).fill("123456");
  await page.getByLabel("New password", { exact: true }).fill("abcdef");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByText("Password changed.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page
    .getByTitle("Logout", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Initiate Session" }),
  ).toBeVisible();
  await page.getByPlaceholder("name@terminal.com").fill(email);
  await page.locator("input[type=password]").fill("abcdef");
  await page.getByRole("button", { name: "Initiate Session" }).click();
  await expect(
    page.getByRole("button", { name: "New Trade", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("deterministic analytics, private HTTP requests and account isolation", async ({
  page,
}, info) => {
  const r = await page.request.post("/api/auth/signup", {
    data: {
      email: `seed-${info.project.name}-${info.repeatEachIndex}-${Date.now()}@test.com`,
      name: "Analytics Test",
      password: "123456",
    },
  });
  expect(r.ok()).toBe(true);
  const u = await r.json();
  for (const [i, exit] of [110, 95, 100, 120].entries()) {
    const response = await page.request.post(`/api/${u.id}/trades`, {
      headers: { "Idempotency-Key": `seed-00000000-0000-0000-000${i}` },
      data: {
        symbol: i % 2 ? "BANK" : "INDEX",
        side: "LONG",
        entryPrice: 100,
        exitPrice: exit,
        stopLoss: 90,
        quantity: 10,
        brokerage: 0,
        setupType: i % 2 ? "Pullback" : "Breakout",
        entryTime: `2026-10-${10 + i}T08:00:00Z`,
        exitTime: `2026-10-${10 + i}T09:00:00Z`,
        mistakes: i === 1 ? ["FOMO"] : [],
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByText("4 closed trades", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("₹250", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("₹62.5", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-analytics.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Journal Cards", exact: true })
    .click();
  await page
    .getByPlaceholder("Search symbols, tags, or reasons...")
    .fill("BANK");
  await expect(
    page.getByRole("button", { name: "View trade BANK", exact: true }),
  ).toHaveCount(2);
  await page.getByLabel("Outcome", { exact: true }).selectOption("loss");
  await expect(
    page.getByRole("button", { name: "View trade BANK", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "View trade BANK", exact: true })
    .click();
  await expect(page.getByText("P&L Outcome", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Close trade details" })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();

  await page.getByRole("button", { name: "Breakdowns", exact: true }).click();
  await expect(
    page.getByText("Strategy performance", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const oversized = await page.request.post("/api/upload", {
    data: { image: "x".repeat(3300000) },
  });
  expect(oversized.status()).toBe(413);
  const other = await page.request.post("/api/auth/signup", {
    data: {
      email: `second-${info.project.name}-${info.repeatEachIndex}-${Date.now()}@test.com`,
      name: "Second",
      password: "123456",
    },
  });
  const b = await other.json();
  expect((await page.request.get(`/api/${u.id}/trades`)).status()).toBe(403);
  await page.reload();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(page.getByText("TOTAL_RECORDS: 0")).toBeVisible();
  expect((await page.request.get(`/api/${b.id}/trades`)).ok()).toBe(true);
});
test("quick entry, manual reviews, calendar, notebook and preferences persist", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      email: `workflow-${info.project.name}-${info.repeatEachIndex}-${Date.now()}@test.com`,
      name: "Process Trader",
      password: "123456",
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto("/");
  const addButton = page.getByRole("button", {
    name: "New Trade",
    exact: true,
  });
  await addButton.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(addButton).toBeFocused();
  await addButton.click();
  await expect(page.getByRole("dialog", { name: "Quick trade" })).toBeVisible();
  await page.getByLabel("Symbol", { exact: true }).fill("PROCESS");
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByLabel("Entry price", { exact: true }).fill("100");
  await page.getByLabel("Exit price", { exact: true }).fill("110");
  await page.getByLabel("Fees (₹)", { exact: true }).fill("5");
  await page.getByLabel("Setup (optional)").fill("Patient breakout");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("₹95", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-overview-v2.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reviews", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "PROCESS" }).click();
  await page
    .getByRole("combobox", { name: "Review status", exact: true })
    .selectOption("REVIEWED");
  await page
    .getByRole("combobox", { name: "Execution rating", exact: true })
    .selectOption("4");
  await page.getByLabel("What went well").fill("Waited for the plan");
  await page.getByLabel("Lesson for the next trade").fill("Repeat the process");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByText("You’re all caught up")).toBeVisible();
  await page.getByLabel("Review queue filter").selectOption("REVIEWED");
  await expect(
    page.getByRole("button").filter({ hasText: "PROCESS" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /1 trades, ₹95/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /1 trades, ₹95/ }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-calendar-v2.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Write daily notes/ }).click();
  await page
    .getByRole("textbox", { name: "Journal notes", exact: true })
    .fill("Followed my plan today");
  await page.getByRole("button", { name: "Save journal review" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Journal review saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Journal notes", exact: true })
    .fill("Weekly reflection");
  await page.getByRole("button", { name: "Save journal review" }).click();
  await expect(
    page.getByRole("button", { name: "Save journal review" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Journal notes", exact: true })
    .fill("Monthly reflection");
  await page.getByRole("button", { name: "Save journal review" }).click();
  await expect(
    page.getByRole("button", { name: "Save journal review" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Strategy / setups").fill("Only patient breakouts");
  await page.getByLabel("Review completion target (%)").fill("90");
  await page
    .getByRole("combobox", { name: "Default analytics range", exact: true })
    .selectOption("month");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Settings and trading plan saved" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Strategy / setups")).toHaveValue(
    "Only patient breakouts",
  );
  await expect(page.getByLabel("Review completion target (%)")).toHaveValue(
    "90",
  );
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Journal notes", exact: true }),
  ).toHaveValue("Followed my plan today");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Journal notes", exact: true }),
  ).toHaveValue("Weekly reflection");
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Journal notes", exact: true }),
  ).toHaveValue("Monthly reflection");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "Journal notes", exact: true })
    .fill("Unsaved draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your trading notebook" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
