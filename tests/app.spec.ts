import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('#model-container')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(page.locator('#model-loading')).toBeHidden();
}

test('real model loads, canvas picking selects the clicked muscle, dragging does not select', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await page.getByRole('searchbox').fill('Biceps brachii');
  await page.getByRole('button', { name: '肱二头肌 Biceps brachii' }).click();
  await expect(page.locator('.detail-title h2')).toHaveText('肱二头肌');
  await page.waitForTimeout(650); // Wait for the camera preset animation to complete.
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Expected WebGL canvas');
  const point = { x: canvas.x + canvas.width * 0.47, y: canvas.y + canvas.height * 0.26 };
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('.model-tooltip')).toContainText('胸大肌');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.detail-title h2')).toHaveText('胸大肌');
  await expect(page.locator('.detail-tags')).toContainText('右侧');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 100, canvas.y + canvas.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.detail-title h2')).toHaveText('胸大肌');
  expect(errors).toEqual([]);
});

test('Chinese search, region filtering and deep-muscle isolation work together', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '核心', exact: true }).click();
  await expect(page.locator('#muscle-list [data-muscle]')).toHaveCount(4);
  await page.getByRole('searchbox').fill('腹横肌');
  await expect(page.locator('#muscle-list [data-muscle]')).toHaveCount(1);
  await page.locator('[data-muscle="transversus-abdominis"]').click();
  await expect(page.locator('.detail-title h2')).toHaveText('腹横肌');
  await expect(page.locator('.deep-note')).toBeVisible();
  await page.getByRole('button', { name: '单独观察这块肌肉' }).click();
  await expect(page.locator('#isolated-badge')).toBeVisible();
  await expect(page.locator('#isolate-button')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.cache/isolated-deep.png', fullPage: true });
  await page.getByRole('button', { name: '返回全身观察' }).click();
  await expect(page.locator('#isolated-badge')).toBeHidden();
  await page.getByLabel('显示层次').selectOption('deep');
  await page.getByRole('button', { name: '重置全部视图' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByLabel('显示层次')).toHaveValue('all');
  await expect(page.locator('#muscle-list [data-muscle]')).toHaveCount(45);
});

test('training details, attachments, view controls and keyboard tabs are usable', async ({ page }) => {
  await ready(page);
  await page.getByRole('tab', { name: '训练关联' }).click();
  await expect(page.getByRole('heading', { name: '俯卧撑', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '训练关联' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '肌肉功能' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('summary').click();
  await expect(page.getByRole('heading', { name: '起点', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '背面', exact: true }).click();
  await expect(page.locator('[data-view="back"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '骨骼参照', exact: true }).click();
  await expect(page.locator('#bones-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '放大模型', exact: true }).click();
  await page.getByRole('button', { name: '缩小模型', exact: true }).click();
});

test('bookmarks persist and empty searches can be reset', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '收藏胸大肌', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏胸大肌', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '只显示收藏的肌肉' }).click();
  await expect(page.locator('#muscle-list [data-muscle]')).toHaveCount(1);
  await page.getByRole('searchbox').fill('不存在的肌肉');
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('#muscle-list [data-muscle]')).toHaveCount(45);
});

test('guide and asset licenses are accessible and dialogs close with Escape', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '学习指南' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '先认识几个动作词' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('#credits-button').click();
  await expect(page.getByRole('heading', { name: 'Z-Anatomy' })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看模型授权' })).toHaveCount(2);
});

test('phone layout remains within viewport and exposes the same learning workflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const search = await page.getByRole('searchbox').boundingBox();
  const count = await page.locator('.count-pill').boundingBox();
  expect(search!.x + search!.width).toBeLessThan(390);
  expect(count!.x + count!.width).toBeLessThan(390);
  await page.getByRole('searchbox').fill('背阔肌');
  await page.locator('[data-muscle="latissimus-dorsi"]').click();
  await expect(page.locator('.detail-title h2')).toHaveText('背阔肌');
  await page.getByRole('button', { name: '单独观察这块肌肉' }).click();
  await expect(page.locator('#isolate-button')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '训练关联' }).click();
  await expect(page.getByRole('heading', { name: '高位下拉' })).toBeVisible();
  await page.getByRole('button', { name: '返回全身观察' }).click();
  await page.getByRole('button', { name: '重置全部视图' }).click();
  await page.waitForTimeout(650); // Capture the settled full-body camera, not a transition.
  await page.screenshot({ path: '.cache/mobile.png', fullPage: true });
});

test('a failed model download keeps the searchable learning content available', async ({ page }) => {
  await page.route('**/models/*.mesh', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: '重新加载', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('臀大肌');
  await page.locator('[data-muscle="gluteus-maximus"]').click();
  await expect(page.locator('.detail-title h2')).toHaveText('臀大肌');
  await expect(page.locator('#function-panel')).toContainText('髋伸展');
});
