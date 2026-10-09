// 체력 소진 안내 패널과 Lab 가짜 보상형 광고 (#263 · Phaser)
// 작업대(E v3) 위에 겹쳐 띄우며, 열려 있는 동안 뒤쪽 보드·버튼 입력을 막습니다.
// 가짜 광고는 RewardedAdAdapter와 같은 결과(completed·failed·dismissed)를 버튼으로 골라 돌려줍니다.
import Phaser from 'phaser';
import { AD_REFILL_AMOUNT, REFILL_POLICIES, type RefillMode, type RefillStatus, type RewardedAdResult } from './energy-refill';
import { BORDER, BROWN, CREAM, CREAM_TEXT, GOLD, GREEN, INK, MUTED, RED, SUCCESS, textStyle } from './merge-play-screen';

export type RestTarget = 'catalog' | 'dream';

export type RefillPanelView = {
  mode: RefillMode;
  status: RefillStatus;
  nextLabel: string; // 다음 +1까지
  fullLabel: string; // 가득 찰 때까지
};

export type RefillPanelHandlers = {
  onAd(): void;
  onFree(): void;
  onRest(target: RestTarget): void;
  onHome(): void;
  onClose(): void;
};

const PANEL = { x: 195, y: 440, w: 340, h: 340 };

export class EnergyRefillPanel {
  private layer?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {}

  get open() { return Boolean(this.layer); }

  hide() {
    this.layer?.destroy(true);
    this.layer = undefined;
  }

  private base(title: string, lines: string[]) {
    this.hide();
    const items: Phaser.GameObjects.GameObject[] = [
      // 화면 전체를 덮는 어두운 막: 뒤쪽 입력을 막습니다.
      this.scene.add.rectangle(195, 405, 390, 810, 0x1d1016, 0.55).setInteractive(),
      this.scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, CREAM).setStrokeStyle(4, BORDER),
      this.scene.add.rectangle(PANEL.x, PANEL.y - PANEL.h / 2 + 4, PANEL.w, 8, RED),
      this.scene.add.text(PANEL.x, PANEL.y - 138, title, textStyle(16, INK)).setOrigin(0.5),
    ];
    lines.forEach((line, index) => items.push(this.scene.add.text(PANEL.x, PANEL.y - 108 + index * 20, line, { ...textStyle(11, MUTED, index > 0), align: 'center' }).setOrigin(0.5)));
    this.layer = this.scene.add.container(0, 0, items).setDepth(60);
    return this.layer;
  }

  private button(y: number, label: string, fill: number, textColor: string, enabled: boolean, handler: () => void, height = 44, width = 280) {
    const rect = this.scene.add.rectangle(PANEL.x, y, width, height, enabled ? fill : 0xe8d3a6).setStrokeStyle(3, enabled ? BORDER : 0xb08a6a);
    const text = this.scene.add.text(PANEL.x, y, label, { ...textStyle(12, enabled ? textColor : MUTED), align: 'center' }).setOrigin(0.5);
    if (enabled) rect.setInteractive({ useHandCursor: true }).on('pointerdown', handler);
    this.layer?.add([rect, text]);
  }

  /** 체력 소진 안내. 방안(mode)에 따라 버튼 구성이 다릅니다. */
  show(view: RefillPanelView, handlers: RefillPanelHandlers) {
    const { adsLeft, freeLeft } = view.status;
    const adsPerDay = REFILL_POLICIES[view.mode].adsPerDay;
    const adLabel = adsLeft > 0 ? `▶ 광고 보고 체력 +${AD_REFILL_AMOUNT} (오늘 ${adsLeft}/${adsPerDay})` : '오늘 광고 충전을 모두 썼어요';
    const recovery = `다음 +1 ${view.nextLabel} · 가득 참까지 ${view.fullLabel}`;
    if (view.mode === 'rest') {
      this.base('잠깐 쉬어 갈 시간이에요', ['알바 체력이 바닥났어요', recovery, '체력이 차는 동안 할 수 있는 일']);
      this.button(PANEL.y - 18, '📖 자전거 도감 보기', GOLD, INK, true, () => handlers.onRest('catalog'));
      this.button(PANEL.y + 34, '🔧 드림 바이크 강화하기', GOLD, INK, true, () => handlers.onRest('dream'));
      this.button(PANEL.y + 92, adLabel, BROWN, CREAM_TEXT, adsLeft > 0, handlers.onAd, 34, 260);
      this.button(PANEL.y + 136, '닫기', CREAM, INK, true, handlers.onClose, 30, 120);
      return;
    }
    this.base('알바 체력이 바닥났어요', ['같은 Day는 체력이 차면 이어서 할 수 있어요', recovery]);
    let y = PANEL.y - 30;
    if (view.mode === 'daily') {
      this.button(y, freeLeft > 0 ? '🎁 오늘 무료 충전 · 체력 가득' : '오늘 무료 충전을 썼어요', GREEN, CREAM_TEXT, freeLeft > 0, handlers.onFree);
      y += 56;
    }
    this.button(y, adLabel, view.mode === 'daily' ? BROWN : GREEN, CREAM_TEXT, adsLeft > 0, handlers.onAd);
    y += 56;
    this.button(y, '🏠 홈으로', GOLD, INK, true, handlers.onHome);
    this.button(PANEL.y + 136, '닫기', CREAM, INK, true, handlers.onClose, 30, 120);
  }

  /** Lab 가짜 보상형 광고: 결과를 직접 고릅니다. 실제 광고 SDK는 메인에서 같은 결과 형식으로 연결합니다. */
  showMockAd(): Promise<RewardedAdResult> {
    return new Promise((resolve) => {
      this.base('광고 재생 중 (Lab 가짜 광고)', ['실제 광고 대신 결과를 골라 흐름을 확인합니다', '끝까지 본 경우에만 체력을 받아요']);
      const done = (result: RewardedAdResult) => { this.hide(); resolve(result); };
      this.button(PANEL.y - 18, '✓ 끝까지 시청 (completed)', GREEN, CREAM_TEXT, true, () => done('completed'));
      this.button(PANEL.y + 38, '✕ 불러오기 실패 (failed)', RED, CREAM_TEXT, true, () => done('failed'));
      this.button(PANEL.y + 94, '— 중간에 닫기 (dismissed)', BROWN, CREAM_TEXT, true, () => done('dismissed'));
      this.layer?.add(this.scene.add.text(PANEL.x, PANEL.y + 140, 'Lab 전용 · 메인에서는 앱인토스 광고 SDK로 교체', textStyle(9, SUCCESS, false)).setOrigin(0.5));
    });
  }
}
