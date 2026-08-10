import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.use({ storageState: 'naver-auth.json' });
test.setTimeout(120000);

const PHOTO_DIR = 'C:\\auto_blog_photo';

test('사진 삽입 테스트', async ({ page }) => {
  const kb = page.keyboard;
  await page.goto('https://blog.naver.com/zzul_s?Redirect=Write&');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const frame = page.frameLocator('iframe[name="mainFrame"]');
  try { await frame.locator('.se-popup-alert-confirm .se-popup-button-cancel').click({ timeout: 5000 }); } catch {}

  await frame.getByRole('paragraph').filter({ hasText: '제목' }).click();
  await kb.insertText('사진 테스트');
  await kb.press('Enter');
  await kb.insertText('사진 들어갑니다');
  await kb.press('Enter');

  // 폴더에서 사진 파일 목록 읽기
  const files = fs.readdirSync(PHOTO_DIR)
    .filter(f => /\.(jpe?g|png)$/i.test(f))
    .map(f => path.join(PHOTO_DIR, f));
  console.log('찾은 사진:', files);

  // 첫 사진 삽입 (파일 선택창을 Playwright가 가로채서 넣음)
  const fcPromise = page.waitForEvent('filechooser');
  await frame.getByRole('button', { name: '사진 추가' }).click();
  const fc = await fcPromise;
  await fc.setFiles(files[0]);
  await page.waitForTimeout(5000); // 업로드 대기

  await frame.getByRole('button', { name: /저장/ }).first().click();
  await page.waitForTimeout(3000);
});