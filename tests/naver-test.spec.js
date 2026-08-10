import { test } from '@playwright/test';

test.use({ storageState: 'naver-auth.json' });
test.setTimeout(180000);

async function line(page, emoji, text) {
  const kb = page.keyboard;
  await kb.insertText(emoji); await page.waitForTimeout(150);
  await kb.insertText(' ' + text); await page.waitForTimeout(150);
  await kb.press('Enter');
}
async function p(page, text) {
  await page.keyboard.insertText(text); await page.waitForTimeout(120);
  await page.keyboard.press('Enter');
}
async function heading(page, frame, text) {
  await frame.getByRole('button', { name: '인용구 선택' }).click();
  await frame.getByRole('listbox').getByRole('button', { name: '인용구 2' }).click();
  await page.keyboard.insertText(text);
  await frame.getByRole('button', { name: '본문 추가' }).click();
  await page.waitForTimeout(200);
}
async function align(frame, name) {
  await frame.getByRole('button', { name: '정렬 열기' }).click();
  await frame.getByRole('button', { name }).click();
}

test('정진식당 초안 전체', async ({ page }) => {
  const kb = page.keyboard;
  await page.goto('https://blog.naver.com/zzul_s?Redirect=Write&');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const frame = page.frameLocator('iframe[name="mainFrame"]');

  try { await frame.locator('.se-popup-alert-confirm .se-popup-button-cancel').click({ timeout: 5000 }); } catch {}
  try { await frame.getByRole('button', { name: '닫기' }).click({ timeout: 2000 }); } catch {}

  await frame.getByRole('paragraph').filter({ hasText: '제목' }).click();
  await kb.insertText('수원 제주 오겹살 숯불구이 - 정진식당');
  await kb.press('Enter');

  await p(page, '안녕하세요 (〃 ˆ ᵕ ˆ) ৎ');
  await p(page, '오늘 소개해 드릴 맛집은 제주 오겹살 집 정진식당입니다!');
  await p(page, '제가 자주 가는 찐 맛집이에요ㅎㅎ');

  // │ 위치 → 지도
  await frame.getByRole('button', { name: '인용구 선택' }).click();
  await frame.getByRole('listbox').getByRole('button', { name: '인용구 2' }).click();
  await kb.insertText('위치');
  await frame.getByRole('button', { name: '장소 추가' }).click();
  await frame.getByRole('textbox', { name: '장소명을 입력하세요' }).fill('정진식당');
  await page.waitForTimeout(1500);
  await frame.getByText('정진식당 수원').first().click();
  await frame.getByRole('button', { name: '추가', exact: true }).click();
  await frame.getByRole('button', { name: '확인' }).click();
  await page.waitForTimeout(2000);

  await frame.locator('.se-text-paragraph').last().click();
  await page.waitForTimeout(500);
  await align(frame, '가운데 정렬');
  await line(page, '📍', '경기도 수원시 영통구 중부대로 311');
  await line(page, '🕐', '매주 일요일 정기휴무 / 월-금 11:00~22:00, 토 11:00~21:50');
  await line(page, '📞', '031-214-9244');
  await line(page, '🚗', '주차 가능 (무료)');
  await align(frame, '왼쪽 정렬');

  await heading(page, frame, '건물 외부');
  await p(page, '(사진)');
  await p(page, '주차는 식당 앞쪽에 빈자리에 주차하시면 돼요!');
  await p(page, '입구는 앞에 문 아니고 옆으로 가시면 입구 나와요');

  await heading(page, frame, '메뉴판');
  await p(page, '(사진)');
  await p(page, '저는 오겹살 3인분 시키고 나중에 2인분 추가했어요ㅎㅎ');
  await p(page, '(사진)');
  await p(page, '기본으로 콘 샐러드, 샐러드, 파채 등등 위에 사진처럼 나와요!');
  await p(page, '(사진)');
  await p(page, '셀프 바가 있어서 여기서 원하는 거 더 가져다 드시면 되고');
  await p(page, '콘 샐러드는 달라고 하셔야 돼요!');

  // │ 오겹살 3인분 (출처에 가격)
  await frame.getByRole('button', { name: '인용구 선택' }).click();
  await frame.getByRole('listbox').getByRole('button', { name: '인용구 2' }).click();
  await kb.insertText('오겹살 3인분');
  await frame.getByRole('paragraph').filter({ hasText: '출처 입력' }).click();
  await page.waitForTimeout(200);
  await kb.insertText('20,000원 (총 60,000원)');
  await frame.getByRole('button', { name: '본문 추가' }).click();
  await page.waitForTimeout(200);
  await p(page, '(사진)');

  await p(page, '부모님이랑도 가고 친구랑도 가는 곳이에요ㅎㅎ');
  await p(page, '실패 없을 거예요!!');
  await p(page, '오겹살 먹고 싶을 때 정진식당 추천드려요!');

  // 마무리 스티커
  await frame.getByRole('button', { name: '스티커 추가' }).click();
  await page.waitForTimeout(1000);
  try { await frame.getByRole('button', { name: '닫기', exact: true }).click({ timeout: 2000 }); } catch {}
  await frame.getByRole('button', { name: 'ogq_624c0baa4c9ed' }).click();
  await page.waitForTimeout(500);
  await frame.getByRole('button', { name: 'ogq_624c0baa4c9ed-21' }).click();
  await page.waitForTimeout(1000);

  // ── 발행창: 주제 + 태그 (발행은 안 함) ──
  await frame.getByRole('button', { name: '발행' }).click();
  await page.waitForTimeout(1500);
  try {
    await frame.getByLabel('주제 목록 버튼').click();
    await frame.getByRole('button', { name: '맛집' }).click();
    await frame.getByRole('button', { name: '확인' }).click();
    await page.waitForTimeout(500);
  } catch {}

  const tags = ['수원','수원맛집','경기도','경기도수원맛집','수원오겹살','수원돼지고기맛집','수원돼지고기','맛집','수원로컬맛집','수원로컬맛집내돈내산','내돈내산'];
  const tagBox = frame.getByRole('combobox', { name: '태그 입력 (최대 30개)' });
  for (const t of tags) {
    await tagBox.fill(t);
    await tagBox.press('Enter');
    await page.waitForTimeout(150);
  }

  // 발행창 닫고 임시저장 (발행 X)
  try { await frame.getByRole('button', { name: '닫기' }).click({ timeout: 3000 }); } catch {}
  await frame.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(2000);
});