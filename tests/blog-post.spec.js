// 범용 블로그 초안 작성 스크립트
// 실행: $env:POST_DATA='data/가게이름.json'; npx playwright test tests/blog-post.spec.js --headed --project=chromium
// POST_DATA 미지정 시 data/post.json 사용
//
// 설계 원칙: 어떤 단계가 실패해도 절대 멈추지 않고 건너뛴 뒤 임시저장까지 간다.
// 실패한 단계는 콘솔에 '[건너뜀]'으로 남기므로 나중에 초안에서 수동 보완하면 됨.
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DATA_PATH = process.env.POST_DATA || 'data/post.json';
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8').replace(/^﻿/, ''));

test.use({ storageState: 'naver-auth.json' });
test.setTimeout(300000);

async function p(page, text) {
  await page.keyboard.insertText(text);
  await page.waitForTimeout(120);
  await page.keyboard.press('Enter');
}

// 이모지와 글자는 반드시 나눠서 입력 (같이 넣으면 뒷글자가 사라짐)
async function line(page, emoji, text) {
  const kb = page.keyboard;
  await kb.insertText(emoji); await page.waitForTimeout(150);
  await kb.insertText(' ' + text); await page.waitForTimeout(150);
  await kb.press('Enter');
}

async function align(frame, name) {
  await frame.getByRole('button', { name: '정렬 열기' }).click({ timeout: 5000 });
  await frame.getByRole('button', { name }).click({ timeout: 5000 });
}

// 세로라인 인용구 소제목 (caption이 있으면 출처 칸에 작은 글씨로)
async function heading(page, frame, text, caption) {
  await frame.getByRole('button', { name: '인용구 선택' }).click({ timeout: 8000 });
  await frame.getByRole('listbox').getByRole('button', { name: '인용구 2' }).click({ timeout: 5000 });
  await page.keyboard.insertText(text);
  if (caption) {
    try {
      await frame.getByRole('paragraph').filter({ hasText: '출처 입력' }).click({ timeout: 4000 });
      await page.waitForTimeout(200);
      await page.keyboard.insertText(caption);
    } catch { console.log('[건너뜀] 출처(가격) 입력 실패:', text); }
  }
  await frame.getByRole('button', { name: '본문 추가' }).click({ timeout: 5000 });
  await page.waitForTimeout(200);
}

// 마지막 문단 클릭으로 커서 복구 (선택 오버레이가 가로막으면 Escape 후 force 클릭)
async function focusEnd(page, frame) {
  const lastPara = frame.locator('.se-text-paragraph').last();
  try {
    await lastPara.click({ timeout: 5000 });
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    await lastPara.click({ force: true, timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

// 사진 삽입. 파일선택창은 Playwright가 가로채서 OS 창이 안 뜨게 하고,
// 이벤트가 안 오면 #hidden-file input에 직접 주입으로 폴백.
// 여러 장이면 '비슷한 사진 묶기' 창에서 슬라이드/콜라주 선택.
async function insertPhotos(page, frame, fileNames, layout) {
  const files = fileNames.map(f => path.join(data.photoDir, f));
  console.log('사진 삽입 시작:', fileNames.join(', '));
  const imageModules = frame.locator('.se-component.se-image, .se-component.se-imageGroup, .se-component.se-imageStrip');
  const before = await imageModules.count().catch(() => 0);

  const fcPromise = page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null);
  await frame.getByRole('button', { name: '사진 추가' }).click({ timeout: 8000 });
  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(files);
  } else {
    console.log('파일선택창 가로채기 실패 → #hidden-file 직접 주입');
    await frame.locator('#hidden-file').setInputFiles(files);
  }

  // 여러 장이면 묶기 방식 선택 창에서 슬라이드/콜라주 클릭 (안 뜨면 그냥 진행)
  if (files.length > 1) {
    const choice = layout || data.photoLayout || '슬라이드';
    try {
      await frame.getByText(choice, { exact: true }).click({ timeout: 20000 });
      console.log('묶기 방식 선택:', choice);
    } catch { console.log('묶기 선택 창이 뜨지 않음, 계속 진행'); }
  }

  // 업로드 완료 대기: 이미지/그룹 모듈 개수가 늘어날 때까지 (최대 90초)
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if ((await imageModules.count().catch(() => 0)) > before) break;
    await page.waitForTimeout(1000);
  }
  const after = await imageModules.count().catch(() => -1);
  console.log(`업로드 완료: 모듈 ${before} → ${after}개`);
  await page.waitForTimeout(1500);
  await focusEnd(page, frame);
}

// 위치 섹션: 지도(장소) 첨부. 검색 결과는 무조건 첫 번째 항목 선택 (정확한 지점은 사용자가 초안에서 확인/수정).
// 어느 단계가 실패해도 팝업 닫고 본문으로 복귀해서 계속 진행.
async function insertLocation(page, frame) {
  const kb = page.keyboard;
  await frame.getByRole('button', { name: '인용구 선택' }).click({ timeout: 8000 });
  await frame.getByRole('listbox').getByRole('button', { name: '인용구 2' }).click({ timeout: 5000 });
  await kb.insertText('위치');

  let mapDone = false;
  try {
    await frame.getByRole('button', { name: '장소 추가' }).click({ timeout: 8000 });
    const searchBox = frame.getByRole('textbox', { name: '장소명을 입력하세요' });
    await searchBox.fill(data.place.query, { timeout: 8000 });
    await page.waitForTimeout(800);
    await searchBox.press('Enter'); // 검색 실행 (Enter 없이는 결과가 안 뜰 수 있음)

    // 첫 번째 검색 결과의 '추가' 버튼 클릭 (정확한 지점은 사용자가 초안에서 확인)
    const firstItem = frame.locator('li.se-place-map-search-result-item').first();
    await firstItem.waitFor({ timeout: 10000 });
    const firstText = await firstItem.innerText({ timeout: 8000 }).catch(() => '?');
    console.log('첫 번째 장소 결과:', firstText.replace(/\n/g, ' / '));
    try {
      await firstItem.getByRole('button', { name: '추가' }).click({ timeout: 5000 });
    } catch {
      // 예전 UI 대비: 항목 클릭 후 전체 '추가' 버튼
      await firstItem.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      await frame.getByRole('button', { name: '추가', exact: true }).click({ timeout: 5000 });
    }
    await frame.getByRole('button', { name: '확인' }).click({ timeout: 8000 });
    await page.waitForTimeout(2000);
    mapDone = true;
    console.log('지도 첨부 완료 (첫 번째 검색 결과)');
  } catch (e) {
    console.log('[건너뜀] 지도 첨부 실패:', e.message.split('\n')[0]);
    // 열려 있는 장소 팝업을 확실히 닫는다 (검색창이 안 보일 때까지)
    for (let i = 0; i < 3; i++) {
      const searchVisible = await frame.getByRole('textbox', { name: '장소명을 입력하세요' }).isVisible().catch(() => false);
      if (!searchVisible) break;
      for (const name of ['취소', '닫기']) {
        try { await frame.getByRole('button', { name, exact: true }).first().click({ timeout: 1500 }); } catch {}
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
    // 인용구에 갇혀 있으면 본문으로 탈출
    try { await frame.getByRole('button', { name: '본문 추가' }).click({ timeout: 3000 }); } catch {}
  }

  // 주소/영업시간/전화/주차 줄 (지도 성공 여부와 무관하게 시도)
  try {
    await focusEnd(page, frame);
    await align(frame, '가운데 정렬');
    if (data.place.address) await line(page, '📍', data.place.address);
    if (data.place.hours) await line(page, '🕐', data.place.hours);
    if (data.place.phone) await line(page, '📞', data.place.phone);
    if (data.place.parking) await line(page, '🚗', data.place.parking);
    await align(frame, '왼쪽 정렬');
  } catch (e) {
    console.log('[건너뜀] 위치 정보 줄 입력 실패:', e.message.split('\n')[0]);
  }
  return mapDone;
}

test(`초안 작성: ${data.title}`, async ({ page }) => {
  const kb = page.keyboard;
  await page.goto('https://blog.naver.com/zzul_s?Redirect=Write&');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const frame = page.frameLocator('iframe[name="mainFrame"]');

  // 이전 글 복구 팝업 등 닫기
  try { await frame.locator('.se-popup-alert-confirm .se-popup-button-cancel').click({ timeout: 5000 }); } catch {}
  try { await frame.getByRole('button', { name: '닫기' }).click({ timeout: 2000 }); } catch {}

  // 제목
  await frame.getByRole('paragraph').filter({ hasText: '제목' }).click();
  await kb.insertText(data.title);
  await kb.press('Enter');

  // 첫인사
  for (const t of data.intro) await p(page, t);

  // │ 위치 (place가 있을 때만)
  if (data.place && data.place.query) {
    await insertLocation(page, frame).catch(e => console.log('[건너뜀] 위치 섹션 실패:', e.message.split('\n')[0]));
  }

  // 본문 섹션들 — 항목 하나가 실패해도 다음 항목으로 계속
  for (const section of data.sections) {
    console.log('섹션 시작:', section.heading);
    try {
      await heading(page, frame, section.heading, section.caption);
    } catch (e) {
      console.log('[건너뜀] 소제목 실패:', section.heading, e.message.split('\n')[0]);
      await page.keyboard.press('Escape').catch(() => {});
      await focusEnd(page, frame);
    }
    for (const item of section.content) {
      try {
        if (item.photos) await insertPhotos(page, frame, item.photos, item.layout);
        if (item.text) await p(page, item.text);
      } catch (e) {
        console.log('[건너뜀] 본문 항목 실패:', e.message.split('\n')[0]);
        await page.keyboard.press('Escape').catch(() => {});
        await focusEnd(page, frame);
      }
    }
  }

  // 마무리
  for (const t of data.outro) {
    try { await p(page, t); } catch {}
  }

  // 스티커 (실패해도 저장은 진행)
  if (data.sticker) {
    try {
      await frame.getByRole('button', { name: '스티커 추가' }).click({ timeout: 8000 });
      await page.waitForTimeout(1000);
      try { await frame.getByRole('button', { name: '닫기', exact: true }).click({ timeout: 2000 }); } catch {}
      await frame.getByRole('button', { name: data.sticker.pack }).click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await frame.getByRole('button', { name: data.sticker.item }).click({ timeout: 5000 });
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('[건너뜀] 스티커 삽입 실패:', e.message.split('\n')[0]);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  // ── 발행창: 주제 + 태그 입력 후 발행하지 않고 임시저장 ──
  try {
    await frame.getByRole('button', { name: '발행' }).click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    try {
      await frame.getByLabel('주제 목록 버튼').click({ timeout: 5000 });
      await frame.getByRole('button', { name: data.category || '맛집' }).click({ timeout: 5000 });
      await frame.getByRole('button', { name: '확인' }).click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } catch { console.log('[건너뜀] 주제 설정 실패'); }

    const tagBox = frame.getByRole('combobox', { name: '태그 입력 (최대 30개)' });
    for (const t of data.tags || []) {
      try {
        await tagBox.fill(t, { timeout: 3000 });
        await tagBox.press('Enter');
        await page.waitForTimeout(150);
      } catch { console.log('[건너뜀] 태그 실패:', t); }
    }

    // 발행창 닫기 (발행 X)
    try { await frame.getByRole('button', { name: '닫기' }).click({ timeout: 3000 }); } catch {}
  } catch (e) {
    console.log('[건너뜀] 발행창(주제/태그) 실패:', e.message.split('\n')[0]);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // 임시저장 — 무조건 시도
  await frame.getByRole('button', { name: '저장', exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('임시저장 완료');
});
