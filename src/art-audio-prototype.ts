import Phaser from 'phaser';

export type ArtAudioPrototypeMode = 'character-warm-pixel' | 'ui-warm-pixel' | 'motion-warm-pixel' | 'music-warm-pixel' | 'sfx-warm-pixel';

const P = {
  ink: 0x3b2531, cream: 0xfff1c6, paper: 0xf6d995, pale: 0xffe6a8,
  wood: 0x8e5136, darkWood: 0x573044, floor: 0xb66f45, green: 0x5e9a67,
  leaf: 0x86ba6f, sky: 0x86c9c8, blue: 0x4e8092, gold: 0xf4b84a,
  red: 0xc95746, tire: 0x302936, peach: 0xe9a96f, white: 0xfff8df,
};

type CharacterRole = '정비사' | '점장' | '고객';
type Emotion = '기본' | '기쁨' | '고민';

class WarmPixelArtAudioScene extends Phaser.Scene {
  private readonly mode: ArtAudioPrototypeMode;
  private role: CharacterRole = '정비사';
  private emotion: Emotion = '기본';
  private uiState: '기본' | '완료 가능' | '잠금' = '기본';
  private audioContext?: AudioContext;
  private musicTimer?: number;
  private musicStep = 0;
  private musicPlaying = false;
  private musicRoom: 'HOME' | 'WORK' = 'HOME';
  private statusText?: Phaser.GameObjects.Text;

  constructor(mode: ArtAudioPrototypeMode) {
    super(`art-audio-${mode}`);
    this.mode = mode;
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopAudio());
    this.render();
  }

  private label(x: number, y: number, value: string, size = 12, color = '#3b2531', bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif',
      fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal',
      stroke: bold ? '#fff1c6' : undefined, strokeThickness: bold ? 1 : 0,
      align: 'center', lineSpacing: 3,
    });
  }

  private panel(x: number, y: number, width: number, height: number, fill = P.paper, depth = 5) {
    this.add.rectangle(x + 4, y + 5, width, height, P.darkWood).setDepth(depth);
    return this.add.rectangle(x, y, width, height, fill).setStrokeStyle(3, P.ink).setDepth(depth + 1);
  }

  private button(x: number, y: number, width: number, height: number, caption: string, action: () => void, active = false) {
    const depth = 30;
    this.add.rectangle(x + 3, y + 4, width, height, P.darkWood).setDepth(depth);
    const box = this.add.rectangle(x, y, width, height, active ? P.gold : P.paper)
      .setStrokeStyle(3, P.ink).setDepth(depth + 1).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.label(x, y, caption, caption.includes('\n') ? 10 : 11, '#3b2531', true).setOrigin(.5).setDepth(depth + 2)
      .setInteractive({ useHandCursor: true }).on('pointerdown', action);
    return box;
  }

  private render() {
    this.tweens.killAll();
    this.children.removeAll();
    this.drawWorkshopShell();
    if (this.mode === 'character-warm-pixel') this.renderCharacter();
    if (this.mode === 'ui-warm-pixel') this.renderUiIcons();
    if (this.mode === 'motion-warm-pixel') this.renderMotion();
    if (this.mode === 'music-warm-pixel') this.renderMusic();
    if (this.mode === 'sfx-warm-pixel') this.renderSfx();
  }

  private drawWorkshopShell() {
    this.add.rectangle(195, 405, 390, 810, P.cream);
    this.add.rectangle(195, 288, 390, 576, 0xd79a63);
    this.add.rectangle(195, 682, 390, 256, P.floor);
    for (let y = 574; y < 810; y += 36) this.add.line(0, 0, 0, y, 390, y, P.darkWood, .24).setOrigin(0);
    for (let x = 12; x < 420; x += 62) this.add.line(0, 0, x, 574, x - 26, 810, P.darkWood, .14).setOrigin(0);

    this.add.rectangle(195, 36, 366, 52, P.paper).setStrokeStyle(3, P.ink).setDepth(20);
    this.label(28, 18, 'DREAM BIKE GARAGE', 9, '#795044', true).setDepth(21);
    this.label(28, 34, this.modeTitle(), 14, '#3b2531', true).setDepth(21);
    this.label(360, 27, 'A', 18, '#a16028', true).setOrigin(.5).setDepth(21);

    this.add.rectangle(195, 160, 190, 138, P.sky).setStrokeStyle(5, P.darkWood).setDepth(1);
    this.add.rectangle(195, 195, 184, 66, 0x8fc975).setDepth(2);
    this.add.triangle(157, 182, 98, 226, 157, 150, 214, 226, P.green).setDepth(2);
    this.add.triangle(249, 183, 202, 226, 251, 150, 302, 226, 0x4f8060).setDepth(2);
    this.add.rectangle(195, 160, 7, 134, P.cream).setDepth(3);
    this.add.rectangle(195, 160, 184, 7, P.cream).setDepth(3);
    this.add.rectangle(48, 244, 68, 282, P.darkWood).setStrokeStyle(3, P.ink).setDepth(2);
    this.label(48, 116, 'TOOLS', 8, '#fff1c6', true).setOrigin(.5).setDepth(3);
    [P.red, P.gold, P.green].forEach((color, index) => {
      this.add.rectangle(48, 157 + index * 66, 14, 40, color).setStrokeStyle(2, P.ink).setDepth(3);
      this.add.circle(48, 185 + index * 66, 8, color).setStrokeStyle(2, P.ink).setDepth(3);
    });
    this.add.rectangle(342, 244, 62, 282, 0x6d8b62).setStrokeStyle(3, P.ink).setDepth(2);
    this.label(342, 116, 'ORDERS', 8, '#fff1c6', true).setOrigin(.5).setDepth(3);
    [0, 1, 2].forEach((index) => this.add.rectangle(342, 156 + index * 52, 42, 27, P.pale).setStrokeStyle(2, P.wood).setDepth(3));
  }

  private modeTitle() {
    return ({
      'character-warm-pixel': '따뜻한 픽셀 캐릭터',
      'ui-warm-pixel': '종이·목재 픽셀 UI',
      'motion-warm-pixel': '짧고 포근한 픽셀 모션',
      'music-warm-pixel': '포근한 Garage 칩튠',
      'sfx-warm-pixel': '부드러운 공방 효과음',
    } as const)[this.mode];
  }

  private renderCharacter() {
    this.panel(195, 352, 268, 230, 0xf2c77e, 6);
    this.label(195, 255, 'ROLE SILHOUETTE', 9, '#795044', true).setOrigin(.5).setDepth(8);
    const roles: CharacterRole[] = ['정비사', '점장', '고객'];
    roles.forEach((role, index) => {
      const x = 112 + index * 83;
      this.drawCharacter(x, 350, role, role === this.role ? 1.08 : .88, 9, role === this.role);
      this.button(x, 456, 72, 36, role, () => { this.role = role; this.render(); }, role === this.role);
    });

    this.panel(195, 582, 326, 176, P.pale, 8);
    this.drawPortrait(103, 575, this.role, this.emotion, 10);
    this.label(170, 518, `${this.role} · ${this.emotion}`, 14, '#3b2531', true).setDepth(11);
    const copy = this.role === '정비사' ? '앞치마와 공구 벨트로\n플레이 역할을 즉시 구분' : this.role === '점장' ? '짙은 조끼와 열쇠 배지로\nGarage 관리 역할을 표현' : '밝은 재킷과 주문 카드로\n요청을 들고 온 고객 표현';
    this.label(170, 546, copy, 10, '#795044').setDepth(11);
    (['기본', '기쁨', '고민'] as Emotion[]).forEach((emotion, index) => this.button(174 + index * 59, 638, 54, 34, emotion, () => { this.emotion = emotion; this.render(); }, emotion === this.emotion));
    this.label(195, 697, '작은 필드 실루엣 + 큰 대화 초상화의 연결을 비교', 9, '#fff1c6', true).setOrigin(.5).setDepth(12);
    this.panel(195, 756, 350, 54, P.wood, 12);
    this.label(195, 756, '독자적 3등신 비율 · 역할별 색과 소품 · 3단계 감정', 10, '#fff1c6', true).setOrigin(.5).setDepth(14);
  }

  private drawCharacter(x: number, y: number, role: CharacterRole, scale: number, depth: number, selected: boolean) {
    if (selected) this.add.ellipse(x, y + 73 * scale, 62 * scale, 18 * scale, P.gold, .55).setDepth(depth - 1);
    const outfit = role === '정비사' ? P.green : role === '점장' ? P.darkWood : P.blue;
    const hair = role === '점장' ? 0x5a3a2d : 0x734733;
    this.add.rectangle(x, y - 31 * scale, 36 * scale, 37 * scale, P.peach).setStrokeStyle(3, P.ink).setDepth(depth);
    this.add.rectangle(x, y - 50 * scale, 38 * scale, 13 * scale, hair).setDepth(depth + 1);
    this.add.rectangle(x, y + 16 * scale, 45 * scale, 60 * scale, outfit).setStrokeStyle(3, P.ink).setDepth(depth);
    this.add.rectangle(x - 12 * scale, y + 61 * scale, 14 * scale, 35 * scale, P.tire).setStrokeStyle(2, P.ink).setDepth(depth);
    this.add.rectangle(x + 12 * scale, y + 61 * scale, 14 * scale, 35 * scale, P.tire).setStrokeStyle(2, P.ink).setDepth(depth);
    if (role === '정비사') this.add.rectangle(x, y + 21 * scale, 27 * scale, 38 * scale, P.paper).setStrokeStyle(2, P.ink).setDepth(depth + 1);
    if (role === '점장') this.add.circle(x + 13 * scale, y, 6 * scale, P.gold).setStrokeStyle(2, P.ink).setDepth(depth + 1);
    if (role === '고객') this.add.rectangle(x + 28 * scale, y + 13 * scale, 20 * scale, 28 * scale, P.paper).setStrokeStyle(2, P.ink).setDepth(depth + 1);
  }

  private drawPortrait(x: number, y: number, role: CharacterRole, emotion: Emotion, depth: number) {
    this.add.rectangle(x, y, 106, 118, P.wood).setStrokeStyle(3, P.ink).setDepth(depth);
    const outfit = role === '정비사' ? P.green : role === '점장' ? P.darkWood : P.blue;
    this.add.rectangle(x, y + 39, 78, 42, outfit).setStrokeStyle(3, P.ink).setDepth(depth + 1);
    this.add.rectangle(x, y - 15, 62, 66, P.peach).setStrokeStyle(3, P.ink).setDepth(depth + 2);
    this.add.rectangle(x, y - 46, 66, 18, role === '점장' ? 0x5a3a2d : 0x734733).setDepth(depth + 3);
    const eyeY = y - 17;
    this.add.rectangle(x - 15, eyeY, 6, emotion === '기쁨' ? 3 : 7, P.ink).setDepth(depth + 4);
    this.add.rectangle(x + 15, eyeY, 6, emotion === '기쁨' ? 3 : 7, P.ink).setDepth(depth + 4);
    if (emotion === '고민') this.add.rectangle(x + 13, eyeY - 8, 15, 3, P.ink).setAngle(-12).setDepth(depth + 4);
    const mouthY = y + 7;
    if (emotion === '기쁨') this.add.rectangle(x, mouthY, 18, 4, P.red).setDepth(depth + 4);
    else if (emotion === '고민') this.add.rectangle(x, mouthY + 4, 14, 4, P.ink).setAngle(-8).setDepth(depth + 4);
    else this.add.rectangle(x, mouthY, 12, 3, P.ink).setDepth(depth + 4);
  }

  private renderUiIcons() {
    this.panel(195, 274, 326, 360, 0xf2c77e, 6);
    this.label(51, 105, 'TODAY\'S ORDER', 9, '#795044', true).setDepth(8);
    this.label(51, 128, '통학용 어반 바이크', 15, '#3b2531', true).setDepth(8);
    this.drawBike(195, 228, .7, 9);
    this.label(195, 317, this.uiState === '완료 가능' ? '부품 준비 완료!' : this.uiState === '잠금' ? 'Lv.15에 해금' : '필요 부품 3 / 4', 12, this.uiState === '완료 가능' ? '#3f7851' : '#795044', true).setOrigin(.5).setDepth(10);

    const icons = [
      { label: '휠', kind: 'wheel', ready: true }, { label: '프레임', kind: 'frame', ready: true },
      { label: '핸들', kind: 'handle', ready: true }, { label: '안장', kind: 'seat', ready: this.uiState === '완료 가능' },
    ];
    icons.forEach((icon, index) => {
      const x = 89 + (index % 2) * 142; const y = 377 + Math.floor(index / 2) * 88;
      this.drawIconTile(x, y, icon.label, icon.kind, icon.ready, this.uiState === '잠금', 10);
    });

    this.label(195, 526, '색상 + 형태 + 배지로 상태를 중복 전달', 9, '#fff1c6', true).setOrigin(.5).setDepth(12);
    this.panel(195, 598, 326, 94, P.pale, 8);
    this.drawCoin(70, 586, 10); this.label(91, 574, '2,480', 13, '#a16028', true).setDepth(11);
    this.drawEnergy(164, 586, 10); this.label(186, 574, '72/100', 13, '#3f7851', true).setDepth(11);
    this.drawBadge(270, 586, 10); this.label(292, 574, 'Lv.12', 13, '#795044', true).setDepth(11);
    this.label(195, 628, '재화·에너지·직급 아이콘은 홈 A안 상단 바와 동일', 9, '#795044').setOrigin(.5).setDepth(11);

    this.panel(195, 746, 350, 96, P.wood, 12);
    this.button(86, 746, 94, 42, '기본', () => { this.uiState = '기본'; this.render(); }, this.uiState === '기본');
    this.button(195, 746, 104, 42, '완료 가능', () => { this.uiState = '완료 가능'; this.render(); }, this.uiState === '완료 가능');
    this.button(304, 746, 94, 42, '잠금', () => { this.uiState = '잠금'; this.render(); }, this.uiState === '잠금');
  }

  private drawIconTile(x: number, y: number, label: string, kind: string, ready: boolean, locked: boolean, depth: number) {
    const fill = locked ? 0x806455 : ready ? P.pale : P.paper;
    this.add.rectangle(x, y, 126, 72, fill).setStrokeStyle(3, P.ink).setDepth(depth);
    if (kind === 'wheel') this.add.circle(x - 34, y - 3, 17, P.paper).setStrokeStyle(6, P.tire).setDepth(depth + 1);
    if (kind === 'frame') {
      const g = this.add.graphics().setDepth(depth + 1); g.lineStyle(6, P.red).strokeTriangle(x - 50, y + 13, x - 27, y - 17, x - 8, y + 13);
    }
    if (kind === 'handle') { const g = this.add.graphics().setDepth(depth + 1); g.lineStyle(6, P.blue).lineBetween(x - 44, y + 15, x - 34, y - 16).lineBetween(x - 48, y - 16, x - 19, y - 16); }
    if (kind === 'seat') this.add.rectangle(x - 32, y - 7, 34, 13, P.darkWood).setStrokeStyle(2, P.ink).setDepth(depth + 1);
    this.label(x + 7, y - 17, label, 11, '#3b2531', true).setDepth(depth + 2);
    this.label(x + 7, y + 6, locked ? 'LOCK' : ready ? 'READY ✓' : '1개 부족', 9, locked ? '#5d3b34' : ready ? '#3f7851' : '#a14a38', true).setDepth(depth + 2);
  }

  private renderMotion() {
    this.panel(195, 326, 326, 456, 0xf2c77e, 6);
    this.label(195, 104, 'MOTION WORKBENCH', 10, '#795044', true).setOrigin(.5).setDepth(8);
    this.label(195, 127, '짧은 4~8 프레임 감각 · 입력 차단 없음', 11, '#3b2531', true).setOrigin(.5).setDepth(8);

    const left = this.drawPartToken(120, 252, 1, 10);
    const right = this.drawPartToken(270, 252, 1, 10);
    const result = this.drawPartToken(195, 252, 2, 10).setVisible(false);
    const merge = () => {
      left.setVisible(true).setPosition(120, 252); right.setVisible(true).setPosition(270, 252); result.setVisible(false).setScale(1);
      this.tweens.add({ targets: left, x: 195, duration: 180, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: right, x: 195, duration: 180, ease: 'Quad.easeIn', onComplete: () => {
        left.setVisible(false); right.setVisible(false); result.setVisible(true);
        this.tweens.add({ targets: result, scaleX: 1.3, scaleY: .72, yoyo: true, duration: 90, onComplete: () => this.sparkle(195, 252) });
        this.updateStatus('MERGE · 360ms · 흡착 → 스쿼시 → 반짝임');
      }});
    };

    this.add.rectangle(195, 391, 238, 70, P.wood).setStrokeStyle(3, P.ink).setDepth(9);
    const wheel = this.add.circle(139, 386, 28, P.paper).setStrokeStyle(8, P.tire).setDepth(11);
    const frame = this.add.triangle(202, 390, 170, 412, 198, 360, 232, 412, P.red).setStrokeStyle(3, P.ink).setDepth(11);
    const mount = () => {
      wheel.setPosition(139, 350).setAlpha(.5); frame.setScale(.82).setAlpha(.5);
      this.tweens.add({ targets: wheel, y: 386, alpha: 1, duration: 240, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: frame, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut', onComplete: () => this.sparkle(195, 391) });
      this.updateStatus('장착 · 240ms · 낙하 → 체결 → 1회 반짝임');
    };

    this.drawBike(195, 515, .66, 10);
    const complete = () => {
      const curtain = this.add.rectangle(195, 515, 270, 112, P.cream, .92).setDepth(20).setScale(0, 1);
      this.tweens.add({ targets: curtain, scaleX: 1, duration: 130, yoyo: true, hold: 130, onYoyo: () => this.sparkle(195, 515), onComplete: () => curtain.destroy() });
      this.cameras.main.shake(90, .004);
      this.updateStatus('완성 · 390ms · 와이프 → 강조 → 즉시 복귀');
    };

    this.button(86, 623, 94, 46, 'MERGE', merge, true);
    this.button(195, 623, 94, 46, '장착', mount);
    this.button(304, 623, 94, 46, '완성', complete);
    this.panel(195, 704, 326, 62, P.pale, 12);
    this.statusText = this.label(195, 704, '버튼을 반복해 모션 길이와 피로도를 확인하세요.', 9, '#795044', true).setOrigin(.5).setDepth(14);
    this.panel(195, 766, 350, 40, P.wood, 15);
    this.label(195, 766, '모든 연출은 0.4초 이하 · 다음 입력을 막지 않음', 9, '#fff1c6', true).setOrigin(.5).setDepth(17);
  }

  private drawPartToken(x: number, y: number, level: number, depth: number) {
    const container = this.add.container(x, y).setDepth(depth);
    const shadow = this.add.rectangle(3, 4, 72, 72, P.darkWood);
    const box = this.add.rectangle(0, 0, 72, 72, level === 1 ? P.paper : P.gold).setStrokeStyle(3, P.ink);
    const icon = this.add.circle(0, -7, 17, level === 1 ? P.green : P.blue).setStrokeStyle(3, P.ink);
    const text = this.label(0, 19, `Lv.${level}`, 10, '#3b2531', true).setOrigin(.5);
    container.add([shadow, box, icon, text]);
    return container;
  }

  private sparkle(x: number, y: number) {
    [[-38, -28], [35, -23], [-30, 30], [42, 23]].forEach(([dx, dy], index) => {
      const star = this.label(x + dx, y + dy, '✦', 18, index % 2 ? '#fff1c6' : '#f4b84a', true).setOrigin(.5).setDepth(40).setScale(.2);
      this.tweens.add({ targets: star, scale: 1, alpha: 0, duration: 330, onComplete: () => star.destroy() });
    });
  }

  private updateStatus(message: string) { this.statusText?.setText(message); }

  private renderMusic() {
    this.panel(195, 354, 326, 510, 0xf2c77e, 6);
    this.label(195, 106, 'COZY GARAGE LOOP', 10, '#795044', true).setOrigin(.5).setDepth(8);
    this.label(195, 132, '80 BPM · 8 STEP · C MAJOR', 16, '#3b2531', true).setOrigin(.5).setDepth(8);
    this.drawRadio(195, 260, 9);
    this.drawMusicNotes();
    this.panel(195, 421, 276, 104, P.pale, 9);
    this.label(195, 395, '현재 공간', 9, '#795044', true).setOrigin(.5).setDepth(11);
    this.label(195, 421, this.musicRoom === 'HOME' ? '햇살 드는 Garage 홈' : '집중하는 Merge 작업대', 14, '#3b2531', true).setOrigin(.5).setDepth(11);
    this.label(195, 449, this.musicRoom === 'HOME' ? '부드러운 삼각파 · 여유 있는 베이스' : '짧은 사각파 · 한 단계 빠른 펄스', 9, '#795044').setOrigin(.5).setDepth(11);
    this.button(128, 510, 118, 44, 'HOME', () => this.setMusicRoom('HOME'), this.musicRoom === 'HOME');
    this.button(262, 510, 118, 44, 'WORK', () => this.setMusicRoom('WORK'), this.musicRoom === 'WORK');
    this.button(195, 591, 194, 58, this.musicPlaying ? '■  STOP' : '▶  PLAY MUSIC', () => this.toggleMusic(), true);
    this.panel(195, 671, 326, 62, P.paper, 12);
    this.statusText = this.label(195, 671, this.musicPlaying ? '재생 중 · HOME과 WORK를 전환해 보세요.' : '브라우저 정책에 따라 PLAY 후 소리가 시작됩니다.', 9, '#795044', true).setOrigin(.5).setDepth(14);
    this.label(195, 716, '절차 생성 데모 · 외부 음원/브랜드 자산 없음', 9, '#fff1c6', true).setOrigin(.5).setDepth(14);
    this.panel(195, 766, 350, 42, P.wood, 15);
    this.label(195, 766, '짧은 루프의 공간감 · 전환 자연스러움 · 반복 피로 검증', 9, '#fff1c6', true).setOrigin(.5).setDepth(17);
  }

  private drawRadio(x: number, y: number, depth: number) {
    this.add.rectangle(x + 5, y + 6, 226, 136, P.darkWood).setDepth(depth);
    this.add.rectangle(x, y, 226, 136, P.wood).setStrokeStyle(4, P.ink).setDepth(depth + 1);
    this.add.rectangle(x - 28, y - 24, 126, 40, P.cream).setStrokeStyle(3, P.ink).setDepth(depth + 2);
    [0, 1, 2, 3, 4].forEach((index) => this.add.rectangle(x - 74 + index * 23, y - 24, 5, 25 - index % 2 * 8, P.green).setDepth(depth + 3));
    this.add.circle(x + 67, y + 20, 29, P.paper).setStrokeStyle(5, P.ink).setDepth(depth + 2);
    this.add.circle(x + 67, y + 20, 8, P.gold).setStrokeStyle(3, P.ink).setDepth(depth + 3);
    this.label(x - 82, y + 36, 'GARAGE FM', 10, '#fff1c6', true).setDepth(depth + 3);
  }

  private drawMusicNotes() {
    ['♪', '♫', '♪'].forEach((note, index) => {
      const item = this.label(96 + index * 95, 330 - index % 2 * 18, note, 24, index === 1 ? '#c95746' : '#5e9a67', true).setOrigin(.5).setDepth(12);
      this.tweens.add({ targets: item, y: item.y - 10, yoyo: true, repeat: -1, duration: 700 + index * 150, ease: 'Sine.easeInOut' });
    });
  }

  private setMusicRoom(room: 'HOME' | 'WORK') {
    this.musicRoom = room;
    if (this.musicPlaying) {
      if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
      this.musicTimer = window.setInterval(() => this.playMusicStep(), room === 'HOME' ? 375 : 300);
    }
    this.render();
    if (this.musicPlaying) this.statusText?.setText(`${room} 변주 재생 중 · 전환 시 루프는 끊기지 않습니다.`);
  }

  private async toggleMusic() {
    if (this.musicPlaying) { this.stopAudio(); this.render(); return; }
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    this.musicPlaying = true;
    this.musicStep = 0;
    this.playMusicStep();
    this.musicTimer = window.setInterval(() => this.playMusicStep(), this.musicRoom === 'HOME' ? 375 : 300);
    this.render();
  }

  private playMusicStep() {
    if (!this.audioContext || !this.musicPlaying) return;
    const homeNotes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    const workNotes = [329.63, 392, 493.88, 392, 349.23, 440, 523.25, 440];
    const notes = this.musicRoom === 'HOME' ? homeNotes : workNotes;
    const now = this.audioContext.currentTime;
    this.tone(notes[this.musicStep % notes.length], .18, this.musicRoom === 'HOME' ? 'triangle' : 'square', .035, now);
    if (this.musicStep % 2 === 0) this.tone(notes[this.musicStep % notes.length] / 2, .32, 'triangle', .018, now);
    this.musicStep += 1;
  }

  private renderSfx() {
    this.panel(195, 349, 326, 500, 0xf2c77e, 6);
    this.label(195, 104, 'WORKSHOP SOUND BOARD', 10, '#795044', true).setOrigin(.5).setDepth(8);
    this.label(195, 128, '짧고 둥근 소리 · 행동별 음형 구분', 12, '#3b2531', true).setOrigin(.5).setDepth(8);
    const items = [
      ['TAP', '탭', 'tap'], ['BOX', '부품 생성', 'create'], ['MERGE', '머지', 'merge'],
      ['CLICK', '장착', 'mount'], ['BELL', '납품', 'delivery'], ['COIN', '보상', 'reward'],
    ] as const;
    items.forEach(([icon, label, sound], index) => {
      const x = 108 + (index % 2) * 174; const y = 207 + Math.floor(index / 2) * 113;
      this.drawSoundTile(x, y, icon, label, () => this.playSfx(sound), index, 9);
    });
    this.panel(195, 557, 326, 68, P.pale, 12);
    this.statusText = this.label(195, 557, '버튼을 눌러 성공 행동 6종의 구분감을 확인하세요.', 9, '#795044', true).setOrigin(.5).setDepth(14);

    this.label(52, 616, 'SOUND SHAPE', 9, '#fff1c6', true).setDepth(14);
    const wave = this.add.graphics().setDepth(14); wave.lineStyle(4, P.gold);
    const points = [0, 7, -12, 20, -25, 16, -9, 6, 0, -5, 3, 0];
    points.forEach((value, index) => { const x = 52 + index * 26; const y = 671 + value; if (index === 0) wave.moveTo(x, y); else wave.lineTo(x, y); });
    wave.strokePath();
    this.panel(195, 752, 350, 76, P.wood, 15);
    this.label(195, 738, 'HOME A안의 포근함을 유지하는 낮은 음량과 짧은 감쇠', 9, '#fff1c6', true).setOrigin(.5).setDepth(17);
    this.label(195, 761, '연속 입력에서도 피로하지 않은지 반복해서 비교', 9, '#fff1c6').setOrigin(.5).setDepth(17);
  }

  private drawSoundTile(x: number, y: number, icon: string, caption: string, action: () => void, index: number, depth: number) {
    this.add.rectangle(x + 4, y + 5, 142, 88, P.darkWood).setDepth(depth);
    const tile = this.add.rectangle(x, y, 142, 88, index % 3 === 0 ? P.pale : P.paper).setStrokeStyle(3, P.ink).setDepth(depth + 1).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.label(x - 45, y - 16, icon, 9, '#795044', true).setDepth(depth + 2).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.label(x - 45, y + 6, ['●', '▣', '◆', '⌁', '♬', '✦'][index], 20, index % 2 ? '#4e8092' : '#c95746', true).setDepth(depth + 2).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.label(x - 7, y - 2, caption, 11, '#3b2531', true).setDepth(depth + 2).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.label(x - 7, y + 20, '눌러 듣기', 8, '#795044').setDepth(depth + 2);
    tile.on('pointerdown', () => this.tweens.add({ targets: tile, scale: .94, yoyo: true, duration: 80 }));
  }

  private async playSfx(kind: 'tap' | 'create' | 'merge' | 'mount' | 'delivery' | 'reward') {
    if (!this.audioContext) this.audioContext = new AudioContext();
    await this.audioContext.resume();
    const now = this.audioContext.currentTime;
    if (kind === 'tap') this.tone(420, .07, 'sine', .05, now);
    if (kind === 'create') { this.tone(220, .09, 'square', .035, now); this.tone(330, .1, 'triangle', .035, now + .07); }
    if (kind === 'merge') { this.tone(330, .1, 'triangle', .045, now); this.tone(494, .15, 'triangle', .05, now + .09); }
    if (kind === 'mount') { this.tone(180, .05, 'square', .045, now); this.tone(120, .06, 'square', .035, now + .055); }
    if (kind === 'delivery') { this.tone(523.25, .14, 'sine', .045, now); this.tone(659.25, .18, 'sine', .04, now + .12); }
    if (kind === 'reward') { [523.25, 659.25, 783.99].forEach((frequency, index) => this.tone(frequency, .12, 'triangle', .04, now + index * .08)); }
    const names = { tap: '탭 · 짧은 목재 톡', create: '부품 생성 · 상자 팝', merge: '머지 · 상승하는 두 음', mount: '장착 · 짧은 체결 클릭', delivery: '납품 · 맑은 벨 두 음', reward: '보상 · 동전 상승 세 음' };
    this.statusText?.setText(names[kind]);
    this.sparkle(195, 557);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, start: number) {
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  private stopAudio() {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.musicPlaying = false;
    const context = this.audioContext;
    this.audioContext = undefined;
    if (context && context.state !== 'closed') void context.close();
  }

  private drawBike(x: number, y: number, scale: number, depth: number) {
    const g = this.add.graphics().setDepth(depth);
    const rear = x - 72 * scale; const front = x + 72 * scale; const wheelY = y + 36 * scale; const radius = 34 * scale;
    g.lineStyle(8 * scale, P.tire).strokeCircle(rear, wheelY, radius).strokeCircle(front, wheelY, radius);
    g.lineStyle(4 * scale, P.cream).strokeCircle(rear, wheelY, radius - 7 * scale).strokeCircle(front, wheelY, radius - 7 * scale);
    g.lineStyle(8 * scale, P.red).lineBetween(rear, wheelY, x - 21 * scale, y - 27 * scale).lineBetween(x - 21 * scale, y - 27 * scale, x, wheelY).lineBetween(x, wheelY, rear, wheelY).lineBetween(x - 21 * scale, y - 27 * scale, x + 41 * scale, y - 20 * scale).lineBetween(x + 41 * scale, y - 20 * scale, x, wheelY).lineBetween(x + 41 * scale, y - 20 * scale, front, wheelY);
  }

  private drawCoin(x: number, y: number, depth: number) { this.add.circle(x, y, 15, P.gold).setStrokeStyle(3, P.ink).setDepth(depth); this.label(x, y, 'C', 9, '#795044', true).setOrigin(.5).setDepth(depth + 1); }
  private drawEnergy(x: number, y: number, depth: number) { this.add.triangle(x, y, x, y - 18, x - 14, y + 5, x + 2, y + 5, P.green).setStrokeStyle(3, P.ink).setDepth(depth); }
  private drawBadge(x: number, y: number, depth: number) { this.add.rectangle(x, y, 28, 28, P.red).setAngle(45).setStrokeStyle(3, P.ink).setDepth(depth); this.label(x, y, '12', 8, '#fff1c6', true).setOrigin(.5).setDepth(depth + 1); }
}

export function startArtAudioPrototype(parent: string, mode: ArtAudioPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO, parent, width: 390, height: 810, backgroundColor: '#fff1c6',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new WarmPixelArtAudioScene(mode), render: { antialias: false, pixelArt: true, roundPixels: true },
  });
}
