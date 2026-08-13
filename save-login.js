// 네이버 로그인 세션 저장 스크립트
// 실행: node save-login.js
//
// 브라우저가 뜨면 직접 네이버에 로그인한 뒤, 이 터미널로 돌아와 Enter를 누르세요.
// ★ 로그인할 때 "로그인 상태 유지"를 반드시 체크하세요. 안 하면 며칠 뒤 세션이 끊깁니다.
//
// 예전 방식(빈 컨텍스트 + storageState JSON)은 실행할 때마다 네이버가 새 기기로 인식해
// 세션이 자주 끊겼습니다. 이제는 .naver-profile 폴더에 크롬 프로필을 통째로 유지해서
// 기기 신뢰 정보까지 그대로 재사용합니다. (blog-post.spec.js도 같은 프로필을 씁니다)
const { chromium } = require('@playwright/test');
const path = require('path');
const readline = require('readline');

const PROFILE_DIR = path.join(__dirname, '.naver-profile');

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://nid.naver.com/nidlogin.login');

  console.log('\n브라우저에서 네이버에 로그인하세요.');
  console.log('★ "로그인 상태 유지" 체크박스를 꼭 켜세요! (안 켜면 또 금방 끊깁니다)');
  console.log('로그인이 끝나면 이 창에서 Enter를 누르세요...\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // "로그인 상태 유지"를 안 켜면 NID_AUT/NID_SES가 세션 쿠키(expires=-1)로 발급돼
  // 브라우저를 닫는 순간 사라진다. 그 자리에서 잡아내고 다시 하도록 안내한다.
  let ok = false;
  while (!ok) {
    await new Promise((resolve) => rl.question('', resolve));

    const cookies = await context.cookies();
    const auth = cookies.filter((c) => c.name === 'NID_AUT' || c.name === 'NID_SES');

    if (auth.length === 0) {
      console.log('\n❌ 로그인이 확인되지 않습니다. 로그인을 끝낸 뒤 다시 Enter를 눌러주세요.\n');
      continue;
    }

    const temporary = auth.filter((c) => !c.expires || c.expires < 0);
    if (temporary.length > 0) {
      console.log('\n❌ "로그인 상태 유지"가 꺼진 채로 로그인됐습니다.');
      console.log('   지금 쿠키는 브라우저를 닫으면 사라져서 자동화가 또 실패합니다.');
      console.log('   → 우측 상단 프로필에서 로그아웃 → "로그인 상태 유지" 체크 → 다시 로그인');
      console.log('   끝나면 다시 Enter를 눌러주세요.\n');
      continue;
    }

    const days = Math.round((Math.min(...auth.map((c) => c.expires)) * 1000 - Date.now()) / 86400000);
    console.log(`\n✅ 로그인 유지 확인! 쿠키 만료까지 약 ${days}일 남았습니다.`);
    ok = true;
  }
  rl.close();

  // 프로필 폴더가 본체지만, 만약을 위한 백업으로 storageState도 남겨둔다
  try {
    await context.storageState({ path: path.join(__dirname, 'naver-auth.json') });
  } catch (e) {
    console.log('[건너뜀] naver-auth.json 백업 실패:', e.message.split('\n')[0]);
  }

  console.log(`로그인 프로필 저장 완료: ${PROFILE_DIR}`);
  await context.close();
})();
